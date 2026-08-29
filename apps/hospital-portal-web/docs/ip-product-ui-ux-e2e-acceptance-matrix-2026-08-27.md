# Product UI/UX + End-to-End Acceptance Matrix (IPD)

**Date:** 2026-08-27  
**Scope:** Discovery + acceptance inventory only  
**Status:** MASTER ACCEPTANCE PLAN — not go-live, not Phase 30, not implementation  

### Hard rules for this document

- Phase 1–29 reports are **engineering / certification evidence**, not final product acceptance.
- **Automated Test = PASS** does **not** mean **User Acceptance = PASS**.
- User Acceptance defaults to **NOT TESTED** unless the product owner explicitly confirms a workflow in UI.
- Do **not** declare the system go-live ready.
- Do **not** implement, fix, fixture-manufacture, or start Phase 30 from this audit.
- Next cycle: **one workflow at a time**, with mandatory user confirmation before the next.

### Sources used

1. Original FRD IDs (FR-1.1 … FR-6.3) via `ip-frd-codebase-crosscheck-2026-08-25.md` (gap matrix **stale**; IDs still valid)
2. Target architecture / screens S-01…S-18 — `ip-ward-ot-billing-coverage-target-architecture.md`
3. Ownership SoT — `ip-billing-ward-cross-module-sot.md`
4. Blueprint — `ip-remaining-work-implementation-blueprint.md` (**§§1.1–1.4 STALE**)
5. Phase 9 acceptance — `ip-phase9-final-acceptance-report.md` (live UI **PARTIAL**)
6. Live cert artifacts — `artifacts/step-17*` … `artifacts/phase-29-live/`
7. Current FE routes, workspaces, e2e specs, BE services / outbox / state machines

### Stale-doc warning

Treat Aug-25 crosscheck “MISSING” blockers (GS1, wristband, vitals gate, dilation, IOL power compare, taper, follow-up lock, bed map) and blueprint §§1.1–1.4 as **out of date**. Phase 19–29 live/unit evidence supersedes those gap claims for **implementation**. They do **not** supersede **user UI acceptance**.

---

## A. Executive Product Completion Status

### Verdict (product acceptance lens — not release)

| Lens | Status |
|---|---|
| P0/P1 **product build** remaining (Phase 29 engineering) | Substantially **complete** — no new Phase 30 build from that report |
| **Engineering live / unit certification** | Strong on core day-care loop; several paths **FIXTURE-BLOCKED** |
| **Product UI / UX acceptance by user** | Almost entirely **NOT TESTED** |
| **End-to-end chain validated from real UI by user** | **Not accepted** |
| Go-live / RC readiness | **Out of scope — do not declare** |

### How much of the product is implemented vs still needs UI/UAT?

Approximate product surface for IPD day-care (screens + major workspaces + FRDs):

| Bucket | Approx share | Notes |
|---|---|---|
| Implemented in code (routes/workspaces exist) | **~90%+** of S-01…S-18 + counsellor/CCMS/inventory adjacent | Pre-op/post-op/discharge/implant/beds are modals, not missing pages |
| Engineering certified (API/unit/live probe) | **~70–80%** of FRDs | Phase 29 matrix; fixture gaps remain |
| Playwright / automated UI coverage | **Partial** | Many specs; Phase 9 had skips/fails; not user acceptance |
| **User-accepted from real UI** | **~0% documented** | No signed product-owner UI PASS found |

**Plain answer:** Most of the product appears **implemented**. Most of it still needs **manual UI acceptance**. Engineering “CERTIFIED” ≠ accepted product.

### Deferred product gaps (implementation — not this audit’s build list)

| ID | Gap | Priority | Classification |
|---|---|---|---|
| FR-5.4 | Consignment inventory workflow | P2 | Implementation deferred |
| F2 | Full HL7 ADT/MLLP | P3 | Thin optional HTTP only |
| F3 | DICOM C-FIND | P3 | Not implemented |

### Certification / fixture limitations (implemented; live proof incomplete)

| Item | Classification |
|---|---|
| A2 / FR-5.3 power override | UI + unit present; live FIXTURE BLOCKED |
| FR-1.1 full counsel→journey diagnosis chain | Code path; live FIXTURE |
| FR-1.3 payer-specific tariffs | Wired; 0 payer `variant_prices` in UAT |
| C1 missing-doc preauth gate | Unit + UI checklist; live FIXTURE |
| A6 occupied-bed → drawer | Map LIVE; drawer FIXTURE (0 active assignments) |
| S-14 Open exception replay | Mapping UI LIVE; replay FIXTURE |

These are **not** automatic “build next” items. Separate **implementation gap** vs **UI acceptance gap** vs **UAT fixture limitation** in backlog sections below.

---

## B. Complete Screen Inventory

Canonical production paths marked **(canonical)**. Legacy/mock marked **(legacy)**. Overlay-only surfaces have no route.

### B.1 Counselling

