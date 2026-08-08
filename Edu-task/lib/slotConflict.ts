import { LeaveRequest } from '@/Edu-task/types/leave';
import { MakeupClass } from '@/Edu-task/types/makeup';
import { BOOKING_ACTIVE_STATUSES, RoomBooking } from '@/Edu-task/types/booking';
import { PeriodSlot } from '@/Edu-task/types/schedule';
import { formatSlot, sameSlot } from '@/Edu-task/lib/schedule';

/**
 * One clash detector for everything that occupies a teaching period.
 *
 * Make-up classes and room bookings look like different features but collide in
 * exactly the same three ways: a teacher cannot be in two places at once, a
 * class cannot be taught two things at once, and a room cannot hold two groups
 * at once. Writing that rule twice would guarantee the two copies drift, and a
 * booking system whose clash rules disagree with itself is worse than no
 * booking system — people stop trusting it and go back to the paper register.
 *
 * So both features project their records onto one `SlotOccupancy` shape and ask
 * the same question. Pure functions, no React or Firestore, so the rules are
 * unit-testable.
 */

export type OccupancyKind = 'MAKEUP' | 'BOOKING';
export type ResourceKind = 'TEACHER' | 'CLASS' | 'ROOM';

export interface SlotOccupancy {
  id: string;
  kind: OccupancyKind;
  slot: PeriodSlot;
  teacherId?: string;
  classId?: string;
  roomId?: string;
  /** Shown in the clash message, e.g. "Dạy bù 10A1 (DB-2026-014)". */
  label: string;
}

export interface SlotConflict {
  resource: ResourceKind;
  conflictsWith: SlotOccupancy;
  message: string;
}

/** What the caller wants to place. `id` is set when editing an existing record. */
export interface SlotCandidate {
  id?: string;
  slot: PeriodSlot;
  teacherId?: string;
  teacherName?: string;
  classId?: string;
  className?: string;
  roomId?: string;
  roomName?: string;
}

// --- Projecting records onto occupancies -----------------------------------

/**
 * Only a make-up class that is still standing holds its slot. A rejected or
 * cancelled one must free the period immediately, otherwise a teacher whose
 * request was turned down could never re-book the same period.
 */
export function occupanciesFromMakeups(makeups: MakeupClass[]): SlotOccupancy[] {
  return makeups
    .filter(m => m.status === 'IN_REVIEW' || m.status === 'APPROVED' || m.status === 'COMPLETED')
    .map(m => ({
      id: m.id,
      kind: 'MAKEUP' as const,
      slot: m.makeupSlot,
      teacherId: m.teacherId,
      classId: m.classId,
      roomId: m.roomId,
      label: `Dạy bù ${m.className} — ${m.teacherName} (${m.code})`,
    }));
}

/**
 * A booking awaiting approval still holds the room: releasing it would let a
 * second person book the same slot and create a clash the approver then has to
 * untangle by hand.
 */
export function occupanciesFromBookings(bookings: RoomBooking[]): SlotOccupancy[] {
  return bookings
    .filter(b => BOOKING_ACTIVE_STATUSES.includes(b.status))
    .map(b => ({
      id: b.id,
      kind: 'BOOKING' as const,
      slot: b.slot,
      teacherId: b.requesterId,
      classId: b.classId,
      roomId: b.roomId,
      label: `Đặt phòng ${b.roomName} — ${b.requesterName} (${b.code})`,
    }));
}

// --- The rule ---------------------------------------------------------------

const RESOURCE_PREFIX: Record<ResourceKind, (candidate: SlotCandidate) => string> = {
  TEACHER: c => `Giáo viên ${c.teacherName ?? ''}`.trim(),
  CLASS: c => `Lớp ${c.className ?? ''}`.trim(),
  ROOM: c => `Phòng ${c.roomName ?? ''}`.trim(),
};

/**
 * Every way `candidate` collides with something already scheduled.
 *
 * Returns all of them rather than the first: a teacher who picks a bad period
 * should be told once that the room AND the class are both busy, instead of
 * fixing one clash only to be stopped again by the next.
 */
export function findSlotConflicts(
  candidate: SlotCandidate,
  existing: SlotOccupancy[]
): SlotConflict[] {
  const conflicts: SlotConflict[] = [];

  for (const occupancy of existing) {
    // Editing a record must not report it as clashing with itself.
    if (candidate.id && occupancy.id === candidate.id) continue;
    if (!sameSlot(candidate.slot, occupancy.slot)) continue;

    const shared: ResourceKind[] = [];
    if (candidate.teacherId && candidate.teacherId === occupancy.teacherId) shared.push('TEACHER');
    if (candidate.classId && candidate.classId === occupancy.classId) shared.push('CLASS');
    if (candidate.roomId && candidate.roomId === occupancy.roomId) shared.push('ROOM');

    for (const resource of shared) {
      conflicts.push({
        resource,
        conflictsWith: occupancy,
        message: `${RESOURCE_PREFIX[resource](candidate)} đã có lịch vào ${formatSlot(candidate.slot)}: ${occupancy.label}.`,
      });
    }
  }

  return conflicts;
}

// --- Leave awareness --------------------------------------------------------

/**
 * The approved leave that would stop this teacher being at school for the slot.
 *
 * Without this a teacher could schedule a make-up class on a day they are
 * already signed off as absent — the single most likely way for this feature to
 * produce a timetable nobody can actually teach.
 */
export function findLeaveConflictForSlot(
  teacherId: string | undefined,
  slot: PeriodSlot,
  leaves: LeaveRequest[]
): LeaveRequest | null {
  if (!teacherId) return null;

  return (
    leaves.find(leave => {
      if (leave.applicantId !== teacherId) return false;
      if (leave.overallStatus !== 'APPROVED') return false;
      // Dates are `YYYY-MM-DD`, so string comparison is chronological.
      if (!((leave.startDate ?? '') <= slot.date && slot.date <= (leave.endDate ?? ''))) return false;
      return leave.session === 'FULL_DAY' || leave.session === slot.session;
    }) ?? null
  );
}

/** All blocking reasons for a slot, as plain sentences ready to show. */
export function describeSlotProblems(params: {
  candidate: SlotCandidate;
  existing: SlotOccupancy[];
  leaves?: LeaveRequest[];
}): string[] {
  const { candidate, existing, leaves = [] } = params;
  const problems = findSlotConflicts(candidate, existing).map(c => c.message);

  const leaveClash = findLeaveConflictForSlot(candidate.teacherId, candidate.slot, leaves);
  if (leaveClash) {
    problems.push(
      `Giáo viên đang có đơn nghỉ đã duyệt (${leaveClash.code}) trùng với ${formatSlot(candidate.slot)}.`
    );
  }

  return problems;
}
