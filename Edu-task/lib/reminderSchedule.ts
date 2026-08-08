import { ReminderSchedule } from '@/Edu-task/types/reminder';
import { Plan } from '@/Edu-task/types/plan';
import { Task } from '@/Edu-task/types/task';
import { parseDate } from '@/Edu-task/lib/schedule';
import { isTaskOverdue, parseDeadline } from '@/Edu-task/lib/taskStatus';

/**
 * When a reminder schedule fires, and what is coming due.
 *
 * All arithmetic is on `YYYY-MM-DD` strings parsed as UTC, matching
 * `lib/schedule.ts`. Going through local-time `Date` would shift the day
 * backwards west of Greenwich, which for a reminder means sending it a day
 * early — every month, silently.
 *
 * Pure functions with no clock of their own: the "today" is always passed in.
 * That is what lets these same functions run unchanged in a Cloud Function and
 * be tested without freezing time.
 */

// --- Date arithmetic --------------------------------------------------------

function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const parsed = parseDate(date);
  if (!parsed) return date;
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return toIso(parsed);
}

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export function isoWeekday(date: string): number | null {
  const parsed = parseDate(date);
  if (!parsed) return null;
  const day = parsed.getUTCDay(); // 0 = Sunday
  return day === 0 ? 7 : day;
}

export function lastDayOfMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/**
 * The day this monthly schedule lands on in the given month.
 *
 * A schedule set to the 31st must still fire in February. Clamping to the last
 * day of the month is the behaviour people expect from "cuối tháng" and the
 * only option that never silently skips a month.
 */
export function monthlyDayIn(year: number, monthIndex: number, dayOfMonth: number): number {
  return Math.min(Math.max(1, dayOfMonth), lastDayOfMonth(year, monthIndex));
}

// --- Firing rules -----------------------------------------------------------

function withinWindow(schedule: ReminderSchedule, date: string): boolean {
  if (schedule.startDate && date < schedule.startDate) return false;
  if (schedule.endDate && date > schedule.endDate) return false;
  return true;
}

/** Would this schedule fire on this exact date, ignoring whether it already has? */
export function isDueOn(schedule: ReminderSchedule, date: string): boolean {
  if (!schedule.isActive) return false;
  if (!parseDate(date)) return false;
  if (!withinWindow(schedule, date)) return false;

  switch (schedule.recurrence) {
    case 'ONCE':
      return schedule.date === date;

    case 'WEEKLY':
      return !!schedule.weekday && isoWeekday(date) === schedule.weekday;

    case 'MONTHLY': {
      if (!schedule.dayOfMonth) return false;
      const parsed = parseDate(date)!;
      const landsOn = monthlyDayIn(parsed.getUTCFullYear(), parsed.getUTCMonth(), schedule.dayOfMonth);
      return parsed.getUTCDate() === landsOn;
    }

    default:
      return false;
  }
}

/**
 * Whether the sender should actually deliver today.
 *
 * The extra `lastFiredOn` check is what makes delivery safe to retry: a
 * scheduled function that runs twice — because the platform retried it, or
 * because someone triggered it by hand — must not notify eighty people twice.
 */
export function shouldFire(schedule: ReminderSchedule, date: string): boolean {
  if (schedule.lastFiredOn === date) return false;
  return isDueOn(schedule, date);
}

/**
 * The next date on or after `from` when this schedule fires, or null if it
 * never will again.
 *
 * Searches forward day by day, capped at `lookaheadDays`. A monthly schedule
 * needs at most 31 days of lookahead and a weekly one at most 7, so the default
 * of 400 covers a whole school year — enough to answer "when next?" for a
 * schedule whose window has not started yet, while still terminating.
 */
export function nextOccurrence(
  schedule: ReminderSchedule,
  from: string,
  lookaheadDays = 400
): string | null {
  if (!schedule.isActive) return null;
  if (!parseDate(from)) return null;

  // A one-off in the past can be answered without scanning.
  if (schedule.recurrence === 'ONCE') {
    if (!schedule.date || schedule.date < from) return null;
    return isDueOn(schedule, schedule.date) ? schedule.date : null;
  }

  let cursor = from;
  for (let i = 0; i <= lookaheadDays; i++) {
    if (schedule.endDate && cursor > schedule.endDate) return null;
    if (isDueOn(schedule, cursor)) return cursor;
    cursor = addDays(cursor, 1);
  }
  return null;
}

