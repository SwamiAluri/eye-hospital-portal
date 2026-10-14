# L-REP-04 — Patient Portal LMS Official PDF Publication  
# Implementation Specification (Bounded / Conditional)

**Date:** 2026-10-13  
**Slice:** `L-REP-04`  
**Mode:** IMPLEMENTATION SPECIFICATION — documentation only; **not** implementation authorization  

**Depends on:**  
- [Product Decision Closure](./enterprise-lms-report-patient-portal-publication-product-decision-closure.md)  
- [Implementation Readiness Audit](./enterprise-lms-report-patient-portal-publication-readiness-audit.md)

```text
SPECIFICATION_STATUS = CONDITIONAL
PATIENT_CONTENT_PATH = BLOCKED_PENDING_BLOCKER-PP-IDENTITY-01
STAFF_PUBLICATION_PATH = DESIGNED_PENDING_IMPLEMENTATION_AUTHORIZATION
IMPLEMENTATION_NOT_AUTHORIZED
```

Proposed contracts below are **proposals** requiring confirmation at implementation time where marked open. Do not treat this document as authorization to change code, schema, permissions, or UI.

---

## 1. Goals

1. Staff can explicitly Publish / Withdraw a Released report’s **current** Official PDF for Patient Portal visibility.  
2. Patients with a **verified** exact identity linkage can list and open only their published current Official PDF via authenticated private content.  
3. Preserve CUT C/D, Pathology, Release≠publish, MODEL A currentness, fail-closed audit, no SAS/public Blob.

---

## 2. Explicit exclusions

- CUT C Download / CUT D Preview / staff Patient 360 contract changes (except optional staff Publish/Withdraw affordances on Reports UI)  
- Pathology / `/dashboard/laboratory`  
- NotificationHub / email / SMS  
- Amendments / Unrelease / Revoke / PDF history browser  
- New proxy/guardian system  
- Silent RolePermission grants  
- Treating Release or PDF generation as publish  

---

## 3. Backend components (verified paths — likely change when authorized)

| Component | Path | Change type |
| --- | --- | --- |
| `LmsReport` (+ migration **proposed**) | `microservices/laboratory-service/LaboratoryApi/Domain/LmsReport.cs` | Add publication fields **or** new entity — **proposed** |
| DbContext / migrations | `LaboratoryApi/Data/LaboratoryDbContext.cs`, `Migrations/` | **Proposed** when authorized |
| Publication service logic | Prefer extend `OfficialPdfService` or new `PortalPublicationService` under `LaboratoryApi/Services/` | New |
| HTTP functions | `LaboratoryApi/Functions/OfficialPdfFunctions.cs` or new `PortalPublicationFunctions.cs` | New routes |
| Authz constants | `LaboratoryApi/Services/LaboratoryAuthz.cs` | Add `ReportsPublish` |
| Audit action constants | `LaboratoryApi/Domain/ReportEnums.cs` | New action strings |
| Platform audit client | `LaboratoryApi/Services/PlatformAuditClient.cs` | Reuse |
| Canonical content client | `LaboratoryApi/Services/PlatformCanonicalDocumentClient.cs` | Reuse for bytes after gates |
| Permission catalogue | `auth-service/AuthService/SeedData/EnterpriseLmsReportsPermissionCatalog.cs` | Add `lms.reports.publish` |
| Permission seeder | Existing `PermissionSeeder` path used by catalogue | Seed definition only |
| Audit allowlist | `AuthService/Controllers/InternalAuditController.cs` | Allowlist new actions |
| Internal LMS content | `InternalCanonicalDocumentController.OpenLmsOfficialPdfContent` | Reuse; do not expose publicly |
| Auth permission tests | `AuthService.Tests/EnterpriseLmsReportsPermissionTests.cs` | Update expectations |
| Lab tests | `LaboratoryApi.Tests/` | New publication tests |

**Patient identity / Portal auth services:** **OPEN — blocked** until `BLOCKER-PP-IDENTITY-01` names the SoT. Do not invent UserPatient link tables here.

---

## 4. Frontend components (verified paths — likely change when authorized)

| Component | Path | Change type |
| --- | --- | --- |
| Permissions | `apps/hospital-portal-web/src/lib/lms/lms-permissions.ts` | Add `publish` |
| Reports API | `apps/hospital-portal-web/src/lib/lms/lms-reports.api.ts` | Publish/Withdraw + patient list/open clients |
| Report Detail / Workbench | `components/lms/reports/ReportDetailView.tsx`, `ReportsWorkbench.tsx` | Publish/Withdraw UI gated by permission + server eligibility |
| Capability registry copy | `lib/lms/lms-capability-registry.ts` | Update when implemented |
| FE tests | `lib/lms/enterprise-lms-reports-ui.test.ts` | Reverse “publish absent” asserts when added |
| Patient results | `app/patient/results/page.tsx` | Smallest LMS published list/open — **blocked** until identity |
| Patient login/layout | `app/patient/login/page.tsx`, `layout.tsx` | **Out of implicit scope** unless PO expands L-REP-04 for identity |

