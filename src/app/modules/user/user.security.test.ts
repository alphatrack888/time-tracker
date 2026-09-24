import request from 'supertest'
import app from '../../../app'
import { User } from './user.model'
import { signTestToken } from '../../../test/testAuth'
import { USER_ROLES, USER_STATUS } from '../../../enum/user'

// Phase 14 security/tenant-isolation audit. GET /user and GET /user/:id had
// no dedicated test coverage at all before this — found while checking the
// plan's "notification preferences and device tokens are never exposed in
// any list/admin endpoint" requirement, which turned up a real leak (see
// the deviceToken tests below) rather than a hypothetical one.
describe('User field exposure (Phase 14 audit)', () => {
  const seedUserWithSecrets = async (overrides: Partial<{ role: string; company: string }> = {}) => {
    return User.create({
      name: 'Target User',
      email: `target-${Date.now()}-${Math.random()}@example.com`,
      password: 'Password123!',
      role: overrides.role || USER_ROLES.EMPLOYEES,
      status: USER_STATUS.ACTIVE,
      verified: true,
      company: overrides.company,
      // A legacy value as if this user pre-dates the multi-device
      // migration — deviceToken is never written to by current code, but
      // a real production row could still have one sitting from before.
      deviceToken: 'legacy-single-device-fcm-token',
    })
  }

  it('never returns password or the deprecated deviceToken field via GET /user/:id, even to an admin who can otherwise view this user', async () => {
    const target = await seedUserWithSecrets()
    const { token } = signTestToken({ role: USER_ROLES.SUPER_ADMIN })

    const res = await request(app)
      .get(`/api/v1/user/${target._id}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.data.password).toBeUndefined()
    expect(res.body.data.deviceToken).toBeUndefined()
  })

  it('never returns password or deviceToken via GET /user (list), even to an admin', async () => {
    await seedUserWithSecrets()
    const { token } = signTestToken({ role: USER_ROLES.SUPER_ADMIN })

    const res = await request(app)
      .get('/api/v1/user')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    const rows = res.body.data.data as Array<Record<string, unknown>>
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      expect(row.password).toBeUndefined()
      expect(row.deviceToken).toBeUndefined()
    }
  })

  it('a company user never sees password or deviceToken for their own employees either', async () => {
    const companyUser = await User.create({
      name: 'Acme Co',
      email: `acme-${Date.now()}@example.com`,
      password: 'Password123!',
      role: USER_ROLES.COMPANY,
      status: USER_STATUS.ACTIVE,
      verified: true,
    })
    await seedUserWithSecrets({ company: companyUser._id.toString() })
    const { token } = signTestToken({ role: USER_ROLES.COMPANY, authId: companyUser._id.toString() })

    const res = await request(app)
      .get('/api/v1/user?role=employee')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    const rows = res.body.data.data as Array<Record<string, unknown>>
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      expect(row.password).toBeUndefined()
      expect(row.deviceToken).toBeUndefined()
    }
  })
})

describe('User tenant isolation — GET /user/:id (Phase 14 audit)', () => {
  it('lets a COMPANY view an employee within their own company', async () => {
    const companyUser = await User.create({
      name: 'Acme Co',
      email: `acme2-${Date.now()}@example.com`,
      password: 'Password123!',
      role: USER_ROLES.COMPANY,
      status: USER_STATUS.ACTIVE,
      verified: true,
    })
    const employee = await User.create({
      name: 'Acme Employee',
      email: `acme-emp-${Date.now()}@example.com`,
      password: 'Password123!',
      role: USER_ROLES.EMPLOYEES,
      company: companyUser._id,
      status: USER_STATUS.ACTIVE,
      verified: true,
    })
    const { token } = signTestToken({ role: USER_ROLES.COMPANY, authId: companyUser._id.toString() })

    const res = await request(app)
      .get(`/api/v1/user/${employee._id}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
  })

  it('rejects a COMPANY viewing an employee that belongs to a different company', async () => {
    const otherCompany = await User.create({
      name: 'Other Co',
      email: `other-co-${Date.now()}@example.com`,
      password: 'Password123!',
      role: USER_ROLES.COMPANY,
      status: USER_STATUS.ACTIVE,
      verified: true,
    })
    const outsideEmployee = await User.create({
      name: 'Outside Employee',
      email: `outside-emp-${Date.now()}@example.com`,
      password: 'Password123!',
      role: USER_ROLES.EMPLOYEES,
      company: otherCompany._id,
      status: USER_STATUS.ACTIVE,
      verified: true,
    })
    const { token } = signTestToken({ role: USER_ROLES.COMPANY })

    const res = await request(app)
      .get(`/api/v1/user/${outsideEmployee._id}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(403)
  })

  it('rejects an EMPLOYEES-role caller viewing a user outside their own company', async () => {
    const otherCompany = await User.create({
      name: 'Other Co 2',
      email: `other-co-2-${Date.now()}@example.com`,
      password: 'Password123!',
      role: USER_ROLES.COMPANY,
      status: USER_STATUS.ACTIVE,
      verified: true,
    })
    const outsideEmployee = await User.create({
      name: 'Outside Employee 2',
      email: `outside-emp-2-${Date.now()}@example.com`,
      password: 'Password123!',
      role: USER_ROLES.EMPLOYEES,
      company: otherCompany._id,
      status: USER_STATUS.ACTIVE,
      verified: true,
    })
    const myCompany = await User.create({
      name: 'My Co',
      email: `my-co-${Date.now()}@example.com`,
      password: 'Password123!',
      role: USER_ROLES.COMPANY,
      status: USER_STATUS.ACTIVE,
      verified: true,
    })
    const { token } = signTestToken({
      role: USER_ROLES.EMPLOYEES,
      company: myCompany._id.toString(),
    })

    const res = await request(app)
      .get(`/api/v1/user/${outsideEmployee._id}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(403)
  })

  it('an ADMIN/SUPER_ADMIN can view a user in any company', async () => {
    const someCompany = await User.create({
      name: 'Any Co',
      email: `any-co-${Date.now()}@example.com`,
      password: 'Password123!',
      role: USER_ROLES.COMPANY,
      status: USER_STATUS.ACTIVE,
      verified: true,
    })
    const { token } = signTestToken({ role: USER_ROLES.ADMIN })

    const res = await request(app)
      .get(`/api/v1/user/${someCompany._id}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
  })
})

describe('User tenant isolation — GET /user list scoping (Phase 14 audit)', () => {
  it('a COMPANY listing users only ever sees their own employees, never another company\'s', async () => {
    const companyA = await User.create({
      name: 'Company A',
      email: `company-a-${Date.now()}@example.com`,
      password: 'Password123!',
      role: USER_ROLES.COMPANY,
      status: USER_STATUS.ACTIVE,
      verified: true,
    })
    const companyB = await User.create({
      name: 'Company B',
      email: `company-b-${Date.now()}@example.com`,
      password: 'Password123!',
      role: USER_ROLES.COMPANY,
      status: USER_STATUS.ACTIVE,
      verified: true,
    })
    const employeeA = await User.create({
      name: 'Employee A',
      email: `employee-a-${Date.now()}@example.com`,
      password: 'Password123!',
      role: USER_ROLES.EMPLOYEES,
      company: companyA._id,
      status: USER_STATUS.ACTIVE,
      verified: true,
    })
    await User.create({
      name: 'Employee B',
      email: `employee-b-${Date.now()}@example.com`,
      password: 'Password123!',
      role: USER_ROLES.EMPLOYEES,
      company: companyB._id,
      status: USER_STATUS.ACTIVE,
      verified: true,
    })
    const { token } = signTestToken({ role: USER_ROLES.COMPANY, authId: companyA._id.toString() })

    const res = await request(app)
      .get('/api/v1/user?role=employee')
      .set('Authorization', `Bearer ${token}`)

    const ids = (res.body.data.data as Array<{ _id: string }>).map(u => u._id)
    expect(ids).toContain(employeeA._id.toString())
    expect(ids).not.toContain((await User.findOne({ name: 'Employee B' }))!._id.toString())
  })
})
