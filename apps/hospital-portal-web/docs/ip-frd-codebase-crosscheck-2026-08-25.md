# IP Management + Ward + OT + Billing + Coverage — FRD / Codebase Cross-Check

**Date:** 25 Aug 2026  
**Status:** Evidence-based analysis. No application code changed by this document.  
**Priority of truth:** (1) live codebase (2) ownership SoT `ip-billing-ward-cross-module-sot.md` (3) target architecture `ip-ward-ot-billing-coverage-target-architecture.md` (4) FRD IDs in the analysis prompt.

The attached target architecture is **analysis-and-design only** and is **stale against current code**. Its eight headline findings (F1–F8) have largely been implemented in subsequent phases. This document re-traces UI → API → BE → DB → event → consumer against the live tree.

---

## Executive Summary

The domain boundaries in the SoT are still correct and must not be inverted:

| Domain | Owner | Canonical home |
|---|---|---|
| Clinical / operational journey | IP Management | `microservices/ip-management-service` (`PatientJourney`, `StateTransitionValidator`) |
| Money ledger | Auth Billing | `OpdBill` / `OpdBillService` |
| Coverage / claims | CCMS | `microservices/ccms-service` |
| Bed occupancy | Auth | `BedLifecyclePolicy` / `InternalIpBedController` |
| Stock | Inventory | `microservices/inventory-service` |
| Realtime | Auth | `NotificationHub` |
| Cross-module events | Existing outboxes | `integration_outbox_event`, `billing_ccms_outbox` |

**Do not redesign the application.** The remaining work is seam completion and FRD safety/throughput features on **existing** screens.

### Overall Implementation Status

| Slice | Complete | Partial | Missing |
|---|---|---|---|
| Explicit FRD IDs (FR-1.1 … FR-6.3, n=22) | **41% (9)** | **23% (5)** | **36% (8)** |
| 18 target screens (S-01 … S-18) | **16 KEEP** | **2 EXTEND-heavy** (S-04 bed map, S-05/S-07/S-08/S-09 feature gaps) | **0 new pages required** |
| Original target-doc F1–F8 | **7 FIXED** | **1 PARTIAL (F6 dual IOL stores)** | **0 still missing as stated** |
| Core day-care loop (OPD counsel → admit → pre-op → OT → charge → pay → discharge → claim) | **~80% production-capable** | Mapping exceptions, ops bugs | Safety extras + HL7/PACS |

### Critical blockers (true remaining P0)

1. **Wrong-implant residual:** eye mismatch is server-blocked (`ImplantUsageService.RequireMatchingEye`); **planned IOL power/model is not compared** to the scanned lens.
2. **No GS1-128 / DataMatrix parse** — `verify-iol-barcode` accepts any alphanumeric ≥5 chars (`PatientJourneyService.VerifyIolBarcodeAsync`).
3. **No IP wristband / safety token.**
4. **No vitals threshold gate** — vitals are recorded (`VitalSignService`) and can auto-tick `vitals_checked`; they do **not** block Mark Ready.
5. **No dilation countdown** — `pre_op_medication_log.administered_at` exists; UI only keyword-prompts `ward_dilatation_done`.

### Major architectural risks

- **None that require ownership inversion.** Inventory still must not set price; IP still must not own the ledger.
- `PermissionSeeder.cs` does **not** seed the IP/billing codes that SQL `156` seeds — empty-DB / seeder-only environments can silently miss RBAC.
- CCMS operations pre-auth queue filters authorization `Status` against **workflow** codes while `PreAuthorizationService` writes `"active"` — the ops page can be empty (**INCORRECT**).

### Major revenue-integrity risks

- Charge pipeline **exists** (`ImplantChargeHandler` → `POST /api/internal/ip-billing/charge-items`). Residual leakage is **unmapped catalog items** parked as `charge_status=Exception`, visible on `/dashboard/admin/charge-mapping`.
- Package explosion is **conditional** on `package_component_map`; unmapped templates still fall back to header `GrossAmount`.

### Major patient-safety risks

- Laterality, consent, PAC, critical labs **are** Mark Ready hard blocks. Keep them.
- Site marking / laterality attestation **exists** (do not recreate as a new clinical state).
- Missing: wristband, dilation timer, vitals thresholds, IOL power/model guard, GS1 UDI.

---

## 1. Current Architecture Assessment

### 1.1 Service topology (verified)

| Service | Style | Owns |
|---|---|---|
| `auth-service` | ASP.NET Core | Auth/RBAC, `OpdBill`, `bed_inventory`, `NotificationHub`, counselling templates, service catalog |
| `ip-management-service` | Azure Functions | `PatientJourney`, pre-op, ward, OT, implants, slots, outbox |
| `ccms-service` | Azure Functions | Coverage FSM, pre-auth, claims, settlement |
| `inventory-service` | Azure Functions | Item master, batches, `inv_surgery_consumables`, implant stock ledger |
| `hospital-portal-web` | Next.js App Router | All UI |

### 1.2 Clinical state machine — KEEP

Source: `StateTransitionValidator.ClinicalAllowed` and `StateConstants.ClinicalState`.

```
Expected → Admitted → ReadyForSurgery → SentToOT → InOT → SurgeryCompleted
        → PostOp → ReadyForDischarge → Discharged
ReadyForSurgery → Admitted          (unmark ready — EXISTS)
SentToOT / InOT → ReadyForSurgery   (OT return — EXISTS)
Discharged → ReadyForDischarge      (reopen — EXISTS)
CancelledSurgery → Expected         (rebook — EXISTS)
AdmissionCancelled                  (terminal)
```

`Pre-Op Pending`, `Pre-Op In Progress`, `Ready for OT` are **not** stored states. Census tab `ReadyForOt` maps to `clinicalState === 'ReadyForSurgery'` (`ip-dashboard-tabs.ts`). **Do not promote them to clinical states.**

### 1.3 Cross-service contracts (current)

```
IP ──X-Internal-Key──> Auth  /api/internal/ip-billing/{ensure-bill,summary,payment,reverse,apply-coverage-allocation,charge-items}
IP ──X-Internal-Key──> Auth  /api/internal/ip-beds/{lifecycle,list}
IP ──X-Internal-Key──> Auth  /api/notifications/internal/{push-dept,push-user,push-tenant}
IP ──outbox──────────> CCMS  JourneyAdmitted, SurgeryCompleted, PatientClinicallyDischarged, EmergencyFcApplied, JourneyReadyForOt
IP ──outbox──────────> Inventory+Billing  ImplantUsed, ImplantUsageReversed
Inventory ──outbox──> IP ConsumableChargeHandler  ConsumablesConsumed
Billing ──outbox────> CCMS  BillFinalized, PaymentReceived, PaymentReversed, PatientObligationChanged
CCMS ───────────────> Auth  apply-coverage-allocation
Counselling ────────> CCMS  counselling-completed → coverage case
```

The target doc’s “Inventory → (nothing)” edge is **no longer true**.

### 1.4 Stale findings vs code

| Target-doc claim | Verdict |
|---|---|
| `ip.billing.collect` does not exist | **INCORRECT** — seeded `156_ip_billing_rbac_seed.sql` L88; FE `ip-role-actions.ts` |
| No `RowVersion` on `OpdBill` | **INCORRECT** — `OpdBill.cs` + `AppDbContext` concurrency |
| `journey_implant_usage` does not exist | **INCORRECT** — migration `160_journey_implant_usage.sql` |
| Charge reconciliation / slot board / integration-health missing | **INCORRECT** — all three admin/IP pages exist |
| `journey_audit_log` only for lifecycle | **INCORRECT** — vitals, meds, PAC, checklists, WHO now write audit |
| FE fails open | **INCORRECT in production** — `permissions-fail-open.ts` returns false when `NODE_ENV === 'production'` |
| Dual money write from UI | **INCORRECT** — `add-billing-ui-retired.test.ts`; drawer posts JWT `OpdBills/payment` |

---

## 2. FRD Traceability Matrix

