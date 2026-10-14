# Laboratory Management — Product Definition V3 / Final Architecture Gate

**Date:** 2026-10-07  
**Type:** PRODUCT + ARCHITECTURE + GAP ANALYSIS GATE  
**Status:** COMPLETE — ARCHITECTURE APPROVED; PHASED IMPLEMENTATION NOT STARTED  
**Mode:** READ-ONLY — **NOT IMPLEMENTED**

**Priors:**
- [diagnostics-laboratory-product-definition.md](./diagnostics-laboratory-product-definition.md) — D-LAB-* ratification
- [laboratory-management-product-definition-v2.md](./laboratory-management-product-definition-v2.md)
- [laboratory-management-deep-domain-audit.md](./laboratory-management-deep-domain-audit.md)
- [laboratory-management-v3-gap-analysis.md](./laboratory-management-v3-gap-analysis.md) — detailed gap matrix companion
- [slice-4-laboratory-document-implementation.md](./slice-4-laboratory-document-implementation.md) — **CERTIFIED EXISTING**

```text
PRODUCT DEFINITION V3: COMPLETE
IMPLEMENTATION: NOT STARTED
CODE CHANGES: NONE
DATABASE CHANGES: NONE
AUTOMATED TESTS: NOT RUN FOR IMPLEMENTATION
MANUAL UAT: NOT STARTED
ACCEPTANCE: NOT CLAIMED
FINAL GATE: PRODUCT DEFINITION READY FOR IMPLEMENTATION
RESIDUAL PRODUCT DECISIONS: PHASE-GATED (see §27)
NEXT ACTION AFTER OWNER ACCEPTANCE OF V3: L1 — Workbench Stabilization ONLY
```

---

## 1. Executive Summary

Laboratory Management target is an end-to-end hospital laboratory platform under the authoritative root **`LabReport`**, supporting internal and send-out workflows, clinical catalog (hybrid), panels/analytes, specimen/accession, structured Observations, QC, critical results, verification/release, amendments, documents (Slice 4), Patient 360 projection, and interoperability adapters (FHIR/HL7/LIS) without creating duplicate clinical sources of truth.

| Layer | Status |
|---|---|
| Product architecture (this V3) | **APPROVED** by Product Owner decisions in this gate |
| Current L1 prototype | **NOT ACCEPTED** — thin worklist/order shell |
| Repository vs target | Large **RED/YELLOW** gaps — see companion gap analysis |
| Implementation | **NOT STARTED** |
| 405 GET list defect | Documented only — **NOT FIXED** here |

**Critical architecture rule (APPROVED):**

```text
Patient
  ↓
LabReport                          ← authoritative root (do not replace)
  ├── LaboratoryTestDefinition / Panel / Items
  ├── Specimen(s) + Accession + barcode values
  ├── Observation(s) + flat summary fields
  ├── Verification / Release / Amendment versions
  ├── Critical-result events
  ├── QC references (where applicable)
  ├── PerformingLaboratory (internal | external)
  └── Canonical Laboratory Documents (Slice 4)
         ↕ adapters (not SoT)
      FHIR / HL7 v2 / Analyzer-LIS gateway / Comm channels
```

Do **not** revive `lab_order`, `lab_order_item`, or orphan `lab.api.ts` as SoT.

---

## 2. Product Vision

Deliver a healthcare-grade Laboratory Management workbench that hospital staff can use to order, accession, process, quality-control, result, verify, release, amend, communicate, and document laboratory work for internal and external performing laboratories — with Patient 360 reflecting authorized clinical and document projections, and with interoperability adapters that do not own clinical truth.

UX: existing Hospital Portal design system; desktop-first; Counsellor-quality operational density; accessible; honest empty/error/permission states; no fabricated clinical data.

---

## 3. Approved Product Owner Decisions

### 3.1 Preserved prior ratification (still in force)

