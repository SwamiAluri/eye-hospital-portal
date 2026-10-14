# L-AUTH-01 — Clinical Authorization  
# Product Owner Decision Closure

**Date:** 2026-10-12  
**Slice:** L-AUTH-01 (Clinical Authorization — bounded first slice — decision closure only)  
**Mode:** DOCUMENTATION / PRODUCT OWNER APPROVAL ONLY — no application source, schema, migrations, APIs, DTOs, services, UI, routes, permissions seeding/grants, audit allowlist changes, Result status enums, Result entities, L-VER-01, L-TST-01A, CollectionTask, Specimen, Receiving, Barcode, Orders, OrderTest, Pathology, Billing, Reporting, Critical Results, Amendments, Instrument/Runs/QC, or Referral implementation  

**Decision package:** [enterprise-lms-clinical-authorization-decision-package.md](./enterprise-lms-clinical-authorization-decision-package.md)  
**Discovery audit:** [enterprise-lms-clinical-authorization-discovery-audit.md](./enterprise-lms-clinical-authorization-discovery-audit.md) *(preserved)*  
**Upstream:** **L-TST-01A ACCEPTED** · **L-VER-01** Technical Verification (`Draft` → `TechnicalVerified`) · L-COL-01B … L-COL-01E ACCEPTED  
**Authoritative PRD/BRD:** Enterprise LMS PRD/BRD v1.0  

```text
L-TST-01A ACCEPTED (Draft SoT)
  → L-VER-01 (Draft → TechnicalVerified)
  → Discovery audit
  → Decision package (DISCOVERY_COMPLETE_READY_FOR_PRODUCT_OWNER_DECISION)
  ↓
PD-AUTH-* / AD-AUTH-* (THIS DOCUMENT)
  ← PRODUCT OWNER APPROVED (2026-10-12)
  ↓
L-AUTH-01 — Clinical Authorization (bounded first slice)
  ← AUTHORIZED FOR SEPARATE IMPLEMENTATION TASK
  ← NOT IMPLEMENTED BY THIS DOCUMENT
  ↓
Later (unauthorized here): L-CRT-01 · Reporting / Final / Release · Amendments · Instrument/Runs/QC · Referral · Billing · production role grants · PRD-RES-03 signatory matrix
```

---

## 1. Document purpose

This document formally records Product Owner approval of the L-AUTH-01 Clinical Authorization decision set, closes the product/architecture decision gate for the **bounded first Clinical Authorization slice only**, and authorizes a **separate** implementation task for:

**L-AUTH-01 — Clinical Authorization**

**This document does not implement L-AUTH-01.**

This closure supersedes historical **OPEN** / **RECOMMENDED** statuses in the decision package for this bounded first slice. The discovery audit and decision package remain preserved historical evidence.

---

## 2. Product Owner approval statement

Product Owner has **explicitly approved** the recommended L-AUTH-01 Product Decisions from [enterprise-lms-clinical-authorization-decision-package.md](./enterprise-lms-clinical-authorization-decision-package.md) with the statement:

> **APPROVED — proceed with the recommended L-AUTH-01 Product Decisions.**

PD-AUTH-01 through PD-AUTH-20 and AD-AUTH-01 through AD-AUTH-14 are therefore **APPROVED** as recorded below. Decisions are **not broadened** beyond this stamp.

| Class | Meaning |
|---|---|
| **APPROVED** | Product Owner approved for L-AUTH-01 first-slice closure, or reaffirmed upstream |
| **APPROVED FOR BOUNDED FIRST SLICE** | Approved within the bounded first Clinical Authorization slice only |
| **APPROVED FOR FIRST SLICE** | Approved authority/catalogue boundary for L-AUTH-01 only |
| **DEFERRED** | Explicitly later than L-AUTH-01 (separate Product Decision / slice) |
| **OUT_OF_SCOPE** | Not part of L-AUTH-01 |

**Gate determination:**

# PRODUCT_DECISIONS_CLOSED_L_AUTH_01_AUTHORIZED

**L-AUTH-01 is authorized as a separate future implementation task.**

This stamp does **not** mean `IMPLEMENTATION_COMPLETE`, `PRE_UAT`, `UAT_READY`, or `ACCEPTED` — no implementation has occurred in this task.

---

