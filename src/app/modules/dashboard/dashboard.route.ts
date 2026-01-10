import express from 'express';
import { dashboardController,  } from './dashboard.controller';
import auth from '../../middleware/auth';
import { USER_ROLES } from '../../../enum/user';

const router = express.Router();

router.get('/general-stats',auth(USER_ROLES.SUPER_ADMIN), dashboardController.getSystemAdminGeneralStats);
router.get('/monthly-revenue-stripe',auth(USER_ROLES.SUPER_ADMIN), dashboardController.getMonthlyRevenueFromStripe);
router.get('/total-company-monthly',auth(USER_ROLES.SUPER_ADMIN), dashboardController.totalCompanyMonthly);
router.get('/total-employees-yearly',auth(USER_ROLES.COMPANY), dashboardController.getTotalEmployeesDataYearly);
router.get('/total-project-yearly',auth(USER_ROLES.COMPANY), dashboardController.totalProjectYearlyData);
router.get('/company-general-stats',auth(USER_ROLES.COMPANY), dashboardController.getCompanyGeneralStats);

// Single comprehensive endpoint
router.get('/time-analytics/:userId',auth(USER_ROLES.COMPANY), dashboardController.getTimeAnalyticsController);
router.get('/employee-locations/:userId',auth(USER_ROLES.COMPANY), dashboardController.getEmployeeLocationsController);


export default router;

export const dashboardRoutes = router;
