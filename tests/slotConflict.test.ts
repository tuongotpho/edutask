import { describe, it, expect } from 'vitest';
import {
  describeSlotProblems,
  findLeaveConflictForSlot,
  findSlotConflicts,
  occupanciesFromBookings,
  occupanciesFromMakeups,
  SlotOccupancy,
} from '@/Edu-task/lib/slotConflict';
import { MakeupClass, MakeupStatus } from '@/Edu-task/types/makeup';
import { BookingStatus, RoomBooking } from '@/Edu-task/types/booking';
import { LeaveRequest, LeaveSession } from '@/Edu-task/types/leave';
import { PeriodSlot } from '@/Edu-task/types/schedule';

const SLOT: PeriodSlot = { date: '2026-08-10', session: 'MORNING', period: 3 };
const OTHER_SLOT: PeriodSlot = { date: '2026-08-10', session: 'MORNING', period: 4 };

function occupancy(over: Partial<SlotOccupancy> = {}): SlotOccupancy {
  return { id: 'OCC_1', kind: 'BOOKING', slot: SLOT, label: 'Bản ghi khác', ...over };
}

function makeup(over: Partial<MakeupClass> = {}): MakeupClass {
  return {
    id: 'MKP_1', schoolId: 'S', code: 'DB-2026-001',
    teacherId: 'T1', teacherName: 'Cô A', departmentId: 'D1', departmentName: 'Tổ Toán',
    classId: 'C1', className: '10A1',
    missedSlot: SLOT, reason: 'LEAVE',
    makeupSlot: SLOT,
    status: 'APPROVED', steps: [], currentStepIndex: 0, history: [],
    createdAt: '2026-08-01 08:00', updatedAt: '2026-08-01 08:00',
    ...over,
  };
}

function booking(over: Partial<RoomBooking> = {}): RoomBooking {
  return {
    id: 'BKG_1', schoolId: 'S', code: 'DP-2026-001',
    roomId: 'R1', roomName: 'Phòng TN Hóa 1',
    requesterId: 'T2', requesterName: 'Thầy B', departmentId: 'D2', departmentName: 'Tổ Hóa',
    slot: SLOT, purpose: 'PRACTICAL',
    status: 'CONFIRMED', history: [],
    createdAt: '2026-08-01 08:00', updatedAt: '2026-08-01 08:00',
    ...over,
  };
}

function leave(over: Partial<LeaveRequest> = {}): LeaveRequest {
  return {
    id: 'LV_1', code: 'ĐXN-2026-001',
    applicantId: 'T1', applicantName: 'Cô A', applicantRole: 'Giáo viên',
    departmentId: 'D1', departmentName: 'Tổ Toán',
    leaveType: 'SICK', startDate: '2026-08-10', endDate: '2026-08-10',
    totalDays: 1, session: 'FULL_DAY', reason: 'Ốm',
    proofFiles: [], currentStepIndex: 0, steps: [],
    overallStatus: 'APPROVED', history: [],
    createdAt: '2026-08-01 08:00', updatedAt: '2026-08-01 08:00',
    ...over,
  };
}

describe('which records hold a slot', () => {
  it.each([['IN_REVIEW'], ['APPROVED'], ['COMPLETED']] as [MakeupStatus][])(
    'a %s make-up class occupies its slot',
    status => {
      expect(occupanciesFromMakeups([makeup({ status })])).toHaveLength(1);
    }
  );

  it.each([['REJECTED'], ['CANCELLED']] as [MakeupStatus][])(
    'a %s make-up class frees the slot again',
    status => {
      // Otherwise a teacher whose request was refused could never re-book the
      // same period, which would be a dead end with no way out.
      expect(occupanciesFromMakeups([makeup({ status })])).toHaveLength(0);
    }
  );

  it('a booking awaiting approval still holds the room', () => {
    // Releasing it would let a second person book the slot and hand the
    // approver a clash to untangle by hand.
    expect(occupanciesFromBookings([booking({ status: 'IN_REVIEW' })])).toHaveLength(1);
  });

  it.each([['REJECTED'], ['CANCELLED']] as [BookingStatus][])(
    'a %s booking releases the room',
    status => {
      expect(occupanciesFromBookings([booking({ status })])).toHaveLength(0);
    }
  );

  it('projects a make-up class onto its make-up slot, not the lost one', () => {
    const [projected] = occupanciesFromMakeups([
      makeup({ missedSlot: SLOT, makeupSlot: OTHER_SLOT }),
    ]);
    expect(projected.slot).toEqual(OTHER_SLOT);
  });
});

