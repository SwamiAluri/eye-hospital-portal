# Diagnostics & Laboratory — Product Definition & Target Operating Model

**Date:** 2026-10-07  
**Type:** PRODUCT / ARCHITECTURE DECISION GATE  
**Status:** PRODUCT OWNER RATIFICATION COMPLETE — RATIFIED FOR IMPLEMENTATION PLANNING  
**Baseline audit:** [diagnostics-laboratory-complete-gap-analysis.md](./diagnostics-laboratory-complete-gap-analysis.md)  
**Related:** [slice-4-laboratory-document-implementation.md](./slice-4-laboratory-document-implementation.md), [slice-4-laboratory-uat-blocker-addendum.md](./slice-4-laboratory-uat-blocker-addendum.md)

```text
PRODUCT OWNER RATIFICATION: COMPLETE
IMPLEMENTATION: NOT STARTED
AUTOMATED TESTS: NOT RUN FOR IMPLEMENTATION
MANUAL UAT: NOT STARTED
ACCEPTANCE: NOT CLAIMED
NEXT IMPLEMENTATION SLICE: L0 — Laboratory Honesty Foundation (IDENTIFIED, NOT STARTED)
```

---

## 1. Executive Summary

Diagnostics & Lab must become three coherent, domain-owned operating lines under one navigation family — **not** a set of mock pages and **not** Patient 360 as a workbench.

| Domain | Authoritative SoT (recommended) | Authoritative ops UI (target) | Patient 360 role |
|---|---|---|---|
| Laboratory / Pathology | `LabReport` (`lab_reports`) + Slice 4 canonical attachment | Rebuilt `/dashboard/laboratory` (Laboratory Management) | Clinical = values; Documents = report files |
| Imaging / Scanning | `ImagingOrder` + `ImagingImage` + blob `imaging-files` | Single Imaging workbench (consolidate away from mock Fundus landing) | Clinical = order/result metadata; Documents = policy A (source-owned), not Lab-copy by default |
| Specialty Diagnostics | Per-entity: Biometry / OCT / Retinopathy / Electrophysiology | Specialty workspaces under Diagnostics (keep entities separate) | Clinical context projections; documents only where legitimate |

**Blood Bank** remains a future separate domain (current nav miswire noted; out of scope).

This document recommends architecture choices grounded in repository evidence and established portal principles. Clinical policy items (post-complete edit, mandatory verification, critical escalation, branch rules, lab-specific permissions) remain **PRODUCT OWNER DECISION REQUIRED**.

---

## 2. Audit Baseline

Verified against repository + prior audit (not re-implemented here):

| Finding | Implication for product |
|---|---|
| `/dashboard/laboratory` is mock (hardcoded KPIs/rows; dead buttons) | Must become real workbench or must not be treated as production ops |
| `LabReportsController` + `labReportsApi` exist; create/complete unused by ops UI | Reuse APIs; wire workbench — do not invent parallel Lab API |
| `lab_reports` present after drift repair; **0 rows** | First real create path required for UAT; no fake seed without approval |
| Slice 4: attach ≠ clinical complete; Documents attach; Clinical read-only | Preserve clinical/document separation |
| `ImagingController` permissioned order/upload | Strongest imaging SoT for operational scanning |
| Specialty CRUD often JWT-only; P360 reads often permissioned | Harden ops authz using **existing** codes only after owner maps codes |
| Triplicate routes: `/dashboard/diagnostic/*`, `/dashboard/imaging/*`, `/imaging` | Consolidate product IA; do not implement route deletes in this gate |
| Orphan `lab.api.ts` (`/lab/*`); unused SQL `lab_order`; live counselor `counselor_lab_order_items` | Do not revive/orphan-wire without explicit bridge decision |
| Lab Technician / Lab Manager default to `/dashboard/laboratory` | Landing on mock is operationally unsafe |

---

## 3. Product Vision

**Diagnostics & Lab** is the staff-facing family for ordering, performing, resulting, reviewing, and releasing laboratory pathology, imaging studies, and specialty eye diagnostics — with Patient 360 reflecting the same clinical events and authorized files without becoming a second operational system.

Quality bar:

- Healthcare-grade, task-focused, honest empty/error/permission states  
- Existing Hospital Portal design system (no new UI framework/visual language)  
- Domain ownership preserved  
- No fabricated clinical data in production nav  
- Documents never fabricate clinical entities  

---

## 4. Domain Boundaries

### In scope

| Domain | Includes |
|---|---|
| **A. Laboratory / Pathology** | Order, queue, specimen fields, result entry, interpretation, completion, report attachment, P360 Clinical/Documents, permissions/audit (as decided) |
| **B. Imaging / Scanning** | ImagingOrder/Image lifecycle, upload, viewer, review/complete, P360 projection, document **policy**, route disposition |
| **C. Specialty Diagnostics** | Biometry, OCT, Retinopathy, Electrophysiology (real SoT); Ultrasound only if SoT later exists |

### Out of scope

Blood Bank · Pharmacy · Billing · CCMS/Insurance (except existing pointer docs) · Counsellor redesign · IP/OT · Surgery · Ownership/work allocation  

Counsellor pre-op lab orders: analyzed only for SoT relationship (D-LAB-14).

---

## 5. Source-of-Truth Model

### 5.1 Laboratory

| Question | Answer |
|---|---|
| Authoritative clinical + operational entity | **`LabReport`** (`lab_reports`) — single entity holds order fields + result fields + status |
| Authoritative file/document | Canonical document associated `domain=lab`, `entityType=LabReport` (Slice 4); `ReportUrl` remains external URL field (unchanged) |
| Certified/reusable APIs | `GET/POST/PUT /api/lab-reports`, `POST .../complete`, `POST .../attach-report`, `GET .../report/content` |
| Partial/dead/orphaned | `lab.api.ts` → `/lab/*` (**orphan, no BE**); SQL `lab_order` / `lab_order_item` (**no EF LabOrder**); mock Laboratory page |
| Parallel (keep separate until bridge decided) | `counselor_lab_order_items` via PreOp / `lab-orders.api.ts` |
| Authoritative UI (target) | Laboratory Management workbench at `/dashboard/laboratory` (rebuild; not P360) |
| Mock/legacy UI | Current mock page content; orphan `LabReportsTab` (attach superseded by Documents) |

