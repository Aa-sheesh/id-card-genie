import nodemailer from 'nodemailer';
import { getAdminServices } from './firebase-admin';
import ExcelJS from 'exceljs';
import archiver from 'archiver';
import stream from 'stream';

// Email configuration
const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail', // or your email service
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD, // Use app password for Gmail
    },
  });
};

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
    let schoolsToProcess: { id: string, data: any }[] = [];
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
      const schoolName = schoolData.name || 'Unknown School';
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

// Send email with Excel attachment and ZIP link for a school
export const sendImagesEmail = async (schoolId: string, images: ImageData[]): Promise<boolean> => {
  console.log('🔍 Starting sendImagesEmail for school:', schoolId);
  if (images.length === 0) {
    console.log('No new images to send');
    return true;
  }
  const recipientEmail = process.env.NOTIFICATION_EMAIL;
  const emailUser = process.env.EMAIL_USER;
  const emailPassword = process.env.EMAIL_PASSWORD;
  console.log('Preparing to send email...');
  if (!recipientEmail || !emailUser || !emailPassword) {
    console.error('❌ Email config missing', { recipientEmail, emailUser, emailPassword });
    return false;
  }
  console.log('Creating transporter...');
  const transporter = createTransporter();
  console.log('Transporter created. Generating Excel...');
  const excelBuffer = await generateSchoolImagesExcel(schoolId);
  console.log('Excel generated. Uploading Excel...');
  const excelUrl = await uploadBufferToStorage(schoolId, 'images-list.xlsx', excelBuffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  console.log('Excel uploaded. Generating ZIP...');
  const { zipBuffer } = await generateSchoolImagesZip(schoolId);
  console.log('ZIP generated. Uploading ZIP...');
  const zipUrl = await uploadBufferToStorage(schoolId, 'images.zip', zipBuffer, 'application/zip');
  console.log('ZIP uploaded. Preparing email content...');
  // Email content
  const htmlContent = `
    <h2>New ID Card Images Generated</h2>
    <p>${images.length} new ID card image(s) have been generated in the last 7 days for this school.</p>
    <p><a href="${excelUrl}" target="_blank">Download Excel File (images-list.xlsx)</a></p>
    <p>Total Images: ${images.length}</p>
    <hr>
    <p><small>This is an automated email from ID Card Genie system.</small></p>
  `;
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: recipientEmail,
    subject: `ID Card Genie - ${images.length} New Image(s) Generated`,
    html: htmlContent,
    attachments: [
      {
        filename: 'images-list.xlsx',
        content: excelBuffer,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
      {
        filename: 'images.zip',
        content: zipBuffer,
        contentType: 'application/zip',
      },
    ],
  };
  try {
    console.log('Sending email with options:', { to: recipientEmail, subject: mailOptions.subject, attachments: mailOptions.attachments.map(a => a.filename) });
    await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent successfully for school ${schoolId}`);
    return true;
  } catch (error) {
    console.error('❌ Error sending email:', error);
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
    // All schools
    const { db } = getAdminServices();
    const schoolsSnapshot = await db.collection('schools').get();
    for (const schoolDoc of schoolsSnapshot.docs) {
      const sid = schoolDoc.id;
      const images = await getNewImages(sid);
      console.log(`📊 Found ${images.length} new images for school ${sid}`);
      if (images.length > 0) {
        const emailSent = await sendImagesEmail(sid, images);
        if (emailSent) {
          console.log(`✅ Email notification sent for school ${sid}`);
        } else {
          console.error(`❌ Failed to send email notification for school ${sid}`);
        }
      } else {
        console.log(`📭 No new images to send for school ${sid}`);
      }
    }
  }
};

// Delete all images and student docs for a school or all schools
export const deleteAllImages = async (schoolIdFilter?: string): Promise<{deletedCount: number, errors: string[]}> => {
  console.log('🗑️ Starting deleteAllImages', schoolIdFilter ? `for schoolId: ${schoolIdFilter}` : 'for all schools');
  const adminServices = getAdminServices();
  const db = adminServices.db;
  const storage = adminServices.storage;
  let deletedCount = 0;
  let errors: string[] = [];
  let schoolsToProcess: { id: string, data: any }[] = [];
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
  console.log('[ZIP] Finalizing archive...');
  await archive.finalize();
  await zipPromise;

  if (archiveError) throw archiveError;
  if (streamError) throw streamError;
  console.log('[ZIP] Archive finalized. Returning buffer.');
  return { zipBuffer: Buffer.concat(zipChunks), fileNames: imageFiles.map(f => f.name.split('/').pop() || f.name) };
} 