// Explicitly simulates Firebase not being configured (no service account),
// regardless of whatever the developer's local .env happens to contain —
// isolated into its own file since the "configured" state is set up once
// at module-load time and doesn't reset between tests in the same file.
//
// `export {}` forces TypeScript to treat this file as a module rather than
// a global script — without it, the top-level `let`s below live in the
// same global scope as the identically-named ones in
// pushnotificationHelper.configured.test.ts and collide.
export {}

let sendPushNotification: typeof import('./pushnotificationHelper').sendPushNotification
let isFirebasePushConfigured: typeof import('./pushnotificationHelper').isFirebasePushConfigured
let truncateForPush: typeof import('./pushnotificationHelper').truncateForPush

beforeAll(() => {
  delete process.env.FIREBASE_SERVICE_ACCOUNT_BASE64
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const helper = require('./pushnotificationHelper')
  sendPushNotification = helper.sendPushNotification
  isFirebasePushConfigured = helper.isFirebasePushConfigured
  truncateForPush = helper.truncateForPush
})

describe('sendPushNotification when Firebase is not configured (Phase 2: fail-open, never throw)', () => {
  it('reports isFirebasePushConfigured() as false', () => {
    expect(isFirebasePushConfigured()).toBe(false)
  })

  it('returns a failed result per token instead of throwing', async () => {
    const results = await sendPushNotification(
      ['token-a', 'token-b'],
      'Title',
      'Body',
      { from: 'x', to: 'y' },
    )

    expect(results).toHaveLength(2)
    results.forEach(r => {
      expect(r.success).toBe(false)
      expect(r.errorCode).toBe('firebase-not-configured')
    })
  })

  it('returns an empty array (no-op) for zero tokens, without contacting Firebase at all', async () => {
    const results = await sendPushNotification([], 'Title', 'Body', {})
    expect(results).toEqual([])
  })
})

describe('truncateForPush (Phase 2: keep push bodies under FCM payload limits)', () => {
  it('leaves a short body untouched', () => {
    expect(truncateForPush('short body')).toBe('short body')
  })

  it('truncates a long body to 500 characters, ending with an ellipsis', () => {
    const longBody = 'a'.repeat(600)
    const result = truncateForPush(longBody)

    expect(result.length).toBe(500)
    expect(result.endsWith('…')).toBe(true)
    expect(result.startsWith('a'.repeat(499))).toBe(true)
  })

  it('leaves a body exactly at the limit untouched', () => {
    const exactBody = 'a'.repeat(500)
    expect(truncateForPush(exactBody)).toBe(exactBody)
  })
})
