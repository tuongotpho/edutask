import { describe, it, expect } from 'vitest';
import { getDisplayTaskStatus, isTaskOverdue, parseDeadline } from '@/Edu-task/lib/taskStatus';
import { TaskStatus } from '@/Edu-task/types/task';

const NOW = new Date('2026-03-15T12:00:00');

function task(deadline: string, status: TaskStatus = 'IN_PROGRESS') {
  return { deadline, status };
}

describe('parseDeadline', () => {
  it('parses the stored "YYYY-MM-DD HH:mm" shape', () => {
    const d = parseDeadline('2026-03-10 17:30');
    expect(d?.getFullYear()).toBe(2026);
    expect(d?.getMonth()).toBe(2); // March
    expect(d?.getDate()).toBe(10);
    expect(d?.getHours()).toBe(17);
    expect(d?.getMinutes()).toBe(30);
  });

  it('returns null for missing or unparseable input instead of Invalid Date', () => {
    expect(parseDeadline('')).toBeNull();
    expect(parseDeadline(undefined)).toBeNull();
    expect(parseDeadline(null)).toBeNull();
    expect(parseDeadline('không phải ngày')).toBeNull();
  });
});

describe('isTaskOverdue', () => {
  it('flags a task whose deadline has passed', () => {
    expect(isTaskOverdue(task('2026-03-10 17:00'), NOW)).toBe(true);
  });

  it('does not flag a task still within its deadline', () => {
    expect(isTaskOverdue(task('2026-03-20 17:00'), NOW)).toBe(false);
  });

  it('never flags a completed task, however late', () => {
    expect(isTaskOverdue(task('2026-01-01 08:00', 'COMPLETED'), NOW)).toBe(false);
  });

  it('still flags work that was submitted but not yet signed off', () => {
    // The deadline is for finishing, not for submitting.
    expect(isTaskOverdue(task('2026-03-10 17:00', 'PENDING_APPROVAL'), NOW)).toBe(true);
  });

  it('treats an unparseable deadline as not overdue rather than throwing', () => {
    expect(isTaskOverdue(task(''), NOW)).toBe(false);
    expect(isTaskOverdue(task('rác'), NOW)).toBe(false);
  });

  it('compares by time of day, not just date', () => {
    expect(isTaskOverdue(task('2026-03-15 11:59'), NOW)).toBe(true);
    expect(isTaskOverdue(task('2026-03-15 12:01'), NOW)).toBe(false);
  });
});

describe('getDisplayTaskStatus', () => {
  it('reports OVERDUE for a late task', () => {
    expect(getDisplayTaskStatus(task('2026-03-10 17:00', 'ASSIGNED'), NOW)).toBe('OVERDUE');
  });

  it('passes the stored status through when on time', () => {
    expect(getDisplayTaskStatus(task('2026-03-20 17:00', 'ASSIGNED'), NOW)).toBe('ASSIGNED');
    expect(getDisplayTaskStatus(task('2026-03-20 17:00', 'VIEWED'), NOW)).toBe('VIEWED');
  });

  it('keeps COMPLETED even past the deadline', () => {
    expect(getDisplayTaskStatus(task('2026-01-01 08:00', 'COMPLETED'), NOW)).toBe('COMPLETED');
  });
});
