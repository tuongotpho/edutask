import { describe, it, expect } from 'vitest';
import {
  addDays,
  describeRecurrence,
  isDueOn,
  isoWeekday,
  lastDayOfMonth,
  monthlyDayIn,
  nextOccurrence,
  resolveReminderRecipients,
  shouldFire,
  upcomingMilestones,
  upcomingTaskReminders,
} from '@/Edu-task/lib/reminderSchedule';
import { ReminderSchedule } from '@/Edu-task/types/reminder';
import { Plan } from '@/Edu-task/types/plan';
import { Task } from '@/Edu-task/types/task';

function schedule(over: Partial<ReminderSchedule> = {}): ReminderSchedule {
  return {
    id: 'RMD_1', schoolId: 'S',
    title: 'Nhắc nộp kế hoạch', scope: 'SCHOOL',
    audience: 'ALL_STAFF',
    recurrence: 'MONTHLY', dayOfMonth: 25, timeOfDay: '07:30',
    isActive: true,
    createdById: 'U1', createdByName: 'Hiệu trưởng',
    createdAt: '2026-08-01 08:00', updatedAt: '2026-08-01 08:00',
    ...over,
  };
}

describe('date arithmetic — UTC, so a reminder never slips a day', () => {
  it('adds days across a month boundary', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('numbers weekdays the ISO way', () => {
    // 2026-08-10 is a Monday.
    expect(isoWeekday('2026-08-10')).toBe(1);
    expect(isoWeekday('2026-08-16')).toBe(7);
    expect(isoWeekday('rác')).toBeNull();
  });

  it('knows the length of each month', () => {
    expect(lastDayOfMonth(2026, 1)).toBe(28); // Feb 2026
    expect(lastDayOfMonth(2028, 1)).toBe(29); // Feb 2028, a leap year
    expect(lastDayOfMonth(2026, 3)).toBe(30); // April
  });
});

describe('monthly schedules land in every month', () => {
  it('clamps the 31st to the last day of a shorter month', () => {
    // Without clamping, a "cuối tháng" reminder would silently skip February —
    // and nobody would notice until the deadline was missed.
    expect(monthlyDayIn(2026, 1, 31)).toBe(28);
    expect(monthlyDayIn(2026, 3, 31)).toBe(30);
    expect(monthlyDayIn(2026, 0, 31)).toBe(31);
  });

  it('fires on the last day of February for a 31st schedule', () => {
    const s = schedule({ dayOfMonth: 31 });
    expect(isDueOn(s, '2026-02-28')).toBe(true);
    expect(isDueOn(s, '2026-02-27')).toBe(false);
  });

  it('fires on the ordinary day in a long month', () => {
    const s = schedule({ dayOfMonth: 25 });
    expect(isDueOn(s, '2026-08-25')).toBe(true);
    expect(isDueOn(s, '2026-08-24')).toBe(false);
  });
});

describe('weekly schedules', () => {
  it('fires on the configured weekday only', () => {
    const s = schedule({ recurrence: 'WEEKLY', weekday: 1, dayOfMonth: undefined });
    expect(isDueOn(s, '2026-08-10')).toBe(true);  // Monday
    expect(isDueOn(s, '2026-08-11')).toBe(false); // Tuesday
    expect(isDueOn(s, '2026-08-17')).toBe(true);  // next Monday
  });

  it('never fires without a weekday configured', () => {
    const s = schedule({ recurrence: 'WEEKLY', weekday: undefined, dayOfMonth: undefined });
    expect(isDueOn(s, '2026-08-10')).toBe(false);
  });
});

describe('one-off schedules', () => {
  it('fires on its date and never again', () => {
    const s = schedule({ recurrence: 'ONCE', date: '2026-08-20', dayOfMonth: undefined });
    expect(isDueOn(s, '2026-08-20')).toBe(true);
    expect(isDueOn(s, '2026-08-21')).toBe(false);
    expect(nextOccurrence(s, '2026-08-21')).toBeNull();
  });
});

describe('the active window', () => {
  it('does not fire before it starts or after it ends', () => {
    const s = schedule({ dayOfMonth: 25, startDate: '2026-09-01', endDate: '2027-05-31' });
    expect(isDueOn(s, '2026-08-25')).toBe(false);
    expect(isDueOn(s, '2026-09-25')).toBe(true);
    expect(isDueOn(s, '2027-06-25')).toBe(false);
  });

  it('does not fire when switched off', () => {
    expect(isDueOn(schedule({ isActive: false }), '2026-08-25')).toBe(false);
    expect(nextOccurrence(schedule({ isActive: false }), '2026-08-01')).toBeNull();
  });
});

describe('nextOccurrence', () => {
  it('finds today when today is the day', () => {
    expect(nextOccurrence(schedule({ dayOfMonth: 25 }), '2026-08-25')).toBe('2026-08-25');
  });

  it('rolls into the next month once the day has passed', () => {
    expect(nextOccurrence(schedule({ dayOfMonth: 25 }), '2026-08-26')).toBe('2026-09-25');
  });

  it('finds the next matching weekday', () => {
    const s = schedule({ recurrence: 'WEEKLY', weekday: 5, dayOfMonth: undefined });
    expect(nextOccurrence(s, '2026-08-10')).toBe('2026-08-14'); // Monday → Friday
  });

  it('returns null once the window has closed', () => {
    const s = schedule({ dayOfMonth: 25, endDate: '2026-08-31' });
    expect(nextOccurrence(s, '2026-09-01')).toBeNull();
  });

  it('looks ahead to a window that has not opened yet', () => {
    const s = schedule({ dayOfMonth: 25, startDate: '2027-01-01' });
    expect(nextOccurrence(s, '2026-08-01')).toBe('2027-01-25');
  });

  it('terminates rather than looping forever on an unsatisfiable schedule', () => {
    const s = schedule({ recurrence: 'MONTHLY', dayOfMonth: undefined });
    expect(nextOccurrence(s, '2026-08-01', 40)).toBeNull();
  });
});

describe('shouldFire — safe to retry', () => {
  it('fires when due and not yet sent today', () => {
    expect(shouldFire(schedule({ dayOfMonth: 25 }), '2026-08-25')).toBe(true);
  });

  it('does not fire twice on the same day', () => {
    // A scheduler that retries must not notify eighty people twice.
    const s = schedule({ dayOfMonth: 25, lastFiredOn: '2026-08-25' });
    expect(shouldFire(s, '2026-08-25')).toBe(false);
  });

  it('fires again next month after a previous send', () => {
    const s = schedule({ dayOfMonth: 25, lastFiredOn: '2026-08-25' });
    expect(shouldFire(s, '2026-09-25')).toBe(true);
  });
});

describe('describeRecurrence', () => {
  it('warns that a late-month day gets clamped', () => {
    expect(describeRecurrence(schedule({ dayOfMonth: 31 }))).toContain('ngày cuối tháng');
    expect(describeRecurrence(schedule({ dayOfMonth: 25 }))).not.toContain('ngày cuối tháng');
  });

  it('names the weekday', () => {
    const s = schedule({ recurrence: 'WEEKLY', weekday: 2, dayOfMonth: undefined });
    expect(describeRecurrence(s)).toContain('Thứ Ba');
  });
});

describe('resolveReminderRecipients', () => {
  const users = [
    { id: 'U1', departmentId: 'D1', roles: ['TEACHER'], status: 'ACTIVE' },
    { id: 'U2', departmentId: 'D1', roles: ['HEAD_OF_DEPT'], status: 'ACTIVE' },
    { id: 'U3', departmentId: 'D2', roles: ['GROUP_LEADER'], status: 'ACTIVE' },
    { id: 'U4', departmentId: 'D1', roles: ['TEACHER'], status: 'PENDING_APPROVAL' },
  ];

  it('never includes accounts that are not active', () => {
    expect(resolveReminderRecipients(schedule({ audience: 'ALL_STAFF' }), users)).toEqual(['U1', 'U2', 'U3']);
  });

  it('resolves department leaders across the school', () => {
    expect(resolveReminderRecipients(schedule({ audience: 'DEPT_LEADERS' }), users)).toEqual(['U2', 'U3']);
  });

  it('resolves a single department', () => {
    const s = schedule({ audience: 'DEPARTMENT', departmentId: 'D1' });
    expect(resolveReminderRecipients(s, users)).toEqual(['U1', 'U2']);
  });

  it('drops custom recipients who are no longer active', () => {
    const s = schedule({ audience: 'CUSTOM', recipientIds: ['U1', 'U4', 'U9'] });
    expect(resolveReminderRecipients(s, users)).toEqual(['U1']);
  });
});

// --- What is coming due -----------------------------------------------------

function task(over: Partial<Task> = {}): Task {
  return {
    id: 'T1', code: 'CV-2026-001', title: 'Nộp báo cáo', description: '',
    assignerId: 'U9', assignerName: 'BGH', assignerRole: 'Hiệu trưởng',
    assigneeType: 'INDIVIDUAL',
    assignees: [{ userId: 'U1', userName: 'GV A', departmentName: 'Tổ Toán', status: 'ASSIGNED' }],
    attachments: [], deadline: '2026-08-10 17:00', startDate: '2026-08-01',
    priority: 'NORMAL', status: 'ASSIGNED', viewerIds: ['U1'],
    extensionRequests: [], activities: [],
    createdAt: '2026-08-01 08:00', updatedAt: '2026-08-01 08:00',
    ...over,
  };
}

describe('upcomingTaskReminders', () => {
  const now = new Date('2026-08-08T03:00:00Z');

  it('includes work due within the horizon', () => {
    const items = upcomingTaskReminders([task({ deadline: '2026-08-10 17:00' })], '2026-08-08', 3, now);
    expect(items).toHaveLength(1);
    expect(items[0].daysRemaining).toBe(2);
    expect(items[0].isOverdue).toBe(false);
  });

  it('excludes work beyond the horizon', () => {
    expect(upcomingTaskReminders([task({ deadline: '2026-08-20 17:00' })], '2026-08-08', 3, now)).toEqual([]);
  });

  it('keeps reminding about work already overdue', () => {
    // Going quiet the moment something slips is when a reminder matters most.
    const items = upcomingTaskReminders([task({ deadline: '2026-08-01 17:00' })], '2026-08-08', 3, now);
    expect(items).toHaveLength(1);
    expect(items[0].isOverdue).toBe(true);
    expect(items[0].daysRemaining).toBeLessThan(0);
  });

  it('ignores completed work', () => {
    const done = task({ deadline: '2026-08-09 17:00', status: 'COMPLETED' });
    expect(upcomingTaskReminders([done], '2026-08-08', 3, now)).toEqual([]);
  });

  it('addresses the assignees', () => {
    const items = upcomingTaskReminders([task()], '2026-08-08', 3, now);
    expect(items[0].recipientIds).toEqual(['U1']);
  });

  it('sorts soonest first', () => {
    const items = upcomingTaskReminders(
      [
        task({ id: 'a', deadline: '2026-08-10 17:00' }),
        task({ id: 'b', deadline: '2026-08-09 17:00' }),
      ],
      '2026-08-08', 3, now
    );
    expect(items.map(i => i.id)).toEqual(['b', 'a']);
  });
});

function plan(over: Partial<Plan> = {}): Plan {
  return {
    id: 'P1', schoolId: 'S', code: 'KH-2026-001',
    title: 'Kế hoạch tổ Toán', scope: 'DEPARTMENT',
    departmentId: 'D1', departmentName: 'Tổ Toán',
    startDate: '2026-09-01', endDate: '2027-05-31',
    milestones: [],
    ownerId: 'OWNER', ownerName: 'Tổ trưởng',
    isArchived: false,
    createdAt: '2026-08-01 08:00', updatedAt: '2026-08-01 08:00',
    ...over,
  };
}

describe('upcomingMilestones', () => {
  it('includes milestones inside the horizon and skips finished ones', () => {
    const p = plan({
      milestones: [
        { id: 'M1', title: 'Nộp kế hoạch', dueDate: '2026-08-12', status: 'PENDING' },
        { id: 'M2', title: 'Đã xong', dueDate: '2026-08-12', status: 'DONE' },
        { id: 'M3', title: 'Còn xa', dueDate: '2026-12-01', status: 'PENDING' },
      ],
    });
    const items = upcomingMilestones([p], '2026-08-08', 7);
    expect(items.map(i => i.id)).toEqual(['M1']);
  });

  it('includes milestones already missed', () => {
    const p = plan({ milestones: [{ id: 'M1', title: 'Trễ', dueDate: '2026-08-01', status: 'PENDING' }] });
    const [item] = upcomingMilestones([p], '2026-08-08', 7);
    expect(item.isOverdue).toBe(true);
  });

  it('falls back to the plan owner when a milestone has none', () => {
    // An unowned reminder reaches nobody, which is worse than reaching the
    // wrong person — at least the owner can forward it.
    const p = plan({ milestones: [{ id: 'M1', title: 'X', dueDate: '2026-08-09', status: 'PENDING' }] });
    expect(upcomingMilestones([p], '2026-08-08', 7)[0].recipientIds).toEqual(['OWNER']);
  });

  it('prefers the milestone owner when set', () => {
    const p = plan({
      milestones: [{ id: 'M1', title: 'X', dueDate: '2026-08-09', status: 'PENDING', ownerId: 'U5' }],
    });
    expect(upcomingMilestones([p], '2026-08-08', 7)[0].recipientIds).toEqual(['U5']);
  });

  it('ignores archived plans', () => {
    const p = plan({
      isArchived: true,
      milestones: [{ id: 'M1', title: 'X', dueDate: '2026-08-09', status: 'PENDING' }],
    });
    expect(upcomingMilestones([p], '2026-08-08', 7)).toEqual([]);
  });
});
