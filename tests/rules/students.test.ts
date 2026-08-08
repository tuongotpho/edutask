import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { anonDb, createTestEnv, dbFor, seedDoc, seedProfiles, UID } from './helpers';

/**
 * Học sinh — hồ sơ, điểm danh, nề nếp.
 *
 * This is personal data about minors, so the boundaries are asserted rather
 * than assumed. The load-bearing claims:
 *
 *  - Only the office may WRITE the roster. A subject teacher must not be able
 *    to alter a child's home contact details.
 *  - Any teacher MAY record attendance and conduct — that is the sổ đầu bài
 *    they fill in during their own lesson.
 *  - A teacher may not quietly soften or delete a colleague's record of an
 *    incident.
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

const STUDENT = {
  id: 'STU_1', schoolId: 'S', code: 'HS001',
  fullName: 'Nguyễn Văn A',
  classId: 'C1', className: '10A1',
  parentName: 'Nguyễn Văn B', parentPhone: '0900000000',
  needsSupport: false, isActive: true,
  createdAt: '2026-08-01 08:00', updatedAt: '2026-08-01 08:00',
};

const ROLL = {
  id: 'C1_2026-08-10_MORNING', schoolId: 'S',
  classId: 'C1', className: '10A1',
  date: '2026-08-10', session: 'MORNING',
  entries: [{ studentId: 'STU_1', studentName: 'Nguyễn Văn A', mark: 'PRESENT' }],
  presentCount: 1, absentCount: 0, lateCount: 0,
  recordedById: UID.teacherToan, recordedByName: 'GV Toán',
  createdAt: '2026-08-10 07:00', updatedAt: '2026-08-10 07:00',
};

const CONDUCT = {
  id: 'CDT_1', schoolId: 'S',
  studentId: 'STU_1', studentName: 'Nguyễn Văn A',
  classId: 'C1', className: '10A1',
  kind: 'VIOLATION', category: 'UNIFORM',
  description: 'Không đeo bảng tên', points: 2,
  date: '2026-08-10',
  recordedById: UID.teacherToan, recordedByName: 'GV Toán',
  createdAt: '2026-08-10 08:00', updatedAt: '2026-08-10 08:00',
};

describe('hồ sơ học sinh — write is narrow, read is wide', () => {
  it('lets any signed-in teacher read a student record', async () => {
    // The deliberate trade-off: a teacher needs to reach a parent about a child
    // who has not turned up, and rules cannot hide a single field.
    await seedDoc(testEnv, 'students', STUDENT.id, STUDENT);
    await assertSucceeds(getDoc(doc(dbFor(testEnv, UID.teacherToan), 'students', STUDENT.id)));
  });

  it('refuses a signed-out reader', async () => {
    await seedDoc(testEnv, 'students', STUDENT.id, STUDENT);
    await assertFails(getDoc(doc(anonDb(testEnv), 'students', STUDENT.id)));
  });

  it('lets the secretary maintain the roster', async () => {
    await assertSucceeds(
      setDoc(doc(dbFor(testEnv, UID.secretary), 'students', 'STU_NEW'), STUDENT)
    );
  });

  it('refuses a subject teacher editing a child’s parent phone', async () => {
    await seedDoc(testEnv, 'students', STUDENT.id, STUDENT);
    await assertFails(
      updateDoc(doc(dbFor(testEnv, UID.teacherToan), 'students', STUDENT.id), {
        parentPhone: '0911111111',
      })
    );
  });

  it('refuses a department leader creating a student', async () => {
    await assertFails(
      setDoc(doc(dbFor(testEnv, UID.headToan), 'students', 'STU_NEW'), STUDENT)
    );
  });

  it('refuses the supervisor editing the roster', async () => {
    // Recording lateness does not imply editing personal records.
    await seedDoc(testEnv, 'students', STUDENT.id, STUDENT);
    await assertFails(
      updateDoc(doc(dbFor(testEnv, UID.supervisor), 'students', STUDENT.id), { fullName: 'Đổi tên' })
    );
  });

  it('reserves deletion for admins', async () => {
    await seedDoc(testEnv, 'students', STUDENT.id, STUDENT);
    await assertFails(deleteDoc(doc(dbFor(testEnv, UID.secretary), 'students', STUDENT.id)));
    await assertSucceeds(deleteDoc(doc(dbFor(testEnv, UID.admin), 'students', STUDENT.id)));
  });
});

describe('điểm danh học sinh', () => {
  it('lets an ordinary teacher take the register', async () => {
    await assertSucceeds(
      setDoc(doc(dbFor(testEnv, UID.teacherToan), 'studentAttendance', ROLL.id), ROLL)
    );
  });

  it('lets a second teacher correct the same roll', async () => {
    // The id is derived from class+date+session precisely so both land here.
    await seedDoc(testEnv, 'studentAttendance', ROLL.id, ROLL);
    await assertSucceeds(
      updateDoc(doc(dbFor(testEnv, UID.teacherToan2), 'studentAttendance', ROLL.id), {
        entries: [{ studentId: 'STU_1', studentName: 'Nguyễn Văn A', mark: 'EXCUSED' }],
      })
    );
  });

  it('refuses an account with no teaching role', async () => {
    await assertFails(
      setDoc(doc(dbFor(testEnv, UID.accountant), 'studentAttendance', ROLL.id), ROLL)
    );
  });

  it('refuses a teacher deleting a roll', async () => {
    // Deleting erases the record that a child was marked absent; corrections
    // are made by editing marks, which keeps the history.
    await seedDoc(testEnv, 'studentAttendance', ROLL.id, ROLL);
    await assertFails(
      deleteDoc(doc(dbFor(testEnv, UID.teacherToan), 'studentAttendance', ROLL.id))
    );
  });
});

describe('vi phạm & khen thưởng', () => {
  it('lets a teacher record an incident under their own name', async () => {
    await assertSucceeds(
      setDoc(doc(dbFor(testEnv, UID.teacherToan), 'studentConduct', 'CDT_NEW'), CONDUCT)
    );
  });

  it('refuses recording one under a colleague’s name', async () => {
    await assertFails(
      setDoc(doc(dbFor(testEnv, UID.teacherToan2), 'studentConduct', 'CDT_NEW'), CONDUCT)
    );
  });

  it('refuses a colleague amending someone else’s record', async () => {
    // Otherwise any teacher could quietly soften another's account of an
    // incident — which would make the whole log unciteable.
    await seedDoc(testEnv, 'studentConduct', CONDUCT.id, CONDUCT);
    await assertFails(
      updateDoc(doc(dbFor(testEnv, UID.teacherToan2), 'studentConduct', CONDUCT.id), {
        points: 0,
        description: 'Không có gì',
      })
    );
  });

  it('lets the teacher who wrote it correct their own record', async () => {
    await seedDoc(testEnv, 'studentConduct', CONDUCT.id, CONDUCT);
    await assertSucceeds(
      updateDoc(doc(dbFor(testEnv, UID.teacherToan), 'studentConduct', CONDUCT.id), { points: 1 })
    );
  });

  it('refuses a colleague deleting someone else’s record', async () => {
    await seedDoc(testEnv, 'studentConduct', CONDUCT.id, CONDUCT);
    await assertFails(
      deleteDoc(doc(dbFor(testEnv, UID.teacherToan2), 'studentConduct', CONDUCT.id))
    );
  });

  it('lets an admin overrule', async () => {
    await seedDoc(testEnv, 'studentConduct', CONDUCT.id, CONDUCT);
    await assertSucceeds(
      updateDoc(doc(dbFor(testEnv, UID.admin), 'studentConduct', CONDUCT.id), { points: 0 })
    );
  });
});
