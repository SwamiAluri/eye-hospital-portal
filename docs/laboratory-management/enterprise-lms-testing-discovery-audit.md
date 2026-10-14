# L-COL-01F — Testing  
# Discovery Audit + Product Decision Gate

**Date:** 2026-10-11  
**Slice:** L-COL-01F — Enterprise LMS Testing (examination / result foundation)  
**Mode:** AUDIT → PRODUCT DECISION WORKSHOP → IMPLEMENTATION READINESS GATE  
**Implementation:** **NOT AUTHORIZED** by this discovery document  
**Product Owner decision closure:** [enterprise-lms-testing-decision-closure.md](./enterprise-lms-testing-decision-closure.md) (`PRODUCT_DECISIONS_CLOSED_L_COL_01F_AUTHORIZED`)  

**Program:** Enterprise Hospital Laboratory Management System  
**Project:** Hospital Portal — Counsellor & Ownership  

---

## Gate determination

# PRODUCT_OWNER_APPROVED — SEE DECISION CLOSURE

Product Owner has approved the L-COL-01F decision set for the bounded first Testing slice. Authoritative stamp:

**[enterprise-lms-testing-decision-closure.md](./enterprise-lms-testing-decision-closure.md)**  
**Status:** `PRODUCT_DECISIONS_CLOSED_L_COL_01F_AUTHORIZED`  
**Authorized implementation (separate task only):** **L-TST-01A — Testing Work Queue + Manual Result Draft**

This discovery audit preserves original findings and recommendations; where the closure differs, the closure prevails.

**This document does not implement Testing.**  
**No Testing tables, migrations, APIs, UI, permissions seeding, role grants, OrderTest/Specimen lifecycle changes, Pathology changes, or Billing changes were made by this audit.**

---

## 1. Executive summary

| Item | Finding |
|---|---|
| L-COL-01C Specimen Foundation | **Accepted** |
| L-COL-01D Receiving & Accession | **Accepted** |
| L-COL-01E Barcode & Label Lifecycle | **Accepted** (`L-COL-01E_ACCEPTED`; Manual UAT PASSED) |
| L-COL-01F / Testing | **Not implemented** |
| LMS Testing tables / APIs / result entities | **Absent** |
| FE Testing / Results routes | **Shell placeholders only** (`not_implemented`) |
| OrderTest status after Receive | Remains **`Ordered`** (certified; no Testing transition yet) |
| Specimen eligibility for Testing (PRD) | Acceptable specimen allocated → **Specimen Ready** (PRD §8.3) |
| Specimen eligibility for Testing (LMS certified) | **PRODUCT_DECISION_REQUIRED** — map PRD readiness onto Received / Rejected / barcode / OrderTest rules without inventing automatic transitions |
| Proposed work-item grain | **OrderTest** (PRD “individually trackable tests” / “test work item”), executed against an allocated Specimen via existing M:N link |
| Pathology / LabReport | **RED** — must not become LMS Testing SoT |
| First bounded slice recommendation | Manual Testing work queue + Result Draft entry for Received specimen-linked OrderTests — **pending PO approval** |

**PRD binary location (outside repository):**  
`C:\Users\Sam Aluri\Downloads\enterprise_laboratory_management_system_prd_brd.docx`  
(Enterprise Hospital Laboratory Management System | PRD/BRD v1.0 | 08 October 2026)

Repository packaging gap for the PRD binary is **not** a product-unavailability condition (same rule as PD-COL-REC-24 / barcode audit).

---

## 2. Current system audit

### 2.1 Search inventory (LMS vs non-LMS)

| Search theme | LMS finding | Classification |
|---|---|---|
| testing / examination / test execution / work item | Nav + `LmsCapabilityPage` stubs under `/dashboard/lms/testing*` | **YELLOW** (shell only) |
| result / result entry / manual / analyzer / instrument | Stubs under `/dashboard/lms/testing/manual-results`, `.../instrument-results`; Results stubs under `/dashboard/lms/results*` | **YELLOW** (shell only) |
| run / batch | Stub `/dashboard/lms/testing/runs` only; no domain model | **YELLOW** |
| technical verification / clinical authorization | Stub routes only | **YELLOW** |
| critical result / amended / invalidated | Stub routes / no LMS entities | **YELLOW** |
| reference interval / units / abnormal flag | Catalogue nullable refs only; config stub for reference intervals | **YELLOW** |
| OrderTest / Specimen / CollectionTask / Barcode / Accession | Implemented LMS domain | **GREEN** |
| Pathology `LabReport` / `LaboratoryAnalyte` / `/dashboard/laboratory` | Legacy Pathology SoT | **RED** |
| Clinical eye `examination` module | Unrelated clinical exam | **RED** |
| IP PreOp / ward checklist result fields | IP SoT | **RED** |

### 2.2 LaboratoryApi — what exists

