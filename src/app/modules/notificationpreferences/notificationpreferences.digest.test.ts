jest.mock('../../../helpers/pushnotificationHelper', () => ({
  sendPushNotification: jest.fn(),
}))

import { Types } from 'mongoose'
import { sendNotification } from '../../../helpers/notificationHelper'
import { sendPushNotification } from '../../../helpers/pushnotificationHelper'
import { NotificationPreferenceServices } from './notificationpreferences.service'
import { NotificationPreference } from './notificationpreferences.model'
import { Notification } from '../notifications/notifications.model'
import { DeviceToken } from '../devicetoken/devicetoken.model'

const mockedSendPush = sendPushNotification as jest.Mock

describe('sendNotification respects digestMode (Phase 6)', () => {
  beforeEach(() => {
    mockedSendPush.mockReset()
    mockedSendPush.mockResolvedValue([])
  })

  it('still creates the in-app row but withholds the individual push when digestMode is daily', async () => {
    const from = new Types.ObjectId().toString()
    const to = new Types.ObjectId()
    await NotificationPreference.create({ user: to, digestMode: 'daily' })
    await DeviceToken.create({ user: to, token: 'device-1', platform: 'ios' })

    await sendNotification({ from, to: to.toString(), kind: 'payrollCreated' })

    expect(await Notification.findOne({ to })).not.toBeNull()
    expect(mockedSendPush).not.toHaveBeenCalled()
  })

  it('pushes normally when digestMode is realtime (default)', async () => {
    const from = new Types.ObjectId().toString()
    const to = new Types.ObjectId()
    await DeviceToken.create({ user: to, token: 'device-1', platform: 'ios' })
    mockedSendPush.mockResolvedValueOnce([{ token: 'device-1', success: true }])

    await sendNotification({ from, to: to.toString(), kind: 'payrollCreated' })

    expect(mockedSendPush).toHaveBeenCalledTimes(1)
  })

  it('still pushes a mandatory-category notification even when digestMode is daily', async () => {
    const from = new Types.ObjectId().toString()
    const to = new Types.ObjectId()
    await NotificationPreference.create({ user: to, digestMode: 'daily' })
    await DeviceToken.create({ user: to, token: 'device-1', platform: 'ios' })
    mockedSendPush.mockResolvedValueOnce([{ token: 'device-1', success: true }])

    await sendNotification({ from, to: to.toString(), kind: 'employeeWelcome', data: { companyName: 'Acme' } })

    expect(mockedSendPush).toHaveBeenCalledTimes(1)
  })
})

describe('NotificationPreferenceServices.runNotificationDigestSweep (Phase 6)', () => {
  beforeEach(() => {
    mockedSendPush.mockReset()
    mockedSendPush.mockResolvedValue([])
  })

  it('sends one digest notification summarizing unread notifications from the last 24h', async () => {
    const user = new Types.ObjectId()
    await NotificationPreference.create({ user, digestMode: 'daily' })
    await Notification.create([
      { to: user, from: user, title: 'A', body: 'a', isRead: false },
      { to: user, from: user, title: 'B', body: 'b', isRead: false },
    ])

    const result = await NotificationPreferenceServices.runNotificationDigestSweep(new Date('2026-05-01T07:00:00.000Z'))

    expect(result).toEqual({ usersChecked: 1, digestsSent: 1 })
    const digest = await Notification.findOne({ to: user, idempotencyKey: `digest:${user.toString()}:2026-05-01` })
    expect(digest?.title).toBe('Your daily notification summary')
    expect(digest?.body).toContain('2')
  })

  it('does not send a digest when there is nothing unread', async () => {
    const user = new Types.ObjectId()
    await NotificationPreference.create({ user, digestMode: 'daily' })

    const result = await NotificationPreferenceServices.runNotificationDigestSweep(new Date('2026-05-01T07:00:00.000Z'))

    expect(result).toEqual({ usersChecked: 1, digestsSent: 0 })
  })

  it('ignores notifications older than the 24h window', async () => {
    const user = new Types.ObjectId()
    await NotificationPreference.create({ user, digestMode: 'daily' })
    const old = await Notification.create({ to: user, from: user, title: 'Old', body: 'old', isRead: false })
    // Mongoose's `timestamps: true` middleware intercepts a normal
    // `Notification.updateOne(...)` and won't let a $set override
    // `createdAt` — going through `.collection` uses the native MongoDB
    // driver directly, bypassing that middleware.
    await Notification.collection.updateOne({ _id: old._id }, { $set: { createdAt: new Date('2026-04-28T00:00:00.000Z') } })

    const result = await NotificationPreferenceServices.runNotificationDigestSweep(new Date('2026-05-01T07:00:00.000Z'))

    expect(result).toEqual({ usersChecked: 1, digestsSent: 0 })
  })

  it('does not check users with digestMode realtime (default)', async () => {
    const user = new Types.ObjectId()
    await Notification.create({ to: user, from: user, title: 'A', body: 'a', isRead: false })

    const result = await NotificationPreferenceServices.runNotificationDigestSweep(new Date('2026-05-01T07:00:00.000Z'))

    expect(result).toEqual({ usersChecked: 0, digestsSent: 0 })
  })

  it('does not re-send a digest for the same user on the same calendar day', async () => {
    const user = new Types.ObjectId()
    await NotificationPreference.create({ user, digestMode: 'daily' })
    await Notification.create({ to: user, from: user, title: 'A', body: 'a', isRead: false })

    await NotificationPreferenceServices.runNotificationDigestSweep(new Date('2026-05-01T07:00:00.000Z'))
    await NotificationPreferenceServices.runNotificationDigestSweep(new Date('2026-05-01T15:00:00.000Z'))

    const count = await Notification.countDocuments({ to: user, title: 'Your daily notification summary' })
    expect(count).toBe(1)
  })

  it('handles multiple digest-enabled users independently', async () => {
    const userA = new Types.ObjectId()
    const userB = new Types.ObjectId()
    await NotificationPreference.create([
      { user: userA, digestMode: 'daily' },
      { user: userB, digestMode: 'daily' },
    ])
    await Notification.create({ to: userA, from: userA, title: 'A', body: 'a', isRead: false })
    // userB has no unread notifications — should not get a digest.

    const result = await NotificationPreferenceServices.runNotificationDigestSweep(new Date('2026-05-01T07:00:00.000Z'))

    expect(result).toEqual({ usersChecked: 2, digestsSent: 1 })
  })
})
