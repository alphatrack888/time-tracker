jest.mock('./pushnotificationHelper', () => ({
  sendPushNotification: jest.fn(),
}))

import { Types } from 'mongoose'
import { sendNotification } from './notificationHelper'
import { sendPushNotification } from './pushnotificationHelper'
import { Notification } from '../app/modules/notifications/notifications.model'
import { DeviceToken } from '../app/modules/devicetoken/devicetoken.model'
// Registers the 'User' model so `.populate('from'/'to', ...)` inside
// sendNotification can resolve the ref (side-effect import only).
import '../app/modules/user/user.model'

const mockedSendPush = sendPushNotification as jest.Mock

describe('sendNotification orchestration (Phase 2: DB row + socket + push fan-out, all best-effort)', () => {
  beforeEach(() => {
    mockedSendPush.mockReset()
    mockedSendPush.mockResolvedValue([])
  })

  it('creates a persisted Notification row regardless of push outcome', async () => {
    const from = new Types.ObjectId().toString()
    const to = new Types.ObjectId().toString()

    await sendNotification({ from, to, title: 'Hello', body: 'World' })

    const stored = await Notification.findOne({ to, from })
    expect(stored).not.toBeNull()
    expect(stored?.title).toBe('Hello')
    expect(stored?.isRead).toBe(false)
  })

  it('persists the category on the row itself for a templated send (Phase 12: mobile needs it to route a tap on a fetched list item, not just a live push)', async () => {
    const from = new Types.ObjectId().toString()
    const to = new Types.ObjectId().toString()

    await sendNotification({
      from,
      to,
      kind: 'leaveRequestSubmitted',
      data: { employeeName: 'Alice', from: '2026-01-01', to: '2026-01-02' },
    })

    const stored = await Notification.findOne({ to, from })
    expect(stored?.category).toBe('leave')
  })

  it('leaves category unset for a literal send with no category given', async () => {
    const from = new Types.ObjectId().toString()
    const to = new Types.ObjectId().toString()

    await sendNotification({ from, to, title: 'Ad-hoc', body: 'No category here' })

    const stored = await Notification.findOne({ to, from })
    expect(stored?.category).toBeUndefined()
  })

  it('does not attempt a push when the recipient has no registered devices', async () => {
    const from = new Types.ObjectId().toString()
    const to = new Types.ObjectId().toString()

    await sendNotification({ from, to, title: 'Hello', body: 'World' })

    expect(mockedSendPush).not.toHaveBeenCalled()
  })

  it('fans out to every device token registered to the recipient', async () => {
    const from = new Types.ObjectId().toString()
    const to = new Types.ObjectId()
    await DeviceToken.create([
      { user: to, token: 'device-1', platform: 'ios' },
      { user: to, token: 'device-2', platform: 'android' },
    ])
    mockedSendPush.mockResolvedValueOnce([
      { token: 'device-1', success: true },
      { token: 'device-2', success: true },
    ])

    await sendNotification({ from, to: to.toString(), title: 'Hello', body: 'World' })

    expect(mockedSendPush).toHaveBeenCalledTimes(1)
    const [tokensArg] = mockedSendPush.mock.calls[0]
    expect(tokensArg.sort()).toEqual(['device-1', 'device-2'])
  })

  it('carries the notification id, category, and kind in the FCM data payload for a templated send (Phase 11)', async () => {
    const from = new Types.ObjectId().toString()
    const to = new Types.ObjectId()
    await DeviceToken.create({ user: to, token: 'device-1', platform: 'android' })
    mockedSendPush.mockResolvedValueOnce([{ token: 'device-1', success: true }])

    await sendNotification({
      from,
      to: to.toString(),
      kind: 'leaveRequestSubmitted',
      data: { employeeName: 'Alice', from: '2026-01-01', to: '2026-01-02' },
    })

    const stored = await Notification.findOne({ to, from })
    const [, , , dataArg] = mockedSendPush.mock.calls[0]
    expect(dataArg.notificationId).toBe(stored?._id.toString())
    expect(dataArg.category).toBe('leave')
    expect(dataArg.kind).toBe('leaveRequestSubmitted')
  })

  it('still carries notificationId (but no category/kind) for a literal send with no category', async () => {
    const from = new Types.ObjectId().toString()
    const to = new Types.ObjectId()
    await DeviceToken.create({ user: to, token: 'device-1', platform: 'android' })
    mockedSendPush.mockResolvedValueOnce([{ token: 'device-1', success: true }])

    await sendNotification({ from, to: to.toString(), title: 'Hello', body: 'World' })

    const stored = await Notification.findOne({ to, from })
    const [, , , dataArg] = mockedSendPush.mock.calls[0]
    expect(dataArg.notificationId).toBe(stored?._id.toString())
    expect(dataArg.category).toBeUndefined()
    expect(dataArg.kind).toBeUndefined()
  })

  it('removes device tokens FCM reports as invalid, and leaves valid ones alone', async () => {
    const from = new Types.ObjectId().toString()
    const to = new Types.ObjectId()
    await DeviceToken.create([
      { user: to, token: 'dead-token', platform: 'ios' },
      { user: to, token: 'live-token', platform: 'android' },
    ])
    mockedSendPush.mockResolvedValueOnce([
      { token: 'dead-token', success: false, errorCode: 'messaging/registration-token-not-registered', isTokenInvalid: true },
      { token: 'live-token', success: true },
    ])

    await sendNotification({ from, to: to.toString(), title: 'Hello', body: 'World' })

    expect(await DeviceToken.findOne({ token: 'dead-token' })).toBeNull()
    expect(await DeviceToken.findOne({ token: 'live-token' })).not.toBeNull()
  })

  it('is idempotent: a second call with the same idempotencyKey creates no duplicate row and attempts no second push', async () => {
    const from = new Types.ObjectId().toString()
    const to = new Types.ObjectId()
    await DeviceToken.create({ user: to, token: 'device-1', platform: 'ios' })
    mockedSendPush.mockResolvedValue([{ token: 'device-1', success: true }])

    const idempotencyKey = 'leaveRequest:abc123:submitted'
    await sendNotification({ from, to: to.toString(), title: 'First', body: 'body', idempotencyKey })
    await sendNotification({ from, to: to.toString(), title: 'First', body: 'body', idempotencyKey })

    const count = await Notification.countDocuments({ idempotencyKey })
    expect(count).toBe(1)
    expect(mockedSendPush).toHaveBeenCalledTimes(1)
  })

  it('allows two different idempotency keys to both send normally', async () => {
    const from = new Types.ObjectId().toString()
    const to = new Types.ObjectId().toString()

    await sendNotification({ from, to, title: 'A', body: 'a', idempotencyKey: 'key-a' })
    await sendNotification({ from, to, title: 'B', body: 'b', idempotencyKey: 'key-b' })

    expect(await Notification.countDocuments({ to })).toBe(2)
  })

  it('does not throw when Notification.create fails for a reason other than a duplicate key', async () => {
    const from = new Types.ObjectId().toString()

    await expect(
      sendNotification({ from, to: 'not-a-valid-object-id', title: 'Hello', body: 'World' }),
    ).resolves.not.toThrow()

    expect(mockedSendPush).not.toHaveBeenCalled()
  })

  it('does not throw when the push step itself throws unexpectedly', async () => {
    const from = new Types.ObjectId().toString()
    const to = new Types.ObjectId()
    await DeviceToken.create({ user: to, token: 'device-1', platform: 'ios' })
    mockedSendPush.mockRejectedValueOnce(new Error('unexpected push failure'))

    await expect(
      sendNotification({ from, to: to.toString(), title: 'Hello', body: 'World' }),
    ).resolves.not.toThrow()

    // The Notification row itself must still exist — a push failure must
    // never roll back or prevent the in-app notification from persisting.
    expect(await Notification.findOne({ to: to.toString() })).not.toBeNull()
  })
})
