# L-PORTAL-01 — Bounded Implementation Plan and Security Review  
# First vertical slice (planning only)

**Date:** 2026-10-14 (revised S0 plan review; S1 runtime authorized and implemented)  
**Mode:** S1 RUNTIME IMPLEMENTED — awaiting review; **do not start S2** without explicit authorization  
**PO plan review:** Revised plan (including S0 C1–C7) **explicitly approved** for **S1 only**  
**Authoritative inputs:**  
- [Product Decision Closure](./enterprise-lms-patient-portal-identity-product-decision-closure.md) (`PRODUCT_DECISIONS_CLOSED_L_PORTAL_01`)  
- [Implementation readiness](./enterprise-lms-patient-portal-identity-implementation-readiness.md) (audit contract `RATIFIED_APPROVE_WITH_EDITS`)  
- [Prerequisite specification](./enterprise-lms-patient-portal-identity-prerequisite-specification.md)  
- [Decision package](./enterprise-lms-patient-portal-identity-decision-package.md) / [decision form](./enterprise-lms-patient-portal-identity-product-owner-decision-form.md)  
- L-REP-04 closure/readiness (PD-PP-01…12 preserved; L-REP-04 **not** authorized)

```text
PRODUCT_DECISIONS_CLOSED_L_PORTAL_01 = PRESERVED
L_PORTAL_01_IMPLEMENTATION_AUTHORIZATION = GRANTED
AUDIT_EVENT_CONTRACT = RATIFIED_APPROVE_WITH_EDITS
PORTAL_AUTH_LOGIN_SUCCESS_FAILURE_AUDIT = BEST_EFFORT
RUNTIME_IMPLEMENTATION = S1_IMPLEMENTED_AWAITING_REVIEW
BLOCKER-PP-IDENTITY-01 = OPEN
L_REP_04_IMPLEMENTATION = NOT_AUTHORIZED
PD-PP-01…12 = PRESERVED
ACCEPTED_L_REP_03_CUT_C = PRESERVED
ACCEPTED_L_REP_03_CUT_D = PRESERVED
LEGACY_PATHOLOGY = UNCHANGED
BOUNDED_IMPLEMENTATION_PLAN = APPROVED_FOR_S1
NEXT_GATE = S1_REVIEW_AND_EXPLICIT_AUTHORIZATION_FOR_S2
```

---

## 0a. S1 implementation record (2026-10-14)

| Item | Status |
| --- | --- |
| Schema: `portal_invitations`, `portal_patient_links`, `portal_remediation_requests` | Implemented (AuthService entities + EF config + SQL migration) |
| Filtered unique indexes (active verified patient / principal) | In model + migration SQL (PostgreSQL) |
| `IPortalPatientResolveService` fail-closed resolve | Implemented (domain service; **no** public Portal HTTP/JWT yet) |
| Mandatory `portal.resolve.denied` via `StageAsync` + `SaveChanges` | Implemented; audit failure ⇒ still deny |
| Automated tests | `PortalPatientResolveServiceTests` + optional Postgres uniqueness tests |
| S2+ (invite lifecycle, Portal JWT, verify, FE, permissions) | **Not** implemented |

**Limitation (documented):** Successful resolve is a **domain foundation** only. It is not production Portal-ready until S3 auth cutover and later slices. Migration is **not** auto-applied to shared/staging/production.

### S1 manual UAT evidence (2026-10-14) — not formal acceptance

Executed against Development/UAT Postgres (`hospitalportal` on Azure non-prod host from AuthService Development settings) via `PortalIdentityS1ManualUatLiveDbTests` + local smoke:

| Check | Result |
| --- | --- |
| Apply S1 DDL; confirm tables/indexes | **PASS** — tables + filtered unique indexes present |
| Unverified + revoked + one verified → resolve | **PASS** |
| Second active verified (patient / principal) → unique violation | **PASS** |
| Deceased / cross-tenant / missing → deny + `portal.resolve.denied` | **PASS** |
| Staff login regression smoke | **PASS** — `POST http://localhost:5073/api/auth/login` success + token |
| Pathology `/dashboard/laboratory` smoke | **PASS** — page loads “Laboratory (Pathology)” / worklist UI |

Disposable UAT rows cleaned up by test teardown. Does **not** close `BLOCKER-PP-IDENTITY-01` or authorize S2/L-REP-04.

### S1-R1 EF tooling reconciliation (2026-10-14)

| Item | Result |
| --- | --- |
| Root cause | Hand-written S1 SQL migration without Designer / snapshot portal metadata |
| Remediation | Surgical add of Portal* entities to `AppDbContextModelSnapshot`; Designer generated from reconciled snapshot; **no** second DDL migration; unrelated WIP **not** folded into snapshot |
| Filtered unique predicates preserved | `verification_status = 'verified' AND revoked_at IS NULL` (patient + principal indexes) |
| `has-pending-model-changes` | Still exits **1** due to **unrelated** AppDbContext WIP (expected); S1 portal objects no longer omitted from snapshot |
| Formal acceptance | **Not** claimed — awaiting PO review of S1-R1 |

---

## 0. S0 plan-review change record (APPROVE WITH EDITS)

