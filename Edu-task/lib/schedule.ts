import {
  ClassGroup,
  PeriodConfig,
  PeriodSlot,
  PeriodTime,
  Room,
  SCHOOL_SESSIONS,
  SCHOOL_SESSION_LABELS,
  SchoolSession,
} from '@/Edu-task/types/schedule';

/**
 * Pure timetable helpers. Kept free of React and Firebase so the conflict rules
 * that depend on them stay unit-testable — the same reason `leaveConflict.ts`
 * was split out of `useLeaveLogic`.
 *
 * Dates are handled as `YYYY-MM-DD` strings throughout and parsed as UTC. Going
 * through the local-time `Date` constructor would shift the day backwards for
 * anyone west of Greenwich, which is exactly the class of bug that makes a
 * booking silently land on the wrong date.
 */

export function periodKey(session: SchoolSession, period: number): string {
  return `${session}-${period}`;
}

export function slotKey(slot: PeriodSlot): string {
  return `${slot.date}|${slot.session}|${slot.period}`;
}

export function sameSlot(a: PeriodSlot, b: PeriodSlot): boolean {
  return a.date === b.date && a.session === b.session && a.period === b.period;
}

/** How many periods this session runs. Guards against a corrupt/blank config. */
export function periodCount(config: PeriodConfig, session: SchoolSession): number {
  const raw = session === 'MORNING' ? config.morningPeriods : config.afternoonPeriods;
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
}

/** `[1, 2, 3, …]` for the session. */
export function listPeriods(config: PeriodConfig, session: SchoolSession): number[] {
  return Array.from({ length: periodCount(config, session) }, (_, i) => i + 1);
}

/** Every (session, period) pair the school runs, in chronological order. */
export function listAllPeriods(config: PeriodConfig): Array<{ session: SchoolSession; period: number }> {
  return SCHOOL_SESSIONS.flatMap(session =>
    listPeriods(config, session).map(period => ({ session, period }))
  );
}

export function isValidPeriod(config: PeriodConfig, session: SchoolSession, period: number): boolean {
  return Number.isInteger(period) && period >= 1 && period <= periodCount(config, session);
}

export function periodTime(
  config: PeriodConfig,
  session: SchoolSession,
  period: number
): PeriodTime | null {
  return config.times?.[periodKey(session, period)] ?? null;
}

// --- Labels ----------------------------------------------------------------

export function formatPeriod(session: SchoolSession, period: number): string {
  return `Tiết ${period} ${SCHOOL_SESSION_LABELS[session].toLowerCase()}`;
}

/** "Tiết 2 sáng (07:50–08:35)" when times are configured, otherwise just the period. */
export function formatPeriodWithTime(
  config: PeriodConfig,
  session: SchoolSession,
  period: number
): string {
  const time = periodTime(config, session, period);
  const base = formatPeriod(session, period);
  return time ? `${base} (${time.start}–${time.end})` : base;
}

const WEEKDAY_LABELS = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

/** Parses `YYYY-MM-DD` as UTC midnight; returns null for anything malformed. */
export function parseDate(date: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date ?? '');
  if (!match) return null;
  const [, y, m, d] = match;
  const parsed = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  // Rejects impossible dates like 2026-02-31, which Date would roll forward.
  if (parsed.getUTCMonth() !== Number(m) - 1 || parsed.getUTCDate() !== Number(d)) return null;
  return parsed;
}

export function weekdayLabel(date: string): string {
  const parsed = parseDate(date);
  return parsed ? WEEKDAY_LABELS[parsed.getUTCDay()] : '';
}

/** True if date falls on a weekend (Saturday or Sunday UTC). */
export function isWeekend(date: string): boolean {
  const parsed = parseDate(date);
  if (!parsed) return false;
  const day = parsed.getUTCDay();
  return day === 0 || day === 6;
}

/** True if date falls on Sunday. */
export function isSunday(date: string): boolean {
  const parsed = parseDate(date);
  return parsed ? parsed.getUTCDay() === 0 : false;
}

/** `2026-08-10` → `10/08/2026`. Returns the input unchanged if unparseable. */
export function formatDateVi(date: string): string {
  const parsed = parseDate(date);
  if (!parsed) return date ?? '';
  const dd = String(parsed.getUTCDate()).padStart(2, '0');
  const mm = String(parsed.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${parsed.getUTCFullYear()}`;
}

/** "Tiết 2 sáng · Thứ Hai 10/08/2026" — the standard one-line slot label. */
export function formatSlot(slot: PeriodSlot): string {
  const day = weekdayLabel(slot.date);
  const date = formatDateVi(slot.date);
  return `${formatPeriod(slot.session, slot.period)} · ${day ? `${day} ` : ''}${date}`;
}

// --- Ordering --------------------------------------------------------------

export function compareSlots(a: PeriodSlot, b: PeriodSlot): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.session !== b.session) return a.session === 'MORNING' ? -1 : 1;
  return a.period - b.period;
}

// --- "What is on right now" ------------------------------------------------

/** Local `YYYY-MM-DD` for a Date — used for "today", so local time is correct here. */
export function toDateString(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function minutesOfDay(time: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time ?? '');
  if (!match) return null;
  const hours = Number(match[1]);
  const mins = Number(match[2]);
  if (hours > 23 || mins > 59) return null;
  return hours * 60 + mins;
}

/**
 * The period happening at `now`, or the next one to start today.
 *
 * This is what pre-fills the supervisor's quick-entry form: they open the app
 * mid-lesson, and having to pick the period by hand every time is exactly the
 * friction that makes people stop using a tool. Returns null outside school
 * hours (after the last period, or with no times configured) so the caller can
 * ask rather than guess wrong.
 */
export function currentPeriod(
  config: PeriodConfig,
  now: Date = new Date()
): { session: SchoolSession; period: number } | null {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  let upcoming: { session: SchoolSession; period: number; start: number } | null = null;

  for (const { session, period } of listAllPeriods(config)) {
    const time = periodTime(config, session, period);
    if (!time) continue;
    const start = minutesOfDay(time.start);
    const end = minutesOfDay(time.end);
    if (start === null || end === null) continue;

    if (nowMinutes >= start && nowMinutes <= end) return { session, period };
    if (nowMinutes < start && (!upcoming || start < upcoming.start)) {
      upcoming = { session, period, start };
    }
  }

  return upcoming ? { session: upcoming.session, period: upcoming.period } : null;
}

// --- Catalog lookups -------------------------------------------------------

/** Active rooms first, then by kind and name — the order every picker wants. */
export function sortRooms(rooms: Room[]): Room[] {
  return [...rooms].sort(
    (a, b) =>
      Number(b.isActive) - Number(a.isActive) ||
      a.kind.localeCompare(b.kind) ||
      a.name.localeCompare(b.name, 'vi')
  );
}

/** By khối, then by class name, so 10A1 … 10A9, 11A1 … reads naturally. */
export function sortClasses(classes: ClassGroup[]): ClassGroup[] {
  return [...classes].sort(
    (a, b) =>
      Number(b.isActive) - Number(a.isActive) ||
      a.grade - b.grade ||
      a.name.localeCompare(b.name, 'vi', { numeric: true })
  );
}