| Layer | Exists for Testing? | Evidence |
|---|---|---|
| Domain tables (`lms_result*`, runs, verification, authorization) | **No** | `LaboratoryDbContext` owns catalogue / order / collection / specimen / barcode only |
| Testing / Results Functions / Services | **No** | Functions: Catalogue, Order, Collection, Specimen, Health |
| OrderTest beyond `Ordered` | **No** | `OrderTestStatuses.Ordered` only (`OrderEnums.cs`); Complete Collection / Receive **require** Ordered |
| Specimen statuses | **Yes (upstream)** | `Collected` \| `Received` \| `Rejected` |
| Accession | **Yes (upstream)** | Issued only on Receive; format `ACC-YYYYMMDD-NNNNNN` |
| Barcode / label | **Yes (upstream, L-COL-01E)** | Separate from GUID and Accession; optional operational identifier |
| Specimen ↔ OrderTest M:N | **Yes (upstream)** | `lms_specimen_order_tests` |
| Platform audit pattern | **Yes (reuse)** | `PlatformAuditClient` → Auth `audit_log`; fail-closed |
| Idempotency / RowVersion patterns | **Yes (reuse)** | Specimen / barcode ops establish pattern |

### 2.3 Frontend LMS — what exists

| Asset | Status | Classification |
|---|---|---|
| Orders / Collection / Specimens (+ barcode UI) | Implemented | **GREEN** |
| `lms-orders.api.ts` / `lms-collection.api.ts` / `lms-specimens.api.ts` | Implemented | **GREEN** |
| Testing / Results / Reports / Referrals / Quality capability pages | `not_implemented` | **YELLOW** |
| Planned FE permission strings `lms.testing.view`, `lms.results.view`, `lms.authorization.view` | Strings only; not page gates; not AuthService Testing catalog | **YELLOW** |
| Design system / `ProtectedRoute` / Counsellor density patterns | Available | **GREEN** (patterns) |

### 2.4 Catalogue structures related to results

On `LmsCatalogueVersion` (L-CAT-01B):

| Field | Present? | Notes | Classification |
|---|---|---|---|
| `ResultDatatype` | Nullable string | No LMS enum of quantitative/qualitative | **YELLOW** |
| `PermittedUnits` | Free string | Not a unit master | **YELLOW** |
| `ReferenceIntervalConfigRef` | Opaque ref | Not configured masters | **YELLOW** / **CONFIGURATION_REQUIRED** |
| `FlagConfigRef` / `CriticalThresholdConfigRef` | Opaque refs | Not live | **YELLOW** / **CONFIGURATION_REQUIRED** |
| `DeltaCheckConfigRef` / `AutoverificationEligibilityRef` | Opaque refs | Explicitly not live in L-CAT UI | **YELLOW** / **DEFERRED** for first Testing slice |
| Panel components | Implemented | Panel ≠ result SoT | **GREEN** (orderable definition) |
| Specimen requirement fields | Implemented | Logistics for collection/receiving | **GREEN** (upstream) |

**Rule (certified catalogue architecture):** Reference intervals, critical values, TAT, delta-check, autoverification are **nullable refs / not configured**. UI must not present them as live values until configuration exists.

### 2.5 GREEN / YELLOW / RED summary

| Asset | Color | Reuse guidance |
|---|---|---|
| LaboratoryApi + `lms_*` persistence | **GREEN** | Own Testing domain here |
| `LmsOrder` / `LmsOrderTest` identity | **GREEN** | Upstream work-item identity |
| `LmsSpecimen` Received + accession + barcode | **GREEN** | Typical readiness inputs |
| `lms_specimen_order_tests` M:N | **GREEN** | Do not change schema; consume |
| CollectionTask lifecycle | **GREEN** | Upstream only |
| Catalogue TEST/PANEL/REFERRAL_TEST versions | **GREEN** | Orderable definition SoT |
| Catalogue result-definition refs | **YELLOW** | Need masters before clinically meaningful flagging |
| FE Testing/Results placeholders | **YELLOW** | Replace with real capability when authorized |
| Platform `audit_log` + LaboratoryAuthz | **GREEN** | Extend deliberately |
| Pathology LabReport / laboratory_* catalog / FE laboratory | **RED** | Never LMS Testing SoT |
| IP PreOp / checklist results | **RED** | Never LMS Testing SoT |
| Clinical examination module | **RED** | Unrelated |

---

## 3. Authoritative source review

### 3.1 Source hierarchy

| # | Source | Role |
|---|---|---|
| 1 | Enterprise LMS PRD/BRD v1.0 (`enterprise_laboratory_management_system_prd_brd.docx`, 08 Oct 2026) | Functional SoT |
| 2 | L-COL-01B acceptance closure | CollectionTask SoT |
| 3 | L-COL-01C specimen decision / implementation / acceptance | Specimen Collected + M:N |
| 4 | L-COL-01D receiving/accession decision / implementation / UAT | Received / Rejected / Accession |
| 5 | L-COL-01E barcode/label acceptance (`L-COL-01E_ACCEPTED`) | Optional barcode; GUID ≠ Accession ≠ Barcode |
| 6 | Order product / state-machine closures | Order Submitted/Cancelled; OrderTest Ordered |
| 7 | Catalogue architecture / L-CAT-01B | Orderable + nullable result-definition refs |
| 8 | Existing LaboratoryApi + LMS FE | Runtime evidence |
| 9 | LMS ↔ Pathology boundary | Pathology not LMS SoT |

