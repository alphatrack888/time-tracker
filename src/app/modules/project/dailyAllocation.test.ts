import request from 'supertest'
import app from '../../../app'
import { User } from '../user/user.model'
import { Project } from './project.model'
import { DailyAllocation } from './dailyAllocation.model'
import { ProjectServices } from './project.service'
import { TimeTrackerService } from '../timetracker/timetracker.service'
import { signTestToken } from '../../../test/testAuth'
import { JwtPayload } from 'jsonwebtoken'
import { USER_ROLES, USER_STATUS } from '../../../enum/user'

const createPeople = async () => {
  const company = await User.create({
    name: 'Allocation Company',
    email: `alloc-co-${Date.now()}-${Math.random()}@example.com`,
    password: 'Password123!',
    role: USER_ROLES.COMPANY,
    status: USER_STATUS.ACTIVE,
    verified: true,
  })
  const employee = await User.create({
    name: 'Allocation Employee',
    email: `alloc-emp-${Date.now()}-${Math.random()}@example.com`,
    password: 'Password123!',
    role: USER_ROLES.EMPLOYEES,
    status: USER_STATUS.ACTIVE,
    verified: true,
  })
  const project = await Project.create({
    title: 'Allocation Project',
    company: company._id,
    employees: [employee._id],
    projectTime: 8,
  })
  const { token } = signTestToken({
    authId: company._id.toString(),
    role: USER_ROLES.COMPANY,
  })
  return { company, employee, project, token }
}

