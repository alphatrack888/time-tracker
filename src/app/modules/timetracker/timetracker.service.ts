import { StatusCodes } from 'http-status-codes';
import ApiError from '../../../errors/ApiError';
import { ITimeSession } from './timetracker.interface';
import { TimeSession } from './timetracker.model';
import { JwtPayload } from 'jsonwebtoken';
import { Types } from 'mongoose';
import { IPaginationOptions } from '../../../interfaces/pagination';
import { paginationHelper } from '../../../helpers/paginationHelper';
import { Project } from '../project/project.model'
import { DailyAllocation } from '../project/dailyAllocation.model';
import { User } from '../user/user.model';
import {
  generateComprehensiveTimesheetReport,
  generateMonthlyTimeReportPdf,
  generateTimesheetStyleMonthlyReport,
} from '../../../helpers/pdfHelper';
import { USER_ROLES } from '../../../enum/user';
import { AttendanceReportData, AttendanceDayEntry, EmployeeAttendance } from '../../../helpers/attendanceReportTypes';
import { generateMonthlyTimesheetExcel, generateAttendanceReportExcel } from '../../../helpers/excelHelper';
import { generateAttendanceReportPdf } from '../../../helpers/pdfHelper';

const OPEN_SESSION_MESSAGE = 'A time session is still open. Clock out before starting another.'

/** Same cut as stopTimer: committed totalTime, plus the unpaused tail while active. */
const elapsedMsForSession = (
  session: Pick<ITimeSession, 'status' | 'totalTime' | 'startTime' | 'pauses'>,
  now: Date,
) => {
  const committed = session.totalTime ?? 0
  if (session.status !== 'active') return committed
  const lastPause = session.pauses?.[session.pauses.length - 1]
  const anchor = lastPause?.end?.getTime() ?? session.startTime.getTime()
  return committed + Math.max(0, now.getTime() - anchor)
}

const startTimer = async (user: JwtPayload, payload: { project?: string; location?: { lat: number; lng: number } }) => {
  const alreadyOpen = await TimeSession.exists({
    user: user.authId,
    status: { $in: ['active', 'paused'] },
  })
  if (alreadyOpen) {
    throw new ApiError(StatusCodes.CONFLICT, OPEN_SESSION_MESSAGE)
  }

  const now = new Date();
  const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
  
  const newSession: Partial<ITimeSession> = {
    user: user.authId,
    project: payload.project ? new Types.ObjectId(payload.project) : undefined,
    startTime: now,
    pauses: [],
    totalTime: 0,
    status: 'active',
    date: dateStr,
    locations: payload.location ? [{
      timestamp: now,
      coordinates: [payload.location.lng, payload.location.lat],
      action: 'start'
    }] : [],
  };
  
  const result = await TimeSession.create(newSession);
  if (!result) throw new ApiError(StatusCodes.BAD_REQUEST, 'Failed to start timer');
  
  return result;
};

const pauseTimer = async (user: JwtPayload, sessionId: string, location?: { lat: number; lng: number }) => {
  const session = await TimeSession.findById(sessionId);
  if (!session || session.user.toString() !== user.authId) throw new ApiError(StatusCodes.NOT_FOUND, 'Session not found');
  if (session.status !== 'active') throw new ApiError(StatusCodes.BAD_REQUEST, 'Timer not active');

  const now = new Date();
  session.pauses.push({ start: now });
  session.totalTime += now.getTime() - (session.pauses[session.pauses.length - 2]?.end?.getTime() || session.startTime.getTime());
  session.status = 'paused';
  
  // Add location if provided
  if (location) {
    session.locations.push({
      timestamp: now,
      coordinates: [location.lng, location.lat],
      action: 'pause'
    });
  }
  
  await session.save();
  return session;
};

const resumeTimer = async (user: JwtPayload, sessionId: string, location?: { lat: number; lng: number }) => {
  const session = await TimeSession.findById(sessionId);
  if (!session || session.user.toString() !== user.authId) throw new ApiError(StatusCodes.NOT_FOUND, 'Session not found');
  if (session.status !== 'paused') throw new ApiError(StatusCodes.BAD_REQUEST, 'Timer not paused');

  const now = new Date();
  session.pauses[session.pauses.length - 1].end = now;
  session.status = 'active';
  
  // Add location if provided
  if (location) {
    session.locations.push({
      timestamp: now,
      coordinates: [location.lng, location.lat],
      action: 'resume'
    });
  }
  
  await session.save();
  return session;
};

