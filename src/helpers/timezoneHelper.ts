/**
 * IANA-timezone-aware date boundary helpers, using only the built-in
 * `Intl` API (no new dependency — `date-fns-tz`/`luxon` aren't in this
 * project and weren't worth adding for this alone). Needed because
 * `TimeSession.date` (set at session-start time via
 * `new Date().toISOString().split('T')[0]`) is fundamentally a
 * UTC-anchored calendar date — correct for a UTC-based company, but wrong
 * for e.g. a Tokyo company, where a session that starts at 2am local time
 * lands on the *previous* UTC calendar date. Anything that needs to know
 * "what was this company's local calendar day" — the daily overtime sweep
 * — must derive it from real UTC instants (TimeSession.startTime) plus the
 * company's timezone, not from the stored `date` string.
 */

export const DEFAULT_TIMEZONE = 'UTC';

// `Intl.supportedValuesOf` is real and present at runtime on every Node
// version this project targets, but this project's `tsconfig.json` target
// (es2018) predates the ES2022 lib that declares its type — augmenting
// locally rather than bumping the project-wide compilation target just for
// this one API.
declare global {
  // `declare global { namespace X }` is the only valid TS syntax for
  // augmenting an existing global namespace like `Intl` — there's no
  // ES-module alternative for this specific case, unlike a namespace used
  // to organize ordinary code.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Intl {
    function supportedValuesOf(key: string): string[];
  }
}

// Computed once — Intl.supportedValuesOf('timeZone') allocates a ~400-entry
// array on every call, no reason to redo that per validation.
const VALID_TIMEZONES = new Set(Intl.supportedValuesOf('timeZone'));

/**
 * Whether `timezone` is a real IANA identifier. Used to validate
 * User.timezone at write time — an invalid value stored there would
 * otherwise only surface as a crash inside the overtime sweep's per-company
 * loop at cron-run-time, far from whoever typed it in.
 */
export const isValidTimezone = (timezone: string): boolean => VALID_TIMEZONES.has(timezone);

/**
 * Minutes to ADD to a UTC instant to get local wall-clock time in
 * `timeZone`, at approximately `date` (e.g. -300 for US Eastern in winter).
 * Uses the standard "format as if UTC, diff against the real instant"
 * technique — accurate to the minute, which is all a daily boundary needs.
 */
export const getTimezoneOffsetMinutes = (timeZone: string, date: Date): number => {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = dtf.formatToParts(date).reduce<Record<string, string>>((acc, p) => {
    acc[p.type] = p.value;
    return acc;
  }, {});
  const asUtcMs = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return (asUtcMs - date.getTime()) / 60000;
};

/** The local calendar date (YYYY-MM-DD) `date` falls on in `timeZone`. */
export const getLocalDateKey = (timeZone: string, date: Date): string => {
  // en-CA formats as YYYY-MM-DD directly.
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
};

/**
 * The [start, end) UTC instant range covering local calendar day
 * `localDateKey` (YYYY-MM-DD) in `timeZone`. `referenceInstant` (defaults
 * to the start of that day interpreted as UTC) only needs to be close
 * enough to the target day to get the right DST offset — exact accuracy
 * across a DST transition boundary isn't attempted here.
 */
export const getUtcRangeForLocalDate = (
  timeZone: string,
  localDateKey: string,
  referenceInstant?: Date,
): { start: Date; end: Date } => {
  const [year, month, day] = localDateKey.split('-').map(Number);
  const naiveUtcMidnight = Date.UTC(year, month - 1, day, 0, 0, 0);
  const offsetMinutes = getTimezoneOffsetMinutes(timeZone, referenceInstant || new Date(naiveUtcMidnight));
  const start = new Date(naiveUtcMidnight - offsetMinutes * 60000);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
};

/** The local calendar date immediately before `date` in `timeZone`. */
export const getPreviousLocalDateKey = (timeZone: string, date: Date): string => {
  const todayKey = getLocalDateKey(timeZone, date);
  const { start } = getUtcRangeForLocalDate(timeZone, todayKey, date);
  return getLocalDateKey(timeZone, new Date(start.getTime() - 60000));
};