### 5.2 Imaging

| Question | Answer |
|---|---|
| Authoritative operational entity | **`ImagingOrder`** |
| Authoritative image entity + storage | **`ImagingImage`** + blob container **`imaging-files`** |
| Certified/reusable APIs | `ImagingController`: create (`examination.create`), list/get (`examination.view`), status (`examination.update`), upload (`imaging.upload`), P360 images metadata |
| Partial/dead | `/clinical/imaging/*` FE clients (no BE); mock Fundus/Ultrasound/Perimetry pages |
| Specialty OCT/etc. | **Separate SoT** — not merged into ImagingOrder (D-IMG-04) |
| Authoritative UI (target) | One Imaging workbench over ImagingOrder (route TBD by D-IMG-01 / D-SPEC-04); `/imaging` retained as advanced viewer shell **FUTURE/CONSOLIDATE** |
| Mock landing today | Sidebar “Scan / Imaging” → `/dashboard/diagnostic/fundus-imaging` |

### 5.3 Specialty

| Module | SoT entity / table | Merge with ImagingOrder? |
|---|---|---|
| Biometry | `BiometryRecord` / `biometry_records` | **No** |
| OCT | `OctImagingScan` / `oct_imaging_scans` | **No** |
| Retinopathy | `RetinopathyScreening` / `retinopathy_screenings` | **No** |
| Electrophysiology | `ElectrophysiologyTest` / `electrophysiology_tests` | **No** |
| Ultrasound (diagnostic page) | **No entity** | N/A — mock only until SoT exists |
| IOL inventory | `iol_inventory` | Adjacent inventory — not clinical result SoT |

---

## 6. Laboratory / Pathology Target Operating Model

### 6.1 End-to-end target flow

```text
Patient
  → Laboratory Management: Order New Test
  → Select patient + test + category + priority + specimen + optional visit/orderer
  → CREATE LabReport (status: ordered)
  → Lab work queue
  → (optional) sample_collected / in_progress
  → Result entry (value, unit, reference range, interpretation, notes)
  → Review / verification  [PRODUCT OWNER — mandatory?]
  → Complete / release (status: completed)
  → Optional report file attach (Slice 4)  [timing: OWNER / Slice 4 default]
  → Patient 360 Clinical (values)
  → Patient 360 Documents (file actions)
  → Patient 360 All (canonical identity dedupe)
```

Patient 360 is **never** the order/result work queue.

### 6.2 Status model

Entity comments document: `ordered`, `sample_collected`, `in_progress`, `completed`, `cancelled`, `on_hold`  
Mock UI uses `pending` (non-API). Complete endpoint hard-sets `"completed"`. Update allows arbitrary Status string today.

| Status | CURRENT RULE | PROPOSED TARGET RULE | Decision |
|---|---|---|---|
| `ordered` | Default on create | Default on create; visible in queue | **Recommended: adopt** |
| `sample_collected` | Free string; unused by UI | Optional when specimen workflow used | **OWNER: required step or optional?** |
| `in_progress` | Free string | Set when tech starts processing / result entry | **OWNER: auto vs manual** |
| `completed` | Set by `/complete` or Update | Terminal clinical release for results | **OWNER: can reopen/edit?** (D-LAB-03) |
| `cancelled` | Free string | Terminal cancel; no result release | **OWNER: who may cancel?** |
| `on_hold` | Free string | Pause without cancel | **OWNER: retain?** |
| UI `pending` | Mock only | **Do not use** — map UI to `ordered` | **Recommended: adopt API vocabulary (D-LAB-11)** |

**Enforcement:** Current = none. Target = server-side allowed transitions. Exact matrix = **PRODUCT OWNER DECISION REQUIRED** (do not invent clinical state machine in code until approved).

### 6.3 Clinical policy questions (not silently answered)

| Question | Current | Recommendation stance |
|---|---|---|
| Edit after completion? | API allows Update | **PRODUCT OWNER DECISION REQUIRED** (D-LAB-03) |
| Verification mandatory? | `VerifiedByName` only; no endpoint | **PRODUCT OWNER DECISION REQUIRED** (D-LAB-04). Target may add workflow later; do not claim verification exists today |
| Who enters results? | Anyone with `patient.update` | **PRODUCT OWNER** — map roles to existing perms (D-LAB-09) |
| Who verifies? | Not modeled | **PRODUCT OWNER** |
| When visible in P360 Clinical? | Any returned LabReport (incl. ordered) | **PRODUCT OWNER**: all statuses vs completed-only for values |
| Critical result? | `interpretation` may be `critical` (comment) | **PRODUCT OWNER**: definition + escalation (P4 until decided) |
| Attach before completion? | Slice 4: yes (any existing LabReport) | **Recommended retain** Slice 4 principle *document ≠ complete*; owner may tighten (D-LAB-05/06) |
| Multiple files? | One active association | **Recommended retain** Slice 4 (D-LAB-07) |
| Replace attachment? | Different bytes → 409 | **PRODUCT OWNER** (D-LAB-08) |

### 6.4 Laboratory Management UI target

| Capability | Classification |
|---|---|
| Live work queue from LabReport API | **REQUIRED NOW** (L1) |
| Patient-linked Order New Test → POST | **REQUIRED NOW** (L1) |
| Search/filter by status/priority/date/patient/test | **REQUIRED NOW** |
| Result entry + Complete | **REQUIRED NOW** (L2) |
| Honest empty/loading/error/permission | **REQUIRED NOW** |
| KPIs from real aggregates (or omit) | **REQUIRED NOW** — never fabricated |
| Attach/preview/download/print on workbench | **FUTURE / L3** — Documents already supports attach |
| Specimen accessioning / barcode / analyzer | **FUTURE** |
| Critical escalation workflow | **FUTURE** (after owner rules) |
| Assigned-to / staffing board | **NOT JUSTIFIED** until ownership module in scope |
| Mock ophthalmology rows as pathology | **NOT JUSTIFIED** — remove |

