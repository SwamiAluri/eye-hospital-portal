# L-REP-03 CUT B / B1 — Official PDF / Report Artifact Foundation  
# Acceptance Closure

**Date:** 2026-10-12  
**Slice:** L-REP-03 CUT B / B1 — Official PDF / Report Artifact Foundation  
**Mode:** DOCUMENTATION / FORMAL ACCEPTANCE CLOSURE ONLY — no application code, schema, migration, API, DTO, domain, Timer, Blob, CanonicalDocument, PDF renderer, permission, role-grant, audit allowlist, frontend, route, navigation, Release, Report Number, ReportVersion, Result, Authorization, Pathology, Patient Portal, Patient 360, NotificationHub, download, or CUT C changes  

**Authoritative references:**

| Document | Role |
| --- | --- |
| [enterprise-lms-report-official-pdf-decision-closure.md](./enterprise-lms-report-official-pdf-decision-closure.md) | Product Decision Closure (`PRODUCT_DECISIONS_CLOSED_L_REP_03_CUT_B_AUTHORIZED`) |
| [enterprise-lms-report-official-pdf-readiness-audit.md](./enterprise-lms-report-official-pdf-readiness-audit.md) | Implementation readiness audit (`READY_WITH_PREREQUISITES`) |
| [enterprise-lms-report-official-pdf-implementation-report.md](./enterprise-lms-report-official-pdf-implementation-report.md) | B1 implementation report (`CUT_B_IMPLEMENTATION_COMPLETE`) |
| [enterprise-lms-report-official-pdf-pre-uat-readiness.md](./enterprise-lms-report-official-pdf-pre-uat-readiness.md) | PRE-UAT environment readiness (`READY_FOR_MANUAL_UAT`) |
| [enterprise-lms-report-official-pdf-discovery-audit.md](./enterprise-lms-report-official-pdf-discovery-audit.md) | Discovery baseline |
| [enterprise-lms-report-official-pdf-decision-package.md](./enterprise-lms-report-official-pdf-decision-package.md) | Decision package baseline |
| Upstream | L-REP-02B Report Release (`ACCEPTED_L_REP_02B`); L-REP-03 CUT A Report Number (`ACCEPTED_L_REP_03_CUT_A`) |

```text
PRODUCT_DECISIONS_CLOSED_L_REP_03_CUT_B_AUTHORIZED
  → CUT B / B1 implemented + PRE-UAT READY_FOR_MANUAL_UAT
  → Manual UAT (partial UI happy-path + Draft boundary) PASSED
  → Automated coverage for remaining B1 gates
  ↓
L-REP-03 CUT B / B1 ACCEPTED  (THIS DOCUMENT)
  ↓
Next gate: PRODUCT_DISCOVERY_REQUIRED
  (CUT C staff download — NOT started, NOT authorized here)
```

---

## 1. Acceptance status

# ACCEPTED_L_REP_03_CUT_B

| Gate | Status |
| --- | --- |
| Product Decision Closure | **`PRODUCT_DECISIONS_CLOSED_L_REP_03_CUT_B_AUTHORIZED`** |
| Implementation status | **`CUT_B_IMPLEMENTATION_COMPLETE`** (B1 only) |
| PRE-UAT environment readiness | **`READY_FOR_MANUAL_UAT`** |
| Manual UAT | **`PASSED`** / **`MANUAL_UAT_PASSED`** (happy-path UI + Draft restriction + expected boundaries; not every matrix item was manually exercised) |
| Formal acceptance | **`ACCEPTED`** / **`ACCEPTANCE_COMPLETE`** / **`ACCEPTED_L_REP_03_CUT_B`** |
| L-REP-02B | **`L_REP_02B_REMAINS_ACCEPTED`** |
| L-REP-03 CUT A | **`ACCEPTED_L_REP_03_CUT_A`** (remains) |
| CUT C | **`CUT_C_NOT_STARTED`** |

Product Owner / user Manual UAT result (human UI evidence):

