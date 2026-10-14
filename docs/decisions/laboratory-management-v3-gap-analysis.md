# Laboratory Management V3 — Repository Gap Analysis Companion

**Date:** 2026-10-07  
**Type:** READ-ONLY GAP ANALYSIS  
**Parent:** [laboratory-management-product-definition-v3.md](./laboratory-management-product-definition-v3.md)  
**Status:** COMPLETE — NO IMPLEMENTATION  

> **2026-10-08 re-baseline:** For current L2→L3 E2E capability status (including commercial/billing), use  
> [laboratory-management-e2e-gap-analysis.md](./laboratory-management-e2e-gap-analysis.md) and  
> [laboratory-management-roadmap-rebaseline.md](./laboratory-management-roadmap-rebaseline.md).  
> This V3 companion remains historical context; several L1/L2 rows below are superseded by shipped work.

```text
GAP ANALYSIS: COMPLETE
IMPLEMENTATION: NOT STARTED
CODE CHANGES: NONE
```

Legend: **GREEN** reusable/sufficient · **YELLOW** reusable with extension · **ORANGE** partial / needs product or security decision · **RED** missing/unsafe/must build

---

## 1. Repository inventory classification

| Asset | Class | Notes |
|---|---|---|
| `LabReport` / `lab_reports` | **GREEN** | Authoritative root; clinically thin |
| `LabReportsController` / `lab-reports.api.ts` | **YELLOW** | CRUD/complete/attach; no list on committed HEAD; no state machine |
| `LaboratoryWorkbench` / `LaboratoryOrderDialog` | **YELLOW** | Prototype list + free-text create |
| Slice 4 canonical lab documents | **GREEN** | CERTIFIED EXISTING |
| Patient 360 Clinical / Documents lab | **GREEN** | Projection |
| Service Catalog / ServiceVariant | **GREEN** | Commercial hybrid half |
| `LabTestCatalog` | **YELLOW** | Counsellor/PreOp — not Lab clinical SoT |
| Counsellor investigation paths | **YELLOW** | Separate SoT; bridge-ready only |
| `GET /users/doctors/search` | **YELLOW** | Exists; unused by Lab UI |
| Organization / Branch / `STD_LABORATORY` | **YELLOW** | Internal facility context |
| Inventory Vendor | **RED** | Unfit as clinical lab |
| NotificationService dispatch | **GREEN** | Channel send |
| NotificationHub | **GREEN** | In-app |
| CCMS CommunicationDispatchService | **GREEN** | Orchestration+audit pattern |
| `IAuditService` | **GREEN** | Cross-cutting audit |
| CounselingSessionAuditLog / JourneyAuditLog | **YELLOW** | Pattern to mirror |
| IP `Hl7AdtPublisher` | **YELLOW** | ADT outbox pattern only |
| IP LIS webhook | **YELLOW** | Auth GREEN; destination ward checklist RED for Lab |
| QC / Westgard / lab lots | **RED** | Absent (hospital Quality CAPA ≠ analytical QC) |
| Specimen / Observation entities | **RED** | Absent |
| PerformingLaboratory | **RED** | `LabName` string only |
| FHIR lab resources | **RED** | Absent |
| HL7 ORM/ORU | **RED** | Absent |
| Analyzer / ASTM / LIS instrument | **RED** | Absent |
| Lab accession / ZPL | **RED** | MRN/IOL barcode YELLOW pattern only |
| Critical-result workflow | **RED** | Interpretation string only |
| Result amendment versions | **RED** | Document supersede YELLOW for PDFs |
| Lab status history table | **RED** | Absent |
| Orphan `lab.api.ts` / SQL `lab_order*` | **RED** | Do not use |
| L0 Lab Tech/Manager grants | **GREEN** interim / **ORANGE** final least-privilege |

---

## 2. Required capability gap matrix

