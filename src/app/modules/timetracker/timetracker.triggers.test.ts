import { Types } from 'mongoose'
import { runForgotClockOutSweep, runDailyOvertimeSweep } from './timetracker.triggers'
import { TimeSession } from './timetracker.model'
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
})

describe('runDailyOvertimeSweep (Phase 3 checker, Phase 6: per-company + timezone-correct)', () => {
  const seedCompany = async (overrides: Partial<{ timezone: string }> = {}) =>
    User.create({
      name: 'Overtime Co',
      email: `overtime-co-${Date.now()}-${Math.random()}@example.com`,
      password: 'Password123!',
      role: USER_ROLES.COMPANY,
      status: USER_STATUS.ACTIVE,
      verified: true,
      ...overrides,
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

  it('notifies both the employee and their company when daily hours exceed the threshold', async () => {
    const company = await seedCompany()
    const employee = await seedEmployee(company._id.toString())
    await TimeSession.create({
      user: employee._id,
      startTime: new Date('2026-01-10T06:00:00.000Z'),
      endTime: new Date('2026-01-10T16:00:00.000Z'),
      totalTime: 10 * 60 * 60 * 1000, // 10h, over an 8h threshold
      status: 'stopped',
      date: '2026-01-10',
    })

    const result = await runDailyOvertimeSweep(new Date('2026-01-11T00:00:00.000Z'), 8, '2026-01-10')

    expect(result).toEqual({ companiesChecked: 1, notified: 1 })

    const employeeNotification = await Notification.findOne({
      to: employee._id,
      idempotencyKey: `overtime:${employee._id.toString()}:2026-01-10:employee`,
    })
    expect(employeeNotification?.title).toBe('Overtime alert')

    const companyNotification = await Notification.findOne({
      to: company._id,
      idempotencyKey: `overtime:${employee._id.toString()}:2026-01-10:company`,
    })
    expect(companyNotification?.body).toContain(employee.name)
  })

  it('does not notify when hours worked are under the threshold', async () => {
    const company = await seedCompany()
    const employee = await seedEmployee(company._id.toString(), 'Normal Hours Employee')
    await TimeSession.create({
      user: employee._id,
      startTime: new Date('2026-01-10T06:00:00.000Z'),
      endTime: new Date('2026-01-10T14:00:00.000Z'),
      totalTime: 6 * 60 * 60 * 1000, // 6h, under threshold
      status: 'stopped',
      date: '2026-01-10',
    })

    const result = await runDailyOvertimeSweep(new Date('2026-01-11T00:00:00.000Z'), 8, '2026-01-10')

    expect(result).toEqual({ companiesChecked: 1, notified: 0 })
    expect(await Notification.countDocuments({ to: employee._id })).toBe(0)
  })

  it('sums multiple sessions for the same user/day when checking the threshold', async () => {
    const company = await seedCompany()
    const employee = await seedEmployee(company._id.toString(), 'Multi Session Employee')
    await TimeSession.create([
      {
        user: employee._id,
        startTime: new Date('2026-01-10T06:00:00.000Z'),
        endTime: new Date('2026-01-10T10:00:00.000Z'),
        totalTime: 4 * 60 * 60 * 1000,
        status: 'stopped',
        date: '2026-01-10',
      },
      {
        user: employee._id,
        startTime: new Date('2026-01-10T11:00:00.000Z'),
        endTime: new Date('2026-01-10T16:00:00.000Z'),
        totalTime: 5 * 60 * 60 * 1000,
        status: 'stopped',
        date: '2026-01-10',
      },
    ])

    const result = await runDailyOvertimeSweep(new Date('2026-01-11T00:00:00.000Z'), 8, '2026-01-10')

    // 4h + 5h = 9h, over the 8h threshold, even though neither session alone is
    expect(result).toEqual({ companiesChecked: 1, notified: 1 })
  })

  it('does not re-notify for the same user/day on a second sweep', async () => {
    const company = await seedCompany()
    const employee = await seedEmployee(company._id.toString(), 'Repeat Sweep Employee')
    await TimeSession.create({
      user: employee._id,
      startTime: new Date('2026-01-10T06:00:00.000Z'),
      endTime: new Date('2026-01-10T16:00:00.000Z'),
      totalTime: 10 * 60 * 60 * 1000,
      status: 'stopped',
      date: '2026-01-10',
    })

    await runDailyOvertimeSweep(new Date('2026-01-11T00:00:00.000Z'), 8, '2026-01-10')
    await runDailyOvertimeSweep(new Date('2026-01-11T00:00:00.000Z'), 8, '2026-01-10')

    expect(await Notification.countDocuments({ to: employee._id })).toBe(1)
  })

  it('does not check an employee who does not belong to any registered company', async () => {
    // The sweep iterates per registered COMPANY (needed to resolve each
    // company's timezone) and looks up that company's employees — an
    // employee with no company is structurally unreachable by any
    // company's iteration. A real signup always sets `company` (see
    // custom.auth.service.ts's createUser), so this is a defensive check
    // against an anomalous data state, not an expected one.
    const employee = await User.create({
      name: 'No Company Employee',
      email: `no-company-${Date.now()}@example.com`,
      password: 'Password123!',
      role: USER_ROLES.EMPLOYEES,
      status: USER_STATUS.ACTIVE,
      verified: true,
    })
    await TimeSession.create({
      user: employee._id,
      startTime: new Date('2026-01-10T06:00:00.000Z'),
      endTime: new Date('2026-01-10T16:00:00.000Z'),
      totalTime: 9 * 60 * 60 * 1000,
      status: 'stopped',
      date: '2026-01-10',
    })

    const result = await runDailyOvertimeSweep(new Date('2026-01-11T00:00:00.000Z'), 8, '2026-01-10')

    expect(result).toEqual({ companiesChecked: 0, notified: 0 })
    expect(await Notification.countDocuments({ to: employee._id })).toBe(0)
  })

  it('does not throw when there are no registered companies at all', async () => {
    await expect(runDailyOvertimeSweep(new Date('2026-01-11T00:00:00.000Z'), 8, '2026-01-10')).resolves.toEqual({
      companiesChecked: 0,
      notified: 0,
    })
  })

  it('does not throw for a company with employees but zero matching sessions', async () => {
    const company = await seedCompany()
    await seedEmployee(company._id.toString(), 'Idle Employee')
    // A TimeSession for a random, unrelated user — never matches this
    // company's employee list, so it must not affect the result at all.
    await TimeSession.create({
      user: new Types.ObjectId(),
      startTime: new Date('2026-01-10T06:00:00.000Z'),
      endTime: new Date('2026-01-10T16:00:00.000Z'),
      totalTime: 9 * 60 * 60 * 1000,
      status: 'stopped',
      date: '2026-01-10',
    })

    await expect(runDailyOvertimeSweep(new Date('2026-01-11T00:00:00.000Z'), 8, '2026-01-10')).resolves.toEqual({
      companiesChecked: 1,
      notified: 0,
    })
  })

  it('attributes a session to the company\'s correct LOCAL calendar day, not the UTC day (timezone correctness)', async () => {
    // Pacific/Kiritimati is UTC+14 with no DST — a deterministic, simple
    // fixed offset ideal for this test. Local midnight 2026-01-11 00:00 is
    // UTC 2026-01-10T10:00:00Z.
    const company = await seedCompany({ timezone: 'Pacific/Kiritimati' })
    const employee = await seedEmployee(company._id.toString(), 'Kiritimati Employee')
    // UTC 2026-01-10T12:00 = local (UTC+14) 2026-01-11T02:00 — this
    // session happened on the company's local Jan 11th, even though its
    // raw UTC instant falls on Jan 10th.
    await TimeSession.create({
      user: employee._id,
      startTime: new Date('2026-01-10T12:00:00.000Z'),
      endTime: new Date('2026-01-10T21:00:00.000Z'),
      totalTime: 9 * 60 * 60 * 1000, // 9h, over an 8h threshold
      status: 'stopped',
      date: '2026-01-10', // the UTC-anchored date string — deliberately "wrong" for this company
    })

    const resultForLocalJan11 = await runDailyOvertimeSweep(new Date(), 8, '2026-01-11')
    expect(resultForLocalJan11.notified).toBe(1)
    expect(
      await Notification.findOne({
        to: employee._id,
        idempotencyKey: `overtime:${employee._id.toString()}:2026-01-11:employee`,
      }),
    ).not.toBeNull()

    // Checking the company's local Jan 10th (a different sweep run, distinct
    // idempotency key) must NOT pick up this session — it didn't happen on
    // their local Jan 10th, regardless of what the raw `date` field says.
    const resultForLocalJan10 = await runDailyOvertimeSweep(new Date(), 8, '2026-01-10')
    expect(resultForLocalJan10.notified).toBe(0)
  })

  it('isolates one company\'s failure — an invalid stored timezone does not abort the sweep for other companies', async () => {
    // Bypasses the write-time IANA validation (isValidTimezone in
    // timezoneHelper.ts, wired into the profile-update endpoint) to
    // simulate data that's bad despite that guard — a migration artifact,
    // a manual DB edit, etc.
    const badCompany = await User.create({
      name: 'Bad Timezone Co',
      email: `bad-timezone-co-${Date.now()}@example.com`,
      password: 'Password123!',
      role: USER_ROLES.COMPANY,
      status: USER_STATUS.ACTIVE,
      verified: true,
      timezone: 'Not/A_Real_Zone',
    })
    await seedEmployee(badCompany._id.toString(), 'Unlucky Employee')

    const goodCompany = await seedCompany({ timezone: 'UTC' })
    const goodEmployee = await seedEmployee(goodCompany._id.toString(), 'Lucky Employee')
    await TimeSession.create({
      user: goodEmployee._id,
      startTime: new Date('2026-01-10T06:00:00.000Z'),
      endTime: new Date('2026-01-10T16:00:00.000Z'),
      totalTime: 9 * 60 * 60 * 1000,
      status: 'stopped',
      date: '2026-01-10',
    })

    const result = await runDailyOvertimeSweep(new Date('2026-01-11T00:00:00.000Z'), 8, '2026-01-10')

    // Both companies were iterated (companiesChecked counts registered
    // companies, not successes) — but only the good one actually notified.
    expect(result.companiesChecked).toBe(2)
    expect(result.notified).toBe(1)
    expect(
      await Notification.findOne({
        to: goodEmployee._id,
        idempotencyKey: `overtime:${goodEmployee._id.toString()}:2026-01-10:employee`,
      }),
    ).not.toBeNull()
  })

  it('defaults to checking each company\'s most recently completed local day when no targetDateKey is given', async () => {
    const company = await seedCompany({ timezone: 'UTC' })
    const employee = await seedEmployee(company._id.toString(), 'Default Date Employee')
    await TimeSession.create({
      user: employee._id,
      startTime: new Date('2026-01-10T06:00:00.000Z'),
      endTime: new Date('2026-01-10T16:00:00.000Z'),
      totalTime: 9 * 60 * 60 * 1000,
      status: 'stopped',
      date: '2026-01-10',
    })

    // "Now" is early on 2026-01-11 UTC — for a UTC company, "yesterday" is 2026-01-10.
    const result = await runDailyOvertimeSweep(new Date('2026-01-11T03:00:00.000Z'), 8)

    expect(result.notified).toBe(1)
    expect(
      await Notification.findOne({
        to: employee._id,
        idempotencyKey: `overtime:${employee._id.toString()}:2026-01-10:employee`,
      }),
    ).not.toBeNull()
  })
})