| # | Correction | Rationale | Evidence | Changes closed decision? |
| --- | --- | --- | --- | --- |
| C1 | Clarify **both** 1:1 active-verified directions + historical row model + DB/TX enforcement + corruption fail-closed | Prior plan implied uniqueness but did not state PD-ID-06 dual invariant or corruption behavior | PD-ID-06 `APPROVED_DIRECTION`; `AppDbContext` filtered unique index pattern | **No** — documents approved PD-ID-06 |
| C2 | Principal/endpoint isolation beyond audience alone; login `UserType` gates; dual JWT schemes | Single `JwtBearer` + one `ValidAudience`; staff `Login` does not filter `UserType`; `PermissionAuthorizationHandler` DB fallback | `Program.cs` JWT; `JwtService.GenerateToken`; `AuthController.Login`; `PermissionAuthorizationHandler` | **No** — implements PD-ID-08 |
| C3 | Concrete TX/concurrency/audit failure paths | Prior sketch lacked concurrent supersede/verify and resolve-deny audit sequencing | `AuditService.StageAsync` docs/behavior; financial fail-closed pattern | **No** — preserves ratified audit contract |
| C4 | Distinct invite accept vs verify lifecycle; accept never verifies | Silent verify risk at accept | PD-ID-04 catalogue; PD-ID-03 invite | **No** |
| C5 | Consistent external HTTP failure contract (enumeration-safe) | Prior AT mixed 401/403 without middleware evidence | ASP.NET JwtBearer challenge/forbid; AuthService Unauthorized vs Forbid patterns | **No** — engineering contract under approved security goals |
| C6 | Session invalidation: no access-token blacklist; refresh revoke + resolve re-check | Cannot claim immediate JWT kill without infra | `JwtService` (no jti blacklist); `SessionManagementService` can deactivate sessions; short JWT expiry | **No** |
| C7 | Smallest safe delivery = policy-enabled **staff-delivered single-use token** first; email/SMS as later wiring | Soft dependency must not become silent policy | PD-ID-03-D2 explicitly allows staff-delivered | **No** — uses approved channel option |

**Unresolved after this revision:** none that reopen product decisions. Remaining open items are engineering/ops dependencies (permission seed/grant auths; verification field/content; NotificationService portal wiring) — see §9.

---

## 1. Executive recommendation and exact scope

### Recommendation

Approve this **revised** plan as the first AuthService-owned vertical slice of L-PORTAL-01, then authorize runtime coding in independently reviewable sub-slices (S0→S5). Do **not** treat plan approval as L-REP-04 authorization or as closure of `BLOCKER-PP-IDENTITY-01`.

### Exact in-scope slice (first vertical)

| # | Capability |
| --- | --- |
| 1 | Patient-link persistence + staff-initiated invitation lifecycle |
| 2 | Invitation create / expiry / supersede (invalidate prior unused) |
| 3 | Patient authentication principal **distinct** from staff |
| 4 | Server-side resolve of exactly one **active verified** link → `PatientId` |
| 5 | Tenant-scoped ops + fail-closed defective/deceased linkage |
| 6 | Mandatory transactional audit for protected mutations + denied resolve |
| 7 | Best-effort Portal login success/failure audit |
| 8 | Hospital policy config + server enforcement (delivery, verification methods, expiry 1–72h default 24h, retention 2,555 days) |
| 9 | Replace mock Portal login / hardcoded `PAT-001` **only when** real backend is usable |
| 10 | Automated security-negative tests + Manual UAT prerequisites + acceptance criteria |

### Explicit out of scope

L-REP-04 publish/withdraw/patient PDF; proxy/guardian; self-registration; Pathology / `/dashboard/laboratory`; CUT C/D; silent role grants; NotificationHub as identity SoT; full Portal rewrite; LMS `InternalAuditController` allowlist expansion for AuthService-owned writes.

---

## 2. Verified repository findings

