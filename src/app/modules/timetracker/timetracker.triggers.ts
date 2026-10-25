import { Types } from 'mongoose';
import { TimeSession } from './timetracker.model';
import { overlapInRange } from './timetracker.service';
import { DailyAllocation } from '../project/dailyAllocation.model';
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
  }).populate('project', 'title').lean();

  await Promise.all(
    openSessions.map(session => {
      const project = session.project as { title?: string } | null
      const projectTitle = typeof project?.title === 'string' ? project.title.trim() : ''
      return sendNotification({
        from: session.user.toString(),
        to: session.user.toString(),
        kind: 'forgotClockOut',
        data: {
          date: session.date,
          thresholdHours,
          ...(projectTitle ? { projectTitle } : {}),
        },
        idempotencyKey: `timesession:${session._id.toString()}:forgotClockOut:${todayKey}`,
      })
    }),
  );

  logger.info(`attendance:forgot-clock-out-sweep checked=${openSessions.length} notified=${openSessions.length}`);
  return { checked: openSessions.length, notified: openSessions.length };
};

/**
 * Notifies an employee and their company when worked time on the company's
 * local day is past the hours planned for that day. `dateKey` is that local
 * calendar date. Queries use the UTC instant range for that day, not the
 * stored session `date` string.
 *
 * Worked time is the overlap inside the range (`overlapInRange`). An open
 * session adds no live tail. Planned hours are the DailyAllocation rows for
 * that employee and date, summed across projects. No plan sends nothing.
 *
 * Idempotency is scoped to (user, local date) — re-running the sweep later
 * the same day does not re-notify; a new local day does.
 */
const runDailyOvertimeSweepForCompany = async (
  companyId: string,
  dateKey: string,
  range: { start: Date; end: Date },
): Promise<{ checked: number; notified: number }> => {
  const companyEmployees = await User.find({ company: companyId, role: USER_ROLES.EMPLOYEES }).select('_id').lean();
  if (companyEmployees.length === 0) return { checked: 0, notified: 0 };
  const employeeIds = companyEmployees.map(e => e._id);

  const sessions = await TimeSession.find({
    user: { $in: employeeIds },
    startTime: { $lt: range.end },
    $or: [
      { endTime: { $gte: range.start } },
      { endTime: null },
      { endTime: { $exists: false } },
    ],
  }).select('user startTime endTime pauses').lean();

  const workMsByUser = new Map<string, number>();
  for (const session of sessions) {
    const overlap = overlapInRange(session, range.start.getTime(), range.end.getTime());
    if (overlap.workMs === 0) continue;
    const userId = session.user.toString();
    workMsByUser.set(userId, (workMsByUser.get(userId) ?? 0) + overlap.workMs);
  }

  const plans = await DailyAllocation.aggregate<{ _id: { toString(): string }; hours: number }>([
    { $match: { company: new Types.ObjectId(companyId), employee: { $in: employeeIds }, date: dateKey } },
    { $group: { _id: '$employee', hours: { $sum: '$hours' } } },
  ]);
  const plannedByUser = new Map(plans.map(row => [row._id.toString(), Number(row.hours) || 0]));

  let notified = 0;
  for (const [userId, workMs] of workMsByUser) {
    const planned = plannedByUser.get(userId) ?? 0;
    const worked = workMs / (1000 * 60 * 60);
    if (!(planned > 0 && worked > planned)) continue;

    const employee = await User.findById(userId).select('name').lean();
    if (!employee) continue;

    const hoursWorked = worked.toFixed(2);
    const plannedHours = planned.toFixed(2);
    const employeeName = employee.name || 'An employee';

    await sendNotification({
      from: userId,
      to: userId,
      kind: 'overtimeEmployeeAlert',
      data: { hoursWorked, plannedHours },
      idempotencyKey: `overtime:${userId}:${dateKey}:employee`,
    });
    notified += 1;

    await sendNotification({
      from: userId,
      to: companyId,
      kind: 'overtimeCompanyAlert',
      data: { employeeName, hoursWorked, plannedHours },
      idempotencyKey: `overtime:${userId}:${dateKey}:company`,
    });
  }

  return { checked: workMsByUser.size, notified };
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
      const result = await runDailyOvertimeSweepForCompany(company._id.toString(), dateKey, range);
      notified += result.notified;
    } catch (err) {
      logger.error(`attendance:daily-overtime-sweep-company-failed companyId=${company._id.toString()}`, err);
    }
  }

  logger.info(`attendance:daily-overtime-sweep companiesChecked=${companies.length} notified=${notified}`);
  return { companiesChecked: companies.length, notified };
};