### 3.2 Certified upstream constraints (immutable for this audit)

| Constraint | Status |
|---|---|
| CollectionTask `Planned → Ready → InProgress → Completed` (terminal Completed) | **APPROVED** / ACCEPTED |
| Complete Collection creates Specimen **Collected**; does not auto-Receive | **APPROVED** |
| Specimen `Collected → Received` (accession) / `Collected → Rejected` | **APPROVED** |
| Order remains `Submitted` / `Cancelled` per order lifecycle | **APPROVED** |
| OrderTest remains **`Ordered`** through collect / receive / reject / barcode | **APPROVED** (to date) |
| Specimen GUID ≠ Accession ≠ Barcode | **APPROVED** |
| Specimen ↔ OrderTest **M:N-capable** | **APPROVED** |
| Pathology not LMS SoT | **APPROVED** |
| LaboratoryApi owns LMS clinical laboratory domain | **APPROVED** |
| Platform `audit_log` sole audit SoT | **APPROVED** |
| Clinical state must not be overwritten by financial state | **APPROVED** (PD-ORD-09; PRD FIN/clinical separation) |
| No production role grants from audit/decision tasks | **APPROVED** |
| Testing deferred until after Collection → Specimen → Receiving → Barcode staging | **APPROVED** (AD-COL-SPC-10 lineage) |

---

## 4. PRD traceability

PRD citations below are from the extracted text of PRD/BRD v1.0 (08 October 2026). LMS “current support” means **repository LMS implementation**, not Pathology.

| ID | PRD requirement (summary) | Current LMS support | Gap | Implementation implication | Decision |
|---|---|---|---|---|---|
| PRD-WF-06 | Stage 6 Examination: worklist/run; QC/calibration gates; import or enter results; retain source + exception flags | None | Full examination domain | New LMS Testing domain in LaboratoryApi | Slice scope **PRODUCT_DECISION_REQUIRED** |
| PRD-WF-07 | Technical verification then clinical authorization per test policy; critical communication; versioned report | None | Verification / authorization / report | Separate from or after first Testing slice | Staging **PRODUCT_DECISION_REQUIRED** |
| PRD-SM-TEST | Test work item SM: Requested → Specimen Ready → Queued/In Examination → Result Draft → Technical Verified → Authorization Pending → Final → Amended/Corrected; Cancelled/Not Performed | OrderTest stuck at `Ordered` | Entire SM | Map OrderTest and/or Result statuses carefully; do not invent silent transitions | State mapping **PRODUCT_DECISION_REQUIRED** |
| PRD-SPC-06 | Bench/instrument worklists by site, method, priority, batch, specimen readiness, competency | Placeholder nav | Work queue + readiness rules | First slice: bounded work queue | Eligibility **PRODUCT_DECISION_REQUIRED** |
| PRD-SPC-07 | Instrument/interface payloads; raw source; mapping; exception worklists | None | Analyzer integration | Future capability; not required for manual-first MVP unless PO expands | Instrument **DEFERRED** recommendation |
| PRD-SPC-08 | Structured manual entry; unit/type/range validation; two-person check where configured; worksheet/image evidence | None | Manual result entry | Strong candidate for first slice | Two-person check / attachments **PRODUCT_DECISION_REQUIRED** for MVP |
| PRD-SPC-09 | Rerun, dilution, repeat, reflex, delta, autoverification under versioned policy | None | Advanced analytical controls | Out of first slice unless PO expands | **DEFERRED** recommendation |
| PRD-RES-01 | Distinguish draft, technical verification, clinical authorization, preliminary, final, amended, corrected, cancelled | None | Result status model | Define LMS result statuses from PRD; do not assume UI labels = SM | Exact MVP subset **PRODUCT_DECISION_REQUIRED** |
| PRD-RES-02 | Persist units, reference interval, abnormal/critical flags, source/method, specimen, comments, report version per component | Catalogue refs only | Result component model + config | Persist fields; live interval/flag calculation needs config | **CONFIGURATION_REQUIRED** for intervals/flags |
| PRD-RES-03 | Authorized signatory workflow by test/discipline/site/flags/delegation | None | Authorization matrix | Not first Testing-only slice unless PO includes it | Authz matrix **PRODUCT_DECISION_REQUIRED** / **CONFIGURATION_REQUIRED** |
| PRD-RES-04 | Critical detection, communication, escalation, acknowledgement, closure with evidence | None | Critical-event object | Separate L-CRT / Results Critical capability | Critical protocol **PRODUCT_DECISION_REQUIRED** / **CONFIGURATION_REQUIRED** |
| PRD-RES-05/06 | Versioned reports; no overwrite of released report; superseding amendment | None | Reporting domain | Out of Testing foundation | **OUT_OF_SCOPE** for L-COL-01F first slice recommendation |
| PRD-REF-* | Referral partner workflow + inbound PDF/structured import | Catalogue REFERRAL_TEST type only | Referral ops | Out of first Testing slice | **DEFERRED** / **OUT_OF_SCOPE** recommendation |
| PRD-TAT | Analytical TAT = authorized − received; total TAT = final authorization − order; queues expose TAT risk | Catalogue expected TAT refs only | Timestamps + config | Capture stage timestamps; do not invent KPI logic in first slice | TAT display/calc **PRODUCT_DECISION_REQUIRED** / **CONFIGURATION_REQUIRED** |
| PRD-QC | QC/calibration gates; failed QC blocks release | None | Quality domain | Do not fake QC gates | **DEFERRED** / **OUT_OF_SCOPE** for first Testing slice |
| PRD-AUDIT | Actor, timestamp, reason, previous/new status, correlation; results are governed clinical records | Platform audit pattern for upstream LMS | Testing audit actions | Extend allowlist in implementation task only | Pattern **APPROVED** (reuse); action codes **PRODUCT_DECISION_REQUIRED** |
| PRD-BILL | Financial state separate from clinical state | PD-ORD-09 certified | No Testing charges | Document dependency only | **APPROVED** principle; Billing **OUT_OF_SCOPE** |
| PRD-REL-1 | Release 1 includes routine bench worklist, technical verification, authorization/reporting | Partial upstream only | Large Release 1 remainder | Stage LMS slices; do not implement entire Release 1 as one task | Slice boundary **PRODUCT_DECISION_REQUIRED** |

