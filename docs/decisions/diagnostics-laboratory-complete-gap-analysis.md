# Diagnostics & Laboratory — Complete Domain Gap Analysis

**Date:** 2026-10-07  
**Type:** READ-ONLY AUDIT  
**Status:** COMPLETE — NO IMPLEMENTATION  
**Related:** [slice-4-laboratory-document-implementation.md](./slice-4-laboratory-document-implementation.md), [slice-4-laboratory-uat-blocker-addendum.md](./slice-4-laboratory-uat-blocker-addendum.md)  

**Follow-up (same day):** Reconciled with parallel inventory agents — corrected LabReport soft-delete (EF query filter present), `lab_reports` post-repair empty-table status, Patient 360 Clinical vs Documents attach surface, orphan `lab.api.ts`, Lab role → mock default route, and additional mock modality/dead-client findings. Still audit-only; no implementation.

```text
AUDIT: COMPLETE
IMPLEMENTATION: NOT STARTED
AUTOMATED TESTS: NOT RUN FOR IMPLEMENTATION — AUDIT ONLY
MANUAL UAT: NOT STARTED
ACCEPTANCE: NOT CLAIMED
NEXT SLICE: NOT STARTED
```

---

## 1. Executive Summary

Diagnostics & Laboratory in Hospital Portal is **not** a coherent end-to-end healthcare workflow today. It is a mixture of:

| Layer | Reality |
|---|---|
| Staff Laboratory Management UI (`/dashboard/laboratory`) | **MOCK** — hardcoded KPIs and rows; dead action buttons; no API calls |
| `LabReport` API (`LabReportsController`) | **PARTIAL certified API** — create/update/complete/attach/content exist; no operational workbench consumes create/complete |
| `lab_reports` table | **PRESENT AFTER DRIFT REPAIR (0 rows)** — UAT addendum: was missing despite EF history; repaired 2026-10-07 with `CREATE TABLE IF NOT EXISTS`; **no clinical rows yet** |
| Slice 4 canonical lab attachment | **IMPLEMENTED in code** — attach/content + Patient 360 Documents actions; blocked in practice by **empty** `lab_reports` (no LabReport to attach to) |
| Imaging orders (`imaging_orders` / `imaging_images`) | **PARTIAL GREEN** — create/status/upload APIs with permissions; used from examination/counselling widgets; no unified Diagnostics workbench |
| Specialty diagnostics (Biometry, OCT, Retinopathy, Electrophysiology) | **PARTIAL** — entities + CRUD APIs + some Patient 360 read contracts; many endpoints JWT-only; Fundus/Ultrasound Diagnostic pages are mock |
| Duplicate modality routes | **LEGACY/DUPLICATE** — `/dashboard/diagnostic/*` vs `/dashboard/imaging/*` vs `/imaging` |
| Patient 360 | **Projection surface** — Clinical labs/imaging + Specialty + Documents Laboratory/Imaging exist; must not be treated as the lab workbench |

**Bottom line:** The portal cannot currently support a professional laboratory order → result → review → report → clinical/document reflection lifecycle for staff. Imaging has stronger backend foundations than Laboratory Management UI, but modality UX is fragmented and partly mock. Product decisions are required before any next implementation slice.

---

## 2. Scope

### In scope

- Scan / Imaging (all modalities found)
- Diagnostics Lab / specialty diagnostics (excluding Blood Bank)
- Laboratory / Pathology lifecycle and Patient 360 clinical/document projection
- Canonical documents for LabReport (Slice 4)
- Permissions, tenant/branch, schema/migrations, mocks/duplicates, tests gaps

### Out of scope (mentioned only as dependencies)

- Blood Bank, Pharmacy, Billing, CCMS/Insurance, Counsellor (except imaging-order consumption), IP/OT, Surgery, ownership/work allocation, unrelated Patient 360 domains

### Explicit non-actions during this audit

No code, schema, seed, permission, route, UI, storage, or test changes. Slice 4 Laboratory document implementation was **not** modified.

---

## 3. Methodology

1. Sidebar inventory (`sidebar-menu-sections.tsx`) → route pages under Diagnostics & Lab and Imaging.
2. Trace UI → API client → controller → service → EF entity → migration for Laboratory, Imaging, specialty modules.
3. Classify every surface: CERTIFIED / PARTIAL / MOCK / LEGACY / DUPLICATE / SOURCE GAP / SECURITY GAP / DATA GAP / INTEGRATION GAP / DECISION REQUIRED.
4. Cross-check prior Slice 4 decision docs for live DB drift evidence (not re-executed against production in this session).
5. Inventory Patient 360 Clinical / Documents / All consumers for labs and imaging.
6. Inventory permissions as they appear in code (no invented codes).
7. No implementation; recommendations are advisory only.

---

## 4. Current Architecture

```text
                    ┌─────────────────────────────────────────┐
                    │  Sidebar: Diagnostics & Lab             │
                    │  - Scan/Imaging → fundus-imaging (MOCK) │
                    │  - Diagnostics Lab → biometry (PARTIAL) │
                    │  - Laboratory → /dashboard/laboratory   │
                    │    (MOCK — not wired to LabReport)      │
                    └─────────────────────────────────────────┘
                                        │
          ┌─────────────────────────────┼─────────────────────────────┐
          ▼                             ▼                             ▼
   Specialty entities            LabReport entity              ImagingOrder/
   biometry_records              lab_reports (EF)              ImagingImage
   oct_imaging_scans             API: /api/lab-reports         imaging_orders
   retinopathy_screenings        Perms: patient.view/update    imaging_images
   electrophysiology_tests       Slice 4: canonical attach     container: imaging-files
          │                             │                             │
          ▼                             ▼                             ▼
   Patient 360 Specialty         Patient 360 Clinical labs     Patient 360 Clinical imaging
   (scoped read endpoints)       + Documents Laboratory        + Imaging files metadata
                                 (attach/content)              (no canonical lab-style attach)
```

**Authoritative principles observed in code (not always enforced in UI):**

- Domain workflows own clinical/operational records.
- Patient 360 is a projection/discovery surface.
- Canonical documents are identity/storage, not clinical records.
- Generic Patient 360 upload → Laboratory is `writable: false` (does not fabricate LabReport).

---

## 5. Domain Inventory

