# L-REP-02B — Report Release Acceptance Closure

**Date:** 2026-10-12  
**Mode:** DOCUMENTATION / FORMAL ACCEPTANCE CLOSURE ONLY — no application code, schema, API, UI, permission, role-grant, ResultStatus, PDF, numbering, download, publication, NotificationHub, Amendments, Unrelease/Revoke, Pathology, CanonicalDocument, Orders/Collection/Specimen/Receiving/Barcode, Testing, Verification, Clinical Authorization, or Critical Results changes  

**Authoritative references:**

| Document | Role |
| --- | --- |
| [enterprise-lms-report-release-decision-closure.md](./enterprise-lms-report-release-decision-closure.md) | Product Decision Closure (`PRODUCT_DECISIONS_CLOSED_L_REP_02B_AUTHORIZED`) |
| [enterprise-lms-report-release-implementation-audit.md](./enterprise-lms-report-release-implementation-audit.md) | Pre-coding implementation audit |
| [enterprise-lms-report-release-implementation.md](./enterprise-lms-report-release-implementation.md) | Implementation report |
| [enterprise-lms-report-release-pre-uat-verification.md](./enterprise-lms-report-release-pre-uat-verification.md) | PRE-UAT automated / runtime evidence (`IMPLEMENTATION_COMPLETE_READY_FOR_PRE_UAT`) |
| Upstream | L-REP-01 Report Foundation; L-REP-02A Finalize (`ACCEPTED_L_REP_02A`) |

```text
PRODUCT_DECISIONS_CLOSED_L_REP_02B_AUTHORIZED
  → L-REP-02B implemented + PRE-UAT automated/runtime evidence
  → Manual UAT PASSED (UI evidence below)
  ↓
L-REP-02B ACCEPTED  (THIS DOCUMENT)
  ↓
Next gate: PRODUCT_DISCOVERY_REQUIRED
  (PDF / numbering / download / publication / notification / Amendments — NOT started)
```

---

## 1. Acceptance status

# ACCEPTED_L_REP_02B

| Gate | Status |
| --- | --- |
| Product Decision Closure | **`PRODUCT_DECISIONS_CLOSED_L_REP_02B_AUTHORIZED`** |
| Implementation status | **`IMPLEMENTATION_COMPLETE_READY_FOR_PRE_UAT`** |
| PRE-UAT automated / runtime | **YES** (see §5) |
| Manual UAT | **`PASSED`** / **`MANUAL_UAT_PASSED`** |
| Formal acceptance | **`ACCEPTED`** / **`ACCEPTED_L_REP_02B`** |

Product Owner statement (human UAT result):

> "Tested manually from UI. All looking good."

Acceptance is based on Product Decision stamps, implementation/PRE-UAT documentation, runtime operational evidence, **and** Manual UAT exercised through the UI (evidence in §6). Automated tests alone do not constitute acceptance.

---

## 2. Product Decision Closure reference

| Stamp | Source |
| --- | --- |
| `PRODUCT_DECISIONS_CLOSED_L_REP_02B_AUTHORIZED` | [enterprise-lms-report-release-decision-closure.md](./enterprise-lms-report-release-decision-closure.md) |

Scope authorized and accepted: **Final → Released metadata only.**

---

## 3. L-REP-02B scope (accepted)

| In scope | Out of scope (explicit) |
| --- | --- |
| `Report.Status` Final → Released | PDF / document generation |
| `ReleasedAtUtc` / `ReleasedByUserId` (server UTC / authenticated actor) | Business Report numbering |
| Current ReportVersion unchanged (no new version) | Download |
| Source claims retained | Patient Portal / Patient 360 publication |
| ResultStatus / ResultVersion / CriticalResultEvent unchanged | NotificationHub / SMS / email / WhatsApp |
| `POST …/release` + `lms.reports.release` | Amendments / Unrelease / Revoke |
| `release_report` idempotency + RowVersion | Dual-control / signatory hierarchy |
| `RELEASE_REPORT` platform audit (fail-closed) | Production role grants |
| Release confirmation UI + Released metadata | CanonicalDocument association |

---

## 4. Release semantics (certified)

