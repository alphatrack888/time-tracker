jest.mock('./pushnotificationHelper', () => ({
  sendPushNotification: jest.fn(),
}))

import { Types } from 'mongoose'
import { sendNotification } from './notificationHelper'
import { sendPushNotification } from './pushnotificationHelper'
import { Notification } from '../app/modules/notifications/notifications.model'
import { DeviceToken } from '../app/modules/devicetoken/devicetoken.model'
import { NotificationPreference } from '../app/modules/notificationpreferences/notificationpreferences.model'
import { User } from '../app/modules/user/user.model'
import { USER_ROLES, USER_STATUS } from '../enum/user'

const mockedSendPush = sendPushNotification as jest.Mock

describe('sendNotification respects notification preferences (Phase 4)', () => {
  beforeEach(() => {
    mockedSendPush.mockReset()
    mockedSendPush.mockResolvedValue([])
  })

  it('skips a notification entirely (no DB row, no push) when its category is disabled', async () => {
    const from = new Types.ObjectId().toString()
    const to = new Types.ObjectId()
    await NotificationPreference.create({ user: to, categories: { leave: false } })
    await DeviceToken.create({ user: to, token: 'device-1', platform: 'ios' })

    await sendNotification({ from, to: to.toString(), kind: 'leaveRequestSubmitted', data: { employeeName: 'A', from: 'x', to: 'y' } })

    expect(await Notification.findOne({ to })).toBeNull()
    expect(mockedSendPush).not.toHaveBeenCalled()
  })

  it('still sends a notification in an unrelated, still-enabled category', async () => {
    const from = new Types.ObjectId().toString()
    const to = new Types.ObjectId()
    await NotificationPreference.create({ user: to, categories: { leave: false } })

    await sendNotification({ from, to: to.toString(), kind: 'payrollCreated' })

    expect(await Notification.findOne({ to })).not.toBeNull()
  })

  it('a user with no preference record at all gets every category (default all-enabled)', async () => {
    const from = new Types.ObjectId().toString()
    const to = new Types.ObjectId().toString()

    await sendNotification({ from, to, kind: 'leaveRequestSubmitted', data: { employeeName: 'A', from: 'x', to: 'y' } })

    expect(await Notification.findOne({ to })).not.toBeNull()
  })

  it('sends the mandatory "account" category even when every other category is disabled', async () => {
    const from = new Types.ObjectId().toString()
    const to = new Types.ObjectId()
    await NotificationPreference.create({
      user: to,
      categories: { leave: false, project: false, payroll: false, overtime: false, attendance: false, subscription: false },
    })

    await sendNotification({ from, to: to.toString(), kind: 'employeeWelcome', data: { companyName: 'Acme' } })

    expect(await Notification.findOne({ to })).not.toBeNull()
  })

  it('creates the in-app row but skips push when pushEnabled is false', async () => {
    const from = new Types.ObjectId().toString()
    const to = new Types.ObjectId()
    await NotificationPreference.create({ user: to, pushEnabled: false })
    await DeviceToken.create({ user: to, token: 'device-1', platform: 'ios' })

    await sendNotification({ from, to: to.toString(), kind: 'payrollCreated' })

    expect(await Notification.findOne({ to })).not.toBeNull()
    expect(mockedSendPush).not.toHaveBeenCalled()
  })

  it('sends push normally when pushEnabled is true (default) and devices are registered', async () => {
    const from = new Types.ObjectId().toString()
    const to = new Types.ObjectId()
    await DeviceToken.create({ user: to, token: 'device-1', platform: 'ios' })
    mockedSendPush.mockResolvedValueOnce([{ token: 'device-1', success: true }])

    await sendNotification({ from, to: to.toString(), kind: 'payrollCreated' })

    expect(mockedSendPush).toHaveBeenCalledTimes(1)
  })

  it('a literal title/body send (no category) is never gated by preferences', async () => {
    const from = new Types.ObjectId().toString()
    const to = new Types.ObjectId()
    await NotificationPreference.create({
      user: to,
      categories: { leave: false, project: false, payroll: false, overtime: false, attendance: false, subscription: false },
    })

    await sendNotification({ from, to: to.toString(), title: 'Ad-hoc', body: 'no category on this one' })

    expect(await Notification.findOne({ to })).not.toBeNull()
  })
})

describe('sendNotification resolves the recipient\'s language for templated content (Phase 4)', () => {
  beforeEach(() => {
    mockedSendPush.mockReset()
    mockedSendPush.mockResolvedValue([])
  })

  it('renders in the recipient\'s preferred language when set', async () => {
    const from = new Types.ObjectId().toString()
    const recipient = await User.create({
      name: 'German Speaker',
      email: `german-speaker-${Date.now()}@example.com`,
      password: 'Password123!',
      role: USER_ROLES.EMPLOYEES,
      status: USER_STATUS.ACTIVE,
      verified: true,
      language: 'de',
    })

    await sendNotification({ from, to: recipient._id.toString(), kind: 'payrollCreated' })

    const notification = await Notification.findOne({ to: recipient._id })
    expect(notification?.title).toBe('Sie haben eine neue Abrechnung erhalten')
  })

  it('falls back to English when the recipient has no language set', async () => {
    const from = new Types.ObjectId().toString()
    const recipient = await User.create({
      name: 'No Language Set',
      email: `no-language-${Date.now()}@example.com`,
      password: 'Password123!',
      role: USER_ROLES.EMPLOYEES,
      status: USER_STATUS.ACTIVE,
      verified: true,
    })

    await sendNotification({ from, to: recipient._id.toString(), kind: 'payrollCreated' })

    const notification = await Notification.findOne({ to: recipient._id })
    expect(notification?.title).toBe('You have received a new payrole')
  })

  it('falls back to English when the recipient user does not exist at all', async () => {
    const from = new Types.ObjectId().toString()
    const to = new Types.ObjectId().toString()

    await sendNotification({ from, to, kind: 'payrollCreated' })

    const notification = await Notification.findOne({ to })
    expect(notification?.title).toBe('You have received a new payrole')
  })
})