| Domain | UI Route | UI State | Source Entity | DB Table | API | Create | Update | Complete | Upload | Review | Storage | Patient 360 Clinical | Patient 360 Documents | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Laboratory Management | `/dashboard/laboratory` | MOCK | none (local interfaces) | — | none called | DEAD button | — | — | — | — | — | N/A | N/A | MOCK / HARDCODED |
| LabReport clinical | Patient 360 Clinical → Laboratory (read-only table) | PARTIAL | `LabReport` | `lab_reports` (repaired; **0 rows**) | `/api/lab-reports` | API yes; UI no caller | API yes; UI no | API `/complete`; UI no | Attach on **Documents** only | `VerifiedByName` field only | canonical `patient-documents` | LIVE read path | LIVE attach/preview/download | PARTIAL + EMPTY DATA |
| LabReport documents | Patient 360 Documents → Laboratory | PARTIAL | association `lab`/`LabReport` | `canonical_documents` + associations | attach-report / report/content | attach only | — | — | yes | — | `CanonicalDocumentStorage.ContainerName` | clinical values separate | LIVE when labs ready | PARTIAL (Slice 4) |
| Imaging orders | Examination ImagingTab, widgets, counselling | PARTIAL LIVE | `ImagingOrder` | `imaging_orders` | `/api/Imaging` | `examination.create` | status `examination.update` | via status | `imaging.upload` → `imaging-files` | Reviewed status | blob `imaging-files` | Clinical imaging list | Documents imaging files (metadata) | YELLOW/GREEN |
| Imaging files P360 | Clinical + Documents Imaging | PARTIAL | `ImagingImage` | `imaging_images` | `GET .../patient-360/images` | — | — | — | — | — | source blob URLs not returned on P360 contract | metadata rows | metadata / limited actions | YELLOW |
| Fundus Diagnostic | `/dashboard/diagnostic/fundus-imaging` | MOCK | local `mockImages` | — | none | mock | mock | — | mock UI | mock grading | — | no | no | MOCK |
| Fundus Imaging form | `/dashboard/imaging/fundus` | PARTIAL/DEAD API | unknown | — | `examination.api` `/clinical/imaging/fundus-photography` | client exists | client exists | — | — | — | — | no | no | SOURCE GAP (no BE route found) |
| OCT Diagnostic list | `/dashboard/diagnostic/oct-imaging` | PARTIAL LIVE UI | `OctImagingScan` | `oct_imaging_scans` | `/api/OctImaging` | API JWT-only | API JWT-only | — | paths in DTO | — | `ImagePaths` strings | P360 OCT read | no file attach platform | YELLOW + SECURITY GAP |
| OCT Imaging form | `/dashboard/imaging/oct` | PARTIAL | same | same | `oct-imaging.api` | yes | yes | — | — | — | — | yes (context) | no | DUPLICATE route |
| Biometry | `/dashboard/diagnostic/biometry` | PARTIAL LIVE | `BiometryRecord` | `biometry_records` | `/api/Biometry` | JWT-only ops | JWT-only | — | — | — | — | P360 `CLINICAL:BIOMETRY:VIEW` | pointer/CCMS only | YELLOW + SECURITY GAP |
| Biometry detail | `/dashboard/diagnostic/biometry/[id]` | PARTIAL | same | same | same | — | — | — | — | — | — | yes | no | PARTIAL |
| Biometry new | `/dashboard/diagnostic/biometry/new` | DEAD ROUTE | — | — | — | button navigates; page missing | — | — | — | — | — | — | — | DEAD |
| Retinopathy Diagnostic | `/dashboard/diagnostic/retinopathy-screening` | PARTIAL LIVE | `RetinopathyScreening` | `retinopathy_screenings` | `/api/RetinopathyScreening` | mostly JWT-only | JWT-only | — | — | grading fields | — | P360 `CLINICAL:SCREENING:VIEW` | no | YELLOW + SECURITY GAP |
| Retinopathy Imaging | `/dashboard/imaging/retinopathy` | DUPLICATE | ? | ? | examination forms | — | — | — | — | — | — | — | — | DUPLICATE |
| Electrophysiology Diagnostic | `/dashboard/diagnostic/electrophysiology` | PARTIAL LIVE | `ElectrophysiologyTest` | `electrophysiology_tests` | `/api/Electrophysiology` | JWT-only | JWT-only | — | — | — | — | no dedicated P360 contract found | no | YELLOW + SECURITY GAP |
| Ultrasound Diagnostic | `/dashboard/diagnostic/ultrasound` | MOCK | `mockScans` | — | none | mock | mock | — | — | mock | — | no | no | MOCK |
| Anterior / Topography / Perimetry / Widefield | `/dashboard/imaging/*` | PARTIAL/FORM | examination.api clients | — | `/clinical/imaging/...` clients | FE only | FE only | — | — | — | — | no | no | SOURCE GAP (no BE matches) |
| Advanced imaging shell | `/imaging` | LEGACY/PARTIAL | ImagingController + viewers | imaging_* | imaging APIs | yes | yes | — | yes | viewers | imaging-files | limited | limited | LEGACY / PARTIAL |
| Counselor lab items | Counselling investigations | OUT OF SCOPE detail | `CounselorLabOrderItem` | `counselor_lab_order_items` | counselling domain | — | — | — | — | — | — | not LabReport | — | PARALLEL MODEL |
| SQL `lab_order` | sample/seed SQL only | LEGACY | no EF `LabOrder` entity | referenced in `migrations/*sample*` | none in AuthService | — | — | — | — | — | — | no | no | UNUSED/PARALLEL |

---

## 6. Laboratory Deep Audit

### 6.A Create / Order

| Question | Finding | Evidence |
|---|---|---|
| Does Order New Test call `POST /api/lab-reports`? | **No.** Button has no `onClick` / handler. | `apps/hospital-portal-web/src/app/dashboard/laboratory/page.tsx` lines ~236–239 |
| Does any FE call `labReportsApi.create`? | **No callers** outside the API module definition. | Grep across `apps/hospital-portal-web`: only `getByPatient`, `attachReport` used |
| Required fields on create? | Entity requires `TenantId`, `PatientId`, `TestName`, `Status` (default `"ordered"`), `Priority` (default `"routine"`). Controller stamps Id/Tenant/Created*. No server-side validation of allowed status values. | `LabReport.cs`, `LabReportsController.Create` |
| Patient selection real? | Not in Laboratory Management UI. Patient-scoped API exists. | `GET /api/lab-reports/patient/{patientId}` |
| Test / category / priority / specimen / visit / orderer? | Model fields exist (`TestName`, `TestCategory`, `Priority`, `SpecimenType`, `VisitId`, `OrderedById/Name`). **No catalog-backed UI.** Free-string categories. | `LabReport.cs` |
| Separate `lab_order` / `lab_order_item` SoT? | **No AuthService EF entity** for `lab_order`. SQL sample migrations insert into `lab_order`. Live UAT addendum reported `lab_order`/`lab_order_item` row counts 0/0 where present. Parallel: `counselor_lab_order_items`. | Grep `DbSet` / Table; `slice-4-laboratory-uat-blocker-addendum.md` |
| Does LabReport represent both order and result? | **Yes — single entity.** Order fields + result fields + status on one row. | `LabReport.cs` |
| Order → result lifecycle? | Intended via status string + `Complete` endpoint; **no enforced state machine** in controller. | `Complete` sets `Status = "completed"`; `Update` allows arbitrary `Status` |

### 6.B Result entry

| Field | Backend support | Operational UI |
|---|---|---|
| `resultValue` | Update + Complete | **None** in Laboratory Management; no form calling complete/update |
| `resultUnit` | Update + Complete | None |
| `referenceRange` | Update + Complete | None |
| `interpretation` | Update + Complete (comment: normal/abnormal/critical/high/low) | None |
| `notes` | Update only | None |
| Abnormal flag | No dedicated boolean; interpretation / UI mock used `isAbnormal` | Mock only on Laboratory page |
| Specimen | `SpecimenType`, `SampleCollectedAt` | None |
| Completion date | `CompletedAt` set on Complete | None |
| Reviewer/verifier | `VerifiedByName` string only — no verification workflow endpoint | None |
| Exact APIs | `PUT /api/lab-reports/{id}`, `POST /api/lab-reports/{id}/complete` | Client methods exist; **zero UI callers** |

