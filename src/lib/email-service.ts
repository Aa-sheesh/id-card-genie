import { getAdminServices } from './firebase-admin';
import ExcelJS from 'exceljs';
import archiver from 'archiver';
import stream from 'stream';
import * as SibApiV3Sdk from '@sendinblue/client';

// Email configuration
// REMOVE nodemailer and Gmail logic
// REMOVE: import nodemailer from 'nodemailer';
// REMOVE: const createTransporter = () => { ... } (lines 8-15)

const brevo = new SibApiV3Sdk.TransactionalEmailsApi();
const brevoApiKey = process.env.BREVO_API_KEY || '';
brevo.setApiKey(SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey, brevoApiKey);

export async function sendBrevoEmail({ to, subject, html, attachments }: { to: string, subject: string, html: string, attachments?: Array<{ content: string, name: string }> }) {
  try {
    const emailData = {
      sender: { name: 'ID Card Genie', email: process.env.SENDER_NOTIFICATION_EMAIL || '' },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      attachment: attachments,
    };
    console.log('BREVO_API_KEY:', process.env.BREVO_API_KEY ? '[SET]' : '[NOT SET]');
    console.log('SENDER_NOTIFICATION_EMAIL:', process.env.SENDER_NOTIFICATION_EMAIL);
    console.log('RECIEVER_NOTIFICATION_EMAIL:', process.env.RECIEVER_NOTIFICATION_EMAIL);
    console.log('Sending email with:', emailData);
    await brevo.sendTransacEmail(emailData);
    console.log('Email sent successfully');
  } catch (error) {
    console.error('Error sending email via Brevo:', error);
    throw error;
  }
}

// Interface for image data
interface ImageData {
  id: string;
  studentName: string;
  schoolName: string;
  downloadUrl: string;
  createdAt: Date;
}

