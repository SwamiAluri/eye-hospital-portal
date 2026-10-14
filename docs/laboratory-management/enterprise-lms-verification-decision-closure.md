# L-VER-01 — Technical Verification  
# Product Owner Decision Closure

**Date:** 2026-10-12  
**Slice:** L-VER-01 (Technical Verification — decision closure only)  
**Mode:** DOCUMENTATION / PRODUCT OWNER APPROVAL ONLY — no application source, schema, migrations, APIs, DTOs, services, UI, routes, permissions seeding/grants, audit allowlist changes, Result status enums, Result entities, Testing behavior, CollectionTask, Specimen, Receiving, Barcode, Orders, OrderTest, Pathology, Billing, Reporting, Clinical Authorization, Critical Results, Amendments, Instrument/Runs/QC, or Referral implementation  

**Decision package:** [enterprise-lms-verification-decision-package.md](./enterprise-lms-verification-decision-package.md)  
**Discovery audit:** [enterprise-lms-verification-discovery-audit.md](./enterprise-lms-verification-discovery-audit.md) *(preserved)*  
**Upstream acceptance:** **L-TST-01A ACCEPTED** · L-COL-01B … L-COL-01E ACCEPTED  
**Authoritative PRD/BRD:** Enterprise LMS PRD/BRD v1.0  

```text
L-TST-01A ACCEPTED (Draft SoT)
  → Discovery audit
  → Decision package (READY_FOR_PRODUCT_OWNER_APPROVAL)
  ↓
PD-VER-* / AD-VER-* (THIS DOCUMENT)
  ← PRODUCT OWNER APPROVED (2026-10-12)
  ↓
L-VER-01 — Technical Verification
  ← AUTHORIZED FOR SEPARATE IMPLEMENTATION TASK
  ← NOT IMPLEMENTED BY THIS DOCUMENT
  ↓
Later (unauthorized here): L-AUTH-01 · L-CRT-01 · Reporting · Amendments · Instrument/Runs/QC · Referral · Billing
```

---

## 1. Document purpose

This document formally records Product Owner approval of the L-VER-01 Technical Verification decision set, closes the product/architecture decision gate for the **first bounded Verification slice only**, and authorizes a **separate** implementation task for:

**L-VER-01 — Technical Verification**

**This document does not implement L-VER-01.**

---

## 2. Product Owner approval statement

Product Owner has **approved** PD-VER-01 through PD-VER-20 and AD-VER-01 through AD-VER-14 as recorded below. Decisions are **not broadened** beyond this stamp.

| Class | Meaning |
|---|---|
| **APPROVED** | Product Owner approved for L-VER-01 first-slice closure, or reaffirmed upstream |
| **APPROVED FOR L-VER-01** | Approved within the bounded first Verification slice |
| **APPROVED FOR FIRST SLICE** | Approved authority boundary for L-VER-01 only |
| **DEFERRED** | Explicitly later than L-VER-01 (configuration or separate slice) |
| **OUT_OF_SCOPE** | Not part of L-VER-01 |
| **CONFIGURATION_REQUIRED** | Later configuration dependency — does not invent clinical values; may block individual verifications honestly |

**Gate determination:**

# PRODUCT_DECISIONS_CLOSED_L_VER_01_AUTHORIZED

**L-VER-01 is authorized as a separate future implementation task.**

---

## 3. Source hierarchy

| Priority | Source | Role |
|---|---|---|
| 1 | This decision closure | Authoritative L-VER-01 product/architecture stamp |
| 2 | Enterprise LMS PRD/BRD v1.0 | Functional SoT |
| 3 | [enterprise-lms-verification-decision-package.md](./enterprise-lms-verification-decision-package.md) | Pre-approval decision package (superseded where this stamp differs) |
| 4 | [enterprise-lms-verification-discovery-audit.md](./enterprise-lms-verification-discovery-audit.md) | Discovery evidence |
| 5 | [enterprise-lms-testing-acceptance-closure.md](./enterprise-lms-testing-acceptance-closure.md) + Testing decision closure | Certified Draft SoT |
| 6 | L-COL-01B … 01E acceptance / decision closures | Certified upstream SoT — **do not reopen** |
| 7 | LaboratoryApi Result domain | Runtime foundation; not a license to invent Verification SoT beyond this stamp |