| # | Capability | Current state | Target state | Gap | Severity | Reusable component | Required new model/API/UI | Dependency | Phase | Product Decision required? | External dependency? |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Catalog | Free-text + counsellor LabTestCatalog + SC commercial | Hybrid LaboratoryTestDefinition + ServiceVariant | Clinical definition missing | **Critical** | Service Catalog | LaboratoryTestDefinition APIs + admin UI | SC link rules | L2 | Closed (Option C) | No |
| 2 | Panels | Absent | Panel membership in clinical catalog | Missing | **Critical** | — | Panel entities + order expansion | Catalog | L2 | Closed (approved) | No |
| 3 | Analytes | Absent | Analyte dictionary → Observations | Missing | **Critical** | — | Analyte entities | Catalog | L2 | Closed | No |
| 4 | Reference ranges | Flat string on LabReport | Catalog + Observation ranges (age/sex later) | Structured missing | **High** | — | Range model on definition/observation | Catalog | L2/L5 | Optional age/sex later | No |
| 5 | Methods | Absent | Method on definition + result provenance | Missing | **High** | — | Method field/entity | Catalog | L2 | No | No |
| 6 | Specimen | SpecimenType string + SampleCollectedAt | First-class Specimen child 1:N | Entity missing | **Critical** | Master specimen labels | Specimen API/UI | LabReport | L4 | Closed | No |
| 7 | Accession | Absent | Accession identifier on specimen | Missing | **Critical** | — | Accession fields + uniqueness rules | Specimen | L4 | Uniqueness policy TBD | No |
| 8 | Collection | Timestamp only | Collector + time + instructions | Partial | **High** | Doctor/user lookup pattern | Collector user id | Specimen | L4 | No | No |
| 9 | Receive/reject | Absent | Received time + accept/reject reason | Missing | **Critical** | — | Status transitions | Specimen | L4 | Reject reason catalog | No |
| 10 | Internal laboratory | Dept STD_LABORATORY; LabName string | Typed PerformingLaboratory internal | Typed entity missing | **High** | Org/Branch/Dept context | PerformingLaboratory | L3 | Closed (typed) | No |
| 11 | External laboratory | LabName string | Typed external/reference + referral | Missing | **Critical** | — | PerformingLaboratory + Referral | L3/L12 | Closed type; partner later | Partner labs |
| 12 | Order routing | Absent | Internal/external + performing lab | Missing | **Critical** | — | Routing fields on LabReport | PerformingLab | L3 | No | No |
| 13 | Result entry | Complete API; not in L1 UI | Result workspace | UI/workflow missing | **Critical** | Complete endpoint (extend) | Result Workspace UI | Observations | L5 | No | No |
| 14 | Observation model | Flat ResultValue | Observation children + flat summary | Missing | **Critical** | Flat fields preserve | Observation API | Catalog analytes | L5 | Closed | No |
| 15 | DiagnosticReport | LabReport + PDF | Domain envelope + FHIR map | FHIR map missing | **Medium** | LabReport + Slice 4 | Mapping layer | Release | L6/L10 | No | No |
| 16 | Verification | VerifiedByName string | Controlled verify before release | Workflow missing | **Critical** | User lookup | Verify API/UI | Role matrix | L6 | **Yes PD-LAB-VER-02** | No |
| 17 | Release | Complete → completed; Update still mutable | Enforce immutability + release gate | Enforcement missing | **Critical** | Complete endpoint | Transition engine | Verify | L6 | Closed rule; enforce in L6 | No |
| 18 | Critical results | Interpretation=critical string | Policy + event + ack + escalate | Workflow missing | **Critical** | Comm dispatch/hub | CriticalResultEvent | Comm | L7 | **Yes PD-LAB-CRIT-02** | Comms providers |
| 19 | Communication | Toasts only in Lab | Orchestrated intents | Lab orchestration missing | **High** | NotificationService, Hub, CCMS pattern | Lab CommunicationIntent | Channels | L7 | Closed pattern | Provider config |
| 20 | Amendment/versioning | Absent for results | Immutable versions + reason | Missing | **Critical** | Doc supersede pattern (PDF) | ResultVersion model | Release | L9 | Closed requirement | No |
| 21 | QC | Absent | Materials/lots/runs/results | Missing | **Critical** | Hospital Quality CAPA ≠ QC | QC domain | Instruments optional | L8 | **Yes PD-LAB-QC-02** | Reagents/EQA org |
| 22 | Westgard | Absent | Multi-rule evaluation | Missing | **High** | — | Rule engine | QC | L8 | **Yes PD-LAB-QC-02** | No |
| 23 | Barcode | MRN/IOL elsewhere | Specimen/accession barcode value + workflow | Lab SoT missing | **High** | JsBarcode/GS1 patterns | Barcode fields + print adapter | Specimen | L4/L14 | Closed domain; HW later | Printers/scanners |
| 24 | Analyzer | Absent | Gateway adapters | Missing | **High** | LIS webhook auth pattern | Integration Gateway | Specs | L13 | Per-interface | Vendor specs |
| 25 | LIS | Ward checklist webhook only | LabReport-bound LIS gateway | Wrong destination | **High** | Webhook auth | Gateway + mappers | LabReport | L13 | Interface specs | LIS vendor |
| 26 | HL7 | ADT publisher only | ORM/ORU abstraction | Lab messages missing | **High** | ADT outbox pattern | HL7 lab adapter | Gateway | L11 | Partner profiles | External systems |
| 27 | FHIR | Absent | Mapping layer | Missing | **Medium** | — | FHIR adapters | Stable domain | L10 | Closed strategy | Consumers |
| 28 | Documents | Slice 4 certified | Preserve | None for core | **Low** | Slice 4 | Optional L15 if reopen replace | — | L15 optional | Closed preserve | No |
| 29 | P360 | Projection exists | Keep projection-only | Boundary discipline | **Low** | Existing P360 | No ops features in P360 | — | Ongoing | Closed | No |
| 30 | Permissions | patient.* + laboratory.view | Least-privilege matrix | Granular missing | **High** | L0 grants | Capability map ± Security Decision | Roles | L6+ | **Yes PD-LAB-PERM-02** | IAM ops |
| 31 | Audit | No LabReport audit writes | Mutation + status history | Missing | **Critical** | IAuditService + counselling log pattern | LabReportAudit / status history | All phases | L1+ progressive | No | No |
| 32 | TAT | Catalog TAT absent on Lab path; TurnaroundHours on LabTestCatalog only | Definition TAT + queue SLA signals | Lab path missing | **Medium** | LabTestCatalog TAT field idea | TAT on LaboratoryTestDefinition + metrics | Catalog | L2/L3 | No | No |
| 33 | Counsellor bridge | Separate SoTs | Bridge-ready; no auto create | Design deferred | **Medium** | Counsellor APIs | Explicit bridge | Owner detail | L16 | **Yes PD-LAB-14-DETAIL** | Counsellor owners |
| 34 | Historical migration | Flat LabReports exist | Additive children; no bulk migrate | None required | **Low** | LabReport history | Adapters for dual-read | — | N/A (L18 not required) | Closed | No |
| 35 | LabReport root | Exists | Keep root | None | **None** | LabReport | Children only | — | All | Closed | No |

