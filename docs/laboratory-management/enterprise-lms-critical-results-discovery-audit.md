# L-CRT-01 — Critical Results  
# Discovery / Repository Audit

**Date:** 2026-10-12  
**Slice candidate:** L-CRT-01 — Critical Results (boundary pending Product Owner)  
**Mode:** DOCUMENTATION / DISCOVERY / AUDIT ONLY — no application code, schema, migrations, APIs, UI, permissions, seed data, role grants, audit allowlists, notifications, or workflows modified  

**Upstream certified boundary:**

| Slice | Status |
|---|---|
| L-COL-01B … L-COL-01E | **ACCEPTED** |
| L-TST-01A | **ACCEPTED** — Draft Result SoT |
| L-VER-01 | **IMPLEMENTED / PRE-UAT / Manual UAT exercised** — Draft → `TechnicalVerified` |
| L-AUTH-01 | **IMPLEMENTED / Manual UAT completed** — `TechnicalVerified` → `ClinicallyAuthorized` |

**Authoritative context:**

| Source | Role |
|---|---|
| Enterprise LMS PRD/BRD v1.0 (via certified extractions; binary not in repo) | Functional SoT |
| [laboratory-management-product-definition-v3.md](../decisions/laboratory-management-product-definition-v3.md) §12 | PD-LAB-CRIT-01 **APPROVED**; PD-LAB-CRIT-02 residual |
| [enterprise-lms-testing-discovery-audit.md](./enterprise-lms-testing-discovery-audit.md) | PRD-RES-02 / PRD-RES-04 / §13 Critical extractions |
| [enterprise-lms-testing-decision-closure.md](./enterprise-lms-testing-decision-closure.md) | PD-TST-13 **DEFERRED** → L-CRT-01 |
| [enterprise-lms-verification-decision-closure.md](./enterprise-lms-verification-decision-closure.md) | PD-VER-09 / PD-VER-19 Critical out of L-VER |
| [enterprise-lms-clinical-authorization-decision-closure.md](./enterprise-lms-clinical-authorization-decision-closure.md) | PD-AUTH-11 / AD-AUTH-10 Critical out of L-AUTH; Auth↔Critical revisit at L-CRT gate |
| LaboratoryApi Result domain (inspected 2026-10-12, post L-AUTH-01) | Runtime evidence |

```text
L-AUTH-01 CERTIFIED UPSTREAM
  Draft → TechnicalVerified → ClinicallyAuthorized
  (NOT Final / Released / patient-visible / Critical workflow)
  ↓
THIS AUDIT — what exists vs Critical Results gap
  ↓
enterprise-lms-critical-results-decision-package.md
  ↓
STOP — wait for Product Owner closure
  ← NOT AUTHORIZED FOR IMPLEMENTATION BY THESE DOCUMENTS
```

**This document does not authorize or implement Critical Results.**

Where the PRD or approved closures do not define a rule, the classification is **DECISION REQUIRED**. No silent choices. No invented clinical thresholds, timers, recipients, or interpretation.

---

## 1. Executive summary

1. **Enterprise LMS Result lifecycle after L-AUTH-01** is exactly:

```text
Draft → TechnicalVerified → ClinicallyAuthorized
```

2. **Critical Results are not implemented.** There is no Critical Result entity, status, API, permission, acknowledgement, escalation, detection engine, or work queue. FE route `/dashboard/lms/results/critical` is a **placeholder** (`not_implemented`).

3. **PRD requires** critical detection, communication, escalation, acknowledgement, and closure with evidence (**PRD-RES-04**), and persistence of abnormal/critical flags (**PRD-RES-02**). Architecture **PD-LAB-CRIT-01** is **APPROVED** (events + ack + escalate via platform orchestration). Residual policy **PD-LAB-CRIT-02** (thresholds, recipients, escalation timers, ack SLA) remains **PRODUCT DECISION REQUIRED** and historically **blocks L7 / L-CRT-01**.

4. **Catalogue has opaque hooks only** (`CriticalThresholdConfigRef`, `ReferenceIntervalConfigRef`, `FlagConfigRef`). No governed critical-threshold tables, masters, or evaluation engine exist. Reference intervals must **not** be assumed to be critical thresholds. `authorization_required` is **not** criticality.

5. **Platform notification transport** (SignalR `NotificationHub`, internal push) is reusable infrastructure (**GREEN**). SMS/email paths are appointment-oriented / incomplete (**YELLOW**). No clinical critical acknowledgement or lab escalation chain exists (**RED** as SoT).

6. **Pathology** `LabReport.Interpretation` string values including `"critical"` are **RED** — must not become LMS Critical Results SoT.

7. **Highest-risk open decisions** before implementation: detection source/ownership; Auth↔Critical sequencing; event model vs ResultStatus; acknowledgement authority; escalation policy; notification failure behavior; first-slice scope under missing configuration.

8. **Recommended path:** Product Owner closes PD-CRT / AD-CRT (and residual CRIT-02 items) via the companion decision package. A fully automated critical-detection engine is **not** implementable until governed threshold configuration exists. A bounded first slice may still be possible if PO chooses a non-threshold-dependent detection mode (e.g. governed manual classification) — **DECISION REQUIRED**, not assumed.

**Discovery status:** `DISCOVERY_COMPLETE_READY_FOR_PRODUCT_OWNER_DECISION`

---

## 2. Current LMS Result lifecycle

### 2.1 Implemented states (repository evidence)

| Status constant | Stored value | Introduced by |
|---|---|---|
| `Draft` | `"Draft"` | L-TST-01A |
| `TechnicalVerified` | `"TechnicalVerified"` | L-VER-01 |
| `ClinicallyAuthorized` | `"ClinicallyAuthorized"` | L-AUTH-01 |

**Source:** `microservices/laboratory-service/LaboratoryApi/Domain/ResultEnums.cs`

**Transitions:**

| From | To | Operation | Permission |
|---|---|---|---|
| (none) | `Draft` | Create draft | `lms.testing.result` |
| `Draft` | `Draft` | Update draft | `lms.testing.result` |
| `Draft` | `TechnicalVerified` | Verify | `lms.testing.verify` |
| `TechnicalVerified` | `ClinicallyAuthorized` | Authorize | `lms.results.authorize` |

**Explicitly absent:** `Final`, `Released`, `AuthorizationPending`, any Critical-related ResultStatus, Critical event entity.