| Screen ID | Route / surface | Component | Persona | Purpose |
|---|---|---|---|---|
| C-WL | `/dashboard/counsellors-desk/waiting-list` **(canonical)** | waiting-list page | Counsellor | Surgery counselling queue |
| C-SES | `/dashboard/counsellors-desk/[id]` | session workspace | Counsellor | Estimate, package, coverage, outpatient checklist |
| C-FIN | `/dashboard/counsellors-desk/finalize-surgery` | finalize page + `FinalizeOtModal` | Counsellor / OT clerk | Finalise OT list / prepare OT day |
| C-FU | `/dashboard/counsellors-desk/surgery-followup` | follow-up centre | Counsellor | Post-surgery / lead follow-up |
| C-AN | `/dashboard/counselor/analytics` | analytics | Lead | Counsellor analytics |
| C-PKG | `/dashboard/master-data/counsellor/packages` | packages admin | Admin | Package catalog |
| C-MDL | overlays | `ScheduleSurgeryModal`, quote/estimate dialogs, price override | Counsellor | Schedule / price / print |

**Upstream:** Doctors desk / exam / biometry. **Downstream:** Expected journey (OTPrepared trigger), CCMS case, estimate snapshot (not ledger).

### B.2 Admission / Census

| Screen ID | Route / surface | Component | Persona | Purpose |
|---|---|---|---|---|
| S-01 | `/dashboard/ip-management` | census | Ward clerk / IP coord / cashier glance | Branch census, filters, deep-link pre-op |
| S-02 | `PatientQuickPanel` / `PatientContextRail` | rail / sheet | Persona-scoped | Identity, blockers, money, actions |
| ADM | `AdmitPanel` in S-05 | admit | Ward clerk | Bed/ward assign + Expected→Admitted |
| S-10 | `/dashboard/ip-management/journey/[id]` | journey chart | Cross-role | Full journey tabs |

### B.3 Ward

| Screen ID | Route / surface | Component | Persona | Purpose |
|---|---|---|---|---|
| S-04 | `/dashboard/ip-management/ward` | ward board | Ward nurse/clerk | Queues, KPIs, send-to-OT, cancel/rebook |
| W-DRW | `WardPatientDrawer` | drawer | Ward | Patient hub → workspaces |
| W-UPD | `WardUpdationModal` | modal | Ward | Stay / assignment updates |
| W-WB | `WristbandPrintDialog` | dialog | Ward | Safety token / wristband |

### B.4 Bed Management

| Screen ID | Route / surface | Notes |
|---|---|---|
| S-04 map | `WardBedMap` on ward | Occupancy visualization (FR-3.1) |
| ADM beds | `AdmitPanel` bed select | Assign at admit |
| MD-WARD | `/dashboard/master-data/ward_ip` | Ward/bed/admission type masters |
| — | Auth `InternalIpBedController` | Occupancy SoT (no FE route) |

### B.5 Pre-op

| Screen ID | Surface | Component | Persona |
|---|---|---|---|
| S-05 | Full-screen modal from census/ward | `WardPreOpWorkspaceModal` | Nurse / junior doctor / PAC |
| S-05 steps | panels under `preop/` | investigations, PAC, clearance, consent, financial, fasting/meds, clinical eval (IOL), bedside, admit, mark ready | Mixed |

### B.6 OT

| Screen ID | Route / surface | Component | Persona |
|---|---|---|---|
| S-06 | `/dashboard/ip-management/operation-theatre` | OT board | OT nurse / surgeon |
| S-13 | `/dashboard/ip-management/slots` | slot board | IP / OT ops |
| TP | `/dashboard/ip-management/throughput` | throughput KPIs | Ops lead |
| OT-LEG | `/dashboard/operations/ot*` **(legacy)** | mock | Do not accept as product |

### B.7 Implant

| Screen ID | Surface | Component | Persona |
|---|---|---|---|
| S-07 | Panel on S-06 + journey implants | `ImplantScanPanel` | OT |
| IOL-RET | OT / post-op | Return IOL / `IolStickerReturnsPanel` | OT / ward |
| IOL-CE | Pre-op clinical eval | `ClinicalEvaluationIolSection` | Doctor / PAC |
| IOL-INV | `/dashboard/diagnostic/iol-inventory` | diagnostic IOL stock | Stores |

### B.8 Inventory (IP/OT relevant)

| Screen ID | Route | Persona | Purpose |
|---|---|---|---|
| INV-SUR | `/admin/inventory/surgery` | Stores / OT materials | Surgery consumable lifecycle |
| INV-* | `/admin/inventory/*` (items, stock, transfers, GRN, PO, …) | Stores / procurement | Stock SoT adjacent to ImplantUsed |

### B.9 Post-op

| Screen ID | Surface | Component | Persona |
|---|---|---|---|
| S-08 | Modal from ward / OT | `WardPostOpWorkspaceModal` | Ward nurse |
| S-08 panels | vitals, nurse/surgeon checklist, IOL sticker, instructions, taper, follow-up handover | — | — |

