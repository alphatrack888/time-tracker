# Phase 2 notes

Companion to [`Notification_Reports_Integration_Plan.md`](../Notification_Reports_Integration_Plan.md) Phase 2 (push delivery engine hardening).

## What was built

- **`pushnotificationHelper.ts`** rewritten: `sendPushNotification` now takes an array of tokens and sends via `admin.messaging().sendEachForMulticast`, batched into chunks of 500 (FCM's per-call limit). Returns a `PushSendResult[]` (one entry per token: `success`, `errorCode`, `isTokenInvalid`) instead of void — callers get enough information to clean up dead tokens without ever seeing a raw FCM error object or a raw token in a log line. Never throws: Firebase-not-configured, a per-token failure, and a whole-batch failure (e.g. an FCM outage) are all reported as data, not exceptions. Added `truncateForPush` (caps body at 500 chars for the OS push banner; the full text still goes to the DB via `Notification.body`, this only affects what FCM sends) and `isFirebasePushConfigured()`.
- **`notificationHelper.ts`** rewritten: `sendNotification` now takes a single options object (`{from, to, title, body, idempotencyKey?}`) instead of positional args with an optional single `deviceToken`. It no longer requires a caller-supplied device token at all — it looks up *every* device registered to the recipient (via `DeviceTokenServices.getTokensForUser`, from Phase 1) and fans the push out to all of them. Stale tokens (`isTokenInvalid: true` in the FCM response) are removed automatically via `DeviceTokenServices.removeStaleToken`. The DB row, the Socket.IO emit, and the push fan-out are three independent best-effort steps — a failure in any one is logged with an event-scoped, token-free message and never propagates to the caller, so a business operation (approving leave, adding an employee to a project, ...) can never fail because notifications/push had a problem.
- **Idempotency**: `Notification.idempotencyKey` (new field, unique + sparse index) lets a caller mark an event with a natural key derived from the triggering entity. A second `sendNotification` call with the same key is a safe no-op — enforced by the DB's unique index and caught as a duplicate-key error (code `11000`), so it's race-safe under concurrent calls, not just a check-then-create. All four existing triggers now pass one:
  - Leave request submitted: `leaveRequest:<id>:submitted`
  - Leave request approved/rejected: `leaveRequest:<id>:<status>`
  - Project employee added/removed: `project:<projectId>:employee:<employeeId>:<added|removed>:<updateTimestamp>` — scoped to the specific update operation (via the project's own `updatedAt`), not the (project, employee, action) tuple forever, so a legitimate later re-add after a removal still notifies.
  - Payroll created: `payrole:<id>:created`
- **`appEvents.ts`**: `NotificationEventPayload` is now a re-export of `notificationHelper`'s `SendNotificationPayload` (single source of truth for the shape), and the internal listener just forwards the payload object straight through.

## FCM push is now real, end to end

Combined with Phase 1: `POST /devices/register` → token stored in `DeviceToken` → an event fires → `sendNotification` looks up all of that user's tokens → `sendPushNotification` multicasts to them → per-token results feed back into stale-token cleanup. This closes the exact gap the original audit found ("every real call site omits `deviceToken`, so FCM push is unreachable in practice") — no caller needs to know or pass a device token anymore; it's resolved automatically per recipient.

## Tests

Four new/updated test files, 19 new tests (46 total project-wide, up from 27 after Phase 1):
- `pushnotificationHelper.unconfigured.test.ts` — fail-open behavior when Firebase isn't configured, plus `truncateForPush` boundary cases.
- `pushnotificationHelper.configured.test.ts` — mocked FCM SDK: multicast fan-out, per-token success/failure reporting, stale-token flagging by error code, 500-token batching (501 tokens → 2 calls), whole-batch-throws handling, body truncation actually reaching the FCM payload.
- `notificationHelper.test.ts` — DB row created regardless of push outcome; no push attempted when the recipient has zero devices; fans out to all of a recipient's tokens; stale tokens actually removed from `DeviceToken` after a send; **idempotency**: same key twice → one row, one push attempt; different keys → both send; `Notification.create` failing for a non-duplicate reason (e.g. a bad ObjectId) doesn't throw; the push step throwing unexpectedly doesn't throw and doesn't prevent the DB row from existing.

One incidental fix while writing tests: both new pushnotificationHelper test files initially had no real `import`/`export` statements, which makes TypeScript treat them as global scripts rather than modules — their identically-named top-level `let` declarations collided across files once both were loaded in the same Jest run (passed in isolation, failed when the full suite ran together). Fixed with an explicit `export {}` in each.

## Minor, not acted on

`GET /notifications` returns full `Notification` documents, including the new `idempotencyKey` field, to the client. It's not sensitive (just an internal string like `leaveRequest:<id>:submitted`, not a token or credential), so this wasn't hidden — flagging only so a future API-response-shaping pass doesn't have to rediscover it.