const stopTimer = async (user: JwtPayload, sessionId: string, location?: { lat: number; lng: number }) => {
  const session = await TimeSession.findById(sessionId);
  if (!session || session.user.toString() !== user.authId) throw new ApiError(StatusCodes.NOT_FOUND, 'Session not found');
  if (session.status === 'stopped') throw new ApiError(StatusCodes.BAD_REQUEST, 'Timer already stopped');

  const now = new Date();
  if (session.status === 'active') {
    session.totalTime += now.getTime() - (session.pauses[session.pauses.length - 1]?.end?.getTime() || session.startTime.getTime());
  } else if (session.status === 'paused') {
    session.pauses[session.pauses.length - 1].end = now;
  }
  session.endTime = now;
  session.status = 'stopped';
  
  // Add location if provided
  if (location) {
    session.locations.push({
      timestamp: now,
      coordinates: [location.lng, location.lat],
      action: 'stop'
    });
  }
  
  await session.save();
  return session;
};

const getOpenSessions = async (user: JwtPayload, now: Date = new Date()) => {
  const sessions = await TimeSession.find({
    user: user.authId,
    status: { $in: ['active', 'paused'] },
  })
    .sort({ startTime: 1 })
    .populate('project', 'title')
    .lean()

  return sessions.map(session => {
    const project = session.project as { _id?: Types.ObjectId; title?: string } | null
    const projectId = project && typeof project === 'object' && project._id
      ? project._id.toString()
      : null
    return {
      id: session._id.toString(),
      status: session.status,
      date: session.date,
      startTime: session.startTime,
      project: projectId
        ? { id: projectId, title: project?.title || '' }
        : null,
      elapsedMs: elapsedMsForSession(session, now),
      pauseStartedAt: pauseStartedAtForSession(session),
    }
  })
}

/** Start of the open pause. Absent unless the session is paused on a pause with no end. */
const pauseStartedAtForSession = (
  session: Pick<ITimeSession, 'status' | 'pauses'>,
) => {
  if (session.status !== 'paused') return null
  const last = session.pauses?.[session.pauses.length - 1]
  if (!last?.start || last.end) return null
  return last.start
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/

/** Same daily allowance as the overtime alert (`DAILY_OVERTIME_THRESHOLD_HOURS`). */
const DAILY_STANDARD_HOURS = Number(process.env.DAILY_OVERTIME_THRESHOLD_HOURS) || 8

const formatHoursMinutes = (hours: number) => {
  const totalMinutes = Math.max(0, Math.round(hours * 60))
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return `${h}h ${m}m`
}

const inclusiveUtcDays = (from: string, to: string) => {
  const start = Date.parse(`${from}T00:00:00.000Z`)
  const end = Date.parse(`${to}T00:00:00.000Z`)
  return Math.floor((end - start) / (24 * 60 * 60 * 1000)) + 1
}

const getDailySummary = async (
  user: JwtPayload,
  filters: { date?: string; from?: string; to?: string; project?: string },
) => {
  const { date, from, to, project: projectId } = filters
  const query: any = { user: user.authId }

  if (from && to) {
    if (!DATE_KEY.test(from) || !DATE_KEY.test(to) || from > to) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid date range')
    }
    if (inclusiveUtcDays(from, to) > 31) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Date range cannot exceed 31 days')
    }
    // Match the stored UTC date string only. Do not OR a startTime window.
    query.date = { $gte: from, $lte: to }
  } else if (date && DATE_KEY.test(date)) {
    query.date = date
  } else {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Date is required')
  }

  if (projectId) query.project = new Types.ObjectId(projectId)

  const sessions = await TimeSession.find(query).populate('project', 'title').lean()

  if (projectId) {
    const project = await Project.findById(projectId).lean()
    if (!project) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        'Something went wrong, please try again with valid project and session id.',
      )
    }
  }

  // project.projectTime is the project span, not a daily cap. Every summary
  // uses the same allowance: 8 hours (or DAILY_OVERTIME_THRESHOLD_HOURS) per
  // distinct session date. The project id only filters which sessions count.
  const distinctDates = new Set(sessions.map((s) => s.date)).size
  const standardHours = DAILY_STANDARD_HOURS * distinctDates

  const totalTime = sessions.reduce((sum, s) => sum + (s.totalTime || 0), 0) / (1000 * 60 * 60)
  const overtime = Math.max(totalTime - standardHours, 0)

  const totalBreakTimeMs = sessions.reduce((sum, session) => {
    if (session.pauses && session.pauses.length > 0) {
      const sessionBreakTime = session.pauses.reduce((pauseSum, pause) => {
        if (pause.start && pause.end) {
          return pauseSum + (new Date(pause.end).getTime() - new Date(pause.start).getTime())
        }
        return pauseSum
      }, 0)
      return sum + sessionBreakTime
    }
    return sum
  }, 0)

  const totalBreakInHours = totalBreakTimeMs / (1000 * 60 * 60)

  const allocationQuery: Record<string, unknown> = {
    employee: user.authId,
    date: query.date,
  }
  if (projectId) allocationQuery.project = new Types.ObjectId(projectId)
  const allocations = await DailyAllocation.find(allocationQuery).select('hours').lean()
  const plannedHours = allocations.reduce((sum, row) => sum + (Number(row.hours) || 0), 0)

  return {
    totalTime: totalTime.toFixed(2),
    overtime: overtime.toFixed(2),
    plannedHours: plannedHours.toFixed(2),
    totalBreakInHours: totalBreakInHours.toFixed(2),
    totalBreakInHoursFormatted: formatHoursMinutes(totalBreakInHours),
    overtimeInHoursFormatted: formatHoursMinutes(overtime),
    sessions,
  }
}

