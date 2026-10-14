# L-REP-02B — Report Release  
## Discovery / Audit

**Date:** 2026-10-12  
**Mode:** DISCOVERY / AUDIT ONLY — no code, schema, migrations, APIs, UI, permission seeds/grants, audit allowlist changes, ResultStatus, Notification, PDF, numbering, CanonicalDocument, Patient Portal/360, Pathology, Amendments, or Release implementation  
**Slice:** L-REP-02B — Report Release (Final → Released)  
**Upstream acceptance:** `ACCEPTED_L_REP_02A` — [enterprise-lms-report-finalization-acceptance-closure.md](./enterprise-lms-report-finalization-acceptance-closure.md)  
**Upstream product stamps:** `PRODUCT_DECISIONS_CLOSED_L_REP_01_AUTHORIZED`, `PRODUCT_DECISIONS_CLOSED_L_REP_02A_AUTHORIZED`  
**Companion decision package:** [enterprise-lms-report-release-decision-package.md](./enterprise-lms-report-release-decision-package.md)  
**Supersedes for Release-only discovery:** Combined L-REP-02 Final+Release discovery ([enterprise-lms-report-final-release-discovery-audit.md](./enterprise-lms-report-final-release-discovery-audit.md)) — re-audited after L-REP-02A acceptance; do not treat that document’s “Finalize absent” sections as current.

---

## 1. Date / scope

| Item | Value |
| --- | --- |
| Date | 2026-10-12 |
| Scope | Discover what is required for **Final → Released** on LaboratoryApi `LmsReport` |
| Authorized outputs | This audit + Product Decision Package |
| Implementation | **Forbidden** in this task |

---

## 2. Accepted L-REP-02A baseline

| Capability | Status |
| --- | --- |
| `LmsReport.Status` Draft → Final | Accepted |
| `FinalizedAtUtc` / `FinalizedByUserId` | Accepted (migration `20261012190000_AddLmsReportFinalizationMetadata`) |
| Current ReportVersion frozen; no new version on Finalize | Accepted |
| Append/edit blocked after Final | Accepted |
| Source claims retained after Final | Accepted |
| Claimed ResultVersions not eligible for new Draft | Accepted |
| `POST …/finalize` + `lms.reports.finalize` | Accepted |
| Idempotency `finalize_report` + RowVersion | Accepted |
| Audit `FINALIZE_REPORT` fail-closed | Accepted |
| ResultStatus unchanged | Accepted |
| No auto-Release, PDF, numbering, publication, NotificationHub | Accepted |
| No production role grants | Accepted |

**Stamp:** `ACCEPTED_L_REP_02A`

---

## 3. Current Report lifecycle

```text
Draft  →  Final  →  Released (conceptual only)
  ↑         ↑              ↑
  L-REP-01  L-REP-02A      L-REP-02B (NOT IMPLEMENTED)
```

| State | Persisted today? | Transition API |
| --- | --- | --- |
| Draft | Yes | Create / Append |
| Final | Yes | `POST …/finalize` |
| Released | Constant only | **NOT FOUND** |

Binding principles (must not reopen without contradiction):

- Released ≠ patient-visible  
- Release ≠ Notification delivery  
- Release ≠ Clinical Authorization  
- No automatic Release because Report is Final  
- ResultStatus never changed by Report operations  

---

## 4. Current Report schema

**Entity:** `LaboratoryApi/Domain/LmsReport.cs` → table `lms_reports`

| Column / field | Present |
| --- | --- |
| Id, TenantId, OperatingBranchId, PatientId, OrderId | Yes |
| Status | Yes (`Draft` / `Final`; `Released` unused) |
| CurrentVersionNumber | Yes |
| FinalizedAtUtc, FinalizedByUserId | Yes |
| ReleasedAtUtc, ReleasedByUserId | **NOT FOUND** |
| ReportNumber / business number | **NOT FOUND** |
| CanonicalDocumentId / PDF blob ref | **NOT FOUND** |
| RowVersion | Yes |

**Related aggregates (unchanged):**

- `LmsReportVersion` — immutable snapshot versions  
- `LmsReportVersionSource` — exact ResultVersion provenance  
- `LmsReportDraftSourceClaim` — unique `(tenant_id, result_version_id)`; retained after Final  

---

## 5. Current ReportVersion semantics

| Rule | Current behavior |
| --- | --- |
| Snapshot immutability | Versions store frozen ResultVersion snapshots at create/append |
| Finalize | Does **not** create a new ReportVersion |
| Append after Final | Rejected (`invalid_state`) |
| Release impact today | **None** (Release not implemented) |

