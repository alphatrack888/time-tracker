import { JwtPayload } from 'jsonwebtoken'
import { UserServices, workingHoursWindow } from './user.service'
import { TimeSession } from '../timetracker/timetracker.model'
import { User } from './user.model'
import { USER_ROLES, USER_STATUS } from '../../../enum/user'

describe('workingHoursWindow', () => {
  it('uses the UTC Monday and UTC month start for a date string', () => {
    // 2026-01-10 is a Saturday. UTC Monday is 2026-01-05.
    // A server east of UTC would otherwise start the week on 2026-01-04
    // and the month on 2025-12-31.
    expect(workingHoursWindow('2026-01-10')).toEqual({
      today: '2026-01-10',
      weekStart: '2026-01-05',
      monthStart: '2026-01-01',
    })
  })
})

describe('UserServices.getWorkingHoursSummary — UTC windows', () => {
  it('excludes the local-previous day and includes the UTC Monday and month start', async () => {
    const employee = await User.create({
      name: 'Hours Employee',
      email: `hours-${Date.now()}-${Math.random()}@example.com`,
      password: 'Password123!',
      role: USER_ROLES.EMPLOYEES,
      status: USER_STATUS.ACTIVE,
      verified: true,
    })
    const hour = 60 * 60 * 1000
    const rows: Array<[string, number]> = [
      ['2025-12-31', 4],
      ['2026-01-01', 1],
      ['2026-01-04', 1],
      ['2026-01-05', 2],
      ['2026-01-10', 3],
    ]
    for (const [day, hours] of rows) {
      await TimeSession.create({
        user: employee._id,
        startTime: new Date(`${day}T08:00:00.000Z`),
        endTime: new Date(`${day}T09:00:00.000Z`),
        totalTime: hours * hour,
        status: 'stopped',
        date: day,
      })
    }

    const result = await UserServices.getWorkingHoursSummary(
      { authId: employee._id.toString(), role: USER_ROLES.EMPLOYEES } as JwtPayload,
      '2026-01-10',
    )
    expect(result.today).toBe(3)
    expect(result.thisWeek).toBe(5)
    expect(result.thisMonth).toBe(7)
  })

  it('keeps the previous month Monday in this week and out of this month', async () => {
    const employee = await User.create({
      name: 'Boundary Hours Employee',
      email: `hours-boundary-${Date.now()}-${Math.random()}@example.com`,
      password: 'Password123!',
      role: USER_ROLES.EMPLOYEES,
      status: USER_STATUS.ACTIVE,
      verified: true,
    })
    const hour = 60 * 60 * 1000
    // 2026-02-01 is a Sunday. That week's UTC Monday is 2026-01-26.
    for (const [day, hours] of [['2026-01-26', 2], ['2026-02-01', 1]] as Array<[string, number]>) {
      await TimeSession.create({
        user: employee._id,
        startTime: new Date(`${day}T08:00:00.000Z`),
        endTime: new Date(`${day}T09:00:00.000Z`),
        totalTime: hours * hour,
        status: 'stopped',
        date: day,
      })
    }

    const result = await UserServices.getWorkingHoursSummary(
      { authId: employee._id.toString(), role: USER_ROLES.EMPLOYEES } as JwtPayload,
      '2026-02-01',
    )
    expect(result.today).toBe(1)
    expect(result.thisWeek).toBe(3)
    expect(result.thisMonth).toBe(1)
  })
})
