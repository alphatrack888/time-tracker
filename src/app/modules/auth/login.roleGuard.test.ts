jest.mock('../../../helpers/appEvents', () => ({
  ...jest.requireActual('../../../helpers/appEvents'),
  dispatchEmail: jest.fn(),
}))

import request from 'supertest'
import app from '../../../app'
import { User } from '../user/user.model'
import { USER_ROLES, USER_STATUS } from '../../../enum/user'
import { dispatchEmail } from '../../../helpers/appEvents'

const password = 'Password123!'

const defaultAuth = {
  restrictionLeftAt: null,
  resetPassword: false,
  wrongLoginAttempts: 0,
}

describe('Login role guards (employee vs company)', () => {
  const employeeEmail = 'role-guard-employee@example.com'
  const companyEmail = 'role-guard-company@example.com'
  const unverifiedEmployeeEmail = 'role-guard-unverified-employee@example.com'
  const unverifiedCompanyEmail = 'role-guard-unverified-company@example.com'

  beforeEach(async () => {
    jest.mocked(dispatchEmail).mockClear()
    await User.create([
      {
        name: 'Employee',
        email: employeeEmail,
        password,
        role: USER_ROLES.EMPLOYEES,
        status: USER_STATUS.ACTIVE,
        verified: true,
        authentication: defaultAuth,
      },
      {
        name: 'Company',
        email: companyEmail,
        password,
        role: USER_ROLES.COMPANY,
        status: USER_STATUS.ACTIVE,
        verified: true,
        authentication: defaultAuth,
      },
      {
        name: 'Unverified Employee',
        email: unverifiedEmployeeEmail,
        password,
        role: USER_ROLES.EMPLOYEES,
        status: USER_STATUS.ACTIVE,
        verified: false,
        authentication: defaultAuth,
      },
      {
        name: 'Unverified Company',
        email: unverifiedCompanyEmail,
        password,
        role: USER_ROLES.COMPANY,
        status: USER_STATUS.ACTIVE,
        verified: false,
        authentication: defaultAuth,
      },
    ])
  })

  it('allows employee on employee-login', async () => {
    const res = await request(app)
      .post('/api/v1/auth/employee-login')
      .send({ email: employeeEmail, password })

    expect(res.status).toBe(200)
    expect(res.body.data.accessToken).toBeDefined()
  })

  it('rejects company on employee-login with 403', async () => {
    const res = await request(app)
      .post('/api/v1/auth/employee-login')
      .send({ email: companyEmail, password })

    expect(res.status).toBe(403)
    expect(res.body.message).toMatch(/company dashboard/i)
    expect(dispatchEmail).not.toHaveBeenCalled()
  })

  it('allows company on company-login and legacy /login', async () => {
    const companyLoginRes = await request(app)
      .post('/api/v1/auth/company-login')
      .send({ email: companyEmail, password })
    expect(companyLoginRes.status).toBe(200)
    expect(companyLoginRes.body.data.accessToken).toBeDefined()

    const legacyRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: companyEmail, password })
    expect(legacyRes.status).toBe(200)
    expect(legacyRes.body.data.accessToken).toBeDefined()
  })

  it('rejects employee on company-login and legacy /login with 403', async () => {
    const companyLoginRes = await request(app)
      .post('/api/v1/auth/company-login')
      .send({ email: employeeEmail, password })
    expect(companyLoginRes.status).toBe(403)
    expect(companyLoginRes.body.message).toMatch(/mobile app/i)

    const legacyRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: employeeEmail, password })
    expect(legacyRes.status).toBe(403)
    expect(legacyRes.body.message).toMatch(/mobile app/i)
  })

  it('returns 407 OTP for unverified employee on employee-login', async () => {
    const res = await request(app)
      .post('/api/v1/auth/employee-login')
      .send({ email: unverifiedEmployeeEmail, password })

    expect(res.status).toBe(407)
    expect(dispatchEmail).toHaveBeenCalled()
  })

  it('rejects unverified company on employee-login with 403 (no OTP)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/employee-login')
      .send({ email: unverifiedCompanyEmail, password })

    expect(res.status).toBe(403)
    expect(dispatchEmail).not.toHaveBeenCalled()
  })
})