### B.10 Billing / Collection / Finalization

| Screen ID | Route / surface | Component | Persona |
|---|---|---|---|
| S-12 | `/dashboard/billing/opd` **(canonical ledger UI)** | `IpBillingWorkstation` + OPD desk | Cashier / billing |
| S-03 | `CollectPaymentDrawer` | drawer | Cashier |
| S-11 | `/dashboard/ip-management/billing` | IP dues worklist (projection) | Billing / IP ops |
| S-14 | `/dashboard/admin/charge-mapping` | charge mapping / replay | Billing admin |
| S-15 | `/dashboard/admin/charge-reconciliation` | completeness | Billing / finance |
| BILL-CRT | `/dashboard/billing/opd/create` | create bill | Billing |
| FIN | `/dashboard/finance` | finance overview | Finance |

### B.11 Coverage / CCMS

| Screen ID | Route | Persona | Purpose |
|---|---|---|---|
| CCMS-H | `/dashboard/ccms` | CCMS ops | Dashboard |
| CCMS-C | `/dashboard/ccms/cases`, `/cases/[id]` | Analyst | Case workspace |
| CCMS-PA | `/dashboard/ccms/operations/preauth` | Ops | Pre-auth queue (**C2 LIVE eng**) |
| CCMS-CL | `/dashboard/ccms/claims`, `/claims/[id]` | Ops | Claims |
| CCMS-EN | `/dashboard/ccms/enhancements` | Ops | Enhancements |
| CCMS-ST | `/dashboard/ccms/settlement`, `operations/settlement`, `reconciliation` | Finance / CCMS | Settlement |
| CCMS-AP | `/dashboard/ccms/approvals` | Ops | Approvals |
| CCMS-DOC | `/dashboard/ccms/documents/[caseId]` | Ops | Documents |
| CCMS-BIL | `/dashboard/ccms/billing/[caseId]` | CCMS / billing | Allocation view |
| CCMS-MD | `/dashboard/ccms/master-data/payers|plans` | Admin | Masters |
| S-18 | `CoverageContextBlock` | Read-only in IP | Coverage display only |

### B.12 Discharge

| Screen ID | Surface | Component | Persona |
|---|---|---|---|
| S-09 | `WardDischargeWorkspaceModal` | discharge workspace | Ward + cashier |
| S-10 discharge tab | journey page | summary | Doctor / ward |

### B.13 Follow-up

| Screen ID | Route / surface | Persona |
|---|---|---|---|
| C-FU | `/dashboard/counsellors-desk/surgery-followup` | Counsellor |
| FU-HAN | `FollowUpHandoverPanel` / `FollowUpAppointmentPanel` | Ward |
| FU-GEN | `/dashboard/follow-ups` | Clinical / ops (broader) |

### B.14 Administration / Operations / Monitoring

| Screen ID | Route | Purpose |
|---|---|---|---|
| S-16 | `/dashboard/admin/integration-health` | Outbox / integration health |
| S-17 | `ReasonConfirmDialog` | Shared destructive / reason confirm |
| UAT | `/dashboard/dev/uat` | Dev UAT seeder — **not production workflow** |
| MD-* | `/dashboard/master-data/*` | Masters incl. ward_ip, counsellor, billing |
| IAM | `/dashboard/admin/*` users/roles/security | Permission gate |
| NTF | `/dashboard/notifications` | Staff notifications |
| RPT | `/dashboard/reports`, `/dashboard/analytics` | Reporting (no mutate) |

---

## C. Complete Workflow Inventory

Clinical FSM (SoT):  
`Expected → Admitted → ReadyForSurgery → SentToOT → InOT → SurgeryCompleted → PostOp → ReadyForDischarge → Discharged`  
(+ cancel/rebook/OT return/discharge reopen paths).

OT FSM: `NotSent → SentToOT → Accepted → InProgress → Completed`.

### C.1 Counselling → Expected journey (P0/P1)

| Field | Detail |
|---|---|
| Actor | Counsellor |
| Start | OPD advice / waiting list |
| Preconditions | Patient identity; package/estimate path |
| UI | C-WL → C-SES → C-FIN / ScheduleSurgery |
| Steps | Session → package/estimate → coverage decision → schedule/finalize → OTPrepared |
| Backend | Auth `OtFinalizeService`; DB trigger creates `patient_journey` Expected; IP onboard + counsellor P0 copy |
| Events | Later `JourneyScheduled` on slot |
| Downstream | Ward Expected; CCMS case; package_amount snapshot |
| Failure modes | Duplicate schedule skip; same-day second eye guard; draft labs unverified on ward; coverage reject later at admit |
| User Acceptance | **NOT TESTED** |

### C.2 Admit + bed occupy (P0)

