import { SchoolSession } from './schedule';

/**
 * Học sinh, điểm danh và nề nếp học sinh.
 *
 * This is the most sensitive data in the system by a wide margin: it concerns
 * minors, and it includes parent contact details. Two consequences run through
 * the design.
 *
 * First, contact details are separated from the rest of the record in intent —
 * `parentName` / `parentPhone` exist because a homeroom teacher genuinely needs
 * to ring a parent when a child is unaccounted for, and for no other reason.
 * Firestore rules cannot hide individual fields, so the boundary is enforced at
 * the document level and stated plainly in the UI rather than pretended away.
 *
 * Second, an absence is never a bare fact. `UNEXCUSED` today can become
 * `EXCUSED` tomorrow when the parent's note arrives, so marks are editable and
 * carry who set them.
 */

export type Gender = 'MALE' | 'FEMALE' | 'OTHER';

export const GENDER_LABELS: Record<Gender, string> = {
  MALE: 'Nam',
  FEMALE: 'Nữ',
  OTHER: 'Khác',
};

export interface Student {
  id: string;
  schoolId: string;
  /** Mã học sinh do trường cấp. */
  code: string;
  fullName: string;

  classId: string;
  className: string;

  dateOfBirth?: string;
  gender?: Gender;

  /** Only ever filled in so someone can be reached about this child. */
  parentName?: string;
  parentPhone?: string;

  /**
   * "Học sinh cần hỗ trợ" — hoàn cảnh khó khăn, sức khoẻ, học lực.
   * A flag, deliberately paired with a free-text note rather than a category
   * list: the reasons are various and private, and forcing them into a
   * dropdown would either lose the detail or create labels that follow a child
   * around.
   */
  needsSupport: boolean;
  supportNote?: string;

  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// --- Điểm danh --------------------------------------------------------------

export type StudentMark =
  | 'PRESENT'
  /** Nghỉ có phép — có đơn hoặc lời nhắn của phụ huynh. */
  | 'EXCUSED'
  /** Nghỉ không phép. */
  | 'UNEXCUSED'
  | 'LATE';

export const STUDENT_MARK_LABELS: Record<StudentMark, { label: string; short: string; color: string; bg: string }> = {
  PRESENT: { label: 'Có mặt', short: 'CM', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  EXCUSED: { label: 'Nghỉ có phép', short: 'P', color: 'text-sky-700', bg: 'bg-sky-50 border-sky-200' },
  UNEXCUSED: { label: 'Nghỉ không phép', short: 'K', color: 'text-rose-700', bg: 'bg-rose-50 border-rose-200' },
  LATE: { label: 'Đi muộn', short: 'M', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
};

export const STUDENT_MARKS: StudentMark[] = ['PRESENT', 'LATE', 'EXCUSED', 'UNEXCUSED'];

/** Marks that mean the child was not in the room. */
export const ABSENT_MARKS: StudentMark[] = ['EXCUSED', 'UNEXCUSED'];

export interface StudentAttendanceEntry {
  studentId: string;
  studentName: string;
  mark: StudentMark;
  minutesLate?: number;
  note?: string;
}

/**
 * One roll call: one class, one date, one session.
 *
 * The document id is derived — `${classId}_${date}_${session}` — rather than
 * random. Two people opening the register for 10A1 this morning must land on
 * the SAME document; a random id would let them each create one and leave the
 * class with two contradictory rolls and no way to tell which counts.
 */
export interface ClassAttendance {
  id: string;
  schoolId: string;

  classId: string;
  className: string;
  date: string;
  session: SchoolSession;

  entries: StudentAttendanceEntry[];

  /**
   * Denormalised so the dashboard can total absences across every class
   * without downloading every roll. Recomputed on each save.
   */
  presentCount: number;
  absentCount: number;
  lateCount: number;

  recordedById: string;
  recordedByName: string;

  createdAt: string;
  updatedAt: string;
}

/** Builds the deterministic id. Used by every writer and reader. */
export function classAttendanceId(classId: string, date: string, session: SchoolSession): string {
  return `${classId}_${date}_${session}`;
}

// --- Nề nếp học sinh --------------------------------------------------------

export type ConductKind = 'VIOLATION' | 'COMMENDATION';

export const CONDUCT_KIND_LABELS: Record<ConductKind, { label: string; color: string; bg: string }> = {
  VIOLATION: { label: 'Vi phạm', color: 'text-rose-700', bg: 'bg-rose-50 border-rose-200' },
  COMMENDATION: { label: 'Khen thưởng', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
};

export type ConductCategory =
  | 'UNIFORM'
  | 'LATE'
  | 'HOMEWORK'
  | 'BEHAVIOUR'
  | 'PHONE'
  | 'ACADEMIC'
  | 'ACTIVITY'
  | 'GOOD_DEED'
  | 'OTHER';

export const CONDUCT_CATEGORY_LABELS: Record<ConductCategory, string> = {
  UNIFORM: 'Đồng phục, tác phong',
  LATE: 'Đi học muộn',
  HOMEWORK: 'Không làm bài tập',
  BEHAVIOUR: 'Mất trật tự, vô lễ',
  PHONE: 'Dùng điện thoại trong giờ',
  ACADEMIC: 'Thành tích học tập',
  ACTIVITY: 'Hoạt động phong trào',
  GOOD_DEED: 'Việc tốt, giúp đỡ bạn',
  OTHER: 'Khác',
};

/** Which categories belong to which kind, so the form cannot mix them up. */
export const VIOLATION_CATEGORIES: ConductCategory[] =
  ['UNIFORM', 'LATE', 'HOMEWORK', 'BEHAVIOUR', 'PHONE', 'OTHER'];
export const COMMENDATION_CATEGORIES: ConductCategory[] =
  ['ACADEMIC', 'ACTIVITY', 'GOOD_DEED', 'OTHER'];

export interface ConductRecord {
  id: string;
  schoolId: string;

  studentId: string;
  studentName: string;
  classId: string;
  className: string;

  kind: ConductKind;
  category: ConductCategory;
  description: string;
  /**
   * Điểm thi đua. Always stored POSITIVE; `kind` decides whether it is added or
   * subtracted. Storing signed values invites a violation accidentally saved as
   * +5 and quietly improving a child's score.
   */
  points: number;

  /** `YYYY-MM-DD` — when it happened, not when it was typed in. */
  date: string;

  recordedById: string;
  recordedByName: string;

  createdAt: string;
  updatedAt: string;
}
