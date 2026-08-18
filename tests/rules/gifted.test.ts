import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { createTestEnv, dbFor, seedDoc, seedProfiles, UID } from './helpers';

/**
 * Bồi dưỡng Học sinh giỏi.
 *
 * A programme is ONE document with its lessons held in an array inside it, so
 * every lesson action — assigning, completing, reopening — is an update of the
 * whole programme document. That shape is what these tests are really about:
 * the rules can gate the document, but they cannot see which lesson inside it
 * changed, because rules have no way to iterate an array.
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

const LESSONS = [
  {
    id: 'LES_1',
    title: 'Chuyên đề Bất đẳng thức',
    teacherId: UID.teacherToan,
    teacherName: 'GV Toán',
    scheduledDate: '2026-09-01',
    durationPeriods: 2,
    status: 'PENDING',
  },
];

const PROGRAM = {
  id: 'GIFTED_1',
  schoolId: 'S',
  code: 'BD-2026-000001',
  title: 'Bồi dưỡng HSG Toán 9',
  subject: 'Toán',
  grade: 'Khối 9',
  departmentId: 'DEPT_TOAN',
  departmentName: 'DEPT_TOAN',
  coordinatorId: UID.headToan,
  coordinatorName: 'Tổ trưởng Toán',
  startDate: '2026-09-01',
  endDate: '2026-12-01',
  status: 'IN_PROGRESS',
  lessons: LESSONS,
  // Flat copy of every lessons[].teacherId — the only thing the rules can test,
  // since they cannot iterate the lessons array.
  teacherIds: [UID.teacherToan],
  createdAt: '2026-08-17 08:00',
  updatedAt: '2026-08-17 08:00',
};

async function seedProgram() {
  await seedDoc(testEnv, 'giftedPrograms', PROGRAM.id, PROGRAM);
}

/** The write the app performs when a lesson is marked done. */
function completedLessons(byUid: string) {
  return [
    {
      ...LESSONS[0],
      status: 'COMPLETED',
      completedAt: '2026-09-01 16:00',
      completedByUserId: byUid,
      completedByUserName: byUid,
    },
  ];
}

describe('who can see a gifted programme', () => {
  it('lets any signed-in member of staff read it', async () => {
    await seedProgram();
    await assertSucceeds(getDoc(doc(dbFor(testEnv, UID.teacherHoa), 'giftedPrograms', PROGRAM.id)));
  });

  it('keeps it away from anonymous visitors', async () => {
    await seedProgram();
    await assertFails(getDoc(doc(testEnv.unauthenticatedContext().firestore() as never, 'giftedPrograms', PROGRAM.id)));
  });
});

describe('who can create a programme', () => {
  it('lets a tổ trưởng open one', async () => {
    await assertSucceeds(
      setDoc(doc(dbFor(testEnv, UID.headToan), 'giftedPrograms', 'GIFTED_NEW'), { ...PROGRAM, id: 'GIFTED_NEW' })
    );
  });

  it('refuses a plain teacher', async () => {
    await assertFails(
      setDoc(doc(dbFor(testEnv, UID.teacherToan), 'giftedPrograms', 'GIFTED_NEW'), { ...PROGRAM, id: 'GIFTED_NEW' })
    );
  });

  it('refuses non-teaching staff', async () => {
    await assertFails(
      setDoc(doc(dbFor(testEnv, UID.accountant), 'giftedPrograms', 'GIFTED_NEW'), { ...PROGRAM, id: 'GIFTED_NEW' })
    );
  });
});

describe('who can change a programme', () => {
  it('lets the coordinator edit their own programme', async () => {
    await seedProgram();
    await assertSucceeds(
      updateDoc(doc(dbFor(testEnv, UID.headToan), 'giftedPrograms', PROGRAM.id), { title: 'Đổi tên' })
    );
  });

  it('lets an admin edit any programme', async () => {
    await seedProgram();
    await assertSucceeds(
      updateDoc(doc(dbFor(testEnv, UID.admin), 'giftedPrograms', PROGRAM.id), { title: 'Đổi tên' })
    );
  });

  it('refuses a teacher who has nothing to do with it', async () => {
    await seedProgram();
    await assertFails(
      updateDoc(doc(dbFor(testEnv, UID.teacherHoa), 'giftedPrograms', PROGRAM.id), { title: 'Đổi tên' })
    );
  });

  it('lets an admin delete a programme', async () => {
    await seedProgram();
    await assertSucceeds(deleteDoc(doc(dbFor(testEnv, UID.admin), 'giftedPrograms', PROGRAM.id)));
  });

  it('refuses deletion by an unrelated teacher', async () => {
    await seedProgram();
    await assertFails(deleteDoc(doc(dbFor(testEnv, UID.teacherHoa), 'giftedPrograms', PROGRAM.id)));
  });
});