| Field | Detail |
|---|---|
| Actor | Ward clerk / nurse |
| UI | S-04 / S-01 → S-05 Admit |
| State | Expected → Admitted |
| APIs | `POST .../admit`; Auth bed lifecycle; CCMS validate-admission |
| Events | `JourneyAdmitted`; hub `PatientAdmitted` |
| Hard failures | Coverage mode without approved case (unless Emergency FC); soft: outstanding balance, incomplete checklists |
| User Acceptance | **NOT TESTED** |

### C.3 Pre-op clearance → Mark Ready (P0)

| Field | Detail |
|---|---|
| Actor | Ward / PAC / doctor |
| UI | S-05 |
| State | Admitted → ReadyForSurgery |
| Hard blocks | Critical labs, unsigned consent, laterality, PAC incomplete |
| Soft | Dilation warn, vitals out-of-range (ack) |
| Events | `JourneyReadyForOt` |
| User Acceptance | **NOT TESTED** |

### C.4 Ward → OT send / accept / start / complete (P0)

| Field | Detail |
|---|---|
| Actor | Ward → OT → surgeon |
| UI | S-04 send; S-06 accept/start/complete |
| State | ReadyForSurgery → SentToOT → InOT → SurgeryCompleted → PostOp |
| Gates | Accept billing gate (FC / override / OpdBillId); WHO warn on start |
| Events | Hub OT events; outbox `SurgeryCompleted`; billing lock on InOT |
| User Acceptance | **NOT TESTED** |

### C.5 Implant scan → inventory → charge (P0)

| Field | Detail |
|---|---|
| Actor | OT staff |
| UI | S-07 on S-06 |
| Steps | Scan GS1 → eye/model/power checks → `journey_implant_usage` → `ImplantUsed` → inventory then charge |
| Failures | Eye hard block; model/power mismatch; override needs perm+reason; `INVENTORY_UNAVAILABLE` / `BILL_NOT_FOUND` park; locked bill NeedsAdjustment |
| User Acceptance | **NOT TESTED** (eng: Ph19 core LIVE; A2 power override FIXTURE) |

### C.6 Coverage allocate → patient obligation (P0)

| Field | Detail |
|---|---|
| Actor | CCMS + Billing |
| UI | CCMS case / allocation; S-18 read-only in IP |
| Steps | Auth → allocation engine → apply-coverage-allocation → patient share |
| Failures | CCMS down fail-closed on financial hops; admit reject on CoverageRejected |
| User Acceptance | **NOT TESTED** (eng: 17-D1A / 18 / 18A LIVE API) |

### C.7 Collect → finalize / lock (P0)

| Field | Detail |
|---|---|
| Actor | Cashier |
| UI | S-03 / S-12 |
| APIs | JWT `OpdBills/payment`, finalize/lock |
| Failures | Overpay reject; double-submit idempotency; post-lock pay 409; finalized form disabled |
| User Acceptance | **NOT TESTED** (eng: 17-D1 / 17-D1A LIVE) |

### C.8 Discharge financial + follow-up gates (P0)

| Field | Detail |
|---|---|
| Actor | Ward + cashier |
| UI | S-09 |
| Rule | PostOp→ReadyForDischarge **not** money-gated; ReadyForDischarge→Discharged **is** (patient obligation + follow-up appointment + anaesthesia clearance) |
| Events | `PatientClinicallyDischarged`; bed vacate |
| User Acceptance | **NOT TESTED** |

### C.9 Post-op care + taper + instructions (P1)

| Field | Detail |
|---|---|
| Actor | Ward / surgeon |
| UI | S-08 |
| Backend | PostOp checklist, instructions, taper service |
| User Acceptance | **NOT TESTED** (UNIT KEEP eng) |

### C.10 Cancel today / rebook / transfer / readmission / refund / Emergency FC (P0–P1)

| Workflow | Eng status | User Acceptance |
|---|---|---|
| Cancel-today + bed vacate | BE IMPLEMENTED; E2E PARTIAL | **NOT TESTED** |
| Rebook → Expected | BE IMPLEMENTED | **NOT TESTED** |
| Bed transfer | BE/unit; live E2E PARTIAL | **NOT TESTED** |
| Readmission PriorJourneyId | BE/unit | **NOT TESTED** |
| Refund append-only | Billing unit | **NOT TESTED** |
| Emergency FC | BE + perm | **NOT TESTED** |

### C.11 Ops: charge mapping, preauth queue, integration health (P1)

| Workflow | Eng | User Acceptance |
|---|---|---|
| C2 preauth ops queue | LIVE CERT (25A) | **NOT TESTED** (product owner) |
| S-14 mapping | LIVE UI | **NOT TESTED**; replay FIXTURE |
| S-15 reconciliation | UNIT | **NOT TESTED** |
| S-16 integration health | Implemented | **NOT TESTED** |

### Non-happy-path checklist (every workflow above)

Validate explicitly during acceptance:

- validation failure · authorization failure · incomplete data · duplicate submit · retry · stale data / 409 concurrency · API failure · integration / outbox failure · invalid state transition · locked/finalized · empty state · permission-hidden vs server deny

