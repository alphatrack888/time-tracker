import handleZodError from '../../../errors/handleZodError'
import { LeavemanagementValidations } from './leavemanagement.validation'

describe('LeavemanagementValidations.create', () => {
  it('maps invalid leave type to LEAVE_TYPE_INVALID', async () => {
    const result = await LeavemanagementValidations.create
      .parseAsync({
        body: {
          type: 'annual',
          from: '2026-01-01',
          to: '2026-01-02',
          reason: 'test',
        },
      })
      .catch((e) => e)

    expect(result).toBeInstanceOf(Error)
    const simplified = handleZodError(result as import('zod').ZodError)
    expect(simplified.errorCode).toBe('LEAVE_TYPE_INVALID')
    expect(simplified.message).toContain('valid leave type')
  })

  it('maps missing type to LEAVE_TYPE_REQUIRED via message', async () => {
    const result = await LeavemanagementValidations.create
      .parseAsync({
        body: {
          from: '2026-01-01',
          to: '2026-01-02',
          reason: 'test',
        },
      })
      .catch((e) => e)

    const simplified = handleZodError(result as import('zod').ZodError)
    expect(simplified.errorCode).toBe('LEAVE_TYPE_REQUIRED')
  })
})
