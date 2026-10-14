# L-REP-04 — Patient Portal LMS Official PDF Publication  
# Implementation Readiness Audit

**Date:** 2026-10-13  
**Slice:** `L-REP-04` — Patient Portal Official PDF Publication  
**Mode:** IMPLEMENTATION READINESS AUDIT ONLY — documentation  

**This task does not implement L-REP-04.**  
No application source, schema, migrations, APIs, UI, permissions, role grants, Pathology, Portal runtime, CUT C/D contracts, or acceptance claims were modified by this audit.

**Product Decision Closure:** [enterprise-lms-report-patient-portal-publication-product-decision-closure.md](./enterprise-lms-report-patient-portal-publication-product-decision-closure.md) (`PRODUCT_DECISIONS_CLOSED_L_REP_04_AUTHORIZED`)  
**Implementation specification (conditional):** [enterprise-lms-report-patient-portal-publication-implementation-specification.md](./enterprise-lms-report-patient-portal-publication-implementation-specification.md)  
**Identity blocker follow-up:** [enterprise-lms-patient-portal-identity-readiness-audit.md](./enterprise-lms-patient-portal-identity-readiness-audit.md) · [decision package](./enterprise-lms-patient-portal-identity-decision-package.md) · [PO decision review](./enterprise-lms-patient-portal-identity-product-decision-review.md) · [conditional prerequisite spec](./enterprise-lms-patient-portal-identity-prerequisite-specification.md)  
(`BLOCKER-PP-IDENTITY-01` remains **OPEN**; Option B `L-PORTAL-01` — [bounded plan](./enterprise-lms-patient-portal-identity-bounded-implementation-plan.md) recorded, awaiting explicit approval; runtime **NOT_STARTED**; L-REP-04 **implementation NOT AUTHORIZED**; PD-PP-01…12 preserved)

---

## 1. Readiness classification

```text
READINESS = BLOCKED_PENDING_PRODUCT_OR_POLICY_DECISION
```

| Classification | Applicability |
| --- | --- |
| `BLOCKED_PENDING_PRODUCT_OR_POLICY_DECISION` | **SELECTED** — PD-PP-11 safe access cannot be implemented: no verified Patient Portal authenticated identity ↔ patient-record linkage exists |
| `READY_FOR_IMPLEMENTATION_READINESS_REVIEW` | Partial — staff Publish/Withdraw design is largely specified; overall slice not ready |
| `SPECIFICATION_INCOMPLETE` | Patient content-delivery wire contract incomplete until identity SoT exists |
| `READY_FOR_IMPLEMENTATION_AUTHORIZATION` | **Not met** |

**Documentation closure does not authorize implementation.**

---

## 2. Authoritative baselines

| Item | Stamp / evidence |
| --- | --- |
| CUT D accepted | `ACCEPTED_L_REP_03_CUT_D` — Portal OUT (`PD-D-14`) |
| CUT C Download | `ACCEPTED_L_REP_03_CUT_C` — frozen |
| Currentness | `LmsReport.CurrentOfficialArtifactId` MODEL A |
| PD-PP-* | `PRODUCT_DECISIONS_CLOSED_L_REP_04_AUTHORIZED` |
| Portal results | Mock only — `apps/hospital-portal-web/src/app/patient/results/page.tsx` |
| Portal login | Simulated — `apps/hospital-portal-web/src/app/patient/login/page.tsx` |

---

## 3. Evidence inventory (repository-verified)

### 3.1 Report lifecycle and Official PDF

| Fact | Path / evidence |
| --- | --- |
| Status Draft → Final → Released | `LaboratoryApi/Domain/LmsReport.cs`, `ReportStatuses` |
| `CurrentOfficialArtifactId` | `LmsReport.CurrentOfficialArtifactId` — sole current pointer |
| Staff download eligibility | `OfficialPdfService.DownloadAsync` — Released + business number + Succeeded current artifact + CanonicalDocumentId + branch + `lms.reports.download` + audit fail-closed before bytes |
| Staff preview | **No separate preview API** — FE calls same `GET .../official-pdf` download (`lms-official-pdf-preview-eligibility.ts` is client hint only) |
| List eligibility flag | `OfficialPdfDownloadEligible` on list DTO — projection hint; comment: not a security gate (`ReportDtos.cs`) |
| Staff generate / P360 list | `OfficialPdfFunctions.cs` routes `official-pdf/generate`, `current-official-pdfs`, `official-pdf`; P360 list is **staff** JWT + `lms.reports.view`/`manage`, not patient publication |
| Publication / Published / PortalVisible fields | **Absent** on `LmsReport` (grep: no Publish/Published/PortalVisible in LaboratoryApi domain) |
| Comment on Official PDF functions | “No patient publication” (`OfficialPdfFunctions.cs`) |