### 2.2 Meaning of ClinicallyAuthorized (certified)

From L-AUTH-01 closure: Clinical Authorization is **not** Final, Released, Published, patient-visible, report/PDF generation. Critical Results remain **L-CRT-01** (PD-AUTH-11).

### 2.3 Where Critical Results belong — open questions (no silent answer)

| Question | Current evidence | Classification |
|---|---|---|
| Is criticality metadata on `LmsResult`? | No fields | **DECISION REQUIRED** |
| Is criticality a property of `LmsResultVersion`? | No fields | **DECISION REQUIRED** |
| Is criticality an event (`CriticalResultEvent`)? | IA / V3 architecture concept only; no table | **DECISION REQUIRED** (architecture recommends event; not approved for LMS schema yet) |
| Can a TechnicalVerified result become critical? | No evaluation engine | **DECISION REQUIRED** |
| Can a Draft result be evaluated for criticality? | Forbidden in L-TST/L-VER; no engine | **DECISION REQUIRED** |
| Does critical handling occur before Clinical Authorization? | L-AUTH first slice: **no** Critical prerequisite (PD-AUTH-11); production sequencing revisit at L-CRT | **DECISION REQUIRED** (PD-CRT) |
| Does it occur after Clinical Authorization? | V3 workflow places CRITICAL HANDLING after clinical review/verification and before FINAL RELEASE | **DECISION REQUIRED** for Enterprise LMS Result-centric model |
| Can a result be ClinicallyAuthorized while critical notification unacknowledged? | Unruled | **DECISION REQUIRED** |
| Does critical handling change `ResultStatus`? | No Critical status today; prior closures forbid inventing Critical status under Auth/Verify | **DECISION REQUIRED** — recommend orthogonal event model (AD-CRT) |
| Should Critical Results have their own state machine? | PRD communication/ack/escalation/closure implies yes | **DECISION REQUIRED** |
| Is criticality orthogonal to ResultStatus? | Strong architecture hint (CriticalResultEvent) | **DECISION REQUIRED** |
| Does a critical event block reporting / release / patient visibility? | Reporting not implemented; INT-01 patient visibility **PD** | **DECISION REQUIRED** |

---

## 3. PRD Critical Results requirements

### 3.1 PRD file gap

Enterprise LMS PRD/BRD v1.0 binary (`enterprise_laboratory_management_system_prd_brd.docx`, cited 08 Oct 2026 in prior extractions) is **not present in this repository**. Requirements below are from **certified prior extractions** and approved decision documents. Line-level re-verification against the binary is a residual ambiguity (**PRD FILE GAP**).

### 3.2 Extracted PRD identifiers

| PRD ID | Requirement (as extracted) | Relevance to L-CRT-01 |
|---|---|---|
| **PRD-RES-04** | Critical detection, communication, escalation, acknowledgement, closure with evidence | **Primary** Critical Results requirement |
| **PRD-RES-02** | Persist units, reference interval, **abnormal/critical flags**, source/method, specimen, comments, report version per component | Flags persist; live calc needs config |
| **PRD-WF-07** | Technical verification then clinical authorization per test policy; **critical communication**; versioned report | Critical communication as workflow stage |
| **PRD-RES-01** | Distinguish draft, technical verification, clinical authorization, preliminary, final, amended, corrected, cancelled | Status distinction; Critical not listed as ResultStatus in this extraction |
| **PRD-RES-03** | Authorized signatory by test/discipline/site/flags/delegation | Authority matrix — **not** Critical SoT; incomplete in LMS |
| **PRD-RES-05/06** | Versioned reports; no overwrite of released report | Reporting boundary — out of L-CRT unless PO expands |
| **PRD-REL-1** | Release 1 acceptance scenarios mention critical path (per Testing discovery) | MVP timing historically deferred to L-CRT-01 |

**Source:** `enterprise-lms-testing-discovery-audit.md` §4 / §12–13; reaffirmed in Verification/Auth discoveries.

### 3.3 Critical protocol topics (Testing discovery §13 paraphrase)

| Topic | PRD requirement (extracted) | Decision dependency |
|---|---|---|
| Identification | Critical limits per test/population/site/policy version; **flag ≠ clinical contact** | **CONFIGURATION_REQUIRED** + **PRODUCT_DECISION_REQUIRED** |
| Acknowledgement | Separate communication event with recipient evidence | **PRODUCT_DECISION_REQUIRED** |
| Notification / escalation | Time-bound escalation chain; **portal SMS alone never closes** | **CONFIGURATION_REQUIRED** / **PRODUCT_DECISION_REQUIRED** |
| Documentation / audit | Detected time, reviewer, result/version, recipient, method, read-back, attempts, closure | Model required if in scope |
| MVP inclusion | Whether inside Testing vs L-CRT-01 | **Resolved for Testing:** PD-TST-13 **DEFERRED** to L-CRT-01 |

### 3.4 Approved architecture (V3 §12) — not LMS schema approval

From `laboratory-management-product-definition-v3.md` §12:

**Must support:** critical-value policy, qualifying result, critical event, responsible recipient, communication attempt, acknowledgement, escalation, final communication status, audit trail.

**Channels:** via communication orchestration only (in-app, SMS, email, WhatsApp, other approved). Lab emits intents; providers are infrastructure.

**Residual:** Exact thresholds / recipient matrix / escalation timers = **PD-LAB-CRIT-02** before L7 implementation.

| ID | Statement | Status |
|---|---|---|
| **PD-LAB-CRIT-01** | Critical-result events + acknowledgement + escalation via platform comms | **APPROVED** (architecture) |
| **PD-LAB-COM-01** (V3) | Generic communication orchestration; no channel hard-wiring in Lab domain | **APPROVED** |
| **PD-LAB-CRIT-02** | Thresholds, recipients, escalation timers, ack SLA | **PRODUCT DECISION REQUIRED** / blocks L7 |
| **NOTIF-01** (PO closure) | Core intents include critical result; ack via Laboratory API only | **APPROVED** principle |
| Intent `lab.result.critical` | Catalogued; recipients/matrix detail under CRIT-02 | Intent existence approved; detail **PDR** |

### 3.5 Abnormal vs critical (PRD distinction)

