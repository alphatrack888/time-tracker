import { JwtPayload } from 'jsonwebtoken'
import pdfParse from 'pdf-parse'
import { TimeTrackerService } from './timetracker.service'
import { TimeSession } from './timetracker.model'
import { User } from '../user/user.model'
import { USER_ROLES, USER_STATUS } from '../../../enum/user'

// Phase 16 QA matrix row: "Report requested for a date range spanning a DST
// transition." Both halves of the calculation (which calendar day a session
// belongs to, and how many hours it totals) are UTC-based throughout this
// codebase — startTimer derives `date` from `now.toISOString()`, and
// totalTime is always a plain millisecond diff between two Date#getTime()
// values, never a local-time recomputation. UTC has no DST transitions, so
// neither step can be affected by one. These tests exist to lock that in as
// a regression, not because reading the code left real doubt.
describe('TimeTrackerService.generateAttendanceReportData — DST transitions (Phase 16)', () => {
  const seedEmployee = async () =>
    User.create({
      name: 'DST Employee',
      email: `dst-employee-${Date.now()}-${Math.random()}@example.com`,
      password: 'Password123!',
      role: USER_ROLES.EMPLOYEES,
      status: USER_STATUS.ACTIVE,
      verified: true,
    })

  it('computes correct total hours for a session spanning a US spring-forward transition (2026-03-08)', async () => {
    const employee = await seedEmployee()
    // A US Eastern clock "loses" the 2:00-3:00am local hour on this date.
    // If duration were ever computed via local-time field subtraction
    // instead of a raw UTC millisecond diff, an 8-hour shift starting
    // before and ending after the transition would come out short by an
    // hour. Stored as a UTC instant pair either way — this is what the
    // real startTimer/stopTimer code path always produces.
    await TimeSession.create({
      user: employee._id,
      startTime: new Date('2026-03-08T09:00:00.000Z'),
      endTime: new Date('2026-03-08T17:00:00.000Z'),
      totalTime: 8 * 60 * 60 * 1000,
      status: 'stopped',
      date: '2026-03-08',
    })

    const data = await TimeTrackerService.generateAttendanceReportData(
      { authId: employee._id.toString(), role: USER_ROLES.EMPLOYEES } as JwtPayload,
      { startDate: '2026-03-07', endDate: '2026-03-09' },
    )

    const day = data.employees[0].days.find(d => d.date === '2026-03-08')
    expect(day?.present).toBe(true)
    expect(day?.workMs).toBe(8 * 60 * 60 * 1000)
  })

  it('computes correct total hours for a session spanning a US fall-back transition (2026-11-01)', async () => {
    const employee = await seedEmployee()
    // The complementary case: a local Eastern clock repeats the 1:00-2:00am
    // hour on this date. Same reasoning — UTC millisecond diffs are
    // unaffected by the repeated local hour.
    await TimeSession.create({
      user: employee._id,
      startTime: new Date('2026-11-01T09:00:00.000Z'),
      endTime: new Date('2026-11-01T17:00:00.000Z'),
      totalTime: 8 * 60 * 60 * 1000,
      status: 'stopped',
      date: '2026-11-01',
    })

    const data = await TimeTrackerService.generateAttendanceReportData(
      { authId: employee._id.toString(), role: USER_ROLES.EMPLOYEES } as JwtPayload,
      { startDate: '2026-10-31', endDate: '2026-11-02' },
    )

    const day = data.employees[0].days.find(d => d.date === '2026-11-01')
    expect(day?.present).toBe(true)
    expect(day?.workMs).toBe(8 * 60 * 60 * 1000)
  })

  it('attributes a session that crosses UTC midnight to its own date only, not a transition-adjacent day', async () => {
    const employee = await seedEmployee()
    // A session close to the UTC day boundary is the only place a
    // date-bucketing bug could actually show up — proving it lands on
    // exactly one bucket, not split or shifted, regardless of the DST
    // dates on either side of it.
    await TimeSession.create({
      user: employee._id,
      startTime: new Date('2026-03-08T23:50:00.000Z'),
      endTime: new Date('2026-03-08T23:59:00.000Z'),
      totalTime: 9 * 60 * 1000,
      status: 'stopped',
      date: '2026-03-08',
    })

    const data = await TimeTrackerService.generateAttendanceReportData(
      { authId: employee._id.toString(), role: USER_ROLES.EMPLOYEES } as JwtPayload,
      { startDate: '2026-03-07', endDate: '2026-03-09' },
    )

    const days = data.employees[0].days
    expect(days.find(d => d.date === '2026-03-08')?.workMs).toBe(9 * 60 * 1000)
    expect(days.find(d => d.date === '2026-03-07')?.present).toBe(false)
    expect(days.find(d => d.date === '2026-03-09')?.present).toBe(false)
  })
})