Where discovery or package recommendations differ from this stamp, **this closure prevails**.

---

## 4. Immutable upstream boundaries

| # | Boundary | Status |
|---|---|---|
| A | L-TST-01A is **ACCEPTED** | **APPROVED** |
| B | L-TST-01A Result Draft is the current Result SoT until Verification mutates an eligible Draft | **APPROVED** |
| C | Order remains Submitted/Cancelled per existing order lifecycle | **APPROVED** |
| D | OrderTest remains **Ordered** | **APPROVED** |
| E | Technical Verification **MUST NOT** mutate OrderTest | **APPROVED** |
| F | Technical Verification **MUST NOT** mutate CollectionTask, Specimen, Receiving, Barcode, Accession | **APPROVED** |
| G | Rejected specimens remain ineligible | **APPROVED** |
| H | Pathology remains separate | **APPROVED** |
| I | LaboratoryApi remains LMS Result/Verification domain owner | **APPROVED** |
| J | Platform `audit_log` remains audit SoT | **APPROVED** |
| K | No production role grants from this decision task | **APPROVED** |
| L | Do not invent a new organization/site/section hierarchy | **APPROVED** |
| M | Technical Verification is distinct from Clinical Authorization | **APPROVED** |
| N | L-AUTH-01 remains a future separate slice | **APPROVED** |
| O | Critical Results remain L-CRT-01 | **APPROVED** |
| P | Reporting remains a future separate slice | **APPROVED** |
| Q | Amendments remain a future separate slice | **APPROVED** |
| R | Instrument / Runs / QC / autoverification remain outside this slice | **APPROVED** |

---

## 5. PRD Result state model (closed for L-VER-01)

PRD sequence (meaning preserved):

```text
Result Draft
    ↓
Technical Verified          ← L-VER-01 introduces this transition only
    ↓
Authorization Pending       ← L-AUTH-01 (unauthorized here)
    ↓
Final                       ← Reporting / release (unauthorized here)
```

Technical Verification and Clinical Authorization are **distinct events**.

| Field | Content |
|---|---|
| **Internal / governed Result state** | `TechnicalVerified` |
| **Display label** | Technical Verified |
| **Product meaning** | Analytical/technical verification completed |
| **Does NOT mean** | Clinically authorized; Final; released; report published; patient-visible |

**Not implemented by this document.** Repository today still has `Draft` only (`ResultStatuses`); the future implementation task introduces `TechnicalVerified` per this stamp.

---

## 6. Product decisions — PD-VER-01 … PD-VER-20

### PD-VER-01 — Verification work item

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Rule** | Verification work item = existing LMS **Result aggregate** (`LmsResult`), in the context of its **current Result Version** |
| **Must** | Identify the exact current version being verified; historical Draft versions remain append-only history |
| **Forbidden** | Separate Verification aggregate; Report-based verification object; component-level Verification SoT; second Result domain |

### PD-VER-02 — Verification eligibility

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Rule** | Eligible only when **all** hold: (1) Order `Submitted`; (2) OrderTest `Ordered`; (3) OrderTest linked to at least one Specimen; (4) relevant Specimen `Received`; (5) tenant matches; (6) operating branch authorized; (7) catalogue/test locally eligible; (8) Result exists; (9) Result status `Draft`; (10) verification targets **current** Result aggregate/version |
| **Not eligible** | Rejected specimens; Collected-only specimens; Result with no Draft; historical/non-current Result Version as independent verify target |
| **Forbidden** | Automatic lifecycle mutations as a side effect of eligibility evaluation |

### PD-VER-03 — Verification state

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Rule** | L-VER-01 introduces governed Result state **`TechnicalVerified`** (display: **Technical Verified**) |
| **Transition** | `Draft` → `TechnicalVerified` only |
| **Forbidden** | Ambiguous generic “Verified” as product meaning; collapsing into Authorized / Final / Released |