| Source | Distinction |
|---|---|
| PRD-RES-02 | Persist **abnormal/critical flags** (both named) |
| Testing discovery §12–13 | Abnormal flag calculation vs **critical thresholds** are separate config topics; critical **flag ≠ clinical contact** |
| Legacy Pathology | `Interpretation` string: normal / abnormal / critical / high / low — **string only**, not event workflow |
| L-TST / L-VER / L-AUTH | Must **not** invent abnormal or critical clinical interpretation |

**Verdict:** PRD distinguishes abnormal vs critical at the flag/protocol level. Repository has **no authoritative abnormal/critical calculation engine** for Enterprise LMS. Do not invent one in discovery.

### 3.6 Requirements explicitly NOT found in PRD extractions

Do not invent: numeric cutoff values; 5/10/15/30-minute timers; recipient hierarchies; on-call rosters; qualitative panic lists; site-specific matrices; patient-facing critical SMS content. All such items are **DECISION REQUIRED** / **CONFIGURATION_REQUIRED**.

---

## 4. Existing repository capabilities

### 4.1 What L-TST-01A provides

- `LmsResult` / `LmsResultVersion` / idempotency tables  
- Draft create/update; work queue; Testing Workbench; Result detail  
- Permissions: `lms.testing.view` / `manage` / `result`  
- Audit: `CREATE_RESULT_DRAFT`, `UPDATE_RESULT_DRAFT`  
- Explicitly **out:** abnormal/critical flags, verify, authorize, Final/release  

### 4.2 What L-VER-01 provides

- Transition `Draft` → `TechnicalVerified`  
- Metadata: `VerifiedByUserId`, `VerifiedAtUtc`, `VerifiedVersionNumber`  
- Permission: `lms.testing.verify`; audit `VERIFY_RESULT`  
- Structural validation only — **no** interval/flag/critical evaluation  
- FE verification surface via Testing workbench `resultStatus="Draft"`  

### 4.3 What L-AUTH-01 provides

- Transition `TechnicalVerified` → `ClinicallyAuthorized`  
- Metadata: `AuthorizedByUserId`, `AuthorizedAtUtc`, `AuthorizedVersionNumber`  
- Permission: `lms.results.authorize`; audit `AUTHORIZE_RESULT`  
- Version bind to verified version; same person may verify then authorize  
- Explicitly **not** Critical (PD-AUTH-11)  

### 4.4 What exists for Critical today

| Artifact | State |
|---|---|
| FE route `/dashboard/lms/results/critical` | Placeholder `LmsCapabilityPage` |
| Capability registry `results-critical` | `not_implemented` |
| Nav / overview tile `critical-events` | Navigation only — no live KPI |
| Catalogue `CriticalThresholdConfigRef` | Opaque nullable string |
| Critical entity / API / permission / ack / escalate | **Absent** |

---

## 5. Current Result domain audit

### 5.1 Entities / enums / service

| Artifact | Path | Critical relevance |
|---|---|---|
| `LmsResult` | `LaboratoryApi/Domain/LmsResult.cs` | Aggregate SoT; verify/authorize metadata; **no critical fields** |
| `LmsResultVersion` | `Domain/LmsResultVersion.cs` | Append-only values; **no critical metadata** |
| `ResultStatuses` | `Domain/ResultEnums.cs` | Draft / TechnicalVerified / ClinicallyAuthorized only |
| `ResultIdempotencyOperations` | same | create/update/verify/authorize only |
| `ResultAuditActions` | same | four Result actions only |
| `ResultService` | `Services/ResultService.cs` | Work queue + draft + verify + authorize; comment forbids inventing criticals |
| `ResultDtos` | `Services/ResultDtos.cs` | No critical DTOs |
| `TestingFunctions` | `Functions/TestingFunctions.cs` | No critical endpoints |
| `LaboratoryAuthz` | `Services/LaboratoryAuthz.cs` | No critical permission constants |

### 5.2 Idempotency / concurrency / audit / authz

| Concern | Current state | Reuse for L-CRT |
|---|---|---|
| RowVersion | Optimistic concurrency on Result | **GREEN** pattern |
| Idempotency | Operation-specific records | **GREEN** pattern for notify/ack ops |
| Audit | Platform `audit_log`; fail-closed on verify/authorize | **GREEN** pattern; new actions need allowlist (**DECISION** at implement) |
| Tenant | Tenant-scoped | **GREEN** |
| Branch | `ValidateUserBranchAsync` / `403 branch_unauthorized` | **GREEN** |
| Permissions | view/manage/result/verify/authorize | No critical codes — **DECISION REQUIRED** |

### 5.3 Work queue

| Query | Behavior |
|---|---|
| Default (no `resultStatus`) | Actionable Testing: no Result or `Draft` only |
| `resultStatus=Draft` | Verification surface |
| `resultStatus=TechnicalVerified` | Authorization surface |
| Critical filter | **Absent** |

### 5.4 Classification of Result artifacts for Critical reuse

See §22 GREEN/YELLOW/RED matrix.

---

## 6. Critical detection audit

### 6.1 Authoritative sources searched

| Candidate source | Finding | Classification |
|---|---|---|
| Numeric critical lower/upper bounds | **Absent** as governed LMS tables | **CONFIGURATION_REQUIRED** |
| Qualitative critical values | **Absent** | **CONFIGURATION_REQUIRED** |
| Age/sex/specimen/unit-dependent critical rules | **Absent** | **CONFIGURATION_REQUIRED** |
| Branch/site/section/discipline-specific critical rules | **Absent** | **CONFIGURATION_REQUIRED** / **DECISION REQUIRED** |
| Test/panel/analyte-specific critical rules | Opaque `CriticalThresholdConfigRef` only | **CONFIGURATION_REQUIRED** |
| Effective dates / versioning / activation | Catalogue versioning exists; critical rule versioning **absent** | **CONFIGURATION_REQUIRED** |
| `ReferenceIntervalConfigRef` | Opaque; **≠** critical thresholds | **YELLOW** — must not assume |
| `FlagConfigRef` | Opaque | **YELLOW** |
| `AuthorizationRequired` | Catalogue flag for auth policy — **≠** criticality | **RED** as critical SoT |
| MasterValue | LMS seeds specimen rejection reasons; no critical masters | **CONFIGURATION_REQUIRED** |
| Pathology analyte `ReferenceRangeText` / LabReport interpretation | Legacy free-text / string | **RED** as LMS SoT |
| Hard-coded medical knowledge | Forbidden by program principles | **RED** |

### 6.2 Evaluation engine