| Topic | Path / type | Current behavior | Evidence class | Plan reuse |
| --- | --- | --- | --- | --- |
| Staff JWT issuance | `AuthService/Services/JwtService.cs` `GenerateToken` | Claims: `sub`/`user_id`, email, name, `TenantId`, **roles**, **permission**; audience `Jwt:Audience`; **no** `patientId` / `principal_kind` | **Verified** | Pattern for signing; **must not** reuse as patient credential |
| JWT validation | `AuthService/Program.cs` (~653–675) | **Single** `JwtBearer` scheme; `ValidateIssuer/Audience/Lifetime/SigningKey`; **one** `ValidAudience` = `Jwt:Audience` | **Verified** | Audience alone is **not** enough if Portal shares this audience — see §3.3 |
| Staff login | `AuthController.Login` | Password + tenant lookup; loads roles/permissions; issues staff JWT; **no** `UserType` gate | **Verified** | Staff path unchanged for staff users; **must reject** `UserType=Patient` when Portal principals exist |
| Refresh sessions | `PersistRefreshTokenSessionAsync` → `SessionManagementService` | Refresh in `user_sessions`; `IsActive=false` can revoke refresh; **access JWT not blacklisted** | **Verified** | Revoke refresh on link invalidation; resolve re-checks link |
| AppUser | `Models/Identity/AppUser.cs` | `UserType` default Staff (comment: Staff/Patient/Admin); **no** `PatientId` | **Verified** | Candidate principal store; link via separate table |
| Permission authz | `PermissionAuthorizationHandler` | Succeeds on JWT `permission` claims **or** DB `HasPermissionAsync` | **Verified** | Patient principals must have **no** staff roles/grants; staff endpoints also reject wrong scheme/`principal_kind` |
| MPI Patient | `Models/Domain/Patient.cs` | `Id`, `TenantId`, `DeceasedDate`, demographics | **Verified** | Authoritative patient SoT |
| Linkage | — | **Absent** | **Verified** | New AuthService tables |
| Filtered unique indexes | `AppDbContext` (e.g. soft-delete / effective_to filters) | EF `.IsUnique().HasFilter(...)` used elsewhere | **Verified** | Pattern for active-verified uniqueness |
| StageAsync | `AuditService.StageAsync` | Stages on DbContext **without** save; caller `SaveChanges` commits atomically; sets retention 2555 | **Verified** | Mandatory mutation path; portal retention policy remains explicit 2,555 days |
| LogAsync | `AuditService.LogAsync` | Stage + immediate SaveChanges | **Verified** | Candidate for **best-effort** login audits (try/catch) |
| LMS Internal audit | `InternalAuditController` | Allowlisted LMS actions only | **Verified** | **Do not expand** for AuthService portal writes |
| Permissions | `SeedData/PermissionSeeder.cs` | No portal invite/remediate codes | **Verified** | Seed definitions only after separate auth |
| RequirePermission | `Authorization/RequirePermissionAttribute.cs` | Policy `Permission:{code}` | **Verified** | Staff invite/remediate APIs |
| Staff activation | `UsersController` `send-activation` (`user.manage`) | Staff OTP email/SMS | **Verified** | Delivery **pattern only** — not portal invite |
| Token expiry pattern | `PatientUploadLink` | Single-use + `ExpiresAt`/`UsedAt` | **Verified** | Analog for invite hashing — **not** portal identity |
| Portal FE login | `app/patient/login/page.tsx` | Mock accept-any | **Verified** | Replace after API exists |
| Portal layout | `app/patient/layout.tsx` | Hardcoded `PAT-001` | **Verified** | Replace with server-resolved identity |
| FE API client | `lib/api/patient-portal.api.ts` | Declares `/portal/auth/*` — **no BE** | **Verified** | Orphan — redesign to AuthService routes |
| Portal identity tests | AuthService.Tests | **Absent** | **Verified** | New suites required |
| HTTP authz patterns | AuthService.Tests (e.g. counseling forbid helpers) | Missing/invalid auth often `Unauthorized*`; permission/branch denial often **403 Forbid** | **Verified** | Informs §3.6 contract |

**Assumptions (not verified as existing Portal capability):** orphaned FE client, mock login, staff OTP, and `user.manage` are **not** patient-identity capabilities.

---

## 3. Proposed component / API / data boundaries (design only)

### 3.1 Ownership

| Concern | Owner |
| --- | --- |
| Portal principal, invitation, link, resolve, remediation | **AuthService** |
| MPI Patient record | AuthService (existing) |
| Future LMS patient content | LaboratoryApi **consumes** resolved PatientId later (L-REP-04 — out of slice) |

### 3.2 Patient-link cardinality and uniqueness (C1)

**Approved invariant (PD-ID-06) — both directions:**

1. **At most / exactly one for resolve success:** one **active verified** Portal principal per Patient (tenant-scoped).  
2. **At most / exactly one for resolve success:** one **active verified** Patient link per Portal principal (tenant-scoped).  

Resolve succeeds **only** when the authenticated Portal principal has **exactly one** row matching:  
`TenantId = principal.TenantId` ∧ `PrincipalUserId = sub` ∧ `VerificationStatus = verified` ∧ `RevokedAt IS NULL` ∧ patient living (`DeceasedDate` null) ∧ no conflicting/stale flags defined at implementation.

**Historical / non-active rows (allowed):**

| State | Representation | Counts toward “active verified”? |
| --- | --- | --- |
| Unverified / pending | Row with `VerificationStatus = unverified` | **No** |
| Revoked | `RevokedAt` set / status revoked | **No** |
| Superseded by remediation | Old row revoked; new row created | Old **No** |
| Stale / conflicting (ops) | Marked unverified or revoked via remediation | **No** after remediation |
| Expired pending invite association | Invite used/expired; link remains unverified until verify or revoke | **No** until verified |

Multiple historical revoked/unverified rows **may** exist; uniqueness applies only to the **active verified** predicate.

**DB enforcement (design):**

- Filtered unique index A: `(TenantId, PatientId)` WHERE `VerificationStatus = 'verified' AND RevokedAt IS NULL`  
- Filtered unique index B: `(TenantId, PrincipalUserId)` WHERE `VerificationStatus = 'verified' AND RevokedAt IS NULL`  
- App-layer transactional checks before insert/verify (read committed / serializable as needed).  
- Concurrent verify/invite: unique violation → fail closed (no second active verified).

