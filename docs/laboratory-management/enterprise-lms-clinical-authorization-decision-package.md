# L-AUTH-01 — Clinical Authorization  
# Product Decision Package

**Date:** 2026-10-12  
**Mode:** PRODUCT DECISION PREPARATION ONLY — no application code, schema, migrations, APIs, UI, permissions seeding/grants, audit allowlist changes, Result status changes, L-VER/L-TST changes, or workflows modified  

**Discovery evidence:** [enterprise-lms-clinical-authorization-discovery-audit.md](./enterprise-lms-clinical-authorization-discovery-audit.md)

**Upstream certified boundary:**

```text
Draft → TechnicalVerified   (L-VER-01)
TechnicalVerified ≠ Clinically Authorized ≠ Final ≠ Released ≠ Patient-visible
```

**Decision status vocabulary (this package):**

| Label | Meaning |
|---|---|
| **OPEN** | Product Owner has not decided |
| **RECOMMENDED** | Engineering recommendation for PO consideration — **not approved** |
| **DECISION REQUIRED** | Blocking clarity needed before implementation authorization |
| **APPROVED** | Used **only** for already-closed upstream decisions (not new L-AUTH stamps) |

**No PD-AUTH / AD-AUTH item in this document is APPROVED for L-AUTH-01 implementation.**

---

## 1. Already certified behavior (do not reopen)

| Item | Status |
|---|---|
| L-TST-01A Draft Result SoT | **APPROVED EXISTING** |
| L-VER-01 Draft → `TechnicalVerified` | **APPROVED EXISTING** (implemented) |
| Technical Verification ≠ Clinical Authorization | **APPROVED EXISTING** (PD-VER-07/17) |
| L-AUTH-01 is a separate future slice | **APPROVED EXISTING** (PD-VER-17, PD-TST-10) |
| Critical = L-CRT-01; Reporting separate; Amendments separate | **APPROVED EXISTING** |
| Platform `audit_log` is audit SoT | **APPROVED EXISTING** |
| LaboratoryApi owns LMS Result domain | **APPROVED EXISTING** |
| No production role grants from decision docs | **APPROVED EXISTING** |
| Do not invent org/section/discipline hierarchy without PO | **APPROVED EXISTING** |
| Admin / role-name ≠ clinical authorizer policy | **APPROVED EXISTING** principle (PD-TST-10 / PD-VER-05) |
| OrderTest remains Ordered; no Specimen/Collection/Receiving/Barcode mutation from Result mutations | **APPROVED EXISTING** |

---

## 2. Repository facts (summary)

| Fact | Evidence |
|---|---|
| Statuses | `Draft`, `TechnicalVerified` only |
| TV metadata | `VerifiedByUserId` / `VerifiedAtUtc` / `VerifiedVersionNumber` |
| Clinical Auth fields / APIs / UI | **Absent** (authorization route stub only) |
| Permissions | `lms.testing.verify` seeded; **no** authorize catalog code; FE `lms.authorization.view` unseeded |
| Catalogue `authorization_required` | Exists; **not** enforced as Clinical Auth SoT |
| Same-person verify↔authorize | **Unruled** in code |
| Pathology / billing | Not LMS Clinical Auth SoT |

---

## 3. PRD requirements (for decision)

| ID | Requirement (summary) |
|---|---|
| PRD-WF-07 | Technical verification then clinical authorization **per test policy** |
| PRD-SM-TEST | … Technical Verified → Authorization Pending → Final … |
| PRD-RES-01 | Distinguish clinical authorization among result statuses |
| PRD-RES-03 | Signatory / discipline / site / delegation matrix |
| Persona | Clinical authorization by pathologist / authorized signatory |
| Same-person | Allowed when properly credentialed; events remain distinct |
| Reporting | Reports follow authorization/release path — not identical to auth event |

---

## 4. Open Product Owner decisions — PD-AUTH-01 …

### PD-AUTH-01 — Authorization work item / grain

| Field | Content |
|---|---|
| **Status** | **OPEN** / **RECOMMENDED** |
| **Question** | What aggregate does Clinical Authorization operate on? |
| **Options** | (A) `LmsResult` + current version (B) OrderTest (C) Panel/order bundle (D) Report object |
| **Recommendation** | **(A)** — reuse Result SoT; bind exact `CurrentVersionNumber` (aligned with L-VER) |
| **Forbidden** | Second Result domain; Pathology LabReport as LMS SoT |

### PD-AUTH-02 — Lifecycle / status model