---

## 3. QMS / ISO 15189–oriented software gap (no compliance claim)

| Process theme | Software today | Target software support | Org/accreditation still owns |
|---|---|---|---|
| **Pre-examination** patient ID | MPI patient search | Same + encounter when known | ID band policy |
| Ordering | Free-text LabReport | Catalog + clinician + indication | Request form SOPs |
| Specimen requirements | String | Definition-driven | Collection manuals |
| Collection / labeling / accession | Minimal | Specimen + accession + barcode value | Phlebotomy competence |
| Transport / receipt / reject | Absent | Receive/reject workflow | Courier SOPs |
| Traceability | Weak timestamps | Full chain audit | Sample retention policy |
| **Examination** test definition | Absent Lab clinical | LaboratoryTestDefinition | Method validation docs |
| Method / instrument | Absent | Method + gateway instrument context | Equipment qualification |
| QC / Westgard | Absent | QC domain + rules | EQA enrollment |
| Result capture / validation | Flat complete | Observations + verify | Authorized staff |
| Repeat/recheck | Absent | Observation status/repeats | SOP |
| **Post-examination** release | Complete mutable | Immutable completed + amend versions | Release authority |
| Critical results | String | Event + ack + escalate | On-call roster |
| Communication | None Lab-owned | Orchestration intents | Contact directories |
| Amendments | Absent | Version chain | Amendment SOP |
| Reports/documents | Slice 4 | Preserve + clinical versions | Report templates |
| **QMS** nonconformance/CAPA | Hospital Quality ≠ lab QC | QC reject + optional Quality link | Management review |
| Competency | Absent | User attribution hooks | Training records |
| TAT / indicators | Absent | Timestamp metrics | KPI governance |
| Document control | Canonical + Slice 4 | Preserve | Controlled SOP system |
| Software validation | Portal change process | Phase tests + UAT gates | IT validation evidence |

References used as context only: ISO 15189:2022 process structure (pre/examination/post-examination; management system; information systems validation themes). **No certification claimed.**

---

## 4. 405 runtime (inspection only)

| Check | Result |
|---|---|
| FE method/URL | GET `/api/lab-reports` via `labReportsApi.list` → `http://localhost:5073/api` |
| Committed controller | POST collection only (no GET List on HEAD) |
| Working tree | May contain uncommitted `[HttpGet] List` |
| Auth cause? | **No** — 401/403 vs 405 |
| Disposition | L1 Stabilization after V3 acceptance — **not fixed in this task** |

---

## 5. Phase cards (summary)