### 3.2 Permissions

| Fact | Path / evidence |
| --- | --- |
| Seeded report codes | `EnterpriseLmsReportsPermissionCatalog.cs` — view/manage/finalize/release/download/assign_number/generate |
| Explicit exclusion | Comment: “Do not seed lms.reports.publish” |
| Auth tests | `EnterpriseLmsReportsPermissionTests.cs` — asserts publish **not** in catalogue |
| FE constants | `lms-permissions.ts` — no publish; `enterprise-lms-reports-ui.test.ts` asserts absence |
| LaboratoryAuthz | `LaboratoryAuthz.cs` — no `ReportsPublish` constant |
| Role grants | Catalogue seed creates permissions with **empty** RolePermissions (same pattern as other report codes) |

### 3.3 Audit

| Fact | Path / evidence |
| --- | --- |
| Internal audit API | `AuthService/Controllers/InternalAuditController.cs` — `POST /api/internal/audit`, allowlisted actions |
| Staff Official PDF actions | `REQUEST_OFFICIAL_PDF`, `OFFICIAL_PDF_GENERATED`, `OFFICIAL_PDF_FAILED`, `DOWNLOAD_OFFICIAL_PDF` |
| Publish / withdraw / patient-open actions | **Absent** from allowlist and `ReportAuditActions` |
| Fail-closed download | `OfficialPdfService.DownloadAsync` catch → `503` `audit_unavailable` before `OpenOfficialPdfContentAsync` |
| Platform client | `LaboratoryApi/Services/PlatformAuditClient.cs` |

### 3.4 Content delivery / storage

| Fact | Path / evidence |
| --- | --- |
| Association | `enterprise_lms` / `LmsReportOfficialPdfArtifact` / artifactId |
| Internal open | `InternalCanonicalDocumentController.OpenLmsOfficialPdfContent` — `POST .../lms-official-pdf/content`, internal key, private Blob, no SAS |
| Lab client | `PlatformCanonicalDocumentClient.OpenOfficialPdfContentAsync` |
| Patient-session content API for LMS Official PDF | **Absent** |

### 3.5 Patient Portal identity and UI

| Fact | Path / evidence |
| --- | --- |
| Login | `patient/login/page.tsx` — simulated delay; “Demo: accept any email/password”; no AuthService call; no token persistence under `src/app/patient` |
| Layout patient | Hardcoded `PAT-001` / mock MRN — `patient/layout.tsx`; logout is route-only (no session clear) |
| Results | `mockResults` hardcoded — `patient/results/page.tsx`; does not import `patient-portal.api` / LMS APIs |
| FE portal client stubs | `lib/api/patient-portal.api.ts` declares `/portal/auth/*`, `/portal/documents`, `/portal/health-records/lab-results` — **not used** by `/patient/*` routes |
| Compiled `/portal/*` backend | **Not found** under AuthService / microservices |
| Staff portal-registration client | `patients-enhanced.api.ts` references `portal-user` / `portal-registration` — **no** matching AuthService controller endpoints found |
| Staff Portal Access UI | `PortalAccessTab.tsx` — “Phase 5 Feature - PatientPortalController” stub |
| Staff JWT claims | `JwtService.cs` — user/tenant/roles/permissions; **no `patientId` claim** |
| `AppUser` | Has `UserType` (comment mentions Patient) and `BranchId`; **no `PatientId` property** linking to MPI |
| JWT patient portal linkage to `Patient.Id` GUID | **Not found** as a verified, server-enforced Portal session binding |
| Proxy/guardian Portal authorization | **Not found**. Patient demographic `Guardian*` / family fields and counselling guardian signature exist — **not** Portal access control |
| Cross-branch Portal visibility policy | **Not found** for Patient Portal |
| Staff vs patient surfaces | Dashboard/admin “Patient Portal” pages (`/dashboard/patient-portal`, `/admin/patient-portal`) are separate staff/admin shells with simulated or client-only calls — **not** authenticated patient publication |

### 3.6 Staff LMS UI (reference only)