---

## 6. Current Final behavior (post L-REP-02A)

`ReportService.FinalizeAsync`:

1. Validate branch + idempotency (`finalize_report`) + RowVersion  
2. Require `Status == Draft` (already Final → `invalid_state`)  
3. Require current version + ≥1 source  
4. Set `Status = Final`, `FinalizedAtUtc`, `FinalizedByUserId`, increment RowVersion  
5. Audit `FINALIZE_REPORT`; on failure → revert Final metadata (fail-closed)  
6. Does **not** remove draft source claims  
7. Does **not** mutate ResultStatus / CriticalResultEvent / Pathology / CanonicalDocument  

---

## 7. Existing Release constants / unused fields

| Artifact | Status |
| --- | --- |
| `ReportStatuses.Released = "Released"` | Constant only; never set |
| `ReleasedAtUtc` / `ReleasedByUserId` | **NOT FOUND** |
| `release_report` idempotency op | **NOT FOUND** |
| `RELEASE_REPORT` audit action | **NOT FOUND** (not allowlisted) |
| `ReleaseAsync` / DTO / FE client | **NOT FOUND** |

---

## 8. Existing release permission

| Code | Location | Enforcement |
| --- | --- | --- |
| `lms.reports.release` | Auth catalogue + `LaboratoryAuthz.ReportsRelease` + FE `LMS_REPORTS_PERMISSIONS.release` | **Not wired** to any API route |
| Role grants | None (by design) | Catalogue-only |

**Important:** Catalogue presence does **not** authorize Release implementation.

---

## 9. Existing audit allowlist

`InternalAuditController.AllowedActions` includes:

- `CREATE_REPORT_DRAFT`  
- `APPEND_REPORT_VERSION`  
- `FINALIZE_REPORT`  

**`RELEASE_REPORT`:** **NOT FOUND** in allowlist.

Any future Release mutation that writes platform audit **must** add this action in an implementation task (not this discovery). Without it, fail-closed Finalization-style behavior would block Release (as observed historically for stale `FINALIZE_REPORT`).

---

## 10. Existing idempotency model

| Operation | Status |
| --- | --- |
| `create_report_draft` | Live |
| `append_report_version` | Live |
| `finalize_report` | Live |
| `release_report` | **NOT FOUND** |

Finalize pattern (GREEN reuse template):

- Key + operation + SHA-256 request hash  
- Same key + same hash → replay  
- Same key + different hash → `idempotency_conflict`  
- Storage: `LmsReportIdempotencyRecords`  

---

## 11. Existing concurrency model

- Integer `RowVersion` on `LmsReport` (`IsConcurrencyToken`)  
- Client sends `expectedRowVersion`  
- Mismatch → `concurrency_conflict` (409)  
- Concurrent Finalize tested on PostgreSQL  

**Release:** same model **RECOMMENDED**; not implemented.

---

## 12. Existing document infrastructure

| Capability | Finding | Class |
| --- | --- | --- |
| CanonicalDocument (AuthService) | Patient blob identity + hash; associates to `lab/LabReport` (legacy), counselling, CCMS — **no LmsReport association** | YELLOW (bytes store) / **RED as Report SoT** |
| LMS Report PDF renderer | **NOT FOUND** | — |
| QuestPDF patterns (imaging / patient summary) | Exists in AuthService; not LMS Report | YELLOW pattern only |
| Report templates / branding config for LMS | **NOT FOUND** | CONFIGURATION_REQUIRED if PDF required |

---

## 13. Existing numbering infrastructure

| Sequence | Exists | Reusable as LMS Report number? |
| --- | --- | --- |
| Order number | Yes | **RED** without explicit PO approval |
| Accession / barcode / collection task | Yes | **RED** without explicit PO approval |
| `LmsReportNumberSequence` / report_number column | **NOT FOUND** | CONFIGURATION_REQUIRED if business number required |

Report list exposes parent **orderNumber** — not a Report business number.

---

## 14. Existing authority / signatory infrastructure

| Model | Finding | Class |
| --- | --- | --- |
| Result TechnicalVerify / ClinicalAuthorize | Exists on Results; separate from Reports | YELLOW (upstream only) |
| Report Finalize authority | `lms.reports.finalize` + tenant + branch (L-REP-02A accepted) | GREEN pattern |
| LMS Release signatory / director hierarchy tables | **NOT FOUND** | — |
| Dual-control Finalizer ≠ Releaser rule | **NOT FOUND** | CONFIGURATION_REQUIRED if required |
| Platform governed release-authority SoT for LMS Reports | **NOT FOUND** | CONFIGURATION_REQUIRED for Option B |

