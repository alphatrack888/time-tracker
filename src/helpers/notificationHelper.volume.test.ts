jest.mock('./pushnotificationHelper', () => ({
  sendPushNotification: jest.fn(),
}))

import { Types } from 'mongoose'
import { sendNotification } from './notificationHelper'
import { sendPushNotification } from './pushnotificationHelper'
import { Notification } from '../app/modules/notifications/notifications.model'
import { DeviceToken } from '../app/modules/devicetoken/devicetoken.model'
import '../app/modules/user/user.model'

const mockedSendPush = sendPushNotification as jest.Mock

// Phase 16 QA matrix exit criterion: "Load/volume sanity check: simulate a
// burst (e.g. ... a company-wide announcement to 500 users) and confirm the
// system doesn't fall over." The FCM 500-token-per-call multicast limit
// itself is already covered (pushnotificationHelper.configured.test.ts,
// "batches more than 500 tokens into multiple multicast calls") — that's
// the *single user with many devices* shape. This is the other shape a
// bulk operation actually produces in this codebase: many separate users,
// each with their own sendNotification call, fired without waiting on each
// other — exactly what project.service.ts's employee-added/-removed fan-out
// (and any other request-driven trigger) does via dispatchNotification's
// fire-and-forget event emission for every affected employee in a loop.
describe('sendNotification under a 500-user burst (Phase 16 load/volume sanity check)', () => {
  beforeEach(() => {
    mockedSendPush.mockReset()
    mockedSendPush.mockImplementation((tokens: string[]) =>
      Promise.resolve(tokens.map(token => ({ token, success: true }))),
    )
  })

  it('creates exactly one Notification row and attempts exactly one push per recipient, for 500 concurrent recipients, without error', async () => {
    const from = new Types.ObjectId().toString()
    const recipients = Array.from({ length: 500 }, () => new Types.ObjectId())

    await DeviceToken.create(
      recipients.map(userId => ({ user: userId, token: `device-${userId.toString()}`, platform: 'android' })),
    )

    const startedAt = Date.now()
    // Mirrors the real fan-out shape (project.service.ts's
    // notificationsData.forEach(... dispatchNotification ...)): every
    // recipient's send kicked off without awaiting the previous one to
    // finish, then the whole batch awaited together here only so the test
    // itself can assert on the end state.
    await Promise.all(
      recipients.map(userId =>
        sendNotification({
          from,
          to: userId.toString(),
          title: 'Company-wide announcement',
          body: 'This affects everyone.',
        }),
      ),
    )
    const elapsedMs = Date.now() - startedAt

    expect(await Notification.countDocuments({ title: 'Company-wide announcement' })).toBe(500)
    expect(mockedSendPush).toHaveBeenCalledTimes(500)
    // Not a strict perf assertion (this environment's mongodb-memory-server
    // throughput isn't representative of production infra either way) —
    // just a floor confirming this didn't hang, deadlock, or silently drop
    // the mongo connection pool under 500 concurrent operations.
    expect(elapsedMs).toBeLessThan(25_000)
  }, 30_000)

  it('an individual recipient failing (bad data) does not affect delivery to any of the other 499', async () => {
    const from = new Types.ObjectId().toString()
    const goodRecipients = Array.from({ length: 499 }, () => new Types.ObjectId().toString())
    const badRecipient = 'not-a-valid-object-id'

    await Promise.all(
      [...goodRecipients, badRecipient].map(to =>
        sendNotification({ from, to, title: 'Bulk send', body: 'body' }),
      ),
    )

    expect(await Notification.countDocuments({ title: 'Bulk send' })).toBe(499)
  }, 30_000)
})
