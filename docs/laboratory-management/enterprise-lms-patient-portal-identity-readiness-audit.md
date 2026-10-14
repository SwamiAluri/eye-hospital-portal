# Patient Portal Identity Linkage — Prerequisite Readiness Audit  
# (`BLOCKER-PP-IDENTITY-01` for L-REP-04)

**Date:** 2026-10-13  
**Mode:** AUDIT / DECISION PREPARATION ONLY — no application code, schema, auth, permissions, Portal runtime, L-REP-04 publication, Pathology, or CUT C/D changes  

**Provisional prerequisite ID (unapproved):** `L-PORTAL-01` — Patient Portal Authenticated Identity ↔ Patient Linkage  

**Authoritative L-REP-04 context:**

| Document | Role |
| --- | --- |
| [enterprise-lms-report-patient-portal-publication-product-decision-closure.md](./enterprise-lms-report-patient-portal-publication-product-decision-closure.md) | PD-PP-01…12 **closed**; PD-PP-11 conservative identity baseline binding |
| [enterprise-lms-report-patient-portal-publication-readiness-audit.md](./enterprise-lms-report-patient-portal-publication-readiness-audit.md) | L-REP-04 readiness; `BLOCKER-PP-IDENTITY-01` |
| [enterprise-lms-report-patient-portal-publication-implementation-specification.md](./enterprise-lms-report-patient-portal-publication-implementation-specification.md) | Conditional; patient path blocked |
| Companion decision package | [enterprise-lms-patient-portal-identity-decision-package.md](./enterprise-lms-patient-portal-identity-decision-package.md) |
| Product Decision Closure | [enterprise-lms-patient-portal-identity-product-decision-closure.md](./enterprise-lms-patient-portal-identity-product-decision-closure.md) — `PRODUCT_DECISIONS_CLOSED_L_PORTAL_01` |
| Product Owner decision review | [enterprise-lms-patient-portal-identity-product-decision-review.md](./enterprise-lms-patient-portal-identity-product-decision-review.md) |
| Product Owner decision form | [enterprise-lms-patient-portal-identity-product-owner-decision-form.md](./enterprise-lms-patient-portal-identity-product-owner-decision-form.md) |
| Conditional prerequisite spec | [enterprise-lms-patient-portal-identity-prerequisite-specification.md](./enterprise-lms-patient-portal-identity-prerequisite-specification.md) |

```text
PRODUCT_DECISIONS_CLOSED_L_REP_04_AUTHORIZED
BLOCKER-PP-IDENTITY-01 = OPEN
  ↓
THIS AUDIT — identity SoT + Option A/B/C (runtime gap unchanged)
  ↓
PRODUCT_DECISIONS_CLOSED_L_PORTAL_01 = PRESERVED
L_PORTAL_01_IMPLEMENTATION_AUTHORIZATION = GRANTED
AUDIT_EVENT_CONTRACT = RATIFIED_APPROVE_WITH_EDITS
BOUNDED_IMPLEMENTATION_PLAN = RECORDED_AWAITING_EXPLICIT_APPROVAL
NEXT_GATE = EXPLICIT_APPROVAL_OF_BOUNDED_IMPLEMENTATION_PLAN
```

---

## 1. Purpose

Determine whether Hospital Portal has a **safe, authoritative** Patient Portal identity-to-`PatientId` linkage that can satisfy L-REP-04 / PD-PP-11. If not, define the smallest prerequisite packaging and the Product Owner decisions still required.

**This audit does not resolve `BLOCKER-PP-IDENTITY-01`.**  
**This audit does not authorize implementation of identity or L-REP-04.**

Binding constraints preserved: exact linked patient only; branch alone insufficient; fail closed; proxy denied unless verified existing mechanism (none found); no browser-supplied `patientId` as proof; no email/name/phone/MRN inference; CUT C/D frozen; Pathology unchanged.

---

## 2. Authentication path — traced against repository

| Step | Expected for safe Portal access | Actual repository evidence |
| --- | --- | --- |
| 1. Portal login request | Call Auth / portal auth API | `app/patient/login/page.tsx` — `setTimeout` simulation; comment “Demo: accept any email/password”; **no API call** |
| 2. Credential validation | Server validates credentials | **Absent** for `/patient/*` |
| 3. Session/token issuance | Server issues JWT/session | **Absent** — no token stored under `src/app/patient` (no localStorage/sessionStorage/auth-store usage) |
| 4. Authenticated user id / claims | Stable subject + tenant | Staff AuthService JWT only: `sub`/`user_id`, email, tenant, roles, permissions — **no `patientId` claim** (`JwtService.cs`) |
| 5. Patient-account association | Verified user↔patient link | **No** AuthService entity/endpoint for portal user / linkage; FE stubs only |
| 6. Server-resolved `PatientId` | From linkage, not client | **Cannot** — layout hardcodes `PAT-001` (`patient/layout.tsx`) |
| 7. Patient-facing API authz | Enforce resolved PatientId | **No** compiled `/portal/*` controllers; `/patient/results` uses `mockResults` |

