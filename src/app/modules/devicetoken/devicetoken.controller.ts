import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { DeviceTokenServices } from './devicetoken.service';

const registerDevice = catchAsync(async (req: Request, res: Response) => {
  const { token, platform, appVersion } = req.body;
  const result = await DeviceTokenServices.registerDeviceToken(req.user!, {
    token,
    platform,
    appVersion,
  });

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Device registered successfully',
    data: result,
  });
});

const deregisterDevice = catchAsync(async (req: Request, res: Response) => {
  const { token } = req.params;
  const result = await DeviceTokenServices.deregisterDeviceToken(req.user!, token);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Device deregistered successfully',
    data: result,
  });
});

const listMyDevices = catchAsync(async (req: Request, res: Response) => {
  const result = await DeviceTokenServices.listMyDevices(req.user!);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Devices retrieved successfully',
    data: result,
  });
});

export const DeviceTokenController = {
  registerDevice,
  deregisterDevice,
  listMyDevices,
};