1. Report.Status transitions Final → Released.  
2. Draft → Released is forbidden.  
3. Released → Released (new transition) is forbidden.  
4. ReleasedAtUtc is server UTC.  
5. ReleasedByUserId is the authenticated platform user.  
6. Release binds to the existing current Final ReportVersion.  
7. Release does NOT create a new ReportVersion.  
8. Released content remains immutable.  
9. Source claims remain retained after Release.  
10. ResultStatus remains unchanged.  
11. ResultVersion remains unchanged.  
12. CriticalResultEvent remains unchanged.  
13. Release does not make the Report patient-visible.  
14. Release does not generate PDF/document bytes.  
15. Release does not assign a business Report number.  
16. Release does not emit NotificationHub / SMS / email / WhatsApp.  
17. Amendments / Unrelease / Revoke remain future / out of scope.  
18. Audit is platform `audit_log` and fail-closed.  
19. Release requires `lms.reports.release` plus tenant / operating-branch authorization.  
20. Idempotency operation is `release_report`.  
21. Optimistic concurrency uses `expectedRowVersion` / HTTP 409.  
22. No production role grants in this closure.  
23. No dual-control or signatory hierarchy.

---

## 5. Implementation / PRE-UAT baseline

Documented status: **`IMPLEMENTATION_COMPLETE_READY_FOR_PRE_UAT`**

| Item | Evidence |
| --- | --- |
| Migration | `20261012200000_AddLmsReportReleaseMetadata` |
| Schema | `released_at_utc`, `released_by_user_id` on `lms_reports` |
| API | `POST /api/lms/reports/{reportId}/release` |
| Permission | `lms.reports.release` (catalogue + endpoint; **no role grants**) |
| Idempotency | `release_report` |
| Concurrency | `expectedRowVersion`; PostgreSQL concurrent Release exactly once |
| Audit | `RELEASE_REPORT` / `LmsReport`; AuthService allowlist |
| Fail-closed | Audit failure → Status remains Final; Released* not persisted |
| AuthService restart | Fresh process after allowlist change |
| LaboratoryApi restart | `LmsReportRelease` route registered on `:7076` |
| Runtime audit probe | `RELEASE_REPORT` + `LmsReport` → HTTP 200 logged |
| LaboratoryApi.Tests | **298 passed** |
| Auth allowlist / reports permission tests | **24 passed** |
| Reports UI tests | **10 passed** |
| LMS FE regression | **93 passed** |
| Primary report | [enterprise-lms-report-release-implementation.md](./enterprise-lms-report-release-implementation.md) |
| PRE-UAT | [enterprise-lms-report-release-pre-uat-verification.md](./enterprise-lms-report-release-pre-uat-verification.md) |

Pre-migration UAT data check (PRE-UAT): Draft and Final reports remained readable; no automatic Release of existing Finals.

---

## 6. Manual UAT evidence (UI)

Product Owner manually tested Final → Release → Released through the Reports UI.

### A. Final state

| Observation | Result |
| --- | --- |
| Existing Final Report opened | Observed |
| Status = Final | Observed |
| Current version = 1 | Observed |
| Finalized by displayed | Observed |
| Finalized at displayed | Observed |
| Release Report action visible | Observed |

### B. Release confirmation

| Observation | Result |
| --- | --- |
| Explicit confirmation state | Observed |
| Status will become Released | Observed in confirmation copy |
| Version 1 remains frozen | Observed in confirmation copy |
| No PDF generation | Observed in confirmation copy |
| No patient notification | Observed in confirmation copy |
| No patient visibility | Observed in confirmation copy |

### C. Released state (after confirm)

| Observation | Result |
| --- | --- |
| Status = Released | Observed |
| Current version remains 1 | Observed |
| Released by displayed | Observed |
| Released at displayed | Observed |
| Version / ReportVersion snapshot unchanged | Observed |
| Snapshot Result remains ClinicallyAuthorized | Observed |
| No repeated Release action | Observed |
| No Unrelease / Revoke | Observed |
| No PDF / Download / Publish / Notify | Observed |

### D. Reports worklist

| Observation | Result |
| --- | --- |
| Released report shows Status = Released | Observed |
| Existing Draft reports remain present | Observed |
| No unrelated KPI / metrics introduced | Observed |

### Product Owner conclusion

```text
MANUAL_UAT_PASSED
```

Statement: *"Tested manually from UI. All looking good."*

### Manual UAT limitations (honest)

| Check | Status |
| --- | --- |
| Second actor without `lms.reports.release` | **Not manually evidenced** — covered by automated permission wiring + Auth catalogue tests |
| Manual stale RowVersion conflict | **Not manually evidenced** — covered by unit + PostgreSQL concurrency tests |
| Manual claim-block of new Draft after Release | **Not manually evidenced in UAT notes** — covered by automated `Release_Keeps_Claim_Blocking_New_Draft` |
| Manual audit fail-closed / idempotency hash conflict | **Not manually evidenced** — covered by automated / runtime PRE-UAT |

