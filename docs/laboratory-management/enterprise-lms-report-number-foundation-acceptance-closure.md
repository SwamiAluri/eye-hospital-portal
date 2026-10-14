# L-REP-03 CUT A — Report Number Foundation Acceptance Closure

**Date:** 2026-10-12  
**Slice:** L-REP-03 CUT A — Report Number Foundation  
**Mode:** DOCUMENTATION / FORMAL ACCEPTANCE CLOSURE ONLY — no application code, schema, API, UI, permission, role-grant, ReleaseAsync, PDF, download, publication, notification, Amendments, Unrelease/Revoke, Pathology, CanonicalDocument, or CUT B/C changes  

**Authoritative references:**

| Document | Role |
| --- | --- |
| [enterprise-lms-report-artifact-numbering-download-decision-closure.md](./enterprise-lms-report-artifact-numbering-download-decision-closure.md) | Product Decision Closure (`PRODUCT_DECISIONS_CLOSED_L_REP_03_AUTHORIZED`) |
| [enterprise-lms-report-artifact-numbering-download-readiness-audit.md](./enterprise-lms-report-artifact-numbering-download-readiness-audit.md) | Pre-coding readiness audit |
| [enterprise-lms-report-number-foundation-implementation-report.md](./enterprise-lms-report-number-foundation-implementation-report.md) | CUT A implementation report |
| [enterprise-lms-report-number-foundation-pre-uat-readiness.md](./enterprise-lms-report-number-foundation-pre-uat-readiness.md) | PRE-UAT environment readiness (`READY_FOR_MANUAL_UAT`) |
| Upstream | L-REP-02B Report Release (`ACCEPTED_L_REP_02B`) |

```text
PRODUCT_DECISIONS_CLOSED_L_REP_03_AUTHORIZED
  → CUT A implemented + PRE-UAT READY_FOR_MANUAL_UAT
  → Manual UAT PASSED (UI evidence below)
  ↓
L-REP-03 CUT A ACCEPTED  (THIS DOCUMENT)
  ↓
Next gate: PRODUCT_DISCOVERY_REQUIRED
  (CUT B PDF / CUT C download — NOT started, NOT authorized here)
```

---

## 1. Acceptance status

# ACCEPTED_L_REP_03_CUT_A

| Gate | Status |
| --- | --- |
| Product Decision Closure | **`PRODUCT_DECISIONS_CLOSED_L_REP_03_AUTHORIZED`** |
| Implementation status | **`IMPLEMENTATION_COMPLETE`** (CUT A only) |
| PRE-UAT environment readiness | **`READY_FOR_MANUAL_UAT`** |
| Manual UAT | **`PASSED`** / **`MANUAL_UAT_PASSED`** |
| Formal acceptance | **`ACCEPTED`** / **`ACCEPTED_L_REP_03_CUT_A`** |
| L-REP-02B | **`ACCEPTED_L_REP_02B`** / **`L_REP_02B_REMAINS_ACCEPTED`** |

Product Owner / user statement (human UAT result):

> Manual UAT of CUT A completed from the UI. Assignment, persistence, immutability, worklist display, unauthorized denial, wrong-branch denial, and scope honesty (no PDF/download/publication/notification) were exercised successfully.

Acceptance is based on Product Decision stamps, implementation documentation, PRE-UAT readiness evidence, automated tests, **and** Manual UAT exercised through the UI (evidence in §6). Automated tests alone do not constitute acceptance.

---

## 2. Product Decision Closure reference

| Stamp | Source |
| --- | --- |
| `PRODUCT_DECISIONS_CLOSED_L_REP_03_AUTHORIZED` | [enterprise-lms-report-artifact-numbering-download-decision-closure.md](./enterprise-lms-report-artifact-numbering-download-decision-closure.md) |

Scope authorized and accepted in this closure: **CUT A — Report Number Foundation only** (explicit post-Release Assign Report Number).

CUT B (official PDF) and CUT C (staff download) remain **not started** and are **not** accepted or authorized by this document.

---

## 3. L-REP-03 CUT A scope (accepted)