## 3. Authoritative source hierarchy

| Priority | Source | Role |
|---|---|---|
| 1 | This decision closure | Authoritative L-AUTH-01 product/architecture stamp |
| 2 | Enterprise LMS PRD/BRD v1.0 | Functional SoT |
| 3 | [enterprise-lms-clinical-authorization-decision-package.md](./enterprise-lms-clinical-authorization-decision-package.md) | Pre-approval decision package (superseded where this stamp differs) |
| 4 | [enterprise-lms-clinical-authorization-discovery-audit.md](./enterprise-lms-clinical-authorization-discovery-audit.md) | Discovery evidence |
| 5 | [enterprise-lms-verification-decision-closure.md](./enterprise-lms-verification-decision-closure.md) + L-VER-01 implementation | Certified TechnicalVerified SoT |
| 6 | [enterprise-lms-testing-acceptance-closure.md](./enterprise-lms-testing-acceptance-closure.md) + Testing decision closure | Certified Draft SoT |
| 7 | L-COL-01B … 01E acceptance / decision closures | Certified upstream SoT — **do not reopen** |
| 8 | LaboratoryApi Result domain | Runtime foundation; not a license to invent Clinical Authorization SoT beyond this stamp |

Where discovery or package recommendations differ from this stamp, **this closure prevails**.

---

## 4. Certified upstream boundaries

| # | Boundary | Status |
|---|---|---|
| A | L-TST-01A is **ACCEPTED** | **APPROVED** |
| B | L-VER-01 `Draft` → `TechnicalVerified` is certified and must not be altered by this closure | **APPROVED** |
| C | L-VER-01 `TechnicalVerified` means technically/analytically verified — **not** clinically authorized, Final, Released, or patient-visible | **APPROVED** |
| D | Order remains Submitted/Cancelled per existing order lifecycle | **APPROVED** |
| E | OrderTest remains **Ordered** | **APPROVED** |
| F | Clinical Authorization **MUST NOT** mutate OrderTest | **APPROVED** |
| G | Clinical Authorization **MUST NOT** mutate CollectionTask, Specimen, Receiving, Barcode, Accession | **APPROVED** |
| H | Rejected specimens remain ineligible | **APPROVED** |
| I | Pathology remains separate | **APPROVED** |
| J | LaboratoryApi remains LMS Result / Clinical Authorization domain owner | **APPROVED** |
| K | Platform `audit_log` remains audit SoT | **APPROVED** |
| L | No production role grants from this decision task | **APPROVED** |
| M | Do not invent a new organization/site/section/discipline hierarchy | **APPROVED** |
| N | Technical Verification and Clinical Authorization remain **distinct** events | **APPROVED** |
| O | Do **not** collapse `TechnicalVerified` into Final / Released / patient-visible | **APPROVED** |
| P | Critical Results remain L-CRT-01 | **APPROVED** |
| Q | Reporting / Final / Release remain a future separate slice | **APPROVED** |
| R | Amendments remain a future separate slice | **APPROVED** |
| S | Instrument / Runs / QC / autoverification remain outside this slice | **APPROVED** |

**Do not alter L-TST-01A or L-VER-01.**

---

## 5. PRD Result state model (closed for L-AUTH-01)

Certified / approved sequence for this bounded slice:

```text
Result Draft
    ↓
TechnicalVerified          ← L-VER-01 (certified; do not alter)
    ↓
ClinicallyAuthorized       ← L-AUTH-01 introduces this transition only
    ↓
(Final / Released / patient-visible)  ← Reporting / release (unauthorized here)
```

| Field | Content |
|---|---|
| **Internal / governed Result state** | `ClinicallyAuthorized` |
| **Display label** | Clinically Authorized |
| **Product meaning** | Clinical sign-off of the TechnicalVerified Result version |
| **Does NOT mean** | Final; Released; patient-visible; report published; PDF generated; patient communication completed |

**No `AuthorizationPending` state** is required for the bounded first slice.

**Not implemented by this document.** Future implementation task introduces `ClinicallyAuthorized` and authorization metadata per this stamp.

---

## 6. Product decisions — PD-AUTH-01 … PD-AUTH-20

