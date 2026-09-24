jest.mock('../../../helpers/image/cloudinaryHelper', () => ({
  CloudinaryHelper: {
    uploadBufferToCloudinary: jest.fn().mockResolvedValue('https://res.cloudinary.com/demo/raw/upload/report.pdf'),
  },
}))

import request from 'supertest'
import app from '../../../app'
import { signTestToken } from '../../../test/testAuth'
import { USER_ROLES, USER_STATUS } from '../../../enum/user'
import { User } from '../user/user.model'
import { TimeSession } from './timetracker.model'
import { waitFor } from '../../../test/waitFor'
import { ReportJob } from '../reportjob/reportjob.model'

describe('GET /timetracker/reports/attendance (Phase 5, synchronous, single-employee only)', () => {
  it('returns a PDF for the caller\'s own attendance when called as an employee', async () => {
    const employee = await User.create({
      name: 'Route Test Employee',
      email: `route-employee-${Date.now()}@example.com`,
      password: 'Password123!',
      role: USER_ROLES.EMPLOYEES,
      status: USER_STATUS.ACTIVE,
      verified: true,
    })
    const { token } = signTestToken({ role: USER_ROLES.EMPLOYEES, authId: employee._id.toString() })

    const res = await request(app)
      .get('/api/v1/timetracker/reports/attendance')
      .query({ startDate: '2026-04-01', endDate: '2026-04-02' })
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toBe('application/pdf')
  })

  it('returns Excel when format=excel is requested', async () => {
    const employee = await User.create({
      name: 'Route Test Employee Excel',
      email: `route-employee-excel-${Date.now()}@example.com`,
      password: 'Password123!',
      role: USER_ROLES.EMPLOYEES,
      status: USER_STATUS.ACTIVE,
      verified: true,
    })
    const { token } = signTestToken({ role: USER_ROLES.EMPLOYEES, authId: employee._id.toString() })

    const res = await request(app)
      .get('/api/v1/timetracker/reports/attendance')
      .query({ startDate: '2026-04-01', endDate: '2026-04-02', format: 'excel' })
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  })

  it('rejects a company-wide request (no employee filter) with a clear message pointing to the async endpoint', async () => {
    const company = await User.create({
      name: 'Route Test Co',
      email: `route-co-${Date.now()}@example.com`,
      password: 'Password123!',
      role: USER_ROLES.COMPANY,
      status: USER_STATUS.ACTIVE,
      verified: true,
    })
    const { token } = signTestToken({ role: USER_ROLES.COMPANY, authId: company._id.toString() })

    const res = await request(app)
      .get('/api/v1/timetracker/reports/attendance')
      .query({ startDate: '2026-04-01', endDate: '2026-04-02' })
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(400)
    expect(res.body.message).toContain('async')
  })

  it('rejects a company requesting an employee outside their company with 403', async () => {
    const company = await User.create({
      name: 'Route Test Co 2',
      email: `route-co-2-${Date.now()}@example.com`,
      password: 'Password123!',
      role: USER_ROLES.COMPANY,
      status: USER_STATUS.ACTIVE,
      verified: true,
    })
    const outsideEmployee = await User.create({
      name: 'Outside Employee',
      email: `outside-employee-${Date.now()}@example.com`,
      password: 'Password123!',
      role: USER_ROLES.EMPLOYEES,
      status: USER_STATUS.ACTIVE,
      verified: true,
    })
    const { token } = signTestToken({ role: USER_ROLES.COMPANY, authId: company._id.toString() })

    const res = await request(app)
      .get('/api/v1/timetracker/reports/attendance')
      .query({ startDate: '2026-04-01', endDate: '2026-04-02', employee: outsideEmployee._id.toString() })
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(403)
  })

  it('rejects a malformed date', async () => {
    const { token } = signTestToken({ role: USER_ROLES.EMPLOYEES })

    const res = await request(app)
      .get('/api/v1/timetracker/reports/attendance')
      .query({ startDate: 'not-a-date', endDate: '2026-04-02' })
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(400)
  })
})

