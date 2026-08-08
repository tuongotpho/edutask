/**
 * One status vocabulary for every workflow in the app.
 *
 * Each module has its own status union — `MakeupStatus`, `BookingStatus`,
 * `LeaveRequest['overallStatus']`, `AttendanceStatus` and so on — and each one
 * grew its own colour map. The result was that "chờ duyệt" was amber in one
 * screen, sky-blue in another, and rendered as plain grey text in a third, so
 * staff had to re-learn the colour code on every tab.
 *
 * A tone is the ANSWER TO ONE QUESTION: does this need someone to act? The
 * module maps its own statuses onto these five; everything visual follows from
 * the tone, in one place.
 */

export type StatusTone =
  /** Waiting on a person. The only tone that should pull the eye. */
  | 'PENDING'
  /** Live and on track — booked, approved, in progress. Nothing to do. */
  | 'ACTIVE'
  /** Finished well. */
  | 'DONE'
  /** Refused, or a rule was broken. */
  | 'REJECTED'
  /** Cancelled, withdrawn, archived — present but no longer relevant. */
  | 'NEUTRAL';

export interface ToneStyle {
  /** 4px bar down the left edge of a row — the first thing the eye lands on. */
  stripe: string;
  badge: string;
  avatar: string;
  /** Faded so settled records recede and open ones stand out. */
  dim: boolean;
}

export const TONE_STYLES: Record<StatusTone, ToneStyle> = {
  PENDING: {
    stripe: 'bg-amber-400',
    badge: 'bg-amber-50 text-amber-800 border-amber-200',
    avatar: 'bg-amber-100 text-amber-800',
    dim: false,
  },
  ACTIVE: {
    stripe: 'bg-sky-400',
    badge: 'bg-sky-50 text-sky-800 border-sky-200',
    avatar: 'bg-sky-100 text-sky-800',
    dim: false,
  },
  DONE: {
    stripe: 'bg-emerald-400',
    badge: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    avatar: 'bg-emerald-100 text-emerald-800',
    // Dimmed on purpose: a finished record is history. Keeping it at full
    // strength is what makes a list of forty items read as forty problems.
    dim: true,
  },
  REJECTED: {
    stripe: 'bg-rose-400',
    badge: 'bg-rose-50 text-rose-800 border-rose-200',
    avatar: 'bg-rose-100 text-rose-800',
    dim: true,
  },
  NEUTRAL: {
    stripe: 'bg-slate-300',
    badge: 'bg-slate-100 text-slate-600 border-slate-200',
    avatar: 'bg-slate-100 text-slate-600',
    dim: true,
  },
};

/**
 * Initials for an avatar circle.
 *
 * Vietnamese names put the given name last, so the last two words are what
 * people actually identify each other by: "Nguyễn Văn An" reads as "VA", not
 * "NV". Falls back gracefully — a blank name must never crash a list, which is
 * a bug this codebase has had before.
 */
export function initials(fullName: string | undefined | null): string {
  const words = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[words.length - 2][0] + words[words.length - 1][0]).toUpperCase();
}

// --- Per-module mappings ----------------------------------------------------
//
// Each lives next to nothing else: the point is that a module declares its
// meaning ONCE here, and never picks colours at the call site again.

export function leaveTone(status: string): StatusTone {
  switch (status) {
    case 'IN_REVIEW': return 'PENDING';
    case 'REQUEST_EDIT': return 'PENDING';
    case 'APPROVED': return 'DONE';
    case 'REJECTED': return 'REJECTED';
    case 'CANCELLED': return 'NEUTRAL';
    default: return 'NEUTRAL';
  }
}

export function makeupTone(status: string): StatusTone {
  switch (status) {
    case 'IN_REVIEW': return 'PENDING';
    case 'APPROVED': return 'ACTIVE';
    case 'COMPLETED': return 'DONE';
    case 'REJECTED': return 'REJECTED';
    default: return 'NEUTRAL';
  }
}

export function bookingTone(status: string): StatusTone {
  switch (status) {
    case 'IN_REVIEW': return 'PENDING';
    case 'CONFIRMED': return 'ACTIVE';
    case 'REJECTED': return 'REJECTED';
    default: return 'NEUTRAL';
  }
}

export function taskTone(status: string, isOverdue = false): StatusTone {
  if (status === 'COMPLETED') return 'DONE';
  // Overdue outranks whatever stage the task is at — it is the thing that
  // needs a person, which is exactly what PENDING means here.
  if (isOverdue) return 'REJECTED';
  if (status === 'PENDING_APPROVAL') return 'PENDING';
  return 'ACTIVE';
}

export function conductTone(kind: string): StatusTone {
  return kind === 'COMMENDATION' ? 'DONE' : 'REJECTED';
}

export function attendanceRecordTone(status: string): StatusTone {
  switch (status) {
    case 'RECORDED': return 'PENDING';
    case 'EXPLAINED': return 'PENDING';
    case 'EXCUSED': return 'DONE';
    case 'CONFIRMED': return 'REJECTED';
    default: return 'NEUTRAL';
  }
}

export function meetingTone(status: string): StatusTone {
  switch (status) {
    case 'SCHEDULED': return 'ACTIVE';
    case 'COMPLETED': return 'DONE';
    default: return 'NEUTRAL';
  }
}