---

## 7. Imaging / Scanning Target Operating Model

### 7.1 Target flow

```text
Patient
  → Imaging workbench / clinical order surfaces
  → CREATE ImagingOrder (Pending)
  → Work queue by status
  → Capture/upload → ImagingImage in imaging-files (In-Progress)
  → ResultSummary / Complete / Reviewed
  → Viewer (/imaging or embedded)
  → Patient 360 Clinical (orders + file metadata)
  → Documents per Imaging Document Policy (§11)
```

### 7.2 Canonical choices (recommended)

| Concern | Target |
|---|---|
| Canonical order source | `ImagingOrder` |
| Canonical workbench | New/consolidated Imaging ops list over ImagingOrder APIs — **not** mock Fundus page |
| Modality | `ImagingType` / upload `modality` strings on existing model — catalog governance = OWNER |
| Capture/upload | Existing `POST .../upload` + `imaging.upload` |
| Review | Existing Reviewed fields/status |
| Viewer | Retain `/imaging` capabilities; link from workbench |
| Report/result | `ResultSummary` + status; not LabReport |

### 7.3 Route disposition (product intent — not implemented)

| Route | Disposition |
|---|---|
| `/dashboard/diagnostic/fundus-imaging` | **BLOCK FROM PRODUCTION NAV** / **REPLACE** with Imaging workbench entry |
| `/dashboard/diagnostic/ultrasound` | **BLOCK / RETIRE** until SoT exists |
| `/dashboard/imaging/perimetry` (mock) | **BLOCK / RETIRE** until SoT |
| `/dashboard/imaging/*` forms calling `/clinical/imaging/*` | **RETIRE FE clients** or **FUTURE BE** (D-IMG-05) — recommend retire dead clients |
| `/dashboard/diagnostic/oct-imaging` etc. | **CONSOLIDATE** under Specialty Diagnostics IA (not ImagingOrder merge) |
| `/imaging` | **RETAIN** as advanced viewer/tools shell |
| Examination/counselling ImagingTab/widgets | **RETAIN** as order entry consumers of ImagingOrder |

---

## 8. Specialty Diagnostics Target Operating Model

### Matrix

| Module | Entity | Current SoT | Current UI | Current API | Current permission | P360 Clinical | P360 Documents | Storage | Review | Completion | Mock/Legacy/Dup | Security gap | Product decision | Target state |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Biometry | `BiometryRecord` | Yes | `/diagnostic/biometry` (+ dead `/new`) | `/api/Biometry` | Ops JWT-only; P360 `CLINICAL:BIOMETRY:VIEW`; UI page often `CLINICAL:EXAMINATION:*` | Yes | Pointer/CCMS only | DB measurements | Status string | Soft fields | Dup imaging/biometry routes | JWT-only CRUD | D-SPEC-05 map codes | Ops workspace + harden authz; keep entity |
| OCT | `OctImagingScan` | Yes | diagnostic + imaging/oct | `/api/OctImaging` | Ops JWT; P360 `diagnostic.oct.read` | Yes | No file platform | Path fields on ops DTO | Weak | Soft delete | Dup routes | JWT + path exposure | Harden; keep separate from ImagingOrder | Specialty workspace |
| Retinopathy | `RetinopathyScreening` | Yes | diagnostic list | `/api/RetinopathyScreening` | Ops JWT; P360 `CLINICAL:SCREENING:VIEW` | Yes | No | Path fields ops | Grading fields | Soft | Not in sidebar | JWT + paths | Harden | Specialty workspace |
| Electrophysiology | `ElectrophysiologyTest` | Yes | diagnostic list | `/api/Electrophysiology` | Ops JWT; UI `DIAGNOSTIC:ELECTROPHYSIOLOGY:VIEW` | **Missing** | No | ImagePaths | Weak | Soft | Not in sidebar | JWT + paths | D-SPEC-03 add P360 | Specialty + P360 clinical |
| Ultrasound | none | **No** | mock page | none | UI gate only | No | Label only | — | Mock | — | MOCK | N/A | SoT first or hide | Hidden until entity |
| Fundus (diagnostic mock) | none as page SoT | ImagingOrder may cover fundus modality | MOCK nav landing | Imaging API unused by page | `DIAGNOSTIC:IMAGING:VIEW` | Via ImagingOrder if ordered | Policy | imaging-files if uploaded | Via ImagingOrder | Via status | MOCK | Misleading | Replace nav | ImagingOrder modality |

**Do not merge** specialty entities into one generic diagnostic table.

---

## 9. Patient 360 Projection Contract

### Clinical

| Show | Do not show |
|---|---|
| LabReport values (test, result, range, status, dates) | Lab operational work queue actions (order/complete as primary workflow) |
| ImagingOrder clinical metadata | Full imaging tech workbench |
| Imaging file **metadata** (existing) | Forcing download if policy is metadata-only |
| Biometry / Retinopathy / OCT context rows | Attach Report on Clinical (Documents only for Lab) |
| Electrophysiology (target if D-SPEC-03 approved) | Fabricated mock rows |

### Documents

| Show | Do not show |
|---|---|
| Lab canonical attachments + http(s) ReportUrl open | Numeric results as “documents” |
| Imaging content **only per §11 policy** | Generic upload creating LabReport/ImagingOrder |
| Legitimate specialty pointers (e.g. CCMS biometry_record) | Fake ultrasound/fundus files |

Generic upload: Laboratory & Imaging areas remain **`writable: false`**.

### All

Preserve canonical identity dedupe (`canonicalDocumentId`). Same bytes → one identity across associations where platform already supports it.

---

## 10. Document Architecture

Preserve:

```text
Patient → Canonical Document → Document Association → Domain Entity
```

