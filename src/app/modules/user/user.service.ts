import { StatusCodes } from 'http-status-codes'
import ApiError from '../../../errors/ApiError'
import { IUser, IUserFilter } from './user.interface'
import { User } from './user.model'

import { USER_ROLES, USER_STATUS } from '../../../enum/user'

import { JwtPayload } from 'jsonwebtoken'
import { logger } from '../../../shared/logger'
import config from '../../../config'
import { IPaginationOptions } from '../../../interfaces/pagination'
import { paginationHelper } from '../../../helpers/paginationHelper'
import { TimeSession } from '../timetracker/timetracker.model'
import { Types } from 'mongoose'
import { IProject } from '../project/project.interface'



const updateProfile = async (user: JwtPayload, payload: Partial<IUser>) => {
  // console.log(first)
  const updatedProfile = await User.findOneAndUpdate(
    { _id: user.authId, status: { $nin: [USER_STATUS.DELETED] } },
    {
      $set: payload,
    },
    { new: true },
  )

  if (!updatedProfile) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Failed to update profile.')
  }

  return 'Profile updated successfully.'
}

const createAdmin = async (): Promise<Partial<IUser> | null> => {
  const admin = {
    email: config.super_admin.email,
    name: 'SUPER_ADMIN',
    password: config.super_admin.password,
    role: USER_ROLES.SUPER_ADMIN,
    status: USER_STATUS.ACTIVE,
    verified: true,
    authentication: {
      oneTimeCode: null,
      restrictionLeftAt: null,
      expiresAt: null,
      latestRequestAt: new Date(),
      authType: '',
    },
    
  }

  const isAdminExist = await User.findOne({
    email: config.super_admin.email,
    status: { $nin: [USER_STATUS.DELETED] },
  }).select('+email +phone').lean()

  if (isAdminExist) {
    logger.log('info', 'Admin account already exist, skipping creation.🦥')
    return isAdminExist
  }
  const result = await User.create([admin])
  if (!result) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Failed to create admin')
  }
  return result[0]
}

export const generalGetAllUsers = async(user:JwtPayload, filter:IUserFilter, paginationOptions:IPaginationOptions)=>{
  const{page,limit,skip,sortBy,sortOrder} = paginationHelper.calculatePagination(paginationOptions)
  const {searchTerm, latitude, longitude, fromLat, toLat, fromLong, toLong, distance, ...restFilters} = filter

  const andCondition = []

  if(Object.keys(restFilters).length){
    andCondition.push({$and: Object.entries(restFilters).map(([key, value]) => ({ [key]: value }))})
  }


  
  
  if (latitude && longitude && distance) {
    andCondition.push({
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [longitude, latitude],
          },
          $maxDistance: distance,
        },
      },
    });
  } 
    

  // Exclude deleted users
  andCondition.push({ status: { $ne: USER_STATUS.DELETED } })

  const whereCondition = andCondition.length ? { $and: andCondition } : {}
  console.log(whereCondition)
  const [result, total] = await Promise.all([
    User.find(whereCondition).populate('company').skip(skip).limit(limit).sort({[sortBy]:sortOrder}),
    User.countDocuments(whereCondition)
  ])


  return {
    meta:{
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    data: result
  }
}


const getProfile = async (user:JwtPayload) => {
  const result = await User.findById(user.authId).populate('company').lean()
  if (!result) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'The requested user not found!')
  }
  return result
}

const getSingleUser = async (id: string) => {
  const result = await User.findById(id).populate('company').lean()
  if (!result) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'The requested user not found!')
  }
  return result
}

// API 1: Get working hours summary (today, this week, this month)
const getWorkingHoursSummary = async (user: JwtPayload, date?: string) => {
  console.log(date)
  const now = new Date(date || new Date().toISOString().split('T')[0])
  const today = now.toISOString().split('T')[0] // YYYY-MM-DD
  
  // Calculate week start (Monday)
  const weekStart = new Date(now)
  const dayOfWeek = weekStart.getDay()
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  weekStart.setDate(weekStart.getDate() - daysToMonday)
  const weekStartStr = weekStart.toISOString().split('T')[0]
  
  // Calculate month start
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthStartStr = monthStart.toISOString().split('T')[0]
  console.log(now)
  const [todaySessions, weekSessions, monthSessions] = await Promise.all([
    TimeSession.find({ user: new Types.ObjectId(user.authId), date: today}).lean(),
    TimeSession.find({ 
      user: user.authId, 
      date: { $gte: weekStartStr, $lte: now } 
    }).lean(),
    TimeSession.find({ 
      user: user.authId, 
      date: { $gte: monthStartStr, $lte: now } 
    }).lean()
  ])
  
  const calculateWorkingHours = (sessions: any[]) => {
    return sessions.reduce((sum, session) => sum + (session.totalTime || 0), 0) / (1000 * 60 * 60)
  }
  
  return {
    today: Math.round(calculateWorkingHours(todaySessions) * 100) / 100,
    thisWeek: Math.round(calculateWorkingHours(weekSessions) * 100) / 100,
    thisMonth: Math.round(calculateWorkingHours(monthSessions) * 100) / 100
  }
}

