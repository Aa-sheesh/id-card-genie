import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request: NextRequest) {
  try {
    const emailUser = process.env.EMAIL_USER;
    const emailPassword = process.env.EMAIL_PASSWORD;
    const notificationEmail = process.env.NOTIFICATION_EMAIL;
    if (!emailUser || !emailPassword || !notificationEmail) {
      return NextResponse.json({ success: false, error: 'Missing email config env vars' }, { status: 500 });
    }
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: emailUser,
        pass: emailPassword,
      },
    });
    const mailOptions = {
      from: emailUser,
      to: notificationEmail,
      subject: 'Test Email from Vercel',
      text: 'This is a test email sent from the deployed Vercel environment.',
    };
    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Test email sent:', result);
    return NextResponse.json({ success: true, message: 'Test email sent', result });
  } catch (error) {
    console.error('❌ Error sending test email:', error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ message: 'POST to this endpoint to send a test email.' });
} 