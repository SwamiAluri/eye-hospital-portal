# L-CRT-01 — Critical Results  
# Product Owner Decision Closure

**Date:** 2026-10-12  
**Slice:** L-CRT-01 (Critical Results — bounded first slice — decision closure only)  
**Mode:** DOCUMENTATION / PRODUCT OWNER APPROVAL ONLY — no application source, schema, migrations, APIs, DTOs, services, UI, routes, permissions seeding/grants, audit allowlist changes, Result status enums, Result entities, CriticalResultEvent tables, notification calls, L-AUTH-01, L-VER-01, L-TST-01A, CollectionTask, Specimen, Receiving, Barcode, Orders, OrderTest, Pathology, Billing, Reporting, Amendments, Instrument/Runs/QC, or Referral implementation  

**Decision package:** [enterprise-lms-critical-results-decision-package.md](./enterprise-lms-critical-results-decision-package.md)  
**Discovery audit:** [enterprise-lms-critical-results-discovery-audit.md](./enterprise-lms-critical-results-discovery-audit.md) *(preserved)*  
**Upstream:** **L-COL-01B … L-COL-01E ACCEPTED** · **L-TST-01A ACCEPTED** · **L-VER-01** (`Draft` → `TechnicalVerified`) · **L-AUTH-01** (`TechnicalVerified` → `ClinicallyAuthorized`)  
**Authoritative PRD/BRD:** Enterprise LMS PRD/BRD v1.0 (via certified extractions)  
**Architecture context:** [laboratory-management-product-definition-v3.md](../decisions/laboratory-management-product-definition-v3.md) §12 (PD-LAB-CRIT-01); residual PD-LAB-CRIT-02 remains configuration/future for automated detection & escalation timers  

```text
L-AUTH-01 CERTIFIED (TechnicalVerified → ClinicallyAuthorized)
  → Discovery audit
  → Decision package (DISCOVERY_COMPLETE_READY_FOR_PRODUCT_OWNER_DECISION)
  ↓
PD-CRT-* / AD-CRT-* (THIS DOCUMENT)
  ← PRODUCT OWNER APPROVED (2026-10-12, outside Cursor)
  ↓
L-CRT-01 — Critical Results (bounded first slice)
  ← AUTHORIZED FOR SEPARATE IMPLEMENTATION TASK
  ← NOT IMPLEMENTED BY THIS DOCUMENT
  ↓
Later (unauthorized here): Automated thresholds · Escalation timers · Reporting / Final / Release · Amendments · Instrument/Runs/QC · Referral · Billing · Patient visibility · production role grants
```

---

## 1. Document purpose

This document formally records Product Owner approval of the L-CRT-01 Critical Results decision set, closes the product/architecture decision gate for the **bounded first Critical Results slice only**, and authorizes a **separate** engineering implementation task for:

**L-CRT-01 — Critical Results**

**This document does not implement L-CRT-01.**

This closure supersedes historical **OPEN** / **RECOMMENDED** / **DECISION REQUIRED** statuses in the decision package for this bounded first slice. The discovery audit and decision package remain preserved historical evidence.

---

## 2. Product Owner approval statement

Product Owner has **explicitly approved** the recommended L-CRT-01 Product Decisions from:

- [enterprise-lms-critical-results-discovery-audit.md](./enterprise-lms-critical-results-discovery-audit.md)
- [enterprise-lms-critical-results-decision-package.md](./enterprise-lms-critical-results-decision-package.md)

with authorization provided **outside Cursor**.

PD-CRT-01 through PD-CRT-18 and AD-CRT-01 through AD-CRT-10 are therefore **APPROVED** as recorded below. Decisions are **not broadened** beyond this stamp.

| Class | Meaning |
|---|---|
| **APPROVED** | Product Owner approved for L-CRT-01 first-slice closure, or reaffirmed upstream |
| **APPROVED FOR BOUNDED FIRST SLICE** | Approved within the bounded first Critical Results slice only |
| **DEFERRED** / **FUTURE** | Explicitly later than L-CRT-01 (separate Product Decision / slice / configuration) |
| **OUT_OF_SCOPE** | Not part of L-CRT-01 |

**Pre-closure repository verification (2026-10-12):**

| Check | Result |
|---|---|
| `ResultStatuses` | `Draft`, `TechnicalVerified`, `ClinicallyAuthorized` only — matches discovery |
| CriticalResult / classify / critical permissions in LaboratoryApi | **Absent** — no silent implementation |
| `/dashboard/lms/results/critical` | Placeholder via `LmsCapabilityPage`; capability `results-critical` = `not_implemented` |
| Discovery vs repository material discrepancy | **None** |

