import { Request, Response } from 'express';
import { TruckServices } from './truck.service';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { StatusCodes } from 'http-status-codes';
import pick from '../../../shared/pick';
import { truckFilterables } from './truck.constants';

const createTruck = catchAsync(async (req: Request, res: Response) => {
  const result = await TruckServices.createTruck(req.user!, req.body);

  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: 'Truck created successfully',
    data: result,
  });
});

const getAllTrucks = catchAsync(async (req: Request, res: Response) => {
  const filters = pick(req.query, truckFilterables);
  const result = await TruckServices.getAllTrucks(req.user!, filters);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Trucks retrieved successfully',
    data: result,
  });
});

const getSingleTruck = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await TruckServices.getSingleTruck(req.user!, id);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Truck retrieved successfully',
    data: result,
  });
});

const updateTruck = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await TruckServices.updateTruck(req.user!, id, req.body);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Truck updated successfully',
    data: result,
  });
});

const deleteTruck = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await TruckServices.deleteTruck(req.user!, id);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Truck deleted successfully',
    data: result,
  });
});

export const TruckController = {
  createTruck,
  getAllTrucks,
  getSingleTruck,
  updateTruck,
  deleteTruck,
};
