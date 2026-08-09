/**
 * Cuộc họp & điểm danh — the secretary's register.
 *
 * Unlike the supervisor's corridor log, meeting attendance is inherently public
 * to the people in the room: the roll is called out loud. So a participant sees
 * the whole roll for meetings they were called to, and nothing at all for
 * meetings they were not. That is enforced by `participantIds`, which exists
 * for exactly the same reason `Task.viewerIds` does — it is both the access
 * list and the thing Firestore can query on.
 */

export type MeetingKind =
  | 'STAFF'
  | 'DEPARTMENT'
  | 'EXECUTIVE'
  | 'PARENT'
  | 'TRAINING'
  | 'OTHER';

export const MEETING_KIND_LABELS: Record<MeetingKind, string> = {
  STAFF: 'Họp hội đồng sư phạm',
  DEPARTMENT: 'Họp tổ chuyên môn',
  EXECUTIVE: 'Họp Ban Giám Hiệu',
  PARENT: 'Họp phụ huynh',
  TRAINING: 'Tập huấn / chuyên đề',
  OTHER: 'Cuộc họp khác',
};

export const MEETING_KINDS: MeetingKind[] = Object.keys(MEETING_KIND_LABELS) as MeetingKind[];

export type MeetingStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';

export const MEETING_STATUS_LABELS: Record<MeetingStatus, { label: string; color: string; bg: string }> = {
  SCHEDULED: { label: 'Sắp diễn ra', color: 'text-sky-700', bg: 'bg-sky-50 border-sky-200' },
  COMPLETED: { label: 'Đã họp', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  CANCELLED: { label: 'Đã hủy', color: 'text-slate-600', bg: 'bg-slate-50 border-slate-200' },
};

/** How the roll was marked. `undefined` means not yet called. */
export type AttendanceMark = 'PRESENT' | 'LATE' | 'EXCUSED' | 'ABSENT';

export const ATTENDANCE_MARK_LABELS: Record<AttendanceMark, { label: string; short: string; color: string; bg: string }> = {
  PRESENT: { label: 'Có mặt', short: 'CM', color: 'text-emerald-800 font-extrabold', bg: 'bg-emerald-100 border-emerald-300 shadow-xs' },
  LATE: { label: 'Đi muộn', short: 'M', color: 'text-amber-800 font-extrabold', bg: 'bg-amber-100 border-amber-300 shadow-xs' },
  EXCUSED: { label: 'Vắng có phép', short: 'P', color: 'text-sky-800 font-extrabold', bg: 'bg-sky-100 border-sky-300 shadow-xs' },
  ABSENT: { label: 'Vắng không phép', short: 'K', color: 'text-rose-800 font-extrabold', bg: 'bg-rose-100 border-rose-300 shadow-xs' },
};

export const ATTENDANCE_MARKS: AttendanceMark[] = ['PRESENT', 'LATE', 'EXCUSED', 'ABSENT'];

/** Marks that count against someone in a monthly roll-up. */
export const PENALISED_MARKS: AttendanceMark[] = ['LATE', 'ABSENT'];

export interface MeetingParticipant {
  userId: string;
  userName: string;
  departmentName: string;
  /** Unset until the secretary calls the roll. */
  mark?: AttendanceMark;
  /** Only meaningful for `LATE`. */
  minutesLate?: number;
  note?: string;
}

/** The written record. Kept separate so "held but not written up" is visible. */
export interface MeetingMinutes {
  content: string;
  finalizedAt: string;
  finalizedById: string;
  finalizedByName: string;
}

export interface Meeting {
  id: string;
  schoolId: string;
  /** e.g. CH-2026-007 */
  code: string;

  title: string;
  agenda?: string;
  kind: MeetingKind;

  /** `YYYY-MM-DD` */
  date: string;
  /** `HH:mm` — the moment after which someone counts as late. */
  startTime: string;
  endTime?: string;
  location?: string;

  /** How the roll was assembled; kept so the list can be rebuilt or explained. */
  scope: 'ALL_STAFF' | 'DEPARTMENTS' | 'CUSTOM';
  departmentIds?: string[];

  participants: MeetingParticipant[];
  /**
   * Denormalised from `participants` — Firestore cannot query inside an array
   * of objects, and rules cannot iterate one. Same trick as `Task.viewerIds`.
   */
  participantIds: string[];

  chairedById?: string;
  chairedByName?: string;
  secretaryId: string;
  secretaryName: string;

  status: MeetingStatus;
  minutes?: MeetingMinutes;

  createdAt: string;
  updatedAt: string;
}
