// Firebase Configuration
// This file initializes Firebase SDK with Firestore and Authentication

import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { 
  getAuth, 
  setPersistence, 
  browserLocalPersistence,
  GoogleAuthProvider 
} from 'firebase/auth';

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};

// Initialize Firebase (only if config is present)
let app: ReturnType<typeof initializeApp> | null = null;
let db: ReturnType<typeof getFirestore> | null = null;
let auth: ReturnType<typeof getAuth> | null = null;
let googleProvider: GoogleAuthProvider | null = null;

// Check if Firebase is configured
export const isFirebaseConfigured = (): boolean => {
  return !!(
    firebaseConfig.apiKey && 
    firebaseConfig.projectId && 
    firebaseConfig.authDomain
  );
};

if (isFirebaseConfigured()) {
  try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    
    // Set persistence to LOCAL - session never expires
    setPersistence(auth, browserLocalPersistence).catch(console.error);
    
    console.log('✅ Firebase initialized successfully');
  } catch (error) {
    console.error('❌ Firebase initialization error:', error);
  }
} else {
  console.warn('⚠️ Firebase not configured. Add REACT_APP_FIREBASE_* to .env');
}

export { app, db, auth, googleProvider };