> Released + numbered Report detail was used to generate Official PDF asynchronously (artifact v1), regenerate (artifact v2), and confirm Release / Business Report Number / ReportVersion invariants. Draft showed no Generate action. No download / patient publication / notification controls were present (expected B1 boundary).

Acceptance is based on Product Decision stamps, implementation documentation, PRE-UAT readiness, automated tests, **and** the Manual UAT observations in §6. Automated tests alone do not constitute acceptance. This closure does **not** claim that every checklist item was individually executed in Manual UAT.

---

## 2. Product Decision Closure reference

| Stamp | Source |
| --- | --- |
| `PRODUCT_DECISIONS_CLOSED_L_REP_03_CUT_B_AUTHORIZED` | [enterprise-lms-report-official-pdf-decision-closure.md](./enterprise-lms-report-official-pdf-decision-closure.md) |

Scope accepted in this closure: **CUT B / B1 — Official PDF / Report Artifact Foundation only.**

CUT C (staff download) remains **not started** and is **not** accepted or authorized by this document. Product Decisions PD-PDF-01 … PD-PDF-24 are **not reopened**.

---

## 3. Readiness / implementation / PRE-UAT references

| Document | Stamp / result |
| --- | --- |
| Readiness audit | `OVERALL_READINESS = READY_WITH_PREREQUISITES` → implementation authorization |
| Implementation report | `CUT_B_IMPLEMENTATION_COMPLETE` |
| PRE-UAT readiness | `READY_FOR_MANUAL_UAT` (migration, UAT template/signatory, branch + number config, operational Lab Manager generate grant, Auth internal-key, Timer host) |

Migration accepted with B1: `20261012220000_AddLmsReportOfficialPdfFoundation`.

---

## 4. Scope accepted (B1)

| Accepted capability |
| --- |
| Governed tenant PDF template foundation (immutable template versions once used) |
| Governed laboratory signatory foundation |
| Explicit staff Official PDF generation (not automatic on Release / Number / Final / Authorize) |
| Async LaboratoryApi-owned job lifecycle (Pending → Running → Succeeded / Failed) |
| Azure Timer drain (no Service Bus) |
| One active generation job per Report |
| Idempotency operation `generate_official_pdf` |
| Immutable artifact versions starting at 1; current pointer on `LmsReport` |
| LaboratoryApi-owned QuestPDF Official PDF renderer |
| Downstream CanonicalDocument + private Blob via LMS association |
| Catalogue permission `lms.reports.generate` |
| Audit `REQUEST_OFFICIAL_PDF` / `OFFICIAL_PDF_GENERATED` / `OFFICIAL_PDF_FAILED` (fail-closed) |
| Report detail UI: Generate + confirmation + status + artifact metadata |

---

## 5. Scope excluded (explicit)

| Not accepted / not delivered by B1 |
| --- |
| Staff download / SAS / raw Blob bytes / download UI |
| Patient download / Patient Portal / Patient 360 publication |
| NotificationHub / SMS / email / WhatsApp |
| Retention enforcement |
| Amendments / Unrelease / Revoke |
| Pathology migration / dual-write / Pathology `lab`/`LabReport` association reuse |
| Report Release semantic changes |
| Business Report Number semantic changes |
| Result / Authorization lifecycle changes |
| B0 ReportVersion snapshot enrichment |
| Production role grants in source seeders |
| CUT C |

Operational UAT Lab Manager → `lms.reports.generate` grant (PRE-UAT) remains **environment test setup**, not a production seeder change, and is **not** reclassified as a production role-grant acceptance item.

---

## 6. Manual UAT evidence (UI)

Product Owner manually tested a Released, numbered Report through the Report detail UI after PRE-UAT readiness.

### Fixture under test

| Field | Value |
| --- | --- |
| Report Status | Released |
| Business Report Number | `UAT-RPT-20261012-000001` |
| Current ReportVersion | `1` |
| Order | `LAB-20261012-000001` |

### Completed Manual UAT observations

