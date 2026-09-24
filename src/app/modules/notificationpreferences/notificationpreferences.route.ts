import express from 'express';
import auth from '../../middleware/auth';
import validateRequest from '../../middleware/validateRequest';
import { USER_ROLES } from '../../../enum/user';
import { NotificationPreferenceController } from './notificationpreferences.controller';
import { NotificationPreferenceValidations } from './notificationpreferences.validation';

const router = express.Router();

const anyAuthenticatedRole = [
  USER_ROLES.EMPLOYEES,
  USER_ROLES.COMPANY,
  USER_ROLES.ADMIN,
  USER_ROLES.SUPER_ADMIN,
];

router.get('/', auth(...anyAuthenticatedRole), NotificationPreferenceController.getMyPreferences);
router.patch(
  '/',
  auth(...anyAuthenticatedRole),
  validateRequest(NotificationPreferenceValidations.update),
  NotificationPreferenceController.updateMyPreferences,
);

export const NotificationPreferenceRoutes = router;
