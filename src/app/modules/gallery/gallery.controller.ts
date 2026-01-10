import { Request, Response } from 'express';
  import { GalleryServices } from './gallery.service';
  import catchAsync from '../../../shared/catchAsync';
  import sendResponse from '../../../shared/sendResponse';
  import { StatusCodes } from 'http-status-codes';
  
  const createGallery = catchAsync(async (req: Request, res: Response) => {
    const galleryData = req.body;
    console.log(galleryData)
    const result = await GalleryServices.createGallery(req.user!, galleryData);
    
    sendResponse(res, {
      statusCode: StatusCodes.CREATED,
      success: true,
      message: 'Gallery created successfully',
      data: result,
    });
  });
  
  const updateGallery = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const galleryData = req.body;
    const result = await GalleryServices.updateGallery(id, galleryData);
    
    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: 'Gallery updated successfully',
      data: result,
    });
  });
  
  const getSingleGallery = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const result = await GalleryServices.getSingleGallery(id);
    
    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: 'Gallery retrieved successfully',
      data: result,
    });
  });
  
  const getAllGallerys = catchAsync(async (req: Request, res: Response) => {
    const result = await GalleryServices.getAllGallerys(req.user!);
    
    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: 'Gallerys retrieved successfully',
      data: result,
    });
  });
  
  const deleteImages = catchAsync(async (req: Request, res: Response) => {
    const { images } = req.body;
    console.log(images)
    const result = await GalleryServices.deleteImages(images);
    
    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: 'Images deleted successfully',
      data: result,
    });
  });
  
  export const GalleryController = {
    createGallery,
    updateGallery,
    getSingleGallery,
    getAllGallerys,
    deleteImages,
  };