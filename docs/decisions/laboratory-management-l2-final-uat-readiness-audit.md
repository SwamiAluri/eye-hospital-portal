# Laboratory Management — L2 Final Manual UAT Readiness + Acceptance Gate Audit

**Date:** 2026-10-08  
**Type:** AUDIT + UAT PREPARATION ONLY  
**Mode:** NO IMPLEMENTATION · NO CODE · NO SCHEMA · NO API · NO UI · NO PERMISSIONS  

**Authoritative companions:** V3 product definition, E2E gap analysis, roadmap rebaseline, INT-01, L3-PD, PO matrix, **PO decision closure**, L2 order-composer UX correction implementation.

```text
L2 FINAL UAT READINESS AUDIT COMPLETE
NO IMPLEMENTATION PERFORMED
NO CODE CHANGES
NO SCHEMA CHANGES
NO API CHANGES
NO UI CHANGES
L2 IMPLEMENTATION COMPLETE
L2 ACCEPTANCE NOT CLAIMED
MANUAL UAT IS THE NEXT HUMAN GATE
L3 IMPLEMENTATION NOT STARTED
L3-COM-01 GATED BY L2 ACCEPTANCE / PROGRAM WAIVER
```

---

## 1. Executive summary

L2 Clinical Catalog + Multi-Test Order Composer is **implemented** and **internally complete** for its approved L2 scope. Fresh automated runs match the historical baseline (**69 FE / 53 BE**). No L3 commercial/billing/notification/lifecycle features were found accidentally shipped inside L2.

**UAT readiness decision: READY FOR MANUAL UAT.**

L2 **acceptance is not claimed**. Only human/Product Owner Manual UAT can accept L2. L3-COM-01 remains gated by L2 acceptance or an explicit program waiver.

---

## 2. Current gate

| Gate | Status |
|---|---|
| L2 implementation | **COMPLETE** |
| Frontend laboratory suite (this audit) | **69 passed / 0 failed** |
| Backend laboratory filter (this audit) | **53 passed / 0 failed** |
| L2 Manual UAT | **READY** — human execution pending |
| L2 acceptance | **NOT CLAIMED** |
| L3 implementation | **NOT STARTED** |
| L3-COM-01 | **GATED BY L2 ACCEPTANCE / PROGRAM WAIVER** |
| PO policy closure (COM/BILL/etc.) | **APPROVED** as policy — **does not authorize implementation** |

---

## 3. Actual implementation audit