### 6.C Status state machine

**Statuses found in entity comments / defaults (not DB CHECK enum):**

`ordered` (default), `sample_collected`, `in_progress`, `completed`, `cancelled`, `on_hold`

**UI mock statuses (different vocabulary):** `pending`, `in_progress`, `completed`, `cancelled`

| Concern | Finding |
|---|---|
| Valid transitions | **Not enforced** — Update accepts any string Status |
| Who can transition | `patient.update` only (Create/Update/Complete/Delete/Attach) |
| Complete required? | Optional helper; Update can also set completed fields |
| Edit after completion? | **Allowed** — Update does not block completed reports |
| Verification workflow? | **No** — only optional `VerifiedByName` |
| Abnormal special workflow? | **No** |
| Soft delete filter on reads? | **Handled by EF global query filter** — `AppDbContext` `LabReport` config: `HasQueryFilter(e => e.DeletedAt == null)` (controller queries inherit filter unless `IgnoreQueryFilters`) |
| UI-only statuses | Laboratory page `pending` ≠ API `ordered` |

### 6.D Document / report

| Topic | Finding | Evidence |
|---|---|---|
| `ReportUrl` | Free string on entity; Patient 360 maps only `http(s)` URLs for Open report; Slice 4 left unchanged | `mapLabReport` in `patient-360-clinical.ts`; Slice 4 D2 |
| Canonical attach | `POST /api/lab-reports/{id}/attach-report` — `patient.update`; does not change Status/results/ReportUrl | `LabReportsController`, `LabReportCanonicalDocumentService` |
| Content | `GET /api/lab-reports/{id}/report/content` — `patient.view`; association + tenant + patient checks | same |
| Storage | Canonical identity → `patient-documents` container via `ICanonicalDocumentIdentityService` | Slice 4 + service |
| Hash / duplicate | SHA-256; same bytes idempotent; different bytes → 409 `lab_report_attachment_exists` | service + Slice 4 |
| Replacement / delete attachment | **Not implemented** (Slice 4 out of scope) | Slice 4 scope |
| Laboratory Management use of attach | **None** — mock page | laboratory `page.tsx` |
| Patient 360 Documents | Preview/Download/Print for canonical; Open for http ReportUrl; Attach gated `patient.update` | `Patient360Documents.tsx` |
| Patient 360 All dedupe | Lab `canonicalDocumentId` participates | Slice 4 + documents tests |
| Generic Upload → Laboratory | `writable: false` | `patient-360-document-areas.ts` |

### 6.E Laboratory Management UI element audit (`/dashboard/laboratory`)

Evidence file: `apps/hospital-portal-web/src/app/dashboard/laboratory/page.tsx`

| UI element | Classification | Evidence |
|---|---|---|
| Pending Tests KPI | **MOCK** | Hardcoded `pendingTests: 5` in `loadLabData` with comment `// Simulated data - will be replaced with real API calls` |
| Completed Today KPI | **MOCK** | Hardcoded `12` |
| Abnormal Results KPI | **MOCK** | Hardcoded `2` |
| Avg Turnaround KPI | **MOCK** | Hardcoded `'4.5h'` |
| Abnormal alert banner | **MOCK** | Driven by hardcoded KPI |
| Search | **PARTIAL** | Filters local mock array only |
| Status filter | **PARTIAL / WRONG SOURCE** | Filters mock; values `pending` ≠ API `ordered` |
| Order New Test | **DEAD** | `<button>` with no handler |
| Lab Tests list | **MOCK** | Hardcoded 5 ophthalmology-style rows (Visual Field, IOP, OCT, Fundus, Topography) — not pathology LabReports |
| Results panel | **MOCK** | Embedded in hardcoded rows |
| View Report | **DEAD** | Button, no handler |
| Details | **DEAD** | Button, no handler |
| Test Catalog / Reports Archive / Analytics cards | **DEAD** | `cursor-pointer` divs, no navigation |
| Loading state | **PARTIAL** | Local only; always succeeds with mock |
| Permission denied / empty / error | **MISSING** | No `ProtectedRoute`; no API error honesty |
| `labReportsApi` usage | **NONE** | Page never imports API |

**Verdict:** Laboratory Management cannot be used by lab staff for a real workflow. It is a polished mock that mixes imaging-like tests into a pathology label.

---

## 7. Imaging Deep Audit

### 7.1 Authoritative imaging order path (GREEN/YELLOW)

| Capability | Status | Evidence |
|---|---|---|
| Create order | GREEN API | `ImagingController.CreateOrder` — `examination.create`; tenant from JWT |
| List by patient | GREEN | `GET patient/{patientId}` — `examination.view` |
| Status update | GREEN | `PATCH {id}/status` — `examination.update`; statuses Pending / In-Progress / Completed / Reviewed / Cancelled (entity comments) |
| Upload images | GREEN | `POST {orderId}/upload` — `imaging.upload`; container **`imaging-files`** |
| Patient 360 image metadata | YELLOW | `GET patient/{id}/patient-360/images` — metadata only, no storage paths |
| DICOM study id field | YELLOW | `ImagingOrder.DicomStudyId` nullable; not a full PACS integration |
| Viewer | YELLOW/PARTIAL | `/imaging` page with Cornerstone/DICOM components; not nav primary under Diagnostics |
| Soft delete images | YELLOW | `ImagingImage.DeletedAt` present |
| Branch column on orders | RED / DECISION | `ImagingOrder` has **no branch_id** — tenant + patient only |
| Cross-patient protection | YELLOW | Order scoped by tenantId; upload validates order belongs to tenant |

**Consumers (live-ish):** `components/examination/ImagingTab.tsx`, `ImagingOrderWidget`, counselling investigations, Patient 360 clinical imaging list.

### 7.2 Modality pages classification

| Source | Color | Why |
|---|---|---|
| `imaging_orders` / `ImagingController` | **GREEN** (API) / **YELLOW** (ops UX) | Real CRUD/upload; no dedicated Diagnostics worklist in sidebar |
| `imaging_images` + blob `imaging-files` | **GREEN** storage | Real upload path |
| Patient 360 imaging files | **YELLOW** | Metadata projection; document actions limited vs Lab Slice 4 |
| `/dashboard/diagnostic/fundus-imaging` | **RED** MOCK | `mockImages` array |
| `/dashboard/diagnostic/ultrasound` | **RED** MOCK | `mockScans` array |
| `/dashboard/diagnostic/oct-imaging` | **ORANGE** | Live OCT API UI; JWT-only BE; duplicate of `/dashboard/imaging/oct` |
| `/dashboard/imaging/fundus` etc. | **ORANGE/RED** | Forms call `examination.api` `/clinical/imaging/*` — **no matching AuthService routes found** |
| `/imaging` advanced shell | **ORANGE** | Feature-rich; not canonical Diagnostics nav entry |
| DICOM/PACS | **ORANGE** | Fields + viewers exist; not certified end-to-end PACS SoT |

