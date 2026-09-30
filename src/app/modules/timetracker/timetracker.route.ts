import express from 'express';
import { TimeTrackerController } from './timetracker.controller';
import auth from '../../middleware/auth';
import validateRequest from '../../middleware/validateRequest';
import { TimeTrackerValidations } from './timetracker.validation';
import { USER_ROLES } from '../../../enum/user';
import { ReportJobController } from '../reportjob/reportjob.controller';

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

// Single-employee only (an explicit `employee` is required for every role
// but EMPLOYEES, who are locked to themselves) — this is what keeps this
// endpoint "small" enough to stay synchronous. A company-wide attendance
// report (no `employee` filter) is only available through the async report
// job endpoints below.
router.get(
  '/reports/attendance',
  auth(
    USER_ROLES.COMPANY,
    USER_ROLES.ADMIN,
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.EMPLOYEES,
  ),
  validateRequest(TimeTrackerValidations.getAttendanceReportZodSchema),
  TimeTrackerController.getAttendanceReport
);

// Async path for a company-wide (or, for admins, cross-company)
// attendance report — see the comment on GET /reports/attendance above.
// COMPANY requesters are always scoped to their own company; ADMIN/
// SUPER_ADMIN may scope to one company via `company` in the body, or omit
// it for a report spanning every company (see reportjob.service.ts).
router.post(
  '/reports/attendance/async',
  auth(USER_ROLES.COMPANY, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  validateRequest(TimeTrackerValidations.requestAsyncAttendanceReportZodSchema),
  ReportJobController.requestAttendanceReportJob
);

// Registered before /reports/jobs/:jobId — a distinct path shape (no
// trailing segment), but kept in this order for the same reason the
// notifications routes put /all before /:id: specific-looking routes
// first avoids any ambiguity as routes are added later.
router.get(
  '/reports/jobs',
  auth(
    USER_ROLES.COMPANY,
    USER_ROLES.ADMIN,
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.EMPLOYEES,
  ),
  validateRequest(TimeTrackerValidations.listReportJobsZodSchema),
  ReportJobController.listJobs
);

router.get(
  '/reports/jobs/:jobId',
  auth(
    USER_ROLES.COMPANY,
    USER_ROLES.ADMIN,
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.EMPLOYEES,
  ),
  ReportJobController.getJobStatus
);

export const TimeTrackerRoutes = router;