**Do not invent requirements absent from PRD or certified closures.**

---

## 5. Existing L-COL-01C / 01D / 01E boundary (upstream contract)

### 5.1 Confirmed contract (do not modify in Testing audit/implementation without separate authorization)

```text
CollectionTask:  Completed  (terminal for task lifecycle)
Specimen:        Collected → Received | Rejected
Order:           Submitted | Cancelled  (order lifecycle)
OrderTest:       Ordered   (no further LMS transitions yet)
Barcode:         optional identifier; ≠ Specimen GUID; ≠ Accession
Accession:       receiving identifier; issued only on successful Receive; ≠ Barcode
Link:            Specimen ↔ OrderTest via lms_specimen_order_tests (M:N-capable)
```

### 5.2 What should make an OrderTest eligible for Testing?

| Source | Statement |
|---|---|
| PRD §8.3 Specimen Ready | “Acceptable specimen allocated. Queues to local bench or referral. Stability expiry blocks start unless approved exception.” |
| PRD §6.1 / canonical | Status at object level; tests linked to accepted specimens may proceed (PRD order SM richer than LMS Order SM) |
| Certified LMS | Receive creates **Received** + accession; Reject creates **Rejected** without accession; OrderTest stays **Ordered**; barcode optional |

**Discovery recommendation (not approved):**  
Eligibility for a **local** Testing work item should require:

1. Order in `Submitted` (not Cancelled)  
2. OrderTest still clinically active (today: `Ordered` — future statuses TBD)  
3. At least one linked Specimen in **`Received`** (not Rejected, not merely Collected)  
4. Catalogue item type local TEST (or panel component) — not referral-only send-out (referral path deferred)

**PRODUCT_DECISION_REQUIRED:**

| ID | Question |
|---|---|
| PD-TST-ELIG-01 | Is **Received** the sole specimen precondition, or may Collected (pre-receive) appear on a Testing queue? |
| PD-TST-ELIG-02 | Is barcode presence required, optional, or location-policy-dependent before examination start? |
| PD-TST-ELIG-03 | Does starting Testing transition OrderTest status, create a separate Testing/Result entity status, or both? |
| PD-TST-ELIG-04 | When Specimen is Rejected, are linked OrderTests automatically Not Performed / held / left Ordered pending recollection? |
| PD-TST-ELIG-05 | For 1 Specimen → N OrderTests, does each OrderTest become independently eligible? (PRD strongly implies yes) |
| PD-TST-ELIG-06 | For future 1 OrderTest → N Specimens (recollection), which specimen is selected for examination? |

**Do not invent an automatic OrderTest transition in this audit.**

---

## 6. Testing work-item grain

### 6.1 PRD evidence

- Vision: “individually trackable tests”, “versioned results”  
- Order submit creates “individual test work items”  
- §8.3 titled **“Test work item and result state machine”**  
- SPC-01: one container may satisfy many compatible tests with **separate test work items**  
- Canonical flow: order → multiple specimens → each specimen multiple tests; status stored at appropriate object level  

### 6.2 Candidate grains evaluated

| Grain | PRD fit | LMS fit | Recommendation |
|---|---|---|---|
| Order | Too coarse; partial completion required | Order stays Submitted | **Reject** as operational Testing unit |
| OrderTest | Strong (“test work item”) | Exists as `LmsOrderTest` | **Primary candidate** |
| Specimen | Specimen readiness is precondition, not the analytical unit | Exists | Supporting object |
| Specimen + OrderTest | Matches M:N allocation reality | Link table exists | **Execution context** for a work item |
| Test execution / run | PRD has analytical run SM; used for QC/instrument batches | Absent | Supporting / later |
| Report | Downstream of authorization | Absent | **Out of Testing foundation** |

