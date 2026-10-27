import { JwtPayload } from 'jsonwebtoken'
import { ProjectServices } from './project.service'
import { Project } from './project.model'
import { User } from '../user/user.model'
import { TimeSession } from '../timetracker/timetracker.model'
import { USER_ROLES, USER_STATUS } from '../../../enum/user'

const hour = 60 * 60 * 1000

describe('getAllProjects workedHours', () => {
  const createUser = (role: string, company?: string) =>
    User.create({
      name: `${role} user`,
      email: `worked-${role}-${Date.now()}-${Math.random()}@example.com`,
      password: 'Password123!',
      role,
      status: USER_STATUS.ACTIVE,
      verified: true,
      company,
    })

  it('sums this employee’s committed time, keeps an empty project at 0, and includes a session older than 31 days', async () => {
    const company = await createUser(USER_ROLES.COMPANY)
    const employee = await createUser(USER_ROLES.EMPLOYEES, company._id.toString())
    const other = await createUser(USER_ROLES.EMPLOYEES, company._id.toString())
    const [rewe, netto] = await Project.create([
      {
        title: 'Rewe',
        company: company._id,
        employees: [employee._id, other._id],
        projectTime: 8,
      },
      {
        title: 'Netto',
        company: company._id,
        employees: [employee._id],
        projectTime: 8,
      },
    ])
    await TimeSession.create([
      {
        user: employee._id,
        project: rewe._id,
        startTime: new Date('2026-10-01T08:00:00.000Z'),
        endTime: new Date('2026-10-01T10:00:00.000Z'),
        totalTime: 2 * hour,
        status: 'stopped',
        date: '2026-10-01',
      },
      {
        user: employee._id,
        project: rewe._id,
        startTime: new Date('2026-10-02T08:00:00.000Z'),
        endTime: new Date('2026-10-02T09:30:00.000Z'),
        totalTime: 1.5 * hour,
        status: 'stopped',
        date: '2026-10-02',
      },
      {
        user: employee._id,
        project: rewe._id,
        startTime: new Date('2020-01-01T08:00:00.000Z'),
        endTime: new Date('2020-01-01T12:00:00.000Z'),
        totalTime: 4 * hour,
        status: 'stopped',
        date: '2020-01-01',
      },
      {
        user: other._id,
        project: rewe._id,
        startTime: new Date('2026-10-03T08:00:00.000Z'),
        endTime: new Date('2026-10-03T18:00:00.000Z'),
        totalTime: 10 * hour,
        status: 'stopped',
        date: '2026-10-03',
      },
    ])

    const listed = await ProjectServices.getAllProjects(
      { authId: employee._id.toString(), role: USER_ROLES.EMPLOYEES } as JwtPayload,
      {},
      {},
    )
    const byTitle = Object.fromEntries(listed.data.map(project => [project.title, project.workedHours]))
    expect(byTitle.Rewe).toBe(7.5)
    expect(byTitle.Netto).toBe(0)

    const companyList = await ProjectServices.getAllProjects(
      { authId: company._id.toString(), role: USER_ROLES.COMPANY } as JwtPayload,
      {},
      {},
    )
    expect(companyList.data.every(project => !Object.prototype.hasOwnProperty.call(project, 'workedHours'))).toBe(true)
  })
})
