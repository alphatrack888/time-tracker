import { StatusCodes } from 'http-status-codes';
import ApiError from '../../../errors/ApiError';
import { IPackageFilterables, IProject } from './project.interface';
import { Project } from './project.model';
import { TimeSession } from '../timetracker/timetracker.model';
import { User } from '../user/user.model';
import { JwtPayload } from 'jsonwebtoken';
import { IPaginationOptions } from '../../../interfaces/pagination';
import { paginationHelper } from '../../../helpers/paginationHelper';
import { isSetEqual, projectSearchableFields } from './project.constants';
import { USER_ROLES } from '../../../enum/user';

import { Types } from 'mongoose';
import { dispatchNotification } from '../../../helpers/appEvents';
import { emitEvent } from '../../../helpers/socketInstances';
import { projectStatusForDates, statusFilterForDates } from './projectStatus';

type ProjectLike = {
  startDate?: Date | string | null
  endDate?: Date | string | null
  status?: string | null
  toObject?: () => Record<string, unknown>
}

/** Response copy with the date-based status. Does not save the document. */
const presentProject = <T>(project: T, now: Date = new Date()): T => {
  if (project == null || typeof project !== 'object') return project
  const source = project as ProjectLike
  const plain = typeof source.toObject === 'function'
    ? source.toObject()
    : { ...(project as Record<string, unknown>) }
  plain.status = projectStatusForDates(
    plain.startDate as Date | string | null | undefined,
    plain.endDate as Date | string | null | undefined,
    now,
    plain.status as string | null | undefined,
  )
  return plain as T
}

/** Committed hours and overtime against the project's shared limit. */
const progressHours = (workedMs: number, projectTime: number | null | undefined) => {
  const workedHours = Math.round((workedMs / (1000 * 60 * 60)) * 100) / 100
  const limit = Number(projectTime) || 0
  const overtimeHours = limit > 0 ? Math.max(0, Math.round((workedHours - limit) * 100) / 100) : 0
  return { workedHours, overtimeHours }
}


const assignedEmployeeIds = async (companyId: string, employees?: IProject['employees']) => {
  const ids = [...new Set((employees || []).map((id) => id.toString()))]
  if (ids.some((id) => !Types.ObjectId.isValid(id))) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Each assigned person must be an employee of this company')
  }
  if (ids.length === 0) return ids

  const found = await User.find({
    _id: { $in: ids },
    company: companyId,
    role: USER_ROLES.EMPLOYEES,
  }).select('_id')
  if (found.length !== ids.length) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Each assigned person must be an employee of this company')
  }
  return ids
}

const createProject = async (user: JwtPayload, payload: IProject) => {
  payload.company = user.authId;

  const startDate = new Date(payload.startDate);
  const endDate = new Date(payload.endDate);
  if (startDate > endDate) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'End date must not be before the start date',
    );
  }
  payload.duration = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
  const employeeIds = await assignedEmployeeIds(user.authId, payload.employees)
  payload.employees = employeeIds as unknown as IProject['employees']

  const result = await Project.create(payload);
  if (!result)
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Failed to create Project, please try again with valid data.',
    );

  const presented = presentProject(result)
  employeeIds.forEach((employeeId) => {
    emitEvent(`newProject::${employeeId}`, presented)
    dispatchNotification({
      from: user.authId,
      to: employeeId,
      kind: 'projectEmployeeAdded',
      data: {
        projectTitle: result.title,
        projectId: result._id.toString(),
        startDate: result.startDate?.toDateString(),
        endDate: result.endDate?.toDateString(),
      },
      idempotencyKey: `project:${result._id.toString()}:employee:${employeeId}:added:${(result.createdAt ?? new Date()).toISOString()}`,
    })
  })

  return presented
};

