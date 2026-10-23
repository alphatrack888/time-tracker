import { Types } from 'mongoose'
import { JwtPayload } from 'jsonwebtoken'
import { USER_ROLES } from '../../../enum/user'
import { Project } from './project.model'
import { ProjectServices } from './project.service'
import { projectStatusForDates } from './projectStatus'

describe('projectStatusForDates', () => {
  const now = new Date('2026-06-15T12:00:00.000Z')

  it('is pending before the start, in progress through the end, and completed after', () => {
    expect(projectStatusForDates(
      '2026-07-01T00:00:00.000Z',
      '2026-07-31T00:00:00.000Z',
      now,
    )).toBe('pending')

    expect(projectStatusForDates(
      '2026-06-01T00:00:00.000Z',
      '2026-06-30T00:00:00.000Z',
      now,
    )).toBe('in-progress')

    expect(projectStatusForDates(
      '2026-06-01T00:00:00.000Z',
      now,
      now,
    )).toBe('in-progress')

    expect(projectStatusForDates(
      '2026-05-01T00:00:00.000Z',
      '2026-05-31T00:00:00.000Z',
      now,
    )).toBe('completed')
  })

  it('keeps the stored status when a date is missing', () => {
    expect(projectStatusForDates(null, '2026-05-31T00:00:00.000Z', now, 'pending')).toBe('pending')
    expect(projectStatusForDates('2026-05-01T00:00:00.000Z', null, now, 'completed')).toBe('completed')
  })
})

describe('getAllProjects returns the date status without saving it', () => {
  const companyId = new Types.ObjectId()
  const asCompany = { authId: companyId.toString(), role: USER_ROLES.COMPANY } as JwtPayload

  it('labels future, current, and past projects and leaves the stored row pending', async () => {
    const now = new Date()
    const day = 24 * 60 * 60 * 1000
    await Project.create([
      {
        title: 'Future',
        company: companyId,
        startDate: new Date(now.getTime() + 2 * day),
        endDate: new Date(now.getTime() + 10 * day),
        status: 'pending',
      },
      {
        title: 'Current',
        company: companyId,
        startDate: new Date(now.getTime() - day),
        endDate: new Date(now.getTime() + day),
        status: 'pending',
      },
      {
        title: 'Past',
        company: companyId,
        startDate: new Date(now.getTime() - 10 * day),
        endDate: new Date(now.getTime() - day),
        status: 'pending',
      },
    ])

    const listed = await ProjectServices.getAllProjects(asCompany, {}, {})
    const byTitle = Object.fromEntries(listed.data.map(project => [project.title, project.status]))
    expect(byTitle.Future).toBe('pending')
    expect(byTitle.Current).toBe('in-progress')
    expect(byTitle.Past).toBe('completed')

    const stored = await Project.find({ company: companyId }).lean()
    expect(stored.every(project => project.status === 'pending')).toBe(true)

    const completedOnly = await ProjectServices.getAllProjects(asCompany, { status: 'completed' }, {})
    expect(completedOnly.data.map(project => project.title)).toEqual(['Past'])
  })
})