| Topic | Status |
|---|---|
| Lab Management = ops workbench; P360 = projection | **APPROVED / PRESERVE** |
| LabReport = SoT root | **APPROVED / PRESERVE** |
| No revive lab_order / lab_order_item / lab.api.ts | **APPROVED / PRESERVE** |
| Counsellor separate until explicit bridge | **APPROVED / PRESERVE** |
| Slice 4 document architecture | **APPROVED / PRESERVE** + **CERTIFIED EXISTING** |
| Attach ≠ clinical completion | **APPROVED / PRESERVE** |
| Status vocabulary (ordered…on_hold) | **APPROVED / PRESERVE** |
| `completed` = final released; no ordinary edit | **APPROVED / PRESERVE** |
| No fake clinical data; no invented branch | **APPROVED / PRESERVE** |
| No silent new permission codes | **APPROVED / PRESERVE** (matrix first) |

### 3.2 Newly approved architecture requirements

| ID | Decision | Status |
|---|---|---|
| PD-LAB-CAT-01 | Option C hybrid catalog (ServiceVariant commercial + LaboratoryTestDefinition clinical) | **APPROVED** |
| PD-LAB-CAT-02 | Panels and analytes required in production architecture | **APPROVED** |
| PD-LAB-SPEC-01 | Specimen first-class child of LabReport; accession/collect/receive/accept-reject | **APPROVED** |
| PD-LAB-OBS-01 | Observation children + preserve flat LabReport summary fields | **APPROVED** |
| PD-LAB-ORG-01 | Typed PerformingLaboratory (internal/external); not Vendor | **APPROVED** |
| PD-LAB-CLI-01 | Authoritative ordering clinician lookup for new orders when known; denorm name | **APPROVED** |
| PD-LAB-VISIT-01 | Capture Visit/Encounter when known; do not invent | **APPROVED** |
| PD-LAB-MULTI-01 | Multi-item and multi-specimen support where clinically required | **APPROVED** |
| PD-LAB-IND-01 | Structured clinical indication/reason | **APPROVED** |
| PD-LAB-WF-01 | Server-enforced status transitions (eventually) | **APPROVED** (requirement) |
| PD-LAB-VER-01 | Verification/review before release = production target | **APPROVED** (requirement); **role matrix still phase-gated** (§27) |
| PD-LAB-FHIR-01 | FHIR mapping strategy (ServiceRequest, Specimen, Observation, DiagnosticReport, Task as needed) as interoperability layer | **APPROVED** |
| PD-LAB-HL7-01 | HL7 v2 ORM/ORU-capable integration abstraction | **APPROVED** |
| PD-LAB-LIS-01 | Analyzer/LIS integration gateway (HL7/ASTM/API/file adapters) | **APPROVED** |
| PD-LAB-BC-01 | Specimen id / accession / barcode value + scanner-friendly workflow; hardware as adapter | **APPROVED** |
| PD-LAB-QC-01 | QC core capability (materials, lots, runs, Westgard-style rules, CAPA hooks) | **APPROVED** |
| PD-LAB-CRIT-01 | Critical-result events + acknowledgement + escalation via platform comms | **APPROVED** |
| PD-LAB-COM-01 | Generic communication orchestration; no channel hard-wiring in Lab domain | **APPROVED** |
| PD-LAB-AMD-01 | Result amendment/versioning; released results immutable to ordinary UPDATE | **APPROVED** |
| PD-LAB-PERM-01 | Least-privilege capability model required for final product; interim patient.* OK | **APPROVED** (requirement); **code invent still gated** (§27) |
| PD-LAB-14 | Counsellor bridge-ready; no auto LabReport; bridge needs explicit later decision | **APPROVED** |
| PD-LAB-MIG-01 | No large historical bulk migration; additive children; historical LabReport remains valid | **APPROVED** |

---

## 4. End-to-End Laboratory Workflow

