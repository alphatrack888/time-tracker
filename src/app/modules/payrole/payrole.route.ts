import express from 'express';
import { PayroleController } from './payrole.controller';
import auth from '../../middleware/auth';
import { USER_ROLES } from '../../../enum/user';
import { fileAndBodyProcessorUsingDiskStorage } from '../../middleware/processReqBody';


import validateRequest from '../../middleware/validateRequest';
import { PayroleValidations } from './payrole.validation';

const router = express.Router();

router.post('/:employeeId',auth(USER_ROLES.COMPANY), fileAndBodyProcessorUsingDiskStorage(),validateRequest(PayroleValidations.create), PayroleController.createPayrole);
router.get('/', auth(USER_ROLES.COMPANY, USER_ROLES.EMPLOYEES), PayroleController.getAllPayroles);
router.get('/:id', auth(USER_ROLES.COMPANY, USER_ROLES.EMPLOYEES), PayroleController.getSinglePayrole);
router.patch('/:id', auth(USER_ROLES.COMPANY, USER_ROLES.EMPLOYEES), fileAndBodyProcessorUsingDiskStorage(),validateRequest(PayroleValidations.update), PayroleController.updatePayrole);
router.delete('/:id', auth(USER_ROLES.COMPANY), PayroleController.deletePayrole);

export const PayroleRoutes = router;