### 6.3 Recommended Product Owner decision

**Operational Testing work item = OrderTest**, always executed in the context of a specific allocated **Specimen** (via `lms_specimen_order_tests`).  
Analytical **Run** is a later/optional grouping object, not the primary work identity for MVP.

**PRODUCT_DECISION_REQUIRED (PD-TST-GRAIN-01):** Confirm OrderTest (+ Specimen allocation) as the L-COL-01F work-item grain.

---

## 7. Specimen ↔ OrderTest cardinality behavior

Respect accepted M:N schema. **Do not change it.**

| Scenario | PRD / certified guidance | Discovery note |
|---|---|---|
| 1 Specimen → N OrderTests | SPC-01; first runtime creates 1→N | Each OrderTest is independently trackable for Testing |
| 1 OrderTest → N Specimens (future recollection) | L-COL-01C: schema must not prevent; UX deferred | Testing must select an eligible Received specimen; selection rule **PRODUCT_DECISION_REQUIRED** |
| Specimen Received | PRD Specimen Ready / accepted specimen | Primary eligibility candidate |
| Specimen Rejected | PRD: never returned to worklist without formal correction; affected tests stop per policy (SPC-04) | Exact OrderTest outcome **PRODUCT_DECISION_REQUIRED** |
| Test not eligible for examination | PRD: cancelled before examination with reason; referral path; stability block | Representation **PRODUCT_DECISION_REQUIRED** |

---

## 8. Result model discovery

| Element | PRD-defined? | Existing approved LMS decision? | Status for first Testing slice |
|---|---|---|---|
| Numeric results | Yes (quantitative catalogue / RES-02) | Catalogue `ResultDatatype` stub only | **PRD-defined**; MVP inclusion **PRODUCT_DECISION_REQUIRED** |
| Qualitative results | Yes | Stub only | **PRODUCT_DECISION_REQUIRED** |
| Coded results | Implied by structured components / mapping | No LMS code set | **PRODUCT_DECISION_REQUIRED** |
| Text / narrative results | Yes (structured + narrative) | No | **PRODUCT_DECISION_REQUIRED** |
| Structured analyte / components | Yes (result components; panels retain component status) | Panel components order-side only | **PRODUCT_DECISION_REQUIRED** |
| Units | Yes (MUST persist) | `PermittedUnits` free string | **CONFIGURATION_REQUIRED** for masters; persist on result |
| Reference intervals | Yes (rule-selected; version retained at authorization) | Opaque config ref | **CONFIGURATION_REQUIRED** |
| Abnormal flags | Yes | Opaque `FlagConfigRef` | **CONFIGURATION_REQUIRED** |
| Comments | Yes | Comment template ref stub | MVP comment field **PRODUCT_DECISION_REQUIRED** |
| Result status | Yes (RES-01) | None | **PRODUCT_DECISION_REQUIRED** (MVP subset) |
| Result version | Yes (no overwrite; supersede) | None | **PRODUCT_DECISION_REQUIRED** |
| Performer | Yes (governed clinical record) | None | **PRODUCT_DECISION_REQUIRED** |
| Instrument / source | Yes (source/method; local vs external vs manual) | None | Manual source for MVP; instrument **DEFERRED** recommendation |
| Result timestamp | Yes | None | Capture on entry — **PRODUCT_DECISION_REQUIRED** field set |
| Verification timestamp | Yes | None | If verification in slice |
| Authorization timestamp | Yes | None | If authorization in slice / later |

**Do not invent clinical interpretation rules.** Flag/interval **calculation** without configuration is forbidden.

---

## 9. Result / test state machine audit

PRD §8.3 states (meaning + safeguards). **These are PRD-permitted transitions, not an approved LMS implementation set.**

| PRD state | Meaning (PRD) | LMS today | For L-COL-01F |
|---|---|---|---|
| Requested | Test created | ≈ OrderTest `Ordered` | Mapping **PRODUCT_DECISION_REQUIRED** |
| Specimen Ready | Acceptable specimen allocated | Implicit when Received + link | Eligibility mapping **PRODUCT_DECISION_REQUIRED** |
| Queued / In Examination | Worklist/run active | Absent | **PRODUCT_DECISION_REQUIRED** |
| Result Draft | Entered, not technically verified | Absent | Strong MVP candidate |
| Technical Verified | Analytical checks done | Absent | Include vs defer **PRODUCT_DECISION_REQUIRED** |
| Authorization Pending | Needs signatory | Absent | Likely later Results slice |
| Final | Clinically authorized + released | Absent | Tied to reporting; **OUT_OF_SCOPE** recommendation for first Testing slice |
| Amended / Corrected | New version after final | Absent | **DEFERRED** |
| Cancelled / Not Performed | No reportable result | Absent | **PRODUCT_DECISION_REQUIRED** |
| Draft / In Progress / Resulted / Invalidated (common labels) | Appear in broader PRD language (RES-01 also lists preliminary/corrected) | Absent | Do **not** adopt merely because common; map from PRD with PO |