describe('findSlotConflicts', () => {
  it('reports nothing when the period differs', () => {
    const conflicts = findSlotConflicts(
      { slot: OTHER_SLOT, roomId: 'R1' },
      [occupancy({ roomId: 'R1' })]
    );
    expect(conflicts).toEqual([]);
  });

  it('catches a double-booked room', () => {
    const conflicts = findSlotConflicts(
      { slot: SLOT, roomId: 'R1', roomName: 'Phòng TN Hóa 1' },
      [occupancy({ roomId: 'R1', label: 'Đặt phòng (DP-2026-001)' })]
    );
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].resource).toBe('ROOM');
    expect(conflicts[0].message).toContain('Phòng TN Hóa 1');
    expect(conflicts[0].message).toContain('DP-2026-001');
  });

  it('catches a teacher already scheduled elsewhere', () => {
    const conflicts = findSlotConflicts(
      { slot: SLOT, teacherId: 'T1', teacherName: 'Cô A' },
      [occupancy({ teacherId: 'T1' })]
    );
    expect(conflicts.map(c => c.resource)).toEqual(['TEACHER']);
  });

  it('catches a class already occupied', () => {
    const conflicts = findSlotConflicts(
      { slot: SLOT, classId: 'C1', className: '10A1' },
      [occupancy({ classId: 'C1' })]
    );
    expect(conflicts.map(c => c.resource)).toEqual(['CLASS']);
  });

  it('reports every clashing resource at once, not just the first', () => {
    // Fixing one clash only to be stopped again by the next is what makes
    // people give up on a booking tool.
    const conflicts = findSlotConflicts(
      { slot: SLOT, teacherId: 'T1', classId: 'C1', roomId: 'R1' },
      [occupancy({ teacherId: 'T1', classId: 'C1', roomId: 'R1' })]
    );
    expect(conflicts.map(c => c.resource).sort()).toEqual(['CLASS', 'ROOM', 'TEACHER']);
  });

  it('does not report a record as clashing with itself when editing', () => {
    const conflicts = findSlotConflicts(
      { id: 'OCC_1', slot: SLOT, roomId: 'R1' },
      [occupancy({ id: 'OCC_1', roomId: 'R1' })]
    );
    expect(conflicts).toEqual([]);
  });

  it('ignores resources the candidate does not use', () => {
    // A booking with no class attached must not collide with every other
    // booking that also has no class.
    const conflicts = findSlotConflicts(
      { slot: SLOT, roomId: 'R1' },
      [occupancy({ roomId: 'R2' })]
    );
    expect(conflicts).toEqual([]);
  });

  it('separates morning and afternoon periods of the same number', () => {
    const conflicts = findSlotConflicts(
      { slot: { date: '2026-08-10', session: 'AFTERNOON', period: 3 }, roomId: 'R1' },
      [occupancy({ roomId: 'R1', slot: { date: '2026-08-10', session: 'MORNING', period: 3 } })]
    );
    expect(conflicts).toEqual([]);
  });
});

describe('findLeaveConflictForSlot', () => {
  it('blocks a slot covered by full-day approved leave', () => {
    expect(findLeaveConflictForSlot('T1', SLOT, [leave()])?.code).toBe('ĐXN-2026-001');
  });

  it('matches only the session that was taken off', () => {
    const morningOff = leave({ session: 'MORNING' as LeaveSession });
    expect(findLeaveConflictForSlot('T1', SLOT, [morningOff])).not.toBeNull();
    expect(
      findLeaveConflictForSlot('T1', { ...SLOT, session: 'AFTERNOON' }, [morningOff])
    ).toBeNull();
  });

  it('ignores leave that is not approved', () => {
    expect(findLeaveConflictForSlot('T1', SLOT, [leave({ overallStatus: 'IN_REVIEW' })])).toBeNull();
    expect(findLeaveConflictForSlot('T1', SLOT, [leave({ overallStatus: 'CANCELLED' })])).toBeNull();
  });

  it('ignores another teacher’s leave', () => {
    expect(findLeaveConflictForSlot('T9', SLOT, [leave()])).toBeNull();
  });

  it('covers every day of a multi-day absence, including the boundaries', () => {
    const week = leave({ startDate: '2026-08-10', endDate: '2026-08-14' });
    for (const date of ['2026-08-10', '2026-08-12', '2026-08-14']) {
      expect(findLeaveConflictForSlot('T1', { ...SLOT, date }, [week])).not.toBeNull();
    }
    expect(findLeaveConflictForSlot('T1', { ...SLOT, date: '2026-08-15' }, [week])).toBeNull();
  });

  it('returns null without a teacher', () => {
    expect(findLeaveConflictForSlot(undefined, SLOT, [leave()])).toBeNull();
  });
});

describe('describeSlotProblems — what the form shows', () => {
  it('combines schedule clashes and leave into one list', () => {
    const problems = describeSlotProblems({
      candidate: { slot: SLOT, teacherId: 'T1', teacherName: 'Cô A', roomId: 'R1', roomName: 'P1' },
      existing: [occupancy({ roomId: 'R1' })],
      leaves: [leave()],
    });
    expect(problems).toHaveLength(2);
    expect(problems.some(p => p.includes('P1'))).toBe(true);
    expect(problems.some(p => p.includes('ĐXN-2026-001'))).toBe(true);
  });

  it('is empty for a free slot', () => {
    expect(
      describeSlotProblems({
        candidate: { slot: OTHER_SLOT, teacherId: 'T9', roomId: 'R9' },
        existing: [occupancy()],
        leaves: [leave()],
      })
    ).toEqual([]);
  });

  it('works with no leave data supplied', () => {
    expect(
      describeSlotProblems({ candidate: { slot: OTHER_SLOT, roomId: 'R9' }, existing: [] })
    ).toEqual([]);
  });
});
