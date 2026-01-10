import { StatusCodes } from 'http-status-codes';
import ApiError from '../../../errors/ApiError';
import { IGallery } from './gallery.interface';
import { Gallery } from './gallery.model';
import { JwtPayload } from 'jsonwebtoken';

const createGallery = async (user:JwtPayload, payload: {images: string[]}) => {
  const items = payload.images.map((image) => ({
    user: user.authId,
    image,
  }));

  const result = await Gallery.insertMany(items);
  if (!result)
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Failed to upload images to gallery.',
    );
  return result;
};

const getAllGallerys = async (user: JwtPayload) => {
  const result = await Gallery.find({ user: user.authId }).select('image _id').lean();


  return result || [];
};

const getSingleGallery = async (id: string) => {
  const result = await Gallery.findById(id);
  return result;
};

const updateGallery = async (
  id: string,
  payload: Partial<IGallery>,
) => {
  const result = await Gallery.findByIdAndUpdate(
    id,
    { $set: payload },
    {
      new: true,
    },
  );
  return result;
};

const deleteImages = async (ids: string[]) => {
  const result = await Gallery.deleteMany({ _id: { $in: ids } });
  if (!result.deletedCount)
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `Failed to delete ${result.deletedCount} images from gallery.`,
    );
  return `Successfully deleted ${result.deletedCount} images from gallery.`;
};

export const GalleryServices = {
  createGallery,
  getAllGallerys,
  getSingleGallery,
  updateGallery,
  deleteImages,
};