**Authority options for PO (not chosen here):**

- **OPTION A:** `lms.reports.release` + tenant + operating-branch  
- **OPTION B:** Existing governed release/signatory authority → **NOT FOUND** → collapses to CONFIGURATION_REQUIRED  
- **OPTION C:** CONFIGURATION_REQUIRED (build authority config before Release)

---

## 15. Existing notification infrastructure

| Item | Finding | Class |
| --- | --- | --- |
| NotificationHub + internal push | Exists (AuthService) | GREEN platform |
| LMS Critical intent `lab.result.critical` | Exists (LaboratoryApi `PlatformNotificationClient`) | GREEN pattern |
| `lab.report.released` / LMS Release intent | **NOT FOUND** | YELLOW if PO chooses intent |
| SMS/email/WhatsApp delivery from Release | **NOT FOUND** / out of scope | RED to invent |

Binding: Release ≠ delivery (PD-REP-19 / L-REP-01).

---

## 16. Existing patient publication infrastructure

| Surface | Finding | Class |
| --- | --- | --- |
| Patient Portal `/portal/documents` backend | **NOT FOUND** in microservices (FE client stubs only) | RED |
| `lms.reports.publish` | Explicitly **not seeded** | Correct boundary |
| Patient 360 lab docs | Legacy `labReportsApi` / CanonicalDocument — **no LmsReport** | RED as LMS Release SoT |
| Released → auto patient-visible | Forbidden by binding principle | — |

---

## 17. Existing download infrastructure

| Item | Finding |
| --- | --- |
| `lms.reports.download` catalogue | Exists; not implemented |
| `GET …/lms/reports/…/download` | **NOT FOUND** |
| Canonical / legacy LabReport content download | Exists (AuthService) — **RED as LMS SoT** |
| FE downloadPdf on Reports UI | Asserted absent |

Download depends on a document-byte source if option is “download persisted bytes.”

---

## 18. Pathology coexistence analysis

| Aggregate | Owner | Role vs LMS Release |
| --- | --- | --- |
| AuthService `LabReport` | Pathology / legacy | **RED** as LMS Release SoT |
| LaboratoryApi `LmsReport` | Enterprise LMS | Intended SoT for Release when authorized |
| Dual-write / migration / replacement | — | **Forbidden** (binding) |

No bridge code between Pathology LabReport and LmsReport for Release/PDF.

---

## 19. Configuration dependencies

| Dependency | Required for which Release shape? | Gate |
| --- | --- | --- |
| Release authority beyond permission+branch | If PO chooses Option B/C | **CONFIGURATION_REQUIRED** |
| Dual-control Finalizer ≠ Releaser | If PO requires dual control | **CONFIGURATION_REQUIRED** |
| Report business number format/sequence | If number assigned at Release | **CONFIGURATION_REQUIRED** |
| Templates / branding | If Release requires PDF bytes | **CONFIGURATION_REQUIRED** |
| Patient publication policy | If Released becomes patient-visible | **CONFIGURATION_REQUIRED** + separate slice likely |
| Document retention | If CanonicalDocument attach | CONFIGURATION_REQUIRED (PD-REP-23) |

**Metadata-only Release** (Final → Released + ReleasedAt/By, no PDF/number/publication) can proceed with **OPTION A authority** without inventing hierarchy — **if and only if** Product Owner stamps that choice.

---

## 20. Reusable vs non-reusable components

### GREEN (genuine reuse)

- LaboratoryApi Report aggregate ownership  
- Finalize service/API/UI pattern (mirror for Release)  
- Idempotency + RowVersion + fail-closed audit pattern  
- Tenant + `ValidateUserBranch` + Report.OperatingBranchId match  
- Permission catalogue code `lms.reports.release` (wire only)  
- Platform `audit_log` / `PlatformAuditClient`  
- NotificationHub **pattern** (if intent approved later)  

### YELLOW (infrastructure exists; semantics need PO)

- CanonicalDocument as post-Release byte store  
- QuestPDF / download patterns from other modules  
- Order/accession sequences (must not silently become Report number)  
- Critical notification intent pattern  
- Result verify/authorize as clinical upstream (not Report releaser)  
- Post-Final claim lifetime (already stamped in L-REP-02A as retain; reconfirm for Release)  

