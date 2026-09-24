# Authentication — Admin Password Reset Link / Tenant Context Diagnosis

**Gate:** DIAGNOSIS COMPLETE — TENANT MIDDLEWARE FIX APPLIED — STOP FOR MANUAL UAT  
**Date:** 2026-09-19  
**Scope:** Admin Reset Password email link → `/auth/reset-password` → tenant validation → Request New Reset Link  
**Do not start:** Phase 3I Slice 10 · Counsellor ownership changes · login/auth redesign  

**Preserve:** NotificationClient `JsonSerializer` + `StringContent` + `PostAsync` transport fix.

**UAT prerequisite:** Restart AuthService so middleware changes load (process was stopped during test build lock).

---

## Diagnostic conclusions (Phase 1)

| Flag | Result |
|------|--------|
| REAL ADMIN RESET TOKEN GENERATED | **YES** |
| REAL RESET URL PASSED TO NOTIFICATION | **YES** |
| DUMMY TOKEN PRESENT IN PRODUCTION/UI FLOW | **NO** |
| DUMMY TOKEN ONLY FROM SMOKE TEST | **YES** |

---

## Root Cause

### 1. Dummy-token issue — confirmed (wrong email / smoke test)

| Field | Value |
|-------|--------|
| Status | **Confirmed** — not an Admin UI production defect |
| Evidence | Literal `live-verify-dummy-not-a-real-token` appears **only** in `docs/audits/authentication-admin-reset-password-fix-report.md` as “Direct `POST /api/notifications/password-reset` (dummy token URL)”. Zero matches in apps/, microservices/ source, scripts, or tests. |
| Admin path | `UsersController.ResetPassword` generates 32-byte RNG token (URL-safe Base64), builds `{Frontend:BaseUrl}/auth/reset-password?token={token}`, passes that URL to `SendPasswordResetEmailAsync`. NotificationService embeds caller-supplied `resetUrl` unchanged. |
| Affected layer | Live verification / ACS smoke probe only |
| Production change | **None** for this issue |

### 2. Tenant-ID issue — confirmed (production defect)

| Field | Value |
|-------|--------|
| Status | **Confirmed** — fixed |
| Symptom | Reset page shows API message `Tenant ID is required` |
| Evidence | Exact string from `TenantResolutionMiddleware` when `X-Tenant-ID` is empty. Middleware allowlist included `/api/auth/login` and activation steps, but **not** `/api/auth/validate-reset-token`, `/api/auth/forgot-password`, or `/api/auth/reset-password`. |
| Frontend | `reset-password/page.tsx` posts `{ token }` only (correct per `ValidateResetTokenRequest`). Interceptor adds `X-Tenant-ID` only if auth-store has `tenantId` — email links are unauthenticated → header absent. |
| Backend contract | `ValidateResetToken` / `ResetPassword` are `[AllowAnonymous]` and look up user by `PasswordResetToken` alone — **no TenantId in DTO**. Tenant is on the user row after token match. |
| Security model | High-entropy token is the credential; requiring login-store tenant on email-open is incorrect (same class of bug previously fixed for `/activate` via `IsAnonymousActivationPath`). |
| Fix | `IsAnonymousPasswordResetPath` — mirror activation pattern; do **not** put `tenantId` in email URL |
| Affected layer | AuthService middleware |

### 3. Request-New-Link issue — confirmed (UX + latent API)

| Field | Value |
|-------|--------|
| Status | **Confirmed** — partially fixed |
| Handler | Plain `<Link href="/auth/forgot-password">` — **no API call** on click (by design) |
| Expected confusion | Click does not send email or show toast; it only navigates to self-service Forgot Password |
| Latent defect | Forgot Password posts `{ email, tenantId }` via `getApi()`, but middleware still required `X-Tenant-ID`. Auth-store often has no tenant on public pages. Page **swallows errors** and always shows success copy → silent non-delivery |
| Fix | Middleware allowlist for forgot-password + FE sends `X-Tenant-ID` from selected hospital on submit |
| Affected layer | Middleware + forgot-password page header |

---

## Forgot Password vs Admin Reset Password (comparison)

