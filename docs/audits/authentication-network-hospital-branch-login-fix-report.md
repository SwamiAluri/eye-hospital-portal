# Authentication — Network Hospital / Branch Login Fix

**Gate:** IMPLEMENTATION COMPLETE — STOP FOR MANUAL UAT  
**Date:** 2026-09-18  
**Scope:** Authentication / tenant (Network Hospital) / branch mapping — independent of Phase 3I Counsellor ownership.

---

## 1. Problem

Newly created and activated Counsellor associated with **Hyderabad Eye Clinic - Banjara Hills** could not sign in. Login showed **HOSPITAL** with network-level options (e.g. India Eye Hospital Network), while Admin User Management showed the operational branch. The UI also showed **“Your session has expired. Please sign in again.”** during failed sign-in attempts.

---

## 2. Root Cause

Three concrete defects (traced end-to-end; not a branch-as-login-gate issue):

1. **False “session expired” on login 401 (primary UX blocker)**  
   `POST /api/auth/login` failures return **401**. The shared Axios auth response interceptor treated **any** 401 (including login credential/tenant failures) as a session expiry: attempted refresh → `logoutEverywhere('session-expired')` → login page displayed the expired-session message instead of the real auth error.

2. **Misleading selector label**  
   Login dropdown is populated from `GET /api/tenants/debug/codes/db` and posts `tenantId`. It represents **Tenant / Network Hospital**, not Branch. Label **Hospital** invited confusion with operational branches such as Banjara Hills and with other network names (e.g. Apollo Hospitals).

3. **Case-sensitive email lookup**  
   Login used `u.Email == request.Email`. Mixed-case email against the same Network Hospital logged **User not found**. Live `failed_login_attempt` rows for the affected user showed repeated **User not found** (wrong tenant and/or case) and **Invalid password** when email+tenant matched.

**Not the cause:** Branch membership is not a login eligibility check. The affected user’s tenant/branch mapping under India Eye is consistent.

---

## 3. Network Hospital vs Branch Model

```
Tenant (table: tenant)  ← login “Network Hospital”
        ↓
Branch (table: branch)  ← Admin “Branch” / post-login context
        ↓
User (table: users) + UserBranch (table: user_branches)
        ↓
Counsellor (role via app_user_roles)
```

Login request: `{ email, password, tenantId }` — **no branchId**.

---

## 4. User Mapping (safe metadata only)

Affected Counsellor (Banjara Hills):

| Attribute | Value |
|-----------|--------|
| User ID | `5599402a-e240-4845-9f1e-da2969068376` |
| Email | `swamidassaluri@gmail.com` |
| Tenant | India Eye Hospital Network (`155fe198-6ae5-4a01-9254-ead5b427247e`) |
| Branch | Hyderabad Eye Clinic - Banjara Hills (`9b2f6670-845c-4603-b75d-b10b776ad22d`) |
| user_branches | Active default row for Banjara |
| Role | Counsellor (active) |
| UserStatus / Activation | `active` / `active` |
| Email confirmed | true |
| Lockout | not locked |
| Password set | yes |
| MFA (`user_mfa_settings`) | enrolled |
| `users.two_factor_enabled` | false (unchanged — MFA enforcement not altered this slice) |

Working same-tenant counsellor reference: `counsellor2@hospital.com` (Downtown) — active, last login recorded.

---

## 5. Backend Changes

- Added `LoginIdentityLookup` — tenant + **NormalizedEmail** lookup; branch never consulted for eligibility.
- `AuthController.Login` (demo + real paths) uses async normalized email lookup.

---

## 6. Frontend Changes

- Login + forgot-password labels: **Network Hospital** (shared `AUTH_NETWORK_HOSPITAL_FIELD`).
- Auth interceptor: skip session-expired logout for public `/auth/login`, `/auth/mfa`, etc.
- `ProtectedRoute`: only show “Session Expired” when `auth_token` was present (not merely `user`).

---

## 7. API Contract Changes

None. Login body remains `{ email, password, tenantId }`.

---

## 8. Database Changes

No database changes.

---

## 9. Security Impact

- Tenant isolation preserved (wrong Network Hospital still rejects).
- Branch authorization unchanged (post-login / domain APIs).
- Password, lockout, inactive, pending activation checks unchanged.
- MFA enforcement behavior **not** changed in this fix (TwoFactorEnabled sync out of scope).
- No credential bypass, no special-case emails, no client branch trust for login.

---

## 10. Tests

### Frontend (Vitest)

```text
npx vitest run src/lib/auth-interceptors.login-401.test.ts src/components/auth/network-hospital-login.test.ts src/components/auth/useAuthTenants.test.ts
```

| Result | Count |
|--------|-------|
| Passed | 10 |
| Failed | 0 |
| Skipped | 0 |

### Backend (.NET)

```text
dotnet test microservices/auth-service/AuthService.Tests/AuthService.Tests.csproj --filter "FullyQualifiedName~LoginTenantEmailLookupTests|FullyQualifiedName~Phase3ISlice9ContractTests" -p:UseAppHost=false
```

| Result | Count |
|--------|-------|
| Passed | 8 |
| Failed | 0 |
| Skipped | 0 |

### Live probe (post-fix, no secrets)

Mixed-case email + India Eye + wrong password → **401** with reason **Invalid password** (user found). Previously: **User not found**.

---

## 11. Manual UAT

| ID | Case | Status |
|----|------|--------|
| UAT-01 | NETWORK HOSPITAL label on `/auth/login` | Pending manual |
| UAT-02 | Banjara Hills not in Network Hospital options | Pending manual |
| UAT-03 | New Counsellor login with India Eye + activation password | Pending manual |
| UAT-04 | Post-login branch context = Banjara Hills | Pending manual |
| UAT-05 | Admin users Branch column = Banjara Hills | Pending manual |
| UAT-06 | Same network, other branch user still works | Pending manual |
| UAT-07 | Wrong Network Hospital rejected | Pending manual |
| UAT-08 | Invalid password → normal auth failure (not session expired) | Pending manual |
| UAT-09 | Inactive user rejected | Pending manual |
| UAT-10 | Existing Counsellor still signs in | Pending manual |
| UAT-11 | Ownership / Waiting List unchanged | Pending manual |
| UAT-12 | Credential/tenant failure does not show false session expired | Pending manual |

---

## 12. Known Limitations

- `users.two_factor_enabled` remains false while `user_mfa_settings` may show MFA enrolled (pre-existing; not changed here).
- Admin Manage Branches still does not sync `users.BranchId` (pre-existing; not changed).
- Duplicate tenant codes (e.g. two APOLLO tenants) remain in the Network Hospital list (data/catalog issue).

---

## 13. Out of Scope

- Counsellor ownership (`CounselingSession.CounselorId`)
- Assign / Reassign / ReQueue
- Slice 10
- Analytics / Follow-up ownership
- New branch-level login architecture
- MFA TwoFactorEnabled sync / enforcement change

---

## 14. Gate

**IMPLEMENTATION COMPLETE — STOP FOR MANUAL UAT**

Do not mark accepted until UAT-01 through UAT-12 pass.
