# AUTHENTICATION UAT-03 — Targeted Login Failure Diagnosis

**Gate:** DIAGNOSIS COMPLETE — NO AUTH CODE CHANGE IN THIS SLICE  
**Date:** 2026-09-18  
**Scope:** Newly activated Counsellor (Banjara Hills) cannot complete login after selecting India Eye Hospital Network.  
**Constraints honored:** No branch-authorization change; BranchId not made a login requirement; no Counsellor ownership / Assign / Reassign / Requeue; Slice 10 not started; no password/JWT/secrets reported.

---

## Executive verdict

The login flow fails at **backend password validation** on `POST /api/auth/login` (**HTTP 401**, audit reason **`Invalid password`**).

It does **not** fail at:

- Network Hospital / tenant selection (when India Eye is selected)
- User lookup (tenant + normalized email) — after prior fix
- Account status / activation status (both `active`)
- MFA challenge (`users.two_factor_enabled = false`)
- Token issuance / ProtectedRoute / branch-context (never reached — no successful auth)

**Code changes are not required** for login eligibility architecture. Remaining UAT-03 is a **credential mismatch** against the Identity `password_hash` set during activation, plus possible confusion between activation OTP and the password chosen in the activate wizard.

---

## 1. Exact reproduction path

```
/auth/login
  → Network Hospital = India Eye Hospital Network (tenantId 155fe198-6ae5-4a01-9254-ead5b427247e)
  → email = swamidassaluri@gmail.com (any casing)
  → password = <activation / chosen password>
  → Authorize & Sign In
  → POST http://localhost:5073/api/auth/login
       body: { email, password, tenantId }   // no branchId
  → HTTP 401 { message: "Invalid credentials" }
  → FE catch → AuthAlert with backend message
  → no setAuth, no /dashboard, no ProtectedRoute session
```

Confirmed FE wiring:

| Step | Location | Behavior |
|------|----------|----------|
| Submit | `apps/hospital-portal-web/src/app/auth/login/page.tsx` | `authApi.login(email, password, tenantId)` — raw email, no branch |
| Client | `apps/hospital-portal-web/src/lib/api.ts` | `POST /auth/login`; `.env.local` → `http://localhost:5073/api` |
| Interceptor | `auth-interceptors.ts` | Login 401 **skipped** for session-expired logout |
| Backend | `AuthController.Login` | Tenant → `LoginIdentityLookup` → lockout → `CheckPasswordAsync` → status → MFA → tokens |

---

## 2. Login HTTP status

| Probe (safe wrong password) | Tenant | Email casing | HTTP |
|-----------------------------|--------|--------------|------|
| Live diagnostic 2026-09-18 18:09 UTC | India Eye | lower | **401** |
| Live diagnostic 2026-09-18 18:09 UTC | India Eye | mixed | **401** |
| Live diagnostic 2026-09-18 18:09 UTC | Wrong (`11111111-…`) | lower | **401** |

Auth service under test: PID 25376, port **5073**, started 2026-09-18 ~23:14 local (includes `LoginIdentityLookup`).

---

## 3. Safe response message / code

| Condition | HTTP body (safe) | `failed_login_attempt.reason` |
|-----------|------------------|-------------------------------|
| Correct tenant + email, wrong password | `{ "message": "Invalid credentials" }` | **`Invalid password`** |
| Wrong tenant | `{ "message": "Invalid credentials" }` | **`User not found`** |
| Locked account | `{ "message": "Account is locked. Please try again later." }` | *(no row — lock checked before password)* |

UI may still show a prior **session-expired** string only if `sessionStorage.auth_expired_message` was set by an older interceptor build. Current code does **not** call `logoutEverywhere('session-expired')` for `/auth/login` 401s.

---

## 4. Tenant resolution result

| Check | Result |
|-------|--------|
| Selected login Network Hospital | India Eye Hospital Network |
| Request `tenantId` | `155fe198-6ae5-4a01-9254-ead5b427247e` |
| DB `users.tenant_id` | Same GUID |
| Tenant status | Active (login proceeds past tenant check) |
| Mismatch? | **None** when India Eye is selected |

Wrong-tenant probes correctly yield **User not found** (expected isolation).

---

## 5. User lookup result