| FRD ID | Requirement | Existing implementation | FE evidence | BE evidence | DB evidence | Integration | Status | Gap | Required change | Owner | Priority |
|---|---|---|---|---|---|---|---|---|---|---|---|
| FR-1.1 | OPD sync (dx/procedure/eye/biometry) | Hints + counsellor outpatient checklist; journey displays server `procedureName`/`eyeOperated` | `outpatient-integration.ts`, `CounsellorOutpatientChecklist.tsx` | Journey onboard from counselling/OT finalize | `patient_journey` | counselling-completed → CCMS | **PARTIAL** | Copy is not a guaranteed field-level transfer | EXTEND onboard mapping + tests | IP + Auth | P1 |
| FR-1.2 | Surgical packages | Templates + explode into `opd_bill_items` when mapped | `estimate-engine.ts`, master-data counsellor packages | `OpdBillService.PackageExplosion.cs` | `counselling_package_templates`, `package_component_map`, `counselor_packages` | ensure-bill | **COMPLETE** | Unmapped components → exception queue | KEEP; operate mapping UI | Billing | P1 ops |
| FR-1.3 | Tariff engine | `variant_prices`, branch overrides, government schemes | estimate engine | `MasterDataService.CalculatePackageCostAsync`, `GetEffectivePriceAsync` | `variant_prices`, `branch_pricing_overrides` | none | **PARTIAL** | No insurer/corporate tariff tables found | EXTEND catalog only if contracts require it | Auth | P2 |
| FR-1.4 | Financial estimation | Counsellor estimate (not ledger) | `use-counselling-estimate.ts` | CalculatePackageCostAsync | templates | CCMS case create | **COMPLETE** | Must never be treated as OpdBill | KEEP | Counselor | — |
| FR-2.1 | Auto-checklist | FE document slots | `DocumentChecklist.tsx`, `ccms-document-slots.ts` | `ccms_document_requirements` API exists; **not** used in SubmitPreAuth | `ccms_documents`, `ccms_document_requirements` | none | **PARTIAL** | No server gate | EXTEND `PreAuthorizationService` | CCMS | P1 |
| FR-2.2 | PACS/DICOM | Client DICOM viewer + manual imaging upload | `DICOMViewer.tsx` | `ImagingController`, `OctImagingService` | `imaging_images.dicom_metadata` | **none** | **MISSING** | No C-STORE/C-FIND/ADT | CREATE later (Phase 7) | Imaging | P3 |
| FR-2.3 | Status workflow | CCMS 30-state FSM | `/dashboard/ccms/*` | `WorkflowEngine`, seed `108_ccms_workflow_seed.sql` | `ccms_workflow_*` | IP validate-admission | **COMPLETE** | Claim-query states bypass FSM | MODIFY claim query to FireAsync | CCMS | P2 |
| FR-2.4 | Approval cap | ApprovedAmount on auth + allocation | CCMS pre-auth UI | `CoverageAllocationEngine`, `RecordTpaResponseAsync` | `ccms_coverage_authorizations.approved_amount` | apply-coverage-allocation | **COMPLETE** | — | KEEP | CCMS | — |
| FR-3.1 | Visual bed map | List/select beds on admit/transfer | `AdmitPanel.tsx`, ward table columns | `GET .../wards/{id}/beds`, `BedLifecyclePolicy` | `bed_inventory.ward_id` (165/167), `journey_bed_assignment` | internal ip-beds | **MISSING** (map UI) | Occupancy is complete; floor plan is not | CREATE component on S-04 | FE + Auth | P1 |
| FR-3.2 | Patient safety token | Not found in IP | — | — | — | — | **MISSING** | No wristband | CREATE print + `journey_safety_token` | IP | P0 |
| FR-3.3 | Vitals gatekeeper | Capture + auto-tick checklist | Ward vitals UI | `VitalSignService.AddVitalAsync` | `vital_sign` | none | **PARTIAL** | No numeric thresholds / override | EXTEND ChecklistGateService | IP | P0 |
| FR-4.1 | Dilation timer | Dilatation med keywords → checklist prompt | `dilatation-meds.ts`, `PreOpMedicationLog.tsx` | `administered_at` already stored | `pre_op_medication_log` | none | **MISSING** (timer) | No countdown / ready-at | EXTEND pre-op footer (no new state) | IP + FE | P0 |
| FR-4.2 | Drop administration | Per-dose med log | `PreOpMedicationLog.tsx` | `MedicationLogService` | `pre_op_medication_log` | audit `MedicationAdded` | **COMPLETE** | — | KEEP | IP | — |
| FR-4.3 | Site verification | Consent site mark + laterality attest + hard block | `ConsentCaptureModal.tsx`, `PatientIdentificationBanner.tsx` | `laterality_not_attested` in `ChecklistGateService` | clearance catalog `surgery_site_marked` | none | **COMPLETE** | Named “site verification” string absent; behaviour present | KEEP | IP | — |
| FR-5.1 | OT scheduler | Slot board + OT board | `/slots`, `/operation-theatre` | `SlotFunctions`, accept/start/complete | `journey_slot` (166) | `JourneyScheduled` | **COMPLETE** | — | KEEP | IP | — |
| FR-5.2 | GS1-128/DataMatrix | Catalog lookup by product code/GUID | `ImplantScanPanel` | `VerifyIolBarcodeAsync` length≥5 | `udi_barcode` column unused as parsed UDI | none | **MISSING** | No AI/GTIN/expiry parse | EXTEND parser in IP | IP | P0 |
| FR-5.3 | POC mismatch guard | Eye mismatch blocked FE+BE; serial unique if Implanted | `ImplantScanPanel` `eyeMismatch` | `RequireMatchingEye`, `EnsureSerialAvailableAsync` | `journey_implant_usage` unique implanted serial | ImplantUsed | **PARTIAL** | Power/model vs `patient_journey.iol_power` not compared | EXTEND RecordAsync | IP | P0 |
| FR-5.4 | Consignment inventory | Supplier `type: 'consignment'` enum only | `inventory.api.ts` | **NOT FOUND** in inventory-service | — | — | **MISSING** | No consignment issue/return | EXTEND Inventory later | Inventory | P2 |
| FR-5.5 | Operative notes | Intra-op note + sign | OT page `intraOpForm` | `IntraOpNoteService` | `intra_op_note` | none | **COMPLETE** | Intra-op save not in `journey_audit_log` | EXTEND audit | IP | P2 |
| FR-6.1 | Real-time ledger capture | Implanted → charge-items; consumables → charge; payments JWT | `CollectPaymentDrawer`, SignalR invalidate | `ImplantChargeHandler`, `OpdBillService.ChargeItems.cs` | `opd_bill_items` + idempotency | `PatientObligationChanged`, hub | **COMPLETE** | Unmapped → exception; KPI fallback to `balanceDue` | KEEP + harden mapping | Billing | P1 |
| FR-6.2 | Eyedrop tapering matrix | Free-text post-op meds | `PostOpInstructionsPanel.tsx` | `PostOpWorkflowService` | post-op instruction text | none | **MISSING** | No structured taper | CREATE table + S-08 panel | IP | P1 |
| FR-6.3 | Follow-up lock | Date + doctor + handover checkbox | `FollowUpHandoverPanel.tsx` | `FollowupDate` on post-op | `followup_date` | **no appointment API** | **MISSING** | Does not reserve OPD slot | EXTEND appointments + discharge gate | IP + Auth | P1 |

---

## 3. Module 1 — Pre-Admission & Counselor Dashboard

### 3.1 Business purpose

**Who:** Counsellor, ophthalmologist (advice), TPA desk (downstream).  
**Why:** Convert OPD surgical advice into a priced package, coverage case, and Expected journey without inventing a second price book.  
**Starts:** OPD consultation / Doctors Desk advice.  
**Ends:** Package selected, estimate shown, coverage case created (if payer), surgery finalized onto waiting list / Expected journey.  
**Upstream:** Doctors Desk, optometry/biometry, lab.  
**Downstream:** CCMS, IP Expected census, Billing ensure-bill at admit.

### 3.2 Existing screens

| Route | Action |
|---|---|
| `/dashboard/counselor` → waiting-list | KEEP |
| `/dashboard/counsellors-desk/waiting-list` | KEEP |
| `/dashboard/counsellors-desk/[id]` | KEEP / EXTEND OPD field copy |
| `/dashboard/counsellors-desk/finalize-surgery` | KEEP |
| `/dashboard/master-data/counsellor/packages` | KEEP |
| `/dashboard/ccms` (status strip) | KEEP |

### 3.3 Target UX

