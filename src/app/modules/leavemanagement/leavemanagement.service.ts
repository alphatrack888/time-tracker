import { StatusCodes } from 'http-status-codes';
import ApiError from '../../../errors/ApiError';
import { ILeavemanagement, ILeavemanagementFilterables } from './leavemanagement.interface';
import { Leavemanagement } from './leavemanagement.model';
import { JwtPayload } from 'jsonwebtoken';
import { USER_ROLES } from '../../../enum/user';
import { Leavebalance } from '../leavebalance/leavebalance.model';

import { Types } from 'mongoose';
import { sendNotification } from '../../../helpers/notificationHelper';

const createLeavemanagement = async (
  user: JwtPayload,
  payload: ILeavemanagement,
) => {
  payload.user = user.authId;
  payload.from = new Date(payload.from);
  payload.to = new Date(payload.to);
  const availableLeaveBalances = await getAvailableLeaveBalance(user, payload.company.toString())
  
  //calculate the day difference between from and to
  const dayDifference = (payload.to.getTime() - payload.from.getTime()) / (1000 * 60 * 60 * 24)
  if(dayDifference <= 0) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid leave date range')
  }

  payload.totalDays = dayDifference == 0 ? 1 : dayDifference;
  if ((availableLeaveBalances as Record<string, number>)[payload.type] < dayDifference) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'You do not have enough leave balance to request this leave')
  }

  const result = await Leavemanagement.create(payload);
  if (!result)
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Failed to create Leavemanagement',
    );

    const notificatonData = {
      from: user.id,
      to: payload.company,
      title: `New Leave Request from ${user.name}`,
      body: `${user.name} has requested a leave from ${payload.from.toDateString()} to ${payload.to.toDateString()}`,
    }
    
    await sendNotification(notificatonData.from, notificatonData.to.toString(), notificatonData.title, notificatonData.body)
  return result;
};

const getAllLeavemanagements = async (user: JwtPayload, filters: ILeavemanagementFilterables) => {
  const andConditions =[]
  if(Object.keys(filters).length) {
    andConditions.push({
      $and: Object.entries(filters).map(([key, value]) => ({
        [key]: value,
      })),
    })
  }

  if(user.role !== USER_ROLES.COMPANY) {
    andConditions.push({
      user: user.authId,
    })
  } else {
    andConditions.push({
      company: user.authId,
    })
  }

  let populatedFields = []
  if(user.role === USER_ROLES.COMPANY) {
    populatedFields.push({
      path: 'user'
    })
  }else {
    populatedFields.push({
      path: 'company'
    })
  }


  //also check the requested user leave balance and add in return
  
  const whereConditions = andConditions.length ? { $and: andConditions } : {}
  const result = await Leavemanagement.find({ ...whereConditions }).populate(populatedFields).lean();
  if(user.role === USER_ROLES.EMPLOYEES) {
    const [leaveBalances, companyLeaveBalance] = await Promise.all(
      [
        getAvailableLeaveBalance(user, user.company.toString()),
        Leavebalance.findOne({ company: user.company.toString()}).lean()
      ]
    )

 const companyLeaves = companyLeaveBalance || {
    casualLeave: 0,
    sickLeave: 0,
    earnLeave: 0,
    wpLeave: 0
  };

  const formattedLeaveBalances = [
    {
      type: "Casual Leave",
      taken: Math.max(companyLeaves.casualLeave - (leaveBalances.casualLeaveLeft ?? 0), 0),
      balance: leaveBalances.casualLeaveLeft ?? 0,
      status: "Active"
    },
    {
      type: "Sick Leave",
      taken: Math.max(companyLeaves.sickLeave - (leaveBalances.sickLeaveLeft ?? 0), 0),
      balance: leaveBalances.sickLeaveLeft ?? 0,
      status: "Active"
    },
    {
      type: "Earn Leave",
      taken: Math.max(companyLeaves.earnLeave - (leaveBalances.earnLeaveLeft ?? 0), 0),
      balance: leaveBalances.earnLeaveLeft ?? 0,
      status: "Active"
    },
    {
      type: "Without Pay Leave",
      taken: Math.max(companyLeaves.wpLeave - (leaveBalances.wpLeaveLeft ?? 0), 0),
      balance: leaveBalances.wpLeaveLeft ?? 0,
      status: "Active"
    }
  ];

  return {
    leavemanagements: [...result],
    // leaveBalances: leaveBalances,
    companyLeaveBalance: formattedLeaveBalances
  };
  }
  return result;
};