| Field | Content |
|---|---|
| **Status** | **OPEN** / **DECISION REQUIRED** |
| **Question** | Which governed states and transitions does L-AUTH-01 introduce? |
| **Options** | **(A)** `TechnicalVerified` → `ClinicallyAuthorized` (no pending) · **(B)** `TechnicalVerified` → `AuthorizationPending` → `ClinicallyAuthorized` · **(C)** Authorization recorded as metadata **without** new status (unlikely given PRD SM) · **(D)** Auth collapses into `Final` (**forbidden** without explicit PO expand into Reporting) |
| **Recommendation** | Prefer **(A)** for first slice if pending queue is not operationally required; use **(B)** if PO requires an explicit awaiting-signatory work state |
| **Forbidden** | Silent `TechnicalVerified` → `Final` / Released / patient-visible |

### PD-AUTH-03 — Meaning of Clinically Authorized

| Field | Content |
|---|---|
| **Status** | **OPEN** / **DECISION REQUIRED** |
| **Question** | What does the authorized state mean product-wise? |
| **Must clarify** | Eligible for reporting later? Clinically signed? Not yet released? Patient-visible? |
| **Recommendation** | Means **clinical sign-off of the TechnicalVerified result version**; **does not** publish report or patient portal; **does not** equal Final/Released |
| **Forbidden** | Treating Clinical Auth as report release or patient communication |

### PD-AUTH-04 — Eligibility to authorize

| Field | Content |
|---|---|
| **Status** | **OPEN** / **DECISION REQUIRED** |
| **Question** | When may a Result be clinically authorized? |
| **Baseline candidates** | (1) Status `TechnicalVerified` (2) Version = current = `VerifiedVersionNumber` (3) Order Submitted (4) OrderTest Ordered (5) Specimen Received (6) tenant match (7) operating branch authorized (8) catalogue still eligible / policy |
| **Open** | Whether `authorization_required=false` tests skip Clinical Auth; whether critical workflow must be complete |
| **Forbidden** | Authorizing Draft; authorizing non-current version; inventing eligibility side-effect mutations |

### PD-AUTH-05 — Version binding

| Field | Content |
|---|---|
| **Status** | **OPEN** / **RECOMMENDED** |
| **Question** | What exact version is authorized? |
| **Recommendation** | Persist `AuthorizedVersionNumber` (= `CurrentVersionNumber` at auth) + actor + UTC timestamp on `LmsResult`; do not rewrite `LmsResultVersion` history |
| **Rule candidate** | Reject if `CurrentVersionNumber` ≠ `VerifiedVersionNumber` (data integrity) |
| **Forbidden** | Second versioning system |

### PD-AUTH-06 — Actor / clinical authority model

| Field | Content |
|---|---|
| **Status** | **OPEN** / **DECISION REQUIRED** / **CONFIGURATION** |
| **Question** | Who is allowed to clinically authorize? |
| **Options** | **(A)** Authenticated user + dedicated authorize permission + tenant + branch (mirror L-VER first-slice) · **(B)** Permission + governed signatory/discipline/site matrix · **(C)** External credential registry · **(D)** Role-name mapping (Admin/Doctor) — **forbidden as sole policy** |
| **Recommendation** | If PO wants a bounded first slice **without** inventing hierarchy: **(A)** with explicit honesty that permission ≠ full PRD-RES-03 matrix; else **CONFIGURATION_REQUIRED** for **(B)** before implementation |
| **Forbidden** | Inferring clinical authority from Admin / Doctor / job title / display name alone |

### PD-AUTH-07 — Same-person (Technical Verifier ↔ Clinical Authorizer)

| Field | Content |
|---|---|
| **Status** | **OPEN** / **DECISION REQUIRED** |
| **Question** | May the same person who technically verified also clinically authorize? |
| **Options** | **(A)** Allowed · **(B)** Prohibited · **(C)** Allowed only under governed configuration · **(D)** Different rule by test/section/discipline |
| **PRD note** | Allows when properly credentialed; events remain distinct |
| **Recommendation** | Present **(A)** as PRD-aligned default **only if** PD-AUTH-06 authority is explicit; else prefer **(C)** once config exists. Do **not** silently implement **(B)** |
| **Note** | PD-VER-06 (draft author may verify) does **not** decide this pair |

### PD-AUTH-08 — Two-person / dual control

| Field | Content |
|---|---|
| **Status** | **OPEN** |
| **Question** | Is a mandatory second reviewer required beyond same-person policy? |
| **Recommendation** | **Not** in first L-AUTH-01 unless PO requires; keep distinct from PD-AUTH-07 |
| **Forbidden** | Inventing dual-control workflow without policy |