| Concern | Forgot Password | Admin Reset Password |
|---------|-----------------|----------------------|
| Entry | `POST /api/auth/forgot-password` body `{ email, tenantId }` | `POST /api/users/{id}/reset-password` + `user.manage` + admin tenant |
| Token gen | 32-byte RNG, URL-safe | Same algorithm |
| Storage | `user.PasswordResetToken` + `ResetTokenExpiresAt` (1h) | Same + `password_reset_requests` row (hashed, audit) |
| Hash table | Not written by ForgotPassword today | SHA-256 hex → `reset_token_hash` |
| Reset URL | `Request.Scheme://Request.Host/auth/reset-password?token=…` | `Frontend:BaseUrl/auth/reset-password?token=…` |
| Email | Same NotificationClient → NotificationService | Same |
| Validate | `POST /api/auth/validate-reset-token` `{ token }` | Same page/API |
| Complete | `POST /api/auth/reset-password` `{ token, newPassword, confirmPassword }` — clears token | Same |
| Used-token | Cleared on user; audit `password_reset_requests.status` not updated by AuthController today | Same completion path |

---

## Files Changed

| File | Change |
|------|--------|
| `microservices/auth-service/AuthService/Middleware/TenantResolutionMiddleware.cs` | `IsAnonymousPasswordResetPath` for forgot / validate / reset |
| `microservices/auth-service/AuthService.Tests/PasswordResetTenantMiddlewareContractTests.cs` | New contract tests |
| `apps/hospital-portal-web/src/app/auth/forgot-password/page.tsx` | Send `X-Tenant-ID` from selected hospital |
| `apps/hospital-portal-web/src/lib/auth-interceptors.ts` | Skip session-expired logout for validate-reset-token |
| `apps/hospital-portal-web/src/lib/auth-interceptors.login-401.test.ts` | Assert validate/reset skip paths |
| `docs/audits/authentication-admin-reset-link-tenant-diagnosis.md` | This report |

**Not changed:** NotificationClient transport · login · Counsellor ownership · Phase 3I · password hashing · Admin Reset URL construction (still token-only).

## API Contract Changes

None. Controllers already accept token-only validate/reset; ForgotPassword still requires `tenantId` in body.

## Database Changes

None.

## Security Impact

| Property | Status |
|----------|--------|
| Token secrecy | Preserved — raw token never returned from Admin API; not logged in NotificationClient success path |
| Expiry | Preserved — 1h `ResetTokenExpiresAt` check remains |
| Used-token | Preserved — token cleared after successful reset |
| Tenant isolation | Preserved — Admin initiate still tenant-scoped; ForgotPassword still requires body `TenantId`; validate/reset derive user (and thus tenant) from opaque token match |
| Authz on Admin Reset | Preserved — `[Authorize]` + `user.manage` unchanged |

## Tests

| Suite | Result |
|-------|--------|
| `PasswordResetTenantMiddlewareContractTests` + `AdminResetPasswordContractTests` + `ActivationTenantMiddlewareContractTests` | **Passed 32/32** |
| `auth-interceptors.login-401.test.ts` | **Passed 4/4** |

## Manual UAT matrix

| ID | Steps | Expected |
|----|-------|----------|
| UAT-R01 | Admin → User Management → Reset Password → Send Email (**fresh**; discard smoke-test mail) | Success; new email |
| UAT-R02 | Inspect fresh email URL | `/auth/reset-password?token=<opaque>` — **not** `live-verify-dummy…` |
| UAT-R03 | Open reset link (incognito / logged-out) | No “Tenant ID is required” |
| UAT-R04 | Network: `POST …/validate-reset-token` | 200 `{ valid: true, email }` without requiring login tenant |
| UAT-R05 | Reset form | Shown for email account |
| UAT-R06 | Set strong new password | Success |
| UAT-R07 | Confirmation | Success message → redirect login |
| UAT-R08 | Login India Eye + branch | Success with new password |
| UAT-R09 | Invalid page → Request New Reset Link | Navigates to Forgot Password; select hospital + email → confirmation; email if account exists |
| UAT-R10 | Open dummy or expired token | Invalid/expired — not tenant middleware error |
| UAT-R11 | Counsellor branch/role | Unchanged |
| UAT-R12 | Counsellor ownership / waiting list | Unchanged |

## Gate

```
STOP FOR MANUAL UAT
```

Do **not** mark UAT passed automatically. Do **not** start Phase 3I Slice 10. Do **not** modify Counsellor ownership.

**Important:** Ignore the smoke-test email containing `live-verify-dummy-not-a-real-token`. Notification transport UAT already passed. Generate a **fresh** Admin → Send Email and use that link for UAT-R01+.
