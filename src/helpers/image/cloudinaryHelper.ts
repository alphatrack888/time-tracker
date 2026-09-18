import { v2 as cloudinary, UploadApiOptions } from 'cloudinary'
import config from '../../config'
import { logger } from '../../shared/logger'
import ApiError from '../../errors/ApiError'
import { StatusCodes } from 'http-status-codes'

cloudinary.config({
  cloud_name: config.cloudinary.cloudinary_name,
  api_key: config.cloudinary.cloudinary_api_key,
  api_secret: config.cloudinary.cloudinary_secret,
})

export type UploadFieldName = 'images' | 'media' | 'documents' | 'audio'

const fieldConfig: Record<UploadFieldName, { resourceType: 'image' | 'video' | 'raw'; transform: boolean }> = {
  images: { resourceType: 'image', transform: true },
  media: { resourceType: 'video', transform: false },
  documents: { resourceType: 'raw', transform: false },
  audio: { resourceType: 'video', transform: false },
}

const uploadBufferToCloudinary = (buffer: Buffer, fieldName: UploadFieldName): Promise<string> => {
  const { resourceType, transform } = fieldConfig[fieldName]

  const options: UploadApiOptions = {
    folder: `time-tracker/${fieldName}`,
    resource_type: resourceType,
    ...(transform && {
      transformation: [{ quality: 'auto', fetch_format: 'auto', width: 1600, crop: 'limit' }],
    }),
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error || !result) {
        logger.error('Error uploading to Cloudinary:', error)
        return reject(new ApiError(StatusCodes.BAD_REQUEST, 'Failed to upload file to Cloudinary'))
      }
      resolve(result.secure_url)
    })
    uploadStream.end(buffer)
  })
}

export const CloudinaryHelper = {
  uploadBufferToCloudinary,
}
