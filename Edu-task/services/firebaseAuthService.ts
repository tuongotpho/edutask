import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged, 
  User as FbUser 
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/Edu-task/lib/firebase';
import { User, RoleType } from '@/Edu-task/types/user';
import { INITIAL_USERS } from '@/Edu-task/lib/storage';

export const firebaseAuthService = {
  // Listen to Auth State Changes
  onAuthChange(callback: (user: FbUser | null) => void) {
    return onAuthStateChanged(auth, callback);
  },

  // Login with Email & Password
  async login(email: string, pass: string): Promise<FbUser> {
    const credential = await signInWithEmailAndPassword(auth, email, pass);
    return credential.user;
  },

  // Register a new user account with Email & Password
  async register(
    email: string, 
    pass: string, 
    fullName: string, 
    departmentId: string, 
    departmentName: string, 
    roles: RoleType[] = ['TEACHER']
  ): Promise<User> {
    const credential = await createUserWithEmailAndPassword(auth, email, pass);
    const fbUser = credential.user;

    const userProfile: User = {
      id: fbUser.uid,
      fullName,
      email,
      phone: '',
      departmentId,
      departmentName,
      roles,
      activeRole: roles[0] || 'TEACHER',
      isTeachingStaff: true,
      subject: 'Bộ môn chung',
    };

    // Save profile to Firestore
    await setDoc(doc(db, 'users', fbUser.uid), userProfile);
    return userProfile;
  },

  // Logout
  async logout(): Promise<void> {
    await signOut(auth);
  },

  // Get User Profile from Firestore by email or uid
  async getUserProfileByEmail(email: string): Promise<User | null> {
    try {
      const match = INITIAL_USERS.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (match) return match;
    } catch {
      // ignore
    }
    return null;
  },

  // Seed default admin user into Firestore if needed
  async seedAdminUserProfile(): Promise<User> {
    const adminDoc = await getDoc(doc(db, 'users', 'USR_ADMIN'));
    const adminUser: User = {
      id: 'USR_ADMIN',
      fullName: 'Quản trị viên Hệ thống (Admin)',
      email: 'admin@gmail.com',
      phone: '0900 000 999',
      departmentId: 'DEPT_BGH',
      departmentName: 'Ban Giám Hiệu',
      roles: ['ADMIN', 'PRINCIPAL', 'TEACHER'],
      activeRole: 'ADMIN',
      isTeachingStaff: true,
      subject: 'Quản trị hệ thống',
    };

    if (!adminDoc.exists()) {
      await setDoc(doc(db, 'users', 'USR_ADMIN'), adminUser);
    }
    return adminUser;
  }
};