const addPeriodicLocation = async (user: JwtPayload, sessionId: string, location: { lat: number; lng: number }) => {
  const session = await TimeSession.findById(sessionId);
  if (!session || session.user.toString() !== user.authId) throw new ApiError(StatusCodes.NOT_FOUND, 'Session not found');
  if (session.status === 'stopped') throw new ApiError(StatusCodes.BAD_REQUEST, 'Cannot add location to stopped session');

  const now = new Date();
  session.locations.push({
    timestamp: now,
    coordinates: [location.lng, location.lat],
    action: 'periodic'
  });
  
  await session.save();
  return { message: 'Location added successfully' };
};

const getSessionLocations = async (user: JwtPayload, sessionId: string) => {
  const session = await TimeSession.findById(sessionId).select('locations user');
  if (!session || session.user.toString() !== user.authId) throw new ApiError(StatusCodes.NOT_FOUND, 'Session not found');
  
  return session.locations;
};

const getLocationsByDate = async (user: JwtPayload, filters: { date: string; project?: string; employee?: string }, pagination: IPaginationOptions) => {
  const { page, limit, skip } = paginationHelper.calculatePagination(pagination);

  // Only the calling company's own employees' locations are visible here.
  const companyEmployees = await User.find({ company: user.authId }).select('_id').lean();
  const companyEmployeeIds = companyEmployees.map((e) => e._id.toString());

  const query: any = { date: filters.date, user: { $in: companyEmployeeIds } };
  if (filters.employee) {
    if (!companyEmployeeIds.includes(filters.employee)) {
      throw new ApiError(StatusCodes.FORBIDDEN, 'You do not have permission to view this employee\'s locations');
    }
    query.user = new Types.ObjectId(filters.employee);
  }
  if (filters.project) query.project = new Types.ObjectId(filters.project);

  const [sessions, total] = await Promise.all([
    TimeSession.find(query)
      .select('locations startTime endTime project')
      .populate('project', 'name')
      .skip(skip)
      .limit(limit)
      .sort({ startTime: -1 }).lean(),
    TimeSession.countDocuments(query)
  ]);

  // Flatten all locations from all sessions
  const allLocations = sessions.flatMap(session => 
    session.locations.map(loc => ({
      ...loc,
      sessionId: session._id,
      project: session.project
    }))
  );

  return { 
    meta: { page, limit, total }, 
    data: allLocations.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()) 
  };
};

// Applies to both the synchronous single-employee attendance endpoint and
// the async company-wide one — a pathological request (decades of range)
// shouldn't be accepted at all, background job or not.
const MAX_ATTENDANCE_RANGE_DAYS = 366;

const dateRangeStrings = (startDate: string, endDate: string): string[] => {
  const dates: string[] = [];
  const cursor = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  while (cursor.getTime() <= end.getTime()) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
};

/**
 * Computes attendance data for one or more employees over a date range —
 * format-agnostic (the caller renders it as PDF or Excel). "Present" means
 * only "has at least one TimeSession that day" — there is no work
 * schedule or holiday calendar anywhere in this system to judge whether a
 * given day *should* have had one, so every day in the range is included,
 * weekends included, without asserting that absence on any particular day
 * was unexpected.
 */