**Corruption / legacy violation:** if resolve query returns **0 or >1** active verified links (or deceased / cross-tenant), **deny** resolve, emit `portal.resolve.denied` with internal reasonCode (`missing` / `ambiguous` / `deceased` / …), do **not** pick a “best” link. Remediation restores exactly one valid link.

**Unresolved cardinality?** None for product policy. Exact column names/status enums are engineering under this approved rule.

### 3.3 Principal and endpoint isolation (C2)

**Verified gap:** one JWT scheme + one audience; staff login issues role/permission claims and does not exclude `UserType=Patient`. Distinct audience alone is insufficient if Portal tokens share the staff scheme/audience or if a patient `AppUser` receives staff role grants (handler DB fallback).

**Recommended arrangement (defense in depth):**

| Layer | Control |
| --- | --- |
| Principal store | Separate `AppUser` row with `UserType = "Patient"`; **never** grant staff roles/permissions to that row |
| Staff login | Reject `UserType == Patient` (generic invalid credentials); continue issuing only via existing `GenerateToken` for staff/admin |
| Portal login | Accept only `UserType == Patient`; issue via **new** `GeneratePortalToken` — **no** role/permission claims; claims include `principal_kind=patient`, `TenantId`, `sub` |
| JWT schemes | Add second scheme e.g. `PortalJwtBearer` with `ValidAudience = Jwt:PortalAudience` (new config). Keep default scheme on `Jwt:Audience` for staff. Portal controllers: `[Authorize(AuthenticationSchemes = PortalJwtBearer)]`. Staff controllers remain on default scheme |
| Portal policies | Require authenticated Portal scheme **and** `principal_kind=patient` (claim or policy handler) |
| Staff policies | Default scheme; reject tokens with `principal_kind=patient` if they somehow authenticate; `RequirePermission` unchanged for staff |
| Resolve | After Portal auth, server loads links; **ignore** client `patientId` |

**Failure matrix:**

| Attempt | Expected external result |
| --- | --- |
| Staff JWT on Portal endpoint | **401** (scheme/audience validation fails) |
| Portal JWT on staff endpoint | **401** (wrong audience/scheme) |
| Valid Portal JWT, missing permission on staff API | N/A if scheme already rejects; if miswired, **403** |
| Valid Portal JWT, resolve denied (link) | **403** or **404** per §3.6 — **no** PatientId success |

**Staff sessions unchanged:** no change to staff token shape, audience, or `AuthController` success path for staff users.

### 3.4 Invitation acceptance vs verification boundary (C4)

| Operation | Effects | Resolve allowed? |
| --- | --- | --- |
| Staff create invite | Invitation `pending`; may create/associate **unverified** link; audit `portal.invite.created` (+ `portal.link.created_unverified` if link created) | **No** |
| Supersede | Prior unused invite → `superseded`; new invite; audit | **No** |
| **Accept invite** | Validate token hash/expiry/status; create/activate Patient principal credentials; bind/ensure **unverified** link; mark invite `used`; **must not** set verified | **No** |
| Portal login (post-accept) | Issue Portal JWT if credentials valid | Login OK; **resolve still No** until verified |
| **Verify** (staff + approved method) | Transition link unverified → verified; audit `portal.link.verified` | **Yes** (if exactly one active verified + living) |
| Revoke / mark unverified / correct | Dual-control where required; invalidate prior verified | **No** until new verified link |

**Hard rule:** invitation acceptance **never** silently establishes a verified patient link.

**Verification go-live block:** verify endpoint remains **blocked from go-live** until approved catalogue methods have operational field/content details (PD-ID-04 residual). Do not invent proofing methods; demographic-only matching forbidden.

### 3.5 API surface (proposed — not implemented)

| Method | Route (proposed) | Authz | Purpose |
| --- | --- | --- | --- |
| POST | `/api/portal/invitations` | Staff scheme + `portal.invite.create` | Create invite (+ optional unverified link) |
| POST | `/api/portal/invitations/{id}/supersede` | Staff + `portal.invite.create` | Replace; invalidate prior unused |
| POST | `/api/portal/auth/accept-invite` | anonymous + token | Credentials + unverified link only |
| POST | `/api/portal/auth/login` | anonymous | Issue **Portal** JWT |
| GET | `/api/portal/me/patient` | Portal scheme | Server resolve PatientId |
| POST | `/api/portal/links/{id}/verify` | Staff + method rules | Activate verified link (**go-live gated**) |
| POST | `/api/portal/links/{id}/revoke` | `portal.link.remediate` | Revoke |
| POST | `/api/portal/remediations` | `portal.link.remediate` | Request correction |
| POST | `/api/portal/remediations/{id}/approve` | `portal.link.remediate_approve` | Dual-control approve (≠ initiator) |

### 3.6 HTTP failure contract and information disclosure (C5)

**Recommended external contract** (enumeration-minimizing):