**Conclusion:** Current Portal login/results are **mock / UI shell only**, not partially wired authentication.

---

## 3. Explicit answers (required)

| Question | Answer | Evidence |
| --- | --- | --- |
| Is there an authoritative authenticated Portal identity? | **No** | Mock login; no portal JWT/session |
| Where is that identity stored and validated? | **N/A** — does not exist. Staff identity is `AppUser` + AuthService login (`AuthController.Login`) — staff-oriented | `AppUser.cs`, `AuthController.cs` |
| Verified governed association with `PatientId`? | **No** | No User↔Patient link table/API found; `AppUser` has **no** `PatientId` property |
| Can server resolve patient without caller-supplied id? | **No** for Portal | No portal session → linkage SoT |
| Duplicate / missing / stale / conflicting associations? | **Unhandled** — no association model | — |
| Distinguish patient vs staff accounts? | **Not for Portal.** `AppUser.UserType` defaults `"Staff"` with comment `"Staff, Patient, Admin"` — **not** a verified Portal auth path | `AppUser.cs` |
| Verified proxy/guardian service? | **No** | MPI `Guardian*` demographics; counselling guardian signature — not Portal ACL |
| Who should own identity-to-patient resolution? | **Proposal only:** AuthService (MPI `Patient` SoT + Identity) — **requires Product Owner confirmation** (PD-ID-05) | `Patient.cs` in AuthService; no current portal owner |

**Forbidden inference (confirmed not used as SoT — and must not be invented):** email similarity, name match, phone match, branch membership, MRN possession alone.

---

## 4. Supporting inventory (verified paths)

### 4.1 Patient app (mock)

| Surface | Path | Status |
| --- | --- | --- |
| Login | `apps/hospital-portal-web/src/app/patient/login/page.tsx` | Simulated |
| Layout / identity display | `.../patient/layout.tsx` | Hardcoded patient |
| Results | `.../patient/results/page.tsx` | `mockResults`; non-LMS |
| Middleware | — | **No** `middleware.ts` under hospital-portal-web |

### 4.2 Client stubs (not backend)

| Surface | Path | Status |
| --- | --- | --- |
| Portal API client | `lib/api/patient-portal.api.ts` | Declares `/portal/auth/*`, documents, lab-results; **unused by `/patient/*`** |
| Staff enhanced client | `lib/api/patients-enhanced.api.ts` | `GET .../portal-user`, `POST .../portal-registration` |
| AuthService controllers | microservices grep | **No** `portal-user`, `portal-registration`, `/portal/` matches |
| Staff Portal Access tab | `components/patients/tabs/PortalAccessTab.tsx` | “Phase 5 Feature - PatientPortalController” stub |
| Admin / dashboard portal pages | `app/admin/patient-portal`, `app/dashboard/patient-portal` | Separate staff shells; simulated / client-only |

### 4.3 AuthService staff identity (not Portal)

| Surface | Path | Status |
| --- | --- | --- |
| `AppUser` | `Models/Identity/AppUser.cs` | Tenant, BranchId, UserType; **no PatientId** |
| JWT | `Services/JwtService.cs` | No patient claim |
| Login | `Controllers/AuthController.cs` | Staff Identity login + JWT |
| MPI Patient | `Models/Domain/Patient.cs` | Authoritative patient record GUID |

### 4.4 Content / LMS (staff only — not patient identity)

| Surface | Notes |
| --- | --- |
| Staff LMS Official PDF download | LaboratoryApi + internal CanonicalDocument — staff JWT + `lms.reports.download` |
| Patient 360 LMS list | Staff JWT + `lms.reports.view`/`manage` — **not** Portal publication |

### 4.5 Proxy / branch

| Topic | Finding |
| --- | --- |
| Proxy/guardian Portal authz | **Absent** — deny under PD-PP-11 |
| Cross-branch Portal policy | **Absent** — branch alone insufficient (PD-PP-11) |

---

## 5. Option comparison

### Option A — Reuse existing verified identity-linkage mechanism

| Field | Content |
| --- | --- |
| **Supported by evidence?** | **No** |
| Scope | N/A |
| Dependencies | Would require a complete server-enforced Portal auth + linkage — **missing** |
| Security | Cannot reuse mock UI or staff JWT as patient identity |
| Data ownership | None established for Portal linkage |
| Required PDs | None unlock Option A — mechanism does not exist |
| Tests / acceptance | N/A |
| **Verdict** | **REJECTED** |

### Option B — Separate Patient Portal identity prerequisite slice

