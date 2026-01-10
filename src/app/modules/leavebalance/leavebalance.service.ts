import { StatusCodes } from 'http-status-codes';
import ApiError from '../../../errors/ApiError';
import { ILeavebalance } from './leavebalance.interface';
import { Leavebalance } from './leavebalance.model';
import { JwtPayload } from 'jsonwebtoken';

const createLeavebalance = async (user: JwtPayload, payload: ILeavebalance) => {
  payload.company = user.authId;
 const findLeavebalance = await Leavebalance.findOne({company: user.authId})
 if(findLeavebalance) {
  await Leavebalance.findByIdAndUpdate(
    findLeavebalance._id,
    {
      $set: {
        ...payload,
      },
    },
    {
      new: true,
    },
  )
  return findLeavebalance
 } else {
  const result = await Leavebalance.create(payload)
  return result
 }
};

const getLeaveBalanceByCompany = async (id: string) => {
  const result = await Leavebalance.find({ company: id }).populate('company').lean();
  if (!result)
    throw new ApiError(
      StatusCodes.NOT_FOUND,
      'Leavebalance not found, please try again',
    );
  return result;
};

const getSingleLeavebalance = async (user:JwtPayload) => {
  console.log(user)
  const result = await Leavebalance.findOne({company:user.authId}).populate('company').lean();
  return result;
};

const updateLeavebalance = async (
  user:JwtPayload,
  payload: Partial<ILeavebalance>,
) => {
  const result = await Leavebalance.findOneAndUpdate(
    {company: user.authId },
    { $set: payload },
    {
      new: true,
    },
  );
  if (!result)
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'The leavebalance does not belong to the company',
    );
  return result;
};

const deleteLeavebalance = async (id: string) => {
  const result = await Leavebalance.findByIdAndDelete(id);
  return result;
};

export const LeavebalanceServices = {
  createLeavebalance,
  getLeaveBalanceByCompany,
  getSingleLeavebalance,
  updateLeavebalance,
  deleteLeavebalance,
};