| # | Observation | Classification |
| --- | --- | --- |
| A | Released + numbered report eligible for Official PDF generation | **PASS — MANUAL** |
| B | Generate Official PDF showed explicit confirmation | **PASS — MANUAL** |
| C | Confirmation stated generation does not change Release status or Report Number | **PASS — MANUAL** |
| D | Generation completed asynchronously | **PASS — MANUAL** |
| E | First success: artifact version **1**, MIME `application/pdf`, artifact metadata + CanonicalDocument identity displayed | **PASS — MANUAL** |
| F | Second explicit generation: artifact version **2**, MIME `application/pdf`, different artifact identity/hash | **PASS — MANUAL** |
| G | After generation/regeneration: Status remained **Released** | **PASS — MANUAL** |
| H | After generation/regeneration: Business Report Number remained `UAT-RPT-20261012-000001` | **PASS — MANUAL** |
| I | After generation/regeneration: Current ReportVersion remained **1** | **PASS — MANUAL** |
| J | Draft Report opened: Status = Draft; Generate Official PDF **not** available; Finalize Report available | **PASS — MANUAL** |
| K | No Download action in B1 UI | **PASS — EXPECTED BOUNDARY** |
| L | No patient publication action | **PASS — EXPECTED BOUNDARY** |
| M | No notification action | **PASS — EXPECTED BOUNDARY** |
| N | Pathology not modified as part of this UAT | **PASS — EXPECTED BOUNDARY** |

### Manual UAT items NOT executed

| Item | Classification | Reason |
| --- | --- | --- |
| Lab Manager explicit permission actor path as distinct Manual UAT script | **NOT EXECUTED — FIXTURE/ACTOR NOT USED** | Not separately exercised as a dedicated unauthorized/authorized actor matrix in Manual UAT |
| Lab Technician unauthorized actor denial | **NOT EXECUTED — FIXTURE/ACTOR NOT USED** | Not manually executed |
| Final-but-not-Released fixture | **NOT EXECUTED — FIXTURE/ACTOR NOT USED** | No Final fixture opened in Manual UAT |
| Released-without-Report-Number fixture | **NOT EXECUTED — FIXTURE/ACTOR NOT USED** | Numbered Released report was the primary fixture |
| Wrong operating branch denial | **NOT EXECUTED — FIXTURE/ACTOR NOT USED** | Not manually executed |
| Manual open/download/inspection of PDF bytes | **NOT EXECUTED — B1 DOWNLOAD INTENTIONALLY ABSENT** | B1 has no download/raw-byte UI/API by design (CUT C) |
| Failure preserves previous current artifact | **NOT EXECUTED — FIXTURE/ACTOR NOT USED** | Not manually forced |
| Idempotency same-key replay / conflict | **NOT EXECUTED — FIXTURE/ACTOR NOT USED** | Not manually scripted |
| Concurrent generate requests | **NOT EXECUTED — FIXTURE/ACTOR NOT USED** | Not manually scripted |

Screenshots were not committed as repository files for this closure. Observations above record Manual UAT faithfully. Do not invent additional screenshot artifacts.

### Product Owner conclusion (Manual UAT)

```text
MANUAL_UAT_PASSED
```

(Scope: exercised happy-path async generation/regeneration, lifecycle invariants, Draft restriction, and expected out-of-scope UI boundaries. Not a claim that every matrix row was manually run.)

---

## 7. Automated test evidence

Evidence from [enterprise-lms-report-official-pdf-implementation-report.md](./enterprise-lms-report-official-pdf-implementation-report.md) (not re-run solely for this acceptance-closure task):

| Suite | Result |
| --- | --- |
| LaboratoryApi Official PDF + Report regression filter | **56 passed**, 0 failed |
| Frontend `enterprise-lms-reports-ui.test.ts` | **12 passed**, 0 failed |
| AuthService permission / audit / LMS CanonicalDocument | **Passed** (catalogue, allowlist, `RegisterLmsOfficialPdf_UsesEnterpriseLmsAssociation_NotPathologyLabReport`) |

### Automated coverage (implementation report)

