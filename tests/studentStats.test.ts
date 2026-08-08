import { describe, it, expect } from 'vitest';
import {
  classesMissingRoll,
  conductInMonth,
  isAbsent,
  studentsInClass,
  studentsNeedingSupport,
  summariseConduct,
  summariseConductByClass,
  summariseDay,
  tallyEntries,
} from '@/Edu-task/lib/studentStats';
import {
  ClassAttendance,
  ConductRecord,
  Student,
  StudentAttendanceEntry,
  StudentMark,
  classAttendanceId,
} from '@/Edu-task/types/student';
import { SchoolSession } from '@/Edu-task/types/schedule';

const TODAY = '2026-08-10';

function entry(studentId: string, mark: StudentMark, minutesLate?: number): StudentAttendanceEntry {
  return { studentId, studentName: `HS ${studentId}`, mark, minutesLate };
}

function roll(over: Partial<ClassAttendance> = {}): ClassAttendance {
  const entries = over.entries ?? [entry('s1', 'PRESENT')];
  return {
    id: classAttendanceId(over.classId ?? 'C1', over.date ?? TODAY, over.session ?? 'MORNING'),
    schoolId: 'S',
    classId: 'C1', className: '10A1',
    date: TODAY, session: 'MORNING' as SchoolSession,
    entries,
    ...tallyEntries(entries),
    recordedById: 'T1', recordedByName: 'GVCN',
    createdAt: '', updatedAt: '',
    ...over,
  };
}

function student(over: Partial<Student> = {}): Student {
  return {
    id: 's1', schoolId: 'S', code: 'HS001', fullName: 'Nguyễn Văn A',
    classId: 'C1', className: '10A1',
    needsSupport: false, isActive: true,
    createdAt: '', updatedAt: '',
    ...over,
  };
}

function conduct(over: Partial<ConductRecord> = {}): ConductRecord {
  return {
    id: 'c1', schoolId: 'S',
    studentId: 's1', studentName: 'Nguyễn Văn A',
    classId: 'C1', className: '10A1',
    kind: 'VIOLATION', category: 'UNIFORM',
    description: 'Không đeo bảng tên', points: 2,
    date: TODAY,
    recordedById: 'T1', recordedByName: 'GV',
    createdAt: '', updatedAt: '',
    ...over,
  };
}

describe('the deterministic roll id', () => {
  it('is the same for the same class, date and session', () => {
    // Two teachers opening 10A1's morning register must land on ONE document,
    // or the class ends up with two contradictory rolls.
    expect(classAttendanceId('C1', TODAY, 'MORNING')).toBe(classAttendanceId('C1', TODAY, 'MORNING'));
  });

  it('separates morning from afternoon', () => {
    expect(classAttendanceId('C1', TODAY, 'MORNING'))
      .not.toBe(classAttendanceId('C1', TODAY, 'AFTERNOON'));
  });
});

describe('tallyEntries', () => {
  it('counts a late child as present — they are in the room', () => {
    const tally = tallyEntries([entry('a', 'PRESENT'), entry('b', 'LATE', 10)]);
    expect(tally.presentCount).toBe(2);
    expect(tally.lateCount).toBe(1);
    expect(tally.absentCount).toBe(0);
  });

  it('counts both kinds of absence as absent', () => {
    const tally = tallyEntries([entry('a', 'EXCUSED'), entry('b', 'UNEXCUSED')]);
    expect(tally.absentCount).toBe(2);
    expect(tally.presentCount).toBe(0);
  });

  it('agrees with isAbsent', () => {
    expect(isAbsent('EXCUSED')).toBe(true);
    expect(isAbsent('UNEXCUSED')).toBe(true);
    expect(isAbsent('LATE')).toBe(false);
    expect(isAbsent('PRESENT')).toBe(false);
  });
});

describe('summariseDay', () => {
  it('separates excused from unexcused absence', () => {
    // They are both absences for headcount, but only one needs chasing.
    const stats = summariseDay(
      [roll({ entries: [entry('a', 'PRESENT'), entry('b', 'EXCUSED'), entry('c', 'UNEXCUSED')] })],
      TODAY
    );
    expect(stats.absentCount).toBe(2);
    expect(stats.excusedCount).toBe(1);
    expect(stats.unexcusedCount).toBe(1);
  });

  it('does not double-count a class registered morning and afternoon', () => {
    // Otherwise a school with two sessions reports twice its own headcount.
    const stats = summariseDay(
      [
        roll({ session: 'MORNING', entries: [entry('a', 'PRESENT'), entry('b', 'PRESENT')] }),
        roll({ session: 'AFTERNOON', entries: [entry('a', 'PRESENT'), entry('b', 'UNEXCUSED')] }),
      ],
      TODAY
    );
    expect(stats.classesRecorded).toBe(1);
    expect(stats.presentCount).toBe(2);
  });

  it('prefers the morning roll as the day’s headcount', () => {
    const stats = summariseDay(
      [
        roll({ session: 'AFTERNOON', entries: [entry('a', 'UNEXCUSED')] }),
        roll({ session: 'MORNING', entries: [entry('a', 'PRESENT')] }),
      ],
      TODAY
    );
    expect(stats.presentCount).toBe(1);
    expect(stats.absentCount).toBe(0);
  });

  it('counts each class separately', () => {
    const stats = summariseDay(
      [
        roll({ classId: 'C1', entries: [entry('a', 'PRESENT')] }),
        roll({ classId: 'C2', className: '10A2', entries: [entry('b', 'UNEXCUSED')] }),
      ],
      TODAY
    );
    expect(stats.classesRecorded).toBe(2);
    expect(stats.presentRate).toBe(50);
  });

  it('ignores other days', () => {
    const stats = summariseDay([roll({ date: '2026-08-09' })], TODAY);
    expect(stats.classesRecorded).toBe(0);
  });

  it('returns a null rate when no roll has been taken', () => {
    // 100% for a day nobody registered would be the most dangerous number on
    // the dashboard: "everyone is here" and "nobody has checked" look identical.
    expect(summariseDay([], TODAY).presentRate).toBeNull();
  });
});