// Get new images from the last 7 days, optionally for a specific school
export const getNewImages = async (schoolIdFilter?: string): Promise<ImageData[]> => {
  console.log('🔍 Starting getNewImages function...');
  
  try {
    // Use Firebase Admin SDK for server-side operations
    const adminServices = getAdminServices();
    const db = adminServices.db;
    const storage = adminServices.storage;
    
    // Get students created in the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    console.log('📅 Searching for students created after:', sevenDaysAgo.toISOString());
    
    // Query all schools and their students
    const images: ImageData[] = [];
    let schoolsToProcess: { id: string, data: unknown }[] = [];
    if (schoolIdFilter) {
      // Only process the specified school
      const schoolDoc = await db.collection('schools').doc(schoolIdFilter).get();
      if (schoolDoc.exists) {
        schoolsToProcess = [{ id: schoolDoc.id, data: schoolDoc.data() }];
      } else {
        console.warn('No school found with id', schoolIdFilter);
        return images;
      }
    } else {
      // Process all schools
      const schoolsRef = db.collection('schools');
      const schoolsSnapshot = await schoolsRef.get();
      schoolsToProcess = schoolsSnapshot.docs.map(doc => ({ id: doc.id, data: doc.data() }));
    }

    for (const school of schoolsToProcess) {
      const schoolData = school.data;
      const schoolId = school.id;
      const schoolName = (schoolData as { name?: string }).name || 'Unknown School';
      console.log(`🔍 Checking students for school: ${schoolName}`);
      const studentsRef = db.collection(`schools/${schoolId}/students`);
      const q = studentsRef
        .where('submittedAt', '>=', sevenDaysAgo)
        .orderBy('submittedAt', 'desc');
      try {
        const querySnapshot = await q.get();
        console.log(`📊 Found ${querySnapshot.docs.length} students in ${schoolName} in the last 7 days`);
        for (const doc of querySnapshot.docs) {
          const studentData = doc.data();
          console.log('📄 Processing student:', studentData.name, '- Image URL:', studentData.imageUrl ? '✅ Has Image' : '❌ No Image');
          if (studentData.imageUrl) {
            try {
              const bucketName = 'malik-studio-photo.firebasestorage.app';
              console.log('🪣 Using bucket name:', bucketName);
              const bucket = storage.bucket(bucketName);
              let filePath = studentData.imageUrl;
              if (filePath.includes('firebasestorage.googleapis.com')) {
                const url = new URL(filePath);
                const pathMatch = url.pathname.match(/\/o\/(.+)/);
                if (pathMatch) {
                  filePath = decodeURIComponent(pathMatch[1]);
                }
              } else if (filePath.startsWith('https://')) {
                const url = new URL(filePath);
                filePath = url.pathname.replace(/^\//, '');
              }
              console.log('📁 Original Image URL:', studentData.imageUrl);
              console.log('📁 Using file path:', filePath);
              const file = bucket.file(filePath);
              const [downloadUrl] = await file.getSignedUrl({
                action: 'read',
                expires: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
              });
              images.push({
                id: doc.id,
                studentName: studentData.name || 'Unknown Student',
                schoolName: schoolName,
                downloadUrl,
                createdAt: studentData.submittedAt?.toDate() || new Date(),
              });
              console.log('✅ Added Image for:', studentData.name);
            } catch (error) {
              console.error('❌ Error getting download URL for:', studentData.name, error);
            }
          }
        }
      } catch (error) {
        console.error(`❌ Error querying students for school ${schoolName}:`, error);
      }
    }
    console.log('📊 Total Images found:', images.length);
    return images;
  } catch (error) {
    console.error('❌ Error fetching new images:', error);
    console.error('❌ Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    return [];
  }
};

// Helper: Upload a buffer to storage and return the public URL
async function uploadBufferToStorage(schoolId: string, fileName: string, buffer: Buffer, contentType: string): Promise<string> {
  const { storage } = getAdminServices();
  const bucket = storage.bucket('malik-studio-photo.firebasestorage.app');
  const file = bucket.file(`schools/${schoolId}/images/${fileName}`);
  await file.save(buffer, { contentType });
  // Get signed URL (valid for 24h)
  const [url] = await file.getSignedUrl({ action: 'read', expires: Date.now() + 24 * 60 * 60 * 1000 });
  return url;
}

// Generate ZIP file containing all images for a school
export async function generateSchoolImagesZip(schoolId: string): Promise<{ zipBuffer: Buffer, fileNames: string[] }> {
  const { storage } = getAdminServices();
  const bucket = storage.bucket('malik-studio-photo.firebasestorage.app');
  console.log(`[ZIP] Fetching files for school: ${schoolId}`);
  const [files] = await bucket.getFiles({ prefix: `schools/${schoolId}/images/` });
  console.log(`[ZIP] Found ${files.length} files in storage`);
  const imageFiles = files.filter(f => !f.name.endsWith('.xlsx') && !f.name.endsWith('.zip'));
  console.log(`[ZIP] ${imageFiles.length} image files to process`);

  const archive = archiver('zip', { zlib: { level: 9 } });
  const zipChunks: Buffer[] = [];
  const passThrough = new stream.PassThrough();
  passThrough.on('data', chunk => zipChunks.push(chunk));
  archive.pipe(passThrough);

  let archiveError: Error | null = null;
  let streamError: Error | null = null;

  // Attach all event listeners BEFORE finalizing
  const zipPromise = new Promise<void>((resolve, reject) => {
    passThrough.once('close', () => {
      console.log('[ZIP] PassThrough close event (resolve)');
      resolve();
    });
    passThrough.once('error', (err) => {
      console.error('[ZIP] PassThrough stream error:', err);
      streamError = err;
      reject(err);
    });
    archive.once('error', (err) => {
      console.error('[ZIP] Archive error:', err);
      archiveError = err;
      reject(err);
    });
  });

  archive.on('finish', () => {
    console.log('[ZIP] Archive finish event fired');
  });
  archive.on('end', () => {
    console.log('[ZIP] Archive end event fired');
  });
  archive.on('close', () => {
    console.log('[ZIP] Archive close event fired');
  });
  passThrough.on('end', () => {
    console.log('[ZIP] PassThrough end event fired');
  });

  // Add images
  for (const file of imageFiles) {
    const fileName = file.name.split('/').pop() || file.name;
    try {
      console.log(`[ZIP] Downloading file: ${file.name}`);
      const [fileBuffer] = await file.download();
      console.log(`[ZIP] Downloaded file: ${file.name} (${fileBuffer.length} bytes)`);
      archive.append(fileBuffer, { name: fileName });
      console.log(`[ZIP] Appended file to archive: ${fileName}`);
    } catch (err) {
      console.error(`[ZIP] Error downloading/appending file: ${file.name}`, err);
    }
  }
  // Add Excel file
  try {
    const excelBuffer = await generateSchoolImagesExcel(schoolId);
    archive.append(excelBuffer, { name: 'images-list.xlsx' });
    console.log('[ZIP] Appended Excel file to archive: images-list.xlsx');
  } catch (err) {
    console.error('[ZIP] Error generating/appending Excel file:', err);
  }

  console.log('[ZIP] Finalizing archive...');
  await archive.finalize();
  await zipPromise;

  if (archiveError) throw archiveError;
  if (streamError) throw streamError;
  console.log('[ZIP] Archive finalized. Returning buffer.');
  return { zipBuffer: Buffer.concat(zipChunks), fileNames: imageFiles.map(f => f.name.split('/').pop() || f.name) };
}

// Generate ZIP file containing all images for all schools (with subfolders)
export async function generateAllSchoolsZip(): Promise<{ zipBuffer: Buffer, fileNames: string[] }> {
  const { storage, db } = getAdminServices();
  const bucket = storage.bucket('malik-studio-photo.firebasestorage.app');
  const schoolsSnapshot = await db.collection('schools').get();
  const archive = archiver('zip', { zlib: { level: 9 } });
  const zipChunks: Buffer[] = [];
  const passThrough = new stream.PassThrough();
  passThrough.on('data', chunk => zipChunks.push(chunk));
  archive.pipe(passThrough);

  let archiveError: Error | null = null;
  let streamError: Error | null = null;
  const zipPromise = new Promise<void>((resolve, reject) => {
    passThrough.once('close', resolve);
    passThrough.once('error', (err) => { streamError = err; reject(err); });
    archive.once('error', (err) => { archiveError = err; reject(err); });
  });

  for (const schoolDoc of schoolsSnapshot.docs) {
    const schoolId = schoolDoc.id;
    const [files] = await bucket.getFiles({ prefix: `schools/${schoolId}/images/` });
    const imageFiles = files.filter(f => !f.name.endsWith('.xlsx') && !f.name.endsWith('.zip'));
    // Add images
    for (const file of imageFiles) {
      const fileName = `schools/${schoolId}/images/${file.name.split('/').pop() || file.name}`;
      try {
        const [fileBuffer] = await file.download();
        archive.append(fileBuffer, { name: fileName });
      } catch (err) {
        console.error(`[ZIP] Error downloading/appending file: ${file.name}`, err);
  }
    }
    // Add Excel for this school
    try {
      const excelBuffer = await generateSchoolImagesExcel(schoolId);
      archive.append(excelBuffer, { name: `schools/${schoolId}/images-list.xlsx` });
      console.log(`[ZIP] Appended Excel file for school ${schoolId}`);
    } catch (err) {
      console.error(`[ZIP] Error generating/appending Excel for school ${schoolId}:`, err);
    }
  }
  await archive.finalize();
  await zipPromise;
  if (archiveError) throw archiveError;
  if (streamError) throw streamError;
  return { zipBuffer: Buffer.concat(zipChunks), fileNames: [] };
}

// Upload the global ZIP to storage and return a signed URL
async function uploadGlobalZipToStorage(buffer: Buffer): Promise<string> {
  const { storage } = getAdminServices();
  const bucket = storage.bucket('malik-studio-photo.firebasestorage.app');
  const file = bucket.file('schools/all-schools.zip');
  await file.save(buffer, { contentType: 'application/zip' });
  const [url] = await file.getSignedUrl({ action: 'read', expires: Date.now() + 24 * 60 * 60 * 1000 });
  return url;
}

// Send email with Excel attachment and ZIP link for a school
export const sendImagesEmail = async (schoolId: string | undefined, images: ImageData[]): Promise<boolean> => {
  const recipientEmail = process.env.RECIEVER_NOTIFICATION_EMAIL;
  if (!recipientEmail) {
    console.error('❌ Email config missing', {
      BREVO_API_KEY: process.env.BREVO_API_KEY ? '[SET]' : '[NOT SET]',
      SENDER_NOTIFICATION_EMAIL: process.env.SENDER_NOTIFICATION_EMAIL,
      RECIEVER_NOTIFICATION_EMAIL: process.env.RECIEVER_NOTIFICATION_EMAIL,
    });
    return false;
  }

  let downloadUrl = '';
  let htmlContent = '';
  let attachments = undefined;
  let subject = '';

  if (schoolId) {
    // Per-school: generate/upload ZIP and email link
    const { zipBuffer } = await generateSchoolImagesZip(schoolId);
    const { storage } = getAdminServices();
    const bucket = storage.bucket('malik-studio-photo.firebasestorage.app');
    const file = bucket.file(`schools/${schoolId}/images/${schoolId}-images.zip`);
    await file.save(zipBuffer, { contentType: 'application/zip' });
    const [url] = await file.getSignedUrl({ action: 'read', expires: Date.now() + 24 * 60 * 60 * 1000 });
    downloadUrl = url;
    subject = `ID Card Genie - Images Download Link`;
    htmlContent = `
      <h2>ID Card Images</h2>
      <p>Click the link below to download all images for this school as a ZIP file (includes Excel).</p>
      <p><a href="${downloadUrl}" target="_blank">Download All Images (ZIP)</a></p>
      <hr>
      <p><small>This is an automated email from ID Card Genie system.</small></p>
    `;
    // Attach the ZIP as well (optional, can comment out if not needed)
    const zipBase64 = zipBuffer.toString('base64');
    attachments = [{ content: zipBase64, name: `${schoolId}-images.zip` }];
  } else {
    // Global: just send the Firebase Storage /schools folder link
    const firebaseFolderUrl = 'https://console.firebase.google.com/project/malik-studio-photo/storage/malik-studio-photo.firebasestorage.app/files/schools';
    subject = `ID Card Genie - Images Download Link (All Schools)`;
    htmlContent = `
      <h2>ID Card Images</h2>
      <p>Here is the link to all school folders in Firebase Storage. Please log in with your admin account to access and download files.</p>
      <p><a href="${firebaseFolderUrl}" target="_blank">${firebaseFolderUrl}</a></p>
      <hr>
      <p><small>This is an automated email from ID Card Genie system.</small></p>
    `;
  }

  try {
    await sendBrevoEmail({ to: recipientEmail, subject, html: htmlContent, attachments });
    return true;
  } catch (error) {
    console.error('❌ Error sending email via Brevo:', error);
    return false;
  }
};

// Check for new images and send email notification (per school or all schools)
export const checkAndSendImages = async (schoolId?: string): Promise<void> => {
  console.log('🔍 Starting checkAndSendImages function...');
  if (schoolId) {
    // Single school
    const images = await getNewImages(schoolId);
    console.log(`📊 Found ${images.length} new images for school ${schoolId}`);
    if (images.length > 0) {
      const emailSent = await sendImagesEmail(schoolId, images);
      if (emailSent) {
        console.log('✅ Email notification sent successfully');
      } else {
        console.error('❌ Failed to send email notification');
      }
    } else {
      console.log('📭 No new images to send');
    }
  } else {
    // Global: send only one email with the /schools root link
    await sendImagesEmail(undefined, []);
    console.log('✅ Global email notification sent with /schools link');
  }
};

// Delete all images and student docs for a school or all schools
export const deleteAllImages = async (schoolIdFilter?: string): Promise<{deletedCount: number, errors: string[]}> => {
  console.log('🗑️ Starting deleteAllImages', schoolIdFilter ? `for schoolId: ${schoolIdFilter}` : 'for all schools');
  const adminServices = getAdminServices();
  const db = adminServices.db;
  const storage = adminServices.storage;
  let deletedCount = 0;
  const errors: string[] = [];
  let schoolsToProcess: { id: string, data: unknown }[] = [];
  if (schoolIdFilter) {
    const schoolDoc = await db.collection('schools').doc(schoolIdFilter).get();
    if (schoolDoc.exists) {
      schoolsToProcess = [{ id: schoolDoc.id, data: schoolDoc.data() }];
    } else {
      return { deletedCount, errors: [`No school found with id ${schoolIdFilter}`] };
    }
  } else {
    const schoolsRef = db.collection('schools');
    const schoolsSnapshot = await schoolsRef.get();
    schoolsToProcess = schoolsSnapshot.docs.map(doc => ({ id: doc.id, data: doc.data() }));
  }
  for (const school of schoolsToProcess) {
    const schoolId = school.id;
    const studentsRef = db.collection(`schools/${schoolId}/students`);
    const studentsSnapshot = await studentsRef.get();
    for (const doc of studentsSnapshot.docs) {
      const studentData = doc.data();
      // Delete image from storage if present
      if (studentData.imageUrl) {
        try {
          const bucketName = 'malik-studio-photo.firebasestorage.app';
          const bucket = storage.bucket(bucketName);
          let filePath = studentData.imageUrl;
          if (filePath.includes('firebasestorage.googleapis.com')) {
            const url = new URL(filePath);
            const pathMatch = url.pathname.match(/\/o\/(.+)/);
            if (pathMatch) {
              filePath = decodeURIComponent(pathMatch[1]);
            }
          } else if (filePath.startsWith('https://')) {
            const url = new URL(filePath);
            filePath = url.pathname.replace(/^\//, '');
          }
          const file = bucket.file(filePath);
          await file.delete();
          deletedCount++;
        } catch (error) {
          errors.push(`Failed to delete image for student ${doc.id} in school ${schoolId}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      // Delete student doc
      try {
        await doc.ref.delete();
  } catch (error) {
        errors.push(`Failed to delete student doc ${doc.id} in school ${schoolId}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
  return { deletedCount, errors };
}; 

// Generate Excel file listing all images for a school
export async function generateSchoolImagesExcel(schoolId: string): Promise<Buffer> {
  const { storage } = getAdminServices();
  const bucket = storage.bucket('malik-studio-photo.firebasestorage.app');
  const [files] = await bucket.getFiles({ prefix: `schools/${schoolId}/images/` });
  const imageFiles = files.filter(f => !f.name.endsWith('.xlsx') && !f.name.endsWith('.zip'));

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Images');
  worksheet.columns = [
    { header: 'S.No.', key: 'sno', width: 10 },
    { header: 'Image', key: 'image', width: 40 },
  ];
  imageFiles.forEach((file, idx) => {
    worksheet.addRow({ sno: idx + 1, image: file.name.split('/').pop() });
  });
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
} 