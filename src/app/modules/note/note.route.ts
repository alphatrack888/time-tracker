import express from 'express';
import { NoteController } from './note.controller';
import auth from '../../middleware/auth';
import { USER_ROLES } from '../../../enum/user';
import { fileAndBodyProcessor, fileAndBodyProcessorUsingDiskStorage } from '../../middleware/processReqBody';
import validateRequest from '../../middleware/validateRequest';
import { NoteValidations } from './note.validation';

const router = express.Router();

router.post('/:projectId',auth(USER_ROLES.COMPANY, USER_ROLES.EMPLOYEES),fileAndBodyProcessorUsingDiskStorage(), validateRequest(NoteValidations.create), NoteController.createNote);
router.get('/',auth(USER_ROLES.COMPANY, USER_ROLES.EMPLOYEES), NoteController.getAllNotes);
router.get('/:id',auth(USER_ROLES.COMPANY, USER_ROLES.EMPLOYEES), NoteController.getSingleNote);
router.patch('/:id',auth(USER_ROLES.COMPANY, USER_ROLES.EMPLOYEES),fileAndBodyProcessorUsingDiskStorage(), validateRequest(NoteValidations.update), NoteController.updateNote);
router.delete('/:id',auth(USER_ROLES.COMPANY, USER_ROLES.EMPLOYEES), NoteController.deleteNote);

export const NoteRoutes = router;
