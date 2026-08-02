import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, 'edutask');
const auth = getAuth(app);

const users = [
  { email: 'hieutruong@gmail.com', fullName: 'Hiệu Trưởng', departmentId: 'BGH', departmentName: 'Ban Giám Hiệu', roles: ['PRINCIPAL'] },
  { email: 'hieupho1@gmail.com', fullName: 'Hiệu Phó 1', departmentId: 'BGH', departmentName: 'Ban Giám Hiệu', roles: ['VICE_PRINCIPAL'] },
  { email: 'hieupho2@gmail.com', fullName: 'Hiệu Phó 2', departmentId: 'BGH', departmentName: 'Ban Giám Hiệu', roles: ['VICE_PRINCIPAL'] },
  { email: 'nhomtruong.hoa@gmail.com', fullName: 'Nhóm Trưởng Hoá', departmentId: 'DEPT_HOA_SINH', departmentName: 'Tổ Hoá - Sinh', roles: ['TEACHER', 'GROUP_LEADER'] },
  { email: 'hoa1@gmail.com', fullName: 'GV Hoá 1', departmentId: 'DEPT_HOA_SINH', departmentName: 'Tổ Hoá - Sinh', roles: ['TEACHER'] },
  { email: 'hoa2@gmail.com', fullName: 'GV Hoá 2', departmentId: 'DEPT_HOA_SINH', departmentName: 'Tổ Hoá - Sinh', roles: ['TEACHER'] },
  { email: 'toan1@gmail.com', fullName: 'GV Toán 1', departmentId: 'DEPT_TOAN_TIN', departmentName: 'Tổ Toán - Tin', roles: ['TEACHER'] }
];

async function run() {
  for (const u of users) {
    try {
      const cred = await signInWithEmailAndPassword(auth, u.email, '123456');
      const uid = cred.user.uid;
      const userDoc = {
        id: uid,
        email: u.email,
        fullName: u.fullName,
        departmentId: u.departmentId,
        departmentName: u.departmentName,
        roles: u.roles,
        activeRole: u.roles[0],
        isTeachingStaff: u.roles.includes('TEACHER') || u.roles.includes('HEAD_OF_DEPT') || u.roles.includes('GROUP_LEADER'),
        status: 'ACTIVE'
      };
      await setDoc(doc(db, 'users', uid), userDoc, { merge: true });
      console.log(`Created/Updated ${u.email} with uid ${uid}`);
    } catch (err) {
      console.error(`Failed for ${u.email}:`, err);
    }
  }
  process.exit(0);
}
run().catch(console.error);