**Gate determination:**

# PRODUCT_DECISIONS_CLOSED_L_CRT_01_AUTHORIZED

**IMPLEMENTATION_NOT_STARTED**

**THIS DOCUMENT AUTHORIZES A SEPARATE FUTURE L-CRT-01 ENGINEERING IMPLEMENTATION TASK.**

This stamp does **not** mean `IMPLEMENTATION_COMPLETE`, `PRE_UAT_READY`, `UAT_READY`, `UAT_PASSED`, or `ACCEPTED` — no implementation has occurred in this task. It does **not** claim notification working or Critical workflow implemented.

---

## 3. Authoritative source hierarchy

| Priority | Source | Role |
|---|---|---|
| 1 | This decision closure | Authoritative L-CRT-01 product/architecture stamp |
| 2 | Enterprise LMS PRD/BRD v1.0 | Functional SoT |
| 3 | [enterprise-lms-critical-results-decision-package.md](./enterprise-lms-critical-results-decision-package.md) | Pre-approval decision package (superseded where this stamp differs) |
| 4 | [enterprise-lms-critical-results-discovery-audit.md](./enterprise-lms-critical-results-discovery-audit.md) | Discovery evidence |
| 5 | [enterprise-lms-clinical-authorization-decision-closure.md](./enterprise-lms-clinical-authorization-decision-closure.md) + L-AUTH-01 | Certified ClinicallyAuthorized SoT; Critical out (PD-AUTH-11) |
| 6 | [enterprise-lms-verification-decision-closure.md](./enterprise-lms-verification-decision-closure.md) + L-VER-01 | Certified TechnicalVerified SoT; Critical out (PD-VER-19) |
| 7 | [enterprise-lms-testing-decision-closure.md](./enterprise-lms-testing-decision-closure.md) + Testing acceptance | Certified Draft SoT; Critical deferred (PD-TST-13) |
| 8 | L-COL-01B … 01E acceptance / decision closures | Certified upstream SoT — **do not reopen** |
| 9 | [laboratory-management-product-definition-v3.md](../decisions/laboratory-management-product-definition-v3.md) §12 | PD-LAB-CRIT-01 APPROVED architecture; PD-LAB-CRIT-02 residual |
| 10 | LaboratoryApi Result domain | Runtime foundation; not a license to invent Critical SoT beyond this stamp |

Where discovery or package recommendations differ from this stamp, **this closure prevails**.

---

## 4. Certified upstream boundaries

| # | Boundary | Status |
|---|---|---|
| A | L-COL-01B … L-COL-01E are **ACCEPTED** and must not be altered | **APPROVED** |
| B | L-TST-01A Draft Result SoT is **ACCEPTED** | **APPROVED** |
| C | L-VER-01 `Draft` → `TechnicalVerified` is certified | **APPROVED** |
| D | L-AUTH-01 `TechnicalVerified` → `ClinicallyAuthorized` is certified | **APPROVED** |
| E | Result lifecycle remains `Draft` → `TechnicalVerified` → `ClinicallyAuthorized` | **APPROVED** |
| F | Critical is **not** a `ResultStatus` | **APPROVED** |
| G | `ClinicallyAuthorized` is **not** Final / Released / Published / patient-visible / Critical | **APPROVED** |
| H | OrderTest remains **Ordered**; Critical MUST NOT mutate OrderTest | **APPROVED** |
| I | Critical MUST NOT mutate CollectionTask, Specimen, Receiving, Barcode, Accession | **APPROVED** |
| J | Pathology remains separate (not LMS Critical SoT) | **APPROVED** |
| K | LaboratoryApi remains LMS Result / Critical domain owner | **APPROVED** |
| L | Platform `audit_log` remains audit SoT | **APPROVED** |
| M | No production role grants from this decision task | **APPROVED** |
| N | Do not invent a new organization/site/section/discipline hierarchy | **APPROVED** |
| O | L-AUTH-01 behavior remains unchanged (no Critical ack prerequisite) | **APPROVED** |
| P | Reporting / Final / Release remain a future separate slice | **APPROVED** |
| Q | Amendments remain a future separate slice | **APPROVED** |
| R | Instrument / Runs / QC / autoverification remain outside this slice | **APPROVED** |
| S | PD-LAB-CRIT-01 (events + ack + escalate via orchestration) remains APPROVED architecture; full escalation timers/recipients remain FUTURE (CRIT-02 residual) | **APPROVED** |