| Rule | Target |
|---|---|
| Domain entity remains SoT | Yes |
| Upload must not fabricate LabReport / ImagingOrder / specialty record | Yes |
| Lab attach | Slice 4 — retain |
| Imaging | Prefer **source-owned** content (§11 Option A); do not auto-migrate blobs to `patient-documents` |
| Specialty files | No new document platform until SoT file ownership is clear (D-SPEC-02) |

---

## 11. Imaging Document Policy

| Option | Description | Tradeoffs |
|---|---|---|
| **A. Source-owned + authenticated content API** (recommended default) | Keep bytes in `imaging-files`; add/use secure content endpoints scoped by ImagingImage + tenant/patient + `examination.view` / existing imaging perms | No byte duplication; aligns with imaging domain ownership; requires content API work (I2) |
| B. Canonical association | Register imaging bytes into canonical platform like Lab | Identity/dedupe benefits; risk of duplicate storage if not careful; different retention/viewer needs |
| C. Metadata-only P360 | Status quo Documents Imaging | Safest short-term; weak clinical file utility |
| D. Other | e.g. DICOM/PACS viewer-only | Future |

**Recommendation:** **A** for target; **C** acceptable interim until I2. **Do not** copy Lab Slice 4 blindly. **No blob migration in early slices.**

**Decision status:** Recommended A — **PRODUCT OWNER CONFIRM** (D-IMG-02).

---

## 12. Authorization Model

### Principles

- Do **not** invent new permission codes in this gate.  
- Hidden UI ≠ security; backend `RequirePermission` remains authoritative.  
- JWT-only PHI CRUD on specialty controllers is **unacceptable** as target.

### Current vs target

| Surface | CURRENT | TARGET | Decision |
|---|---|---|---|
| LabReport read/content | `patient.view` | Keep unless owner introduces lab-specific codes later | D-LAB-10 — **OWNER if change** |
| LabReport write/complete/attach | `patient.update` | Keep for Slice continuity; role mapping via existing roles | D-LAB-09 — **OWNER** for lab-tech least privilege |
| Nav `laboratory.view` | Sidebar only; unused by LabReportsController | Align nav gate with real capability **or** document that nav uses laboratory.view while API uses patient.* | **OWNER** |
| Imaging orders/upload | `examination.*`, `imaging.upload` | Retain | Resolved as certified |
| Specialty ops CRUD | Often JWT-only | Add `RequirePermission` using **existing** catalog codes (`CLINICAL:BIOMETRY:VIEW`, `CLINICAL:SCREENING:VIEW`, `diagnostic.oct.read`, `examination.view`, etc.) — exact map | D-SPEC-05 **OWNER** |
| Specialty P360 | Already gated | Retain pattern; add EP | D-SPEC-03 |

---

## 13. Tenant / Branch / Patient Isolation

| Entity | Tenant | Patient | Branch column | Soft delete |
|---|---|---|---|---|
| LabReport | Yes | Yes | **No** | Yes + EF query filter |
| ImagingOrder | Yes | Yes | **No** | Status cancel (no DeletedAt) |
| ImagingImage | Yes | Via order | **No** | DeletedAt |
| Biometry / OCT / Retinopathy / EP | Yes | Yes | **Yes (nullable)** | Yes |

**Missing branch semantics on LabReport / ImagingOrder:** **PRODUCT DECISION REQUIRED** (D-SPEC-01) — do not invent tenant-wide vs branch-restricted behavior.

Target: preserve tenant + patient checks; association ownership for Lab content as Slice 4.

---

## 14. Provenance / Auditability

| Event | CURRENT | TARGET | Decision |
|---|---|---|---|
| Who ordered | `OrderedById/Name`, `CreatedByUserId` | Retain + require on create in UI | — |
| Who collected | `SampleCollectedAt` only | Add actor if owner requires | **OWNER** |
| Who entered result | `UpdatedByUserId` on Complete | Explicit performer field if owner requires | **OWNER** |
| Who reviewed/verified | `VerifiedByName` string | Structured user id + timestamp if verification mandated | D-LAB-04 **OWNER** |
| Status change history | No dedicated ledger | Future audit trail | **FUTURE** |
| Document upload | Canonical identity + association + user on attach | Retain Slice 4 | — |
| Imaging review | `ReviewedByUserId` / `ReviewedAt` | Retain | — |

Do not implement a new audit ledger in early Lab slices unless owner prioritizes.

---

## 15. Navigation / Information Architecture (target)

Conceptual target (labels adjustable; **route changes not implemented here**):

```text
DIAGNOSTICS & LAB
  ├── Laboratory / Pathology
  │     └── Laboratory Management (/dashboard/laboratory)  ← ops workbench
  ├── Imaging / Scanning
  │     └── Imaging Work Queue (canonical entry — replaces mock fundus landing)
  │     └── Viewer tools (/imaging) — advanced
  └── Specialty Diagnostics
        ├── Biometry
        ├── OCT
        ├── Retinopathy Screening
        └── Electrophysiology

Blood Bank → FUTURE separate domain (fix nav miswire later)
```

Patient 360 remains under Patient Record — not under Diagnostics ops.

---

## 16. Mock / Legacy / Duplicate Disposition

| Asset | Disposition |
|---|---|
| `/dashboard/laboratory` mock content | **REBUILD** into live LabReport workbench |
| `/dashboard/diagnostic/fundus-imaging` | **BLOCK FROM PRODUCTION NAV** / **REPLACE** |
| `/dashboard/diagnostic/ultrasound` | **BLOCK / RETIRE** until SoT |
| `/dashboard/diagnostic/biometry` | **RETAIN** as specialty UI; fix dead `/new` |
| `/dashboard/diagnostic/oct-imaging` | **RETAIN/CONSOLIDATE** under Specialty |
| `/dashboard/diagnostic/retinopathy-screening` | **RETAIN** (add to IA) |
| `/dashboard/diagnostic/electrophysiology` | **RETAIN** (add to IA) |
| `/dashboard/imaging/*` orphan clinical clients | **RETIRE** dead clients (D-IMG-05) |
| `/dashboard/imaging/perimetry` mock | **BLOCK / RETIRE** |
| `/imaging` | **RETAIN** |
| `labReportsApi` | **RETAIN** — primary FE client |
| `lab.api.ts` | **RETIRE** (do not wire) |
| Counselor lab-orders | **RETAIN** counselling SoT; bridge **FUTURE** (D-LAB-14) |
| SQL `lab_order` artifacts | **RETIRE** as SoT candidate — do not revive |
| `LabReportsTab` | **CONSOLIDATE** — Documents is live attach; tab optional cleanup later |

