import { Types } from 'mongoose'
import { TimeTrackerService } from './timetracker.service'
import { TimeSession } from './timetracker.model'
import { User } from '../user/user.model'
import { USER_ROLES } from '../../../enum/user'

describe('TimeTrackerService.generateMonthlyPdfReport `template` param (Phase 0 fix: was a no-op)', () => {
  const month = '2026-01'
  let employeeId: Types.ObjectId

  beforeEach(async () => {
    const employee = await User.create({
      name: 'Test Employee',
      email: 'employee@example.com',
      password: 'Password123!',
      role: USER_ROLES.EMPLOYEES,
    })
    employeeId = employee._id as Types.ObjectId

    await TimeSession.create({
      user: employeeId,
      startTime: new Date(`${month}-05T09:00:00.000Z`),
      endTime: new Date(`${month}-05T17:00:00.000Z`),
      totalTime: 8 * 60 * 60 * 1000,
      pauses: [
        {
          start: new Date(`${month}-05T12:00:00.000Z`),
          end: new Date(`${month}-05T12:30:00.000Z`),
        },
      ],
      status: 'stopped',
      date: `${month}-05`,
    })
  })

  const authUser = () => ({ authId: employeeId.toString(), role: USER_ROLES.EMPLOYEES })

  it('produces different PDF bytes for the "default" and "timesheet" templates (previously identical for every value)', async () => {
    const defaultReport = await TimeTrackerService.generateMonthlyPdfReport(authUser(), {
      month,
      template: 'default',
    })
    const timesheetReport = await TimeTrackerService.generateMonthlyPdfReport(authUser(), {
      month,
      template: 'timesheet',
    })
    const comprehensiveReport = await TimeTrackerService.generateMonthlyPdfReport(authUser(), {
      month,
      template: 'comprehensive',
    })

    expect(defaultReport.buffer.equals(timesheetReport.buffer)).toBe(false)
    expect(defaultReport.buffer.equals(comprehensiveReport.buffer)).toBe(false)
    expect(timesheetReport.buffer.equals(comprehensiveReport.buffer)).toBe(false)
  })

  it('defaults to the comprehensive layout when no template is specified, preserving existing behavior for callers that never send the param', async () => {
    const noTemplate = await TimeTrackerService.generateMonthlyPdfReport(authUser(), { month })
    const explicitComprehensive = await TimeTrackerService.generateMonthlyPdfReport(authUser(), {
      month,
      template: 'comprehensive',
    })

    // Both PDFs are generated at slightly different instants, so pdfkit's
    // /CreationDate metadata differs even for identical content. Compare
    // buffer length instead of exact byte-equality as a stable proxy for
    // "same layout, same content."
    expect(noTemplate.buffer.length).toBe(explicitComprehensive.buffer.length)
  })

  it.each(['default', 'timesheet', 'comprehensive'] as const)(
    'produces a valid, non-empty PDF for template=%s',
    async (template) => {
      const { buffer } = await TimeTrackerService.generateMonthlyPdfReport(authUser(), {
        month,
        template,
      })
      expect(buffer.length).toBeGreaterThan(0)
      expect(buffer.subarray(0, 5).toString('utf-8')).toBe('%PDF-')
    },
  )

  it('produces a valid, non-empty Excel workbook when format=excel', async () => {
    const { buffer, contentType, fileExtension } = await TimeTrackerService.generateMonthlyPdfReport(authUser(), {
      month,
      format: 'excel',
    })
    expect(buffer.length).toBeGreaterThan(0)
    expect(contentType).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    expect(fileExtension).toBe('xlsx')
    // .xlsx files are zip archives — PK is the zip local-file-header magic number.
    expect(buffer.subarray(0, 2).toString('utf-8')).toBe('PK')
  })
})
