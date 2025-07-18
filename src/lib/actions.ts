'use server';

import { db, storage } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject, listAll } from 'firebase/storage';
import JSZip from 'jszip';
import * as xlsx from 'xlsx';
import type { School, TemplateConfig } from '@/lib/types';
import { generateIDCardPDF } from './utils';

export async function processBulkUpload(formData: FormData) {
    const excelFile = formData.get('excelFile') as File | null;
    const zipFile = formData.get('zipFile') as File | null;
    const schoolId = formData.get('schoolId') as string | null;

    if (!excelFile || !zipFile || !schoolId) {
        return { success: false, error: 'Missing required form data.' };
    }
    if (!db || !storage) {
        return { success: false, error: 'Firebase is not configured on the server.' };
    }

    const uploadTimestamp = Date.now();
    const tempFolderPath = `schools/${schoolId}/bulk_uploads/${uploadTimestamp}`;
    const excelPath = `${tempFolderPath}/${excelFile.name}`;
    const zipPath = `${tempFolderPath}/${zipFile.name}`;

    try {
        // Upload temporary files using client-side Firebase
        const excelStorageRef = ref(storage, excelPath);
        const zipStorageRef = ref(storage, zipPath);

        await Promise.all([
            uploadBytes(excelStorageRef, excelFile),
            uploadBytes(zipStorageRef, zipFile),
        ]);

        // Get school template configuration
        const schoolDocRef = doc(db, 'schools', schoolId);
        const schoolDocSnap = await getDoc(schoolDocRef);
        if (!schoolDocSnap.exists() || !schoolDocSnap.data()?.templateConfig) {
            throw new Error('Template configuration not found for this school.');
        }
        const school = schoolDocSnap.data() as School;
        const config = school.templateConfig as TemplateConfig;

        if (!config.templateImagePath) {
            throw new Error('School template image path is not configured.');
        }

        // Get template image
        const templateUrl = await getDownloadURL(ref(storage, config.templateImagePath));
        const templateResponse = await fetch(templateUrl);
        const templateBuffer = await templateResponse.arrayBuffer();

        // Read Excel file
        const excelUrl = await getDownloadURL(excelStorageRef);
        const excelResponse = await fetch(excelUrl);
        const excelBuffer = await excelResponse.arrayBuffer();
        const workbook = xlsx.read(excelBuffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const studentData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]) as any[];

        // Extract photos from ZIP
        const zipUrl = await getDownloadURL(zipStorageRef);
        const zipResponse = await fetch(zipUrl);
        const zipBuffer = await zipResponse.arrayBuffer();
        const zip = await JSZip.loadAsync(zipBuffer);
        const photos: { [key: string]: ArrayBuffer } = {};
        
        for (const fileName in zip.files) {
            if (!zip.files[fileName].dir && (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg') || fileName.endsWith('.png'))) {
                const photoBuffer = await zip.files[fileName].async('arraybuffer');
                const rollNo = fileName.split('/').pop()?.split('.')[0] ?? '';
                if (rollNo) photos[rollNo] = photoBuffer;
            }
        }

        let processedCount = 0;
        let skippedCount = 0;

        // Process each student
        for (const student of studentData) {
            const rollNo = student.rollNo || student.RollNo || student.roll_no;
            const photoBuffer = photos[rollNo];
            
            if (!photoBuffer) {
                console.warn(`Photo not found for roll number: ${rollNo}, skipping this entry.`);
                skippedCount++;
                continue;
            }

            try {
                // Generate PDF for this student
                const pdfBytes = await generateIDCardPDF(config, student, templateBuffer, photoBuffer);

                // Create unique ID for this student
                const uniqueId = rollNo ? `${rollNo}-${Date.now()}-${processedCount}` : `bulk-${Date.now()}-${processedCount}`;

                // Upload PDF to Firebase Storage
                const pdfPath = `schools/${schoolId}/pdfs/${uniqueId}/id_card.pdf`;
                const pdfStorageRef = ref(storage, pdfPath);
                const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
                const pdfSnapshot = await uploadBytes(pdfStorageRef, pdfBlob);
                const pdfUrl = await getDownloadURL(pdfSnapshot.ref);

                // Save student data to Firestore
                const studentDocRef = doc(db, `schools/${schoolId}/students`, uniqueId);
                await setDoc(studentDocRef, {
                    ...student,
                    pdfUrl,
                    submittedAt: new Date(),
                    status: "submitted",
                    source: "bulk_upload",
                    batchId: uploadTimestamp,
                });

                processedCount++;
                console.log(`✅ Processed student: ${rollNo} (${student.name || 'Unknown'})`);

            } catch (error) {
                console.error(`❌ Failed to process student ${rollNo}:`, error);
                skippedCount++;
            }
        }

        return { 
            success: true, 
            processedCount, 
            skippedCount,
            message: `Successfully processed ${processedCount} students. ${skippedCount} students were skipped due to missing photos or errors.`
        };

    } catch (error) {
        console.error('Bulk upload processing failed:', error);
        return { success: false, error: error instanceof Error ? error.message : 'An unknown error occurred during processing.' };
    } finally {
        // Clean up temporary files
        try {
            await deleteObject(ref(storage, excelPath));
            await deleteObject(ref(storage, zipPath));
            console.log('✅ Temporary files cleaned up successfully');
        } catch (cleanupError) {
            console.error("Failed to cleanup temporary files. Manual cleanup may be required:", cleanupError);
        }
    }
}
