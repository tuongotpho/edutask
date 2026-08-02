import { LeaveRequest, LeaveSession } from '@/Edu-task/types/leave';

export interface LeaveConflictResult {
  hasConflict: boolean;
  conflictDetail?: LeaveRequest;
}

/**
 * Finds an existing leave request that would clash with the given date range.
 *
 * Extracted from `useLeaveLogic` so the rule can be unit-tested without React:
 * getting this wrong double-books a substitute teacher, which is the most
 * consequential silent failure in the app.
 *
 * Two requests clash when their date ranges overlap AND their sessions collide.
 * A FULL_DAY request collides with anything; a MORNING only collides with
 * another MORNING (or a FULL_DAY). Only APPROVED and IN_REVIEW requests count —
 * cancelled or rejected ones free the slot back up.
 */
export function findLeaveConflict(
  leaves: LeaveRequest[],
  teacherId: string,
  startDate: string,
  endDate: string,
  session: LeaveSession = 'FULL_DAY',
  excludeLeaveId?: string
): LeaveConflictResult {
  if (!teacherId || !startDate || !endDate) return { hasConflict: false };

  const blocking = leaves.filter(l =>
    l.id !== excludeLeaveId &&
    l.applicantId === teacherId &&
    (l.overallStatus === 'APPROVED' || l.overallStatus === 'IN_REVIEW')
  );

  for (const leave of blocking) {
    const dateOverlap = startDate <= leave.endDate && endDate >= leave.startDate;
    if (!dateOverlap) continue;

    const sessionOverlap =
      session === 'FULL_DAY' ||
      leave.session === 'FULL_DAY' ||
      session === leave.session;

    if (sessionOverlap) {
      return { hasConflict: true, conflictDetail: leave };
    }
  }

  return { hasConflict: false };
}
