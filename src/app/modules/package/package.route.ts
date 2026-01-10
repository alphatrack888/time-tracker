import express from 'express';
import { PackageController } from './package.controller';
import auth from '../../middleware/auth';
import { USER_ROLES } from '../../../enum/user';
import validateRequest from '../../middleware/validateRequest';
import { PackageValidations } from './package.validation';

const router = express.Router();

router.post('/',auth(USER_ROLES.SUPER_ADMIN),validateRequest(PackageValidations.create), PackageController.createPackage);
router.get('/', PackageController.getAllPackages);
router.get('/:id', PackageController.getSinglePackage);
router.patch('/:id',auth(USER_ROLES.SUPER_ADMIN),validateRequest(PackageValidations.update), PackageController.updatePackage);
router.delete('/:id',auth(USER_ROLES.SUPER_ADMIN), PackageController.deletePackage);

export const PackageRoutes = router;
