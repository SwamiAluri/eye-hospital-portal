# L-REP-03 CUT C — Official PDF Staff Download  
# Acceptance Closure

**Date:** 2026-10-13  
**Slice:** L-REP-03 CUT C — Official PDF Staff Download  
**Mode:** DOCUMENTATION / FORMAL ACCEPTANCE CLOSURE ONLY — no application code, schema, migration, API, DTO, domain, Blob, CanonicalDocument, permission, role-grant, audit allowlist, frontend, route, navigation, Release, Report Number, ReportVersion, Official PDF generation, Result, Authorization, Pathology, Patient Portal, Patient 360, NotificationHub, historical artifact, amendment, or next-slice changes  

**Authoritative references:**

| Document | Role |
| --- | --- |
| [enterprise-lms-report-staff-download-decision-closure.md](./enterprise-lms-report-staff-download-decision-closure.md) | Product Decision Closure (`PRODUCT_DECISIONS_CLOSED_L_REP_03_CUT_C`) |
| [enterprise-lms-report-staff-download-readiness-audit.md](./enterprise-lms-report-staff-download-readiness-audit.md) | Implementation readiness audit |
| [enterprise-lms-report-staff-download-implementation-report.md](./enterprise-lms-report-staff-download-implementation-report.md) | Implementation report (`CUT_C_IMPLEMENTATION_COMPLETE`) |
| [enterprise-lms-report-staff-download-uat-report.md](./enterprise-lms-report-staff-download-uat-report.md) | Manual UAT report (`MANUAL_UAT_PASSED`, historically `ACCEPTANCE_NOT_CLAIMED`) |
| Upstream | L-REP-02B (`ACCEPTED_L_REP_02B`); CUT A (`ACCEPTED_L_REP_03_CUT_A`); CUT B (`ACCEPTED_L_REP_03_CUT_B`) |

```text
PRODUCT_DECISIONS_CLOSED_L_REP_03_CUT_C
  → CUT C implemented (CUT_C_IMPLEMENTATION_COMPLETE)
  → Manual UAT PASSED (with UAT-06 / UAT-08 limitations acknowledged)
  ↓
L-REP-03 CUT C ACCEPTED  (THIS DOCUMENT)
  ↓
Next gate: PRODUCT_DISCOVERY_REQUIRED
  (next LMS Report lifecycle capability — NOT started, NOT authorized here)
```

---

## 1. Acceptance purpose

Formally close Product Owner acceptance for **L-REP-03 CUT C — Official PDF Staff Download** based on:

- approved Product Decisions (PD-DL-*)
- completed bounded implementation
- automated test evidence
- Manual UAT evidence
- security and regression evidence
- explicit Product Owner acknowledgment of UAT-06 and UAT-08 safe-execution limitations

This document does **not** reopen Product Decisions, does **not** modify application behavior, and does **not** start the next LMS product slice.

The historical UAT report remains `MANUAL_UAT_PASSED` with its contemporaneous `ACCEPTANCE_NOT_CLAIMED` stamp; this closure is the separate acceptance event.

---

## 2. Authoritative references

See table above. Upstream acceptance records for L-REP-02B, CUT A, and CUT B are **preserved unchanged**.

---

## 3. Product Decision closure reference

| Stamp | Source |
| --- | --- |
| `PRODUCT_DECISIONS_CLOSED_L_REP_03_CUT_C` | [enterprise-lms-report-staff-download-decision-closure.md](./enterprise-lms-report-staff-download-decision-closure.md) |

Scope accepted in this closure: **CUT C — Official PDF Staff Download only.**

PD-DL-* decisions are **not reopened**. CUT B Official PDF generation remains separately accepted (`ACCEPTED_L_REP_03_CUT_B`).

---

## 4. Implementation completion reference