| Capability | Exists? |
|---|---|
| Automated critical detection at draft/verify/authorize | **No** (explicitly forbidden in L-VER/L-AUTH) |
| Abnormal flag engine | **No** |
| Manual critical classification UI | **No** |

**Verdict:** No authoritative Critical Rule SoT exists. Automated detection is **CONFIGURATION / PRODUCT DECISION REQUIRED**.

---

## 7. Notification audit

| Capability | Evidence | Classification |
|---|---|---|
| SignalR `NotificationHub` | AuthService hub `/notificationHub`; tenant/user groups | **GREEN** transport |
| FE `useNotifications.ts` (JWT) | Canonical staff hook | **GREEN** |
| FE `use-notifications.ts` | next-auth + sonner fork | **YELLOW** — avoid for new LMS work |
| Internal push API | `InternalNotificationController` push-dept/user | **GREEN** pattern |
| `NotificationService` | Generic fan-out | **GREEN** generic |
| SMS (`SmsService` / Twilio) | Appointment reminder path; fails closed if credentials missing | **YELLOW** |
| Email (`EmailService`) | SMTP incomplete / log-only paths observed | **YELLOW** |
| Delivery status / retry | Appointment reminder pending/sent/failed; limited retry | **YELLOW** — not clinical critical SoT |
| LaboratoryApi → notify | **No** critical notify calls | **RED** (absent) |
| Clinical critical acknowledgement | **Absent** | **RED** |
| Counsellor escalation | Counselling domain | **RED** for L-CRT SoT |
| Toast (`react-hot-toast`) | UI feedback only — ≠ orchestration | **YELLOW** (UI only) |

**Approved principle:** Lab emits intents; channels via orchestration (PD-LAB-COM-01 V3). Portal SMS alone never closes critical protocol (PRD extraction).

**Do not send real notifications during discovery** — none sent.

---

## 8. Acknowledgement audit

### 8.1 PRD requirement

PRD-RES-04 and Testing discovery §13 require acknowledgement as a **separate communication event with recipient evidence**. V3 §12 lists acknowledgement as required capability. NOTIF-01 / INT-01: ack updates Lab critical-event state **via Lab API only**.

### 8.2 Open decisions (all DECISION REQUIRED)

| Question | Status |
|---|---|
| Who acknowledges? | **DECISION REQUIRED** |
| What authority / permission? | **DECISION REQUIRED** |
| Ordering provider vs other clinician vs lab staff? | **DECISION REQUIRED** |
| Acknowledgement vs receipt (read) distinction? | **DECISION REQUIRED** |
| Mandatory acknowledgement? | Strong PRD/architecture intent — exact rule **DECISION REQUIRED** |
| What counts as acknowledgement (UI click, phone read-back, both)? | **DECISION REQUIRED** |
| Comment/reason required? | **DECISION REQUIRED** |
| Can acknowledgement be reversed / amended? | **DECISION REQUIRED** |
| Timeout if nobody acknowledges? | **DECISION REQUIRED** — do not invent minutes |
| Escalation after timeout? | **DECISION REQUIRED** (CRIT-02) |
| Failed delivery behavior? | **DECISION REQUIRED** |

Closest unrelated patterns (must not become Critical SoT): LMS order `AcknowledgementEvidence` (consent), CCMS claim acknowledge.

---

## 9. Escalation audit

| Topic | PRD / architecture | Repository |
|---|---|---|
| Escalation required | PRD-RES-04; V3 §12; INT-01 “Required escalate path” | **No** LMS critical escalation config |
| Escalation target | CRIT-02 | **Absent** |
| Escalation timer | CRIT-02 | **Absent** — do not invent 5/10/15/30 minutes |
| Alternate recipient / supervisor / lab manager / on-call | CRIT-02 | **Absent** |
| Branch/site/discipline authority | PRD-RES-03 incomplete | **CONFIGURATION_REQUIRED** / **DECISION REQUIRED** |

**Classification:** **DECISION REQUIRED** / **CONFIGURATION_REQUIRED** (PD-LAB-CRIT-02 residual).

---

## 10. Versioning audit

### 10.1 Result versioning today

- `LmsResultVersion` is append-only value history.  
- Verify binds `VerifiedVersionNumber`; Authorize requires current == verified version.  
- Later versions must not silently rewrite historical truth.

### 10.2 Critical event ↔ version binding (open)

| Binding option | Notes | Status |
|---|---|---|
| Bind to current `ResultVersion` at detection | Preserves snapshot of critical values | **DECISION REQUIRED** |
| Bind to TechnicalVerified version | Aligns with TV stamp | **DECISION REQUIRED** |
| Bind to ClinicallyAuthorized version | Aligns with auth stamp | **DECISION REQUIRED** |
| One event per Result (not version) | Risks overwriting history on amend | **DECISION REQUIRED** — likely unsafe |
| One event per transition into critical | Supports repeat/amend scenarios | **DECISION REQUIRED** |

**Invariant (recommended architecture principle, not approved):** A later `ResultVersion` must never silently rewrite a historical critical event. Prefer immutable `CriticalResultEvent` rows keyed to a specific version number.

### 10.3 Duplicate / repeated critical events (open)

| Scenario | Status |
|---|---|
| Same critical value repeated | **DECISION REQUIRED** |
| Corrected / amended critical value | **DECISION REQUIRED** (Amendment boundary) |
| Notification already acknowledged | **DECISION REQUIRED** |
| Critical across multiple versions / specimens | **DECISION REQUIRED** |
| Same ResultVersion notified twice | INT-01 recommends dedupe by CriticalResultEvent id | **RECOMMENDED** principle / not LMS-approved |
| Same recipient notified twice | **DECISION REQUIRED** |

---

## 11. Authorization boundary (L-AUTH-01)

| Fact | Status |
|---|---|
| Critical ≠ Clinical Authorization | **APPROVED EXISTING** (PD-AUTH-11, AD-AUTH-10) |
| L-AUTH does not implement detection/notify/escalation/ack | **APPROVED EXISTING** |
| L-AUTH first slice has **no** Critical prerequisite | **APPROVED EXISTING** |
| Production Auth↔Critical sequencing (before/after/parallel; block authorize until ack?) | **DECISION REQUIRED** at L-CRT gate |
| Do not modify L-AUTH-01 in this discovery | Observed |

Interaction options for PO (not approved):

