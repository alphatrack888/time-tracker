import { Types } from 'mongoose'
import { runForgotClockOutSweep, runDailyOvertimeSweep } from './timetracker.triggers'
import { TimeSession } from './timetracker.model'
import { Project } from '../project/project.model'
import { Notification } from '../notifications/notifications.model'
import { User } from '../user/user.model'
import { USER_ROLES, USER_STATUS } from '../../../enum/user'

describe('runForgotClockOutSweep (Phase 3, checker built now — cron wiring is Phase 6)', () => {
  it('notifies an employee whose session has been open past the threshold', async () => {
    const employee = await User.create({
      name: 'Forgetful Employee',
      email: 'forgetful@example.com',
      password: 'Password123!',
      role: USER_ROLES.EMPLOYEES,
      status: USER_STATUS.ACTIVE,
      verified: true,
    })
    const now = new Date('2026-01-10T20:00:00.000Z')
    const session = await TimeSession.create({
      user: employee._id,
      startTime: new Date('2026-01-10T06:00:00.000Z'), // 14h ago
      status: 'active',
      date: '2026-01-10',
    })

    const result = await runForgotClockOutSweep(now, 12)

    expect(result).toEqual({ checked: 1, notified: 1 })
    const notification = await Notification.findOne({
      to: employee._id,
      idempotencyKey: `timesession:${session._id.toString()}:forgotClockOut:2026-01-10`,
    })
    expect(notification).not.toBeNull()
    expect(notification?.title).toBe('Did you forget to clock out?')
  })

  it('does not notify for a session still under the threshold', async () => {
    const employee = await User.create({
      name: 'On Time Employee',
      email: 'ontime@example.com',
      password: 'Password123!',
      role: USER_ROLES.EMPLOYEES,
      status: USER_STATUS.ACTIVE,
      verified: true,
    })
    const now = new Date('2026-01-10T20:00:00.000Z')
    await TimeSession.create({
      user: employee._id,
      startTime: new Date('2026-01-10T15:00:00.000Z'), // 5h ago
      status: 'active',
      date: '2026-01-10',
    })

    const result = await runForgotClockOutSweep(now, 12)

    expect(result).toEqual({ checked: 0, notified: 0 })
  })

  it('does not notify for a session that has already been stopped', async () => {
    const employee = await User.create({
      name: 'Stopped Employee',
      email: 'stopped@example.com',
      password: 'Password123!',
      role: USER_ROLES.EMPLOYEES,
      status: USER_STATUS.ACTIVE,
      verified: true,
    })
    const now = new Date('2026-01-10T20:00:00.000Z')
    await TimeSession.create({
      user: employee._id,
      startTime: new Date('2026-01-10T02:00:00.000Z'), // 18h ago, but...
      endTime: new Date('2026-01-10T10:00:00.000Z'),
      status: 'stopped', // ...already clocked out
      date: '2026-01-10',
    })

    const result = await runForgotClockOutSweep(now, 12)

    expect(result).toEqual({ checked: 0, notified: 0 })
  })

  it('sends at most one reminder per calendar day while the session stays open', async () => {
    const employee = await User.create({
      name: 'Still Forgetful Employee',
      email: 'still-forgetful@example.com',
      password: 'Password123!',
      role: USER_ROLES.EMPLOYEES,
      status: USER_STATUS.ACTIVE,
      verified: true,
    })
    await TimeSession.create({
      user: employee._id,
      startTime: new Date('2026-01-09T06:00:00.000Z'),
      status: 'active',
      date: '2026-01-09',
    })

    // Two sweeps on the same calendar day, hours apart — still open both times.
    await runForgotClockOutSweep(new Date('2026-01-10T20:00:00.000Z'), 12)
    await runForgotClockOutSweep(new Date('2026-01-10T22:00:00.000Z'), 12)

    expect(await Notification.countDocuments({ to: employee._id })).toBe(1)
  })

  it('names the project and describes an open session, not hours worked', async () => {
    const employee = await User.create({
      name: 'Project Session Employee',
      email: 'project-session@example.com',
      password: 'Password123!',
      role: USER_ROLES.EMPLOYEES,
      status: USER_STATUS.ACTIVE,
      verified: true,
    })
    const project = await Project.create({ title: 'rewe' })
    await TimeSession.create({
      user: employee._id,
      project: project._id,
      startTime: new Date('2026-01-10T06:00:00.000Z'),
      status: 'active',
      date: '2026-01-10',
    })

    await runForgotClockOutSweep(new Date('2026-01-10T20:00:00.000Z'), 12)

    const notification = await Notification.findOne({ to: employee._id })
    expect(notification?.body).toContain('rewe')
    expect(notification?.body).toContain('still open')
    expect(notification?.body).not.toContain('after 12+')
  })
})