const getSingleLeavemanagement = async (id: string) => {
  const result = await Leavemanagement.findById(id);
  if(!result) throw new ApiError(StatusCodes.NOT_FOUND, 'Requested leave request not found, please try again')
  return result;
};

const updateLeavemanagement = async (
  user: JwtPayload,
  id: string,
  payload: Partial<ILeavemanagement>,
) => {

  const result = await Leavemanagement.findByIdAndUpdate(
    id,
    { $set: payload },
    {
      new: true,
    },
  );
  if(!result) throw new ApiError(StatusCodes.BAD_REQUEST, 'Failed to update leave request, please try again.')
    console.log(result.user, result)
    const notificatonData = {
      from: user.authId,
      to: result.user,
      title: `Your leave request has been ${payload.status}`,
      body: `Your leave request from ${result.from.toDateString()} to ${result.to.toDateString()} has been ${payload.status}`,  
    }
    
    await sendNotification(notificatonData.from, notificatonData.to.toString(), notificatonData.title, notificatonData.body)



  return 'Leave request updated successfully.';
};

const deleteLeavemanagement = async (user: JwtPayload, id: string) => {
  const leavemanagement = await Leavemanagement.findById(id)
  if(!leavemanagement) throw new ApiError(StatusCodes.NOT_FOUND, 'Requested leave request not found, please try again')
  if(leavemanagement.status !== 'pending') throw new ApiError(StatusCodes.BAD_REQUEST,"You can not delete this leave request. Only pending request can be deleted.")
  if(leavemanagement.user.toString() !== user.authId) throw new ApiError(StatusCodes.BAD_REQUEST, 'You are not authorized to delete this leave request')
  const result = await Leavemanagement.findByIdAndDelete(id);
  if(!result) throw new ApiError(StatusCodes.BAD_REQUEST, 'Failed to delete leave request, please try again.')
  return 'Leave request deleted successfully';
};


const getAvailableLeaveBalance = async (user: JwtPayload, company: string) => {
  
  const [leavemanagements, leaveBalance] = await Promise.all([
    Leavemanagement.find({
      user: user.authId,
      status: 'approved',
    }),
    Leavebalance.findOne({
      company:new Types.ObjectId(company),
    })
  ])

  if(!leaveBalance) throw new ApiError(StatusCodes.NOT_FOUND, 'Leave balance not found, please try again')

  const earnLeaveLeft = leaveBalance?.earnLeave - leavemanagements.filter((leave) => leave.type === 'earn').reduce((acc, cur) => acc + cur.totalDays, 0)
  const sickLeaveLeft = leaveBalance?.sickLeave - leavemanagements.filter((leave) => leave.type === 'sick').reduce((acc, cur) => acc + cur.totalDays, 0)
  const casualLeaveLeft = leaveBalance?.casualLeave - leavemanagements.filter((leave) => leave.type === 'casual').reduce((acc, cur) => acc + cur.totalDays, 0)
  const wpLeaveLeft = leaveBalance?.wpLeave - leavemanagements.filter((leave) => leave.type === 'wp').reduce((acc, cur) => acc + cur.totalDays, 0)
  return {
    earnLeaveLeft,
    sickLeaveLeft,
    casualLeaveLeft,
    wpLeaveLeft,
  }
}






export const LeavemanagementServices = {
  createLeavemanagement,
  getAllLeavemanagements,
  getSingleLeavemanagement,
  updateLeavemanagement,
  deleteLeavemanagement,

  getAvailableLeaveBalance,
  
};
