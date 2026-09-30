import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { ReportJobServices } from './reportjob.service';

const requestAttendanceReportJob = catchAsync(async (req: Request, res: Response) => {
  const result = await ReportJobServices.createAttendanceReportJob(req.user!, req.body);

  sendResponse(res, {
    statusCode: StatusCodes.ACCEPTED,
    success: true,
    message: 'Report generation started. You will be notified when it is ready.',
    data: result,
  });
});

const getJobStatus = catchAsync(async (req: Request, res: Response) => {
  const result = await ReportJobServices.getJobStatus(req.user!, req.params.jobId);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Report job status retrieved successfully',
    data: result,
  });
});

const listJobs = catchAsync(async (req: Request, res: Response) => {
  const { page, limit } = req.query as { page?: string; limit?: string };
  const result = await ReportJobServices.listJobs(req.user!, {
    page: page ? parseInt(page, 10) : undefined,
    limit: limit ? parseInt(limit, 10) : undefined,
  });

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Report jobs retrieved successfully',
    data: result,
  });
});

export const ReportJobController = {
  requestAttendanceReportJob,
  getJobStatus,
  listJobs,
};
