# Patient 360 — Document Upload Foundation Audit

Date: 2026-10-06  
Status: **AUDIT COMPLETE — IMPLEMENTATION NOT STARTED**  
Slice: **Phase D.1 — audit only**  
Route (existing, unchanged): `/dashboard/patients/[id]?section=documents`  
Principle: **ONE PATIENT → ONE FIXED CONTEXT → ONE RECORD WORKSPACE → MULTIPLE INFORMATION DOMAINS**

This document is a repository audit. It does **not** authorize implementation. Labels used throughout:

| Label | Meaning |
|---|---|
| **CERTIFIED EXISTING CAPABILITY** | Live compiled API/UI/storage/permission that was inspected in this repo |
| **SOURCE GAP** | No authoritative patient-scoped capability exists (or the live path is non-functional) |
| **DECISION REQUIRED** | Product/security must choose before any implementation slice |
| **PROPOSED FUTURE IMPLEMENTATION** | Recommendation only. Not built. Not approved by this audit. |

**Did not change:** production code, Phase D UI, APIs, tables, permissions, migrations, CCMS, Counsellor, Clinical, Laboratory, Imaging, Insurance, OT/IP, Billing, or ownership workflows.

---

## 1. Executive conclusion

Patient 360 Documents is already a **read-only unified index** of source-owned metadata (Phase D). Manual UAT now asks for an authorized way to **add a patient-associated document** when none exists.

There is **no live, compiled, patient-scoped generic document upload API**.

What exists instead:

- A **legacy table** `patient_document_uploads` and unused permission codes `patient.patient_document.*`.
- A **disabled** frontend caller `GET /patient-document-uploads/patient/{id}` (no compiled controller).
- A **Phase 4 excluded** Document Sharing workbench (not a Patient 360 store).
- **Domain-owned** upload paths that must not be reused from Patient 360 because they require or create CCMS cases, counselling sessions, imaging orders, lab results, insurance pre-auths, or IP journeys.

**Classification of the product requirement as a whole: SOURCE GAP + DECISION REQUIRED.**  
The closest reuse candidate is the **existing `patient_document_uploads` table + `patient.patient_document.*` permission catalog**, not CCMS and not counselling session documents. That reuse is **YELLOW**, not GREEN: the table has no live API, tenant query filters are commented out, there is no branch column, blob storage is not wired, and the permissions have no bound controller.

**Do not revive** the disabled `/patient-document-uploads` UI or `_Phase4_Disabled` Document Sharing as Patient 360 upload.

**Do not** upload from Patient 360 into CCMS, counselling sessions, lab reports, imaging orders, insurance, or IP pre-op. That would fabricate or mutate source-owned records.

Recommended future slice (not started): a **narrow MPI “General” patient-document capability** keyed to canonical `patient.id`, permission-gated, then indexed on Patient 360 Documents. Source-owned rows stay read-only in the index.

---

## 2. Existing document architecture

Patient 360 Documents today (Phase D, **CERTIFIED EXISTING CAPABILITY** for read/index only):

| Index source | Owner | Patient-scoped read | Bytes in 360 |
|---|---|---|---|
| CCMS documents | CCMS / coverage case | `GET /ccms/documents/by-patient/{patientId}` metadata | No |
| Counselling session documents | Counsellor / session | `GET /api/counseling-session-documents/by-patient/{patientId}` metadata | No |
| Chart notes | Clinical / notes | `GET /api/patient-notes/patient/{patientId}` | Text in Sheet |
| Laboratory reports | Lab report rows | Clinical loader → `lab-reports` | External `reportUrl` only if `http(s)` |
| Imaging files | Imaging | `GET /api/Imaging/patient/{id}/patient-360/images` | Metadata only |
| MPI / general patient documents | **None live** | Stub / disabled GET | **SOURCE GAP** |
| Insurance document store | Legacy insurance + CCMS | No 360 GET; Insurance filter is source-gap copy | **SOURCE GAP** |

Storage is **not** a single hospital document repository. It is several engines:

| Engine | Service | Container / path | Used for |
|---|---|---|---|
| Auth `BlobStorageService` | auth-service | default `patient-photos`; also generic `UploadFileAsync` | Photos; imaging export reports; counselling audio exact keys in `session-audio` |
| CCMS `DocumentEngineService` | ccms-service | `ccms-documents` + SAS / `/content` | Coverage-case files |
| IP `AzureBlobStorageService` | ip-management-service | `preop-documents` (`preop/{tenant}/{journey}/…`) | Pre-op / ward investigation files |
| Counselling session document POST | auth-service | **Placeholder `FilePath` string; TODO blob** | Metadata row only |
| `patient_document_uploads.file_url` | auth-service table | **No writer** | **SOURCE GAP** |

There is no virus/malware scanner in the repository (**SOURCE GAP**).

---

## 3. Existing APIs

### 3.1 Patient-scoped generic documents