const generateAttendanceReportData = async (
  user: JwtPayload,
  opts: { startDate: string; endDate: string; employee?: string; project?: string; company?: string },
): Promise<AttendanceReportData> => {
  if (opts.endDate < opts.startDate) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'endDate must not be before startDate');
  }
  const rangeDates = dateRangeStrings(opts.startDate, opts.endDate);
  if (rangeDates.length > MAX_ATTENDANCE_RANGE_DAYS) {
    throw new ApiError(StatusCodes.BAD_REQUEST, `Date range cannot exceed ${MAX_ATTENDANCE_RANGE_DAYS} days`);
  }

  let targetEmployees: { _id: Types.ObjectId; name?: string; email?: string }[];

  if (user.role === USER_ROLES.EMPLOYEES) {
    const self = await User.findById(user.authId).select('name email').lean();
    if (!self) throw new ApiError(StatusCodes.NOT_FOUND, 'User not found');
    targetEmployees = [self];
  } else if (opts.employee) {
    const employee = await User.findById(opts.employee).select('name email company').lean();
    if (!employee) throw new ApiError(StatusCodes.NOT_FOUND, 'Employee not found');
    if (user.role === USER_ROLES.COMPANY && employee.company?.toString() !== user.authId) {
      throw new ApiError(StatusCodes.FORBIDDEN, 'You do not have permission to view this employee\'s report');
    }
    targetEmployees = [employee];
  } else if (user.role === USER_ROLES.COMPANY) {
    // Company-wide: every employee belonging to this company. Callers
    // requesting this (no `employee` filter) are expected to go through the
    // async report job endpoint, not this function called synchronously
    // from a live request — see timetracker.route.ts. `opts.company` is
    // ignored here on purpose: a COMPANY user can only ever see their own
    // company's employees, never one supplied on the request.
    targetEmployees = await User.find({ company: user.authId, role: USER_ROLES.EMPLOYEES }).select('name email').lean();
  } else if (user.role === USER_ROLES.ADMIN || user.role === USER_ROLES.SUPER_ADMIN) {
    if (opts.company) {
      // Single-company roll-up: every employee of the specified company.
      const company = await User.findOne({ _id: opts.company, role: USER_ROLES.COMPANY }).select('_id').lean();
      if (!company) throw new ApiError(StatusCodes.NOT_FOUND, 'Company not found');
      targetEmployees = await User.find({ company: opts.company, role: USER_ROLES.EMPLOYEES }).select('name email').lean();
    } else {
      // No employee and no company: a true cross-company report, every
      // employee across every company. Admin-only — see role check above.
      targetEmployees = await User.find({ role: USER_ROLES.EMPLOYEES }).select('name email').lean();
    }
  } else {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'An employee must be specified for this role');
  }

  const employees: EmployeeAttendance[] = [];

  for (const employee of targetEmployees) {
    const sessionQuery: any = {
      user: employee._id,
      date: { $gte: opts.startDate, $lte: opts.endDate },
    };
    if (opts.project) sessionQuery.project = new Types.ObjectId(opts.project);

    const sessions = await TimeSession.find(sessionQuery).select('date totalTime').lean();

    const byDate = new Map<string, { sessionsCount: number; workMs: number }>();
    sessions.forEach(s => {
      const entry = byDate.get(s.date) || { sessionsCount: 0, workMs: 0 };
      entry.sessionsCount += 1;
      entry.workMs += s.totalTime || 0;
      byDate.set(s.date, entry);
    });

    const days: AttendanceDayEntry[] = rangeDates.map(date => {
      const entry = byDate.get(date);
      return {
        date,
        present: !!entry,
        sessionsCount: entry?.sessionsCount || 0,
        workMs: entry?.workMs || 0,
      };
    });

    employees.push({
      employeeId: employee._id.toString(),
      employeeName: employee.name || employee._id.toString(),
      employeeEmail: employee.email,
      days,
      presentCount: days.filter(d => d.present).length,
      absentCount: days.filter(d => !d.present).length,
    });
  }

  const companyName = user.role === USER_ROLES.COMPANY ? user.name : undefined;

  return {
    companyName,
    startDate: opts.startDate,
    endDate: opts.endDate,
    employees,
  };
};

/**
 * Renders already-computed attendance data as PDF or Excel. Kept separate
 * from generateAttendanceReportData so the async report job processor
 * (reportjob module) can compute once and render however the requester
 * asked, the same way the synchronous endpoint does.
 */
const renderAttendanceReport = async (
  data: AttendanceReportData,
  format: 'pdf' | 'excel',
  lang: 'en' | 'de' = 'en',
): Promise<{ buffer: Buffer; contentType: string; fileExtension: string }> => {
  if (format === 'excel') {
    return {
      buffer: await generateAttendanceReportExcel(data),
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      fileExtension: 'xlsx',
    };
  }
  return {
    buffer: await generateAttendanceReportPdf(data, lang),
    contentType: 'application/pdf',
    fileExtension: 'pdf',
  };
};