describe('PUT /project/:id/daily-allocation', () => {
  it('saves the planned hours for an assigned employee, and replaces a previous plan', async () => {
    const { employee, project, token } = await createPeople()

    const created = await request(app)
      .put(`/api/v1/project/${project._id}/daily-allocation`)
      .set('Authorization', `Bearer ${token}`)
      .send({ employee: employee._id.toString(), date: '2026-10-23', hours: 4 })

    expect(created.status).toBe(200)
    expect(created.body.data.hours).toBe(4)

    const replaced = await request(app)
      .put(`/api/v1/project/${project._id}/daily-allocation`)
      .set('Authorization', `Bearer ${token}`)
      .send({ employee: employee._id.toString(), date: '2026-10-23', hours: 5 })

    expect(replaced.status).toBe(200)
    expect(replaced.body.data.hours).toBe(5)
    const rows = await DailyAllocation.find({ employee: employee._id, project: project._id })
    expect(rows).toHaveLength(1)
    expect(rows[0].hours).toBe(5)
  })

  it('removes the plan when hours is 0', async () => {
    const { company, employee, project, token } = await createPeople()
    await DailyAllocation.create({
      company: company._id,
      employee: employee._id,
      project: project._id,
      date: '2026-10-23',
      hours: 4,
    })

    const res = await request(app)
      .put(`/api/v1/project/${project._id}/daily-allocation`)
      .set('Authorization', `Bearer ${token}`)
      .send({ employee: employee._id.toString(), date: '2026-10-23', hours: 0 })

    expect(res.status).toBe(200)
    expect(res.body.data.hours).toBe(0)
    const rows = await DailyAllocation.find({ employee: employee._id, date: '2026-10-23' })
    expect(rows).toHaveLength(0)
  })

  it('rejects an employee who is not assigned to the project', async () => {
    const { project, token } = await createPeople()
    const outsider = await User.create({
      name: 'Outsider',
      email: `alloc-out-${Date.now()}-${Math.random()}@example.com`,
      password: 'Password123!',
      role: USER_ROLES.EMPLOYEES,
      status: USER_STATUS.ACTIVE,
      verified: true,
    })

    const res = await request(app)
      .put(`/api/v1/project/${project._id}/daily-allocation`)
      .set('Authorization', `Bearer ${token}`)
      .send({ employee: outsider._id.toString(), date: '2026-10-23', hours: 4 })

    expect(res.status).toBe(400)
  })

  it('rejects a company that does not own the project, and an employee token', async () => {
    const { employee, project } = await createPeople()
    const other = signTestToken({ role: USER_ROLES.COMPANY })
    const employeeToken = signTestToken({
      authId: employee._id.toString(),
      role: USER_ROLES.EMPLOYEES,
    })

    const foreign = await request(app)
      .put(`/api/v1/project/${project._id}/daily-allocation`)
      .set('Authorization', `Bearer ${other.token}`)
      .send({ employee: employee._id.toString(), date: '2026-10-23', hours: 4 })
    expect(foreign.status).toBe(403)

    const worker = await request(app)
      .put(`/api/v1/project/${project._id}/daily-allocation`)
      .set('Authorization', `Bearer ${employeeToken.token}`)
      .send({ employee: employee._id.toString(), date: '2026-10-23', hours: 4 })
    expect(worker.status).toBe(403)
  })

  it('clears a leftover plan after the employee is no longer assigned', async () => {
    const { company, employee, project, token } = await createPeople()
    await DailyAllocation.create({
      company: company._id,
      employee: employee._id,
      project: project._id,
      date: '2026-10-23',
      hours: 4,
    })
    await Project.findByIdAndUpdate(project._id, { employees: [] })

    const res = await request(app)
      .put(`/api/v1/project/${project._id}/daily-allocation`)
      .set('Authorization', `Bearer ${token}`)
      .send({ employee: employee._id.toString(), date: '2026-10-23', hours: 0 })

    expect(res.status).toBe(200)
    const rows = await DailyAllocation.find({ project: project._id })
    expect(rows).toHaveLength(0)
  })

  it('drops planned hours when the employee is removed from the project', async () => {
    const { company, employee, project } = await createPeople()
    await DailyAllocation.create({
      company: company._id,
      employee: employee._id,
      project: project._id,
      date: '2026-10-23',
      hours: 4,
    })

    await ProjectServices.updateProject(
      { authId: company._id.toString(), role: USER_ROLES.COMPANY } as JwtPayload,
      project._id.toString(),
      { employees: [] },
    )

    const rows = await DailyAllocation.find({ project: project._id })
    expect(rows).toHaveLength(0)
  })

  it('returns saved rows to the owning company, and an empty list when nothing is planned', async () => {
    const { employee, project, token } = await createPeople()
    const empty = await request(app)
      .get(`/api/v1/project/${project._id}/daily-allocation`)
      .set('Authorization', `Bearer ${token}`)
    expect(empty.status).toBe(200)
    expect(empty.body.data).toEqual([])

    await request(app)
      .put(`/api/v1/project/${project._id}/daily-allocation`)
      .set('Authorization', `Bearer ${token}`)
      .send({ employee: employee._id.toString(), date: '2026-10-24', hours: 6 })
    await request(app)
      .put(`/api/v1/project/${project._id}/daily-allocation`)
      .set('Authorization', `Bearer ${token}`)
      .send({ employee: employee._id.toString(), date: '2026-10-23', hours: 4 })

    const saved = await request(app)
      .get(`/api/v1/project/${project._id}/daily-allocation`)
      .set('Authorization', `Bearer ${token}`)
    expect(saved.status).toBe(200)
    expect(saved.body.data).toEqual([
      { employee: employee._id.toString(), name: 'Allocation Employee', date: '2026-10-23', hours: 4 },
      { employee: employee._id.toString(), name: 'Allocation Employee', date: '2026-10-24', hours: 6 },
    ])
  })

  it('rejects a company that does not own the project when reading plans', async () => {
    const { project } = await createPeople()
    const other = signTestToken({ role: USER_ROLES.COMPANY })
    const res = await request(app)
      .get(`/api/v1/project/${project._id}/daily-allocation`)
      .set('Authorization', `Bearer ${other.token}`)
    expect(res.status).toBe(403)
  })

  it('puts the saved hours on the employee summary, and clearing them removes the plan', async () => {
    const { employee, project, token } = await createPeople()
    const user = { authId: employee._id.toString(), role: USER_ROLES.EMPLOYEES } as JwtPayload

    const saved = await request(app)
      .put(`/api/v1/project/${project._id}/daily-allocation`)
      .set('Authorization', `Bearer ${token}`)
      .send({ employee: employee._id.toString(), date: '2026-10-23', hours: 4 })
    expect(saved.status).toBe(200)

    const withPlan = await TimeTrackerService.getDailySummary(user, { date: '2026-10-23' })
    expect(withPlan.plannedHours).toBe('4.00')

    const cleared = await request(app)
      .put(`/api/v1/project/${project._id}/daily-allocation`)
      .set('Authorization', `Bearer ${token}`)
      .send({ employee: employee._id.toString(), date: '2026-10-23', hours: 0 })
    expect(cleared.status).toBe(200)

    const withoutPlan = await TimeTrackerService.getDailySummary(user, { date: '2026-10-23' })
    expect(withoutPlan.plannedHours).toBe('0.00')
    expect(withoutPlan.overtime).toBe('0.00')
    const rows = await DailyAllocation.find({ project: project._id })
    expect(rows).toHaveLength(0)
  })

  it('drops planned hours when the project is deleted', async () => {
    const { company, employee, project } = await createPeople()
    await DailyAllocation.create({
      company: company._id,
      employee: employee._id,
      project: project._id,
      date: '2026-10-23',
      hours: 4,
    })
    await Project.findByIdAndUpdate(project._id, { employees: [] })

    await ProjectServices.deleteProject(
      { authId: company._id.toString(), role: USER_ROLES.COMPANY } as JwtPayload,
      project._id.toString(),
    )

    const rows = await DailyAllocation.find({ project: project._id })
    expect(rows).toHaveLength(0)
  })
})
