# Backend Bug Audit

Read-only audit of the `time-tracker` backend, covering all 16 modules. Focused on two things,
per request: cross-user/cross-company data leakage, and wrong data caused by bad queries or
unit-confusion bugs. No API response shapes were changed — findings only, fixes to be applied
separately and prioritized by you.

**Summary: 15 HIGH, 8 MEDIUM, 3 LOW severity findings.**

**Status: all 15 HIGH, all 8 MEDIUM, and #27 of the LOW findings fixed and verified (`npx tsc --noEmit` + `npm run lint:check` clean, no new issues introduced). #25 (truck-limit enforcement) intentionally deferred pending a product decision — see below.**

- HIGH = cross-tenant data leakage, data corruption, or privilege escalation
- MEDIUM = wrong numbers/values returned, but contained to the requester's own data
- LOW = minor/defensive, or only reachable through another bug

---

## HIGH severity — cross-tenant leakage, corruption, or privilege escalation

*(All 15 items below are fixed.)*

### 1. Mass-assignment in profile update allows privilege escalation and tenant hijacking
- `src/app/modules/user/user.controller.ts:12-24` + `user.service.ts:19-34` (`updateProfile`), also `user.service.ts:137-162` (`adminUpdateUser`)
- The controller spreads the entire request body into `User.findOneAndUpdate({_id: user.authId}, {$set: payload})` with no field allowlist. `validateRequest.ts:9-15` calls `schema.parseAsync(...)` but never writes the parsed/stripped result back onto `req.body`, so zod provides no real protection — and the schema itself already permits a client-supplied `company` field. The `role` field has no enum restriction on the Mongoose schema either.
- **Scenario:** An EMPLOYEE calls `PATCH /user/profile` with `{"role":"super_admin"}` or `{"company":"<anotherCompanyId>"}` — succeeds, silently escalating their role or moving them into another tenant.

### 2. `GET /user/` (list all users) is not scoped by company at all
- `src/app/modules/user/user.service.ts:70-118` (`generalGetAllUsers`), route `user.route.ts:15-24`
- Receives `user: JwtPayload` but never uses it in the query — no company/employee scoping condition anywhere.
- **Scenario:** Any COMPANY or EMPLOYEE account calls `GET /user/` and gets every user across every company/tenant — full cross-tenant PII leak.

### 3. `GET /user/:id` returns any user's full profile with no ownership check
- `src/app/modules/user/user.service.ts:129-135` (`getSingleUser`)
- `User.findById(id)` with no comparison against the caller at all.
- **Scenario:** Any employee guesses/enumerates another company's user id and reads their full profile.

### 4. Notification read-state can be modified for any user (IDOR)
- `src/app/modules/notifications/notifications.service.ts:35-46` (`readNotification`)
- `Notification.findByIdAndUpdate(id, {isRead:true})` with no check that the notification's `to` equals `user.authId`.
- **Scenario:** Any employee can enumerate notification IDs and mark other users' notifications as read.

