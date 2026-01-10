import { Request, Response } from 'express';
  import { PackageServices } from './package.service';
  import catchAsync from '../../../shared/catchAsync';
  import sendResponse from '../../../shared/sendResponse';
  import { StatusCodes } from 'http-status-codes';
  
  const createPackage = catchAsync(async (req: Request, res: Response) => {
    const packageData = req.body;
    const result = await PackageServices.createPackage(packageData);
    
    sendResponse(res, {
      statusCode: StatusCodes.CREATED,
      success: true,
      message: 'Package created successfully',
      data: result,
    });
  });
  
  const updatePackage = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const packageData = req.body;
    const result = await PackageServices.updatePackage(id, packageData);
    
    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: 'Package updated successfully',
      data: result,
    });
  });
  
  const getSinglePackage = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const result = await PackageServices.getSinglePackage(id);
    
    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: 'Package retrieved successfully',
      data: result,
    });
  });
  
  const getAllPackages = catchAsync(async (req: Request, res: Response) => {
    const result = await PackageServices.getAllPackages();
    
    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: 'Packages retrieved successfully',
      data: result,
    });
  });
  
  const deletePackage = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const result = await PackageServices.deletePackage(id);
    
    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: 'Package deleted successfully',
      data: result,
    });
  });
  
  export const PackageController = {
    createPackage,
    updatePackage,
    getSinglePackage,
    getAllPackages,
    deletePackage,
  };