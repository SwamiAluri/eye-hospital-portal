# Slice 4 — Laboratory Canonical Document Integration

Date: 2026-10-07  
Status: **IMPLEMENTATION COMPLETE — MANUAL UAT REQUIRED**  
Prerequisite: Slice 3A / 3B accepted  
Principle: **Document attachment ≠ Laboratory clinical completion**  
UAT blocker follow-up: [slice-4-laboratory-uat-blocker-addendum.md](./slice-4-laboratory-uat-blocker-addendum.md)

```text
AUTOMATED TESTS: PASS
MANUAL UAT: REQUIRED
ACCEPTANCE: NOT CLAIMED
NEXT SLICE: NOT STARTED
```

---

## 1. Scope implemented

Bounded Lab report file attachment for existing `LabReport` records via the shared canonical document platform, plus Patient 360 Laboratory content actions and All-tab canonical identity participation.

Does **not** include Imaging, IP/OT, mock `/dashboard/laboratory` rebuild, ReportUrl migration, replacement/versioning, or new permissions.

## 2. Product decisions implemented

| ID | Decision | Implemented |
|---|---|---|
| D1 | Attach on Patient Record document surface for existing LabReport | Yes — Patient 360 **Documents → Laboratory** (Clinical → Laboratory is clinical-only; see UAT-blocker addendum §10) |
| D2 | Leave `ReportUrl` unchanged | Yes |
| D3 | At most one active canonical attachment; same bytes idempotent; different bytes → 409 | Yes |
| D4 | `patient.update` attach; `patient.view` content | Yes |
| D5 | `domain=lab`, `entityType=LabReport` | Yes |
| D6 | Canonical `patient-documents` via `ICanonicalDocumentIdentityService` | Yes |
| D7 | Attach does not change Status / results / ReportUrl | Yes |

## 3. Backend changes

- `LabReportCanonicalDocumentService` — attach, populate metadata, open content
- `LabReportsController` — `POST {id}/attach-report`, `GET {id}/report/content`; list/get populate canonical metadata
- Association constants: `lab` / `LabReport`
- DI registration in `Program.cs`
- No clinical Complete path invoked from attach

## 4. Frontend changes

- `LabReportsTab` + `LabAttachReportDialog` — Attach Report (gated by `patient.update`)
- `lab-reports.api.ts` — `attachReport`, `downloadLabReportContent`
- Patient 360 Documents Laboratory — Preview / Download / Print for canonical attachment; Open report preserved for http(s) `ReportUrl`
- Patient 360 All — Lab `canonicalDocumentId` participates in existing exact-identity dedupe
- Generic Upload Document → Laboratory remains `writable: false`
- Mock `/dashboard/laboratory` untouched

## 5. API routes added/changed

| Method | Route | Permission |
|---|---|---|
| POST | `/api/lab-reports/{id}/attach-report` | `patient.update` |
| GET | `/api/lab-reports/{id}/report/content` | `patient.view` |
| GET | `/api/lab-reports/patient/{patientId}` | `patient.view` (now includes canonical metadata) |
| GET | `/api/lab-reports/{id}` | `patient.view` (now includes canonical metadata) |

Conflict response (different file already attached):

```json
{ "code": "lab_report_attachment_exists", "message": "...", "existingCanonicalDocumentId": "..." }
```

## 6. Permission behavior

- Attach: `patient.update` only (no new codes)
- Content / metadata visibility: `patient.view`
- Canonical document id alone does **not** grant Lab content access (association + LabReport tenant/patient checks required)
- Does **not** accept `patient.patient_document.download` for Lab content

## 7. Canonical identity behavior

- SHA-256 of actual uploaded bytes (lowercase hex)
- Identity: TenantId + PatientId + ContentHash
- `ResolveOrCreate` then `EnsureAssociation`
- Exact-byte reuse across General / Counselling / CCMS / Lab

## 8. Association behavior

- `domain = lab`
- `entityType = LabReport`
- `entityId = LabReport.Id`
- One active attachment per LabReport
- Same content hash → idempotent success
- Different content → conflict; no silent replace

## 9. ReportUrl behavior

- Never written by attach
- Historical http(s) Open report preserved alongside Attached Report actions when both exist

## 10. Clinical workflow preservation

Attach does not modify:

- `Status`
- `ResultValue` / unit / range / interpretation
- `CompletedAt`
- `VerifiedByName`
- `ReportUrl`

Does not call `Complete`.

## 11. Patient 360 changes

- Laboratory tab already enabled — extended with authenticated Preview/Download/Print when association exists
- All-tab dedupe includes Lab canonical ids (General/Counselling/CCMS precedence unchanged via merge order)
- Generic Laboratory upload remains unavailable

## 12. Database / migrations

**None.** Reused existing `canonical_documents` + `canonical_document_associations`.

`LabReport` gained NotMapped read fields only (`CanonicalDocumentId`, `CanonicalFileName`, `CanonicalMimeType`).

## 13. Automated tests added

### Backend — `LabReportCanonicalDocumentTests.cs`

Attach, auth attributes, tenant isolation, soft-delete, hash reuse, conflict, clinical field preservation, content open guards, populate metadata, controller 409.

