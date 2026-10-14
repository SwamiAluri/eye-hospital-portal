# L-PORTAL-01 — Implementation Readiness Report  
# (Audit-event contract ratified — S1 runtime implemented, awaiting review)

**Date:** 2026-10-14 (updated — S1 implemented)  
**Mode:** S1 RUNTIME COMPLETE FOR REVIEW — S2+ not authorized  
**Authorization:** Product Owner authorized L-PORTAL-01 and approved the revised bounded plan for **S1 only**. Does **not** authorize L-REP-04 or S2+.  
**Closure baseline:** [enterprise-lms-patient-portal-identity-product-decision-closure.md](./enterprise-lms-patient-portal-identity-product-decision-closure.md) (`PRODUCT_DECISIONS_CLOSED_L_PORTAL_01`)  
**Prerequisite spec:** [enterprise-lms-patient-portal-identity-prerequisite-specification.md](./enterprise-lms-patient-portal-identity-prerequisite-specification.md)

```text
PRODUCT_DECISIONS_CLOSED_L_PORTAL_01 = PRESERVED
L_PORTAL_01_IMPLEMENTATION_AUTHORIZATION = GRANTED
IMPLEMENTATION_READINESS_AUDIT_COMPLETE
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

## 1. Purpose

Fresh repository verification after implementation authorization; record Product Owner **audit-event contract ratification**; prepare the next **planning/security-review** gate. This document does **not** authorize or execute runtime code changes.

---

## 2. Fresh audit findings (source-verified 2026-10-14)

### 2.1 Authentication / session / token

| Finding | Path | Status |
| --- | --- | --- |
| Staff JWT issuance | `AuthService/Services/JwtService.cs` | **Exists** — claims: `sub`/`user_id`, email, name, `TenantId`, roles, `permission`. **No** `patientId`, **No** `UserType` claim. Audience: config `Jwt:Audience` (`EyeHospitalAPI`) |
| Staff login | `AuthService/Controllers/AuthController.cs` | **Exists** — Identity login + JWT; `UserType` in response body only; not a Portal patient gate |
| `AppUser` | `AuthService/Models/Identity/AppUser.cs` | **Exists** — `UserType` default `"Staff"`; activation fields; **no** `PatientId` |
| Portal auth APIs | AuthService controllers | **Absent** — no `/portal/*` / `portal-user` / `portal-registration` backends |
| Patient FE login | `apps/hospital-portal-web/src/app/patient/login/page.tsx` | **Mock** — accept-any credentials/OTP; no API |
| Patient layout identity | `.../patient/layout.tsx` | **Hardcoded** demo patient (`PAT-001`) |
| Patient auth-store usage | under `src/app/patient/` | **Absent** |
| FE portal client | `lib/api/patient-portal.api.ts` | Declares `/portal/auth/*` — **orphaned** (no BE) |

**Extension points:** New Portal auth controller (preferred over overloading staff `Login`) + distinct patient-principal JWT claims/audience; replace mock login after server path exists.

### 2.2 Patient identity / MPI

| Finding | Path | Status |
| --- | --- | --- |
| MPI Patient | `AuthService/Models/Domain/Patient.cs` | **Exists** — `Id`, `TenantId`, `DeceasedDate`, demographics |
| Staff patient lookup | `PatientsController` / `PatientService` | **Exists** — tenant-scoped |
| User↔Patient linkage store | — | **Absent** |

### 2.3 Database / migrations / transactions

| Finding | Path | Status |
| --- | --- | --- |
| EF migrations | `AuthService/Migrations/` + `AuthService/Data/Migrations/` | **Exists** (split convention) |
| `AppDbContext` | `AuthService/Context/AppDbContext.cs` | Users, Patients, AuditLogs, SystemSettings, Permissions, … |
| Transactional audit | `AuditService.StageAsync` | **Exists** — stage then caller `SaveChanges`; infra write path supports RetentionDays |

### 2.4 Permissions

| Finding | Path | Status |
| --- | --- | --- |
| Permission seeder | `AuthService/SeedData/PermissionSeeder.cs` | **Exists** |
| Portal identity permissions | seeder | **Absent** — no dedicated invite/remediation codes |
| LMS report permissions | `EnterpriseLmsReportsPermissionCatalog.cs` | **Exists** — `lms.reports.*`; **no** `lms.reports.publish` |
| `RequirePermission` | `Authorization/RequirePermissionAttribute.cs` | **Exists** |
| FE `patient_portal.view` | sidebar menu | Orphan relative to seeder |

**Constraint:** Do not reuse `user.manage`. Permission codes in §6 remain **proposals** — audit-contract ratification does **not** authorize seed/grant.

### 2.5 Audit infrastructure (pre-ratification evidence)

| Finding | Path | Status |
| --- | --- | --- |
| Internal allowlist (LMS) | `InternalAuditController.AllowedActions` / `AllowedResourceTypes` | Lab-centric; **no** portal identity actions — **do not expand** for AuthService-owned portal writes |
| Staff login audit | `AuthController.LogAudit` | Free-string parallel path |
| Fail-closed StageAsync | financial tests / callers | Pattern **exists**; not yet wired to portal |

### 2.6 Email / SMS / configuration

| Finding | Path | Status |
| --- | --- | --- |
| Staff activation OTP | `UsersController` `send-activation` (`user.manage`) | **Exists** for staff AppUsers |
| Notification delivery | notification-service Azure email / Twilio SMS | **Exists** as delivery infra |
| Portal invite E2E | — | **Absent** |
| Policy config surface | `SystemSettings` / `SettingsController` | Generic categories; **no** portal invite/verification policy keys |

### 2.7 Tests

| Finding | Status |
| --- | --- |
| AuthService.Tests (login, activation, InternalAudit, financial fail-closed) | **Exists** |
| Portal identity / link / invite tests | **Absent** |

---

## 3. Implementation readiness verdict (updated)

| Question | Answer |
| --- | --- |
| Architecture extension points identified? | **Yes** — AuthService ownership confirmed |
| Product decisions closed? | **Yes** — `PRODUCT_DECISIONS_CLOSED_L_PORTAL_01` |
| Implementation authorization granted? | **Yes** |
| Audit event contract ratified? | **Yes** — `RATIFIED_APPROVE_WITH_EDITS` (§5) |
| Safe to expand LMS InternalAudit allowlist for these events? | **No** — AuthService-owned writes use AuthService audit path; do not expand LMS allowlist merely for these |
| Safe to start runtime without bounded plan/security review? | **No** — next gate is planning/review only |
| Identity runtime blocker closed? | **No** — `BLOCKER-PP-IDENTITY-01` remains **OPEN** |

**Readiness status:** `AUDIT_CONTRACT_RATIFIED — S1_IMPLEMENTED_AWAITING_REVIEW`

**Runtime implementation:** **S1_IMPLEMENTED_AWAITING_REVIEW** (schema + fail-closed resolve foundation + tests). S2+ **not** started. `BLOCKER-PP-IDENTITY-01` remains **OPEN**.

**Bounded plan (canonical; approved for S1):** [enterprise-lms-patient-portal-identity-bounded-implementation-plan.md](./enterprise-lms-patient-portal-identity-bounded-implementation-plan.md)

---

## 4. Proposed first bounded slice (planning baseline — not implemented)

*Planning input for next gate only.*

**Intent:** Smallest independently testable vertical: AuthService linkage store + staff-initiated invite create (pending/unverified) + Portal principal authenticate + server-side resolve `PatientId` that fails closed unless verified — without presenting unverified accounts as linked.

| Area | Planned (after plan/security review approval) |
| --- | --- |
| Ownership | AuthService |
| Persistence | New `portal_patient_links` (or equivalent) + invitation tokens; additive migration under AuthService conventions |
| Permissions | Definitions only after **separate** permission-definition authorization (§6); **no** silent role grants |
| Audit | Ratified contract §5 via `IAuditService.StageAsync` for mandatory mutations; fail closed |
| FE | Replace mock login / `PAT-001` only when real backend contract exists; no L-REP-04 wiring |
| Exclusions | L-REP-04, Pathology, CUT C/D, proxy/guardian, self-registration, role grants |

---

## 5. Ratified audit event contract

### 5.0 Product Owner ratification record

| Field | Value |
| --- | --- |
| **Decision** | `PRODUCT_OWNER_AUDIT_EVENT_CONTRACT = APPROVE_WITH_EDITS` |
| **Login audit policy** | `PORTAL_AUTH_LOGIN_SUCCESS_FAILURE_AUDIT = BEST_EFFORT` |
| **Additional conditions** | `NONE_SUPPLIED` |
| **Provenance** | Explicit Product Owner decision supplied in the **project conversation** on **2026-10-14** — **not** an assistant recommendation as the source of approval |
| **Status** | `AUDIT_EVENT_CONTRACT = RATIFIED_APPROVE_WITH_EDITS` |

Historical proposal text is superseded by the ratified rules below. Event action strings are retained; resource types and login audit classification are edited per PO.

### 5.1 Write path (ratified)

| Rule | Ratified requirement |
| --- | --- |
| Mutation path | Mandatory identity-link / invitation / remediation state-change mutations use AuthService `IAuditService.StageAsync` in the **same database transaction** as the protected mutation. If mandatory audit persistence fails, the mutation **must fail and roll back**. |
| Resolution denial | Mandatory `portal.resolve.denied` auditing must **fail closed**: no successful patient-resolution response may be returned when the required denial audit cannot be persisted. |
| Login success/failure | **BEST EFFORT**. Audit-write failure for these events alone must **not** turn an otherwise valid authentication result into an authentication failure, and must **not** disclose sensitive audit infrastructure details. |
| Retention | **2,555 days** — existing explicit Product Owner policy (PD-ID-11-D2), not an inferred infrastructure default |
| Secrets / minimization | Never record passwords, OTP values, raw invitation tokens, access/refresh tokens, or unnecessary patient demographics. Record only minimal actor/action/time/outcome and necessary linkage identifiers. |
| LMS Internal allowlist | AuthService-owned writes use the AuthService audit path. **Do not** expand `InternalAuditController` allowlist merely for these writes. If a future satellite-service write requires that allowlist, stop and use these **already-ratified** action strings; do **not** invent aliases. |

### 5.2 Ratified resource types

| ResourceType | Use |
| --- | --- |
| `PortalPrincipal` | Portal authentication outcomes |
| `PortalInvitation` | Invitation lifecycle events |
| `PortalPatientLink` | Patient-link creation, verification, revocation, correction |
| `PortalRemediation` | Remediation request and approval lifecycle |
| `PortalResolve` | Denied patient-identity resolution |

### 5.3 Ratified action catalogue

| Action | ResourceType | When | Actor | Outcome | Minimal identifiers (no secrets) | Audit class |
| --- | --- | --- | --- | --- | --- | --- |
| `portal.auth.login_success` | `PortalPrincipal` | Portal principal auth succeeds | Portal principal userId | success | tenantId, principalUserId, sessionId (if any) | **BEST_EFFORT** |
| `portal.auth.login_failure` | `PortalPrincipal` | Portal auth fails | anonymous / attempted id | failure | tenantId, reasonCode (no password) | **BEST_EFFORT** |
| `portal.invite.created` | `PortalInvitation` | Staff creates invitation | staff userId | success | tenantId, patientId, invitationId, deliveryChannel, expiresAt | **MANDATORY** (fail closed with mutation) |
| `portal.invite.superseded` | `PortalInvitation` | Replacement invite invalidates prior | staff userId | success | tenantId, patientId, oldInvitationId, newInvitationId | **MANDATORY** |
| `portal.invite.expired_or_rejected` | `PortalInvitation` | Expired/invalid invite use or rejection handling | system/staff/principal | failure | tenantId, invitationId, reasonCode | **MANDATORY** when invitation state mutates; otherwise log without weakening invite state rules |
| `portal.link.created_unverified` | `PortalPatientLink` | Pending link/invite association created | staff userId | success | tenantId, principalUserId (if any), patientId, linkId, verificationStatus | **MANDATORY** |
| `portal.link.verified` | `PortalPatientLink` | Link activated after approved verification method | staff and/or principal per method | success | tenantId, linkId, patientId, principalUserId, verificationMethodCode | **MANDATORY** |
| `portal.link.verification_failed` | `PortalPatientLink` | Verification attempt failed | staff/principal | failure | tenantId, linkId, methodCode, reasonCode | **MANDATORY** if state change attempted |
| `portal.link.revoked` | `PortalPatientLink` | Link revoked | remediator userId | success | tenantId, linkId, patientId, principalUserId, reasonCode | **MANDATORY** |
| `portal.link.corrected` | `PortalPatientLink` | Correct/reassign after dual control | remediator + approver userIds | success | tenantId, oldLinkId, newLinkId, patientId, principalUserId, reasonCode | **MANDATORY** |
| `portal.link.mark_unverified` | `PortalPatientLink` | Mark unverified | remediator userId | success | tenantId, linkId, reasonCode | **MANDATORY** |
| `portal.remediation.approval_granted` | `PortalRemediation` | Dual-control approval recorded | approver userId | success | tenantId, remediationRequestId, linkId | **MANDATORY** |
| `portal.remediation.approval_denied` | `PortalRemediation` | Dual-control denied | approver userId | failure | tenantId, remediationRequestId, reasonCode | **MANDATORY** when it closes the request |
| `portal.resolve.denied` | `PortalResolve` | Server-side patient resolve denied | principal or staff attempt | failure | tenantId, principalUserId (if any), reasonCode (`missing`/`unverified`/`ambiguous`/`deceased`/`revoked`/`staff_token`/…) | **MANDATORY** (fail closed — no successful resolve) |

### 5.4 Explicit exclusions from audit metadata

Credentials, OTPs, raw invitation tokens, access/refresh tokens, full addresses, unnecessary clinical data, browser-supplied patientId presented as proof.

---

## 6. Proposed permission codes (unchanged — not authorized by this ratification)

| Proposed code | Purpose |
| --- | --- |
| `portal.invite.create` | Staff-initiated Portal invitation |
| `portal.link.remediate` | Revoke / correct / mark-unverified (initiator) |
| `portal.link.remediate_approve` | Dual-control approver for wrong-patient correction |

**Status:** Technical proposals pending a **separate** permission-definition/seed authorization.  
**Not authorized by audit-contract ratification:** seed definitions, role grants, permission changes, or reuse of `user.manage`.

---

## 7. Remaining contracts (post-audit-ratification)

| Contract | Status | Blocks next *runtime* slice? |
| --- | --- | --- |
| Audit event contract (§5) | **Ratified** `APPROVE_WITH_EDITS` | No (contract ready for use at impl) |
| Permission definition/seed (§6) | Separate authorization required | Soft-block for staff invite/remediate APIs until defined under separate auth |
| JWT audience / claim set for Portal principal | Engineering design under PD-ID-08 | Soft-block for Portal login issuance |
| Verification checklist field contents / document lists / OTP assurance | Engineering + hospital ops | Soft-block for verify endpoint content |
| Hospital policy config keys (channels/methods/expiry within 1–72h) | Design at plan/impl | Soft-block for invite issuance |
| Ops notification channel (wrong-patient) | External hospital process | Soft-block for notification only |
| Bounded plan + security review | **Next gate** | **Yes** — no runtime until plan/review approved |

---

## 8. Conflicts and dependencies

1. Mock Portal login can navigate without tokens — must not remain after real auth cutover.  
2. Dual audit writers (AuthController free-string vs AuditService StageAsync) — Portal identity **mandatory** mutations must use StageAsync fail-closed; login audits are BEST_EFFORT and must not unlock or fail auth on audit write failure.  
3. FE `patient_portal.view` vs missing seeder — do not treat as Portal patient identity permission.  
4. L-REP-04 remains decision-closed but implementation-unauthorized; `BLOCKER-PP-IDENTITY-01` stays **OPEN** until identity is implemented, verified, UAT’d, and accepted.

---

## 9. What was deliberately not changed (this ratification task)

No application/runtime code, migrations, permission seeds/grants, audit allowlist/runtime emitters, Portal FE, LaboratoryApi, Pathology, CUT C/D, or L-REP-04 implementation.

---

## 10. Next gate — S1 review, then explicit S2 authorization

Bounded plan **approved for S1**; S1 runtime (schema + resolve foundation + automated tests) **implemented** and awaiting review.  
[enterprise-lms-patient-portal-identity-bounded-implementation-plan.md](./enterprise-lms-patient-portal-identity-bounded-implementation-plan.md) §0a

```text
BOUNDED_IMPLEMENTATION_PLAN = APPROVED_FOR_S1
RUNTIME_IMPLEMENTATION = S1_IMPLEMENTED_AWAITING_REVIEW
NEXT_GATE = S1_REVIEW_AND_EXPLICIT_AUTHORIZATION_FOR_S2
```

### 10.1 Stop conditions

- Do **not** begin S2 (invitation lifecycle), S3 (Portal JWT/FE), S4 (verify/remediate), permission seeds/grants, or L-REP-04 without **explicit** authorization.  
- Do **not** claim `BLOCKER-PP-IDENTITY-01` closed.  
- Do **not** apply S1 migration to shared/staging/production without separate deployment authorization.  
- Permission definition/seed and role grants remain **separate** authorizations (plan §5).  

---

## 11. Mandatory stop

**STOP.** S1 implemented for review. Do **not** start S2+ or L-REP-04 from this document.  
`BLOCKER-PP-IDENTITY-01` remains **OPEN**.
