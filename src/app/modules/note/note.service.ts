import { StatusCodes } from 'http-status-codes';
import ApiError from '../../../errors/ApiError';
import { INote, INoteFilters } from './note.interface';
import { Note } from './note.model';
import { JwtPayload } from 'jsonwebtoken';
import { emitEvent } from '../../../helpers/socketInstances';
import { Project } from '../project/project.model';
import { USER_ROLES } from '../../../enum/user';

// Notes are shared within a project's team (see the `note::<projectId>`
// broadcast in createNote below), so access is governed by project
// membership, not solely by who authored the note: COMPANY must own the
// project, EMPLOYEES must be assigned to it.
const assertProjectAccess = async (user: JwtPayload, projectId: string) => {
  const filter: Record<string, unknown> = { _id: projectId }
  if (user.role === USER_ROLES.COMPANY) filter.company = user.authId
  if (user.role === USER_ROLES.EMPLOYEES) filter.employees = { $in: [user.authId] }

  const project = await Project.findOne(filter).select('_id').lean()
  if (!project) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'You do not have access to this project')
  }
}

const getAccessibleProjectIds = async (user: JwtPayload) => {
  const filter: Record<string, unknown> = {}
  if (user.role === USER_ROLES.COMPANY) filter.company = user.authId
  if (user.role === USER_ROLES.EMPLOYEES) filter.employees = { $in: [user.authId] }

  const projects = await Project.find(filter).select('_id').lean()
  return projects.map((p) => p._id)
}

const createNote = async (user:JwtPayload,payload: INote) => {
  await assertProjectAccess(user, payload.project as unknown as string)

  payload.createdBy = user.authId;
  const result = await Note.create(payload);
  if (!result)
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Failed to create Note, please try again with valid data.',
    );

   const populatedNoteData = await Note.findById(result._id).populate({
    path:'createdBy'
   }).lean()
   
    emitEvent(`note::${result.project}`,populatedNoteData)

  return result;
};

const getAllNotes = async (user:JwtPayload, filters:INoteFilters) => {
  // Always bound results to projects the caller can actually access — a
  // `project`/`createdBy` filter narrows within that boundary, it never
  // escapes it.
  const accessibleProjectIds = await getAccessibleProjectIds(user)
  const andConditions: Record<string, unknown>[] = [{ project: { $in: accessibleProjectIds } }];

  if (filters.project) {
    andConditions.push({
      project: filters.project,
    });
  }
  if (filters.createdBy) {
    andConditions.push({
      createdBy: filters.createdBy,
    });
  }

  if(!filters.createdBy && !filters.project){
    andConditions.push({
      createdBy: user.authId,
    });
  }

  const whereConditions = { $and: andConditions };



  const result = await Note.find(whereConditions).populate({
    path:'createdBy'
  }).lean();
  return result;
};

const getSingleNote = async (user: JwtPayload, id: string) => {
  const result = await Note.findById(id).populate({
    path:'createdBy'
  }).lean();
  if (!result) {
    throw new ApiError(
      StatusCodes.NOT_FOUND,
      'Requested note not found, please try again with valid id',
    );
  }

  await assertProjectAccess(user, result.project.toString())

  return result;
};

const updateNote = async (
  user: JwtPayload,
  id: string,
  payload: Partial<INote>,
) => {
  const existing = await Note.findById(id).select('project').lean()
  if (!existing) {
    throw new ApiError(
      StatusCodes.NOT_FOUND,
      'Requested note not found, please try again with valid id',
    );
  }
  await assertProjectAccess(user, existing.project.toString())

  const result = await Note.findByIdAndUpdate(
    id,
    { $set: payload },
    {
      new: true,
    },
  );

  if(!result){
    throw new ApiError(
      StatusCodes.NOT_FOUND,
      'Requested note not found, please try again with valid id',
    );
  }

  return result;
};

const deleteNote = async (user: JwtPayload, id: string) => {
  const existing = await Note.findById(id).select('project').lean()
  if (!existing) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Failed to delete note, please try again with valid id',
    );
  }
  await assertProjectAccess(user, existing.project.toString())

  const result = await Note.findByIdAndDelete(id);
  if (!result) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Failed to delete note, please try again with valid id',
    );
  }
  return result;
};

export const NoteServices = {
  createNote,
  getAllNotes,
  getSingleNote,
  updateNote,
  deleteNote,
};
