import { describe, it, expect } from 'vitest';
import {
  METRIC_DEFINITIONS,
  buildMetricContext,
  metricCoverage,
  metricsByGroup,
  resolveMetric,
} from '@/Edu-task/lib/dashboardMetrics';
import { MetricContext, MetricDefinition } from '@/Edu-task/types/dashboard';
import { AttendanceRecord } from '@/Edu-task/types/attendance';
import { RoomBooking } from '@/Edu-task/types/booking';
import { MakeupClass } from '@/Edu-task/types/makeup';
import { Meeting } from '@/Edu-task/types/meeting';
import { Plan } from '@/Edu-task/types/plan';
import { Room } from '@/Edu-task/types/schedule';
import { User } from '@/Edu-task/types/user';

const TODAY = '2026-08-10';
const NOW = new Date('2026-08-10T05:00:00Z');

function emptyContext(over: Partial<MetricContext> = {}): MetricContext {
  return buildMetricContext({
    users: [], leaves: [], tasks: [],
    attendance: [], bookings: [], makeups: [], meetings: [], plans: [], rooms: [],
    equipment: [], loans: [],
    classes: [], students: [], studentAttendance: [], conduct: [],
    now: NOW,
    ...over,
  });
}

function find(key: string): MetricDefinition {
  const definition = METRIC_DEFINITIONS.find(m => m.key === key);
  if (!definition) throw new Error(`No metric "${key}"`);
  return definition;
}

function user(over: Partial<User> = {}): User {
  return {
    id: 'U1', fullName: 'GV A', email: 'a@x.vn',
    departmentId: 'D1', departmentName: 'Tổ Toán',
    roles: ['TEACHER'], activeRole: 'TEACHER',
    isTeachingStaff: true, status: 'ACTIVE',
    ...over,
  };
}

function attendance(over: Partial<AttendanceRecord> = {}): AttendanceRecord {
  return {
    id: 'A1', schoolId: 'S', code: 'NN-1',
    slot: { date: TODAY, session: 'MORNING', period: 1 },
    classId: 'C1', className: '10A1',
    teacherId: 'U1', teacherName: 'GV A',
    issue: 'LATE', minutes: 5,
    recordedById: 'SUP', recordedByName: 'Giám thị',
    status: 'RECORDED',
    createdAt: '', updatedAt: '',
    ...over,
  };
}

function booking(over: Partial<RoomBooking> = {}): RoomBooking {
  return {
    id: 'B1', schoolId: 'S', code: 'DP-1',
    roomId: 'R1', roomName: 'Phòng 1',
    requesterId: 'U1', requesterName: 'GV A',
    departmentId: 'D1', departmentName: 'Tổ Toán',
    slot: { date: TODAY, session: 'MORNING', period: 1 },
    purpose: 'PRACTICAL', status: 'CONFIRMED', history: [],
    createdAt: '', updatedAt: '',
    ...over,
  };
}

function makeup(over: Partial<MakeupClass> = {}): MakeupClass {
  return {
    id: 'M1', schoolId: 'S', code: 'DB-1',
    teacherId: 'U1', teacherName: 'GV A',
    departmentId: 'D1', departmentName: 'Tổ Toán',
    classId: 'C1', className: '10A1',
    missedSlot: { date: TODAY, session: 'MORNING', period: 1 },
    reason: 'LEAVE',
    makeupSlot: { date: TODAY, session: 'AFTERNOON', period: 1 },
    status: 'APPROVED', steps: [], currentStepIndex: 0, history: [],
    createdAt: '', updatedAt: '',
    ...over,
  };
}

function meeting(over: Partial<Meeting> = {}): Meeting {
  return {
    id: 'MT1', schoolId: 'S', code: 'CH-1',
    title: 'Họp', kind: 'STAFF', date: TODAY, startTime: '14:00',
    scope: 'ALL_STAFF', participants: [], participantIds: [],
    secretaryId: 'SEC', secretaryName: 'Văn thư',
    status: 'COMPLETED',
    createdAt: '', updatedAt: '',
    ...over,
  };
}

function plan(over: Partial<Plan> = {}): Plan {
  return {
    id: 'P1', schoolId: 'S', code: 'KH-1',
    title: 'Kế hoạch', scope: 'SCHOOL',
    startDate: '2026-08-01', endDate: '2027-05-31',
    milestones: [], ownerId: 'U1', ownerName: 'HT',
    isArchived: false,
    createdAt: '', updatedAt: '',
    ...over,
  };
}

const ROOM: Room = {
  id: 'R1', schoolId: 'S', name: 'Phòng 1', code: 'P1',
  kind: 'LAB_CHEMISTRY', requiresApproval: false, isActive: true,
};

