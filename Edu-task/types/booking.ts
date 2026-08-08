import { HistoryLog } from './approval';
import { PeriodSlot } from './schedule';

/**
 * Đăng ký phòng đa năng / phòng thí nghiệm.
 *
 * Simpler than a make-up class on purpose: one slot, one room, and — for most
 * rooms — no approval at all. Whether a booking needs signing off is a property
 * of the room (`Room.requiresApproval`), not of this record, so a school can
 * make the hall controlled and the labs first-come-first-served without any
 * code change.
 */

export type BookingPurpose =
  | 'PRACTICAL'
  | 'LESSON'
  | 'MEETING'
  | 'EVENT'
  | 'EXAM'
  | 'OTHER';

export const BOOKING_PURPOSE_LABELS: Record<BookingPurpose, string> = {
  PRACTICAL: 'Tiết thực hành / thí nghiệm',
  LESSON: 'Tiết dạy thường',
  MEETING: 'Họp tổ / họp chuyên môn',
  EVENT: 'Hoạt động ngoại khóa, sự kiện',
  EXAM: 'Kiểm tra, thi',
  OTHER: 'Mục đích khác',
};

export const BOOKING_PURPOSES: BookingPurpose[] = Object.keys(BOOKING_PURPOSE_LABELS) as BookingPurpose[];

export type BookingStatus =
  /** Booked outright — the room does not require approval. */
  | 'CONFIRMED'
  | 'IN_REVIEW'
  | 'REJECTED'
  | 'CANCELLED';

export const BOOKING_STATUS_LABELS: Record<BookingStatus, { label: string; color: string; bg: string }> = {
  CONFIRMED: { label: 'Đã xác nhận', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  IN_REVIEW: { label: 'Chờ duyệt', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  REJECTED: { label: 'Từ chối', color: 'text-rose-700', bg: 'bg-rose-50 border-rose-200' },
  CANCELLED: { label: 'Đã hủy', color: 'text-slate-600', bg: 'bg-slate-50 border-slate-200' },
};

/** Statuses that actually hold the room; anything else frees the slot. */
export const BOOKING_ACTIVE_STATUSES: BookingStatus[] = ['CONFIRMED', 'IN_REVIEW'];

export interface RoomBooking {
  id: string;
  schoolId: string;
  /** e.g. DP-2026-032 */
  code: string;

  roomId: string;
  roomName: string;

  requesterId: string;
  requesterName: string;
  departmentId: string;
  departmentName: string;

  classId?: string;
  className?: string;

  slot: PeriodSlot;
  purpose: BookingPurpose;
  purposeNote?: string;
  expectedAttendees?: number;

  status: BookingStatus;
  approverId?: string;
  approverName?: string;
  decidedAt?: string;
  decisionComment?: string;

  history: HistoryLog[];
  createdAt: string;
  updatedAt: string;
}
