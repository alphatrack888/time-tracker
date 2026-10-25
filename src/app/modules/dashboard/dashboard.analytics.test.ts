import { JwtPayload } from 'jsonwebtoken'
import { getTimeAnalytics } from './dashboard.services'
import { TimeSession } from '../timetracker/timetracker.model'
import { Project } from '../project/project.model'
import { DailyAllocation } from '../project/dailyAllocation.model'
import { User } from '../user/user.model'
import { USER_ROLES, USER_STATUS } from '../../../enum/user'

const seedCompanyAndEmployee = async () => {
  const company = await User.create({
    name: 'Chart Company',
    email: `chart-co-${Date.now()}-${Math.random()}@example.com`,
    password: 'Password123!',
    role: USER_ROLES.COMPANY,
    status: USER_STATUS.ACTIVE,
    verified: true,
  })
  const employee = await User.create({
    name: 'Chart Employee',
    email: `chart-emp-${Date.now()}-${Math.random()}@example.com`,
    password: 'Password123!',
    role: USER_ROLES.EMPLOYEES,
    company: company._id,
    status: USER_STATUS.ACTIVE,
    verified: true,
  })
  return { company, employee }
}

const chartFor = (
  companyId: string,
  employeeId: string,
) => getTimeAnalytics(
  { authId: companyId, role: USER_ROLES.COMPANY } as JwtPayload,
  {
    userId: employeeId,
    startDate: '2026-07-01',
    endDate: '2026-07-02',
    includeChart: true,
  },
)

describe('getTimeAnalytics chart points', () => {
  it('splits a midnight session across the two UTC dates and shows the plan only where it is saved', async () => {
    const { company, employee } = await seedCompanyAndEmployee()
    const project = await Project.create({
      title: 'Chart Project',
      company: company._id,
      employees: [employee._id],
    })
    await TimeSession.create({
      user: employee._id,
      project: project._id,
      startTime: new Date('2026-07-01T22:00:00.000Z'),
      endTime: new Date('2026-07-02T02:00:00.000Z'),
      totalTime: 4 * 60 * 60 * 1000,
      status: 'stopped',
      date: '2026-07-01',
    })
    await DailyAllocation.create({
      company: company._id,
      employee: employee._id,
      project: project._id,
      date: '2026-07-02',
      hours: 4,
    })

    const result = await chartFor(company._id.toString(), employee._id.toString())
    const points = result.chartData.dailyBreakdown

    expect(points.map((point: { date: string; workingHours: number; plannedHours: number }) => ({
      date: point.date,
      workingHours: point.workingHours,
      plannedHours: point.plannedHours,
    }))).toEqual([
      { date: '2026-07-01', workingHours: 2, plannedHours: 0 },
      { date: '2026-07-02', workingHours: 2, plannedHours: 4 },
    ])
  })

  it('counts only the part of a pause that falls on the chart day', async () => {
    const { company, employee } = await seedCompanyAndEmployee()
    await TimeSession.create({
      user: employee._id,
      startTime: new Date('2026-07-01T22:00:00.000Z'),
      endTime: new Date('2026-07-02T02:00:00.000Z'),
      pauses: [{
        start: new Date('2026-07-01T23:30:00.000Z'),
        end: new Date('2026-07-02T00:30:00.000Z'),
      }],
      totalTime: 3 * 60 * 60 * 1000,
      status: 'stopped',
      date: '2026-07-01',
    })

    const result = await chartFor(company._id.toString(), employee._id.toString())
    const july2 = result.chartData.dailyBreakdown.find((point: { date: string }) => point.date === '2026-07-02')

    expect(july2?.breakHours).toBe(0.5)
  })
})