**Missing and therefore PRODUCT_DECISION_REQUIRED:** exact LMS status names, allowed transitions, actors, permissions, mandatory reasons, terminal states, and whether OrderTest status mirrors Result status or remains separate.

---

## 10. Technical verification vs clinical authorization

| Question | PRD answer | Gap |
|---|---|---|
| Are both stages mandatory? | Distinct events; technical verification then clinical authorization **according to test policy**; autoverification may cover a defined path only for pre-approved tests | Whether every MVP test requires both **PRODUCT_DECISION_REQUIRED** / **CONFIGURATION_REQUIRED** |
| Who performs each? | Bench scientist: technical verification; Pathologist/authorized signatory: clinical authorization (persona tables §3/§7) | Hospital role mapping **PRODUCT_DECISION_REQUIRED** — do not infer from Admin |
| Same person both? | Explicitly allowed when properly credentialed; still **distinct events** | Same-person policy **PRODUCT_DECISION_REQUIRED** |
| Grain of verification | Tied to test/result authorization policy; report generation after authorization | Per OrderTest vs per result component vs per report **PRODUCT_DECISION_REQUIRED** |
| Amendments | New version after Final; reason, authorizer, affected components, link to prior; notify recipients | Re-verification/re-authorization rules **PRODUCT_DECISION_REQUIRED** |
| Prior versions | Must remain retrievable; no in-place overwrite of released report | Version retention principle **APPROVED** (PRD); LMS model **PRODUCT_DECISION_REQUIRED** |

---

## 11. Manual vs instrument results

| Capability | PRD | Release plan | Discovery recommendation |
|---|---|---|---|
| Manual structured entry | MUST (SPC-08) | Release 1 routine core | **MVP requirement** (candidate) |
| Instrument/analyzer ingestion | MUST (SPC-07) | Release 2 Integration | **Future integration capability** |
| Import / mapping / exception queue | MUST | Release 2 | **DEFERRED** |
| Analyzer identity / run / batch | Analytical run SM | Release 1–2 depending on depth | Run object **DEFERRED** unless PO expands |
| Duplicate handling / reconciliation | MUST for interfaces | Release 2 + downtime | **DEFERRED** |

**Do not implement analyzer integration in L-COL-01F unless Product Owner explicitly expands scope after configuration ownership is clear.**

---

## 12. Reference intervals / abnormal flags

| Topic | PRD | LMS today | Status |
|---|---|---|---|
| Source | Governed configuration; selected by age/sex/pregnancy/specimen/method/unit/site; version retained at authorization | Opaque `ReferenceIntervalConfigRef` | **CONFIGURATION_REQUIRED** |
| Age/sex applicability | Explicit rule set | Not implemented | **CONFIGURATION_REQUIRED** |
| Units | Part of selection + persistence | Free string | **CONFIGURATION_REQUIRED** |
| Specimen / method / site / effective dating / versioning | Yes | Not implemented | **CONFIGURATION_REQUIRED** |
| Abnormal flag calculation | Yes | Not implemented | **CONFIGURATION_REQUIRED** + clinical policy **PRODUCT_DECISION_REQUIRED** |
| Critical thresholds | Per test/population/site/policy version | Opaque ref | **CONFIGURATION_REQUIRED** |

**Ownership of masters is not defined as an implemented LMS configuration domain.** Treat as **CONFIGURATION_REQUIRED** before live flagging. First Testing slice may persist **manual** unit/value/comment without claiming interval evaluation — only if PO explicitly allows deferred evaluation.

---

## 13. Critical results

| Topic | PRD requirement | Decision dependency |
|---|---|---|
| Identification | Critical limits per test/population/site/policy version; flag ≠ clinical contact | **CONFIGURATION_REQUIRED** + **PRODUCT_DECISION_REQUIRED** (MVP include?) |
| Acknowledgement | Separate communication event with recipient evidence | **PRODUCT_DECISION_REQUIRED** |
| Notification / escalation / timeout / recipient | Time-bound escalation chain; portal SMS alone never closes | **CONFIGURATION_REQUIRED** / **PRODUCT_DECISION_REQUIRED** |
| Documentation / audit | Detected time, reviewer, result/version, recipient, method, read-back, attempts, closure | Model required if in scope |
| MVP inclusion | Release 1 mentions critical path in acceptance scenarios | Whether inside first Testing slice vs L-CRT-01 **PRODUCT_DECISION_REQUIRED** |

**Discovery recommendation:** Critical-result **protocol out of first Testing slice**; do not invent thresholds or escalation matrices.

---

## 14. TAT

| Timestamp / need | PRD | First Testing slice recommendation |
|---|---|---|
| Test / examination start | Implied by Queued/In Examination | Capture if In Examination is in slice — **PRODUCT_DECISION_REQUIRED** |
| Result time | Yes | Capture on draft entry |
| Verification time | Yes | If verification in slice |
| Authorization time | Analytical TAT uses authorized − received | Later Results/Reporting |
| TAT calculation / breach escalation | Configured; queues expose risk | **CONFIGURATION_REQUIRED**; no KPI invention in first slice |