// Phase 14 audit: this route has existed since Phase 0 and its service-level
// cross-company guard (generateMonthlyPdfReport's `User.findOne({_id, company})`
// check) is real code, but no test anywhere — grepped the whole repo to
// confirm — ever actually exercised it. The other sync report route
// (/reports/attendance, above) already had this exact class of test; this
// one didn't.
describe('GET /timetracker/reports/monthly — tenant isolation (Phase 14 audit)', () => {
  it('rejects a company requesting a monthly report for an employee outside their company with 403', async () => {
    const company = await User.create({
      name: 'Monthly Route Co',
      email: `monthly-route-co-${Date.now()}@example.com`,
      password: 'Password123!',
      role: USER_ROLES.COMPANY,
      status: USER_STATUS.ACTIVE,
      verified: true,
    })
    const outsideEmployee = await User.create({
      name: 'Monthly Outside Employee',
      email: `monthly-outside-employee-${Date.now()}@example.com`,
      password: 'Password123!',
      role: USER_ROLES.EMPLOYEES,
      status: USER_STATUS.ACTIVE,
      verified: true,
    })
    const { token } = signTestToken({ role: USER_ROLES.COMPANY, authId: company._id.toString() })

    const res = await request(app)
      .get('/api/v1/timetracker/reports/monthly')
      .query({ month: '2026-04', employee: outsideEmployee._id.toString() })
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(403)
  })

  it('lets a company request a monthly report for their own employee', async () => {
    const company = await User.create({
      name: 'Monthly Route Co 2',
      email: `monthly-route-co-2-${Date.now()}@example.com`,
      password: 'Password123!',
      role: USER_ROLES.COMPANY,
      status: USER_STATUS.ACTIVE,
      verified: true,
    })
    const employee = await User.create({
      name: 'Monthly Own Employee',
      email: `monthly-own-employee-${Date.now()}@example.com`,
      password: 'Password123!',
      role: USER_ROLES.EMPLOYEES,
      company: company._id,
      status: USER_STATUS.ACTIVE,
      verified: true,
    })
    const { token } = signTestToken({ role: USER_ROLES.COMPANY, authId: company._id.toString() })

    const res = await request(app)
      .get('/api/v1/timetracker/reports/monthly')
      .query({ month: '2026-04', employee: employee._id.toString() })
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
  })

  it('an EMPLOYEES-role caller always gets their own report, ignoring any employee id they pass', async () => {
    const self = await User.create({
      name: 'Monthly Self Employee',
      email: `monthly-self-${Date.now()}@example.com`,
      password: 'Password123!',
      role: USER_ROLES.EMPLOYEES,
      status: USER_STATUS.ACTIVE,
      verified: true,
    })
    const someoneElse = await User.create({
      name: 'Monthly Someone Else',
      email: `monthly-someone-else-${Date.now()}@example.com`,
      password: 'Password123!',
      role: USER_ROLES.EMPLOYEES,
      status: USER_STATUS.ACTIVE,
      verified: true,
    })
    const { token } = signTestToken({ role: USER_ROLES.EMPLOYEES, authId: self._id.toString() })

    // Not asserting on PDF content here (covered elsewhere) — the point is
    // this must not 403/404 just because a foreign id was supplied; the
    // service silently substitutes the caller's own id for EMPLOYEES.
    const res = await request(app)
      .get('/api/v1/timetracker/reports/monthly')
      .query({ month: '2026-04', employee: someoneElse._id.toString() })
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
  })
})

