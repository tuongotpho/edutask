import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyCfCX-xKHVnvv2tEb_AVdxL_xvqnnSjgcQ",
  authDomain: "app-from-ai.firebaseapp.com",
  projectId: "app-from-ai",
  storageBucket: "app-from-ai.firebasestorage.app",
  messagingSenderId: "895767442095",
  appId: "1:895767442095:web:12ebb60a4031cd8d259a5a",
  measurementId: "G-6R608FRWN3"
};

// Initialize Firebase app singleton
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { app, db, auth };
