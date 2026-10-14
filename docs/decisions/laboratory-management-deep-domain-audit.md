# Laboratory Management — Deep Domain / Architecture Audit

**Date:** 2026-10-07  
**Type:** READ-ONLY DOMAIN / ARCHITECTURE AUDIT  
**Status:** COMPLETE — NO IMPLEMENTATION  
**Baseline docs:**
- [diagnostics-laboratory-complete-gap-analysis.md](./diagnostics-laboratory-complete-gap-analysis.md)
- [diagnostics-laboratory-product-definition.md](./diagnostics-laboratory-product-definition.md) (product owner ratification)
- [slice-4-laboratory-document-implementation.md](./slice-4-laboratory-document-implementation.md)
- [slice-4-laboratory-uat-blocker-addendum.md](./slice-4-laboratory-uat-blocker-addendum.md)

```text
AUDIT: COMPLETE
IMPLEMENTATION: NOT STARTED
PRODUCT DECISIONS: REQUIRED
MANUAL UAT: PAUSED
NEXT GATE: PRODUCT OWNER REVIEW
```

---

## 1. Executive Summary

Current Laboratory Management (L0 honesty + L1 worklist/order create) is **not** an acceptable production-grade hospital laboratory system. It is a **partial prototype / thin ops shell** over a flat `LabReport` row: patient search, free-text test name, optional code/category/priority/specimen, free-text ordering clinician, and notes — plus list filters. It does **not** provide catalog-driven ordering, specimen accessioning, multi-analyte results, verification, internal/external lab routing, structured interoperability, or regulated quality workflows.

| Layer | Current reality | Classification |
|---|---|---|
| `/dashboard/laboratory` L1 UI | Real workbench over `labReportsApi` (list + create); no collection/result/verify/release UX | **Partial prototype — not production-ready** |
| `LabReport` / `lab_reports` | Authoritative flat order+result entity (ratified D-LAB-01/02) | **GREEN SoT root — clinically thin** |
| Slice 4 canonical attach | PDF/report file via `domain=lab` / `entityType=LabReport` | **GREEN document path** |
| `LabTestCatalog` / `lab_test_catalog` | Counsellor/pre-op price list; not pathology dictionary | **YELLOW — not clinically authoritative** |
| SQL `lab_order` / `lab_order_item` / FE `lab.api.ts` | Orphan / no EF / no BE | **RED — do not revive** |
| Specimen / Observation children / External lab | Absent as domain entities | **RED gaps** |
| Communications / HL7 / FHIR | Platform channels exist; Lab does not own or use them | **YELLOW reuse / RED lab integration** |

**HTTP 405 on `GET /api/lab-reports`:** Root cause is ASP.NET Core method mismatch — the frontend issues **GET** on the collection route while the **committed** AuthService registers only **POST** Create on that template. Authorization does not produce 405. See §2.

**Bottom line:** Keep `LabReport` as the operational root per ratification, but treat the intended hospital LIS as a **major domain expansion** requiring product decisions (catalog SoT, specimen model, observation children, performing laboratory, verification/release, external send-out, communications). Do **not** start another implementation slice until product owner review of this audit.

---

## 2. Current Runtime 405 Root Cause

### 2.1 Observed symptom

| Item | Value |
|---|---|
| UI | `/dashboard/laboratory` → `LaboratoryWorkbench` |
| User-visible error | “Unable to load laboratory orders” |
| Browser request | `GET /api/lab-reports` (with optional `status`, `priority`, `search`, `take`) |
| Reported response | **HTTP 405 Method Not Allowed** |

### 2.2 Complete runtime path (verified)

```text
Browser (/dashboard/laboratory)
  → LaboratoryWorkbench.tsx
      labReportsApi.list({ status, priority, search, take: 100 })
  → lab-reports.api.ts
      api.get(`/lab-reports${query}`)          // HTTP GET
  → apps/hospital-portal-web/src/lib/api.ts
      baseURL = NEXT_PUBLIC_API_URL
        || 'http://localhost:5000/api'
  → .env.local
      NEXT_PUBLIC_API_URL=http://localhost:5073/api
  → Absolute URL
      GET http://localhost:5073/api/lab-reports?...
  → No Next.js rewrite / middleware proxy
      (next.config.js redirects only; no API rewrites)
  → AuthService Kestrel :5073
      launchSettings http profile: http://localhost:5073
      Program.cs: MapControllers()
  → LabReportsController [Route("api/lab-reports")] [Authorize]
  → Method selection on collection template
```

### 2.3 Endpoint registration evidence

**Committed HEAD** (`LabReportsController` at commit baseline):

| Verb | Template | Action |
|---|---|---|
| GET | `api/lab-reports/patient/{patientId}` | GetByPatient |
| GET | `api/lab-reports/{id}` | GetById |
| **POST** | **`api/lab-reports`** | **Create** |
| PUT | `api/lab-reports/{id}` | Update |
| POST | `api/lab-reports/{id}/complete` | Complete |
| DELETE | `api/lab-reports/{id}` | Delete |

