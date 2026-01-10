import { StatusCodes } from 'http-status-codes';
import ApiError from '../../../errors/ApiError';
import { ITimeSession, ITimeSessionFilters } from './timetracker.interface';
import { TimeSession } from './timetracker.model';
import { JwtPayload } from 'jsonwebtoken';
import { Types } from 'mongoose';
import { IPaginationOptions } from '../../../interfaces/pagination';
import { paginationHelper } from '../../../helpers/paginationHelper';
import { Project } from '../project/project.model';
import { User } from '../user/user.model';
import { generateMonthlyTimeReportPdf, generateTimesheetStyleMonthlyReport, generateComprehensiveTimesheetReport } from '../../../helpers/pdfHelper';

const startTimer = async (user: JwtPayload, payload: { project?: string; location?: { lat: number; lng: number } }) => {
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

const getDailySummary = async (user: JwtPayload, filters: { date: string; project?: string }) => {
  const query: any = { user: user.authId, date: filters.date };
  if (filters.project) query.project = new Types.ObjectId(filters.project);

  const [sessions, project] = await Promise.all([
    TimeSession.find(query).populate('project', 'name').lean(),
    Project.findById(filters.project).lean()
  ]);

  if(!sessions || !project) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Something went wrong, please try again with valid project and session id.')
  }

  const totalTime = sessions.reduce((sum, s) => sum + s.totalTime, 0) / (1000 * 60 * 60); // in hours
  const overtime = Math.max(totalTime - (project?.projectTime || 8), 0); // assuming 8h standard
  
  // Calculate total break time in hours
  const totalBreakTimeMs = sessions.reduce((sum, session) => {
    if (session.pauses && session.pauses.length > 0) {
      const sessionBreakTime = session.pauses.reduce((pauseSum, pause) => {
        if (pause.start && pause.end) {
          return pauseSum + (new Date(pause.end).getTime() - new Date(pause.start).getTime());
        }
        return pauseSum;
      }, 0);
      return sum + sessionBreakTime;
    }
    return sum;
  }, 0);
  
  //format the total break time in hh:mm:ss
  const totalBreakInHours = totalBreakTimeMs / (1000 * 60 * 60); // convert to hours
  const totalBreakInMinutes = totalBreakTimeMs / (1000 * 60); // convert to minutes
  const totalBreakInSeconds = totalBreakTimeMs / 1000; // convert to seconds
  //format the total break time in hh:mm:ss
  const totalBreakInHoursFormatted = `${Math.floor(totalBreakInHours)}:${Math.floor(totalBreakInMinutes)}:${Math.floor(totalBreakInSeconds)}`;


  //also format the overtime same as break time
  const overtimeInHours = overtime / 60; // convert to hours
  const overtimeInMinutes = overtime; // convert to minutes
  const overtimeInSeconds = overtime * 60; // convert to seconds
  //format the overtime same as break time
  const overtimeInHoursFormatted = `${Math.floor(overtimeInHours)}:${Math.floor(overtimeInMinutes)}:${Math.floor(overtimeInSeconds)}`;

  return { totalTime:totalTime.toFixed(2), overtime:overtime.toFixed(2), totalBreakInHours:totalBreakInHours.toFixed(2), totalBreakInHoursFormatted, overtimeInHoursFormatted, sessions };
};

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

const getLocationsByDate = async (filters: { date: string; project?: string; employee?: string }, pagination: IPaginationOptions) => {
  const { page, limit, skip } = paginationHelper.calculatePagination(pagination);
  const query: any = { date: filters.date };
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

export const TimeTrackerService = {
  startTimer,
  pauseTimer,
  resumeTimer,
  stopTimer,
  getDailySummary,
  addPeriodicLocation,
  getSessionLocations,
  getLocationsByDate,
  generateMonthlyPdfReport: async (
    user: JwtPayload,
    opts: { month: string; employee?: string; project?: string; template?: 'default' | 'timesheet' | 'comprehensive', lang?: 'en' | 'de' }
  ) => {

    console.log('generateMonthlyPdfReport', opts);
    const employeeId = new Types.ObjectId(opts.employee || (user.authId as string));
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

    const pdfBuffer = await generateComprehensiveTimesheetReport(commonData, opts.lang || 'en');


    return {pdfBuffer, employeeName: commonData.employeeName};
  },
};