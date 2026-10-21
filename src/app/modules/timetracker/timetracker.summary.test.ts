import { JwtPayload } from 'jsonwebtoken'
import { TimeTrackerService } from './timetracker.service'
import { TimeSession } from './timetracker.model'
import { Project } from '../project/project.model'
import { User } from '../user/user.model'
import { USER_ROLES, USER_STATUS } from '../../../enum/user'

describe('TimeTrackerService.getDailySummary — stored date string', () => {
  it('matches the stored date string and ignores a startTime that falls on another UTC day', async () => {
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

    const missed = await TimeTrackerService.getDailySummary(
      { authId: employee._id.toString(), role: USER_ROLES.EMPLOYEES } as JwtPayload,
      { date: '2026-01-10', project: project._id.toString() },
    )
    expect(missed.sessions).toHaveLength(0)

    const matched = await TimeTrackerService.getDailySummary(
      { authId: employee._id.toString(), role: USER_ROLES.EMPLOYEES } as JwtPayload,
      { date: '2026-01-09', project: project._id.toString() },
    )
    expect(matched.sessions).toHaveLength(1)
    expect((matched.sessions[0] as { date?: string }).date).toBe('2026-01-09')
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
    expect(result.overtime).toBe('2.00')
    expect(result.overtimeInHoursFormatted).toBe('2h 0m')
    expect(result.totalBreakInHoursFormatted).toBe('0h 30m')
  })

  it('uses 8 hours per date when projectTime is the project span', async () => {
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
    expect(result.overtime).toBe('2.00')
    expect(result.overtimeInHoursFormatted).toBe('2h 0m')
  })

  it('allows 8 hours for each date in a project-scoped range', async () => {
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
    expect(result.overtime).toBe('2.00')
    expect(result.overtimeInHoursFormatted).toBe('2h 0m')
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
  })
})
