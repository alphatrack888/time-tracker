import { Request, Response } from 'express';
  import { ProjectServices } from './project.service';
  import catchAsync from '../../../shared/catchAsync';
  import sendResponse from '../../../shared/sendResponse';
  import { StatusCodes } from 'http-status-codes';
import pick from '../../../shared/pick';
import { projectFilterables } from './project.constants';
import { paginationFields } from '../../../interfaces/pagination';
  
  const createProject = catchAsync(async (req: Request, res: Response) => {
    const {images, media, audio, ...projectData} = req.body;
    projectData.images = images?.map((item: string) => item);
    projectData.audio = audio?.[0];
    
    console.log(projectData)
    const result = await ProjectServices.createProject(req.user!,projectData);
    
    sendResponse(res, {
      statusCode: StatusCodes.CREATED,
      success: true,
      message: 'Project created successfully',
      data: result,
    });
  });
  
  const updateProject = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const projectData = req.body;
    const result = await ProjectServices.updateProject(req.user!, id, projectData);
    
    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: 'Project updated successfully',
      data: result,
    });
  });
  
  const getSingleProject = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const result = await ProjectServices.getSingleProject(req.user!, id);
    
    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: 'Project retrieved successfully',
      data: result,
    });
  });
  
  const getAllProjects = catchAsync(async (req: Request, res: Response) => {
    const filterables = pick(req.query, projectFilterables);
    const pagination = pick(req.query, paginationFields);
    const result = await ProjectServices.getAllProjects(req.user!,filterables,pagination);
    
    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: 'Projects retrieved successfully',
      data: result,
    });
  });
  
  const deleteProject = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const result = await ProjectServices.deleteProject(req.user!, id);
    
    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: 'Project deleted successfully',
      data: result,
    });
  });
  
  export const ProjectController = {
    createProject,
    updateProject,
    getSingleProject,
    getAllProjects,
    deleteProject,
  };