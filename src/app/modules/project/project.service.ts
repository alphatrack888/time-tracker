import { StatusCodes } from 'http-status-codes';
import ApiError from '../../../errors/ApiError';
import { IPackageFilterables, IProject } from './project.interface';
import { Project } from './project.model';
import { JwtPayload } from 'jsonwebtoken';
import { IPaginationOptions } from '../../../interfaces/pagination';
import { paginationHelper } from '../../../helpers/paginationHelper';
import { isSetEqual, projectSearchableFields } from './project.constants';
import { USER_ROLES } from '../../../enum/user';

import { Types } from 'mongoose';
import { dispatchNotification } from '../../../helpers/appEvents';
import { emitEvent } from '../../../helpers/socketInstances';


const createProject = async (user: JwtPayload, payload: IProject) => {
  payload.company = user.authId;
  
  // Convert string dates to Date objects and calculate duration
  const startDate = new Date(payload.startDate);
  const endDate = new Date(payload.endDate);
  if(startDate > endDate){
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'End date must be after start date',
    );
  }
  payload.duration = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 );
  payload.projectTime = payload.projectTime || (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 );
  
  const result = await Project.create(payload);
  if (!result)
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Failed to create Project, please try again with valid data.',
    );

   

  return result;
};

const getAllProjects = async (user: JwtPayload, filterables: IPackageFilterables, pagination: IPaginationOptions) => {
  const {searchTerm, ...filterData} = filterables;
  const {page, skip, limit, sortBy, sortOrder} = paginationHelper.calculatePagination(pagination);
  const andConditions = [];
  if(searchTerm){
    andConditions.push({
      $or: projectSearchableFields.map((field) => ({
        [field]: {
          $regex: searchTerm,
          $options: 'i',
        },
      })),
    });
  }
  if(Object.keys(filterData).length){
    andConditions.push({
      $and: Object.entries(filterData).map(([key, value]) => ({
        [key]: value,
      })),
    });
  }

  if(user.role === USER_ROLES.EMPLOYEES){
    andConditions.push({employees: {$in: [user.authId]}})
  }
  if(user.role === USER_ROLES.COMPANY){
    andConditions.push({company: user.authId})
  }

  const whereConditions = andConditions.length ? {$and: andConditions} : {};
  const populate = [
    {
      path: 'company',
      select: 'name ',
    },
  ]
  if(user.role === USER_ROLES.COMPANY){
     populate.push({
      path: 'employees',
      select: 'name email',
    })
  }
  const [result, total] = await Promise.all([
    Project.find(whereConditions)
      .populate(populate)
      .skip(skip)
      .limit(limit)
      .sort({[sortBy]: sortOrder}).lean(),
    Project.countDocuments(whereConditions),
  ])
  return {
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    data: result,
  };
};

const getSingleProject = async (user: JwtPayload, id: string) => {
  const populate = [
    {
      path: 'company',
      select: 'name ',
    },
  ]
  if(user.role === USER_ROLES.COMPANY){
     populate.push({
      path: 'employees',
      select: 'name email',
    })
  }

  // Same scoping convention as getAllProjects: COMPANY only sees their own
  // projects, EMPLOYEES only sees projects they're assigned to.
  const andConditions: Record<string, unknown>[] = [{ _id: id }]
  if(user.role === USER_ROLES.EMPLOYEES){
    andConditions.push({employees: {$in: [user.authId]}})
  }
  if(user.role === USER_ROLES.COMPANY){
    andConditions.push({company: user.authId})
  }

  const result = await Project.findOne({ $and: andConditions }).populate(populate).lean();
  if(!result){
    throw new ApiError(
      StatusCodes.NOT_FOUND,
      'Requested project not found, please try again with valid id',
    );
  }
  return result;
};

