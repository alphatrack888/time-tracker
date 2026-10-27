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
    const byTitle = Object.fromEntries(listed.data.map(project => [project.title, project]))
    expect(byTitle.Rewe.workedHours).toBe(7.5)
    expect(byTitle.Rewe.overtimeHours).toBe(0)
    expect(byTitle.Netto.workedHours).toBe(0)
    expect(byTitle.Netto.overtimeHours).toBe(0)

    const companyList = await ProjectServices.getAllProjects(
      { authId: company._id.toString(), role: USER_ROLES.COMPANY } as JwtPayload,
      {},
      {},
    )
    expect(companyList.data.every(project => !Object.prototype.hasOwnProperty.call(project, 'workedHours'))).toBe(true)
    expect(companyList.data.every(project => !Object.prototype.hasOwnProperty.call(project, 'overtimeHours'))).toBe(true)
  })

  const session = (
    user: { _id: unknown },
    project: { _id: unknown },
    totalTime: number,
  ) => ({
    user: user._id,
    project: project._id,
    startTime: new Date('2026-10-01T08:00:00.000Z'),
    endTime: new Date('2026-10-01T18:00:00.000Z'),
    totalTime,
    status: 'stopped',
    date: '2026-10-01',
  })

  it('returns worked and overtime from the list and the single project, ignoring another employee', async () => {
    const company = await createUser(USER_ROLES.COMPANY)
    const employee = await createUser(USER_ROLES.EMPLOYEES, company._id.toString())
    const other = await createUser(USER_ROLES.EMPLOYEES, company._id.toString())
    const project = await Project.create({
      title: 'Site',
      company: company._id,
      employees: [employee._id, other._id],
      projectTime: 40,
    })
    await TimeSession.create([
      session(employee, project, 42 * hour),
      session(other, project, 10 * hour),
    ])
    const auth = { authId: employee._id.toString(), role: USER_ROLES.EMPLOYEES } as JwtPayload

    const listed = await ProjectServices.getAllProjects(auth, {}, {})
    expect(listed.data[0].workedHours).toBe(42)
    expect(listed.data[0].overtimeHours).toBe(2)

    const single = await ProjectServices.getSingleProject(auth, project._id.toString())
    expect(single.workedHours).toBe(42)
    expect(single.overtimeHours).toBe(2)
  })

  it('returns overtime 0 at the limit and when the project has no limit', async () => {
    const company = await createUser(USER_ROLES.COMPANY)
    const employee = await createUser(USER_ROLES.EMPLOYEES, company._id.toString())
    const [atLimit, noLimit] = await Project.create([
      {
        title: 'At limit',
        company: company._id,
        employees: [employee._id],
        projectTime: 40,
      },
      {
        title: 'No limit',
        company: company._id,
        employees: [employee._id],
        projectTime: 0,
      },
    ])
    await TimeSession.create([
      session(employee, atLimit, 40 * hour),
      session(employee, noLimit, 5 * hour),
    ])
    const auth = { authId: employee._id.toString(), role: USER_ROLES.EMPLOYEES } as JwtPayload

    const listed = await ProjectServices.getAllProjects(auth, {}, {})
    const byTitle = Object.fromEntries(listed.data.map(project => [project.title, project]))
    expect(byTitle['At limit'].workedHours).toBe(40)
    expect(byTitle['At limit'].overtimeHours).toBe(0)
    expect(byTitle['No limit'].workedHours).toBe(5)
    expect(byTitle['No limit'].overtimeHours).toBe(0)

    const single = await ProjectServices.getSingleProject(auth, noLimit._id.toString())
    expect(single.workedHours).toBe(5)
    expect(single.overtimeHours).toBe(0)
  })

  it('puts each assigned person’s worked and overtime on the company single project', async () => {
    const company = await createUser(USER_ROLES.COMPANY)
    const employee = await createUser(USER_ROLES.EMPLOYEES, company._id.toString())
    const idle = await createUser(USER_ROLES.EMPLOYEES, company._id.toString())
    const project = await Project.create({
      title: 'Crew',
      company: company._id,
      employees: [employee._id, idle._id],
      projectTime: 40,
    })
    await TimeSession.create(session(employee, project, 42 * hour))

    const single = await ProjectServices.getSingleProject(
      { authId: company._id.toString(), role: USER_ROLES.COMPANY } as JwtPayload,
      project._id.toString(),
    )
    expect(Object.prototype.hasOwnProperty.call(single, 'workedHours')).toBe(false)
    expect(Object.prototype.hasOwnProperty.call(single, 'overtimeHours')).toBe(false)

    const people = single.employees as unknown as Array<{
      _id: { toString(): string }
      workedHours: number
      overtimeHours: number
    }>
    const byId = Object.fromEntries(people.map(person => [String(person._id), person]))
    expect(byId[employee._id.toString()].workedHours).toBe(42)
    expect(byId[employee._id.toString()].overtimeHours).toBe(2)
    expect(byId[idle._id.toString()].workedHours).toBe(0)
    expect(byId[idle._id.toString()].overtimeHours).toBe(0)
  })
})
