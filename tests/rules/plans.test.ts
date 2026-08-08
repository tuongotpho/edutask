import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { createTestEnv, dbFor, DEPT, seedDoc, seedProfiles, UID } from './helpers';

/**
 * Kế hoạch & lịch nhắc.
 *
 * The rule worth proving: a tổ trưởng owns their own tổ's plans and reminder
 * rhythm, and nothing beyond it. Without that boundary one department leader
 * could schedule reminders at the whole school — turning one person's checklist
 * into everybody else's notifications.
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

const DEPT_PLAN = {
  id: 'PLAN_TOAN', schoolId: 'S', code: 'KH-2026-001',
  title: 'Kế hoạch tổ Toán', scope: 'DEPARTMENT',
  departmentId: DEPT.toan, departmentName: 'Tổ Toán',
  startDate: '2026-09-01', endDate: '2027-05-31',
  milestones: [], ownerId: UID.headToan, ownerName: 'Tổ trưởng Toán',
  isArchived: false,
  createdAt: '2026-08-01 08:00', updatedAt: '2026-08-01 08:00',
};

const SCHOOL_PLAN = {
  ...DEPT_PLAN,
  id: 'PLAN_SCHOOL', scope: 'SCHOOL',
  title: 'Kế hoạch năm học',
  departmentId: null, departmentName: null,
  ownerId: UID.principal, ownerName: 'Hiệu trưởng',
};

const DEPT_REMINDER = {
  id: 'RMD_TOAN', schoolId: 'S',
  title: 'Nhắc nộp kế hoạch tháng', scope: 'DEPARTMENT',
  departmentId: DEPT.toan, departmentName: 'Tổ Toán',
  audience: 'DEPARTMENT',
  recurrence: 'MONTHLY', dayOfMonth: 25, timeOfDay: '07:30',
  isActive: true,
  createdById: UID.headToan, createdByName: 'Tổ trưởng Toán',
  createdAt: '2026-08-01 08:00', updatedAt: '2026-08-01 08:00',
};

describe('plans — everyone may read', () => {
  it('lets a plain teacher read a plan', async () => {
    // Progress figures only leadership can see defeat the point of a plan.
    await seedDoc(testEnv, 'plans', SCHOOL_PLAN.id, SCHOOL_PLAN);
    await assertSucceeds(getDoc(doc(dbFor(testEnv, UID.teacherToan), 'plans', SCHOOL_PLAN.id)));
  });
});

describe('plans — who may write', () => {
  it('lets the principal create a school-wide plan', async () => {
    await assertSucceeds(
      setDoc(doc(dbFor(testEnv, UID.principal), 'plans', 'PLAN_NEW'), SCHOOL_PLAN)
    );
  });

  it('refuses a department leader creating a school-wide plan', async () => {
    await assertFails(
      setDoc(doc(dbFor(testEnv, UID.headToan), 'plans', 'PLAN_NEW'), SCHOOL_PLAN)
    );
  });

  it('lets a department leader create a plan for their own department', async () => {
    await assertSucceeds(
      setDoc(doc(dbFor(testEnv, UID.headToan), 'plans', 'PLAN_NEW'), DEPT_PLAN)
    );
  });

  it('refuses a department leader creating a plan for another department', async () => {
    await assertFails(
      setDoc(doc(dbFor(testEnv, UID.headToan), 'plans', 'PLAN_NEW'), {
        ...DEPT_PLAN,
        departmentId: DEPT.hoa,
      })
    );
  });

  it('refuses a plain teacher creating any plan', async () => {
    await assertFails(
      setDoc(doc(dbFor(testEnv, UID.teacherToan), 'plans', 'PLAN_NEW'), DEPT_PLAN)
    );
  });

  it('refuses a plain teacher ticking off a milestone', async () => {
    await seedDoc(testEnv, 'plans', DEPT_PLAN.id, DEPT_PLAN);
    await assertFails(
      updateDoc(doc(dbFor(testEnv, UID.teacherToan), 'plans', DEPT_PLAN.id), {
        milestones: [{ id: 'M1', title: 'Xong', dueDate: '2026-09-30', status: 'DONE' }],
      })
    );
  });

  it('refuses a department leader editing another department’s plan', async () => {
    await seedDoc(testEnv, 'plans', 'PLAN_HOA', { ...DEPT_PLAN, id: 'PLAN_HOA', departmentId: DEPT.hoa });
    await assertFails(
      updateDoc(doc(dbFor(testEnv, UID.headToan), 'plans', 'PLAN_HOA'), { title: 'Đổi tên' })
    );
  });

  it('lets the executive edit any plan', async () => {
    await seedDoc(testEnv, 'plans', DEPT_PLAN.id, DEPT_PLAN);
    await assertSucceeds(
      updateDoc(doc(dbFor(testEnv, UID.principal), 'plans', DEPT_PLAN.id), { title: 'BGH điều chỉnh' })
    );
  });
});

describe('reminders — the notification-volume boundary', () => {
  it('lets a department leader schedule a reminder for their own tổ', async () => {
    await assertSucceeds(
      setDoc(doc(dbFor(testEnv, UID.headToan), 'reminders', 'RMD_NEW'), DEPT_REMINDER)
    );
  });

  it('refuses a department leader scheduling a school-wide reminder', async () => {
    // The whole point: one person's checklist must not become everyone's pings.
    await assertFails(
      setDoc(doc(dbFor(testEnv, UID.headToan), 'reminders', 'RMD_NEW'), {
        ...DEPT_REMINDER,
        scope: 'SCHOOL',
        audience: 'ALL_STAFF',
      })
    );
  });

  it('refuses a department leader scheduling into another tổ', async () => {
    await assertFails(
      setDoc(doc(dbFor(testEnv, UID.headToan), 'reminders', 'RMD_NEW'), {
        ...DEPT_REMINDER,
        departmentId: DEPT.hoa,
      })
    );
  });

  it('refuses a schedule attributed to someone else', async () => {
    await assertFails(
      setDoc(doc(dbFor(testEnv, UID.headToan), 'reminders', 'RMD_NEW'), {
        ...DEPT_REMINDER,
        createdById: UID.principal,
      })
    );
  });

  it('lets the principal schedule a school-wide reminder', async () => {
    await assertSucceeds(
      setDoc(doc(dbFor(testEnv, UID.principal), 'reminders', 'RMD_NEW'), {
        ...DEPT_REMINDER,
        scope: 'SCHOOL',
        audience: 'ALL_STAFF',
        createdById: UID.principal,
      })
    );
  });

  it('refuses a plain teacher scheduling anything', async () => {
    await assertFails(
      setDoc(doc(dbFor(testEnv, UID.teacherToan), 'reminders', 'RMD_NEW'), {
        ...DEPT_REMINDER,
        createdById: UID.teacherToan,
      })
    );
  });

  it('refuses a plain teacher switching a reminder off', async () => {
    await seedDoc(testEnv, 'reminders', DEPT_REMINDER.id, DEPT_REMINDER);
    await assertFails(
      updateDoc(doc(dbFor(testEnv, UID.teacherToan), 'reminders', DEPT_REMINDER.id), { isActive: false })
    );
  });

  it('lets everyone read the schedules so pings are explainable', async () => {
    await seedDoc(testEnv, 'reminders', DEPT_REMINDER.id, DEPT_REMINDER);
    await assertSucceeds(getDoc(doc(dbFor(testEnv, UID.teacherToan), 'reminders', DEPT_REMINDER.id)));
  });

  it('lets the creator delete their own schedule', async () => {
    await seedDoc(testEnv, 'reminders', DEPT_REMINDER.id, DEPT_REMINDER);
    await assertSucceeds(deleteDoc(doc(dbFor(testEnv, UID.headToan), 'reminders', DEPT_REMINDER.id)));
  });

  it('refuses an unrelated teacher deleting a schedule', async () => {
    await seedDoc(testEnv, 'reminders', DEPT_REMINDER.id, DEPT_REMINDER);
    await assertFails(deleteDoc(doc(dbFor(testEnv, UID.teacherHoa), 'reminders', DEPT_REMINDER.id)));
  });
});