| Area | Status | Primary sources | Automated coverage | Limitations | UAT importance |
|---|---|---|---|---|---|
| **A. Laboratory catalog** | Implemented | `LaboratoryCatalogController`, `LaboratoryCatalog.cs`, `laboratory-catalog.api.ts`, `LaboratoryCatalogAdminDialog` | Catalog + bootstrap tests; FE L2 catalog contracts | Panels/analytes sparsely populated | High |
| **B. LaboratoryTestDefinition** | Implemented | Domain model + catalog APIs | BE LaboratoryCatalogTests | Optional `ServiceVariantId` (0 linked; expected L2) | High |
| **C. Catalog search/filter** | Implemented | `LaboratoryCatalogPicker` (debounce, groups, loadOnOpen) | FE picker contracts | Client-side filter of loaded catalog | High |
| **D. Ordering clinician lookup** | Implemented | `DoctorSearchAutosuggest`; `GET …/ordering-clinicians` (`patient.view`) | FE UAT-defect + catalog tests | Not `user.view` / doctors/search | High |
| **E. Multi-test Order Composer** | Implemented | `LaboratoryOrderDialog` | FE UX + UAT correction suites | Dialog constrained; table scroll | Critical |
| **F. Panel expansion** | Partial | BE expands panel members into items on `catalog-order` | BE catalog-order tests | Active panels may be 0 in UAT DB | Medium |
| **G. Duplicate prevention** | Implemented | FE `excludeKeys` + toast; BE distinct selection keys + expanded-id check | FE + BE | — | Critical |
| **H. Indication** | Implemented | Required free-text; BE validates | FE + BE | No indication catalog (approved) | Critical |
| **I. Notes** | Implemented | Optional `Input` | FE contracts | — | High |
| **J. Priority** | Implemented | routine/urgent/stat | FE + BE | — | High |
| **K. Patient association** | Implemented | `PatientSearchAutosuggest` + selected card | FE contracts | Branch via `useBranchContext` | Critical |
| **L. LabReport creation** | Implemented | `POST /lab-reports/catalog-order` | BE + FE API mocks | Status defaults `ordered` | Critical |
| **M. LabReportItem creation** | Implemented | Items under one report | BE multi-item | No per-item status (L2 OK) | Critical |
| **N. Legacy single-test** | Implemented | `POST /lab-reports` free-text path retained; catalog path preferred | BE Create tests; FE uses catalog-order | Free-text not L2 happy path | Medium |
| **O. Serialization** | Implemented | `JsonIgnore` on Item↔Report navs | Historical UAT 500 fix / BE | — | Critical |
| **P. Order response** | Implemented | Returns LabReport (+ items as configured) | BE | Confirm items in UAT response | High |
| **Q. Worklist reflection** | Implemented | `LaboratoryWorkbench` + `labReportsApi.list` | L1 workbench tests | Filters/status display | Critical |
| **R. P360 reflection** | Existing certified | `labReportsApi.getByPatient` / `mapLabReport` | patient-360-clinical tests | Projection only | High |
| **S. Slice 4 documents** | Existing certified | attach-report / content; attach≠complete | LabReportCanonicalDocumentTests | Not order-create side effect | Medium |
| **T. Lab Manager auth** | Interim L0 | `laboratory.view` page + `patient.*` API; UAT grants | LaboratoryL0UatPermissionTests | Least-privilege cutover later | High |
| **U. Responsive / short viewport** | Implemented | `!flex`, form-body scroll, `pb-6`, footer `bg-white z-10`, table `max-h` | FE UX layout contracts | Human short-viewport still required | Critical |

---

## 4. Automated test results

### Frontend

| | |
|---|---|
| **Command** | `npx vitest run src/app/dashboard/laboratory` |
| **CWD** | `apps/hospital-portal-web` |
| **Result** | Test Files **7 passed**; Tests **69 passed** (0 failed) |
| **Duration** | ~14.6s (collect/transform dominated) |
| **vs historical 69** | **Match** |

### Backend

| | |
|---|---|
| **Command (successful)** | `dotnet test AuthService.Tests.csproj --filter "FullyQualifiedName~LaboratoryCatalogTests\|FullyQualifiedName~LabReportWorklistTests\|FullyQualifiedName~LabReportCanonicalDocumentTests\|FullyQualifiedName~LaboratoryClinicalCatalogBootstrapTests" -o "..\..\..\artifacts\lab-l2-uat-audit-test"` |
| **CWD** | `microservices/auth-service/AuthService.Tests` |
| **Result** | **Passed! Failed: 0, Passed: 53, Skipped: 0, Total: 53**, Duration ~3s |
| **vs historical 53** | **Match** |

### Backend first attempt (classified)

| | |
|---|---|
| **Command** | Same filter without alternate `-o` (default `bin\Debug`) |
| **Failure** | `MSB3027` / file lock — `AuthService.exe` locked by process **AuthService (PID 35020)** |
| **Classification** | **NON-BLOCKING** environmental/process lock — **not** an L2 product defect |
| **Resolution for audit** | Re-ran with alternate output path → 53 passed |
| **UAT note** | Running AuthService on `:5073` is **expected** for interactive Manual UAT; stop/rebuild carefully if developers need default bin output |

No test **assertion** failures observed in the successful Laboratory filter run.

---

## 5. L2 scope boundary check

| Out-of-scope concern | Found in L2 path? | Notes |
|---|---|---|
| Billing charge posting | **No** | `CreateFromCatalog` has no OpdBill/ChargeCatalog calls |
| Payment collection | **No** | — |
| Insurance claims | **No** | — |
| Specimen/accession workflow | **No** | Strings/timestamps only |
| Observations / verification / release workflow | **No** | Complete endpoint exists historically; not L2 Order Composer scope |
| Notification orchestration | **No** | Local `react-hot-toast` only on create |
| TAT engine | **No** | Catalog `TurnaroundHours` field only |
| External laboratory | **No** | — |
| ServiceVariant population | **No** | Bootstrap leaves null (expected) |
| BillChargeSource implementation | **No** | Policy approved; code unchanged |
| Non-billable schema field | **No** | Policy approved; not implemented |
| Laboratory financial ledger | **No** | — |
| Second event bus | **No** | — |

