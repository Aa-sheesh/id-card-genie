import * as admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

let adminServices: {
  auth: admin.auth.Auth;
  db: admin.firestore.Firestore;
  storage: admin.storage.Storage;
} | null = null;

function initializeAdminApp() {
  try {
    // Check if app is already initialized
    if (admin.apps.length > 0) {
      const app = admin.app();
      if (!adminServices) {
        adminServices = {
          auth: app.auth(),
          db: app.firestore(),
          storage: app.storage(),
        };
      }
      return adminServices;
    }

    // Check if credentials file exists
    const credentialsPath = path.join(process.cwd(), 'firebase-admin-sdk-credentials.json');
    if (!fs.existsSync(credentialsPath)) {
      console.error('🔥 Firebase Admin SDK credentials file not found at project root!');
      return null;
    }

    // Read and parse credentials
    const serviceAccount = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
    
    // Initialize the app
    const app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: `${serviceAccount.project_id}.appspot.com`,
    });

    // Initialize services
    adminServices = {
      auth: app.auth(),
      db: app.firestore(),
      storage: app.storage(),
    };

    console.log("✅ Firebase Admin initialized successfully.");
    return adminServices;

  } catch (err: any) {
    console.error("❌ Firebase Admin init error:", err.message);
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