| Attribute | Affected Counsellor | Working reference |
|-----------|---------------------|-------------------|
| User ID | `5599402a-e240-4845-9f1e-da2969068376` | `c0d35b44-a3fb-4e72-a9f9-c45491b4090e` |
| Email | `swamidassaluri@gmail.com` | `counsellor2@hospital.com` |
| `normalized_email` | `SWAMIDASSALURI@GMAIL.COM` | `COUNSELLOR2@HOSPITAL.COM` |
| Tenant | India Eye Hospital Network | Same |
| Branch (`users.BranchId`) | Hyderabad Eye Clinic - Banjara Hills | Downtown Hospital |
| `user_branches` | Active default Banjara | Active default Downtown |
| Role | Counsellor (active) | Counsellor (active) |
| Lookup path | `LoginIdentityLookup` → `TenantId` + `NormalizedEmail` | Same |

**Evidence user is found:** India Eye + mixed-case email + wrong password → audit reason **`Invalid password`** (not User not found).

Historical pre-fix rows (same day, earlier) still show **User not found** for mixed/all-caps email — explained by pre-`LoginIdentityLookup` behavior. Post-fix + current process: case-insensitive lookup works.

---

## 6. Password validation result

| Check | Result |
|-------|--------|
| `password_hash` present | Yes (Identity V3 prefix `AQAAAAI`, length 84 — same shape as working counsellor) |
| `LastPasswordChangeAt` | `2026-09-18 17:12:40 UTC` (during activation wizard) |
| `CheckPasswordAsync` with deliberate wrong password | Fail → 401 + **Invalid password** |
| Successful login ever recorded | **`LastLoginAt` = NULL** |
| UAT-era failures after Network Hospital / email fixes | Still **Invalid password** (e.g. 17:45 UTC) |

Backend step mapping:

| Step | Outcome for this user (India Eye + real email) |
|------|------------------------------------------------|
| A. Find tenant | Pass |
| B. Find user | Pass |
| C. Validate password | **Fail** ← failure point |
| D. Account status | Would pass (`active` / `active`) if C passed |
| E. Create auth result | Never reached |

Login does **not** consult `one_time_password_hash` (empty for this user). Activation OTP lived in `otp_activations` (verified) and is **not** the login password.

---

## 7. Account status result

| Field | Value |
|-------|-------|
| `UserStatus` | `active` |
| `activation_status` | `active` |
| `email_confirmed` | true |
| Lockout (pre-diagnostic probes) | not locked; `access_failed_count` was 3 |
| Lockout (after diagnostic wrong-password probes) | temporarily locked at count 5 |
| Lockout (after diagnostic cleanup) | **cleared** — `access_failed_count = 0`, not locked |

Activation trail (safe):

| Time (UTC) | Event |
|------------|-------|
| 17:11:35 | OTP created (`otp_activations`, email, purpose `user_activation`) |
| 17:12:17 | OTP verified |
| 17:12:40 | Password set (`LastPasswordChangeAt`) via activation path |
| 17:12:45 | Terms + HIPAA accepted (`activation_audit_log`) |
| — | MFA enrolled in `user_mfa_settings` (`is_mfa_enabled` / `totp_enabled` true) |

Note: `activation_audit_log` only recorded terms/HIPAA for this user (no `password_set` / `complete-activation` rows) — **audit coverage gap**, not the login failure.

---

## 8. MFA result

| Source | Affected | Working counsellor | Login gate? |
|--------|----------|--------------------|-------------|
| `users.two_factor_enabled` | **false** | false | **Yes — only this gates MFA on password login** |
| `user_mfa_settings` enrolled | true (totp) | true (totp) | No (existing split) |

**Expected:** password success would return tokens **without** `requiresMfa`. MFA is **not** blocking this user under current implementation. Do not sync `two_factor_enabled` without a product decision (out of scope).

---

## 9. Token / auth-state result

| Check | Result |
|-------|--------|
| Tokens issued | **No** (401 before JWT/refresh) |
| `setAuth` / localStorage auth | Not reached on failed login |
| Login page mount | Clears `localStorage` + Zustand logout (expected) |

---

## 10. ProtectedRoute / interceptor result

| Component | Result for this failure |
|-----------|-------------------------|
| Auth response interceptor | Login path in `AUTH_SESSION_LOGOUT_SKIP_PATHS` → **no** `logoutEverywhere('session-expired')` |
| `ProtectedRoute` | Never entered with a new token |
| False “session expired” on login 401 | **Fixed in tree**; if UAT still sees it, confirm FE rebuild includes interceptor change |
| Login catch | Surfaces `response.data.message` (`Invalid credentials`) when interceptor does not rewrite |