**There is no `[HttpGet]` on the bare collection route in HEAD.**

**Working tree (uncommitted at audit time):** adds `[HttpGet] List` on `api/lab-reports` (plus Slice 4 `attach-report` / `report/content` already present in WT). Frontend `labReportsApi.list` and `LaboratoryWorkbench` are also working-tree / untracked L1 surfaces.

### 2.4 Exact root cause

**ASP.NET Core HTTP method mismatch on a matched controller route.**

1. Frontend calls **GET** `http://localhost:5073/api/lab-reports?...`.
2. On committed AuthService, the collection path `api/lab-reports` is registered only for **POST** (`Create`).
3. The framework matches the controller/route but finds **no GET action** → returns **405 Method Not Allowed** (Allow typically advertises `POST`).
4. This is **not** an authorization failure. `[RequirePermission]` / `[Authorize]` yield **401/403**. `CheckInValidationMiddleware` does not gate hyphenated `/api/lab-reports` GETs and would not emit 405.
5. Orphan `lab.api.ts` (`/lab/*`) is **not** on this path.
6. No YARP/API gateway sits between FE and AuthService for this call.

### 2.5 Process / deploy nuance (verified this session)

| Check | Result |
|---|---|
| AuthService listening | PID 8932 on `127.0.0.1:5073` / `[::1]:5073` |
| Launch | `dotnet run --no-build --project AuthService.csproj` → `bin\Debug\net8.0\AuthService.exe` |
| Unauthenticated GET this session | **400** `{"message":"Tenant ID is required"}` — routing accepted GET (List present in **currently running binary**) |
| HEAD source without rebuild | Would 405 GET collection |

**Interpretation:** The 405 the user observed is the correct failure mode when FE L1 (GET list) runs against an AuthService build that **does not** include `[HttpGet] List` (HEAD or stale binary). A later local rebuild can make GET reach tenant/auth middleware (400/401) even while the List addition remains **uncommitted**. Tests against a rebuilt process can therefore diverge from HEAD/runtime used when 405 was seen.

**Authorization cannot produce 405.** Method routing differs between HEAD (no GET collection) and WT/tests that assume List exists.

### 2.6 What 405 is not

- Not a wrong base URL (5073 matches AuthService + `.env.local`)
- Not Next proxy stripping methods
- Not HL7/document middleware
- Not soft-delete / empty table (those would be 200 `[]` or 401/403 after List exists)
- Not `lab.api.ts` orphan client

---

## 3. Current Architecture Map

```text
[Nav laboratory.view]
    → /dashboard/laboratory
    → LaboratoryWorkbench ── list/create ──→ labReportsApi
                                            → LabReportsController
                                            → lab_reports (LabReport)
                                            → patient (+ optional visit_id unset)
                                            → canonical_documents (Slice 4 attach)

[Patient 360 Clinical] ── getByPatient ──→ LabReport values (projection)
[Patient 360 Documents] ── attach/content ──→ LabReportCanonicalDocumentService
                                              domain=lab, entityType=LabReport

[Counsellor PreOp] ── lab-orders.api ──→ PreOpTestManagementController
                                       → counselor_lab_order_items
                                       → lab_test_catalog (YELLOW dual w/ service catalog)

[ORPHAN FE] lab.api.ts → /lab/*          (no BE)
[ORPHAN SQL] lab_order / lab_order_item  (no EF)
```

### 3.1 Frontend inventory (classification)

| Asset | Path | Class | Why |
|---|---|---|---|
| Laboratory page | `apps/.../dashboard/laboratory/page.tsx` | **GREEN** (ops entry) | Real route; `ProtectedRoute` + `laboratory.view` |
| `LaboratoryWorkbench` | `components/laboratory/LaboratoryWorkbench.tsx` | **YELLOW** | List/create only; prototype depth |
| `LaboratoryOrderDialog` | `components/laboratory/LaboratoryOrderDialog.tsx` | **YELLOW** | Free-text test; free-text clinician |
| `laboratory-constants.ts` | categories/priorities/specimen enums | **YELLOW** | UI constants, not catalog SoT |
| `labReportsApi` | `lib/api/lab-reports.api.ts` | **GREEN** | Authoritative LabReport client |
| Patient search | `PatientSearchAutosuggest` + unified MPI search | **GREEN** | Reusable |
| Ordering clinician UI | free-text Input | **RED** for production identity | Ignores doctor search |
| `LabReportsTab` / attach dialog | Patient tabs + Slice 4 | **YELLOW** / **GREEN** | Legacy tab vs Documents attach |
| P360 Clinical labs | `patient-360-clinical.ts` | **GREEN** | Projection only |
| P360 Documents Laboratory | `Patient360Documents.tsx` | **GREEN** | Canonical attach surface |
| Orphan `lab.api.ts` | `lib/api/lab.api.ts` | **RED** | No backend; D-LAB-13 do not wire |
| Lab SignalR / notifications | — | **RED** | None under laboratory components |
| Admin mock lab page | `app/admin/lab/page.tsx` | **RED** | Mock UI |