Reuse counsellor desk. Do **not** build a new “pre-admission dashboard.” Add a stronger “clinical carry-forward” panel: diagnosis, procedure, eye, biometry IOL power — written onto `patient_journey` at finalize, not only as FE hints.

**Pricing owner:** Auth catalog (`CalculatePackageCostAsync`). Counselor estimate is **not** `OpdBill`.

---

## 4. Module 2 — TPA & Insurance Pre-Authorization

### 4.1 Business purpose

TPA desk assembles eligibility + documents + pre-auth, records TPA query/approval, and stores the **approval cap**. IP only **reads** coverage via `getPreauthStatus` / validate-admission.

### 4.2 Existing (KEEP)

CCMS routes under `/dashboard/ccms/authorization`, `approvals`, `operations/preauth`, `documents/[caseId]`, `enhancements`. APIs: `PreAuthorizationService`, `EligibilityService`, `ClarificationService`, `EnhancementService`. Admit is fail-closed on `CoverageRejected`.

**Do not** create an insurance state machine in IP. `InsurancePreauthSubmitted` is deprecated (`IpFinancialFieldClassification`).

### 4.3 Gaps

| Gap | Change |
|---|---|
| FE-only document checklist | Server-validate `ccms_document_requirements` before `SubmitPreAuth` |
| Ops pre-auth queue empty | Fix `OperationsFunctions.GetPreAuthQueue` to use authorization lifecycle status **or** `GET /ccms/authorizations/queue` |
| PACS auto-attach | Phase 7; until then keep manual `ccms_documents` upload |
| Claim-query states | Route through `WorkflowEngine` |

---

## 5. Module 3 — Day-Care Admission & Bed Management

### 5.1 Business purpose

Ward clerk / nurse: patient arrives, is identified, occupies a day-care chair/bed, vitals captured, safety identity visible.

### 5.2 Existing (KEEP)

- Admit: `AdmitPanel.tsx` → `AdmitAsync` (CCMS validate, bed occupy, compensate).
- Beds: `BedLifecyclePolicy` `Available → Reserved → Occupied → Cleaning → Available` (+ maintenance). **Do not replace.**
- Types: `Recliner`, `DayCareChair` (165/167).
- History: `journey_bed_assignment`, `GET .../bed-assignments`, `PUT .../ward`.
- Slots: `journey_slot` + `/dashboard/ip-management/slots`.

### 5.3 Missing

| Feature | Action |
|---|---|
| Visual bed map | **NEW component** on ward page; data from existing `GET /ip-management/wards/{id}/beds` |
| Wristband / token | **NEW** print from census/admit; persist `journey_safety_token` |
| Vitals gate | **EXTEND** `ChecklistGateService` with configurable thresholds + `ip.vitals.override` |

No new bed FSM.

---

## 6. Module 4 — Pre-Operative Preparation & Clinical Tracking

### 6.1 Existing — KEEP as design reference

`WardPreOpWorkspaceModal` + `PreOpMarkReadyFooter` + `PreOpReadinessEngine` + four hard blocks. Census should continue to call `GET .../transition-gates?newState=ReadyForSurgery` (already the ward model).

### 6.2 Gaps on the same workspace

| FRD | Implementation |
|---|---|
| Dilation timer | Derive from first dilatation `administered_at` + tenant minutes (default 20–30). Show countdown in S-05 footer. Optional **warn** (not a 5th hard block unless clinically mandated). |
| Drops | Already complete. |
| Site verification | Already complete via consent laterality. |

**Do not** add clinical states `Pre-Op Pending` / `Ready for OT`.

---

## 7. Module 5 — OT & High-Value Asset Tracking

### 7.1 Existing (KEEP / EXTEND)

| Piece | Path |
|---|---|
| OT board | `/dashboard/ip-management/operation-theatre` |
| Accept / start / complete | `AcceptInOtAsync`, `StartSurgeryAsync`, clinical-transition |
| WHO | `SurgicalSafetyService` |
| Implant registry | `POST/PATCH /journeys/{id}/implants` → `journey_implant_usage` |
| Scan UI | `ImplantScanPanel.tsx` |
| Stock | `ImplantChargeHandler` → `IInventoryImplantClient` / `ImplantStockService` |
| Charge | only if `usageStatus == Implanted` (D2 write-off) |
| Reverse | `ImplantUsageReversed` + credit line |

### 7.2 Target implant machine (already close)

```
Recorded (Implanted|Opened_Unused|Wasted|Returned)
  Implanted → charge Pending → Posted
  write-off → ChargeStatus Suppressed
  Implanted → Reversed/Returned → CreditPending → Credited
```

Reserved/Issued as **inventory** states belong in Inventory (`ImplantStockService`), not as extra IP clinical states.

### 7.3 Gaps

- GS1 parser feeding GTIN, serial, lot, expiry into `RecordImplantRequest`.
- Compare scanned power/model to `patient_journey.iol_power` / planned catalog; block with reason override `ip.implant.mismatch.override`.
- Consignment: Inventory P2.

---

## 8. Module 6 — Billing & Automated Discharge

### 8.1 Existing (KEEP)

- Ledger: `opd_bills` / `opd_bill_items` / `opd_bill_payments` (append-only).
- One bill per journey: `ux_opd_bills_patient_journey`.
- Cashier: `CollectPaymentDrawer` → `opdBillingApi.ensureIpBill` + `addPayment` (`bill.update` / `ip.billing.collect`).
- Deep link: `/dashboard/billing/opd?billId=&journeyId=&patientId=`.
- Discharge money gate: `DischargeFinancialClearancePolicy` + `patient_obligation_outstanding` (**patient share**, not TPA balance).
- `PostOp → ReadyForDischarge` is **not** money-gated (SoT Phase 9).

**IP must not write money.** Deprecated `POST .../journeys/{id}/billing` remains for UAT; UI forbidden.

### 8.2 Gaps

- Eyedrop tapering structured matrix on S-08.
- Follow-up appointment create + **block ReadyForDischarge** until `appointment_id` exists (or documented override).
- Census KPI: remove `j.balanceDue` fallback when ledger dashboard fails (show error, not a second number).

---

## 9. Additional Required Capabilities

| Capability | Current | Action |
|---|---|---|
| RBAC seed dual-path | SQL 156 complete; C# `PermissionSeeder` incomplete | ALIGN seeder |
| Fail-closed FE | Complete in production | KEEP |
| Realtime | `NotificationHub` + 45s poll | KEEP; `useWardRealtime` is dead — do not resurrect |
| Integration health | `/dashboard/admin/integration-health` | KEEP |
| Charge mapping | `/dashboard/admin/charge-mapping` | KEEP (operational) |
| Reconciliation | `/dashboard/admin/charge-reconciliation` | KEEP |
| Audit clinical | Broad; intra-op thin | EXTEND |
| HL7 ADT | Missing | Phase 7 |
| Persona census | `resolveIpPersona` emphasis-only | KEEP (not a security boundary) |

---

## 10. Existing Screen Reuse Matrix

