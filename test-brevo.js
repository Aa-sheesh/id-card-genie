import SibApiV3Sdk from '@sendinblue/client';
import dotenv from 'dotenv';
dotenv.config();

const brevo = new SibApiV3Sdk.TransactionalEmailsApi();
brevo.setApiKey(SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);

async function sendTest() {
  await brevo.sendTransacEmail({
    sender: { name: 'ID Card Genie', email: 'your_verified_sender@yourdomain.com' },
    to: [{ email: process.env.NOTIFICATION_EMAIL }],
    subject: 'Test Email from Brevo',
    htmlContent: '<h1>This is a test email from Brevo integration.</h1>',
  });
  console.log('Test email sent!');
}

sendTest().catch(console.error); 