const getAllProjects = async (user: JwtPayload, filterables: IPackageFilterables, pagination: IPaginationOptions) => {
  const {searchTerm, status, ...filterData} = filterables;
  const {page, skip, limit, sortBy, sortOrder} = paginationHelper.calculatePagination(pagination);
  const now = new Date();
  const andConditions = [];
  if (status) {
    const statusQuery = statusFilterForDates(status, now);
    if (statusQuery) andConditions.push(statusQuery);
  }
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
  const data = result.map(row => presentProject(row, now) as IProject & { workedHours?: number; overtimeHours?: number })
  if (user.role === USER_ROLES.EMPLOYEES && data.length > 0) {
    const pageIds = data.map(project => project._id)
    const totals = await TimeSession.aggregate<{ _id: Types.ObjectId; workedMs: number }>([
      {
        $match: {
          user: new Types.ObjectId(user.authId),
          project: { $in: pageIds },
        },
      },
      {
        $group: {
          _id: '$project',
          workedMs: { $sum: { $ifNull: ['$totalTime', 0] } },
        },
      },
    ])
    const msByProject = new Map(totals.map(row => [row._id.toString(), row.workedMs]))
    for (const project of data) {
      const progress = progressHours(msByProject.get(String(project._id)) ?? 0, project.projectTime)
      project.workedHours = progress.workedHours
      project.overtimeHours = progress.overtimeHours
    }
  }
  return {
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    data,
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
  const presented = presentProject(result) as IProject & {
    workedHours?: number
    overtimeHours?: number
    employees: Array<{ _id: Types.ObjectId; name?: string; workedHours?: number; overtimeHours?: number }>
  }

  if (user.role === USER_ROLES.EMPLOYEES) {
    const totals = await TimeSession.aggregate<{ _id: Types.ObjectId; workedMs: number }>([
      {
        $match: {
          user: new Types.ObjectId(user.authId),
          project: result._id,
        },
      },
      {
        $group: {
          _id: '$project',
          workedMs: { $sum: { $ifNull: ['$totalTime', 0] } },
        },
      },
    ])
    const progress = progressHours(totals[0]?.workedMs ?? 0, presented.projectTime)
    presented.workedHours = progress.workedHours
    presented.overtimeHours = progress.overtimeHours
  }

  if (user.role === USER_ROLES.COMPANY && presented.employees.length > 0) {
    const totals = await TimeSession.aggregate<{ _id: Types.ObjectId; workedMs: number }>([
      { $match: { project: result._id } },
      {
        $group: {
          _id: '$user',
          workedMs: { $sum: { $ifNull: ['$totalTime', 0] } },
        },
      },
    ])
    const msByUser = new Map(totals.map(row => [row._id.toString(), row.workedMs]))
    for (const employee of presented.employees) {
      const progress = progressHours(msByUser.get(String(employee._id)) ?? 0, presented.projectTime)
      employee.workedHours = progress.workedHours
      employee.overtimeHours = progress.overtimeHours
    }
  }

  return presented;
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
  const presented = presentProject(updatedProject)



  // Only proceed if employees field is being updated
  if (!payload.employees || !Array.isArray(payload.employees)) {
    emitEvent(`updatedProject::${user.authId}`, presented)
    return presented;
  }
  // Normalize IDs to strings for comparison
  const existingEmployees = new Set(
    result.employees.map(emp => emp.toString())
  );
  const newEmployees = new Set(
    payload.employees.map(emp => emp.toString())
  );
  

  //only proceed if employee has been changed removed or added not by size check array element
  if(isSetEqual(existingEmployees, newEmployees)) return presented;


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
        kind: 'projectEmployeeAdded' as const,
        data: {
          projectTitle: result.title,
          projectId: result._id.toString(),
          startDate: result.startDate?.toDateString(),
          endDate: result.endDate?.toDateString(),
        },
        type: 'added' as const,
      }))
    );
  }

  // Notify removed employees
  if (removedEmployees.length > 0) {
    notificationsData.push(
      ...removedEmployees.map(employeeId => ({
        from: result.company._id,
        to: employeeId,
        kind: 'projectEmployeeRemoved' as const,
        data: { projectTitle: result.title },
        type: 'removed' as const,
      }))
    );
  }

  //emit the project for both added and removed employees
  if (addedEmployees.length > 0 || removedEmployees.length > 0) {
    addedEmployees.forEach(employeeId => {
      emitEvent(`newProject::${employeeId}`, presented)
    })
    removedEmployees.forEach(employeeId => {
      emitEvent(`removedProject::${employeeId}`, presented)
    })
  }
  

  // Send notifications if any. Idempotency key is scoped to *this specific
  // update* (project + employee + added/removed + the update's own
  // timestamp) rather than the (project, employee, action) tuple forever —
  // an employee legitimately removed and later re-added must be notified
  // both times, not silently deduped against their first addition.
  const updateTimestamp = (updatedProject?.updatedAt ?? new Date()).toISOString()
  notificationsData.forEach(notification => {
    dispatchNotification({
      from: notification.from.toString(),
      to: notification.to.toString(),
      kind: notification.kind,
      data: notification.data,
      idempotencyKey: `project:${id}:employee:${notification.to.toString()}:${notification.type}:${updateTimestamp}`,
    })
  })

  return presented;
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