### RED (wrong SoT / prohibited)

- AuthService Pathology `LabReport` as LMS Release SoT  
- Treating Released as patient-visible without new PO stamp  
- Inventing signatory hierarchy / numbering / templates  
- Socket.IO or second audit store  
- Role grants invented in-slice  

---

## 21. Risks

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Stale AuthService without `RELEASE_REPORT` allowlist | High (UAT blocker pattern from L-REP-02A) | Implementation must allowlist + restart; fail-closed |
| Scope creep into PDF/numbering/publication | High | Keep L-REP-02B metadata-only unless config gates green |
| Silent claim release unlocking duplicate Drafts | Clinical integrity | Do not drop claims unless PO overrides L-REP-02A stamp |
| Pathology dual-write | Architecture | Explicit RED; no bridge |
| Assuming Released = patient-visible | Privacy | Binding principle; separate publication decision |
| Dual-control invented without config | Security false confidence | CONFIGURATION_REQUIRED |

---

## 22. Release semantics discovery (questions → repository answers)

| # | Question | Repository answer |
| --- | --- | --- |
| 1 | Is Release a Report aggregate state transition? | **Intended yes** (`ReportStatuses.Released`); not implemented |
| 2 | Operate on existing Final ReportVersion? | **Recommended yes**; no Release code today |
| 3 | Create new ReportVersion? | Finalize does not; Release should not invent one without PO stamp |
| 4 | Modify Report content? | Must not (immutability of Final content) |
| 5 | Require Final? | Binding principle: Release after Final only |
| 6 | Can Draft be Released? | Should be rejected; no API today |
| 7 | Can Release be repeated? | Idempotency should replay; second distinct Release → invalid_state (mirror Finalize) |
| 8 | Irreversible? | No Unrelease/Revoke **NOT FOUND** |
| 9 | Unrelease/Revoke concept? | **NOT FOUND** |
| 10 | Distinct from patient publication? | Yes (binding) |
| 11 | Distinct from delivery? | Yes (binding) |
| 12 | Distinct from NotificationHub? | Yes (binding); no Release intent exists |
| 13 | Distinct from Final? | Yes — Final exists; Released unused |
| 14 | Affect ResultStatus? | Finalize does not; Release must not |
| 15 | Affect CriticalResultEvent? | No Report code does |
| 16 | Affect source claims? | L-REP-02A stamp: claims remain through Release |
| 17 | Affect ReportVersion immutability? | Must preserve |

---

## 23. Open Product Decisions

See decision package IDs **PD-REP-02B-01 … PD-REP-02B-24**.

Highest-impact unanswered items:

1. Authority model (permission+branch vs CONFIGURATION_REQUIRED)  
2. Same-person Finalizer vs Releaser  
3. Metadata-only vs PDF-required Release  
4. Business Report number timing  
5. Notification intent inclusion  
6. Patient visibility / publication  
7. Download inclusion  
8. Already-Released / concurrent / audit-failure semantics  

---

## 24. Recommended next slice boundary

**Recommended (not approved):** L-REP-02B = **metadata Release only**

- Prerequisite: `Status == Final`  
- Transition: Final → Released  
- Persist `ReleasedAtUtc` / `ReleasedByUserId` (names illustrative; implementation later)  
- No new ReportVersion  
- Permission `lms.reports.release` + tenant + branch  
- Idempotency `release_report`  
- Audit `RELEASE_REPORT` fail-closed  
- Claims unchanged  
- No PDF, numbering, download, publication, NotificationHub delivery, Amendments, Pathology, role grants  

Later slices (separate gates): PDF/CanonicalDocument, numbering, download, publication, notification delivery, Amendments/Unrelease.

---

## 25. Explicit statement — NO implementation occurred

This task produced **documentation only**.

- No migration created  
- No schema changed  
- No Release API / UI created  
- No permission or role grants  
- No audit allowlist changes  
- No ResultStatus / claim / Pathology / CanonicalDocument / Patient Portal changes  
- L-REP-02A accepted behavior left untouched  

---

## Final discovery stamp

```text
DISCOVERY_COMPLETE_READY_FOR_PRODUCT_OWNER_DECISION
```

**Next gate:** Product Owner stamps [enterprise-lms-report-release-decision-package.md](./enterprise-lms-report-release-decision-package.md) → separate Decision Closure → only then may an implementation task be authorized.
