import { Request, Response, NextFunction } from 'express'
import multer, { FileFilterCallback } from 'multer'
import ApiError from '../../errors/ApiError'
import { StatusCodes } from 'http-status-codes'
import { CloudinaryHelper, UploadFieldName } from '../../helpers/image/cloudinaryHelper'

interface ProcessedFiles {
  [key: string]: string | string[] | undefined
}

const uploadFields = [
  { name: 'images', maxCount: 5 },
  { name: 'media', maxCount: 3 },
  { name: 'documents', maxCount: 3 },
  { name: 'audio', maxCount: 3 },
] as const

export const fileAndBodyProcessorUsingDiskStorage = () => {
  const storage = multer.memoryStorage()

  // File filter configuration
  const fileFilter = (
    req: Request,
    file: Express.Multer.File,
    cb: FileFilterCallback,
  ) => {
    try {
      const allowedTypes = {
        images: ['image/jpeg', 'image/png', 'image/jpg'],
        media: ['video/mp4', 'audio/mpeg', 'video/avi'],
        documents: ['application/pdf', 'application/msword', 'application/vnd.ms-excel', 'application/vnd.ms-powerpoint'],
          audio: [
            'audio/mpeg',
            'audio/mp3',
            'audio/wav',
            'audio/mp4',
            'audio/x-m4a'
          ],
      }

      const fieldType = file.fieldname as UploadFieldName
      if (!allowedTypes[fieldType]?.includes(file.mimetype)) {
        return cb(
          new ApiError(
            StatusCodes.BAD_REQUEST,
            `Invalid file type for ${file.fieldname}`,
          ),
        )
      }
      cb(null, true)
    } catch (error) {
      cb(
        new ApiError(
          StatusCodes.INTERNAL_SERVER_ERROR,
          'File validation failed',
        ),
      )
    }
  }

  const upload = multer({
    storage,
    fileFilter,
    limits: {
      fileSize: 10 * 1024 * 1024,
      files: 10,
    },
  }).fields(uploadFields)

  return (req: Request, res: Response, next: NextFunction) => {
    upload(req, res, async error => {
      if (error) return next(error)

      try {
        // Parse JSON data if exists
        if (req.body?.data) {
          req.body = JSON.parse(req.body.data)
        }

        // Upload files to Cloudinary
        if (req.files) {
          const fieldsConfig = new Map(
            uploadFields.map(f => [f.name, f.maxCount]),
          )

          // Upload every file, across every field, in parallel
          const uploaded = await Promise.all(
            Object.entries(req.files).flatMap(([fieldName, files]) =>
              (files as Express.Multer.File[]).map(async file => ({
                fieldName,
                url: await CloudinaryHelper.uploadBufferToCloudinary(
                  file.buffer,
                  fieldName as UploadFieldName,
                ),
              })),
            ),
          )

          // Regroup uploaded URLs by field, preserving per-file order
          const urlsByField: Record<string, string[]> = {}
          for (const { fieldName, url } of uploaded) {
            ;(urlsByField[fieldName] ??= []).push(url)
          }

          const processedFiles: ProcessedFiles = {}
          for (const [fieldName, urls] of Object.entries(urlsByField)) {
            const maxCount = fieldsConfig.get(fieldName as UploadFieldName) ?? 1
            processedFiles[fieldName] = maxCount > 1 ? urls : urls[0]
          }

          req.body = { ...req.body, ...processedFiles }
        }

        next()
      } catch (err) {
        next(err)
      }
    })
  }
}
