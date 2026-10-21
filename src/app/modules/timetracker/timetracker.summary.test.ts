import { JwtPayload } from 'jsonwebtoken'
import { TimeTrackerService } from './timetracker.service'
import { TimeSession } from './timetracker.model'
import { Project } from '../project/project.model'
import { User } from '../user/user.model'
import { USER_ROLES, USER_STATUS } from '../../../enum/user'

describe('TimeTrackerService.getDailySummary — date $or startTime', () => {
  it('returns a session whose stored date string is yesterday but startTime is on the requested UTC day', async () => {
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

    const result = await TimeTrackerService.getDailySummary(
      { authId: employee._id.toString(), role: USER_ROLES.EMPLOYEES } as JwtPayload,
      { date: '2026-01-10', project: project._id.toString() },
    )

    expect(result.sessions).toHaveLength(1)
    expect((result.sessions[0] as { date?: string }).date).toBe('2026-01-09')
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
