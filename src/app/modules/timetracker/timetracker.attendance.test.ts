import { JwtPayload } from 'jsonwebtoken'
import pdfParse from 'pdf-parse'
import { TimeTrackerService } from './timetracker.service'
import { TimeSession } from './timetracker.model'
import { User } from '../user/user.model'
import { USER_ROLES, USER_STATUS } from '../../../enum/user'

describe('TimeTrackerService.generateAttendanceReportData (Phase 5)', () => {
  const seedEmployee = async (companyId?: string) =>
    User.create({
      name: 'Attendance Employee',
      email: `attendance-employee-${Date.now()}-${Math.random()}@example.com`,
      password: 'Password123!',
      role: USER_ROLES.EMPLOYEES,
      status: USER_STATUS.ACTIVE,
      verified: true,
      ...(companyId && { company: companyId }),
    })

  const seedCompany = async () =>
    User.create({
      name: 'Attendance Co',
      email: `attendance-co-${Date.now()}-${Math.random()}@example.com`,
      password: 'Password123!',
      role: USER_ROLES.COMPANY,
      status: USER_STATUS.ACTIVE,
      verified: true,
    })

  it('marks every day in the range as present or absent based on whether a session exists', async () => {
    const employee = await seedEmployee()
    await TimeSession.create({
      user: employee._id,
      startTime: new Date('2026-03-02T09:00:00.000Z'),
      endTime: new Date('2026-03-02T17:00:00.000Z'),
      totalTime: 8 * 60 * 60 * 1000,
      status: 'stopped',
      date: '2026-03-02',
    })

    const data = await TimeTrackerService.generateAttendanceReportData(
      { authId: employee._id.toString(), role: USER_ROLES.EMPLOYEES } as JwtPayload,
      { startDate: '2026-03-01', endDate: '2026-03-03' },
    )

    expect(data.employees).toHaveLength(1)
    const [emp] = data.employees
    expect(emp.days).toHaveLength(3)
    expect(emp.days.find(d => d.date === '2026-03-01')?.present).toBe(false)
    expect(emp.days.find(d => d.date === '2026-03-02')?.present).toBe(true)
    expect(emp.days.find(d => d.date === '2026-03-03')?.present).toBe(false)
    expect(emp.presentCount).toBe(1)
    expect(emp.absentCount).toBe(2)
  })

  it('produces a clean all-absent report for an employee with zero sessions in range (no crash, no 500)', async () => {
    const employee = await seedEmployee()

    const data = await TimeTrackerService.generateAttendanceReportData(
      { authId: employee._id.toString(), role: USER_ROLES.EMPLOYEES } as JwtPayload,
      { startDate: '2026-03-01', endDate: '2026-03-05' },
    )

    const [emp] = data.employees
    expect(emp.presentCount).toBe(0)
    expect(emp.absentCount).toBe(5)
    expect(emp.days.every(d => !d.present)).toBe(true)
  })

  it('lets a company request any employee that belongs to it', async () => {
    const company = await seedCompany()
    const employee = await seedEmployee(company._id.toString())

    const data = await TimeTrackerService.generateAttendanceReportData(
      { authId: company._id.toString(), role: USER_ROLES.COMPANY } as JwtPayload,
      { startDate: '2026-03-01', endDate: '2026-03-01', employee: employee._id.toString() },
    )

    expect(data.employees).toHaveLength(1)
    expect(data.employees[0].employeeId).toBe(employee._id.toString())
  })

  it('rejects a company requesting an employee outside their own company', async () => {
    const company = await seedCompany()
    const otherCompany = await seedCompany()
    const outsideEmployee = await seedEmployee(otherCompany._id.toString())

    await expect(
      TimeTrackerService.generateAttendanceReportData(
        { authId: company._id.toString(), role: USER_ROLES.COMPANY } as JwtPayload,
        { startDate: '2026-03-01', endDate: '2026-03-01', employee: outsideEmployee._id.toString() },
      ),
    ).rejects.toThrow()
  })

  it('ignores an employee filter for an EMPLOYEES-role caller — always self', async () => {
    const employee = await seedEmployee()
    const someoneElse = await seedEmployee()

    const data = await TimeTrackerService.generateAttendanceReportData(
      { authId: employee._id.toString(), role: USER_ROLES.EMPLOYEES } as JwtPayload,
      { startDate: '2026-03-01', endDate: '2026-03-01', employee: someoneElse._id.toString() },
    )

    expect(data.employees[0].employeeId).toBe(employee._id.toString())
  })

  it('returns every employee in the company when no employee filter is given (company-wide)', async () => {
    const company = await seedCompany()
    const employeeA = await seedEmployee(company._id.toString())
    const employeeB = await seedEmployee(company._id.toString())
    const outsider = await seedEmployee() // no company — must not appear

    const data = await TimeTrackerService.generateAttendanceReportData(
      { authId: company._id.toString(), role: USER_ROLES.COMPANY } as JwtPayload,
      { startDate: '2026-03-01', endDate: '2026-03-01' },
    )

    const ids = data.employees.map(e => e.employeeId)
    expect(ids).toEqual(expect.arrayContaining([employeeA._id.toString(), employeeB._id.toString()]))
    expect(ids).not.toContain(outsider._id.toString())
  })

  it('scopes an ADMIN/SUPER_ADMIN request to one company when `company` is given (no employee)', async () => {
    const company = await seedCompany()
    const employeeA = await seedEmployee(company._id.toString())
    const employeeB = await seedEmployee(company._id.toString())
    const otherCompany = await seedCompany()
    const outsider = await seedEmployee(otherCompany._id.toString())

    const data = await TimeTrackerService.generateAttendanceReportData(
      { authId: 'some-admin-id', role: USER_ROLES.SUPER_ADMIN } as JwtPayload,
      { startDate: '2026-03-01', endDate: '2026-03-01', company: company._id.toString() },
    )

    const ids = data.employees.map(e => e.employeeId)
    expect(ids).toEqual(expect.arrayContaining([employeeA._id.toString(), employeeB._id.toString()]))
    expect(ids).not.toContain(outsider._id.toString())
  })

  it('returns every employee across every company for ADMIN/SUPER_ADMIN when neither `employee` nor `company` is given (true cross-company report)', async () => {
    const companyA = await seedCompany()
    const companyB = await seedCompany()
    const employeeA = await seedEmployee(companyA._id.toString())
    const employeeB = await seedEmployee(companyB._id.toString())

    const data = await TimeTrackerService.generateAttendanceReportData(
      { authId: 'some-admin-id', role: USER_ROLES.ADMIN } as JwtPayload,
      { startDate: '2026-03-01', endDate: '2026-03-01' },
    )

    const ids = data.employees.map(e => e.employeeId)
    expect(ids).toEqual(expect.arrayContaining([employeeA._id.toString(), employeeB._id.toString()]))
  })

  it('rejects an ADMIN/SUPER_ADMIN `company` filter that does not resolve to a real company', async () => {
    await expect(
      TimeTrackerService.generateAttendanceReportData(
        { authId: 'some-admin-id', role: USER_ROLES.ADMIN } as JwtPayload,
        { startDate: '2026-03-01', endDate: '2026-03-01', company: '507f1f77bcf86cd799439011' },
      ),
    ).rejects.toThrow()
  })

  it('ignores a `company` filter for a COMPANY-role caller — always their own company, never a supplied one', async () => {
    const company = await seedCompany()
    const own = await seedEmployee(company._id.toString())
    const otherCompany = await seedCompany()
    await seedEmployee(otherCompany._id.toString())

    const data = await TimeTrackerService.generateAttendanceReportData(
      { authId: company._id.toString(), role: USER_ROLES.COMPANY } as JwtPayload,
      { startDate: '2026-03-01', endDate: '2026-03-01', company: otherCompany._id.toString() },
    )

    expect(data.employees.map(e => e.employeeId)).toEqual([own._id.toString()])
  })

  it('rejects endDate before startDate', async () => {
    const employee = await seedEmployee()
    await expect(
      TimeTrackerService.generateAttendanceReportData(
        { authId: employee._id.toString(), role: USER_ROLES.EMPLOYEES } as JwtPayload,
        { startDate: '2026-03-10', endDate: '2026-03-01' },
      ),
    ).rejects.toThrow()
  })

  it('rejects a date range longer than the configured maximum', async () => {
    const employee = await seedEmployee()
    await expect(
      TimeTrackerService.generateAttendanceReportData(
        { authId: employee._id.toString(), role: USER_ROLES.EMPLOYEES } as JwtPayload,
        { startDate: '2020-01-01', endDate: '2025-01-01' },
      ),
    ).rejects.toThrow()
  })

  it('sums totalTime across multiple sessions on the same day', async () => {
    const employee = await seedEmployee()
    await TimeSession.create([
      { user: employee._id, startTime: new Date('2026-03-02T06:00:00.000Z'), totalTime: 2 * 60 * 60 * 1000, status: 'stopped', date: '2026-03-02' },
      { user: employee._id, startTime: new Date('2026-03-02T12:00:00.000Z'), totalTime: 3 * 60 * 60 * 1000, status: 'stopped', date: '2026-03-02' },
    ])

    const data = await TimeTrackerService.generateAttendanceReportData(
      { authId: employee._id.toString(), role: USER_ROLES.EMPLOYEES } as JwtPayload,
      { startDate: '2026-03-02', endDate: '2026-03-02' },
    )

    const day = data.employees[0].days[0]
    expect(day.sessionsCount).toBe(2)
    expect(day.workMs).toBe(5 * 60 * 60 * 1000)
  })
})

