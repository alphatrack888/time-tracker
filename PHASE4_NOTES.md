# Phase 4 notes

Companion to [`Notification_Reports_Integration_Plan.md`](../Notification_Reports_Integration_Plan.md) Phase 4 (preferences & i18n).

## What was built

- **New `notificationpreferences` module**: `NotificationPreference` model (one doc per user, `pushEnabled` + 6 toggleable categories: `leave`, `project`, `payroll`, `overtime`, `attendance`, `subscription`), `GET/PATCH /api/v1/notification-preferences`. `language` lives on `User` (new `language?: 'en'|'de'` field), but is read/written through the same preferences endpoint for a single client-facing surface — the split is an implementation detail the API hides.
- **New `notificationTemplates.ts`**: every notification kind the system sends (14 total, covering all triggers from Phases 0–3) now has both English and German copy in one place, keyed by a `NotificationKind` enum. Each kind maps to exactly one `NotificationCategory` via `KIND_CATEGORY` — a trigger can't tag its notification with a category that doesn't match its actual content, because it doesn't tag it at all; the category is derived from the kind.
- **`notificationHelper.ts` is now the single enforcement point** for both preferences and language: before creating anything, it checks whether the recipient has disabled the notification's category (skip everything — no DB row, no socket emit, no push — unless the category is mandatory); before the push step specifically, it checks the recipient's `pushEnabled` switch (in-app row still created, push skipped). Language is resolved from the recipient's `User.language`, falling back to English for unset or invalid values, and used to render the template.
- **All 9 real trigger call sites migrated** from hand-written `title`/`body` strings to `kind`/`data`, across `leavemanagement.service.ts` (3 sites), `project.service.ts`, `payrole.service.ts`, `custom.auth.service.ts` (2 sites), `monitoring.service.ts` (2 sites), and `timetracker.triggers.ts` (3 sites).

## Design decisions worth knowing about

**Backwards-compatible payload shape, not a breaking rewrite.** `SendNotificationPayload` is now a union: either `{kind, data?}` (templated, localized, preference-checked) or `{title, body, category?}` (literal, only preference-checked if a `category` is explicitly given — omitted, it's always sent, like a mandatory category). This meant **zero changes were needed to any of the 68 tests written in Phases 0–3** — they all pass a literal `{title, body}` with no `category`, which is still a fully supported, ungated path. Real production triggers were migrated to `kind`/`data`; nothing in the test suite needed touching to make that possible. A discriminated union with hard type-level enforcement was considered and rejected as unnecessary complexity for a codebase that doesn't otherwise lean on that style.

**Preferences are resolved once per send, not twice.** Both the category gate and the `pushEnabled` gate need the same `NotificationPreference` document; an earlier draft fetched it separately for each check (two DB round trips) before being simplified to fetch once and reuse.

**`account` is mandatory by construction, not by convention.** The `ToggleableCategories` type used by the preferences model and its Zod validation schema simply has no `account` key — a client sending `{categories: {account: false}}` gets a `400` (unrecognized key), not a silently-ignored one. `MANDATORY_CATEGORIES` in `notificationTemplates.ts` is the second, independent enforcement point (inside `sendNotification` itself), so even a future code path that bypasses the API validation still can't suppress an account-category send.

**`pushEnabled` applies even to mandatory-category notifications.** A user who globally disabled push still gets the in-app row for a welcome/onboarding notification — they just don't get an OS push banner for it. This is a deliberate reading of "mandatory": the *category* can't be turned off, but the separate, category-independent "don't push to my phone" switch is honored uniformly. Tested explicitly.

**Language is resolved once, at send time, not per-viewer.** A `Notification` row's `title`/`body` are rendered in the recipient's language at creation time and stored as plain text — this matches how the push notification itself works (FCM sends fixed text, not something re-rendered per viewer) and how the existing PDF-report `lang` param already behaves. If a user changes their language preference later, past notifications stay in whichever language they were created in; this is intentional (an accurate historical record), not a bug.

**Translation coverage is complete, not a token example.** All 14 notification kinds have real German translations (not machine-placeholder text), verified by a test that renders every kind in both languages without throwing, plus targeted tests for interpolation and the dynamic leave-status word ("approved"/"rejected" → "genehmigt"/"abgelehnt").

## Tests

4 new test files, 24 new tests (92 total project-wide, up from 68):
- `notificationTemplates.test.ts` — English and German rendering, unsupported-language fallback (and `undefined`), data interpolation, the dynamic status-word translation, every kind renders in both languages without throwing, and the kind→category mapping (including which category is mandatory).
- `notificationpreferences.route.test.ts` — default all-enabled for a user with no record, partial category updates, the `pushEnabled` switch, language persisted through to `User`, `account` rejected as an unknown category key, an unsupported language code rejected, and tenant isolation (one user's preference change never affects another's).
- `notificationHelper.preferences.test.ts` — a disabled category is skipped entirely (no row, no push) while an unrelated enabled category still sends; a user with no preference record at all gets everything by default; the mandatory `account` category sends even with every other category disabled; `pushEnabled: false` creates the row but skips push; a literal (non-`kind`) send with no `category` is never gated; plus three language-resolution cases (recipient has `de` set, recipient has nothing set, recipient doesn't exist at all — all handled without throwing).

Two real bugs found and fixed while writing these (not left for later):
1. A wrong relative import path (`../../enum/user` instead of `../enum/user`) in a new test file — caught immediately by `tsc`, not a runtime issue, but worth naming since it's exactly the kind of mistake that's easy to wave through without actually running the suite.
2. The "persists a language change" test initially signed a JWT with a fabricated `authId` that had no backing `User` document, so the `User.findByIdAndUpdate` call had nothing to update and the test's own assertion silently failed against a `User.findById` that returned `null`. Fixed by seeding a real `User` first and signing the token against its actual `_id`.
