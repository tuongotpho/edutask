import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { anonDb, createTestEnv, dbFor, DEPT, seedDoc, seedProfiles, UID } from './helpers';

/**
 * Đơn xin nghỉ phép.
 *
 * The oldest collection in the app and, until now, the only major one with no
 * rules tests. The approval flow is the app's most consequential workflow, so
 * the questions worth asking are blunt: can someone approve their own leave,
 * route it to a friendlier approver, or quietly change what they asked for
 * after it was signed?
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

const LEAVE = {
  id: 'LV_1', code: 'ĐXN-2026-001',
  applicantId: UID.teacherToan, applicantName: 'GV Toán', applicantRole: 'Giáo viên',
  departmentId: DEPT.toan, departmentName: 'Tổ Toán',
  leaveType: 'SICK', startDate: '2026-08-10', endDate: '2026-08-10',
  totalDays: 1, session: 'FULL_DAY', reason: 'Ốm',
  proofFiles: [], currentStepIndex: 0,
  steps: [
    { level: 'GROUP_LEADER', levelLabel: 'Tổ trưởng', status: 'PENDING' },
    { level: 'VICE_PRINCIPAL', levelLabel: 'Ban Giám Hiệu', status: 'PENDING' },
  ],
  overallStatus: 'IN_REVIEW', history: [],
  createdAt: '2026-08-08 08:00', updatedAt: '2026-08-08 08:00',
};

async function seedLeave(over: Record<string, unknown> = {}) {
  await seedDoc(testEnv, 'leaves', LEAVE.id, { ...LEAVE, ...over });
}

describe('ai đọc được đơn nghỉ', () => {
  it('cho người nộp đơn đọc đơn của mình', async () => {
    await seedLeave();
    await assertSucceeds(getDoc(doc(dbFor(testEnv, UID.teacherToan), 'leaves', LEAVE.id)));
  });

  it('cho giáo viên được phân công dạy thay đọc được', async () => {
    // Without this they cannot see the class they have been asked to cover.
    await seedLeave({ substituteTeacherId: UID.teacherToan2 });
    await assertSucceeds(getDoc(doc(dbFor(testEnv, UID.teacherToan2), 'leaves', LEAVE.id)));
  });

  it('cho tổ trưởng của tổ đó đọc được', async () => {
    await seedLeave();
    await assertSucceeds(getDoc(doc(dbFor(testEnv, UID.headToan), 'leaves', LEAVE.id)));
  });

  it('CHẶN đồng nghiệp không liên quan', async () => {
    await seedLeave();
    await assertFails(getDoc(doc(dbFor(testEnv, UID.teacherHoa), 'leaves', LEAVE.id)));
  });

  it('CHẶN tổ trưởng tổ khác', async () => {
    await seedLeave();
    await assertFails(getDoc(doc(dbFor(testEnv, UID.headHoa), 'leaves', LEAVE.id)));
  });

  it('CHẶN người chưa đăng nhập', async () => {
    await seedLeave();
    await assertFails(getDoc(doc(anonDb(testEnv), 'leaves', LEAVE.id)));
  });
});

describe('tạo đơn', () => {
  it('cho giáo viên nộp đơn của chính mình', async () => {
    await assertSucceeds(
      setDoc(doc(dbFor(testEnv, UID.teacherToan), 'leaves', 'LV_NEW'), LEAVE)
    );
  });

  it('CHẶN nộp đơn đứng tên người khác', async () => {
    await assertFails(
      setDoc(doc(dbFor(testEnv, UID.teacherToan2), 'leaves', 'LV_NEW'), LEAVE)
    );
  });

  it('CHẶN đơn tạo ra đã ở trạng thái ĐÃ DUYỆT', async () => {
    await assertFails(
      setDoc(doc(dbFor(testEnv, UID.teacherToan), 'leaves', 'LV_NEW'), {
        ...LEAVE, overallStatus: 'APPROVED',
      })
    );
  });

  it('CHẶN định tuyến đơn sang tổ khác ngay lúc tạo', async () => {
    // Guards against picking a friendlier approver.
    await assertFails(
      setDoc(doc(dbFor(testEnv, UID.teacherToan), 'leaves', 'LV_NEW'), {
        ...LEAVE, departmentId: DEPT.hoa,
      })
    );
  });
});

describe('duyệt đơn', () => {
  it('cho tổ trưởng của tổ đó duyệt', async () => {
    await seedLeave();
    await assertSucceeds(
      updateDoc(doc(dbFor(testEnv, UID.headToan), 'leaves', LEAVE.id), { overallStatus: 'APPROVED' })
    );
  });

  it('CHẶN người nộp tự duyệt đơn của mình', async () => {
    await seedLeave();
    await assertFails(
      updateDoc(doc(dbFor(testEnv, UID.teacherToan), 'leaves', LEAVE.id), { overallStatus: 'APPROVED' })
    );
  });

  it('CHẶN tổ trưởng tổ khác duyệt', async () => {
    await seedLeave();
    await assertFails(
      updateDoc(doc(dbFor(testEnv, UID.headHoa), 'leaves', LEAVE.id), { overallStatus: 'APPROVED' })
    );
  });

  it('cho người nộp tự hủy đơn của mình', async () => {
    await seedLeave();
    await assertSucceeds(
      updateDoc(doc(dbFor(testEnv, UID.teacherToan), 'leaves', LEAVE.id), { overallStatus: 'CANCELLED' })
    );
  });
});

/**
 * Blocking `overallStatus` alone is not enough. Everything below is a way to
 * reach an outcome the approval flow was supposed to control, WITHOUT ever
 * touching `overallStatus` — which is exactly what the current rule permits.
 */
