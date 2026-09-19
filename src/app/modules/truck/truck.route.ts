import express from 'express';
import { TruckController } from './truck.controller';
import auth from '../../middleware/auth';
import { USER_ROLES } from '../../../enum/user';
import validateRequest from '../../middleware/validateRequest';
import { TruckValidations } from './truck.validation';

const router = express.Router();

router.post('/', auth(USER_ROLES.COMPANY), validateRequest(TruckValidations.create), TruckController.createTruck);
router.get('/', auth(USER_ROLES.COMPANY, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN), TruckController.getAllTrucks);
router.get('/:id', auth(USER_ROLES.COMPANY, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN), TruckController.getSingleTruck);
router.patch('/:id', auth(USER_ROLES.COMPANY), validateRequest(TruckValidations.update), TruckController.updateTruck);
router.delete('/:id', auth(USER_ROLES.COMPANY), TruckController.deleteTruck);

export const TruckRoutes = router;
