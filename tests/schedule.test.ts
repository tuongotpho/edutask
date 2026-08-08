import { describe, it, expect } from 'vitest';
import {
  compareSlots,
  currentPeriod,
  formatDateVi,
  formatPeriod,
  formatPeriodWithTime,
  formatSlot,
  isValidPeriod,
  listAllPeriods,
  listPeriods,
  parseDate,
  periodCount,
  periodKey,
  periodTime,
  sameSlot,
  slotKey,
  sortClasses,
  sortRooms,
  toDateString,
  weekdayLabel,
} from '@/Edu-task/lib/schedule';
import {
  ClassGroup,
  DEFAULT_PERIOD_CONFIG,
  PeriodConfig,
  Room,
} from '@/Edu-task/types/schedule';

const config: PeriodConfig = DEFAULT_PERIOD_CONFIG;

describe('period counting', () => {
  it('lists periods per session, restarting the numbering each session', () => {
    expect(listPeriods(config, 'MORNING')).toEqual([1, 2, 3, 4, 5]);
    expect(listPeriods(config, 'AFTERNOON')).toEqual([1, 2, 3, 4, 5]);
  });

  it('walks the whole day in chronological order', () => {
    const all = listAllPeriods({ ...config, morningPeriods: 2, afternoonPeriods: 1 });
    expect(all).toEqual([
      { session: 'MORNING', period: 1 },
      { session: 'MORNING', period: 2 },
      { session: 'AFTERNOON', period: 1 },
    ]);
  });

  it('treats a missing or nonsensical count as zero rather than crashing', () => {
    const broken = { ...config, morningPeriods: -3, afternoonPeriods: Number.NaN };
    expect(periodCount(broken, 'MORNING')).toBe(0);
    expect(periodCount(broken, 'AFTERNOON')).toBe(0);
    expect(listPeriods(broken, 'MORNING')).toEqual([]);
  });

  it('validates a period against the configured range', () => {
    expect(isValidPeriod(config, 'MORNING', 5)).toBe(true);
    expect(isValidPeriod(config, 'MORNING', 6)).toBe(false);
    expect(isValidPeriod(config, 'MORNING', 0)).toBe(false);
    expect(isValidPeriod(config, 'MORNING', 1.5)).toBe(false);
  });
});

describe('slot identity', () => {
  it('keys a slot uniquely by date, session and period', () => {
    expect(slotKey({ date: '2026-08-10', session: 'MORNING', period: 3 }))
      .toBe('2026-08-10|MORNING|3');
  });

  it('does not confuse the same period number across sessions', () => {
    const morning = { date: '2026-08-10', session: 'MORNING' as const, period: 1 };
    const afternoon = { date: '2026-08-10', session: 'AFTERNOON' as const, period: 1 };
    expect(sameSlot(morning, afternoon)).toBe(false);
    expect(slotKey(morning)).not.toBe(slotKey(afternoon));
  });

  it('orders slots by day, then session, then period', () => {
    const slots = [
      { date: '2026-08-11', session: 'MORNING' as const, period: 1 },
      { date: '2026-08-10', session: 'AFTERNOON' as const, period: 1 },
      { date: '2026-08-10', session: 'MORNING' as const, period: 4 },
      { date: '2026-08-10', session: 'MORNING' as const, period: 2 },
    ];
    expect(slots.sort(compareSlots).map(slotKey)).toEqual([
      '2026-08-10|MORNING|2',
      '2026-08-10|MORNING|4',
      '2026-08-10|AFTERNOON|1',
      '2026-08-11|MORNING|1',
    ]);
  });
});

describe('date parsing — UTC, so the day never shifts backwards', () => {
  it('parses a well-formed date', () => {
    const parsed = parseDate('2026-08-10');
    expect(parsed?.getUTCFullYear()).toBe(2026);
    expect(parsed?.getUTCMonth()).toBe(7);
    expect(parsed?.getUTCDate()).toBe(10);
  });

  it('rejects malformed and impossible dates instead of rolling them forward', () => {
    expect(parseDate('2026-02-31')).toBeNull();
    expect(parseDate('10/08/2026')).toBeNull();
    expect(parseDate('')).toBeNull();
    expect(parseDate('2026-8-1')).toBeNull();
  });

  it('names the weekday', () => {
    // 2026-08-10 is a Monday.
    expect(weekdayLabel('2026-08-10')).toBe('Thứ Hai');
    expect(weekdayLabel('2026-08-16')).toBe('Chủ Nhật');
    expect(weekdayLabel('rác')).toBe('');
  });

  it('formats dates the Vietnamese way and leaves junk alone', () => {
    expect(formatDateVi('2026-08-10')).toBe('10/08/2026');
    expect(formatDateVi('không-phải-ngày')).toBe('không-phải-ngày');
  });

  it('round-trips a local Date through toDateString', () => {
    expect(toDateString(new Date(2026, 7, 10))).toBe('2026-08-10');
    // A late-evening local time must still report the local day, which is the
    // whole reason this does not go through toISOString().
    expect(toDateString(new Date(2026, 7, 10, 23, 30))).toBe('2026-08-10');
  });
});