| Fact | Path / evidence |
| --- | --- |
| Reports workbench / detail | `components/lms/reports/*` |
| API client | `lib/lms/lms-reports.api.ts` — download + P360 list; no publish |
| Capability copy | `lms-capability-registry.ts` — “Patient publication not implemented” |

### 3.7 Tests / UAT (baseline — not re-run)

| Fact | Evidence |
| --- | --- |
| Official PDF BE tests | `OfficialPdfServiceTests.cs` (CUT D recorded 37 passed historically) |
| FE reports UI tests | `enterprise-lms-reports-ui.test.ts` (includes publish absence assert) |
| This task | **No application tests executed** |

---

## 4. Audit areas A–G

### A. Report lifecycle and artifact currentness

| Topic | Finding |
| --- | --- |
| Released representation | `Status == "Released"` + `ReleasedAtUtc` / `ReleasedByUserId` |
| Successful Official PDF | Artifact `Status == Succeeded` + `CanonicalDocumentId`; job Succeeded |
| Current pointer | `CurrentOfficialArtifactId` set only after successful generation |
| Server eligibility for staff download | Implemented (Released + number + Succeeded current + association + branch + permission + audit) |
| Publication eligibility (proposed) | Must require Released + Succeeded current Official PDF; **must not** treat Release alone as published |
| Stale after regeneration | MODEL A: pointer moves to new Succeeded artifact; prior Succeeded retained. **Proposed invariant for published reports:** Portal always resolves via **current** pointer + Succeeded; if current missing/Failed, deny open/list even if publication flag remains until withdraw or explicit repair policy. |
| Gap | No publication flag/state today |

### B. Publication state

| Topic | Finding |
| --- | --- |
| Existing model reuse | **None suitable** found |
| Minimal proposed persistence (not implemented) | On `LmsReport` (or dedicated publication row keyed by ReportId): `IsPublishedToPatientPortal` (or status enum Published/Withdrawn), `PublishedAtUtc`, `PublishedByUserId`, `WithdrawnAtUtc`, `WithdrawnByUserId`, optional `PublishedCurrentArtifactId` snapshot for audit; **eligibility always re-checks live `CurrentOfficialArtifactId`** |
| Required behaviors | Explicit Publish; explicit Withdraw; idempotent re-publish when already published (no-op success); idempotent re-withdraw; concurrent publish/withdraw serialization (row version / transaction); publication state ≠ clinical Status |
| Forbidden | New clinical Status values replacing Draft/Final/Released; silent publish on Release/PDF |

### C. Patient identity and access control — **BLOCKER**

| Check | Result |
| --- | --- |
| Authenticated Portal user representation | **Mock UI only** — no production patient JWT session found for `/patient/*` |
| Link to patient record | Hardcoded display identity; **not** linked to MPI `PatientId` GUID |
| Unique / verified / server-enforced | **No** |
| Exact-patient API enforcement | **Cannot** without identity SoT |
| Missing / ambiguous / invalid linkage | Must fail closed (PD-PP-11) — today there is nothing to evaluate |
| Cross-branch policy | **None** for Portal — branch alone must not grant access |
| Verified proxy/guardian | **None** — deny proxy access in L-REP-04 |
| Browser-supplied patient id | Must never authorize alone |

**Blocker ID:** `BLOCKER-PP-IDENTITY-01` — **OPEN** (not resolved by documentation alone)  
**Why it blocks:** PD-PP-11 requires exact linked patient access. Repository has no verified linkage mechanism; implementing Portal PDF access would require inventing identity/auth — forbidden.  
**Follow-up audit:** [enterprise-lms-patient-portal-identity-readiness-audit.md](./enterprise-lms-patient-portal-identity-readiness-audit.md) — **Option A rejected**; **Option B** separate prerequisite (`L-PORTAL-01` provisional) **recommended**; **Option C** interim deferral of L-REP-04 until prerequisite done.  
**Smallest decision to resolve:** Product Owner decisions on **PD-ID-*** in [enterprise-lms-patient-portal-identity-decision-package.md](./enterprise-lms-patient-portal-identity-decision-package.md) (packaging, account creation, verification, cardinality, ownership, staff/patient separation). Do not invent those policies.

### D. Content delivery and storage