**Do not alter L-COL-01B/C/D/E, L-TST-01A, L-VER-01, or L-AUTH-01.**

---

## 5. Current Result lifecycle (preserved)

```text
Draft
  ↓
TechnicalVerified
  ↓
ClinicallyAuthorized
```

Critical Results are an **orthogonal clinical-safety workflow** (event + communication + acknowledgement), **not** a ResultStatus transition.

---

## 6. Product Decisions — PD-CRT-01 … PD-CRT-18 (APPROVED)

### PD-CRT-01 — Detection Mode

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Traceability** | Decision package PD-CRT-01 Option (A); Discovery §6 / §23 Option CR-A |
| **Rule** | L-CRT-01 first slice uses **governed manual critical classification** |
| **Behavior** | An authorized laboratory/clinical actor explicitly classifies an eligible ResultVersion as critical |
| **Not in slice** | Automated threshold-based detection |
| **Future** | Automated detection requires separately governed Critical Rule configuration |
| **Forbidden** | Hard-coded medical thresholds; invented panic values; inferred criticality from reference intervals; Pathology interpretation strings as LMS Critical SoT |

### PD-CRT-02 — Criticality Model

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Traceability** | Decision package PD-CRT-02 Option (A); Discovery §2.3 / §22; V3 CriticalResultEvent concept |
| **Rule** | Criticality is represented using an orthogonal **CriticalResultEvent** (or equivalent Result-centric critical-event aggregate) |
| **Forbidden** | `ResultStatus = Critical`; replacing `ClinicallyAuthorized` with Critical |
| **Lifecycle** | Existing ResultStatus lifecycle remains unchanged |

### PD-CRT-03 — Authorization ↔ Critical Sequencing

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Traceability** | Decision package PD-CRT-03 Option (A); PD-AUTH-11; Discovery §11 |
| **Rule** | Critical handling is **independent** of Clinical Authorization for L-CRT-01 first slice |
| **Rule** | Clinical Authorization **MUST NOT** be blocked waiting for Critical acknowledgement |
| **Preserve** | L-AUTH-01 behavior unchanged; do not modify authorization endpoint or state machine |
| **Does not authorize** | Reporting / Final / Release behavior |

### PD-CRT-04 — Earliest Critical Evaluation Eligibility

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Traceability** | Decision package PD-CRT-04 Options (D)/(E); Discovery §2.3 |
| **Rule** | Critical classification allowed only for **TechnicalVerified** or later Result states |
| **Forbidden** | Manual Critical classification of **Draft** results |
| **Practical eligibility** | `TechnicalVerified` and/or `ClinicallyAuthorized` according to existing Result eligibility model |
| **Forbidden** | Hidden Critical evaluation inside Verify or Authorize |

### PD-CRT-05 — Critical Event Version Binding

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Traceability** | Decision package PD-CRT-05 Option (A); Discovery §10 |
| **Rule** | Every CriticalResultEvent **MUST** bind to the exact ResultVersion number that was classified |
| **Rule** | Event preserves immutable historical version context |
| **Forbidden** | Later ResultVersion silently rewriting or mutating a historical CriticalResultEvent |

### PD-CRT-06 — Acknowledgement Authority

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Traceability** | Decision package PD-CRT-06; Discovery §8; NOTIF-01 Lab API ack principle |
| **Rule** | Acknowledgement by an explicitly authorized clinical/laboratory actor governed by a **dedicated Critical Results permission** |
| **MUST NOT** treat as acknowledgement | Merely viewing a notification; opening a toast; SMS delivery; email delivery |
| **Permission model** | Dedicated least-privilege Critical Results permission family |
| **Forbidden** | Silently reusing Pathology, Counsellor, Insurance, or generic acknowledgement permissions |

*Exact permission code strings: **IMPLEMENTATION DETAIL — TO BE RESOLVED DURING AUTHORIZED ENGINEERING IMPLEMENTATION** (must remain dedicated Critical family; catalog seed only; no role grants).*