| Option | Description |
|---|---|
| A | Critical handling parallel; authorize independent of critical ack |
| B | Critical detection after authorize; ack before Reporting/Release |
| C | Critical detection before authorize; authorize blocked until ack |
| D | Hybrid / stage-dependent |

---

## 12. Reporting / release boundary

| Fact | Status |
|---|---|
| Critical ≠ Reporting / Final / Release | **APPROVED EXISTING** boundary from Auth/Verify closures |
| Final / Released / PDF / patient communication | **Not implemented**; out of L-CRT unless PO expands |
| Does critical handling block Reporting? | **DECISION REQUIRED** |
| Does critical handling block patient visibility? | INT-01: patient crit visibility **PD** — **DECISION REQUIRED** |
| V3 workflow places CRITICAL before FINAL RELEASE | Architecture hint; Enterprise LMS Result model mapping **DECISION REQUIRED** |

---

## 13. Amendment boundary

Amendments are **not implemented**. Document-only future boundary questions:

| Scenario | Status |
|---|---|
| Critical result amended | **DECISION REQUIRED** (future L-AMD) |
| Critical result corrected | **DECISION REQUIRED** |
| Non-critical becomes critical on new version | **DECISION REQUIRED** |
| Critical becomes non-critical on new version | **DECISION REQUIRED** |
| Historical critical event immutability on amend | **DECISION REQUIRED** (recommend immutable event + new event) |

Do not implement Amendment behavior in L-CRT-01 unless PO explicitly expands scope.

---

## 14. Branch / site / section authority audit

| Authority dimension | LMS today | Critical relevance |
|---|---|---|
| Tenant | Enforced | **GREEN** reuse |
| Authorized operating branch | Enforced on Result mutations | **GREEN** reuse |
| Laboratory section / discipline / signatory matrix | **Not** full SoT (PRD-RES-03 honesty from L-AUTH) | **DECISION REQUIRED** / **CONFIGURATION_REQUIRED** |
| On-call / clinician responsibility matrix | **Absent** | **DECISION REQUIRED** (CRIT-02) |
| Branch-specific critical rules | **Absent** | **CONFIGURATION_REQUIRED** |

Do not invent a new organization hierarchy in L-CRT-01 without PO approval.

---

## 15. Permission audit

### 15.1 Existing relevant permissions

| Code | Seeded (Auth catalog) | Role grants | FE |
|---|---|---|---|
| `lms.testing.view` | Yes | No production grants from LMS docs | Yes |
| `lms.testing.manage` | Yes | No | Yes |
| `lms.testing.result` | Yes | No | Yes |
| `lms.testing.verify` | Yes | No | Yes |
| `lms.results.authorize` | Yes (L-AUTH) | No | Yes |
| `lms.results.view` (planned FE stub) | Not a Critical permission | N/A | Planned string only |

### 15.2 Candidate Critical permissions (NOT decided / NOT seeded)

Historical discovery candidate: `lms.results.critical.*` (Testing discovery).

Examples for PO consideration only:

- critical results view  
- critical results manage / classify  
- critical results acknowledge  
- critical results administer / configure  

**Do not decide final names without evidence. Do not seed. Do not grant roles.** All candidates are **PRODUCT_DECISION_REQUIRED** (PD-CRT).

---

## 16. Audit architecture

| Item | Evidence |
|---|---|
| Audit SoT | Platform `audit_log` via `PlatformAuditClient` → AuthService `InternalAuditController` |
| Current Result actions allowlisted | `CREATE_RESULT_DRAFT`, `UPDATE_RESULT_DRAFT`, `VERIFY_RESULT`, `AUTHORIZE_RESULT` |
| Resource | `LmsResult` |
| Failure mode | Fail-closed + compensating restore on verify/authorize |

### 16.1 Candidate Critical audit actions (NOT allowlisted)

| Candidate action | Typical fields |
|---|---|
| Critical detected | actor, authority, object (result/version/event), action, reason/policy, source, outcome, timestamp |
| Notification created / sent / failed | + channel, recipient, attempt |
| Acknowledgement | + ack evidence |
| Escalation / escalation acknowledged | + target |
| Critical event closed | + closure evidence |

**Do not change audit allowlists during discovery.** Extension is an implementation-gated decision after PO closure.

---

## 17. Idempotency / concurrency audit

| Scenario | Need | Pattern available |
|---|---|---|
| Duplicate critical event creation | Required if auto/manual create | Result idempotency pattern **GREEN** |
| Duplicate notification | INT-01 recommends dedupe by event id | **DECISION REQUIRED** detail |
| Duplicate acknowledgement | Required | **DECISION REQUIRED** + pattern reuse |
| Duplicate escalation | Required | **DECISION REQUIRED** |
| Retry after timeout / worker retry | Likely | **DECISION REQUIRED** |
| Browser double-click | Required | Idempotency-Key pattern **GREEN** |
| Concurrent ack vs escalate | Required | RowVersion-like concurrency **DECISION REQUIRED** on event entity |

Do not implement yet.

---

## 18. Failure / retry audit

| Failure mode | PRD explicit? | Status |
|---|---|---|
| Notification service unavailable | Protocol must not silently succeed | **DECISION REQUIRED** (fail-closed vs queue) |
| SMS / email / in-app fails | Portal SMS alone never closes | **DECISION REQUIRED** |
| Acknowledgement API fails | — | **DECISION REQUIRED** |
| Browser disconnect | — | Reuse idempotency **GREEN** pattern |
| Worker retries / duplicate request | INT-01 event id unique | **DECISION REQUIRED** |
| Retry counts / backoff values | **Not defined** | Do not invent |

---

## 19. Existing module reuse matrix

| Module / capability | Finding | Classification |
|---|---|---|
| LMS Result + TestingWorkbench | Proven queue/detail/mutation patterns | **GREEN** (infrastructure) |
| LMS capability route `/results/critical` | Placeholder reserved | **YELLOW** (route reuse; content not SoT) |
| NotificationHub / InternalNotification | Transport | **GREEN** |
| SMS/Email reminder services | Appointment-oriented | **YELLOW** |
| Pathology LabReport interpretation | String critical/abnormal | **RED** LMS SoT |
| Doctor exam severity “critical” | Clinical finding severity | **RED** |
| IP ward `criticalLabs` / acuity | Ward domain | **RED** |
| Patient portal `isAbnormal` | Consumer typing | **YELLOW** / not LMS SoT |
| Counsellor escalation | Counselling | **RED** |
| Analytics “Critical” risk labels | Non-lab | **RED** |
| CCMS claim acknowledge | Insurance | **RED** as Critical SoT |
| Order priority Urgent/STAT | Logistics priority | **YELLOW** (≠ panic value) |

