import { ApprovalStep, HistoryLog } from './approval';
import { PeriodSlot } from './schedule';

/**
 * Đăng ký dạy bù — a teacher who lost a period arranging when they will teach it.
 *
 * A make-up class is two slots, not one: the period that was lost and the
 * period that will replace it. Recording both is the point — the lost slot is
 * what the record is *about* (and what a Sở GD&ĐT report has to account for),
 * while the make-up slot is what has to be checked for clashes against the
 * teacher, the class and the room.
 */

export type MakeupReason =
  | 'LEAVE'
  | 'MEETING'
  | 'SCHOOL_EVENT'
  | 'TRAINING'
  | 'WEATHER'
  | 'OTHER';

export const MAKEUP_REASON_LABELS: Record<MakeupReason, string> = {
  LEAVE: 'Giáo viên nghỉ phép',
  MEETING: 'Bận họp',
  SCHOOL_EVENT: 'Hoạt động chung của trường',
  TRAINING: 'Đi tập huấn / công tác',
  WEATHER: 'Nghỉ do thời tiết, sự cố',
  OTHER: 'Lý do khác',
};

export const MAKEUP_REASONS: MakeupReason[] = Object.keys(MAKEUP_REASON_LABELS) as MakeupReason[];

export type MakeupStatus =
  | 'IN_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'
  /** The make-up slot has passed and the lesson was taught. */
  | 'COMPLETED';

export const MAKEUP_STATUS_LABELS: Record<MakeupStatus, { label: string; color: string; bg: string }> = {
  IN_REVIEW: { label: 'Chờ duyệt', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  APPROVED: { label: 'Đã duyệt', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  REJECTED: { label: 'Từ chối', color: 'text-rose-700', bg: 'bg-rose-50 border-rose-200' },
  CANCELLED: { label: 'Đã hủy', color: 'text-slate-600', bg: 'bg-slate-50 border-slate-200' },
  COMPLETED: { label: 'Đã dạy xong', color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200' },
};

export interface MakeupClass {
  id: string;
  schoolId: string;
  /** e.g. DB-2026-014 */
  code: string;

  teacherId: string;
  teacherName: string;
  departmentId: string;
  departmentName: string;

  classId: string;
  className: string;
  subject?: string;

  /** The period that was lost. */
  missedSlot: PeriodSlot;
  reason: MakeupReason;
  reasonNote?: string;
  /** Set when the lost period traces back to an approved leave request. */
  relatedLeaveId?: string;

  /** When it will be taught instead. */
  makeupSlot: PeriodSlot;
  roomId?: string;
  roomName?: string;

  status: MakeupStatus;
  /** Single step in practice (department leader), but kept as a list so the
   *  configurable workflow that leave already has can be extended to this. */
  steps: ApprovalStep[];
  currentStepIndex: number;

  history: HistoryLog[];
  createdAt: string;
  updatedAt: string;
}
