import { JwtPayload } from 'jsonwebtoken'
import { StatusCodes } from 'http-status-codes'
import { TimeTrackerService } from './timetracker.service'
import { TimeSession } from './timetracker.model'
import { Project } from '../project/project.model'
import { User } from '../user/user.model'
import { USER_ROLES, USER_STATUS } from '../../../enum/user'
import ApiError from '../../../errors/ApiError'

describe('one open session per employee', () => {
  const seedEmployee = async () =>
    User.create({
      name: 'Open Session Employee',
      email: `open-session-${Date.now()}-${Math.random()}@example.com`,
      password: 'Password123!',
      role: USER_ROLES.EMPLOYEES,
      status: USER_STATUS.ACTIVE,
      verified: true,
    })

  const asUser = (id: string) =>
    ({ authId: id, role: USER_ROLES.EMPLOYEES } as JwtPayload)

  it('rejects a second start while a session is active and does not insert a row', async () => {
    const employee = await seedEmployee()
    await TimeSession.create({
      user: employee._id,
      startTime: new Date('2026-06-01T08:00:00.000Z'),
      status: 'active',
      date: '2026-06-01',
      totalTime: 0,
    })

    await expect(
      TimeTrackerService.startTimer(asUser(employee._id.toString()), {}),
    ).rejects.toBeInstanceOf(ApiError)
    await expect(
      TimeTrackerService.startTimer(asUser(employee._id.toString()), {}),
    ).rejects.toMatchObject({ statusCode: StatusCodes.CONFLICT })

    expect(await TimeSession.countDocuments({ user: employee._id })).toBe(1)
  })

  it('rejects a second start while a session is paused', async () => {
    const employee = await seedEmployee()
    await TimeSession.create({
      user: employee._id,
      startTime: new Date('2026-06-01T08:00:00.000Z'),
      status: 'paused',
      date: '2026-06-01',
      totalTime: 60_000,
      pauses: [{ start: new Date('2026-06-01T08:01:00.000Z') }],
    })

    await expect(
      TimeTrackerService.startTimer(asUser(employee._id.toString()), {}),
    ).rejects.toMatchObject({ statusCode: StatusCodes.CONFLICT })
    expect(await TimeSession.countDocuments({ user: employee._id })).toBe(1)
  })

  it('allows a new start after the previous session is stopped', async () => {
    const employee = await seedEmployee()
    await TimeSession.create({
      user: employee._id,
      startTime: new Date('2026-06-01T08:00:00.000Z'),
      endTime: new Date('2026-06-01T09:00:00.000Z'),
      status: 'stopped',
      date: '2026-06-01',
      totalTime: 60 * 60 * 1000,
    })

    const created = await TimeTrackerService.startTimer(asUser(employee._id.toString()), {})
    expect(created.status).toBe('active')
    expect(await TimeSession.countDocuments({ user: employee._id, status: 'active' })).toBe(1)
  })
})

describe('TimeTrackerService.getOpenSessions', () => {
  const seedEmployee = async (name: string) =>
    User.create({
      name,
      email: `open-list-${Date.now()}-${Math.random()}@example.com`,
      password: 'Password123!',
      role: USER_ROLES.EMPLOYEES,
      status: USER_STATUS.ACTIVE,
      verified: true,
    })

  it('returns open sessions oldest first, with paused time committed and the active tail included', async () => {
    const employee = await seedEmployee('Listed Employee')
    const other = await seedEmployee('Other Employee')
    const project = await Project.create({ title: 'rewe' })
    const now = new Date('2026-06-01T12:00:00.000Z')

    const older = await TimeSession.create({
      user: employee._id,
      project: project._id,
      startTime: new Date('2026-06-01T09:00:00.000Z'),
      status: 'paused',
      date: '2026-06-01',
      totalTime: 90_000,
      pauses: [{ start: new Date('2026-06-01T09:01:30.000Z') }],
    })
    const newer = await TimeSession.create({
      user: employee._id,
      startTime: new Date('2026-06-01T10:00:00.000Z'),
      status: 'active',
      date: '2026-06-01',
      totalTime: 60_000,
      pauses: [{
        start: new Date('2026-06-01T10:30:00.000Z'),
        end: new Date('2026-06-01T11:30:00.000Z'),
      }],
    })
    await TimeSession.create({
      user: employee._id,
      startTime: new Date('2026-06-01T07:00:00.000Z'),
      endTime: new Date('2026-06-01T08:00:00.000Z'),
      status: 'stopped',
      date: '2026-06-01',
      totalTime: 60 * 60 * 1000,
    })
    await TimeSession.create({
      user: other._id,
      startTime: new Date('2026-06-01T08:00:00.000Z'),
      status: 'active',
      date: '2026-06-01',
      totalTime: 0,
    })

    const open = await TimeTrackerService.getOpenSessions(
      { authId: employee._id.toString(), role: USER_ROLES.EMPLOYEES } as JwtPayload,
      now,
    )

    expect(open.map(session => session.id)).toEqual([
      older._id.toString(),
      newer._id.toString(),
    ])
    expect(open[0].elapsedMs).toBe(90_000)
    expect(open[0].project).toEqual({ id: project._id.toString(), title: 'rewe' })
    expect(open[1].project).toBeNull()
    // 60s already committed, plus 30 minutes since the last pause ended.
    expect(open[1].elapsedMs).toBe(60_000 + 30 * 60 * 1000)
  })
})
