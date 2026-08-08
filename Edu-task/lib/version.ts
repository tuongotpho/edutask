/**
 * Date-encoded app version.
 *
 * The number IS the build date: two digits of year, then month, then day, with
 * no separators and no leading zeros — `2687` means 2026, tháng 8, ngày 7. The
 * point is that anyone reading "ver 2687" in the footer, or in a screenshot
 * attached to a bug report, knows immediately which build they are looking at
 * without a changelog to cross-reference.
 *
 * Computed at build time in `next.config.ts` and injected as an env var, so it
 * tracks the actual release rather than a constant someone has to remember to
 * bump.
 *
 * KNOWN AMBIGUITY: dropping the leading zeros makes a handful of dates read two
 * ways — `26112` is both 2026-01-12 and 2026-11-02. Zero-padding to `260112` /
 * `261102` would remove it at the cost of two characters. Left unpadded because
 * that is the requested format; switch `formatDateVersion` below if the
 * ambiguity ever bites.
 */

/** `2026-08-07` → `2687`. Year is the last two digits; month and day unpadded. */
export function formatDateVersion(date: Date): string {
  const year = date.getFullYear() % 100;
  return `${year}${date.getMonth() + 1}${date.getDate()}`;
}

/**
 * Falls back to today only in the odd case where the build-time value is
 * missing (a bare `next dev` started outside the project config). A wrong-but-
 * plausible date beats an empty footer.
 */
export const APP_VERSION: string =
  process.env.NEXT_PUBLIC_APP_VERSION || formatDateVersion(new Date());

/** `2687` → `07/08/2026`, for a tooltip that spells the date out. */
export function describeVersion(version: string = APP_VERSION): string {
  const match = /^(\d{2})(\d{1,2})(\d{1,2})$/.exec(version);
  if (!match) return version;
  const [, yy, m, d] = match;
  return `Bản phát hành ngày ${d.padStart(2, '0')}/${m.padStart(2, '0')}/20${yy}`;
}
