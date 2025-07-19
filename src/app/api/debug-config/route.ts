import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Check environment variables
    const envCheck = {
      firebase: {
        apiKey: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: !!process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        storageBucket: !!process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: !!process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        appId: !!process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      },
      email: {
        user: !!process.env.EMAIL_USER,
        password: !!process.env.EMAIL_PASSWORD,
        notificationEmail: !!process.env.NOTIFICATION_EMAIL,
      },
      admin: {
        credentials: !!process.env.FIREBASE_ADMIN_CREDENTIALS,
      }
    };

    // Test Firebase Admin SDK
    let adminTest: { success: boolean; error: string | null } = { success: false, error: null };
    try {
      const { getAdminServices } = await import('@/lib/firebase-admin');
      const adminServices = getAdminServices();
      if (adminServices) {
        adminTest = { success: true, error: null };
      } else {
        adminTest = { success: false, error: 'Failed to initialize Firebase Admin' };
      }
    } catch (error) {
      adminTest = { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }

    return NextResponse.json({
      status: 'success',
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
      envCheck,
      adminTest,
      // Don't expose actual values, just check if they exist
      firebaseConfig: {
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      }
    });

  } catch (error) {
    return NextResponse.json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
} 