// API 2: Get break hours for last 7 days in bar chart format
const getBreakHoursChart = async (user: JwtPayload) => {
  const now = new Date()
  const dates: { date: string; dayName: string }[] = []
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  // ✅ Generate last 7 days (today + previous 6 days)
  for (let i = 6; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(now.getDate() - i)
    dates.push({
      date: date.toISOString().split('T')[0], // YYYY-MM-DD
      dayName: dayNames[date.getDay()],
    })
  }

  // ✅ Fetch sessions only for these 7 days
  const sessions = await TimeSession.find({
    user: user.authId,
    date: { $in: dates.map((d) => d.date) },
  }).lean()

  // ✅ Build [day:value] for each of 7 days
  const result = dates.map(({ date, dayName }) => {
    const daySessions = sessions.filter((s) => s.date === date)

    const totalBreakMs = daySessions.reduce((sum, session) => {
      if (session.pauses && session.pauses.length > 0) {
        const sessionBreakTime = session.pauses.reduce(
          (pauseSum: number, pause: any) => {
            if (pause.start && pause.end) {
              return (
                pauseSum +
                (new Date(pause.end).getTime() -
                  new Date(pause.start).getTime())
              )
            }
            return pauseSum
          },
          0
        )
        return sum + sessionBreakTime
      }
      return sum
    }, 0)

    const breakHours =
      Math.round((totalBreakMs / (1000 * 60 * 60)) * 100) / 100

    return { [dayName]: breakHours }
  })

  // ✅ Merge into a single object: { Sun:0, Mon:1.5, ... }
  return result.reduce((acc, curr) => ({ ...acc, ...curr }), {})
}


// API 3: Get today's break periods from time sessions
const getTodaysBreakPeriods = async (user: JwtPayload, date?: string) => {
   console.log(date)
  const now = new Date(date || new Date().toISOString().split('T')[0])
  const today = now.toISOString().split('T')[0] // YYYY-MM-DD
  const sessions = await TimeSession.find({
    user: user.authId,
    date: today
  }).populate<{project: IProject}>('project', 'title').lean()
  console.log(sessions)
  const breakPeriods: any[] = []
  
  sessions.forEach(session => {
    if (session.pauses && session.pauses.length > 0) {
      session.pauses.forEach((pause: any) => {
        if (pause.start && pause.end) {
          const duration = new Date(pause.end).getTime() - new Date(pause.start).getTime()
          const durationMinutes = Math.round(duration / (1000 * 60))
          
          breakPeriods.push({
            projectName: session.project?.title || 'No Project',
            startTime: pause.start,
            endTime: pause.end,
            durationMinutes,
            durationHours: Math.round((duration / (1000 * 60 * 60)) * 100) / 100
          })
        }
      })
    }
  })
  
  // Sort by start time
  breakPeriods.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
  
  return {
    date: today,
    totalBreakPeriods: breakPeriods.length,
    totalBreakTime: breakPeriods.reduce((sum, period) => sum + period.durationMinutes, 0),
    breakPeriods
  }
}

const deleteUser = async (user: JwtPayload, id: string) => {
  const targetUser = await User.findById(id)
  if (!targetUser) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'User not found')
  }

  if (targetUser.status === USER_STATUS.DELETED) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'User is already deleted')
  }

  // Admin can delete anyone
  if (user.role === USER_ROLES.SUPER_ADMIN) {
    targetUser.status = USER_STATUS.DELETED
    await targetUser.save()
    return 'User deleted successfully'
  }

  // Company can only delete employees belonging to them
  if (user.role === USER_ROLES.COMPANY) {
    if (targetUser.role !== USER_ROLES.EMPLOYEES) {
      throw new ApiError(StatusCodes.FORBIDDEN, 'Company can only delete employee accounts')
    }
    if (targetUser.company?.toString() !== user.authId) {
      throw new ApiError(StatusCodes.FORBIDDEN, 'You can only delete employees belonging to your company')
    }
    targetUser.status = USER_STATUS.DELETED
    await targetUser.save()
    return 'Employee deleted successfully'
  }

  throw new ApiError(StatusCodes.FORBIDDEN, 'You do not have permission to delete users')
}

export const UserServices = { 
  updateProfile, 
  createAdmin, 
  generalGetAllUsers, 
  getProfile, 
  getSingleUser,
  getWorkingHoursSummary,
  getBreakHoursChart,
  getTodaysBreakPeriods,
  deleteUser
}

