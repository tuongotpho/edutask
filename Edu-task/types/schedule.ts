/**
 * The school timetable vocabulary shared by every feature that is finer-grained
 * than a leave request.
 *
 * Leave requests only ever needed a date plus "sáng / chiều / cả ngày", so that
 * is all `LeaveSession` expresses. Make-up classes, room bookings and the
 * supervisor's late-arrival log all happen at a specific *period* of a specific
 * session, so they share the `PeriodSlot` below instead of inventing three
 * incompatible shapes.
 */

export type SchoolSession = 'MORNING' | 'AFTERNOON';

export const SCHOOL_SESSION_LABELS: Record<SchoolSession, string> = {
  MORNING: 'Sáng',
  AFTERNOON: 'Chiều',
};

export const SCHOOL_SESSIONS: SchoolSession[] = ['MORNING', 'AFTERNOON'];

/** A wall-clock range in `HH:mm`, used for labels and "which period is on now". */
export interface PeriodTime {
  start: string;
  end: string;
}

/**
 * How many teaching periods this school runs, and when they are.
 *
 * Period numbers restart each session — "tiết 1 chiều" is a different slot from
 * "tiết 1 sáng" — which matches how Vietnamese schools actually talk about the
 * timetable, and is why every slot carries its session alongside the number.
 */
export interface PeriodConfig {
  morningPeriods: number;
  afternoonPeriods: number;
  /** Keyed by `periodKey()`, e.g. `MORNING-1`. Missing entries just render without a time. */
  times: Record<string, PeriodTime>;
}

export const DEFAULT_PERIOD_TIMES: Record<string, PeriodTime> = {
  'MORNING-1': { start: '07:00', end: '07:45' },
  'MORNING-2': { start: '07:50', end: '08:35' },
  'MORNING-3': { start: '08:55', end: '09:40' },
  'MORNING-4': { start: '09:45', end: '10:30' },
  'MORNING-5': { start: '10:35', end: '11:20' },
  'AFTERNOON-1': { start: '13:30', end: '14:15' },
  'AFTERNOON-2': { start: '14:20', end: '15:05' },
  'AFTERNOON-3': { start: '15:25', end: '16:10' },
  'AFTERNOON-4': { start: '16:15', end: '17:00' },
  'AFTERNOON-5': { start: '17:05', end: '17:50' },
};

export const DEFAULT_PERIOD_CONFIG: PeriodConfig = {
  morningPeriods: 5,
  afternoonPeriods: 5,
  times: DEFAULT_PERIOD_TIMES,
};

/** One teaching period on one calendar day. */
export interface PeriodSlot {
  /** `YYYY-MM-DD` — the same string format leave requests use. */
  date: string;
  session: SchoolSession;
  /** 1-based within the session. */
  period: number;
}

// --- Rooms -----------------------------------------------------------------

export type RoomKind =
  | 'MULTIPURPOSE'
  | 'LAB_PHYSICS'
  | 'LAB_CHEMISTRY'
  | 'LAB_BIOLOGY'
  | 'COMPUTER'
  | 'LANGUAGE'
  | 'LIBRARY'
  | 'HALL'
  | 'OTHER';

export const ROOM_KIND_LABELS: Record<RoomKind, string> = {
  MULTIPURPOSE: 'Phòng đa năng',
  LAB_PHYSICS: 'Phòng thí nghiệm Vật lý',
  LAB_CHEMISTRY: 'Phòng thí nghiệm Hóa học',
  LAB_BIOLOGY: 'Phòng thí nghiệm Sinh học',
  COMPUTER: 'Phòng máy tính',
  LANGUAGE: 'Phòng ngoại ngữ / nghe nhìn',
  LIBRARY: 'Thư viện',
  HALL: 'Hội trường',
  OTHER: 'Phòng chức năng khác',
};

export const ROOM_KINDS: RoomKind[] = Object.keys(ROOM_KIND_LABELS) as RoomKind[];

export interface Room {
  id: string;
  /** See `lib/tenant.ts` — stamped now so multi-school stays a migration we can do. */
  schoolId: string;
  name: string;
  code: string;
  kind: RoomKind;
  capacity?: number;
  /** Free text, e.g. "Tầng 2, dãy B". */
  location?: string;
  note?: string;
  /**
   * Whether a booking has to be signed off before it counts as confirmed.
   * A shared hall usually does; an ordinary lab usually does not, and making
   * teachers wait for approval on those would just push them back to paper.
   */
  requiresApproval: boolean;
  isActive: boolean;
}

// --- Classes ---------------------------------------------------------------

export interface ClassGroup {
  id: string;
  schoolId: string;
  /** As people say it: "10A1". */
  name: string;
  /** 10, 11, 12 — kept separate from the name so lists can group by khối. */
  grade: number;
  homeroomTeacherId?: string;
  homeroomTeacherName?: string;
  studentCount?: number;
  isActive: boolean;
}
