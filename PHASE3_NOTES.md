# Phase 3 notes

Companion to [`Notification_Reports_Integration_Plan.md`](../Notification_Reports_Integration_Plan.md) Phase 3 (notification trigger expansion).

## Disposition of every trigger the plan named

| Trigger | Status | Where |
|---|---|---|
| Leave request submitted / approved / rejected | Already existed (Phase 0/2 fixed its idempotency) | `leavemanagement.service.ts` |
| Project employee added/removed | Already existed | `project.service.ts` |
| Payroll created | Already existed | `payrole.service.ts` |
| **New employee onboarded** (welcome + company confirmation) | ✅ Built | `custom.auth/custom.auth.service.ts` `createUser` |
| **Leave balance low/exhausted** | ✅ Built (on approval, not submission — see below) | `leavemanagement.service.ts` `notifyIfLeaveBalanceLow` |
| **Subscription payment failure alert** | ✅ Built (connects a pre-existing commented-out TODO) | `subscription/monitoring.service.ts` `monitorPaymentFailures` |
| **Subscription trial-ending reminder** | ✅ Built (same) | `subscription/monitoring.service.ts` `monitorTrialConversions` |
| **Forgot-to-clock-out reminder** | ✅ Checker built and tested; **not yet scheduled** — cron wiring is Phase 6 | `timetracker/timetracker.triggers.ts` `runForgotClockOutSweep` |
| **Overtime threshold crossed** | ✅ Checker built and tested; **not yet scheduled** — cron wiring is Phase 6 | `timetracker/timetracker.triggers.ts` `runDailyOvertimeSweep` |
| **Clock-in reminder** | 🚫 Blocked | No "expected shift start time" exists anywhere in the data model (not on `User`, not on `Project`) — there's nothing to compare an actual clock-in against. Needs a schedule/shift feature before this can be built at all. |
| **Geofence violation** | 🚫 Blocked | `TimeSession.locations` records raw coordinates, but no project or user has a defined geofence boundary/radius anywhere in the schema. Confirmed by grep across the whole codebase — this isn't a gap in the trigger, it's a missing feature underneath it. |
| **Report ready** | ⏸️ Deferred | Depends on Phase 5's async report generation, which doesn't exist yet (all reports today are synchronous). Revisit once Phase 5 lands. |

## Design decisions worth knowing about

**Two different dispatch styles, on purpose.** The pre-existing 4 triggers, plus onboarding and low-balance, fire from live HTTP request handlers and use the existing fire-and-forget `dispatchNotification` (an EventEmitter emit — the HTTP response doesn't wait on push/DB completion). The subscription alerts and the two new attendance sweeps fire from cron jobs, where there's no HTTP client to keep fast and every reason to want deterministic completion for logging/testing — those call `sendNotification` from `notificationHelper.ts` directly and `await` it. This is a locally-scoped choice for the new cron-driven code only; Phase 2's `dispatchNotification` design for request-driven triggers is untouched.

**System sender for cron-originated notifications.** Added `UserServices.getSystemSenderId()` — resolves the seeded super-admin account (always present from server boot, per `createAdmin`) and uses it as the `from` for subscription/billing alerts. No new "system user" infrastructure needed since one already existed and just wasn't being used for this.

**Leave balance low/exhausted only fires on approval, not submission.** The plan described "triggered on leave request submission if it would exceed balance, or on a scheduled low-balance check." Looking at the actual code: `createLeavemanagement` already synchronously rejects a request that would exceed balance (`400 Bad Request`, before the request is even created) — so there's no "submitted but over balance" state to notify about; the user already gets immediate, direct feedback. The genuinely new, useful case is different: a request that fits within balance now might leave the employee *low* once approved. That's what got built — a `LOW_LEAVE_BALANCE_THRESHOLD_DAYS = 2` check that fires right after an approval consumes balance, separate from the "your leave was approved" notification, with its own idempotency key tied to the specific approval.

**Overtime sweep reuses the existing (imperfect) definition of "hours worked."** `getDailySummary`'s existing overtime figure sums `TimeSession.totalTime`, which is only incremented on pause/stop — a continuously-running, never-paused session won't reflect its still-accruing time until it's paused or stopped. `runDailyOvertimeSweep` deliberately sums the same field the same way rather than inventing a second, inconsistent definition of "hours worked today." This is a real limitation (documented in the code) but a pre-existing one, not something this phase introduced or is trying to quietly redesign.

**Overtime threshold is global, not per-project.** The existing single-project overtime calc uses `project?.projectTime || 8` (each project can define its own expected hours). The new cross-company sweep uses one configurable global threshold (`DAILY_OVERTIME_THRESHOLD_HOURS`, default 8) rather than joining each session back to its project's specific `projectTime` — a deliberate simplification for a first version, not an oversight.

**Two new env vars**, both optional with sane defaults (no `.env`/`.example.env` entry required, consistent with how `DAILY_REPORT_TIME`/`ENABLE_SUBSCRIPTION_MONITORING` are handled elsewhere in this codebase):
- `FORGOT_CLOCK_OUT_THRESHOLD_HOURS` (default `12`)
- `DAILY_OVERTIME_THRESHOLD_HOURS` (default `8`)

**Bug found and fixed while testing `runDailyOvertimeSweep`:** the initial implementation's returned `notified` count was the number of users *qualifying* by threshold, not the number actually notified — if a `TimeSession` referenced a user that no longer exists, that entry inflated the count even though the per-user loop correctly skips it (`continue`) and sends nothing. Fixed to count actual sends; a test (`skips a user id with no matching User document without throwing`) pins this down.

## Tests

5 new test files, 22 new tests (68 total project-wide, up from 46):
- `custom.auth.employeeOnboarding.test.ts` — welcome + confirmation notifications on employee creation; none sent for non-employee accounts.
- `leavemanagement.lowBalance.test.ts` — low-balance and exhausted-balance notifications on approval; no notification when balance stays healthy; none on rejection.
- `monitoring.notifications.test.ts` — payment-failure and trial-ending notifications; no re-notify on a second sweep while the condition is unchanged (idempotency); no notification below the failure-count/day thresholds.
- `timetracker.triggers.test.ts` — both sweeps: threshold crossing, under-threshold (no notify), multi-session summation, at-most-once-per-day/per-sweep-run idempotency, and the missing-user edge case above.
- `src/test/waitFor.ts` — small polling helper added for the request-driven (fire-and-forget) triggers' tests, since `dispatchNotification`'s completion isn't synchronous with the HTTP handler returning (by design, per Phase 2). The cron-driven triggers don't need it, since those are properly awaited.

One incidental fix: the onboarding test was making a real network call to the Resend email API (via the unrelated `dispatchEmail` side effect on user creation) and failing with a 422 in the background after the test had already finished, producing harmless but noisy "cannot log after tests are done" output. Fixed by mocking just `dispatchEmail` in that test file (`dispatchNotification`, the thing actually under test, stays real).
