jest.mock('./pushnotificationHelper', () => ({
  sendPushNotification: jest.fn(),
}))

import { Types } from 'mongoose'
import { sendNotification } from './notificationHelper'
import { sendPushNotification } from './pushnotificationHelper'
import { DeviceToken } from '../app/modules/devicetoken/devicetoken.model'
import { notificationCreatedCounter, pushSendCounter, staleTokenCleanupCounter } from '../shared/metrics'
import '../app/modules/user/user.model'

const mockedSendPush = sendPushNotification as jest.Mock

// Proves the raw counter behavior the alert rules in
// ../monitoring/prometheus-alerts.yml threshold against — no Prometheus
// server exists in this environment to run those PromQL rules for real,
// so this is what stands in for "the input signal to that math is
// correct."
describe('sendNotification metrics instrumentation (Phase 15)', () => {
  const valueFor = async (
    counter: typeof pushSendCounter | typeof notificationCreatedCounter,
    labels: Record<string, string>,
  ) => {
    const metric = await counter.get()
    const match = metric.values.find(v => Object.entries(labels).every(([k, val]) => (v.labels as Record<string, unknown>)[k] === val))
    return match?.value ?? 0
  }

  beforeEach(() => {
    mockedSendPush.mockReset()
    mockedSendPush.mockResolvedValue([])
    pushSendCounter.reset()
    notificationCreatedCounter.reset()
    staleTokenCleanupCounter.reset()
  })

  it('increments notification_created_total by category on a successful create', async () => {
    const from = new Types.ObjectId().toString()
    const to = new Types.ObjectId().toString()

    await sendNotification({
      from,
      to,
      kind: 'leaveRequestSubmitted',
      data: { employeeName: 'Alice', from: '2026-01-01', to: '2026-01-02' },
    })

    expect(await valueFor(notificationCreatedCounter, { category: 'leave' })).toBe(1)
  })

  it('increments notification_created_total with category="none" for an uncategorized literal send', async () => {
    const from = new Types.ObjectId().toString()
    const to = new Types.ObjectId().toString()

    await sendNotification({ from, to, title: 'Ad-hoc', body: 'No category here' })

    expect(await valueFor(notificationCreatedCounter, { category: 'none' })).toBe(1)
  })

  it('increments push_send_total{result="success"} once per successfully delivered device', async () => {
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

    expect(await valueFor(pushSendCounter, { result: 'success' })).toBe(2)
  })

  it('increments push_send_total{result="failure", reason=<fcm error code>} per failed device, and stale_token_cleanup_total for invalid ones', async () => {
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

    expect(
      await valueFor(pushSendCounter, { result: 'failure', reason: 'messaging/registration-token-not-registered' }),
    ).toBe(1)
    expect((await staleTokenCleanupCounter.get()).values[0]?.value).toBe(1)
  })

  it('drives AlphaTrackPushFailureRateHigh\'s underlying ratio to 1.0 when every attempt fails', async () => {
    const from = new Types.ObjectId().toString()
    const to = new Types.ObjectId()
    await DeviceToken.create({ user: to, token: 'device-1', platform: 'ios' })
    mockedSendPush.mockResolvedValueOnce([
      { token: 'device-1', success: false, errorCode: 'firebase-not-configured' },
    ])

    await sendNotification({ from, to: to.toString(), title: 'Hello', body: 'World' })

    const succeeded = await valueFor(pushSendCounter, { result: 'success' })
    const failed = await valueFor(pushSendCounter, { result: 'failure', reason: 'firebase-not-configured' })
    expect(failed / (succeeded + failed)).toBe(1)
  })
})