export const TimeTrackerService = {
  startTimer,
  pauseTimer,
  resumeTimer,
  stopTimer,
  getOpenSessions,
  getDailySummary,
  addPeriodicLocation,
  getSessionLocations,
  generateAttendanceReportData,
  renderAttendanceReport,
  getLocationsByDate,
  generateMonthlyPdfReport: async (
    user: JwtPayload,
    opts: { month: string; employee?: string; project?: string; template?: 'default' | 'timesheet' | 'comprehensive', lang?: 'en' | 'de', format?: 'pdf' | 'excel' }
  ) => {

    console.log('generateMonthlyPdfReport', opts);

    // EMPLOYEES may only ever generate their own report — the `employee`
    // param is ignored for them rather than trusted. COMPANY may generate a
    // report for any employee, but only one that actually belongs to them.
    let targetEmployeeId = user.authId as string;
    if (opts.employee && user.role !== USER_ROLES.EMPLOYEES) {
      targetEmployeeId = opts.employee;
    }
    if (user.role === USER_ROLES.COMPANY) {
      const targetEmployee = await User.findOne({ _id: targetEmployeeId, company: user.authId });
      if (!targetEmployee) {
        throw new ApiError(StatusCodes.FORBIDDEN, 'You do not have permission to view this employee\'s report');
      }
    }

    const employeeId = new Types.ObjectId(targetEmployeeId);
    const month = opts.month; // YYYY-MM

    // Fetch sessions for the month
    const sessionQuery: any = {
      user: employeeId,
      date: { $regex: `^${month}-` }
    };
    if (opts.project) sessionQuery.project = new Types.ObjectId(opts.project);

    const sessions = await TimeSession.find(sessionQuery)
      .populate<{ project: { title: string } }>('project', 'title')
      .lean();

    // Aggregate per day
    const dayMap = new Map<string, { workMs: number; breakMs: number; sessions: any[] }>();

    sessions.forEach((s) => {
      const day = s.date;
      const workMs = s.totalTime || 0;
      const breakMs = (s.pauses || []).reduce((acc, p) => {
        if (p.start && p.end) {
          return acc + (new Date(p.end).getTime() - new Date(p.start).getTime());
        }
        return acc;
      }, 0);

      const entry = dayMap.get(day) || { workMs: 0, breakMs: 0, sessions: [] };
      entry.workMs += workMs;
      entry.breakMs += breakMs;
      entry.sessions.push({
        date: day,
        project: (s as any).project?.title,
        startTime: s.startTime,
        endTime: s.endTime,
        workMs,
        breaks: (s.pauses || [])
          .filter(p => p.start && p.end)
          .map(p => ({ start: p.start, end: p.end, durationMs: new Date(p.end!).getTime() - new Date(p.start!).getTime() })),
      });
      dayMap.set(day, entry);
    });

    const daily = Array.from(dayMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, v]) => ({ date, workMs: v.workMs, breakMs: v.breakMs, sessions: v.sessions }));

    const totals = daily.reduce(
      (acc, d) => {
        acc.workMs += d.workMs;
        acc.breakMs += d.breakMs;
        acc.days += 1;
        acc.sessions += d.sessions.length;
        return acc;
      },
      { workMs: 0, breakMs: 0, days: 0, sessions: 0 }
    );

    const employee = await User.findById(employeeId).lean();
    const companyName = user?.companyName || undefined;

    const commonData = {
      employeeName: employee?.name || employee?._id?.toString() || 'Employee',
      employeeEmail: employee?.email,
      companyName,
      month,
      totals,
      daily,
    };

    if (opts.format === 'excel') {
      const excelBuffer = await generateMonthlyTimesheetExcel(commonData);
      return {
        buffer: excelBuffer,
        employeeName: commonData.employeeName,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        fileExtension: 'xlsx',
      };
    }

    // `template` picks the PDF layout: 'timesheet' is the plain daily-summary
    // report, 'default'/'comprehensive'/unset is the branded bilingual layout.
    let pdfBuffer: Buffer;
    switch (opts.template) {
      case 'timesheet':
        pdfBuffer = await generateTimesheetStyleMonthlyReport(commonData);
        break;
      case 'default':
        pdfBuffer = await generateMonthlyTimeReportPdf(commonData);
        break;
      case 'comprehensive':
      default:
        pdfBuffer = await generateComprehensiveTimesheetReport(commonData, opts.lang || 'en');
        break;
    }

    return { buffer: pdfBuffer, employeeName: commonData.employeeName, contentType: 'application/pdf', fileExtension: 'pdf' };
  },
};