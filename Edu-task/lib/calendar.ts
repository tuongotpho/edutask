import { LeaveRequest } from '@/Edu-task/types/leave';

export interface CalendarCell {
  /** `YYYY-MM-DD`, or null for the padding cells before/after the month. */
  date: string | null;
  isToday: boolean;
  isWeekend: boolean;
}

/** `YYYY-MM-DD` for a local date, avoiding the UTC shift `toISOString()` causes. */
export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Builds a Monday-first month grid padded to whole weeks, so the calendar
 * renders as a clean 7-column layout.
 */
export function buildMonthGrid(year: number, month: number, today: Date = new Date()): CalendarCell[] {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // JS weeks start on Sunday; Vietnamese calendars start on Monday.
  const leadingBlanks = (first.getDay() + 6) % 7;
  const todayKey = toDateKey(today);

  const cells: CalendarCell[] = [];
  for (let i = 0; i < leadingBlanks; i++) {
    cells.push({ date: null, isToday: false, isWeekend: false });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const key = toDateKey(date);
    const weekday = date.getDay();
    cells.push({ date: key, isToday: key === todayKey, isWeekend: weekday === 0 || weekday === 6 });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ date: null, isToday: false, isWeekend: false });
  }
  return cells;
}

/**
 * Maps each date in the month to the leave requests covering it.
 *
 * A request spans a range, so it appears on every day it covers — that is the
 * whole point of the calendar: seeing who is absent on a given day without
 * mentally expanding date ranges.
 */
export function groupLeavesByDate(
  leaves: LeaveRequest[],
  includeStatuses: LeaveRequest['overallStatus'][] = ['APPROVED', 'IN_REVIEW']
): Map<string, LeaveRequest[]> {
  const byDate = new Map<string, LeaveRequest[]>();

  for (const leave of leaves) {
    if (!includeStatuses.includes(leave.overallStatus)) continue;
    if (!leave.startDate || !leave.endDate) continue;

    const start = new Date(`${leave.startDate}T00:00:00`);
    const end = new Date(`${leave.endDate}T00:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) continue;

    // Guard against a typo'd range locking the browser in a long loop.
    const MAX_SPAN_DAYS = 366;
    const cursor = new Date(start);
    for (let i = 0; i <= MAX_SPAN_DAYS && cursor <= end; i++) {
      const key = toDateKey(cursor);
      const bucket = byDate.get(key);
      if (bucket) bucket.push(leave);
      else byDate.set(key, [leave]);
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  return byDate;
}

export const WEEKDAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export const MONTH_LABELS = [
  'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
  'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12',
];
