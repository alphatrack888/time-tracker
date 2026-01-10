import { Request, Response } from 'express';
  import { LeavebalanceServices } from './leavebalance.service';
  import catchAsync from '../../../shared/catchAsync';
  import sendResponse from '../../../shared/sendResponse';
  import { StatusCodes } from 'http-status-codes';
  
  const createLeavebalance = catchAsync(async (req: Request, res: Response) => {
    const leavebalanceData = req.body;
    const result = await LeavebalanceServices.createLeavebalance(req.user!, leavebalanceData);
    
    sendResponse(res, {
      statusCode: StatusCodes.CREATED,
      success: true,
      message: 'Leavebalance updated successfully',
      data: result,
    });
  });
  
  const updateLeavebalance = catchAsync(async (req: Request, res: Response) => {
    const leavebalanceData = req.body;
    const result = await LeavebalanceServices.updateLeavebalance(req.user!, leavebalanceData);
    
    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: 'Leavebalance updated successfully',
      data: result,
    });
  });
  
  const getSingleLeavebalance = catchAsync(async (req: Request, res: Response) => {
 
    const result = await LeavebalanceServices.getSingleLeavebalance(req.user!);
    
    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: 'Leavebalance retrieved successfully',
      data: result,
    });
  });
  
  const getLeaveBalanceByCompany = catchAsync(async (req: Request, res: Response) => {
    const result = await LeavebalanceServices.getLeaveBalanceByCompany(req.params.companyId);
    
    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: 'Leavebalances retrieved successfully',
      data: result,
    });
  });
  
  const deleteLeavebalance = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const result = await LeavebalanceServices.deleteLeavebalance(id);
    
    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: 'Leavebalance deleted successfully',
      data: result,
    });
  });
  
  export const LeavebalanceController = {
    createLeavebalance,
    updateLeavebalance,
    getSingleLeavebalance,
    getLeaveBalanceByCompany,
    deleteLeavebalance,
  };