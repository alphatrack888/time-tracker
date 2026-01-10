import { StatusCodes } from 'http-status-codes';
import ApiError from '../../../errors/ApiError';
import { INote, INoteFilters } from './note.interface';
import { Note } from './note.model';
import { JwtPayload } from 'jsonwebtoken';
import { emitEvent } from '../../../helpers/socketInstances';

const createNote = async (user:JwtPayload,payload: INote) => {

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
  const andConditions = [];
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

  if(!filters.createdBy){
    andConditions.push({
      createdBy: user.authId,
    });
  }
  
  const whereConditions = andConditions.length > 0 ? {
    $and: andConditions,
  } : {};
  
  
 
  const result = await Note.find(whereConditions).populate({
    path:'createdBy'
  }).lean();
  return result;
};

const getSingleNote = async (id: string) => {
  const result = await Note.findById(id).populate({
    path:'createdBy'
  }).lean();
  if (!result) {
    throw new ApiError(
      StatusCodes.NOT_FOUND,
      'Requested note not found, please try again with valid id',
    );
  }
  return result;
};

const updateNote = async (
  id: string,
  payload: Partial<INote>,
) => {
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

const deleteNote = async (id: string) => {
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