### PD-CRT-07 — Acknowledgement Evidence

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Traceability** | Decision package PD-CRT-07 Options (B)/(C); Discovery §8 / PRD-RES-04 extraction |
| **Rule** | Acknowledgement must be authenticated and auditable |
| **Minimum required** | Authenticated actor; acknowledgement timestamp; mandatory acknowledgement evidence/comment |
| **Where applicable** | Preserve structured evidence for recipient/method/communication context |
| **Forbidden** | SMS/email delivery alone closing the Critical event; inventing clinical documentation fields beyond approved first-slice boundary |

### PD-CRT-08 — Escalation

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Traceability** | Decision package PD-CRT-08 Option (A); Discovery §9; PD-LAB-CRIT-02 residual |
| **Rule** | Full time-bound escalation is **OUT OF SCOPE** for L-CRT-01 first slice |
| **Forbidden** | Inventing escalation timers, on-call intervals, recipient hierarchies, supervisor chains, retry minutes, escalation SLA values |
| **Future** | Escalation pending separately governed recipient/timer configuration and Product Owner approval |

### PD-CRT-09 — Notification Channels

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Traceability** | Decision package PD-CRT-09 Option (A); Discovery §7; PD-LAB-COM-01 V3 |
| **Rule** | First slice uses **in-app notification INTENT** through existing platform notification/orchestration boundary |
| **Forbidden in LaboratoryApi** | Hard-wiring Twilio, SMS, WhatsApp, SMTP, or direct email delivery |
| **Boundary** | Lab emits the intent; platform notification infrastructure delivers |
| **Future** | Additional channels |

### PD-CRT-10 — Permissions

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Traceability** | Decision package PD-CRT-10 Option (A); Discovery §15 |
| **Rule** | Dedicated least-privilege Critical Results permission family |
| **May catalog** | Critical Results view; classification/manage; acknowledgement; other explicitly required first-slice capabilities |
| **Future implementation may** | Seed permission catalog entries |
| **NOT authorized by this closure** | **NO PRODUCTION ROLE GRANTS** |
| **Forbidden** | Granting permissions to Admin, Doctor, Lab Technician, Counsellor, or any production role; silently modifying existing role assignments |

### PD-CRT-11 — Duplicate / Repeat Policy

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Traceability** | Decision package PD-CRT-11 Options (A)+(D); Discovery §10.3; INT-01 dedupe |
| **Rule** | **One open Critical event per ResultVersion** |
| **Rule** | Notification dispatch deduplicated using Critical event identity |
| **Forbidden** | Unbounded duplicate Critical events or clinician notifications from repeated attempts against the same event/version |
| **Future** | Future ResultVersion changes may create a distinct Critical event when the approved amendment model supports that behavior |

### PD-CRT-12 — Reporting / Release Interaction

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Traceability** | Decision package PD-CRT-12 Option (D); Discovery §12 |
| **Rule** | Reporting / Final / Release gating is **OUT OF SCOPE** for L-CRT-01 |
| **Forbidden** | Final; Released; Published; PDF; patient report delivery |
| **Future** | Any rule such as “Critical acknowledgement required before Reporting/Release” remains a **FUTURE** Product Decision for the Reporting slice |

### PD-CRT-13 — Patient Visibility

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Traceability** | Decision package PD-CRT-13 Option (A); Discovery §12 / INT-01 patient PD |
| **Rule** | Patient visibility is **OUT OF SCOPE** for L-CRT-01 |
| **Forbidden** | Patient portal Critical badges; patient Critical alerts; patient SMS/email; patient-facing Critical communication |
| **Forbidden** | Silent patient disclosure |

### PD-CRT-14 — Abnormal vs Critical

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Traceability** | Decision package PD-CRT-14 Option (A); Discovery §3.5 / §6 |
| **Rule** | L-CRT-01 implements the Critical event workflow only |
| **OUT OF SCOPE** | Abnormal flag calculation |
| **Forbidden** | Abnormal/critical clinical calculation engine; using reference intervals, normal ranges, Pathology interpretation strings, or arbitrary numeric thresholds as Critical classification source |
| **Classification** | Manual Critical classification is explicit and governed by the authorized actor |

### PD-CRT-15 — Configuration Ownership

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Traceability** | Decision package PD-CRT-15; Discovery §21; catalogue architecture honesty |
| **Rule** | No automated Critical Rule configuration engine is authorized in this first slice |
| **Future** | Critical rule configuration ownership remains FUTURE (thresholds, qualitative values, population/specimen/unit/site rules, effective dating, versioning, activation) |
| **Forbidden** | Creating placeholder clinical thresholds merely to enable the first slice |

