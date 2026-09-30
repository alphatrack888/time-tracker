# Phase 1 notes

Companion to [`Notification_Reports_Integration_Plan.md`](../Notification_Reports_Integration_Plan.md) Phase 1 (device token & multi-device data model).

## What was built

- New `devicetoken` module (`src/app/modules/devicetoken/`): `DeviceToken` model (`user`, unique `token`, `platform`, `appVersion`, `lastSeenAt`), service, controller, validation, routes.
- `POST /api/v1/devices/register`, `GET /api/v1/devices`, `DELETE /api/v1/devices/:token` — mounted at `/api/v1/devices` in `src/routes/index.ts`. All three require auth; register/deregister/list are scoped to the requesting user only (`req.user!.authId`, never a client-supplied user id).
- Re-registering an already-registered token under a different user reassigns ownership (shared/kiosk device handoff) instead of creating a duplicate row — enforced by the model's unique index on `token` plus an upsert-by-token in `registerDeviceToken`.
- `DeviceTokenServices.getTokensForUser` / `removeStaleToken` added as the data-access layer Phase 2's push-sending rewrite will consume — not wired into `pushnotificationHelper`/`notificationHelper` yet; that fan-out logic is explicitly Phase 2's scope.
- `handleLoginLogic` (`auth/common.ts`) and `socialLogin` (`auth/custom.auth/custom.auth.service.ts`) no longer write to `User.deviceToken`. If a `deviceToken` is present in the login payload, it's registered into the new `DeviceToken` collection instead (best-effort — a registration failure never fails the login itself). `User.deviceToken` is marked `@deprecated` in both the interface and model, left readable, not yet removed.
- API contract documented in `API_DOCUMENTATION.md` (new "Device Tokens" section) and `Time_Tracker_Postman_Collection.json` (new "Device Tokens" folder) — this is the frozen contract for Phase 11 (mobile) and any web-push work in Phases 7/9.
- Tests: `devicetoken.route.test.ts` (registration, multi-device, reassignment, deregistration, tenant isolation, validation, role coverage), `devicetoken.service.test.ts` (data-access helpers), `login.deviceToken.test.ts` (login no longer writes `User.deviceToken`, registers into the new collection instead). 27/27 tests passing project-wide (up from 14 after Phase 0).

## Bug discovered, not fixed (out of scope for Phase 1)

While writing `login.deviceToken.test.ts`, logging in as a freshly created user (via `POST /api/v1/auth/custom-login`) threw a 500:

```
TypeError: Cannot destructure property 'restrictionLeftAt' of 'authentication' as it is undefined.
  at Object.handleLoginLogic (src/app/modules/auth/common.ts:19)
```

`handleLoginLogic` unconditionally destructures `isUserExist.authentication` (`common.ts:19`), but for a user whose `authentication` subdocument wasn't explicitly set at creation time, it comes back `undefined` from the `.select('+password +authentication').lean()` query in `customLogin`/`adminLogin` — despite the schema declaring defaults for every field inside it. This line is untouched by Phase 0 or Phase 1; it's a pre-existing defect, not a regression introduced here.

**Not fixed here** because it's unrelated to device tokens and outside this phase's scope. Worked around in the test by explicitly setting `authentication: { restrictionLeftAt: null, resetPassword: false, wrongLoginAttempts: 0 }` on the seeded test user, so the test exercises only what Phase 1 changed.

**Real-world impact, for whoever picks this up:** any user created without an explicit `authentication` object — which, depending on how user creation actually persists the schema's nested defaults, may include some or all normal signups — could get a 500 on their very first login attempt via `custom-login`/`admin-login` (the passport-based `/login` route goes through a different code path and should be checked separately for the same defect). Worth a focused investigation into whether Mongoose is actually applying the nested `authentication.*` defaults on `User.create()`/`save()`, and whether `.select('+authentication').lean()` returns them correctly when it is.