---

## 20. Analytics considerations

| Topic | Status |
|---|---|
| Critical analytics required? | INT-01 lists time-to-ack as future metric — **FUTURE** / **DECISION REQUIRED** for L-CRT first slice |
| Denominator / status / freshness / TZ | **DECISION REQUIRED** if analytics in scope |
| Delivery success / unresolved events | **DECISION REQUIRED** |
| Infer clinical interpretation from Draft / TV / CA / cancelled | **Forbidden** unless explicitly governed |

**Recommendation (not approved):** Keep analytics **OUT OF SCOPE** for first L-CRT slice; avoid fake KPI tiles (foundation tests already reject fake `criticalResults: 4`).

---

## 21. Configuration dependency matrix

| Dependency | Classification |
|---|---|
| Numeric critical thresholds | **CONFIGURATION_REQUIRED** |
| Qualitative critical values | **CONFIGURATION_REQUIRED** |
| Units / age / sex / specimen rules | **CONFIGURATION_REQUIRED** |
| Branch/site/section rules | **CONFIGURATION_REQUIRED** / **PRODUCT_DECISION_REQUIRED** |
| Recipient / on-call matrix | **PRODUCT_DECISION_REQUIRED** (CRIT-02) |
| Notification channels | **PRODUCT_DECISION_REQUIRED** (orchestration exists; clinical policy open) |
| Acknowledgement rules | **PRODUCT_DECISION_REQUIRED** |
| Escalation / timeout rules | **PRODUCT_DECISION_REQUIRED** (CRIT-02) — do not invent minutes |
| Effective dates / versioning / activation | **CONFIGURATION_REQUIRED** |
| Opaque catalogue refs today | **AVAILABLE** as hooks only — **not** live evaluation SoT |
| MasterValue critical masters | **CONFIGURATION_REQUIRED** (absent) |
| Automated detection engine without config | **OUT_OF_SCOPE** / blocked |
| Reporting / Final / Amendments / Instrument | **OUT_OF_SCOPE** for L-CRT first slice (unless PO expands) |

---

## 22. GREEN / YELLOW / RED reuse matrix

### GREEN — safe reuse (no semantic conflict as infrastructure)

| Artifact | Why |
|---|---|
| `LmsResult` / `LmsResultVersion` as clinical value SoT | Authoritative Result pipeline |
| Result eligibility / tenant / branch checks | Same safety gates |
| Idempotency + RowVersion patterns | Mutation safety |
| Fail-closed platform audit pattern | Safety |
| `TestingWorkbench` + `resultStatus` filter pattern | Queue UX precedent |
| `ResultDraftEntry` detail shell | Context presentation |
| Permission catalog pattern (seed without grants) | Authz pattern |
| NotificationHub + internal push | Transport |
| Capability registry href reservation | Route already reserved |
| Platform `audit_log` as audit SoT | Approved existing |

### YELLOW — potential reuse; needs Product Decision / semantic validation

| Artifact | Why |
|---|---|
| `CriticalThresholdConfigRef` / interval / flag refs | Opaque hooks; not evaluation SoT |
| Work queue default filters | Critical queue needs distinct filter design |
| Overview critical-events tile | Nav only; must not invent counts |
| SMS/email infrastructure | Channel providers incomplete / wrong workflow today |
| `lms.results.view` planned stub | May or may not relate to Critical |
| Order Urgent/STAT | Priority ≠ critical value |
| Patient portal abnormal flags | Consumer projection |
| Auth↔Critical sequencing options | Explicit L-CRT gate |
| V3 LabReport-centric CriticalResultEvent naming | Enterprise LMS is Order/Result-centric — map carefully |

### RED — must not reuse as Critical Results SoT

| Artifact | Why |
|---|---|
| Pathology LabReport / interpretation `"critical"` | Wrong SoT; prior AD-TST/AD-VER/AD-AUTH forbid |
| Doctor severity “critical” | Wrong domain |
| IP criticalLabs / acuity | Wrong domain |
| Counsellor escalation | Wrong domain |
| Invented medical thresholds / timers / recipient trees | Clinical safety violation |
| Fake Critical UI rows / KPI | Honesty tests forbid |
| Mutating OrderTest / Specimen / Collection / Receiving / Barcode for critical | Certified upstream forbidden |
| Collapsing Critical into ResultStatus Final/Released | Reporting boundary |
| Using `authorization_required` as criticality | Wrong semantics |
| Assuming reference intervals = critical thresholds | Wrong semantics |

---

## 23. Proposed first-slice boundary (recommendation — NOT APPROVED)

### 23.1 Configuration blocker honesty

Because governed critical thresholds do **not** exist, a first slice that claims **automated critical detection** is **blocked** unless PO also authorizes a configuration program (or an alternative detection mode).

### 23.2 Recommended bounded L-CRT-01 options for PO

**Option CR-A — Event + manual classification foundation (recommended if config absent)**

| IN SCOPE (recommended) | OUT OF SCOPE |
|---|---|
| `CriticalResultEvent` (or equivalent) bound to Result + ResultVersion | Automated threshold engine |
| Governed **manual** critical classification by authorized lab role | Final / Released / Reporting / PDF |
| Critical work queue (staff) | Patient-visible critical alerts |
| In-app notification intent emission (platform orchestration) | Hard-wired SMS/WhatsApp from LaboratoryApi |
| Acknowledgement via Laboratory API | Full on-call roster / multi-level escalation timers |
| Audit actions for detect/notify/ack/close (allowlist at implement) | Amendments / Instrument / QC / Referral / Billing |
| Permissions catalog (no production role grants) | Pathology LabReport migration |
| Idempotency for create/ack | Analytics KPI suite |

**Option CR-B — Automated detection first**

Requires closing **CONFIGURATION_REQUIRED** (thresholds/rules) + CRIT-02 recipients/timers **before** or as part of implementation authorization. Higher risk; not recommended as first slice while config is empty.

**Option CR-C — Notification-only without event SoT**

**Forbidden recommendation** — violates PRD-RES-04 / PD-LAB-CRIT-01 (event + ack + evidence).

