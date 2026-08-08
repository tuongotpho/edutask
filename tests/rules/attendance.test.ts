import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { createTestEnv, dbFor, DEPT, seedDoc, seedProfiles, UID } from './helpers';

/**
 * Sổ nề nếp — the most privacy-sensitive collection in the system.
 *
 * These tests exist because the guarantees here are social, not just technical:
 * a teacher must not be able to read records about colleagues, must not be able
 * to alter what was recorded about them, and must not be able to settle a
 * record in their own favour. Every one of those is asserted below rather than
 * left to a comment in the rules file.
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

/** A record naming the Toán teacher, written by the supervisor. */
const RECORD = {
  id: 'ATT_1', schoolId: 'S', code: 'NN-2026-001',
  slot: { date: '2026-08-10', session: 'MORNING', period: 1 },
  classId: 'C1', className: '10A1',
  teacherId: UID.teacherToan, teacherName: 'GV Toán',
  departmentId: DEPT.toan, departmentName: 'Tổ Toán',
  issue: 'LATE', minutes: 10,
  recordedById: UID.supervisor, recordedByName: 'Giám thị',
  status: 'RECORDED',
  createdAt: '2026-08-10 07:10', updatedAt: '2026-08-10 07:10',
};

async function seedRecord() {
  await seedDoc(testEnv, 'attendance', RECORD.id, RECORD);
}

describe('reading the log', () => {
  it('lets the teacher named read their own record', async () => {
    await seedRecord();
    await assertSucceeds(getDoc(doc(dbFor(testEnv, UID.teacherToan), 'attendance', RECORD.id)));
  });

  it('refuses a colleague in the same department', async () => {
    // The single most important guarantee here: colleagues cannot browse each
    // other's discipline records.
    await seedRecord();
    await assertFails(getDoc(doc(dbFor(testEnv, UID.teacherToan2), 'attendance', RECORD.id)));
  });

  it('refuses a teacher from another department', async () => {
    await seedRecord();
    await assertFails(getDoc(doc(dbFor(testEnv, UID.teacherHoa), 'attendance', RECORD.id)));
  });

  it('lets the department leader read their own department', async () => {
    await seedRecord();
    await assertSucceeds(getDoc(doc(dbFor(testEnv, UID.headToan), 'attendance', RECORD.id)));
  });

  it('lets the supervisor and leadership read everything', async () => {
    await seedRecord();
    await assertSucceeds(getDoc(doc(dbFor(testEnv, UID.supervisor), 'attendance', RECORD.id)));
    await assertSucceeds(getDoc(doc(dbFor(testEnv, UID.principal), 'attendance', RECORD.id)));
  });
});

describe('writing the log', () => {
  it('lets the supervisor record an issue under their own name', async () => {
    await assertSucceeds(
      setDoc(doc(dbFor(testEnv, UID.supervisor), 'attendance', 'ATT_NEW'), RECORD)
    );
  });

  it('refuses a department leader recording one', async () => {
    // Deliberate: a record anyone can file about anyone becomes a grievance
    // machine rather than a discipline log.
    await assertFails(
      setDoc(doc(dbFor(testEnv, UID.headToan), 'attendance', 'ATT_NEW'), RECORD)
    );
  });

  it('refuses a plain teacher recording one', async () => {
    await assertFails(
      setDoc(doc(dbFor(testEnv, UID.teacherToan2), 'attendance', 'ATT_NEW'), RECORD)
    );
  });

  it('refuses a record filed under someone else’s name', async () => {
    // Otherwise a supervisor could attribute their own entry to a colleague.
    await assertFails(
      setDoc(doc(dbFor(testEnv, UID.supervisor), 'attendance', 'ATT_NEW'), {
        ...RECORD,
        recordedById: UID.principal,
      })
    );
  });

  it('refuses a record that starts already settled', async () => {
    // Creating one as CONFIRMED would skip the teacher's right of reply.
    await assertFails(
      setDoc(doc(dbFor(testEnv, UID.supervisor), 'attendance', 'ATT_NEW'), {
        ...RECORD,
        status: 'CONFIRMED',
      })
    );
  });
});

describe('the teacher’s right of reply — and its limits', () => {
  it('lets the named teacher add an explanation', async () => {
    await seedRecord();
    await assertSucceeds(
      updateDoc(doc(dbFor(testEnv, UID.teacherToan), 'attendance', RECORD.id), {
        status: 'EXPLAINED',
        explanation: { text: 'Xe hỏng dọc đường', submittedAt: '2026-08-10 08:00' },
        updatedAt: '2026-08-10 08:00',
      })
    );
  });

  it('refuses the teacher excusing their own record', async () => {
    // The whole point of the reply flow: replying is theirs, deciding is not.
    await seedRecord();
    await assertFails(
      updateDoc(doc(dbFor(testEnv, UID.teacherToan), 'attendance', RECORD.id), {
        status: 'EXCUSED',
        updatedAt: '2026-08-10 08:00',
      })
    );
  });

  it('refuses the teacher rewriting what was recorded', async () => {
    await seedRecord();
    await assertFails(
      updateDoc(doc(dbFor(testEnv, UID.teacherToan), 'attendance', RECORD.id), {
        status: 'EXPLAINED',
        explanation: { text: 'Giải trình', submittedAt: '2026-08-10 08:00' },
        minutes: 1,
        updatedAt: '2026-08-10 08:00',
      })
    );
  });

  it('refuses a colleague replying on someone else’s record', async () => {
    await seedRecord();
    await assertFails(
      updateDoc(doc(dbFor(testEnv, UID.teacherToan2), 'attendance', RECORD.id), {
        status: 'EXPLAINED',
        explanation: { text: 'Không phải việc của tôi', submittedAt: '2026-08-10 08:00' },
        updatedAt: '2026-08-10 08:00',
      })
    );
  });

  it('lets leadership settle the record', async () => {
    await seedRecord();
    await assertSucceeds(
      updateDoc(doc(dbFor(testEnv, UID.principal), 'attendance', RECORD.id), {
        status: 'EXCUSED',
        reviewedById: UID.principal,
        updatedAt: '2026-08-10 09:00',
      })
    );
  });
});

describe('deleting', () => {
  it('refuses the teacher named erasing their own record', async () => {
    // Otherwise the log means nothing.
    await seedRecord();
    await assertFails(deleteDoc(doc(dbFor(testEnv, UID.teacherToan), 'attendance', RECORD.id)));
  });

  it('lets the supervisor who wrote it remove a mistake', async () => {
    await seedRecord();
    await assertSucceeds(deleteDoc(doc(dbFor(testEnv, UID.supervisor), 'attendance', RECORD.id)));
  });

  it('lets an admin delete', async () => {
    await seedRecord();
    await assertSucceeds(deleteDoc(doc(dbFor(testEnv, UID.admin), 'attendance', RECORD.id)));
  });
});