`getApiErrorMessage()` still maps any 401 to a session-expired string, but **login page does not use that helper**.

---

## 11. Branch-context result

| Check | Result |
|-------|--------|
| Branch in login body | **Not sent** (correct) |
| Branch as eligibility check | **Not used** (`AuthController` + `LoginIdentityLookup`) |
| User branch mapping | Banjara Hills default `user_branches` row present |
| Post-login branch init | **Not reached** (auth never succeeds) |

UAT-04 (post-login branch = Banjara) remains blocked until password login succeeds.

---

## 12. Exact root cause

**Primary (UAT-03 remaining defect):**

> After Network Hospital + normalized-email fixes, `POST /api/auth/login` finds the Counsellor under India Eye Hospital Network, then **`UserManager.CheckPasswordAsync` rejects the submitted password**. Audit reason = **`Invalid password`**. No tokens are issued. The user has **never** completed a successful login (`LastLoginAt` null).

**Not the root cause:**

- Wrong Network Hospital label / Banjara shown as Network Hospital (UAT-01/02 area — confirmed corrected)
- Branch membership gating login
- Tenant DB mismatch (when India Eye selected)
- Inactive / pending activation
- MFA challenge (`two_factor_enabled = false`)
- Post-login ProtectedRoute bounce (no token issued)
- Case-sensitive email lookup (fixed; live mixed-case → Invalid password)

**Likely operational explanation (highest probability):**

The password entered on `/auth/login` is **not** the password chosen in `/activate` → `set-activation-password`. Common confusion: email **activation OTP** / admin-generated credential vs wizard-chosen password. Login validates **only** Identity `password_hash`.

**Secondary (diagnostic side-effect, remediated):**

Wrong-password API probes during this diagnosis incremented `access_failed_count` to 5 and locked the account. Lockout was **cleared** after diagnosis (`access_failed_count = 0`, `lockout_end` null) so UAT is not blocked by the probe lock.

---

## 13. Recommended smallest fix

**No authentication code change** for this root cause.

Operational / UAT steps (smallest safe path):

1. Confirm FE build includes prior interceptor + Network Hospital label + backend `LoginIdentityLookup`.
2. On `/auth/login`: Network Hospital = **India Eye Hospital Network**; email = affected address; password = **exactly the password set in the activation wizard** (not the email OTP).
3. If password unknown: Admin **Reset Password** / re-activation password set (existing `user.manage` / activation flows) — do not invent a special login bypass.
4. After success, verify UAT-04 branch context = Banjara Hills (separate check).

Optional (product, not required for UAT-03 eligibility):

- Clearer login copy: “Use the password you created during activation (not the email code).”
- Complete missing activation audit steps for `password_set` / `complete-activation`.

---

## 14. Whether code changes are actually required

| Area | Required now? |
|------|----------------|
| Login lookup / tenant / branch eligibility | **No** |
| MFA enforcement sync | **No** (pre-existing split; out of scope) |
| Interceptor session-expired on login 401 | Already fixed; verify deploy only |
| Password / Identity hashing | **No evidence of broken hasher** (hash present; wrong password correctly rejected) |
| Data mutation for diagnosis | Lockout cleared only (probe side-effect); password **not** changed |

**Implementation gate:** STOP — diagnosis only. Do not start Slice 10. Do not claim UAT-03 passed until a human completes login with the correct activation password (or admin reset) and reaches dashboard.

---

## Appendix A — Failure timeline (safe)

| attempted_at (UTC) | email submitted | tenant | reason |
|--------------------|-----------------|--------|--------|
| 18:09:38 | lower | wrong tenant | User not found *(diagnostic)* |
| 18:09:37 | mixed / lower | India Eye | Invalid password *(diagnostic)* |
| 17:45:17 | mixed | India Eye | Invalid password *(post email-fix UAT/probe)* |
| 17:37:xx | various | India Eye / wrong | User not found *(pre-normalized lookup / wrong tenant)* |
| earlier same day | lower | India Eye | User not found *(pre-fix)* |

---

## Appendix B — Flow classification

```
FAIL POINT:  C — password validation
HTTP:        401
SO MESSAGE:  Invalid credentials
AUDIT:       Invalid password
NEXT STEPS:  operational password confirmation / admin reset
CODE FIX:    not indicated for this root cause
```