| Topic | Finding |
| --- | --- |
| Byte path (staff) | LaboratoryApi Download → audit → internal Auth `lms-official-pdf/content` → private Blob |
| Patient path | **Absent** — must not reuse staff `lms.reports.download` as patient authority |
| Trust boundary (proposed) | Content service (or LaboratoryApi patient endpoint) must independently verify: authenticated patient session → linked PatientId → report.PatientId match → publication active → current Succeeded artifact → then open bytes. Must not trust client “published=true” or raw artifactId alone without server checks |
| SAS/public | Forbidden (PD-PP-06); internal open path already private |

### E. Permissions and audit

| Topic | Finding |
| --- | --- |
| Permission definition | Add `lms.reports.publish` to catalogue + FE + LaboratoryAuthz (approved) |
| Seed | Required at implementation; must remain **grant-free** unless separate grant decision |
| Role grants | **Not authorized** by PD-PP-05; current evidence: no grants for other report codes either |
| Audit actions | Propose new allowlisted actions (names TBD at implementation, examples for design only): `PUBLISH_OFFICIAL_PDF_TO_PORTAL`, `WITHDRAW_OFFICIAL_PDF_FROM_PORTAL`, `PATIENT_OPEN_OFFICIAL_PDF` — **not present today** |
| Fail-closed | Required for patient content open (mirror staff download) |

### F. Patient Portal UI

| Topic | Finding |
| --- | --- |
| Routes | `/patient/results` (mock), layout nav present |
| Design system | Patient portal scoped theme — preserve; do not merge staff LMS workbench patterns wholesale |
| Smallest proposed UI change | Replace mock results section (or add adjacent “Laboratory reports (Enterprise LMS)” list) that calls real APIs **only after identity exists**; list published current Official PDFs for linked patient; open via authenticated blob/object-URL; label source as Enterprise LMS; leave unrelated mock modules untouched unless identity work replaces them |
| Do not | Replace entire Portal; alter Pathology; change staff Reports contracts |

### G. Data integrity and concurrency

| Scenario | Expected / gap |
| --- | --- |
| Concurrent Publish | Serialize on report row; second publish idempotent success if already published and still eligible |
| Concurrent Withdraw | Serialize; second withdraw idempotent |
| PDF regeneration while published | Portal follows `CurrentOfficialArtifactId`; open denied if current not Succeeded |
| Missing / superseded artifact | Deny open; list omit or show unavailable — **exact UX = implementation decision**, security deny required |
| Audit failure | No bytes |
| Authorization failure | 401/403; no bytes |
| Duplicate retries | Idempotency keys recommended for publish/withdraw mutations (pattern exists for generate/release) |
| Gap | Exact idempotency operation names — technical at implementation |

---

## 5. Residual product / policy decisions (blocking or grant)

| ID | Decision needed | Blocks implementation? |
| --- | --- | --- |
| `BLOCKER-PP-IDENTITY-01` | How/when Patient Portal authenticated identity ↔ exact PatientId is established (prerequisite vs in-slice vs defer) | **Yes** |
| `GRANT-PP-05` | Which roles get `lms.reports.publish` in which environments | Blocks **production enablement / UAT role setup**, not necessarily catalogue+code scaffolding; must not silent-grant |
| Cross-branch Portal visibility beyond “branch alone insufficient” | None found — keep deny-by-default; escalate only if multi-branch patient Portal access is required later | No for conservative baseline |

---

## 6. In / out of scope (readiness)

Aligned with Product Decision Closure §6. Portal publication remains a **prospective** slice separate from accepted CUT D.

---

## 7. Automated test plan (required when implementation authorized)

Locations (existing patterns):

| Layer | Likely location |
| --- | --- |
| LaboratoryApi unit/integration | `LaboratoryApi.Tests` (extend `OfficialPdfServiceTests` or new `PortalPublication*Tests`) |
| Auth permission seed | `AuthService.Tests/EnterpriseLmsReportsPermissionTests.cs` |
| Auth audit allowlist | Existing InternalAudit tests pattern (if present) / new facts for allowed actions |
| FE permissions / UI gating | `apps/hospital-portal-web/src/lib/lms/*.test.ts`; Portal page tests when real APIs exist |
| Concurrency | Prefer service-level tests; Postgres suite remains deferred pattern from CUT D P3 |

**Must cover:** all items in Product Decision Closure §10 (eligibility, Release≠publish, permission, no implicit grants, exact patient, linkage deny, branch alone, proxy deny, withdraw, stale artifact, regeneration, audit fail-closed, anonymous/cross-patient, no SAS, Pathology unaffected, permission separation, concurrency/retry).

