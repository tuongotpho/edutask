import { describe, it, expect } from 'vitest';
import {
  heldMeetings,
  isMinutesOutstanding,
  meetingPunctualityRate,
  meetingsInMonth,
  monthOfMeeting,
  summariseByPerson,
  summariseRoll,
} from '@/Edu-task/lib/meetingStats';
import { AttendanceMark, Meeting, MeetingParticipant } from '@/Edu-task/types/meeting';

function person(userId: string, mark?: AttendanceMark, minutesLate?: number): MeetingParticipant {
  return { userId, userName: `Người ${userId}`, departmentName: 'Tổ Toán', mark, minutesLate };
}

function meeting(over: Partial<Meeting> = {}): Meeting {
  const participants = over.participants ?? [person('U1', 'PRESENT')];
  return {
    id: 'MTG_1', schoolId: 'S', code: 'CH-2026-001',
    title: 'Họp hội đồng', kind: 'STAFF',
    date: '2026-08-10', startTime: '14:00',
    scope: 'ALL_STAFF',
    participants,
    participantIds: participants.map(p => p.userId),
    secretaryId: 'SEC', secretaryName: 'Văn thư',
    status: 'COMPLETED',
    createdAt: '2026-08-01 08:00', updatedAt: '2026-08-01 08:00',
    ...over,
  };
}

describe('month bucketing', () => {
  it('buckets by the meeting date, not the creation date', () => {
    const m = meeting({ date: '2026-07-30', createdAt: '2026-08-01 08:00' });
    expect(monthOfMeeting(m)).toBe('2026-07');
    expect(meetingsInMonth([m], '2026-08')).toEqual([]);
  });
});

describe('heldMeetings', () => {
  it('counts only meetings that actually happened', () => {
    const all = [
      meeting({ id: 'a', status: 'COMPLETED' }),
      meeting({ id: 'b', status: 'SCHEDULED' }),
      meeting({ id: 'c', status: 'CANCELLED' }),
    ];
    expect(heldMeetings(all).map(m => m.id)).toEqual(['a']);
  });
});

describe('summariseRoll', () => {
  it('counts each mark and the not-yet-called', () => {
    const roll = summariseRoll([
      person('U1', 'PRESENT'),
      person('U2', 'LATE', 10),
      person('U3', 'EXCUSED'),
      person('U4', 'ABSENT'),
      person('U5'),
    ]);
    expect(roll).toEqual({
      total: 5, present: 1, late: 1, excused: 1, absent: 1, unmarked: 1, totalMinutesLate: 10,
    });
  });

  it('sums late minutes only from late people', () => {
    const roll = summariseRoll([person('U1', 'LATE', 5), person('U2', 'ABSENT', 99)]);
    expect(roll.totalMinutesLate).toBe(5);
  });
});

describe('isMinutesOutstanding', () => {
  it('flags a held meeting with no minutes written', () => {
    expect(isMinutesOutstanding(meeting({ status: 'COMPLETED' }))).toBe(true);
  });

  it('does not flag a meeting that has not happened yet', () => {
    expect(isMinutesOutstanding(meeting({ status: 'SCHEDULED' }))).toBe(false);
  });

  it('does not flag one that has minutes', () => {
    const m = meeting({
      minutes: { content: 'Nội dung', finalizedAt: '2026-08-10 16:00', finalizedById: 'SEC', finalizedByName: 'Văn thư' },
    });
    expect(isMinutesOutstanding(m)).toBe(false);
  });
});

describe('summariseByPerson', () => {
  it('accumulates across meetings', () => {
    const rows = summariseByPerson([
      meeting({ id: 'a', participants: [person('U1', 'LATE', 10), person('U2', 'PRESENT')] }),
      meeting({ id: 'b', participants: [person('U1', 'ABSENT'), person('U2', 'PRESENT')] }),
    ]);
    const u1 = rows.find(r => r.userId === 'U1')!;
    expect(u1.meetingsCalled).toBe(2);
    expect(u1.lateCount).toBe(1);
    expect(u1.absentCount).toBe(1);
    expect(u1.totalMinutesLate).toBe(10);
    expect(u1.penalisedCount).toBe(2);
  });

  it('does not penalise approved absence', () => {
    const [row] = summariseByPerson([meeting({ participants: [person('U1', 'EXCUSED')] })]);
    expect(row.excusedCount).toBe(1);
    expect(row.penalisedCount).toBe(0);
  });

  it('ignores meetings that were cancelled', () => {
    // Nobody may be recorded absent from a meeting that never took place.
    const rows = summariseByPerson([
      meeting({ id: 'a', status: 'CANCELLED', participants: [person('U1', 'ABSENT')] }),
    ]);
    expect(rows).toEqual([]);
  });

  it('ignores meetings not yet held', () => {
    const rows = summariseByPerson([
      meeting({ id: 'a', status: 'SCHEDULED', participants: [person('U1')] }),
    ]);
    expect(rows).toEqual([]);
  });

  it('sorts the most penalised first', () => {
    const rows = summariseByPerson([
      meeting({ participants: [person('U1', 'PRESENT'), person('U2', 'ABSENT'), person('U3', 'LATE', 30)] }),
    ]);
    // U2 and U3 both have one penalty; minutes break the tie.
    expect(rows[0].userId).toBe('U3');
    expect(rows[rows.length - 1].userId).toBe('U1');
  });
});

describe('meetingPunctualityRate', () => {
  it('is the share of marked seats that were on time', () => {
    const rows = meetingPunctualityRate([
      meeting({ participants: [person('U1', 'PRESENT'), person('U2', 'PRESENT'), person('U3', 'LATE', 5), person('U4', 'ABSENT')] }),
    ]);
    expect(rows).toBe(50);
  });

  it('excludes approved absence from both sides, not counting it as on time', () => {
    // 1 present + 1 excused → the excused seat is removed entirely, so 1/1.
    expect(meetingPunctualityRate([
      meeting({ participants: [person('U1', 'PRESENT'), person('U2', 'EXCUSED')] }),
    ])).toBe(100);

    // 1 late + 1 excused → 0/1, not 50%.
    expect(meetingPunctualityRate([
      meeting({ participants: [person('U1', 'LATE', 5), person('U2', 'EXCUSED')] }),
    ])).toBe(0);
  });

  it('ignores seats nobody called — missing data is not good news', () => {
    expect(meetingPunctualityRate([
      meeting({ participants: [person('U1', 'PRESENT'), person('U2')] }),
    ])).toBe(100);
  });

  it('returns null when no roll has been called at all', () => {
    expect(meetingPunctualityRate([meeting({ participants: [person('U1')] })])).toBeNull();
    expect(meetingPunctualityRate([])).toBeNull();
  });

  it('returns null when every marked seat was an approved absence', () => {
    // Would otherwise divide by zero and report 0%, implying everyone was late.
    expect(meetingPunctualityRate([
      meeting({ participants: [person('U1', 'EXCUSED')] }),
    ])).toBeNull();
  });
});