| Area | Automated |
| --- | --- |
| Missing template / signatory configuration denied | Yes |
| Draft denied | Yes |
| Final denied | Yes |
| Released without Business Report Number denied | Yes |
| Wrong branch denied | Yes |
| Generate → Timer drain → Succeeded | Yes |
| Report / Number / ReportVersion / Result invariants | Yes |
| Idempotency replay + conflict (409) | Yes |
| One active job / concurrency | Yes |
| Failed generation does not become current; previous current preserved | Yes |
| Artifact version increment | Yes |
| Exact CatalogueVersion display name (not current catalogue decoy) | Yes |
| PDF content via PdfPig (approved fields present; unapproved absent) | Yes |
| CanonicalDocument LMS association ≠ Pathology `lab`/`LabReport` | Yes |
| PostgreSQL one-active uniqueness | Yes (requires `LABORATORY_TEST_CONNECTION`) |

Do **not** convert the above into a claim that the Product Owner manually performed those scenarios.

---

## 8. UAT evidence matrix

| # | Criterion | Classification | Manual | Automated | Notes |
| --- | --- | --- | --- | --- | --- |
| 1 | Draft cannot generate | **PASS — MANUAL** | Yes (action absent; Finalize available) | Yes | |
| 2 | Final cannot generate | **PASS — AUTOMATED** | **NOT EXECUTED — FIXTURE/ACTOR NOT USED** | Yes | No Final fixture in Manual UAT |
| 3 | Released without number cannot generate | **PASS — AUTOMATED** | **NOT EXECUTED — FIXTURE/ACTOR NOT USED** | Yes | Numbered Released fixture used instead |
| 4 | Released + numbered can generate | **PASS — MANUAL** | Yes | Yes | Primary Manual UAT path |
| 5 | Generate creates async job | **PASS — MANUAL** | Yes (async completion observed) | Yes | |
| 6 | Pending/Running behavior | **PASS — MANUAL** + **PASS — AUTOMATED** | Async completion observed; intermediate Pending/Running ticks not separately scripted | Yes | |
| 7 | Successful artifact metadata | **PASS — MANUAL** | Yes (v1 then v2; MIME; CanonicalDocument id) | Yes | |
| 8 | Approved PDF content | **PASS — AUTOMATED** | **NOT EXECUTED — B1 DOWNLOAD INTENTIONALLY ABSENT** | Yes (PdfPig) | Known evidence limitation |
| 9 | Business Report Number in PDF | **PASS — AUTOMATED** | **NOT EXECUTED — B1 DOWNLOAD INTENTIONALLY ABSENT** | Yes | Number displayed on Report UI remains Manual PASS for invariant |
| 10 | Unapproved clinical content absent | **PASS — AUTOMATED** | **NOT EXECUTED — B1 DOWNLOAD INTENTIONALLY ABSENT** | Yes | |
| 11 | Report remains Released | **PASS — MANUAL** | Yes | Yes | |
| 12 | Business Report Number unchanged | **PASS — MANUAL** | Yes (`UAT-RPT-20261012-000001`) | Yes | |
| 13 | ReportVersion unchanged | **PASS — MANUAL** | Yes (remained 1) | Yes | |
| 14 | Failure preserves current artifact | **PASS — AUTOMATED** | **NOT EXECUTED — FIXTURE/ACTOR NOT USED** | Yes | |
| 15 | Retry / regeneration after success | **PASS — MANUAL** | Yes (second generate → v2) | Yes | Manual = successful regeneration; failure-retry path automated |
| 16 | Idempotency replay | **PASS — AUTOMATED** | **NOT EXECUTED — FIXTURE/ACTOR NOT USED** | Yes | |
| 17 | Concurrent request → one active job | **PASS — AUTOMATED** | **NOT EXECUTED — FIXTURE/ACTOR NOT USED** | Yes | |
| 18 | Unauthorized actor denied | **PASS — AUTOMATED** | **NOT EXECUTED — FIXTURE/ACTOR NOT USED** | Yes (permission wiring / missing permission paths in suites) | Lab Tech Manual UAT not executed |
| 19 | Wrong branch denied | **PASS — AUTOMATED** | **NOT EXECUTED — FIXTURE/ACTOR NOT USED** | Yes | |
| 20 | No download | **PASS — EXPECTED BOUNDARY** | Yes (absent in UI) | Yes (FE contract) | CUT C |
| 21 | No patient publication | **PASS — EXPECTED BOUNDARY** | Yes | Scope | |
| 22 | No notification | **PASS — EXPECTED BOUNDARY** | Yes | Scope | |
| 23 | Pathology untouched | **PASS — EXPECTED BOUNDARY** | Yes (not modified in UAT) | Yes (association ≠ Pathology) | |