| Field | Content |
| --- | --- |
| **Supported?** | **Yes — recommended packaging** |
| Provisional ID | `L-PORTAL-01` (**unapproved**) |
| Scope (candidate) | Smallest independently testable: real Portal authentication + **verified** identity↔exact `PatientId` linkage + server-side resolve API that never trusts caller `patientId` as sole authority; staff credentials cannot act as patient identity |
| Out of candidate scope | L-REP-04 publish/withdraw/PDF publication; NotificationHub; proxy/guardian system; Pathology; CUT C/D; silent role grants; inventing self-registration UX without PD approval |
| Dependencies | Product Decision Closure on PD-ID-* (see decision package); AuthService + Portal FE; MPI Patient SoT |
| Security | Enables fail-closed exact-patient gates for future L-REP-04; separates staff vs patient principals |
| Data ownership | **Proposed:** AuthService owns linkage + Portal auth issuance; LaboratoryApi **consumes** resolved PatientId later — PO confirm |
| Required PDs | Account creation, verification, cardinality, conflict handling, token model, ownership — **cannot invent** (PD-ID-*) |
| Tests / UAT | See prerequisite specification + decision package |
| Relationship to L-REP-04 | L-REP-04 patient content path remains blocked until this slice is **approved, implemented, accepted** |
| **Verdict** | **RECOMMENDED** (decision-first; implementation not authorized) |

### Option C — Defer L-REP-04

| Field | Content |
| --- | --- |
| **Supported?** | **Yes as interim posture** |
| Scope | Keep `BLOCKER-PP-IDENTITY-01` open; no Portal LMS publication; no identity implementation |
| When required | If Product Owner declines prerequisite work, or cannot decide PD-ID-* account/linking policy |
| Security | Safest short-term (no patient PDF exposure) |
| Dependencies | None |
| Required PDs | Explicit deferral vs proceed with B |
| **Verdict** | **Retain until Option B Product Decisions close and implementation is authorized/accepted** |

---

## 6. Recommendation

```text
RECOMMENDATION = OPTION_B_SEPARATE_PREREQUISITE_SLICE
OPTION_A = REJECTED
OPTION_C = INTERIM_DEFER_L_REP_04_UNTIL_PREREQUISITE_DONE
PROVISIONAL_ID = L-PORTAL-01 (UNAPPROVED)
```

1. **Reject Option A** — no verified mechanism exists.  
2. **Adopt Option B packaging** — close Product Decisions PD-ID-* for a bounded `L-PORTAL-01`, then authorize a separate identity implementation (not L-REP-04).  
3. **Keep Option C posture for L-REP-04** — do not authorize L-REP-04 patient publication until identity is accepted.

Do **not** expand L-REP-04 to silently include identity without an explicit Product Owner packaging decision (already listed as alternate in prior readiness; prefer separate slice for testability and auth ownership clarity).

---

## 7. Unresolved Product Owner decisions

Authoritative open list: [enterprise-lms-patient-portal-identity-decision-package.md](./enterprise-lms-patient-portal-identity-decision-package.md) (`PD-ID-*`).

Cannot be derived from PD-PP-11 alone: how accounts are created, how linkage is verified, cardinality/conflict rules, token/session model details, ownership confirmation, and whether self-registration UX is in scope.

---

## 8. Status stamps

```text
BLOCKER-PP-IDENTITY-01 = OPEN
PRODUCT_DECISIONS_CLOSED_L_REP_04_AUTHORIZED = PRESERVED
L_REP_04_IMPLEMENTATION_NOT_AUTHORIZED
OPTION_A_REJECTED
OPTION_B_DIRECTION_APPROVED
PRODUCT_DECISIONS_CLOSED_L_PORTAL_01 = PRESERVED
L_PORTAL_01_IMPLEMENTATION_AUTHORIZATION = GRANTED
AUDIT_EVENT_CONTRACT = RATIFIED_APPROVE_WITH_EDITS
RUNTIME_IMPLEMENTATION = NOT_STARTED
BLOCKER-PP-IDENTITY-01 = OPEN
L_REP_04_IMPLEMENTATION = NOT_AUTHORIZED
ACCEPTED_L_REP_03_CUT_D = PRESERVED
CUT_C_UNCHANGED
LEGACY_PATHOLOGY = UNCHANGED
APPLICATION_RUNTIME_UNCHANGED_BY_THIS_AUDIT
NO_APPLICATION_TESTS_EXECUTED
BOUNDED_IMPLEMENTATION_PLAN = RECORDED_AWAITING_EXPLICIT_APPROVAL
NEXT_GATE = EXPLICIT_APPROVAL_OF_BOUNDED_IMPLEMENTATION_PLAN
```

---

## 9. Mandatory stop

**STOP.** Runtime identity gap (`BLOCKER-PP-IDENTITY-01`) remains **OPEN**. Current program gate is bounded plan/security review ([implementation readiness](./enterprise-lms-patient-portal-identity-implementation-readiness.md)).  
Do **not** implement authentication, patient linking, or L-REP-04 from this audit alone.