| Document | Stamp / result |
| --- | --- |
| Implementation report | `CUT_C_IMPLEMENTATION_COMPLETE` |
| Schema / migration | **None** for CUT C (relies on accepted CUT B Official PDF foundation) |
| Production role grants in source | **None** (catalogue + Lab Authz + FE wiring only) |

Implemented boundary (summary):

- Staff download of the **current** Official PDF via JWT LMS proxy  
- AuthService internal association-gated content stream (private Blob; no SAS)  
- `lms.reports.download` authorization  
- Fail-closed `DOWNLOAD_OFFICIAL_PDF` audit before bytes  
- Report Detail + Reports Worklist Download UX  
- Server-projected `officialPdfDownloadEligible`  

---

## 5. Manual UAT reference

| Document | Stamp / result |
| --- | --- |
| [enterprise-lms-report-staff-download-uat-report.md](./enterprise-lms-report-staff-download-uat-report.md) | `MANUAL_UAT_PASSED` |

Manual UAT date: **2026-10-13**.  
Primary fixture (identifiers only): Report `a34fdfdc-…`, Business Report Number `UAT-RPT-20261012-000001`, current artifact version **2**, Downtown Hospital operating branch.

This acceptance does **not** claim `ALL_UAT_SCENARIOS_MANUALLY_EXECUTED`.

---

## 6. Automated test evidence

Carried forward from the implementation report (not re-run for this closure):

| Suite | Result |
| --- | --- |
| LaboratoryApi `OfficialPdfServiceTests` | **22 passed** |
| Report / OfficialPdf / ReportNumber regression filter | **64 passed** |
| Auth CUT C filter (permissions / audit / CanonicalDocument) | **33 passed** |
| Frontend `enterprise-lms-reports-ui.test.ts` | **12 passed** |
| **Total listed** | **131 passed / 0 failed** |

Automated denial coverage (including unnumbered / missing-or-failed artifact paths) complements the two Manual UAT scenarios that were not safely executable.

---

## 7. Acceptance scope

**Accepted capability:** Staff download of the current Official PDF for an eligible Released, numbered Enterprise LMS Report through the authenticated LaboratoryApi proxy, with AuthService owning CanonicalDocument / private Blob bytes.

**Not accepted / not in scope:** Patient publication or download, Patient 360 download, notifications, historical artifact download, amendments, supersession, Unrelease, Revoke, retention enforcement, Pathology dual-write, SAS/public Blob URLs, production RolePermission grants, design-system changes, or any next lifecycle slice.

Generate Official PDF on Report Detail remains the accepted **CUT B** capability.

---

## 8. Acceptance criteria

| Criterion | Met? |
| --- | --- |
| Product Decisions closed for CUT C | **Yes** |
| Implementation complete within approved boundary | **Yes** |
| Automated tests green (listed baseline) | **Yes** (131 / 0) |
| Manual UAT passed for executable scenarios | **Yes** |
| Successful download proven (MIME, filename, PDF magic, length) | **Yes** |
| `DOWNLOAD_OFFICIAL_PDF` audit proven (including repeat) | **Yes** |
| Branch + permission denials proven | **Yes** |
| Non-Released denial proven | **Yes** |
| No SAS / public Blob exposure | **Yes** |
| Worklist Download-only (no Generate) | **Yes** |
| Pathology / Patient boundaries / Release–Number–Generate regression | **Yes** |
| UAT-06 / UAT-08 limitations explicitly acknowledged | **Yes** (this document) |

---

## 9. UAT scenario summary

