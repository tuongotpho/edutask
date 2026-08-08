import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { createTestEnv, dbFor, seedDoc, seedProfiles, UID } from './helpers';

/**
 * Cuộc họp.
 *
 * The design claim: a meeting roll is public to the room but invisible outside
 * it, and only the office may mark it. The second half matters most — if a
 * participant could edit the roll, anyone marked late could quietly mark
 * themselves present.
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

const PARTICIPANTS = [
  { userId: UID.teacherToan, userName: 'GV Toán', departmentName: 'Tổ Toán', mark: 'LATE', minutesLate: 10 },
  { userId: UID.headToan, userName: 'Tổ trưởng Toán', departmentName: 'Tổ Toán', mark: 'PRESENT' },
];

const MEETING = {
  id: 'MTG_1', schoolId: 'S', code: 'CH-2026-001',
  title: 'Họp tổ Toán', kind: 'DEPARTMENT',
  date: '2026-08-12', startTime: '14:00',
  scope: 'DEPARTMENTS',
  participants: PARTICIPANTS,
  participantIds: PARTICIPANTS.map(p => p.userId),
  secretaryId: UID.secretary, secretaryName: 'Văn thư',
  status: 'COMPLETED',
  createdAt: '2026-08-08 08:00', updatedAt: '2026-08-08 08:00',
};

async function seedMeeting() {
  await seedDoc(testEnv, 'meetings', MEETING.id, MEETING);
}

describe('who can see a meeting', () => {
  it('lets someone who was called to it read the whole roll', async () => {
    await seedMeeting();
    await assertSucceeds(getDoc(doc(dbFor(testEnv, UID.teacherToan), 'meetings', MEETING.id)));
  });

  it('refuses someone who was not invited', async () => {
    await seedMeeting();
    await assertFails(getDoc(doc(dbFor(testEnv, UID.teacherHoa), 'meetings', MEETING.id)));
  });

  it('lets the secretary and leadership read any meeting', async () => {
    await seedMeeting();
    await assertSucceeds(getDoc(doc(dbFor(testEnv, UID.secretary), 'meetings', MEETING.id)));
    await assertSucceeds(getDoc(doc(dbFor(testEnv, UID.principal), 'meetings', MEETING.id)));
  });
});

describe('who can convene one', () => {
  it('lets the secretary create a meeting', async () => {
    await assertSucceeds(
      setDoc(doc(dbFor(testEnv, UID.secretary), 'meetings', 'MTG_NEW'), MEETING)
    );
  });

  it('refuses a plain teacher creating one', async () => {
    await assertFails(
      setDoc(doc(dbFor(testEnv, UID.teacherToan), 'meetings', 'MTG_NEW'), {
        ...MEETING,
        secretaryId: UID.teacherToan,
      })
    );
  });

  it('refuses a department leader creating one', async () => {
    await assertFails(
      setDoc(doc(dbFor(testEnv, UID.headToan), 'meetings', 'MTG_NEW'), {
        ...MEETING,
        secretaryId: UID.headToan,
      })
    );
  });

  it('refuses a meeting filed under another person as secretary', async () => {
    await assertFails(
      setDoc(doc(dbFor(testEnv, UID.secretary), 'meetings', 'MTG_NEW'), {
        ...MEETING,
        secretaryId: UID.principal,
      })
    );
  });
});

describe('who can mark the roll', () => {
  it('refuses a participant marking themselves present', async () => {
    // The guarantee that makes the roll worth keeping.
    await seedMeeting();
    await assertFails(
      updateDoc(doc(dbFor(testEnv, UID.teacherToan), 'meetings', MEETING.id), {
        participants: [
          { ...PARTICIPANTS[0], mark: 'PRESENT', minutesLate: null },
          PARTICIPANTS[1],
        ],
      })
    );
  });

  it('refuses a department leader marking the roll of a meeting they attend', async () => {
    await seedMeeting();
    await assertFails(
      updateDoc(doc(dbFor(testEnv, UID.headToan), 'meetings', MEETING.id), { status: 'CANCELLED' })
    );
  });

  it('lets the secretary mark it', async () => {
    await seedMeeting();
    await assertSucceeds(
      updateDoc(doc(dbFor(testEnv, UID.secretary), 'meetings', MEETING.id), {
        participants: [{ ...PARTICIPANTS[0], mark: 'PRESENT' }, PARTICIPANTS[1]],
      })
    );
  });

  it('lets the secretary finalise the minutes', async () => {
    await seedMeeting();
    await assertSucceeds(
      updateDoc(doc(dbFor(testEnv, UID.secretary), 'meetings', MEETING.id), {
        minutes: {
          content: 'Nội dung biên bản',
          finalizedAt: '2026-08-12 16:00',
          finalizedById: UID.secretary,
          finalizedByName: 'Văn thư',
        },
      })
    );
  });
});

describe('deleting', () => {
  it('refuses a participant deleting the meeting', async () => {
    await seedMeeting();
    await assertFails(deleteDoc(doc(dbFor(testEnv, UID.teacherToan), 'meetings', MEETING.id)));
  });

  it('lets the secretary who convened it delete it', async () => {
    await seedMeeting();
    await assertSucceeds(deleteDoc(doc(dbFor(testEnv, UID.secretary), 'meetings', MEETING.id)));
  });
});