### PD-CRT-16 — Failure / Outage Behavior

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Traceability** | Decision package PD-CRT-16 Options (A)+(B); Discovery §18 |
| **Rule** | Critical workflow mutations must not report false success |
| **Rule** | Critical event state changes and acknowledgement use safe, auditable, **fail-closed** semantics |
| **If notification unavailable** | Do not represent notification as successfully delivered; do not treat failed notification as acknowledgement; preserve Critical event safely; expose explicit failure/unavailable outcome where applicable |
| **Forbidden** | Inventing retry counts or backoff intervals |
| **Future** | Queued/retry orchestration may be separately governed |

### PD-CRT-17 — Analytics

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Traceability** | Decision package PD-CRT-17 Option (A); Discovery §20 |
| **Rule** | Critical analytics/KPIs are **OUT OF SCOPE** for L-CRT-01 |
| **Forbidden** | Fake Critical counts; fake time-to-ack metrics; fake escalation KPIs; dashboard tiles with invented values |
| **Honesty** | Any Critical overview tile must remain honest until backed by real implemented data |

### PD-CRT-18 — Amendment Boundary

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Traceability** | Decision package PD-CRT-18 Options (C)+(A); Discovery §13 |
| **Rule** | Historical CriticalResultEvents are **immutable** |
| **OUT OF SCOPE** | Amendment/correction behavior (belongs to future Amendment slice) |
| **Intended future principle** | New ResultVersion + new Critical classification/event when applicable — not mutating historical Critical evidence |
| **Forbidden** | Implementing Amendments in L-CRT-01 |

---

## 7. Architecture Decisions — AD-CRT-01 … AD-CRT-10 (APPROVED)

### AD-CRT-01 — Domain ownership

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Traceability** | Decision package AD-CRT-01; Discovery §22 GREEN LaboratoryApi |
| **Rule** | LaboratoryApi owns the LMS Critical Result domain and Critical event SoT |

### AD-CRT-02 — Aggregate

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Traceability** | Decision package AD-CRT-02; Discovery IA CriticalResultEvent; PD-CRT-02/05 |
| **Rule** | Create a Result-centric CriticalResultEvent (or equivalent) aggregate referencing LMS Result and exact ResultVersion |
| **Forbidden** | Pathology LabReport as source of truth |

### AD-CRT-03 — Communication boundary

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Traceability** | Decision package AD-CRT-03; PD-CRT-09; PD-LAB-COM-01 V3 |
| **Rule** | `LaboratoryApi → critical notification intent → platform notification/orchestration → configured delivery channel` |
| **Forbidden** | Direct channel-specific provider logic inside LaboratoryApi |

### AD-CRT-04 — Acknowledgement path

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Traceability** | Decision package AD-CRT-04; PD-CRT-06; NOTIF-01 |
| **Rule** | Critical acknowledgement mutates the Critical event only through an authorized LaboratoryApi endpoint |
| **Forbidden** | NotificationService becoming a second Critical event SoT |

### AD-CRT-05 — Audit

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Traceability** | Decision package AD-CRT-05; Discovery §16 |
| **Rule** | Critical event is a distinct auditable resource |
| **Rule** | Critical-specific audit actions introduced only during the future authorized implementation |
| **SoT** | Platform `audit_log` |
| **Semantics** | Fail-closed for safety-critical mutations |

*Exact audit action names / allowlist entries: **IMPLEMENTATION DETAIL — TO BE RESOLVED DURING AUTHORIZED ENGINEERING IMPLEMENTATION** (must not be changed by this closure task).*

### AD-CRT-06 — UI / work queue

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Traceability** | Decision package AD-CRT-06; Discovery §4.4 / §22; capability registry |
| **Rule** | Critical Results UI must use a **real event-backed** staff work queue |
| **Forbidden** | Mocked Critical rows |
| **Route** | Reserved `/dashboard/lms/results/critical` may be converted from placeholder to real capability during authorized implementation |
| **Reuse** | Existing LMS Testing/Result UX patterns where appropriate; do not duplicate an authoritative worklist unnecessarily |

### AD-CRT-07 — Pathology non-reuse

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Traceability** | Decision package AD-CRT-07; Discovery §19 RED; AD-TST/AD-VER/AD-AUTH Pathology boundaries |
| **Rule** | Pathology remains completely separate |
| **MUST NOT become LMS Critical SoT** | `LabReport.Interpretation`; Pathology `"critical"` strings; Pathology result flags; Pathology legacy workflows |
| **Forbidden** | Migration or bridge |