describe('classesMissingRoll', () => {
  it('lists classes with no roll for the date', () => {
    const missing = classesMissingRoll([roll({ classId: 'C1' })], TODAY, ['C1', 'C2', 'C3']);
    expect(missing).toEqual(['C2', 'C3']);
  });

  it('counts a class registered in either session as done', () => {
    const missing = classesMissingRoll(
      [roll({ classId: 'C1', session: 'AFTERNOON' })],
      TODAY,
      ['C1']
    );
    expect(missing).toEqual([]);
  });

  it('does not credit yesterday’s roll for today', () => {
    const missing = classesMissingRoll([roll({ classId: 'C1', date: '2026-08-09' })], TODAY, ['C1']);
    expect(missing).toEqual(['C1']);
  });
});

describe('summariseConduct', () => {
  it('treats stored points as positive and lets kind set the direction', () => {
    // Points are stored positive on purpose; a violation saved as +5 would
    // quietly improve a child's score.
    const [row] = summariseConduct([
      conduct({ id: 'a', kind: 'VIOLATION', points: 5 }),
      conduct({ id: 'b', kind: 'COMMENDATION', points: 3 }),
    ]);
    expect(row.violationPoints).toBe(5);
    expect(row.commendationPoints).toBe(3);
    expect(row.netPoints).toBe(-2);
  });

  it('normalises a negative points value rather than trusting it', () => {
    const [row] = summariseConduct([conduct({ kind: 'VIOLATION', points: -4 })]);
    expect(row.violationPoints).toBe(4);
    expect(row.netPoints).toBe(-4);
  });

  it('sorts the lowest net score first', () => {
    const rows = summariseConduct([
      conduct({ id: 'a', studentId: 's1', studentName: 'A', kind: 'COMMENDATION', points: 5 }),
      conduct({ id: 'b', studentId: 's2', studentName: 'B', kind: 'VIOLATION', points: 5 }),
    ]);
    expect(rows.map(r => r.studentId)).toEqual(['s2', 's1']);
  });

  it('keeps a child with both violations and commendations visible', () => {
    const [row] = summariseConduct([
      conduct({ id: 'a', kind: 'VIOLATION', points: 6 }),
      conduct({ id: 'b', kind: 'COMMENDATION', points: 4 }),
    ]);
    expect(row.violationCount).toBe(1);
    expect(row.commendationCount).toBe(1);
    expect(row.netPoints).toBe(-2);
  });
});

describe('summariseConductByClass', () => {
  it('ranks classes by net points, best first', () => {
    const rows = summariseConductByClass([
      conduct({ id: 'a', classId: 'C1', className: '10A1', kind: 'VIOLATION', points: 5 }),
      conduct({ id: 'b', classId: 'C2', className: '10A2', kind: 'COMMENDATION', points: 5 }),
    ]);
    expect(rows.map(r => r.classId)).toEqual(['C2', 'C1']);
    expect(rows[0].netPoints).toBe(5);
    expect(rows[1].netPoints).toBe(-5);
  });
});

describe('conductInMonth', () => {
  it('buckets by when it happened, not when it was typed in', () => {
    const record = conduct({ date: '2026-07-31', createdAt: '2026-08-01 08:00' });
    expect(conductInMonth([record], '2026-08')).toEqual([]);
    expect(conductInMonth([record], '2026-07')).toHaveLength(1);
  });
});

describe('roster helpers', () => {
  it('lists only active students of a class, alphabetically', () => {
    const roster = studentsInClass(
      [
        student({ id: 'b', fullName: 'Trần B' }),
        student({ id: 'a', fullName: 'Lê A' }),
        student({ id: 'c', fullName: 'Phạm C', isActive: false }),
        student({ id: 'd', fullName: 'Đỗ D', classId: 'C2' }),
      ],
      'C1'
    );
    expect(roster.map(s => s.id)).toEqual(['a', 'b']);
  });

  it('lists students flagged for support, excluding those who left', () => {
    const list = studentsNeedingSupport([
      student({ id: 'a', needsSupport: true }),
      student({ id: 'b', needsSupport: false }),
      student({ id: 'c', needsSupport: true, isActive: false }),
    ]);
    expect(list.map(s => s.id)).toEqual(['a']);
  });
});
