import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { createTestEnv, dbFor, DEPT, seedDoc, seedProfiles, UID } from './helpers';

/**
 * Make-up classes and room bookings.
 *
 * Two claims are tested here. First, that these ARE readable school-wide —
 * that is not an oversight but a requirement, since clash detection runs in the
 * browser and cannot work on data it is not allowed to see. Second, that nobody
 * can approve their own request.
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

const MAKEUP = {
  id: 'MKP_1', schoolId: 'S', code: 'DB-2026-001',
  teacherId: UID.teacherToan, teacherName: 'GV Toán',
  departmentId: DEPT.toan, departmentName: 'Tổ Toán',
  classId: 'C1', className: '10A1',
  missedSlot: { date: '2026-08-10', session: 'MORNING', period: 1 },
  reason: 'LEAVE',
  makeupSlot: { date: '2026-08-12', session: 'AFTERNOON', period: 3 },
  status: 'IN_REVIEW', steps: [], currentStepIndex: 0, history: [],
  createdAt: '2026-08-08 08:00', updatedAt: '2026-08-08 08:00',
};

const BOOKING = {
  id: 'BKG_1', schoolId: 'S', code: 'DP-2026-001',
  roomId: 'ROOM_1', roomName: 'Phòng TN Hóa 1',
  requesterId: UID.teacherHoa, requesterName: 'GV Hóa',
  departmentId: DEPT.hoa, departmentName: 'Tổ Hóa',
  slot: { date: '2026-08-12', session: 'MORNING', period: 2 },
  purpose: 'PRACTICAL', status: 'CONFIRMED', history: [],
  createdAt: '2026-08-08 08:00', updatedAt: '2026-08-08 08:00',
};

describe('makeups — visibility is required for clash detection', () => {
  it('lets an unrelated teacher read someone else’s make-up class', async () => {
    // Not a leak: without this the browser cannot tell the teacher that the
    // period they just picked is already taken.
    await seedDoc(testEnv, 'makeups', MAKEUP.id, MAKEUP);
    await assertSucceeds(getDoc(doc(dbFor(testEnv, UID.teacherHoa), 'makeups', MAKEUP.id)));
  });
});

describe('makeups — who may create', () => {
  it('lets a teacher register their own', async () => {
    await assertSucceeds(
      setDoc(doc(dbFor(testEnv, UID.teacherToan), 'makeups', 'MKP_NEW'), MAKEUP)
    );
  });

  it('refuses one filed in another teacher’s name', async () => {
    await assertFails(
      setDoc(doc(dbFor(testEnv, UID.teacherToan2), 'makeups', 'MKP_NEW'), MAKEUP)
    );
  });

  it('refuses one that starts already approved', async () => {
    await assertFails(
      setDoc(doc(dbFor(testEnv, UID.teacherToan), 'makeups', 'MKP_NEW'), {
        ...MAKEUP,
        status: 'APPROVED',
      })
    );
  });

  it('refuses one routed to a department the teacher does not belong to', async () => {
    // Otherwise a request could be sent to a friendlier tổ trưởng for sign-off.
    await assertFails(
      setDoc(doc(dbFor(testEnv, UID.teacherToan), 'makeups', 'MKP_NEW'), {
        ...MAKEUP,
        departmentId: DEPT.hoa,
      })
    );
  });
});

describe('makeups — who may approve', () => {
  it('refuses the teacher approving their own request', async () => {
    await seedDoc(testEnv, 'makeups', MAKEUP.id, MAKEUP);
    await assertFails(
      updateDoc(doc(dbFor(testEnv, UID.teacherToan), 'makeups', MAKEUP.id), { status: 'APPROVED' })
    );
  });

  it('lets the teacher cancel their own request', async () => {
    await seedDoc(testEnv, 'makeups', MAKEUP.id, MAKEUP);
    await assertSucceeds(
      updateDoc(doc(dbFor(testEnv, UID.teacherToan), 'makeups', MAKEUP.id), { status: 'CANCELLED' })
    );
  });

  it('lets their department leader approve it', async () => {
    await seedDoc(testEnv, 'makeups', MAKEUP.id, MAKEUP);
    await assertSucceeds(
      updateDoc(doc(dbFor(testEnv, UID.headToan), 'makeups', MAKEUP.id), { status: 'APPROVED' })
    );
  });

  it('refuses an unrelated teacher touching it at all', async () => {
    await seedDoc(testEnv, 'makeups', MAKEUP.id, MAKEUP);
    await assertFails(
      updateDoc(doc(dbFor(testEnv, UID.teacherHoa), 'makeups', MAKEUP.id), { status: 'CANCELLED' })
    );
  });
});

describe('bookings', () => {
  it('is readable school-wide so the room timetable is honest', async () => {
    await seedDoc(testEnv, 'bookings', BOOKING.id, BOOKING);
    await assertSucceeds(getDoc(doc(dbFor(testEnv, UID.teacherToan), 'bookings', BOOKING.id)));
  });

  it('lets a teacher book a room in their own name', async () => {
    await assertSucceeds(
      setDoc(doc(dbFor(testEnv, UID.teacherHoa), 'bookings', 'BKG_NEW'), BOOKING)
    );
  });

  it('refuses booking in someone else’s name', async () => {
    await assertFails(
      setDoc(doc(dbFor(testEnv, UID.teacherToan), 'bookings', 'BKG_NEW'), BOOKING)
    );
  });

  it('refuses creating one that is already rejected', async () => {
    await assertFails(
      setDoc(doc(dbFor(testEnv, UID.teacherHoa), 'bookings', 'BKG_NEW'), {
        ...BOOKING,
        status: 'REJECTED',
      })
    );
  });

  it('refuses the requester approving their own pending booking', async () => {
    await seedDoc(testEnv, 'bookings', BOOKING.id, { ...BOOKING, status: 'IN_REVIEW' });
    await assertFails(
      updateDoc(doc(dbFor(testEnv, UID.teacherHoa), 'bookings', BOOKING.id), { status: 'CONFIRMED' })
    );
  });

  it('lets the requester cancel their own booking', async () => {
    await seedDoc(testEnv, 'bookings', BOOKING.id, { ...BOOKING, status: 'IN_REVIEW' });
    await assertSucceeds(
      updateDoc(doc(dbFor(testEnv, UID.teacherHoa), 'bookings', BOOKING.id), { status: 'CANCELLED' })
    );
  });

  it('lets the secretary arbitrate the room timetable', async () => {
    await seedDoc(testEnv, 'bookings', BOOKING.id, { ...BOOKING, status: 'IN_REVIEW' });
    await assertSucceeds(
      updateDoc(doc(dbFor(testEnv, UID.secretary), 'bookings', BOOKING.id), { status: 'CONFIRMED' })
    );
  });

  it('refuses an unrelated teacher cancelling someone else’s booking', async () => {
    await seedDoc(testEnv, 'bookings', BOOKING.id, BOOKING);
    await assertFails(
      updateDoc(doc(dbFor(testEnv, UID.teacherToan), 'bookings', BOOKING.id), { status: 'CANCELLED' })
    );
  });

  it('refuses an unrelated teacher deleting someone else’s booking', async () => {
    await seedDoc(testEnv, 'bookings', BOOKING.id, BOOKING);
    await assertFails(deleteDoc(doc(dbFor(testEnv, UID.teacherToan), 'bookings', BOOKING.id)));
  });
});
