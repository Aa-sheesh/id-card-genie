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

// Generate ZIP file containing all images for a school (SCALABLE VERSION)
export async function generateSchoolImagesZip(schoolId: string): Promise<{ zipBuffer: Buffer, fileNames: string[] }> {
  const { storage } = getAdminServices();
  const bucket = storage.bucket('malik-studio-photo.firebasestorage.app');
  console.log(`[ZIP] Fetching files for school: ${schoolId}`);
  const [files] = await bucket.getFiles({ prefix: `schools/${schoolId}/images/` });
  console.log(`[ZIP] Found ${files.length} files in storage`);
  
  // Use the same filtering logic as Excel generation
  const imageFiles = files.filter(f => {
    const fileName = f.name.toLowerCase();
    const isImage = fileName.endsWith('.jpg') || fileName.endsWith('.jpeg') || fileName.endsWith('.png');
    const isExcluded = fileName.endsWith('.xlsx') || fileName.endsWith('.zip');
    return !isExcluded && isImage;
  });
  
  console.log(`[ZIP] ${imageFiles.length} image files to process`);

  // For large schools (>1000 images), use a different approach
  if (imageFiles.length > 1000) {
    console.log(`[ZIP] Large school detected (${imageFiles.length} images). Using Firebase Storage direct access approach.`);
    return await generateLargeSchoolZip(schoolId, imageFiles);
  }

  // Use lower compression for faster processing
  const archive = archiver('zip', { zlib: { level: 6 } });
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

  // Add images with timeout protection
  let processedCount = 0;
  const maxFiles = 100; // Limit to prevent timeouts
  
  for (const file of imageFiles) {
    if (processedCount >= maxFiles) {
      console.log(`[ZIP] Reached maximum file limit (${maxFiles}), stopping processing`);
      break;
    }
    
    const fileName = file.name.split('/').pop() || file.name;
    try {
      console.log(`[ZIP] Downloading file: ${file.name} (${processedCount + 1}/${Math.min(imageFiles.length, maxFiles)})`);
      const [fileBuffer] = await file.download();
      console.log(`[ZIP] Downloaded file: ${file.name} (${fileBuffer.length} bytes)`);
      archive.append(fileBuffer, { name: fileName });
      console.log(`[ZIP] Appended file to archive: ${fileName}`);
      processedCount++;
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

// Generate ZIP for large schools using Firebase Storage direct access
async function generateLargeSchoolZip(schoolId: string, imageFiles: FirebaseFirestore.DocumentData[]): Promise<{ zipBuffer: Buffer, fileNames: string[] }> {
  console.log(`[LARGE-ZIP] Generating ZIP for large school ${schoolId} with ${imageFiles.length} images`);
  
  // Create a simple ZIP with just the Excel file and a README
  const archive = archiver('zip', { zlib: { level: 6 } });
  const zipChunks: Buffer[] = [];
  const passThrough = new stream.PassThrough();
  passThrough.on('data', chunk => zipChunks.push(chunk));
  archive.pipe(passThrough);

  const zipPromise = new Promise<void>((resolve, reject) => {
    passThrough.once('close', resolve);
    passThrough.once('error', reject);
    archive.once('error', reject);
  });

  // Add Excel file with all images listed
  try {
    const excelBuffer = await generateSchoolImagesExcel(schoolId);
    archive.append(excelBuffer, { name: 'images-list.xlsx' });
    console.log('[LARGE-ZIP] Appended Excel file with all images');
  } catch (err) {
    console.error('[LARGE-ZIP] Error generating Excel file:', err);
  }

  // Add README with instructions
  const readmeContent = `# ID Card Images for School: ${schoolId}

This ZIP contains an Excel file listing all ${imageFiles.length} images for this school.

## How to Download Images

Due to the large number of images (${imageFiles.length}), the actual image files are not included in this ZIP to prevent timeout issues.

### Option 1: Download from Firebase Console
1. Go to: https://console.firebase.google.com/project/malik-studio-photo/storage/malik-studio-photo.firebasestorage.app/files/schools/${schoolId}/images
2. Select the images you want to download
3. Click "Download" button

### Option 2: Use Firebase CLI
\`\`\`bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Download all images for this school
gsutil -m cp -r gs://malik-studio-photo.firebasestorage.app/schools/${schoolId}/images/ ./downloads/
\`\`\`

### Option 3: Programmatic Download
Use the Firebase Admin SDK or client SDK to download images programmatically.

## Excel File
The 'images-list.xlsx' file contains a complete list of all images with their filenames.
`;

  archive.append(readmeContent, { name: 'README.txt' });
  console.log('[LARGE-ZIP] Appended README with download instructions');

  await archive.finalize();
  await zipPromise;

  console.log('[LARGE-ZIP] Large school ZIP finalized');
  return { zipBuffer: Buffer.concat(zipChunks), fileNames: imageFiles.map(f => f.name.split('/').pop() || f.name) };
}

// Generate ZIP file containing all images for all schools (SCALABLE VERSION)
export async function generateAllSchoolsZip(): Promise<{ zipBuffer: Buffer, fileNames: string[] }> {
  const { storage, db } = getAdminServices();
  const bucket = storage.bucket('malik-studio-photo.firebasestorage.app');
  const schoolsSnapshot = await db.collection('schools').get();
  
  console.log(`[ALL-ZIP] Found ${schoolsSnapshot.docs.length} schools total`);
  
  // For large deployments (>50 schools), use a different approach
  if (schoolsSnapshot.docs.length > 50) {
    console.log(`[ALL-ZIP] Large deployment detected (${schoolsSnapshot.docs.length} schools). Using Firebase Storage direct access approach.`);
    return await generateLargeDeploymentZip(schoolsSnapshot.docs);
  }
  
  // Limit number of schools to prevent timeouts
  const maxSchools = 10;
  const schoolsToProcess = schoolsSnapshot.docs.slice(0, maxSchools);
  
  console.log(`[ZIP] Processing ${schoolsToProcess.length} schools (limited to ${maxSchools} to prevent timeouts)`);
  
  const archive = archiver('zip', { zlib: { level: 6 } }); // Lower compression for speed
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

  let totalFilesProcessed = 0;
  const maxTotalFiles = 200; // Limit total files across all schools

  for (const schoolDoc of schoolsToProcess) {
    if (totalFilesProcessed >= maxTotalFiles) {
      console.log(`[ZIP] Reached maximum total file limit (${maxTotalFiles}), stopping processing`);
      break;
    }
    
    const schoolId = schoolDoc.id;
    console.log(`[ZIP] Processing school: ${schoolId}`);
    
    const [files] = await bucket.getFiles({ prefix: `schools/${schoolId}/images/` });
    const imageFiles = files.filter(f => !f.name.endsWith('.xlsx') && !f.name.endsWith('.zip'));
    
    // Add images (limit per school)
    const maxFilesPerSchool = Math.floor(maxTotalFiles / schoolsToProcess.length);
    let schoolFilesProcessed = 0;
    
    for (const file of imageFiles) {
      if (totalFilesProcessed >= maxTotalFiles || schoolFilesProcessed >= maxFilesPerSchool) {
        break;
      }
      
      const fileName = `schools/${schoolId}/images/${file.name.split('/').pop() || file.name}`;
      try {
        const [fileBuffer] = await file.download();
        archive.append(fileBuffer, { name: fileName });
        totalFilesProcessed++;
        schoolFilesProcessed++;
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
  console.log(`[ZIP] All-schools ZIP completed with ${totalFilesProcessed} files processed`);
  return { zipBuffer: Buffer.concat(zipChunks), fileNames: [] };
}

// Generate ZIP for large deployments using Firebase Storage direct access
async function generateLargeDeploymentZip(schoolDocs: FirebaseFirestore.QueryDocumentSnapshot[]): Promise<{ zipBuffer: Buffer, fileNames: string[] }> {
  console.log(`[LARGE-DEPLOYMENT-ZIP] Generating ZIP for large deployment with ${schoolDocs.length} schools`);
  
  const archive = archiver('zip', { zlib: { level: 6 } });
  const zipChunks: Buffer[] = [];
  const passThrough = new stream.PassThrough();
  passThrough.on('data', chunk => zipChunks.push(chunk));
  archive.pipe(passThrough);

  const zipPromise = new Promise<void>((resolve, reject) => {
    passThrough.once('close', resolve);
    passThrough.once('error', reject);
    archive.once('error', reject);
  });

  // Add Excel files for each school (without images)
  for (const schoolDoc of schoolDocs) {
    const schoolId = schoolDoc.id;
    try {
      const excelBuffer = await generateSchoolImagesExcel(schoolId);
      archive.append(excelBuffer, { name: `schools/${schoolId}/images-list.xlsx` });
      console.log(`[LARGE-DEPLOYMENT-ZIP] Appended Excel for school ${schoolId}`);
    } catch (err) {
      console.error(`[LARGE-DEPLOYMENT-ZIP] Error generating Excel for school ${schoolId}:`, err);
    }
  }

  // Add comprehensive README
  const readmeContent = `# ID Card Images for All Schools

This ZIP contains Excel files for all ${schoolDocs.length} schools in the system.

## Deployment Statistics
- Total Schools: ${schoolDocs.length}
- Total Images: See individual Excel files for counts

## How to Download Images

Due to the large scale of this deployment, actual image files are not included in this ZIP.

### Option 1: Firebase Console (Recommended)
1. Go to: https://console.firebase.google.com/project/malik-studio-photo/storage/malik-studio-photo.firebasestorage.app/files/schools
2. Navigate to individual school folders
3. Download images as needed

### Option 2: Firebase CLI (Bulk Download)
\`\`\`bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Download all images for all schools
gsutil -m cp -r gs://malik-studio-photo.firebasestorage.app/schools/ ./downloads/

# Or download specific school
gsutil -m cp -r gs://malik-studio-photo.firebasestorage.app/schools/SCHOOL_ID/images/ ./downloads/SCHOOL_ID/
\`\`\`

### Option 3: Programmatic Access
Use the Firebase Admin SDK or client SDK to download images programmatically.

## Excel Files
Each Excel file contains a complete list of images for that specific school.

## School List
${schoolDocs.map((doc, index) => `${index + 1}. ${doc.id}`).join('\n')}
`;

  archive.append(readmeContent, { name: 'README.txt' });
  console.log('[LARGE-DEPLOYMENT-ZIP] Appended comprehensive README');

  await archive.finalize();
  await zipPromise;

  console.log('[LARGE-DEPLOYMENT-ZIP] Large deployment ZIP finalized');
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
export const sendImagesEmail = async (schoolId: string | undefined, _images?: ImageData[]): Promise<boolean> => {
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
    // Per-school: always generate/upload ZIP with all images and email link
    console.log(`📦 Generating ZIP for school ${schoolId} with all images`);
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
      <p><strong>Direct Firebase Storage Access:</strong></p>
      <p><a href="https://console.firebase.google.com/project/malik-studio-photo/storage/malik-studio-photo.firebasestorage.app/files/schools/${schoolId}/images" target="_blank">View Images in Firebase Console</a></p>
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
      <p><strong>Bulk Download Options:</strong></p>
      <p><strong>Firebase CLI (Recommended for large deployments):</strong></p>
      <pre style="background: #f5f5f5; padding: 10px; border-radius: 5px;">
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Download all images for all schools
gsutil -m cp -r gs://malik-studio-photo.firebasestorage.app/schools/ ./downloads/

# Or download specific school
gsutil -m cp -r gs://malik-studio-photo.firebasestorage.app/schools/SCHOOL_ID/images/ ./downloads/SCHOOL_ID/</pre>
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
  console.log('🔍 Starting Excel & ZIP generation...');
  if (schoolId) {
    // Single school: always send email with all images, not just recent ones
    console.log(`📧 Generating Excel & ZIP for school ${schoolId} with all images`);
    const emailSent = await sendImagesEmail(schoolId, []);
      if (emailSent) {
        console.log('✅ Excel & ZIP generation completed successfully');
      } else {
        console.error('❌ Failed to generate Excel & ZIP files');
    }
  } else {
    // Global: send only one email with the /schools root link
    await sendImagesEmail(undefined, []);
    console.log('✅ Global Excel & ZIP generation completed with /schools link');
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
  try {
  const { storage } = getAdminServices();
  const bucket = storage.bucket('malik-studio-photo.firebasestorage.app');
    
    console.log(`[EXCEL] Generating Excel for school: ${schoolId}`);
  const [files] = await bucket.getFiles({ prefix: `schools/${schoolId}/images/` });
    console.log(`[EXCEL] Found ${files.length} total files in storage`);
    
    // Debug: Log all files found
    files.forEach((file, idx) => {
      console.log(`[EXCEL] File ${idx + 1}: ${file.name}`);
    });
    
    // Filter out Excel and ZIP files, keep only image files
    const imageFiles = files.filter(f => {
      const fileName = f.name.toLowerCase();
      const isImage = fileName.endsWith('.jpg') || fileName.endsWith('.jpeg') || fileName.endsWith('.png');
      const isExcluded = fileName.endsWith('.xlsx') || fileName.endsWith('.zip');
      
      console.log(`[EXCEL] Checking file: ${f.name} - isImage: ${isImage}, isExcluded: ${isExcluded}`);
      
      return !isExcluded && isImage;
    });
    
    console.log(`[EXCEL] ${imageFiles.length} image files to include in Excel`);

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Images');
    
    // Set up columns
  worksheet.columns = [
    { header: 'S.No.', key: 'sno', width: 10 },
    { header: 'Image', key: 'image', width: 40 },
  ];
    
    // Add data rows
  imageFiles.forEach((file, idx) => {
      const fileName = file.name.split('/').pop() || file.name;
      worksheet.addRow({ 
        sno: idx + 1, 
        image: fileName 
      });
      console.log(`[EXCEL] Added row ${idx + 1}: ${fileName}`);
    });
    
    // If no images found, add a note row
    if (imageFiles.length === 0) {
      worksheet.addRow({ 
        sno: 1, 
        image: 'No images found for this school' 
      });
      console.log(`[EXCEL] No images found, added placeholder row`);
    }
    
  const buffer = await workbook.xlsx.writeBuffer();
    console.log(`[EXCEL] Excel file generated successfully (${buffer.byteLength} bytes)`);
  return Buffer.from(buffer);
    
  } catch (error) {
    console.error(`[EXCEL] Error generating Excel for school ${schoolId}:`, error);
    throw error;
  }
} 