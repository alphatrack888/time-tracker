// createUser also fires a welcome email via dispatchEmail (unrelated to what
// this file tests) — mock just that export so the suite doesn't make a real
// network call to Resend; dispatchNotification stays real, since that's the
// actual thing under test here.
jest.mock('../../../../helpers/appEvents', () => ({
  ...jest.requireActual('../../../../helpers/appEvents'),
  dispatchEmail: jest.fn(),
}))

import { JwtPayload } from 'jsonwebtoken'
import { CustomAuthServices } from './custom.auth.service'
import { Notification } from '../../notifications/notifications.model'
import { USER_ROLES, USER_STATUS } from '../../../../enum/user'
import { User } from '../../user/user.model'
import { IUser } from '../../user/user.interface'
import { waitFor } from '../../../../test/waitFor'

describe('CustomAuthServices.createUser — new employee onboarding notifications (Phase 3)', () => {
  it('notifies the new employee with a welcome message and the company with a confirmation', async () => {
    const company = await User.create({
      name: 'Acme Co',
      email: 'company-onboarding@example.com',
      password: 'Password123!',
      role: USER_ROLES.COMPANY,
      status: USER_STATUS.ACTIVE,
      verified: true,
    })
    const actingCompanyUser = {
      authId: company._id.toString(),
      role: USER_ROLES.COMPANY,
      name: company.name,
    } as JwtPayload

    await CustomAuthServices.createUser(actingCompanyUser, {
      name: 'New Employee',
      email: 'new-employee-onboarding@example.com',
      password: 'Password123!',
      role: USER_ROLES.EMPLOYEES,
    } as IUser)

    const newEmployee = await User.findOne({ email: 'new-employee-onboarding@example.com' })
    expect(newEmployee).not.toBeNull()

    // dispatchNotification (used here, matching the existing 4 request-driven
    // triggers) is deliberately fire-and-forget — poll briefly rather than
    // assume the DB write has landed the instant createUser resolves.
    await waitFor(async () => (await Notification.countDocuments({
      to: newEmployee!._id,
      idempotencyKey: `userOnboarded:${newEmployee!._id.toString()}:welcomeToEmployee`,
    })) === 1)
    await waitFor(async () => (await Notification.countDocuments({
      to: company._id,
      idempotencyKey: `userOnboarded:${newEmployee!._id.toString()}:confirmationToCompany`,
    })) === 1)

    const welcomeNotification = await Notification.findOne({
      to: newEmployee!._id,
      idempotencyKey: `userOnboarded:${newEmployee!._id.toString()}:welcomeToEmployee`,
    })
    expect(welcomeNotification?.title).toContain('Welcome')

    const companyConfirmation = await Notification.findOne({
      to: company._id,
      idempotencyKey: `userOnboarded:${newEmployee!._id.toString()}:confirmationToCompany`,
    })
    expect(companyConfirmation?.body).toContain('New Employee')
  })

  it('does not send onboarding notifications when creating a non-employee account', async () => {
    const superAdmin = {
      authId: (await User.create({
        name: 'Super',
        email: 'super-onboarding@example.com',
        password: 'Password123!',
        role: USER_ROLES.SUPER_ADMIN,
        status: USER_STATUS.ACTIVE,
        verified: true,
      }))._id.toString(),
      role: USER_ROLES.SUPER_ADMIN,
    } as JwtPayload

    await CustomAuthServices.createUser(superAdmin, {
      name: 'New Company',
      email: 'new-company-onboarding@example.com',
      password: 'Password123!',
      role: USER_ROLES.COMPANY,
    } as IUser)

    const newCompany = await User.findOne({ email: 'new-company-onboarding@example.com' })
    const count = await Notification.countDocuments({
      idempotencyKey: new RegExp(`userOnboarded:${newCompany!._id.toString()}`),
    })
    expect(count).toBe(0)
  })
})