describe('labels', () => {
  it('reads the way teachers say it', () => {
    expect(formatPeriod('MORNING', 2)).toBe('Tiết 2 sáng');
    expect(formatPeriod('AFTERNOON', 1)).toBe('Tiết 1 chiều');
  });

  it('adds the clock time when one is configured', () => {
    expect(formatPeriodWithTime(config, 'MORNING', 1)).toBe('Tiết 1 sáng (07:00–07:45)');
  });

  it('falls back to the bare period when no time is configured', () => {
    const noTimes: PeriodConfig = { ...config, times: {} };
    expect(formatPeriodWithTime(noTimes, 'MORNING', 1)).toBe('Tiết 1 sáng');
    expect(periodTime(noTimes, 'MORNING', 1)).toBeNull();
  });

  it('writes a full slot label with the weekday', () => {
    expect(formatSlot({ date: '2026-08-10', session: 'MORNING', period: 2 }))
      .toBe('Tiết 2 sáng · Thứ Hai 10/08/2026');
  });

  it('keys period times by session and number', () => {
    expect(periodKey('AFTERNOON', 3)).toBe('AFTERNOON-3');
  });
});

describe('currentPeriod — what pre-fills the supervisor quick-entry form', () => {
  const at = (h: number, m: number) => new Date(2026, 7, 10, h, m);

  it('returns the period in progress', () => {
    expect(currentPeriod(config, at(7, 30))).toEqual({ session: 'MORNING', period: 1 });
    expect(currentPeriod(config, at(14, 0))).toEqual({ session: 'AFTERNOON', period: 1 });
    expect(currentPeriod(config, at(14, 30))).toEqual({ session: 'AFTERNOON', period: 2 });
  });

  it('includes the boundary minutes of a period', () => {
    expect(currentPeriod(config, at(7, 0))).toEqual({ session: 'MORNING', period: 1 });
    expect(currentPeriod(config, at(7, 45))).toEqual({ session: 'MORNING', period: 1 });
  });

  it('suggests the next period during a break', () => {
    // 08:40 falls in the long break between morning periods 2 and 3.
    expect(currentPeriod(config, at(8, 40))).toEqual({ session: 'MORNING', period: 3 });
  });

  it('suggests the first afternoon period during the lunch gap', () => {
    expect(currentPeriod(config, at(12, 0))).toEqual({ session: 'AFTERNOON', period: 1 });
  });

  it('returns null after the school day, so the form asks instead of guessing', () => {
    expect(currentPeriod(config, at(21, 0))).toBeNull();
  });

  it('returns null when no times are configured at all', () => {
    expect(currentPeriod({ ...config, times: {} }, at(9, 0))).toBeNull();
  });

  it('ignores a malformed time entry rather than throwing', () => {
    const broken: PeriodConfig = {
      ...config,
      times: { ...config.times, 'MORNING-1': { start: '25:99', end: 'xx' } },
    };
    // Period 1 is unusable, so the next one that has a valid start time wins.
    expect(currentPeriod(broken, at(7, 30))).toEqual({ session: 'MORNING', period: 2 });
  });
});

describe('catalog ordering', () => {
  const room = (over: Partial<Room>): Room => ({
    id: 'R', schoolId: 'S', name: 'Phòng', code: 'P', kind: 'OTHER',
    requiresApproval: false, isActive: true, ...over,
  });

  it('puts retired rooms last so pickers show usable ones first', () => {
    const sorted = sortRooms([
      room({ id: 'r1', name: 'Phòng B', isActive: false }),
      room({ id: 'r2', name: 'Phòng A' }),
    ]);
    expect(sorted.map(r => r.id)).toEqual(['r2', 'r1']);
  });

  const cls = (over: Partial<ClassGroup>): ClassGroup => ({
    id: 'C', schoolId: 'S', name: '10A1', grade: 10, isActive: true, ...over,
  });

  it('sorts classes by khối then by number, not by string order', () => {
    const sorted = sortClasses([
      cls({ id: 'c1', name: '10A10', grade: 10 }),
      cls({ id: 'c2', name: '11A1', grade: 11 }),
      cls({ id: 'c3', name: '10A2', grade: 10 }),
    ]);
    // Plain string sort would place 10A10 before 10A2.
    expect(sorted.map(c => c.name)).toEqual(['10A2', '10A10', '11A1']);
  });
});
