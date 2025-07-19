import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Check if environment variables are set
    const emailUser = process.env.EMAIL_USER;
    const emailPassword = process.env.EMAIL_PASSWORD;
    const notificationEmail = process.env.NOTIFICATION_EMAIL;
    
    const config = {
      emailUser: emailUser ? '✅ Set' : '❌ Not set',
      emailPassword: emailPassword ? '✅ Set' : '❌ Not set',
      notificationEmail: notificationEmail ? '✅ Set' : '❌ Not set',
      emailUserValue: emailUser ? `${emailUser.substring(0, 3)}***@${emailUser.split('@')[1]}` : 'Not set',
      notificationEmailValue: notificationEmail || 'Not set'
    };
    
    return NextResponse.json({
      success: true,
      message: 'Email configuration check',
      config,
      allSet: !!(emailUser && emailPassword && notificationEmail)
    });
    
  } catch (error) {
    console.error('Error checking email config:', error);
    return NextResponse.json(
      { error: 'Failed to check email configuration' },
      { status: 500 }
    );
  }
} 