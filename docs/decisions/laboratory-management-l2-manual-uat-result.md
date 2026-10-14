# Laboratory Management — L2 Manual UAT Result & Acceptance Gate

**Date:** 2026-10-08  
**Type:** MANUAL UAT EXECUTION / EVIDENCE (NO IMPLEMENTATION)  
**Mode:** CONTROLLED MANUAL UAT · NO CODE · NO SCHEMA · NO API · NO UI · NO PERMISSIONS · NO L3  

**Authoritative companions:**  
[laboratory-management-l2-final-uat-readiness-audit.md](./laboratory-management-l2-final-uat-readiness-audit.md) ·  
[laboratory-management-product-owner-decision-closure.md](./laboratory-management-product-owner-decision-closure.md) ·  
[laboratory-management-l2-order-composer-ux-correction-implementation.md](./laboratory-management-l2-order-composer-ux-correction-implementation.md)

---

## 1. Date

2026-10-08 (execution window ~14:00–14:35 IST / UTC+5:30)

---

## 2. UAT environment

| Item | Value |
|---|---|
| Frontend | `http://localhost:3000` (Next.js already listening; PID on :3000) |
| AuthService | `http://127.0.0.1:5073` — restarted mid-session via alternate build output `artifacts/lab-l2-manual-uat-auth` after prior PID exit (environmental; not a product defect) |
| Tenant | India Eye Hospital Network (`155fe198-6ae5-4a01-9254-ead5b427247e`) |
| Primary branch (Lab Manager) | Downtown Hospital (`74c014cf-9570-4824-bdf9-b369ea11a8f4`) |
| Lab Tech branch | Dubai Medical Center (`a586ba17-91df-4636-8950-0f0f653b90d5`) |
| Test patient | Asha UAT-IP-026 / MRN `UAT-MR-026` / id `c1adbdee-9e94-4ace-94da-28cbf4ead1cd` |
| Catalog | Active LaboratoryTestDefinition set present (CBC001, LIPID001, LFT001, …) |

### Environment prep performed (not product code)

At session start, `labmgr1@hospital.com` had **0** `user-branches` assignments, so patient search returned empty (`branchId` null). Using the **existing** admin API `POST /api/user-branches`, Downtown Hospital was assigned to Lab Manager. This is **UAT data prep**, not an L2 implementation change.

---

## 3. Build / revision inspected

| Item | Value |
|---|---|
| Git HEAD (short) | `006ec7ab` |
| Tip message | `feat: counsellor session workspace, recording, and desk UX` |
| Working tree | Dirty (many unrelated WIP files); L2 Laboratory sources present as previously certified |
| L2 implementation status (pre-existing) | COMPLETE |
| L3 implementation | NOT STARTED (commercial guard tests exist; no L3 feature work performed) |

---

## 4. Tester / account type

| Account | Role | Used for |
|---|---|---|
| `labmgr1@hospital.com` / `Admin123!` | Lab Manager (Joseph Lopez) | UAT-01–16, 19–21, 24, UX |
| `labtech1@hospital.com` / `Admin123!` | Lab Technician | UAT-23, 25 (API create + branch) |
| `admin@test.com` / `Admin123!` | System Administrator | P360 Clinical Laboratory UI (UAT-17), env branch assign |

---

## 5. Preconditions

- AuthService healthy on `:5073`
- Portal FE on `:3000`
- Clinical catalog bootstrapped (Development)
- Lab UAT accounts active with interim grants (`laboratory.view` + `patient.view` / `patient.update`)
- Lab Manager branch assigned (Downtown) before create-flow UAT
- No expectation of Billing / CCMS / notification side effects (L2 scope)

---

## 6. Automated baseline (post–Manual UAT)

### Frontend

| | |
|---|---|
| **Command** | `npx vitest run src/app/dashboard/laboratory` |
| **CWD** | `apps/hospital-portal-web` |
| **Result** | Test Files **8 passed**; Tests **77 passed** / 0 failed |
| **Duration** | ~24.2s |
| **vs historical 69** | **+8** — new file `laboratory-l3-com-01-commercial.test.tsx` (8 commercial **guard** tests). Not an L2 product failure. L2 suites remain green. |