**Conclusion:** L2 has not accidentally absorbed L3+ commercial/clinical lifecycle implementation.

---

## 6. Functional audit (Order Composer)

| # | Check | Evidence | Verdict for UAT |
|---|---|---|---|
| 1 | Patient identity | PatientSearchAutosuggest + selected card | Ready |
| 2 | Active test search | CatalogPicker loadOnOpen + filter | Ready (needs live catalog data) |
| 3 | Multi select | selectedItems state + table | Ready |
| 4 | Duplicate block | FE excludeKeys; BE 400 on duplicates | Ready |
| 5 | Table columns | Test/Code/Category/Specimen/Remove | Ready |
| 6 | Remove | removeCatalogItem | Ready |
| 7 | Search with many selected | Picker outside table scroll | Ready (human 10+) |
| 8–9 | Indication / notes | Required textarea; optional input | Ready |
| 10 | Priority | select routine/urgent/stat | Ready |
| 11 | Ordering clinician | DoctorSearchAutosuggest + BE doctor check | Ready |
| 12–13 | One LabReport + N items | catalog-order creates report + items | Ready |
| 14 | Panel expansion | BE expands members; FE panel selection | Ready if panels exist |
| 15 | Legacy single-test | Separate POST create retained | Compatible |
| 16 | No circular JSON | JsonIgnore on navs | Ready |
| 17 | Server duplicate reject | Distinct keys + expanded ids | Ready |
| 18 | Authorization | patient.view/update API; laboratory.view page | Interim L0 — document for UAT |

---

## 7. UX / responsive audit (source inspection)

| Check | Source finding | Human UAT still needed? |
|---|---|---|
| Design system (Dialog/Button/Table/emerald cards) | Preserved Hospital Portal primitives | Spot-check |
| Compact selected-test table | Implemented (not stacked cards) | Yes (10+) |
| Controlled dialog height | `max-h-[min(90vh,44rem)]` `!flex` overflow-hidden | Yes |
| Independent table scroll | `max-h-[min(14rem,30vh)] overflow-y-auto` | Yes |
| Form body scroll + footer clearance | form-body `overflow-y-auto pb-6 scroll-pb-6`; footer sibling `bg-white z-10` | Yes (short viewport) |
| Footer accessible | DialogFooter outside scroll body | Yes |
| No new visual language | Matches L2 correction docs | Spot-check |
| Keyboard | Labels/ids; table region tabIndex=0; picker keyboard contracts in tests | Yes |

**No redesign performed in this audit.** Residual UX risk is **human short-viewport / 10+ selection** — covered by Manual UAT checklist, not a code STOP.

---

## 8. Security / authorization audit

| Topic | Current L2 behavior | Assessment |
|---|---|---|
| Page gate | `ProtectedRoute requiredPermission="laboratory.view"` | Correct for nav |
| API read | `patient.view` on list/get/catalog/ordering-clinicians | Interim L0 — intentional |
| API write | `patient.update` on create/catalog-order/complete/attach | Interim L0 — intentional |
| Ordering clinician | `patient.view` — **not** `user.view` | Matches L2 UAT fix |
| Tenant isolation | Patient/catalog/doctor scoped by tenant | Present |
| Branch | FE branch context for patient search; LabReport has VisitId optional | Confirm cross-branch in Manual UAT |
| Lab Manager / Technician | UAT grants: laboratory.view + patient.view + patient.update | Document as interim |
| Permission escalation | No new Lab codes invented in L2 | OK |
| Least-privilege cutover | Deferred (PD-LAB-PERM-02 / Security Decision) | Non-blocking for L2 UAT |

---

## 9. Cross-module reflection audit

| Reflection | Status |
|---|---|
| Order → Laboratory worklist | List/refetch on create — L2 path |
| Order → P360 | Existing `getByPatient` projection — **not** ops SoT |
| Slice 4 documents | Attach path independent; attach ≠ complete — certified |
| Billing silently modified for Lab charges | **Not found** |
| CCMS silently modified for Lab | **Not found** |
| Notification orchestration for Lab lifecycle | **Not found** (toast only) |