| Existing screen | Route | Purpose | Status | Requirements | Problems | Action | Target | FE | BE | DB |
|---|---|---|---|---|---|---|---|---|---|---|
| IP census | `/dashboard/ip-management` | Worklist | Live split pane | Coordinator throughput | KPI fallback | KEEP | S-01 | Harden KPI | — | — |
| Context rail | `PatientQuickPanel` → `PatientContextRail` | Persona actions | Live | Mark ready, collect | Naming leftover | KEEP | S-02 | — | — | — |
| Collect payment | `CollectPaymentDrawer` | Cashier | Live | FR-6.1 | — | KEEP | S-03 | — | — | — |
| Ward board | `/ward` | Nurse board | Live | FR-3, FR-4 | No bed map | EXTEND | S-04 | Bed map | — | — |
| Pre-op workspace | `WardPreOpWorkspaceModal` | Readiness | Best-in-module | FR-4 | No timer | EXTEND | S-05 | Timer | optional gate | reuse med log |
| OT board | `/operation-theatre` | OT flow | Live | FR-5 | No GS1 | EXTEND | S-06 | — | parser | — |
| Implant scan | `ImplantScanPanel` | IOL | Live | FR-5.2/5.3 | Weak barcode | EXTEND | S-07 | parse UX | mismatch | — |
| Post-op | `WardPostOpWorkspaceModal` | Recovery | Live | FR-6.2 | Free-text | EXTEND | S-08 | matrix | new table | yes |
| Discharge | `WardDischargeWorkspaceModal` | DC | Live | FR-6.3 | No appt lock | EXTEND | S-09 | — | gate | appointment FK |
| Journey | `/journey/[id]` | Record | Live | Audit | — | KEEP | S-10 | — | — | — |
| IP billing | `/ip-management/billing` | AR | Live | Finance | — | KEEP | S-11 | — | — | — |
| OPD bill | `/billing/opd` | Ledger UI | Live | Cashier handoff | — | KEEP | S-12 | — | — | — |
| Slots | `/slots` | Day-care batch | Live | FR-5.1 | — | KEEP | S-13 | — | — | — |
| Charge mapping | `/admin/charge-mapping` | Catalog | Live | D1/D4 | — | KEEP | S-14 | — | — | — |
| Reconciliation | `/admin/charge-reconciliation` | 3-way match | Live | F5 residual | — | KEEP | S-15 | — | — | — |
| Integration health | `/admin/integration-health` | Outbox | Live | Ops | — | KEEP | S-16 | — | — | — |
| Reason dialog | `ReasonConfirmDialog` | Unmark/override | Live | Unmark ready | — | KEEP | S-17 | — | — | — |
| Coverage block | `CoverageContextBlock` | Payer | Live | Module 2 read | — | KEEP | S-18 | — | — | — |
| Counselor desk | `/counsellors-desk/*` | FR-1 | Live | Packages | OPD copy | EXTEND | — | — | onboard | — |
| CCMS suite | `/dashboard/ccms/*` | FR-2 | Live | Pre-auth | Queue bug | MODIFY queue | — | — | filter | — |
| `addBilling` UI | — | Legacy money | Retired | — | BE endpoint still exists | DEPRECATE BE after UAT | — | — | freeze writes | freeze `ip_billing_transactions` inserts |

**Do not create:** second census, second OT, IP-owned bill page, IP insurance workflow, new bed product.

---

## 11. Complete Target Screen Inventory

| ID | Route | Persona | Pattern | Current | Target | FE | BE | DB | Integration |
|---|---|---|---|---|---|---|---|---|---|
| S-01 | `/dashboard/ip-management` | Coordinator | Split pane | KEEP | KEEP | KPI error state | — | — | SignalR |
| S-02 | rail | All | Docked / Sheet | KEEP | KEEP | — | gates | — | — |
| S-03 | drawer | Cashier | Dialog | KEEP | KEEP | — | OpdBills | payments | PaymentReceived |
| S-04 | `/ward` | Ward nurse | Shell A | KEEP | EXTEND map | bed map | list beds | bed_inventory | occupy |
| S-05 | modal | Ward nurse | Shell B | KEEP | EXTEND timer | countdown | optional warn | med log | — |
| S-06 | `/operation-theatre` | OT | Full page | KEEP | EXTEND | — | GS1 | — | JourneyReadyForOt |
| S-07 | panel | Surgeon | Shell C | KEEP | EXTEND | UDI fields | mismatch | implant usage | ImplantUsed |
| S-08 | modal | Recovery | Shell B | KEEP | EXTEND taper | matrix | CRUD | new table | — |
| S-09 | modal | Ward | Shell B | KEEP | EXTEND lock | appt picker | gate | appointment id | — |
| S-10–S-18 | as §10 | mixed | existing | KEEP | KEEP | — | — | — | — |

---

## 12. Screen-by-Screen UX / Wireframe Specification

**Do not restyle screens that already match mockups.** Visual specs live in `docs/mockups/ip-target/s-01` … `s-18`. Below: only **delta** vs live code.

### S-04 Ward board — visual bed map (NEW zone)

- Place a **day-care occupancy strip** above the journey table (not a new route): chairs/recliners as cells coloured by `Available / Occupied / Cleaning / Reserved`, labelled with bed number + UHID, never colour-only (include status word).
- Click occupied cell → existing patient drawer / pre-op.
- Empty → admit/assign using existing `AdmitPanel` / transfer.
- Loading / empty / permission: reuse ward board states; hide map if `ip.view` missing (fail closed).
- Data: existing beds API; realtime: existing `WardJourneyChanged` invalidation (`use-ward-board-query.ts`).

### S-05 Pre-op — dilation timer (NEW footer chip)

- Header / identity / steps: **unchanged**.
- New chip: “Dilation: mm:ss remaining” or “Dilation ready” from first matching med `administered_at`.
- Empty: “No dilating drop recorded”.
- Do not block Mark Ready unless product later promotes it to a hard block (default: warn).

### S-07 Implant scan — GS1 + power guard

- Keep layout. On scan, parse GS1; fill GTIN/serial/lot/expiry.
- If power ≠ `journey.iolPower` (numeric compare): **block** with reason dialog (`ReasonConfirmDialog`) + permission.
- Error copy: user-facing only (“This lens power does not match the planned power”). No service names.

### S-08 Post-op — tapering matrix

- Table: drug, eye, start dose, taper steps (frequency × days), stop date.
- Add + history (existing convention).
- Print into discharge instructions.

### S-09 Discharge — follow-up lock

- Follow-up section: pick existing appointment or create via appointments API.
- Primary Discharge disabled until appointment id **or** override + reason (`ip.discharge.override` already exists).

All other screens: **no visual redesign**. Loading/empty/error/permission/conflict/success already exist on census, billing, charge-mapping, integration-health; inherit those patterns.

---

## 13. End-to-End Real-Time Patient Journey

Ophthalmic day-care cataract, right eye, package + premium IOL, TPA.

| # | Actor | Screen | FE action | API | Backend | DB | Event | Consumer | Realtime | Audit | Failure |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Ophthalmologist | Doctors Desk | Complete consult | existing encounter APIs | Auth | visit | — | Counsellor | — | encounter | retry UI |
| 2 | Counsellor | `/counsellors-desk/[id]` | Select package + IOL upgrade | counselling APIs | `CounsellingPackageTemplateService` | `counselor_packages` | — | estimate | — | session | validation |
| 3 | System | — | Session complete | `POST .../counselling-completed` | `CoverageCaseService.CreateAsync` | `ccms_coverage_cases` | counselling-completed | CCMS | status strip | case | idempotent key |
| 4 | TPA | CCMS eligibility | Run check | `/eligibility-checks` | `EligibilityService` | `ccms_eligibility_checks` | workflow | case | — | history | ELIGIBILITY_FAILED |
| 5 | TPA | Documents | Upload | `/coverage-cases/{id}/documents` | `DocumentEngineService` | `ccms_documents` | — | — | — | — | blob retry |
| 6 | TPA | Pre-auth | Generate/submit | `/authorization` `/submit` | `PreAuthorizationService` | `ccms_coverage_authorizations` | workflow | TPA | — | approval events | **today: no doc gate** |
| 7 | TPA | TPA response | Record approved amt | `/tpa-response` | `RecordTpaResponseAsync` | `approved_amount` | — | allocation | — | — | invalid amount |
| 8 | Coordinator | Slots | Assign slot | `POST /ip-management/slots` | `SlotService.AssignAsync` | `journey_slot` | `JourneyScheduled` | OT board | hub | slot audit | unique slot |
| 9 | Ward | Admit | Admit + bed | `POST clinical-transition` Expected→Admitted | `AdmitAsync` | `patient_journey`, `bed_inventory` | `JourneyAdmitted` | CCMS | census | ClinicalStateChanged | bed compensate |
| 10 | Billing (auto) | — | Ensure + explode | internal `ensure-bill` | `EnsureInpatientBillAsync` | `opd_bills`, items | BillCreated hub | cashier | hub | financial audit | mapping exception |
| 11 | Ward | Pre-op | Vitals, drops, consent, PAC | vitals/meds/consent/PAC APIs | respective services | `vital_sign`, `pre_op_medication_log`, clearance | — | readiness | ward poll/SignalR | VitalRecorded etc. | **no BP gate today** |
| 12 | Ward | Pre-op footer | Mark Ready | `GET transition-gates` then `POST clinical-transition` | `ChecklistGateService` + `TransitionClinicalAsync` | `patient_journey` | `JourneyReadyForOt` | OT | hub | ClinicalStateChanged | 4 hard blocks |
| 13 | Ward | Census | Send to OT | clinical-transition SentToOT | validator | journey | realtime | OT | hub | — | med-log warn |
| 14 | OT | OT board | Accept | `POST .../accept` | billing gate `ValidateBillingGateForAcceptAsync` | ot state | realtime | — | hub | OtPatientAccepted | no bill / no FC |
| 15 | OT | WHO | Timeout | surgical-safety | `SurgicalSafetyService` | safety tables | — | start gate | — | WhoTimeoutSigned | incomplete |
| 16 | OT | Implant scan | Scan + record Implanted | `POST .../implants` | `ImplantUsageService.RecordAsync` | `journey_implant_usage` | `ImplantUsed` | Inventory + Billing | OT list | ImplantRecorded | eye mismatch; **power not checked** |
| 17 | System | — | Charge | internal `charge-items` | `OpdBillService.ChargeItemsAsync` | `opd_bill_items` | `PatientObligationChanged` | CCMS | billing hub | ChargeItemsPosted audit | unmapped → Exception |
| 18 | OT | Complete | SurgeryCompleted | clinical-transition | outbox | journey | `SurgeryCompleted` | CCMS COMPLETE_SURGERY | hub | — | outbox retry |
| 19 | Ward | Post-op | Recovery + instructions | post-op APIs | `PostOpWorkflowService` | post-op tables | realtime | — | hub | — | **no taper table** |
| 20 | Cashier | Census drawer | Collect | `POST /api/OpdBills/payment` | `OpdBillService` | `opd_bill_payments` | `PaymentReceived` | CCMS applied | hub | IAuditService | idempotency key |
| 21 | CCMS | Allocation | Allocate | `/billing/allocate` | `CoverageAllocationEngine` | summaries | apply-coverage-allocation | Billing | obligation hub | — | approvedLimit≤0 |
| 22 | Ward | Discharge | ReadyForDischarge → Discharged | clinical-transition | obligation policy | journey, vacate bed | `PatientClinicallyDischarged` | CCMS | hub | — | outstanding patient share |
| 23 | Billing exec | `/billing/opd` | Finalize | finalize API | `OpdBillService` | `opd_bills` | `BillFinalized` | CCMS | hub | — | 409 RowVersion |
| 24 | TPA | Claims | Packet + submit | claim APIs | `ClaimPacketGeneratorService` | `ccms_claim_packets` | — | — | — | — | query bypass FSM |
| 25 | TPA | Settlement | Record | settlement APIs | `SettlementReconciliationService` | `ccms_settlements` | RECEIVE_SETTLEMENT | workflow | — | — | mismatch → recon UI |