### 3.2 Backend inventory (classification)

| Asset | Path | Class | Why |
|---|---|---|---|
| `LabReport` | `Models/Domain/LabReport.cs` → `lab_reports` | **GREEN** | Ratified SoT root |
| `LabReportsController` | AuthService | **GREEN** API / **YELLOW** workflow | CRUD + complete + attach; no state machine |
| `LabReportCanonicalDocumentService` | Slice 4 | **GREEN** | Document identity |
| `LabTestCatalog` | `lab_test_catalog` | **YELLOW** | Counsellor/pre-op catalog |
| `CounselorLabOrderItem` | `counselor_lab_order_items` | **GREEN** counsellor / **YELLOW** vs Lab bridge | Parallel SoT (D-LAB-14) |
| `PreOpTestManagementController` | lab-catalog / lab-orders | **GREEN** counsellor | Not Laboratory workbench |
| Visit / practitioner FKs on LabReport | optional Guid / free names | **YELLOW** | Incomplete binding |
| Lab analytics / metrics API | — | **RED** | Only orphan FE |
| Dedicated Specimen / Observation entities | — | **RED** | Absent |
| External laboratory entity | — | **RED** | Absent |
| Lab audit writes in controller | — | **RED** | No `IAuditService` calls |

### 3.3 Database inventory (classification)

| Table / concept | Class | Why |
|---|---|---|
| `lab_reports` | **GREEN** | Authoritative pathology ops/clinical row |
| `canonical_documents` + associations | **GREEN** | Report file SoT |
| `patient` | **GREEN** | Required FK |
| `visits` | **YELLOW** | Exists; LabReport.VisitId optional, no FK, L1 unset |
| `users` / doctor search | **GREEN** platform / **YELLOW** lab use | Lab UI does not bind |
| `lab_test_catalog` | **YELLOW** | Live counsellor catalog; dual with service catalog |
| `counselor_lab_order_items` | **YELLOW** (bridge) | Live parallel |
| `preop_test_orders.lab_order_id` | **RED** pointer | Points at non-existent LabOrder module |
| SQL `lab_order` / `lab_order_item` / `lab_panel` | **RED** | Archive/SQL only; no EF |
| Specimen / observation / external lab tables | **RED** | Not present |
| Master `lab.specimen_type` | **YELLOW** | Label lookup only |
| `notification_logs` (NotificationService) | **GREEN** platform | Not Lab-owned |
| Organization / Branch / Department | **GREEN** facility / **YELLOW** for external lab | Internal only |
| Inventory `Vendor` | **RED** as clinical lab | Supply vendors |

---

## 4. Existing Reusable Capabilities

| Capability | Reuse recommendation |
|---|---|
| `LabReport` + `/api/lab-reports` | Keep as authoritative order/result root (D-LAB-02) |
| Slice 4 canonical documents | Keep; LabReport SoT + document association |
| Patient 360 Clinical / Documents split | Keep projection model |
| MPI patient search | Reuse in Order New Test |
| `GET /api/users/doctors/search` (`user.view`) | Reuse for ordering clinician / verifier identity |
| Master values `lab.specimen_type` | Seed specimen-type labels only |
| Organization / Branch / `STD_LABORATORY` department | Internal hospital lab facility context |
| NotificationService `POST .../notifications/dispatch` | Patient SMS/email (Lab requests; does not own channel) |
| SignalR `NotificationHub` + `useNotifications` | Staff realtime alerts |
| IP LIS webhook auth pattern | Pattern only — today completes ward checklist, not LabReport |
| Thin HL7 ADT publisher (IP) | Pattern only — not lab ORU/ORM |
| Counsellor `lab_test_catalog` / service catalog investigations | Possible **name/price seed** after product decision — not clinical SoT as-is |
| Imaging permission patterns | Reference for future lab-specific codes (D-LAB-09 FUTURE) |

---

## 5. Existing Catalog Assessment

### 5.1 `LabTestCatalog` (`lab_test_catalog`)

| Aspect | Finding |
|---|---|
| Ownership | AuthService; historically counsellor / PreOp |
| Schema | `TestName`, `TestCode?`, `Category?`, `Description?`, `Price?`, `TurnaroundHours?`, `SampleType`→`specimen_type`, `IsPreOperative`, `TestType` (Lab\|Imaging\|Scan), `IsActive`, soft delete |
| Missing for LIS | LOINC, SNOMED, panels, analytes, units, reference ranges, methods, collection requirements, performing/external lab, QC |
| Permissions | PreOp `counseling_sessions.read` / `.update` — not Laboratory ops |
| Consumers | `PreOpTestManagement/lab-catalog`, CounselingWorkflowService, `lab-orders.api.ts`, PreOperative widgets |
| Laboratory L1 | **Does not use** — free-text test name |
| Dual SoT pressure | Import script / counsellor master-catalog path moving to **Service Catalog** investigations; PreOp still reads EF catalog |
| Clinically authoritative? | **No** |
| Counseling-specific? | **Primarily yes** (`IsPreOperative`, PreOp APIs) |
| Safe to reuse as general Laboratory catalog? | **Not as-is.** May seed display names/prices after explicit product decision; must not silently become pathology dictionary |