---

## 10. Manual UAT checklist

**Preconditions (global):** AuthService listening (e.g. `:5073`); FE app running; Lab Tech or Lab Manager UAT account; India Eye (or current) tenant with clinical catalog populated; test patients exist; no expectation of billing/insurance side effects.

| # | Scenario | Preconditions | Steps | Expected | Pass/Fail | Evidence | Severity if fail |
|---|---|---|---|---|---|---|---|
| 1 | Open Laboratory | User has `laboratory.view` | Navigate `/dashboard/laboratory` | Worklist loads (empty OK) | ☐ | Screenshot worklist | **BLOCKER** |
| 2 | Open Order Composer | On Laboratory | Click Order / New | Dialog “Order New Laboratory Tests” | ☐ | Screenshot dialog | **BLOCKER** |
| 3 | Select 1 test | Composer open | Search + select one test | Count “1 selected”; row in table | ☐ | Screenshot | **BLOCKER** |
| 4 | Select 3 tests | — | Add two more distinct | Count 3; three rows | ☐ | Screenshot | **BLOCKER** |
| 5 | Select 5 tests | — | Add to 5 | Count 5 | ☐ | Screenshot | HIGH |
| 6 | Select 10+ tests | Catalog has ≥10 | Add until 10+ | Table scrolls independently; dialog bounded | ☐ | Screenshot + note scroll | **BLOCKER** if unusable |
| 7 | Search after full | 10+ selected | Search another test | Results usable; duplicates excluded | ☐ | Screenshot | HIGH |
| 8 | Remove one | ≥2 selected | Remove one | Count decrements; row gone | ☐ | Screenshot | **BLOCKER** |
| 9 | Duplicate selection | Test already selected | Try re-add | Rejected (FE message and/or no add) | ☐ | Screenshot/toast | **BLOCKER** |
| 10 | Clinical indication | — | Enter free text | Field accepts; required for submit | ☐ | — | **BLOCKER** |
| 11 | Notes | — | Enter optional notes | Saved on create | ☐ | Worklist/detail | MEDIUM |
| 12 | Priority | — | Switch urgent/stat | Value retained on create | ☐ | API/network or detail | HIGH |
| 13 | Ordering clinician | — | Search/select clinician | Selected card; create succeeds | ☐ | Screenshot | **BLOCKER** |
| 14 | Create multi-test order | Patient+clinician+indication+≥2 tests | Create order | Success toast; dialog closes | ☐ | Network 2xx | **BLOCKER** |
| 15 | One LabReport + N items | After create | Inspect response/DB/detail | One report id; N items | ☐ | Network JSON / DB | **BLOCKER** |
| 16 | Worklist row | After create | Refresh/list | New row visible with patient/status | ☐ | Screenshot | **BLOCKER** |
| 17 | P360 reflection | Patient with new order | Open Patient 360 clinical labs | Order appears as projection | ☐ | Screenshot | HIGH |
| 18 | Document behavior | Optional attach if in scope | Attach/preview if used | Attach does not force completed | ☐ | Status unchanged | MEDIUM |
| 19 | Short viewport | Browser height reduced / zoom | Scroll form to notes | Notes fully editable; footer clear | ☐ | Screenshot | **BLOCKER** if overlap |
| 20 | Normal desktop | Standard 1080p+ | Full flow | Usable density | ☐ | Screenshot | HIGH |
| 21 | Keyboard | Composer open | Tab through fields; Esc close | Focus order reasonable | ☐ | Notes | HIGH |
| 22 | Unauthorized | User without laboratory.view | Open `/dashboard/laboratory` | Denied / redirected | ☐ | Screenshot | **BLOCKER** |
| 23 | Branch boundary | Multi-branch if available | Search patients / create | No cross-tenant/cross-branch leak | ☐ | Notes | **BLOCKER** if leak |
| 24 | Lab Manager | Manager UAT account | Order + catalog admin if granted | Expected access | ☐ | Notes | HIGH |
| 25 | Lab Technician | Tech UAT account | Order create | Expected access; no user.view needed for clinician search | ☐ | Notes | HIGH |
| 26 | No unexpected charge | After create | Check OpdBill / billing UI | **No** new lab charge | ☐ | Billing screenshot/query | **BLOCKER** if charge appears |
| 27 | No unexpected claim | After create | Check CCMS | **No** new claim | ☐ | Notes | **BLOCKER** if claim |
| 28 | No unexpected notification | After create | Check notification inbox | No orchestrated Lab intent (toast OK) | ☐ | Notes | MEDIUM |
| 29 | No unrelated module break | Spot-check Billing/Counselling nav | Open unrelated module | Loads normally | ☐ | Notes | HIGH |