---

## 14. Backend / API Implementation Plan (remaining only)

### 14.1 IOL planned-power mismatch — EXTEND

```
POST /api/ip-management/journeys/{id}/implants
```

- **Reuse:** `ImplantUsageService.RecordAsync`.
- **Add:** after `RequireMatchingEye`, compare `req.Power` to `journey.IolPower` (decimal). If mismatch and `acknowledgeMismatch != true` → 409 with user message.
- **Perm:** existing implant record (`ot.safety.sign` / `ip.surgery.complete`); override `ip.implant.mismatch.override` (new, seed in 156-style SQL).
- **Idempotency:** existing usage id key.
- **Event:** unchanged `ImplantUsed`.

### 14.2 GS1 parse — EXTEND

```
POST /api/ip-management/journeys/{id}/verify-iol-barcode
```

Replace length≥5 with GS1 AI parser (`01` GTIN, `21` serial, `10` lot, `17` expiry). Still resolve catalog. Invalid GS1 → 400 user message.

### 14.3 Wristband — CREATE

```
POST /api/ip-management/journeys/{id}/safety-token
GET  /api/ip-management/journeys/{id}/safety-token
```

- Service `JourneySafetyTokenService`.
- Perm: `ip.admit` or `ip.view` (print).
- Idempotent: one active token per journey (`UNIQUE (tenant_id, journey_id) WHERE revoked_at IS NULL`).

### 14.4 Vitals threshold — EXTEND

Inside `ChecklistGateService.AddMarkReadyHardBlocksAsync` (or dedicated warn): if latest `vital_sign` outside tenant thresholds → `vitals_out_of_range` **warn** default / **block** if configured. Override: `ip.vitals.override` + reason.

**No new clinical state.**

### 14.5 Dilation timer — FE primary

`GET .../pre-op/readiness` already exists. Add `dilationStartedAt`, `dilationReadyAt` computed from med log. No new table required.

### 14.6 Tapering — CREATE

```
GET/PUT /api/ip-management/journeys/{id}/post-op/taper
```

### 14.7 Follow-up lock — EXTEND

```
POST /api/ip-management/journeys/{id}/follow-up-appointment  { appointmentId }
```

Discharge `ReadyForDischarge` evaluates `followup_appointment_id IS NOT NULL` unless override.

### 14.8 Visual beds — FE only initially

Reuse `GET /ip-management/wards/{id}/beds`.

### 14.9 CCMS pre-auth docs — EXTEND

`SubmitPreAuth`: load `ccms_document_requirements` for stage; 400 if missing required docs.

### 14.10 Ops queue — MODIFY

Filter `ccms_coverage_authorizations.status` consistently (`active` / process-status), **or** switch FE to `GET /ccms/authorizations/queue`.

**Do not** add a third outbox.

---

## 15. Database Architecture & Migration Plan

| DB | Table | Existing? | Change | Notes | Migration | Backfill | Rollback |
|---|---|---|---|---|---|---|---|
| Shared | `patient_journey` | Y | EXTEND nullable `safety_token_id`, `followup_appointment_id`, `unmark_ready_*` already from 157 | — | 168+ | no | drop FKs |
| Shared | `journey_implant_usage` | Y | KEEP | power column exists | — | — | — |
| Shared | `journey_slot` | Y | KEEP | 166 | — | — | — |
| Shared | `bed_inventory` | Y | KEEP | ward_id 165/167 | — | — | — |
| Shared | `pre_op_medication_log` | Y | KEEP | `administered_at` sufficient for timer | — | — | — |
| Shared | `vital_sign` | Y | KEEP | thresholds in config table | — | — | — |
| Shared | `opd_bills` / items / payments | Y | KEEP | row_version, idempotency exist | — | — | — |
| Shared | `ip_billing_transactions` | Y | FREEZE writes | projection only | comment + API 410 | — | — |
| Shared | `journey_safety_token` | N | CREATE | FR-3.2 | 168 | no | DROP |
| Shared | `ip_vital_threshold` | N | CREATE | tenant BP/HR/SpO2/temp | 169 | seed defaults | DROP |
| Shared | `post_op_taper_step` | N | CREATE | FR-6.2 | 170 | no | DROP |
| Shared | `permissions` | Y | INSERT 2–3 codes | mismatch override, vitals override, safety token | 171 | role bundles | delete codes |
| CCMS | workflow claim-query states | PARTIAL | INSERT states+transitions | FR-2.3 hygiene | 172 | map existing cases | — |
| Inventory | consignment | N | DEFER | FR-5.4 | later | — | — |

Indexes: unique implanted serial already in 160; unique payment/item idempotency already in Auth.

---

## 16. Actual PostgreSQL Migration Scripts (remaining)

Existing 156–167 must **not** be re-run as new work. New scripts below are additive.

```sql
-- Migration: 168_journey_safety_token.sql
-- Purpose: FR-3.2 printable patient safety token / wristband identity
-- Dependencies: patient_journey
-- Rollback: DROP TABLE journey_safety_token; ALTER TABLE patient_journey DROP COLUMN IF EXISTS safety_token_id;
BEGIN;

CREATE TABLE IF NOT EXISTS journey_safety_token (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid NOT NULL,
    journey_id      uuid NOT NULL REFERENCES patient_journey(id),
    token_code      varchar(32) NOT NULL,
    barcode_value   varchar(64) NOT NULL,
    laterality      varchar(8),
    printed_at      timestamptz,
    printed_by      uuid,
    revoked_at      timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    created_by      uuid NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_journey_safety_token_active
    ON journey_safety_token (tenant_id, journey_id)
    WHERE revoked_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_journey_safety_token_code
    ON journey_safety_token (tenant_id, token_code);

COMMIT;
```