| Class | HTTP | Body guidance |
| --- | --- | --- |
| Missing/invalid/expired/malformed token | **401** | Generic unauthenticated |
| Wrong token class (staff↔Portal scheme/audience) | **401** | Same generic unauthenticated (do not say “staff token” / “patient token”) |
| Authenticated staff lacking permission | **403** | Generic forbidden |
| Authenticated Portal principal, resolve denied (any link reason) | **403** *or* **404** — **pick one for all resolve denials** and keep stable | Generic “not available”; **no** existence of patient/link/invite |
| Invite accept with bad token | **401** or **400** with **generic** invalid/expired message | Do not distinguish unknown vs used vs wrong tenant in client text |
| Validation (missing reason on remediation) | **400** | Field errors only — no PHI |

**Internal audit** may use specific `reasonCode` values under ratified minimization (`missing`/`unverified`/`ambiguous`/`deceased`/`revoked`/`staff_token`/…).

**Middleware evidence:** JwtBearer challenge → unauthenticated (**401**); `Forbid()` → **403**. Plan aligns AT matrix to this (§7).

**Recommendation for resolve denials:** use **403** with identical generic body for all deny reasons (including ambiguity/corruption), so clients cannot distinguish missing vs wrong patient. Document as engineering security choice under PD-ID-07 fail-closed — not a new clinical policy.

### 3.7 Session invalidation after link changes (C6)

| Mechanism | Available today? | Plan use |
| --- | --- | --- |
| Access JWT blacklist / jti revoke | **Not verified / absent** in `JwtService` | **Do not claim** immediate access-token invalidation |
| Refresh session deactivate | **Yes** — `SessionManagementService` sets `IsActive = false` | On revoke / mark-unverified / correct: deactivate Portal principal refresh sessions |
| Server resolve re-check | N/A (new) | **Every** resolve reloads active verified link; invalid link → deny even if JWT unexpired |
| Short Portal access TTL | Config-driven (staff uses `Jwt:ExpiryInMinutes`) | Prefer **shorter** Portal access TTL (engineering default under existing config pattern; exact minutes = engineering, not new PO policy) |

**Guaranteed control:** revocation of **patient identity resolution** is immediate at resolve time.  
**Bounded residual:** a still-valid Portal access JWT may call non-resolve Portal endpoints until expiry unless those endpoints also re-check link state (recommend: any Portal patient-data endpoint calls the same resolve gate).

### 3.8 First delivery path and dependencies (C7)

**Smallest safe invitation delivery (approved):** policy-enabled **staff-delivered single-use token** (PD-ID-03-D2). Compatible with verification requirements because delivery ≠ verification: staff shows/transfers opaque token; accept still creates **unverified** link only; verify remains separate and go-live gated.

| Path | When |
| --- | --- |
| Staff-delivered single-use token | **First** UAT/production-capable path when policy enables it |
| Email / SMS / both | After NotificationService portal wiring validated; only if tenant policy enables |

Do **not** treat NotificationService readiness as approved substitution for verification.

### 3.9 Persistence sketch (M1)

**`portal_invitations`:** `Id`, `TenantId`, `PatientId`, `DeliveryChannel`, `TokenHash`, `ExpiresAt`, `UsedAt`, `SupersededAt`, `SupersededByInvitationId`, `CreatedByUserId`, `CreatedAt`, `Status` (`pending`/`used`/`expired`/`superseded`/`revoked`)

**`portal_patient_links`:** as §3.2 + `VerificationMethodCode`, `VerifiedAt`, `VerifiedByUserId`, `RevokedReason`, `CreatedAt`

**`portal_remediation_requests`:** dual-control fields + `Reason` + `Status`

**Token storage:** hash only; never raw token in DB or audit.

### 3.10 Frontend cutover

1. AuthService APIs + tests first.  
2. Portal login → real Portal auth; store Portal token **separately** from staff `auth-store`.  
3. Remove `PAT-001`; display only server-resolved identity.  
4. Retarget/retire orphaned `patient-portal.api.ts` to AuthService routes.

---

## 4. Transaction and audit semantics (C3)

### 4.1 Ratified contract (preserved exactly)

**ResourceTypes:** `PortalPrincipal`, `PortalInvitation`, `PortalPatientLink`, `PortalRemediation`, `PortalResolve`

**Actions:**  
`portal.auth.login_success`, `portal.auth.login_failure`, `portal.invite.created`, `portal.invite.superseded`, `portal.invite.expired_or_rejected`, `portal.link.created_unverified`, `portal.link.verified`, `portal.link.verification_failed`, `portal.link.revoked`, `portal.link.corrected`, `portal.link.mark_unverified`, `portal.remediation.approval_granted`, `portal.remediation.approval_denied`, `portal.resolve.denied`

### 4.2 Mandatory mutations (invite / link / remediation)

```text
using transaction (ambient EF / explicit BeginTransaction)
  mutate invitation/link/remediation rows
  await StageAsync(action, ResourceType, resourceId, minimal JSON)
  await SaveChangesAsync()   // mutation + audit atomic
commit
on StageAsync throw OR SaveChanges failure → rollback; HTTP error; no partial success
```

RetentionDays / RetentionExpiry = **2,555 days** (explicit PO policy).

**Concurrency:**

| Race | Control |
| --- | --- |
| Concurrent invite create for same patient | Supersede prior pending in same TX; unique pending policy optional; last committed supersession wins; unused prior invalid |
| Concurrent verify to active verified | Filtered unique index + catch unique violation → fail closed; no dual active verified |
| Concurrent remediation approve | Row version / status check; only one transition to approved |