| API | Status | Classification |
|---|---|---|
| `GET /patient-document-uploads/patient/{id}` | Called by hidden `DocumentsTab.tsx`. **No compiled controller.** Failure collapsed to `[]`. | **RED** (non-functional; must not be treated as empty-SoT). **Do not revive automatically.** |
| `POST /patient-documents/{id}/upload` | Archive docs only (`archive/docs/module3-status`). Not a live controller. | **SOURCE GAP** |
| `widgets.api.getPatientDocuments` | Returns `[]` with TODO `Replace with /documents/patient/:id` | **RED** for 360 |
| `patients-enhanced.uploadMedicalRecord` → `POST /patients/{id}/medical-records` | Frontend client only. **No backend controller** found. | **RED** |
| `patients-enhanced.getLabResults` → `/patients/{id}/lab-results` | Frontend client only. Live labs are `LabReportsController`. | **RED** |
| `document-sharing.api.ts` `/documents/upload`, `/documents/search`, versions, share | Targets Phase 4 Document Sharing. Controller **Compile Remove**. | **RED** as a 360 store |

**CERTIFIED EXISTING ARTIFACT (data, not API):** table `patient_document_uploads` (`PatientDocumentUpload`), created in `20251113084527_CompleteSchema.cs`. Columns include `tenant_id`, `patient_id`, `document_type`, `document_title`, `file_url`, `file_size`, `mime_type`, `uploaded_by`, `uploaded_at`, sharing arrays, `is_public`, `data_classification`, `retention_days`, `status`, audit/soft-delete. **No `branch_id`.** Global query filter for tenant is **commented out** in `AppDbContext`.

### 3.2 CCMS documents — **CERTIFIED EXISTING CAPABILITY** (case-owned)

| Method | Route | Notes |
|---|---|---|
| POST multipart or JSON | `/api/ccms/coverage-cases/{id}/documents` | Requires coverage case. Multipart `file` + `documentType` + `stage`. JSON blob-url path rejected unless blob already exists. |
| GET | `/api/ccms/coverage-cases/{id}/documents` | Case list; builds access URLs |
| GET | `/api/ccms/documents/by-patient/{patientId}` | **Metadata only.** Tenant on case + document. **No branch predicate.** Safe for 360 **display** of CCMS rows. |
| GET | `/api/ccms/documents/{docId}/access-url` and `.../content` | Bytes. **Not wired in Patient 360** (existing 360 tests forbid `access-url`). |
| POST | `.../documents/pacs-study`, `.../biometry` | Pointer docs, not generic files |
| DELETE | `/api/ccms/documents/{id}` | Soft-delete via engine |

Upload **associates the file with a coverage case**, which already has `PatientId`. Surfacing by `patient.id` is certified for **metadata**. Uploading from 360 **would create/replace a CCMS document on a case** (engine soft-deletes prior same type/category). That is **not** a generic patient document.

**Auth gap (existing, not invented):** `Upload`, `AttachPacsStudy`, `AttachBiometryRecord`, and `Delete` in `DocumentFunctions.cs` validate JWT but **do not** call `CcmsAuthz.ForbidUnlessAsync` for `ccms.document.upload` / `ccms.document.delete`. Read/content/access-url **do** require `ccms.document.read`. Permissions exist in `consolidated/migrations/127_ccms_permissions.sql`. Frontend `useCcmsPermissions` maps upload/read/delete codes.

### 3.3 Counselling documents — **CERTIFIED EXISTING CAPABILITY** (session-owned)

| Method | Permission | Notes |
|---|---|---|
| `GET api/counseling/sessions/{sessionId}/documents` | `session_documents.read` | Session-scoped |
| `GET api/counseling/documents/{id}` | `session_documents.read` | Includes `FilePath` |
| `GET api/counseling-session-documents/by-patient/{patientId}` | `session_documents.read` | 360 metadata; **no file paths/bytes**; tenant; excludes soft-deleted session/doc; **no branch filter** |
| `POST api/counseling/documents` | `session_documents.create` | JSON metadata; **requires `SessionId`** |
| `POST api/counseling/documents/upload` | `session_documents.create` | Multipart; 100MB limit; extensions jpg/png/gif/pdf/doc/docx; **placeholder FilePath**; **TODO Azure Blob**; mock/temp session IDs return success **without persist** |
| `POST api/counseling/sessions/{id}/upload-audio` | `session_documents.create` | Real blob via `session-audio` exact keys |
| `POST .../documents/{id}/verify` | `session_documents.verify` | Session workflow |
| `DELETE api/counseling/documents/{id}` | `session_documents.delete` | Session-scoped |

Documents **cannot exist without a session** in the model (`SessionId` required; 360 list joins sessions). Table check constraint limits `document_type` to counselling types including `AudioRecording`.

**Generic Patient 360 upload must not reuse this infrastructure.** It would either fabricate a session or attach MPI files to Counsellor ownership.

Recordings/transcripts live in `session_recordings` + private `session-audio` blob + conversation workflow. **Must remain Counsellor-owned. Do not index as generic 360 documents.**

