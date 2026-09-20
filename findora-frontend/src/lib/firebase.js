// src/lib/firebase.js - Firebase initialization (optional, for production)
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true';

let app = null;
let auth = null;
let storage = null;

if (!isDemoMode) {
  const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };

  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    storage = getStorage(app);
    console.log('✅ Firebase initialized');
  } catch (error) {
    console.warn('⚠️ Firebase initialization failed, running in demo mode:', error.message);
  }
}

export { app, auth, storage, isDemoMode };