### PD-VER-04 — Version / verification record

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Rule** | Preserve append-only Result Version history. Do **not** rewrite historical `LmsResultVersion` rows. Record which **current** Result Version was verified |
| **Authoritative model** | Result aggregate stores current Verification state/metadata; verification references exact `CurrentVersionNumber`; actor + timestamp persisted; version history immutable |
| **Forbidden** | Second result-versioning system; using verification as a replacement for ResultVersion |

### PD-VER-05 — Verification actor / authority

| Field | Content |
|---|---|
| **Status** | **APPROVED FOR L-VER-01** |
| **Rule** | Authenticated platform user + dedicated Verification permission + tenant authorization + authorized operating branch |
| **Forbidden** | Inferring clinical authority from Admin role, Hospital Portal role name, display name, job title, section name, or discipline name; inventing laboratory/section/discipline authority matrix |
| **Note** | L-VER-01 permission is operational technical-verification authorization, **not** proof of clinical authorization. Section/discipline/signatory/delegation remain future configuration/authorization concerns |

### PD-VER-06 — Same-person rule

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Rule** | A user who created or updated the Draft **MAY** technically verify that Result if they hold Verification authority |
| **Forbidden** | Mandatory different-person rule for L-VER-01; collapsing Draft / Technical Verification / Clinical Authorization into one event; inferring Clinical Authorization from same-person capability |
| **Events remain distinct** | Draft create/update · Technical Verification · Clinical Authorization (future) |

### PD-VER-07 — Technical vs clinical scope

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Rule** | L-VER-01 = **Technical Verification only** |
| **Forbidden** | Clinical authorization; final release; report publish; patient notify; final report generation; signatory workflow |
| **Deferred** | L-AUTH-01 |

### PD-VER-08 — Pre-verification validation

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Rule** | Confirm applicable structural/analytical completeness required by governed test/method configuration. PRD categories recognized: required value; valid datatype; valid unit where governed; required reference interval/configuration where applicable; catalogue/result mapping valid; required components complete; specimen/order/result context valid |
| **Honesty** | If required governed configuration is missing, ambiguous, inactive, or unavailable → **block** Verification and surface the problem. Do **not** silently treat missing required config as passed |
| **Distinguish** | “Configuration not required for this test” vs “Configuration required but missing” |
| **Forbidden** | Inventing/hard-coding reference intervals, abnormal/critical thresholds, clinical interpretation, test-specific limits, site-specific ranges |

### PD-VER-09 — Abnormal / critical handling

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Rule** | L-VER-01 does **not** perform clinical abnormal/critical interpretation |
| **Forbidden** | Critical value calculation; invented abnormal ranges; critical-result cases; clinician critical notify; escalation chains; critical acknowledgement |
| **Deferred** | L-CRT-01 |

### PD-VER-10 — Rejection / return to Draft

| Field | Content |
|---|---|
| **Status** | **APPROVED — VERIFY-FORWARD-ONLY** |
| **Rule** | Only mutation: `Draft` → `TechnicalVerified`. Pre-verify corrections remain Draft via L-TST-01A Draft workflow. Once Technical Verified → **not** editable as Draft |
| **Forbidden in L-VER-01** | TechnicalVerified → Draft; Reject Verification; Return to Draft; Correction-request lifecycle; Verification rejection state; amendment behavior |

### PD-VER-11 — Concurrency

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Rule** | Reuse LMS optimistic concurrency. Verify uses current Result RowVersion/version state. Stale load → `409 concurrency_conflict`. No silent overwrite. Second verify after already Technical Verified fails safely. No duplicate Verification records for the same current Result Version |

### PD-VER-12 — Idempotency

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Rule** | Technical Verification mutation is idempotent. Preferred operation name: `verify_result`. Same key + same hash → safe replay; same key + different hash → `409 idempotency_conflict` |
| **Note** | Exact internal key construction may be finalized during implementation design |