### 3.4 Clinical / notes / lab / imaging

| API | Permission | Upload? | 360 |
|---|---|---|---|
| `GET/POST/PUT/DELETE api/patient-notes` | view: `patient.view`; write: `patient.update` | JSON notes, not files | Display notes |
| `GET/POST api/lab-reports` | same | JSON including `ReportUrl`; **not multipart** | Display labs; Open report if http(s) |
| `POST api/Imaging/{orderId}/upload` | `imaging.upload` | Multipart images; **requires imaging order**; 50MB; max 20 files | **RED** for 360 upload |
| `GET api/Imaging/patient/{id}/patient-360/images` | `examination.view` | — | Metadata display |
| Imaging export report upload | service uses `BlobStorageService.UploadFileAsync` | Report generation, not MPI | Not a 360 writer |

Uploading a “lab PDF” via `LabReportsController.Create` would create a **lab result row**. Uploading via imaging upload would attach to an **imaging order**. Both violate the product rule.

### 3.5 Insurance

| API | Permission | Status |
|---|---|---|
| `GET insurance/pre-auths/{id}/documents` | `insurance.documents.view` | Pre-auth scoped, not patient-scoped |
| POST/verify/DELETE insurance documents | upload/verify/delete | **410 frozen** unless CCMS bypass. Frontend throws `LegacyWriteFrozen`. |
| Table `insurance_documents` | — | Keyed by `pre_auth_id`, not `patient_id` |

Insurance files that should appear for a patient today are **CCMS case documents** (already on All, **not** labeled Insurance in Phase D). A dedicated Insurance filter remains a **SOURCE GAP**.

### 3.6 IP / pre-op / consent / registration / portal

| Area | API | Classification for 360 upload |
|---|---|---|
| Pre-op documents | `POST ip-management/journeys/{id}/pre-op/documents` (base64), `ward.checklist.edit` | **RED** — journey/clearance owned |
| Ward investigation docs | `UploadWardInvestigationDocument` | **RED** — checklist owned |
| Patient consents | `api/patient-consents` JSON `DocumentUrl` / `SignatureUrl`; `patient.view` / create perms | **YELLOW** for display later; **RED** as file upload (no multipart; would create consent records) |
| Registration ID | Demographics fields (Aadhaar etc.), not a file store | **SOURCE GAP** as documents |
| Patient photo | `POST api/patients/{id}/photo` `patient.edit`; 10MB; jpeg/png/webp | **RED** for documents |
| Patient portal | `patient-portal.api` lab getters; no certified portal document POST found for MPI | **SOURCE GAP** |

---

## 4. Existing storage

### 4.1 Azure Blob (auth-service) — **CERTIFIED EXISTING CAPABILITY** (photos / session audio / generic helper)

- Config `AzureBlobStorage`: Azurite `UseDevelopmentStorage=true`; `MaxFileSizeMB` 10; allowed types **images only** (jpeg/png/webp). That config is used by **photo upload**, not by a general document API.
- Containers: `patient-photos` / config name `patient-media`; private `session-audio` with exact keys `{tenant}/{session}/{conversation}/{recording}{ext}`; generic `UploadFileAsync` default container `patient-photos`, returns **blob URI string** (not SAS).
- Session audio: no-overwrite, no browser URL, `OpenReadExactAsync` for authorized backend streams.

**YELLOW** as a future patient-document store: the service can upload streams, but a general document container, SAS vs authenticated stream, filename rules, and PDF MIME allow-list **do not exist**.

### 4.2 CCMS DocumentEngine — **CERTIFIED EXISTING CAPABILITY** (case files)

- Container `ccms-documents`.
- Filename resolve/sanitize (`CcmsDocumentFileNames`).
- Completeness validator: type, name, size > 0, mime, http or pointer URL.
- Short-lived read SAS + `/content` stream.
- Soft-delete prior same type/category on upload.
- Policy extraction separately caps **10MB** and MIME for OCR (not the generic case upload).

**RED** for Patient 360 generic upload (case ownership).

### 4.3 IP pre-op blob — **CERTIFIED EXISTING CAPABILITY** (journey files)

- Container `preop-documents`; path `preop/{tenantId}/{journeyId}/{guid}/{sanitized}`.
- **RED** for 360 generic upload.

### 4.4 S3

No production S3 document engine found. Counselling upload comments mention S3 as TODO only.

### 4.5 Unused audit table

`document_access_audit` is mapped in EF. **No controller writes were found.** Retention on `PatientDocumentUpload.RetentionDays` default 2555 is **not enforced by a job** in this audit.

---

## 5. Existing permissions

### 5.1 Generic patient document (catalog only)

Seeded in `PermissionSeeder.cs` (**CERTIFIED catalog**, **SOURCE GAP binding**):

| Code | Seeded scope | Bound live API? |
|---|---|---|
| `patient.patient_document.upload` | own, department-specific | **No** |
| `patient.patient_document.read` | own, department-specific | **No** |
| `patient.patient_document.download` | own, department-specific | **No** |
| `patient.patient_document.delete` | branch | **No** |

