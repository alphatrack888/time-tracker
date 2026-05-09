import express from 'express'
import { UserController } from './user.controller'
import { UserValidations } from './user.validation'
import validateRequest from '../../middleware/validateRequest'
import auth from '../../middleware/auth'
import { USER_ROLES } from '../../../enum/user'
import {
  fileAndBodyProcessorUsingDiskStorage,
} from '../../middleware/processReqBody'

const router = express.Router()



router.get(
  '/',
  auth(
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.ADMIN,
    USER_ROLES.EMPLOYEES,
    USER_ROLES.COMPANY,
  ),
  UserController.getAllUsers,
)

router.get(
  '/profile',
  auth(
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.ADMIN,
    USER_ROLES.EMPLOYEES,
    USER_ROLES.COMPANY,
  ),
  UserController.getProfile,
)

router.patch(
  '/profile',
  auth(
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.ADMIN,
    USER_ROLES.EMPLOYEES,
    USER_ROLES.COMPANY,
  ),
  fileAndBodyProcessorUsingDiskStorage(),
  validateRequest(UserValidations.updateUserZodSchema),
  UserController.updateProfile,
)

// API 1: Get working hours summary (today, this week, this month)
router.get(
  '/working-hours-summary',
  auth(
    USER_ROLES.EMPLOYEES,
  ),
  UserController.getWorkingHoursSummary,
)

// API 2: Get break hours for last 7 days in bar chart format
router.get(
  '/break-hours-chart',
  auth(
    USER_ROLES.EMPLOYEES,
  ),
  UserController.getBreakHoursChart,
)

// API 3: Get today's break periods from time sessions
router.get(
  '/todays-break-periods',
  auth(
    USER_ROLES.EMPLOYEES,
  ),
  UserController.getTodaysBreakPeriods,
)
router.get(
  '/:id',
  auth(
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.ADMIN,
    USER_ROLES.EMPLOYEES,
    USER_ROLES.COMPANY,
  ),
  UserController.getSingleUser,
)

router.patch(
  '/:id',
  auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.COMPANY),
  fileAndBodyProcessorUsingDiskStorage(),
  validateRequest(UserValidations.adminUpdateUserZodSchema),
  UserController.adminUpdateUser,
)

router.delete(
  '/:id',
  // auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.COMPANY),
  UserController.deleteUser,
)

export const UserRoutes = router