### PD-VER-13 — Audit

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **SoT** | Platform `audit_log` |
| **Primary action** | `VERIFY_RESULT` |
| **Rule** | Capture platform-required actor/object/action/context; **fail-closed** — audit failure means Verification must not be considered successful |
| **Out of scope actions** | `RETURN_RESULT_TO_DRAFT`; `REJECT_RESULT` |
| **This task** | Does **not** modify the audit allowlist; future implementation task performs allowlist wiring |

### PD-VER-14 — Permission

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Code** | `lms.testing.verify` |
| **Rule** | Dedicated Technical Verification permission. Catalog definition only |
| **Forbidden** | Using `lms.testing.manage` or `lms.testing.result` as Verification authority; production role grants; assigning to Admin / Lab Technician / Doctor / any role in this task |
| **Role mapping** | Separate explicit future task |

### PD-VER-15 — Branch / lab authority

| Field | Content |
|---|---|
| **Status** | **APPROVED FOR FIRST SLICE** |
| **Rule** | Tenant + authorized operating branch |
| **Forbidden** | Inventing laboratory / section / discipline / organization hierarchy or new master data to unblock L-VER-01 |
| **Deferred dependency** | Section/discipline authority |

### PD-VER-16 — Amendment boundary

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Rule** | Technical Verification does not implement amendments. Technical Verified Results are not edited through Draft update APIs. Post-verification correction belongs to a future amendment/correction workflow |
| **Forbidden** | Amendment tables, APIs, UI, or state transitions in L-VER-01 |

### PD-VER-17 — Clinical Authorization

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Rule** | L-VER-01 = Technical Verification only; L-AUTH-01 = Clinical Authorization |
| **Forbidden** | Combining Technical Verified with Clinically Authorized; Verification releasing final report; marking Final; patient publish; patient communication; bypassing authorization |

### PD-VER-18 — Reporting

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Rule** | Technical Verification does not generate, finalize, publish, or deliver reports; does not expose results to patient portal as final; does not create report PDFs |
| **Deferred** | Reporting slice |

### PD-VER-19 — Critical result

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Rule** | Critical-result handling remains **L-CRT-01** |
| **Forbidden in L-VER-01** | Critical flags/cases; communication events; escalation; acknowledgement workflows |

### PD-VER-20 — UI / Work Queue

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Preferred UX** | Existing Testing Work Queue → Eligible Draft Result → Result detail → Technical Verification action |
| **Dedicated route** | `/dashboard/lms/results/verification` may become presentation surface if it reuses the same authoritative Result/eligibility source; remains a **stub until implementation authorization** |
| **Forbidden** | Duplicate operational worklist unless required by evidence; fabricating Verification rows/metrics; fake KPIs/counts/clinical statuses |
| **Reuse** | LMS design system + Testing Work Queue UX patterns |

---

## 7. Architecture decisions — AD-VER-01 … AD-VER-14

| ID | Decision | Status |
|---|---|---|
| **AD-VER-01** | LaboratoryApi remains the owner of Verification | **APPROVED** |
| **AD-VER-02** | Reuse `LmsResult` / `LmsResultVersion`; no duplicate Result domain | **APPROVED** |
| **AD-VER-03** | Verification state belongs to the LMS Result domain | **APPROVED** |
| **AD-VER-04** | No OrderTest lifecycle mutation | **APPROVED** |
| **AD-VER-05** | No Specimen lifecycle mutation | **APPROVED** |
| **AD-VER-06** | No CollectionTask mutation | **APPROVED** |
| **AD-VER-07** | No Receiving mutation | **APPROVED** |
| **AD-VER-08** | No Barcode mutation | **APPROVED** |
| **AD-VER-09** | Platform `audit_log` remains audit SoT | **APPROVED** |
| **AD-VER-10** | Tenant + authorized branch authorization is reused | **APPROVED** |
| **AD-VER-11** | Optimistic concurrency is reused | **APPROVED** |
| **AD-VER-12** | Operation-specific idempotency is reused | **APPROVED** |
| **AD-VER-13** | No separate Verification microservice | **APPROVED** |
| **AD-VER-14** | Pathology remains completely separate | **APPROVED** |