### 5.2 Other catalog-like surfaces

| Surface | Assessment |
|---|---|
| Service Catalog DIAGNOSTICS / INVESTIGATIONS | Emerging counsellor investigation picker SoT |
| Ward FE `investigation-catalog.ts` | Display metadata only — not Lab SoT |
| Orphan `lab.api.ts` panels/ranges | Aspirational — **RED** |
| LOINC / SNOMED in lab models | **Absent** |

---

## 6. Order Model Assessment

### 6.1 Can current `LabReport` represent the intended concepts?

| Concept | Represented? | Notes |
|---|---|---|
| Order | **Partial** | Create → `status=ordered`, `OrderedAt` |
| Test | **Flat** | Free `TestName` / `TestCode` / `TestCategory` |
| Panel | **Missing** | |
| Individual analytes | **Missing** | Single result fields |
| Ordering clinician | **Partial** | `OrderedByName` + optional `OrderedById` (L1 sets name only) |
| Encounter/visit | **Partial** | `VisitId?` unset by L1; no EF FK |
| Clinical indication | **Missing** | Only `Notes` |
| Internal/external routing | **Missing** | |
| Performing laboratory | **Partial** | Free-text `LabName` |
| Priority | **Yes** | routine / urgent / stat |
| Specimen requirement | **Partial** | `SpecimenType` string |
| Collection | **Partial** | `SampleCollectedAt` |
| Accession | **Missing** | |
| Status | **Yes (string)** | ordered → sample_collected → in_progress → completed / cancelled / on_hold — **no enforced transitions** |
| Result | **Flat** | value / unit / range / interpretation |
| Report file | **Yes** | `ReportUrl` + Slice 4 canonical |

### 6.2 Ratified constraint

**Do not revive `lab_order` / `lab_order_item` / `lab.api.ts` as competing SoT (D-LAB-02 / D-LAB-13 / D-DATA-02).**

`LabReport` should remain the **authoritative root**. Child entities (specimen, observations, referrals, verifications) would hang off `LabReport` if product approves schema expansion — not a parallel SQL lab_order tree.

### 6.3 Parallel counsellor order

`CounselorLabOrderItem` remains a **separate** counselling SoT until bridge design (D-LAB-14). Status vocabulary differs (`Pending` vs `ordered`). Must not auto-fabricate LabReports.

---

## 7. Specimen Assessment

| Capability | Current | Gap vs intended LIS |
|---|---|---|
| Specimen type | String on LabReport + master labels | No controlled clinical specimen definition |
| Container / volume / additive | Absent | Required for real collection |
| Collection / collector / time | Time only (`SampleCollectedAt`) | Collector identity missing |
| Labeling / barcode | Absent | |
| Transport | Absent | |
| Accession number | Absent | |
| Received time | Absent | |
| Acceptance / rejection + reason | Absent | |
| Processing status | Collapsed into LabReport `status` | |
| Multiple specimens per order | Absent | |

**Verdict:** No specimen entity. Current fields are insufficient for pre-analytical LIS. Product must decide whether specimen is a first-class child of `LabReport` or deferred.

---

## 8. Result Model Assessment

### 8.1 How results are stored today

Single row fields on `LabReport`:

- `ResultValue` (string ≤200) — no numeric/text/coded/qualitative discriminator  
- `ResultUnit`, `ReferenceRange` (strings)  
- `Interpretation` (normal / abnormal / critical / high / low)  
- `TechnicianName`, `VerifiedByName` (strings; no user ids / timestamps for verify)  
- `CompletedAt` via Complete  
- External PDF via canonical attach / legacy `ReportUrl`

### 8.2 Capability matrix

| Need | Support |
|---|---|
| Numeric / text / coded / qualitative | One undifferentiated string |
| Unit / reference range | Strings only |
| Abnormal / critical | Interpretation string |
| Method / analyzer / device | Missing |
| Performer / verifier (authoritative) | Names only |
| Multiple analytes / panel results | Missing |
| Microbiology / pathology narrative | Missing (notes/PDF only) |
| External structured ingest | Missing |
| Amendments / versioned results | Missing (D-LAB-03 amendment = FUTURE) |

### 8.3 Recommendation (proposal only)

For production multi-analyte / panels / micro / amendments: **child Observation/Result entities** under `LabReport` are required. Flat fields may remain as **denormalized summary** for simple single-analyte tests and P360 list cards. Do not implement in this audit.