---

## D. FRD → UI Traceability Matrix

**Legend**

- Backend: IMPLEMENTED / PARTIAL / DEFERRED  
- Automated Test: PASS / PARTIAL / NONE (engineering)  
- Live Eng: LIVE / UNIT / FIXTURE / DEFER  
- User Acceptance: **NOT TESTED** (default)

Sorted **P0 → P1 → P2 → P3**.

| Pri | FRD / Work | Requirement | Backend | API / Screen | User | UI Flow | Integration | Automated Test | Live Eng | User Acceptance |
|---|---|---|---|---|---|---|---|---|---|---|
| P0 | FR-5.3 / A2 | Power/model mismatch + override | IMPLEMENTED | S-07 `ImplantScanPanel` | OT | Scan → warn/block → override reason | ImplantUsed | PASS (unit) | LIVE model/eye; power override FIXTURE | **NOT TESTED** |
| P0 | FR-5.2 / A1 | GS1 / DataMatrix | IMPLEMENTED | S-07 | OT | Scan parse | ImplantUsed → Inv+Bill | PASS | LIVE Ph19 | **NOT TESTED** |
| P0 | FR-3.3 / A4 | Vitals gate / warn | IMPLEMENTED | S-05 | Ward | Capture → soft warn / ack | Audit | PASS | LIVE Ph19 | **NOT TESTED** |
| P0 | FR-4.1 / A3 | Dilation timer / warn | IMPLEMENTED | S-05 footer | Ward | Countdown from med log | — | PASS | LIVE Ph19 | **NOT TESTED** |
| P0 | FR-3.2 / A5 | Safety token / wristband | IMPLEMENTED | W-WB / admit | Ward | Print token | — | PASS | LIVE Ph19 | **NOT TESTED** |
| P0 | FR-4.3 | Site / laterality | IMPLEMENTED | S-05 consent | Ward/Dr | Hard block mark ready | — | PASS | LIVE/UNIT | **NOT TESTED** |
| P0 | FR-6.1 | Real-time ledger capture | IMPLEMENTED | S-07→S-12/S-14 | System+Cashier | ChargeItems / exceptions | ImplantUsed, Consumables | PASS | LIVE 17/18 | **NOT TESTED** |
| P0 | D1 finalize/lock | Collect → finalize → lock | IMPLEMENTED | S-03/S-12 | Cashier | Pay → finalize → lock | BillFinalized | PASS | LIVE 17-D1A | **NOT TESTED** |
| P0 | Discharge $ gate | Patient obligation before Discharged | IMPLEMENTED | S-09 | Ward+Cashier | Collect → discharge | PatientClinicallyDischarged | PASS | LIVE policy+17/18 | **NOT TESTED** |
| P0 | Coverage alloc | Payer/patient share | IMPLEMENTED | CCMS + S-18 | CCMS | Allocate → obligation | apply-coverage-allocation | PASS | LIVE 17-D1A/18/18A | **NOT TESTED** |
| P0 | Clinical FSM | State transitions | IMPLEMENTED | S-01/S-04/S-05/S-06/S-08/S-09 | Clinical | Transition APIs | Outbox+hub | PASS | LIVE core | **NOT TESTED** |
| P1 | FR-1.1 | Dx/procedure/eye/biometry copy | IMPLEMENTED | C-SES → S-10 | Counsellor→IP | Finalize/onboard copy | counselling→journey | PARTIAL | FIXTURE full chain | **NOT TESTED** |
| P1 | FR-1.2 | Packages / explosion | IMPLEMENTED | C-SES / S-12 / S-14 | Counsellor+Billing | Explode / map exceptions | ensure-bill | PASS | LIVE/UNIT | **NOT TESTED** |
| P1 | FR-1.4 | Financial estimate | IMPLEMENTED | C-SES | Counsellor | Estimate ≠ OpdBill | — | PASS | LIVE/UNIT | **NOT TESTED** |
| P1 | FR-2.1 / C1 | Preauth document gate | IMPLEMENTED | CCMS docs + MarkSent | CCMS | Checklist → server gate | — | PASS unit | FIXTURE live block | **NOT TESTED** |
| P1 | C2 | Preauth ops queue | IMPLEMENTED | CCMS-PA | CCMS ops | Queue filters | — | PASS | LIVE 25A | **NOT TESTED** |
| P1 | FR-3.1 / A6 | Bed map + occupied drawer | IMPLEMENTED map; drawer wired | S-04 `WardBedMap` | Ward | Map → drawer | beds API | PARTIAL | Map LIVE; drawer FIXTURE | **NOT TESTED** |
| P1 | FR-4.2 | Drop admin log | IMPLEMENTED | S-05 med log | Ward | Dose log | Audit | PASS | LIVE/UNIT | **NOT TESTED** |
| P1 | FR-5.1 | OT scheduler / slots | IMPLEMENTED | S-13 / S-06 | Ops | Slot assign / board | JourneyScheduled | PASS | LIVE/UNIT | **NOT TESTED** |
| P1 | FR-5.5 | Operative notes | IMPLEMENTED | S-06 | Surgeon | Intra-op note/sign | Audit E3 | PASS | UNIT/LIVE | **NOT TESTED** |
| P1 | FR-6.2 / B1 | Eyedrop taper | IMPLEMENTED | S-08 taper panel | Ward | Structured taper | — | PASS | UNIT | **NOT TESTED** |
| P1 | FR-6.3 / B2 | Follow-up appointment lock | IMPLEMENTED | S-08/S-09 | Ward | Bind Auth appointment | Discharge gate | PASS | UNIT | **NOT TESTED** |
| P1 | S-14 / D1 ops | Charge mapping + replay | IMPLEMENTED | S-14 | Billing admin | Map / replay Open | charge_exception | PASS map | Map LIVE; replay FIXTURE | **NOT TESTED** |
| P1 | S-15 | Reconciliation | IMPLEMENTED | S-15 | Finance | Completeness buckets | — | UNIT | UNIT | **NOT TESTED** |
| P1 | Admit / Mark Ready / Send OT | Core ward loop | IMPLEMENTED | S-04/S-05 | Ward | Workspace | JourneyAdmitted/ReadyForOt | PASS many e2e | LIVE/PARTIAL | **NOT TESTED** |
| P2 | FR-1.3 | Payer-aware tariff | IMPLEMENTED | Catalog / package explode | System | Payer price path | — | PASS unit | FIXTURE (0 payer prices) | **NOT TESTED** |
| P2 | FR-5.4 | Consignment inventory | DEFERRED | INV flags only | Stores | — | — | Thin | DEFER | **NOT TESTED** / N/A |
| P2 | C3 | Claim-query FSM | IMPLEMENTED | CCMS claims | CCMS | FireAsync | — | PASS unit | UNIT | **NOT TESTED** |
| P2 | S-16 | Integration health | IMPLEMENTED | S-16 | IT | Dead/Failed visibility | Outbox | — | UNIT | **NOT TESTED** |
| P3 | FR-2.2 / F3 | PACS / C-FIND | DEFERRED | Viewer only | Imaging | Manual upload | — | NONE | DEFER | N/A |
| P3 | F2 | HL7 ADT full | DEFERRED | Optional HTTP | IT | — | Thin fan-out | Thin | DEFER | N/A |