---

## 11. Acceptance criteria (L2 scope only)

### Functional
- Multi-test ordering works; one `LabReport` root; N `LabReportItem`s  
- Duplicate prevention FE + BE  
- Required indication; clinician; patient; priority validation  
- Authorization allows Lab Tech/Manager UAT accounts per interim model  

### Data
- Clinical catalog identity (test/panel FKs), not free-text override on catalog path  
- No circular serialization on create  
- No accidental duplicate order from double-click (spot-check)  

### UX
- Composer usable at 1 / 3 / 10+ selections  
- Table independent scroll; form scroll; footer accessible; short viewport no overlap  
- No major accessibility blocker for keyboard  

### Integration
- Worklist reflects new orders  
- P360 projection preserved (not ops workbench)  
- Slice 4 attach≠complete preserved  

### Regression
- Automated FE 69 / BE 53 remain green (or re-verified after any fix)  
- No Billing/CCMS/notification silent side effects  

### Security
- No cross-tenant exposure  
- No unauthorized mutation  
- Clinician lookup does not require `user.view`  

---

## 12. Known non-blocking follow-ups (not L2 defects)

| Item | Later home |
|---|---|
| ServiceVariant mapping population | L3-COM-01 (after L2 acceptance/waiver) |
| Branch-aware price resolver fix | Implementation design |
| BillChargeSource Laboratory typed value | L3-COM-02 / Billing security |
| Non-billable catalog field (COM-02 schema) | Security/schema + L3-COM-01 |
| Charge posting at collection | L3-COM-02 (BILL-01) |
| Payment soft gates / patient release gate | PAY-01 follow-ups |
| Insurance display | INS + FIN-VIS |
| Notification catalog implementation | NOTIF-01 |
| TAT calendar engine / clock stamps | TAT-01 follow-ups |
| Specimen/accession/results/verify/external | L4+ |
| Finance detailed reversal cells | Finance decision |
| Least-privilege Lab permissions cutover | PERM-02 |

---

## 13. UAT readiness decision

```text
READY FOR MANUAL UAT
```

**Rationale:** L2 scope is implemented; automated baselines green; no product blocker identified that prevents meaningful Manual UAT. Remaining items are explicitly post-L2 (commercial/lifecycle) or human verification of layout/ops scenarios.

**Not a claim of acceptance.**

---

## 14. Explicit acceptance gate

```text
L2 IMPLEMENTATION:
COMPLETE

L2 AUTOMATED TESTS:
Frontend: 69 passed (0 failed) — vitest run src/app/dashboard/laboratory
Backend:  53 passed (0 failed) — Laboratory filter via alternate output path
(First BE default-bin attempt: NON-BLOCKING AuthService.exe file lock PID 35020)

L2 MANUAL UAT:
READY

L2 ACCEPTANCE:
NOT CLAIMED — HUMAN UAT REQUIRED

L3 IMPLEMENTATION:
NOT STARTED

L3-COM-01:
GATED BY L2 ACCEPTANCE / PROGRAM WAIVER
```

---

## 15. Final status

```text
L2 FINAL UAT READINESS AUDIT COMPLETE
NO IMPLEMENTATION PERFORMED
NO CODE CHANGES
NO SCHEMA CHANGES
NO API CHANGES
NO UI CHANGES
L2 IMPLEMENTATION COMPLETE
L2 ACCEPTANCE NOT CLAIMED
MANUAL UAT IS THE NEXT HUMAN GATE
L3 IMPLEMENTATION NOT STARTED
L3-COM-01 GATED BY L2 ACCEPTANCE / PROGRAM WAIVER
```
