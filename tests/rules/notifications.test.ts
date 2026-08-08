import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { anonDb, createTestEnv, dbFor, seedDoc, seedProfiles, UID } from './helpers';

/**
 * Thông báo.
 *
 * The awkward collection. Every feature in the app writes here from the
 * ordinary user's browser — a teacher filing leave notifies their tổ trưởng, a
 * supervisor filing a lateness record notifies the teacher — so "only admins
 * may create" is not an available answer. The rule therefore lets any signed-in
 * account create a notification for anyone.
 *
 * That is the spam and impersonation surface. The tests below pin down what IS
 * guaranteed today, and state plainly what is not.
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

const NOTIF = {
  id: 'NTF_1',
  recipientUserId: UID.teacherToan,
  createdById: UID.teacherToan,
  createdByName: 'GV Toán',
  title: 'Đơn xin nghỉ cần duyệt',
  message: 'GV Toán đã nộp đơn xin nghỉ.',
  type: 'SYSTEM',
  isRead: false,
  createdAt: '2026-08-08 08:00',
};

describe('ai đọc được thông báo', () => {
  it('chỉ người nhận đọc được', async () => {
    await seedDoc(testEnv, 'notifications', NOTIF.id, NOTIF);
    await assertSucceeds(getDoc(doc(dbFor(testEnv, UID.teacherToan), 'notifications', NOTIF.id)));
  });

  it('CHẶN đồng nghiệp đọc thông báo của người khác', async () => {
    await seedDoc(testEnv, 'notifications', NOTIF.id, NOTIF);
    await assertFails(getDoc(doc(dbFor(testEnv, UID.teacherToan2), 'notifications', NOTIF.id)));
  });

  it('CHẶN cả quản trị viên đọc thông báo riêng của người khác', async () => {
    // Deliberate: an inbox is personal, and nothing in the app needs an admin
    // to read one. The Cloud Function uses the Admin SDK and bypasses rules.
    await seedDoc(testEnv, 'notifications', NOTIF.id, NOTIF);
    await assertFails(getDoc(doc(dbFor(testEnv, UID.admin), 'notifications', NOTIF.id)));
  });

  it('CHẶN người chưa đăng nhập', async () => {
    await seedDoc(testEnv, 'notifications', NOTIF.id, NOTIF);
    await assertFails(getDoc(doc(anonDb(testEnv), 'notifications', NOTIF.id)));
  });
});

describe('tạo thông báo — cái được bảo đảm', () => {
  it('cho giáo viên báo cho tổ trưởng (luồng bình thường của app)', async () => {
    await assertSucceeds(
      setDoc(doc(dbFor(testEnv, UID.teacherToan), 'notifications', 'NTF_NEW'), {
        ...NOTIF, recipientUserId: UID.headToan,
      })
    );
  });

  it('CHẶN tạo thông báo thiếu trường bắt buộc', async () => {
    await assertFails(
      setDoc(doc(dbFor(testEnv, UID.teacherToan), 'notifications', 'NTF_NEW'), {
        recipientUserId: UID.headToan, isRead: false,
      })
    );
  });

  it('CHẶN tạo thông báo đã đánh dấu là ĐÃ ĐỌC', async () => {
    // Would let someone plant a notice the recipient never sees a badge for.
    await assertFails(
      setDoc(doc(dbFor(testEnv, UID.teacherToan), 'notifications', 'NTF_NEW'), {
        ...NOTIF, isRead: true,
      })
    );
  });

  it('CHẶN người chưa đăng nhập tạo thông báo', async () => {
    await assertFails(
      setDoc(doc(anonDb(testEnv), 'notifications', 'NTF_NEW'), NOTIF)
    );
  });
});

/**
 * Attribution.
 *
 * Restricting creation to admins was never available — the app's normal flow
 * has teachers notifying their tổ trưởng. What IS enforceable is that a
 * notification always names the account that sent it, so an alarming message
 * can never arrive anonymously.
 */
describe('truy nguồn người gửi', () => {
  it('CHẶN thông báo không ghi người gửi', async () => {
    const { createdById, createdByName, ...withoutSender } = NOTIF;
    void createdById; void createdByName;

    await assertFails(
      setDoc(doc(dbFor(testEnv, UID.teacherHoa), 'notifications', 'NTF_ANON'), {
        ...withoutSender,
        recipientUserId: UID.teacherToan,
        title: 'Thông báo kỷ luật',
        message: 'Bạn bị đình chỉ công tác từ ngày mai.',
      })
    );
  });

  it('CHẶN mạo danh người gửi khác', async () => {
    // Without this, a forged notice could be dressed up as coming from the
    // principal — the difference between a nuisance and an abuse.
    await assertFails(
      setDoc(doc(dbFor(testEnv, UID.teacherHoa), 'notifications', 'NTF_SPOOF'), {
        ...NOTIF,
        recipientUserId: UID.teacherToan,
        createdById: UID.principal,
        createdByName: 'Hiệu trưởng',
      })
    );
  });

  it('vẫn CHO gửi khi ghi đúng tên mình — kể cả tin khó nghe', async () => {
    // The guarantee is traceability, not censorship: a supervisor must still be
    // able to tell a teacher something unwelcome.
    await assertSucceeds(
      setDoc(doc(dbFor(testEnv, UID.supervisor), 'notifications', 'NTF_REAL'), {
        ...NOTIF,
        recipientUserId: UID.teacherToan,
        createdById: UID.supervisor,
        createdByName: 'Giám thị',
        title: 'Có ghi nhận nề nếp về bạn',
      })
    );
  });
});

describe('đánh dấu đã đọc', () => {
  it('cho người nhận đánh dấu đã đọc', async () => {
    await seedDoc(testEnv, 'notifications', NOTIF.id, NOTIF);
    await assertSucceeds(
      updateDoc(doc(dbFor(testEnv, UID.teacherToan), 'notifications', NOTIF.id), { isRead: true })
    );
  });

  it('CHẶN người nhận sửa nội dung thông báo', async () => {
    // The inbox must stay a faithful record of what was sent.
    await seedDoc(testEnv, 'notifications', NOTIF.id, NOTIF);
    await assertFails(
      updateDoc(doc(dbFor(testEnv, UID.teacherToan), 'notifications', NOTIF.id), {
        isRead: true,
        message: 'Nội dung đã bị sửa',
      })
    );
  });

  it('CHẶN người khác đánh dấu hộ', async () => {
    await seedDoc(testEnv, 'notifications', NOTIF.id, NOTIF);
    await assertFails(
      updateDoc(doc(dbFor(testEnv, UID.teacherToan2), 'notifications', NOTIF.id), { isRead: true })
    );
  });

  it('cho người nhận xóa thông báo của mình', async () => {
    await seedDoc(testEnv, 'notifications', NOTIF.id, NOTIF);
    await assertSucceeds(
      deleteDoc(doc(dbFor(testEnv, UID.teacherToan), 'notifications', NOTIF.id))
    );
  });

  it('CHẶN người khác xóa thông báo của mình', async () => {
    await seedDoc(testEnv, 'notifications', NOTIF.id, NOTIF);
    await assertFails(
      deleteDoc(doc(dbFor(testEnv, UID.teacherToan2), 'notifications', NOTIF.id))
    );
  });
});