describe('POST /timetracker/reports/attendance/async + GET /timetracker/reports/jobs/:jobId (Phase 5)', () => {
  it('creates a job (202) and the job eventually becomes ready, retrievable via the status endpoint', async () => {
    const company = await User.create({
      name: 'Async Route Co',
      email: `async-route-co-${Date.now()}@example.com`,
      password: 'Password123!',
      role: USER_ROLES.COMPANY,
      status: USER_STATUS.ACTIVE,
      verified: true,
    })
    const employee = await User.create({
      name: 'Async Route Employee',
      email: `async-route-employee-${Date.now()}@example.com`,
      password: 'Password123!',
      role: USER_ROLES.EMPLOYEES,
      company: company._id,
      status: USER_STATUS.ACTIVE,
      verified: true,
    })
    await TimeSession.create({
      user: employee._id,
      startTime: new Date('2026-04-05T09:00:00.000Z'),
      endTime: new Date('2026-04-05T17:00:00.000Z'),
      totalTime: 8 * 60 * 60 * 1000,
      status: 'stopped',
      date: '2026-04-05',
    })
    const { token } = signTestToken({ role: USER_ROLES.COMPANY, authId: company._id.toString() })

    const createRes = await request(app)
      .post('/api/v1/timetracker/reports/attendance/async')
      .set('Authorization', `Bearer ${token}`)
      .send({ startDate: '2026-04-01', endDate: '2026-04-30' })

    expect(createRes.status).toBe(202)
    const { jobId } = createRes.body.data
    expect(jobId).toBeDefined()

    // Processing runs in the background — poll until it settles.
    await waitFor(async () => (await ReportJob.findById(jobId))?.status === 'ready')

    const statusRes = await request(app)
      .get(`/api/v1/timetracker/reports/jobs/${jobId}`)
      .set('Authorization', `Bearer ${token}`)

    expect(statusRes.status).toBe(200)
    expect(statusRes.body.data.status).toBe('ready')
    expect(statusRes.body.data.fileUrl).toBeDefined()
  })

  it('rejects EMPLOYEES from requesting an async report — sync-self-only is the only path for that role', async () => {
    const { token } = signTestToken({ role: USER_ROLES.EMPLOYEES })

    const res = await request(app)
      .post('/api/v1/timetracker/reports/attendance/async')
      .set('Authorization', `Bearer ${token}`)
      .send({ startDate: '2026-04-01', endDate: '2026-04-30' })

    expect(res.status).toBe(403)
  })

  // Phase 8 added ADMIN/SUPER_ADMIN service-level tests
  // (reportjob.service.test.ts) but never a route-level one — this is the
  // gap a Phase 14 audit exists to catch: the service logic being correct
  // says nothing about whether the route's own auth() middleware actually
  // admits that role. Confirmed missing by grepping this file for
  // "ADMIN"/"SUPER_ADMIN" before adding these.
  it('lets an ADMIN create an async cross-company job through the real route (not just the service function)', async () => {
    const { token } = signTestToken({ role: USER_ROLES.ADMIN })

    const res = await request(app)
      .post('/api/v1/timetracker/reports/attendance/async')
      .set('Authorization', `Bearer ${token}`)
      .send({ startDate: '2026-04-01', endDate: '2026-04-30' })

    expect(res.status).toBe(202)
    expect(res.body.data.jobId).toBeDefined()
  })

  it('lets a SUPER_ADMIN list their own report jobs through the real route', async () => {
    const { token } = signTestToken({ role: USER_ROLES.SUPER_ADMIN })

    await request(app)
      .post('/api/v1/timetracker/reports/attendance/async')
      .set('Authorization', `Bearer ${token}`)
      .send({ startDate: '2026-04-01', endDate: '2026-04-30' })

    const listRes = await request(app)
      .get('/api/v1/timetracker/reports/jobs')
      .set('Authorization', `Bearer ${token}`)

    expect(listRes.status).toBe(200)
    expect(listRes.body.data.data.length).toBeGreaterThanOrEqual(1)
  })

  it('returns 404 for a job id that does not belong to the requesting user', async () => {
    const companyA = signTestToken({ role: USER_ROLES.COMPANY })
    const companyB = signTestToken({ role: USER_ROLES.COMPANY })

    const createRes = await request(app)
      .post('/api/v1/timetracker/reports/attendance/async')
      .set('Authorization', `Bearer ${companyA.token}`)
      .send({ startDate: '2026-04-01', endDate: '2026-04-30' })
    const { jobId } = createRes.body.data

    const res = await request(app)
      .get(`/api/v1/timetracker/reports/jobs/${jobId}`)
      .set('Authorization', `Bearer ${companyB.token}`)

    expect(res.status).toBe(404)
  })
})