// Phase 16 QA matrix row: "Report generation while the underlying data is
// being actively written (employee currently clocked in, mid-session)."
// totalTime is only advanced at pause/stop (see startTimer/pauseTimer/
// stopTimer in timetracker.service.ts) — an `active` session that has never
// been paused holds totalTime: 0 in the DB for its entire duration. That's
// the defined rule this suite locks in: an in-progress, never-paused
// session is reported as present with the time already committed by a
// pause/stop event, never a live/partial in-flight duration, and never a
// crash or undefined value.
describe('TimeTrackerService.generateAttendanceReportData — report generated mid-session (Phase 16)', () => {
  const seedEmployee = async () =>
    User.create({
      name: 'Mid-Session Employee',
      email: `mid-session-employee-${Date.now()}-${Math.random()}@example.com`,
      password: 'Password123!',
      role: USER_ROLES.EMPLOYEES,
      status: USER_STATUS.ACTIVE,
      verified: true,
    })

  it('shows a never-paused active session as present with workMs=0 (nothing committed yet), not a crash or negative value', async () => {
    const employee = await seedEmployee()
    await TimeTrackerService.startTimer(
      { authId: employee._id.toString(), role: USER_ROLES.EMPLOYEES } as JwtPayload,
      {},
    )

    const data = await TimeTrackerService.generateAttendanceReportData(
      { authId: employee._id.toString(), role: USER_ROLES.EMPLOYEES } as JwtPayload,
      { startDate: new Date().toISOString().slice(0, 10), endDate: new Date().toISOString().slice(0, 10) },
    )

    const day = data.employees[0].days[0]
    expect(day.present).toBe(true)
    expect(day.workMs).toBe(0)
  })

  it('includes only the time committed by a pause for a session paused mid-way, excluding time elapsed since resume', async () => {
    const employee = await seedEmployee()
    const session = await TimeTrackerService.startTimer(
      { authId: employee._id.toString(), role: USER_ROLES.EMPLOYEES } as JwtPayload,
      {},
    )
    await TimeTrackerService.pauseTimer(
      { authId: employee._id.toString(), role: USER_ROLES.EMPLOYEES } as JwtPayload,
      session._id.toString(),
    )
    await TimeTrackerService.resumeTimer(
      { authId: employee._id.toString(), role: USER_ROLES.EMPLOYEES } as JwtPayload,
      session._id.toString(),
    )

    const committedAfterPause = (await TimeSession.findById(session._id))!.totalTime

    const data = await TimeTrackerService.generateAttendanceReportData(
      { authId: employee._id.toString(), role: USER_ROLES.EMPLOYEES } as JwtPayload,
      { startDate: new Date().toISOString().slice(0, 10), endDate: new Date().toISOString().slice(0, 10) },
    )

    const day = data.employees[0].days[0]
    expect(day.present).toBe(true)
    // Deterministic and reproducible — exactly what pauseTimer already
    // committed to the DB, whatever that value is, not a live-updating one.
    expect(day.workMs).toBe(committedAfterPause)
  })
})

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