Do **not** merge OCT specialty scans (`oct_imaging_scans`) with `imaging_orders`/`imaging_images` for convenience — separate sources.

---

## 8. Specialty Diagnostics Deep Audit

| Module | Entity / Table | Patient / Tenant / Branch | API | Permission (ops) | Permission (P360) | Create/Update | Result/Image | P360 Clinical | P360 Docs | UI | Security issues |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Biometry | `BiometryRecord` / `biometry_records` | patient_id, tenant_id, branch_id? | `/api/Biometry` | Most endpoints **JWT only** | `CLINICAL:BIOMETRY:VIEW` on patient-360 | Yes (service tenant-filtered) | Measurements/IOL; no canonical file platform | Yes (context mapper) | Not Lab-style; CCMS biometry_record pointer exists elsewhere | List LIVE; **New route missing** | Missing RequirePermission on CRUD; UI permission `CLINICAL:EXAMINATION:VIEW` vs nav `DIAGNOSTIC:BIOMETRY:VIEW` mismatch |
| OCT | `OctImagingScan` / `oct_imaging_scans` | tenant, patient, branch? | `/api/OctImaging` | **JWT only** all listed actions | `diagnostic.oct.read` (Patient360OctController) | Yes | `ImagePaths` JSON strings returned in DTOs | Yes | No | Diagnostic list LIVE | JWT-only; storage path exposure risk via ImagePaths |
| Retinopathy | `RetinopathyScreening` / `retinopathy_screenings` | tenant, patient, branch? | `/api/RetinopathyScreening` | Most JWT only; P360 gated | `CLINICAL:SCREENING:VIEW` | Yes | Grading fields; image/AI omitted from P360 mapper by design | Yes | No | LIVE list | JWT-only ops |
| Electrophysiology | `ElectrophysiologyTest` / `electrophysiology_tests` | tenant, patient | `/api/Electrophysiology` | **JWT only** | No dedicated P360 endpoint found | Yes | Test results in entity | **Missing P360 projection** | No | LIVE list | JWT-only; nav uses `DIAGNOSTIC:ELECTROPHYSIOLOGY:VIEW` on UI only |
| Ultrasound (Diagnostic page) | none | — | none | — | — | — | mock | no | no | MOCK | N/A |
| IOL inventory | pages under diagnostic/iol-inventory | inventory domain | inventory APIs | inventory perms | — | — | — | — | — | PARTIAL (adjacent) | Out of clinical result SoT |

**Permission inconsistency pattern:** Sidebar/nav codes (`DIAGNOSTIC:*`) often differ from backend `RequirePermission` codes (`CLINICAL:*`, `examination.*`, `diagnostic.oct.read`, or none).

---

## 9. Patient 360 Integration

### A. Clinical

| Source | Appears? | Content | Notes |
|---|---|---|---|
| Laboratory (`LabReport`) | Yes path (read-only table) | test name, status, result/unit, reference, ReportUrl (http only), canonical metadata | `loadPatient360Clinical` → `labReportsApi.getByPatient`; empty when 0 rows; unavailable if API fails. **No Attach on Clinical** |
| Imaging orders | Yes | type, status, laterality, ordered time | `imagingApi.getPatientOrders` |
| Imaging files | Yes (section) | file metadata via dedicated loader | not full clinical result |
| Biometry / Retinopathy / OCT | Yes (Specialty diagnostics section) | scoped context rows | separate loaders; honesty states empty/unauthorized/unavailable |
| Electrophysiology | **No** dedicated P360 clinical projection found | — | INTEGRATION GAP |
| Ultrasound specialty | No | — | MOCK only |

### B. Documents

| Area | Behavior |
|---|---|
| Laboratory | Lists LabReport rows from clinical bundle; **Attach Report** (patient.update), Preview / Download / Print when canonical present; Open http ReportUrl; generic upload **not writable**. This is the live attach surface (not `LabReportsTab`) |
| Imaging | Imaging file metadata listing; **writable: false** for generic upload; not Slice-4-style canonical attach to ImagingOrder |
| All | Dedupes by canonical document id where present (Lab attachments participate) |

### C. Incorrect mixing / risks

- Laboratory Management mock rows are **not** Patient 360 sources (good) but staff may believe the mock is real.
- Clinical Laboratory shows clinical values; Documents Laboratory shows files — separation is intentional (Slice 4 / UAT addendum).
- Empty `lab_reports` (0 rows) → Clinical/Documents Laboratory show **empty** (or unavailable if API errors). Prior missing-table state produced unavailable; repaired env should show empty until a real LabReport exists.

Patient 360 must **not** become the Diagnostics/Lab workbench (principle preserved in architecture; Laboratory Management still mock).

---

## 10. Document Architecture

| Source | File stored? | Where / Owner | Indexable? | Preview/Download/Print | Permission | Canonical association? | Byte reuse? | Fabricate clinical? | Domain still SoT? |
|---|---|---|---|---|---|---|---|---|---|
| LabReport attachment | Yes (when attached) | canonical `patient-documents` + association `lab`/`LabReport` | Yes via association | Yes via report/content | attach `patient.update`; content `patient.view` | Yes | Yes (hash identity) | Attach requires existing LabReport | Yes |
| LabReport `ReportUrl` | External/unknown | External URL string on LabReport | Metadata only | Open if http(s) | patient.view for row | No auto | N/A | No | Yes |
| Imaging images | Yes | blob container `imaging-files`; `ImagingImage.ImageUrl` | P360 metadata index | Not Lab-equivalent content API | `examination.view` / `imaging.upload` | No Lab-style canonical association found | Separate store | No | Yes — imaging domain |
| OCT ImagePaths | Path strings on scan | Unclear blob vs path | Risky | Unclear | JWT-only ops | No | Unknown | No | Specialty SoT |
| Biometry | Clinical numbers | DB row | Clinical only | N/A file | CLINICAL:BIOMETRY:VIEW (P360) | CCMS may attach pointer docs separately | N/A | Must not | Yes |
| Generic P360 Upload → Lab/Imaging | Blocked | — | — | — | — | — | — | Must not create LabReport/ImagingOrder | — |

**Do not** migrate imaging-files blobs into patient-documents without an explicit product decision.

---

## 11. Security / Authorization