### AD-CRT-08 — Upstream mutation ban

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Traceability** | Decision package AD-CRT-08; Discovery §32 certified upstream; PD-AUTH/PD-VER closures |
| **Rule** | Critical operations MUST NOT mutate OrderTest, Specimen, CollectionTask, Receiving, Accession, or Barcode |
| **Preserve** | Certified upstream lifecycles unchanged |

### AD-CRT-09 — Idempotency

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Traceability** | Decision package AD-CRT-09; Discovery §17; PD-CRT-11 |
| **Rule** | Critical operations require idempotency protection |
| **Mechanism** | Dedicated Critical operation semantics or approved shared idempotency mechanism |
| **Minimum protect** | Critical event creation/classification; acknowledgement |
| **Notify** | Prevent notification duplication using Critical event identity |

### AD-CRT-10 — Orthogonal to ResultStatus

| Field | Content |
|---|---|
| **Status** | **APPROVED** |
| **Traceability** | Decision package AD-CRT-10; PD-CRT-02; Discovery §2 |
| **Rule** | Critical remains orthogonal to ResultStatus |
| **Forbidden** | Adding a Critical ResultStatus |
| **Lifecycle remains** | `Draft` → `TechnicalVerified` → `ClinicallyAuthorized` |

---

## 8. Approved first-slice implementation boundary

The future authorized L-CRT-01 implementation **MAY** include **ONLY**:

### IN SCOPE

1. CriticalResultEvent / equivalent event model  
2. Binding to `LmsResult`  
3. Exact ResultVersion binding  
4. Manual governed Critical classification  
5. Eligible Result validation (`TechnicalVerified` or later; existing Result eligibility)  
6. Critical staff work queue (real events)  
7. Critical Result detail/context  
8. In-app notification intent  
9. LaboratoryApi acknowledgement endpoint  
10. Required acknowledgement evidence  
11. Critical event audit  
12. Critical notification/ack audit where approved by implementation design  
13. Dedicated Critical permission catalog entries  
14. Tenant authorization  
15. Branch authorization consistent with existing Result mutations  
16. Idempotency  
17. Optimistic concurrency  
18. Honest failure handling  
19. Automated backend tests  
20. Automated FE tests  
21. AuthService permission/audit tests where applicable  
22. PRE-UAT verification  
23. Manual UAT  
24. Acceptance only after UAT  

### EXPLICITLY OUT OF SCOPE

- Automated numeric critical thresholds  
- Automated qualitative panic-value engine  
- Critical rule configuration master  
- Invented clinical thresholds  
- Invented escalation timers / recipient hierarchies / on-call roster / multi-level escalation  
- Final / Released / Published / PDF/report generation  
- Patient-visible Critical alerts / patient SMS/email  
- Amendments / Corrections  
- Instrument / Runs / Autoverification / QC  
- Referral / Billing  
- Pathology migration / Pathology bridge  
- Analytics KPI suite / fake Critical metrics  
- Changes to L-TST-01A / L-VER-01 / L-AUTH-01  
- Changes to Collection / Specimen / Receiving / Barcode  
- Changes to OrderTest lifecycle  
- Production role grants  
- New organization hierarchy  
- Critical ResultStatus  

---

## 9. Configuration honesty

**Automated Critical detection is NOT authorized** because governed Critical Rule configuration does not currently exist.

| Item | Closure rule |
|---|---|
| `CriticalThresholdConfigRef` | Opaque hook only — **not** a working threshold source |
| `ReferenceIntervalConfigRef` | Opaque — **must not** assume reference interval = critical threshold |
| `FlagConfigRef` | Opaque — **not** Critical SoT |
| `authorization_required` | **Must not** be used as Criticality |
| Pathology `"critical"` interpretation strings | **Must not** be reused as LMS Critical SoT |
| Placeholder clinical thresholds | **Forbidden** merely to enable first slice |

**Deferred configuration / FUTURE items (not authorized here):**

- Critical Rule masters (thresholds, qualitative values, population/specimen/unit/site rules, effective dating, versioning, activation)  
- Recipient / on-call matrix  
- Escalation timers / ack SLA (PD-LAB-CRIT-02 residual)  
- Multi-channel clinical delivery beyond in-app intent  
- Reporting gate requiring Critical acknowledgement  
- Patient visibility of Critical alerts  
- Abnormal flag calculation engine  

---

## 10. Permission policy