### Frontend

- `LabReportsTab.test.tsx` — Attach Report on live tab; absent from mock laboratory page
- `Patient360Documents.test.tsx` — dual actions + All dedupe with Lab
- Existing clinical / document-area fixtures updated for new Lab row fields

## 14. Automated test commands

```text
dotnet test microservices/auth-service/AuthService.Tests/AuthService.Tests.csproj --filter "FullyQualifiedName~LabReportCanonicalDocumentTests"

cd apps/hospital-portal-web
npx vitest run src/components/patients/tabs/LabReportsTab.test.tsx src/components/patients/record/Patient360Documents.test.tsx src/lib/patients/patient-360-clinical.test.ts src/lib/patients/patient-360-document-areas.test.ts
```

Regression (3A/3B document suites):

```text
dotnet test ... --filter "FullyQualifiedName~CounselingSessionDocumentCanonicalTests|FullyQualifiedName~CanonicalDocumentApiTests|FullyQualifiedName~InternalCanonicalDocumentControllerTests"
```

## 15. Automated test results

| Suite | Result |
|---|---|
| `LabReportCanonicalDocumentTests` | **PASS** — Failed: 0, Passed: 18, Skipped: 0 |
| Focused vitest (Lab + P360 documents + clinical + areas) | **PASS** — 34 tests |
| Note | AuthService process lock required stopping PID 204 to rebuild; environment issue, not product failure |

## 16. Files changed

### Backend

- `AuthService/Models/Domain/CanonicalDocument.cs`
- `AuthService/Models/Domain/LabReport.cs`
- `AuthService/Services/LabReportCanonicalDocumentService.cs` (new)
- `AuthService/Controllers/LabReportsController.cs`
- `AuthService/Program.cs`
- `AuthService.Tests/LabReportCanonicalDocumentTests.cs` (new)

### Frontend

- `apps/hospital-portal-web/src/lib/api/lab-reports.api.ts`
- `apps/hospital-portal-web/src/components/patients/tabs/LabReportsTab.tsx`
- `apps/hospital-portal-web/src/components/patients/tabs/LabAttachReportDialog.tsx` (new)
- `apps/hospital-portal-web/src/components/patients/tabs/LabReportsTab.test.tsx` (new)
- `apps/hospital-portal-web/src/lib/patients/patient-360-clinical.ts`
- `apps/hospital-portal-web/src/lib/patients/patient-360-clinical.test.ts`
- `apps/hospital-portal-web/src/components/patients/record/Patient360Documents.tsx`
- `apps/hospital-portal-web/src/components/patients/record/Patient360Documents.test.tsx`
- `apps/hospital-portal-web/src/components/patients/record/Patient360Clinical.test.tsx`
- `apps/hospital-portal-web/src/components/patients/record/Patient360ImagingFiles.test.tsx`

### Docs

- `docs/decisions/slice-4-laboratory-document-implementation.md` (this file)

## 17. Known limitations

- `/dashboard/laboratory` remains mock (out of scope)
- No replace / multi-file / versioning for Lab attachments
- Historical external `ReportUrl` is not auto-canonicalized
- Soft-deleted LabReports cannot receive attachments (EF query filter)
- Lab has no branch field — none invented
- Content actions require `patient.view`; users without it see metadata without Preview/Download/Print

## 18. Manual UAT checklist

### UAT-1

Open a real patient record → Clinical → Laboratory. Verify clinical LabReport fields (no Attach Report).

### UAT-2

Patient 360 → Documents → Laboratory → LabReport with no canonical attachment → Attach Report → upload valid PDF.  
Expect: success; Status/results/ReportUrl unchanged; attachment visible.

### UAT-3

Same Documents → Laboratory row → Preview / Download / Print for the attachment.

### UAT-4

If ReportUrl exists, Open report still works; both sources distinguishable when both present.

### UAT-5

Re-upload exact same bytes → no second canonical identity; idempotent.

### UAT-6

Attach a different file to an already-attached LabReport → rejected; original intact.

### UAT-7

Patient 360 → Documents → All → Lab participates in canonical dedupe.

### UAT-8

Patient 360 → Upload Document → Laboratory remains unavailable.

### UAT-9

`/dashboard/laboratory` unchanged by this slice.

### UAT-10

General / Counselling / CCMS Insurance flows still work.

## 19. Explicit out-of-scope confirmation

Not implemented: mock laboratory rebuild, Imaging, IP/OT, CCMS/Counselling changes, generic P360 Lab upload, Lab blob container, new identity service, new permissions, ReportUrl migration, bulk historical canonicalization, replacement/versioning, multi-file attachments, clinical completion changes, retention, malware, platform refactor.

## 20. Security / authorization check

- No public blob / SAS URL introduced
- Content endpoint requires auth + tenant + LabReport + lab association + `patient.view`
- No new permission codes
- PatientId taken from LabReport entity, not client body
- Canonical id alone cannot open Lab content

---

```text
AUTOMATED TESTS: PASS
MANUAL UAT: REQUIRED
ACCEPTANCE: NOT CLAIMED
STOP.
```