describe('người nộp KHÔNG được sửa các trường quyết định luồng duyệt', () => {
  it('CHẶN tự đánh dấu bước duyệt là APPROVED', async () => {
    await seedLeave();
    await assertFails(
      updateDoc(doc(dbFor(testEnv, UID.teacherToan), 'leaves', LEAVE.id), {
        steps: [
          { level: 'GROUP_LEADER', levelLabel: 'Tổ trưởng', status: 'APPROVED' },
          { level: 'VICE_PRINCIPAL', levelLabel: 'Ban Giám Hiệu', status: 'APPROVED' },
        ],
      })
    );
  });

  it('CHẶN nhảy qua các bước bằng currentStepIndex', async () => {
    await seedLeave();
    await assertFails(
      updateDoc(doc(dbFor(testEnv, UID.teacherToan), 'leaves', LEAVE.id), { currentStepIndex: 99 })
    );
  });

  it('CHẶN đổi tổ SAU khi tạo để né người duyệt', async () => {
    // The create rule pins the department; if update does not, that guard is
    // worthless — file it correctly, then re-route it a second later.
    await seedLeave();
    await assertFails(
      updateDoc(doc(dbFor(testEnv, UID.teacherToan), 'leaves', LEAVE.id), { departmentId: DEPT.hoa })
    );
  });

  it('sửa số ngày nghỉ thì BẮT BUỘC phải qua duyệt lại từ đầu', async () => {
    // `totalDays` is intentionally NOT frozen: editing the dates recalculates
    // it, and freezing it would break "chỉnh sửa & gửi lại đơn".
    //
    // The guarantee is different, and stronger: an applicant cannot change the
    // number AND keep an existing signature. Any edit that touches the request
    // must send it back through approval — so the approver sees the new figure
    // alongside the dates before signing anything.
    await seedLeave({
      currentStepIndex: 1,
      steps: [
        { level: 'GROUP_LEADER', levelLabel: 'Tổ trưởng', status: 'APPROVED', approverName: 'Tổ trưởng Toán' },
        { level: 'VICE_PRINCIPAL', levelLabel: 'Ban Giám Hiệu', status: 'PENDING' },
      ],
    });

    // Bumping the days while keeping the tổ trưởng's signature: refused.
    await assertFails(
      updateDoc(doc(dbFor(testEnv, UID.teacherToan), 'leaves', LEAVE.id), { totalDays: 30 })
    );

    // Bumping the days AND resetting the flow to the start: allowed, because
    // every approver now has to look at it again.
    await assertSucceeds(
      updateDoc(doc(dbFor(testEnv, UID.teacherToan), 'leaves', LEAVE.id), {
        totalDays: 30,
        currentStepIndex: 0,
        steps: [
          { level: 'GROUP_LEADER', levelLabel: 'Tổ trưởng', status: 'PENDING' },
          { level: 'VICE_PRINCIPAL', levelLabel: 'Ban Giám Hiệu', status: 'PENDING' },
        ],
        overallStatus: 'IN_REVIEW',
      })
    );
  });

  it('CHẶN tự chỉ định người dạy thay mà không qua kiểm tra trùng lịch', async () => {
    await seedLeave();
    await assertFails(
      updateDoc(doc(dbFor(testEnv, UID.teacherToan), 'leaves', LEAVE.id), {
        substituteTeacherId: UID.teacherHoa,
        substituteTeacherName: 'GV Hóa',
      })
    );
  });

  it('CHẶN đổi tên người nộp đơn', async () => {
    await seedLeave();
    await assertFails(
      updateDoc(doc(dbFor(testEnv, UID.teacherToan), 'leaves', LEAVE.id), {
        applicantId: UID.teacherToan2,
      })
    );
  });

  it('VẪN CHO sửa nội dung hợp lệ của chính mình', async () => {
    // The restriction must not lock the applicant out of legitimate edits —
    // otherwise it fixes the hole by breaking the feature.
    await seedLeave();
    await assertSucceeds(
      updateDoc(doc(dbFor(testEnv, UID.teacherToan), 'leaves', LEAVE.id), {
        reason: 'Ốm, đã có giấy khám của bệnh viện',
        updatedAt: '2026-08-08 09:00',
      })
    );
  });
});