### 4.3 Mandatory `portal.resolve.denied`

```text
determine deny (do not return PatientId yet)
attempt StageAsync(portal.resolve.denied, PortalResolve, ...) + SaveChanges
if audit persistence fails → still return deny/error (fail closed); never 200 with PatientId
if audit succeeds → return generic deny (§3.6)
```

### 4.4 Best-effort login audits

After auth success/failure decision: try `LogAsync` (`login_success` / `login_failure`) in try/catch (or fire-and-forget with logged failure). Failure **must not** change HTTP auth outcome or expose audit infrastructure details.

### 4.5 Data minimization

Never audit: passwords, OTPs, raw invite tokens, access/refresh tokens, unnecessary demographics, browser `patientId` as proof.

### 4.6 InternalAuditController

**Do not expand** LMS allowlist for AuthService-owned portal writes.

---

## 5. Permission-definition vs role-grant boundary

| Proposed code | Purpose | Status |
| --- | --- | --- |
| `portal.invite.create` | Staff invite | **Proposal** |
| `portal.link.remediate` | Revoke/correct/mark-unverified initiator | **Proposal** |
| `portal.link.remediate_approve` | Dual-control approver | **Proposal** |

| Gate | Required |
| --- | --- |
| A | Separate authorization to **define/seed** permission rows (no role grants) |
| B | Separate authorization to **grant** permissions to roles/users |

**Forbidden:** silent reuse of `user.manage`.

---

## 6. Threat model (concise)

| # | Attacker / abuse | Control | Evidence / test | Residual risk |
| --- | --- | --- | --- | --- |
| T1 | Staff JWT as patient | Separate PortalJwt scheme + audience + `principal_kind`; staff login rejects Patient UserType | AT-01 | Misconfig if schemes share audience — deploy checklist |
| T2 | Patient JWT on staff API | Staff scheme rejects Portal audience | AT-01b | — |
| T3 | Client supplies victim `patientId` | Server resolve only | AT-18 | — |
| T4 | Accept invite → silent verify | Accept never sets verified | AT-20 / U5 | — |
| T5 | Invite replay / guess | Hash, single-use, expiry, rate limit | AT-10 | Token theft pre-use — HTTPS + short TTL |
| T6 | Concurrent double-link | Filtered unique + TX | AT-11 | Rare race → fail closed |
| T7 | Cross-tenant | TenantId on all queries | AT-09 | — |
| T8 | Skip mandatory audit | StageAsync atomic; fail closed | AT-12/13 | — |
| T9 | Login audit outage DoS auth | BEST_EFFORT | AT-14 | Lost login telemetry |
| T10 | Self-approve remediation | Approver ≠ initiator + separate perm | AT-16/17 | Collusion |
| T11 | Enumeration via errors | Uniform generic bodies (§3.6) | AT-09/10 messaging | Timing residual |
| T12 | Stale JWT after revoke | Resolve re-check + refresh revoke; short TTL | AT-04 + session tests | Access JWT until TTL without blacklist |
| T13 | Deceased access | Deny on `DeceasedDate` | AT-08 | — |
| T14 | Patient AppUser gains staff perms | No role grants; Portal token omits permission claims | AT-01 / grant policy | Ops mis-grant — Gate B discipline |

---

## 7. Automated test matrix

| ID | Scenario | Layer | Expected |
| --- | --- | --- | --- |
| AT-01 | Staff JWT on Portal resolve/login-gated API | AuthService.Tests | **401**; no PatientId |
| AT-01b | Portal JWT on staff permission endpoint | AuthService.Tests | **401** |
| AT-02 | Missing/invalid/expired Portal token | AuthService.Tests | **401** |
| AT-03 | Wrong audience / missing `principal_kind` | AuthService.Tests | **401** |
| AT-04 | No link / unverified / revoked | AuthService.Tests | Generic deny (**403**); `portal.resolve.denied` |
| AT-05 | Two active verified links same patient (seeded corruption) | AuthService.Tests | Fail closed deny; unique index prevents clean insert |
| AT-06 | One principal two active patients | AuthService.Tests | Fail closed |
| AT-07 | Stale/conflicting link states | AuthService.Tests | Deny |
| AT-08 | Deceased patient | AuthService.Tests | Deny |
| AT-09 | Cross-tenant invite/link/resolve | AuthService.Tests | Deny; no existence leak |
| AT-10 | Invite replay / expired / superseded | AuthService.Tests | Reject generic |
| AT-11 | Concurrent invite create/verify | AuthService.Tests | One winner; no dual active verified |
| AT-12 | Mandatory audit StageAsync/Save failure on invite/link/remediate | AuthService.Tests | Mutation rolled back |
| AT-13 | Resolve deny + audit write failure | AuthService.Tests | No successful PatientId |
| AT-14 | Login audit write failure | AuthService.Tests | Auth outcome unchanged |
| AT-15 | Audit payload redaction | AuthService.Tests | No secrets in Details/NewValues |
| AT-16 | Remediation without perm / self-approve / no reason | AuthService.Tests | **403** / **400** |
| AT-17 | Wrong-patient correct without dual control | AuthService.Tests | Rejected |
| AT-18 | Browser `patientId` manipulation | AuthService.Tests | Ignored; server id wins |
| AT-19 | Staff login regression (staff user) | Existing AuthService.Tests | Unchanged green |
| AT-19b | Staff login with Patient UserType credentials | AuthService.Tests | Rejected (generic) |
| AT-20 | Accept invite does not verify; demographic-only cannot verify | AuthService.Tests | Unverified; resolve denied |
| AT-21 | Disabled delivery/verification method | AuthService.Tests | Reject |
| AT-22 | Expiry outside 1–72h / default policy | AuthService.Tests | Fail closed |
| AT-23 | Link revoke → resolve denied while JWT unexpired | AuthService.Tests | Deny at resolve |
| AT-24 | Refresh session deactivated after revoke | AuthService.Tests | Refresh fails |
| AT-FE-01 | Mock login removed after cutover | FE test (later) | Real API only |
| AT-FE-02 | No hardcoded PAT-001 | FE test (later) | Server identity |