```text
PATIENT
  → ORDER (LabReport)
  → TEST / PANEL (LaboratoryTestDefinition + items)
  → ORDERING CLINICIAN (authoritative user/practitioner ref)
  → CLINICAL INDICATION
  → INTERNAL | EXTERNAL PerformingLaboratory
  → SPECIMEN(s)
  → COLLECTION
  → ACCESSION (+ barcode value)
  → RECEIVING
  → ACCEPT | REJECT
  → PROCESSING
  → QC (where applicable)
  → RESULT ENTRY | STRUCTURED IMPORT | EXTERNAL REPORT INGEST
  → OBSERVATION(s)  (+ flat LabReport summary)
  → TECHNICAL VALIDATION
  → CLINICAL REVIEW / VERIFICATION
  → CRITICAL RESULT HANDLING (when applicable)
  → FINAL RELEASE (status → completed)
  → AMENDMENT (controlled version) when needed
  → DIAGNOSTIC REPORT (domain envelope + optional FHIR DiagnosticReport map)
  → PATIENT 360 (projection)
  → DOCUMENTS (Slice 4 canonical file when present)
```

**Branches:**
- **Internal:** process in hospital lab → QC → entry/import → verify → release  
- **External/send-out:** referral → dispatch → external accession → receive result/PDF → reconcile → review → release  
- **Manual entry** vs **structured import** vs **document-only ingest** (document ≠ automatic clinical complete — **PRESERVE** Slice 4)

---

## 5. Domain Model

### 5.1 Root (APPROVED)

**`LabReport`** remains the single authoritative Laboratory root. Do **not** replace with `LaboratoryOrder`.

### 5.2 Children / related concepts (APPROVED architecture; **NOT IMPLEMENTED**)

| Concept | Ownership | Notes |
|---|---|---|
| LaboratoryTestDefinition | Laboratory clinical catalog | Hybrid link to ServiceVariant optional |
| LaboratoryPanel / membership | Under clinical catalog | Expands to items/analytes |
| LaboratoryAnalyte | Catalog component | Observation dictionary |
| LabReportItem | Child of LabReport | Multi-test/panel expansion (**not** SQL lab_order_item) |
| Specimen | Child of LabReport (1:N) | Lifecycle + accession + barcode value |
| Observation | Child of LabReport (1:N) | Structured results; prefer over flat when present |
| PerformingLaboratory | Typed registry | Internal / External / Reference / CollectionCenter |
| ExternalLabReferral | Under LabReport | Send-out state machine |
| ResultVerification | Event/record on LabReport | Before release |
| ResultVersion / Amendment | Version chain | Immutable released versions |
| CriticalResultEvent | Under LabReport/Observation | Comm + ack + escalate |
| QcMaterial / QcLot / QcRun / QcResult / QcRuleEvaluation | QC domain linked to method/instrument/analyte | Core capability |
| LaboratoryIntegrationMessage | Integration abstraction | HL7/FHIR/LIS correlation — not clinical SoT |
| Canonical Document | Slice 4 | `domain=lab`, `entityType=LabReport` |

Names above are **architecture concepts**, not approved table names. Implementation may adjust naming while preserving ownership.

### 5.3 Anti-patterns

| Forbidden | Why |
|---|---|
| Revive SQL `lab_order` / `lab_order_item` as SoT | Competing root |
| Wire orphan `lab.api.ts` as architecture | No BE |
| Vendor as clinical lab | Supply domain |
| FHIR resources as primary DB SoT | Interop layer only |
| Hard-wire WhatsApp/SMS in Lab services | Use orchestration |
| Bulk rewrite historical LabReports | Additive only |

---

## 6. Catalog Architecture

**APPROVED — Option C Hybrid**

