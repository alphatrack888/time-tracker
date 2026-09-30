import { StatusCodes } from 'http-status-codes';
import { JwtPayload } from 'jsonwebtoken';
import ApiError from '../../../errors/ApiError';
import { logger } from '../../../shared/logger';
// Processing already runs in the background relative to the HTTP request
// (see createAttendanceReportJob), so there's no live response left to keep
// fast by the time this notification fires — awaiting sendNotification
// directly, same reasoning as the cron-driven triggers in Phase 3
// (monitoring.service.ts, timetracker.triggers.ts), gives deterministic
// completion instead of racing a fire-and-forget dispatch.
import { sendNotification } from '../../../helpers/notificationHelper';
import { CloudinaryHelper } from '../../../helpers/image/cloudinaryHelper';
import { ReportJob } from './reportjob.model';
import { ReportJobFormat } from './reportjob.interface';
import { TimeTrackerService } from '../timetracker/timetracker.service';
import { User } from '../user/user.model';
import { USER_ROLES } from '../../../enum/user';

type CreateAttendanceJobPayload = {
  startDate: string;
  endDate: string;
  project?: string;
  format?: ReportJobFormat;
  lang?: 'en' | 'de';
  company?: string;
};

/**
 * Does the actual work: computes the report data, renders it, uploads the
 * result, and marks the job ready (or failed) — then notifies the
 * requester either way. Exported separately from createAttendanceReportJob
 * so tests can await it directly; production code deliberately does not
 * await it (see createAttendanceReportJob below) so the HTTP response
 * isn't held open for however long a company-wide report takes to render.
 */
const processAttendanceReportJob = async (jobId: string): Promise<void> => {
  const job = await ReportJob.findById(jobId);
  if (!job) {
    logger.error(`reportjob:not-found jobId=${jobId}`);
    return;
  }

  try {
    job.status = 'processing';
    await job.save();

    const user = { authId: job.requestedBy.toString(), role: job.requestedByRole } as JwtPayload;
    const data = await TimeTrackerService.generateAttendanceReportData(user, {
      startDate: job.params.startDate,
      endDate: job.params.endDate,
      project: job.params.project,
      company: job.params.company,
    });
    const { buffer } = await TimeTrackerService.renderAttendanceReport(data, job.format, job.params.lang || 'en');

    const fileUrl = await CloudinaryHelper.uploadBufferToCloudinary(buffer, 'documents');

    job.status = 'ready';
    job.fileUrl = fileUrl;
    await job.save();

    await sendNotification({
      from: job.requestedBy.toString(),
      to: job.requestedBy.toString(),
      kind: 'reportReady',
      data: { reportLabel: 'attendance' },
      idempotencyKey: `reportjob:${job._id.toString()}:ready`,
    });
  } catch (error) {
    logger.error(
      `reportjob:generation-failed jobId=${jobId} requestedBy=${job.requestedBy.toString()} role=${job.requestedByRole} type=${job.type} format=${job.format}`,
      error,
    );
    job.status = 'failed';
    job.errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await job.save();

    await sendNotification({
      from: job.requestedBy.toString(),
      to: job.requestedBy.toString(),
      kind: 'reportFailed',
      data: { reportLabel: 'attendance' },
      idempotencyKey: `reportjob:${job._id.toString()}:failed`,
    });
  }
};

/**
 * Company-wide attendance reports only — the one report shape that can
 * genuinely be "large" (every employee × the whole date range) given the
 * data this system has. Anything narrower (a single employee) stays on the
 * synchronous /reports/attendance endpoint.
 */
const createAttendanceReportJob = async (user: JwtPayload, payload: CreateAttendanceJobPayload) => {
  if (payload.endDate < payload.startDate) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'endDate must not be before startDate');
  }

  // COMPANY requesters are always scoped to their own company — a `company`
  // in the payload from them is ignored, not trusted, the same way
  // generateAttendanceReportData ignores it. ADMIN/SUPER_ADMIN may scope to
  // one company, or omit it entirely for a cross-company report; the
  // company (if given) is validated here so a bad id fails fast instead of
  // silently producing an empty report once the job runs.
  let company: string | undefined;
  if (user.role === USER_ROLES.ADMIN || user.role === USER_ROLES.SUPER_ADMIN) {
    if (payload.company) {
      const companyUser = await User.findOne({ _id: payload.company, role: USER_ROLES.COMPANY }).select('_id').lean();
      if (!companyUser) throw new ApiError(StatusCodes.NOT_FOUND, 'Company not found');
      company = payload.company;
    }
  } else if (user.role !== USER_ROLES.COMPANY) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'You do not have permission to request this report');
  }

  const job = await ReportJob.create({
    requestedBy: user.authId,
    requestedByRole: user.role,
    type: 'attendance',
    format: payload.format || 'pdf',
    params: {
      startDate: payload.startDate,
      endDate: payload.endDate,
      project: payload.project,
      lang: payload.lang,
      company,
    },
    status: 'pending',
  });

  // Deliberately not awaited — see processAttendanceReportJob's comment.
  processAttendanceReportJob(job._id.toString()).catch(err =>
    logger.error(`reportjob:unexpected-processing-failure jobId=${job._id.toString()}`, err),
  );

  return { jobId: job._id.toString(), status: job.status };
};

const getJobStatus = async (user: JwtPayload, jobId: string) => {
  const job = await ReportJob.findOne({ _id: jobId, requestedBy: user.authId }).lean();
  if (!job) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Report job not found');
  }
  return {
    jobId: job._id.toString(),
    type: job.type,
    format: job.format,
    status: job.status,
    fileUrl: job.fileUrl,
    errorMessage: job.errorMessage,
    // Echoed back so a UI listing many jobs can tell them apart (which date
    // range, which company) without a second lookup.
    startDate: job.params.startDate,
    endDate: job.params.endDate,
    company: job.params.company,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
};

const listJobs = async (user: JwtPayload, opts: { page?: number; limit?: number }) => {
  const page = opts.page && opts.page > 0 ? opts.page : 1;
  const limit = opts.limit && opts.limit > 0 ? Math.min(opts.limit, 50) : 20;
  const skip = (page - 1) * limit;

  const [jobs, total] = await Promise.all([
    ReportJob.find({ requestedBy: user.authId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    ReportJob.countDocuments({ requestedBy: user.authId }),
  ]);

  return {
    meta: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) },
    data: jobs.map(job => ({
      jobId: job._id.toString(),
      type: job.type,
      format: job.format,
      status: job.status,
      fileUrl: job.fileUrl,
      errorMessage: job.errorMessage,
      startDate: job.params.startDate,
      endDate: job.params.endDate,
      company: job.params.company,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    })),
  };
};

export const ReportJobServices = {
  createAttendanceReportJob,
  processAttendanceReportJob,
  getJobStatus,
  listJobs,
};
