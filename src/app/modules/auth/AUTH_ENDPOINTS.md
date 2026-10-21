# Auth login endpoints

| Endpoint | Allowed roles | Clients |
|----------|---------------|---------|
| `POST /auth/employee-login` | `employee` | Mobile app |
| `POST /auth/company-login` | `company` | Company dashboard |
| `POST /auth/login` | `company` (alias) | Company dashboard, legacy clients |
| `POST /auth/admin-login` | `super_admin` | Admin dashboard |
| `POST /auth/custom-login` | `employee` (deprecated alias) | Legacy phone login |

Shared flows without role-scoped login: `forget-password`, `reset-password`, `verify-account`, `refresh-token`.

**v1 note:** `refresh-token` does not re-check which client issued the token. Tokens issued before a role split remain valid until expiry.

## Deploy order

1. Backend (this service)
2. Company / admin dashboards
3. Mobile app store build

## Manual QA matrix

| Scenario | Endpoint / client | Expected |
|----------|-------------------|----------|
| Employee credentials | `employee-login` / mobile | 200, app home |
| Company credentials | `employee-login` / mobile | 403 |
| Company credentials | `company-login` or `/login` / dashboard | 200 |
| Employee credentials | `company-login` or `/login` | 403 |
| Unverified employee | `employee-login` | 407 OTP |
| Unverified company | `employee-login` | 403 (no OTP) |
| super_admin | `admin-login` / admin SPA | 200 |
| Wrong password | any login | 400, generic password message |