### Target screens S-01…S-18 (implementation vs acceptance)

| Screen | Route / component | Implemented? | Reachable? | Live eng notes | User Acceptance |
|---|---|---|---|---|---|
| S-01 Census | `/dashboard/ip-management` | Yes | Yes | KEEP | **NOT TESTED** |
| S-02 Rail | PatientContextRail | Yes | Yes | KEEP | **NOT TESTED** |
| S-03 Collect | CollectPaymentDrawer | Yes | Yes | API LIVE | **NOT TESTED** |
| S-04 Ward | `/ward` | Yes | Yes | Map LIVE | **NOT TESTED** |
| S-05 Pre-op | WardPreOpWorkspaceModal | Yes | Yes | KEEP | **NOT TESTED** |
| S-06 OT | `/operation-theatre` | Yes | Yes | Ph19 | **NOT TESTED** |
| S-07 Implant | ImplantScanPanel | Yes | Yes | LIVE + A2 fixture | **NOT TESTED** |
| S-08 Post-op | WardPostOpWorkspaceModal | Yes | Yes | UNIT | **NOT TESTED** |
| S-09 Discharge | WardDischargeWorkspaceModal | Yes | Yes | Gate LIVE policy | **NOT TESTED** |
| S-10 Journey | `/journey/[id]` | Yes | Yes | KEEP | **NOT TESTED** |
| S-11 IP billing | `/ip-management/billing` | Yes | Yes | Projection only | **NOT TESTED** |
| S-12 OpdBill desk | `/billing/opd` | Yes | Yes | LIVE collect/lock | **NOT TESTED** |
| S-13 Slots | `/slots` | Yes | Yes | KEEP | **NOT TESTED** |
| S-14 Mapping | `/admin/charge-mapping` | Yes | Yes | LIVE; replay FIXTURE | **NOT TESTED** |
| S-15 Recon | `/admin/charge-reconciliation` | Yes | Yes | UNIT | **NOT TESTED** |
| S-16 Integration | `/admin/integration-health` | Yes | Yes | — | **NOT TESTED** |
| S-17 Reason | ReasonConfirmDialog | Yes | Shared | KEEP | **NOT TESTED** |
| S-18 Coverage | CoverageContextBlock | Yes | Embedded | Read-only | **NOT TESTED** |

---

## E. P0/P1 UI Acceptance Backlog

Items that still need **user testing** and/or are **not product-accepted**. Implementation work is **out of scope** until a workflow fails user acceptance or a genuine defect is found.

### E.1 P0 — must user-accept first (clinical/financial/integration integrity)

