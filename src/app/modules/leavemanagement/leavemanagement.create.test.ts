import { JwtPayload } from 'jsonwebtoken'
import { StatusCodes } from 'http-status-codes'
import { LeavemanagementServices } from './leavemanagement.service'
import { Leavemanagement } from './leavemanagement.model'
import { Leavebalance } from '../leavebalance/leavebalance.model'
import { User } from '../user/user.model'
import { USER_ROLES, USER_STATUS } from '../../../enum/user'
import { ILeavemanagement } from './leavemanagement.interface'

describe('createLeavemanagement', () => {
  const setupEmployee = async () => {
    const company = await User.create({
      name: 'Acme Co',
      email: `company-create-leave-${Date.now()}@example.com`,
      password: 'Password123!',
      role: USER_ROLES.COMPANY,
      status: USER_STATUS.ACTIVE,
      verified: true,
    })
    const employee = await User.create({
      name: 'Employee One',
      email: `employee-create-leave-${Date.now()}@example.com`,
      password: 'Password123!',
      role: USER_ROLES.EMPLOYEES,
      company: company._id,
      status: USER_STATUS.ACTIVE,
      verified: true,
    })
    await Leavebalance.create({
      company: company._id,
      casualLeave: 1,
      sickLeave: 10,
      earnLeave: 10,
      wpLeave: 10,
    })
    const employeeJwt = {
      authId: employee._id.toString(),
      company: company._id.toString(),
      role: USER_ROLES.EMPLOYEES,
      name: employee.name,
      id: employee._id.toString(),
    } as JwtPayload
    return { company, employee, employeeJwt }
  }

  it('rejects when employee has insufficient leave balance', async () => {
    const { employee, company, employeeJwt } = await setupEmployee()

    const payload = {
      type: 'casual',
      from: new Date('2026-06-01'),
      to: new Date('2026-06-05'),
      reason: 'vacation',
      user: employee._id,
      company: company._id,
      status: 'pending',
      totalDays: 0,
    } as ILeavemanagement

    await expect(
      LeavemanagementServices.createLeavemanagement(employeeJwt, payload),
    ).rejects.toMatchObject({
      statusCode: StatusCodes.BAD_REQUEST,
      errorCode: 'LEAVE_INSUFFICIENT_BALANCE',
      message:
        'You do not have enough leave days for this request. Try fewer days or another leave type.',
    })
  })

  it('wraps unexpected errors as internal server error', async () => {
    const { employee, company, employeeJwt } = await setupEmployee()
    await Leavebalance.findOneAndUpdate(
      { company: company._id },
      { casualLeave: 10 },
    )

    const createSpy = jest
      .spyOn(Leavemanagement, 'create')
      .mockRejectedValueOnce(new Error('db connection lost'))

    try {
      const payload = {
        type: 'casual',
        from: new Date('2026-06-01'),
        to: new Date('2026-06-02'),
        reason: 'test',
        user: employee._id,
        company: company._id,
        status: 'pending',
        totalDays: 0,
      } as ILeavemanagement

      await expect(
        LeavemanagementServices.createLeavemanagement(employeeJwt, payload),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        errorCode: 'LEAVE_SUBMIT_UNEXPECTED',
        message: 'Unable to submit leave request. Please try again later.',
      })
    } finally {
      createSpy.mockRestore()
    }
  })
})