### 5. Refresh-token flow reads a field that doesn't exist, breaking identity on refresh
- `src/app/modules/auth/custom.auth/custom.auth.service.ts:343-356` (`getRefreshToken`)
- Tokens are signed with `authId` (see `auth.helper.ts:7-20`), but this function destructures `const { userId, role } = decodedToken` — `userId` doesn't exist on the payload, so it's always `undefined`, and the new token is minted with `authId: undefined`.
- **Scenario:** Anyone using `/refresh-token` gets a new access token with `authId: undefined`. Every service that scopes by `user.authId` (the app's core multi-tenant convention) then queries with `undefined` → `null`, which can incorrectly match documents with a missing/null owner field, on top of simply breaking that user's session.

### 6. Dashboard time-analytics & employee-locations leak any employee's data to any company
- `src/app/modules/dashboard/dashboard.route.ts:16-17`, `dashboard.services.ts:426-440` (`getTimeAnalytics`), `:548-560` (`getEmployeeLocations`)
- Routes only check the caller's role is COMPANY, not that `:userId` belongs to that company. Query uses the URL param directly.
- **Scenario:** Company A obtains another company's employee id and reads that employee's name, email, GPS history, and work/break stats via `GET /dashboard/employee-locations/:userId`.

### 7. `getSingleProject` has no ownership/membership check
- `src/app/modules/project/project.service.ts:104-125`
- `Project.findById(id)` with no `company`/`employees` check, unlike `getAllProjects`/`updateProject`/`deleteProject` in the same file, which do check.
- **Scenario:** Any employee/company can `GET /project/:id` for a project that isn't theirs.

### 8. Gallery `deleteImages` deletes any user's images with no ownership check
- `src/app/modules/gallery/gallery.service.ts:48-56`, route `gallery.route.ts:15`
- `Gallery.deleteMany({_id: {$in: ids}})` — no `user: user.authId` filter, unlike `getAllGallerys`.
- **Scenario:** Any employee can pass another employee's gallery image IDs and permanently delete them.

### 9. Payroll: single-record read/update/delete have no ownership check
- `src/app/modules/payrole/payrole.service.ts:60-100`, routes `payrole.route.ts:15-17`
- Unlike `createPayrole`/`getAllPayroles` in the same file (which scope correctly), these three trust the raw id.
- **Scenario:** Any employee/company who knows/guesses a payrole id can read another company's payroll files, or delete another company's payroll record.

### 10. Leave balance: company read and delete have no ownership check
- `src/app/modules/leavebalance/leavebalance.service.ts:29-37`, `:64-67`
- **Scenario:** Any authenticated user reads another company's leave policy; any COMPANY-role user can delete another company's leave-balance configuration.

### 11. Note module: no ownership checks on single-doc operations
- `src/app/modules/note/note.service.ts:58-69`, `:71-91`, `:93-102` (get/update/delete single note)
- **Scenario:** Any employee/company can read, silently overwrite, or delete another company's note by ID.

### 12. Note listing lets the requester bypass self-scoping via query params
- `src/app/modules/note/note.service.ts:27-56` (`getAllNotes`)
- Self-scoping only applies when the client does **not** supply `createdBy`/`project` — supplying either skips it entirely.
- **Scenario:** `GET /note?createdBy=<anyone>` returns another user's notes in full.

### 13. Leave request read/update have no ownership/company scoping
- `src/app/modules/leavemanagement/leavemanagement.service.ts:137-141`, `:143-170`
- `deleteLeavemanagement` in the same file does check ownership — the update path is a clear inconsistency, not intentional.
- **Scenario:** Company B can read or approve/reject Company A's employee's leave request by ID.

### 14. Unauthenticated deletion of Public content
- `src/app/modules/public/public.route.ts:20`
- `DELETE /public/:id` has no `auth(...)` middleware at all, unlike every other mutating route in the file.
- **Scenario:** Anyone, logged in or not, can delete the privacy-policy/terms document.

### 15. Leave request `company` is trusted from client body, not the employee's real employer
- `src/app/modules/leavemanagement/leavemanagement.service.ts:16-19`, `leavemanagement.validation.ts:5-6`
- **Scenario:** An employee of Company A submits a leave request with `company: <Company B's id>` — it lands in Company B's leave list and depletes Company B's leave balance.

---

## MEDIUM severity — wrong data, contained to the requester

*(All 8 items below are fixed.)*

### 16. String-vs-Date comparison makes week/month summary upper bound a no-op
- `src/app/modules/user/user.service.ts:181-191` (`getWorkingHoursSummary`)
- `TimeSession.date` is stored as a `String` (`YYYY-MM-DD`), but the query uses `date: {$gte: weekStartStr, $lte: now}` where `now` is a JS `Date`. In MongoDB's BSON type ordering, all strings sort below all dates, so `$lte: <Date>` is true for every string — the upper bound never actually filters anything. Currently masked only because no future-dated sessions exist yet.

### 17. `getCompanyGeneralStats` returns platform-wide project counts, not the caller's own
- `src/app/modules/dashboard/dashboard.services.ts:118-131`
- `totalProjects`/`totalCompletedProjects` use `Project.countDocuments({})` with no company filter, while `totalEmployees` in the same response is correctly scoped.
- **Scenario:** Every company's dashboard shows the same platform-wide totals as if they were their own.

### 18. `generateMonthlyPdfReport` lets an employee fetch another employee's report
- `src/app/modules/timetracker/timetracker.service.ts:220-226`
- The `employee` query param is used unconditionally regardless of caller role/company.

### 19. `getLocationsByDate` ignores company scoping and the `employee` filter entirely
- `src/app/modules/timetracker/timetracker.service.ts:181-209`
- **Scenario:** A company requesting locations for a date gets every employee's location pings across every company.

### 20. `Project.duration` uses inconsistent units between create and update
- `src/app/modules/project/project.service.ts:28` (hours) vs `:171-174` (milliseconds — the code's own comment says so)
- **Scenario:** A project's `duration` is stored in hours at creation but overwritten in raw milliseconds if its dates are ever edited — ~3.6 million times too large, depending on edit history.

### 21. Subscription: cross-company trial-eligibility check
- `src/app/modules/subscription/subscription.controller.ts:38-40`
- `req.params.userId || user.authId` lets a caller override their own identity via the URL with no ownership check.
- **Scenario:** Company A can check whether Company B has used its free trial.

### 22. Leavebalance upsert returns stale (pre-update) data
- `src/app/modules/leavebalance/leavebalance.service.ts:7-27` (`createLeavebalance`)
- The updated document from `findByIdAndUpdate(..., {new:true})` is discarded; the function returns the old object.
- **Scenario:** Changing sick-leave allowance from 10 to 20 updates the DB correctly, but that same API call's response still shows 10.

### 23. Note update writes to a schema field that doesn't exist (`documents` instead of `files`)
- `src/app/modules/note/note.controller.ts:29-36` vs schema field `files`
- Mongoose's default `strict: true` silently drops the unknown key.
- **Scenario:** Editing a note's attachments returns success but nothing actually changes.

---

## LOW severity

### 24. Leave balance calculation not scoped by company
- `src/app/modules/leavemanagement/leavemanagement.service.ts:183-207` — sums a user's approved leave across **all** companies. Only manifests via bug #15 or a real employer change.

### 25. `usage-tracking.service.ts` truck/user counts are stubbed
- **User count: fixed.** `getCurrentUserCount` now actually counts `User.countDocuments({company: userId, status: {$ne: DELETED}}) + 1` instead of a hardcoded `1` — this was a live billing bug: `canAddUser`'s plan-limit check (`currentUserCount >= plan.maxUsers`) could never actually block anyone from exceeding their plan's user limit.
- **Truck count: deferred.** Subscription plans genuinely define a `maxTrucks` limit per tier (1/3/10/50/999 — see `subscription.seed.ts`), but there is no `Truck` model anywhere in the app, so `canAddTruck`'s limit check has silently never enforced anything. This isn't a simple bug fix — it needs a product decision on what a "truck" should map to (a new model, a field on Company, or removing truck-limiting from the plan logic entirely). Flagged for you; not fixed.

### 26. Gallery `getSingleGallery`/`updateGallery` unscoped but currently unreachable
- **Fixed** alongside #8 (same file) while already in there — both now scope by `user: user.authId`, matching `getAllGallerys`.

### 27. `cacheMiddleware.ts` builds cache keys without user scoping
- **Fixed by deletion.** Confirmed via search that it was never imported anywhere outside itself — genuinely dead code. Removed entirely rather than patched, consistent with how other unused code was handled earlier in this project. Note: the `CacheService` it wrapped is unaffected and remains in active use elsewhere (review, public modules, rate limiter).

---

## Confirmed clean (checked, no issues found)

- **Project**: `updateProject`/`deleteProject` correctly check company ownership.
- **Timetracker**: timer lifecycle functions correctly scoped by `session.user`; `getDailySummary` correctly scoped and unit-consistent.
- **Dashboard**: `calculateWorkingHours` (the earlier ms/minutes bug) confirmed fixed; date-range helpers have no off-by-one.
- **Subscription**: core Stripe money flow always reads price from Stripe's own response, never trusts client-supplied amounts; update/cancel/pause/resume all correctly scoped by `{_id, userId: user.authId}`; webhook route correctly sits outside JWT auth and verifies Stripe's signature.
- **Package**: global catalog, no tenant scoping needed; writes are SUPER_ADMIN-gated.
- **Review**: update/delete correctly check `reviewer === user.authId`; rating-average math is correct.
- **Public**: all routes except the `DELETE /:id` above are appropriately public or role-gated.
- **Token module**: no exploitable logic — the one lookup matches on an unguessable crypto token, not a client-supplied id.
- **Middleware** (`auth.ts`, `socketAuth.ts`): role/JWT verification logic is correct and consistent.
- **User module**: `deleteUser` and the ownership-check portion of `adminUpdateUser` correctly follow the scoping convention (separate from the mass-assignment issue in #1).
- **Notifications**: `getNotifications`/`readAllNotifications` correctly scope by `{to: user.authId}`.

---

## Suggested fix order

1. **#1 (mass-assignment/privilege escalation)** and **#5 (broken refresh token)** — these undermine the whole auth model and should go first.
2. **#2, #3, #6, #7, #9-#15** — the IDOR/missing-scoping pattern repeats across almost every module; since they're all the same shape (add an ownership/company check before `findById`/`findByIdAndUpdate`/`findByIdAndDelete`), these can likely be fixed in one focused pass.
3. **#14** — one-line fix (add `auth(...)` middleware), trivial and urgent.
4. **MEDIUM items** — fix as time allows; none are actively leaking data to other tenants, just returning wrong numbers to the requester's own view.