| Layer | Owner | Responsibility |
|---|---|---|
| Service Catalog / ServiceVariant | Billing / Master Data | Commercial/billable SKU, payer/branch prices, counsellor orderable identity where applicable |
| LaboratoryTestDefinition | Laboratory | Clinical identity: local code, display name, discipline, active lifecycle, specimen/collection requirements, method, TAT, units, reference ranges, analytes, panel membership, optional LOINC/SNOMED, performing-lab defaults, optional ServiceVariantId |
| LabTestCatalog (legacy) | Counsellor/PreOp | **Not** long-term Laboratory clinical SoT; may seed names only |

**Do not** fabricate catalog seed rows in this gate.

---

## 7. Result Architecture

| Element | Rule |
|---|---|
| Observation children | Structured analyte results (numeric/text/coded/qualitative + unit/range/flags/status/performer/time) |
| Flat LabReport fields | **PRESERVE** for historical rows and summary projection |
| Read preference | Prefer Observations when present; else flat fields |
| Microbiology / culture-susceptibility | Represent via specialized Observation groups or linked susceptibility structures under LabReport — see §23 gaps |
| Narrative pathology | Narrative Observation + optional Slice 4 PDF |
| Import | Structured import maps to Observations + provenance; PDF attach remains document path |

---

## 8. Specimen / Accession Architecture

| Capability | Requirement |
|---|---|
| Specimen child of LabReport | **APPROVED** (1:N) |
| Type, collector, collected/received times | Required |
| Acceptance / rejection + reason | Required |
| Accession identifier | Required in architecture |
| Barcode value | Stored on specimen/accession; generation/representation supported |
| Scanner hardware | Adapter only — not domain logic |
| Transport | Supported as status/timestamps; logistics systems external |

---

## 9. Internal Laboratory

| Concept | Direction |
|---|---|
| PerformingLaboratory type=Internal | Links to hospital facility context (Organization/Branch/Department STD_LABORATORY as context, not sole identity) |
| Disciplines | Hematology, chemistry, micro, path, etc. via catalog discipline |
| Work queue | Laboratory Management dashboard over LabReport + specimen/result states |
| Instruments | Via Integration Gateway + instrument registry (L13) |

---

## 10. External Laboratory

| Concept | Direction |
|---|---|
| PerformingLaboratory type=External/Reference | Directory entity — **not** Vendor |
| Referral lifecycle | Order → send-out decision → referral → dispatch → external accession → expected → received → reconcile → review → release |
| First operational external mode | Manual result/PDF + structured entry (before automated HL7) |
| Automation | Via integration abstraction (HL7/API) when interface specs exist |

---

## 11. QC / Quality Architecture

**APPROVED as core capability (not indefinitely deferred).**

Must support: QC material, lot, level, analyte, method, instrument, control run, target, SD, QC result, rule evaluation, warning/rejection, QC status, corrective action, audit.

Westgard-style multi-rule evaluation **where applicable**; do not invent proprietary thresholds beyond documented standard rules. Exact rule pack selection = residual decision (§27).

Hospital Quality CAPA module is a **different domain** — may link nonconformances later; do not treat as analytical QC SoT.

**Organizational** SOPs, competency, facilities, EQA remain laboratory organization responsibilities — software supports, does not replace accreditation.

---

## 12. Critical Result Architecture

**APPROVED core patient-safety capability.**

Must support: critical-value policy, qualifying result, critical event, responsible recipient, communication attempt, acknowledgement, escalation, final communication status, audit trail.

Channels via communication orchestration only (in-app, SMS, email, WhatsApp, other approved). Lab emits intents; providers are infrastructure.

Exact thresholds/recipient matrix/escalation timers = residual product decision (§27) before L7 implementation.

---

## 13. Amendment Architecture

**APPROVED.**

After final release (`completed`):
- Original released Observation/version **immutable**
- Amendment requires reason + attributable actor
- New version auditable; prior versions retained
- Authorization controlled (verification/release rules apply)
- P360 shows **current** released version without destroying provenance
- **No** ordinary UPDATE on released results