### PD-AUTH-09 — Catalogue `authorization_required`

| Field | Content |
|---|---|
| **Status** | **OPEN** / **DECISION REQUIRED** |
| **Question** | How does catalogue `authorization_required` affect L-AUTH-01? |
| **Options** | **(A)** Ignored in first slice (all TV results need Clinical Auth) · **(B)** If false, Clinical Auth skipped / auto-not-required path · **(C)** If true/null ambiguous → block until configured |
| **Recommendation** | **(C)** honesty for required-but-missing; do not invent default clinical policy |
| **Forbidden** | Silent skip that looks like clinical authorization completed |

### PD-AUTH-10 — Pre-authorization validation

| Field | Content |
|---|---|
| **Status** | **OPEN** / **RECOMMENDED** |
| **Question** | What must be validated at authorize time? |
| **Recommendation** | Structural: status TechnicalVerified; version bind; eligibility; actor authority; branch/tenant. **Do not** invent reference ranges, abnormal/critical thresholds, diagnosis, or treatment text |
| **Forbidden** | Hard-coded clinical interpretation |

### PD-AUTH-11 — Critical Results boundary (L-CRT-01)

| Field | Content |
|---|---|
| **Status** | **OPEN** / **DECISION REQUIRED** / **L-CRT-01 BOUNDARY** |
| **Question** | Relationship between Clinical Auth and critical handling? |
| **Options** | **(A)** Independent (auth may proceed) · **(B)** Critical complete is prerequisite · **(C)** Auth triggers critical notify · **(D)** Out of L-AUTH entirely (document only) |
| **Recommendation** | **(D)** for implementation scope + choose **(A)** or **(B)** as product rule without implementing L-CRT-01 |
| **Forbidden** | Implementing critical cases/escalation in L-AUTH-01 |

### PD-AUTH-12 — Reporting / Final / release boundary

| Field | Content |
|---|---|
| **Status** | **OPEN** / **RECOMMENDED** |
| **Question** | Does Clinical Authorization create Final / release / patient visibility / report PDF? |
| **Recommendation** | **No** — Clinical Auth only; Reporting/Final/Release remain separate future slice(s) |
| **Forbidden** | Silent report publish; patient portal final exposure; PDF generation as side effect |

### PD-AUTH-13 — Rejection / return / revoke

| Field | Content |
|---|---|
| **Status** | **OPEN** / **DECISION REQUIRED** |
| **Question** | Can authorization be rejected, cancelled, revoked, or returned to TechnicalVerified/Draft? |
| **Options** | **(A)** Authorize-forward-only (mirror PD-VER-10) · **(B)** Reject back to TechnicalVerified with reason · **(C)** Revoke authorized with reason · **(D)** Defer all reverse paths to Amendments |
| **Recommendation** | **(A)** or **(D)** for first slice; do not invent amendment workflow |
| **Forbidden** | Silent TechnicalVerified ↔ Draft edits after auth without governed amendment |

### PD-AUTH-14 — Amendment boundary

| Field | Content |
|---|---|
| **Status** | **OPEN** / **RECOMMENDED** |
| **Rule candidate** | Post-authorization correction belongs to future Amendments; L-AUTH-01 does not implement amendment tables/APIs |
| **Open** | Whether amendment requires re-TV and/or re-authorization (document for later) |

### PD-AUTH-15 — Concurrency

| Field | Content |
|---|---|
| **Status** | **OPEN** / **RECOMMENDED** |
| **Recommendation** | Reuse RowVersion; stale → `409 concurrency_conflict`; already authorized → safe conflict code; no silent overwrite |

### PD-AUTH-16 — Idempotency

| Field | Content |
|---|---|
| **Status** | **OPEN** / **RECOMMENDED** |
| **Recommendation** | Mutation idempotent; candidate operation `authorize_result`; same key+hash replay; different hash → `409 idempotency_conflict`; reuse `lms_result_idempotency` |

### PD-AUTH-17 — Audit

| Field | Content |
|---|---|
| **Status** | **OPEN** / **RECOMMENDED** |
| **SoT** | Platform `audit_log` only |
| **Candidate primary action** | `AUTHORIZE_RESULT` |
| **Capture** | Actor, result id, version, tenant, branch, outcome context; fail-closed |
| **Forbidden** | Second audit store; success without audit |

### PD-AUTH-18 — Permission catalogue

