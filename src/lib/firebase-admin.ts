import { initializeApp, getApps, cert, getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import fs from 'fs';
import path from 'path';

let adminServices: {
  auth: ReturnType<typeof getAuth>;
  db: ReturnType<typeof getFirestore>;
  storage: ReturnType<typeof getStorage>;
} | null = null;

function initializeAdminApp() {
  try {
    console.log('🔧 Initializing Firebase Admin...');
    console.log('🔧 Environment:', process.env.NODE_ENV);
    console.log('🔧 Has FIREBASE_ADMIN_CREDENTIALS:', !!process.env.FIREBASE_ADMIN_CREDENTIALS);
    
    // Check if app is already initialized
    if (getApps().length > 0) {
      console.log('✅ Firebase Admin app already initialized');
      const app = getApp();
      if (!adminServices) {
        adminServices = {
          auth: getAuth(app),
          db: getFirestore(app),
          storage: getStorage(app),
        };
        console.log('✅ Admin services created from existing app');
      }
      return adminServices;
    }

    // Check for credentials in environment variable first (production), then file (development)
    let serviceAccount;
    
    if (process.env.FIREBASE_ADMIN_CREDENTIALS) {
      // Production: Use environment variable
      console.log('🔧 Using Firebase Admin credentials from environment variable');
      try {
        serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_CREDENTIALS);
        console.log('✅ Successfully parsed credentials from environment');
      } catch (error) {
        console.error('🔥 Failed to parse Firebase Admin credentials from environment variable:', error);
        return null;
      }
    } else {
      // Development: Use file
      console.log('🔧 Looking for Firebase Admin credentials file...');
      const credentialsPath = path.join(process.cwd(), 'firebase-admin-sdk-credentials.json');
      console.log('🔧 Credentials path:', credentialsPath);
      if (!fs.existsSync(credentialsPath)) {
        console.error('🔥 Firebase Admin SDK credentials file not found at project root!');
        return null;
      }
      console.log('✅ Found credentials file, reading...');
      serviceAccount = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
      console.log('✅ Successfully read credentials from file');
    }
    
    // Initialize the app
    console.log('🔧 Initializing Firebase app with storage bucket: malik-studio-photo.firebasestorage.app');
    const app = initializeApp({
      credential: cert(serviceAccount),
      storageBucket: 'malik-studio-photo.firebasestorage.app',
    });

    // Initialize services
    console.log('🔧 Creating admin services...');
    adminServices = {
      auth: getAuth(app),
      db: getFirestore(app),
      storage: getStorage(app),
    };

    console.log("✅ Firebase Admin initialized successfully.");
    return adminServices;

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error("❌ Firebase Admin init error:", errorMessage);
    console.error("❌ Error details:", err);
    return null;
  }
}

export function getAdminServices() {
  if (!adminServices) {
    adminServices = initializeAdminApp();
  }

  if (!adminServices) {
    throw new Error(
      'Firebase Admin SDK is not configured on the server. Please check your `firebase-admin-sdk-credentials.json` file and restart the server.'
    );
  }

  return adminServices;
}
