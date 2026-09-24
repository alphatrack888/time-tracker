# Phase 15 notes — Cross-cutting: observability & alerting

Companion to [`../Notification_Reports_Integration_Plan.md`](../Notification_Reports_Integration_Plan.md) Phase 15. Backend-only.

## There was no monitoring stack to extend

Checked directly rather than assumed: `package.json` had no metrics/APM library at all before this phase, and `BACKEND_DEPLOYMENT_GUIDE.md` (Phase 14) documents none. Flagged this to the user as a real fork — build a Prometheus-style `/metrics` endpoint, or stay log-based-only and lean harder on the structured-logging task — and the user chose Prometheus-style.

`npm install prom-client` succeeded but printed a deprecation notice: "prom-client has been replaced by @prometheus-io/client." Didn't blindly trust or ignore that — checked `npm view @prometheus-io/client` (a real, actively-published package, same repo now under `github.com/prometheus/client_js`, same author per its own type definitions header) before switching. Uninstalled `prom-client`, installed `@prometheus-io/client@^0.16.1` instead, and confirmed its API surface (`Registry`, `Counter`, `Histogram`, `collectDefaultMetrics`) before writing any code against it.

## What's instrumented

One shared `Registry` (`src/shared/metrics.ts`), all six metrics the plan names:

- `alpha_track_push_send_total{result, reason}` — every per-device FCM send outcome, `result` in `success`/`failure`, `reason` the FCM error code (or `firebase-not-configured` when Firebase Admin never initialized at all — that's a config problem, not a device-level failure, and the alert rule below treats it as its own, more severe case).
- `alpha_track_stale_token_cleanup_total` — incremented by however many device tokens got removed in one cleanup pass, not once per pass.
- `alpha_track_notification_created_total{category}` — every persisted `Notification` row, `category` is `none` for an uncategorized literal send rather than an unlabeled series.
- `alpha_track_report_generation_total{type, format, result}` — `type` is `monthly`, `attendance` (sync), or `attendance-async`; covers both synchronous report controller actions and the async job path.
- `alpha_track_report_job_duration_seconds{type, result}` — a histogram, async attendance jobs only (the only report path that isn't already bounded by an HTTP request timeout), buckets from 0.5s to 5 minutes since a real cross-company pull can legitimately take a while.

Instrumented at the real call sites, not bolted on separately: `notificationHelper.ts`'s `sendNotification` (create + push-result handling), `timetracker.controller.ts`'s two synchronous report actions (wrapped in try/catch specifically to record failure before rethrowing to `catchAsync`), and `reportjob.service.ts`'s `processAttendanceReportJob` (duration measured with `process.hrtime.bigint()` across the full generate→upload→save span, on both the success and failure exit paths).

`GET /metrics` (`src/app.ts`) is unauthenticated and sits at the top level next to the pre-existing `/health` — a Prometheus scraper hits it over a private network path, never through a browser session with app auth, matching the existing `/health` pattern exactly rather than inventing a new convention.

## Alerting: a config artifact, not in-process reimplementation

Reasoned through the alternative before rejecting it: with no real Prometheus/Alertmanager deployment in this environment, it would be possible to hand-roll a rate-over-time threshold check inside the Node process itself (a rolling window counter, a setInterval check, a webhook call). Rejected that — it would be a worse, from-scratch, untested copy of exactly what Prometheus/Alertmanager already do well, and this project has zero prior art for that pattern to build on.

Instead: `monitoring/prometheus-alerts.yml`, a real PromQL alert-rule config meant to be loaded by an actual Prometheus server. Four rules:
- `AlphaTrackPushFailureRateHigh` — failure ratio (not raw count) over 15m, so the threshold means the same thing at low and high traffic.
- `AlphaTrackPushFailureRateHighFirebaseNotConfigured` — a narrower, higher-severity variant: 100% of failures on this one `reason` label means Firebase Admin never initialized, a config problem that won't self-resolve, not a transient FCM issue.
- `AlphaTrackReportGenerationFailureRateHigh` — same ratio pattern, across all three report types.
- `AlphaTrackAsyncReportJobSlow` — p95 (not mean) job duration over 120s, since a handful of slow cross-company jobs is the operational signal a mean would hide behind a larger population of fast single-company ones.

No staging environment exists to "test-fire" these against a live Alertmanager (same category of gap as every earlier phase's live-infrastructure caveats). What's verified instead: the counters/histogram each rule reads are recorded correctly, proven by two new test files —
- `src/helpers/notificationHelper.metrics.test.ts` (5 tests) — including one that drives the push failure ratio to exactly `1.0`, the same math `AlphaTrackPushFailureRateHigh` evaluates, using a mocked `firebase-not-configured` failure.
- `src/app/modules/reportjob/reportjob.metrics.test.ts` (2 tests) — proves a success run records a success-labeled counter and a non-negative duration observation, and a failure run (forced by rejecting the Cloudinary upload mock) records a failure-labeled counter and *not* a success one.

## Structured logging audit (Phases 2–6)

Went through every `logger.error` call in the modules Phases 2–6 actually touched (notification send/push, report job processing, digest/sweep crons, leave-balance low check) against the plan's own bar: user id, event type, error reason. Most already cleared it — `notification:socket-emit-failed`, `push:stale-tokens-removed`, `notification-digest:user-failed`, `leaveBalance:low-check-failed`, and the cron-sweep failure lines all already carry an id plus the raw error, left unchanged rather than padded for its own sake.

Found and closed four real gaps, each a log-line change only (no behavior change):
- `notification:create-failed` (`notificationHelper.ts`) was missing `from`, `category`, and `kind` — only had `to` and `title`. A failure here with several concurrent sends in flight gave no way to tell which trigger it came from without cross-referencing timestamps.
- `push:unexpected-failure` (`notificationHelper.ts`) was missing `category` and `notificationId` — same issue, no way to correlate back to the specific notification without the id.
- `Push batch failed entirely` (`pushnotificationHelper.ts`) was missing the token count and title entirely — just the raw FCM error, no indication of blast radius or which send it was.
- `reportjob:generation-failed` (`reportjob.service.ts`) had only `jobId` — enough to look the job up in Mongo, but not enough to debug without that extra round trip; added `requestedBy`, `role`, `type`, `format` directly.

## Verification

`tsc --noEmit` clean. `eslint src`: exactly 56 errors, the documented pre-existing baseline — this phase's new files (`shared/metrics.ts`, two `*.metrics.test.ts` files) and edits introduced zero new lint debt. Full backend suite passing, including the 7 targeted suites this phase touches run in isolation (56/56 tests) and the full run alongside everything from every earlier phase.

**Not done, and not fake-checked:** a rendered Grafana (or equivalent) dashboard, and a real alert firing against a live Alertmanager — no monitoring server of any kind is deployed anywhere in this environment, so neither can exist here. What's real and checked: the metrics endpoint serves correct, correctly-labeled data a real dashboard could chart, and the alert rules' underlying math is proven against real counter/histogram values via unit test.
