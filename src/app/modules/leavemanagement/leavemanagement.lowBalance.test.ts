import { JwtPayload } from 'jsonwebtoken'
import { LeavemanagementServices } from './leavemanagement.service'
import { Leavemanagement } from './leavemanagement.model'
import { Leavebalance } from '../leavebalance/leavebalance.model'
import { Notification } from '../notifications/notifications.model'
import { User } from '../user/user.model'
import { USER_ROLES, USER_STATUS } from '../../../enum/user'
import { waitFor } from '../../../test/waitFor'

describe('Leave balance low/exhausted notification on approval (Phase 3)', () => {
  const setup = async (casualLeaveTotal: number) => {
    const company = await User.create({
      name: 'Acme Co',
      email: `company-lowbal-${casualLeaveTotal}-${Date.now()}@example.com`,
      password: 'Password123!',
      role: USER_ROLES.COMPANY,
      status: USER_STATUS.ACTIVE,
      verified: true,
    })
    const employee = await User.create({
      name: 'Employee One',
      email: `employee-lowbal-${casualLeaveTotal}-${Date.now()}@example.com`,
      password: 'Password123!',
      role: USER_ROLES.EMPLOYEES,
      company: company._id,
      status: USER_STATUS.ACTIVE,
      verified: true,
    })
    await Leavebalance.create({
      company: company._id,
      casualLeave: casualLeaveTotal,
      sickLeave: 10,
      earnLeave: 10,
      wpLeave: 10,
    })
    const leaveRequest = await Leavemanagement.create({
      user: employee._id,
      company: company._id,
      type: 'casual',
      status: 'pending',
      from: new Date('2026-01-01'),
      to: new Date('2026-01-03'),
      totalDays: 2,
      reason: 'test',
    })

    const companyActor = { authId: company._id.toString(), role: USER_ROLES.COMPANY, name: company.name } as JwtPayload
    return { company, employee, leaveRequest, companyActor }
  }

  it('notifies the employee when an approval leaves their balance low (but not yet exhausted)', async () => {
    // 3 total casual days, this 2-day request approved -> 1 left (<= threshold of 2, > 0)
    const { employee, leaveRequest, companyActor } = await setup(3)

    await LeavemanagementServices.updateLeavemanagement(companyActor, leaveRequest._id.toString(), { status: 'approved' })

    await waitFor(async () => (await Notification.countDocuments({
      to: employee._id,
      idempotencyKey: `leaveBalance:${employee._id.toString()}:casual:lowAfter:${leaveRequest._id.toString()}`,
    })) === 1)

    const notification = await Notification.findOne({
      to: employee._id,
      idempotencyKey: `leaveBalance:${employee._id.toString()}:casual:lowAfter:${leaveRequest._id.toString()}`,
    })
    expect(notification?.title).toBe('Leave balance running low')
    expect(notification?.body).toContain('1')
  })

  it('notifies the employee that their balance is exhausted when it hits zero', async () => {
    // 2 total casual days, this 2-day request approved -> 0 left
    const { employee, leaveRequest, companyActor } = await setup(2)

    await LeavemanagementServices.updateLeavemanagement(companyActor, leaveRequest._id.toString(), { status: 'approved' })

    await waitFor(async () => (await Notification.countDocuments({
      to: employee._id,
      idempotencyKey: `leaveBalance:${employee._id.toString()}:casual:lowAfter:${leaveRequest._id.toString()}`,
    })) === 1)

    const notification = await Notification.findOne({
      to: employee._id,
      idempotencyKey: `leaveBalance:${employee._id.toString()}:casual:lowAfter:${leaveRequest._id.toString()}`,
    })
    expect(notification?.title).toBe('Leave balance exhausted')
  })

  it('does not send a low-balance notification when plenty of balance remains', async () => {
    // 20 total casual days, this 2-day request approved -> 18 left, well above threshold
    const { employee, leaveRequest, companyActor } = await setup(20)

    await LeavemanagementServices.updateLeavemanagement(companyActor, leaveRequest._id.toString(), { status: 'approved' })

    // The main "your leave was approved" notification always fires — wait
    // for that first so we know the update (and its side effects) settled,
    // then assert the low-balance one specifically never showed up.
    await waitFor(async () => (await Notification.countDocuments({
      to: employee._id,
      idempotencyKey: `leaveRequest:${leaveRequest._id.toString()}:approved`,
    })) === 1)

    const lowBalanceCount = await Notification.countDocuments({
      idempotencyKey: `leaveBalance:${employee._id.toString()}:casual:lowAfter:${leaveRequest._id.toString()}`,
    })
    expect(lowBalanceCount).toBe(0)
  })

  it('does not send a low-balance notification on rejection (no balance consumed)', async () => {
    const { employee, leaveRequest, companyActor } = await setup(2)

    await LeavemanagementServices.updateLeavemanagement(companyActor, leaveRequest._id.toString(), { status: 'rejected' })

    await waitFor(async () => (await Notification.countDocuments({
      to: employee._id,
      idempotencyKey: `leaveRequest:${leaveRequest._id.toString()}:rejected`,
    })) === 1)

    const lowBalanceCount = await Notification.countDocuments({
      idempotencyKey: `leaveBalance:${employee._id.toString()}:casual:lowAfter:${leaveRequest._id.toString()}`,
    })
    expect(lowBalanceCount).toBe(0)
  })
})
