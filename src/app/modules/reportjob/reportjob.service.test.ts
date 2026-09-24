jest.mock('../../../helpers/image/cloudinaryHelper', () => ({
  CloudinaryHelper: {
    uploadBufferToCloudinary: jest.fn(),
  },
}))

import { JwtPayload } from 'jsonwebtoken'
import { Types } from 'mongoose'
import { ReportJobServices } from './reportjob.service'
import { ReportJob } from './reportjob.model'
import { Notification } from '../notifications/notifications.model'
import { CloudinaryHelper } from '../../../helpers/image/cloudinaryHelper'
import { User } from '../user/user.model'
import { TimeSession } from '../timetracker/timetracker.model'
import { USER_ROLES, USER_STATUS } from '../../../enum/user'

// requestedBy is a real ObjectId ref on ReportJob — a made-up non-ObjectId
// string like 'some-admin-id' throws a Mongoose CastError on create(), so
// admin/super_admin actors in these tests need a syntactically valid id
// even though no such User document actually exists.
const fakeAdminId = () => new Types.ObjectId().toString()

const mockedUpload = CloudinaryHelper.uploadBufferToCloudinary as jest.Mock

const seedCompanyWithEmployees = async () => {
  const company = await User.create({
    name: 'Async Report Co',
    email: `async-report-co-${Date.now()}-${Math.random()}@example.com`,
    password: 'Password123!',
    role: USER_ROLES.COMPANY,
    status: USER_STATUS.ACTIVE,
    verified: true,
  })
  const employee = await User.create({
    name: 'Async Report Employee',
    email: `async-report-employee-${Date.now()}-${Math.random()}@example.com`,
    password: 'Password123!',
    role: USER_ROLES.EMPLOYEES,
    company: company._id,
    status: USER_STATUS.ACTIVE,
    verified: true,
  })
  await TimeSession.create({
    user: employee._id,
    startTime: new Date('2026-02-03T09:00:00.000Z'),
    endTime: new Date('2026-02-03T17:00:00.000Z'),
    totalTime: 8 * 60 * 60 * 1000,
    status: 'stopped',
    date: '2026-02-03',
  })
  const companyActor = { authId: company._id.toString(), role: USER_ROLES.COMPANY } as JwtPayload
  return { company, employee, companyActor }
}

describe('ReportJobServices.createAttendanceReportJob (Phase 5)', () => {
  beforeEach(() => {
    mockedUpload.mockReset()
  })

  it('creates a pending job immediately, without waiting for generation to finish', async () => {
    const { companyActor } = await seedCompanyWithEmployees()
    // Never resolves during this test — proves createAttendanceReportJob
    // itself doesn't wait on the background processing it kicks off.
    mockedUpload.mockImplementation(() => new Promise(() => {}))

    const result = await ReportJobServices.createAttendanceReportJob(companyActor, {
      startDate: '2026-02-01',
      endDate: '2026-02-28',
    })

    expect(result.status).toBe('pending')
    expect(result.jobId).toBeDefined()
  })

  it('rejects an invalid date range before ever creating a job', async () => {
    const { companyActor } = await seedCompanyWithEmployees()

    await expect(
      ReportJobServices.createAttendanceReportJob(companyActor, { startDate: '2026-02-28', endDate: '2026-02-01' }),
    ).rejects.toThrow()

    expect(await ReportJob.countDocuments({})).toBe(0)
  })

  it('lets an ADMIN scope a job to one company, validating the company exists first', async () => {
    const { company } = await seedCompanyWithEmployees()
    const admin = { authId: fakeAdminId(), role: USER_ROLES.ADMIN } as JwtPayload
    mockedUpload.mockImplementation(() => new Promise(() => {}))

    const result = await ReportJobServices.createAttendanceReportJob(admin, {
      startDate: '2026-02-01',
      endDate: '2026-02-28',
      company: company._id.toString(),
    })

    expect(result.status).toBe('pending')
    const job = await ReportJob.findById(result.jobId)
    expect(job?.requestedByRole).toBe('admin')
    expect(job?.params.company).toBe(company._id.toString())
  })

  it('rejects an ADMIN job request scoped to a company that does not exist', async () => {
    const admin = { authId: 'some-admin-id', role: USER_ROLES.ADMIN } as JwtPayload

    await expect(
      ReportJobServices.createAttendanceReportJob(admin, {
        startDate: '2026-02-01',
        endDate: '2026-02-28',
        company: '507f1f77bcf86cd799439011',
      }),
    ).rejects.toThrow()
    expect(await ReportJob.countDocuments({})).toBe(0)
  })

  it('creates a cross-company job for a SUPER_ADMIN that omits `company`', async () => {
    const superAdmin = { authId: fakeAdminId(), role: USER_ROLES.SUPER_ADMIN } as JwtPayload
    mockedUpload.mockImplementation(() => new Promise(() => {}))

    const result = await ReportJobServices.createAttendanceReportJob(superAdmin, {
      startDate: '2026-02-01',
      endDate: '2026-02-28',
    })

    const job = await ReportJob.findById(result.jobId)
    expect(job?.requestedByRole).toBe('super_admin')
    expect(job?.params.company).toBeUndefined()
  })

  it('rejects a job request from an EMPLOYEES-role caller', async () => {
    const employeeActor = { authId: 'some-employee-id', role: USER_ROLES.EMPLOYEES } as JwtPayload

    await expect(
      ReportJobServices.createAttendanceReportJob(employeeActor, { startDate: '2026-02-01', endDate: '2026-02-28' }),
    ).rejects.toThrow()
    expect(await ReportJob.countDocuments({})).toBe(0)
  })
})

