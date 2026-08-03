import { describe, it, expect } from 'vitest';
import { buildApprovalSteps, requiresExecutiveApproval } from '@/Edu-task/lib/workflow';
import { DEFAULT_WORKFLOW_CONFIG, isTelegramConfigured, DEFAULT_TELEGRAM_CONFIG } from '@/Edu-task/types/settings';
import { buildMonthGrid, groupLeavesByDate, toDateKey } from '@/Edu-task/lib/calendar';
import { buildAuditLog, filterAuditLog, auditLogToCsv } from '@/Edu-task/lib/auditLog';
import { monthlyLeaveTrend, onTimeCompletionRate, topWorkloads } from '@/Edu-task/lib/analytics';
import { escapeHtml } from '@/Edu-task/services/telegramService';
import { LeaveRequest } from '@/Edu-task/types/leave';
import { Task } from '@/Edu-task/types/task';

function leave(overrides: Partial<LeaveRequest> = {}): LeaveRequest {
  return {
    id: 'LV_1', code: 'DXN-1', applicantId: 'U1', applicantName: 'GV A', applicantRole: 'Giáo viên',
    departmentId: 'D1', departmentName: 'Tổ 1', leaveType: 'SICK',
    startDate: '2026-03-10', endDate: '2026-03-12', totalDays: 3, session: 'FULL_DAY',
    reason: 'Ốm', proofFiles: [], currentStepIndex: 0, steps: [], overallStatus: 'APPROVED',
    history: [], createdAt: '2026-03-01 08:00', updatedAt: '2026-03-01 08:00',
    ...overrides,
  };
}

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 'T1', code: 'CV-1', title: 'Việc 1', description: '',
    assignerId: 'U9', assignerName: 'HT', assignerRole: 'Hiệu trưởng',
    assigneeType: 'INDIVIDUAL', assignees: [], attachments: [],
    deadline: '2026-03-20 17:00', startDate: '2026-03-01 08:00',
    priority: 'NORMAL', status: 'ASSIGNED', viewerIds: [],
    extensionRequests: [], activities: [],
    createdAt: '2026-03-01 08:00', updatedAt: '2026-03-01 08:00',
    ...overrides,
  };
}

describe('workflow configuration', () => {
  it('defaults to requiring executive approval for everything', () => {
    expect(buildApprovalSteps(DEFAULT_WORKFLOW_CONFIG, 'SICK', 1)).toHaveLength(2);
  });

  it('settles short requests at the department when a threshold is set', () => {
    const config = { deptOnlyMaxDays: 2, alwaysExecutiveTypes: [] };
    expect(buildApprovalSteps(config, 'SICK', 1)).toHaveLength(1);
    expect(buildApprovalSteps(config, 'SICK', 2)).toHaveLength(1);
    expect(buildApprovalSteps(config, 'SICK', 3)).toHaveLength(2);
  });

  it('honours leave types that always need executive sign-off', () => {
    const config = { deptOnlyMaxDays: 5, alwaysExecutiveTypes: ['BUSINESS' as const] };
    expect(requiresExecutiveApproval(config, 'BUSINESS', 1)).toBe(true);
    expect(requiresExecutiveApproval(config, 'SICK', 1)).toBe(false);
  });

  it('always keeps the department step so a request is never unapprovable', () => {
    const steps = buildApprovalSteps({ deptOnlyMaxDays: 99, alwaysExecutiveTypes: [] }, 'SICK', 1);
    expect(steps[0].level).toBe('GROUP_LEADER');
    expect(steps.length).toBeGreaterThanOrEqual(1);
  });

  it('falls back to the default when no config has been saved', () => {
    expect(buildApprovalSteps(null, 'SICK', 1)).toHaveLength(2);
  });
});

describe('telegram configuration', () => {
  it('is inactive until enabled with both token and chat id', () => {
    expect(isTelegramConfigured(DEFAULT_TELEGRAM_CONFIG)).toBe(false);
    expect(isTelegramConfigured({ ...DEFAULT_TELEGRAM_CONFIG, enabled: true })).toBe(false);
    expect(isTelegramConfigured({ ...DEFAULT_TELEGRAM_CONFIG, enabled: true, botToken: 'x' })).toBe(false);
    expect(isTelegramConfigured({ ...DEFAULT_TELEGRAM_CONFIG, enabled: true, botToken: 'x', chatId: '-1' })).toBe(true);
  });

  it('treats whitespace-only credentials as unconfigured', () => {
    expect(isTelegramConfigured({ ...DEFAULT_TELEGRAM_CONFIG, enabled: true, botToken: '  ', chatId: ' ' })).toBe(false);
  });

  it('escapes HTML so a reason field cannot break the message', () => {
    expect(escapeHtml('<b>x</b> & y')).toBe('&lt;b&gt;x&lt;/b&gt; &amp; y');
  });
});

