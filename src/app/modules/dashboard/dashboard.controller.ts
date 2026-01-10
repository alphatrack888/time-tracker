import { StatusCodes } from "http-status-codes";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { dashboardService, getTimeAnalytics } from "./dashboard.services";
import { JwtPayload } from "jsonwebtoken";
import { AnalyticsQuery, LocationQuery } from "./dashboard.interface";
import { Request, Response } from "express";

const getSystemAdminGeneralStats = catchAsync(async (req: Request, res: Response) => {

    const stats = await dashboardService.getSystemAdminGeneralStats();
   sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'System admin general stats fetched successfully',
    data: stats,
   })

});



const getMonthlyRevenueFromStripe = catchAsync(async (req: Request, res: Response) => {
    const year = Number(req.query.year) as number
    const stats = await dashboardService.getMonthlyRevenueFromStripe(year);
   sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Monthly revenue from Stripe fetched successfully',
    data: stats,
   })
})

const totalCompanyMonthly = catchAsync(async (req: Request, res: Response) => {

    const year = Number(req.query.year) as number
    const stats = await dashboardService.totalCompanyMonthly(year);
   sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Total company monthly fetched successfully',
    data: stats,
   })
})

const getTotalEmployeesDataYearly = catchAsync(async (req: Request, res: Response) => {

    const year = Number(req.query.year) as number
    const stats = await dashboardService.getTotalEmployeesDataYearly(year);
   sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Total employees data yearly fetched successfully',
    data: stats,
   })
})

const totalProjectYearlyData = catchAsync(async (req: Request, res: Response) => {

    const year = Number(req.query.year) as number
    const stats = await dashboardService.totalProjectYearlyData(year);
   sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Total project yearly data fetched successfully',
    data: stats,
   })
})

const getCompanyGeneralStats = catchAsync(async (req: Request, res: Response) => {

    const user = req.user as JwtPayload
    const stats = await dashboardService.getCompanyGeneralStats(user);
   sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Company general stats fetched successfully',
    data: stats,
   })
})



/**
 * Universal time analytics controller
 * 
 * Query Parameters:
 * - date: Single date (YYYY-MM-DD)
 * - startDate & endDate: Date range
 * - period: Predefined periods ('today', 'yesterday', 'week', 'month', 'last7days', 'last30days')
 * - compare: Comparison type ('previous', 'lastWeek', 'lastMonth', 'yesterday')
 * - includeChart: Include daily breakdown for charts (true/false)
 * 
 * Examples:
 * GET /api/time-analytics/123?date=2024-01-25
 * GET /api/time-analytics/123?startDate=2024-01-23&endDate=2024-01-28&compare=previous&includeChart=true
 * GET /api/time-analytics/123?period=week&compare=lastWeek
 * GET /api/time-analytics/123 (defaults to today vs yesterday)
 */
 const getTimeAnalyticsController = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const {
    date,
    startDate,
    endDate,
    period,
    compare = 'previous',
    includeChart = 'false'
  } = req.query;

  const query: AnalyticsQuery = {
    userId,
    date: date as string,
    startDate: startDate as string,
    endDate: endDate as string,
    period: period as any,
    compare: compare as any,
    includeChart: includeChart === 'true'
  };

  const analytics = await getTimeAnalytics(query);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Time analytics fetched successfully',
    data: analytics,
  });
});


const getEmployeeLocationsController = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const {
    date,
    startDate,
    endDate,
    period,
    actions
  } = req.query;

  const query: LocationQuery = {
    userId,
    date: date as string,
    startDate: startDate as string,
    endDate: endDate as string,
    period: period as any,
    actions: actions ? (actions as string).split(',') : undefined
  };

  const locationData = await dashboardService.getEmployeeLocations(query);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Employee locations fetched successfully',
    data: locationData,
  });
});

export const dashboardController = {
    getSystemAdminGeneralStats,
    getMonthlyRevenueFromStripe,
    totalCompanyMonthly,
    getTotalEmployeesDataYearly,
    totalProjectYearlyData,
    getCompanyGeneralStats,
    getTimeAnalyticsController,
    getEmployeeLocationsController
}
