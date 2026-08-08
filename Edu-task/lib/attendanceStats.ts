import {
  AttendanceRecord,
  COUNTED_STATUSES,
  TIMED_ISSUES,
} from '@/Edu-task/types/attendance';

/**
 * Turning the nề nếp log into the numbers a monthly thi đua meeting needs.
 *
 * Pure functions over records, so the rules that decide what "counts" are
 * testable and stated once. The subtle one is `COUNTED_STATUSES`: an entry
 * nobody has answered still counts, because if silence excused a record then
 * ignoring it would be the winning move.
 */

/** `YYYY-MM` for a record's slot date. */
export function monthOf(record: AttendanceRecord): string {
  return (record.slot?.date ?? '').slice(0, 7);
}

export function isCounted(record: AttendanceRecord): boolean {
  return COUNTED_STATUSES.includes(record.status);
}

export function recordsInMonth(records: AttendanceRecord[], month: string): AttendanceRecord[] {
  return records.filter(r => monthOf(r) === month);
}

export interface TeacherAttendanceSummary {
  teacherId: string;
  teacherName: string;
  departmentName: string;
  lateCount: number;
  emptyClassCount: number;
  leftEarlyCount: number;
  otherCount: number;
  totalCounted: number;
  totalMinutes: number;
  /** Entries excused after an explanation — shown, but not held against anyone. */
  excusedCount: number;
}

/**
 * Per-teacher totals, worst first.
 *
 * Records with no teacher attached (an empty room whose timetabled teacher was
 * unknown) are excluded rather than bucketed under a placeholder name: they are
 * real events for the school total, but they cannot fairly be attributed.
 */
export function summariseByTeacher(records: AttendanceRecord[]): TeacherAttendanceSummary[] {
  const byTeacher = new Map<string, TeacherAttendanceSummary>();

  for (const record of records) {
    if (!record.teacherId) continue;

    const entry = byTeacher.get(record.teacherId) ?? {
      teacherId: record.teacherId,
      teacherName: record.teacherName ?? 'Không rõ',
      departmentName: record.departmentName ?? '—',
      lateCount: 0,
      emptyClassCount: 0,
      leftEarlyCount: 0,
      otherCount: 0,
      totalCounted: 0,
      totalMinutes: 0,
      excusedCount: 0,
    };

    if (!isCounted(record)) {
      entry.excusedCount += 1;
      byTeacher.set(record.teacherId, entry);
      continue;
    }

    switch (record.issue) {
      case 'LATE': entry.lateCount += 1; break;
      case 'EMPTY_CLASS': entry.emptyClassCount += 1; break;
      case 'LEFT_EARLY': entry.leftEarlyCount += 1; break;
      default: entry.otherCount += 1;
    }

    entry.totalCounted += 1;
    if (TIMED_ISSUES.includes(record.issue)) entry.totalMinutes += record.minutes ?? 0;

    byTeacher.set(record.teacherId, entry);
  }

  return Array.from(byTeacher.values()).sort(
    (a, b) =>
      b.totalCounted - a.totalCounted ||
      b.totalMinutes - a.totalMinutes ||
      a.teacherName.localeCompare(b.teacherName, 'vi')
  );
}

export interface AttendanceOverview {
  totalRecords: number;
  countedRecords: number;
  lateCount: number;
  emptyClassCount: number;
  teachersInvolved: number;
  totalMinutes: number;
}

export function overview(records: AttendanceRecord[]): AttendanceOverview {
  const counted = records.filter(isCounted);
  return {
    totalRecords: records.length,
    countedRecords: counted.length,
    lateCount: counted.filter(r => r.issue === 'LATE').length,
    emptyClassCount: counted.filter(r => r.issue === 'EMPTY_CLASS').length,
    teachersInvolved: new Set(counted.map(r => r.teacherId).filter(Boolean)).size,
    totalMinutes: counted
      .filter(r => TIMED_ISSUES.includes(r.issue))
      .reduce((sum, r) => sum + (r.minutes ?? 0), 0),
  };
}

/**
 * Share of teaching staff with no counted entry in the period.
 *
 * Deliberately *not* a percentage of periods taught: the app has no timetable,
 * so the denominator would be invented. "94% giáo viên không có ghi nhận nào"
 * is a claim the data actually supports; "94% số tiết đúng giờ" is not.
 *
 * Returns null when there are no teaching staff to measure, so the caller shows
 * "chưa có dữ liệu" rather than a meaningless 100%.
 */
export function punctualityRate(
  records: AttendanceRecord[],
  teachingStaffCount: number
): number | null {
  if (teachingStaffCount <= 0) return null;

  const flagged = new Set(
    records.filter(isCounted).map(r => r.teacherId).filter((id): id is string => !!id)
  );
  const clean = Math.max(0, teachingStaffCount - flagged.size);
  return Math.round((clean / teachingStaffCount) * 100);
}
