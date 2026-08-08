/**
 * Lịch nhắc — recurring reminders for plan progress.
 *
 * Distinct from deadline reminders, which need no configuration at all: a task
 * already carries its own due date, so "nhắc việc sắp đến hạn" is derived, not
 * scheduled. What genuinely needs configuring is the recurring administrative
 * rhythm a school runs on — "ngày 25 hàng tháng nhắc các tổ nộp kế hoạch
 * tháng", "sáng thứ Hai nhắc tổ trưởng báo cáo tuần".
 *
 * `lastFiredOn` is the idempotency key. Delivery will run from a scheduled
 * Cloud Function, and a scheduler that retries — as they all do — must not send
 * the same reminder twice. Recording the date a schedule last fired makes a
 * second attempt on the same day a no-op.
 */

export type RecurrenceKind = 'ONCE' | 'WEEKLY' | 'MONTHLY';

export const RECURRENCE_LABELS: Record<RecurrenceKind, string> = {
  ONCE: 'Một lần',
  WEEKLY: 'Hàng tuần',
  MONTHLY: 'Hàng tháng',
};

export const RECURRENCE_KINDS: RecurrenceKind[] = ['ONCE', 'WEEKLY', 'MONTHLY'];

/** ISO weekday numbering: 1 = Thứ Hai … 7 = Chủ Nhật. */
export const WEEKDAY_LABELS: Record<number, string> = {
  1: 'Thứ Hai',
  2: 'Thứ Ba',
  3: 'Thứ Tư',
  4: 'Thứ Năm',
  5: 'Thứ Sáu',
  6: 'Thứ Bảy',
  7: 'Chủ Nhật',
};

export type ReminderAudience = 'ALL_STAFF' | 'DEPT_LEADERS' | 'DEPARTMENT' | 'CUSTOM';

export const REMINDER_AUDIENCE_LABELS: Record<ReminderAudience, string> = {
  ALL_STAFF: 'Toàn thể cán bộ, giáo viên',
  DEPT_LEADERS: 'Tổ trưởng & nhóm trưởng',
  DEPARTMENT: 'Thành viên một tổ',
  CUSTOM: 'Chọn từng người',
};

export interface ReminderSchedule {
  id: string;
  schoolId: string;

  title: string;
  message?: string;

  /** Whose rhythm this is. A tổ trưởng may only create DEPARTMENT schedules. */
  scope: 'SCHOOL' | 'DEPARTMENT';
  departmentId?: string;
  departmentName?: string;

  audience: ReminderAudience;
  /** Only for `CUSTOM`. */
  recipientIds?: string[];

  recurrence: RecurrenceKind;
  /** `YYYY-MM-DD`, for `ONCE`. */
  date?: string;
  /** 1–7 (ISO), for `WEEKLY`. */
  weekday?: number;
  /** 1–31, for `MONTHLY`. Clamped to the last day of shorter months. */
  dayOfMonth?: number;
  /** `HH:mm` — when in the day it goes out. */
  timeOfDay: string;

  /** Outside this window the schedule never fires; typically the school year. */
  startDate?: string;
  endDate?: string;

  isActive: boolean;
  /** `YYYY-MM-DD` of the last send. Stops a retrying scheduler double-sending. */
  lastFiredOn?: string;

  /** Optional link to the plan this reminder is chasing. */
  planId?: string;

  createdById: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}
