jest.mock('../../../helpers/image/cloudinaryHelper', () => ({
  CloudinaryHelper: {
    uploadBufferToCloudinary: jest.fn(),
  },
}))

import { JwtPayload } from 'jsonwebtoken'
import { ReportJobServices } from './reportjob.service'
import { ReportJob } from './reportjob.model'
import { CloudinaryHelper } from '../../../helpers/image/cloudinaryHelper'
import { User } from '../user/user.model'
import { TimeSession } from '../timetracker/timetracker.model'
import { USER_ROLES, USER_STATUS } from '../../../enum/user'
import { reportGenerationCounter, reportJobDurationHistogram } from '../../../shared/metrics'

// The client's LabelValues<T> conditional type distributes over a union
// label-name type, so `.labels` on a .get() result comes back typed as a
// union of single-key partials rather than one object with all three keys
// — real at the type level, not at runtime (the actual object always has
// whichever keys were passed to .inc()/.observe()). Widened here rather
// than accessed key-by-key per branch.
const asLabels = (labels: unknown) => labels as Record<string, string | number | undefined>

const mockedUpload = CloudinaryHelper.uploadBufferToCloudinary as jest.Mock

const seedCompanyWithEmployees = async () => {
  const company = await User.create({
    name: 'Metrics Report Co',
    email: `metrics-report-co-${Date.now()}-${Math.random()}@example.com`,
    password: 'Password123!',
    role: USER_ROLES.COMPANY,
    status: USER_STATUS.ACTIVE,
    verified: true,
  })
  const employee = await User.create({
    name: 'Metrics Report Employee',
    email: `metrics-report-employee-${Date.now()}-${Math.random()}@example.com`,
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
  return { company, companyActor }
}

const seedJob = async (requestedBy: string) => {
  const job = await ReportJob.create({
    requestedBy,
    requestedByRole: USER_ROLES.COMPANY,
    type: 'attendance',
    format: 'pdf',
    params: { startDate: '2026-02-01', endDate: '2026-02-28' },
    status: 'pending',
  })
  return job._id.toString()
}

// Proves the underlying signal for AlphaTrackReportGenerationFailureRateHigh
// and AlphaTrackAsyncReportJobSlow (../../../../monitoring/prometheus-alerts.yml)
// is recorded correctly — there is no live Prometheus server in this
// environment to evaluate those PromQL rules against.
describe('ReportJobServices.processAttendanceReportJob metrics instrumentation (Phase 15)', () => {
  beforeEach(() => {
    mockedUpload.mockReset()
    reportGenerationCounter.reset()
    reportJobDurationHistogram.reset()
  })

  it('records a success outcome with a non-negative duration observation', async () => {
    const { companyActor } = await seedCompanyWithEmployees()
    mockedUpload.mockResolvedValueOnce('https://res.cloudinary.com/demo/raw/upload/v1/time-tracker/documents/report.pdf')

    const jobId = await seedJob(companyActor.authId as string)
    await ReportJobServices.processAttendanceReportJob(jobId)

    const generation = await reportGenerationCounter.get()
    const successRow = generation.values.find(
      v => asLabels(v.labels).type === 'attendance-async' && asLabels(v.labels).format === 'pdf' && asLabels(v.labels).result === 'success',
    )
    expect(successRow?.value).toBe(1)

    const duration = await reportJobDurationHistogram.get()
    const countRow = duration.values.find(
      v => v.metricName === 'alpha_track_report_job_duration_seconds_count' && asLabels(v.labels).result === 'success',
    )
    expect(countRow?.value).toBe(1)
    const sumRow = duration.values.find(
      v => v.metricName === 'alpha_track_report_job_duration_seconds_sum' && asLabels(v.labels).result === 'success',
    )
    expect(sumRow?.value).toBeGreaterThanOrEqual(0)
  })

  it('records a failure outcome (not success) when generation/upload throws', async () => {
    const { companyActor } = await seedCompanyWithEmployees()
    mockedUpload.mockRejectedValueOnce(new Error('Cloudinary is down'))

    const jobId = await seedJob(companyActor.authId as string)
    await ReportJobServices.processAttendanceReportJob(jobId)

    const generation = await reportGenerationCounter.get()
    const failureRow = generation.values.find(
      v => asLabels(v.labels).type === 'attendance-async' && asLabels(v.labels).result === 'failure',
    )
    const successRow = generation.values.find(
      v => asLabels(v.labels).type === 'attendance-async' && asLabels(v.labels).result === 'success',
    )
    expect(failureRow?.value).toBe(1)
    expect(successRow).toBeUndefined()

    const duration = await reportJobDurationHistogram.get()
    const failureCountRow = duration.values.find(
      v => v.metricName === 'alpha_track_report_job_duration_seconds_count' && asLabels(v.labels).result === 'failure',
    )
    expect(failureCountRow?.value).toBe(1)
  })
})
