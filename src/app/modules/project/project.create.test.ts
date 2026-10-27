import request from 'supertest'
import app from '../../../app'
import { User } from '../user/user.model'
import { Project } from './project.model'
import { signTestToken } from '../../../test/testAuth'
import { USER_ROLES, USER_STATUS } from '../../../enum/user'
import { appEvents } from '../../../helpers/appEvents'

const createCompany = async (label: string) => {
  const company = await User.create({
    name: `${label} Company`,
    email: `create-co-${label}-${Date.now()}-${Math.random()}@example.com`,
    password: 'Password123!',
    role: USER_ROLES.COMPANY,
    status: USER_STATUS.ACTIVE,
    verified: true,
  })
  const { token } = signTestToken({
    authId: company._id.toString(),
    role: USER_ROLES.COMPANY,
  })
  return { company, token }
}

const createEmployee = async (companyId: string) =>
  User.create({
    name: 'Create Employee',
    email: `create-emp-${Date.now()}-${Math.random()}@example.com`,
    password: 'Password123!',
    role: USER_ROLES.EMPLOYEES,
    status: USER_STATUS.ACTIVE,
    verified: true,
    company: companyId,
  })

const validBody = (employeeId?: string) => ({
  title: 'Site work',
  startDate: '2026-10-01T00:00:00.000Z',
  endDate: '2026-10-31T00:00:00.000Z',
  projectTime: 40,
  images: ['https://example.com/photo.jpg'],
  description: 'Build the fence',
  ...(employeeId ? { employees: [employeeId] } : {}),
})

describe('POST /project', () => {
  it('stores this company’s employee and keeps the submitted hours', async () => {
    const { company, token } = await createCompany('own')
    const employee = await createEmployee(company._id.toString())
    const emitSpy = jest.spyOn(appEvents, 'emit')

    const res = await request(app)
      .post('/api/v1/project')
      .set('Authorization', `Bearer ${token}`)
      .send(validBody(employee._id.toString()))

    expect(res.status).toBe(201)
    const saved = await Project.findById(res.body.data._id)
    expect(saved?.employees.map((id) => id.toString())).toEqual([employee._id.toString()])
    expect(saved?.projectTime).toBe(40)
    expect(emitSpy).toHaveBeenCalledWith(
      'notification:send',
      expect.objectContaining({
        kind: 'projectEmployeeAdded',
        to: employee._id.toString(),
        data: expect.objectContaining({ projectTitle: 'Site work' }),
      }),
    )
    emitSpy.mockRestore()
  })

  it('rejects an end date before the start date', async () => {
    const { token } = await createCompany('dates')
    const res = await request(app)
      .post('/api/v1/project')
      .set('Authorization', `Bearer ${token}`)
      .send({
        ...validBody(),
        startDate: '2026-10-31T00:00:00.000Z',
        endDate: '2026-10-01T00:00:00.000Z',
      })

    expect(res.status).toBe(400)
    expect(res.body.errorMessages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ message: 'End date must not be before the start date' }),
      ]),
    )
  })

  it('rejects an employee of another company', async () => {
    const { token } = await createCompany('host')
    const { company: other } = await createCompany('other')
    const outsider = await createEmployee(other._id.toString())

    const res = await request(app)
      .post('/api/v1/project')
      .set('Authorization', `Bearer ${token}`)
      .send(validBody(outsider._id.toString()))

    expect(res.status).toBe(400)
    expect(res.body.message).toBe('Each assigned person must be an employee of this company')
  })

  it('rejects a project with no photo', async () => {
    const { token } = await createCompany('photo')
    const res = await request(app)
      .post('/api/v1/project')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Site work',
        startDate: '2026-10-01T00:00:00.000Z',
        endDate: '2026-10-31T00:00:00.000Z',
        projectTime: 40,
        description: 'Build the fence',
      })

    expect(res.status).toBe(400)
    expect(res.body.errorMessages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ message: 'A photo is required' }),
      ]),
    )
  })
})
