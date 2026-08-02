import { Task, TaskStatus } from '@/Edu-task/types/task';

/**
 * Deadlines are stored as `YYYY-MM-DD HH:mm` (local time, no timezone).
 * `new Date()` accepts that shape in most engines but it is not standard, so we
 * normalise to ISO-ish first and reject anything unparseable rather than
 * silently producing `Invalid Date`.
 */
export function parseDeadline(deadline: string | undefined | null): Date | null {
  if (!deadline) return null;
  const parsed = new Date(deadline.trim().replace(' ', 'T'));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * A task is overdue once its deadline has passed and it has not been signed
 * off. Work still awaiting approval counts as overdue: the deadline was for
 * finishing, not for submitting.
 *
 * `OVERDUE` is a derived state, never stored. Nothing in the app ever wrote it,
 * which is why the "Quá hạn" filter could never match anything.
 */
export function isTaskOverdue(task: Pick<Task, 'deadline' | 'status'>, now: Date = new Date()): boolean {
  if (task.status === 'COMPLETED') return false;
  const deadline = parseDeadline(task.deadline);
  if (!deadline) return false;
  return deadline.getTime() < now.getTime();
}

/**
 * The status to show the user, which folds in the derived overdue state.
 * Kanban columns deliberately keep using the raw `task.status` so a late task
 * stays in its workflow column instead of disappearing from the board.
 */
export function getDisplayTaskStatus(
  task: Pick<Task, 'deadline' | 'status'>,
  now: Date = new Date()
): TaskStatus {
  return isTaskOverdue(task, now) ? 'OVERDUE' : task.status;
}
