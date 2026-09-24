import { TimeSession } from './timetracker.model';
import { User } from '../user/user.model';
// These sweeps are meant to be invoked by cron (Phase 6), not a live HTTP
// request, so they call sendNotification directly and await it rather than
// the fire-and-forget dispatchNotification used by request-driven triggers
// elsewhere — a batch job should know deterministically that its
// notifications were actually created before it logs/returns, and there's
// no HTTP client waiting on the response that awaiting would slow down.
import { sendNotification } from '../../../helpers/notificationHelper';
import { logger } from '../../../shared/logger';
import { USER_ROLES } from '../../../enum/user';
import { DEFAULT_TIMEZONE, getPreviousLocalDateKey, getUtcRangeForLocalDate } from '../../../helpers/timezoneHelper';

/**
 * Scheduled-check notification triggers (integration plan Phase 3), each a
 * pure, independently callable, idempotent function. They are NOT yet
 * invoked on any schedule — wiring them into cron.service.ts is explicitly
 * Phase 6's job (see the plan: "Implement the scheduled checks needed by
 * Phase 3's threshold triggers"). Building the checker logic itself here,
 * fully tested, means Phase 6 only has to add the cron registration.
 */

const DEFAULT_FORGOT_CLOCK_OUT_THRESHOLD_HOURS = Number(process.env.FORGOT_CLOCK_OUT_THRESHOLD_HOURS) || 12;
const DEFAULT_DAILY_OVERTIME_THRESHOLD_HOURS = Number(process.env.DAILY_OVERTIME_THRESHOLD_HOURS) || 8;

const toDateKey = (date: Date): string => date.toISOString().slice(0, 10); // YYYY-MM-DD

/**
 * Finds TimeSession documents that are still open (active or paused, no
 * endTime) and started more than `thresholdHours` ago, and reminds the
 * employee to clock out.
 *
 * Idempotency is scoped to (session, calendar day of this check) — a
 * session left open across multiple days gets one reminder per day it
 * remains open, not one ever and not one per sweep run.
 */
export const runForgotClockOutSweep = async (
  now: Date = new Date(),
  thresholdHours: number = DEFAULT_FORGOT_CLOCK_OUT_THRESHOLD_HOURS,
): Promise<{ checked: number; notified: number }> => {
  const cutoff = new Date(now.getTime() - thresholdHours * 60 * 60 * 1000);
  const todayKey = toDateKey(now);

  const openSessions = await TimeSession.find({
    status: { $in: ['active', 'paused'] },
    startTime: { $lte: cutoff },
  }).lean();

  await Promise.all(
    openSessions.map(session =>
      sendNotification({
        from: session.user.toString(),
        to: session.user.toString(),
        kind: 'forgotClockOut',
        data: { date: session.date, thresholdHours },
        idempotencyKey: `timesession:${session._id.toString()}:forgotClockOut:${todayKey}`,
      }),
    ),
  );

  logger.info(`attendance:forgot-clock-out-sweep checked=${openSessions.length} notified=${openSessions.length}`);
  return { checked: openSessions.length, notified: openSessions.length };
};

/**
 * Aggregates one company's employees' hours within a UTC instant range and
 * notifies both the employee and the company for anyone over threshold.
 * `dateKey` is the company's *local* calendar date this range represents —
 * used only for the idempotency key, never for querying (queries go by the
 * real `startTime` timestamp, not the UTC-anchored `date` string field —
 * see timezoneHelper.ts for why those two things can disagree).
 *
 * Note: like the existing single-project `getDailySummary` overtime figure
 * (timetracker.service.ts), this sums `totalTime`, which is only
 * incremented on pause/stop (see pauseTimer/stopTimer) — a session
 * that has been running continuously without a pause won't reflect its
 * still-accruing time until it's paused or stopped. This sweep inherits
 * that same pre-existing limitation rather than introducing a second,
 * inconsistent definition of "hours worked."
 *
 * Idempotency is scoped to (user, local date) — re-running the sweep later
 * the same day does not re-notify; a new local day does.
 */