### PD-AUTH-01 — Authorization work item / grain

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Rule** | Clinical Authorization operates on the existing LMS **Result aggregate** (`LmsResult`) and authorizes the exact **current Result version** |
| **SoT** | The Result aggregate remains the LMS Result SoT |
| **Forbidden** | Second Result domain; Pathology LabReport as LMS Clinical Authorization SoT |

### PD-AUTH-02 — Lifecycle / status

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Transition** | `TechnicalVerified` → `ClinicallyAuthorized` |
| **Pending** | No `AuthorizationPending` state for the bounded first slice |
| **Forbidden** | `TechnicalVerified` → `Final`; introducing Final or Released as part of L-AUTH-01 |

### PD-AUTH-03 — Meaning of Clinically Authorized

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Meaning** | Clinical sign-off of the TechnicalVerified Result version |
| **Does NOT mean** | Final; Released; patient-visible; report published; PDF generated; patient communication completed |
| **Separation** | Clinical Authorization and Reporting/Release remain separate capabilities |

### PD-AUTH-04 — Eligibility

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Rule** | A Result may be clinically authorized only when **all** hold: (1) Result status = `TechnicalVerified`; (2) `CurrentVersionNumber` = `VerifiedVersionNumber`; (3) Order status = `Submitted`; (4) OrderTest status = `Ordered`; (5) linked Specimen status = `Received`; (6) tenant matches; (7) operating branch is authorized for the actor; (8) existing LMS Result eligibility remains valid; (9) no invalid upstream lifecycle condition exists |
| **Not eligible** | Draft results; non-current versions |
| **Forbidden** | Side-effect mutations to Order, OrderTest, CollectionTask, Specimen, Receiving, or Barcode |

### PD-AUTH-05 — Version binding

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Rule** | Clinical Authorization binds to the current Result version at the time of authorization |
| **Persist** | `AuthorizedVersionNumber`, `AuthorizedByUserId`, `AuthorizedAtUtc` |
| **Integrity** | `AuthorizedVersionNumber` must equal `CurrentVersionNumber`; authorization must correspond to the previously TechnicalVerified version; if `CurrentVersionNumber` ≠ `VerifiedVersionNumber` → fail closed |
| **Forbidden** | Rewriting `LmsResultVersion` history; creating a second versioning system |

### PD-AUTH-06 — Clinical authority model

| Field | Content |
|---|---|
| **Status** | **APPROVED FOR BOUNDED FIRST SLICE** |
| **Rule** | Authenticated user + dedicated Clinical Authorization permission + tenant authorization + authorized operating branch |
| **Runtime gate** | Dedicated permission |
| **Honesty** | This slice does **not** claim full PRD-RES-03 signatory / discipline / specialty / delegation matrix coverage. No such clinical authority hierarchy currently exists as an LMS governed SoT |
| **Forbidden** | Inferring authority from Admin role, Doctor role, job title, display name, Pathology role name, or arbitrary user metadata; inventing a signatory/discipline/credential hierarchy |
| **Future** | A future governed authority matrix may supersede/extend this bounded first slice through a **separate** Product Decision. This decision does **not** create a future-proof clinical credential model |

### PD-AUTH-07 — Same-person Technical Verifier / Clinical Authorizer

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Rule** | The same authenticated user **MAY** perform Technical Verification and Clinical Authorization for the same Result, provided the user satisfies the L-AUTH-01 authorization rule |
| **Implication** | Draft author → may Technical Verify (L-VER-01) → may Clinical Authorize (L-AUTH-01) when required permissions and branch authorization are satisfied |
| **Audit** | The two events remain distinct and separately audited |
| **Forbidden** | Mandatory separation of persons |

### PD-AUTH-08 — Two-person / dual control

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Rule** | No mandatory two-person / dual-control requirement in L-AUTH-01 |
| **Forbidden** | Inventing a second-reviewer workflow |

### PD-AUTH-09 — Catalogue `authorization_required`

| Field | Content |
|---|---|
| **Status** | **APPROVED FOR FIRST SLICE** |
| **Rule** | Do **not** use the existing catalogue `authorization_required` field as an authoritative Clinical Authorization skip/auto-complete rule |
| **Workflow** | Eligible TechnicalVerified Results follow the Clinical Authorization workflow |
| **Flag status** | Existing catalogue flag remains **non-authoritative** until a future Product Decision explicitly defines and governs its semantics |
| **Forbidden** | Silently skipping Clinical Authorization; treating absence/false value as “already authorized” |