### 23.3 Explicit out-of-scope list (default recommendation)

- Final / Released / Published / PDF / patient communication  
- Amendments / corrections workflow  
- Instrument / Runs / QC / Autoverification  
- Referral / Billing  
- Pathology migration  
- Full PRD-RES-03 signatory/discipline matrix invention  
- Invented thresholds / timers / recipient hierarchies  
- Production role grants  
- Changing L-COL / L-TST / L-VER / L-AUTH certified behavior  
- Introducing Critical as a `ResultStatus` that replaces ClinicallyAuthorized  

---

## 24. PD-CRT decision register

| Decision ID | Topic | Repository evidence | PRD / prior ref | Current state | Recommended option | Alternatives | Risks | PO decision required |
|---|---|---|---|---|---|---|---|---|
| **PD-CRT-01** | First-slice detection mode | No threshold engine; opaque refs only | PRD-RES-04; CRIT-02 | No detection | **(A)** Manual governed classification for first slice | (B) Automated config-gated (C) Hybrid | Auto without config = clinical false safety | **Yes** |
| **PD-CRT-02** | Criticality model | No Critical fields/status | CriticalResultEvent IA/V3 | Absent | **(A)** Orthogonal event entity; ResultStatus unchanged | (B) New ResultStatus (C) Flag columns only | Status pollution vs Reporting | **Yes** |
| **PD-CRT-03** | Auth↔Critical sequencing | PD-AUTH-11 revisit | PRD-WF-07; V3 workflow | Auth independent today | **(A)** Parallel for first slice; block Reporting later | (B) Block authorize until ack (C) Detect only after authorize | Unsafe release vs workflow friction | **Yes** |
| **PD-CRT-04** | When detection may run | No engine | Flag ≠ contact | Unruled | Close: Draft? TV? CA? | Combinations | Premature clinician alert on Draft | **Yes** |
| **PD-CRT-05** | Version binding | Versioned Result | Immutable history | Unruled | Bind event to specific ResultVersion number | Result-only binding | Silent rewrite of history | **Yes** |
| **PD-CRT-06** | Acknowledgement authority | No ack API | PRD-RES-04; NOTIF-01 | Absent | Define who may ack + permission | Lab-only / clinician-only / either | Wrong person closes safety event | **Yes** |
| **PD-CRT-07** | Ack evidence requirements | — | Recipient evidence; read-back | Absent | Define mandatory fields | UI click only vs phone read-back | Weak legal traceability | **Yes** |
| **PD-CRT-08** | Escalation policy | No timers/targets | CRIT-02; PRD time-bound chain | Absent | Close CRIT-02 subset for first slice or defer escalation | Full matrix now | Invented timers; alert fatigue | **Yes** |
| **PD-CRT-09** | Notification channels for first slice | Hub GREEN; SMS/email YELLOW | PD-LAB-COM-01; SMS≠close | Transport only | In-app intent first; SMS/email later | Multi-channel day-1 | Failed delivery false closure | **Yes** |
| **PD-CRT-10** | Permissions model | No critical perms | Candidate `lms.results.critical.*` | Absent | Name + seed catalog only; no role grants | Reuse testing/authorize | Over/under privilege | **Yes** |
| **PD-CRT-11** | Duplicate / repeat notification | No event id | INT-01 dedupe | Absent | One open event per ResultVersion + dedupe notify | Per Result / per transition | Duplicate clinician spam | **Yes** |
| **PD-CRT-12** | Reporting / release gate | Reporting absent | V3 before FINAL RELEASE | Unruled | Critical ack required before Reporting (future) | Independent of Reporting | Patient sees unacked critical | **Yes** |
| **PD-CRT-13** | Patient visibility | Portal separate | INT-01 patient **PD** | Unruled | **Out of first slice** | Patient alert in slice | PHI / panic disclosure | **Yes** |
| **PD-CRT-14** | Abnormal vs critical flags | No flag engine | PRD-RES-02 | Absent | Critical event ≠ abnormal flag engine; defer abnormal calc | Combined engine | Scope explosion | **Yes** |
| **PD-CRT-15** | Configuration ownership | Opaque refs | Catalogue architecture | Hooks only | Who owns critical masters + effective dating | MasterValue vs catalogue tables | Orphaned refs | **Yes** |
| **PD-CRT-16** | Failure / outage behavior | Fail-closed Result audit exists | SMS never closes | Unruled | Critical notify fail must not look successful; ack API fail-closed | Best-effort notify | Silent patient-safety gap | **Yes** |
| **PD-CRT-17** | Analytics in first slice | Fake KPI forbidden | INT-01 time-to-ack FUTURE | Stub tile | **Out of first slice** | Minimal unresolved count | Fake safety metrics | **Yes** |
| **PD-CRT-18** | Amendment interaction | Amendments absent | Future L-AMD | Unruled | Immutable historical events; new event on new critical version | Mutate prior event | Lost forensic trail | **Yes** |

**Status vocabulary for new items:** OPEN / RECOMMENDED / DECISION REQUIRED only. **None marked APPROVED.**

**Already APPROVED upstream (not reopened):** PD-LAB-CRIT-01 architecture; PD-TST-13 / PD-VER-19 / PD-AUTH-11 boundaries; NOTIF-01 Lab-API ack principle; platform audit SoT.

---

## 25. AD-CRT decision register