---

## 9. Internal Workflow Gap Map

Legend: **GREEN** usable · **ORANGE** partial/fields only · **RED** absent

| Stage | Entity | API | Permission | UI | Audit | Rating |
|---|---|---|---|---|---|---|
| ORDER | LabReport create | `POST /api/lab-reports` | `patient.update` | L1 Order dialog | CreatedBy only; no audit service | **ORANGE** (works, not catalog-grade) |
| COLLECTION | `SampleCollectedAt`, status | generic `PUT` | `patient.update` | None in workbench | None | **ORANGE** |
| ACCESSION | — | — | — | — | — | **RED** |
| RECEIVING | — | orphan FE only | — | — | — | **RED** |
| PROCESSING | status `in_progress` | `PUT` | `patient.update` | Filter only | None | **ORANGE** |
| RESULT ENTRY | result fields | `PUT` / `POST .../complete` | `patient.update` | API client exists; **not** in L1 workbench | None | **ORANGE** |
| VALIDATION | `VerifiedByName` | No verify API | — | Forbidden inventing in L1 (D-LAB-04) | — | **RED** |
| REVIEW | — | — | — | — | — | **RED** |
| RELEASE | `completed` via Complete | `POST .../complete` | `patient.update` | Not wired in L1 | None | **ORANGE** |
| DOCUMENT ATTACH | canonical | attach / content | `patient.update` / `patient.view` | P360 Documents | Storage/hash | **GREEN** (≠ clinical release) |

---

## 10. External Lab Gap Map

| Capability | Status | Reuse |
|---|---|---|
| External / reference lab entity | **Absent** | — |
| Send-out / referral workflow | **Absent** (docs only) | — |
| Provider/lab directory | **Absent** | Do not misuse inventory Vendor without redesign |
| External accession / reconciliation | **Absent** | — |
| Outbound ORM / inbound ORU (HL7) | **Absent** | IP ADT publisher is unrelated pattern |
| FHIR DiagnosticReport / Observation / ServiceRequest | **Not implemented** (product deferred) | — |
| SFTP | **Absent** | — |
| Email/SMS/WhatsApp as Lab-owned | **Must not** | Use NotificationService / hub |
| Webhooks | IP LIS → ward checklist only | Auth pattern reusable; destination wrong for Lab |
| Free-text `LabName` | Only current “which lab” field | Insufficient |

---

## 11. Communication / Integration Assessment

### 11.1 Existing infrastructure

| Stack | Role |
|---|---|
| NotificationService `POST .../notifications/dispatch` | SMS / email / (WhatsApp currently routed via SMS path) |
| `notification_logs` | Delivery status fields |
| AuthService Twilio SMS + email | Counselling / reminders |
| Counsellor communication log | Often log-only; channels include WhatsApp |
| SignalR `NotificationHub` | Staff realtime |
| CCMS inbound email webhook | TPA — not Lab |
| WhatsApp Business API | **TODO / stub** in counselling share |

### 11.2 Recommendation for Laboratory

Laboratory should **request** communications through platform services:

1. **Staff alerts** (critical result, exception queue) → NotificationHub events + existing toast patterns.  
2. **Patient SMS/email** → NotificationService dispatch with purpose codes (e.g. `lab_result_ready`, `critical_result`) and delivery logging.  
3. **Do not** add Lab-owned Twilio/WhatsApp clients or parallel buses (`socket.io` unused — do not start).  
4. Critical-result escalation policy remains **PRODUCT OWNER DECISION** (product definition FUTURE).

### 11.3 External result ingestion (today)

| Path | Exists? |
|---|---|---|
| Manual structured complete | Yes (API; not L1 UI) |
| Manual PDF attach | Yes (Slice 4) |
| HL7 / FHIR / analyzer ingest | No |
| Order reconciliation by external accession | No |
| IP LIS webhook → LabReport | No |

**Future authoritative ingest (proposal):** structured Observation children under LabReport as clinical SoT; PDF remains document SoT; external messages store provenance then map into Observations + optional DiagnosticReport projection.

---

## 12. Document Architecture Assessment

Confirmed — **do not change Slice 4**:

| Concern | Rule |
|---|---|
| Clinical/ops SoT | `LabReport` |
| Physical document identity | Canonical document (`patient-documents`, association `domain=lab`, `entityType=LabReport`) |
| Patient 360 | Projection only (Clinical = values; Documents = files) |
| Attach ≠ complete | Certified |
| Duplicate document store | Forbidden |
| Structured results | Clinical data on LabReport (future: Observation children) |
| PDF / external report | Document data |
| `ReportUrl` | Legacy external URL; attach does not rewrite it |
| Versioning / replace | One active attach; different bytes → 409 (D-LAB-08 FUTURE) |

---

## 13. Authorization Assessment