| In scope | Out of scope (explicit) |
| --- | --- |
| Immutable `BusinessReportNumber` on Report after Released | Official PDF / QuestPDF / PDF jobs |
| Explicit Assign Report Number (not automatic on Release) | PDF artifact / CanonicalDocument association |
| Operating-branch scoped sequence allocation | Staff download endpoint / download UI |
| Governed format configuration (no production defaults seeded) | `lms.reports.generate` / `DOWNLOAD_OFFICIAL_PDF` |
| `POST …/assign-number` + `lms.reports.assign_number` | Patient Portal / Patient 360 publication |
| Idempotency `assign_report_number` + RowVersion | Notifications |
| Audit `ASSIGN_REPORT_NUMBER` (fail-closed) | Amendments / Unrelease / Revoke |
| Report detail + worklist number display | Production role grants |
| Draft/Final do not expose assignment | Automatic number assignment inside `ReleaseAsync` |
| | Legacy Pathology changes |

---

## 4. Number assignment semantics (certified)

1. Business Report Number is assigned only when Report.Status is Released.  
2. Draft and Final do not expose Assign Report Number.  
3. Assignment is explicit (separate API/UI action), not automatic on Release.  
4. Assigned number is immutable; reassignment is not available after success.  
5. Number allocation is scoped to Operating Branch sequence + governed format config.  
6. PostgreSQL allocation is concurrency-safe (`INSERT … ON CONFLICT DO UPDATE … RETURNING` on sequences).  
7. Tenant unique index on `(tenant_id, business_report_number)` prevents reuse.  
8. Sequence gaps are permitted.  
9. Idempotency operation is `assign_report_number`.  
10. Optimistic concurrency uses `expectedRowVersion` / HTTP 409.  
11. Audit action is `ASSIGN_REPORT_NUMBER` and is fail-closed (assignment fields + RowVersion reverted on audit failure).  
12. Permission is `lms.reports.assign_number` (catalogue; no silent production role grants).  
13. Report Number appears on Report detail after assignment.  
14. Report Number appears in the Reports worklist for Released + assigned reports.  
15. Release remains metadata-only (L-REP-02B unchanged).  
16. No PDF, download, CanonicalDocument, patient publication, or notification is introduced by CUT A.  
17. Legacy Pathology remains unchanged.

---

## 5. Implementation / PRE-UAT baseline

| Item | Evidence |
| --- | --- |
| Implementation report | [enterprise-lms-report-number-foundation-implementation-report.md](./enterprise-lms-report-number-foundation-implementation-report.md) |
| PRE-UAT readiness | [enterprise-lms-report-number-foundation-pre-uat-readiness.md](./enterprise-lms-report-number-foundation-pre-uat-readiness.md) — **`READY_FOR_MANUAL_UAT`** |
| Migration | `20261012210000_AddLmsReportNumberFoundation` applied to UAT DB |
| Schema | `business_report_number`, `business_report_number_assigned_at_utc`, `business_report_number_assigned_by_user_id`; tables `lms_report_number_configurations`, `lms_report_number_sequences`; unique index `IX_lms_reports_tenant_id_business_report_number` |
| API | `POST /api/lms/reports/{id}/assign-number` (`LmsReportAssignNumber`) |
| Permission | `lms.reports.assign_number` catalogue-only; **no role grants in source** |
| UAT number configuration | Format `UAT_RPT_UTC_DAY`; prefix `UAT-RPT`; width `6`; period `UTC_DAY`; date segment `YYYYMMDD`; branch `74c014cf-…`; config id `a1111111-…` |
| Authorized actor | `admin@test.com` (Admin → JWT `*`) |
| Unauthorized actor | `labmgr1@hospital.com` (no `lms.reports.assign_number`) |
| Runtime | AuthService `:5073`; LaboratoryApi `:7076`; FE → those APIs |
| API smoke (no business assign) | **401** unauthenticated; **403** missing permission; **403** wrong branch; **409** stale RowVersion |

Business assignment was reserved for UI Manual UAT (PRE-UAT smoke did not assign a number).

---

## 6. Manual UAT evidence (UI)

Product Owner / user manually tested CUT A through the Reports UI after PRE-UAT readiness.

### Completed Manual UAT scenarios

