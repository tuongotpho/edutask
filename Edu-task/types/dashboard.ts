/**
 * The principal's operations screen, modelled as a registry rather than a page.
 *
 * The target is a "mission control" view — one screen that answers *how is the
 * school running right now*. That list of indicators is long, spans modules that
 * do not exist yet, and will keep growing. Hardcoding tiles into a component
 * would mean every new indicator edits the same file, and — worse — that a tile
 * whose data source is missing quietly renders a zero that looks like real
 * information.
 *
 * So each indicator is a declaration: what it is called, which area it belongs
 * to, and how to compute it. An indicator whose module has not been built yet
 * declares `resolve: null` and renders as "chưa có dữ liệu" with the reason.
 * The dashboard therefore doubles as an honest roadmap: the principal can see
 * what the system will eventually tell them, and can never mistake a
 * placeholder for a measurement.
 *
 * The resolver signature is the other half of the design. Every indicator is a
 * pure function of a context bag, so when one school's data outgrows
 * "subscribe to the whole collection and count in the browser", a resolver can
 * be swapped for a read of a server-maintained aggregate without any UI change.
 */

import { LeaveRequest } from './leave';
import { Task } from './task';
import { User } from './user';
import { AttendanceRecord } from './attendance';
import { RoomBooking } from './booking';
import { MakeupClass } from './makeup';
import { Meeting } from './meeting';
import { Plan } from './plan';
import { ClassGroup, Room } from './schedule';
import { ClassAttendance, ConductRecord, Student } from './student';
import { Equipment, EquipmentLoan } from './equipment';

export type MetricGroup =
  | 'STAFF'
  | 'WORK'
  | 'PROFESSIONAL'
  | 'STUDENT'
  | 'FACILITY'
  | 'OPERATION';

export const METRIC_GROUP_LABELS: Record<MetricGroup, string> = {
  STAFF: 'Nhân sự',
  WORK: 'Công việc',
  PROFESSIONAL: 'Chuyên môn',
  STUDENT: 'Học sinh',
  FACILITY: 'Cơ sở vật chất',
  OPERATION: 'Điều hành',
};

export const METRIC_GROUP_ORDER: MetricGroup[] = [
  'STAFF',
  'WORK',
  'PROFESSIONAL',
  'STUDENT',
  'FACILITY',
  'OPERATION',
];

/**
 * The status dot. Tone is a property of the *reading*, not of the indicator:
 * "0 việc quá hạn" is green and "12 việc quá hạn" is red, so resolvers decide.
 */
export type MetricTone = 'CRITICAL' | 'WARNING' | 'INFO' | 'GOOD' | 'NEUTRAL';

export type MetricUnit = 'COUNT' | 'PERCENT';

export type MetricOutcome =
  | {
      state: 'READY';
      value: number;
      unit: MetricUnit;
      tone: MetricTone;
      /** One short line under the number, e.g. "3 tổ bị ảnh hưởng". */
      detail?: string;
    }
  /**
   * Source exists and is working; there is genuinely nothing to report.
   *
   * `zeroIsMeaningful` separates two very different empties. For a count, zero
   * IS the reading and good news — "0 việc quá hạn". For a rate, zero is not a
   * reading at all: there was no denominator. Rendering "0" next to "Tiến độ kế
   * hoạch năm học" would be read as 0% progress and send someone into a meeting
   * with a false alarm, so rates fall back to "—" unless a resolver says
   * otherwise.
   */
  | { state: 'EMPTY'; note: string; zeroIsMeaningful?: boolean }
  /** The module that would feed this indicator has not been built. */
  | { state: 'NOT_AVAILABLE'; note: string };

/**
 * Everything a resolver may read. Fields arrive as their modules land; a
 * resolver must treat a missing array as "module not deployed" rather than as
 * an empty result, which is why they are optional.
 */
export interface MetricContext {
  /**
   * `YYYY-MM-DD` in local time — compare this against dates a human picked
   * (leave start/end, booking dates), which are stored as local calendar days.
   */
  today: string;
  /**
   * The same day expressed in UTC — compare this against record timestamps
   * (`createdAt` / `updatedAt`), which the app writes with `toISOString()` and
   * are therefore UTC. Mixing the two undercounts anything that happened
   * before 07:00 local. Both are passed in rather than read from the clock so
   * resolvers stay testable.
   */
  todayUtc: string;
  now: Date;
  users: User[];
  leaves: LeaveRequest[];
  tasks: Task[];
  attendance: AttendanceRecord[];
  bookings: RoomBooking[];
  makeups: MakeupClass[];
  meetings: Meeting[];
  plans: Plan[];
  rooms: Room[];
  equipment: Equipment[];
  loans: EquipmentLoan[];
  classes: ClassGroup[];
  students: Student[];
  studentAttendance: ClassAttendance[];
  conduct: ConductRecord[];
}

export interface MetricDefinition {
  key: string;
  label: string;
  group: MetricGroup;
  /**
   * `null` means "declared but not implemented" — the indicator still appears
   * on the dashboard, greyed, with `plannedNote` explaining what it is waiting
   * for. This is what keeps the roadmap visible instead of invisible.
   */
  resolve: ((ctx: MetricContext) => MetricOutcome) | null;
  /** Required when `resolve` is null: what has to exist before this can work. */
  plannedNote?: string;
  /** Tab slug to open when the tile is clicked, if the detail lives somewhere. */
  linkTab?: string;
}