describe('runDailyOvertimeSweep', () => {
  const seedCompany = async () =>
    User.create({
      name: 'Overtime Co',
      email: `overtime-co-${Date.now()}-${Math.random()}@example.com`,
      password: 'Password123!',
      role: USER_ROLES.COMPANY,
      status: USER_STATUS.ACTIVE,
      verified: true,
    })

  const seedEmployee = async (companyId: string, name = 'Hardworking Employee') =>
    User.create({
      name,
      email: `${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}-${Math.random()}@example.com`,
      password: 'Password123!',
      role: USER_ROLES.EMPLOYEES,
      company: companyId,
      status: USER_STATUS.ACTIVE,
      verified: true,
    })

  const hour = 60 * 60 * 1000

  const seedProject = async (
    companyId: string,
    employeeId: Types.ObjectId,
    projectTime: number,
    title = 'Site',
  ) =>
    Project.create({
      title,
      company: companyId,
      employees: [employeeId],
      projectTime,
    })

  it('notifies once when committed hours pass the project limit', async () => {
    const company = await seedCompany()
    const employee = await seedEmployee(company._id.toString())
    const project = await seedProject(company._id.toString(), employee._id, 40, 'Site')
    await TimeSession.create({
      user: employee._id,
      project: project._id,
      startTime: new Date('2026-01-10T06:00:00.000Z'),
      endTime: new Date('2026-01-10T16:00:00.000Z'),
      totalTime: 42 * hour,
      status: 'stopped',
      date: '2026-01-10',
    })

    const result = await runDailyOvertimeSweep()
    expect(result).toEqual({ companiesChecked: 1, notified: 1 })

    const employeeKey = `overtime:${employee._id.toString()}:${project._id.toString()}:40:employee`
    const employeeNotification = await Notification.findOne({
      to: employee._id,
      idempotencyKey: employeeKey,
    })
    expect(employeeNotification?.title).toBe('Overtime alert')
    expect(employeeNotification?.body).toContain('Site')
    expect(employeeNotification?.body).toContain('42')
    expect(employeeNotification?.body).toContain('40')

    const companyNotification = await Notification.findOne({
      to: company._id,
      idempotencyKey: `overtime:${employee._id.toString()}:${project._id.toString()}:40:company`,
    })
    expect(companyNotification?.body).toContain(employee.name)
    expect(companyNotification?.body).toContain('Site')

    await runDailyOvertimeSweep()
    expect(await Notification.countDocuments({ to: employee._id })).toBe(1)
    expect(await Notification.countDocuments({ to: company._id })).toBe(1)
  })

  it('sends nothing when the project has no limit', async () => {
    const company = await seedCompany()
    const employee = await seedEmployee(company._id.toString())
    const project = await seedProject(company._id.toString(), employee._id, 0)
    await TimeSession.create({
      user: employee._id,
      project: project._id,
      startTime: new Date('2026-01-10T06:00:00.000Z'),
      endTime: new Date('2026-01-10T16:00:00.000Z'),
      totalTime: 10 * hour,
      status: 'stopped',
      date: '2026-01-10',
    })

    const result = await runDailyOvertimeSweep()
    expect(result).toEqual({ companiesChecked: 1, notified: 0 })
    expect(await Notification.countDocuments({ to: employee._id })).toBe(0)
  })

  it('sends nothing when worked hours are under the project limit', async () => {
    const company = await seedCompany()
    const employee = await seedEmployee(company._id.toString())
    const project = await seedProject(company._id.toString(), employee._id, 40)
    await TimeSession.create({
      user: employee._id,
      project: project._id,
      startTime: new Date('2026-01-10T06:00:00.000Z'),
      endTime: new Date('2026-01-10T16:00:00.000Z'),
      totalTime: 10 * hour,
      status: 'stopped',
      date: '2026-01-10',
    })

    const result = await runDailyOvertimeSweep()
    expect(result).toEqual({ companiesChecked: 1, notified: 0 })
    expect(await Notification.countDocuments({ to: employee._id })).toBe(0)
  })

  it('sends nothing when committed hours equal the project limit', async () => {
    const company = await seedCompany()
    const employee = await seedEmployee(company._id.toString())
    const project = await seedProject(company._id.toString(), employee._id, 40)
    await TimeSession.create({
      user: employee._id,
      project: project._id,
      startTime: new Date('2026-01-10T06:00:00.000Z'),
      endTime: new Date('2026-01-10T16:00:00.000Z'),
      totalTime: 40 * hour,
      status: 'stopped',
      date: '2026-01-10',
    })

    const result = await runDailyOvertimeSweep()
    expect(result).toEqual({ companiesChecked: 1, notified: 0 })
    expect(await Notification.countDocuments({ to: employee._id })).toBe(0)
  })
})
