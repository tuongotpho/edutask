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
import { firebaseService } from '@/Edu-task/services/firebaseService';

/**
 * Hồ sơ dành cho một tài khoản vừa đăng nhập lần đầu.
 *
 * Trước đây chỗ này chỉ hỏi đúng một câu — "đã có hồ sơ ở users/{mã đăng nhập}
 * chưa?" — và nếu chưa thì dựng một hồ sơ mới toanh ở trạng thái chờ duyệt.
 * Nó không hề biết tới danh sách đã nhập từ file, vì không ai tra theo email.
 * Hậu quả: giáo viên đã có tên trong danh sách vẫn bị coi là người lạ, mất
 * vai trò đã được phân, và quản trị phải gán lại bằng tay từng người.
 *
 * Nay có thêm một bước: tra thư mời theo email. Có thư thì lập hồ sơ ngay với
 * đúng vai trò trong thư và trạng thái hoạt động — không phải duyệt lại. Vai
 * trò được đối chiếu ở MÁY CHỦ với chính thư mời đó, nên kể cả khi trình duyệt
 * bị can thiệp cũng không tự nâng quyền được.
 *
 * Không có thư mời thì giữ nguyên đường cũ: giáo viên chờ duyệt.
 */
async function buildFirstLoginProfile(fbUser: FbUser): Promise<User> {
  const email = fbUser.email || '';
  const isAdmin = isAdminEmail(email);

  if (!isAdmin && email) {
    const invitation = await firebaseService.getInvitation(email).catch(() => null);
    if (invitation) {
      return {
        id: fbUser.uid,
        fullName: invitation.fullName || fbUser.displayName || email,
        email,
        avatarUrl: fbUser.photoURL || '',
        phone: invitation.phone || fbUser.phoneNumber || '',
        departmentId: invitation.departmentId,
        departmentName: invitation.departmentName,
        roles: invitation.roles,
        activeRole: invitation.activeRole,
        isTeachingStaff: invitation.isTeachingStaff,
        subject: invitation.subject || 'Chưa phân công môn',
        status: 'ACTIVE',
      };
    }
  }

  return {
    id: fbUser.uid,
    fullName: fbUser.displayName || email || 'Người dùng',
    email,
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
}

/**
 * Xoá thư mời sau khi đã lập hồ sơ, để nó không nằm lại thành rác và không
 * dùng lại được lần hai. Hỏng ở bước này không được làm hỏng việc đăng nhập —
 * hồ sơ đã lập xong rồi, thư mời thừa chỉ là rác chứ không gây hại.
 */
async function consumeInvitation(email: string): Promise<void> {
  if (!email) return;
  try {
    await firebaseService.deleteInvitation(email);
  } catch (err) {
    console.warn('[Thư mời] Không xoá được thư mời sau khi lập hồ sơ:', err);
  }
}

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
      const userProfile = await buildFirstLoginProfile(fbUser);
      await setDoc(userDocRef, sanitizeForFirestore(userProfile));
      if (userProfile.status === 'ACTIVE' && !isAdminEmail(fbUser.email)) {
        await consumeInvitation(fbUser.email || '');
      }
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
      // Lần đầu đăng nhập: nhận thư mời nếu có, không thì vào diện chờ duyệt.
      userProfile = await buildFirstLoginProfile(fbUser);
      await setDoc(userDocRef, sanitizeForFirestore(userProfile));
      if (userProfile.status === 'ACTIVE' && !isAdminEmail(fbUser.email)) {
        await consumeInvitation(fbUser.email || '');
      }
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