describe('calendar', () => {
  it('produces whole weeks starting on Monday', () => {
    const cells = buildMonthGrid(2026, 2, new Date('2026-03-15T12:00:00')); // March 2026
    expect(cells.length % 7).toBe(0);
    expect(cells.filter(c => c.date !== null)).toHaveLength(31);
  });

  it('marks today', () => {
    const today = new Date(2026, 2, 15);
    const cells = buildMonthGrid(2026, 2, today);
    expect(cells.find(c => c.isToday)?.date).toBe('2026-03-15');
  });

  it('uses local dates, not UTC, so the day never shifts', () => {
    expect(toDateKey(new Date(2026, 0, 1))).toBe('2026-01-01');
  });

  it('expands a range so a leave appears on every day it covers', () => {
    const byDate = groupLeavesByDate([leave()]);
    expect(byDate.get('2026-03-10')).toHaveLength(1);
    expect(byDate.get('2026-03-11')).toHaveLength(1);
    expect(byDate.get('2026-03-12')).toHaveLength(1);
    expect(byDate.get('2026-03-13')).toBeUndefined();
  });

  it('omits cancelled and rejected requests', () => {
    const byDate = groupLeavesByDate([leave({ overallStatus: 'CANCELLED' }), leave({ id: 'LV_2', overallStatus: 'REJECTED' })]);
    expect(byDate.size).toBe(0);
  });

  it('ignores a reversed date range rather than looping', () => {
    const byDate = groupLeavesByDate([leave({ startDate: '2026-03-12', endDate: '2026-03-10' })]);
    expect(byDate.size).toBe(0);
  });
});

describe('audit log', () => {
  const leaves = [leave({
    history: [{ id: 'H1', action: 'TẠO ĐƠN', actorName: 'GV A', actorRole: 'Giáo viên', timestamp: '2026-03-01 08:00', note: 'ghi chú' }],
  })];
  const tasks = [task({
    activities: [{ id: 'A1', taskId: 'T1', actorId: 'U9', actorName: 'HT', actorRole: 'Hiệu trưởng', action: 'CREATE', content: 'Phát hành', timestamp: '2026-03-02 09:00' }],
  })];

  it('merges both sources newest first', () => {
    const entries = buildAuditLog(leaves, tasks);
    expect(entries).toHaveLength(2);
    expect(entries[0].source).toBe('TASK'); // 03-02 is later than 03-01
  });

  it('translates task action codes into Vietnamese', () => {
    expect(buildAuditLog([], tasks)[0].action).toBe('PHÁT HÀNH CÔNG VIỆC');
  });

  it('filters by source, text and date range', () => {
    const entries = buildAuditLog(leaves, tasks);
    expect(filterAuditLog(entries, { source: 'LEAVE' })).toHaveLength(1);
    expect(filterAuditLog(entries, { search: 'hiệu trưởng' })).toHaveLength(1);
    expect(filterAuditLog(entries, { from: '2026-03-02' })).toHaveLength(1);
    expect(filterAuditLog(entries, { to: '2026-03-01' })).toHaveLength(1);
    expect(filterAuditLog(entries, { from: '2026-04-01' })).toHaveLength(0);
  });

  it('escapes quotes when exporting CSV', () => {
    const entries = buildAuditLog([leave({
      history: [{ id: 'H', action: 'X', actorName: 'A "B"', actorRole: 'R', timestamp: '2026-03-01 08:00' }],
    })], []);
    expect(auditLogToCsv(entries)).toContain('"A ""B"""');
  });
});

describe('analytics', () => {
  it('keeps empty months so the trend has no gaps', () => {
    const trend = monthlyLeaveTrend([], 6, new Date(2026, 2, 15));
    expect(trend).toHaveLength(6);
    expect(trend.every(p => p.leaveDays === 0)).toBe(true);
  });

  it('buckets a request by its start month and excludes cancelled ones', () => {
    const trend = monthlyLeaveTrend(
      [leave(), leave({ id: 'LV_2', overallStatus: 'CANCELLED' })],
      6,
      new Date(2026, 2, 15)
    );
    expect(trend.find(p => p.month === '2026-03')?.leaveDays).toBe(3);
    expect(trend.find(p => p.month === '2026-03')?.leaveCount).toBe(1);
  });

  it('returns null on-time rate when nothing is completed yet', () => {
    expect(onTimeCompletionRate([task()])).toBeNull();
  });

  it('counts a task finished before its deadline as on time', () => {
    const done = task({
      status: 'COMPLETED',
      deadline: '2026-03-20 17:00',
      assignees: [{ userId: 'U1', userName: 'A', departmentName: 'D', status: 'COMPLETED', completedAt: '2026-03-19 10:00' }],
    });
    expect(onTimeCompletionRate([done])).toBe(100);
  });

  it('counts a task finished after its deadline as late', () => {
    const late = task({
      status: 'COMPLETED',
      deadline: '2026-03-20 17:00',
      assignees: [{ userId: 'U1', userName: 'A', departmentName: 'D', status: 'COMPLETED', completedAt: '2026-03-25 10:00' }],
    });
    expect(onTimeCompletionRate([late])).toBe(0);
  });

  it('ranks people by open workload and ignores completed tasks', () => {
    const busy = task({
      id: 'T2',
      assignees: [{ userId: 'U1', userName: 'A', departmentName: 'D', status: 'ASSIGNED' }],
    });
    const done = task({
      id: 'T3',
      status: 'COMPLETED',
      assignees: [{ userId: 'U2', userName: 'B', departmentName: 'D', status: 'COMPLETED' }],
    });
    const result = topWorkloads([busy, done], 5, new Date(2026, 2, 15));
    expect(result).toHaveLength(1);
    expect(result[0].userId).toBe('U1');
  });
});
