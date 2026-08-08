import { describe, it, expect } from 'vitest';
import {
  isCounted,
  monthOf,
  overview,
  punctualityRate,
  recordsInMonth,
  summariseByTeacher,
} from '@/Edu-task/lib/attendanceStats';
import { AttendanceRecord, AttendanceStatus } from '@/Edu-task/types/attendance';

function record(over: Partial<AttendanceRecord> = {}): AttendanceRecord {
  return {
    id: 'ATT_1', schoolId: 'S', code: 'NN-2026-001',
    slot: { date: '2026-08-10', session: 'MORNING', period: 1 },
    classId: 'C1', className: '10A1',
    teacherId: 'T1', teacherName: 'Cô A',
    departmentId: 'D1', departmentName: 'Tổ Toán',
    issue: 'LATE', minutes: 5,
    recordedById: 'S1', recordedByName: 'Giám thị B',
    status: 'RECORDED',
    createdAt: '2026-08-10 07:10', updatedAt: '2026-08-10 07:10',
    ...over,
  };
}

describe('what counts against a teacher', () => {
  it.each([['RECORDED'], ['EXPLAINED'], ['CONFIRMED']] as [AttendanceStatus][])(
    'counts a %s record',
    status => {
      // An unanswered record still counts — if silence excused it, ignoring the
      // record would be the winning move.
      expect(isCounted(record({ status }))).toBe(true);
    }
  );

  it('does not count an excused record', () => {
    expect(isCounted(record({ status: 'EXCUSED' }))).toBe(false);
  });
});

describe('month bucketing', () => {
  it('buckets by the date the issue happened, not when it was typed in', () => {
    const late = record({
      slot: { date: '2026-07-31', session: 'AFTERNOON', period: 5 },
      createdAt: '2026-08-01 08:00',
    });
    expect(monthOf(late)).toBe('2026-07');
    expect(recordsInMonth([late], '2026-08')).toEqual([]);
    expect(recordsInMonth([late], '2026-07')).toHaveLength(1);
  });
});

describe('summariseByTeacher', () => {
  it('tallies each issue type separately', () => {
    const [row] = summariseByTeacher([
      record({ id: 'a', issue: 'LATE', minutes: 5 }),
      record({ id: 'b', issue: 'LATE', minutes: 10 }),
      record({ id: 'c', issue: 'EMPTY_CLASS', minutes: undefined }),
      record({ id: 'd', issue: 'LEFT_EARLY', minutes: 3 }),
    ]);
    expect(row.lateCount).toBe(2);
    expect(row.emptyClassCount).toBe(1);
    expect(row.leftEarlyCount).toBe(1);
    expect(row.totalCounted).toBe(4);
  });

  it('sums minutes only for issues that have a duration', () => {
    const [row] = summariseByTeacher([
      record({ id: 'a', issue: 'LATE', minutes: 10 }),
      // An empty class has no duration; a stray `minutes` must not leak in.
      record({ id: 'b', issue: 'EMPTY_CLASS', minutes: 45 }),
    ]);
    expect(row.totalMinutes).toBe(10);
  });

  it('separates excused records from counted ones', () => {
    const [row] = summariseByTeacher([
      record({ id: 'a', status: 'CONFIRMED' }),
      record({ id: 'b', status: 'EXCUSED' }),
    ]);
    expect(row.totalCounted).toBe(1);
    expect(row.excusedCount).toBe(1);
  });

  it('still lists a teacher whose every record was excused', () => {
    // Otherwise they vanish from the report and nobody can see the case was
    // raised and settled.
    const rows = summariseByTeacher([record({ status: 'EXCUSED' })]);
    expect(rows).toHaveLength(1);
    expect(rows[0].totalCounted).toBe(0);
    expect(rows[0].excusedCount).toBe(1);
  });

  it('excludes records with no teacher rather than inventing a placeholder', () => {
    const rows = summariseByTeacher([
      record({ id: 'a', teacherId: undefined, teacherName: undefined, issue: 'EMPTY_CLASS' }),
      record({ id: 'b', teacherId: 'T2', teacherName: 'Thầy C' }),
    ]);
    expect(rows.map(r => r.teacherId)).toEqual(['T2']);
  });

  it('sorts the heaviest tally first', () => {
    const rows = summariseByTeacher([
      record({ id: 'a', teacherId: 'T1', teacherName: 'Cô A' }),
      record({ id: 'b', teacherId: 'T2', teacherName: 'Thầy B' }),
      record({ id: 'c', teacherId: 'T2', teacherName: 'Thầy B' }),
    ]);
    expect(rows.map(r => r.teacherId)).toEqual(['T2', 'T1']);
  });
});

describe('overview', () => {
  it('counts records, not teachers, but reports both', () => {
    const stats = overview([
      record({ id: 'a', teacherId: 'T1' }),
      record({ id: 'b', teacherId: 'T1' }),
      record({ id: 'c', teacherId: 'T2', issue: 'EMPTY_CLASS', minutes: undefined }),
      record({ id: 'd', teacherId: 'T3', status: 'EXCUSED' }),
    ]);
    expect(stats.totalRecords).toBe(4);
    expect(stats.countedRecords).toBe(3);
    expect(stats.lateCount).toBe(2);
    expect(stats.emptyClassCount).toBe(1);
    expect(stats.teachersInvolved).toBe(2);
    expect(stats.totalMinutes).toBe(10);
  });

  it('handles an empty month', () => {
    const stats = overview([]);
    expect(stats.totalRecords).toBe(0);
    expect(stats.teachersInvolved).toBe(0);
  });
});

describe('punctualityRate — the number a principal will quote out loud', () => {
  it('measures the share of staff with no counted record', () => {
    // 10 teachers, 2 of them flagged (one twice) → 8/10.
    const records = [
      record({ id: 'a', teacherId: 'T1' }),
      record({ id: 'b', teacherId: 'T1' }),
      record({ id: 'c', teacherId: 'T2' }),
    ];
    expect(punctualityRate(records, 10)).toBe(80);
  });

  it('does not hold an excused record against anyone', () => {
    expect(punctualityRate([record({ status: 'EXCUSED' })], 10)).toBe(100);
  });

  it('ignores records with no teacher attached', () => {
    expect(punctualityRate([record({ teacherId: undefined })], 10)).toBe(100);
  });

  it('returns null with no staff to measure, rather than a meaningless 100%', () => {
    expect(punctualityRate([], 0)).toBeNull();
  });

  it('never goes below zero even if more teachers are flagged than counted', () => {
    // Guards against a stale staff count making the arithmetic negative.
    const records = [
      record({ id: 'a', teacherId: 'T1' }),
      record({ id: 'b', teacherId: 'T2' }),
      record({ id: 'c', teacherId: 'T3' }),
    ];
    expect(punctualityRate(records, 2)).toBe(0);
  });
});
