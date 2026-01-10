import express from 'express';
import { GalleryController } from './gallery.controller';
import auth from '../../middleware/auth';
import { USER_ROLES } from '../../../enum/user';
import { fileAndBodyProcessorUsingDiskStorage } from '../../middleware/processReqBody';
import validateRequest from '../../middleware/validateRequest';
import { GalleryValidations } from './gallery.validation';

const router = express.Router();

router.post('/',auth(USER_ROLES.EMPLOYEES),fileAndBodyProcessorUsingDiskStorage(), validateRequest(GalleryValidations.create), GalleryController.createGallery);
router.get('/',auth(USER_ROLES.EMPLOYEES), GalleryController.getAllGallerys);
// router.get('/:id',auth(USER_ROLES.EMPLOYEES), GalleryController.getSingleGallery);
// router.patch('/:id',auth(USER_ROLES.EMPLOYEES), validateRequest(GalleryValidations.update), GalleryController.updateGallery);
router.delete('/',auth(USER_ROLES.EMPLOYEES), validateRequest(GalleryValidations.delete), GalleryController.deleteImages);

export const GalleryRoutes = router;
