import { Types } from 'mongoose';
import { TimeSession } from './timetracker.model';
import { Project } from '../project/project.model';
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

const hoursFromMs = (workedMs: number) => Math.round((workedMs / (1000 * 60 * 60)) * 100) / 100

/**
 * Notifies an employee and their company when that person's committed hours
 * on a project are past the project's hour limit. An open session adds
 * nothing beyond time already committed. A project with no limit sends
 * nothing. Only people assigned to the project are checked.
 *
 * Idempotency is scoped to (user, project, limit). A repeat sweep does not
 * send again. A later change to the limit can notify once on the new crossing.
 */
const runProjectOvertimeSweepForCompany = async (
  companyId: string,
): Promise<{ checked: number; notified: number }> => {
  const projects = await Project.find({
    company: companyId,
    projectTime: { $gt: 0 },
    'employees.0': { $exists: true },
  }).select('_id title projectTime employees').lean();
  if (projects.length === 0) return { checked: 0, notified: 0 };

  const projectById = new Map(projects.map(project => [project._id.toString(), project]));
  const totals = await TimeSession.aggregate<{
    _id: { user: Types.ObjectId; project: Types.ObjectId }
    workedMs: number
  }>([
    { $match: { project: { $in: projects.map(project => project._id) } } },
    {
      $group: {
        _id: { user: '$user', project: '$project' },
        workedMs: { $sum: { $ifNull: ['$totalTime', 0] } },
      },
    },
  ]);

  let notified = 0;
  for (const row of totals) {
    const project = projectById.get(row._id.project.toString());
    if (!project) continue;
    const userId = row._id.user.toString();
    const assigned = (project.employees || []).some(id => id.toString() === userId);
    if (!assigned) continue;

    const limit = Number(project.projectTime) || 0;
    const workedHours = hoursFromMs(row.workedMs);
    if (!(limit > 0 && workedHours > limit)) continue;

    const employee = await User.findById(userId).select('name').lean();
    if (!employee) continue;

    const projectId = project._id.toString();
    const projectTitle = project.title || 'Project';
    const hoursWorked = workedHours.toFixed(2);
    const allocatedHours = limit.toFixed(2);
    const employeeName = employee.name || 'An employee';

    await sendNotification({
      from: userId,
      to: userId,
      kind: 'overtimeEmployeeAlert',
      data: { projectTitle, hoursWorked, allocatedHours },
      idempotencyKey: `overtime:${userId}:${projectId}:${limit}:employee`,
    });
    notified += 1;

    await sendNotification({
      from: userId,
      to: companyId,
      kind: 'overtimeCompanyAlert',
      data: { employeeName, projectTitle, hoursWorked, allocatedHours },
      idempotencyKey: `overtime:${userId}:${projectId}:${limit}:company`,
    });
  }

  return { checked: totals.length, notified };
};

/**
 * Runs the project-limit overtime check for every company. The schedule stays
 * every 4 hours. The check does not use a calendar day or a company timezone.
 */
export const runDailyOvertimeSweep = async (): Promise<{ companiesChecked: number; notified: number }> => {
  const companies = await User.find({ role: USER_ROLES.COMPANY }).select('_id').lean();
  let notified = 0;

  for (const company of companies) {
    try {
      const result = await runProjectOvertimeSweepForCompany(company._id.toString());
      notified += result.notified;
    } catch (err) {
      logger.error(`attendance:project-overtime-sweep-company-failed companyId=${company._id.toString()}`, err);
    }
  }

  logger.info(`attendance:project-overtime-sweep companiesChecked=${companies.length} notified=${notified}`);
  return { companiesChecked: companies.length, notified };
};