| ID | Scenario | Manual UAT result |
| --- | --- | --- |
| UAT-01 | Eligible Report Detail | **PASS** |
| UAT-02 | Download (200, `application/pdf`, attachment, `{BusinessReportNumber}.pdf`, `%PDF`, expected length) | **PASS** |
| UAT-03 | `DOWNLOAD_OFFICIAL_PDF` audit | **PASS** |
| UAT-04 | Repeated download + second audit | **PASS** |
| UAT-05 | Reports Worklist Download; no Generate; no historical selector; no PDF viewer | **PASS** |
| UAT-06 | Released but unnumbered | **NOT EXECUTABLE SAFELY** |
| UAT-07 | Non-Released → `409` `invalid_state` | **PASS** |
| UAT-08 | Failed / missing current artifact | **NOT EXECUTABLE SAFELY** |
| UAT-09 | Wrong branch → `403`, no PDF bytes | **PASS** |
| UAT-10 | Missing `lms.reports.download` → `403`, no PDF bytes | **PASS** |
| UAT-11 | Current artifact only | **PASS** |
| UAT-12 | Patient boundaries | **PASS** |
| UAT-13 | Pathology regression | **PASS** |
| UAT-14 | Release / Number / Generation regression | **PASS** |
| UAT-15 | Security / network (LMS proxy; no SAS/Blob URL; no client artifact/document authority) | **PASS** |

---

## 10. UAT-06 limitation

| Item | Statement |
| --- | --- |
| Scenario | Released Report without Business Report Number |
| Manual result | **`NOT EXECUTABLE SAFELY`** — **not** PASS |
| Reason | No such Released unnumbered report existed in the UAT database; certified Released/numbered records were **not** mutated to manufacture a negative fixture |
| Compensating evidence | Automated Official PDF / download denial coverage for unnumbered / `report_number_required` paths in LaboratoryApi tests |
| Product Owner acknowledgment | **Required and recorded here:** UAT-06 was not manually executed; acceptance proceeds with this limitation |

---

## 11. UAT-08 limitation

| Item | Statement |
| --- | --- |
| Scenario | No current artifact **or** current artifact not Succeeded |
| Manual result | **`NOT EXECUTABLE SAFELY`** — **not** PASS |
| Reason | The available Released+numbered UAT Report already had a Succeeded current Official PDF artifact; certified artifact pointer/status were **not** corrupted to manufacture a negative fixture |
| Compensating evidence | Automated coverage for missing current artifact and Failed current artifact denial in LaboratoryApi OfficialPdf download tests |
| Product Owner acknowledgment | **Required and recorded here:** UAT-08 was not manually executed; acceptance proceeds with this limitation |

**Acceptance interpretation:** These two gaps do **not** block CUT C acceptance when:

1. they remain explicitly **not** reclassified as PASS,  
2. no certified data was deliberately corrupted,  
3. automated tests cover the corresponding denials,  
4. Manual UAT independently covered eligibility, successful download, audit, repeat, Worklist, non-Released, branch, permission, current-artifact-only, patient, Pathology, regression, and security boundaries, and  
5. the Product Owner acknowledges the gaps (this closure).

---

## 12. Security acceptance

CUT C security boundary is **accepted** as implemented and UAT-verified:

| Control | Status |
| --- | --- |
| JWT-authenticated LMS application proxy | Accepted |
| `lms.reports.download` authorization | Accepted |
| Tenant isolation | Accepted |
| Operating branch authorization | Accepted |
| Server-side current artifact resolution | Accepted |
| Browser does not supply artifactId as resource authority | Accepted |
| Browser does not supply canonicalDocumentId as resource authority | Accepted |
| No Blob key / SAS / public Blob URL to browser | Accepted |
| AuthService association gate (`enterprise_lms` / `LmsReportOfficialPdfArtifact`) | Accepted |
| `DOWNLOAD_OFFICIAL_PDF` audit | Accepted |
| Audit fail-closed (no bytes on audit failure) | Accepted (implementation + automated evidence) |
| Wrong permission → controlled denial, no PDF bytes | Accepted (Manual UAT-10) |
| Wrong branch → controlled denial, no PDF bytes | Accepted (Manual UAT-09) |
| Non-Released → controlled `invalid_state` | Accepted (Manual UAT-07) |

---

## 13. Regression acceptance