describe('marking a lesson done', () => {
  it('works for the coordinator', async () => {
    await seedProgram();
    await assertSucceeds(
      updateDoc(doc(dbFor(testEnv, UID.headToan), 'giftedPrograms', PROGRAM.id), {
        lessons: completedLessons(UID.headToan),
        updatedAt: '2026-09-01 16:00',
      })
    );
  });

  /**
   * The point of the whole `teacherIds` field: this used to be REFUSED, because
   * the rules could only see the document, not which lesson inside it changed.
   * The button was shown to the teacher, the write was denied, and they were
   * told "không lưu được lên máy chủ" for the one thing the feature exists to
   * let them do.
   */
  it('works for the teacher who actually taught it', async () => {
    await seedProgram();
    await assertSucceeds(
      updateDoc(doc(dbFor(testEnv, UID.teacherToan), 'giftedPrograms', PROGRAM.id), {
        lessons: completedLessons(UID.teacherToan),
        updatedAt: '2026-09-01 16:00',
      })
    );
  });

  it('still refuses a teacher with no lesson in the programme', async () => {
    await seedProgram();
    await assertFails(
      updateDoc(doc(dbFor(testEnv, UID.teacherHoa), 'giftedPrograms', PROGRAM.id), {
        lessons: completedLessons(UID.teacherHoa),
        updatedAt: '2026-09-01 16:00',
      })
    );
  });

  it('lets the last completion close the programme', async () => {
    await seedProgram();
    await assertSucceeds(
      updateDoc(doc(dbFor(testEnv, UID.teacherToan), 'giftedPrograms', PROGRAM.id), {
        lessons: completedLessons(UID.teacherToan),
        status: 'COMPLETED',
        updatedAt: '2026-09-01 16:00',
      })
    );
  });

  it('refuses a programme created before teacherIds existed, rather than erroring', async () => {
    // `get('teacherIds', [])` means a legacy document simply has no teachers.
    const { teacherIds: _dropped, ...legacy } = PROGRAM;
    await seedDoc(testEnv, 'giftedPrograms', 'GIFTED_CU', { ...legacy, id: 'GIFTED_CU' });
    await assertFails(
      updateDoc(doc(dbFor(testEnv, UID.teacherToan), 'giftedPrograms', 'GIFTED_CU'), {
        lessons: completedLessons(UID.teacherToan),
        updatedAt: '2026-09-01 16:00',
      })
    );
  });
});

describe('what an assigned teacher must NOT be able to do', () => {
  it('cannot rename the programme while confirming a lesson', async () => {
    await seedProgram();
    await assertFails(
      updateDoc(doc(dbFor(testEnv, UID.teacherToan), 'giftedPrograms', PROGRAM.id), {
        lessons: completedLessons(UID.teacherToan),
        title: 'Đổi tên',
        updatedAt: '2026-09-01 16:00',
      })
    );
  });

  it('cannot take over as coordinator', async () => {
    await seedProgram();
    await assertFails(
      updateDoc(doc(dbFor(testEnv, UID.teacherToan), 'giftedPrograms', PROGRAM.id), {
        lessons: completedLessons(UID.teacherToan),
        coordinatorId: UID.teacherToan,
        updatedAt: '2026-09-01 16:00',
      })
    );
  });

  /** The one that would unravel the whole scheme. */
  it('cannot write another teacher into teacherIds', async () => {
    await seedProgram();
    await assertFails(
      updateDoc(doc(dbFor(testEnv, UID.teacherToan), 'giftedPrograms', PROGRAM.id), {
        teacherIds: [UID.teacherToan, UID.teacherHoa],
        updatedAt: '2026-09-01 16:00',
      })
    );
  });

  it('cannot write ITSELF into a programme it has no lesson in', async () => {
    await seedProgram();
    await assertFails(
      updateDoc(doc(dbFor(testEnv, UID.teacherHoa), 'giftedPrograms', PROGRAM.id), {
        teacherIds: [UID.teacherToan, UID.teacherHoa],
        updatedAt: '2026-09-01 16:00',
      })
    );
  });

  it('cannot move the programme dates', async () => {
    await seedProgram();
    await assertFails(
      updateDoc(doc(dbFor(testEnv, UID.teacherToan), 'giftedPrograms', PROGRAM.id), {
        lessons: completedLessons(UID.teacherToan),
        endDate: '2027-06-01',
        updatedAt: '2026-09-01 16:00',
      })
    );
  });

  it('cannot delete the programme', async () => {
    await seedProgram();
    await assertFails(deleteDoc(doc(dbFor(testEnv, UID.teacherToan), 'giftedPrograms', PROGRAM.id)));
  });
});
