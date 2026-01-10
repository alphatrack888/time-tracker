import express from 'express';
import { LeavebalanceController } from './leavebalance.controller';
import auth from '../../middleware/auth';
import { USER_ROLES } from '../../../enum/user';
import validateRequest from '../../middleware/validateRequest';
import { LeavebalanceValidations } from './leavebalance.validation';

const router = express.Router();

router.get('/', auth(USER_ROLES.COMPANY), LeavebalanceController.getSingleLeavebalance);
router.post('/', auth(USER_ROLES.COMPANY), validateRequest(LeavebalanceValidations.create), LeavebalanceController.createLeavebalance);
router.get('/company/:companyId', auth(USER_ROLES.COMPANY, USER_ROLES.EMPLOYEES), validateRequest(LeavebalanceValidations.getByCompany), LeavebalanceController.getLeaveBalanceByCompany);
router.patch('/', auth(USER_ROLES.COMPANY), validateRequest(LeavebalanceValidations.update), LeavebalanceController.updateLeavebalance);
router.delete('/:id', auth(USER_ROLES.COMPANY), validateRequest(LeavebalanceValidations.delete), LeavebalanceController.deleteLeavebalance);

export const LeavebalanceRoutes = router;
