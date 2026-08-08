import {
  ABSENT_MARKS,
  ClassAttendance,
  ConductRecord,
  Student,
  StudentMark,
} from '@/Edu-task/types/student';

/**
 * Student attendance and conduct, rolled up for the register and the dashboard.
 *
 * The judgement encoded here is what an absence *costs*. Nghỉ có phép is still
 * an absence for headcount purposes — the child is not in the room and the
 * teacher needs to know — but it is not a conduct failing, so the two are
 * counted separately everywhere rather than collapsed into one "absent" number
 * that would be wrong for one purpose or the other.
 */

export function isAbsent(mark: StudentMark): boolean {
  return ABSENT_MARKS.includes(mark);
}

/** Recomputes the denormalised totals stored on a roll. */
export function tallyEntries(entries: ClassAttendance['entries']): {
  presentCount: number;
  absentCount: number;
  lateCount: number;
} {
  return {
    // Late is still present: the child is in the room, just not on time.
    presentCount: entries.filter(e => e.mark === 'PRESENT' || e.mark === 'LATE').length,
    absentCount: entries.filter(e => isAbsent(e.mark)).length,
    lateCount: entries.filter(e => e.mark === 'LATE').length,
  };
}

export interface DailyAttendanceSummary {
  /** Classes whose roll has been taken. */
  classesRecorded: number;
  presentCount: number;
  absentCount: number;
  excusedCount: number;
  unexcusedCount: number;
  lateCount: number;
  /** 0–100, or null when no roll has been taken at all. */
  presentRate: number | null;
}

/** Everything recorded for one date, across every class and session. */
export function summariseDay(records: ClassAttendance[], date: string): DailyAttendanceSummary {
  const today = records.filter(r => r.date === date);

  // A class taught morning AND afternoon produces two rolls; counting both
  // would double the headcount. The morning roll is the school-day headcount.
  const byClass = new Map<string, ClassAttendance>();
  for (const record of today) {
    const existing = byClass.get(record.classId);
    if (!existing || (existing.session === 'AFTERNOON' && record.session === 'MORNING')) {
      byClass.set(record.classId, record);
    }
  }

  const chosen = Array.from(byClass.values());
  const entries = chosen.flatMap(r => r.entries);

  const presentCount = entries.filter(e => e.mark === 'PRESENT' || e.mark === 'LATE').length;
  const excusedCount = entries.filter(e => e.mark === 'EXCUSED').length;
  const unexcusedCount = entries.filter(e => e.mark === 'UNEXCUSED').length;
  const total = entries.length;

  return {
    classesRecorded: chosen.length,
    presentCount,
    absentCount: excusedCount + unexcusedCount,
    excusedCount,
    unexcusedCount,
    lateCount: entries.filter(e => e.mark === 'LATE').length,
    presentRate: total === 0 ? null : Math.round((presentCount / total) * 100),
  };
}

/** Classes with no roll taken yet for a date — the register's to-do list. */
export function classesMissingRoll(
  records: ClassAttendance[],
  date: string,
  classIds: string[]
): string[] {
  const recorded = new Set(records.filter(r => r.date === date).map(r => r.classId));
  return classIds.filter(id => !recorded.has(id));
}

// --- Conduct ---------------------------------------------------------------

export interface StudentConductSummary {
  studentId: string;
  studentName: string;
  className: string;
  violationCount: number;
  commendationCount: number;
  violationPoints: number;
  commendationPoints: number;
  /** Commendations minus violations. Can legitimately be negative. */
  netPoints: number;
}

export function monthOfConduct(record: ConductRecord): string {
  return (record.date ?? '').slice(0, 7);
}

export function conductInMonth(records: ConductRecord[], month: string): ConductRecord[] {
  return records.filter(r => monthOfConduct(r) === month);
}

/**
 * Per-student tally, most negative first.
 *
 * Sorted by net score ascending so the children who most need attention are at
 * the top — a list sorted by "worst violations" would bury a child who has both
 * many violations and many commendations, which is exactly the pattern worth
 * looking at.
 */
export function summariseConduct(records: ConductRecord[]): StudentConductSummary[] {
  const byStudent = new Map<string, StudentConductSummary>();

  for (const record of records) {
    const entry = byStudent.get(record.studentId) ?? {
      studentId: record.studentId,
      studentName: record.studentName,
      className: record.className,
      violationCount: 0,
      commendationCount: 0,
      violationPoints: 0,
      commendationPoints: 0,
      netPoints: 0,
    };

    // Points are stored positive; the kind decides the direction. See the note
    // on ConductRecord.points.
    const points = Math.abs(record.points ?? 0);
    if (record.kind === 'VIOLATION') {
      entry.violationCount += 1;
      entry.violationPoints += points;
    } else {
      entry.commendationCount += 1;
      entry.commendationPoints += points;
    }
    entry.netPoints = entry.commendationPoints - entry.violationPoints;

    byStudent.set(record.studentId, entry);
  }

  return Array.from(byStudent.values()).sort(
    (a, b) => a.netPoints - b.netPoints || a.studentName.localeCompare(b.studentName, 'vi')
  );
}

/** Class-level conduct totals, for the thi đua board between classes. */
export function summariseConductByClass(records: ConductRecord[]): Array<{
  classId: string;
  className: string;
  violationCount: number;
  commendationCount: number;
  netPoints: number;
}> {
  const byClass = new Map<string, { classId: string; className: string; violationCount: number; commendationCount: number; netPoints: number }>();

  for (const record of records) {
    const entry = byClass.get(record.classId) ?? {
      classId: record.classId,
      className: record.className,
      violationCount: 0,
      commendationCount: 0,
      netPoints: 0,
    };
    const points = Math.abs(record.points ?? 0);
    if (record.kind === 'VIOLATION') {
      entry.violationCount += 1;
      entry.netPoints -= points;
    } else {
      entry.commendationCount += 1;
      entry.netPoints += points;
    }
    byClass.set(record.classId, entry);
  }

  return Array.from(byClass.values()).sort((a, b) => b.netPoints - a.netPoints);
}

/** Students flagged as needing support, in the caller's visible scope. */
export function studentsNeedingSupport(students: Student[]): Student[] {
  return students
    .filter(s => s.isActive && s.needsSupport)
    .sort((a, b) => a.className.localeCompare(b.className, 'vi', { numeric: true })
      || a.fullName.localeCompare(b.fullName, 'vi'));
}

/** Roster for one class, in register order. */
export function studentsInClass(students: Student[], classId: string): Student[] {
  return students
    .filter(s => s.classId === classId && s.isActive)
    .sort((a, b) => a.fullName.localeCompare(b.fullName, 'vi'));
}
