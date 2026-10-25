import { JwtPayload } from 'jsonwebtoken'
import { TimeTrackerService } from './timetracker.service'
import { TimeSession } from './timetracker.model'
import { Project } from '../project/project.model'
import { DailyAllocation } from '../project/dailyAllocation.model'
import { User } from '../user/user.model'
import { USER_ROLES, USER_STATUS } from '../../../enum/user'

const expectDailyAddsUp = (result: { totalTime: string; dailyWorkedHours: { hours: string }[] }) => {
  const cents = result.dailyWorkedHours.reduce((sum, day) => sum + Math.round(Number(day.hours) * 100), 0)
  expect((cents / 100).toFixed(2)).toBe(result.totalTime)
}

describe('TimeTrackerService.getDailySummary — stored date string', () => {
  it('counts the hours that fall on the queried day, not the stored date string', async () => {
    const employee = await User.create({
      name: 'Summary Employee',
      email: `summary-${Date.now()}-${Math.random()}@example.com`,
      password: 'Password123!',
      role: USER_ROLES.EMPLOYEES,
      status: USER_STATUS.ACTIVE,
      verified: true,
    })
    const project = await Project.create({
      title: 'Summary Project',
      company: employee._id,
      projectTime: 8,
    })

    await TimeSession.create({
      user: employee._id,
      project: project._id,
      startTime: new Date('2026-01-10T01:00:00.000Z'),
      endTime: new Date('2026-01-10T03:00:00.000Z'),
      totalTime: 2 * 60 * 60 * 1000,
      status: 'stopped',
      // UTC-anchored date field from a previous local calendar day.
      date: '2026-01-09',
    })

    const onWorkedDay = await TimeTrackerService.getDailySummary(
      { authId: employee._id.toString(), role: USER_ROLES.EMPLOYEES } as JwtPayload,
      { date: '2026-01-10', project: project._id.toString() },
    )
    expect(onWorkedDay.sessions).toHaveLength(1)
    expect((onWorkedDay.sessions[0] as { date?: string }).date).toBe('2026-01-09')
    expect((onWorkedDay.sessions[0] as { totalTime?: number }).totalTime).toBe(2 * 60 * 60 * 1000)
    expect(onWorkedDay.totalTime).toBe('2.00')
    expect(onWorkedDay.dailyWorkedHours).toEqual([{ date: '2026-01-10', hours: '2.00' }])
    expectDailyAddsUp(onWorkedDay)

    const onStoredDay = await TimeTrackerService.getDailySummary(
      { authId: employee._id.toString(), role: USER_ROLES.EMPLOYEES } as JwtPayload,
      { date: '2026-01-09', project: project._id.toString() },
    )
    expect(onStoredDay.sessions).toHaveLength(0)
    expect(onStoredDay.totalTime).toBe('0.00')
    expect(onStoredDay.dailyWorkedHours).toEqual([{ date: '2026-01-09', hours: '0.00' }])
  })

  it('returns every project when project is omitted', async () => {
    const employee = await User.create({
      name: 'All Projects Employee',
      email: `summary-all-${Date.now()}-${Math.random()}@example.com`,
      password: 'Password123!',
      role: USER_ROLES.EMPLOYEES,
      status: USER_STATUS.ACTIVE,
      verified: true,
    })
    const first = await Project.create({ title: 'First', company: employee._id, projectTime: 8 })
    const second = await Project.create({ title: 'Second', company: employee._id, projectTime: 8 })
    await TimeSession.create({
      user: employee._id,
      project: first._id,
      startTime: new Date('2026-02-01T08:00:00.000Z'),
      endTime: new Date('2026-02-01T10:00:00.000Z'),
      totalTime: 2 * 60 * 60 * 1000,
      status: 'stopped',
      date: '2026-02-01',
    })
    await TimeSession.create({
      user: employee._id,
      project: second._id,
      startTime: new Date('2026-02-01T11:00:00.000Z'),
      endTime: new Date('2026-02-01T12:00:00.000Z'),
      totalTime: 60 * 60 * 1000,
      status: 'stopped',
      date: '2026-02-01',
    })

    const result = await TimeTrackerService.getDailySummary(
      { authId: employee._id.toString(), role: USER_ROLES.EMPLOYEES } as JwtPayload,
      { date: '2026-02-01' },
    )
    expect(result.sessions).toHaveLength(2)
    expectDailyAddsUp(result)
  })

  it('from/to includes only stored dates inside the range', async () => {
    const employee = await User.create({
      name: 'Range Employee',
      email: `summary-range-${Date.now()}-${Math.random()}@example.com`,
      password: 'Password123!',
      role: USER_ROLES.EMPLOYEES,
      status: USER_STATUS.ACTIVE,
      verified: true,
    })
    for (const day of ['2026-03-01', '2026-03-02', '2026-03-04']) {
      await TimeSession.create({
        user: employee._id,
        startTime: new Date(`${day}T08:00:00.000Z`),
        endTime: new Date(`${day}T09:00:00.000Z`),
        totalTime: 60 * 60 * 1000,
        status: 'stopped',
        date: day,
      })
    }

    const result = await TimeTrackerService.getDailySummary(
      { authId: employee._id.toString(), role: USER_ROLES.EMPLOYEES } as JwtPayload,
      { from: '2026-03-01', to: '2026-03-02' },
    )
    const dates = result.sessions.map((s) => (s as { date?: string }).date).sort()
    expect(dates).toEqual(['2026-03-01', '2026-03-02'])
    expectDailyAddsUp(result)
  })

  it('reports overtime in hours, not hours divided by 60', async () => {
    const employee = await User.create({
      name: 'Overtime Employee',
      email: `summary-ot-${Date.now()}-${Math.random()}@example.com`,
      password: 'Password123!',
      role: USER_ROLES.EMPLOYEES,
      status: USER_STATUS.ACTIVE,
      verified: true,
    })
    const project = await Project.create({
      title: 'Overtime Project',
      company: employee._id,
      projectTime: 8,
    })
    await TimeSession.create({
      user: employee._id,
      project: project._id,
      startTime: new Date('2026-04-01T08:00:00.000Z'),
      endTime: new Date('2026-04-01T18:00:00.000Z'),
      totalTime: 10 * 60 * 60 * 1000,
      pauses: [{
        start: new Date('2026-04-01T12:00:00.000Z'),
        end: new Date('2026-04-01T12:30:00.000Z'),
      }],
      status: 'stopped',
      date: '2026-04-01',
    })

    const result = await TimeTrackerService.getDailySummary(
      { authId: employee._id.toString(), role: USER_ROLES.EMPLOYEES } as JwtPayload,
      { date: '2026-04-01', project: project._id.toString() },
    )
    expect(result.totalTime).toBe('9.50')
    expect(result.overtime).toBe('0.00')
    expect(result.overtimeInHoursFormatted).toBe('0h 0m')
    expect(result.totalBreakInHoursFormatted).toBe('0h 30m')
    expect((result.sessions[0] as { totalTime?: number }).totalTime).toBe(10 * 60 * 60 * 1000)
    expectDailyAddsUp(result)
  })

  it('does not treat projectTime as an overtime allowance', async () => {
    const employee = await User.create({
      name: 'Span Overtime Employee',
      email: `summary-span-${Date.now()}-${Math.random()}@example.com`,
      password: 'Password123!',
      role: USER_ROLES.EMPLOYEES,
      status: USER_STATUS.ACTIVE,
      verified: true,
    })
    const project = await Project.create({
      title: 'Long Project',
      company: employee._id,
      projectTime: 720,
    })
    await TimeSession.create({
      user: employee._id,
      project: project._id,
      startTime: new Date('2026-05-01T08:00:00.000Z'),
      endTime: new Date('2026-05-01T18:00:00.000Z'),
      totalTime: 10 * 60 * 60 * 1000,
      status: 'stopped',
      date: '2026-05-01',
    })

    const result = await TimeTrackerService.getDailySummary(
      { authId: employee._id.toString(), role: USER_ROLES.EMPLOYEES } as JwtPayload,
      { date: '2026-05-01', project: project._id.toString() },
    )
    expect(result.overtime).toBe('0.00')
    expect(result.overtimeInHoursFormatted).toBe('0h 0m')
    expect(result.plannedHours).toBe('0.00')
    expectDailyAddsUp(result)
  })

  it('reports no overtime for a range when nothing is planned', async () => {
    const employee = await User.create({
      name: 'Range Overtime Employee',
      email: `summary-range-ot-${Date.now()}-${Math.random()}@example.com`,
      password: 'Password123!',
      role: USER_ROLES.EMPLOYEES,
      status: USER_STATUS.ACTIVE,
      verified: true,
    })
    const project = await Project.create({
      title: 'Range Project',
      company: employee._id,
      projectTime: 720,
    })
    for (const day of ['2026-05-01', '2026-05-02']) {
      await TimeSession.create({
        user: employee._id,
        project: project._id,
        startTime: new Date(`${day}T08:00:00.000Z`),
        endTime: new Date(`${day}T17:00:00.000Z`),
        totalTime: 9 * 60 * 60 * 1000,
        status: 'stopped',
        date: day,
      })
    }

    const result = await TimeTrackerService.getDailySummary(
      { authId: employee._id.toString(), role: USER_ROLES.EMPLOYEES } as JwtPayload,
      { from: '2026-05-01', to: '2026-05-02', project: project._id.toString() },
    )
    expect(result.totalTime).toBe('18.00')
    expectDailyAddsUp(result)
    expect(result.overtime).toBe('0.00')
    expect(result.overtimeInHoursFormatted).toBe('0h 0m')
  })

  it('returns an empty sessions array when none match (does not 400)', async () => {
    const employee = await User.create({
      name: 'Empty Summary Employee',
      email: `summary-empty-${Date.now()}-${Math.random()}@example.com`,
      password: 'Password123!',
      role: USER_ROLES.EMPLOYEES,
      status: USER_STATUS.ACTIVE,
      verified: true,
    })
    const project = await Project.create({
      title: 'Empty Summary Project',
      company: employee._id,
      projectTime: 8,
    })

    const result = await TimeTrackerService.getDailySummary(
      { authId: employee._id.toString(), role: USER_ROLES.EMPLOYEES } as JwtPayload,
      { date: '2026-01-10', project: project._id.toString() },
    )

    expect(result.sessions).toEqual([])
    expect(result.plannedHours).toBe('0.00')
  })

  it('counts overtime as logged time past the planned hours', async () => {
    const company = await User.create({
      name: 'Plan Company',
      email: `plan-co-${Date.now()}-${Math.random()}@example.com`,
      password: 'Password123!',
      role: USER_ROLES.COMPANY,
      status: USER_STATUS.ACTIVE,
      verified: true,
    })
    const employee = await User.create({
      name: 'Planned Employee',
      email: `plan-emp-${Date.now()}-${Math.random()}@example.com`,
      password: 'Password123!',
      role: USER_ROLES.EMPLOYEES,
      status: USER_STATUS.ACTIVE,
      verified: true,
    })
    const project = await Project.create({
      title: 'Planned Project',
      company: company._id,
      employees: [employee._id],
      projectTime: 720,
    })
    await DailyAllocation.create({
      company: company._id,
      employee: employee._id,
      project: project._id,
      date: '2026-06-01',
      hours: 4,
    })
    await TimeSession.create({
      user: employee._id,
      project: project._id,
      startTime: new Date('2026-06-01T08:00:00.000Z'),
      endTime: new Date('2026-06-01T14:00:00.000Z'),
      totalTime: 6 * 60 * 60 * 1000,
      status: 'stopped',
      date: '2026-06-01',
    })

    const result = await TimeTrackerService.getDailySummary(
      { authId: employee._id.toString(), role: USER_ROLES.EMPLOYEES } as JwtPayload,
      { date: '2026-06-01' },
    )
    expect(result.totalTime).toBe('6.00')
    expectDailyAddsUp(result)
    expect(result.plannedHours).toBe('4.00')
    expect(result.overtime).toBe('2.00')
    expect(result.overtimeInHoursFormatted).toBe('2h 0m')
  })

  it('reports 6 hours of overtime when 10 hours are logged against a 4 hour plan', async () => {
    const company = await User.create({
      name: 'Ten Hour Company',
      email: `plan-ten-co-${Date.now()}-${Math.random()}@example.com`,
      password: 'Password123!',
      role: USER_ROLES.COMPANY,
      status: USER_STATUS.ACTIVE,
      verified: true,
    })
    const employee = await User.create({
      name: 'Ten Hour Employee',
      email: `plan-ten-emp-${Date.now()}-${Math.random()}@example.com`,
      password: 'Password123!',
      role: USER_ROLES.EMPLOYEES,
      status: USER_STATUS.ACTIVE,
      verified: true,
    })
    const project = await Project.create({
      title: 'Ten Hour Project',
      company: company._id,
      employees: [employee._id],
      projectTime: 8,
    })
    await DailyAllocation.create({
      company: company._id,
      employee: employee._id,
      project: project._id,
      date: '2026-06-10',
      hours: 4,
    })
    await TimeSession.create({
      user: employee._id,
      project: project._id,
      startTime: new Date('2026-06-10T08:00:00.000Z'),
      endTime: new Date('2026-06-10T18:00:00.000Z'),
      totalTime: 10 * 60 * 60 * 1000,
      status: 'stopped',
      date: '2026-06-10',
    })

    const result = await TimeTrackerService.getDailySummary(
      { authId: employee._id.toString(), role: USER_ROLES.EMPLOYEES } as JwtPayload,
      { date: '2026-06-10' },
    )
    expect(result.totalTime).toBe('10.00')
    expectDailyAddsUp(result)
    expect(result.plannedHours).toBe('4.00')
    expect(result.overtime).toBe('6.00')
    expect(result.overtimeInHoursFormatted).toBe('6h 0m')
  })

  it('sums planned hours across projects on the same day, and a project filter counts only that project', async () => {
    const company = await User.create({
      name: 'Sum Company',
      email: `plan-sum-co-${Date.now()}-${Math.random()}@example.com`,
      password: 'Password123!',
      role: USER_ROLES.COMPANY,
      status: USER_STATUS.ACTIVE,
      verified: true,
    })
    const employee = await User.create({
      name: 'Sum Employee',
      email: `plan-sum-emp-${Date.now()}-${Math.random()}@example.com`,
      password: 'Password123!',
      role: USER_ROLES.EMPLOYEES,
      status: USER_STATUS.ACTIVE,
      verified: true,
    })
    const first = await Project.create({
      title: 'First Planned',
      company: company._id,
      employees: [employee._id],
      projectTime: 8,
    })
    const second = await Project.create({
      title: 'Second Planned',
      company: company._id,
      employees: [employee._id],
      projectTime: 8,
    })
    await DailyAllocation.create({
      company: company._id,
      employee: employee._id,
      project: first._id,
      date: '2026-06-02',
      hours: 4,
    })
    await DailyAllocation.create({
      company: company._id,
      employee: employee._id,
      project: second._id,
      date: '2026-06-02',
      hours: 3,
    })
    await TimeSession.create({
      user: employee._id,
      project: first._id,
      startTime: new Date('2026-06-02T08:00:00.000Z'),
      endTime: new Date('2026-06-02T14:00:00.000Z'),
      totalTime: 6 * 60 * 60 * 1000,
      status: 'stopped',
      date: '2026-06-02',
    })

    const user = { authId: employee._id.toString(), role: USER_ROLES.EMPLOYEES } as JwtPayload
    const combined = await TimeTrackerService.getDailySummary(user, { date: '2026-06-02' })
    expect(combined.plannedHours).toBe('7.00')
    expect(combined.totalTime).toBe('6.00')
    expectDailyAddsUp(combined)
    expect(combined.overtime).toBe('0.00')

    const filtered = await TimeTrackerService.getDailySummary(user, {
      date: '2026-06-02',
      project: first._id.toString(),
    })
    expect(filtered.plannedHours).toBe('4.00')
    expect(filtered.overtime).toBe('2.00')
  })

  it('sums planned hours across the dates in a range', async () => {
    const employee = await User.create({
      name: 'Range Plan Employee',
      email: `plan-range-${Date.now()}-${Math.random()}@example.com`,
      password: 'Password123!',
      role: USER_ROLES.EMPLOYEES,
      status: USER_STATUS.ACTIVE,
      verified: true,
    })
    const project = await Project.create({
      title: 'Range Plan',
      company: employee._id,
      projectTime: 8,
    })
    await DailyAllocation.create({
      company: employee._id,
      employee: employee._id,
      project: project._id,
      date: '2026-06-03',
      hours: 4,
    })
    await DailyAllocation.create({
      company: employee._id,
      employee: employee._id,
      project: project._id,
      date: '2026-06-04',
      hours: 3,
    })
    await DailyAllocation.create({
      company: employee._id,
      employee: employee._id,
      project: project._id,
      date: '2026-06-05',
      hours: 9,
    })

    const result = await TimeTrackerService.getDailySummary(
      { authId: employee._id.toString(), role: USER_ROLES.EMPLOYEES } as JwtPayload,
      { from: '2026-06-03', to: '2026-06-04' },
    )
    expect(result.plannedHours).toBe('7.00')
    expect(result.overtime).toBe('0.00')
    expect(result.sessions).toEqual([])
    expectDailyAddsUp(result)
  })

  it('counts only the part of a session that falls inside the range', async () => {
    const employee = await User.create({
      name: 'Midnight Employee',
      email: `summary-midnight-${Date.now()}-${Math.random()}@example.com`,
      password: 'Password123!',
      role: USER_ROLES.EMPLOYEES,
      status: USER_STATUS.ACTIVE,
      verified: true,
    })
    await TimeSession.create({
      user: employee._id,
      startTime: new Date('2026-07-01T22:00:00.000Z'),
      endTime: new Date('2026-07-02T02:00:00.000Z'),
      totalTime: 4 * 60 * 60 * 1000,
      status: 'stopped',
      date: '2026-07-01',
    })
    await TimeSession.create({
      user: employee._id,
      startTime: new Date('2026-07-03T08:00:00.000Z'),
      endTime: new Date('2026-07-03T09:00:00.000Z'),
      totalTime: 60 * 60 * 1000,
      status: 'stopped',
      date: '2026-07-03',
    })

    const user = { authId: employee._id.toString(), role: USER_ROLES.EMPLOYEES } as JwtPayload
    const partial = await TimeTrackerService.getDailySummary(user, { from: '2026-07-02', to: '2026-07-02' })
    expect(partial.sessions).toHaveLength(1)
    expect((partial.sessions[0] as { totalTime?: number }).totalTime).toBe(4 * 60 * 60 * 1000)
    expect(partial.totalTime).toBe('2.00')
    expect(partial.dailyWorkedHours).toEqual([{ date: '2026-07-02', hours: '2.00' }])
    expectDailyAddsUp(partial)

    const bothDays = await TimeTrackerService.getDailySummary(user, { from: '2026-07-01', to: '2026-07-02' })
    expect(bothDays.dailyWorkedHours).toEqual([
      { date: '2026-07-01', hours: '2.00' },
      { date: '2026-07-02', hours: '2.00' },
    ])
    expect(bothDays.totalTime).toBe('4.00')
    expectDailyAddsUp(bothDays)

    const outside = await TimeTrackerService.getDailySummary(user, { date: '2026-07-02' })
    const outsideDates = outside.sessions.map(session => (session as { date?: string }).date)
    expect(outsideDates).not.toContain('2026-07-03')
  })

  it('counts only the part of a pause that falls inside the range', async () => {
    const employee = await User.create({
      name: 'Clipped Break Employee',
      email: `summary-break-${Date.now()}-${Math.random()}@example.com`,
      password: 'Password123!',
      role: USER_ROLES.EMPLOYEES,
      status: USER_STATUS.ACTIVE,
      verified: true,
    })
    await TimeSession.create({
      user: employee._id,
      startTime: new Date('2026-07-01T22:00:00.000Z'),
      endTime: new Date('2026-07-02T02:00:00.000Z'),
      totalTime: 3 * 60 * 60 * 1000,
      pauses: [{
        start: new Date('2026-07-01T23:30:00.000Z'),
        end: new Date('2026-07-02T00:30:00.000Z'),
      }],
      status: 'stopped',
      date: '2026-07-01',
    })

    const result = await TimeTrackerService.getDailySummary(
      { authId: employee._id.toString(), role: USER_ROLES.EMPLOYEES } as JwtPayload,
      { date: '2026-07-02' },
    )
    expect(result.totalBreakInHoursFormatted).toBe('0h 30m')
    expectDailyAddsUp(result)
  })
})
