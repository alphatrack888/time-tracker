import { StatusCodes } from 'http-status-codes'
import { Types } from 'mongoose'
import { JwtPayload } from 'jsonwebtoken'
import ApiError from '../../../errors/ApiError'
import { USER_ROLES } from '../../../enum/user'
import { Project } from './project.model'
import { DailyAllocation } from './dailyAllocation.model'

export const setDailyAllocation = async (
  user: JwtPayload,
  projectId: string,
  payload: { employee: string; date: string; hours: number },
) => {
  if (!Types.ObjectId.isValid(projectId) || !Types.ObjectId.isValid(payload.employee)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid project or employee id')
  }

  const project = await Project.findById(projectId).select('company employees').lean()
  if (!project) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Requested project not found')
  }
  if (user.role !== USER_ROLES.COMPANY || project.company.toString() !== user.authId) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'You do not have permission to plan this project')
  }

  const filter = {
    employee: payload.employee,
    project: projectId,
    date: payload.date,
  }

  // A leftover plan can be cleared after the employee is taken off the project.
  if (payload.hours === 0) {
    await DailyAllocation.deleteOne(filter)
    return { date: payload.date, hours: 0 }
  }

  const assigned = (project.employees || []).some((id) => id.toString() === payload.employee)
  if (!assigned) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Employee is not assigned to this project')
  }

  const saved = await DailyAllocation.findOneAndUpdate(
    filter,
    {
      $set: {
        company: user.authId,
        employee: payload.employee,
        project: projectId,
        date: payload.date,
        hours: payload.hours,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  )
  return { date: saved.date, hours: saved.hours }
}