Document supersession (Slice 4 / canonical) remains separate from clinical result versioning unless owner later unifies — default: clinical versions on Observations; document replace still D-LAB-08 constrained until reopened.

---

## 14. FHIR Architecture

**APPROVED as interoperability layer — not primary SoT.**

| FHIR R4 | Maps from |
|---|---|
| ServiceRequest | LabReport order + items |
| Specimen | Specimen child |
| Observation | Observation children |
| DiagnosticReport | Released LabReport envelope + document reference |
| Task | Optional workflow tracking when needed |

Do **not** duplicate DB entities solely because FHIR names exist. Export/import adapters translate local IDs ↔ FHIR resources. Local IDs remain authoritative.

---

## 15. HL7 Architecture

**APPROVED — integration abstraction, not transport coupling.**

Support future/current HL7 v2 laboratory messaging (ORM-class orders, ORU-class results) via:

- message mapping  
- inbound/outbound  
- acknowledgement  
- retry  
- error / dead-letter  
- interface configuration  
- facility/application identifiers  
- audit / correlation IDs  

Actual partner profiles are **deployment-specific**. Existing IP `Hl7AdtPublisher` is ADT-only — reusable **outbox pattern**, not lab ORM/ORU.

---

## 16. Analyzer / LIS Integration Architecture

**APPROVED — gateway + adapters.**

```text
Lab domain (LabReport / Specimen / Observation)
        ↕
Laboratory Integration Gateway
        ↕ adapters
   HL7 | ASTM | Vendor API | File | Other
```

Do not implement vendor connectors without real interface specifications. IP LIS webhook today completes ward checklist — **pattern reuse only**, not LabReport SoT.

---

## 17. Barcode Architecture

| Layer | Rule |
|---|---|
| Domain | Specimen identifier, accession number, barcode value fields |
| Representation | Generate/print-ready values; scanner-friendly worklists |
| Hardware / ZPL printers | Adapters |
| Existing reuse | Patient MRN JsBarcode / IOL GS1 parse are **YELLOW** UX/pattern only — not lab accession SoT |

---

## 18. Communication Architecture

| Layer | Reuse |
|---|---|
| In-app / staff | NotificationHub / Auth `INotificationService` |
| SMS / email / WhatsApp | NotificationService `POST .../notifications/dispatch` |
| Orchestration+audit pattern | CCMS `CommunicationDispatchService` style |
| Lab | Communication **intent** API/events only |

Do not hard-wire providers into Laboratory business logic.

---

## 19. Permission / Role Architecture

### Interim (current)

| Role (L0 UAT) | Grants |
|---|---|
| Lab Technician / Lab Manager | `laboratory.view`, `patient.view`, `patient.update` |
| LabReport API | `patient.view` / `patient.update` |
| Doctor search | `user.view` |

### Final product (APPROVED requirement)

Define capability matrix for:

- Lab Technician  
- Lab Manager  
- Pathologist / Clinical Reviewer  
- Ordering Clinician  
- External Laboratory Coordinator (if applicable)  
- Integration / System roles  

Map to **existing** permission catalog where safe. If none fit, raise **Product/Security Decision** — do **not** auto-create codes.

Capability matrix content = residual decision before least-privilege cutover (§27).

---

## 20. Counsellor Boundary

| Rule | Status |
|---|---|
| Counsellor / Pre-Op investigations remain separate SoT | **APPROVED** |
| Do not auto-create LabReport from counsellor rows | **APPROVED** |
| Architecture remains bridge-ready | **APPROVED** |
| Bridge requires explicit later decision (trigger, clinician, billing map, routing, encounter, duplicates, cancel, audit) | **PHASE-GATED** (L16) |

---

## 21. P360 Boundary

| Laboratory Management | Patient 360 |
|---|---|
| Ops workbench | Projection / discovery |
| Specimen, result entry, verify, QC, send-out | Orders, results (current released), report metadata, authorized documents |
| Must not become Lab queue/workstations | **PRESERVE** |

