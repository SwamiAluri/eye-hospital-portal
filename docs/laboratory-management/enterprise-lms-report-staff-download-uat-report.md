# L-REP-03 CUT C — Official PDF Staff Download  
# Manual UAT Report

**Date/time:** 2026-10-13 (local UAT execution)  
**Slice:** L-REP-03 CUT C — Official PDF Staff Download  
**Mode:** MANUAL UAT PREPARATION + EXECUTION ONLY — no product behavior changes  

**Authoritative references**

| Document | Role |
| --- | --- |
| [enterprise-lms-report-staff-download-decision-closure.md](./enterprise-lms-report-staff-download-decision-closure.md) | Binding PD-DL-* |
| [enterprise-lms-report-staff-download-implementation-report.md](./enterprise-lms-report-staff-download-implementation-report.md) | `CUT_C_IMPLEMENTATION_COMPLETE` |
| Upstream | `ACCEPTED_L_REP_02B`, `ACCEPTED_L_REP_03_CUT_A`, `ACCEPTED_L_REP_03_CUT_B` |

```text
MANUAL_UAT_PASSED

ACCEPTANCE_NOT_CLAIMED
ACCEPTANCE_COMPLETE = NO
ACCEPTED_L_REP_03_CUT_C = NOT CLAIMED

NEXT_GATE = ACCEPTANCE_CLOSURE
```

---

## 1. UAT date/time

2026-10-13 — Manual UAT executed against the local/dev Hospital Portal stack (AuthService + LaboratoryApi Functions + Next.js portal).

## 2. Environment

| Component | Endpoint / note | Result |
| --- | --- | --- |
| AuthService | `http://localhost:5073` | Running (Swagger 200) |
| LaboratoryApi | `http://localhost:7076` | Running (`/api/lms/health` 200) |
| Hospital Portal Web | `http://localhost:3000` | Running |
| Shared internal key | Lab `AuthService__InternalApiKey` ↔ Auth `InternalApi:Key` | **Match** (value not recorded) |
| Lab → Auth CanonicalDocument content | `POST /api/internal/canonical-documents/lms-official-pdf/content` | Wrong key **401**; correct key **200** `application/pdf` |
| CUT B PDF template / signatory | Active rows present | Confirmed |
| CUT C migration | None expected | Confirmed (no new schema) |
| Stale LaboratoryApi host | Initial download/generate routes **404** | **Corrected** by rebuild + `func start --port 7076` (runtime only) |

## 3. Services verified

- AuthService listening and serving internal LMS Official PDF content stream  
- LaboratoryApi Functions host with `LmsReportOfficialPdfDownload`, `LmsReportOfficialPdfGenerate`, `LmsOfficialPdfJobDrain` registered  
- Browser UI against Downtown Hospital branch context  

## 4. UAT user category

| Actor | Category | Use |
| --- | --- | --- |
| `labmgr1@hospital.com` (Joseph Lopez / Lab Manager) | Authorized staff | Happy-path UI + API download |
| `labtech1@hospital.com` | Unauthorized for download | Permission denial (API) |
| Wrong `operatingBranchId` with Lab Manager JWT | Branch denial | Branch authorization (API) |

### Operational UAT grants (environment only — not production seeders)

Documented controlled DB grants to Lab Manager role `deb7dae5-4419-4df1-973f-0d6c89c2f292`:

| Permission | Grant id | Why |
| --- | --- | --- |
| `lms.reports.download` | `b5555555-5555-4555-8555-555555555555` | CUT C download affordance / API |
| `lms.view` | `b6666666-6666-4666-8666-666666666666` | LMS shell `ProtectedRoute` |
| `lms.reports.view` | `b7777777-7777-4777-8777-777777777777` | Report read APIs |

Prior CUT B operational grant retained: Lab Manager → `lms.reports.generate` (`b4444444-…`).  
**No source seeder / production RolePermission catalogue changes.** Re-login required after grants.

## 5–9. Report fixture (identifiers only)

| Field | Value |
| --- | --- |
| Report ID | `a34fdfdc-5e21-4684-a436-4d192ecc96be` |
| Business Report Number | `UAT-RPT-20261012-000001` |
| Operating branch | `74c014cf-9570-4824-bdf9-b369ea11a8f4` (Downtown Hospital) |
| Status | Released |
| ReportVersion | 1 (unchanged after downloads) |
| Current Official Artifact ID | `d69a1d7c-f0da-4103-bc67-8f79496876a7` |
| Artifact version | **2** (Succeeded) |
| CanonicalDocument ID | `76f84c82-3db4-4680-b33f-52f3a70b1329` |
| Artifact size | 34380 bytes |

No MRN / patient name recorded in this report.

---

## 10–11. Scenario matrix