| Surface | Permission |
|---|---|
| Nav + Laboratory page | `laboratory.view` |
| LabReport read / report content | `patient.view` |
| LabReport write / complete / attach / delete | `patient.update` |
| Doctor search | `user.view` |
| Counsellor lab catalog/orders | `counseling_sessions.*` |
| Generic MPI document download codes | **Not** accepted for Lab content (Slice 4) |

**Gaps / honesty:**

- Nav vs API permission split is intentional interim (D-LAB-09) but operationally awkward for Lab Tech least privilege.  
- Anyone with `patient.update` can complete/release — no lab-role separation.  
- No verification permission model.  
- New `lab.*` workflow codes = FUTURE only after owner approval.

---

## 14. Quality / Auditability Assessment

| Requirement | Today | Gap |
|---|---|---|
| Audit log on mutations | LabReportsController does **not** call audit service | High |
| Provenance / source system | None | Needed for external ingest |
| Status history | Current status column only | No timeline table |
| Verification / final release | Name string; Complete = release | D-LAB-04 target unmet |
| Post-complete immutability | Ratified D-LAB-03; Update still mutable in controller | Must enforce in future L2 |
| Amendments | FUTURE | |
| Critical result communication | Interpretation string only | No escalation workflow |
| Document versioning | One active attach | D-LAB-08 |
| User attribution | Created/Updated user ids | Clinical roles unbound |
| Timestamps | Ordered / collected / completed / CRUD | Present; no history |
| Soft delete | EF query filter | OK |

ISO 15189 / NABL / WHO: see §16 — current system does **not** claim compliance; gaps above block compliance-oriented operations.

---

## 15. Interoperability Assessment

### 15.1 FHIR R4 conceptual mapping (future compatibility)

| FHIR resource | Current affinity | Risk if model stays flat forever |
|---|---|---|
| ServiceRequest | LabReport order fields | OK as root if panel/items clarified |
| Specimen | SpecimenType + SampleCollectedAt | **Blocks** without specimen entity |
| Observation | Single ResultValue | **Blocks** multi-analyte / panels |
| DiagnosticReport | LabReport + canonical PDF | Feasible as report envelope |
| Task | Status string | Weak without workflow tasks |
| CommunicationRequest | None | Use platform Communication later |
| LOINC | Absent | Need mapping table, not rename local codes |

### 15.2 HL7 v2

No lab ORM/ORU. IP ADT publisher is unrelated. Future ORU ingest should map to Observation children + provenance, not overwrite LabReport blindly.

**Goal:** Internal model must not prevent FHIR/HL7 — prefer local IDs + optional standard code mappings + Observation children + Specimen + PerformingOrganization.

---

## 16. India / ISO / NABL / WHO Contextual Assessment

**Do not claim regulatory compliance.**

Capabilities that would support *future* compliance posture vs today:

| Theme | Product capability needed | Today |
|---|---|---|
| Traceability | Order → specimen → analyzer → result → releaser | Partial timestamps only |
| Result validity | Verification + post-release control | Incomplete |
| Documented procedures | Procedure/version linkage | Absent |
| Sample handling | Collection, accession, rejection | Absent |
| Result authorization | Named competent verifier user | Free-text name |
| Critical results | Documented communicate/ack | Interpretation string |
| Auditability | Immutable audit + status history | Weak |
| Quality control | QC runs / lot / Westgard-style | Absent |
| Competence / accountability | Role + user attribution | `patient.update` blanket |

---

## 17. Target Domain Model Proposal (NOT APPROVED)

Respect: **do not revive `lab_order` / `lab_order_item` blindly.** Prefer extending under `LabReport` root.

| Concept | Required? | Existing equivalent | Reusable? | Merge / new? | Why |
|---|---|---|---|---|---|
| LaboratoryTestDefinition | **Yes** (catalog) | `LabTestCatalog` (thin) / Service Catalog | Partial seed only | **New or major extend** after owner picks SoT | Clinical identity, method, specimen req, TAT |
| LaboratoryPanel | Yes for panels | Orphan FE only | No | **New** child of catalog | Multi-test orders |
| LaboratoryAnalyte | Yes for multi-result | Flat ResultValue | No | **New** | Observation dictionary |
| LaboratoryOrder / **LabReport** | **Yes** | **LabReport** | **Yes — keep root** | **Extend LabReport** | Ratified SoT |
| LaboratoryOrderItem | Conditional | — / orphan SQL | No revive SQL | **New child of LabReport only if panels/multi-test required** | Prefer `LabReportItem` naming to avoid orphan confusion |
| Specimen | Yes for real pre-analytical | Columns only | No | **New** | Accession/reject/receive |
| Accession | Yes | — | — | **New** (or Specimen.AccessionNumber) | Pre-analytical identity |
| Observation/Result | Yes for LIS | Flat fields | Partial denorm | **New children** | Multi-analyte + flags |
| DiagnosticReport (domain) | Report envelope | LabReport + canonical doc | Partial | **Projection / thin entity later** | Align FHIR DiagnosticReport |
| PerformingLaboratory | Yes | `LabName` string / Dept | Partial | **New or Org/Facility typed** | Internal vs external |
| ExternalLaboratory | Yes for send-out | — | No | **New** (or typed Organization) | Directory + routing |
| ResultVerification | Yes (D-LAB-04 target) | VerifiedByName | No | **New workflow fields/events** | Authorization |
| ResultAmendment | FUTURE | — | — | **New** after D-LAB-03 | Controlled change |
| ExternalLabReferral | Yes for send-out | — | — | **New** | Dispatch/reconcile |
| LaboratoryIntegration | FUTURE | IP webhook pattern | Pattern | **New** | Channel adapters |
| LaboratoryReportDocument | Exists | Slice 4 canonical | **Yes** | **Keep** | Do not duplicate store |