| Policy | Status |
|---|---|
| Dedicated Critical Results permission family | **APPROVED** |
| Catalog seed during authorized implementation | **APPROVED** (future implement task) |
| Production role grants | **NOT AUTHORIZED** |
| Silent role assignment changes | **FORBIDDEN** |

---

## 11. Audit policy

| Policy | Status |
|---|---|
| Platform `audit_log` is audit SoT | **APPROVED** |
| Distinct Critical event auditable resource | **APPROVED** |
| Fail-closed for safety-critical mutations | **APPROVED** |
| Allowlist / action introduction | **Only** during authorized implementation — **not** this closure task |

---

## 12. Notification boundary

```text
LaboratoryApi
  → critical notification intent
  → platform notification / orchestration
  → configured delivery channel (in-app for first slice)
```

| Rule | Status |
|---|---|
| Lab emits intent; platform delivers | **APPROVED** |
| No Twilio/SMS/WhatsApp/SMTP hard-wire in LaboratoryApi | **APPROVED** |
| Delivery ≠ acknowledgement | **APPROVED** |
| Failed notify ≠ closed / acked | **APPROVED** |

---

## 13. Decision register (closed for L-CRT-01)

| ID | Topic | Status |
|---|---|---|
| PD-CRT-01 | Governed manual Critical classification | **APPROVED** |
| PD-CRT-02 | Orthogonal CriticalResultEvent; no Critical ResultStatus | **APPROVED** |
| PD-CRT-03 | Critical independent of Clinical Authorization | **APPROVED** |
| PD-CRT-04 | Eligibility = TechnicalVerified or later; Draft forbidden | **APPROVED** |
| PD-CRT-05 | Bind exact ResultVersion; immutable historical events | **APPROVED** |
| PD-CRT-06 | Dedicated Critical ack permission; view/toast/SMS ≠ ack | **APPROVED** |
| PD-CRT-07 | Authenticated ack + timestamp + mandatory evidence/comment | **APPROVED** |
| PD-CRT-08 | Escalation OUT OF SCOPE / FUTURE | **APPROVED** |
| PD-CRT-09 | In-app intent only; no Lab channel hard-wire | **APPROVED** |
| PD-CRT-10 | Dedicated permission family; catalog only; no role grants | **APPROVED** |
| PD-CRT-11 | One open event per ResultVersion; notify dedupe by event id | **APPROVED** |
| PD-CRT-12 | Reporting/Final/Release OUT OF SCOPE | **APPROVED** |
| PD-CRT-13 | Patient visibility OUT OF SCOPE | **APPROVED** |
| PD-CRT-14 | Critical event only; no abnormal engine | **APPROVED** |
| PD-CRT-15 | No Critical Rule config engine in first slice | **APPROVED** |
| PD-CRT-16 | Fail-closed; no false success; no invented retry | **APPROVED** |
| PD-CRT-17 | Analytics OUT OF SCOPE; no fake KPIs | **APPROVED** |
| PD-CRT-18 | Historical events immutable; Amendments FUTURE | **APPROVED** |
| AD-CRT-01 … AD-CRT-10 | Architecture | **APPROVED** |

**No required L-CRT-01 Product Decision remains OPEN for this bounded first slice.**

Upstream boundaries A–S remain **APPROVED**.  
Future automated thresholds / escalation timers / Reporting gate / patient visibility / Amendments / Instrument decisions remain separate and are **not** approved here.

---

## 14. UAT / acceptance gate (future implementation task)

After a separate authorized implementation:

1. Automated tests  
2. PRE-UAT verification  
3. Manual UAT  
4. Acceptance only after UAT  

Manual UAT considerations (for the future implementation task — **not** performed here):

- Classify Critical only on TechnicalVerified or ClinicallyAuthorized eligible ResultVersion  
- Confirm Draft cannot be classified Critical  
- Confirm ResultStatus unchanged (no Critical status)  
- Confirm authorize still works without Critical ack (PD-CRT-03)  
- Acknowledge with mandatory evidence; unauthorized user denied  
- Confirm toast/view/SMS delivery alone does not close event  
- Notification unavailable → explicit failure; no false “sent/acked”  
- Idempotent re-classify / re-ack against same ResultVersion  
- Tenant / branch denial paths  
- Audit visible in platform audit trail  
- Upstream OrderTest / Specimen / Collection / Receiving / Barcode / Auth / Verify / Draft unchanged  
- No mock Critical queue rows; no fake KPIs  
- No patient-facing Critical disclosure  

