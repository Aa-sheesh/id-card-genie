import nodemailer from 'nodemailer';
import { getAdminServices } from './firebase-admin';

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

// Get new images from the last 7 days
export const getNewImages = async (): Promise<ImageData[]> => {
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
    const schoolsRef = db.collection('schools');
    const schoolsSnapshot = await schoolsRef.get();
    
    const images: ImageData[] = [];
    
    for (const schoolDoc of schoolsSnapshot.docs) {
      const schoolData = schoolDoc.data();
      const schoolId = schoolDoc.id;
      const schoolName = schoolData.name || 'Unknown School';
      
      console.log(`🔍 Checking students for school: ${schoolName}`);
      
      // Get students for this school
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
              // Get download URL for the image using admin SDK
              const bucketName = 'malik-studio-photo.firebasestorage.app';
              console.log('🪣 Using bucket name:', bucketName);
              const bucket = storage.bucket(bucketName);
              
              // Get the file path - prefer the direct path if available
              let filePath = studentData.imageUrl;
              
              // If it's a full Firebase Storage URL, extract the path
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

// Send email with image attachments
export const sendImagesEmail = async (images: ImageData[]): Promise<boolean> => {
  console.log('🔍 Starting sendImagesEmail function...');
  console.log('📊 Number of images to process:', images.length);
  
  if (images.length === 0) {
    console.log('No new images to send');
    return true;
  }
  
  const recipientEmail = process.env.NOTIFICATION_EMAIL;
  const emailUser = process.env.EMAIL_USER;
  const emailPassword = process.env.EMAIL_PASSWORD;
  
  console.log('📧 Email configuration check:');
  console.log('  - EMAIL_USER:', emailUser ? '✅ Set' : '❌ Not set');
  console.log('  - EMAIL_PASSWORD:', emailPassword ? '✅ Set' : '❌ Not set');
  console.log('  - NOTIFICATION_EMAIL:', recipientEmail ? '✅ Set' : '❌ Not set');
  
  if (!recipientEmail) {
    console.error('❌ NOTIFICATION_EMAIL not configured in environment variables');
    return false;
  }
  
  if (!emailUser || !emailPassword) {
    console.error('❌ EMAIL_USER or EMAIL_PASSWORD not configured');
    return false;
  }
  
  console.log('📧 Recipient email:', recipientEmail);
  
  const transporter = createTransporter();
  
  try {
    // Create HTML content for the email
    const htmlContent = `
      <h2>New ID Card Images Generated</h2>
      <p>${images.length} new ID card image(s) have been generated in the last 7 days:</p>
      <ul>
        ${images.map(image => `
          <li>
            <strong>${image.studentName}</strong> - ${image.schoolName}
            <br>
            <small>Generated on: ${image.createdAt.toLocaleDateString()}</small>
            <br>
            <a href="${image.downloadUrl}" target="_blank">Download Image</a>
          </li>
        `).join('')}
      </ul>
      <p>Total Images: ${images.length}</p>
      <hr>
      <p><small>This is an automated email from ID Card Genie system.</small></p>
    `;
    
    // Send email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: recipientEmail,
      subject: `ID Card Genie - ${images.length} New Image(s) Generated`,
      html: htmlContent,
    };
    
    console.log('📧 Attempting to send email...');
    console.log('📧 From:', process.env.EMAIL_USER);
    console.log('📧 To:', recipientEmail);
    console.log('📧 Subject:', mailOptions.subject);
    
    await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent successfully with ${images.length} image(s)`);
    return true;
  } catch (error) {
    console.error('❌ Error sending email:', error);
    console.error('❌ Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    return false;
  }
};

// Check for new images and send email notification
export const checkAndSendImages = async (): Promise<void> => {
  console.log('🔍 Starting checkAndSendImages function...');
  
  try {
    const images = await getNewImages();
    console.log(`📊 Found ${images.length} new images`);
    
    if (images.length > 0) {
      const emailSent = await sendImagesEmail(images);
      if (emailSent) {
        console.log('✅ Email notification sent successfully');
      } else {
        console.error('❌ Failed to send email notification');
      }
    } else {
      console.log('📭 No new images to send');
    }
  } catch (error) {
    console.error('❌ Error in checkAndSendImages:', error);
  }
}; 