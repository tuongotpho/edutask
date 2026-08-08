import { PeriodSlot } from './schedule';

/**
 * Sổ nề nếp — the supervisor's record of teachers arriving late or a class
 * being left without one.
 *
 * This is the most socially delicate data in the system: it feeds thi đua and
 * it is about named colleagues. Two design choices follow from that, and both
 * are deliberate rather than incidental.
 *
 * 1. A record is never the last word. Every entry can be answered by the
 *    teacher it names (`explanation`) and then settled by leadership. A log
 *    that people cannot reply to gets fought about outside the system, which
 *    defeats the purpose of having one.
 *
 * 2. Only the supervisor may write one. Opening this to department leaders
 *    would turn "who was late" into something anyone can assert about anyone.
 */

export type AttendanceIssue =
  /** Giáo viên vào lớp muộn. */
  | 'LATE'
  /** Lớp trống giờ — không có giáo viên. */
  | 'EMPTY_CLASS'
  /** Ra khỏi lớp trước khi hết tiết. */
  | 'LEFT_EARLY'
  | 'OTHER';

export const ATTENDANCE_ISSUE_LABELS: Record<AttendanceIssue, string> = {
  LATE: 'Vào lớp muộn',
  EMPTY_CLASS: 'Lớp trống giờ',
  LEFT_EARLY: 'Ra lớp sớm',
  OTHER: 'Vấn đề khác',
};

export const ATTENDANCE_ISSUES: AttendanceIssue[] = Object.keys(ATTENDANCE_ISSUE_LABELS) as AttendanceIssue[];

/** Issues that are measured in minutes; the others have no duration. */
export const TIMED_ISSUES: AttendanceIssue[] = ['LATE', 'LEFT_EARLY'];

export type AttendanceStatus =
  /** Vừa ghi nhận, chưa ai phản hồi. */
  | 'RECORDED'
  /** Giáo viên đã gửi giải trình, chờ xem xét. */
  | 'EXPLAINED'
  /** Giải trình được chấp nhận — không tính vào thi đua. */
  | 'EXCUSED'
  /** Giữ nguyên ghi nhận — tính vào thi đua. */
  | 'CONFIRMED';

export const ATTENDANCE_STATUS_LABELS: Record<
  AttendanceStatus,
  { label: string; color: string; bg: string }
> = {
  RECORDED: { label: 'Đã ghi nhận', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  EXPLAINED: { label: 'Đã giải trình', color: 'text-sky-700', bg: 'bg-sky-50 border-sky-200' },
  EXCUSED: { label: 'Được miễn', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  CONFIRMED: { label: 'Giữ nguyên', color: 'text-rose-700', bg: 'bg-rose-50 border-rose-200' },
};

/**
 * Statuses that count against a teacher. An unanswered record still counts —
 * otherwise ignoring it would be the winning move.
 */
export const COUNTED_STATUSES: AttendanceStatus[] = ['RECORDED', 'EXPLAINED', 'CONFIRMED'];

export interface AttendanceExplanation {
  text: string;
  submittedAt: string;
}

export interface AttendanceRecord {
  id: string;
  schoolId: string;
  code: string;

  slot: PeriodSlot;
  classId: string;
  className: string;

  /**
   * Optional: for `EMPTY_CLASS` the supervisor may find a room with no teacher
   * and not know who was timetabled. Forcing a name would mean either a wrong
   * one or no record at all.
   */
  teacherId?: string;
  teacherName?: string;
  departmentId?: string;
  departmentName?: string;

  issue: AttendanceIssue;
  /** Only meaningful for `LATE` / `LEFT_EARLY`. */
  minutes?: number;
  note?: string;

  recordedById: string;
  recordedByName: string;

  status: AttendanceStatus;
  explanation?: AttendanceExplanation;
  reviewedById?: string;
  reviewedByName?: string;
  reviewNote?: string;
  reviewedAt?: string;

  createdAt: string;
  updatedAt: string;
}
