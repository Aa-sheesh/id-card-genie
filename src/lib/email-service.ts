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

// Interface for PDF data
interface PDFData {
  id: string;
  studentName: string;
  schoolName: string;
  downloadUrl: string;
  createdAt: Date;
}

// Get new PDFs from the last 7 days
export const getNewPDFs = async (): Promise<PDFData[]> => {
  console.log('🔍 Starting getNewPDFs function...');
  
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
    
    const pdfs: PDFData[] = [];
    
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
          console.log('📄 Processing student:', studentData.name, '- PDF URL:', studentData.pdfUrl ? '✅ Has PDF' : '❌ No PDF');
          
          if (studentData.pdfUrl) {
            try {
              // Get download URL for the PDF using admin SDK
              // Try the actual bucket name from the error URL
              const bucketName = 'malik-studio-photo.firebasestorage.app';
              console.log('🪣 Using bucket name:', bucketName);
              const bucket = storage.bucket(bucketName);
              
              // Get the file path - prefer the direct path if available
              let filePath = studentData.pdfUrl;
              
              // If it's a full Firebase Storage URL, extract the path
              if (filePath.includes('firebasestorage.googleapis.com')) {
                // Extract path from URL like: https://firebasestorage.googleapis.com/v0/b/malik-studio-photo.appspot.com/o/schools%2Fschool-01%2Fpdfs%2F...?alt=media&token=...
                const url = new URL(filePath);
                const pathMatch = url.pathname.match(/\/o\/(.+)/);
                if (pathMatch) {
                  filePath = decodeURIComponent(pathMatch[1]);
                }
              } else if (filePath.startsWith('https://')) {
                // If it's a different type of URL, try to extract the path
                const url = new URL(filePath);
                filePath = url.pathname.replace(/^\//, ''); // Remove leading slash
              }
              
              console.log('📁 Original PDF URL:', studentData.pdfUrl);
              console.log('📁 Using file path:', filePath);
              const file = bucket.file(filePath);
              const [downloadUrl] = await file.getSignedUrl({
                action: 'read',
                expires: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
              });
              
              pdfs.push({
                id: doc.id,
                studentName: studentData.name || 'Unknown Student',
                schoolName: schoolName,
                downloadUrl,
                createdAt: studentData.submittedAt?.toDate() || new Date(),
              });
              
              console.log('✅ Added PDF for:', studentData.name);
            } catch (error) {
              console.error('❌ Error getting download URL for:', studentData.name, error);
            }
          }
        }
      } catch (error) {
        console.error(`❌ Error querying students for school ${schoolName}:`, error);
      }
    }
    
    console.log('📊 Total PDFs found:', pdfs.length);
    return pdfs;
  } catch (error) {
    console.error('❌ Error fetching new PDFs:', error);
    console.error('❌ Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    return [];
  }
};

// Send email with PDF attachments
export const sendPDFsEmail = async (pdfs: PDFData[]): Promise<boolean> => {
  console.log('🔍 Starting sendPDFsEmail function...');
  console.log('📊 Number of PDFs to process:', pdfs.length);
  
  if (pdfs.length === 0) {
    console.log('No new PDFs to send');
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
      <h2>New ID Card PDFs Generated</h2>
      <p>${pdfs.length} new ID card PDF(s) have been generated in the last 7 days:</p>
      <ul>
        ${pdfs.map(pdf => `
          <li>
            <strong>${pdf.studentName}</strong> - ${pdf.schoolName}
            <br>
            <small>Generated on: ${pdf.createdAt.toLocaleDateString()}</small>
            <br>
            <a href="${pdf.downloadUrl}" target="_blank">Download PDF</a>
          </li>
        `).join('')}
      </ul>
      <p>Total PDFs: ${pdfs.length}</p>
      <hr>
      <p><small>This is an automated email from ID Card Genie system.</small></p>
    `;
    
    // Send email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: recipientEmail,
      subject: `ID Card Genie - ${pdfs.length} New PDF(s) Generated`,
      html: htmlContent,
    };
    
    console.log('📧 Attempting to send email...');
    console.log('📧 From:', process.env.EMAIL_USER);
    console.log('📧 To:', recipientEmail);
    console.log('📧 Subject:', mailOptions.subject);
    
    await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent successfully with ${pdfs.length} PDF(s)`);
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

// Main function to check and send PDFs
export const checkAndSendPDFs = async (): Promise<void> => {
  try {
    console.log('Checking for new PDFs...');
    const newPDFs = await getNewPDFs();
    
    if (newPDFs.length > 0) {
      console.log(`Found ${newPDFs.length} new PDF(s)`);
      await sendPDFsEmail(newPDFs);
    } else {
      console.log('No new PDFs found in the last 7 days');
    }
  } catch (error) {
    console.error('Error in checkAndSendPDFs:', error);
  }
}; 