`patient.view` is **not** a document-upload permission. It is used for notes, lab GET, consents GET.  
`patient.update` is used for notes/lab **writes** (clinical/lab mutation). **Must not** be the silent upload gate.  
`patient.edit` is photo upload.

**DECISION REQUIRED:** whether 360 upload uses unused `patient.patient_document.upload` (recommended catalog reuse) vs inventing a new code (out of scope until product says so) vs `patient.update` (**reject** — mutates clinical/lab meaning).

**DECISION REQUIRED:** meaning of Scope `own` / department-specific for MPI documents (uploader-only vs any staff with patient.view vs assigned department).

### 5.2 Domain permissions (live)

| Operation | Permission | Patient 360 use |
|---|---|---|
| CCMS list/read/SAS/content | `ccms.document.read` | Index metadata only |
| CCMS upload (intended) | `ccms.document.upload` | **Not for 360 upload**; function may not even enforce it today |
| CCMS delete (intended) | `ccms.document.delete` | **Not for 360** |
| Counselling doc read | `session_documents.read` | Index metadata |
| Counselling doc create/upload/audio | `session_documents.create` | **Session-scoped only** |
| Counselling verify/delete | `session_documents.verify` / `.delete` | Counsellor workflow |
| Imaging file list 360 | `examination.view` | Index |
| Imaging upload | `imaging.upload` | Order-scoped |
| Insurance docs | `insurance.documents.*` | Frozen writes; pre-auth read |
| IP pre-op upload | ward edit (`RequireWardEdit`) | Journey-scoped |
| Consent create | `patient.patient_consent.create` (seeder) / controller uses `patient.view` on GET | Not file upload |

Counsellor users with `session_documents.create` must **not** gain start/assign/requeue via a 360 upload. Those are separate counselling permissions. 360 must not call session create APIs.

`patient.view` is **insufficient** as the upload gate. It is **currently sufficient** for reading notes/labs in 360 (existing Phase D). **DECISION REQUIRED** whether general document **read** in 360 uses `patient.patient_document.read` or `patient.view`.

---

## 6. Ownership matrix

| Document category | Authoritative owner | Existing storage/API | Patient-scoped? | 360 display? | 360 upload? | 360 delete? | Permission | Required decision |
|---|---|---|---|---|---|---|---|---|
| General patient documents | MPI / patient record (**intended**) | Table exists; **no live API** | Table has `patient_id` | SOURCE GAP (honest MPI copy) | SOURCE GAP | SOURCE GAP | Catalog `patient.patient_document.*` unbound | Activate table vs new table; permission scope; MIME/size |
| Clinical documents / chart notes | Clinical | `patient-notes` | Yes | Yes (notes) | No — would create notes | No | `patient.view` / `patient.update` | Do not treat notes as file upload |
| Counselling documents | Counsellor session | `counseling_session_documents` | Via session join | Metadata yes | **No** | **No** | `session_documents.*` | Keep session-owned |
| Counselling recordings / transcripts | Counsellor conversation | `session_recordings` + `session-audio` | Via session | Not generic docs | **No** | **No** | `session_documents.create` + counselling product | Stay out of 360 General |
| Laboratory reports | Laboratory | `lab-reports` + optional `reportUrl` | Yes | Yes | **No** (would create lab row) | **No** | `patient.view` / `patient.update` | External PDF vs lab SoT |
| Imaging / scanning | Imaging / exam | order upload + 360 images GET | Yes (360 GET) | Metadata yes | **No** (needs order) | **No** | `examination.view` / `imaging.upload` | Bytes in 360 later? |
| Insurance documents | CCMS (live); legacy insurance frozen | CCMS case docs; `insurance_documents` | CCMS via case; legacy via preauth | CCMS on All only; Insurance filter SOURCE GAP | **No** from 360 | **No** | `ccms.document.*` / frozen insurance | Whether Insurance filter ever lists CCMS types |
| CCMS documents | Coverage case | `ccms-documents` blob | Via case.PatientId | Metadata yes | **No** | **No** | `ccms.document.read` (+ upload/delete intended) | Bytes/SAS in 360? (currently forbidden) |
| Registration documents | MPI demographics | Fields, not files | N/A | No | SOURCE GAP | — | — | Are ID scans in-scope for General? |
| Consent documents | Consent + IP surgical consent | JSON URLs; IP PreOpDocument | Consent by patient; IP by journey | Not in Phase D index | **No** | **No** | consent / ward.edit | Separate from General |
| IP / pre-op documents | IP / ward | `preop-documents` | Journey, not MPI API | Not indexed | **No** | **No** | ward edit | Stay in IP |
| Portal uploads | Patient portal | **SOURCE GAP** | — | No | No | No | — | If portal files exist later, index read-only |

---

## 7. Candidate API evaluation

For each candidate: Permission · Tenant · Branch · Patient authz · Ownership · Delete · Storage.

