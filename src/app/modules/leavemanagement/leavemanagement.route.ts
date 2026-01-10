import express from 'express';
import { LeavemanagementController } from './leavemanagement.controller';
import auth from '../../middleware/auth';
import { USER_ROLES } from '../../../enum/user';
import validateRequest from '../../middleware/validateRequest';
import { LeavemanagementValidations } from './leavemanagement.validation';

const router = express.Router();

router.post('/',auth(USER_ROLES.EMPLOYEES),validateRequest(LeavemanagementValidations.create), LeavemanagementController.createLeavemanagement);
router.get('/', auth(USER_ROLES.EMPLOYEES, USER_ROLES.COMPANY), LeavemanagementController.getAllLeavemanagements);
router.get('/:id', auth(USER_ROLES.EMPLOYEES, USER_ROLES.COMPANY), LeavemanagementController.getSingleLeavemanagement);
router.patch('/:id', auth(USER_ROLES.COMPANY), validateRequest(LeavemanagementValidations.update), LeavemanagementController.updateLeavemanagement);
router.delete('/:id', auth(USER_ROLES.EMPLOYEES), LeavemanagementController.deleteLeavemanagement);


export const LeavemanagementRoutes = router;
