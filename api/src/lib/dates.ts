/**
 * All dates in this app are LOCAL DATES (YYYY-MM-DD strings), never timestamps.
 * The day boundary is `dayStartHour` (default 04:00) so a 1:40am log still
 * belongs to yesterday — which is what you actually mean at 1:40am.
 */

export type LocalDate = string; // "YYYY-MM-DD"

const DAY_MS = 86_400_000;

/** The user's current local date, respecting their 4am day boundary. */
export function todayLocal(tz: string, dayStartHour: number, now = new Date()): LocalDate {
  const shifted = new Date(now.getTime() - dayStartHour * 3_600_000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(shifted);
}

/** Local hour in the user's timezone — drives morning vs evening mode. */
export function localHour(tz: string, now = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "2-digit", hour12: false }).format(now),
  );
}

/** Convert a LocalDate to the UTC-midnight Date that Prisma's @db.Date expects. */
export function toDbDate(d: LocalDate): Date {
  return new Date(`${d}T00:00:00.000Z`);
}

/** Convert back out of Prisma. */
export function fromDbDate(d: Date): LocalDate {
  return d.toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday */
export function dayOfWeek(d: LocalDate): number {
  return new Date(`${d}T00:00:00.000Z`).getUTCDay();
}

export function addDays(d: LocalDate, n: number): LocalDate {
  return new Date(new Date(`${d}T00:00:00.000Z`).getTime() + n * DAY_MS).toISOString().slice(0, 10);
}

export function diffDays(a: LocalDate, b: LocalDate): number {
  return Math.round(
    (new Date(`${a}T00:00:00.000Z`).getTime() - new Date(`${b}T00:00:00.000Z`).getTime()) / DAY_MS,
  );
}

/** Monday of the week containing `d`. */
export function weekStart(d: LocalDate): LocalDate {
  const dow = dayOfWeek(d);
  return addDays(d, -((dow + 6) % 7));
}

export function weekDays(start: LocalDate): LocalDate[] {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function monthStart(d: LocalDate): LocalDate {
  return `${d.slice(0, 7)}-01`;
}

export function monthEnd(d: LocalDate): LocalDate {
  const [y, m] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

export function eachDay(from: LocalDate, to: LocalDate): LocalDate[] {
  const out: LocalDate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export function isValidLocalDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(`${s}T00:00:00.000Z`).getTime());
}

/**
 * Whether a string is an IANA zone this runtime knows. Signup takes the zone
 * from the browser, so it is untrusted input — an unknown one stored here would
 * throw on every later date calculation for that account, not at the point it
 * was accepted.
 */
export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