### A. Disabled `GET /patient-document-uploads/patient/{id}`

- Permission: none (no controller)  
- Tenant/branch/patient: N/A  
- Ownership: intended MPI (`PatientId`)  
- Delete/storage: N/A  
- **RED.** Collapsing 404 to empty list is already forbidden by 360 IA. Do not revive blindly.

### B. `patient_document_uploads` table + unused `patient.patient_document.*`

- Permission: catalog exists, unbound  
- Tenant: column exists; **query filter commented out**  
- Branch: **none**  
- Patient: `patient_id`  
- Ownership: MPI-shaped  
- Delete: `deleted_at` columns exist  
- Storage: `file_url` unused  
- **YELLOW** — best reuse candidate **if** a new compiled controller is written (not Phase 4 Document Sharing).

### C. CCMS `POST .../coverage-cases/{id}/documents`

- Permission: JWT only on upload function (**gap** vs `ccms.document.upload`)  
- Tenant: from coverage case  
- Branch: not on document list-by-patient  
- Patient: only via case  
- Ownership: **CCMS case**; upload replaces prior type  
- Delete: engine delete  
- Storage: `ccms-documents` + SAS  
- **RED** for 360 generic upload. **GREEN** for 360 **metadata display** (`by-patient`).

### D. Counselling `POST /api/counseling/documents/upload`

- Permission: `session_documents.create`  
- Tenant: JWT  
- Branch: none on 360 list  
- Patient: only via session  
- Ownership: **session required**  
- Delete: `session_documents.delete`  
- Storage: **placeholder path, bytes discarded**  
- **RED** for 360. Also unsafe as a real store even inside counselling until blob TODO is done.

### E. Lab `POST /api/lab-reports`

- Permission: `patient.update`  
- Creates lab SoT  
- **RED**

### F. Imaging `POST /{orderId}/upload`

- Permission: `imaging.upload`  
- Requires order  
- **RED**

### G. Insurance document POST

- Permission: `insurance.documents.upload`  
- **410 frozen**  
- **RED**

### H. IP pre-op upload

- Permission: ward edit  
- Journey ownership  
- **RED**

### I. Patient photo POST

- Permission: `patient.edit`  
- Image-only 10MB  
- **RED** (identity photo, not documents)

### J. Document Sharing `/documents/upload`

- Phase 4 excluded; HIPAA workbench model (versions, share, folders)  
- **RED** — would turn 360 into a document-management workbench

### K. Widgets / medical-records stubs

- **RED**

---

## 8. GREEN / YELLOW / RED / SOURCE GAP classification

### GREEN — safe to reuse **as-is** (display / primitives only)

- Patient 360 Documents **read index** and honesty copy (Phase D).
- `GET /ccms/documents/by-patient/{patientId}` metadata.
- `GET /api/counseling-session-documents/by-patient/{patientId}` metadata.
- Clinical notes/labs loaders and imaging 360 images GET.
- Auth `IBlobStorageService` **as a storage library**, not as photo-container semantics.
- Existing permission **codes** in seeder/CCMS SQL as catalog references.

### YELLOW — partial; needs product/API decision

- Reusing table `patient_document_uploads` for General documents.
- Binding unused `patient.patient_document.upload|read|download|delete`.
- Adding a **General** filter chip vs keeping MPI honesty on All until upload exists.
- Whether 360 may later open **authenticated** byte streams (not SAS in row) for General and/or CCMS.
- Consent `DocumentUrl` as a later index source (metadata, not upload).
- Counselling blob TODO (Counsellor module, not 360).
- CCMS upload permission enforcement gap (CCMS hardening, not 360).

### RED — must not be reused by Patient 360 upload

- Disabled `/patient-document-uploads` caller + empty-list collapse.
- Phase 4 Document Sharing workbench.
- CCMS case upload/delete/PACS/biometry from 360.
- Counselling session document POST/upload/audio/verify/delete from 360.
- Lab report create/update as “upload PDF”.
- Imaging order upload.
- Frozen insurance writes.
- IP/pre-op/ward investigation uploads.
- Patient photo endpoint.
- Widget/medical-record stubs.
- Recording/transcript pipelines.

### SOURCE GAP

- Live patient-scoped generic **POST** (multipart) bound to `patient.id`.
- Live patient-scoped generic **GET** that 360 can index without lying.
- Authorized **download/stream** for general documents.
- Authorized **delete** for general documents.
- Insurance-as-insurance patient index.
- Portal / registration file stores.
- Malware scanning.
- Branch authorization on general documents.
- Enforced MIME/size/filename policy for general documents.
- Working retention job / access-audit writer for MPI files.

---

## 9. Security gaps

Marked **DECISION REQUIRED** where no rule exists. Do not invent defaults in code until product/security signs them.