---

## 9. Known evidence limitations

| Limitation | Status |
| --- | --- |
| Manual PDF byte/content visual inspection | **NOT EXECUTED** — B1 intentionally has no download/raw-byte UI/API; **not a B1 scope defect** |
| Final-not-Released Manual fixture | Not used; covered by **automated** denial |
| Released-without-number Manual fixture | Not used; covered by **automated** denial |
| Unauthorized / wrong-branch Manual actor scripts | Not used; covered by **automated** + PRE-UAT wiring |
| Forced failure / concurrent Manual scripts | Not used; covered by **automated** |
| Production readiness | **Not claimed** |
| Every checklist item individually manually executed | **Not claimed** |

---

## 10. Security / authorization evidence

| Item | Evidence source | Result |
| --- | --- | --- |
| Permission `lms.reports.generate` in catalogue | Implementation + Auth automated | Present |
| LaboratoryAuthz + FE constant | Implementation | Present |
| Production role grants in source seeders | Implementation report | **None** |
| Operational UAT Lab Manager grant | PRE-UAT readiness | Environment-only; not production seeder acceptance |
| Tenant / operating-branch authorization on generate | Automated | Covered |
| Auth internal-key for CanonicalDocument register | PRE-UAT readiness | Confirmed (wrong key 401; good key reaches handler) |
| Manual Lab Manager / Lab Technician actor matrix | Manual UAT | **NOT EXECUTED — FIXTURE/ACTOR NOT USED** |

---

## 11. Artifact / version evidence

| Item | Manual | Automated |
| --- | --- | --- |
| First successful artifact version = 1 | **PASS — MANUAL** | Yes |
| Subsequent successful regeneration increments (v2) | **PASS — MANUAL** | Yes |
| MIME `application/pdf` | **PASS — MANUAL** | Yes |
| Artifact metadata + CanonicalDocument identity on detail | **PASS — MANUAL** | Yes |
| Different artifact identity/hash on regeneration | **PASS — MANUAL** | Yes |
| Failed artifact never current | Automated only | Yes |
| Current pointer only updates on success | Automated + Manual success path | Yes |

---

## 12. Report lifecycle invariants

| Invariant | Manual | Automated |
| --- | --- | --- |
| Status remains Released during/after PDF generation | **PASS — MANUAL** | Yes |
| Business Report Number unchanged | **PASS — MANUAL** | Yes |
| Current ReportVersion unchanged | **PASS — MANUAL** | Yes |
| ResultStatus / ResultVersion / CriticalResultEvent unchanged | Automated | Yes |
| No automatic generate hooks on Release / Assign Number / Finalize / Authorize | Implementation scope + automated invariants | Confirmed not introduced in B1 |

L-REP-02B Release and L-REP-03 CUT A Report Number semantics remain accepted and unchanged by this closure.

---

## 13. CanonicalDocument / Blob boundary

| Item | Evidence |
| --- | --- |
| LaboratoryApi remains LMS artifact / report SoT | Implementation |
| CanonicalDocument is downstream physical store | Implementation + Auth register endpoint |
| Association `enterprise_lms` / `LmsReportOfficialPdfArtifact` | Automated (not Pathology) |
| Private Blob | Implementation + Auth registration path |
| No staff download / SAS / raw bytes in B1 | Manual UI absence + implementation scope |