```sql
-- Migration: 169_ip_vital_threshold.sql
-- Purpose: FR-3.3 configurable vitals gate (not a clinical state)
-- Dependencies: none (tenant-scoped)
-- Rollback: DROP TABLE ip_vital_threshold;
BEGIN;

CREATE TABLE IF NOT EXISTS ip_vital_threshold (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id             uuid NOT NULL,
    systolic_max          int NOT NULL DEFAULT 180,
    diastolic_max         int NOT NULL DEFAULT 110,
    pulse_min             int NOT NULL DEFAULT 40,
    pulse_max             int NOT NULL DEFAULT 140,
    spo2_min              numeric(5,2) NOT NULL DEFAULT 92,
    temp_max_c            numeric(4,1) NOT NULL DEFAULT 38.5,
    severity              varchar(16) NOT NULL DEFAULT 'warn'
                          CHECK (severity IN ('warn', 'block')),
    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id)
);

COMMIT;
```

```sql
-- Migration: 170_post_op_taper_step.sql
-- Purpose: FR-6.2 structured eyedrop taper (replaces free-text-only)
-- Dependencies: patient_journey
-- Rollback: DROP TABLE post_op_taper_step;
BEGIN;

CREATE TABLE IF NOT EXISTS post_op_taper_step (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid NOT NULL,
    journey_id      uuid NOT NULL REFERENCES patient_journey(id),
    drug_name       varchar(160) NOT NULL,
    eye             varchar(8) NOT NULL,
    step_no         int NOT NULL,
    frequency_label varchar(80) NOT NULL,
    days            int NOT NULL CHECK (days > 0),
    instructions    text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    created_by      uuid NOT NULL,
    deleted_at      timestamptz,
    UNIQUE (journey_id, drug_name, eye, step_no)
);

CREATE INDEX IF NOT EXISTS ix_post_op_taper_journey
    ON post_op_taper_step (tenant_id, journey_id)
    WHERE deleted_at IS NULL;

COMMIT;
```

```sql
-- Migration: 171_frd_safety_permissions.sql
-- Purpose: seed remaining P0 permission codes into permissions + role bundles
-- Dependencies: 156_ip_billing_rbac_seed.sql
-- Rollback: delete role_permissions then permissions for these codes
BEGIN;

INSERT INTO permissions ("Id", "Code", "Name", "Module", "Action", "Resource", "Scope", "Description")
SELECT gen_random_uuid(), x.code, x.name, 'ip_management', 'update', 'patient_journey', 'branch', x.descr
FROM (VALUES
    ('ip.implant.mismatch.override', 'Override IOL mismatch', 'Record implant when power/model differs from plan'),
    ('ip.vitals.override',           'Override vitals gate',  'Proceed despite out-of-range vitals'),
    ('ip.safety_token.print',        'Print safety token',    'Print or reprint inpatient wristband')
) AS x(code, name, descr)
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p."Code" = x.code);

-- Role attach: ADMIN + SURGEON for mismatch; NURSE+ADMIN for vitals/token
-- REQUIRES CODEBASE VERIFICATION of exact permissions table column names in this environment
-- (156 uses quoted PascalCase columns). Align INSERT with 156's actual column list before apply.

COMMIT;
```

```sql
-- Migration: 172_ccms_claim_query_states.sql
-- Purpose: add CLAIM_QUERY_RAISED / CLAIM_QUERY_RESPONDED to CCMS_MAIN seed
-- Dependencies: 108_ccms_workflow_seed.sql
-- Rollback: delete transitions then states
-- REQUIRES CODEBASE VERIFICATION of state UUID assignment pattern in 108 before insert.
BEGIN;
-- Insert states + transitions matching WorkflowEngine (from_state_id, trigger_event).
-- Do not apply until 108 row layout is copied exactly.
COMMIT;
```

Follow-up appointment: prefer **nullable `followup_appointment_id uuid`** on existing post-op instruction table (column `followup_date` already exists). Exact table name: `PostOpChecklist` mapped in `IpManagementDbContext` — confirm table name in mapping before ALTER (**REQUIRES CODEBASE VERIFICATION** of EF `ToTable`).

```sql
-- Migration: 173_postop_followup_appointment.sql
-- Purpose: FR-6.3 lock discharge to a real appointment
-- Rollback: ALTER TABLE ... DROP COLUMN followup_appointment_id;
BEGIN;
-- ALTER TABLE <post_op_table> ADD COLUMN IF NOT EXISTS followup_appointment_id uuid;
-- CREATE INDEX IF NOT EXISTS ix_postop_followup_appt ON <post_op_table> (followup_appointment_id);
COMMIT;
```

---

## 17. Event / Outbox / Realtime Architecture

| Event | Producer | Consumer | Trigger | Idempotency | Outbox | UI |
|---|---|---|---|---|---|---|
| JourneyAdmitted | IP | CCMS | Admit | existing | IP | census |
| JourneyScheduled | IP | OT/analytics | Slot assign | existing | IP | slot board |
| JourneyReadyForOt | IP | OT | Mark ready | existing | IP | OT board |
| JourneyReadyReverted | IP | OT | Unmark | existing | IP | OT |
| ImplantUsed | IP | Inventory + Billing | Record implant | `ImplantUsed:{usageId}` | IP | OT + bill |
| ImplantUsageReversed | IP | Inventory + Billing | Correct/return | `ImplantUsageReversed:{usageId}` | IP | recon |
| ConsumablesConsumed | Inventory | IP ConsumableChargeHandler | OT issue | consumption id | shared | recon |
| PaymentReceived | Billing | CCMS **applied** | payment | payment key | billing_ccms | billing dash |
| PaymentReversed | Billing | CCMS applied | reverse | existing | billing | dash |
| PatientObligationChanged | Billing | CCMS applied | charges/coverage | existing | billing | rail |
| BillFinalized | Billing | CCMS | finalize | existing | billing | dash |
| SurgeryCompleted | IP | CCMS | complete | existing | IP | OT/CCMS |
| PatientClinicallyDischarged | IP | CCMS | discharge | existing | IP | census |
| ClaimStatusChanged | mixed | CCMS inbound **ack-only**; Auth notify | claim | existing | — | CCMS |

**New events not required** for remaining FRD except optional `SafetyTokenPrinted` (audit row is enough). Reuse 8-retry → Dead. Dead letters: existing S-16.

Realtime: identity-only hub payloads; clients invalidate React Query (`use-ip-journeys-query.ts`, `use-ward-board-query.ts`, `use-ip-billing-dashboard-query.ts`) + 45s poll.

---

## 18. RBAC / Security Matrix

Frontend visibility is **not** security. Server: `IpChecklistAuth` + `JourneyCommandAuthContext` + `[RequirePermission]` on OpdBills.

| Persona | Existing (156 bundles) | Required extra | Missing | Excess | FE | API |
|---|---|---|---|---|---|---|
| Ward nurse | admit, mark_ready, unmark, send, postop, discharge, checklist | vitals.override, safety_token.print | those two | Grandfathered `ward.checklist.edit` still aliases some OT perms | fail-closed | server |
| OT nurse / OT coord | accept, start, complete, safety.sign | implant.mismatch.override (surgeon primary) | mismatch code | — | ImplantScanPanel `canRecord` | RequireImplantRecord |
| Surgeon | surgery.complete, postop, implant | mismatch override | seed | — | OT | server |
| IP coordinator | mark_ready, send, view | — | — | — | census | server |
| Ward clerk | bed.transfer, view | token print | — | must NOT get PAC edit | hide clinical | server |
| Cashier | bill.update, ip.billing.collect, bill.create | — | — | billing-dashboard-access `cashier`→full may be wide | persona rail | bill.update |
| Billing exec | bill.* | — | — | — | S-12 | server |
| TPA desk | CCMS perms | — | ops queue bug | — | CCMS | JWT |
| Inventory mgr | inventory | consignment later | FR-5.4 | — | inventory | — |
| Finance | bill.view / dashboard | recon | — | — | S-11/S-15 | bill.view |
| Admin | emergency_fc, discharge.override, integration.admin | new overrides | seeder drift | — | all | server |

**P0:** copy IP/billing codes from SQL 156 into `PermissionSeeder.cs` so seeder-only environments match.

Internal `X-Internal-Key` remains network-only; never bundle in FE.