| Topic | What exists | Gap |
|---|---|---|
| Max file size | Photos 10MB; counselling upload 100MB; imaging 50MB; CCMS policy-extract 10MB; counselling audio 100MB | **No general-document limit.** DECISION REQUIRED |
| MIME / extensions | Photos: jpeg/png/webp. Counselling upload: jpg/jpeg/png/gif/pdf/doc/docx. CCMS: completeness, not a tight allow-list on case upload | **No MPI allow-list.** DECISION REQUIRED (recommend PDF + images only; reject `doc` unless justified) |
| Filename normalization | CCMS + IP sanitizers; counselling uses original + GUID path | **None for MPI.** DECISION REQUIRED |
| Malicious-file / virus scan | **None found** | SOURCE GAP / DECISION REQUIRED (scan vs magic-bytes only vs none) |
| Magic-byte validation | CCMS **frontend** retrieve path (`case-document-actions`) | Not on MPI upload |
| Storage isolation | Per-engine containers | MPI container **does not exist**. DECISION REQUIRED (`patient-documents/{tenantId}/{patientId}/…`, private) |
| Tenant isolation | JWT tenant on live 360 reads; MPI table filter **commented out** | Must enforce tenant in any new API. CERTIFIED gap on table mapping |
| Branch authorization | MPI table has no branch; CCMS/counselling 360 lists have **no branch predicate** | DECISION REQUIRED whether General docs are tenant-wide or branch-bound |
| Patient authorization | Live GETs key `patientId` + tenant | Must verify patient exists in tenant before write. DECISION REQUIRED: also `patient.view`? |
| Download authorization | CCMS `ccms.document.read`; counselling 360 does not return paths | MPI download permission unused. DECISION REQUIRED: first slice metadata-only vs stream |
| Delete authorization | Domain-specific; MPI delete permission unused | **Do not delete from 360 in first slice** (recommended). DECISION REQUIRED |
| Audit trail | Domain logs; `document_access_audit` unused | DECISION REQUIRED: write access audit on upload/download |
| Created-by / uploaded-by | Table has `uploaded_by`, `created_by_user_id` | Must populate from JWT. Proposed, not live |
| Timestamps | `uploaded_at`, `created_at` | Exist on table |
| Soft deletion | `deleted_at` columns | No live API |
| Retention | Default 2555 days on model | **Not enforced** |
| Public URL leakage | Photo/generic upload returns blob URI; CCMS prefers SAS/content | MPI must **not** put durable public URLs in 360 rows. DECISION REQUIRED: private blob + authenticated stream |
| Counsellor privilege escalation | Session create is separate from ownership APIs | 360 must not call counselling writes |
| Double-submit | CCMS replaces same slot; MPI has no idempotency | DECISION REQUIRED (client request id?) |

---

## 10. Product decisions required

1. **What may be uploaded from Patient 360?** Only MPI **General** files, or also “this is a lab PDF / insurance card” **without** creating domain records? (Audit recommendation: **General only**; type is metadata, not a lab/CCMS/session write.)
2. **Reuse `patient_document_uploads` vs new table?** Recommendation: reuse table; do not compile Phase 4 Document Sharing.
3. **Permission codes:** bind `patient.patient_document.upload` (and read) vs new codes vs `patient.update` (reject). Who is granted them (front desk, all clinical, counsellor)?
4. **Is `patient.view` enough to see General rows?** Recommendation: require `patient.patient_document.read` **or** `patient.view` — pick one; do not hide security in UI only.
5. **Download in the same slice as upload?** Recommendation: **no** — metadata + 360 index first; download is a later authorized stream.
6. **Delete from 360?** Recommendation: **no** in first slice.
7. **Filter chip “General”** vs keep MPI honesty footer until rows exist.
8. **Allowed types and max size.**
9. **Branch scope.**
10. **Whether CCMS/counselling/lab/imaging bytes ever open from 360** (today forbidden for CCMS SAS). Independent of General upload.
11. **Insurance filter:** remain source gap vs subset of CCMS document types. Do not relabel all CCMS as insurance (Phase D).
12. **Registration ID scans / consents** in General vs stay in source modules.
13. **Malware scanning** requirement.
14. **Do not revive** disabled GET; fail closed if source missing.
15. **Counsellor:** upload in 360 must not start/assign/requeue sessions or attach to a guessed “latest session”.

---

## 11. Recommended architecture

**PROPOSED FUTURE IMPLEMENTATION** (not approved by this audit):

```
Patient 360 Documents (index)
  ├─ CCMS metadata     (existing GET by patient)     [read]
  ├─ Counselling meta  (existing GET by patient)     [read]
  ├─ Notes / labs / imaging                          [read]
  └─ General MPI docs  (NEW live API on existing table) [read + optional upload]
```

- **SoT for General files:** `patient_document_uploads` + private blob object keyed by tenant + patient + document id. Frontend is not SoT.
- **SoT for other categories:** unchanged source modules.
- **Upload** writes only General rows keyed to canonical `patient.id`. `document_type` / `document_title` are metadata (`DocumentType` is free text today — **DECISION REQUIRED** to constrain values).
- **Do not** POST to CCMS, counselling, lab, imaging, insurance, or IP.
- **Auth-service** owns MPI documents (same service as patient). CCMS remains case-owned.
- **Index:** extend Phase D loader with a new GET; unauthorized → honesty copy, not “No documents”.
- **Counsellor:** no ownership side effects.

