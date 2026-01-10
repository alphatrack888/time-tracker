import { Request, Response } from 'express';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { StatusCodes } from 'http-status-codes';
import { TimeTrackerService } from './timetracker.service';
import pick from '../../../shared/pick';
import { paginationFields } from '../../../interfaces/pagination';


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

  const result = await TimeTrackerService.getLocationsByDate( filters, pagination);
  sendResponse(res, { statusCode: StatusCodes.OK, success: true, message: 'Locations fetched', data: result });
});

const getMonthlyPdfReport = catchAsync(async (req: Request, res: Response) => {
  const { month, employee, project, template, lang } = req.query as { month: string; employee?: string; project?: string; template?: 'default' | 'timesheet' | 'comprehensive'; lang?: 'en' | 'de' };
  const result = await TimeTrackerService.generateMonthlyPdfReport(req.user!, { month, employee, project, template, lang });
  const {pdfBuffer, employeeName} = result;
  const filename = `monthly-report-${( employeeName)}-${month}${template ? '-' + template : '' + (lang ? '-' + lang : '-en')}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.status(StatusCodes.OK).send(pdfBuffer);
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
};