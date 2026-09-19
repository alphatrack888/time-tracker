import { Request, Response } from 'express';
  import { NoteServices } from './note.service';
  import catchAsync from '../../../shared/catchAsync';
  import sendResponse from '../../../shared/sendResponse';
  import { StatusCodes } from 'http-status-codes';
import pick from '../../../shared/pick';
import { NOTE_FILTERS } from './note.constants';
  
  const createNote = catchAsync(async (req: Request, res: Response) => {
    const {images, documents, audio,...noteData} = req.body;
    const {projectId} = req.params;

    if(images && images?.length > 0) noteData.images = images;
    if(documents && documents?.length > 0) noteData.files = documents;
    if(audio && audio?.length > 0) noteData.audio = audio;

    noteData.project = projectId;
   
    const result = await NoteServices.createNote(req.user!,noteData);
    
    sendResponse(res, {
      statusCode: StatusCodes.CREATED,
      success: true,
      message: 'Note created successfully',
      data: result,
    });
  });
  
  const updateNote = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const {images, documents,...noteData} = req.body;

    if(images && images?.length > 0) noteData.images = images;
    if(documents && documents?.length > 0) noteData.files = documents;

    const result = await NoteServices.updateNote(req.user!, id, noteData);
    
    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: 'Note updated successfully',
      data: result,
    });
  });
  
  const getSingleNote = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const result = await NoteServices.getSingleNote(req.user!, id);
    
    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: 'Note retrieved successfully',
      data: result,
    });
  });
  
  const getAllNotes = catchAsync(async (req: Request, res: Response) => {
    const filters = pick(req.query, NOTE_FILTERS);
    const result = await NoteServices.getAllNotes(req.user!,filters);
    
    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: 'Notes retrieved successfully',
      data: result,
    });
  });
  
  const deleteNote = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const result = await NoteServices.deleteNote(req.user!, id);
    
    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: 'Note deleted successfully',
      data: result,
    });
  });
  
  export const NoteController = {
    createNote,
    updateNote,
    getSingleNote,
    getAllNotes,
    deleteNote,
  };