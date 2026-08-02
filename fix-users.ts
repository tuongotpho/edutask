import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, 'edutask');

async function run() {
  const querySnapshot = await getDocs(collection(db, 'users'));
  for (const userDoc of querySnapshot.docs) {
    await updateDoc(doc(db, 'users', userDoc.id), { status: 'ACTIVE' });
    console.log('Updated ' + userDoc.id);
  }
  process.exit(0);
}
run().catch(console.error);
