import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  User as FbUser 
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '@/Edu-task/lib/firebase';
import { User, RoleType } from '@/Edu-task/types/user';

function sanitizeForFirestore<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

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

  // Login or Register with Google (Gmail)
  async loginWithGoogle(): Promise<{ fbUser: FbUser; userProfile: User }> {
    const credential = await signInWithPopup(auth, googleProvider);
    const fbUser = credential.user;

    const userDocRef = doc(db, 'users', fbUser.uid);
    const userDocSnap = await getDoc(userDocRef);

    let userProfile: User;

    if (userDocSnap.exists()) {
      userProfile = userDocSnap.data() as User;
    } else {
      // First time Google sign in -> Create Pending Approval Profile
      const isAdminEmail = fbUser.email?.toLowerCase() === 'admin@gmail.com';
      userProfile = {
        id: fbUser.uid,
        fullName: fbUser.displayName || 'Giáo viên mới',
        email: fbUser.email || '',
        avatarUrl: fbUser.photoURL || '',
        phone: fbUser.phoneNumber || '',
        departmentId: 'DEPT_TOAN_TIN',
        departmentName: 'Tổ Toán - Tin',
        roles: isAdminEmail ? ['ADMIN', 'PRINCIPAL'] : ['TEACHER'],
        activeRole: isAdminEmail ? 'ADMIN' : 'TEACHER',
        isTeachingStaff: true,
        subject: 'Chưa phân công môn',
        status: isAdminEmail ? 'ACTIVE' : 'PENDING_APPROVAL',
      };
      await setDoc(userDocRef, sanitizeForFirestore(userProfile));
    }

    return { fbUser, userProfile };
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

    const isAdmin = email.toLowerCase() === 'admin@gmail.com';

    const userProfile: User = {
      id: fbUser.uid,
      fullName,
      email,
      phone: '',
      departmentId,
      departmentName,
      roles: isAdmin ? ['ADMIN', 'PRINCIPAL'] : roles,
      activeRole: isAdmin ? 'ADMIN' : (roles[0] || 'TEACHER'),
      isTeachingStaff: true,
      subject: 'Bộ môn chuyên',
      status: isAdmin ? 'ACTIVE' : 'PENDING_APPROVAL',
    };

    // Save profile to Firestore
    await setDoc(doc(db, 'users', fbUser.uid), sanitizeForFirestore(userProfile));
    return userProfile;
  },

  // Logout
  async logout(): Promise<void> {
    await signOut(auth);
  },

  // Get User Profile from Firestore
  async getUserProfile(uid: string): Promise<User | null> {
    try {
      const userDocSnap = await getDoc(doc(db, 'users', uid));
      if (userDocSnap.exists()) {
        return userDocSnap.data() as User;
      }
    } catch {
      // fallback
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
      status: 'ACTIVE',
    };

    if (!adminDoc.exists()) {
      await setDoc(doc(db, 'users', 'USR_ADMIN'), sanitizeForFirestore(adminUser));
    }
    return adminUser;
  }
};
