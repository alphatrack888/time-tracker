import { Counter, Histogram, Registry, collectDefaultMetrics } from '@prometheus-io/client'

/**
 * Phase 15 (observability & alerting). This project had no metrics/APM
 * library at all before this — confirmed by checking package.json — only
 * plain-text Winston file logs. @prometheus-io/client is the official
 * Prometheus org's Node client (a straight rename of the long-standing
 * `prom-client`, now deprecated in favor of this — same author, same API,
 * confirmed by comparing their published source before switching).
 *
 * One shared Registry, exposed via GET /metrics (see routes/index.ts) for
 * a real Prometheus server to scrape. No such server exists in this
 * environment, so nothing here can produce an actual rendered dashboard —
 * what's verifiable here is that the right data is being collected
 * correctly, which is a testable, environment-independent claim.
 */
export const register = new Registry()
collectDefaultMetrics({ register })

// ── Push notifications ──────────────────────────────────────────────────
// One counter, keyed by result: `success` rate and `failure` rate (with
// `reason`, the FCM error code) are both just different label-selections
// of the same series — this is the standard Prometheus pattern, not two
// separate counters that could drift out of sync with each other.
export const pushSendCounter = new Counter({
  name: 'alpha_track_push_send_total',
  help: 'Push notification send attempts, per device token, by result',
  labelNames: ['result', 'reason'] as const,
  registers: [register],
})

export const staleTokenCleanupCounter = new Counter({
  name: 'alpha_track_stale_token_cleanup_total',
  help: 'Device tokens removed because FCM reported them permanently invalid',
  registers: [register],
})

// ── Notifications ────────────────────────────────────────────────────────
export const notificationCreatedCounter = new Counter({
  name: 'alpha_track_notification_created_total',
  help: 'Notification rows created, by preference category',
  labelNames: ['category'] as const,
  registers: [register],
})

// ── Reports (Phase 5) ────────────────────────────────────────────────────
export const reportGenerationCounter = new Counter({
  name: 'alpha_track_report_generation_total',
  help: 'Report generation attempts, by type/format/result',
  labelNames: ['type', 'format', 'result'] as const,
  registers: [register],
})

// Async attendance report jobs only (Phase 5/8) — the only report path
// that runs in the background rather than inline on the HTTP request, so
// it's the only one where "how long did this take" is an operational
// question rather than something already bounded by the request timeout.
export const reportJobDurationHistogram = new Histogram({
  name: 'alpha_track_report_job_duration_seconds',
  help: 'Async report job processing duration in seconds, from pending to ready/failed',
  labelNames: ['type', 'result'] as const,
  // Company-wide/cross-company jobs can genuinely take a while; buckets
  // span sub-second (a tiny company) to several minutes (a large
  // cross-company pull), not just the sub-second web-request-shaped
  // defaults collectDefaultMetrics assumes elsewhere.
  buckets: [0.5, 1, 2, 5, 10, 30, 60, 120, 300],
  registers: [register],
})
