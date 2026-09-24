import { Request, Response } from 'express';
import { JwtPayload } from 'jsonwebtoken';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { StatusCodes } from 'http-status-codes';
import ApiError from '../../../errors/ApiError';
import { TimeTrackerService } from './timetracker.service';
import pick from '../../../shared/pick';
import { paginationFields } from '../../../interfaces/pagination';
import { USER_ROLES } from '../../../enum/user';


const startTimer = catchAsync(async (req: Request, res: Response) => {
  const result = await TimeTrackerService.startTimer(req.user!, req.body);
  sendResponse(res, { statusCode: StatusCodes.OK, success: true, message: 'Timer started', data: result });
});

const pauseTimer = catchAsync(async (req: Request, res: Response) => {
  const result = await TimeTrackerService.pauseTimer(req.user!, req.params.sessionId, req.body.location);
  sendResponse(res, { statusCode: StatusCodes.OK, success: true, message: 'Timer paused', data: result });
});

const resumeTimer = catchAsync(async (req: Request, res: Response) => {
  const result = await TimeTrackerService.resumeTimer(req.user!, req.params.sessionId, req.body.location);
  sendResponse(res, { statusCode: StatusCodes.OK, success: true, message: 'Timer resumed', data: result });
});

const stopTimer = catchAsync(async (req: Request, res: Response) => {
  const result = await TimeTrackerService.stopTimer(req.user!, req.params.sessionId, req.body.location);
  sendResponse(res, { statusCode: StatusCodes.OK, success: true, message: 'Timer stopped', data: result });
});

const getDailySummary = catchAsync(async (req: Request, res: Response) => {
  const result = await TimeTrackerService.getDailySummary(req.user!, req.query as any);
  sendResponse(res, { statusCode: StatusCodes.OK, success: true, message: 'Daily summary fetched', data: result });
});

const addPeriodicLocation = catchAsync(async (req: Request, res: Response) => {
  const result = await TimeTrackerService.addPeriodicLocation(req.user!, req.body.sessionId, req.body.location);
  sendResponse(res, { statusCode: StatusCodes.OK, success: true, message: 'Location added', data: result });
});

const getSessionLocations = catchAsync(async (req: Request, res: Response) => {
  const result = await TimeTrackerService.getSessionLocations(req.user!, req.params.sessionId);
  sendResponse(res, { statusCode: StatusCodes.OK, success: true, message: 'Session locations fetched', data: result });
});

const getLocationsByDate = catchAsync(async (req: Request, res: Response) => {
  const filters = { date: req.query.date as string, project: req.query.project as string, employee: req.query.employee as string };
  const pagination = pick(req.query, paginationFields);

  const result = await TimeTrackerService.getLocationsByDate(req.user!, filters, pagination);
  sendResponse(res, { statusCode: StatusCodes.OK, success: true, message: 'Locations fetched', data: result });
});

const getMonthlyPdfReport = catchAsync(async (req: Request, res: Response) => {
  const { month, employee, project, template, lang, format } = req.query as {
    month: string; employee?: string; project?: string;
    template?: 'default' | 'timesheet' | 'comprehensive'; lang?: 'en' | 'de'; format?: 'pdf' | 'excel';
  };
  const result = await TimeTrackerService.generateMonthlyPdfReport(req.user!, { month, employee, project, template, lang, format });
  const { buffer, employeeName, contentType, fileExtension } = result;
  const suffix = format === 'excel' ? '' : (template ? '-' + template : '' + (lang ? '-' + lang : '-en'));
  const filename = `monthly-report-${employeeName}-${month}${suffix}.${fileExtension}`;
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.status(StatusCodes.OK).send(buffer);
});

const getAttendanceReport = catchAsync(async (req: Request, res: Response) => {
  const { startDate, endDate, employee, project, format, lang } = req.query as {
    startDate: string; endDate: string; employee?: string; project?: string; format?: 'pdf' | 'excel'; lang?: 'en' | 'de';
  };

  // This endpoint is synchronous, so it must stay small: a company-wide
  // request (no `employee`) can span every employee in a company and
  // belongs on the async report job endpoints instead.
  if (!employee && (req.user as JwtPayload).role !== USER_ROLES.EMPLOYEES) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Specify an employee for this report, or use POST /timetracker/reports/attendance/async for a company-wide report.',
    );
  }

  const data = await TimeTrackerService.generateAttendanceReportData(req.user!, { startDate, endDate, employee, project });
  const { buffer, contentType, fileExtension } = await TimeTrackerService.renderAttendanceReport(data, format || 'pdf', lang);
  const filename = `attendance-report-${startDate}-to-${endDate}.${fileExtension}`;
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.status(StatusCodes.OK).send(buffer);
});

export const TimeTrackerController = {
  startTimer,
  pauseTimer,
  resumeTimer,
  stopTimer,
  getDailySummary,
  addPeriodicLocation,
  getSessionLocations,
  getLocationsByDate,
  getMonthlyPdfReport,
  getAttendanceReport,
};