| Decision ID | Topic | Repository evidence | Prior ref | Current state | Recommended option | Alternatives | Risks | PO / Architecture decision |
|---|---|---|---|---|---|---|---|---|
| **AD-CRT-01** | Domain ownership | LaboratoryApi owns Result | AD-AUTH Result ownership | No Critical domain | LaboratoryApi owns CriticalResultEvent SoT | AuthService owns events | Split SoT | **Yes** |
| **AD-CRT-02** | Event aggregate | IA lists CriticalResultEvent | V3 §5.2 / §12 | Absent | New LMS entity under LaboratoryApi (Result-centric, not Pathology LabReport) | Columns on LmsResult only | Overload Result aggregate | **Yes** |
| **AD-CRT-03** | Communication orchestration boundary | No Lab channel hard-wire | PD-LAB-COM-01 V3 | Pattern approved | Lab emits intent; NotificationService delivers | Direct Twilio from LaboratoryApi | Channel coupling | **Yes** |
| **AD-CRT-04** | Ack mutation path | INT-01 Lab API only | NOTIF-01 | Absent | Ack only via LaboratoryApi authorized endpoint | Ack via NotificationService mutating Lab | Dual SoT | **Yes** |
| **AD-CRT-05** | Audit resource type | Result uses `LmsResult` | InternalAuditController | No critical resource | New resource e.g. `LmsCriticalResultEvent` + actions | Reuse LmsResult only | Audit query ambiguity | **Yes** |
| **AD-CRT-06** | Work queue surface | TestingWorkbench reuse | Auth/Verify FE pattern | Placeholder route | Reuse TestingWorkbench pattern OR dedicated critical queue bound to events | Mock rows on placeholder | Fake queue | **Yes** |
| **AD-CRT-07** | Pathology non-reuse | LabReport interpretation | AD-TST-04 / AD-AUTH-06 / AD-VER-14 | Separate | Pathology remains **RED** SoT | Bridge Pathology strings into LMS | False clinical authority | **Yes** |
| **AD-CRT-08** | Upstream mutation ban | OrderTest stays Ordered | Auth/Verify closures | Observed | Critical must not mutate OrderTest/Specimen/Collection/Receiving/Barcode | Cross-mutate for “urgency” | Lifecycle corruption | **Yes** |
| **AD-CRT-09** | Idempotency store | `lms_result_idempotency` | Result pattern | Result-only | Dedicated critical idempotency ops or shared table with new ops | No idempotency | Duplicate events | **Yes** |
| **AD-CRT-10** | No Critical ResultStatus | ResultEnums 3 states | Program hard stop | 3 statuses | Keep Critical orthogonal; do not add Critical status in first slice unless PO requires | Add Critical status | Confuses Auth/Reporting | **Yes** |

**None of the new AD-CRT items are APPROVED.**

---

## 26. Risks

| Risk | Severity | Mitigation for discovery/decision |
|---|---|---|
| Implementing auto-detection without governed thresholds | **Critical** | Block auto mode until CONFIGURATION + CRIT-02 closed |
| Collapsing Critical into Auth or Final | **Critical** | Preserve PD-AUTH-11 / Reporting boundaries |
| Using Pathology critical strings as LMS SoT | **High** | RED classification; AD-CRT-07 |
| Invented escalation timers / recipients | **High** | DECISION REQUIRED only |
| Notification looks successful when delivery failed | **High** | Fail-closed / explicit delivery status PD |
| Portal SMS closes critical protocol | **High** | PRD: SMS alone never closes |
| Fake Critical KPI / queue rows | **Medium** | Honesty tests; stub remains not_implemented until real |
| Premature Draft clinician alerts | **High** | PD-CRT-04 detection timing |
| Dual SoT (NotificationService vs Lab event) | **High** | Ack via Lab API only |
| Skipping Product Owner gate | **Critical** | Hard stop after these docs |

---

## 27. Open questions

1. Detection mode for first slice without threshold masters?  
2. Orthogonal event vs ResultStatus?  
3. Auth↔Critical sequencing for production?  
4. Earliest ResultStatus eligible for critical evaluation?  
5. Acknowledgement persona + evidence?  
6. Escalation in or out of first slice?  
7. Channels in first slice (in-app only vs multi-channel)?  
8. Exact permission codes?  
9. Does unacked critical block future Reporting/Release?  
10. Patient visibility?  
11. Abnormal flag engine in or out of L-CRT?  
12. Configuration ownership model for critical rules?  
13. Duplicate event / notify policy?  
14. Failure/retry policy without invented backoff?  
15. PRD binary availability for line-level re-audit?  

---

## 28. Product Owner gate

```text
DISCOVERY (this document)
       ↓
PRODUCT OWNER DECISION
  (enterprise-lms-critical-results-decision-package.md)
       ↓
DECISION CLOSURE
       ↓
AUTHORIZED IMPLEMENTATION
       ↓
AUTOMATED TESTS
       ↓
PRE-UAT
       ↓
MANUAL UAT
       ↓
ACCEPTANCE
```

**Hard stop:** Do not implement L-CRT-01, modify Result entities/statuses, add Critical entities/APIs/UI, seed permissions, grant roles, change audit allowlists, send notifications, or start Reporting/Amendments/Instrument from these documents.

**Certified upstream verified untouched by this task:** L-COL-01B–E, L-TST-01A, L-VER-01, L-AUTH-01 — documentation only; no application changes.

---

## 29. Test inventory (inspection only — no new tests)

### 29.1 What currently protects Result lifecycle

| Suite | Protects |
|---|---|
| `ResultServiceTests` | Draft create/update |
| `ResultVerificationServiceTests` | Draft → TechnicalVerified; no invented Critical comments |
| `ResultAuthorizationServiceTests` | TV → ClinicallyAuthorized; no invented Critical |
| `TestingAuthorizeRouteContractTests` | Authorize route contract |
| AuthService `InternalAuditControllerTests` | Result audit allowlist |
| FE `enterprise-lms-testing-ui.test.ts` / foundation honesty tests | Stub honesty; no fake critical KPIs |

### 29.2 Future L-CRT test matrix (proposed — not written)

| Area | Future tests |
|---|---|
| Event create idempotency | Duplicate key → same event |
| Version binding immutability | New ResultVersion does not mutate prior event |
| Ack authorization | Wrong permission → 403 |
| Notify dedupe | Same event id not double-dispatched |
| Fail-closed audit | Audit down → no silent success |
| Boundary | Authorize still works without Critical if PD chooses parallel |
| Honesty | No mock critical queue rows; no invented thresholds in unit tests |
| Pathology non-coupling | LaboratoryApi remains free of LabReport Critical SoT |

---

## 30. Files created by this discovery

| File | Purpose |
|---|---|
| `docs/laboratory-management/enterprise-lms-critical-results-discovery-audit.md` | This audit |
| `docs/laboratory-management/enterprise-lms-critical-results-decision-package.md` | PO decision preparation |

---

## 31. Final discovery status

**`DISCOVERY_COMPLETE_READY_FOR_PRODUCT_OWNER_DECISION`**

Ambiguities remaining (non-blocking for decision package, blocking for implementation):

- PRD binary not in repository (rely on certified extractions)  
- PD-LAB-CRIT-02 still open (thresholds/recipients/timers/ack SLA)  
- Auth↔Critical production sequencing open at L-CRT gate  
- Configuration masters absent → automated detection blocked unless PO chooses alternate first-slice mode  
