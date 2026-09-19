import { StatusCodes } from 'http-status-codes';
import ApiError from '../../../errors/ApiError';
import { ITruck, ITruckFilterables } from './truck.interface';
import { Truck } from './truck.model';
import { JwtPayload } from 'jsonwebtoken';
import { USER_ROLES } from '../../../enum/user';
import { usageTrackingService } from '../subscription/usage-tracking.service';

// COMPANY may only touch trucks belonging to their own company; ADMIN/SUPER_ADMIN
// are unrestricted — same convention used across payrole/leavebalance/etc.
const ownershipFilter = (user: JwtPayload, id: string) => {
  const filter: Record<string, unknown> = { _id: id }
  if (user.role === USER_ROLES.COMPANY) {
    filter.company = user.authId
  }
  return filter
}

const createTruck = async (user: JwtPayload, payload: Partial<ITruck>) => {
  const eligibility = await usageTrackingService.canAddTruck(user.authId as string)
  if (!eligibility.allowed) {
    throw new ApiError(StatusCodes.FORBIDDEN, eligibility.reason || 'You cannot add more trucks on your current plan')
  }

  payload.company = user.authId

  const result = await Truck.create(payload)
  if (!result)
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Failed to create Truck, please try again with valid data.',
    );
  return result;
};

const getAllTrucks = async (user: JwtPayload, filters: ITruckFilterables) => {
  const andConditions: Record<string, unknown>[] = []

  if (Object.keys(filters).length) {
    andConditions.push({ $and: Object.entries(filters).map(([key, value]) => ({ [key]: value })) })
  }

  if (user.role === USER_ROLES.COMPANY) {
    andConditions.push({ company: user.authId })
  }

  const whereConditions = andConditions.length ? { $and: andConditions } : {}
  const result = await Truck.find(whereConditions).populate('company', 'name').populate('assignedDriver', 'name email').lean();
  return result;
};

const getSingleTruck = async (user: JwtPayload, id: string) => {
  const result = await Truck.findOne(ownershipFilter(user, id)).populate('company', 'name').populate('assignedDriver', 'name email').lean();
  if (!result) {
    throw new ApiError(
      StatusCodes.NOT_FOUND,
      'The requested truck not found, please try again',
    );
  }
  return result;
};

const updateTruck = async (
  user: JwtPayload,
  id: string,
  payload: Partial<ITruck>,
) => {
  // company is server-derived only, never trusted from the client body
  const { company: _ignoredCompany, ...safePayload } = payload

  const result = await Truck.findOneAndUpdate(
    ownershipFilter(user, id),
    { $set: safePayload },
    { new: true },
  );
  if (!result) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Some error occurred while updating the truck, please try again',
    );
  }
  return result;
};

const deleteTruck = async (user: JwtPayload, id: string) => {
  const result = await Truck.findOneAndDelete(ownershipFilter(user, id));
  if (!result) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Some error occurred while deleting the truck, please try again',
    );
  }
  return result;
};

export const TruckServices = {
  createTruck,
  getAllTrucks,
  getSingleTruck,
  updateTruck,
  deleteTruck,
};
