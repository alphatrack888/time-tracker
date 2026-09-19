import { Request, Response } from 'express';
  import { PayroleServices } from './payrole.service';
  import catchAsync from '../../../shared/catchAsync';
  import sendResponse from '../../../shared/sendResponse';
  import { StatusCodes } from 'http-status-codes';
import pick from '../../../shared/pick';
import { payroleFilterables } from './payrole.constants';
  
  const createPayrole = catchAsync(async (req: Request, res: Response) => {
    const {documents,...payroleData} = req.body;

    const {employeeId} = req.params;
    if(documents && documents.length > 0){
      payroleData.files = documents;
    }
    const result = await PayroleServices.createPayrole(req.user!,employeeId,payroleData);
    
    sendResponse(res, {
      statusCode: StatusCodes.CREATED,
      success: true,
      message: 'Payrole created successfully',
      data: result,
    });
  });
  
  const updatePayrole = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const {documents,...payroleData} = req.body;
    if(documents && documents.length > 0){
      payroleData.files = documents;
    }
    const result = await PayroleServices.updatePayrole(req.user!, id, payroleData);
    
    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: 'Payrole updated successfully',
      data: result,
    });
  });
  
  const getSinglePayrole = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const result = await PayroleServices.getSinglePayrole(req.user!, id);
    
    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: 'Payrole retrieved successfully',
      data: result,
    });
  });
  
  const getAllPayroles = catchAsync(async (req: Request, res: Response) => {
    const filters = pick(req.query, payroleFilterables);
    const result = await PayroleServices.getAllPayroles(req.user!,filters);
    
    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: 'Payroles retrieved successfully',
      data: result,
    });
  });
  
  const deletePayrole = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const result = await PayroleServices.deletePayrole(req.user!, id);
    
    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: 'Payrole deleted successfully',
      data: result,
    });
  });
  
  export const PayroleController = {
    createPayrole,
    updatePayrole,
    getSinglePayrole,
    getAllPayroles,
    deletePayrole,
  };