describe('the registry contract', () => {
  it('gives every metric a unique key', () => {
    const keys = METRIC_DEFINITIONS.map(m => m.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('makes every unimplemented metric explain itself', () => {
    // A greyed tile with no reason is indistinguishable from a broken one.
    for (const definition of METRIC_DEFINITIONS.filter(m => !m.resolve)) {
      expect(definition.plannedNote, `${definition.key} has no plannedNote`).toBeTruthy();
    }
  });

  it('assigns every metric to a known group', () => {
    const grouped = METRIC_DEFINITIONS.filter(m =>
      metricsByGroup(m.group).some(other => other.key === m.key)
    );
    expect(grouped).toHaveLength(METRIC_DEFINITIONS.length);
  });

  it('reports coverage honestly', () => {
    const coverage = metricCoverage();
    expect(coverage.ready).toBe(METRIC_DEFINITIONS.filter(m => m.resolve).length);
    expect(coverage.total).toBe(METRIC_DEFINITIONS.length);
    expect(coverage.ready).toBeLessThan(coverage.total);
  });
});

describe('resolveMetric', () => {
  it('reports an unimplemented metric as unavailable, never as zero', () => {
    const outcome = resolveMetric(find('staff.teaching_now'), emptyContext());
    expect(outcome.state).toBe('NOT_AVAILABLE');
  });

  it('survives a resolver that throws instead of blanking the screen', () => {
    const broken: MetricDefinition = {
      key: 'test.broken', label: 'Hỏng', group: 'OPERATION',
      resolve: () => { throw new Error('boom'); },
    };
    expect(resolveMetric(broken, emptyContext()).state).toBe('NOT_AVAILABLE');
  });
});

describe('buildMetricContext', () => {
  it('derives both the local and the UTC day', () => {
    // Timestamps are written with toISOString(); dates people pick are local.
    // Conflating them undercounts anything before 07:00 local.
    const ctx = buildMetricContext({
      users: [], leaves: [], tasks: [], attendance: [], bookings: [],
      makeups: [], meetings: [], plans: [], rooms: [], equipment: [], loans: [],
      classes: [], students: [], studentAttendance: [], conduct: [],
      now: new Date('2026-08-10T05:00:00Z'),
    });
    expect(ctx.todayUtc).toBe('2026-08-10');
    expect(ctx.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('staff metrics', () => {
  it('counts late arrivals recorded today and totals the minutes', () => {
    const ctx = emptyContext({
      attendance: [
        attendance({ id: 'a', minutes: 5 }),
        attendance({ id: 'b', minutes: 10, teacherId: 'U2' }),
        attendance({ id: 'c', slot: { date: '2026-08-09', session: 'MORNING', period: 1 } }),
      ],
    });
    const outcome = resolveMetric(find('staff.late_today'), ctx);
    expect(outcome).toMatchObject({ state: 'READY', value: 2 });
    if (outcome.state === 'READY') expect(outcome.detail).toContain('15');
  });

  it('does not count an excused record against the school', () => {
    const ctx = emptyContext({ attendance: [attendance({ status: 'EXCUSED' })] });
    expect(resolveMetric(find('staff.late_today'), ctx).state).toBe('EMPTY');
  });

  it('states the denominator on the punctuality tile', () => {
    // Without it, "95%" reads as "% of periods", which the data cannot support.
    const ctx = emptyContext({
      users: [user({ id: 'U1' }), user({ id: 'U2' })],
      attendance: [attendance({ teacherId: 'U1' })],
    });
    const outcome = resolveMetric(find('staff.punctuality_rate'), ctx);
    expect(outcome).toMatchObject({ state: 'READY', value: 50 });
    if (outcome.state === 'READY') expect(outcome.detail).toContain('2 giáo viên');
  });
});

describe('facility metrics', () => {
  it('counts a room as busy whether held by a booking or a make-up lesson', () => {
    // Counting only bookings would understate usage and make the tile lie.
    const ctx = emptyContext({
      rooms: [ROOM, { ...ROOM, id: 'R2', code: 'P2' }],
      bookings: [booking({ roomId: 'R1' })],
      makeups: [makeup({ roomId: 'R2' })],
    });
    expect(resolveMetric(find('facility.rooms_booked_today'), ctx)).toMatchObject({
      state: 'READY', value: 2,
    });
  });

  it('does not double-count one room held twice', () => {
    const ctx = emptyContext({
      rooms: [ROOM],
      bookings: [booking({ id: 'b1', roomId: 'R1' })],
      makeups: [makeup({ roomId: 'R1' })],
    });
    expect(resolveMetric(find('facility.rooms_booked_today'), ctx)).toMatchObject({
      state: 'READY', value: 1,
    });
  });

  it('ignores a cancelled booking', () => {
    const ctx = emptyContext({ rooms: [ROOM], bookings: [booking({ status: 'CANCELLED' })] });
    expect(resolveMetric(find('facility.rooms_booked_today'), ctx).state).toBe('EMPTY');
  });

  it('distinguishes "no rooms configured" from "no rooms booked"', () => {
    const noRooms = resolveMetric(find('facility.rooms_booked_today'), emptyContext());
    const noBookings = resolveMetric(find('facility.rooms_booked_today'), emptyContext({ rooms: [ROOM] }));
    expect(noRooms.state).toBe('EMPTY');
    expect(noBookings.state).toBe('EMPTY');
    if (noRooms.state === 'EMPTY' && noBookings.state === 'EMPTY') {
      expect(noRooms.note).not.toBe(noBookings.note);
    }
  });
});

describe('professional metrics', () => {
  it('counts held meetings with no minutes written', () => {
    const ctx = emptyContext({
      meetings: [
        meeting({ id: 'a', status: 'COMPLETED' }),
        meeting({ id: 'b', status: 'SCHEDULED' }),
      ],
    });
    expect(resolveMetric(find('professional.minutes_outstanding'), ctx)).toMatchObject({
      state: 'READY', value: 1,
    });
  });
});

describe('operation metrics', () => {
  it('measures the year plan by milestones delivered', () => {
    const ctx = emptyContext({
      plans: [
        plan({
          scope: 'SCHOOL',
          milestones: [
            { id: 'm1', title: 'A', dueDate: '2026-09-01', status: 'DONE' },
            { id: 'm2', title: 'B', dueDate: '2026-10-01', status: 'PENDING' },
            { id: 'm3', title: 'C', dueDate: '2026-11-01', status: 'PENDING' },
            { id: 'm4', title: 'D', dueDate: '2026-12-01', status: 'PENDING' },
          ],
        }),
      ],
    });
    expect(resolveMetric(find('operation.year_plan_progress'), ctx)).toMatchObject({
      state: 'READY', value: 25,
    });
  });

  it('reports a plan with no milestones as unmeasured, not complete', () => {
    const ctx = emptyContext({ plans: [plan({ scope: 'SCHOOL', milestones: [] })] });
    expect(resolveMetric(find('operation.year_plan_progress'), ctx).state).toBe('EMPTY');
  });

  it('keeps school and department plan progress apart', () => {
    const ctx = emptyContext({
      plans: [
        plan({ id: 'school', scope: 'SCHOOL', milestones: [{ id: 'a', title: 'A', dueDate: '2026-09-01', status: 'DONE' }] }),
        plan({ id: 'dept', scope: 'DEPARTMENT', milestones: [{ id: 'b', title: 'B', dueDate: '2026-09-01', status: 'PENDING' }] }),
      ],
    });
    expect(resolveMetric(find('operation.year_plan_progress'), ctx)).toMatchObject({ value: 100 });
    expect(resolveMetric(find('professional.dept_plan_progress'), ctx)).toMatchObject({ value: 0 });
  });

  it('counts overdue milestones across every plan', () => {
    const ctx = emptyContext({
      plans: [
        plan({ id: 'a', milestones: [{ id: 'm', title: 'Trễ', dueDate: '2026-08-01', status: 'PENDING' }] }),
        plan({ id: 'b', scope: 'DEPARTMENT', milestones: [{ id: 'n', title: 'Trễ 2', dueDate: '2026-08-02', status: 'PENDING' }] }),
      ],
    });
    expect(resolveMetric(find('operation.plan_milestones_overdue'), ctx)).toMatchObject({
      state: 'READY', value: 2, tone: 'WARNING',
    });
  });
});

describe('tone follows the reading, not the metric', () => {
  it('turns a count green when there is nothing to report', () => {
    // "0 việc quá hạn" is good news; the same tile with 12 is not.
    expect(resolveMetric(find('work.overdue'), emptyContext()).state).toBe('EMPTY');
  });
});

describe('an empty count and an unmeasured rate are different things', () => {
  it.each([
    ['work.overdue'],
    ['staff.on_leave_today'],
    ['facility.bookings_pending'],
    ['professional.minutes_outstanding'],
  ])('marks zero as a genuine reading for the count %s', key => {
    const outcome = resolveMetric(find(key), emptyContext());
    expect(outcome.state).toBe('EMPTY');
    if (outcome.state === 'EMPTY') expect(outcome.zeroIsMeaningful).toBe(true);
  });

  it.each([
    ['operation.year_plan_progress'],
    ['professional.dept_plan_progress'],
    ['operation.on_time_rate'],
  ])('does NOT claim zero is a reading for the rate %s', key => {
    // Rendering "0" beside "Tiến độ kế hoạch năm học" reads as 0% progress and
    // would send someone into a meeting with a false alarm. The tile must show
    // a dash instead.
    const outcome = resolveMetric(find(key), emptyContext());
    expect(outcome.state).toBe('EMPTY');
    if (outcome.state === 'EMPTY') expect(outcome.zeroIsMeaningful).not.toBe(true);
  });

  it('reports a real rate of 0% as a reading, not as missing data', () => {
    // A plan with milestones, none done, genuinely IS 0% — and must say so.
    const ctx = emptyContext({
      plans: [plan({ scope: 'SCHOOL', milestones: [{ id: 'm', title: 'A', dueDate: '2026-09-01', status: 'PENDING' }] })],
    });
    expect(resolveMetric(find('operation.year_plan_progress'), ctx)).toMatchObject({
      state: 'READY', value: 0, tone: 'CRITICAL',
    });
  });
});