### PD-AUTH-10 — Pre-authorization validation

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Rule** | Clinical Authorization performs **structural/domain validation only** |
| **Validate** | TechnicalVerified state; exact version binding; existing Result eligibility; Order Submitted; OrderTest Ordered; Specimen Received; tenant authorization; operating branch authorization; Clinical Authorization permission |
| **Forbidden** | Reference-range calculations; abnormal flags; critical thresholds; diagnosis; treatment interpretation; medical interpretation; hard-coded clinical rules |
| **Nature** | Sign-off boundary — **not** a new clinical interpretation engine |

### PD-AUTH-11 — Critical Results

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Boundary** | Critical Results remain a separate future slice: **L-CRT-01** |
| **L-AUTH-01 does NOT implement** | Critical detection; critical notification; escalation; acknowledgement; critical-result workflow |
| **Prerequisite** | Do not introduce a Critical Result prerequisite unless explicitly required by this approved first-slice decision (it is not) |
| **Scope** | Critical Results are outside L-AUTH-01 implementation scope; relationship may be revisited in the L-CRT-01 Product Decision gate |

### PD-AUTH-12 — Reporting / Final / Release

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Rule** | Clinical Authorization does **not**: create Final status; release result; publish report; generate PDF; send patient communication; make result patient-visible |
| **Separation** | Reporting / Final / Release remain separate future capability slices |

### PD-AUTH-13 — Rejection / return / revoke

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Rule** | L-AUTH-01 is **forward-only**: `TechnicalVerified` → `ClinicallyAuthorized` |
| **Not implemented** | Return to Draft; return to TechnicalVerified; revoke; cancel; reject-to-draft workflow |
| **Future** | Correction/reversal belongs to the appropriate Amendments/correction Product Decision |

### PD-AUTH-14 — Amendment boundary

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Rule** | Post-authorization correction is outside L-AUTH-01; amendment/correction is a separate future slice |
| **Forbidden in this slice** | Amendment tables; amendment APIs; reversion; re-authorization workflow; amendment UI |
| **Future policy** | Any future amendment policy must separately decide whether re-Technical Verification and re-Authorization are required |

### PD-AUTH-15 — Concurrency

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Rule** | Reuse existing LMS optimistic concurrency via Result `RowVersion` |
| **Stale RowVersion** | → `409 concurrency_conflict` |
| **Already ClinicallyAuthorized** | → safe conflict / `already_authorized` behavior |
| **Forbidden** | Silent overwrite |
| **Convention** | Use established LMS error conventions |

### PD-AUTH-16 — Idempotency

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Rule** | Clinical Authorization mutation must be idempotent; reuse existing LMS Result idempotency mechanism |
| **Operation** | `authorize_result` |
| **Behavior** | Same idempotency key + same request hash → safe replay; same key + different request hash → `409 idempotency_conflict` |
| **Forbidden** | Creating a second idempotency mechanism |

### PD-AUTH-17 — Audit

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **SoT** | Platform `audit_log` remains the sole audit source of truth |
| **Primary action** | `AUTHORIZE_RESULT` |
| **Capture** | Actor; Result; authorized version; tenant; operating branch; timestamp; outcome/context required by existing platform audit conventions |
| **Fail-closed** | If audit persistence fails, Clinical Authorization must not remain successfully committed |
| **Forbidden** | Second LMS-specific audit store |

### PD-AUTH-18 — Permission catalogue

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Permission** | `lms.results.authorize` |
| **Scope of this decision** | Permission catalogue entry only |
| **Must NOT reuse as Clinical Authorization authority** | `lms.testing.verify`; `lms.testing.manage`; `lms.testing.result` |
| **Forbidden** | Production role grants; assigning this permission to Admin, Doctor, Lab Technician, or any other role; silently granting it to the current UAT user |
| **Role/user assignment** | Separate authorization decision/task |

### PD-AUTH-19 — Branch / lab authority

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Rule** | Tenant isolation applies; operating branch authorization applies; reuse existing `ValidateUserBranchAsync` / established LMS branch authorization pattern |
| **Forbidden** | New organization hierarchy; section hierarchy; discipline hierarchy; specialty hierarchy; laboratory authority hierarchy |
| **Future** | Those remain future configuration/product decisions |