---

## 22. Document Architecture

**PRESERVE Slice 4 / CERTIFIED EXISTING:**

- Canonical identity + SHA-256  
- `domain=lab` / `entityType=LabReport`  
- One active attachment; same-byte idempotent; different-byte 409  
- Attach ≠ complete  
- Authenticated content  
- P360 Documents actions; no generic Laboratory upload  
- No silent replacement unless D-LAB-08 reopened  

Clinical Observation versions ≠ document bytes (both auditable).

---

## 23. Test-Type Capability Matrix

Architecture support assessment (not catalog seeds):

| Pattern | Supported by target model? | Gap / decision |
|---|---|---|
| Hematology (CBC panel) | Yes — panel + analytes + Observations | Catalog content |
| Biochemistry / chemistry | Yes — quantitative Observations + ranges | Catalog + QC |
| Coagulation | Yes — quantitative/qualitative | Catalog |
| Urinalysis | Yes — mixed qualitative/quantitative panel | Catalog |
| Immunology / serology | Yes — qualitative/coded | Catalog |
| Microbiology culture | Partial — needs organism + susceptibility structure | **PRODUCT DECISION** micro model detail (PD-LAB-MICRO-01) |
| Antimicrobial susceptibility | Partial — specialized child vs coded Observations | PD-LAB-MICRO-01 |
| Pathology / histopathology narrative | Yes — narrative Observation + PDF | Report templates |
| Cytology | Same as narrative + structured codes as needed | Catalog |
| Molecular / genetic | Partial — may need complex report + document | **PRODUCT DECISION** scope (PD-LAB-MOL-01) |
| Qualitative / quantitative / coded / textual | Yes — Observation value types | — |
| Panels | Yes — APPROVED | — |
| Derived / calculated | Partial — formula engine not specified | **PRODUCT DECISION** (PD-LAB-CALC-01) |
| External lab reports | Yes — referral + Observations + Slice 4 PDF | — |

---

## 24. Standards / QMS Gap Analysis (software-oriented)

**Do not claim ISO 15189 / NABL / WHO LQMS certification or accreditation.**

Contextual benchmarks (ISO 15189:2022 process themes — pre/examination/post-examination; risk; quality indicators; information-system validation; documented procedures):

| Area | Software can support | Organization must own |
|---|---|---|
| Patient ID / ordering / specimen / accession / reject | Traceability entities + UI | SOPs, training, labeling discipline |
| Method / instrument / QC / Westgard | QC domain + rule engine | Method validation, EQA, reagent control |
| Validation / release / critical / amend | Workflow + audit | Authorized personnel competency |
| TAT / quality indicators | Metrics from timestamps | Management review |
| Document control | Canonical docs + change audit | Controlled SOP repository (may use hospital Quality) |
| Nonconformance / CAPA | Lab QC rejection + link to Quality module | Investigation & management actions |
| LIS validation / cybersecurity | Change control, authz, audit | IT validation per ISO 15189 software notes |

Detailed QMS matrix: companion [laboratory-management-v3-gap-analysis.md](./laboratory-management-v3-gap-analysis.md) §QMS.

---

## 25. Repository Gap Analysis (summary)

| Area | Class |
|---|---|
| LabReport root / API / Slice 4 / P360 projection | **GREEN** |
| Service Catalog commercial identity | **GREEN** |
| Doctor search | **YELLOW** (unused by Lab UI) |
| Org/Branch/STD_LABORATORY | **YELLOW** (internal context only) |
| Notification dispatch / Hub / CCMS orchestration pattern | **GREEN** |
| Audit service / CounselingSessionAuditLog pattern | **GREEN** pattern / **RED** Lab history |
| IP LIS webhook auth | **GREEN** pattern / **RED** Lab SoT |
| HL7 ADT publisher | **YELLOW** pattern / **RED** ORM/ORU |
| LaboratoryTestDefinition / Specimen / Observation / PerformingLaboratory / QC / Critical / Amendment / FHIR / HL7 lab / Analyzer / Barcode accession | **RED** |
| Vendor as lab | **RED** unsafe |
| Orphan lab.api.ts / SQL lab_order | **RED** do not use |
| L1 workbench | **YELLOW** prototype |
| Permissions least-privilege | **ORANGE** interim patient.* only |