| Issue | Severity | Evidence |
|---|---|---|
| Laboratory APIs use `patient.view` / `patient.update` only — not `laboratory.*` | DECISION REQUIRED / SECURITY GAP vs nav | `LabReportsController`; sidebar requires `laboratory.view` for mock page only |
| Soft-deleted LabReports | **Mitigated** — EF `HasQueryFilter(DeletedAt == null)` on `LabReport` | `AppDbContext.cs` LabReport config |
| Specialty CRUD (Biometry/OCT/Electrophysiology/Retinopathy ops) often **Authorize JWT-only** without `RequirePermission` | P0/P1 security | Controllers cited above |
| OCT/Biometry/Electrophysiology/Retinopathy operational DTOs may return storage path strings | SECURITY GAP | `ImagePaths` / `DataFilePath` / `ThumbnailPath` on specialty services |
| Imaging order APIs permissioned (`examination.*`, `imaging.upload`) | Better | ImagingController |
| Branch authorization for LabReport | **Absent** — no branch column | `LabReport.cs` |
| Branch for ImagingOrder | **Absent** | `ImagingOrder.cs` |
| Nav permission codes not equal to API codes | SECURITY/UX GAP | e.g. `DIAGNOSTIC:BIOMETRY:VIEW` vs `CLINICAL:BIOMETRY:VIEW` / JWT-only |
| `laboratory.view` | Referenced in FE nav; archive SQL has `laboratory.view_*` variants; **LabReportsController does not use it** | sidebar + archive SQL |
| Cross-tenant | Lab/Imaging list endpoints filter TenantId when implemented | Lab Get*; Imaging Get* |
| Patient isolation | Lab queries by patientId + tenant; attach checks patient on document | services |
| Lab soft-delete | EF global filter applies | Confirm no `IgnoreQueryFilters` on lab content paths |

Where existing permissions are insufficient for lab-tech role separation: **DECISION REQUIRED** — do not invent new codes in this audit.

---

## 12. Database / Data Integrity

| Table | Migration / model | Live existence (prior UAT) | Notes |
|---|---|---|---|
| `lab_reports` | EF `20260218163249_AddExaminationDraftsAndClinicalExaminationFields` + snapshot | **Present after 2026-10-07 drift repair; 0 rows** (UAT addendum §10) | Empty SoT — blocks attach/UAT |
| `lab_order` / `lab_order_item` | SQL sample migrations; **no EF LabOrder** | 0/0 rows where checked | Unused parallel model |
| `counselor_lab_order_items` | EF present | Exists | Counsellor domain — not LabReport SoT |
| `imaging_orders` | EF + SQL migrations | Assumed present with imaging feature | Has tenant, patient; no branch |
| `imaging_images` | EF Module3 / schema 36 | Present in model | Soft delete column |
| `biometry_records` | EF model | Model present | Tenant + branch |
| `oct_imaging_scans` | EF | Model present | |
| `retinopathy_screenings` | EF | Model present | |
| `electrophysiology_tests` | EF | Model present | |
| `canonical_documents` / `canonical_document_associations` | Canonical platform | Present (UAT addendum) | Lab associations only when LabReport exists |
| Soft delete LabReport | Column exists | Reads ignore it | Integrity gap |
| Indexes LabReport | tenant+patient, status, patient | Migration creates | |

**This audit did not repair drift.** Applying `lab_reports` migration is a future approved action.

---

## 13. Mock / Legacy / Duplicate Inventory

| Item | Location | Evidence | Usage | Retain for now? |
|---|---|---|---|---|
| Laboratory Management mock | `dashboard/laboratory/page.tsx` | Simulated data comment + hardcoded arrays | Sidebar live entry | Untouched until Lab slice; misleading |
| Fundus Diagnostic mock | `diagnostic/fundus-imaging/page.tsx` | `mockImages` | Sidebar “Scan / Imaging” landing | Untouched; misleading |
| Ultrasound mock | `diagnostic/ultrasound/page.tsx` | `mockScans` | Direct route | Untouched |
| Dead Order/View/Details buttons | laboratory page | no handlers | — | — |
| Dead Biometry `/new` | router push without page | Glob 0 `**/biometry/new/**` | Button present | — |
| Duplicate imaging trees | `/dashboard/diagnostic/*` vs `/dashboard/imaging/*` vs `/imaging` | three trees | Fragmented | DECISION on canonical nav |
| `examination.api` clinical imaging clients | `examination.api.ts` | `/clinical/imaging/...` | Forms under `/dashboard/imaging/*` | SOURCE GAP — no BE |
| `labReportsApi.create/complete/update/delete` | `lab-reports.api.ts` | defined; no callers for create/complete/update | Dead clients relative to ops UI | Keep API; wire later |
| Orphan `LabReportsTab` | Only `PatientRecordTabContent` (`lab_results`); **not** mounted in live Patient 360 Clinical (Clinical = read-only table; Attach = Documents) | `Patient360Clinical.tsx`; `LabReportsTab.test.tsx` asserts Clinical has no LabReportsTab | Dead dual UI | Retain until cleanup decision |
| Orphan `lab.api.ts` | `src/lib/api/lab.api.ts` → `/lab/orders`, `/lab/metrics`, verify/release, etc. | **No AuthService controller; zero FE importers** | Dead client | Untouched |
| Lab role default route | `DashboardRouter.tsx`: `'Lab Technician' → '/dashboard/laboratory'` | Lands on **MOCK** workbench | Misleading | DECISION |
| Counselor pre-op lab orders | `lab-orders.api.ts` → `PreOpTestManagement` → `counselor_lab_order_items` | LIVE counselling path; **not** LabReport SoT | Parallel | Do not merge without decision |
| Imaging image DELETE | FE may call delete; soft-delete column exists; controller delete gap per imaging audit | Incomplete | — | DECISION |
| Perimetry / ultrasound mocks | `/dashboard/imaging/perimetry`, `/dashboard/diagnostic/ultrasound` | Hardcoded patients/scans | Misleading | Untouched until modality decision |
| SQL `lab_order` samples | `migrations/05_*`, `14_*`, `17_*` | INSERT samples | Not AuthService SoT | Untouched |
| Archive laboratory.view_* permissions | `archive/sql/*rbac*` | historical | Unclear live seed | DECISION |
| Blood Bank nav → ambulance | sidebar | wrong href | Out of scope quirk | Note only |
| Widgets LabResults / AlertBanner / Timeline | patient components | call getByPatient | Projection consumers | Retain |

---

## 14. End-to-End Workflow Maps

### Laboratory

| Step | Status |
|---|---|
| Patient identity | GREEN (MPI/patient) |
| Order (staff workbench) | **RED** MOCK / DEAD |
| Order (API) | YELLOW — exists; unused by Lab UI |
| Lab processing worklist | **RED** |
| Result entry UI | **RED** |
| Result entry API | YELLOW |
| Review/verification | **RED** / GRAY (field only) |
| Complete API | YELLOW |
| Attach report | YELLOW/GREEN code; **ORANGE** blocked by missing table/data |
| Clinical reflection | ORANGE (path exists; 0 rows) |
| Documents reflection | ORANGE (attach ready; needs existing LabReport) |
| Downstream | GRAY |

### Imaging

| Step | Status |
|---|---|
| Patient | GREEN |
| Imaging order | YELLOW/GREEN (API + some UI) |
| Scheduling | GRAY / missing dedicated |
| Capture/upload | YELLOW/GREEN (`imaging.upload`) |
| Result/report summary | YELLOW (`ResultSummary`, Reviewed) |
| Review | YELLOW |
| Clinical P360 | YELLOW |
| Viewer | YELLOW (`/imaging`) |
| Documents | ORANGE (metadata; no Lab-parity canonical attach) |
| Modality mock pages | **RED** misleading |

### Specialty Diagnostics

