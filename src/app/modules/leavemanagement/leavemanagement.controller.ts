import { Request, Response } from 'express';
  import { LeavemanagementServices } from './leavemanagement.service';
  import catchAsync from '../../../shared/catchAsync';
  import sendResponse from '../../../shared/sendResponse';
  import { StatusCodes } from 'http-status-codes';
import pick from '../../../shared/pick';
import { leavemanagementFilterables } from './leavemanagement.constants';
  
  const createLeavemanagement = catchAsync(async (req: Request, res: Response) => {
    const leavemanagementData = req.body;

    const result = await LeavemanagementServices.createLeavemanagement(req.user!, leavemanagementData);
    
    sendResponse(res, {
      statusCode: StatusCodes.CREATED,
      success: true,
      message: 'Leavemanagement created successfully',
      data: result,
    });
  });
  
  const updateLeavemanagement = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const leavemanagementData = req.body;
    const result = await LeavemanagementServices.updateLeavemanagement(req.user!, id, leavemanagementData);
    
    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: 'Leavemanagement updated successfully',
      data: result,
    });
  });
  
  const getSingleLeavemanagement = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const result = await LeavemanagementServices.getSingleLeavemanagement(id);
    
    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: 'Leavemanagement retrieved successfully',
      data: result,
    });
  });
  
  const getAllLeavemanagements = catchAsync(async (req: Request, res: Response) => {
    const filters = pick(req.query, leavemanagementFilterables);
    const result = await LeavemanagementServices.getAllLeavemanagements(req.user!, filters);
    
    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: 'Leavemanagements retrieved successfully',
      data: result,
    });
  });
  
  const deleteLeavemanagement = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const result = await LeavemanagementServices.deleteLeavemanagement(req.user!, id);
    
    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: 'Leavemanagement deleted successfully',
      data: result,
    });
  });
  


  export const LeavemanagementController = {
    createLeavemanagement,
    updateLeavemanagement,
    getSingleLeavemanagement,
    getAllLeavemanagements,
    deleteLeavemanagement,

  };