**This decision task does not perform Manual UAT.**

---

## 15. IMPLEMENTATION AUTHORIZATION

# PRODUCT_DECISIONS_CLOSED_L_CRT_01_AUTHORIZED

| Field | Content |
|---|---|
| **Authorized implementation** | **L-CRT-01 — Critical Results** (bounded first slice) |
| **Authorization** | **AUTHORIZED FOR SEPARATE IMPLEMENTATION TASK** |
| **This document** | Does **not** implement L-CRT-01 |
| **Implementation state** | **IMPLEMENTATION_NOT_STARTED** |
| **Criticality model** | Orthogonal CriticalResultEvent (not ResultStatus) |
| **Detection** | Governed manual classification only |
| **Ack** | LaboratoryApi endpoint + dedicated permission + evidence |
| **Notify** | In-app intent via platform orchestration |
| **Permissions** | Catalog only; **no role grants** |
| **All other capabilities beyond §8 IN SCOPE** | Remain **unauthorized** |

**THIS DOCUMENT AUTHORIZES A SEPARATE FUTURE L-CRT-01 ENGINEERING IMPLEMENTATION TASK.**

**This stamp means:**

- Product decisions are closed for the bounded first slice  
- Engineering implementation of L-CRT-01 is now authorized as a **separate** task  
- It does **not** authorize automated Critical Rule detection  
- It does **not** authorize escalation timers / on-call matrices  
- It does **not** authorize Reporting / Final / Release  
- It does **not** authorize Amendments  
- It does **not** authorize patient visibility  
- It does **not** authorize production role grants  
- It does **not** authorize changes to L-TST / L-VER / L-AUTH / Collection slices  

**Explicitly not authorized by this stamp:** Automated thresholds · Escalation · Reporting / Final / Release · Amendments · Instrument/Runs/QC · Autoverification · Referral · Billing · Pathology migration · patient Critical alerts · analytics KPI suite · upstream lifecycle changes · production role grants · audit allowlist / permission seed changes in **this** task · L-AUTH-01 / L-VER-01 / L-TST-01A changes.

**L-CRT-01 is authorized as a separate future engineering implementation task.**

**Next step:** Separate Cursor / engineering implementation task against this closure only.

---

## 16. Confirmation — this task

- NO APPLICATION IMPLEMENTATION  
- NO DATABASE / MIGRATION / SCHEMA / ROW CHANGES  
- NO RESULT ENTITY / STATUS ENUM / API / UI / ROUTE CHANGES  
- NO CRITICALRESULT EVENT TABLES CREATED  
- NO PERMISSION SEEDING / ROLE GRANTS  
- NO AUDIT ALLOWLIST CHANGES  
- NO NOTIFICATION CALLS / SENDS  
- NO L-AUTH-01 BEHAVIOR CHANGES  
- NO L-VER-01 BEHAVIOR CHANGES  
- NO L-TST-01A BEHAVIOR CHANGES  
- NO COLLECTION / SPECIMEN / RECEIVING / BARCODE / ORDER / ORDERTEST CHANGES  
- NO PATHOLOGY CHANGES  
- NO REPORTING / AMENDMENTS / INSTRUMENT / REFERRAL / BILLING START  

Discovery audit and decision package were **not** deleted.

---

## 17. Explicit stop condition

**STOP.**

- Do **not** implement L-CRT-01 in this task  
- Do **not** create migrations  
- Do **not** create APIs  
- Do **not** create UI  
- Do **not** seed permissions  
- Do **not** grant roles  
- Do **not** change audit allowlists  
- Do **not** send notifications  
- Do **not** start Reporting  
- Do **not** start Amendments  
- Do **not** start automated Critical Rule configuration  

Wait for the next explicit engineering implementation task.

---

## FINAL STATUS

**PRODUCT_DECISIONS_CLOSED_L_CRT_01_AUTHORIZED**

**IMPLEMENTATION_NOT_STARTED**

**Authorized implementation:** L-CRT-01 — Critical Results (bounded first slice)

**THIS DOCUMENT AUTHORIZES A SEPARATE FUTURE L-CRT-01 ENGINEERING IMPLEMENTATION TASK.**

**All other Results capabilities beyond the approved L-CRT-01 first-slice scope remain unauthorized.**

**NEXT GATE:** SEPARATE L-CRT-01 AUTHORIZED ENGINEERING IMPLEMENTATION