Preserve Hospital Portal design system / patient-portal scoped theme. Do not import staff LMS workbench chrome into Portal wholesale.

---

## 5. Proposed persistence (proposed until implementation authorization)

**Option P1 (preferred minimal):** columns on `lms_reports`:

| Column | Type | Notes |
| --- | --- | --- |
| `patient_portal_publication_status` | text | `None` / `Published` / `Withdrawn` (exact enum names TBD) |
| `patient_portal_published_at_utc` | timestamptz nullable | |
| `patient_portal_published_by_user_id` | uuid nullable | |
| `patient_portal_withdrawn_at_utc` | timestamptz nullable | |
| `patient_portal_withdrawn_by_user_id` | uuid nullable | |

Use existing `RowVersion` for concurrency.  
**Do not** add clinical Status values.  
**Do not** treat publication columns as Official PDF currentness SoT.

---

## 6. Proposed endpoint contracts (proposals)

Exact routes may be adjusted to match LaboratoryApi Functions conventions. Authorization and error semantics are binding intent.

### 6.1 Staff — Publish

| Field | Proposal |
| --- | --- |
| Method / route | `POST /lms/reports/{id}/patient-portal-publication/publish` |
| Auth | Staff JWT + `lms.reports.publish` |
| Body | `{ operatingBranchId, idempotencyKey }` (branch gate per staff LMS pattern) |
| Eligibility | `Status==Released` AND non-empty `BusinessReportNumber` AND `CurrentOfficialArtifactId` → Succeeded artifact with CanonicalDocumentId AND actor authorized for report operating branch |
| Success | 200 with publication DTO; audit publish action |
| Errors | 401/403; 404; 409 `invalid_state` if not eligible; 503 `audit_unavailable` if audit required-and-failed before state commit (prefer fail-closed) |
| Idempotency | Already Published + still eligible → 200 no-op |

### 6.2 Staff — Withdraw

| Field | Proposal |
| --- | --- |
| Method / route | `POST /lms/reports/{id}/patient-portal-publication/withdraw` |
| Auth | Staff JWT + `lms.reports.publish` |
| Body | `{ operatingBranchId, idempotencyKey }` |
| Effect | Status → Withdrawn; subsequent patient list/open deny |
| Idempotency | Already Withdrawn / None → 200 no-op (define precisely at implementation) |
| Audit | Distinct withdraw action |

### 6.3 Patient — List published Official PDFs

| Field | Proposal |
| --- | --- |
| Status | **BLOCKED** until identity SoT |
| Intent | Authenticated patient session → resolve linked `PatientId` **server-side** → return published reports for that PatientId only where publication active AND current Official PDF Succeeded |
| Forbidden | Accept arbitrary `patientId` from query as sole authority; return SAS/public URLs |
| Errors | 401 if unauthenticated; 403 if no verified linkage |

### 6.4 Patient — Open / download current Official PDF

| Field | Proposal |
| --- | --- |
| Status | **BLOCKED** until identity SoT |
| Intent | Same identity gate + publication active + resolve **only** `CurrentOfficialArtifactId` Succeeded + audit patient-open fail-closed + stream via private content path |
| Forbidden | Staff `lms.reports.download` as patient gate; anonymous; SAS |
| Disposition | `inline` or `attachment` — UX choice; security path identical |

### 6.5 Trust boundary

1. LaboratoryApi (or designated patient BFF) validates patient session → linked PatientId.  
2. Loads report by id + tenant; verifies `report.PatientId == linkedPatientId`.  
3. Verifies publication status Published.  
4. Resolves live `CurrentOfficialArtifactId` Succeeded + association.  
5. Writes patient-open audit (fail-closed).  
6. Opens bytes via internal Auth LMS content API (internal key) — **not** browser Blob credentials.

Caller-supplied `published=true` / `artifactId` without server re-check is forbidden.

---

## 7. Current-artifact consistency rules

| Rule | Specification |
| --- | --- |
| SoT | `LmsReport.CurrentOfficialArtifactId` only |
| Publish time | Eligible only if current Succeeded |
| After publish + regen | Portal open uses **new** current Succeeded artifact |
| Current Failed / missing | Deny open; do not serve historical Succeeded as current |
| Withdraw | Deny regardless of artifact health |
| History browser | Out of scope |

---

## 8. Permission and audit requirements

### Permission

| Item | Requirement |
| --- | --- |
| Code | `lms.reports.publish` |
| Seed | Definition only |
| Grants | **None** unless separate grant decision; never silent Admin/LabTech grants |
| FE | Add to `LMS_REPORTS_PERMISSIONS`; gate Publish/Withdraw |
| Compatibility | Confirm no historical conflicting meaning; prior docs reserved name but did not seed |

