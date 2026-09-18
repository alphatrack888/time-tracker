import { StatusCodes } from 'http-status-codes';
import ApiError from '../../../errors/ApiError';
import { IPayrole, IPayroleFilterables } from './payrole.interface';
import { Payrole } from './payrole.model';
import { JwtPayload } from 'jsonwebtoken';
import { USER_ROLES } from '../../../enum/user';
import { dispatchNotification } from '../../../helpers/appEvents';
import mongoose from 'mongoose';

const createPayrole = async (user: JwtPayload, employeeId: string, payload: IPayrole) => {

  payload.company = new mongoose.Types.ObjectId(user.authId);
  payload.employee = new mongoose.Types.ObjectId(employeeId);

  const result = await Payrole.create(payload);
  if (!result)
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Failed to create Payrole, please try again',
    );

    //now send the notification
    const notificationData = {
      from: user.authId,
      to: result.employee,
      title: 'You have received a new payrole',
      body: `You have been assigned a new payrole, please see the document for more details`,
    };


    dispatchNotification({ from: notificationData.from, to: notificationData.to.toString(), title: notificationData.title, body: notificationData.body })

    return "Payrole created successfully";
};

const getAllPayroles = async (user: JwtPayload, filterables: IPayroleFilterables) => {
  const whereConditions = [];
  if(user.role === USER_ROLES.COMPANY) {
      if(Object.keys(filterables).length){
    whereConditions.push({$and: Object.entries(filterables).map(([key, value]) => ({ [key]: value }))})
  }
    whereConditions.push({company:new mongoose.Types.ObjectId(user.authId)})

  } 

  if(user.role === USER_ROLES.EMPLOYEES) {
    whereConditions.push({employee:new mongoose.Types.ObjectId(user.authId)})
  }

    console.log(whereConditions)

  const result = await Payrole.find({
    $and: whereConditions,
  })
    .populate('employee')
    .populate('project');
  return result;
};

const getSinglePayrole = async (id: string) => {
  const result = await Payrole.findById(id);
  if(!result) {
    throw new ApiError(
      StatusCodes.NOT_FOUND,
      'The requested payrole not found, please try again',
    );
  }
  return result;
};

const updatePayrole = async (
  id: string,
  payload: Partial<IPayrole>,
) => {
  const result = await Payrole.findByIdAndUpdate(
    id,
    { $set: payload },
    {
      new: true,
    },
  );
  if(!result) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Some error occurred while updating payrole, please try again',
    );
  }
  return "Payrole updated successfully";
};

const deletePayrole = async (id: string) => {
  const result = await Payrole.findByIdAndDelete(id);
  if(!result) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Some error occurred while deleting payrole, please try again',
    );
  }
  return "Payrole deleted successfully";
};

export const PayroleServices = {
  createPayrole,
  getAllPayroles,
  getSinglePayrole,
  updatePayrole,
  deletePayrole,
};