**This planning task does not run tests.**

---

## 8. Manual UAT plan and acceptance criteria

### Prerequisites

- AuthService deployed with migrations for slice.  
- Permission **definitions seeded** (Gate A) and **UAT roles granted** (Gate B).  
- Tenant policy: enabled channels/methods; expiry default 24h within 1–72h.  
- **Staff-delivered token** path enabled for first UAT (email/SMS optional if wired).  
- Test patients (living + deceased), two staff users (inviter/remediator ≠ approver).  
- Verification method operational details available before UAT scenarios that require verify go-live.

### Scenarios (summary)

| UAT | Steps | Expected |
| --- | --- | --- |
| U1 | Staff creates invite (enabled channel) | Invite created; audit `portal.invite.created` |
| U2 | Supersede unused invite | Old invalid; new works; `portal.invite.superseded` |
| U3 | Accept invite → credentials → Portal login | Portal JWT; no staff perms; link still unverified |
| U4 | Verify link (approved method) | Resolve returns PatientId |
| U5 | Login before verify | Resolve denied (generic) |
| U6 | Expired/superseded invite | Rejected |
| U7 | Staff JWT against Portal API | **401** |
| U8 | Manipulate patientId in request | Ignored/denied |
| U9 | Deceased patient | Denied |
| U10 | Remediation dual control | Initiator≠approver; reason required |
| U11 | Revoke link then call resolve with existing access JWT | Denied immediately at resolve |
| U12 | Staff login smoke | Unaffected |
| U13 | Pathology `/dashboard/laboratory` smoke | Unaffected |
| U14 | No L-REP-04 patient PDF path | Still unavailable |

### Evidence

Screenshots/logs without PHI dump; audit row presence (action/resource) for mandatory events; redact tokens.

### Acceptance (slice)

- All AT-* for implemented sub-slices green.  
- UAT U1–U14 pass with recorded evidence.  
- No secrets in audit samples.  
- Mock login / PAT-001 removed **only if** real path shipped in same acceptance.  
- `BLOCKER-PP-IDENTITY-01` remains **OPEN** until formal acceptance document (separate).  
- L-REP-04 still **NOT_AUTHORIZED**.

---

## 9. Dependencies and unresolved decisions

| Item | Owner | Blocks |
| --- | --- | --- |
| Explicit **approval of this revised plan** | Product Owner / Security | **All runtime (S1+)** |
| Permission **definition/seed** (Gate A) | PO / Security | Staff invite/remediate **APIs** (not schema unit tests with fixtures) |
| Permission **role grants** (Gate B) | PO / Security | Manual UAT / prod staff operations |
| Verification checklist / ID evidence / OTP assurance field contents | Hospital ops + Engineering | **Verify endpoint go-live** and UAT U4 — **not** schema, invite create, accept, login, or deny-resolve |
| NotificationService portal email/SMS wiring | Engineering | Automated email/SMS delivery only — **not** staff-delivered path |
| Portal JWT config (`Jwt:PortalAudience`, scheme registration, Portal TTL minutes) | Engineering | Soft — design fixed in §3.3; values at impl |
| Policy key names in SystemSettings | Engineering | Soft — propose in S1 |
| Ops notification channel for wrong-patient | Hospital security ops | Soft — procedure still deny+revoke+audit (PD-ID-07-D3) |

**Does not block schema work:** Gate A/B, NotificationService email/SMS, verification field contents.  
**Does not block invite create + staff-delivered delivery + accept + login + deny-resolve:** verification field contents (verify go-live only).

---

## 10. Migration / deployment / rollback

| Step | Action |
| --- | --- |
| 1 | Additive AuthService migration (tables + filtered unique indexes); default deny resolve |
| 2 | Deploy AuthService APIs; Portal FE remains mock until cutover criteria met |
| 3 | Seed permissions (**only** after Gate A); grants (**only** after Gate B) |
| 4 | Configure tenant policy bounds + enable staff-delivered channel for first path |
| 5 | Register `PortalJwtBearer` + `Jwt:PortalAudience` without changing staff `Jwt:Audience` |
| 6 | Cut over FE login; remove PAT-001 |
| Rollback | Disable Portal auth endpoints / feature flag; deny resolve; keep tables; staff auth unchanged |
| Ordering | AuthService before FE cutover; never enable L-REP-04 |

