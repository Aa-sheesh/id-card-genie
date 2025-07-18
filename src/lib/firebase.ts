import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

// --- CLIENT-SIDE FIREBASE CONFIGURATION ---
// This file configures the Firebase Client SDK, which runs in the user's browser.
// It uses public environment variables (prefixed with NEXT_PUBLIC_) from your .env.local file.
// This is separate from the Admin SDK configuration (firebase-admin.ts), which runs on the server
// and uses a secure JSON file for administrative access.

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// We use a lazy-initialized singleton pattern to ensure the Firebase client SDK is initialized only once.
let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;

const isConfigured = firebaseConfig.apiKey && firebaseConfig.projectId;

if (isConfigured) {
  try {
    app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
  } catch (error) {
    console.error("Firebase initialization error", error);
    // Set services to null if initialization fails
    app = null;
    auth = null;
    db = null;
    storage = null;
  }
} else {
  console.warn(
    "Firebase configuration not found. Please create a .env.local file with your Firebase project credentials. Firebase features will be disabled."
  );
}

export { app, auth, db, storage, isConfigured };