---

## 18. Target Workflow (proposal)

### Pre-analytical
Order (catalog) → patient ID → preparation → collection → labeling → transport → accession → accept/reject

### Analytical
Work assign → process → instrument/manual → QC → capture → repeat/dilution as needed

### Post-analytical
Technical validation → clinical review → critical communicate → report release → amendment → notify

**Classification of gaps:**

| Item | Type |
|---|---|
| Catalog SoT, verification mandatory roles, external lab org model, counsellor bridge | **Required product decisions** |
| Analyzer integration, LOINC pack, QC module, FHIR export | **Future capabilities** |
| Specimen entity, Observation children, status history, audit writes, clinician binding | **Current application gaps** |

---

## 19. Target UX / Workbench Proposal (proposal only)

### Laboratory Dashboard
Work queue; status; priority; SLA/TAT; internal/external; specimen state; assigned work; exceptions — desktop-dense, Counsellor-quality patterns, honest empty/error.

### Order New Test
Patient (MPI search); ordering clinician (**doctor search**, not free-text); test/panel catalog; codes; category; specimen requirements; priority; reason; internal/external + performing lab; collection instructions; expected TAT.

### Order Detail
Patient/order/specimen timeline; structured results; documents; communications; audit.

### Result Workspace
Analytes, units, ranges, flags, comments, verification, report preview/attach.

### External Lab
Referral, dispatch, external accession, expected vs received, reconciliation, document.

**L1 today covers only a thin slice of Dashboard list + Order create.**

---

## 20. Migration Strategy (no migration executed)

| Current asset | Strategy |
|---|---|
| `LabReport` / `lab_reports` | **Preserve** as root; **extend** with FKs/children |
| Flat result columns | **Preserve** as summary; **adapter** to Observation children later |
| Slice 4 canonical docs | **Preserve** |
| `LabTestCatalog` | **Deprecated** as pathology SoT candidate; **adapter/seed** if owner chooses; counsellor path may retain until service catalog fully owns it |
| Service Catalog investigations | **Candidate** catalogue SoT — owner decision |
| `counselor_lab_order_items` | **Preserve** parallel; bridge **adapter** only after D-LAB-14 design |
| SQL `lab_order` / `lab_order_item` | **Deprecated** — do not revive |
| `lab.api.ts` | **Deprecated** — do not wire |
| `LabName` / `OrderedByName` strings | **Preserve** for display; **extend** with authoritative FKs |
| `PreOpTestOrder.LabOrderId` | **Deprecated** pointer — retarget or drop in future bridge |
| Orphan admin mock lab UI | **Deprecated** |

---

## 21. Product Decisions Required

| ID | Decision | Why it blocks |
|---|---|---|
| PD-LAB-CAT-01 | Authoritative Laboratory test catalog SoT (`LabTestCatalog` extend vs Service Catalog vs new LaboratoryTestDefinition) | Ordering quality |
| PD-LAB-CAT-02 | Panels and analytes in v1 scope? | Schema shape |
| PD-LAB-SPEC-01 | First-class Specimen + accession in next phase? | Pre-analytical |
| PD-LAB-OBS-01 | Observation children vs remain flat for single-analyte only | Result model |
| PD-LAB-ORG-01 | PerformingLaboratory / ExternalLaboratory model (new vs Organization/Branch type) | Internal vs send-out |
| PD-LAB-CLI-01 | Mandate doctor-search binding for OrderedById (and verifier user id) | Attribution |
| PD-LAB-WF-01 | Exact status machine + who may transition | Safety |
| PD-LAB-VER-01 | Verification roles/capabilities before release (implements D-LAB-04) | Release |
| PD-LAB-EXT-01 | Send-out scope and channels (manual PDF vs API vs HL7 later) | External lab |
| PD-LAB-COM-01 | Critical result communication policy | Patient safety |
| PD-LAB-PERM-01 | Timing for lab-specific permissions vs keep `patient.*` | Authz |
| PD-LAB-14 | Counsellor → LabReport bridge timing/design | Dual queues |
| PD-LAB-CODE-01 | LOINC (and other) mapping strategy — local ID + map | Interop |
| Runtime | Commit/deploy GET List + restart AuthService before any L1 UAT | 405 / FE-BE drift |