---

## 15. Audit / versioning

### 15.1 Governed clinical record (PRD)

A result is never merely a PDF: source, performer, authorization, delivery, and correction history are required. Released reports are not overwritten.

### 15.2 Mutation retention checklist

| Element | Required by PRD? | Platform pattern suitability |
|---|---|---|
| Actor | Yes | **Yes** — `audit_log` |
| Authority / assurance | Yes (re-auth for privileged actions) | Partial — LMS must use existing privileged-action patterns when implemented |
| Object | Yes | Resource type for Testing/Result entities |
| Action | Yes | New allowlisted actions (implementation task only) |
| Reason | Yes where exceptional | Payload / structured fields |
| Source (manual/instrument/external) | Yes | Domain field + audit |
| Previous / new value or version | Yes | Domain versioning + audit detail |
| Timestamp | Yes | Audit + domain |
| Outcome | Yes | Success/fail closed |

**Conclusion:** Existing platform `audit_log` pattern is **suitable and required** (same as Catalogue/Orders/Collection/Specimen/Barcode). LaboratoryApi must **not** create a parallel clinical audit store. Historical clinical results must not be overwritten.

---

## 16. Permissions (candidates only — not granted)

| Operational need | PRD support | Proposed candidate | PO decision |
|---|---|---|---|
| View Testing work queue / work item | Role dashboards §7 | `lms.testing.view` (already a FE planned string) | **PRODUCT_DECISION_REQUIRED** |
| Manage / start examination / assign bench work | SPC-06 | `lms.testing.manage` | **PRODUCT_DECISION_REQUIRED** |
| Enter / edit result drafts | SPC-08 | `lms.testing.result` | **PRODUCT_DECISION_REQUIRED** |
| Technical verification | §11.1 / RES-01 | `lms.testing.verify` **or** `lms.results.verify` | **PRODUCT_DECISION_REQUIRED** (naming + slice ownership) |
| Clinical authorization | §11.1 / RES-03 | `lms.testing.authorize` **or** `lms.results.authorize` / planned `lms.authorization.view` | **PRODUCT_DECISION_REQUIRED** |
| Critical communication actions | RES-04 | Later `lms.results.critical.*` | **DEFERRED** recommendation |

**Forbidden in this audit:** seeding AuthService catalogs, role grants, or treating Admin as clinical authorizer policy.

---

## 17. UI / work queue

### 17.1 PRD screens vs LMS stubs

| Area | PRD | LMS stub | First-slice candidate? |
|---|---|---|---|
| Bench scientist worklist / Testing Workbench | Yes | `/testing`, `/testing/workbench` | **Yes** (recommended) |
| Test Work Queue | Yes (role dashboard) | Part of workbench | **Yes** |
| Test / Result Detail + Result Entry | Yes (`Result entry/review`) | Manual Results stub | **Yes** |
| Verification queue | Yes | `/results/verification` | PO: include vs next slice |
| Authorization queue | Yes | `/results/authorization` | **Later** recommended |
| Exceptions | Yes | `/testing/exceptions` | Minimal hold/invalid only if needed |
| Runs | Yes | `/testing/runs` | **DEFERRED** |
| Instrument Results | Yes | `/testing/instrument-results` | **DEFERRED** |
| Critical / Amendments | Yes | `/results/critical`, `/amendments` | **DEFERRED** |

### 17.2 Smallest coherent first Testing slice (recommendation only)

**Proposed name:** L-TST-01A — Testing Work Queue + Manual Result Draft  

**In:**

- Eligibility read-model for Received specimen-linked OrderTests  
- Testing work queue / workbench (honest empty/error; no fake KPIs)  
- Manual result draft create/update for permitted datatypes decided by PO  
- Platform audit + idempotency + concurrency patterns  
- Candidate permissions catalog (no role grants)

**Out:**

- Instrument/analyzer integration  
- Analytical runs / QC gates  
- Clinical authorization / report release / patient portal  
- Critical communication protocol  
- Amendments after Final  
- Referral inbound results  
- Pathology migration  
- Billing charges  
- Fabricated clinical/demo results  

---

## 18. Architecture

### 18.1 Ownership

**Expected principle (reaffirmed unless PO overturns):**  
**LaboratoryApi owns the LMS Testing domain** (same service as Catalogue / Orders / Collection / Specimen / Barcode).

Do **not** create a Testing microservice without explicit architectural justification and approval.

### 18.2 Boundaries to design in a later implementation task (not build now)

| Boundary | Discovery note |
|---|---|
| Domain tables | Candidate concepts: Testing work / examination attempt, Result (+ components), Result version, optional Run later |
| Service boundary | New Testing/Result services inside LaboratoryApi |
| API boundary | `/api/lms/...` under existing Laboratory authz |
| Audit boundary | Platform `audit_log` via internal API; fail closed |
| Transaction boundary | Result mutation + audit + idempotency in one server transaction pattern (as Specimen) |
| Event/outbox | Not required for first slice unless PO adds consumers; currently deferred at LMS foundation |
| Idempotency | Operation-specific keys for draft save / verify (when included) |
| Concurrency | RowVersion on mutable Testing/Result aggregates |

