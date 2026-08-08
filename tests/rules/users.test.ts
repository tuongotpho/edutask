import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { anonDb, createTestEnv, dbFor, DEPT, seedDoc, seedProfiles, UID } from './helpers';

/**
 * Hồ sơ người dùng — the privilege boundary itself.
 *
 * `users` is what every other rule in the file reads to decide who someone is:
 * `getUserData().roles` drives isAdmin(), isDeptLeader(), canRecordAttendance()
 * and the rest. So a hole here is not one hole — it is every hole at once. The
 * tests below are the ones that matter most in the whole suite.
 */

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await createTestEnv();
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seedProfiles(testEnv);
});

const NEW_UID = 'u_brand_new';

function pendingProfile(uid: string, over: Record<string, unknown> = {}) {
  return {
    id: uid,
    fullName: 'Người mới',
    email: `${uid}@truong.edu.vn`,
    roles: ['TEACHER'],
    activeRole: 'TEACHER',
    departmentId: DEPT.toan,
    departmentName: 'Tổ Toán',
    isTeachingStaff: true,
    status: 'PENDING_APPROVAL',
    ...over,
  };
}

describe('tự đăng ký tài khoản', () => {
  it('cho người mới tạo hồ sơ của chính mình ở trạng thái CHỜ DUYỆT', async () => {
    await assertSucceeds(
      setDoc(doc(dbFor(testEnv, NEW_UID), 'users', NEW_UID), pendingProfile(NEW_UID))
    );
  });

  it('CHẶN tự đăng ký thẳng thành ADMIN', async () => {
    // The classic privilege-escalation hole: sign up, name yourself admin.
    await assertFails(
      setDoc(doc(dbFor(testEnv, NEW_UID), 'users', NEW_UID),
        pendingProfile(NEW_UID, { roles: ['ADMIN'] }))
    );
  });

  it('CHẶN tự đăng ký rồi tự duyệt luôn (status ACTIVE)', async () => {
    await assertFails(
      setDoc(doc(dbFor(testEnv, NEW_UID), 'users', NEW_UID),
        pendingProfile(NEW_UID, { status: 'ACTIVE' }))
    );
  });

  it('CHẶN tự đăng ký kèm vai trò tổ trưởng', async () => {
    await assertFails(
      setDoc(doc(dbFor(testEnv, NEW_UID), 'users', NEW_UID),
        pendingProfile(NEW_UID, { roles: ['TEACHER', 'HEAD_OF_DEPT'] }))
    );
  });

  it('CHẶN tạo hồ sơ cho người khác', async () => {
    await assertFails(
      setDoc(doc(dbFor(testEnv, NEW_UID), 'users', 'u_someone_else'),
        pendingProfile('u_someone_else'))
    );
  });

  it('CHẶN người chưa đăng nhập tạo hồ sơ', async () => {
    await assertFails(
      setDoc(doc(anonDb(testEnv), 'users', NEW_UID), pendingProfile(NEW_UID))
    );
  });

  it('cho quản trị viên tạo hồ sơ bất kỳ', async () => {
    await assertSucceeds(
      setDoc(doc(dbFor(testEnv, UID.admin), 'users', NEW_UID),
        pendingProfile(NEW_UID, { roles: ['SECRETARY'], status: 'ACTIVE' }))
    );
  });
});

describe('tự sửa hồ sơ của mình', () => {
  it('cho sửa những thông tin vô hại', async () => {
    await assertSucceeds(
      updateDoc(doc(dbFor(testEnv, UID.teacherToan), 'users', UID.teacherToan), {
        fullName: 'Nguyễn Văn A (đã đổi)',
        phone: '0900000000',
      })
    );
  });

  it('CHẶN tự nâng vai trò của mình', async () => {
    await assertFails(
      updateDoc(doc(dbFor(testEnv, UID.teacherToan), 'users', UID.teacherToan), {
        roles: ['TEACHER', 'ADMIN'],
      })
    );
  });

  it('CHẶN tự đổi vai trò đang thao tác', async () => {
    // activeRole drives what the client shows AND what several rules accept;
    // switching to a role you were never granted must be impossible.
    await assertFails(
      updateDoc(doc(dbFor(testEnv, UID.teacherToan), 'users', UID.teacherToan), {
        activeRole: 'PRINCIPAL',
      })
    );
  });

  it('CHẶN tự duyệt tài khoản đang chờ của mình', async () => {
    // Must start from a genuinely PENDING account. Writing status:'ACTIVE'
    // onto a user who is already ACTIVE produces an empty diff, so the rule
    // allows it — correctly, since nothing changed. Testing that would prove
    // nothing at all.
    const pendingUid = 'u_awaiting_approval';
    await seedDoc(testEnv, 'users', pendingUid, pendingProfile(pendingUid));

    await assertFails(
      updateDoc(doc(dbFor(testEnv, pendingUid), 'users', pendingUid), { status: 'ACTIVE' })
    );
  });

  it('CHẶN tự chuyển mình sang tổ khác', async () => {
    // departmentId decides which department's leave, attendance and plans you
    // can reach — it is an access-control field, not a profile detail.
    await assertFails(
      updateDoc(doc(dbFor(testEnv, UID.teacherToan), 'users', UID.teacherToan), {
        departmentId: DEPT.hoa,
      })
    );
  });

  it('CHẶN sửa hồ sơ của đồng nghiệp', async () => {
    await assertFails(
      updateDoc(doc(dbFor(testEnv, UID.teacherToan), 'users', UID.teacherToan2), {
        fullName: 'Bị đổi tên',
      })
    );
  });

  it('CHẶN cả tổ trưởng nâng vai trò cho người trong tổ mình', async () => {
    await assertFails(
      updateDoc(doc(dbFor(testEnv, UID.headToan), 'users', UID.teacherToan), {
        roles: ['TEACHER', 'HEAD_OF_DEPT'],
      })
    );
  });

  it('cho quản trị viên sửa vai trò', async () => {
    await assertSucceeds(
      updateDoc(doc(dbFor(testEnv, UID.admin), 'users', UID.teacherToan), {
        roles: ['TEACHER', 'GROUP_LEADER'],
      })
    );
  });
});

describe('đọc và xóa', () => {
  it('cho mọi tài khoản đã đăng nhập đọc danh sách người dùng', async () => {
    // Needed for every assignee/substitute picker in the app.
    await assertSucceeds(getDoc(doc(dbFor(testEnv, UID.teacherToan), 'users', UID.teacherToan2)));
  });

  it('CHẶN người chưa đăng nhập đọc', async () => {
    await assertFails(getDoc(doc(anonDb(testEnv), 'users', UID.teacherToan)));
  });

  it('CHẶN tự xóa tài khoản của mình', async () => {
    await assertFails(deleteDoc(doc(dbFor(testEnv, UID.teacherToan), 'users', UID.teacherToan)));
  });

  it('CHẶN tổ trưởng xóa tài khoản người khác', async () => {
    await assertFails(deleteDoc(doc(dbFor(testEnv, UID.headToan), 'users', UID.teacherToan)));
  });

  it('cho quản trị viên xóa', async () => {
    await assertSucceeds(deleteDoc(doc(dbFor(testEnv, UID.admin), 'users', UID.teacherToan)));
  });
});