### PD-AUTH-20 — UI / Work Queue

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Primary surface** | Existing Testing Work Queue and Result Detail |
| **Preferred flow** | Testing Work Queue → TechnicalVerified Result → Result Detail → Clinical Authorization |
| **Stub route** | `/dashboard/lms/results/authorization` may become a presentation/navigation surface during implementation **only if** it continues to use the same `LmsResult` SoT |
| **Forbidden** | Duplicate operational worklist unless later evidence requires it; fake authorization counts; awaiting-authorization KPIs; dashboard metrics |

---

## 7. Architecture decisions — AD-AUTH-01 … AD-AUTH-14

| ID | Decision | Status |
|---|---|---|
| **AD-AUTH-01** | LaboratoryApi remains the owner of LMS Clinical Authorization | **APPROVED** |
| **AD-AUTH-02** | Reuse `LmsResult` and `LmsResultVersion`; no duplicate Result domain | **APPROVED** |
| **AD-AUTH-03** | Clinical Authorization state/metadata belongs to the LMS Result domain | **APPROVED** |
| **AD-AUTH-04** | No OrderTest lifecycle mutation | **APPROVED** |
| **AD-AUTH-05** | No Specimen / CollectionTask / Receiving / Barcode mutation | **APPROVED** |
| **AD-AUTH-06** | No Pathology LabReport reuse as LMS Clinical Authorization SoT | **APPROVED** |
| **AD-AUTH-07** | Platform `audit_log` remains the sole audit SoT | **APPROVED** |
| **AD-AUTH-08** | Permission catalogue is the bounded first-slice runtime authority mechanism; it does **not** imply a full clinical credential matrix | **APPROVED** |
| **AD-AUTH-09** | Clinical Authorization does not implement Reporting / Final / Release / patient publication | **APPROVED** |
| **AD-AUTH-10** | Clinical Authorization does not implement Critical Results | **APPROVED** |
| **AD-AUTH-11** | Clinical Authorization does not implement Amendments | **APPROVED** |
| **AD-AUTH-12** | Reuse Testing Work Queue / Result Detail as primary UX | **APPROVED** |
| **AD-AUTH-13** | No production role grants in L-AUTH-01 | **APPROVED** |
| **AD-AUTH-14** | Do not invent signatory / section / discipline masters | **APPROVED** |

---

## 8. Configuration / authority limitation

| Item | Decision |
|---|---|
| Full PRD-RES-03 signatory / discipline / specialty / delegation matrix | **NOT implemented** in L-AUTH-01 |
| Bounded first-slice authority gate | Dedicated permission + tenant + authorized operating branch |
| Product Owner scope decision | **Explicit** — first slice uses permission + branch honesty |
| Configuration tables to simulate missing signatory matrix | **Forbidden** |
| Claim of full PRD-RES-03 authority coverage | **Forbidden** |
| Future expansion to governed signatory / credential / discipline configuration | Requires a **separate** Product Decision |

This is an explicit Product Owner scope decision, not an accidental omission.

---

## 9. Exact L-AUTH-01 implementation boundary

### 9.1 IN SCOPE

Future authorized implementation may contain **only**:

- `TechnicalVerified` → `ClinicallyAuthorized`
- Clinical Authorization metadata
- `AuthorizedVersionNumber`
- `AuthorizedByUserId`
- `AuthorizedAtUtc`
- Exact version validation
- Existing Result eligibility
- Dedicated permission (`lms.results.authorize`)
- Tenant authorization
- Operating branch authorization
- Idempotency (`authorize_result`)
- RowVersion concurrency
- Platform audit (`AUTHORIZE_RESULT`, fail-closed)
- Fail-closed authorization
- Existing Testing Work Queue integration
- Result Detail Clinical Authorization action
- Permission-aware UI
- Automated tests
- PRE-UAT
- Manual UAT

### 9.2 OUT OF SCOPE

Not authorized by this stamp:

- `AuthorizationPending`
- Final
- Released
- Patient-visible result
- Reporting
- PDF
- Patient communication
- Critical Results (L-CRT-01)
- Amendments
- Revoke
- Return to Draft
- Instrument results
- Runs
- QC
- Autoverification
- Referral
- Billing
- Pathology migration
- Order lifecycle mutation
- OrderTest lifecycle mutation
- Specimen lifecycle mutation
- CollectionTask mutation
- Receiving mutation
- Barcode mutation
- Signatory / discipline / credential matrix
- Production role grants
- Clinical threshold calculation
- Abnormal interpretation
- Critical threshold calculation

---

## 10. Security / permission boundary

| Item | Decision |
|---|---|
| Dedicated permission | `lms.results.authorize` |
| Catalog scope in this stamp | Catalogue entry only (future implementation task) |
| Not Clinical Authorization authority | `lms.testing.verify`, `lms.testing.manage`, `lms.testing.result` |
| Production role grants | **None** authorized |
| Admin / Doctor / Lab Technician / UAT user silent grants | **Forbidden** |
| Role/user assignment | Separate authorization decision/task |
| Authority inference from role names / job titles / display names | **Forbidden** |

This closure does **not** seed permissions or grant roles.

---

## 11. Audit boundary

| Item | Decision |
|---|---|
| SoT | Platform `audit_log` |
| Mutation action | `AUTHORIZE_RESULT` |
| Fail-closed | **Required** — audit failure must not leave authorization successfully committed |
| Capture | Actor; Result; authorized version; tenant; operating branch; timestamp; outcome/context per platform conventions |
| Allowlist change | **Future implementation task only** |
| Out of scope | Second LMS audit store; revoke/return/amendment audit actions for this slice |

---

## 12. Version / concurrency / idempotency boundary

| Concern | Decision |
|---|---|
| Version binding | `AuthorizedVersionNumber` = `CurrentVersionNumber`; must align with previously verified version |
| Integrity fail-closed | `CurrentVersionNumber` ≠ `VerifiedVersionNumber` → reject |
| Version history | Append-only `LmsResultVersion`; no rewrite; no second versioning system |
| Concurrency | Optimistic RowVersion; stale → `409 concurrency_conflict` |
| Already authorized | Safe conflict / `already_authorized`; no silent overwrite |
| Idempotency operation | `authorize_result` |
| Replay | Same key + same hash → safe replay; same key + different hash → `409 idempotency_conflict` |
| Idempotency store | Existing LMS Result idempotency mechanism only |

---

## 13. Decision register (closed for L-AUTH-01)

| ID | Topic | Status |
|---|---|---|
| PD-AUTH-01 | Work item = `LmsResult` + current version | **APPROVED** |
| PD-AUTH-02 | `TechnicalVerified` → `ClinicallyAuthorized` (no pending) | **APPROVED** |
| PD-AUTH-03 | Meaning = clinical sign-off; not Final/Released/patient-visible | **APPROVED** |
| PD-AUTH-04 | Eligibility rules | **APPROVED** |
| PD-AUTH-05 | Version binding + authorization metadata | **APPROVED** |
| PD-AUTH-06 | Actor / authority (user + permission + tenant + branch) | **APPROVED FOR BOUNDED FIRST SLICE** |
| PD-AUTH-07 | Same person may verify and authorize | **APPROVED** |
| PD-AUTH-08 | No mandatory dual control | **APPROVED** |
| PD-AUTH-09 | Catalogue `authorization_required` non-authoritative for skip | **APPROVED FOR FIRST SLICE** |
| PD-AUTH-10 | Structural validation only | **APPROVED** |
| PD-AUTH-11 | Critical Results = L-CRT-01 (out) | **APPROVED** |
| PD-AUTH-12 | No Reporting / Final / Release | **APPROVED** |
| PD-AUTH-13 | Forward-only; no revoke/return | **APPROVED** |
| PD-AUTH-14 | No amendments | **APPROVED** |
| PD-AUTH-15 | Optimistic concurrency | **APPROVED** |
| PD-AUTH-16 | Idempotency `authorize_result` | **APPROVED** |
| PD-AUTH-17 | Audit `AUTHORIZE_RESULT` fail-closed | **APPROVED** |
| PD-AUTH-18 | Permission `lms.results.authorize` catalog only | **APPROVED** |
| PD-AUTH-19 | Tenant + branch | **APPROVED** |
| PD-AUTH-20 | UX via Testing Work Queue / Result Detail | **APPROVED** |
| AD-AUTH-01 … AD-AUTH-14 | Architecture | **APPROVED** |