1. Counselling finalize → Expected appears on census/ward with correct procedure/eye/IOL hints (FR-1.1 UI visibility)
2. Admit with bed occupy + coverage gate / Emergency FC path
3. Pre-op hard blocks (consent, laterality, PAC, critical labs) + Mark Ready
4. Send → Accept (billing gate) → Start → Complete surgery
5. Implant GS1 scan: eye hard-block, model mismatch, successful ImplantUsed → stock + charge line
6. A2 power mismatch override UI (when legitimate planned-power case exists — do not manufacture)
7. Collect payment (S-03/S-12): idempotency, receipt, overpay reject
8. Coverage allocation → patient share displayed correctly on IP + billing
9. Finalize + lock; post-lock payment blocked
10. Discharge: ReadyForDischarge without money OK; Discharged blocked until patient obligation + follow-up appointment
11. Cancel-today before OT accept; blocked after Accepted; bed vacated

### E.2 P1 — daily ops (user-accept after P0 chain)

12. Ward map usability; occupied bed drawer when real occupancy exists (A6)
13. Wristband print (A5)
14. Dilation / vitals soft warnings in real pre-op
15. Post-op instructions + taper (B1) + follow-up bind (B2)
16. CCMS preauth ops queue (C2) + document checklist UX (C1 live when case available)
17. Charge mapping ops (S-14); replay when Open exceptions exist
18. Charge reconciliation (S-15)
19. Slot board / throughput
20. Refund / transfer / readmission UI paths
21. Counsellor surgery-followup after discharge

### E.3 Do not reopen as “build” unless user finds defect

Engineering KEEP list (Phase 29): FR-5.2, A3–A5, B1–B2, C2, 17-D1A, FR-1.2/1.4, FR-2.3/2.4 core, FR-4.2/4.3, FR-5.1/5.5/6.1, E1–E4, FE-KPI, C3, Phase 24A, Phase 26 wiring, Phase 19 non-override implant.

---

## F. Known UI/UX Gaps

### F.1 Separate classifications

| Finding | Type | Notes |
|---|---|---|
| No documented product-owner UI PASS for any workflow | **UI acceptance gap** | Primary backlog |
| Phase 9 live UI PARTIAL; Playwright skips/fails historically | **UI acceptance / test gap** | Not proof of product defect |
| A2 power override never live-proven | **UAT fixture limitation** | Unit strong; do not SQL-fake planned power |
| C1 missing-doc live block | **UAT fixture limitation** | Gate + tests exist |
| A6 occupied → drawer | **UAT fixture limitation** (+ possible UX under real occupancy) | 0 active journey↔bed in probe |
| S-14 Open replay | **UAT fixture limitation** | Mapping UI LIVE |
| FR-1.3 live payer tariff | **UAT fixture limitation** | 0 payer variant_prices |
| FR-1.1 full clinical copy chain | **UAT fixture / integration acceptance** | Code path exists |
| FR-5.4 consignment | **Implementation gap** | Deferred P2 |
| F2/F3 HL7/DICOM | **Implementation gap** | Deferred P3 |
| Legacy `/dashboard/operations/ot*` | **UX / product coherence** | Do not use for acceptance |
| IP billing page vs OpdBill desk | **UX clarity** | S-11 is worklist; S-12 is ledger — train users |
| Limited-role auth soft-skips (Ph19) | **Authz live gap** | Re-test with real role accounts |

### F.2 UI state criteria (acceptance checklist per screen)

For each screen in §B during manual test, score:

| Criterion | PASS / GAP / DEFECT / UX IMPROVEMENT / NOT TESTED |
|---|---|
| Initial loading / disabled while loading | start as **NOT TESTED** |
| Empty / no results / no config | **NOT TESTED** |
| Success confirmation / status | **NOT TESTED** |
| API / validation / integration error + retry | **NOT TESTED** |
| Action enabled / disabled / hidden / confirm | **NOT TESTED** |
| Refresh / reload / back-nav / stale / concurrent | **NOT TESTED** |
| Terminology / severity / destructive confirm / role chrome | **NOT TESTED** |

Do not mark PASS from engineering cert alone.

---

## G. Integration Acceptance Backlog

Module-local eng evidence exists; **UI end-to-end chain not user-validated**:

| Hop | What to verify from UI | Eng evidence | User |
|---|---|---|---|
| Counselling → IP | Procedure, laterality, IOL, diagnosis, biometry on Expected/journey | Code + FIXTURE chain | **NOT TESTED** |
| IP → Ward | Journey, patient, bed, status, pre-op, warnings | Admit LIVE paths | **NOT TESTED** |
| Ward → OT | Readiness, consent, laterality, planned IOL/power | Mark ready / send LIVE | **NOT TESTED** |
| OT → Inventory | Scan, GS1, stock deduction, failure park | Ph19 + outbox | **NOT TESTED** |
| OT → Billing | ImplantUsed → ChargeItems; unmapped → S-14 | 17/18 + Ph23 map | **NOT TESTED** |
| Coverage → Billing | Payer, preauth, allocation, shares, PatientBalance | 17-D1A/18/18A | **NOT TESTED** |
| Billing → Discharge | Collection, obligation, finalize/lock, discharge gate | 17-D1A + discharge policy | **NOT TESTED** |
| Discharge → Follow-up | Appointment bind, instructions, readiness | UNIT B2 | **NOT TESTED** |