| # | Scenario | Result |
| --- | --- | --- |
| 1 | Draft Report — Assign Report Number action absent | **Observed** |
| 2 | Final Report — Assign Report Number action absent | **Observed** |
| 3 | Released without number — Report Number = Not assigned; Assign action visible to authorized actor | **Observed** |
| 4 | Assignment — confirmation displayed; assignment succeeded | **Observed** |
| 5 | Assigned number displayed; UAT format `UAT-RPT-20261012-000001` | **Observed** |
| 6 | Refresh/reopen — number persisted | **Observed** |
| 7 | Immutability — Assign action unavailable after assignment; number unchanged | **Observed** |
| 8 | Integrity — Status remained Released; Release metadata unchanged; ReportVersion unchanged | **Observed** |
| 9 | Worklist — Released shows Business Report Number; Drafts show no number/placeholder | **Observed** |
| 10 | Unauthorized user could not assign | **Observed** |
| 11 | Wrong-branch assignment denied | **Observed** |
| 12 | Retry/idempotency/concurrency | Supported by automated tests + PRE-UAT verification (not separately re-run as a Manual UAT script) |
| 13 | Scope honesty — no PDF, download, patient publication, or notification introduced | **Observed** |
| 14 | Legacy Pathology unchanged | **Observed** (no Pathology change in CUT A) |

### UI evidence (described; no repository screenshot files embedded)

**A. Released unnumbered Report detail**

| Observation | Result |
| --- | --- |
| Status = Released | Observed |
| Report Number = Not assigned | Observed |
| Assign Report Number visible (authorized actor) | Observed |

**B. Confirmation state**

| Observation | Result |
| --- | --- |
| Explicit immutable-number confirmation | Observed |
| Operating-branch scope stated | Observed |
| PDF/download explicitly excluded in confirmation copy | Observed |

**C. Released numbered Report**

| Observation | Result |
| --- | --- |
| Business Report Number displayed (`UAT-RPT-20261012-000001`) | Observed |
| Number assigned timestamp displayed | Observed |
| Status remains Released | Observed |
| ReportVersion remains Version 1 | Observed |
| No PDF/download controls | Observed |

**D. Reports worklist**

| Observation | Result |
| --- | --- |
| Report Number column displayed | Observed |
| Released report shows assigned number | Observed |
| Draft reports show no number | Observed |

### Product Owner conclusion

```text
MANUAL_UAT_PASSED
```

Screenshots were not committed as repository files for this closure; evidence above records the Manual UAT observations faithfully. Do not invent additional screenshot artifacts.

---

## 7. Automated test evidence

| Suite | Result |
| --- | --- |
| AuthService — `EnterpriseLmsReportsPermissionTests` + `InternalAuditControllerTests` | **24/24 passed** |
| LaboratoryApi — `ReportNumberAssignTests` | **12/12 passed** |
| LaboratoryApi — ReportService / shell / ReportNumber regression filter | **45/45 passed** |
| Frontend — `enterprise-lms-reports-ui.test.ts` | **11/11 passed** |
| LaboratoryApi — `ReportNumberPostgresConcurrencyTests` | **2/2 passed** |

### PostgreSQL concurrency (real Npgsql)

| Test | Result |
| --- | --- |
| Concurrent assignment to distinct Released Reports produces unique numbers | **Passed** |
| Concurrent assignment to the same Report succeeds exactly once | **Passed** |

Do not overstate: these suites certify CUT A assign/number/regression coverage listed above; they are not a claim of full LaboratoryApi or full LMS suite green.

---

## 8. Acceptance matrix