---

## 17. Product Decision Register

Status key: **RECOMMENDED** (architecture recommendation for owner ratification) · **OWNER REQUIRED** · **RESOLVED** (already true in code)

### Laboratory

| ID | Decision | Current evidence | Options | Recommended | Rationale | Consequences | Dependencies | Impl impact | UAT impact | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| D-LAB-01 | Lab Management = authoritative ops workbench for LabReport? | Mock page; P360 projection | P360 as workbench / Lab Management / both | **Lab Management** | Portal principle: domain owns ops | Rebuild `/dashboard/laboratory` | — | L1 | Ops UAT on Management | **RECOMMENDED** |
| D-LAB-02 | Create LabReport vs revive `lab_order`? | LabReport EF+API; lab_order no EF | LabReport / lab_order / both | **LabReport direct** | Avoid parallel SoT | Do not build lab_order API | D-DATA-02 | L1 uses POST lab-reports | Create path clear | **RECOMMENDED** |
| D-LAB-03 | Edit after completion? | Update unrestricted | Allow / disallow / amend-only | — | Clinical policy | Server transition rules | Status matrix | L2 | Negative UAT | **OWNER REQUIRED** |
| D-LAB-04 | Verification mandatory? | Name field only | No / optional / mandatory | — | Clinical/regulatory | New workflow vs none | Roles | L2+ | Verify steps | **OWNER REQUIRED** |
| D-LAB-05 | When attach allowed? | Slice 4: any LabReport | Any / completed-only | **Any existing LabReport** (retain Slice 4) | Document ≠ complete | Attach ≠ release | Slice 4 | L3 optional | Attach UAT | **RECOMMENDED** (confirm) |
| D-LAB-06 | Attach before complete? | Yes today | Yes / no | **Yes** (same as Slice 4) | Same principle | Docs may precede complete | D-LAB-05 | — | — | **RECOMMENDED** (confirm) |
| D-LAB-07 | One vs many files? | One active | One / many | **One active** | Slice 4 certified | Keep 409 on conflict | — | — | Dedupe UAT | **RECOMMENDED** |
| D-LAB-08 | Replacement? | 409 different bytes | Keep 409 / allow replace | — | Ops preference | Versioning complexity | D-LAB-07 | Future | Conflict UAT | **OWNER REQUIRED** |
| D-LAB-09 | Lab staff perms vs patient.update? | API patient.update; nav laboratory.view | Keep patient.* / introduce lab.* later / map roles only | **Keep patient.* for now**; role mapping | No new codes without approval | Lab tech may be over/under privileged | Role catalog | Authz tests | Role UAT | **OWNER REQUIRED** |
| D-LAB-10 | View results vs file content perms? | Both patient.view | Keep / split later | **Keep patient.view** interim | Slice 4 certified | — | — | — | — | **RECOMMENDED** interim |
| D-LAB-11 | Status vocabulary | Mock pending vs API ordered | API set / UI set | **API set** | Align FE/BE | UI labels map to ordered | — | L1 filters | Status UAT | **RECOMMENDED** |
| D-LAB-12 | Lab tech default landing | DashboardRouter → mock | Keep / honesty banner / delay until L1 live | **Do not treat mock as production**; replace with live workbench ASAP; interim honesty | Safety | Router change in L0/L1 | D-UX-01 | L0/L1 | Role landing UAT | **RECOMMENDED** |
| D-LAB-13 | Fate of lab.api.ts? | Orphan /lab/* | Wire / ignore / delete later | **Do not wire**; retire later | Dead BE | Avoid dual clients | — | Cleanup slice | — | **RECOMMENDED** |
| D-LAB-14 | Counselor lab-orders vs LabReport? | Separate tables | Ignore / bridge / merge | **Keep separate**; bridge only after explicit design | Prevent fabricated LabReports from counselling | Dual queues until bridge | Counsellor owners | Future | Cross-module UAT | **OWNER REQUIRED** (timing) |

### Imaging

| ID | Decision | Current evidence | Options | Recommended | Rationale | Consequences | Dependencies | Impl impact | UAT impact | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| D-IMG-01 | Canonical imaging nav/workbench? | Sidebar → mock fundus | Fundus mock / ImagingOrder workbench / /imaging only | **ImagingOrder workbench** as nav entry | Real SoT | Nav change later | D-SPEC-04 | I1 | Imaging queue UAT | **RECOMMENDED** |
| D-IMG-02 | P360 Documents for imaging? | Metadata only | A/B/C/D §11 | **A source-owned content** (C interim) | No blind Lab copy | I2 content API | — | I2 | File access UAT | **RECOMMENDED** + confirm |
| D-IMG-03 | Which modalities in P360? | Mixed mock/live | All labels / live only | **Live ImagingOrder + specialty with SoT only** | No fabricated modality | Hide mock modalities | — | I1/S* | — | **RECOMMENDED** |
| D-IMG-04 | ImagingOrder vs specialty tables? | Separate entities | Merge / link / keep separate | **Keep separate** | Different clinical meaning | Dual projections OK | — | — | — | **RECOMMENDED** |
| D-IMG-05 | `/clinical/imaging/*` FE? | No BE | Build BE / retire FE | **Retire FE clients** | Source gap | Remove dead forms dependency | — | I1 cleanup | — | **RECOMMENDED** |

### Specialty / data / UX / security

| ID | Decision | Current evidence | Options | Recommended | Rationale | Status |
|---|---|---|---|---|---|---|
| D-SPEC-01 | Branch when column null / missing? | Lab/ImagingOrder no branch; specialty nullable | Tenant-wide / require branch / inherit user branches | — | Must not invent | **OWNER REQUIRED** |
| D-SPEC-02 | Specialty document integrations? | Only Lab Slice 4 | Per-module / none yet | **None yet** unless file SoT clear | Avoid fabricate | **RECOMMENDED** |
| D-SPEC-03 | Electrophysiology in P360 Clinical? | Entity exists; no projection | Yes / no | **Yes** (clinical projection, metadata-safe) | Parity with other specialty | **RECOMMENDED** |
| D-SPEC-04 | Canonical UI tree? | Triple routes | diagnostic vs imaging vs /imaging | **IA §15**: Imaging workbench + Specialty list + retain /imaging tools | Clarity | **RECOMMENDED** |
| D-SPEC-05 | RequirePermission codes for specialty CRUD? | JWT-only | Map existing codes | Map to existing CLINICAL:/diagnostic./examination.* — **exact code per endpoint OWNER** | Security | **OWNER REQUIRED** |
| D-DATA-01 | lab_reports env + first row policy? | Repaired; 0 rows | Fake seed / ops create / controlled UAT create | **Ops or controlled create — no silent fake clinical seed** | Clinical safety | **RECOMMENDED** |
| D-DATA-02 | Fate of SQL lab_order? | Unused | Revive / ignore | **Ignore as SoT** | LabReport wins | **RECOMMENDED** |
| D-SEC-01 | Soft-delete LabReport reads | EF HasQueryFilter | — | Retain | Already correct | **RESOLVED** |
| D-UX-01 | Mock pages in production nav? | Misleading | Banner / hide / rebuild first | **Honesty + rebuild Lab; block mock imaging landings** | Safety | **RECOMMENDED** |

### Role capability matrix (existing roles only — no new roles)

| Capability | Lab Technician / Manager (intent) | Doctor (intent) | Counsellor (current) | Decision |
|---|---|---|---|---|
| View lab queue | Yes (target) | View patient labs | Pre-op lab orders (separate) | Map via existing perms — **OWNER** |
| Create lab order | Yes (target) | Yes if clinically ordered | Counsellor items ≠ LabReport | D-LAB-14 |
| Enter results | Yes (target) | Maybe | No LabReport | **OWNER** |
| Verify/release | Manager/Doctor? | Maybe | No | D-LAB-04 **OWNER** |
| Attach report | patient.update today | Same | N/A | Slice 4 |
| Imaging order | Via examination.create surfaces | Yes | Can order imaging | Retain |
| Specialty perform | Tech roles in seed catalogs | View | Limited | D-SPEC-05 **OWNER** |

---

## 18. Target UX Principles

1. Always show patient identity in ops contexts.  
2. Task-first work queues; clear status chips using **real** statuses.  
3. No fabricated KPIs or clinical rows.  
4. Clinical values ≠ document actions (separate surfaces).  
5. Honest loading / empty / error / unauthorized.  
6. Existing design system only (Counsellor quality bar for staff UI polish).  
7. Do not force ops work through Patient 360.  
8. Desktop-first density for lab/imaging workstations.  
9. Minimal copy; actionable primary buttons.  
10. Accessibility: keyboard, labels, focus (portal a11y rules).

---

## 19. Cross-Module Reflection Matrix

| Domain | Operational source | Clinical reflection | Document reflection | All-tab |
|---|---|---|---|---|
| Lab | Lab Management → LabReport | P360 Clinical Laboratory | P360 Documents Laboratory (canonical + ReportUrl) | Canonical id dedupe |
| Imaging | Imaging workbench → ImagingOrder/Image | P360 Clinical orders + file metadata | Per §11 (not automatic Lab pattern) | Only if canonical association exists |
| Biometry | Biometry workspace → BiometryRecord | P360 Specialty | Pointer docs only if already issued | If canonical id present |
| OCT | OCT workspace → OctImagingScan | P360 OCT | No new platform yet | — |
| Retinopathy | Screening workspace | P360 Specialty | — | — |
| Electrophysiology | EP workspace | Target P360 Specialty | — | — |

**Invariant:** operational source ≠ Patient 360 projection.

---

## 20. Test Strategy

| Layer | Must prove |
|---|---|
| Unit | Mappers, status display maps, honesty states |
| API/integration | Create/complete/attach; transition rules once approved; soft-delete filter |
| Permission | patient.view/update; examination/imaging; specialty RequirePermission once mapped |
| Isolation | Tenant + patient; negative cross-patient |
| Documents | Association required; hash idempotency; 409 conflict; content denied without association |
| UI mount | **Live shell imports** Laboratory Management + P360 Documents attach (Slice 4 lesson: string tests ≠ mounted) |
| Mock honesty | Management page must call live API or fail tests if mock data remains |
| E2E | Order → result → Clinical → attach → Documents → All dedupe |

---

## 21. Manual UAT Strategy (do not execute now)

### Laboratory (happy + negative)

Patient → Order → Queue → Process → Enter result → (Verify if mandated) → Complete → Clinical → Attach → Documents Preview/Download/Print → All dedupe  

Negatives: wrong tenant/patient, unauthorized, soft-deleted hidden, duplicate attach, invalid transition (once enforced), empty source, unavailable API.

### Imaging

Order → Upload → Review/Complete → Viewer → Clinical → content policy  

### Specialty

Create/perform → Result → P360 → unauthorized denial  

---

## 22. Implementation Roadmap (NOT STARTED)

Recommended sequence (adjusted for dependencies):

### L0 — Laboratory honesty foundation
- Confirm `lab_reports` in all envs; no fake seeds; mock honesty / Lab-role landing policy  
- **DB:** none beyond env confirmation  
- **Out:** full workbench rebuild  

### L1 — Laboratory Management workbench
- Replace mock with LabReport list/create/search/filter; API vocabulary  
- Reuse `labReportsApi`, LabReportsController  
- **DB:** none expected  

### L2 — Result workflow
- Result entry + Complete; apply owner decisions D-LAB-03/04 if resolved  
- **Out:** analyzer, critical escalation  

### L3 — Report ops on workbench (optional)
- Reuse Slice 4 attach/content from Management  

### I1 — Imaging operational consolidation
- Canonical ImagingOrder workbench; change nav away from mock Fundus; retire dead `/clinical/imaging` clients  
- **Out:** PACS, specialty merge  

### I2 — Imaging document/content policy
- Implement confirmed §11 option (prefer A)  

### S1 — Specialty authorization hardening
- RequirePermission with owner-mapped existing codes; stop path leakage on P360 (already) and reduce ops DTO risk  

### S2 — Specialty P360 normalization
- Electrophysiology clinical projection; IA/sidebar completeness; Biometry `/new`  

Each slice later needs full gate fields (tests, UAT, acceptance) at execution time.

---

## 23. Dependencies

- Owner ratification of **OWNER REQUIRED** decisions before L2 clinical rules and S1 permission mapping  
- Slice 4 Lab document platform (complete in code; UAT still required)  
- Env `lab_reports` presence  
- Existing design system / Patient 360 shell  
- Imaging blob `imaging-files` availability  

---

## 24. Risks

| Risk | Mitigation |
|---|---|
| Lab tech continues landing on mock | L0/L1 + D-LAB-12 |
| Dual SoT if lab_order or lab.api.ts wired | D-LAB-02/13 |
| Counsellor orders confuse pathology queue | D-LAB-14 explicit bridge later |
| JWT-only specialty PHI | S1 priority |
| Imaging document byte duplication | Prefer policy A |
| Over-scoping verification/critical before owner rules | Keep P4 until decided |
| Tests pass on unmounted components | Mount assertions mandatory |

---

## 25. Explicitly Deferred Items

- Blood Bank domain  
- PACS/DICOM full integration  
- FHIR/HL7 implementation  
- Analyzer / accessioning  
- New permission code creation  
- Attachment replacement/versioning (unless D-LAB-08 chooses)  
- Merging specialty entities into ImagingOrder  
- Counsellor→LabReport automatic fabrication  
- Ownership/work allocation boards  

### Standards lens

| Standard | Status |
|---|---|
| FHIR | NOT YET IMPLEMENTED — FUTURE consideration |
| DICOM/PACS | Fields/viewer partial — FUTURE |
| HL7 | NOT YET IMPLEMENTED |
| HIPAA/regulatory claims | Do not claim compliance from this document |

---

## 26. Product Owner Ratification

**Ratification date:** 2026-10-07  

**Status:** RATIFIED FOR IMPLEMENTATION PLANNING  

Product Owner reviewed [diagnostics-laboratory-product-definition.md](./diagnostics-laboratory-product-definition.md) recommendations and approved the positions below. This section records ratification only. **No implementation was performed.**

### 26.1 Ratified decisions

| ID | Decision | Ratified Position | Implementation Slice | Kind |
|---|---|---|---|---|
| D-LAB-01 | Ops workbench vs P360 | Laboratory Management is authoritative ops workbench; `LabReport` is SoT; Patient 360 is projection only | L1 (workbench); P360 unchanged as ops | **RATIFIED** |
| D-LAB-02 | Lab entity vs parallels | `LabReport` authoritative; do **not** revive `lab_order`, `lab_order_item`, or `lab.api.ts` as competing SoT; counsellor pre-op lab remains separate until future bridge | L0–L2 | **RATIFIED** |
| D-LAB-03 | Post-completion editing | Ordinary edit after `completed` **not allowed**; `completed` = released clinical result; controlled amendment/versioning **out of scope** for L0/L1/L2 | L2 (enforce no silent mutate); amendment = FUTURE | **RATIFIED** |
| D-LAB-04 | Verification | Verification is a **target** requirement before final release; **not** in L0; L1 must not invent verification UI; L2 may implement only after exact role/capability mapping in that slice’s product decision | Deferred to approved result-workflow (L2+) | **RATIFIED** (requirement) / impl deferred |
| D-LAB-05 | Attach timing | Preserve Slice 4: attach to existing LabReport regardless of completion; attach ≠ clinical completion/release | Preserve (Slice 4); L3 optional workbench UX | **RATIFIED** + **CERTIFIED EXISTING** |
| D-LAB-06 | Attach before completion | Allowed; certified Slice 4; do not change in L1/L2 | Preserve | **RATIFIED** + **CERTIFIED EXISTING** |
| D-LAB-07 | One active attachment | One active canonical attachment; same-bytes idempotent; different bytes → conflict per Slice 4 | Preserve | **RATIFIED** + **CERTIFIED EXISTING** |
| D-LAB-08 | Attachment replacement | Preserve Slice 4: one active; different bytes → 409; **no** replacement / supersession / version history in L0/L1/L2 | Preserve; versioning = FUTURE | **RATIFIED** |
| D-LAB-09 | Lab permissions | **No** new lab-specific permission codes; continue `patient.view` / `patient.update`; do not silently broaden access; audit role→permission before any change; STOP if L1 would expose API to a role lacking required permission | L0–L2; least-privilege codes = FUTURE | **RATIFIED** |
| D-LAB-10 | Result vs content perms | Initial: both use existing `patient.view`; no new codes; future least-privilege separate | L0–L2 | **RATIFIED** |
| D-LAB-11 | Status vocabulary | API statuses authoritative: `ordered`, `sample_collected`, `in_progress`, `completed`, `cancelled`, `on_hold`; no UI-only `pending` lifecycle state (label for ordered OK) | L1+ | **RATIFIED** |
| D-LAB-14 | Counsellor pre-op | Remains separate SoT; do **not** auto-create LabReport, copy rows, fabricate orders, or merge tables; bridge = future explicit design; **out of scope** L0/L1/L2 | FUTURE bridge | **RATIFIED** |
| D-IMG-01 | Imaging ops SoT | `ImagingOrder` authoritative; one Imaging workbench; mock Fundus landing is **not** operational source | I1 | **RATIFIED** |
| D-IMG-02 | Imaging documents | Source-owned `imaging-files` + authenticated scoped content API; P360 Documents metadata-only until I2; **no** blob copy to `patient-documents`; **no** storage migration | I2 | **RATIFIED** |
| D-IMG-03 | P360 modalities | Reflect only real modality/source records; no fabricated mock modality data | I1 / ongoing | **RATIFIED** |
| D-IMG-04 | Imaging vs specialty | Keep `ImagingOrder` separate from Biometry/OCT/Retinopathy/EP entities; consolidate UX/nav, not entities | I1 / S* | **RATIFIED** |
| D-IMG-05 | Orphan clinical imaging FE | Dead `/clinical/imaging/*` clients must not become parallel architecture; retire in future cleanup slice | Future cleanup | **RATIFIED** |
| D-SPEC-01 | Branch semantics | Do **not** invent branch for LabReport/ImagingOrder; tenant + patient isolation mandatory; no branch columns, no infer-from-profile, no branch filtering | FUTURE | **RATIFIED** (defer) |
| D-SPEC-02 | Specialty documents | No new generic specialty document platform yet; source-owned files/pointers remain source-owned | S* | **RATIFIED** |
| D-SPEC-03 | Electrophysiology P360 | Eventually in Patient 360 Clinical; belongs in **S2** | S2 | **RATIFIED** |
| D-SPEC-04 | Target IA | Diagnostics & Lab → Laboratory / Pathology · Imaging / Scanning · Specialty Diagnostics; specialty entities remain separate | Nav/IA in later slices | **RATIFIED** |
| D-SPEC-05 | Specialty authz | JWT-only PHI CRUD **not** acceptable; use existing permission catalog; **no** new codes in this ratification; S1 requires endpoint-by-endpoint mapping; STOP if no appropriate existing permission | S1 | **RATIFIED** (approach) |
| D-DATA-01 | Lab data honesty | Genuine operational data only; **no** fake clinical seeds; L0 may verify schema/env; L1 may create first real LabReport via operational workflow in dev/UAT | L0 / L1 | **RATIFIED** |
| D-DATA-02 | SQL lab_order | Not authoritative; do not revive | L0–L2 | **RATIFIED** |
| D-UX-01 | Mock honesty | Mock pages must not be genuine workstations; rebuild Laboratory; do not use mock Fundus/Ultrasound/Perimetry as ops landings; specialty = source-backed only; no fabricated KPIs/rows | L0 / L1 / I1 | **RATIFIED** |
| D-SEC-01 | Lab soft-delete reads | EF `HasQueryFilter` retained | — | **CERTIFIED EXISTING** / prior resolved |
| D-LAB-12 / D-LAB-13 | Lab landing / orphan lab.api | Covered by D-UX-01 + D-LAB-02 (rebuild Management; do not wire `lab.api.ts`) | L0 / L1 | **RATIFIED** (via D-UX-01 / D-LAB-02) |

### 26.2 Additional ratified clinical rules (Laboratory)

| Topic | Ratified Position | Slice | Kind |
|---|---|---|---|
| Specimen step | **Optional** initially; may use `ordered → in_progress` without specimen; or `ordered → sample_collected → in_progress` when used; **no** barcode/accessioning/analyzer | L1/L2 | **RATIFIED** |
| `in_progress` | Means processing/result work has begun; auto vs manual transition decided in L2 design; no extra states | L2 | **RATIFIED** |
| `completed` | Final released result; normal edit not allowed; verification required in **target** workflow but verification **implementation** deferred to L2 | L2 | **RATIFIED** |
| Critical results | Definition + escalation **not** approved for implementation | — | **FUTURE DECISION** |
| P360 Lab visibility | May reflect LabReports per existing projection; ops actions stay in Laboratory Management; P360 never result-entry/release workbench; **do not redesign** P360 Clinical in L0 | Preserve; L0 no redesign | **RATIFIED** + existing projection |

### 26.3 Certified Slice 4 behavior (must preserve)

Do **not** redesign in L0/L1/L2:

| Behavior | Kind |
|---|---|
| Canonical Lab document attachment | **CERTIFIED EXISTING BEHAVIOR** |
| SHA-256 identity | **CERTIFIED EXISTING BEHAVIOR** |
| Canonical association (`lab` / `LabReport`) | **CERTIFIED EXISTING BEHAVIOR** |
| One active LabReport attachment | **CERTIFIED EXISTING BEHAVIOR** |
| Attach-before-completion | **CERTIFIED EXISTING BEHAVIOR** |
| Different-byte conflict (409) | **CERTIFIED EXISTING BEHAVIOR** |
| Authenticated report content | **CERTIFIED EXISTING BEHAVIOR** |
| P360 Documents Laboratory + Preview / Download / Print | **CERTIFIED EXISTING BEHAVIOR** |
| Existing Patient 360 Clinical lab projection (read-only values) | **CERTIFIED EXISTING BEHAVIOR** |

### 26.4 Future product decisions (explicitly deferred)

1. Critical-result definition and escalation  
2. Exact verification role/capability model (required before L2 verification UI)  
3. Future Laboratory least-privilege permission codes  
4. LabReport / ImagingOrder branch semantics  
5. Counsellor → Laboratory bridge  
6. Attachment replacement / versioning  
7. Full specimen accessioning  
8. Analyzer integration  
9. PACS / DICOM integration  
10. FHIR / HL7 integration  

**Do not implement these in L0/L1/L2** (except L2 verification only after item 2 is bounded and approved for that slice).

---

## 27. Final Product Gate

```text
PRODUCT DEFINITION: COMPLETE

PRODUCT OWNER RATIFICATION: COMPLETE

TARGET ARCHITECTURE: DEFINED

IMPLEMENTATION:
NOT STARTED

AUTOMATED TESTS:
NOT RUN FOR IMPLEMENTATION

MANUAL UAT:
NOT STARTED

ACCEPTANCE:
NOT CLAIMED

NEXT IMPLEMENTATION SLICE:
L0 — Laboratory Honesty Foundation

STOP.
```

**Note:** “NEXT IMPLEMENTATION SLICE” means **identified**, **not started**.

---

*Ratification records product decisions only. No production code, database, seeds, permissions, routes, APIs, or UI were changed in this gate.*
