/* eslint-disable @typescript-eslint/no-unused-vars */
import { ErrorRequestHandler, NextFunction, Request, Response } from 'express'
import config from '../../config'
import { IGenericErrorMessage } from '../../interfaces/error'
import handleValidationError from '../../errors/handleZodError'
import { ZodError } from 'zod'
import handleZodError from '../../errors/handleZodError'
import handleCastError from '../../errors/handleCastError'
import ApiError from '../../errors/ApiError'

const SAFE_INTERNAL_ERROR_MESSAGE = 'Something went wrong.'

const globalErrorHandler: ErrorRequestHandler = (
  error,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  console.log('Inside Global Error Handler🪐', error)

  let statusCode = 500
  let message = SAFE_INTERNAL_ERROR_MESSAGE
  let errorMessages: IGenericErrorMessage[] = []
  let errorCode: string | undefined

  if (error?.name === 'validationError') {
    const simplifiedError = handleValidationError(error)
    statusCode = simplifiedError.statusCode
    message = simplifiedError.errorMessages[0].message
    errorMessages = simplifiedError.errorMessages
  } else if (error instanceof ZodError) {
    const simplifiedError = handleZodError(error)
    statusCode = simplifiedError.statusCode
    message = simplifiedError.message
    errorMessages = simplifiedError.errorMessages
    errorCode = simplifiedError.errorCode
  } else if (error?.name === 'CastError') {
    const simplifiedError = handleCastError(error)
    statusCode = simplifiedError.statusCode
    message =
      simplifiedError.errorMessages[0]?.message ?? simplifiedError.message
    errorMessages = simplifiedError.errorMessages
  } else if (error instanceof ApiError) {
    statusCode = error?.statusCode
    message = error?.message
    errorCode = error?.errorCode
    errorMessages = error?.message
      ? [{ path: '', message: error?.message }]
      : []
  } else if (error instanceof Error) {
    message = error?.message
    errorMessages = error?.message
      ? [{ path: '', message: error?.message }]
      : []
  }

  if (
    statusCode === 500 &&
    config.node_env === 'production'
  ) {
    message = SAFE_INTERNAL_ERROR_MESSAGE
    errorMessages = [{ path: '', message: SAFE_INTERNAL_ERROR_MESSAGE }]
  }

  res.status(statusCode).json({
    success: false,
    message: message,
    ...(errorCode ? { errorCode } : {}),
    errorMessages,
    stack: config.node_env === 'production' ? undefined : error?.stack,
  })
}

export default globalErrorHandler