---

## 19. HL7 / DICOM / PACS Integration

| Interface | Status | Plan |
|---|---|---|
| HL7 ADT A01/A02/A03 | **MISSING** | Phase 7: adapter publishing from existing `JourneyAdmitted` / bed transfer / `PatientClinicallyDischarged` — **consume outbox, do not fork IP writes** |
| DICOM C-STORE/C-FIND | **MISSING** | Phase 7; keep manual imaging + Cornerstone viewer |
| Biometry → CCMS | **MISSING** | Attach existing `BiometryRecord` files into `ccms_documents` (small P2) |
| Security | TLS, JWT, tenant | KEEP; no PHI in SignalR details |

Do not pretend these exist. Day-care go-live does **not** depend on them.

---

## 20. Reporting / Reconciliation / Operational Monitoring

**KEEP** existing:

- `/dashboard/admin/charge-reconciliation` — `ChargeReconciliationService` (implanted-not-charged, charged-not-implanted, wastage).
- `/dashboard/admin/charge-mapping` — unmapped exceptions.
- `/dashboard/admin/integration-health` — both outboxes, requeue/abandon.
- `/dashboard/ccms/settlement/reconciliation`.
- `/dashboard/ip-management/throughput`.

**EXTEND:** include vitals-override and IOL-mismatch counts on throughput (P2). **Done** — `SlotThroughputDto.vitalsOverrideCount` / `iolMismatchOverrideCount` from `VitalsWarningAcknowledged` and `ImplantMismatchOverridden` on slotted journeys.

---

## 21. Performance & Scalability

| Current | Problem | Target | FE | BE | DB |
|---|---|---|---|---|---|
| Census row click extra GETs | Was N+1; rail still fetches summary/preauth/audit | react-query cache by journeyId | wrap remaining GETs | — | — |
| KPI fallback `j.balanceDue` | Two outstanding numbers | ledger only + error | page.tsx | — | — |
| Ward 45s poll | Intentional fallback | KEEP | — | — | — |
| Client tab filter | Target wanted server counts | `GetDashboardSummaryAsync` already exists — **verify FE uses it** (**REQUIRES CODEBASE VERIFICATION** of census count source) | use summary | KEEP | indexes on clinical_state |
| Unbounded journeys | Phase 8 paging | KEEP server page | — | — | — |

---

## 22. Testing & UAT Strategy

### Unit

StateTransitionValidator (already); implant eye+**power** mismatch; GS1 parser; vitals threshold; taper CRUD; discharge follow-up gate; permission fail-closed tests (exist).

### Integration

IP→Billing charge-items (exist `ImplantUsageTests`); Inventory apply; CCMS payment **applied** (exist CollectionSettlement); SubmitPreAuth document gate (new); ops queue (new).

### E2E (extend existing pre-op / census specs)

Happy path §13. Negatives: wrong eye (exists), wrong power (new), missing consent (exists), duplicate serial (exists), duplicate payment key (exists), TPA reject admit (exists), billing down (outbox Dead + S-16), concurrent cashier 409 RowVersion.

UAT catalog: `UatScenarioCatalog.cs` / `UatDatasetService.cs` — add scenarios for dilation wait, wristband print, taper, follow-up lock.

---

## 23. Phased Implementation Roadmap

**Do not restart Phases 0–6 of the stale document** (RBAC, census split pane, package explode, implant registry, slots, recon, integration health are done).

| Phase | Objective | Screens | FE | BE | DB | Integration | RBAC | Tests | Deps | Risk | Rollback | Accept |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **A — Safety deltas** | Wrong-IOL + dilation + vitals + wristband | S-05, S-07, S-01/S-04 | timer, GS1 fields, token print, bed map later | mismatch, GS1, token, vitals gate | 168, 169, 171 | none new | new codes | unit+e2e | none | override abuse | feature flags | cannot record mismatched IOL without override; token prints; timer visible |
| **B — Discharge completeness** | Taper + follow-up lock | S-08, S-09 | matrix, appt picker | CRUD + gate | 170, 173 | appointments API | discharge.override | e2e DC | A optional | appt service down | override | cannot DC without appt or override |
| **C — CCMS hygiene** | Doc gate + queue fix + claim-query FSM | CCMS | checklist from master | SubmitPreAuth, queue, FireAsync | 172 | — | existing | integration | none | false blocks | revert gate | queue non-empty; submit blocked without docs |
| **D — Catalog ops** | Drive unmapped to zero | S-14, S-15 | — | — | mapping rows | — | bill.admin | recon job | live surgeries | — | — | exception queue empty for mapped packages |
| **E — Seeder alignment** | PermissionSeeder = SQL 156 | — | — | seeder | — | — | — | seed test | — | empty JWT | — | fresh DB has ip.admit |
| **F — Consignment + HL7/PACS** | FR-5.4, FR-2.2 | inventory / imaging | — | adapters | later | new | — | contract tests | A–D | vendor | isolate | optional |

---

## 24. Detailed Engineering Task Breakdown

| ID | Title | Module | Pri | Type | Current | Target | Modify | Create | API | Events | Deps | Accept | Tests | Migration | Risk |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| TASK-A1 | GS1 parser | 5 | P0 | BE/FE | length≥5 | AI parse | `PatientJourneyService.VerifyIolBarcodeAsync`, `ImplantScanPanel` | `Gs1BarcodeParser` | verify-iol-barcode | none | — | GTIN/serial filled | unit GS1 fixtures | none | bad barcodes |
| TASK-A2 | Power/model mismatch | 5 | P0 | BE/FE | eye only | block + override | `ImplantUsageService.RecordAsync` | — | POST implants | ImplantUsed | A1 | 409 without override | ImplantUsageTests | 171 | false mismatch on empty plan |
| TASK-A3 | Dilation countdown | 4 | P0 | FE/BE | keyword prompt | timer from `administered_at` | `PreOpMarkReadyFooter`, readiness DTO | — | GET pre-op/readiness | none | — | chip shows mm:ss | component test | none | tz |
| TASK-A4 | Vitals threshold | 3/4 | P0 | BE | capture only | warn/block | `ChecklistGateService` | threshold load | transition-gates | none | 169 | gates include vitals_out_of_range | gate tests | 169 | over-block |
| TASK-A5 | Wristband | 3 | P0 | FE/BE/DB | missing | print | AdmitPanel, census | `JourneySafetyTokenService` | safety-token | audit | 168 | unique token | api test | 168 | reprint |
| TASK-A6 | Visual bed map | 3 | P1 | FE | table | occupancy strip | `ward/page.tsx` | `WardBedMap` | existing beds GET | hub invalidate | 165 | cells match occupancy | e2e | none | stale poll |
| TASK-B1 | Taper matrix | 6 | P1 | full | free text | steps table | S-08 | service | post-op/taper | none | 170 | steps persist | api | 170 | — |
| TASK-B2 | Follow-up lock | 6 | P1 | full | date only | appointment FK | S-09, ChecklistGateService | — | follow-up-appointment | none | 173 + appointments | DC blocked | e2e | 173 | appt outage |
| TASK-C1 | Pre-auth doc gate | 2 | P1 | BE | FE only | server | `PreAuthorizationService.Submit` | — | submit | none | requirements table | 400 missing docs | integration | none | legacy cases |
| TASK-C2 | Ops queue filter | 2 | P1 | BE | INCORRECT | match `active` | `OperationsFunctions` | — | preauth-queue | none | — | queue lists auths | api | none | — |
| TASK-C3 | Claim query FSM | 2 | P2 | BE/DB | direct column | FireAsync | `ClaimPacketGeneratorService` | — | claims/query | workflow | 172 | state in seed | unit | 172 | history |
| TASK-D1 | Mapping completeness | 1/6 | P1 | ops | exceptions | mapped packages | S-14 | — | chargemapping | — | live data | recon clean | recon | none | — |
| TASK-E1 | PermissionSeeder parity | 9 | P0 | BE | SQL-only | seeder+SQL | `PermissionSeeder.cs` | — | — | — | 156 | fresh seed test | unit | none | duplicate insert |
| TASK-E2 | Freeze addBilling | 6 | P2 | BE | deprecated live | 410 Gone for browser | `JourneyFunctions` billing | — | POST billing | — | UAT | UI test already | — | none | UAT scripts |
| TASK-E3 | Intra-op audit | 5 | P2 | BE | no row | JourneyClinicalAudit | `IntraOpNoteService` | — | intra-op | — | — | audit row | unit | none | — |
| TASK-F1 | Consignment | 5 | P2 | Inv | enum | stock type flow | inventory | — | issue/return | ImplantUsed | F | — | — | later | — |
| TASK-F2 | HL7 ADT | 9 | P3 | Int | missing | outbox consumer | new adapter | — | MLLP | existing clinical events | A | ACK | contract | later | vendor |
| TASK-F3 | PACS | 2 | P3 | Int | viewer | C-FIND attach | imaging | — | DICOM | — | F2 | study on case | — | later | — |

