import { Request, Response, NextFunction } from 'express'

import { StatusCodes } from 'http-status-codes'
import catchAsync from '../../../shared/catchAsync'
import sendResponse from '../../../shared/sendResponse'

import { UserServices } from './user.service'
import pick from '../../../shared/pick'
import { paginationFields } from '../../../interfaces/pagination'
import { userFilterables } from './user.constants'



const updateProfile = catchAsync(async (req: Request, res: Response) => {
  const { images, ...userData } = req.body
  if (images.length > 0) {
    userData.profile = images[0]
  }
  const result = await UserServices.updateProfile(req.user!, userData)
  sendResponse<String>(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Profile updated successfully',
    data: result,
  })
})


const getAllUsers = catchAsync(async (req: Request, res: Response) => {
  const pagination = pick(req.query, paginationFields)
  const filter = pick(req.query, userFilterables)

  const result = await UserServices.generalGetAllUsers(req.user!, filter,pagination )
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Users retrieved successfully',
    data: result,
  })
})

const getProfile = catchAsync(async (req: Request, res: Response) => {
  const result = await UserServices.getProfile(req.user!)
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Profile retrieved successfully',
    data: result,
  })
})

const getSingleUser = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params
  const result = await UserServices.getSingleUser(id)
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'User retrieved successfully',
    data: result,
  })
})

const getWorkingHoursSummary = catchAsync(async (req: Request, res: Response) => {
  const date = req.query.date as string

  const result = await UserServices.getWorkingHoursSummary(req.user!, date)
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Working hours summary retrieved successfully',
    data: result,
  })
})

const getBreakHoursChart = catchAsync(async (req: Request, res: Response) => {
  const result = await UserServices.getBreakHoursChart(req.user!)
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Break hours chart data retrieved successfully',
    data: result,
  })
})

const getTodaysBreakPeriods = catchAsync(async (req: Request, res: Response) => {
  const result = await UserServices.getTodaysBreakPeriods(req.user!, req.query.date as string)
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Today\'s break periods retrieved successfully',
    data: result,
  })
})

const deleteUser = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params
  const result = await UserServices.deleteUser(req.user!, id)
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: result,
  })
})

const adminUpdateUser = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params
  const { images, ...userData } = req.body
  if (images && images.length > 0) {
    userData.profile = images[0]
  }
  const result = await UserServices.adminUpdateUser(req.user!, id, userData)
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'User updated successfully',
    data: result,
  })
})

export const UserController = {
  getAllUsers,
  getProfile,
  updateProfile,
  getSingleUser,
  getWorkingHoursSummary,
  getBreakHoursChart,
  getTodaysBreakPeriods,
  deleteUser,
  adminUpdateUser,
}