### Backend

| | |
|---|---|
| **Command** | `dotnet test AuthService.Tests.csproj --filter "FullyQualifiedName~LaboratoryCatalogTests\|FullyQualifiedName~LabReportWorklistTests\|FullyQualifiedName~LabReportCanonicalDocumentTests\|FullyQualifiedName~LaboratoryClinicalCatalogBootstrapTests" -o "..\..\..\artifacts\lab-l2-manual-uat-test"` |
| **CWD** | `microservices/auth-service/AuthService.Tests` |
| **Result** | **Passed: 53**, Failed: 0, Skipped: 0 |
| **Duration** | ~14s |
| **vs historical 53** | **Match** |

---

## 7. Complete UAT matrix

Legend: **PASS** / **FAIL** / **BLOCKED**

| ID | Scenario | Result | Severity if failed | Evidence / notes |
|---|---|---|---|---|
| **UAT-01** | Open Laboratory | **PASS** | — | Lab Manager → `/dashboard/laboratory`; worklist loaded with prior multi-test rows |
| **UAT-02** | Open Order Composer | **PASS** | — | “Order New Laboratory Tests” dialog; Hospital Portal DS preserved |
| **UAT-03** | Select one test | **PASS** | — | CBC001 in selected table; Remove action present; count=1 |
| **UAT-04** | Select three tests | **PASS** | — | CBC + Lipid + LFT (+ more) distinct rows |
| **UAT-05** | Select five tests | **PASS** | — | Count reached 5; table usable |
| **UAT-06** | Select 10+ tests | **PASS** | — | 11 then 10 selected; dialog bounded; table `overflowY:auto` (scrollHeight 402 / clientHeight 166); footer accessible |
| **UAT-07** | Search after many selections | **PASS** | — | With 10 selected, search `HBsAg` returns results; selected CBC001 excluded (“No active laboratory catalog items” for that key) |
| **UAT-08** | Remove test | **PASS** | — | Removed Serum Electrolytes; badge `10 selected` |
| **UAT-09** | Duplicate prevention | **PASS** | — | Client: selected test not re-addable. Server: `POST …/catalog-order` with duplicate Items → **400** `"Duplicate test or panel selection is not allowed in one order."` |
| **UAT-10** | Clinical indication | **PASS** | — | Required free-text persisted: `L2 Manual UAT multi-test order - pre-op screening panel validation` |
| **UAT-11** | Notes | **PASS** | — | Notes persisted on LabReport |
| **UAT-12** | Priority | **PASS** | — | UI create retained **urgent**; Lab Tech API create with **stat** → `priority=stat` |
| **UAT-13** | Ordering clinician | **PASS** | — | Clinician search worked for Lab Manager without `user.view`; selection shown |
| **UAT-14** | Create multi-test order | **PASS** | — | Create succeeded; dialog closed; toast path used (local success acceptable) |
| **UAT-15** | One LabReport + N items | **PASS** | — | Report `1ee33b3c-ef9c-4551-902a-fc92f97e23db`: status `ordered`, priority `urgent`, **items=10**, distinct `testDefinitionId`s; JSON serialization without circular `report` nav on items |
| **UAT-16** | Worklist reflection | **PASS** | — | New Urgent row for Asha with 10-test concatenated name; status Ordered |
| **UAT-17** | P360 reflection | **PASS** | — | API `GET /lab-reports/patient/{id}` includes UAT order. Admin UI Clinical → Laboratory section lists the multi-test order (status ordered). Lab Manager Overview OK; Clinical tab → Access Denied (interim least-privilege — see defects) |
| **UAT-18** | Slice 4 documents | **PASS** | — | No new document behavior introduced by create. Canonical document BE suite (subset of 53) remains green. Attach≠complete remains certified; not exercised as attach upload in this session |
| **UAT-19** | Short viewport | **PASS** | — | vh=560: footer Create in view; selected table independent scroll; notes reachable via form-body scroll without footer overlap |
| **UAT-20** | Normal desktop | **PASS** | — | Hierarchy/density match existing portal; no redesign language |
| **UAT-21** | Keyboard | **PASS** | — | Combobox ArrowDown/Enter selection; Escape closes dialog (expected); no keyboard trap observed |
| **UAT-22** | Unauthorized Laboratory | **PASS*** | — | Page gated by `ProtectedRoute requiredPermission="laboratory.view"`. Interactive third-party account without lab.view not available (credentials). No unauthorized workbench exposure observed for authorized roles. *Code + gate evidence; dedicated non-lab UI login blocked by missing UAT password for receptionist |
| **UAT-23** | Tenant / branch boundary | **PASS** | — | Lab Tech: Dubai suggest **200**; Downtown suggest **403**. No cross-branch mutation demonstrated |
| **UAT-24** | Lab Manager | **PASS** | — | Page + Order + Catalog admin visible; create succeeded after branch prep |
| **UAT-25** | Lab Technician | **PASS** | — | API catalog-order create **201**, 2 items, priority stat; clinician id accepted without `user.view` |
| **UAT-26** | No unexpected billing charge | **PASS** | — | Create path does not post OpdBill; AuthService OpdBill list endpoints **404** (not wired as lab side effect). No silent charge observed |
| **UAT-27** | No unexpected CCMS claim | **PASS** | — | No CCMS mutation in create path; out-of-scope integrations untouched |
| **UAT-28** | No unexpected notification | **PASS** | — | No orchestrated lifecycle notification endpoints returning new lab events; local success toast only (acceptable) |
| **UAT-29** | Regression / unrelated modules | **PASS** | — | Patient Directory / P360 loaded; Laboratory worklist stable; FE/BE lab suites green; no intentional cross-module edits |