---

## 14. Pathology isolation

| Item | Status |
| --- | --- |
| No Pathology association reuse (`lab` / `LabReport`) | **PASS — AUTOMATED** + **PASS — EXPECTED BOUNDARY** (Manual: Pathology not touched in UAT) |
| No Pathology dual-write / migration | Explicit B1 exclusion |

---

## 15. Regression boundary

| Upstream | Status |
| --- | --- |
| L-REP-02B Report Release | **`L_REP_02B_REMAINS_ACCEPTED`** |
| L-REP-03 CUT A Report Number | **`ACCEPTED_L_REP_03_CUT_A`** |
| Release does not auto-generate PDF | Confirmed (B1 requires explicit staff action) |
| Assign Number does not auto-generate PDF | Confirmed |
| Result / Authorization lifecycle unchanged | Confirmed (implementation + automated invariants) |

---

## 16. Acceptance decision

| Area | Decision |
| --- | --- |
| Core B1 implementation | **ACCEPTED** |
| Manual happy-path UI (Released + numbered generate / regenerate) | **PASSED** |
| Artifact versioning (v1 → v2) | **PASSED** |
| Report lifecycle invariants (Released / Number / ReportVersion) | **PASSED** |
| Draft restriction | **PASSED** (Manual) |
| Final restriction | **PASS — AUTOMATED** (Manual Final fixture not used) |
| Released-without-number restriction | **PASS — AUTOMATED** (Manual fixture not used) |
| Unauthorized actor | **PASS — AUTOMATED** (Manual not executed) |
| Wrong branch | **PASS — AUTOMATED** (Manual not executed) |
| PDF content | **PASS — AUTOMATED**; Manual PDF inspection **NOT EXECUTED — B1 DOWNLOAD INTENTIONALLY ABSENT** |
| Download / patient publication / notification / Pathology | **PASS — EXPECTED BOUNDARY** |
| Production readiness | **Not claimed** |

Evidence is sufficient to close B1 acceptance honestly without claiming a complete Manual UAT script of every matrix row.

---

## 17. Explicit CUT C boundary

Even with B1 accepted:

- Staff download is **not** implemented  
- No Blob SAS / raw byte API / download UI  
- No worklist PDF status  
- No patient publication / Patient Portal / Patient 360 PDF publication  
- No NotificationHub integration for Official PDF  

```text
CUT_C_NOT_STARTED
```

This Acceptance Closure does **not** authorize CUT C implementation.

---

## 18. Explicit non-claims

This document does **not** claim:

- Production ready  
- Every Manual UAT checklist item individually executed  
- Product Owner visually inspected PDF file bytes  
- Staff download available  
- Patient publication / notification delivered  
- Production role grants added in source  
- Retention enforcement  
- Pathology changes  
- CUT C started or accepted  

This acceptance-closure task:

- Did **not** modify application code, schema, migrations, APIs, UI, permissions, role grants, audit allowlists, Timer, Blob, CanonicalDocument, or PDF renderer  
- Did **not** start CUT C  
- Does **not** authorize CUT C without separate Product Discovery  

---

## 19. Next gate

```text
NEXT_GATE = PRODUCT_DISCOVERY_REQUIRED
```

Do **not** treat this Acceptance Closure as authorization to implement CUT C (staff download) or any patient-facing publication/notification slice.

---

## 20. Final stamps

```text
MANUAL_UAT_PASSED = YES
ACCEPTANCE_COMPLETE = YES
ACCEPTED_L_REP_03_CUT_B = YES

L_REP_02B_REMAINS_ACCEPTED
ACCEPTED_L_REP_03_CUT_A

CUT_B_IMPLEMENTATION_COMPLETE
CUT_C_NOT_STARTED

NEXT_GATE = PRODUCT_DISCOVERY_REQUIRED
```

# ACCEPTED_L_REP_03_CUT_B

**STOP.** Do not authorize, discover, audit, or implement CUT C in this task.
