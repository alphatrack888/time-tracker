import { StatusCodes } from 'http-status-codes';
import ApiError from '../../../errors/ApiError';
import { ILeavemanagement, ILeavemanagementFilterables } from './leavemanagement.interface';
import { Leavemanagement } from './leavemanagement.model';
import { JwtPayload } from 'jsonwebtoken';
import { USER_ROLES } from '../../../enum/user';
import { Leavebalance } from '../leavebalance/leavebalance.model';

import { Types } from 'mongoose';
import { dispatchNotification } from '../../../helpers/appEvents';
import { logger } from '../../../shared/logger';
import {
  LEAVE_TYPES,
  LEAVE_TYPE_LABELS,
  LeaveType,
  isLeaveType,
  remainingDaysForType,
  typeToBalanceField,
  typeToBalanceLeftKey,
} from './leaveTypes';
import { leaveApplyApiError } from './leaveApplyErrors';

// Below this many remaining days for a leave type, the employee gets a
// "running low" notification when a request against that type is approved.
const LOW_LEAVE_BALANCE_THRESHOLD_DAYS = 2;

const createLeavemanagement = async (
  user: JwtPayload,
  payload: ILeavemanagement,
) => {
  try {
    payload.user = user.authId;
    // Derived from the employee's own JWT, never trusted from the client body
    // — otherwise an employee could submit a leave request against a company
    // that isn't theirs.
    payload.company = user.company;
    payload.from = new Date(payload.from);
    payload.to = new Date(payload.to);
    const availableLeaveBalances = await getAvailableLeaveBalance(
      user,
      payload.company.toString(),
    );

    //calculate the day difference between from and to
    const dayDifference =
      (payload.to.getTime() - payload.from.getTime()) / (1000 * 60 * 60 * 24);
    if (dayDifference <= 0) {
      throw leaveApplyApiError('LEAVE_INVALID_DATE_RANGE');
    }

    payload.totalDays = dayDifference == 0 ? 1 : dayDifference;
    if (!isLeaveType(payload.type)) {
      throw leaveApplyApiError('LEAVE_INVALID_TYPE');
    }
    const remaining = remainingDaysForType(
      availableLeaveBalances,
      payload.type,
    );
    if (remaining < payload.totalDays) {
      throw leaveApplyApiError('LEAVE_INSUFFICIENT_BALANCE');
    }

    const result = await Leavemanagement.create(payload);
    if (!result) throw leaveApplyApiError('LEAVE_CREATE_FAILED');

    dispatchNotification({
      from: user.id,
      to: payload.company.toString(),
      kind: 'leaveRequestSubmitted',
      data: {
        employeeName: user.name,
        from: payload.from.toDateString(),
        to: payload.to.toDateString(),
      },
      idempotencyKey: `leaveRequest:${result._id.toString()}:submitted`,
    });
    return result;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    logger.error('createLeavemanagement unexpected error', error);
    throw leaveApplyApiError('LEAVE_SUBMIT_UNEXPECTED');
  }
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

  const populatedFields = []
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

  const formattedLeaveBalances = LEAVE_TYPES.map((leaveType: LeaveType) => {
    const balanceField = typeToBalanceField(leaveType)
    const leftKey = typeToBalanceLeftKey(leaveType)
    const allocated = companyLeaves[balanceField] ?? 0
    const left = leaveBalances[leftKey] ?? 0
    return {
      type: leaveType,
      label: LEAVE_TYPE_LABELS[leaveType],
      taken: Math.max(allocated - left, 0),
      balance: left,
      status: 'active',
    }
  });

  return {
    leavemanagements: [...result],
    // leaveBalances: leaveBalances,
    companyLeaveBalance: formattedLeaveBalances
  };
  }
  return result;
};

const getSingleLeavemanagement = async (user: JwtPayload, id: string) => {
  const filter = user.role === USER_ROLES.COMPANY
    ? { _id: id, company: user.authId }
    : { _id: id, user: user.authId }
  const result = await Leavemanagement.findOne(filter);
  if(!result) throw new ApiError(StatusCodes.NOT_FOUND, 'Requested leave request not found, please try again')
  return result;
};

const updateLeavemanagement = async (
  user: JwtPayload,
  id: string,
  payload: Partial<ILeavemanagement>,
) => {

  const result = await Leavemanagement.findOneAndUpdate(
    { _id: id, company: user.authId },
    { $set: payload },
    {
      new: true,
    },
  );
  if(!result) throw new ApiError(StatusCodes.BAD_REQUEST, 'Failed to update leave request, please try again.')
    console.log(result.user, result)
    dispatchNotification({
      from: user.authId,
      to: result.user.toString(),
      kind: 'leaveRequestStatusChanged',
      data: {
        status: payload.status,
        from: result.from.toDateString(),
        to: result.to.toDateString(),
      },
      idempotencyKey: `leaveRequest:${id}:${payload.status}`,
    })

    // A separate, additional heads-up when this approval leaves the
    // employee's balance for that leave type low or exhausted. Only makes
    // sense on approval — rejection doesn't consume any balance. The balance
    // lookup itself is awaited (cheap, and worth actually seeing fail if it
    // does); the resulting dispatchNotification call stays fire-and-forget,
    // consistent with every other trigger in this file.
    if (payload.status === 'approved') {
      try {
        await notifyIfLeaveBalanceLow(user, result, id)
      } catch (err) {
        logger.error(`leaveBalance:low-check-failed leaveRequestId=${id}`, err)
      }
    }

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


/**
 * Fires an additional notification to the employee when approving this
 * leave request leaves their balance for that leave type at or below
 * LOW_LEAVE_BALANCE_THRESHOLD_DAYS (including exhausted/negative). Kept
 * separate from the "your leave was approved" notification above — this is
 * conceptually a different event (a balance crossing a threshold), with its
 * own idempotency key tied to the specific request that caused it.
 */
const notifyIfLeaveBalanceLow = async (
  user: JwtPayload,
  result: ILeavemanagement,
  leaveRequestId: string,
) => {
  const balances = await getAvailableLeaveBalance({ authId: result.user.toString() } as JwtPayload, user.authId)
  if (!isLeaveType(result.type)) return
  const balanceKey = typeToBalanceLeftKey(result.type)
  const remaining = balances[balanceKey]

  if (typeof remaining !== 'number' || remaining > LOW_LEAVE_BALANCE_THRESHOLD_DAYS) return

  const exhausted = remaining <= 0
  dispatchNotification({
    from: user.authId,
    to: result.user.toString(),
    kind: exhausted ? 'leaveBalanceExhausted' : 'leaveBalanceLow',
    data: { leaveType: result.type, remaining },
    idempotencyKey: `leaveBalance:${result.user.toString()}:${result.type}:lowAfter:${leaveRequestId}`,
  })
}

const getAvailableLeaveBalance = async (user: JwtPayload, company: string) => {
  
  const [leavemanagements, leaveBalance] = await Promise.all([
    Leavemanagement.find({
      user: user.authId,
      company: new Types.ObjectId(company),
      status: 'approved',
    }),
    Leavebalance.findOne({
      company:new Types.ObjectId(company),
    })
  ])

  if (!leaveBalance) throw leaveApplyApiError('LEAVE_BALANCE_NOT_CONFIGURED');

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