const updateProject = async (
  user: JwtPayload,
  id: string,
  payload: Partial<IProject>,
): Promise<IProject | null> => {

  
  const result = await Project.findById(
    new Types.ObjectId(id),
  )
    .populate('company') // Ensure company is populated




  if (!result) {
    throw new ApiError(
      StatusCodes.NOT_FOUND,
      'Requested project not found, please try again with valid id',
    );
  }

    // Check if the user is the company owner
  if (user.role !== USER_ROLES.COMPANY || user.authId !== result.company._id.toString()) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      'You do not have permission to update this project',
    );
  }

  // Check if project has assigned employees and prevent date/time updates
  if ((payload.startDate || payload.endDate || payload.projectTime) && result.employees.length > 0) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      'Cannot update project dates or time for projects with assigned employees. Please remove all employees first.'
    );
  }

  // Calculate duration and project time when dates are updated
  if (payload.startDate || payload.endDate) {
    const startDate = payload.startDate ? new Date(payload.startDate) : result.startDate;
    const endDate = payload.endDate ? new Date(payload.endDate) : result.endDate;
    
    if (startDate && endDate) {
      // duration/projectTime are stored in hours everywhere else (see
      // createProject above) — this used to store raw milliseconds here,
      // ~3.6 million times too large.
      const durationHours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
      payload.duration = durationHours;
      payload.projectTime = durationHours;
    }
  }



  const updatedProject = await Project.findByIdAndUpdate(
    new Types.ObjectId(id),
    { $set: payload },
    {
      new: true,
      runValidators: true,
    },
  )



  // Only proceed if employees field is being updated
  if (!payload.employees || !Array.isArray(payload.employees)) {
    emitEvent(`updatedProject::${user.authId}`, updatedProject?.toObject())
    return updatedProject;
  }
  // Normalize IDs to strings for comparison
  const existingEmployees = new Set(
    result.employees.map(emp => emp.toString())
  );
  const newEmployees = new Set(
    payload.employees.map(emp => emp.toString())
  );
  

  //only proceed if employee has been changed removed or added not by size check array element
  if(isSetEqual(existingEmployees, newEmployees)) return updatedProject;


  // Find differences
  const addedEmployees = [...newEmployees].filter(emp => !existingEmployees.has(emp));
  const removedEmployees = [...existingEmployees].filter(emp => !newEmployees.has(emp));

  // Prepare notifications
  const notificationsData = [];

  // Notify newly added employees
  if (addedEmployees.length > 0) {
    notificationsData.push(
      ...addedEmployees.map(employeeId => ({
        from: result.company._id,
        to: employeeId,
        title: `You've been added to ${result.title}`,
        body: `You've been added to "${result.title}". Start: ${result.startDate?.toDateString()}, End: ${result.endDate?.toDateString()}.`,
      }))
    );
  }

  // Notify removed employees
  if (removedEmployees.length > 0) {
    notificationsData.push(
      ...removedEmployees.map(employeeId => ({
        from: result.company._id,
        to: employeeId,
        title: `You've been removed from "${result.title}"`,
        body: `You've been removed from the project "${result.title}". If this was unexpected, please contact your manager.`,
      }))
    );
  }

  //emit the project for both added and removed employees
  if (addedEmployees.length > 0 || removedEmployees.length > 0) {
    addedEmployees.forEach(employeeId => {
      emitEvent(`newProject::${employeeId}`, updatedProject?.toObject())
    })
    removedEmployees.forEach(employeeId => {
      emitEvent(`removedProject::${employeeId}`, updatedProject?.toObject())
    })
  }
  

  // Send notifications if any
  notificationsData.forEach(notification => {
    dispatchNotification({ from: notification.from.toString(), to: notification.to.toString(), title: notification.title, body: notification.body })
  })

  return updatedProject;
};

const deleteProject = async (user: JwtPayload, id: string) => {
  const findProject = await Project.findById(id).lean();
  if(!findProject) throw new ApiError(
    StatusCodes.NOT_FOUND,
    'The project you are trying to delete does not exist.',
  );
  if(findProject.company.toString() !== user.authId){
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      'You are not authorized to delete this project.',
    );
  }

  if(findProject.employees.length > 0){
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      'You cannot delete a project that has employees assigned to it.',
    );
  }

 const deleteProject = await Project.findByIdAndDelete(id);
  if(!deleteProject){
    throw new ApiError(
      StatusCodes.NOT_FOUND,
      'Something went wrong while deleting project, please try again with valid id.',
    );
  }
  return "Project deleted successfully";
};

export const ProjectServices = {
  createProject,
  getAllProjects,
  getSingleProject,
  updateProject,
  deleteProject,
};
