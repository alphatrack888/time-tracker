import { StatusCodes } from 'http-status-codes';
import ApiError from '../../../errors/ApiError';
import { ILeavebalance } from './leavebalance.interface';
import { Leavebalance } from './leavebalance.model';
import { JwtPayload } from 'jsonwebtoken';
import { USER_ROLES } from '../../../enum/user';

const createLeavebalance = async (user: JwtPayload, payload: ILeavebalance) => {
  payload.company = user.authId;
 const findLeavebalance = await Leavebalance.findOne({company: user.authId})
 if(findLeavebalance) {
  const updated = await Leavebalance.findByIdAndUpdate(
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
  return updated
 } else {
  const result = await Leavebalance.create(payload)
  return result
 }
};

const getLeaveBalanceByCompany = async (user: JwtPayload, id: string) => {
  // COMPANY may only look up their own record; EMPLOYEES may only look up
  // their own employer's, using the company id carried on their own JWT.
  const ownCompanyId = user.role === USER_ROLES.COMPANY ? user.authId : user.company
  if (id !== ownCompanyId) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'You do not have permission to view this company\'s leave balance')
  }

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

const deleteLeavebalance = async (user: JwtPayload, id: string) => {
  const result = await Leavebalance.findOneAndDelete({ _id: id, company: user.authId });
  if (!result)
    throw new ApiError(
      StatusCodes.NOT_FOUND,
      'Leavebalance not found, please try again',
    );
  return result;
};

export const LeavebalanceServices = {
  createLeavebalance,
  getLeaveBalanceByCompany,
  getSingleLeavebalance,
  updateLeavebalance,
  deleteLeavebalance,
};
