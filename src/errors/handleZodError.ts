import { ZodError, ZodIssue } from 'zod'
import { leaveApplyErrorCodeFromMessage } from '../app/modules/leavemanagement/leaveApplyErrors'
import {
  IGenericErrorMessage,
  IGenericErrorResponse,
} from '../interfaces/error'

function errorCodeFromIssue(issue: ZodIssue): string | undefined {
  const params = (issue as ZodIssue & { params?: Record<string, unknown> })
    .params
  if (params && typeof params === 'object' && 'errorCode' in params) {
    const code = params.errorCode
    if (typeof code === 'string' && code.trim().length > 0) {
      return code.trim()
    }
  }
  return undefined
}

const handleZodError = (error: ZodError): IGenericErrorResponse => {
  const errors: IGenericErrorMessage[] = error.issues.map((issue: ZodIssue) => {
    return {
      path: issue?.path[issue.path.length - 1],
      message: issue?.message,
    }
  })

  const statusCode = 400
  const firstIssue = error.issues[0]
  let errorCode = firstIssue ? errorCodeFromIssue(firstIssue) : undefined
  if (!errorCode && firstIssue?.message) {
    errorCode = leaveApplyErrorCodeFromMessage(firstIssue.message)
  }
  const firstMessage = firstIssue?.message
  const message =
    errorCode && firstMessage && firstMessage.trim().length > 0
      ? firstMessage.trim()
      : 'Validation Error'

  return {
    statusCode,
    message,
    errorMessages: errors,
    ...(errorCode ? { errorCode } : {}),
  }
}

export default handleZodError
