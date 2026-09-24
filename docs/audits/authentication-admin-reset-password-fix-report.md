# Authentication — Admin Reset Password Fix

**Gate:** IMPLEMENTATION COMPLETE — STOP FOR MANUAL UAT  
**Date:** 2026-09-18 (updated 2026-09-19 — database schema alignment; notification delivery endpoint; **UI-triggered empty-body 400 / PostAsJsonAsync fix**)  
**Scope:** Admin → Users & Employees → Reset Password → Send Email  
**Affected user (UAT context):** Counsellor `swamidassaluri@gmail.com` / Hyderabad Eye Clinic - Banjara Hills / active  

**Current phase:** Persistence OK; Notification route OK; Auth client transport fixed — see [UI-Triggered Notification Failure Diagnosis](#ui-triggered-notification-failure-diagnosis).
---

## 1. Problem

Admin User Management “Reset Password” confirmation dialog opened correctly, but **Send Email** failed in the UI with **“Failed to fetch”**.

## 2. Exact Failure

| Field | Value |
|-------|--------|
| HTTP method | `POST` |
| Request URL/path | `http://localhost:5073/api/users/{userId}/reset-password` |
| Request sent? | **Yes** (browser → AuthService) |
| HTTP status (pre-fix) | **500** |
| Safe response (phase 1) | `AmbiguousMatchException: The request matched multiple endpoints` |
| Safe response (phase 2 — current) | `DbUpdateException` → `Npgsql.PostgresException` **42703**: column `requested_at` of relation `password_reset_requests` does not exist |
| Frontend exception | `TypeError: Failed to fetch` (browser mask of backend 500) |
| Category | Phase 1: route ambiguity; Phase 2: **EF model vs PostgreSQL schema mismatch** |

API base URL was already correct (`NEXT_PUBLIC_API_URL=http://localhost:5073/api`). CORS was not the primary defect.

## Database Schema Root Cause

| Layer | Fact |
|-------|------|
| EF entity | `PasswordResetRequest` maps `RequestedAt` → column `requested_at` (`timestamp with time zone`, NOT NULL), plus `reset_token_hash`, `requested_by_user_id`, `status`, `expires_at`, `used_at`, `ip_address`, `user_agent`, `tenant_id`, `user_id` |
| Why EF generates `requested_at` | `[Column("requested_at")]` on `RequestedAt` with default `DateTime.UtcNow`; INSERT includes the property |
| Live PostgreSQL (before) | `public.password_reset_requests` had: `id`, `tenant_id`, `user_id`, **`reset_token`**, `expires_at`, `used_at`, `ip_address`, `user_agent`, **`created_at`** — **no `requested_at`**, no `reset_token_hash`, no `requested_by_user_id`, no `status` |
| Connection (AuthService Development) | Host `hospitalportal-db-server.postgres.database.azure.com`, database `hospitalportal`, schema `public` |
| Migration history | `__EFMigrationsHistory` **already records** `20260113154156_AddHipaaComplianceColumnsToUsers` (creates EF-shaped table), yet live columns matched the **legacy bootstrap** |

**Why the mismatch existed (classification C + D + E):**

1. **C — Table predates current EF model.** Live columns match early bootstrap in `archive/cleanup_2026_01_15/MIGRATION_REQUIRED.md` (`reset_token` + `created_at`, no `requested_at`).
2. **D — SQL scripts and EF model diverged.** EF/`opd_migration.sql`/HIPAA migration define `reset_token_hash` + `requested_at`; bootstrap/`add_user_columns.sql` differ.
3. **E — History said schema was current.** HIPAA migration id was applied in `__EFMigrationsHistory`, but the live object never received the EF column set (`Database.Migrate()` is disabled; guarded SQL create could not reshape an existing table).

`RequestedAt` is intentional audit/state on the reset-request model — **not** removed from the entity. Schema was aligned to the entity.

## Migration

| Item | Value |
|------|--------|
| Strategy | **New idempotent SQL migration** (project path: SQL scripts under `Data/Migrations`; no `Database.Migrate()`) |
| Name | `20260918220000_AlignPasswordResetRequestsWithEfModel.sql` |
| Path | `microservices/auth-service/AuthService/Data/Migrations/20260918220000_AlignPasswordResetRequestsWithEfModel.sql` |
| EF C# migration | **Not created** — model/snapshot already describe the target shape; HIPAA id already in history |
| `__EFMigrationsHistory` rewrite | **Not done** (would hide the divergence) |
| Applied to UAT DB | **Yes** (Azure `hospitalportal` / `public`) |

## Database Verification

**Before:**

- `requested_at` — **missing**
- `reset_token_hash` — **missing** (had `reset_token`)
- `requested_by_user_id` — **missing**
- `status` — **missing**
- Row count: `0`

**After:**

| column | data_type | null |
|--------|-----------|------|
| id | uuid | NO |
| tenant_id | uuid | NO |
| user_id | uuid | NO |
| reset_token_hash | character varying | NO |
| expires_at | timestamp with time zone | NO |
| used_at | timestamp with time zone | YES |
| ip_address | character varying | YES |
| user_agent | text | YES |
| created_at | timestamp without time zone | YES (legacy leftover; EF unmapped) |
| requested_at | timestamp with time zone | NO |
| requested_by_user_id | uuid | YES |
| status | character varying | NO |

## 3. Root Cause (phase 1 — route)

`UsersController` registered **two** actions on the same route (AmbiguousMatchException). Fixed earlier in this report’s phase 1.

## 4. Request Flow

```
Users page → showConfirmation (Send Email)
  → usersApi.requestPasswordReset(userId)
  → POST /api/users/{id}/reset-password
  → [Authorize] + RequirePermission("user.manage")
  → tenant-scoped user lookup by id
  → generate ForgotPassword-compatible token
  → persist PasswordResetToken + audit PasswordResetRequest (hashed, RequestedAt)
  → NotificationClient.SendPasswordResetEmailAsync
  → Ok { message, email, expiresAt }  (no raw token in response)
```

## 5. Backend Changes

**Phase 1 (route / email):**

- One admin email-initiate route: `POST /api/users/{id}/reset-password`
- Direct set-password → `POST /api/users/{id}/set-password`
- Email via `INotificationClient.SendPasswordResetEmailAsync`
- Token aligned with Forgot Password; no raw token in response

**Phase 2 (schema):**

- SQL alignment only; **no** auth semantic changes, no CheckPasswordAsync / tenant / branch / Counsellor ownership changes

## 6. Frontend Changes

- `usersApi.requestPasswordReset(id)` via axios interceptors
- Backend `err.response?.data?.message` surfaced; dialog stays open on failure

## 7. Notification/Email Changes

**Phase 3 (this fix):** Added missing NotificationService password-reset HTTP function + `IEmailService.SendPasswordResetEmailAsync` (Azure Communication Services). Auth `NotificationClient` path unchanged. See [Notification Delivery Root Cause](#notification-delivery-root-cause).

## 8. Security / Authorization

- Permission: `user.manage`
- Tenant scoping preserved
- Audit stores SHA-256 hex of token, not plaintext
- No plaintext password email; token expiration unchanged

## 9. Database

Schema aligned via SQL migration above. No changes to `users.tenant_id`, `users.branch_id`, `user_branches`, role assignments, or `CounselingSession.CounselorId`.

## Tests

| Suite / command | Result |
|-----------------|--------|
| `dotnet test AuthService.Tests.csproj --filter FullyQualifiedName~AdminResetPasswordContractTests` | **Passed** (9/9) |
| `npx vitest run src/app/dashboard/admin/users/admin-reset-password.contract.test.ts` | **Passed** (5/5) |
| Live authorized Admin POST (schema insert + email) | **Skipped** — stop for Manual UAT (do not expose bearer token) |
| Failed | **0** |

Contract coverage added/extended: entity `requested_at` mapping, ResetPassword persists `PasswordResetRequest` before notification, SQL migration presence, FE success path + backend error surfacing (not hard-coded “Failed to fetch”).

## Manual UAT

| ID | Steps | Expected |
|----|-------|----------|
| UAT-01 | Admin → User Management → affected Counsellor | User visible |
| UAT-02 | Click Reset Password | Dialog opens |
| UAT-03 | Confirmation shows email | `swamidassaluri@gmail.com` |
| UAT-04 | Click Send Email | **Success** — not “Failed to fetch” |
| UAT-05 | Password reset email received | Delivered |
| UAT-06 | Open reset link | `/auth/reset-password` accepts token |
| UAT-07 | Set new password | Success |
| UAT-08 | Login India Eye Hospital Network + new password | Success |
| UAT-09 | Reaches application | Success |
| UAT-10 | Branch: Hyderabad Eye Clinic - Banjara Hills | Unchanged |
| UAT-11 | Role: Counsellor | Unchanged |
| UAT-12 | Counsellor ownership / Waiting List | Unchanged |

After Send Email: confirm a new `password_reset_requests` row for the user (**do not** expose `reset_token_hash` / raw token). Confirm Notification receives the send request.

## Known Limitations

- Email still depends on NotificationService + Azure Communication Services; Auth returns **502** with the safe prepared-but-not-sent message if dispatch fails after token preparation.
- Legacy `created_at` column left in place (unused by EF).
- Self-service Forgot Password URL host unchanged (`Request.Host`).
- Retry after notification failure creates a **new** pending `PasswordResetRequest` (existing semantics; not changed).

## Out of Scope

- Network Hospital login architecture / branch-as-login  
- Counsellor ownership / Assign / Reassign / ReQueue  
- Phase 3I Slice 10  
- MFA / password hashing / CheckPasswordAsync / LoginIdentityLookup  

---

## Notification Delivery Root Cause

**Date:** 2026-09-19  
**Symptom (after schema fix):** UI showed *“Password reset was prepared but the email could not be sent…”* (Auth **502**).

### Failure chain

```
Admin Send Email
  → POST AuthService /api/users/{id}/reset-password   (persistence OK)
  → NotificationClient.SendPasswordResetEmailAsync
  → POST http://localhost:7073/api/notifications/password-reset
  → NotificationService
  → ❌ HTTP 404 (route did not exist)
  → Auth returns 502 safe message
```

| Layer | Finding |
|-------|---------|
| AuthService | Running `localhost:5073`; `NotificationService:BaseUrl` = `http://localhost:7073`; `UseMockService` = **false** |
| NotificationClient | Correct call: `POST /api/notifications/password-reset` with `userId`, `tenantId`, `email`, `resetUrl`, `userName`, `templateType=password_reset` |
| NotificationService | Running `localhost:7073` (Azure Functions) |
| Exact failure | **Missing function** — no `password-reset` route (confirmed live **404** before fix) |
| Not the cause | SMTP auth, ACS credentials, template lookup, S2S 401/403, tenant header, connection refused |

### Endpoint contract (after fix)

| Item | Value |
|------|--------|
| Method | `POST` |
| Path | `/api/notifications/password-reset` |
| Auth | `AuthorizationLevel.Anonymous` (same pattern as purchase-return / email-verification; Auth client does not send function key) |
| Provider | Azure Communication Services via existing `AzureEmailService` |
| Response success | `{ success: true, messageId, message }` |
| Response provider failure | **502** `{ success: false, error }` (no credentials / token) |

### Exact fix

Implemented the missing NotificationService endpoint and email method (no Auth login/tenant/token-security changes):

1. `Functions/PasswordResetNotification.cs` — route `notifications/password-reset`
2. `Models/Requests/PasswordResetEmailRequest.cs` — matches Auth client DTO
3. `IEmailService.SendPasswordResetEmailAsync` + `AzureEmailService` / `ResendEmailService` implementations
4. Template includes reset URL + expiry; **does not log** the token-bearing URL

### Security impact

- Reset token still never returned by Auth API
- Notification logs userId/tenantId/recipient-present only (not reset URL)
- No secrets committed; ACS config remains in existing `local.settings.json`
- No `AllowAnonymous` workaround on Auth; Notification route matches established internal email functions

### Idempotency / retry

Re-clicking Send Email after a prior notification failure creates a **new** pending reset request (new token on user + new audit row). Existing pending rows are not deleted. Behavior documented; not changed.

### Tests

| Suite | Result |
|-------|--------|
| `dotnet test NotificationService.Tests` (`PasswordResetNotificationContractTests`) | **Passed** (6/6) |
| `dotnet test AuthService.Tests --filter FullyQualifiedName~AdminResetPasswordContractTests` | **Passed** (11/11) |
| `npx vitest run .../admin-reset-password.contract.test.ts` | **Passed** (6/6) |

### Live verification (safe)

| Check | Result |
|-------|--------|
| AuthService `localhost:5073` | Listening / reachable |
| NotificationService `localhost:7073` | Listening; maps `SendPasswordResetEmail` |
| Direct `POST /api/notifications/password-reset` (dummy token URL) | **200** `{ success: true, messageId: … }` — ACS accepted |
| Authorized Admin UI reset | **STOP FOR MANUAL UAT** (do not automate with bearer token) |

### Manual UAT (notification phase)

| ID | Steps | Expected |
|----|-------|----------|
| UAT-01 | Admin → User Management | Opens |
| UAT-02 | Select active Counsellor `swamidassaluri@gmail.com` | Visible |
| UAT-03 | Reset Password | Dialog opens |
| UAT-04 | Confirmation shows email | `swamidassaluri@gmail.com` |
| UAT-05 | Send Email | **Success** — not “Failed to fetch”; not “email could not be sent” |
| UAT-06 | Inbox | Password reset email received |
| UAT-07 | Open reset link | `/auth/reset-password` |
| UAT-08 | Set new password | Success |
| UAT-09 | Login India Eye Hospital Network + new password | Success |
| UAT-10 | Branch Hyderabad Eye Clinic - Banjara Hills | Unchanged |
| UAT-11 | Role Counsellor | Unchanged |
| UAT-12 | Counsellor ownership / Waiting List | Unchanged |

Confirm a new `password_reset_requests` row (`status=pending` until used). **Do not** expose `reset_token_hash` / raw token.

## Gate

```
IMPLEMENTATION COMPLETE — STOP FOR MANUAL UAT
```

Do **not** mark UAT passed automatically. Do **not** start Phase 3I Slice 10. Do **not** modify Counsellor ownership.

---

## UI-Triggered Notification Failure Diagnosis

**Date:** 2026-09-19  
**Symptom:** Admin UI Send Email still showed *“Password reset was prepared but the email could not be sent…”* after the NotificationService route fix and after live curl/PowerShell probes returned **200 + ACS messageId**.

### Actual UI request (reconstructed from DB + Notification logs)

Browser Network was not captured in-session (no bearer automation). Evidence from the Admin UI attempts:

| Layer | Evidence |
|-------|----------|
| Auth persistence | New `password_reset_requests` rows for Counsellor `swamidassaluri@gmail.com` at **2026-09-19 07:35:31Z** and **07:37:51Z** (`status=pending`) |
| NotificationService | Same timestamps **07:35:33Z** / **07:37:53Z**: `POST /api/notifications/password-reset` → **400**, `Invalid password-reset notification body`, `JsonException: The input does not contain any JSON tokens` (empty body), `userAgent: (null)` (HttpClient) |
| Auth → UI | `UsersController.ResetPassword` returns **502** with the prepared-but-not-sent message when `SendPasswordResetEmailAsync` returns `Success=false` |
| Frontend | `page.tsx` surfaces `err.response?.data?.message` — **correct**; not a frontend contract bug |

**UI Auth response classification:** **502** (not 2xx). Persistence succeeded; notification dispatch failed.

### AuthService notification call

| Item | Value |
|------|--------|
| Client | `NotificationClient.SendPasswordResetEmailAsync` |
| Configured base URL | `NotificationService:BaseUrl` = `http://localhost:7073` (`UseMockService=false`) |
| Method / path | `POST /api/notifications/password-reset` |
| DTO fields | `userId`, `tenantId`, `email`, `resetUrl`, `userName`, `templateType=password_reset` |
| Success condition | `response.IsSuccessStatusCode` only (does **not** require `success` property) |
| Pre-fix transport | `HttpClient.PostAsJsonAsync(...)` → **JsonContent / chunked, no Content-Length** |

### NotificationService response (live)

| Caller | Status | Body (safe) |
|--------|--------|-------------|
| PowerShell / curl with JSON + Content-Length | **200** | `{ success: true, messageId, message }` |
| Auth-style `PostAsJsonAsync` | **400** | `{ success: false, error: "Invalid request body." }` (empty stream) |
| Auth-style `StringContent` + `PostAsync` | **200** | `{ success: true, messageId, message }` |

### Response contract comparison

| Check | Result |
|-------|--------|
| Client expects `success: true` DTO? | **No** — password-reset path uses HTTP status only |
| Service returns `{ success, messageId }` on 200? | **Yes** |
| Defect C (success-property mismatch)? | **Ruled out** for this path |
| Defect D (client mis-classifies 200)? | **Ruled out** — Auth never received 200; it received **400** |

### Exact root cause

**G + transport defect (Auth → Functions body delivery):**

1. Admin UI correctly called Auth `POST /api/users/{id}/reset-password`.
2. Auth persisted `password_reset_requests` (`pending`).
3. Auth called Notification via `PostAsJsonAsync` (chunked JSON, **no Content-Length**).
4. Azure Functions isolated worker delivered an **empty** `req.Body` → deserialize failure → **400**.
5. Auth treated non-2xx as notification failure → **502** safe message → UI displayed it.

Standalone probes succeeded because they sent `Content-Length`. Activation OTP already used `StringContent` + `PostAsync` for this reason; password-reset did not.

**Not the cause:** wrong URL, missing route (post-fix), ACS provider failure for Auth payload shape, stale Notification binary (route mapped), frontend mis-parse of 200, or `success` property mismatch.

### Smallest fix

`NotificationClient.SendPasswordResetEmailAsync`: serialize with `JsonSerializer` + `StringContent` + `PostAsync` to full `{BaseUrl}/api/notifications/password-reset` (same pattern as `SendActivationOtpAsync`). Log URL + payload byte length + HTTP status only (no token / reset URL).

### Tests

| Suite | Result |
|-------|--------|
| `AdminResetPasswordContractTests` | **Passed** (12/12) — includes StringContent/PostAsync guard + HTTP-status success condition |
| `admin-reset-password.contract.test.ts` | **Passed** (6/6) |
| `PasswordResetNotificationContractTests` | **Passed** (6/6) |

### Live verification (safe)

| Check | Result |
|-------|--------|
| AuthService `:5073` | Restarted with fix (listening) |
| NotificationService `:7073` | Running; route mapped |
| `StringContent` POST password-reset | **200** + `messageId` |
| `PostAsJsonAsync` POST password-reset | **400** empty body (reproduces pre-fix defect) |
| Authorized Admin UI Send Email | **STOP FOR MANUAL UAT** |

### Manual UAT (repeat)

UAT-01 … UAT-12 as in the notification phase table above. Expect Send Email **success**, inbox delivery, reset link, login, branch/role/ownership unchanged.

## Gate (post UI-triggered diagnosis)

```
IMPLEMENTATION COMPLETE — STOP FOR MANUAL UAT
```

Do **not** mark UAT passed automatically. Do **not** start Phase 3I Slice 10. Do **not** modify Counsellor ownership.