**Counts:** PASS **29** · FAIL **0** · BLOCKED **0**  
(UAT-22 marked PASS with explicit evidence caveat.)

---

## 8. Evidence references

| Evidence | Detail |
|---|---|
| Created LabReport (primary) | `1ee33b3c-ef9c-4551-902a-fc92f97e23db` — 10 items, urgent, ordered |
| Lab Tech create | `5bc42bcb-8fc4-451c-9ed3-07b25346dab5` — 2 items, stat |
| Duplicate API | HTTP 400 duplicate selection message |
| P360 Clinical Laboratory | Admin UI `#p360-clinical-lab` lists multi-test order |
| Screenshots (local temp) | Order composer 10-selected; short viewport footer; worklist Urgent row; P360 Laboratory table |
| FE tests | 77 passed |
| BE tests | 53 passed |

---

## 9. Defects

| ID | Title | Severity | Blocks L2 acceptance? | Notes |
|---|---|---|---|---|
| D-01 | Lab Manager UAT account had zero branch assignments at session start | **MEDIUM** (environment / bootstrap data) | **No** (unblocked via existing admin assign API) | Document for Lab UAT bootstrap hardening later; not an Order Composer logic bug |
| D-02 | After create, worklist Priority filter observed as `Urgent` (dialog priority may leak into worklist filter state) | **MEDIUM** | **No** | Does not break create/data integrity; polish follow-up |
| D-03 | Lab Manager cannot open P360 Clinical tab (Access Denied); Admin can | **MEDIUM** (interim authz) | **No** for L2 order acceptance | API patient lab projection works for Lab Manager; least-privilege P360 Clinical grants are post-L2 |
| D-04 | Catalog search string matching is loose (e.g. “CBC” surfaces many non-CBC rows until typed more specifically) | **LOW** | **No** | Usability polish; selection still correct |

No **BLOCKER** or acceptance-blocking **HIGH** defects remain.

---

## 10. Severity summary

| Severity | Count | Blocking? |
|---|---|---|
| BLOCKER | 0 | — |
| HIGH | 0 | — |
| MEDIUM | 3 | No |
| LOW | 1 | No |

---

## 11. Cross-domain boundary validation

