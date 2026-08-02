import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

async function run() {
  const cred = await signInWithEmailAndPassword(auth, 'hoa1@gmail.com', '123456');
  console.log('Logged in as', cred.user.uid);
  
  const userDoc = await getDoc(doc(db, 'users', cred.user.uid));
  if (userDoc.exists()) {
    console.log('User doc in (default):', userDoc.data());
  } else {
    console.log('User doc in (default) does not exist!');
  }
  process.exit(0);
}
run().catch(console.error);