| Field | Content |
|---|---|
| **Status** | **OPEN** / **RECOMMENDED** |
| **Candidate codes** | `lms.results.authorize` (preferred semantic) **or** `lms.testing.authorize` (keep under testing module) |
| **FE note** | `lms.authorization.view` exists as string only — resolve naming vs seed |
| **Rule** | Catalog definition only; **no** production role grants in L-AUTH decision/implementation unless separate grant task |
| **Forbidden** | Using `lms.testing.verify` / `manage` / `result` as Clinical Auth authority |

### PD-AUTH-19 — Branch / lab authority

| Field | Content |
|---|---|
| **Status** | **OPEN** / **RECOMMENDED** |
| **Recommendation** | First slice: tenant + authorized operating branch (like L-VER) |
| **Deferred** | Section/discipline/site matrix unless PD-AUTH-06 chooses config-backed model |
| **Forbidden** | Inventing L0 org hierarchy to unblock |

### PD-AUTH-20 — UI / Work Queue

| Field | Content |
|---|---|
| **Status** | **OPEN** / **RECOMMENDED** |
| **Recommendation** | Prefer Testing Work Queue → TechnicalVerified Result detail → Clinical Authorization action (extend L-VER UX) |
| **Stub route** | `/dashboard/lms/results/authorization` may become presentation surface **only** if same Result SoT; remains stub until implementation authorization |
| **Forbidden** | Duplicate operational worklist without evidence; fake KPIs / awaiting-authorization counts; inventing clinical statuses in UI |

---

## 5. Architecture decisions — AD-AUTH-01 … (recommendations only)

| ID | Decision | Status |
|---|---|---|
| **AD-AUTH-01** | LaboratoryApi remains owner of Clinical Authorization for LMS Results | **RECOMMENDED** |
| **AD-AUTH-02** | Reuse `LmsResult` / `LmsResultVersion`; no duplicate Result domain | **RECOMMENDED** |
| **AD-AUTH-03** | Clinical Authorization state/metadata belongs on LMS Result domain | **RECOMMENDED** |
| **AD-AUTH-04** | No OrderTest lifecycle mutation | **RECOMMENDED** (reaffirm) |
| **AD-AUTH-05** | No Specimen / CollectionTask / Receiving / Barcode mutation | **RECOMMENDED** (reaffirm) |
| **AD-AUTH-06** | No Pathology LabReport reuse as LMS Clinical Auth SoT | **RECOMMENDED** (reaffirm) |
| **AD-AUTH-07** | Platform `audit_log` remains sole audit SoT | **RECOMMENDED** (reaffirm) |
| **AD-AUTH-08** | Permission catalogue ≠ clinical authority matrix unless PO explicitly equates them for first slice | **RECOMMENDED** |
| **AD-AUTH-09** | Clinical Authorization must not implement Reporting/Final/Release/patient publish | **RECOMMENDED** |
| **AD-AUTH-10** | Clinical Authorization must not implement Critical Results (L-CRT-01) | **RECOMMENDED** |
| **AD-AUTH-11** | Clinical Authorization must not implement Amendments | **RECOMMENDED** |
| **AD-AUTH-12** | Reuse Testing Work Queue / Result detail as primary UX unless PO requires separate queue | **RECOMMENDED** |
| **AD-AUTH-13** | No production role grants in L-AUTH-01 decision/implementation without separate grant task | **RECOMMENDED** (reaffirm) |
| **AD-AUTH-14** | Do not invent signatory/section/discipline masters inside L-AUTH-01 | **RECOMMENDED** |

---

## 6. Configuration dependencies (decision impact)

| Dependency | Class | Blocks first slice? |
|---|---|---|
| Signatory / authorized personnel list | **MISSING** | **Yes** if PD-AUTH-06 = matrix; **No** if PO accepts permission+branch honesty |
| Discipline / section / specialty | **MISSING** | Same as above |
| Catalogue `authorization_required` semantics | **AMBIGUOUS** | **Yes** until PD-AUTH-09 closed |
| Credential / delegation registry | **MISSING** | Blocks only if required by PD-AUTH-06/07(C/D) |
| Critical completion gate | **MISSING** | Blocks only if PD-AUTH-11 = prerequisite |
| Report templates | **NOT REQUIRED** | If Reporting deferred |

If PO selects a matrix-backed authority model **without** providing a governed config source, final gate becomes **CONFIGURATION_REQUIRED** (implementation must not invent tables to fake compliance).

---

## 7. Candidate L-AUTH-01 implementation scope (not authorized)