### Counselling → IP field visibility map (acceptance check)

| Data | Copied/owned where | Where user should see it |
|---|---|---|
| Procedure | Journey / clinical copy | Census row, S-02, S-10, OT |
| Laterality / eye | `EyeOperated` / consent | S-05, S-06, S-07 eye check |
| Planned IOL / power | Journey IOL fields + clinical eval | S-05 IOL section, S-07 mismatch |
| Diagnosis | OpdClinicalCopy / counsellor | Journey / counselling (verify FR-1.1) |
| Biometry | Clinical copy / diagnostics | Pre-op investigations / journey |
| Package / estimate | Counsellor estimate (not ledger) | C-SES; bill lines after explode on S-12 |

---

## H. Recommended Testing Sequence

Dependency-ordered **manual** UI acceptance. After each step: Cursor prepares only if needed → you test → you confirm PASS / issues → **stop until confirmation**.

| Step | Workflow | Primary screens | Why this order |
|---|---|---|---|
| 1 | Counselling session + package/estimate | C-WL, C-SES | Upstream clinical + commercial truth |
| 2 | Finalize / schedule → Expected | C-FIN, S-01 | Creates journey |
| 3 | CCMS case / preauth (if payer) | CCMS-C, CCMS-PA, docs | Admit depends on coverage mode |
| 4 | Admit + bed | S-04/S-05 Admit, bed map | Occupancy SoT |
| 5 | Pre-op clearance + Mark Ready | S-05 | Safety hard blocks |
| 6 | Send to OT → Accept → Start | S-04, S-06 | Billing gate + WHO |
| 7 | Implant scan (+ inventory check) | S-07, INV-SUR / stock | Clinical + stock |
| 8 | Complete surgery → Post-op | S-06, S-08 | Clinical progression |
| 9 | Charge lines / mapping exceptions | S-12, S-14, S-15 | Revenue integrity |
| 10 | Coverage allocation → patient share | CCMS, S-18, S-12 | Obligation SoT |
| 11 | Collect payment | S-03, S-12 | Cash integrity |
| 12 | Finalize / lock | S-12 | Ledger lock |
| 13 | Follow-up appointment bind | S-08/S-09 | Discharge precondition |
| 14 | Discharge | S-09 | Terminal clinical + bed vacate |
| 15 | Counsellor follow-up | C-FU | Downstream ops |
| 16 | Ops / admin | S-16, masters, IAM roles | Internal screens |
| 17 | Exception paths | cancel, transfer, refund, FC, reopen | After happy path |

**Within each step**, exercise: happy path, validation, authz, empty, error, locked, retry, reload.

---

## Internal / operations screen readiness (summary)

| Screen | Implemented | Reachable | Integrated | Role-protected | Visually coherent | User Acceptance |
|---|---|---|---|---|---|---|
| CCMS preauth queue | Yes | Yes | Eng LIVE | Expect perms | IP/CCMS kits | **NOT TESTED** |
| Charge mapping S-14 | Yes | Yes | Eng LIVE map | Yes | Admin | **NOT TESTED** |
| Charge recon S-15 | Yes | Yes | UNIT | Yes | Admin | **NOT TESTED** |
| Integration health S-16 | Yes | Yes | Outbox | Yes | Admin | **NOT TESTED** |
| Ward board S-04 | Yes | Yes | Yes | Yes | `.ip-target` | **NOT TESTED** |
| Billing workstation S-12 | Yes | Yes | Eng LIVE | Yes | Billing kit | **NOT TESTED** |
| Safety token | Yes | Yes | Ph19 | Yes | IP | **NOT TESTED** |
| Master data ward/counsellor | Yes | Yes | Config | Admin | Master-data | **NOT TESTED** |
| Legacy ops OT | Mock | Yes | **No** | — | Legacy | **Reject as product** |

---

## Gate for next work

1. Do **not** implement from this document alone.  
2. Do **not** start Phase 30 or release packaging.  
3. Pick **Step 1** (Counselling) unless you designate another P0.  
4. After your PASS/FAIL, proceed only to the next confirmed step.

---

## Document control

| Field | Value |
|---|---|
| Authoring mode | Audit / discovery only |
| Supersedes for **acceptance planning** | Phase 29 go-live recommendation (engineering only) |
| Does not supersede | Ownership SoT; clinical/billing/CCMS boundaries |
| Next artifact after user picks a workflow | Per-workflow UI test script + any required legitimate prep (no manufactured fixtures) |

**END — HARD STOP (no implementation)**