No new organization hierarchy is invented.

---

## 8. Configuration dependency treatment

| Rule | Status |
|---|---|
| L-VER-01 may proceed **without** creating new reference interval / critical / abnormal / signatory configuration merely to unblock implementation | **APPROVED** |
| If a governed technical verification rule is **required** for a test and that configuration does not exist → Verification **blocks** honestly (does not fabricate a pass) | **APPROVED** |
| Missing configuration ≠ automatic failure of the entire L-VER-01 slice | **APPROVED** |
| Configuration not applicable to the test → verification may proceed using remaining applicable structural checks | **APPROVED** |
| Do not hard-code test-specific clinical values | **APPROVED** |

Future configuration work for intervals/criticals/signatory/section-discipline remains **CONFIGURATION_REQUIRED** / separate slices — **not** marked as approved live clinical SoT by this closure.

---

## 9. Permission boundary

| Code | Catalogued by this closure? | Role grants |
|---|---|---|
| `lms.testing.verify` | **Approved for future catalog** in implementation task | **None** |
| `lms.testing.view` / `manage` / `result` | Existing L-TST-01A catalog | Unchanged; **not** Verification authority |

This closure does **not** seed permissions or grant roles.

---

## 10. Audit boundary

| Item | Decision |
|---|---|
| SoT | Platform `audit_log` |
| Mutation action | `VERIFY_RESULT` |
| Fail-closed | **Required** |
| Allowlist change | **Future implementation task only** |
| Out of scope | `RETURN_RESULT_TO_DRAFT`, `REJECT_RESULT` |

---

## 11. Concurrency / idempotency model

| Concern | Decision |
|---|---|
| Concurrency | Optimistic RowVersion; stale → `409 concurrency_conflict` |
| Already verified | Fail safely; no duplicate verify for same current version |
| Idempotency operation | `verify_result` |
| Replay | Same key + same hash → replay; same key + different hash → `409 idempotency_conflict` |

---

## 12. Final approved L-VER-01 scope

Future authorized implementation may contain **only**:

1. Verification eligibility over existing Draft Results  
2. Technical Verification Work Queue / reuse of existing Testing Work Queue  
3. Result detail and current Draft/version history  
4. Explicit Verify action  
5. `TechnicalVerified` state  
6. Verification metadata tied to exact current Result Version  
7. Verification actor and timestamp  
8. Structural/technical validation required by governed configuration  
9. Audit (`VERIFY_RESULT`, fail-closed)  
10. Idempotency (`verify_result`)  
11. Optimistic concurrency  
12. Dedicated permission catalog entry `lms.testing.verify` (no role grants)  
13. Automated tests  
14. PRE-UAT verification  
15. Manual UAT after implementation authorization  

---

## 13. Explicitly out of scope

Not authorized by this stamp:

- Clinical Authorization / Authorization Pending implementation  
- Final / release / Reporting / patient release / patient communication  
- Critical Results (L-CRT-01)  
- Amendments / corrections after Technical Verified  
- Instrument results / analyzer integration / Runs / QC / Calibration / Autoverification  
- Referral inbound results  
- Billing / payment  
- Pathology migration  
- OrderTest / Specimen / CollectionTask / Receiving / Barcode lifecycle changes  
- New laboratory/section/discipline hierarchy  
- Production role grants  
- Two-person mandatory policy (same-person is allowed; mandatory different-person is not introduced)  
- Signatory / delegation workflow  

---

## 14. Decision register (closed for L-VER-01)