| Boundary | Result |
|---|---|
| Billing / OpdBill silent create | **Not observed** |
| CCMS claim silent create | **Not observed** |
| Notification orchestration | **Not observed** |
| P360 as Lab SoT | **No** — projection only; operational work remains on Laboratory workbench |
| Documents as Lab clinical SoT | **No** — Slice 4 attach semantics unchanged |
| ServiceVariant / BillChargeSource / charge posting | **Absent** (expected L2) |

---

## 12. Regression validation

| Suite | Result |
|---|---|
| FE `src/app/dashboard/laboratory` | **77 passed** / 0 failed |
| BE Laboratory filter | **53 passed** / 0 failed |
| Unrelated module smoke (P360 load) | OK |

---

## 13. Acceptance assessment

Using **only** approved L2 scope:

| Criterion group | Met? |
|---|---|
| Functional (multi-test, one LabReport, N items, duplicates, validation, authz) | **Yes** |
| Data integrity / serialization | **Yes** |
| UX (composer usable, responsive, footer, table scroll) | **Yes** |
| Integration (worklist, P360 projection, Slice 4 preserved) | **Yes** |
| Regression automated green | **Yes** |
| Security (branch deny, no unauthorized mutation observed) | **Yes** |
| No BLOCKER / unresolved HIGH on core L2 | **Yes** |

**Assessment:** **L2 UAT PASS — READY FOR L2 ACCEPTANCE**

**Important:** This document does **not** claim Product Owner acceptance. Only the human/PO acceptance gate can accept L2.  
**L3 / L3-COM-01 remain gated** by L2 acceptance or an explicit program waiver. No L3 implementation was started in this task.

---

## 14. Known non-blocking follow-ups (not L2 defects)

- ServiceVariant mapping / ChargeCatalogResolver branch wiring  
- BillChargeSource schema + charge-at-collection posting  
- Non-billable catalog field  
- Payment gates / insurance / CCMS  
- Notification catalog / TAT engine  
- Specimen / accession / observations / verification / release  
- External laboratory  
- Final least-privilege Laboratory + P360 Clinical permission cutover  
- Lab UAT account default branch assignment in bootstrap  
- Worklist filter state isolation from Order Composer priority (D-02)

---

## 15. Final status

```text
L2 MANUAL UAT COMPLETE
L2 UAT PASS
NO IMPLEMENTATION PERFORMED
NO CODE CHANGES
NO SCHEMA CHANGES
NO API CHANGES
NO UI CHANGES
NO PERMISSION CHANGES
L2 ACCEPTANCE READY FOR PRODUCT OWNER
L3 IMPLEMENTATION NOT STARTED
L3-COM-01 REMAINS GATED
```

---

## Concise report (A–K)

| | |
|---|---|
| **A. UAT status** | **L2 UAT PASS — READY FOR ACCEPTANCE** |
| **B. Counts** | PASS **29** / FAIL **0** / BLOCKED **0** |
| **C. Blocking defects** | **None** |
| **D. Non-blocking defects** | D-01 env branch bootstrap; D-02 worklist priority filter leak; D-03 Lab Manager P360 Clinical deny; D-04 loose catalog search |
| **E. Automated regression** | FE **77** passed; BE **53** passed |
| **F. Data integrity** | One LabReport + 10 LabReportItems; server duplicate reject; no circular JSON |
| **G. Security / authz** | Branch 403 for Lab Tech on Downtown; page permission gate present; interim L2 grants |
| **H. Cross-module boundary** | No billing/CCMS/notification side effects from L2 create |
| **I. Artifact** | `docs/decisions/laboratory-management-l2-manual-uat-result.md` |
| **J. Ready for PO acceptance?** | **Yes** (human gate still required) |
| **K. L3 started?** | **No** |

```text
L2 FINAL MANUAL UAT EXECUTION COMPLETE
NO IMPLEMENTATION PERFORMED
NO CODE CHANGES
NO SCHEMA CHANGES
NO API CHANGES
NO UI CHANGES
L2 IMPLEMENTATION COMPLETE
L2 UAT PASS
L2 ACCEPTANCE NOT CLAIMED — PRODUCT OWNER GATE
L3 IMPLEMENTATION NOT STARTED
L3-COM-01 GATED BY L2 ACCEPTANCE / PROGRAM WAIVER
```
