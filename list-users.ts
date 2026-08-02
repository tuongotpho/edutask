import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
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
    console.log(userDoc.id, userDoc.data().email);
  }
  process.exit(0);
}
run().catch(console.error);