Full capability matrix: companion gap analysis §8.

---

## 26. Release Roadmap

**No big-bang.** Core safety/QMS capabilities are phased but **not** indefinitely labeled “future” to avoid difficulty.

### Dependency-optimized sequence

| Phase | Name | Objective | Core vs External |
|---|---|---|---|
| **L1** | Workbench Stabilization | Fix GET list 405 class; commit/runtime discipline; honest worklist | Core |
| **L2** | Clinical Catalog | LaboratoryTestDefinition + panels/analytes + hybrid ServiceVariant link + clinician lookup on order | Core |
| **L3** | Order & Routing | Indication, visit when known, PerformingLaboratory, multi-item, internal/external flag | Core |
| **L4** | Specimen & Accession | Specimen children, collect/receive/accept-reject, accession + barcode **value** | Core |
| **L5** | Structured Results | Observation model + result workspace; flat summary sync | Core |
| **L6** | Verification & Release | Transition enforcement; verify; `completed` immutability | Core |
| **L7** | Critical Results | Policy + events + ack + escalate via comms orchestration | Core |
| **L8** | QC / Quality | Materials/lots/runs/Westgard-style evaluation + audit | Core |
| **L9** | Amendment / Versioning | Immutable released versions + reason + P360 current | Core |
| **L10** | FHIR Interoperability | Mapping/export-import adapters | External/interop |
| **L11** | HL7 v2 Interoperability | ORM/ORU via integration abstraction | External/interop |
| **L12** | External Laboratory | Referral/dispatch/reconcile (manual first → automated) | Core + partner deps |
| **L13** | Integration Gateway / Analyzer / LIS | Gateway + adapters per real specs | External |
| **L14** | Barcode Hardware Adapter | Printers/scanners | External |
| **L15** | Laboratory Documents | Only beyond Slice 4 if reopened | Core (optional) |
| **L16** | Counsellor Bridge | Explicit bridge decision only | Cross-domain |
| **L17** | Advanced Imaging/PACS/DICOM | Out of Laboratory SoT; Imaging domain | Separate |
| **L18** | Historical Migration | **Not required** per PD-LAB-MIG-01 unless later justified | N/A |

### Phase template (applies to each)

Each phase must define before coding: objective, prerequisites (incl. residual PDs), exact scope, out of scope, APIs, entities, UI, permissions approach, automated tests, **Manual UAT required**, acceptance gate.  
**Do not skip UAT.** Do not auto-start the next slice.

#### L1 — Workbench Stabilization (next after V3 acceptance)

| | |
|---|---|
| Objective | Eliminate GET `/api/lab-reports` 405; align committed AuthService + FE + process restart |
| Prerequisites | V3 accepted; no architecture redesign |
| Scope | List endpoint + runtime discipline only |
| Out of scope | Catalog, specimen, QC, FHIR, permissions redesign |
| UAT | Worklist loads for authorized user |
| Acceptance | Authenticated GET returns 200 with array (possibly empty); no 405 |

Detailed phase cards: companion gap analysis §Roadmap.

---

## 27. Product Decisions Still Required (phase-gated)

Architecture is approved; these block **specific later phases**, not the existence of the roadmap:

| ID | Decision | Blocks |
|---|---|---|
| PD-LAB-VER-02 | Exact verification/release role → capability matrix | L6 |
| PD-LAB-PERM-02 | Map capabilities to existing permissions or Security Decision for new codes | L6+ least-privilege cutover |
| PD-LAB-CRIT-02 | Critical thresholds, recipients, escalation timers, ack SLA | L7 |
| PD-LAB-QC-02 | Westgard/multi-rule pack selection & which analytes require QC gate before release | L8 |
| PD-LAB-MICRO-01 | Culture + susceptibility detailed structure | Micro go-live |
| PD-LAB-MOL-01 | Molecular/genetic report complexity in scope | If molecular in live menu |
| PD-LAB-CALC-01 | Derived/calculated result engine ownership | If calculated results required |
| PD-LAB-14-DETAIL | Counsellor bridge trigger/mapping (when bridge scheduled) | L16 |
| PD-LAB-IFACE-* | Deployment-specific HL7/LIS partner specs | L11–L13 per interface |

---

## 28. Risks

| Risk | Mitigation |
|---|---|
| Implementing L2+ before L1 stabilize | Sequence enforcement |
| Treating FHIR/HL7 as SoT | Adapter rule |
| Skipping QC/critical as “hard” | Phases L7/L8 are core |
| Auto counsellor bridge | Forbidden until L16 decision |
| Permission invention | Matrix → Security Decision |
| Vendor as external lab | Forbidden |
| Process drift (405) | L1 + ops restart checklist |
| Claiming accreditation | Explicit non-claim |

---

## 29. Non-Goals

- Big-bang rewrite  
- Bulk historical migration  
- Replacing LabReport root  
- Reviving orphan lab_order / lab.api.ts  
- Hard-wiring WhatsApp/SMS/email in Lab domain  
- Vendor-as-lab  
- P360 as ops workbench  
- Claiming ISO 15189 / NABL compliance  
- Implementing vendor LIS without interface specs  
- Starting L1/L2 in this gate  
- Fixing 405 in this gate  

---

## 30. Final Gate

```text
PRODUCT DEFINITION READY FOR IMPLEMENTATION

Meaning:
- Target architecture and owner-approved decisions are recorded in V3.
- Phased roadmap is defined.
- Residual decisions are phase-gated (§27), not architecture blockers for L1.
- Implementation, automated tests, Manual UAT, and Acceptance are NOT claimed.
- Do NOT start L1 until Product Owner explicitly accepts V3 and authorizes L1-Stabilize.

IMPLEMENTATION: NOT STARTED
CODE CHANGES: NONE
DATABASE CHANGES: NONE
MANUAL UAT: NOT STARTED
ACCEPTANCE: NOT CLAIMED
```

---

## Appendix A — 405 Runtime Issue (document only; NOT FIXED)

| Item | Finding |
|---|---|
| FE | `labReportsApi.list` → `GET {NEXT_PUBLIC_API_URL}/lab-reports` → `http://localhost:5073/api/lab-reports` |
| Committed AuthService | Collection route has **POST** Create; **no** GET List on HEAD |
| Working tree | Uncommitted `[HttpGet] List` observed historically |
| Running process | May diverge if rebuilt from WT (`dotnet run --no-build`) |
| Why 405 | ASP.NET method mismatch on matched route; **not** authorization |
| Fix disposition | **L1 — Workbench Stabilization** after V3 acceptance |
| This task | **NOT FIXED** |

---

## Appendix B — Documents & areas inspected

Documents: V1 product definition, V2, deep audit, Slice 4 + addendum, gap analysis companion.  
Repository: LabReport stack, Service Catalog, LabTestCatalog, counsellor paths, doctor search, Org/Branch/Dept, Vendor, NotificationService/Hub, CCMS dispatch, IP HL7 ADT + LIS webhook, barcode (MRN/IOL), Quality CAPA (non-lab), L0 permission catalog, audit patterns, orphan lab.api.ts.

Standards context: ISO 15189:2022 process themes (pre/examination/post-examination, QMS, information systems) used only as software-oriented gap benchmarks — **no compliance claim**.