### Audit (proposed names — not yet in allowlist)

| Action (proposed) | When |
| --- | --- |
| `PUBLISH_OFFICIAL_PDF_TO_PORTAL` | Successful publish commit |
| `WITHDRAW_OFFICIAL_PDF_FROM_PORTAL` | Successful withdraw commit |
| `PATIENT_OPEN_OFFICIAL_PDF` | Before returning patient PDF bytes (fail-closed) |

Must be added to `InternalAuditController.AllowedActions` at implementation. Exact strings may be normalized to repository conventions during implementation **without** changing the distinct-action / fail-closed principles.

---

## 9. Security and privacy

- No PHI in logs/URLs/toasts beyond existing LMS patterns  
- Exact patient match only  
- Branch membership alone insufficient  
- Proxy/guardian denied (no verified Portal mechanism)  
- No SAS/public Blob  
- Fail-closed audit for protected content  
- Separate staff vs patient authorization models  

---

## 10. Automated test matrix

| ID | Assertion | Layer |
| --- | --- | --- |
| T-PP-01 | Publish rejected if not Released | Lab |
| T-PP-02 | Publish rejected without Succeeded current Official PDF | Lab |
| T-PP-03 | Release alone leaves publication None | Lab |
| T-PP-04 | Publish requires `lms.reports.publish` | Lab + Authz |
| T-PP-05 | Unauthorized role cannot publish/withdraw | Lab |
| T-PP-06 | Seed creates publish permission with **zero** role grants | Auth |
| T-PP-07 | Exact linked patient can list/open when published | Lab/Portal — after identity |
| T-PP-08 | Missing/ambiguous linkage denied | after identity |
| T-PP-09 | Branch-only principal denied | after identity |
| T-PP-10 | Proxy denied | after identity |
| T-PP-11 | Withdrawn not listable/openable | Lab |
| T-PP-12 | Stale/non-current artifact not served as current | Lab |
| T-PP-13 | Regen moves current; portal follows pointer | Lab |
| T-PP-14 | Audit failure → no bytes | Lab |
| T-PP-15 | Anonymous / cross-patient denied | Lab |
| T-PP-16 | Response/body contains no SAS/public Blob URL | Lab/FE |
| T-PP-17 | Pathology association domain unused | Lab |
| T-PP-18 | Concurrent publish/withdraw + retry idempotency | Lab |

---

## 11. Manual UAT

See readiness audit §8 (UAT-PP-01…15). User-executed after implementation. Not claimed here.

---

## 12. Rollback and deployment considerations

| Topic | Guidance |
| --- | --- |
| Schema | Additive publication columns/table; nullable/default None — reversible by ignoring feature flags if introduced |
| Permission seed | Additive catalogue row; removing grants is ops (none expected initially) |
| Audit allowlist | Additive; deploy Auth before Lab emits new actions |
| Feature exposure | Prefer ship staff Publish behind permission (no grants ⇒ UI hidden) until UAT grants |
| Patient APIs | Do not enable until identity blocker cleared |
| Rollback runtime | Withdraw all / stop routing Portal to LMS APIs; does not delete Official PDF artifacts |

---

## 13. Open items (do not invent)

| ID | Open item |
| --- | --- |
| O-PP-01 | Patient Portal auth + identity linkage SoT (`BLOCKER-PP-IDENTITY-01` **OPEN**) — see [identity readiness audit](./enterprise-lms-patient-portal-identity-readiness-audit.md) + [PD-ID-* package](./enterprise-lms-patient-portal-identity-decision-package.md); Option A rejected; Option B `L-PORTAL-01` provisional recommended |
| O-PP-02 | Final HTTP route names / DTO shapes |
| O-PP-03 | Final audit action string literals |
| O-PP-04 | Publication status enum naming |
| O-PP-05 | Whether publish/withdraw require audit success before or after DB commit (prefer: no published visibility without successful audit trail — align with fail-closed culture) |
| O-PP-06 | Role grant matrix for UAT/production (`GRANT-PP-05`) |
| O-PP-07 | Exact Portal UI composition vs mock results coexistence labeling |

---

## 14. Status stamps

```text
L_REP_04_IMPLEMENTATION_SPECIFICATION_RECORDED
SPECIFICATION_STATUS = CONDITIONAL
BLOCKER-PP-IDENTITY-01 = UNRESOLVED
IMPLEMENTATION_NOT_AUTHORIZED
DOCUMENTATION_ONLY
NEXT_GATE = PRODUCT_OWNER_DECISION_ON_BLOCKER-PP-IDENTITY-01
THEN = IMPLEMENTATION_AUTHORIZATION_IF_CLEARED
```

---

## 15. Mandatory stop

**STOP.** Do not implement from this specification until Product Owner clears identity blocker and issues explicit implementation authorization.
