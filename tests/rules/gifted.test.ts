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
   * KNOWN GAP — this test asserts the CURRENT behaviour, which is wrong.
   *
   * GiftedTab offers the "hoàn thành tiết" button to the assigned teacher
   * (`canCompleteLesson = isMyLesson || canManageProgram`), but the rules only
   * allow updating `giftedPrograms/{id}` for canManageGifted() or the
   * coordinator. So a plain teacher marking their OWN lesson is denied, the
   * optimistic update rolls back, and they are told "không lưu được lên máy
   * chủ" — a server error for something they are supposed to be able to do.
   *
   * Fixing it needs a schema change: the rules cannot look inside `lessons` to
   * see who owns the changed entry, so the programme has to carry a
   * `teacherIds` array the rules can test with `in`. Until that is decided,
   * this test pins the gap so it cannot be lost — and it will fail loudly on
   * the day the rules are widened, which is the reminder to update it.
   */
  it('is currently REFUSED for the teacher who taught it (known gap)', async () => {
    await seedProgram();
    await assertFails(
      updateDoc(doc(dbFor(testEnv, UID.teacherToan), 'giftedPrograms', PROGRAM.id), {
        lessons: completedLessons(UID.teacherToan),
        updatedAt: '2026-09-01 16:00',
      })
    );
  });
});
