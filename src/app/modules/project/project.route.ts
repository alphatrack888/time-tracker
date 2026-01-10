import express from 'express';
import { ProjectController } from './project.controller';
import auth from '../../middleware/auth';
import { USER_ROLES } from '../../../enum/user';
import validateRequest from '../../middleware/validateRequest';
import { ProjectValidations } from './project.validation';
import { fileAndBodyProcessorUsingDiskStorage } from '../../middleware/processReqBody';

const router = express.Router();

router.post('/',auth(USER_ROLES.COMPANY),fileAndBodyProcessorUsingDiskStorage(), validateRequest(ProjectValidations.create), ProjectController.createProject);
router.get('/', auth(USER_ROLES.COMPANY, USER_ROLES.EMPLOYEES, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN), ProjectController.getAllProjects);
router.get('/:id', auth(USER_ROLES.COMPANY, USER_ROLES.EMPLOYEES, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN), ProjectController.getSingleProject);
router.patch('/:id', auth(USER_ROLES.COMPANY),fileAndBodyProcessorUsingDiskStorage(),validateRequest(ProjectValidations.update), ProjectController.updateProject);
router.delete('/:id', auth(USER_ROLES.COMPANY), ProjectController.deleteProject);

export const ProjectRoutes = router;
