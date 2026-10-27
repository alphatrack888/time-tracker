import { JwtPayload } from 'jsonwebtoken'
import { ProjectServices } from './project.service'
import { Project } from './project.model'
import { User } from '../user/user.model'
import { TimeSession } from '../timetracker/timetracker.model'
import { USER_ROLES, USER_STATUS } from '../../../enum/user'

const hour = 60 * 60 * 1000
const day = 24 * hour

const createUser = (role: string, company?: string) =>
  User.create({
    name: `${role} user`,
    email: `standing-${role}-${Date.now()}-${Math.random()}@example.com`,
    password: 'Password123!',
    role,
    status: USER_STATUS.ACTIVE,
    verified: true,
    company,
  })

const span = (startOffsetMs: number, endOffsetMs: number) => {
  const now = Date.now()
  return {
    startDate: new Date(now + startOffsetMs),
    endDate: new Date(now + endOffsetMs),
  }
}

const inProgress = () => span(-7 * day, 7 * day)

describe('getStanding', () => {
  it('sums overtime per project and keeps another employee’s time out', async () => {
    const company = await createUser(USER_ROLES.COMPANY)
    const employee = await createUser(USER_ROLES.EMPLOYEES, company._id.toString())
    const other = await createUser(USER_ROLES.EMPLOYEES, company._id.toString())
    const [over, under] = await Project.create([
      {
        title: 'Over',
        company: company._id,
        employees: [employee._id, other._id],
        projectTime: 40,
        ...inProgress(),
      },
      {
        title: 'Under',
        company: company._id,
        employees: [employee._id],
        projectTime: 40,
        ...inProgress(),
      },
    ])
    await TimeSession.create([
      {
        user: employee._id,
        project: over._id,
        startTime: new Date('2026-01-01T08:00:00.000Z'),
        endTime: new Date('2026-01-01T18:00:00.000Z'),
        totalTime: 50 * hour,
        status: 'stopped',
        date: '2026-01-01',
      },
      {
        user: employee._id,
        project: under._id,
        startTime: new Date('2026-01-02T08:00:00.000Z'),
        endTime: new Date('2026-01-02T18:00:00.000Z'),
        totalTime: 10 * hour,
        status: 'stopped',
        date: '2026-01-02',
      },
      {
        user: other._id,
        project: over._id,
        startTime: new Date('2026-01-03T08:00:00.000Z'),
        endTime: new Date('2026-01-03T18:00:00.000Z'),
        totalTime: 20 * hour,
        status: 'stopped',
        date: '2026-01-03',
      },
    ])

    const standing = await ProjectServices.getStanding(
      { authId: employee._id.toString(), role: USER_ROLES.EMPLOYEES } as JwtPayload,
    )
    expect(standing).toEqual({
      workedHours: 60,
      allocatedHours: 80,
      overtimeHours: 10,
      breakHours: 0,
      projectCount: 2,
    })
  })

  it('leaves out upcoming and completed projects', async () => {
    const company = await createUser(USER_ROLES.COMPANY)
    const employee = await createUser(USER_ROLES.EMPLOYEES, company._id.toString())
    const [current, upcoming, completed] = await Project.create([
      {
        title: 'Current',
        company: company._id,
        employees: [employee._id],
        projectTime: 40,
        ...inProgress(),
      },
      {
        title: 'Upcoming',
        company: company._id,
        employees: [employee._id],
        projectTime: 40,
        ...span(day, 14 * day),
      },
      {
        title: 'Completed',
        company: company._id,
        employees: [employee._id],
        projectTime: 40,
        ...span(-14 * day, -day),
      },
    ])
    await TimeSession.create([
      {
        user: employee._id,
        project: current._id,
        startTime: new Date('2026-02-01T08:00:00.000Z'),
        endTime: new Date('2026-02-01T12:00:00.000Z'),
        totalTime: 4 * hour,
        status: 'stopped',
        date: '2026-02-01',
      },
      {
        user: employee._id,
        project: upcoming._id,
        startTime: new Date('2026-02-02T08:00:00.000Z'),
        endTime: new Date('2026-02-02T18:00:00.000Z'),
        totalTime: 10 * hour,
        status: 'stopped',
        date: '2026-02-02',
      },
      {
        user: employee._id,
        project: completed._id,
        startTime: new Date('2026-02-03T08:00:00.000Z'),
        endTime: new Date('2026-02-03T20:00:00.000Z'),
        totalTime: 12 * hour,
        status: 'stopped',
        date: '2026-02-03',
      },
    ])

    const standing = await ProjectServices.getStanding(
      { authId: employee._id.toString(), role: USER_ROLES.EMPLOYEES } as JwtPayload,
    )
    expect(standing.workedHours).toBe(4)
    expect(standing.allocatedHours).toBe(40)
    expect(standing.overtimeHours).toBe(0)
    expect(standing.projectCount).toBe(1)
  })

  it('counts a completed pause and a session older than 31 days, and ignores an open pause', async () => {
    const company = await createUser(USER_ROLES.COMPANY)
    const employee = await createUser(USER_ROLES.EMPLOYEES, company._id.toString())
    const project = await Project.create({
      title: 'Breaks',
      company: company._id,
      employees: [employee._id],
      projectTime: 40,
      ...inProgress(),
    })
    await TimeSession.create([
      {
        user: employee._id,
        project: project._id,
        startTime: new Date('2020-01-01T08:00:00.000Z'),
        endTime: new Date('2020-01-01T12:00:00.000Z'),
        totalTime: 3.5 * hour,
        pauses: [{
          start: new Date('2020-01-01T10:00:00.000Z'),
          end: new Date('2020-01-01T10:30:00.000Z'),
        }],
        status: 'stopped',
        date: '2020-01-01',
      },
      {
        user: employee._id,
        project: project._id,
        startTime: new Date('2026-03-01T08:00:00.000Z'),
        totalTime: 2 * hour,
        pauses: [{ start: new Date('2026-03-01T10:00:00.000Z') }],
        status: 'paused',
        date: '2026-03-01',
      },
    ])

    const standing = await ProjectServices.getStanding(
      { authId: employee._id.toString(), role: USER_ROLES.EMPLOYEES } as JwtPayload,
    )
    expect(standing.workedHours).toBe(5.5)
    expect(standing.breakHours).toBe(0.5)
    expect(standing.projectCount).toBe(1)
  })

  it('counts worked time on a project with no limit and adds no overtime', async () => {
    const company = await createUser(USER_ROLES.COMPANY)
    const employee = await createUser(USER_ROLES.EMPLOYEES, company._id.toString())
    const project = await Project.create({
      title: 'No limit',
      company: company._id,
      employees: [employee._id],
      projectTime: 0,
      ...inProgress(),
    })
    await TimeSession.create({
      user: employee._id,
      project: project._id,
      startTime: new Date('2026-04-01T08:00:00.000Z'),
      endTime: new Date('2026-04-01T13:00:00.000Z'),
      totalTime: 5 * hour,
      status: 'stopped',
      date: '2026-04-01',
    })

    const standing = await ProjectServices.getStanding(
      { authId: employee._id.toString(), role: USER_ROLES.EMPLOYEES } as JwtPayload,
    )
    expect(standing).toMatchObject({
      workedHours: 5,
      allocatedHours: 0,
      overtimeHours: 0,
      projectCount: 1,
    })
  })

  it('returns zeros when the employee has no in-progress project', async () => {
    const company = await createUser(USER_ROLES.COMPANY)
    const employee = await createUser(USER_ROLES.EMPLOYEES, company._id.toString())

    const standing = await ProjectServices.getStanding(
      { authId: employee._id.toString(), role: USER_ROLES.EMPLOYEES } as JwtPayload,
    )
    expect(standing).toEqual({
      workedHours: 0,
      allocatedHours: 0,
      overtimeHours: 0,
      breakHours: 0,
      projectCount: 0,
    })
  })
})