| Area | Status |
| --- | --- |
| Report Release remains metadata-only | Accepted unchanged |
| Business Report Number remains immutable | Accepted unchanged |
| Official PDF Generate remains CUT B operation | Accepted unchanged |
| Download does not trigger Generate / new artifact version / status / number change | Accepted (Manual UAT-14) |
| Patient Portal / Patient 360 unchanged | Accepted (Manual UAT-12) |
| Legacy Pathology unchanged / not used as LMS download path | Accepted (Manual UAT-13) |
| No NotificationHub / patient publication introduced | Accepted |

---

## 14. Environment correction note

| Item | Classification |
| --- | --- |
| Initial Manual UAT download/generate **404** | Operational / stale LaboratoryApi host (pre–CUT C binaries on port 7076) |
| Correction | Rebuild LaboratoryApi + restart Functions host; re-run UAT |
| Source code changed during UAT | **None** |
| Product / CUT C implementation defect | **No** |
| Remediation backlog item | **Not required** unless the stale-host condition recurs without process control |

---

## 15. Explicit out-of-scope confirmation

This acceptance does **not** claim or authorize:

- Patient Portal or Patient 360 Official PDF download / publication  
- Notifications / NotificationHub integration  
- Historical artifact browsing or download  
- Amendments / supersession / Unrelease / Revoke  
- Retention enforcement  
- Pathology migration or dual-write  
- SAS or public Blob access models  
- Production RolePermission grants or a new security model  
- Design system / navigation redesign  
- Changes to Release, Report Number, Official PDF generation, templates, or signatories  
- Start of any next LMS Report lifecycle product slice  

Operational UAT Lab Manager grants (`lms.view`, `lms.reports.view`, `lms.reports.download`) remain **environment test setup**, not production seeder acceptance items.

---

## 16. Acceptance decision

**DECISION: ACCEPT L-REP-03 CUT C — Official PDF Staff Download.**

Basis:

1. Product Decisions closed (`PRODUCT_DECISIONS_CLOSED_L_REP_03_CUT_C`)  
2. Implementation complete within the approved boundary (`CUT_C_IMPLEMENTATION_COMPLETE`)  
3. Automated evidence: **131 passed / 0 failed** (listed baseline)  
4. Manual UAT: `MANUAL_UAT_PASSED` for all executable mandatory scenarios  
5. Security, audit, Worklist, and regression evidence sufficient  
6. UAT-06 and UAT-08 explicitly retained as **NOT EXECUTABLE SAFELY**, with Product Owner acknowledgment and automated compensating coverage  

This closure does **not** state that every UAT scenario was manually executed.

---

## 17. Final status stamps

```text
PRODUCT_DECISIONS_CLOSED_L_REP_03_CUT_C

CUT_C_IMPLEMENTATION_COMPLETE

MANUAL_UAT_PASSED

ACCEPTANCE_COMPLETE

ACCEPTED_L_REP_03_CUT_C

L_REP_02B_REMAINS_ACCEPTED

ACCEPTED_L_REP_03_CUT_A

ACCEPTED_L_REP_03_CUT_B

UAT_LIMITATIONS_ACKNOWLEDGED

UAT-06_NOT_EXECUTABLE_SAFELY

UAT-08_NOT_EXECUTABLE_SAFELY

ALL_UAT_SCENARIOS_MANUALLY_EXECUTED = FALSE
```

---

## 18. Next gate

```text
NEXT_GATE = PRODUCT_DISCOVERY_REQUIRED
```

The next LMS Report lifecycle capability (if any) must proceed through:

1. PRODUCT DISCOVERY  
2. PRODUCT DECISION REVIEW  
3. PRODUCT DECISION CLOSURE  
4. IMPLEMENTATION READINESS  
5. IMPLEMENTATION AUTHORIZATION  

**Do not** automatically begin the next slice from this acceptance.  
**Do not** infer what the next capability should be.

```text
STOP
```