const runDailyOvertimeSweepForCompany = async (
  companyId: string,
  dateKey: string,
  range: { start: Date; end: Date },
  thresholdHours: number,
): Promise<{ checked: number; notified: number }> => {
  const thresholdMs = thresholdHours * 60 * 60 * 1000;

  const companyEmployees = await User.find({ company: companyId, role: USER_ROLES.EMPLOYEES }).select('_id').lean();
  if (companyEmployees.length === 0) return { checked: 0, notified: 0 };
  const employeeIds = companyEmployees.map(e => e._id);

  const perUserTotals = await TimeSession.aggregate<{ _id: string; totalMs: number }>([
    { $match: { user: { $in: employeeIds }, startTime: { $gte: range.start, $lt: range.end } } },
    { $group: { _id: '$user', totalMs: { $sum: '$totalTime' } } },
  ]);

  const overThreshold = perUserTotals.filter(entry => entry.totalMs > thresholdMs);
  let notified = 0;

  for (const entry of overThreshold) {
    const employee = await User.findById(entry._id).select('name').lean();
    // A TimeSession can outlive the user it belongs to (e.g. a deleted
    // account) — nothing to notify, but not an error either.
    if (!employee) continue;

    const hoursWorked = (entry.totalMs / (1000 * 60 * 60)).toFixed(1);
    const employeeName = employee.name || 'An employee';

    await sendNotification({
      from: entry._id.toString(),
      to: entry._id.toString(),
      kind: 'overtimeEmployeeAlert',
      data: { hoursWorked, thresholdHours },
      idempotencyKey: `overtime:${entry._id.toString()}:${dateKey}:employee`,
    });
    notified += 1;

    await sendNotification({
      from: entry._id.toString(),
      to: companyId,
      kind: 'overtimeCompanyAlert',
      data: { employeeName, hoursWorked, thresholdHours },
      idempotencyKey: `overtime:${entry._id.toString()}:${dateKey}:company`,
    });
  }

  return { checked: perUserTotals.length, notified };
};

/**
 * Runs the overtime check for every company, each against its own most
 * recently completed *local* calendar day (per its configured `timezone`,
 * default UTC — see user.interface.ts) — so a company in Tokyo isn't
 * evaluated against a UTC day boundary that doesn't match their actual
 * workday. `targetDateKey`, if given, checks that specific local date for
 * every company instead of auto-computing "yesterday" — mainly useful for
 * tests and manual reprocessing.
 */
export const runDailyOvertimeSweep = async (
  now: Date = new Date(),
  thresholdHours: number = DEFAULT_DAILY_OVERTIME_THRESHOLD_HOURS,
  targetDateKey?: string,
): Promise<{ companiesChecked: number; notified: number }> => {
  const companies = await User.find({ role: USER_ROLES.COMPANY }).select('timezone').lean();
  let notified = 0;

  for (const company of companies) {
    // One company's failure — most plausibly an invalid `timezone` value
    // that somehow bypassed the profile-update validation (isValidTimezone
    // in timezoneHelper.ts) — must not abort the sweep for every other
    // company.
    try {
      const timezone = company.timezone || DEFAULT_TIMEZONE;
      const dateKey = targetDateKey || getPreviousLocalDateKey(timezone, now);
      const range = getUtcRangeForLocalDate(timezone, dateKey, now);
      const result = await runDailyOvertimeSweepForCompany(company._id.toString(), dateKey, range, thresholdHours);
      notified += result.notified;
    } catch (err) {
      logger.error(`attendance:daily-overtime-sweep-company-failed companyId=${company._id.toString()}`, err);
    }
  }

  logger.info(`attendance:daily-overtime-sweep companiesChecked=${companies.length} notified=${notified}`);
  return { companiesChecked: companies.length, notified };
};
