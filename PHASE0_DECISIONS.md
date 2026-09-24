# Phase 0 decisions

Companion to [`Notification_Reports_Integration_Plan.md`](../Notification_Reports_Integration_Plan.md) Phase 0. Records the two judgment calls that phase required, per its exit criteria.

## 1. Subscription cron jobs: started, not removed

`cronService.startSubscriptionCronJobs()` (`src/app/modules/subscription/cron.service.ts`) defines four jobs (hourly health monitoring, daily reporting, 6-hourly webhook health check, 4-hourly trial-conversion monitoring) but was never called anywhere — `server.ts` never imported `cron.service.ts`, so none of these jobs ran in any environment.

**Decision: wire it up, don't delete it.** `src/server.ts`'s `main()` now calls `cronService.startSubscriptionCronJobs()` right after Socket.IO initialization, and `gracefulShutdown()` calls `cronService.stopAllJobs()` before closing the HTTP server.

**Why keep it instead of removing the dead code:** the four jobs are fully implemented, not stubs — they call real methods on `monitoringService` (Stripe subscription health sync, webhook health, trial-conversion tracking). Deleting a working feature because it was never wired up would throw away real functionality for no reason; wiring it up is a two-line change with essentially no downside, given the function itself is already gated.

**Safety:** `startSubscriptionCronJobs()` only actually starts jobs when `NODE_ENV === 'production'` or `ENABLE_SUBSCRIPTION_MONITORING === 'true'`. In local/dev/test runs without that flag set, the call is a no-op (logs "Subscription monitoring disabled in development mode" and returns) — so this change has zero effect on local development unless a developer explicitly opts in via `ENABLE_SUBSCRIPTION_MONITORING=true`. It only takes effect for real once deployed with `NODE_ENV=production`.

**Verified by:** `src/app/modules/subscription/cron.service.test.ts` — asserts all four jobs start when the flag is on, none start when it's off, and `stopAllJobs()` actually stops them (guards against dangling timers).

**Known follow-up, not in Phase 0 scope:** the daily-reporting job's `monitoringService.generateDailyReport()` only logs its output (`logger.info`) — it isn't emailed, persisted, or exposed via any API. Payment-failure and trial-reminder alerts inside the health-monitoring job are still commented-out TODOs (`monitoring.service.ts:61-62, 88-89`). These are exactly the gaps Phase 3 of the integration plan is meant to close (connecting this monitoring logic to `dispatchNotification`) — Phase 0 only makes sure the jobs actually *run*; it doesn't change what they do.

## 2. Report `template` query param: implemented, not removed

`GET /timetracker/reports/monthly` accepted and Zod-validated a `template` query param (`'default' | 'timesheet' | 'comprehensive'`), but `TimeTrackerService.generateMonthlyPdfReport` never read `opts.template` — every request produced the same `generateComprehensiveTimesheetReport` output regardless of what was requested. Two of the three PDF generator functions in `pdfHelper.ts` (`generateMonthlyTimeReportPdf`, `generateTimesheetStyleMonthlyReport`) had no callers anywhere in the codebase.

**Decision: implement the branching, don't remove the param/dead code.** `generateMonthlyPdfReport` now switches on `opts.template`:
- `'timesheet'` → `generateTimesheetStyleMonthlyReport` (the German-style "ALPHA time" layout)
- `'default'` → `generateMonthlyTimeReportPdf` (the plain-text simple layout)
- `'comprehensive'` or **unset** → `generateComprehensiveTimesheetReport` (the branded bilingual layout — unchanged default, so existing callers who never send `template` keep getting exactly what they got before this fix)

**Why implement instead of deleting the two unused generators:** all three layouts are fully built, tested-by-eye-in-the-original-implementation PDF templates, not scaffolding. The Zod schema already promises three template choices to any API consumer who read the validation contract; silently removing two of them would be a bigger behavioral change (and a real capability loss) than just switching on a param that was already being accepted and validated. Wiring it up is the smaller, safer, and more valuable change.

**Backwards compatibility:** requests that don't pass `template` at all (i.e., every caller in the codebase today — the mobile app and both dashboards never send this param) are unaffected; they still get the comprehensive layout, exactly as before.

**Verified by:** `src/app/modules/timetracker/timetracker.report.template.test.ts` — asserts the three template values produce genuinely different PDF output, and that omitting `template` produces output equivalent to explicitly requesting `'comprehensive'`.