// Seeds a ReportJob doc directly (bypassing createAttendanceReportJob, which
// would also kick off its own background processing call) so each test can
// call processAttendanceReportJob exactly once, deterministically.
const seedJob = async (
  requestedBy: string,
  overrides: Partial<{ format: 'pdf' | 'excel'; requestedByRole: 'company' | 'admin' | 'super_admin'; company: string }> = {},
) => {
  const job = await ReportJob.create({
    requestedBy,
    requestedByRole: overrides.requestedByRole || USER_ROLES.COMPANY,
    type: 'attendance',
    format: overrides.format || 'pdf',
    params: { startDate: '2026-02-01', endDate: '2026-02-28', company: overrides.company },
    status: 'pending',
  })
  return job._id.toString()
}

describe('ReportJobServices.processAttendanceReportJob (Phase 5)', () => {
  beforeEach(() => {
    mockedUpload.mockReset()
  })

  it('computes the report, uploads it, marks the job ready, and notifies the requester', async () => {
    const { company, companyActor } = await seedCompanyWithEmployees()
    mockedUpload.mockResolvedValueOnce('https://res.cloudinary.com/demo/raw/upload/v1/time-tracker/documents/report.pdf')

    const jobId = await seedJob(companyActor.authId as string)
    await ReportJobServices.processAttendanceReportJob(jobId)

    const job = await ReportJob.findById(jobId)
    expect(job?.status).toBe('ready')
    expect(job?.fileUrl).toBe('https://res.cloudinary.com/demo/raw/upload/v1/time-tracker/documents/report.pdf')

    const notification = await Notification.findOne({
      to: company._id,
      idempotencyKey: `reportjob:${jobId}:ready`,
    })
    expect(notification).not.toBeNull()
    expect(notification?.title).toBe('Your report is ready')
  })

  it('marks the job failed and notifies the requester when generation/upload throws', async () => {
    const { company, companyActor } = await seedCompanyWithEmployees()
    mockedUpload.mockRejectedValueOnce(new Error('Cloudinary is down'))

    const jobId = await seedJob(companyActor.authId as string)
    await ReportJobServices.processAttendanceReportJob(jobId)

    const job = await ReportJob.findById(jobId)
    expect(job?.status).toBe('failed')
    expect(job?.errorMessage).toBe('Cloudinary is down')

    const notification = await Notification.findOne({
      to: company._id,
      idempotencyKey: `reportjob:${jobId}:failed`,
    })
    expect(notification).not.toBeNull()
    expect(notification?.title).toBe('Your report could not be generated')
  })

  it('does nothing (no throw) for a job id that does not exist', async () => {
    await expect(ReportJobServices.processAttendanceReportJob('507f1f77bcf86cd799439011')).resolves.not.toThrow()
  })

  it('processes an admin-requested, company-scoped job using the stored role and company, not a hardcoded company actor', async () => {
    const { company, employee } = await seedCompanyWithEmployees()
    const otherCompany = await User.create({
      name: 'Other Async Co',
      email: `other-async-co-${Date.now()}-${Math.random()}@example.com`,
      password: 'Password123!',
      role: USER_ROLES.COMPANY,
      status: USER_STATUS.ACTIVE,
      verified: true,
    })
    mockedUpload.mockResolvedValueOnce('https://res.cloudinary.com/demo/raw/upload/v1/time-tracker/documents/admin-report.pdf')

    const adminId = fakeAdminId()
    const jobId = await seedJob(adminId, { requestedByRole: USER_ROLES.ADMIN, company: company._id.toString() })
    await ReportJobServices.processAttendanceReportJob(jobId)

    const job = await ReportJob.findById(jobId)
    expect(job?.status).toBe('ready')

    // The notification goes to whoever requested the job (the admin), not
    // to the company the report happened to be scoped to.
    const notification = await Notification.findOne({ idempotencyKey: `reportjob:${jobId}:ready` })
    expect(notification?.to.toString()).toBe(adminId)
    expect(notification?.to.toString()).not.toBe(company._id.toString())
    expect(notification?.to.toString()).not.toBe(otherCompany._id.toString())
    void employee
  })
})

