import express from 'express';
import { TimeTrackerController } from './timetracker.controller';
import auth from '../../middleware/auth';
import validateRequest from '../../middleware/validateRequest';
import { TimeTrackerValidations } from './timetracker.validation';
import { USER_ROLES } from '../../../enum/user';

const router = express.Router();

router.post(
  '/start',
  auth(USER_ROLES.EMPLOYEES),
  validateRequest(TimeTrackerValidations.startTimerZodSchema),
  TimeTrackerController.startTimer
);

router.post(
  '/pause/:sessionId',

  auth(USER_ROLES.EMPLOYEES),
  validateRequest(TimeTrackerValidations.pauseTimerZodSchema),
  TimeTrackerController.pauseTimer
);

router.post(
  '/resume/:sessionId',

  auth(USER_ROLES.EMPLOYEES),
  validateRequest(TimeTrackerValidations.resumeTimerZodSchema),
  TimeTrackerController.resumeTimer
);

router.post(
  '/stop/:sessionId',

  auth(USER_ROLES.EMPLOYEES, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  validateRequest(TimeTrackerValidations.stopTimerZodSchema),
  TimeTrackerController.stopTimer
);

router.get(
  '/summary',
  auth(USER_ROLES.EMPLOYEES, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  validateRequest(TimeTrackerValidations.getDailySummaryZodSchema),
  TimeTrackerController.getDailySummary
);

router.post(
  '/location',
  auth(USER_ROLES.EMPLOYEES),
  validateRequest(TimeTrackerValidations.addPeriodicLocationZodSchema),
  TimeTrackerController.addPeriodicLocation
);

router.get(
  '/session/:sessionId/locations',
  auth(USER_ROLES.EMPLOYEES),
  validateRequest(TimeTrackerValidations.getSessionLocationsZodSchema),
  TimeTrackerController.getSessionLocations
);

router.get(
  '/locations',
  auth(USER_ROLES.COMPANY),
  validateRequest(TimeTrackerValidations.getLocationsByDateZodSchema),
  TimeTrackerController.getLocationsByDate
);

router.get(
  '/reports/monthly',
  auth(
    USER_ROLES.COMPANY,
    USER_ROLES.ADMIN,
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.EMPLOYEES,
  ),
  validateRequest(TimeTrackerValidations.getMonthlyReportZodSchema),
  TimeTrackerController.getMonthlyPdfReport
);

export const TimeTrackerRoutes = router;