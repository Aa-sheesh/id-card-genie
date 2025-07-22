import SibApiV3Sdk from '@sendinblue/client';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

if (!process.env.BREVO_API_KEY) {
  console.error('BREVO_API_KEY is missing! Please check your .env.local file.');
  process.exit(1);
}

const brevo = new SibApiV3Sdk.TransactionalEmailsApi();
brevo.setApiKey(SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);

async function sendTest() {
  await brevo.sendTransacEmail({
    sender: { name: 'ID Card Genie', email: process.env.SENDER_NOTIFICATION_EMAIL },
    to: [{ email: process.env.RECIEVER_NOTIFICATION_EMAIL }],
    subject: 'Test Email from Brevo',
    htmlContent: '<h1>This is a test email from Brevo integration.</h1>',
  });
  console.log('Test email sent!');
}

sendTest().catch(console.error); 