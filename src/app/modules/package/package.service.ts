import { StatusCodes } from 'http-status-codes';
import ApiError from '../../../errors/ApiError';
import { IPackage } from './package.interface';
import { Package } from './package.model';

const createPackage = async (payload: IPackage) => {
  const result = await Package.create(payload);
  if (!result)
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Failed to create Package',
    );
  return result;
};

const getAllPackages = async () => {
  const result = await Package.find().lean();
  return result;
};

const getSinglePackage = async (id: string) => {
  const result = await Package.findById(id).lean();
  if (!result)
    throw new ApiError(StatusCodes.NOT_FOUND, 'The requested package not found!');
  return result;
};

const updatePackage = async (
  id: string,
  payload: Partial<IPackage>,
) => {
  const result = await Package.findByIdAndUpdate(
    id,
    { $set: payload },
    {
      new: true,
    },
  );
  return result;
};

const deletePackage = async (id: string) => {
  const result = await Package.findByIdAndDelete(id);
  if (!result)
    throw new ApiError(StatusCodes.NOT_FOUND, 'The requested package not found! please try again.');
  return result;
};

export const PackageServices = {
  createPackage,
  getAllPackages,
  getSinglePackage,
  updatePackage,
  deletePackage,
};
