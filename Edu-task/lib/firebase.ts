import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// This project keeps its data in dedicated, non-default resources: the Firestore
// database is named 'edutask' rather than '(default)', and uploads go to a
// separate 'edutask' bucket rather than the project's default bucket. Both must
// be addressed explicitly — `getFirestore(app)` / `getStorage(app)` would
// silently target the wrong (empty) default resources.
const UPLOAD_BUCKET = process.env.NEXT_PUBLIC_FIREBASE_UPLOAD_BUCKET || 'edutask';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app, 'edutask');
const storage = getStorage(app, `gs://${UPLOAD_BUCKET}`);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export { app, db, storage, auth, googleProvider };