---

## 11. In-scope / out-of-scope matrix

| Item | In | Out |
| --- | --- | --- |
| AuthService invite/link/auth/resolve/remediate | ✓ | |
| Portal FE real login cutover | ✓ (after API) | Full Portal rewrite |
| Staff-delivered invite token (policy-enabled) | ✓ | |
| Email/SMS invite delivery | ✓ when wired + policy | Required for first path |
| L-REP-04 PDF publication | | ✓ |
| Proxy/guardian | | ✓ |
| Self-registration | | ✓ |
| Pathology / CUT C/D | | ✓ |
| LMS InternalAudit allowlist expansion | | ✓ |
| Silent role grants | | ✓ |
| Access-token blacklist infrastructure | | ✓ (not claimed) |

---

## 12. Risk register

| Risk | Mitigation |
| --- | --- |
| Shared JWT audience mis-accepts staff token | Dual schemes + distinct PortalAudience + `principal_kind` + login UserType gates |
| Stale Portal JWT after revoke | Resolve/link gate on every patient-data call; refresh revoke; shorter Portal TTL |
| Permission grants delayed | S1 schema+resolve unit tests with fixtures before staff APIs |
| Verification content undefined | Invite + unverified + deny-resolve first; verify go-live waits |
| Delivery outage | Staff-delivered single-use token as first path |
| Enumeration via status codes | Uniform resolve-deny HTTP + generic bodies |
| FE orphan client drift | Single AuthService contract |
| Accidental staff role on Patient AppUser | No grants; AT-19b; Gate B discipline |

---

## 13. Implementation sequencing (sub-slices)

| Sub-slice | Deliverable | Depends on |
| --- | --- | --- |
| **S0** | Explicit approval of **this revised** plan | PO/Security |
| **S1** | Schema + filtered uniques + resolve fail-closed + mandatory audit tests (no FE) | S0 |
| **S2** | Invitation lifecycle + policy bounds + **staff-delivered** token path | S1; Gate A for invite API |
| **S3** | PortalJwt scheme + login BEST_EFFORT audit + FE cutover | S1–S2 |
| **S4** | Verification + remediation dual control | S3; Gate A/B; ops verification fields |
| **S5** | Manual UAT + acceptance package | S4 |

Each sub-slice: code + automated tests + review; stop between slices for approval if required by workflow.

---

## 14. Final approval checklist (Product Owner / Security)

- [ ] Scope matches §1 (no L-REP-04 / Pathology / proxy / self-reg)  
- [ ] S0 corrections C1–C7 accepted (§0)  
- [ ] Cardinality = **both** 1:1 active-verified directions; corruption fail-closed  
- [ ] Dual JWT scheme + UserType login gates (audience alone insufficient)  
- [ ] Accept ≠ verify; verify go-live gated on ops field details  
- [ ] HTTP contract §3.6 accepted (enumeration-safe)  
- [ ] Session model: resolve re-check + refresh revoke; no false claim of access-token blacklist  
- [ ] First delivery path = staff-delivered when policy-enabled  
- [ ] Ratified audit contract preserved (resource types, actions, StageAsync fail-closed, login BEST_EFFORT)  
- [ ] Retention 2,555 days; expiry 1–72h default 24h acknowledged  
- [ ] Permission seed/grant treated as **separate** authorizations  
- [ ] Threat model and AT matrix accepted  
- [ ] UAT/acceptance criteria accepted  
- [ ] Open dependencies owners acknowledged  
- [ ] Explicit approval to proceed to **S1 runtime** recorded  

**Approval field:** `☐ APPROVE plan` / `☐ APPROVE WITH EDITS` / `☐ REJECT` — PO/Security: _______________ Date: _______________

---

## 15. Status and mandatory stop

```text
PRODUCT_DECISIONS_CLOSED_L_PORTAL_01 = PRESERVED
L_PORTAL_01_IMPLEMENTATION_AUTHORIZATION = GRANTED
AUDIT_EVENT_CONTRACT = RATIFIED_APPROVE_WITH_EDITS
PORTAL_AUTH_LOGIN_SUCCESS_FAILURE_AUDIT = BEST_EFFORT
RUNTIME_IMPLEMENTATION = S1_IMPLEMENTED_AWAITING_REVIEW
BLOCKER-PP-IDENTITY-01 = OPEN
L_REP_04_IMPLEMENTATION = NOT_AUTHORIZED
PD-PP-01…12 = PRESERVED
ACCEPTED_L_REP_03_CUT_C = PRESERVED
ACCEPTED_L_REP_03_CUT_D = PRESERVED
LEGACY_PATHOLOGY = UNCHANGED
BOUNDED_IMPLEMENTATION_PLAN = APPROVED_FOR_S1
NEXT_GATE = S1_REVIEW_AND_EXPLICIT_AUTHORIZATION_FOR_S2
```

**STOP.** S1 complete for review. Do **not** begin S2 or later slices without explicit Product Owner/Security authorization.
