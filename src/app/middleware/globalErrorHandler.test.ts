import { Request, Response, NextFunction } from 'express'
import { StatusCodes } from 'http-status-codes'
import ApiError from '../../errors/ApiError'

jest.mock('../../config', () => ({
  __esModule: true,
  default: { node_env: 'production' },
}))

import globalErrorHandler from './globalErrorHandler'

const jsonMock = jest.fn()
const statusMock = jest.fn(() => ({ json: jsonMock }))

function invokeHandler(error: unknown) {
  const req = {} as Request
  const res = { status: statusMock } as unknown as Response
  const next = jest.fn() as NextFunction
  globalErrorHandler(error, req, res, next)
}

describe('globalErrorHandler', () => {
  beforeEach(() => {
    jsonMock.mockClear()
    statusMock.mockClear()
  })

  it('returns safe message for unhandled errors in production', () => {
    invokeHandler(new Error('mongoose internal detail'))

    expect(statusMock).toHaveBeenCalledWith(500)
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'Something went wrong.',
        stack: undefined,
      }),
    )
    const body = jsonMock.mock.calls[0][0]
    expect(body.message).not.toContain('mongoose')
  })

  it('preserves ApiError client messages and errorCode', () => {
    invokeHandler(
      new ApiError(
        StatusCodes.BAD_REQUEST,
        'You do not have enough leave days for this request. Try fewer days or another leave type.',
        'LEAVE_INSUFFICIENT_BALANCE',
      ),
    )

    expect(statusMock).toHaveBeenCalledWith(400)
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message:
          'You do not have enough leave days for this request. Try fewer days or another leave type.',
        errorCode: 'LEAVE_INSUFFICIENT_BALANCE',
      }),
    )
  })

  it('sanitizes 500 message in production but keeps errorCode', () => {
    invokeHandler(
      new ApiError(
        StatusCodes.INTERNAL_SERVER_ERROR,
        'db exploded',
        'LEAVE_SUBMIT_UNEXPECTED',
      ),
    )

    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'Something went wrong.',
        errorCode: 'LEAVE_SUBMIT_UNEXPECTED',
      }),
    )
  })
})