| Step | Status |
|---|---|
| Patient | GREEN |
| Request/create | YELLOW (API; JWT-only; Biometry new dead) |
| Measurement | YELLOW (entities) |
| Result/calculation | YELLOW (Biometry/OCT/Retinopathy) |
| Review | ORANGE |
| Clinical P360 | YELLOW (Biometry/OCT/Retinopathy); Electrophysiology **RED** |
| Source workspace | YELLOW |
| Documents | ORANGE/GRAY |

---

## 15. UX / Operational Assessment

- **IA:** Sidebar collapses three different realities (mock imaging landing, partial biometry, mock laboratory) under one “Diagnostics & Lab” heading.
- **Terminology:** “Laboratory (Pathology)” shows ophthalmology mock tests — clinically misleading.
- **Patient selection:** Absent on Laboratory Management; present on some specialty/imaging forms.
- **Workflow clarity:** No visible order → in-progress → verified → completed path for labs.
- **Result entry / review:** Not operational in Lab Management.
- **Error/empty/permission honesty:** Patient 360 has honesty states; Laboratory Management does not.
- **Mock UI risk:** High — staff can believe KPIs/rows are live.
- **Could lab staff run the entire workflow on `/dashboard/laboratory` today?** **No.**

---

## 16. Healthcare Capability Assessment

| Concept | Supported? | Notes |
|---|---|---|
| Patient identity | Yes | PatientId on entities |
| Order/request | Partial | LabReport-as-order; ImagingOrder; no pathology order entity in EF |
| Specimen | Partial fields | No accessioning workflow |
| Result | Partial API | No ops UI |
| Reference range | Field only | Free text |
| Abnormal interpretation | Field only | No critical alert workflow |
| Verification/review | Name field / imaging Reviewed | Potential capability gap — product decision required |
| Report file | Slice 4 canonical for Lab | Imaging separate |
| Modality / study / image | Imaging + specialty | Fragmented |
| Clinical provenance | Partial timestamps/user ids | Incomplete verification |
| Auditability | Partial | Imaging access audit services exist; Lab attach not full clinical audit trail productized |
| Status lifecycle | Soft strings | Potential capability gap — product decision required |
| Source ownership | Intended | Violated only by mock confusion |
| Access control | Uneven | Specialty JWT-only = gap |
| Patient-level security | Partial | Soft-delete Lab gap |

Standards (FHIR/DICOM/HL7): **not** recommended for automatic implementation. Flag only: “Potential capability gap — product decision required” where local rules are missing.

---

## 17. Master Gap Matrix

| Capability | Source of Truth | Current UI | Current API | DB/Storage | Permission | P360 Clinical | P360 Documents | Status | Gap | Recommendation | Decision Required |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Lab order create | LabReport (intended) | MOCK dead | POST exists | lab_reports drift | patient.update | read only | — | RED/YELLOW | No workbench | Wire Lab Management to API after schema | Yes — workbench authority |
| Lab result entry | LabReport | none | PUT/Complete | same | patient.update | shows values | — | RED | No UI | Build result UI on SoT | Yes — post-complete edit |
| Lab verification | VerifiedByName only | none | none dedicated | — | — | — | — | RED | No workflow | Decide if required | Yes |
| Lab report file | Canonical assoc | P360 Docs | attach/content | patient-documents | patient.update/view | metadata | actions | YELLOW | Schema/data block | Keep Slice 4; fix table | Yes — attach timing |
| Lab Management KPIs | none | MOCK | none | — | laboratory.view (nav only) | — | — | MOCK | Misleading | Replace or banner “non-production” | Yes |
| Imaging order | ImagingOrder | exam/widgets | ImagingController | imaging_orders | examination.* | yes | limited | YELLOW | No Diagnostics worklist | Optional imaging worklist — not duplicate | Yes — nav SoT |
| Imaging upload | ImagingImage | partial | upload | imaging-files | imaging.upload | metadata | metadata | YELLOW | Docs parity undecided | Keep source-owned | Yes — P360 docs for imaging? |
| Fundus diagnostic page | none | MOCK | none | — | DIAGNOSTIC:IMAGING:VIEW | no | no | MOCK | Fake clinical | Replace with ImagingOrder modality or retire | Yes |
| Biometry ops | BiometryRecord | partial | JWT CRUD | biometry_records | inconsistent | yes | pointer only | YELLOW | Authz + /new dead | Harden perms; fix route | Yes |
| OCT ops | OctImagingScan | partial | JWT CRUD | oct_imaging_scans | JWT / diagnostic.oct.read P360 | yes | no | YELLOW | Path exposure; dup routes | Harden; choose canonical UI | Yes |
| Retinopathy | RetinopathyScreening | partial | mostly JWT | retinopathy_screenings | CLINICAL:SCREENING:VIEW P360 | yes | no | YELLOW | Authz | Harden | Yes |
| Electrophysiology | ElectrophysiologyTest | partial | JWT | electrophysiology_tests | UI DIAGNOSTIC:* only | **missing** | no | YELLOW/RED | No P360 | Decide projection | Yes |
| Ultrasound specialty | none | MOCK | none | — | — | no | no | MOCK | No SoT | Decide modality home | Yes |
| clinical/imaging FE clients | unknown | forms | **no BE found** | — | view:fundus_* style | no | no | SOURCE GAP | Dead integration | Retire or implement BE | Yes |
| lab_order SQL | unclear | none | none | orphan | — | no | no | LEGACY | Parallel model | Do not revive without decision | Yes — authoritative model |
| Schema lab_reports | EF | — | OK after repair | present, 0 rows | — | empty | empty | DATA GAP | No clinical rows | First real create path | Yes — UAT data policy |
| Orphan lab.api.ts | none | none | no BE | — | — | — | — | DEAD | Parallel fake API surface | Do not wire without decision | Yes — D-LAB-13 |

---

## 18. Priority Classification

### P0 — Safety / security / data integrity

1. Specialty diagnostic CRUD endpoints JWT-only (tenant may exist in service, but permission model bypassed); operational DTOs may expose storage paths.
2. Lab Technician / Lab Manager default route lands on **mock** `/dashboard/laboratory` (`DashboardRouter.tsx`).
3. Mock Laboratory / Fundus / Ultrasound / Perimetry pages presenting fabricated clinical-looking data in production nav.
4. ~~Soft-deleted LabReports readable~~ — **corrected:** EF `HasQueryFilter` on `LabReport` filters `DeletedAt` (not a P0).

### P1 — Core operational workflow missing

1. No Laboratory Management workbench wired to LabReport.
2. No FE callers for create/complete/result entry.
3. Lab status vocabulary mismatch (UI vs API).
4. Biometry “New” dead route.

### P2 — Important integration gaps

1. Imaging Documents canonical parity undecided.
2. Electrophysiology missing P360 clinical projection.
3. Duplicate diagnostic vs imaging route trees.
4. `examination.api` clinical imaging clients without backend.
5. Branch rules absent on LabReport/ImagingOrder.

### P3 — UX / quality

1. KPI/analytics cards dead.
2. Permission code naming inconsistency across nav vs API.
3. Loading/empty/permission states on Lab Management.
4. Misleading ophthalmology tests under Pathology label.

### P4 — Future enhancement