| Criterion | Manual UAT | Automated | PRE-UAT / Runtime | Notes |
| --- | --- | --- | --- | --- |
| Immutable Business Report Number | **Yes** | Unit tests | Unique index | Action absent after assign |
| Assignment only after Release | **Yes** | Unit tests | — | Draft/Final action absent |
| Explicit assignment (not automatic) | **Yes** | Release unchanged in unit/regression | Release smoke not re-opened | Separate Assign action |
| Operating-branch scope | **Yes** (wrong branch denied) | Unit tests | API **403** wrong branch | |
| PostgreSQL concurrency-safe allocation | Automated | **2/2 PG tests** | — | |
| Number reuse prevented | Automated | Unique index + unit | Migration verified | |
| Gaps permitted | Design + automated | Sequence allocator | — | Not a Manual UAT gap exercise |
| Idempotency supported | Automated | Unit tests | — | Op `assign_report_number` |
| RowVersion concurrency | Automated + PRE-UAT | Unit + PG | API **409** stale RV | |
| Audit `ASSIGN_REPORT_NUMBER` | Automated | Auth allowlist + unit fail-closed | — | |
| Audit fail-closed | Automated | Unit revert path | — | |
| `lms.reports.assign_number` exists | Automated + PRE-UAT | Auth catalogue tests | Catalogue verified | |
| No silent production role grants | PRE-UAT + implementation | Auth seed tests | Catalogue-only | Admin `*` via existing Admin role |
| Number on Report detail after assign | **Yes** | FE tests | — | `UAT-RPT-20261012-000001` |
| Number on Reports worklist | **Yes** | FE tests | — | |
| Draft/Final do not expose assignment | **Yes** | FE tests | — | |
| Release remains metadata-only | **Yes** (integrity) | Release regression filter | — | L-REP-02B preserved |
| No PDF | **Yes** | FE + implementation scope | — | CUT B not started |
| No download | **Yes** | FE + implementation scope | — | CUT C not started |
| No CanonicalDocument | Implementation scope | — | No schema | |
| No patient publication | **Yes** | — | — | |
| No notification | **Yes** | — | — | |
| Legacy Pathology unchanged | **Yes** | — | — | |

---

## 9. L-REP-02B regression confirmation

| Check | Status |
| --- | --- |
| L-REP-02B remains accepted | **`ACCEPTED_L_REP_02B`** / **`L_REP_02B_REMAINS_ACCEPTED`** |
| `ReleaseAsync` remains metadata-only | **Confirmed** (implementation report + regression filter) |
| Release does **not** automatically assign Report Number | **Confirmed** |
| Release does **not** generate PDF / create artifact / download / publish / notify | **Confirmed** |
| No L-REP-02B business rule changed | **Confirmed** |

---

## 10. Explicit non-claims

### CUT B is NOT implemented

Therefore there is currently:

- no official PDF generation  
- no QuestPDF implementation in LaboratoryApi  
- no PDF job infrastructure  
- no PDF artifact  
- no CanonicalDocument association  
- no signatory rendering  
- no official PDF download  

### CUT C is NOT implemented

Therefore there is currently:

- no staff download endpoint  
- no download UI  
- no `DOWNLOAD_OFFICIAL_PDF` audit action  

### Also not implemented

- Patient Portal publication  
- Patient 360 publication  
- Notifications  
- Amendments  
- Unrelease / Revoke  
- Analytics changes  
- Legacy Pathology integration  
- Production role grants  
- Automatic Report Number assignment on Release  

This acceptance-closure task:

- Did **not** modify backend, frontend, schema, migrations, permissions, role assignments, APIs, routes, or state machines  
- Did **not** start CUT B or CUT C  
- Does **not** authorize CUT B/C without separate Product Discovery / Decision Closure  

---

## 11. Known limitations

| Limitation | Note |
| --- | --- |
| Number format is environment-configured | Missing config → `503 report_number_configuration_missing` |
| UAT format values are test-tagged | Prefix `UAT-RPT` / format `UAT_RPT_UTC_DAY` — not production defaults |
| Non-Admin staff need governed role grants for `lms.reports.assign_number` | Admin `*` path used for authorized UAT actor; catalogue has no seeded production grants |
| CUT B / CUT C | Not started |

---

## 12. Next gate

```text
NEXT_GATE = PRODUCT_DISCOVERY_REQUIRED
```

Do **not** treat this Acceptance Closure as authorization to implement CUT B (PDF) or CUT C (download). Those require separate Product Discovery and Decision Closure.

---

## 13. Final stamps

```text
MANUAL_UAT_PASSED
ACCEPTANCE_COMPLETE
ACCEPTED_L_REP_03_CUT_A
L_REP_02B_REMAINS_ACCEPTED
CUT_A_ACCEPTED
CUT_B_NOT_STARTED
CUT_C_NOT_STARTED
NEXT_GATE = PRODUCT_DISCOVERY_REQUIRED
```

# ACCEPTED_L_REP_03_CUT_A

**STOP.** Do not authorize, discover, audit, or implement CUT B or CUT C in this task.