### L1 Workbench Stabilization
- **Objective:** GET list contract + rebuild/restart discipline  
- **Entities:** none new  
- **APIs:** GET `/api/lab-reports`  
- **UI:** existing workbench load path  
- **Permissions:** existing  
- **Tests:** worklist contract tests  
- **UAT:** worklist loads without 405  
- **Acceptance:** authenticated GET 200 array  

### L2 Clinical Catalog
- LaboratoryTestDefinition, panels, analytes, hybrid ServiceVariant link  
- Order dialog catalog + doctor search  
- UAT: catalog-driven order  

### L3 Order & Routing
- Indication, visit when known, PerformingLaboratory, multi-item, internal/external  
- UAT: routed order  

### L4 Specimen & Accession
- Specimen 1:N, collect/receive/accept-reject, accession + barcode value  
- UAT: reject path + accession uniqueness  

### L5 Structured Results
- Observation children + result workspace; dual-read with flat fields  
- UAT: multi-analyte entry  

### L6 Verification & Release
- **Prerequisite:** PD-LAB-VER-02, transition matrix  
- Enforce completed immutability  
- UAT: cannot ordinary-edit completed  

### L7 Critical Results
- **Prerequisite:** PD-LAB-CRIT-02  
- Events + orchestration + ack/escalate  
- UAT: critical path with acknowledgement  

### L8 QC / Quality
- **Prerequisite:** PD-LAB-QC-02  
- Lots/runs/Westgard-style evaluation  
- UAT: QC fail blocks or warns per policy  

### L9 Amendment / Versioning
- Version chain; P360 current; provenance retained  
- UAT: amend with reason; prior version visible in audit  

### L10 FHIR
- Mapping adapters only  
- UAT: export sample resources  

### L11 HL7 v2
- ORM/ORU via abstraction  
- **External:** partner profile  
- UAT: sandbox message round-trip  

### L12 External Laboratory
- Referral/reconcile; manual first  
- UAT: send-out order completes via reconcile  

### L13 Integration Gateway / Analyzer / LIS
- Gateway + adapters per real specs  
- **External:** vendor interface docs  
- UAT: one certified adapter in sandbox  

### L14 Barcode Hardware Adapter
- Printers/scanners  
- UAT: scan accession finds specimen  

### L15 Laboratory Documents
- Only if Slice 4 reopen needed  
- Default: skip  

### L16 Counsellor Bridge
- **Prerequisite:** PD-LAB-14-DETAIL  
- No auto fabrication without design  
- Cross-module UAT  

### L17 Imaging/PACS
- Not Laboratory SoT  

### L18 Historical Migration
- Not required (PD-LAB-MIG-01)  

---

## 6. Major gaps (top severity)

1. Clinical catalog + panels/analytes (**RED**)  
2. Specimen/accession/barcode domain (**RED**)  
3. Observation model + result workspace (**RED**)  
4. Verification/release enforcement + role matrix (**RED** / **ORANGE**)  
5. Critical-result workflow (**RED**)  
6. QC / Westgard (**RED**)  
7. Amendment versions (**RED**)  
8. PerformingLaboratory + external referral (**RED**)  
9. HL7/FHIR/LIS adapters (**RED**; patterns YELLOW)  
10. Least-privilege permissions (**ORANGE**)  
11. Lab audit/status history (**RED**)  
12. L1 GET list 405 stabilization (**YELLOW** process/contract)

---

## 7. External dependencies

| Dependency | Needed for |
|---|---|
| SMS/email/WhatsApp providers via NotificationService | Critical/result notifications |
| External lab partners + HL7/API specs | L11–L13 |
| Analyzer/LIS vendors + interface specs | L13 |
| Barcode printers/scanners | L14 |
| Laboratory organization SOPs/competency/EQA | Accreditation reality (not software alone) |
| Security/IAM owner for new permission codes | PD-LAB-PERM-02 |

---

## 8. Unresolved product decisions (phase-gated)

See V3 §27: PD-LAB-VER-02, PERM-02, CRIT-02, QC-02, MICRO-01, MOL-01, CALC-01, 14-DETAIL, IFACE-*.

---

## 9. Confirmation

| Item | Status |
|---|---|
| Production code changed | **NONE** |
| Database / migration / seed changed | **NONE** |
| Permissions/IAM changed | **NONE** |
| APIs / UI / routes changed | **NONE** |
| Tests executed for implementation | **NOT REQUIRED** (inspection only) |
| 405 fixed | **NO** |
| L1/L2 started | **NO** |

```text
GAP ANALYSIS: COMPLETE
IMPLEMENTATION: NOT STARTED
```