1. Full verification state machine / critical-result escalation.
2. Specimen accessioning / analyzer integration.
3. FHIR/DICOM/HL7 standardization.
4. PACS deep integration.
5. Replacement/versioning of lab attachments.

---

## 19. Product Decision Register

| ID | Decision | Why it matters | Audit answer |
|---|---|---|---|
| D-LAB-01 | Is Laboratory Management the authoritative operational workbench for LabReport? | Avoids P360 becoming workbench | **DECISION REQUIRED** |
| D-LAB-02 | Does Order New Test create LabReport directly, or introduce/revive `lab_order`? | Parallel models exist | **DECISION REQUIRED** |
| D-LAB-03 | Can results be edited after completion? | API currently allows | **DECISION REQUIRED** |
| D-LAB-04 | Is verification required before clinical release? | Only name field today | **DECISION REQUIRED** |
| D-LAB-05 | When can a report be attached (any status vs completed only)? | Slice 4 allows any existing LabReport | **DECISION REQUIRED** |
| D-LAB-06 | Can attachment exist before completion? | Currently yes | **DECISION REQUIRED** |
| D-LAB-07 | One vs many report files per LabReport? | Slice 4 = one active | Confirm retain |
| D-LAB-08 | Replacement/versioning of attachments? | Currently 409 on different bytes | **DECISION REQUIRED** |
| D-LAB-09 | Permissions for laboratory staff vs `patient.update`? | Nav `laboratory.view` unused by API | **DECISION REQUIRED** — do not invent silently |
| D-LAB-10 | Permissions for viewing clinical results vs file content? | Both use patient.view today | **DECISION REQUIRED** |
| D-LAB-11 | Status vocabulary: adopt API set or UI set? | ordered vs pending | **DECISION REQUIRED** |
| D-IMG-01 | Canonical Diagnostics nav entry for imaging worklist? | Sidebar lands on mock Fundus | **DECISION REQUIRED** |
| D-IMG-02 | Should Imaging files appear in Patient 360 Documents with content actions? | Metadata only today | **DECISION REQUIRED** |
| D-IMG-03 | Which modalities are safe to expose in P360? | Mixed mock/live | **DECISION REQUIRED** |
| D-IMG-04 | Relationship between ImagingOrder and specialty OCT/Biometry tables? | Duplicate clinical events risk | **DECISION REQUIRED** |
| D-IMG-05 | Retire `/clinical/imaging/*` FE clients or build BE? | SOURCE GAP | **DECISION REQUIRED** |
| D-SPEC-01 | Branch rule when branch_id null? | Biometry has column; Lab/ImagingOrder lack | **DECISION REQUIRED** |
| D-SPEC-02 | Separate document integrations per specialty? | Only Lab Slice 4 today | **DECISION REQUIRED** |
| D-SPEC-03 | Electrophysiology in Patient 360 Clinical? | Missing | **DECISION REQUIRED** |
| D-SPEC-04 | Authoritative UI tree: `/diagnostic/*` vs `/imaging/*` vs `/imaging`? | Triplicate | **DECISION REQUIRED** |
| D-SPEC-05 | RequirePermission codes for specialty CRUD? | JWT-only | **DECISION REQUIRED** (map to existing codes) |
| D-DATA-01 | Confirm `lab_reports` present in all target envs; approve how first real LabReport is created for UAT (ops UI vs controlled create — **not** fake seed without approval)? | Empty table blocks attach UAT | **DECISION REQUIRED** |
| D-DATA-02 | Fate of SQL `lab_order` model? | Unused parallel | **DECISION REQUIRED** |
| D-SEC-01 | Soft-delete LabReport reads | EF `HasQueryFilter` already present | **Resolved as existing capability** — no change required unless `IgnoreQueryFilters` paths appear |
| D-UX-01 | Production banner / hide mock Diagnostics pages until live? | Misleading staff | **DECISION REQUIRED** |
| D-LAB-12 | Lab Technician default landing: keep mock, redirect, or replace first? | `DashboardRouter` → mock | **DECISION REQUIRED** |
| D-LAB-13 | Fate of orphan `lab.api.ts` `/lab/*` client vs LabReport API? | Dead parallel vocabulary | **DECISION REQUIRED** |
| D-LAB-14 | Relationship of counselor `lab-orders` / PreOp to LabReport workbench? | Parallel SoT | **DECISION REQUIRED** |

**Product decisions required (count): 27** (D-SEC-01 closed as existing; +D-LAB-12/13/14)

---

## 20. Recommended Target Architecture (RECOMMENDATION ONLY — NOT IMPLEMENTED)

Preserve existing SoT entities, certified APIs, safe permissions, canonical document platform, and Patient 360 as projection.

### Laboratory

```text
Laboratory Management (ops workbench)
    → LabReport (order + result lifecycle; enforced transitions per product rules)
    → Clinical values on LabReport
    → Canonical report attachment (Slice 4; domain=lab, entity=LabReport)
    → Patient 360 Clinical (projection of values)
    → Patient 360 Documents (projection of attachment + http ReportUrl)
```

- Do **not** make P360 the order/result workbench.
- Do **not** revive `lab_order` unless product chooses it as SoT over LabReport.
- Do **not** fabricate LabReport from generic upload.

### Imaging

```text
Imaging workspace (single canonical nav)
    → ImagingOrder + ImagingImage
    → clinical metadata / ResultSummary / Reviewed
    → imaging viewer (existing)
    → Patient 360 Clinical + imaging file metadata
    → Documents integration only if justified (prefer source-owned content API, not byte duplication)
```

- Keep specialty measurement tables separate unless a formal merge decision exists.

### Specialty Diagnostics

```text
Specialty workspace (Biometry / OCT / Retinopathy / Electrophysiology)
    → authoritative specialty record
    → Patient 360 clinical context endpoints (already patterned)
    → document projection only where legitimate source files exist
```

- Harden to existing permission codes; stop JWT-only PHI APIs.

---

## 21. Recommended Implementation Roadmap (NOT STARTED)

Derived from audit — not assumed from generic A–F labels.

### Slice L0 — Data integrity & honesty (prerequisite)

- **Objective:** Make Laboratory truthful.
- **Scope:** Confirm `lab_reports` present in all target envs (drift already repaired in one env with 0 rows); create real LabReport only via approved workflow (not fake seed); optional mock-page honesty banner / stop Lab-role default to mock; do **not** invent clinical rows for UAT without product approval.
- **Dependencies:** D-DATA-01, D-UX-01; Lab role routing decision.
- **Out of scope:** Full Lab Management rebuild; imaging; fabricating LabReport seeds unless explicitly approved.
- **SoT:** LabReport + migrations.
- **APIs:** existing LabReportsController.
- **Permissions:** unchanged unless D-LAB-09 decides.
- **Tests:** table presence; empty vs unavailable honesty; assert mock Management has no live API.
- **UAT:** table exists; empty Clinical/Documents Laboratory honest; mock not claiming live counts.
- **Gate:** No fabricated rows; no silent mock-as-live.

### Slice L1 — Laboratory Management foundation