**This audit did not run tests.**

---

## 8. Manual UAT plan (required after implementation — user-executed)

| ID | Setup | Steps | Expected | Evidence to capture |
| --- | --- | --- | --- | --- |
| UAT-PP-01 | Released + Succeeded current Official PDF; staff with `lms.reports.publish` | Publish | Success; audit publish | API status; audit action id if available |
| UAT-PP-02 | Released; no/failed current Official PDF | Attempt Publish | Rejected / unavailable | Status code / UI disabled + API 409 |
| UAT-PP-03 | Unreleased report | Attempt Publish | Rejected | 409 |
| UAT-PP-04 | Staff without `lms.reports.publish` | Publish / Withdraw | Denied | 403 |
| UAT-PP-05 | Linked patient A; published report for A | Patient lists/opens | Sees own LMS report only | UI + Network |
| UAT-PP-06 | Patient B session | Alter id/URL toward A’s report | Denied | 403/404; no bytes |
| UAT-PP-07 | Session without verified linkage | Access publication APIs | Denied | 401/403 |
| UAT-PP-08 | User with branch membership only (no patient link) | Access | Denied | 403 |
| UAT-PP-09 | Published then Withdraw | Portal list + open | Not discoverable; open denied | UI empty + API deny |
| UAT-PP-10 | Patient previously downloaded | Withdraw after download | Portal blocked; **document** prior file retained locally | Acknowledgement note |
| UAT-PP-11 | Regenerate Official PDF while published | Open from Portal | Current artifact per pointer; prior not offered as current | Artifact ids |
| UAT-PP-12 | Force audit failure (controlled UAT env) | Patient open | No PDF bytes; fail-closed | 503/deny |
| UAT-PP-13 | Anonymous / Network inspection | Open/list | No anonymous; no SAS/public Blob URL | Network HAR redacted |
| UAT-PP-14 | Pathology workflows | Smoke `/dashboard/laboratory` / LabReport paths | Unchanged | Confirmation |
| UAT-PP-15 | Existing Portal non-LMS surfaces | Appointments etc. | Unchanged (except intentional LMS results slice) | Confirmation |

UAT must be performed by the user after implementation. Automated tests do not substitute Manual UAT.

---

## 9. Proposed implementation scope summary

**Can be designed now (staff side):** publication state, publish/withdraw APIs, `lms.reports.publish` catalogue (no grants), audit action allowlist additions, staff UI Publish/Withdraw, tests for eligibility/authz.

**Blocked for safe patient side:** authenticated patient list/open until `BLOCKER-PP-IDENTITY-01` resolved.

**Exclusions:** CUT C/D reopen; Pathology; notifications; amendments; unrelease; history browser; SAS; new proxy system; silent role grants.

---

## 10. Status stamps

```text
PRODUCT_DECISIONS_CLOSED_L_REP_04_AUTHORIZED
L_REP_04_IMPLEMENTATION_READINESS_AUDIT_COMPLETE
READINESS = BLOCKED_PENDING_PRODUCT_OR_POLICY_DECISION
BLOCKER-PP-IDENTITY-01 = PATIENT_PORTAL_IDENTITY_LINKAGE_ABSENT
PROXY_GUARDIAN_PORTAL_AUTHZ = ABSENT_DENY
PUBLICATION_STATE_MODEL = ABSENT_PROPOSED
LMS_REPORTS_PUBLISH = ABSENT_APPROVED_TO_ADD_NO_GRANTS
IMPLEMENTATION_NOT_AUTHORIZED
ACCEPTED_L_REP_03_CUT_D = PRESERVED
CUT_C_UNCHANGED
LEGACY_PATHOLOGY_UNCHANGED
PATIENT_PORTAL_RUNTIME_UNCHANGED_BY_THIS_AUDIT
NO_APPLICATION_TESTS_EXECUTED_IN_THIS_TASK
NEXT_GATE = PRODUCT_OWNER_RESOLVE_PENDING_DETAIL_THEN_FORMAL_CLOSURE
BLOCKER-PP-IDENTITY-01 = OPEN
```

---

## 11. Exact next action

Product Owner must resolve blocking **PENDING_DETAIL** on L-PORTAL-01 ([identity decision package](./enterprise-lms-patient-portal-identity-decision-package.md)), then formal identity closure → identity implementation authorization → acceptance → separate L-REP-04 authorization.  
Until then: **do not implement** Portal identity or patient PDF publication.
