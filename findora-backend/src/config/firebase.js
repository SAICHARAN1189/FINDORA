// src/config/firebase.js
// Firebase Admin SDK initialization with demo mode fallback

const admin = require('firebase-admin');

let db = null;
let storage = null;
let auth = null;
const isDemoMode = process.env.DEMO_MODE === 'true' || !process.env.FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID === 'your-project-id';

if (!isDemoMode) {
  try {
    const serviceAccount = {
      type: 'service_account',
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
    };

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      });
    }

    db = admin.firestore();
    storage = admin.storage();
    auth = admin.auth();
    console.log('✅ Firebase Admin SDK initialized');
  } catch (err) {
    console.warn('⚠️  Firebase init failed, running in DEMO mode:', err.message);
  }
} else {
  console.log('🔧 Running in DEMO mode (no Firebase credentials needed)');
}

module.exports = { admin, db, storage, auth, isDemoMode };
