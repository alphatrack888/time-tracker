# Backend deployment guide

**This file did not exist before Phase 14** of [`../Notification_Reports_Integration_Plan.md`](../Notification_Reports_Integration_Plan.md), which explicitly asks to "cross-check against `BACKEND_DEPLOYMENT_GUIDE.md`" — that file was referenced but never actually created in any earlier phase. Rather than skip the check because the named file didn't exist, this phase created it: a real, accurate environment-variable reference derived directly from `src/config/index.ts` (the actual code that reads them), not from `README.md`'s "Environment Variables" section, which is stale template boilerplate left over from this project's scaffolding — it references `MONGODB_URI`, `CLOUDINARY_CLOUD_NAME`/`CLOUDINARY_API_SECRET`, AWS S3 vars, and SMTP vars, **none of which match what the code actually reads** (real names: `DATABASE_URL`, `CLOUDINARY_NAME`/`CLOUDINARY_SECRET`; AWS and SMTP aren't used by this codebase at all — email goes through Resend). That section has been replaced with a pointer to this file rather than left to keep misleading anyone deploying this for the first time.

## Required environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | MongoDB connection string |
| `PORT` | Yes | HTTP port the server listens on |
| `IP_ADDRESS` | Yes | Bind address passed to `app.listen` |
| `NODE_ENV` | Yes | `development` / `production` — gates things like the pretty request logger |
| `JWT_SECRET` | Yes | Signs access tokens |
| `JWT_EXPIRE_IN` | Yes | Access token lifetime |
| `JWT_REFRESH_SECRET` | Yes | Signs refresh tokens |
| `JWT_REFRESH_EXPIRES_IN` | Yes | Refresh token lifetime |
| `TEMP_JWT_SECRET` | Yes | Signs/verifies short-lived tokens for the pre-account-creation flow (`tempAuth` middleware) |
| `TEMP_JWT_EXPIRE_IN` | See note below | Intended lifetime for temp tokens |
| `BCRYPT_SALT_ROUNDS` | Yes | Password hashing cost factor |
| `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` | Yes | Seeded super-admin account credentials |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_CALLBACK_URL` | Yes, if Google login is offered | OAuth credentials for social login |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Yes | Subscription billing |
| `EMAIL_FROM` / `RESEND_API_KEY` | Yes | Transactional email (OTPs, notifications) via Resend |
| `CLOUDINARY_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_SECRET` | Yes | File uploads — profile images, payroll documents, and (since Phase 5 of this plan) generated async report files |
| **`FIREBASE_SERVICE_ACCOUNT_BASE64`** | **New in this plan (Phase 2) — see below** | FCM push notifications |

### `FIREBASE_SERVICE_ACCOUNT_BASE64` — new secret this plan introduced, verified fail-open

This is the one genuinely new secret the whole Phases 0–13 effort added — nothing before Phase 2 sent push notifications at all. It must be the **base64 encoding of the entire Firebase service account JSON key file** (Project Settings → Service Accounts → Generate new private key, in the Firebase console — the same project mobile's `google-services.json`/`GoogleService-Info.plist` register against, per Phase 11's notes), not the raw JSON and not a path to a file:

```bash
base64 -i service-account.json | tr -d '\n'   # → paste the output as the env var value
```

**Verified directly, not assumed:** `pushnotificationHelper.ts` wraps its `admin.initializeApp(...)` call in a try/catch and only sets `firebaseInitialized = true` on success; every call site (`sendNotification` → `sendPushNotification`) checks that flag first and returns a "not configured" result rather than throwing when it's false. This was actually observed in this environment's own test runs throughout every backend phase of this plan (`error: Failed to initialize Firebase Admin` appears in the logs, and every affected test still passes) — confirming a missing or invalid value here degrades push delivery only, not the rest of the API. **Still required for real push to work in production** — this is a resilience property of the code, not a reason to skip setting it.

### A pre-existing, currently-inert naming mismatch (found during this audit, not fixed)

`.env` in this environment defines `TEMP_JWT_EXPIRES_IN` (plural "expires"), but `src/config/index.ts` reads `process.env.TEMP_JWT_EXPIRE_IN` (singular "expire") — the names don't match, so `config.jwt.temp_jwt_expire_in` is always `undefined` here. Checked its actual impact before deciding whether this needed fixing: **nothing in the codebase reads `config.jwt.temp_jwt_expire_in` at all** (confirmed by grepping the whole `src` tree) — `tempAuth`'s token verification only uses `temp_jwt_secret`, and no code path was found that signs a token with the temp secret in the first place. This is a dead, currently-inert inconsistency, not an active bug — left unfixed per this session's standing policy of not changing code outside what's actually blocking or in direct scope, but flagged here since a deployment audit is exactly where a future maintainer would want to know about it before relying on that variable.

## What did *not* need adding here

- **exceljs, pdfkit, pdf-parse** (Phase 5) — plain npm dependencies, not runtime secrets. Nothing to add to environment configuration.
- **Excel/PDF report generation** — uses the same Cloudinary credentials already required above; no separate secret.