/** Human phrasing of the recurrence, for the schedule list. */
export function describeRecurrence(schedule: ReminderSchedule): string {
  const at = ` lúc ${schedule.timeOfDay}`;
  switch (schedule.recurrence) {
    case 'ONCE':
      return `Một lần vào ${schedule.date ?? '—'}${at}`;
    case 'WEEKLY': {
      const labels: Record<number, string> = {
        1: 'Thứ Hai', 2: 'Thứ Ba', 3: 'Thứ Tư', 4: 'Thứ Năm',
        5: 'Thứ Sáu', 6: 'Thứ Bảy', 7: 'Chủ Nhật',
      };
      return `Hàng tuần vào ${labels[schedule.weekday ?? 0] ?? '—'}${at}`;
    }
    case 'MONTHLY':
      return `Hàng tháng vào ngày ${schedule.dayOfMonth ?? '—'}${at}` +
        (schedule.dayOfMonth && schedule.dayOfMonth > 28
          ? ' (tháng ngắn hơn sẽ nhắc vào ngày cuối tháng)'
          : '');
    default:
      return '—';
  }
}

// --- What is coming due -----------------------------------------------------

export interface DueItem {
  kind: 'TASK' | 'MILESTONE';
  id: string;
  title: string;
  /** `YYYY-MM-DD` */
  dueDate: string;
  /** Negative when already overdue. */
  daysRemaining: number;
  isOverdue: boolean;
  /** Who should care: assignees for a task, the owner for a milestone. */
  recipientIds: string[];
  context?: string;
}

function daysBetween(from: string, to: string): number {
  const a = parseDate(from);
  const b = parseDate(to);
  if (!a || !b) return 0;
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/**
 * Tasks approaching their deadline, plus those already past it.
 *
 * Overdue work is included deliberately: a reminder system that goes quiet the
 * moment something slips is at its least useful exactly when it matters most.
 */
export function upcomingTaskReminders(
  tasks: Task[],
  today: string,
  withinDays = 3,
  now: Date = new Date()
): DueItem[] {
  const horizon = addDays(today, withinDays);

  return tasks
    .filter(task => {
      if (task.status === 'COMPLETED') return false;
      const deadline = parseDeadline(task.deadline);
      if (!deadline) return false;
      const dueDate = (task.deadline ?? '').slice(0, 10);
      return isTaskOverdue(task, now) || dueDate <= horizon;
    })
    .map(task => {
      const dueDate = (task.deadline ?? '').slice(0, 10);
      const daysRemaining = daysBetween(today, dueDate);
      return {
        kind: 'TASK' as const,
        id: task.id,
        title: task.title,
        dueDate,
        daysRemaining,
        isOverdue: isTaskOverdue(task, now),
        recipientIds: (task.assignees ?? []).map(a => a.userId),
        context: task.code,
      };
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

/** Plan milestones approaching their date, plus those already missed. */
export function upcomingMilestones(
  plans: Plan[],
  today: string,
  withinDays = 7
): DueItem[] {
  const horizon = addDays(today, withinDays);
  const items: DueItem[] = [];

  for (const plan of plans) {
    if (plan.isArchived) continue;
    for (const milestone of plan.milestones ?? []) {
      if (milestone.status === 'DONE') continue;
      if (!milestone.dueDate) continue;
      if (milestone.dueDate > horizon) continue;

      items.push({
        kind: 'MILESTONE',
        id: milestone.id,
        title: milestone.title,
        dueDate: milestone.dueDate,
        daysRemaining: daysBetween(today, milestone.dueDate),
        isOverdue: milestone.dueDate < today,
        // Falls back to the plan owner so a milestone nobody was assigned still
        // reaches someone — an unowned reminder helps no one.
        recipientIds: [milestone.ownerId ?? plan.ownerId].filter(Boolean) as string[],
        context: plan.title,
      });
    }
  }

  return items.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

/** Everything one person should be reminded about, soonest first. */
export function dueItemsForUser(items: DueItem[], userId: string): DueItem[] {
  return items.filter(item => item.recipientIds.includes(userId));
}

/** Resolves an audience to concrete recipients at send time. */
export function resolveReminderRecipients(
  schedule: ReminderSchedule,
  users: Array<{ id: string; departmentId: string; roles?: string[]; status?: string }>
): string[] {
  const active = users.filter(u => u.status === 'ACTIVE');

  switch (schedule.audience) {
    case 'ALL_STAFF':
      return active.map(u => u.id);
    case 'DEPT_LEADERS':
      return active
        .filter(u => u.roles?.some(r => r === 'HEAD_OF_DEPT' || r === 'GROUP_LEADER'))
        .map(u => u.id);
    case 'DEPARTMENT':
      return active.filter(u => u.departmentId === schedule.departmentId).map(u => u.id);
    case 'CUSTOM':
      return (schedule.recipientIds ?? []).filter(id => active.some(u => u.id === id));
    default:
      return [];
  }
}
