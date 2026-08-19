import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import { assertFails, assertSucceeds, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { createTestEnv, dbFor, seedDoc, seedProfiles, UID } from './helpers';

/**
 * Khi mã hồ sơ khác mã đăng nhập.
 *
 * Rules nhận diện người dùng bằng `request.auth.uid`. Giao diện nhận diện bằng
 * trường `id` trong hồ sơ Firestore, và nó tìm hồ sơ theo EMAIL:
 *
 *     users.find(u => u.email === userEmail || u.id === fbUser.uid)
 *
 * Hai cách nhận diện này không có gì bắt chúng phải trùng nhau. Khi chúng lệch,
 * tài khoản đó rơi vào trạng thái hỏng một nửa: mọi luật chỉ cần `isAuth()`
 * hoặc có cửa thoát hiểm theo email vẫn chạy, còn mọi luật so với
 * `request.auth.uid` thì từ chối.
 *
 * `notifications` là chỗ lộ ra đầu tiên vì luật đọc của nó KHÔNG có cửa thoát
 * hiểm nào: `resource.data.recipientUserId == request.auth.uid`, hết.
 *
 * Bài test dựng lại đúng trạng thái đó để chứng minh cơ chế, thay vì suy đoán
 * từ một dòng lỗi.
 */

let testEnv: RulesTestEnvironment;

/** Mã đăng nhập thật của người dùng. */
const AUTH_UID = 'auth_uid_that_that';
/** Mã hồ sơ do nhập hàng loạt / seed admin sinh ra trước khi họ từng đăng nhập. */
const PROFILE_ID = 'USR_ADMIN';

beforeAll(async () => {
  testEnv = await createTestEnv();
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seedProfiles(testEnv);

  // Hồ sơ nằm ở USR_ADMIN, KHÔNG nằm ở mã đăng nhập — đúng như
  // firebaseAuthService.seedAdminUserProfile() tạo ra.
  await seedDoc(testEnv, 'users', PROFILE_ID, {
    id: PROFILE_ID,
    fullName: 'Quản trị viên Hệ thống (Admin)',
    email: 'admin@gmail.com',
    roles: ['ADMIN', 'PRINCIPAL', 'TEACHER'],
    activeRole: 'ADMIN',
    departmentId: 'DEPT_BGH',
    departmentName: 'Ban Giám Hiệu',
    isTeachingStaff: true,
    status: 'ACTIVE',
  });

  // Thông báo được gửi tới MÃ HỒ SƠ, vì đó là thứ app dùng làm danh tính.
  await seedDoc(testEnv, 'notifications', 'NTF_1', {
    id: 'NTF_1',
    recipientUserId: PROFILE_ID,
    createdById: UID.teacherToan,
    title: 'Đơn xin nghỉ cần duyệt',
    message: 'Có đơn cần duyệt.',
    type: 'SYSTEM',
    isRead: false,
    createdAt: '2026-08-19 08:00',
  });
});

describe('hồ sơ nằm ở mã khác mã đăng nhập', () => {
  it('TÁI HIỆN LỖI: truy vấn thông báo bị từ chối', async () => {
    // Đây chính xác là truy vấn subscribeNotifications phát ra, với danh tính
    // mà giao diện đang cầm.
    const db = dbFor(testEnv, AUTH_UID);
    await assertFails(
      getDocs(query(collection(db, 'notifications'), where('recipientUserId', '==', PROFILE_ID)))
    );
  });

  it('lọc theo ĐÚNG mã đăng nhập thì qua — nhưng không có gì để đọc', async () => {
    // Chứng minh luật không hỏng: nó chỉ từ chối vì bộ lọc trỏ sai danh tính.
    const db = dbFor(testEnv, AUTH_UID);
    const snap = await assertSucceeds(
      getDocs(query(collection(db, 'notifications'), where('recipientUserId', '==', AUTH_UID)))
    );
    // Thông báo có tồn tại, nhưng nó được gửi tới mã hồ sơ nên không thuộc về
    // mã đăng nhập này. Sửa bộ lọc thôi thì hết lỗi mà cũng hết thông báo.
    expect((snap as { size: number }).size).toBe(0);
  });

  it('getUserData() không thấy hồ sơ, nên mọi luật theo vai trò đều hỏng', async () => {
    // canManageGifted() đọc users/{auth.uid}. Hồ sơ nằm ở USR_ADMIN nên hàm đó
    // trả null, và tài khoản này KHÔNG tạo được chương trình bồi dưỡng — dù hồ
    // sơ của họ ghi rõ vai trò ADMIN.
    const db = dbFor(testEnv, AUTH_UID);
    const { setDoc, doc } = await import('firebase/firestore');
    await assertFails(
      setDoc(doc(db, 'giftedPrograms', 'GIFTED_X'), {
        id: 'GIFTED_X', schoolId: 'S', code: 'BD-X', title: 'Thử',
        subject: 'Toán', coordinatorId: AUTH_UID, coordinatorName: 'Admin',
        lessons: [], teacherIds: [], status: 'IN_PROGRESS',
        startDate: '2026-09-01', endDate: '2026-12-01',
        createdAt: '2026-08-19 08:00', updatedAt: '2026-08-19 08:00',
      })
    );
  });
});

describe('khi hồ sơ nằm đúng mã đăng nhập', () => {
  beforeEach(async () => {
    await seedDoc(testEnv, 'users', AUTH_UID, {
      id: AUTH_UID,
      fullName: 'Quản trị viên Hệ thống (Admin)',
      email: 'admin@gmail.com',
      roles: ['ADMIN', 'PRINCIPAL', 'TEACHER'],
      activeRole: 'ADMIN',
      departmentId: 'DEPT_BGH',
      departmentName: 'Ban Giám Hiệu',
      isTeachingStaff: true,
      status: 'ACTIVE',
    });
    await seedDoc(testEnv, 'notifications', 'NTF_2', {
      id: 'NTF_2',
      recipientUserId: AUTH_UID,
      createdById: UID.teacherToan,
      title: 'Đơn xin nghỉ cần duyệt',
      message: 'Có đơn cần duyệt.',
      type: 'SYSTEM',
      isRead: false,
      createdAt: '2026-08-19 08:00',
    });
  });

  it('truy vấn thông báo chạy bình thường', async () => {
    const db = dbFor(testEnv, AUTH_UID);
    const snap = await assertSucceeds(
      getDocs(query(collection(db, 'notifications'), where('recipientUserId', '==', AUTH_UID)))
    );
    expect((snap as { size: number }).size).toBe(1);
  });

  it('và các luật theo vai trò cũng chạy', async () => {
    const db = dbFor(testEnv, AUTH_UID);
    const { setDoc, doc } = await import('firebase/firestore');
    await assertSucceeds(
      setDoc(doc(db, 'giftedPrograms', 'GIFTED_Y'), {
        id: 'GIFTED_Y', schoolId: 'S', code: 'BD-Y', title: 'Thử',
        subject: 'Toán', coordinatorId: AUTH_UID, coordinatorName: 'Admin',
        lessons: [], teacherIds: [], status: 'IN_PROGRESS',
        startDate: '2026-09-01', endDate: '2026-12-01',
        createdAt: '2026-08-19 08:00', updatedAt: '2026-08-19 08:00',
      })
    );
  });
});