Approaches considered:

| Approach | Trade-off | Verdict |
|---|---|---|
| A. New MPI API on existing table + blob | Smallest honest store; matches product | **Recommend** |
| B. Upload into CCMS without a case / fake case | Fabricates coverage | Forbidden |
| C. Upload into counselling without session / latest session | Fabricates Counsellor ownership | Forbidden |
| D. Revive Document Sharing workbench | Turns 360 into DMS | Forbidden |
| E. New greenfield document microservice | Stack/architecture freeze | Forbidden without explicit approval |

---

## 12. Recommended UX

**PROPOSED FUTURE IMPLEMENTATION.** Evaluate only; **do not add the button now.**

Keep Phase D table:

`Document | Type | Source | Date | Status | Action`

Keep chips: `All | Clinical | Counselling | Insurance | Laboratory | Imaging`.

Add **General** only when the MPI GET exists. Terminology: table comment uses types like `insurance_card, lab_report, prescription` as **labels**, not owners. UX copy for upload category should be **General** (or “Patient document”), not “Laboratory”, unless product explicitly wants a **label-only** type that still stores as MPI.

Primary action **Upload document** — visible only with upload permission. Hidden UI is not security.

Flow (fields that the **existing table** actually supports):

1. Select file  
2. `document_type` (constrained list — DECISION REQUIRED; table is unconstrained text)  
3. Optional `document_title` (maps to `DocumentTitle`; there is **no description column** — do not invent description)  
4. Client + server validation  
5. Confirm  
6. Upload  
7. Refresh index  

Do **not** add: bulk admin, versioning, sharing workbench, CCMS case picker, session picker, delete, download (until decided), recordings.

Empty All continues to tell the truth about other sources. After General exists, MPI gap copy is replaced by General empty/unauthorized copy — **DECISION REQUIRED** on exact strings.

---

## 13. Exact files likely to change in implementation

**PROPOSED** only. Not modified in this audit.

Frontend (360 index + gated upload UI):

- `apps/hospital-portal-web/src/components/patients/record/Patient360Documents.tsx`
- `apps/hospital-portal-web/src/components/patients/record/Patient360Documents.test.tsx`
- `apps/hospital-portal-web/src/lib/patients/patient-360-documents.ts`
- New API module e.g. `apps/hospital-portal-web/src/lib/api/patient-documents.api.ts` (do not use `widgets.api` stub or `document-sharing.api.ts`)
- Permission helper usage via canonical `use-permissions.ts` / `permission-cache.ts`

Backend (new compiled controller — **not** `_Phase4_Disabled`):

- New `PatientDocumentUploadsController` (or equivalent) under `microservices/auth-service/AuthService/Controllers/`
- Possibly small `BlobStorageService` methods for a `patient-documents` container (private, tenant/patient prefix)
- Tests under `AuthService.Tests/`
- Do **not** enable `Controllers/_Phase4_Disabled/DocumentSharingController.cs`
- Do **not** modify CCMS `DocumentFunctions`, counselling session write APIs, lab/imaging/insurance/IP for this slice

Do **not** treat hidden `DocumentsTab.tsx` as the 360 UI.

---

## 14. Backend changes required, if any

**SOURCE GAP → required for a future upload slice:**

- Compiled patient-scoped GET (metadata) and POST (multipart) on auth-service.
- Tenant + patient existence checks; JWT user as `uploaded_by`.
- Private blob write; persist metadata row; soft-delete columns unused until a delete slice.
- Fail closed (no empty-list-on-404).

**Not required** for General upload: CCMS, counselling writes, lab, imaging, insurance, IP.

**CCMS permission gap** is a separate security item, not part of 360 upload.

---

## 15. Database changes required, if any

**CERTIFIED:** `patient_document_uploads` already exists.

**Likely none** if product reuses it.

**DECISION REQUIRED / possible later migrations:** `branch_id`; check constraint on `document_type`; enable global tenant query filter (currently commented — behavior change, needs approval); blob object key column if `file_url` public URI is rejected.

Do not add a second document repository table without approval.

---

## 16. Permission changes required, if any

**Do not create new permissions in the first implementation unless product rejects the unused catalog.**

**PROPOSED:** bind existing:

- Upload: `patient.patient_document.upload`
- Read/index: `patient.patient_document.read` (or `patient.view` if product says so)
- Download: `patient.patient_document.download` (later slice)
- Delete: `patient.patient_document.delete` (later slice; seeded scope branch)

**DECISION REQUIRED:** role assignment (who actually has these codes in UAT/prod). Catalog existence ≠ staff grants.

`session_documents.create` stays session-scoped. `ccms.document.upload` stays CCMS-ops/counsellor-coverage.

---

