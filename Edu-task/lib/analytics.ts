import { LeaveRequest } from '@/Edu-task/types/leave';
import { Task } from '@/Edu-task/types/task';
import { isTaskOverdue, parseDeadline } from '@/Edu-task/lib/taskStatus';

export interface MonthlyPoint {
  /** `YYYY-MM` */
  month: string;
  label: string;
  leaveCount: number;
  leaveDays: number;
}

/**
 * Leave volume for the last `months` calendar months, oldest first.
 * Months with no requests are kept so the trend line has no gaps.
 */
export function monthlyLeaveTrend(
  leaves: LeaveRequest[],
  months = 6,
  now: Date = new Date()
): MonthlyPoint[] {
  const buckets: MonthlyPoint[] = [];
  const index = new Map<string, MonthlyPoint>();

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const point: MonthlyPoint = { month: key, label: `T${d.getMonth() + 1}`, leaveCount: 0, leaveDays: 0 };
    buckets.push(point);
    index.set(key, point);
  }

  for (const leave of leaves) {
    if (leave.overallStatus === 'CANCELLED' || leave.overallStatus === 'REJECTED') continue;
    // Bucket by start date: that is when the absence begins to matter.
    const key = (leave.startDate ?? '').slice(0, 7);
    const point = index.get(key);
    if (!point) continue;
    point.leaveCount += 1;
    point.leaveDays += leave.totalDays ?? 0;
  }

  return buckets;
}

export interface DepartmentStat {
  departmentId: string;
  departmentName: string;
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  completionRate: number;
  leaveDays: number;
}

/** Per-department workload and delivery, for the Sở GD&ĐT style report. */
export function departmentStats(
  departments: { id: string; name: string }[],
  tasks: Task[],
  leaves: LeaveRequest[],
  now: Date = new Date()
): DepartmentStat[] {
  return departments.map(dept => {
    const deptTasks = tasks.filter(t => t.targetDepartmentId === dept.id);
    const completedTasks = deptTasks.filter(t => t.status === 'COMPLETED').length;
    const overdueTasks = deptTasks.filter(t => isTaskOverdue(t, now)).length;
    const leaveDays = leaves
      .filter(l => l.departmentId === dept.id && l.overallStatus === 'APPROVED')
      .reduce((sum, l) => sum + (l.totalDays ?? 0), 0);

    return {
      departmentId: dept.id,
      departmentName: dept.name,
      totalTasks: deptTasks.length,
      completedTasks,
      overdueTasks,
      completionRate: deptTasks.length > 0 ? Math.round((completedTasks / deptTasks.length) * 100) : 0,
      leaveDays,
    };
  });
}

export interface WorkloadEntry {
  userId: string;
  userName: string;
  activeTasks: number;
  overdueTasks: number;
}

/** Busiest people first — used to spot uneven task distribution. */
export function topWorkloads(tasks: Task[], limit = 5, now: Date = new Date()): WorkloadEntry[] {
  const byUser = new Map<string, WorkloadEntry>();

  for (const task of tasks) {
    if (task.status === 'COMPLETED') continue;
    const overdue = isTaskOverdue(task, now);
    for (const assignee of task.assignees ?? []) {
      const entry = byUser.get(assignee.userId) ?? {
        userId: assignee.userId,
        userName: assignee.userName,
        activeTasks: 0,
        overdueTasks: 0,
      };
      entry.activeTasks += 1;
      if (overdue) entry.overdueTasks += 1;
      byUser.set(assignee.userId, entry);
    }
  }

  return Array.from(byUser.values())
    .sort((a, b) => b.activeTasks - a.activeTasks || b.overdueTasks - a.overdueTasks)
    .slice(0, limit);
}

/**
 * Share of completed tasks that were signed off on or before their deadline.
 * Returns null when nothing has been completed yet, so the UI can say "chưa có
 * dữ liệu" instead of a misleading 0%.
 */
export function onTimeCompletionRate(tasks: Task[]): number | null {
  const completed = tasks.filter(t => t.status === 'COMPLETED');
  if (completed.length === 0) return null;

  const onTime = completed.filter(task => {
    const deadline = parseDeadline(task.deadline);
    if (!deadline) return true; // no deadline recorded: do not count as late
    const finishedAt = task.assignees
      ?.map(a => (a.completedAt ? new Date(a.completedAt.replace(' ', 'T')) : null))
      .filter((d): d is Date => !!d && !Number.isNaN(d.getTime()))
      .sort((a, b) => b.getTime() - a.getTime())[0];
    // Fall back to updatedAt when no assignee recorded a completion time.
    const reference = finishedAt ?? new Date((task.updatedAt ?? '').replace(' ', 'T'));
    if (Number.isNaN(reference.getTime())) return true;
    return reference.getTime() <= deadline.getTime();
  }).length;

  return Math.round((onTime / completed.length) * 100);
}