Prior ratified decisions (D-LAB-01…14, Slice 4) remain in force unless explicitly reopened by product owner.

---

## 22. Recommended Phased Roadmap (advisory — not started)

| Phase | Intent | Gate |
|---|---|---|
| **Gate 0** | Product owner review of this audit; resolve PD-* above for next phase scope | **CURRENT GATE** |
| **L1-stabilize** | Align committed AuthService GET list with FE; process restart discipline; no feature expansion | After owner acknowledges 405 root cause |
| **L-Cat** | Catalog SoT + order from catalog + clinician identity | PD-LAB-CAT-*, PD-LAB-CLI-01 |
| **L-Specimen** | Specimen/accession/reject/receive | PD-LAB-SPEC-01 |
| **L-Result** | Observation model + result workspace + enforce D-LAB-03 | PD-LAB-OBS-01, PD-LAB-VER-01 |
| **L-Release** | Verification + release + audit/status history | PD-LAB-WF-01, PD-LAB-COM-01 |
| **L-External** | Performing/external lab + referral + manual ingest reconciliation | PD-LAB-ORG-01, PD-LAB-EXT-01 |
| **L-Interop** | LOINC maps, FHIR/HL7 adapters | PD-LAB-CODE-01 |
| **L-Bridge** | Counsellor bridge if approved | D-LAB-14 / PD-LAB-14 |

Do **not** start the next implementation slice until Gate 0 completes.

---

## 23. Current L1 Status

| Question | Answer |
|---|---|
| Production-ready? | **No** |
| Prototype? | **Yes — thin order/worklist prototype** |
| Partial? | **Yes** (real API create/list when BE matches FE; document attach via Slice 4 elsewhere) |
| Blocked? | **Yes for UAT** — product-scope gap vs intended LIS; runtime FE/BE List drift caused 405; Manual UAT **paused** pending owner review |
| Accepted? | **Not accepted** |

---

## 24. Explicit Out-of-Scope Items (this audit)

- No code changes  
- No database / migration / seed changes  
- No new permissions  
- No API contract changes  
- No Laboratory UI changes  
- No test catalog data creation  
- No fake clinical data  
- No HL7/FHIR implementation  
- No WhatsApp/SMS/email implementation  
- No result entry / verification / external lab implementation  
- No new implementation slice  
- No Slice 4 redesign  
- No revival of `lab_order` / `lab_order_item` / `lab.api.ts`

---

## 25. Final Gate Statement

```text
AUDIT: COMPLETE
IMPLEMENTATION: NOT STARTED
PRODUCT DECISIONS: REQUIRED
MANUAL UAT: PAUSED
NEXT GATE: PRODUCT OWNER REVIEW
```

---

## Appendix A — LabReport field inventory (evidence)

Source: `microservices/auth-service/AuthService/Models/Domain/LabReport.cs`

Identity/context: `Id`, `TenantId`, `PatientId`, `VisitId?`  
Test: `TestName`, `TestCode?`, `TestCategory?`  
Orderer: `OrderedByName?`, `OrderedById?`, `OrderedAt?`  
Specimen/time: `SpecimenType?`, `SampleCollectedAt?`, `CompletedAt?`  
Result: `ResultValue?`, `ResultUnit?`, `ReferenceRange?`, `Interpretation?`  
People/org strings: `LabName?`, `TechnicianName?`, `VerifiedByName?`  
Ops: `Priority`, `Notes?`, `ReportUrl?`, `Status`  
Audit columns: `CreatedAt`, `UpdatedAt`, `CreatedByUserId?`, `UpdatedByUserId?`, `DeletedAt?`  
NotMapped: canonical document metadata; worklist `PatientDisplayName`, `MedicalRecordNumber`

## Appendix B — Real-world workflow comparison (summary)

| Phase | Required product decision | Future capability | Current app gap |
|---|---|---|---|
| Pre-analytical order/ID | Catalog + clinician binding | — | Free-text order |
| Collection/label/transport | Specimen scope | Barcode/hardware | No specimen entity |
| Accession/accept/reject | Specimen workflow | — | Missing |
| Analytical + QC | Scope of analyzer/QC | Instrument interfaces | Missing |
| Technical validation | Verification policy | — | Missing |
| Clinical review / critical | Escalation policy | Comms templates | Missing |
| Release / amend / notify | Release + amend rules | Channel automation | Complete API only; weak audit |

## Appendix C — Related decisions still in force

- D-LAB-01…14 as ratified in `diagnostics-laboratory-product-definition.md`  
- Slice 4 document principles unchanged  
- This audit **raises the target bar** above L1 prototype scope; it does **not** silently reopen Slice 4 or revive orphan SQL orders