**ARCHITECTURE_DECISION_REQUIRED:**

| ID | Topic |
|---|---|
| AD-TST-01 | Confirm LaboratoryApi ownership (recommended APPROVE) |
| AD-TST-02 | Whether Result is a new aggregate vs status fields only on OrderTest |
| AD-TST-03 | Whether OrderTest status changes in first slice or Result carries examination state while OrderTest stays Ordered |
| AD-TST-04 | Pathology isolation reaffirmation (recommended APPROVE) |

---

## 19. Billing / financial separation

| Topic | Status |
|---|---|
| Testing creates charges? | **OUT_OF_SCOPE** for this audit and recommended first slice |
| Clinical/testing state overwritten by financial state? | **Forbidden** (PRD + PD-ORD-09) |
| Charge timing dependency | Existing principle: normal OPD lab charging at specimen collection (PD-LAB-BILL-01 lineage) — **do not reopen** here |
| Document only | Future L-BILL / finance handoff may observe Testing/Result milestones — **dependency only** |

---

## 20. Pathology separation

| Tempting asset | Classification | Rule |
|---|---|---|
| `/dashboard/laboratory` LaboratoryWorkbench | **RED** | Preserve; do not mount LMS Testing there |
| AuthService `LabReport` / `LabReportItem` | **RED** | Not LMS result SoT |
| `LaboratoryAnalyte` / `LaboratoryTestDefinition` / `LaboratoryPanel` | **RED** | Legacy Pathology catalog |
| `lab-reports.api.ts` | **RED** / YELLOW legacy | Do not adopt as LMS client |
| LMS Catalogue | **GREEN** | LMS orderable SoT |
| LMS Testing (to be built) | **GREEN (future)** | New `lms_*` model |

---

## 21. Proposed decision IDs for Product Owner workshop

See [enterprise-lms-testing-decision-closure.md](./enterprise-lms-testing-decision-closure.md) for the full matrix with honest statuses.

High-priority blockers before any implementation authorization:

1. Work-item grain (OrderTest + Specimen context)  
2. Eligibility rule (Received? barcode? OrderTest transition?)  
3. First-slice scope (Draft only vs Draft+Technical Verify vs include Authorization)  
4. Result status subset for MVP  
5. Manual-only vs instrument-in-MVP  
6. Reference-interval / flag behavior when config absent  
7. Permission code set (catalog only)  
8. Architecture: Result aggregate vs OrderTest status expansion  

---

## 22. Recommended implementation sequence (after PO closure)

1. Product Owner closes PD-TST-* / AD-TST-* (or explicitly defers)  
2. Resolve **CONFIGURATION_REQUIRED** items that the approved MVP depends on (or PO accepts deferred evaluation)  
3. Separate bounded implementation task (e.g. L-TST-01A) — schema/API/UI only as authorized  
4. PRE-UAT verification  
5. Manual UAT  
6. Later: L-VER / L-AUTH / L-CRT / L-AMD / L-RPT / L-INT as separate slices  

**STOP after discovery/decision documents. Do not implement.**

---

## 23. Acceptance / UAT implications (future)

| Implication | Note |
|---|---|
| Upstream UAT data | Need Submitted Order + Ordered OrderTests + Completed CollectionTask + Collected Specimen + **Received** Specimen (+ optional barcode) |
| Rejected path | Must prove non-eligibility / safe handling without manufacturing Reject data solely for vanity UAT |
| No fake clinical results | Do not seed demo analytes as production |
| Permissions | UAT may use Admin `*` until role grants decided; grants remain separate PO decision |
| Pathology isolation | UAT must not require `/dashboard/laboratory` |
| Report/patient visibility | Draft must not appear as final (PRD RES-01) — enforce in whichever slice first creates drafts |

---

## 24. Explicit out-of-scope (this audit task)

- Creating tables / migrations / APIs / UI  
- Permission DB seeding / role grants  
- Modifying Specimen / Order / OrderTest / CollectionTask / Receiving / Barcode lifecycles  
- Pathology or Billing changes  
- Instrument integration, QC, referral ops, reporting release, critical escalation matrices  
- Inventing clinical thresholds or interpretation rules  

---

## 25. Final audit status

# PRODUCT_OWNER_APPROVED — SEE DECISION CLOSURE

**Companion decision closure:** [enterprise-lms-testing-decision-closure.md](./enterprise-lms-testing-decision-closure.md)  

**Stamp:** `PRODUCT_DECISIONS_CLOSED_L_COL_01F_AUTHORIZED`  
**Authorized implementation (separate task):** L-TST-01A — Testing Work Queue + Manual Result Draft  
**This discovery document:** does **not** implement L-TST-01A  

**STOP.** Do not implement Testing in this audit document.
