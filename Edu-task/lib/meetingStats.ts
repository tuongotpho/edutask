import {
  AttendanceMark,
  Meeting,
  MeetingParticipant,
  PENALISED_MARKS,
} from '@/Edu-task/types/meeting';

/**
 * Meeting attendance, rolled up the way a monthly thi đua review needs it.
 *
 * The judgement encoded here is what "counts": arriving late and being absent
 * without leave do; being absent WITH leave does not. Someone who filed an
 * approved absence has already accounted for themselves, and counting it again
 * would punish them twice for the same event.
 */

export function monthOfMeeting(meeting: Meeting): string {
  return (meeting.date ?? '').slice(0, 7);
}

export function meetingsInMonth(meetings: Meeting[], month: string): Meeting[] {
  return meetings.filter(m => monthOfMeeting(m) === month);
}

/** Only a meeting that actually happened tells us anything about attendance. */
export function heldMeetings(meetings: Meeting[]): Meeting[] {
  return meetings.filter(m => m.status === 'COMPLETED');
}

export interface MeetingRollSummary {
  total: number;
  present: number;
  late: number;
  excused: number;
  absent: number;
  /** Nobody has called the roll for these yet. */
  unmarked: number;
  totalMinutesLate: number;
}

export function summariseRoll(participants: MeetingParticipant[]): MeetingRollSummary {
  const count = (mark: AttendanceMark) => participants.filter(p => p.mark === mark).length;
  return {
    total: participants.length,
    present: count('PRESENT'),
    late: count('LATE'),
    excused: count('EXCUSED'),
    absent: count('ABSENT'),
    unmarked: participants.filter(p => !p.mark).length,
    totalMinutesLate: participants
      .filter(p => p.mark === 'LATE')
      .reduce((sum, p) => sum + (p.minutesLate ?? 0), 0),
  };
}

/** A held meeting whose minutes were never written up. */
export function isMinutesOutstanding(meeting: Meeting): boolean {
  return meeting.status === 'COMPLETED' && !meeting.minutes;
}

export interface PersonMeetingSummary {
  userId: string;
  userName: string;
  departmentName: string;
  meetingsCalled: number;
  lateCount: number;
  absentCount: number;
  excusedCount: number;
  totalMinutesLate: number;
  /** Late or absent without leave, over meetings actually held. */
  penalisedCount: number;
}

/**
 * Per-person totals across held meetings, worst first.
 *
 * Only `COMPLETED` meetings are counted: a scheduled meeting has no attendance
 * yet, and a cancelled one must not leave anyone marked absent for a meeting
 * that never took place.
 */
export function summariseByPerson(meetings: Meeting[]): PersonMeetingSummary[] {
  const byPerson = new Map<string, PersonMeetingSummary>();

  for (const meeting of heldMeetings(meetings)) {
    for (const participant of meeting.participants) {
      const entry = byPerson.get(participant.userId) ?? {
        userId: participant.userId,
        userName: participant.userName,
        departmentName: participant.departmentName,
        meetingsCalled: 0,
        lateCount: 0,
        absentCount: 0,
        excusedCount: 0,
        totalMinutesLate: 0,
        penalisedCount: 0,
      };

      entry.meetingsCalled += 1;

      switch (participant.mark) {
        case 'LATE':
          entry.lateCount += 1;
          entry.totalMinutesLate += participant.minutesLate ?? 0;
          break;
        case 'ABSENT':
          entry.absentCount += 1;
          break;
        case 'EXCUSED':
          entry.excusedCount += 1;
          break;
        default:
          break;
      }

      if (participant.mark && PENALISED_MARKS.includes(participant.mark)) {
        entry.penalisedCount += 1;
      }

      byPerson.set(participant.userId, entry);
    }
  }

  return Array.from(byPerson.values()).sort(
    (a, b) =>
      b.penalisedCount - a.penalisedCount ||
      b.totalMinutesLate - a.totalMinutesLate ||
      a.userName.localeCompare(b.userName, 'vi')
  );
}

/**
 * Share of called-for seats that were filled on time, across held meetings.
 *
 * Unlike the corridor punctuality figure, this one has a real denominator —
 * every participant of every held meeting — so it can be stated as a rate
 * without inventing anything. Unmarked seats are excluded: a roll nobody
 * called is missing data, not good news.
 *
 * Returns null when nothing has been marked yet.
 */
export function meetingPunctualityRate(meetings: Meeting[]): number | null {
  let marked = 0;
  let onTime = 0;

  for (const meeting of heldMeetings(meetings)) {
    for (const participant of meeting.participants) {
      if (!participant.mark) continue;
      marked += 1;
      // Approved absence is neither punctual nor a failing — it is excluded
      // from both sides rather than counted as on time.
      if (participant.mark === 'PRESENT') onTime += 1;
      if (participant.mark === 'EXCUSED') marked -= 1;
    }
  }

  if (marked <= 0) return null;
  return Math.round((onTime / marked) * 100);
}
