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
import { sanitizeForFirestore } from '@/Edu-task/lib/utils';
import { User, RoleType } from '@/Edu-task/types/user';
import { isAdminEmail } from '@/Edu-task/lib/admin';

export const firebaseAuthService = {
  // Listen to Auth State Changes
  onAuthChange(callback: (user: FbUser | null) => void) {
    return onAuthStateChanged(auth, callback);
  },

  // Login with Email & Password
  async login(email: string, pass: string): Promise<FbUser> {
    const credential = await signInWithEmailAndPassword(auth, email, pass);
    const fbUser = credential.user;

    // Self-heal: an Auth account can exist without a matching Firestore
    // profile (e.g. register()'s post-signup setDoc was interrupted, or the
    // account was provisioned outside the app). Without this, such users
    // never get a `users/{uid}` doc and stay invisible to the admin list.
    const userDocRef = doc(db, 'users', fbUser.uid);
    const userDocSnap = await getDoc(userDocRef);

    if (!userDocSnap.exists()) {
      const isAdmin = isAdminEmail(fbUser.email);
      const userProfile: User = {
        id: fbUser.uid,
        fullName: fbUser.displayName || fbUser.email || 'Người dùng',
        email: fbUser.email || '',
        avatarUrl: fbUser.photoURL || '',
        phone: fbUser.phoneNumber || '',
        departmentId: 'DEPT_TOAN_TIN',
        departmentName: 'Tổ Toán - Tin',
        roles: isAdmin ? ['ADMIN', 'PRINCIPAL'] : ['TEACHER'],
        activeRole: isAdmin ? 'ADMIN' : 'TEACHER',
        isTeachingStaff: true,
        subject: 'Chưa phân công môn',
        status: isAdmin ? 'ACTIVE' : 'PENDING_APPROVAL',
      };
      await setDoc(userDocRef, sanitizeForFirestore(userProfile));
    }

    return fbUser;
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
      const isAdmin = isAdminEmail(fbUser.email);
      userProfile = {
        id: fbUser.uid,
        fullName: fbUser.displayName || 'Giáo viên mới',
        email: fbUser.email || '',
        avatarUrl: fbUser.photoURL || '',
        phone: fbUser.phoneNumber || '',
        departmentId: 'DEPT_TOAN_TIN',
        departmentName: 'Tổ Toán - Tin',
        roles: isAdmin ? ['ADMIN', 'PRINCIPAL'] : ['TEACHER'],
        activeRole: isAdmin ? 'ADMIN' : 'TEACHER',
        isTeachingStaff: true,
        subject: 'Chưa phân công môn',
        status: isAdmin ? 'ACTIVE' : 'PENDING_APPROVAL',
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

    const isAdmin = isAdminEmail(email);

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
        const data = userDocSnap.data() as User;
        return data;
      }
    } catch {
      // fallback
    }
    return null;
  },

  /**
   * Tạo hồ sơ cho tài khoản quản trị đầu tiên, ĐẶT THEO MÃ ĐĂNG NHẬP.
   *
   * Trước đây hàm này ghi vào `users/USR_ADMIN` với `id: 'USR_ADMIN'` — một mã
   * tự đặt, không liên quan gì tới mã đăng nhập Firebase của người đó. Hai cách
   * nhận diện từ đó lệch nhau vĩnh viễn:
   *
   *   - Giao diện tìm hồ sơ theo EMAIL, nên nó nhận `USR_ADMIN` làm danh tính
   *   - Rules chỉ biết `request.auth.uid`, và tra hồ sơ ở `users/{auth.uid}`
   *
   * Hậu quả là tài khoản hỏng một nửa, rất khó thấy: mọi luật chỉ cần đăng nhập
   * hoặc có cửa thoát hiểm theo email vẫn chạy, nên app trông vẫn bình thường —
   * còn `notifications`, luật duy nhất so thẳng với `request.auth.uid` và không
   * có cửa thoát hiểm nào, thì từ chối. Người dùng thấy đúng một chỗ hỏng và
   * không có cách nào đoán ra vì sao.
   *
   * tests/rules/identityMismatch.test.ts dựng lại nguyên trạng thái đó.
   */
  async seedAdminUserProfile(uid: string, email: string): Promise<User> {
    const adminUser: User = {
      id: uid,
      fullName: 'Quản trị viên Hệ thống (Admin)',
      email,
      phone: '0900 000 999',
      departmentId: 'DEPT_BGH',
      departmentName: 'Ban Giám Hiệu',
      roles: ['ADMIN', 'PRINCIPAL', 'TEACHER'],
      activeRole: 'ADMIN',
      isTeachingStaff: true,
      subject: 'Quản trị hệ thống',
      status: 'ACTIVE',
    };

    const existing = await getDoc(doc(db, 'users', uid));
    if (!existing.exists()) {
      await setDoc(doc(db, 'users', uid), sanitizeForFirestore(adminUser));
    }
    return adminUser;
  }
};