Screenshots / UI observation establish the primary Final → Release → Released happy path. Do not invent additional manual checks.

---

## 7. Acceptance matrix

| Criterion | Manual UAT | Automated | Runtime | Notes |
| --- | --- | --- | --- | --- |
| Final report available for Release | **Yes** | — | — | Status Final; Release action visible |
| Explicit Release confirmation | **Yes** | FE source tests | — | Confirmation copy observed |
| Final → Released | **Yes** | Unit tests | — | |
| ReleasedAtUtc | **Yes** (UI “Released at”) | Unit tests | Schema columns | Server UTC in service |
| ReleasedByUserId | **Yes** (UI “Released by”) | Unit tests | — | Authenticated actor |
| ReportVersion unchanged | **Yes** (version 1) | Unit + PG concurrency | — | No new version |
| Snapshot unchanged | **Yes** | Unit tests | — | |
| Result remains ClinicallyAuthorized | **Yes** (snapshot status) | Unit tests | — | ResultStatus not mutated |
| Released persists after navigation | **Yes** (worklist return) | — | — | Explicit refresh not separately logged; worklist return confirms persistence |
| Released in Reports worklist | **Yes** | — | — | Draft rows still present |
| Release unavailable after Released | **Yes** | FE source tests | — | |
| No Unrelease / Revoke | **Yes** | FE assertions | — | Out of scope |
| No PDF | **Yes** | FE assertions | — | Out of scope |
| No Download | **Yes** | FE assertions | — | Out of scope |
| No Publish | **Yes** | FE assertions | — | Out of scope |
| No Notify | **Yes** | FE assertions | — | Out of scope |
| Source claims preserved | Automated | Unit tests | — | Not separately logged in Manual UAT notes |
| ResultStatus unchanged | Automated (+ snapshot Manual) | Unit tests | — | |
| Audit `RELEASE_REPORT` | Automated + Runtime | Unit + Auth allowlist | **HTTP 200 probe** | |
| Authorization `lms.reports.release` | Automated | Endpoint wiring + Auth catalogue | — | Second actor not manually tested |
| Tenant / branch | Automated | Unit tests | — | |
| Idempotency `release_report` | Automated | Unit tests | — | |
| Concurrency / RowVersion | Automated | Unit + **PostgreSQL** concurrent Release | — | Manual stale RV not tested |
| Fail-closed audit | Automated | Unit (remains Final) | — | |
| No role grants | Automated | Auth seed tests | — | |
| No downstream side effects | Automated + Manual (no PDF/notify/publish) | Unit (Result/Critical/claims) | — | |

---

## 8. Regression / boundary statement

Acceptance of L-REP-02B **does not authorize or imply** implementation of:

- PDF  
- Report numbering  
- Document generation  
- CanonicalDocument association  
- Download  
- Patient Portal publication  
- Patient 360 publication  
- NotificationHub  
- SMS / email / WhatsApp  
- Amendments  
- Unrelease  
- Revoke  
- Dual-control  
- Signatory hierarchy  
- Production role grants  

Certified areas remain unchanged by this acceptance:

| Area | Status |
| --- | --- |
| L-REP-01 Draft foundation | Unchanged / preserved |
| L-REP-01 source uniqueness | Unchanged / preserved |
| L-REP-02A Finalize | Unchanged / remains `ACCEPTED_L_REP_02A` |
| L-TST / L-VER / L-AUTH / L-CRT | Unchanged |
| Orders / Collection / Specimen / Receiving / Barcode | Unchanged |
| Legacy Pathology | Unchanged |

---

## 9. Explicit non-claims

This acceptance-closure task:

- Did **not** modify backend, frontend, schema, migrations, permissions, role assignments, APIs, routes, or state machines  
- Did **not** start PDF, numbering, download, publication, NotificationHub, Amendments, Unrelease/Revoke, or any adjacent LMS slice  
- Does **not** authorize the next product slice without separate Product Discovery / Decision Closure  

---

## 10. Final stamps

```text
ACCEPTED_L_REP_02B
MANUAL_UAT_PASSED
ACCEPTANCE_COMPLETE
NEXT_GATE = PRODUCT_DISCOVERY_REQUIRED
```

# ACCEPTED_L_REP_02B

**STOP.** Do not propose or implement the next feature in this task.
