// Simulates Firebase being fully configured, with a mocked SDK so these
// tests don't depend on the developer's real .env credential (which may or
// may not parse in this environment) and never make a real network call.
// `firebase-admin` is mocked *before* pushnotificationHelper is required —
// jest.doMock (imperative, not hoisted) plus a lazy require guarantees the
// mock is registered before the module's own `require('firebase-admin')`
// runs, the same pattern used in socketHelper.test.ts.
//
// `export {}` forces TypeScript to treat this file as a module rather than
// a global script — without it, the top-level `let`s below live in the
// same global scope as the identically-named ones in
// pushnotificationHelper.unconfigured.test.ts and collide.
export {}

const sendEachForMulticast = jest.fn()
const loggerInfo = jest.fn()

let sendPushNotification: typeof import('./pushnotificationHelper').sendPushNotification
let isFirebasePushConfigured: typeof import('./pushnotificationHelper').isFirebasePushConfigured
let androidNotificationChannelId: typeof import('./pushnotificationHelper').ANDROID_NOTIFICATION_CHANNEL_ID
let firebaseInitLog = ''

beforeAll(() => {
  process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 = Buffer.from(
    JSON.stringify({
      type: 'service_account',
      project_id: 'test-project',
      private_key: 'super-secret-key',
    }),
  ).toString('base64')

  jest.doMock('../shared/logger', () => ({
    logger: { info: loggerInfo, warn: jest.fn(), error: jest.fn() },
  }))

  jest.doMock('firebase-admin', () => ({
    initializeApp: jest.fn(),
    credential: { cert: jest.fn(() => ({})) },
    messaging: () => ({ sendEachForMulticast }),
  }))

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const helper = require('./pushnotificationHelper')
  sendPushNotification = helper.sendPushNotification
  isFirebasePushConfigured = helper.isFirebasePushConfigured
  androidNotificationChannelId = helper.ANDROID_NOTIFICATION_CHANNEL_ID
  firebaseInitLog = loggerInfo.mock.calls.map(call => call.map(String).join(' ')).join('\n')
})

beforeEach(() => {
  sendEachForMulticast.mockReset()
})

describe('sendPushNotification when Firebase is configured (Phase 2: multicast + stale-token detection)', () => {
  it('reports isFirebasePushConfigured() as true', () => {
    expect(isFirebasePushConfigured()).toBe(true)
  })

  it('logs the Firebase project id and nothing else from the service account', () => {
    expect(firebaseInitLog).toContain('project_id=test-project')
    expect(firebaseInitLog).not.toContain('super-secret-key')
  })

  it('sends one message per token via a single multicast call, reporting per-token results', async () => {
    sendEachForMulticast.mockResolvedValueOnce({
      successCount: 1,
      failureCount: 3,
      responses: [
        { success: true },
        { success: false, error: { code: 'messaging/registration-token-not-registered' } },
        { success: false, error: { code: 'messaging/internal-error' } },
        { success: false, error: { code: 'messaging/invalid-argument' } },
      ],
    })

    const results = await sendPushNotification(
      ['token-good', 'token-dead', 'token-transient-fail', 'token-bad-payload'],
      'Title',
      'Body',
      { from: 'a', to: 'b' },
    )

    expect(sendEachForMulticast).toHaveBeenCalledTimes(1)
    const sentMessage = sendEachForMulticast.mock.calls[0][0]
    expect(sentMessage.tokens).toEqual([
      'token-good',
      'token-dead',
      'token-transient-fail',
      'token-bad-payload',
    ])
    expect(sentMessage.android.notification.channelId).toBe(androidNotificationChannelId)
    expect(sentMessage.android.notification.icon).toBeUndefined()

    expect(results).toEqual([
      { token: 'token-good', success: true },
      {
        token: 'token-dead',
        success: false,
        errorCode: 'messaging/registration-token-not-registered',
        isTokenInvalid: true,
      },
      {
        token: 'token-transient-fail',
        success: false,
        errorCode: 'messaging/internal-error',
        isTokenInvalid: false,
      },
      {
        token: 'token-bad-payload',
        success: false,
        errorCode: 'messaging/invalid-argument',
        isTokenInvalid: false,
      },
    ])
  })

  it('batches more than 500 tokens into multiple multicast calls (FCM per-call limit)', async () => {
    sendEachForMulticast.mockImplementation(async (message: { tokens: string[] }) => ({
      successCount: message.tokens.length,
      failureCount: 0,
      responses: message.tokens.map(() => ({ success: true })),
    }))

    const tokens = Array.from({ length: 501 }, (_, i) => `token-${i}`)
    const results = await sendPushNotification(tokens, 'Title', 'Body', {})

    expect(sendEachForMulticast).toHaveBeenCalledTimes(2)
    expect(sendEachForMulticast.mock.calls[0][0].tokens).toHaveLength(500)
    expect(sendEachForMulticast.mock.calls[1][0].tokens).toHaveLength(1)
    expect(results).toHaveLength(501)
    expect(results.every(r => r.success)).toBe(true)
  })

  it('reports every token in a batch as failed (without marking them invalid) when the whole call throws', async () => {
    sendEachForMulticast.mockRejectedValueOnce(new Error('FCM is down'))

    const results = await sendPushNotification(['token-1', 'token-2'], 'Title', 'Body', {})

    expect(results).toEqual([
      { token: 'token-1', success: false, errorCode: 'batch-send-failed' },
      { token: 'token-2', success: false, errorCode: 'batch-send-failed' },
    ])
  })

  it('truncates a long body before sending, in the actual FCM message payload', async () => {
    sendEachForMulticast.mockResolvedValueOnce({
      successCount: 1,
      failureCount: 0,
      responses: [{ success: true }],
    })

    const longBody = 'x'.repeat(600)
    await sendPushNotification(['token-1'], 'Title', longBody, {})

    const sentMessage = sendEachForMulticast.mock.calls[0][0]
    expect(sentMessage.notification.body.length).toBe(500)
  })
})