## 17. Migration requirements, if any

- **None** to “create the table” — it exists (`CompleteSchema`).
- **None** to revive Phase 4.
- Possible follow-up migration only after decisions in §15.
- No CCMS/counselling schema change for General upload.

---

## 18. Test strategy

**This audit did not run the test suite** (no code changed).

When a slice is approved, tests should include:

**Backend**

- 401/403 without permission; 404 unknown patient; tenant isolation (no cross-tenant read/write).
- POST does not insert `CounselingSession`, `LabReport`, `CcmsDocument`, imaging order, insurance, IP journey, or session assignment.
- Soft-deleted rows excluded from GET.
- File empty / oversize / disallowed MIME rejected.
- Mock counselling-style “success without persist” must **not** be copied.

**Frontend**

- Upload control absent without permission.
- General rows appear after mocked GET; MPI honesty until GET exists.
- Existing Phase D contracts remain: no `accessUrl` on CCMS rows; Insurance filter not CCMS; recordings not listed as General.
- Counsellor regression: no start/assign/requeue.

Reuse focused Patient 360 vitest pattern (`Patient360Documents.test.tsx`, backend `*PatientReadTests.cs`).

---

## 19. UAT strategy

After an approved implementation slice (not now):

- Authorized user: upload General PDF/image → row on All + General; Source = Patient documents (wording TBD); no new counselling session, CCMS case, lab, imaging order, bill, or IP journey.
- Unauthorized user: no upload; no leaked rows.
- Counsellor with session_documents but without MPI upload: cannot upload from 360; existing session docs still metadata-only.
- CCMS/lab/imaging/counselling index unchanged.
- Confirm/validation/error/retry; no double-submit success toast on failure.
- Desktop-first; do not convert Documents to a workbench.

Manual UAT of Phase D read-only remains separate and is **not claimed** here.

---

## 20. Explicit scope boundary for the future implementation slice

**In scope (proposed next slice — still requires explicit approval):**

- Product/security decisions in §10 (minimum: permission, types/size, General-only).
- Live MPI GET metadata + POST multipart for **General** documents on existing table.
- Private blob storage isolation by tenant + patient.
- Patient 360 index those rows; permission-gated Upload; refresh.
- Tests proving no source-module record fabrication.

**Out of scope (same slice):**

- Download, delete, replace, bulk, versioning, sharing, DMS.
- CCMS / counselling / lab / imaging / insurance / IP / consent / portal / recordings writes.
- Reviving Phase 4 Document Sharing or `DocumentsTab` empty-list behavior.
- New permission codes (unless catalog is rejected).
- New microservice, new toast/table stack, Clinical redesign, Coverage/Timeline phases.
- Opening CCMS SAS/`accessUrl` in 360.
- Counsellor ownership/start/assign/requeue.

**Stop rule:** if implementation cannot stay on MPI General without a coverage case or counselling session, **stop** and return to product.

---

## Appendix — evidence anchors (inspected, not modified)

- `PatientDocumentUpload.cs`, `AppDbContext` mapping + commented tenant filter  
- `AuthService.csproj` `Compile Remove` `_Phase4_Disabled`  
- `DocumentsTab.tsx`, `widgets.api.ts` `getPatientDocuments`  
- `DocumentFunctions.cs`, `DocumentEngineService.cs`  
- `CounselingController.cs` session documents; `CounselingSessionDocumentPatientReadController.cs`  
- `CounselingWorkflowService.ListMetadataByPatientIdAsync` / `CreateSessionDocumentAsync`  
- `LabReportsController.cs`, `ImagingController.cs`, `InsuranceController.cs`  
- `PreOpFunctions.UploadPreOpDocument`, IP `AzureBlobStorageService`  
- `PermissionSeeder.cs`, `127_ccms_permissions.sql`  
- `BlobStorageService.cs`, `appsettings.json` AzureBlobStorage  
- Phase D report `docs/decisions/patient-360-phase-d-documents-report.md`

---

## Final gate

**AUDIT COMPLETE**  
**IMPLEMENTATION NOT STARTED**  
**TEST STATUS:** not run (audit-only; no production files changed besides this decision document)  
**EXACT EXISTING REUSE CANDIDATES:** Phase D read index; CCMS/counselling/lab/imaging **metadata GETs**; table `patient_document_uploads`; catalog `patient.patient_document.*`; `IBlobStorageService` as a library  
**EXACT NEW CAPABILITIES REQUIRED:** compiled patient-scoped General GET+POST; private blob layout; 360 index + permission-gated upload; fail-closed errors  
**PRODUCT/SECURITY DECISIONS REQUIRED:** §10 (permission binding, General-only, MIME/size, branch, download/delete deferral, type taxonomy)  
**RECOMMENDED NEXT IMPLEMENTATION SLICE:** **D.2 — MPI General patient-document API + Patient 360 index/upload (no source-module writes, no download/delete, no Phase 4 revival)** after explicit approval of this audit  

**STOP. Do not implement anything in this task.**