**Only after Product Owner closes PD-AUTH / AD-AUTH and issues an implementation authorization stamp.**

### 7.1 Candidate IN

- Governed status transition per closed PD-AUTH-02/03  
- Authorization metadata (actor, timestamp, version) on Result  
- Exact version binding  
- Eligibility checks (TV + context)  
- Authority validation per closed PD-AUTH-06/07  
- Permission catalogue entry (no role grants)  
- Platform audit action + AuthService allowlist wiring  
- Idempotency + RowVersion concurrency  
- Testing Work Queue / Result detail authorize action  
- Automated tests (matrix below)  
- PRE-UAT + Manual UAT after implementation authorization  

### 7.2 Explicit OUT

- Critical Results (L-CRT-01)  
- Reporting / Final Release / patient communication / PDF  
- Amendments / revoke-as-amendment workflow (unless PO includes reject-only)  
- Instrument / Runs / QC / Autoverification  
- Referral  
- Billing  
- Pathology migration  
- Production role grants  
- Order / OrderTest / Specimen / Collection / Receiving / Barcode lifecycle changes  
- Invented clinical thresholds / interpretation  

---

## 8. Future automated test matrix (do not execute — no implementation)

| Case | Expectation |
|---|---|
| Valid TechnicalVerified → authorize | Success; metadata + status per PO |
| Draft cannot authorize | Reject |
| Wrong / non-current version | Reject |
| Unauthorized actor | Reject |
| Wrong branch / tenant | Reject |
| Same-person rule | Per PD-AUTH-07 |
| Already authorized | Safe conflict / idempotent replay |
| RowVersion conflict | 409 |
| Idempotency replay same hash | Safe |
| Idempotency hash conflict | 409 |
| Audit failure | Fail-closed; no partial auth |
| Historical versions immutable | No rewrite |
| Order / OrderTest / Collection / Specimen / Receiving / Barcode / Pathology unchanged | Assert |
| No clinical threshold invention | Assert / code review |
| No Reporting/Release leakage | Assert |

---

## 9. Manual UAT considerations (future)

- Authorize only TechnicalVerified results  
- Confirm UI does **not** claim Final / Released / patient-visible  
- Confirm TV and Clinical Auth remain distinct actions/events  
- Exercise same-person policy as closed  
- Permission denied path for users without authorize permission  
- Branch denial path  
- Concurrency / double-submit  
- Audit visible in platform audit trail  
- Upstream OrderTest/Specimen unchanged  

---

## 10. Risks / blockers

| Risk | Mitigation |
|---|---|
| Collapsing Auth into Final/Release | PD-AUTH-03/12; AD-AUTH-09 |
| Using Admin/Doctor as authorizer | PD-AUTH-06 forbidden path |
| Using `lms.testing.verify` for auth | PD-AUTH-18 |
| Signatory matrix expected but missing | PD-AUTH-06 → CONFIGURATION_REQUIRED |
| Fake authorization queue KPIs | PD-AUTH-20 |
| Critical/reporting scope creep | PD-AUTH-11/12 |
| Same-person ambiguity vs PRD | PD-AUTH-07 must close explicitly |

---

## 11. Acceptance / UAT implications

Implementation authorization must follow a future **decision closure** document (not this package) that marks PD-AUTH/AD-AUTH **APPROVED** for the chosen first-slice boundary. Until then:

- No migrations  
- No APIs  
- No UI  
- No permission seeds/grants  
- No L-CRT-01 / Reporting start  

---

## 12. Exact recommended next gate

```text
PRODUCT OWNER reviews this package
  ↓
Closes PD-AUTH-01 … PD-AUTH-20 and AD-AUTH-01 … AD-AUTH-14
  (or subset required for first slice)
  ↓
Issues L-AUTH-01 decision closure / implementation authorization stamp
  ↓
ONLY THEN — separate implementation task
```

**If** PO requires full PRD-RES-03 signatory/discipline matrix **and** no governed config source exists → closure status must be **CONFIGURATION_REQUIRED** (do not implement).

**If** PO accepts bounded first slice (permission + branch + explicit Clinical Auth state, Reporting/Critical out) → proceed to implementation authorization after closure.

---

## 13. Package status

# DISCOVERY_COMPLETE_READY_FOR_PRODUCT_OWNER_DECISION

**Stop condition met:** discovery audit + this decision package only.  
**Do not** start L-AUTH-01 implementation.  
**Do not** proceed to L-CRT-01.  
Wait for explicit Product Owner approval of L-AUTH-01 decisions.