describe('TimeTrackerService.renderAttendanceReport (Phase 5)', () => {
  it('renders a valid PDF', async () => {
    const employee = await User.create({
      name: 'Render Employee',
      email: `render-employee-${Date.now()}@example.com`,
      password: 'Password123!',
      role: USER_ROLES.EMPLOYEES,
      status: USER_STATUS.ACTIVE,
      verified: true,
    })
    const data = await TimeTrackerService.generateAttendanceReportData(
      { authId: employee._id.toString(), role: USER_ROLES.EMPLOYEES } as JwtPayload,
      { startDate: '2026-03-01', endDate: '2026-03-02' },
    )

    const { buffer, contentType, fileExtension } = await TimeTrackerService.renderAttendanceReport(data, 'pdf')
    expect(fileExtension).toBe('pdf')
    expect(contentType).toBe('application/pdf')
    expect(buffer.subarray(0, 5).toString('utf-8')).toBe('%PDF-')
  })

  it('renders every day of a multi-day range as its own visible row, not just the first (regression: pdfkit x-cursor drift)', async () => {
    // pdfkit's `doc.x` mutates after a bounded-width text() call — an
    // earlier version of generateAttendanceReportPdf re-read `doc.x` per
    // row instead of using a fixed column anchor, which silently dropped
    // every row after the first one off the visible page. A byte-length/
    // magic-number check can't catch this; the actual text has to be
    // extracted and checked.
    const employee = await User.create({
      name: 'Multi Day PDF Employee',
      email: `multi-day-pdf-${Date.now()}@example.com`,
      password: 'Password123!',
      role: USER_ROLES.EMPLOYEES,
      status: USER_STATUS.ACTIVE,
      verified: true,
    })
    await TimeSession.create([
      { user: employee._id, startTime: new Date('2026-03-02T09:00:00Z'), totalTime: 8 * 60 * 60 * 1000, status: 'stopped', date: '2026-03-02' },
      { user: employee._id, startTime: new Date('2026-03-03T09:00:00Z'), totalTime: 6 * 60 * 60 * 1000, status: 'stopped', date: '2026-03-03' },
    ])

    const data = await TimeTrackerService.generateAttendanceReportData(
      { authId: employee._id.toString(), role: USER_ROLES.EMPLOYEES } as JwtPayload,
      { startDate: '2026-03-01', endDate: '2026-03-04' },
    )
    const { buffer } = await TimeTrackerService.renderAttendanceReport(data, 'pdf')

    const { text } = await pdfParse(buffer)
    expect(text).toContain('2026-03-01')
    expect(text).toContain('2026-03-02')
    expect(text).toContain('2026-03-03')
    expect(text).toContain('2026-03-04')
    // Row-level values, not just the dates being present anywhere.
    expect(text).toMatch(/2026-03-02[\s\S]*?Present[\s\S]*?1[\s\S]*?8\.00/)
    expect(text).toMatch(/2026-03-03[\s\S]*?Present[\s\S]*?1[\s\S]*?6\.00/)
  })

  it('renders a valid Excel workbook', async () => {
    const employee = await User.create({
      name: 'Render Employee 2',
      email: `render-employee-2-${Date.now()}@example.com`,
      password: 'Password123!',
      role: USER_ROLES.EMPLOYEES,
      status: USER_STATUS.ACTIVE,
      verified: true,
    })
    const data = await TimeTrackerService.generateAttendanceReportData(
      { authId: employee._id.toString(), role: USER_ROLES.EMPLOYEES } as JwtPayload,
      { startDate: '2026-03-01', endDate: '2026-03-02' },
    )

    const { buffer, contentType, fileExtension } = await TimeTrackerService.renderAttendanceReport(data, 'excel')
    expect(fileExtension).toBe('xlsx')
    expect(contentType).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    expect(buffer.subarray(0, 2).toString('utf-8')).toBe('PK')
  })
})