| ID | Scenario | Result | Evidence / notes |
| --- | --- | --- | --- |
| UAT-01 | Eligible Report Detail | **PASS** | UI: Released, `UAT-RPT-20261012-000001`, Official PDF Succeeded v2, Download + Generate visible |
| UAT-02 | Download | **PASS** | UI download (post-restart) no error; API `200`, `Content-Type: application/pdf`, `Content-Disposition: attachment; filename="UAT-RPT-20261012-000001.pdf"`, magic `%PDF`, length 34380 |
| UAT-03 | Audit | **PASS** | `audit_log.action=DOWNLOAD_OFFICIAL_PDF`; Description includes reportId, artifactId, artifactVersion=2, canonicalDocumentId, contentHash, operatingBranchId, businessReportNumber; no patient PHI fields |
| UAT-04 | Repeated download | **PASS** | Second API download `200` same filename/size; multiple `DOWNLOAD_OFFICIAL_PDF` rows for same Report |
| UAT-05 | Reports Worklist | **PASS** | Eligible row shows `Download` (`reports-download-a34fdfdc-…`); Drafts show Open only; **no Generate**; worklist Download clicked successfully; no historical selector / PDF viewer |
| UAT-06 | Unnumbered Released | **NOT EXECUTABLE SAFELY** | DB query: no Released report without Business Report Number in UAT DB; will not mutate production/UAT data to strip a number |
| UAT-07 | Non-Released | **PASS** | Draft `c08ddff2-…` API download → `409` `invalid_state` (“Official PDF download requires a Released Report.”); Worklist Draft rows have no Download |
| UAT-08 | Failed / missing current artifact | **NOT EXECUTABLE SAFELY** | Only Released+numbered report in UAT already has Succeeded current artifact; will not corrupt certified artifact pointer/status |
| UAT-09 | Branch authorization | **PASS** | Wrong branch GUID → `403` (“User is not authorized for the collection branch.”); no PDF bytes |
| UAT-10 | Permission authorization | **PASS** | `labtech1` JWT lacks `lms.reports.download` → `403` (“Missing permission. Required one of: lms.reports.download”); no PDF bytes |
| UAT-11 | Current artifact only | **PASS** | UI has no historical artifact selector; API accepts only reportId (+ operatingBranchId); current pointer remains artifact v2; historical v1 not downloadable via UI |
| UAT-12 | Patient boundaries | **PASS** | No LMS Official PDF download wiring under Patient components; portal copy states staff-only / not patient-visible; no new patient-facing LMS PDF route introduced by CUT C |
| UAT-13 | Pathology regression | **PASS** | `/dashboard/laboratory` loads Pathology work queue; LMS download uses `/api/lms/reports/{id}/official-pdf` (not legacy lab-reports) |
| UAT-14 | Release / Number / Generation regression | **PASS** | After downloads: Status=Released, Number unchanged, ReportVersion=1, CurrentOfficialArtifactId unchanged (v2); Download does not call Generate; Generate remains separate Detail action |
| UAT-15 | Security / network | **PASS** | Browser/API request to LaboratoryApi host only; attachment headers; internal Blob stream verified server-to-server; no SAS / public Blob URL / storage key returned to client; client does not supply artifactId/canonicalDocumentId |

---

## 12. Failures

None on executable scenarios after environment correction.

**Initial blocker (runtime, not product defect):** LaboratoryApi host on 7076 was stale (pre–CUT C binaries). Download and Generate routes returned **404** until rebuild + host restart. Documented under environment corrections.

## 13. Environment corrections

1. Operational UAT role grants for Lab Manager: `lms.reports.download`, `lms.view`, `lms.reports.view` (DB only; documented above).  
2. Re-login Lab Manager so JWT included new permissions.  
3. Rebuild LaboratoryApi Debug + restart Azure Functions host on port **7076** so `LmsReportOfficialPdfDownload` is registered.  

No application source changes during UAT.

## 14. Security observations

- Staff download is JWT-authenticated LMS proxy only.  
- Internal Auth content endpoint rejects wrong internal key (**401**) and streams private Blob after association checks.  
- Missing permission and unauthorized branch return controlled **403** without PDF body.  
- Non-Released returns controlled **409** `invalid_state`.  
- Audit details are operational identifiers only (no MRN/name/DOB).  

## 15. Regression observations

- Pathology module route remains available and distinct from LMS Reports.  
- Release remains metadata-only; Report Number immutable; Official PDF Generate remains CUT B action on Detail.  
- Download does not create artifacts or change Report lifecycle fields.  

## 16. Automated-test baseline (pre-UAT)

| Suite | Result |
| --- | --- |
| OfficialPdfServiceTests | 22 passed |
| Report/OfficialPdf/ReportNumber regression | 64 passed |
| Auth CUT C filter | 33 passed |
| `enterprise-lms-reports-ui.test.ts` | 12 passed |

Automated tests were not re-executed as a substitute for Manual UAT.

## 17. Final UAT status

```text
MANUAL_UAT_PASSED

Executable mandatory scenarios: PASS
NOT EXECUTABLE SAFELY (documented): UAT-06, UAT-08

ACCEPTANCE_NOT_CLAIMED
ACCEPTANCE_COMPLETE = NO
ACCEPTED_L_REP_03_CUT_C = NOT CLAIMED

CUT_C_IMPLEMENTATION_COMPLETE (unchanged)
PRODUCT_DECISIONS_CLOSED_L_REP_03_CUT_C (unchanged)

NEXT_GATE = ACCEPTANCE_CLOSURE

STOP
```

**Acceptance note:** UAT-06 and UAT-08 were not safely executable against existing UAT data without mutating certified Released/numbered/artifact records. Product Acceptance should explicitly acknowledge those gaps or supply isolated disposable fixtures before claiming full matrix coverage.