const hoursFromMs = (workedMs: number) => Math.round((workedMs / (1000 * 60 * 60)) * 100) / 100

/** Worked, allocation, overtime, and break for the employee's in-progress projects. */
const getStanding = async (user: JwtPayload) => {
  if (user.role !== USER_ROLES.EMPLOYEES) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'Only an employee can read project standing')
  }

  const now = new Date()
  const window = statusFilterForDates('in-progress', now)
  const projects = await Project.find({
    employees: user.authId,
    ...window,
  }).select('_id projectTime').lean()

  if (projects.length === 0) {
    return {
      workedHours: 0,
      allocatedHours: 0,
      overtimeHours: 0,
      breakHours: 0,
      projectCount: 0,
    }
  }

  const rows = await TimeSession.aggregate<{ _id: Types.ObjectId; workedMs: number; breakMs: number }>([
    {
      $match: {
        user: new Types.ObjectId(user.authId),
        project: { $in: projects.map(project => project._id) },
      },
    },
    {
      $group: {
        _id: '$project',
        workedMs: { $sum: { $ifNull: ['$totalTime', 0] } },
        breakMs: {
          $sum: {
            $reduce: {
              input: { $ifNull: ['$pauses', []] },
              initialValue: 0,
              in: {
                $add: [
                  '$$value',
                  {
                    $cond: [
                      {
                        $and: [
                          { $ne: ['$$this.start', null] },
                          { $ne: ['$$this.end', null] },
                          { $gt: ['$$this.end', '$$this.start'] },
                        ],
                      },
                      { $subtract: ['$$this.end', '$$this.start'] },
                      0,
                    ],
                  },
                ],
              },
            },
          },
        },
      },
    },
  ])

  const msByProject = new Map(rows.map(row => [String(row._id), row]))
  let workedHours = 0
  let allocatedHours = 0
  let overtimeHours = 0
  let breakMs = 0
  for (const project of projects) {
    const row = msByProject.get(String(project._id))
    const progress = progressHours(row?.workedMs ?? 0, project.projectTime)
    workedHours += progress.workedHours
    overtimeHours += progress.overtimeHours
    allocatedHours += Number(project.projectTime) || 0
    breakMs += row?.breakMs ?? 0
  }

  return {
    workedHours: Math.round(workedHours * 100) / 100,
    allocatedHours: Math.round(allocatedHours * 100) / 100,
    overtimeHours: Math.round(overtimeHours * 100) / 100,
    breakHours: hoursFromMs(breakMs),
    projectCount: projects.length,
  }
}

export const ProjectServices = {
  createProject,
  getAllProjects,
  getSingleProject,
  getStanding,
  updateProject,
  deleteProject,
};
