/**
 * Polls `check` until it returns true or `timeoutMs` elapses. Needed because
 * `dispatchNotification` (appEvents.ts) is deliberately fire-and-forget —
 * the request-driven triggers that use it (leave requests, project
 * assignment, onboarding, low-balance) return before the underlying
 * `Notification.create()` necessarily resolves, by design (an HTTP response
 * should never wait on a push notification round trip). Tests that assert
 * against the resulting DB state need to tolerate that small, real delay
 * instead of racing it.
 */
export const waitFor = async (
  check: () => Promise<boolean>,
  { timeoutMs = 2000, intervalMs = 20 }: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<void> => {
  const start = Date.now()
  while (true) {
    if (await check()) return
    if (Date.now() - start >= timeoutMs) {
      throw new Error(`waitFor: condition not met within ${timeoutMs}ms`)
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs))
  }
}