- **Objective:** Live worklist + Order New Test → POST LabReport.
- **Scope:** Replace mock list/KPIs with API; patient-linked order; status filter aligned to API vocabulary.
- **Dependencies:** L0; D-LAB-01/02/11/09.
- **Out of scope:** Verification workflow; attachment UX on Management (optional later).
- **Reuse:** `labReportsApi`, LabReportsController.
- **Gate:** Real create visible in P360 Clinical without duplicate entities.

### Slice L2 — Result workflow

- **Objective:** Enter results + Complete with rules from D-LAB-03/04.
- **Scope:** Result form; Complete; interpretation; block/allow edit rules.
- **Out of scope:** Analyzer interfaces.
- **Gate:** Completed result appears in P360 Clinical; permissions enforced.

### Slice L3 — Lab report document ops on workbench (optional)

- **Objective:** Allow attach/preview from Management using Slice 4 APIs.
- **Dependencies:** L1/L2; D-LAB-05/06/08.
- **Reuse only** existing attach/content — no second store.

### Slice I1 — Imaging operational consolidation

- **Objective:** Single imaging worklist over ImagingOrder; stop landing on mock Fundus.
- **Dependencies:** D-IMG-01/04/05.
- **Out of scope:** Full PACS; specialty table merge.

### Slice I2 — Imaging Patient 360 document policy

- **Objective:** Implement only the decided document/content policy for imaging-files.
- **Dependencies:** D-IMG-02/03.

### Slice S1 — Specialty authz + P360 normalization

- **Objective:** RequirePermission on specialty CRUD using **existing** codes; add Electrophysiology P360 if D-SPEC-03 yes; fix Biometry `/new`.
- **Dependencies:** D-SPEC-*.
- **Out of scope:** New document platforms per specialty unless decided.

Each slice needs: exact scope, dependencies, out-of-scope, SoT, APIs reused, permissions, storage, tests, UAT, acceptance gate — filled at planning time after decisions.

---

## 22. Test Gap Analysis

| Area | Current coverage | Gap |
|---|---|---|
| Lab create/update/complete | Backend entity/API exist; limited FE callers tests | No E2E order→complete→P360 |
| Lab attach/content | `LabReportCanonicalDocumentTests`; FE string/mount tests post-UAT | Can pass while `lab_reports` missing in live DB |
| Lab Management UI | Explicitly asserts mock page lacks attach (Slice 4 tests) | No test that Management is non-mock / API-wired |
| Permissions Lab | patient.view/update on controller tests | No laboratory.* role matrix; Lab role → mock route untested as honesty failure |
| Patient isolation / tenant | Partial in controller patterns | Soft-delete + cross-patient attach edge cases |
| Imaging upload/order | Some e2e `imaging-workflow.spec.ts` | Not tied to Diagnostics sidebar honesty |
| Specialty P360 | Dedicated read permission tests (Biometry/OCT/Imaging files) | Ops JWT-only not failing closed |
| Mock-vs-live | Weak | **Critical:** tests can pass while UI unreachable or mock |
| Empty/unauthorized/unavailable | Stronger on Patient 360 | Absent on Laboratory Management |
| Cross-module reflection | Limited | Order in Management → Clinical → Documents → All dedupe |

---

## 23. Manual UAT Plan (DO NOT EXECUTE IN THIS AUDIT)

### Laboratory (future)

1. Find patient.  
2. Order a real test (post-L1).  
3. Verify LabReport row in DB/API.  
4. Open test in Management.  
5. Enter result.  
6. Save/Complete.  
7. Verify Patient 360 Clinical → Laboratory.  
8. Attach report (Slice 4).  
9. Verify Management (if wired) + Documents → Laboratory.  
10. Preview / Download / Print.  
11. Verify All-tab dedupe.  
12. Status lifecycle per decided rules.  
13. Permissions positive/negative.  
14. Duplicate attachment same/different bytes.  
15. Confirm no second LabReport from attach or generic upload.  
16. Soft-delete not visible.  
17. Confirm mock page not used as evidence of completion.

### Imaging (future)

Create/order → upload → status/review → viewer → P360 clinical/files → content policy → permissions → cross-patient isolation.

### Specialty (future)

Per live module only (Biometry/OCT/Retinopathy/Electrophysiology): create → view → P360 context → authz denial → no fabricated documents.

---

## 24. Explicit Out-of-Scope

- Blood Bank, Pharmacy, Billing, CCMS claim ops, Counsellor product redesign, IP/OT, Surgery, ownership allocation  
- Implementing FHIR/DICOM/HL7  
- Repairing schema drift during this audit  
- Replacing mock pages during this audit  
- Creating seed LabReport rows  
- Starting next implementation slice  

---

## 25. Final Audit Verdict

Hospital Portal Diagnostics & Laboratory is **not production-ready as an end-to-end professional workflow**.  

- Laboratory Management is a **mock**; Lab Technician default routing lands there.
- LabReport APIs and Slice 4 document attachment are **real but incomplete as an operational system**, and are **blocked by empty `lab_reports` (0 rows)** after drift repair — not by a missing table in the repaired environment.
- Patient 360 Clinical Laboratory is **read-only**; Attach Report lives on **Documents → Laboratory**. `LabReportsTab` remains an orphan legacy path.
- Imaging has the strongest operational backend (`ImagingOrder`/`ImagingImage`), but Diagnostics navigation and several modality pages are **mock, duplicate, or backend-missing**.
- Specialty modules have entities and partial UIs with **serious authorization inconsistencies** (JWT-only CRUD; path exposure on ops DTOs).
- Patient 360 is correctly positioned as a projection, but cannot compensate for missing operational workbenches or empty clinical data.
- Orphan FE client `lab.api.ts` (`/lab/*`) must not be mistaken for the LabReport SoT.

---

AUDIT: COMPLETE

LABORATORY: MOCK UI + PARTIAL API + EMPTY lab_reports (NOT OPERATIONAL E2E)

IMAGING: PARTIAL (ORDERS/UPLOAD GREEN-ISH; MODALITY UX FRAGMENTED/MOCK)

SPECIALTY DIAGNOSTICS: PARTIAL (ENTITIES/APIs EXIST; AUTHZ + P360 INCOMPLETE; SOME MOCK)

CORE WORKFLOW STATUS: NOT OPERATIONAL END-TO-END

PATIENT 360 INTEGRATION: PARTIAL (PROJECTION PATHS EXIST; LAB BLOCKED BY EMPTY DATA)

DOCUMENT INTEGRATION: PARTIAL (SLICE 4 LAB ATTACH CERTIFIED IN CODE; IMAGING NOT PARITY)

SECURITY STATUS: GAPS PRESENT (JWT-ONLY SPECIALTY; PATH EXPOSURE ON OPS DTOs; PERMISSION MISMATCH)

DATA / SCHEMA STATUS: lab_reports PRESENT AFTER REPAIR — 0 ROWS (NO CLINICAL DATA)

PRODUCT DECISIONS REQUIRED: 27

IMPLEMENTATION: NOT STARTED

AUTOMATED TESTS: NOT RUN FOR IMPLEMENTATION — AUDIT ONLY

MANUAL UAT: NOT STARTED

ACCEPTANCE: NOT CLAIMED

NEXT SLICE: NOT STARTED

STOP.