describe('ReportJobServices.getJobStatus (Phase 5)', () => {
  beforeEach(() => {
    mockedUpload.mockReset()
  })

  it('returns the job for its own requester once ready', async () => {
    const { companyActor } = await seedCompanyWithEmployees()
    mockedUpload.mockResolvedValueOnce('https://res.cloudinary.com/demo/raw/upload/report.pdf')
    const jobId = await seedJob(companyActor.authId as string)
    await ReportJobServices.processAttendanceReportJob(jobId)

    const status = await ReportJobServices.getJobStatus(companyActor, jobId)
    expect(status.status).toBe('ready')
    expect(status.fileUrl).toBeDefined()
    expect(status.startDate).toBe('2026-02-01')
    expect(status.endDate).toBe('2026-02-28')
  })

  it('does not let a different user view someone else\'s job (tenant isolation)', async () => {
    const { companyActor } = await seedCompanyWithEmployees()
    const jobId = await seedJob(companyActor.authId as string)

    const otherCompany = {
      authId: (await User.create({
        name: 'Other Co',
        email: `other-co-${Date.now()}-${Math.random()}@example.com`,
        password: 'Password123!',
        role: USER_ROLES.COMPANY,
        status: USER_STATUS.ACTIVE,
        verified: true,
      }))._id.toString(),
      role: USER_ROLES.COMPANY,
    } as JwtPayload

    await expect(ReportJobServices.getJobStatus(otherCompany, jobId)).rejects.toThrow()
  })

  it('throws for a job id that does not exist', async () => {
    const { companyActor } = await seedCompanyWithEmployees()
    await expect(ReportJobServices.getJobStatus(companyActor, '507f1f77bcf86cd799439011')).rejects.toThrow()
  })
})

describe('ReportJobServices.listJobs (Phase 8)', () => {
  it('returns only the requesting user\'s own jobs, newest first', async () => {
    const { companyActor } = await seedCompanyWithEmployees()
    const jobId1 = await seedJob(companyActor.authId as string)
    await new Promise(resolve => setTimeout(resolve, 5))
    const jobId2 = await seedJob(companyActor.authId as string)

    const otherActorId = fakeAdminId()
    await seedJob(otherActorId, { requestedByRole: USER_ROLES.ADMIN })

    const result = await ReportJobServices.listJobs(companyActor, {})

    expect(result.data.map(j => j.jobId)).toEqual([jobId2, jobId1])
    expect(result.meta.total).toBe(2)
    expect(result.data[0].startDate).toBe('2026-02-01')
    expect(result.data[0].endDate).toBe('2026-02-28')
  })

  it('paginates with a default limit and caps an oversized requested limit', async () => {
    const { companyActor } = await seedCompanyWithEmployees()
    for (let i = 0; i < 3; i++) {
      await seedJob(companyActor.authId as string)
    }

    const page1 = await ReportJobServices.listJobs(companyActor, { page: 1, limit: 2 })
    expect(page1.data).toHaveLength(2)
    expect(page1.meta.totalPages).toBe(2)

    const page2 = await ReportJobServices.listJobs(companyActor, { page: 2, limit: 2 })
    expect(page2.data).toHaveLength(1)

    const capped = await ReportJobServices.listJobs(companyActor, { limit: 500 })
    expect(capped.meta.limit).toBe(50)
  })

  it('returns an empty list (not an error) for a user with no jobs', async () => {
    const { companyActor } = await seedCompanyWithEmployees()
    const result = await ReportJobServices.listJobs(companyActor, {})
    expect(result.data).toEqual([])
    expect(result.meta.total).toBe(0)
    expect(result.meta.totalPages).toBe(1)
  })
})