No required L-AUTH-01 Product Decision remains open for this bounded first slice.

Upstream boundaries A–S remain **APPROVED**.  
Future L-CRT-01 / Reporting / Amendments / Instrument / PRD-RES-03 matrix / production role-grant decisions remain separate and are **not** approved here.

---

## 14. UAT / acceptance gate (future implementation task)

After a separate authorized implementation:

1. Automated tests  
2. PRE-UAT verification  
3. Manual UAT  

Manual UAT considerations (for the future implementation task — **not** performed here):

- Authorize only TechnicalVerified results  
- Confirm UI does **not** claim Final / Released / patient-visible  
- Confirm Technical Verification and Clinical Authorization remain distinct actions/events  
- Exercise same-person policy as closed  
- Permission denied path for users without `lms.results.authorize`  
- Branch denial path  
- Concurrency / double-submit  
- Audit visible in platform audit trail  
- Upstream OrderTest / Specimen / Collection / Receiving / Barcode unchanged  

**This decision task does not perform Manual UAT.**

---

## 15. IMPLEMENTATION AUTHORIZATION

# PRODUCT_DECISIONS_CLOSED_L_AUTH_01_AUTHORIZED

| Field | Content |
|---|---|
| **Authorized implementation** | **L-AUTH-01 — Clinical Authorization** (bounded first slice) |
| **Authorization** | **AUTHORIZED FOR SEPARATE IMPLEMENTATION TASK** |
| **This document** | Does **not** implement L-AUTH-01 |
| **State transition** | `TechnicalVerified` → `ClinicallyAuthorized` |
| **Permission** | `lms.results.authorize` (catalog only; no role grants) |
| **Audit action** | `AUTHORIZE_RESULT` |
| **Idempotency operation** | `authorize_result` |
| **All other capabilities beyond §9.1** | Remain **unauthorized** |

**This stamp means:**

- Product decisions are closed for the bounded first slice  
- Engineering implementation of L-AUTH-01 is now authorized as a **separate** task  
- It does **not** authorize L-CRT-01  
- It does **not** authorize Reporting  
- It does **not** authorize Amendments  
- It does **not** authorize production role grants  
- It does **not** authorize any adjacent capability  

**Explicitly not authorized by this stamp:** Critical Results · Reporting / Final / Release · Amendments · Instrument/Runs/QC · Autoverification · Referral · Billing · Pathology migration · upstream lifecycle changes · production role grants · PRD-RES-03 signatory matrix · audit allowlist / permission seed changes in this task · L-VER-01 / L-TST-01A changes.

**L-AUTH-01 is authorized as a separate future implementation task.**

**Next step:** Separate Cursor / engineering implementation task against this closure only.

---

## 16. Confirmation — this task

- NO APPLICATION IMPLEMENTATION  
- NO DATABASE / MIGRATION / SCHEMA / ROW CHANGES  
- NO RESULT ENTITY / STATUS ENUM / API / UI / ROUTE CHANGES  
- NO PERMISSION SEEDING / ROLE GRANTS  
- NO AUDIT ALLOWLIST CHANGES  
- NO L-VER-01 BEHAVIOR CHANGES  
- NO L-TST-01A BEHAVIOR CHANGES  
- NO COLLECTION / SPECIMEN / RECEIVING / BARCODE / ORDER / ORDERTEST CHANGES  
- NO L-CRT-01 / REPORTING / AMENDMENTS / INSTRUMENT / REFERRAL / BILLING START  

Discovery audit and decision package were **not** deleted.

---

## 17. Explicit stop condition

**STOP.**

- Do **not** implement L-AUTH-01 in this task  
- Do **not** create migrations  
- Do **not** create APIs  
- Do **not** create UI  
- Do **not** seed permissions  
- Do **not** grant roles  
- Do **not** start L-CRT-01  
- Do **not** start Reporting  
- Do **not** start Amendments  

Wait for the next explicit engineering implementation task.

---

## FINAL STATUS

**PRODUCT_DECISIONS_CLOSED_L_AUTH_01_AUTHORIZED**

**Authorized implementation:** L-AUTH-01 — Clinical Authorization (bounded first slice)  

**All other Results capabilities beyond the approved L-AUTH-01 scope remain unauthorized.**