Each task is independently testable. Do not combine A2 with a new clinical state.

---

## 25. Dependency Graph

```
TASK-E1 (seeder) ─────────────────────────────── parallel with all A/C
TASK-C2 (queue)  ─────────────────────────────── parallel
TASK-A1 (GS1) → TASK-A2 (mismatch)
TASK-A3 (dilation) ── parallel
TASK-A4 (vitals) ← 169
TASK-A5 (token)  ← 168
TASK-A6 (bed map) ── parallel (FE)
TASK-B1 (taper) ── parallel with B2 after appointments contract
TASK-B2 (follow-up)
TASK-C1 (doc gate) ── parallel
TASK-C3 ← 172
TASK-D1 ── ongoing ops, parallel
TASK-E2, E3 ── parallel P2
TASK-F* ── after A–D
```

**Parallelizable immediately:** E1, C2, A1, A3, A6, C1, D1.

---

## 26. Production Readiness Checklist

| Area | Status | Remaining |
|---|---|---|
| FE core IPD | Ready | A3, A5, A6, B*, GS1 UX |
| BE clinical FSM | Ready | mismatch, vitals, follow-up gate |
| DB 156–167 | Applied in repo | 168–173 not applied |
| RBAC | SQL ready | Seeder parity |
| Integrations | Charge+CCMS live | Doc gate, HL7 later |
| Realtime | Hub + poll | KEEP |
| Audit | Strong | Intra-op |
| Security | Fail-closed prod | Internal key rotation (ops) |
| Performance | Paged journeys | KPI fallback |
| Observability | S-16 | — |
| Data migration | n/a for new empty tables | — |
| Rollback | feature-flag safety gates | — |
| UAT | existing catalog | add A/B scenarios |
| Deployment | standard | run 168+ with verify scripts |

---

## 27. Final Gap Summary

| Requirement | Current | Gap | Target | Change | Pri | Owner | Dependency |
|---|---|---|---|---|---|---|---|
| IOL power/model guard | Eye only | Planned power ignored | Block + override | EXTEND | P0 | IP | A1 optional |
| GS1/UDI parse | Length check | No AI parse | Parse into registry | EXTEND | P0 | IP | — |
| Wristband | Missing | No token | Printable identity | CREATE | P0 | IP | 168 |
| Vitals gate | Capture | No threshold | Warn/block | EXTEND | P0 | IP | 169 |
| Dilation timer | Med log | No countdown | Footer timer | EXTEND | P0 | FE | med log |
| Visual bed map | List | No map | Occupancy strip | CREATE UI | P1 | FE | beds API |
| Taper matrix | Free text | Unstructured | Steps | CREATE | P1 | IP | 170 |
| Follow-up lock | Date | No slot | Appointment FK | EXTEND | P1 | IP+Auth | appt API |
| Pre-auth docs | FE | No server gate | Fail closed | EXTEND | P1 | CCMS | master data |
| Ops preauth queue | Wrong filter | Empty queue | Correct status | MODIFY | P1 | CCMS | — |
| OPD field copy | Hints | Incomplete | Onboard mapping | EXTEND | P1 | IP | finalize |
| Insurer tariffs | Branch+gov | No payer price book | If contracts need | EXTEND | P2 | Auth | legal |
| Claim-query FSM | Bypass | Drift | FireAsync | MODIFY | P2 | CCMS | 172 |
| Consignment | Enum | No flow | Inventory | EXTEND | P2 | Inv | — |
| PermissionSeeder | Incomplete | Env drift | Parity with 156 | MODIFY | P0 | Auth | — |
| Intra-op audit | Thin | No log | Audit row | EXTEND | P2 | IP | — |
| addBilling API | Deprecated | Still callable | 410 | DEPRECATE | P2 | IP | UAT |
| KPI fallback | balanceDue | Two numbers | Ledger or error | MODIFY | P1 | FE | — |
| HL7/PACS | Missing | No ADT/DICOM net | Adapter | CREATE | P3 | Int | F |
| New clinical states | — | FRD wording | **Do not add** | KEEP machine | P0 | All | — |

---

## 28. Final Recommendation

### What should NOT be changed

- Ownership: IP clinical, Billing money, CCMS coverage, Auth beds, Inventory stock, Auth hub, existing outboxes.
- `StateTransitionValidator` 9-state (+ reverse/rebook) machine. No `Pre-Op Pending` / `Ready for OT` columns.
- Four Mark Ready hard blocks (consent, laterality, PAC, critical labs).
- `OpdBill` append-only ledger, package explosion when mapped, `CollectPaymentDrawer`.
- Pre-op workspace, census split pane, slot board, implant registry, charge-mapping, reconciliation, integration-health, CCMS FSM.
- Identity-only SignalR payloads.

### What must be changed immediately (P0)

1. IOL planned power/model mismatch guard.  
2. GS1-128 parser on existing verify/record path.  
3. Dilation countdown from existing `administered_at`.  
4. Vitals threshold on existing `vital_sign`.  
5. Wristband/token.  
6. `PermissionSeeder` parity with SQL 156.  
7. Fix CCMS ops pre-auth queue filter.

### What can be reused

Every S-01–S-18 surface, counsellor desk, CCMS workspace, `BedLifecyclePolicy`, `ImplantChargeHandler`, `CoverageAllocationEngine`, `NotificationHub`.

### What must be newly created

- `WardBedMap` component (no new route).  
- `journey_safety_token` + print UI.  
- `ip_vital_threshold`.  
- `post_op_taper_step` + S-08 panel.  
- GS1 parser class.  
- Follow-up appointment link + gate.  
- Two/three permission codes.

### What should be deprecated

- Browser use of `POST /ip-management/journeys/{id}/billing` (UI already retired).  
- Dual IOL documentation: prefer `journey_implant_usage` over free-text `intra_op_note.ImplantUsed` and journey `IolBarcode` flags (keep as compatibility, stop treating as SoT).  
- `useWardRealtime` dead hook — remove in a cleanup PR.  
- Target-architecture §1.2 as an implementation backlog (superseded by this document).

### Safest sequence

Phase A (safety on existing OT/pre-op/admit) → Phase B (discharge completeness) → Phase C (CCMS hygiene) → Phase D (catalog ops) → Phase E (seeder/deprecations) → Phase F (HL7/PACS/consignment).

### Minimum set for a complete real-time ophthalmic IPD workflow

**Already present:** counsel → coverage case → Expected → slot → admit → pre-op gates → mark ready → OT → implant registry → async charge → pay from census → obligation discharge → claim/settlement.

**Minimum add:** A1–A5 + B2 (follow-up) + C2 (queue) + E1 (seeder). Bed map, taper, PACS, consignment, HL7 are **not** required for a correct money+clinical loop.

### Assumptions requiring confirmation before coding

1. Should dilation **warn** or **hard-block** Mark Ready? Default: **warn**.  
2. Vitals: default `severity=warn` vs `block`? Default: **warn**.  
3. Follow-up lock: which appointment service/table is authoritative (**REQUIRES CODEBASE VERIFICATION** of Auth appointments schema).  
4. Wristband barcode symbology (Code128 vs QR) and whether laterality is printed.  
5. Numeric tolerance for IOL power mismatch (0.00 vs 0.50 D).  
6. Whether `PermissionSeeder` still runs in production or SQL 156 is the only path.  
7. Column names for `permissions` INSERT in 171 — copy 156 exactly.  
8. Post-op EF table name for `followup_appointment_id`.

---

*Companion visual: Cursor canvas `ip-frd-codebase-crosscheck.canvas.tsx`. Ownership SoT unchanged.*