/**
 * A gap neither the code review nor the first pass of these tests identified,
 * found while working out why the `totalDays` test above was wrong.
 *
 * The number of approval steps is computed by `buildApprovalSteps()` in the
 * BROWSER at creation time, and no rule checks the result against
 * `settings/workflow`. A modified client can therefore file a month-long leave
 * carrying only the department step, and once the tổ trưởng signs it the
 * request is fully approved without Ban Giám Hiệu ever seeing it.
 *
 * This cannot be closed in rules alone: validating it means recomputing the
 * expected step count from the workflow config AND checking `totalDays`
 * against the dates, and rules cannot do date arithmetic on `YYYY-MM-DD`
 * strings. The real fix is to move leave creation into a Cloud Function — now
 * possible, since the project is on Blaze.
 *
 * The test below asserts what is TRUE today rather than what we wish were
 * true, so the suite stays honest and green while the gap stays visible.
 */
describe('giới hạn đã biết: số bước duyệt do client quyết định', () => {
  it('rules KHÔNG kiểm tra số bước duyệt có khớp cấu hình luồng hay không', async () => {
    await assertSucceeds(
      setDoc(doc(dbFor(testEnv, UID.teacherToan), 'leaves', 'LV_ONE_STEP'), {
        ...LEAVE,
        totalDays: 30,
        startDate: '2026-09-01',
        endDate: '2026-09-30',
        // Only the department step — no Ban Giám Hiệu, whatever the config says.
        steps: [{ level: 'GROUP_LEADER', levelLabel: 'Tổ trưởng', status: 'PENDING' }],
      })
    );
  });
});

describe('xóa đơn', () => {
  it('cho người nộp xóa đơn của mình', async () => {
    await seedLeave();
    await assertSucceeds(deleteDoc(doc(dbFor(testEnv, UID.teacherToan), 'leaves', LEAVE.id)));
  });

  it('CHẶN đồng nghiệp xóa đơn của người khác', async () => {
    await seedLeave();
    await assertFails(deleteDoc(doc(dbFor(testEnv, UID.teacherToan2), 'leaves', LEAVE.id)));
  });
});