| ID | Topic | Status |
|---|---|---|
| PD-VER-01 | Work item = `LmsResult` + current version | **APPROVED** |
| PD-VER-02 | Eligibility rules | **APPROVED** |
| PD-VER-03 | State `TechnicalVerified` / Technical Verified | **APPROVED** |
| PD-VER-04 | Version / verification metadata model | **APPROVED** |
| PD-VER-05 | Actor / authority (user + permission + tenant + branch) | **APPROVED FOR L-VER-01** |
| PD-VER-06 | Same person may verify | **APPROVED** |
| PD-VER-07 | Technical only | **APPROVED** |
| PD-VER-08 | Pre-verify validation + honesty | **APPROVED** |
| PD-VER-09 | No abnormal/critical clinical workflow | **APPROVED** |
| PD-VER-10 | Verify-forward-only | **APPROVED** |
| PD-VER-11 | Optimistic concurrency | **APPROVED** |
| PD-VER-12 | Idempotency `verify_result` | **APPROVED** |
| PD-VER-13 | Audit `VERIFY_RESULT` fail-closed | **APPROVED** |
| PD-VER-14 | Permission `lms.testing.verify` catalog only | **APPROVED** |
| PD-VER-15 | Tenant + branch | **APPROVED FOR FIRST SLICE** |
| PD-VER-16 | No amendments | **APPROVED** |
| PD-VER-17 | L-AUTH-01 separate | **APPROVED** |
| PD-VER-18 | No reporting | **APPROVED** |
| PD-VER-19 | L-CRT-01 separate | **APPROVED** |
| PD-VER-20 | UX via Testing Work Queue / Result detail | **APPROVED** |
| AD-VER-01 … AD-VER-14 | Architecture | **APPROVED** |

No required L-VER-01 Product Decision remains `PRODUCT_DECISION_REQUIRED`.

Upstream boundaries A–R remain **APPROVED**.  
Future L-AUTH-01 / L-CRT-01 / Reporting / Amendments / Instrument decisions remain separate and are **not** approved here.

---

## 15. UAT gate (future implementation task)

After a separate authorized implementation:

1. Automated tests  
2. PRE-UAT verification  
3. Manual UAT  

**This decision task does not perform Manual UAT.**

---

## 16. IMPLEMENTATION AUTHORIZATION

# PRODUCT_DECISIONS_CLOSED_L_VER_01_AUTHORIZED

| Field | Content |
|---|---|
| **Authorized implementation** | **L-VER-01 — Technical Verification** |
| **Authorization** | **AUTHORIZED FOR SEPARATE IMPLEMENTATION TASK** |
| **This document** | Does **not** implement L-VER-01 |
| **All other Verification/Results capabilities beyond §12** | Remain **unauthorized** |

**Explicitly not authorized by this stamp:** Clinical Authorization · Critical Results · Reporting · Amendments · Instrument/Runs/QC · Autoverification · Referral Results · Billing · Pathology migration · upstream lifecycle changes · production role grants · audit allowlist changes in this task.

**L-VER-01 is authorized as a separate future implementation task.**

**Next step:** Separate Cursor / engineering implementation task against this closure only.

---

## 17. Confirmation — this task

- NO APPLICATION IMPLEMENTATION  
- NO DATABASE / MIGRATION / SCHEMA / ROW CHANGES  
- NO RESULT ENTITY / STATUS ENUM / API / UI / ROUTE CHANGES  
- NO PERMISSION SEEDING / ROLE GRANTS  
- NO AUDIT ALLOWLIST CHANGES  
- NO L-TST-01A BEHAVIOR CHANGES  
- NO COLLECTION / SPECIMEN / RECEIVING / BARCODE / ORDER / ORDERTEST CHANGES  
- NO L-AUTH-01 / L-CRT-01 / REPORTING / AMENDMENTS / INSTRUMENT / REFERRAL / BILLING START  

---

## FINAL STATUS

**PRODUCT_DECISIONS_CLOSED_L_VER_01_AUTHORIZED**

**Authorized implementation:** L-VER-01 — Technical Verification  

**All other Results capabilities beyond the approved L-VER-01 scope remain unauthorized.**

**STOP.** Do not implement L-VER-01 in this task. Do not generate an implementation prompt. Do not start L-AUTH-01, L-CRT-01, Reporting, or Amendments.
