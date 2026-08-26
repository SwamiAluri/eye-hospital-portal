# IP Management + Ward + OT + IP Billing + Coverage & Claims — Target Architecture, Gap Analysis and Implementation Roadmap

**Status:** Analysis and design only. **No code changed by this document.**
**Companion to:** `apps/hospital-portal-web/docs/ip-billing-ward-cross-module-sot.md` (ownership SoT — still authoritative and **not** overturned by this document).
**Scope:** `microservices/ip-management-service`, `microservices/auth-service` (Billing + Beds + Notifications), `microservices/ccms-service`, `microservices/inventory-service`, `apps/hospital-portal-web`.
**Context:** Eye hospital, high-volume day-care ophthalmic surgery.
**Design deliverable:** §20.4–§20.7 contain the complete screen-by-screen design — 18 surfaces with wireframes, zone specifications, and a per-element map to API → backend service → database table → owning module → permission → event.
**Visual mockups:** `apps/hospital-portal-web/docs/mockups/ip-target/index.html` — static HTML rendering of all 18 screens with the same maps. Every sub-view is drawn, not described: each step of a workspace, each tab of a detail page, each persona variant, each dialog, each record-creation flow with its resulting history, and each loading, empty, error, conflict and permission state — 225 views in total. The index page carries a coverage checklist listing them per screen. No build step; open the file directly. Nothing in that folder is imported by the application.

**Conventions:** `mockups/ip-target/conventions.html` is the companion every screen depends on. It fixes three things globally: (1) any record a user can create carries an **Add control and a visible history** of what was already added, with correction rules per record type; (2) **no status codes, exception names or service names reach the user interface** — technical detail sits behind one opt-in "Details for IT" line carrying the correlation id; (3) it contains the **verified endpoint, table and permission inventory** read from `ip-management-service` and `auth-service`, so every map in §20.6 resolves to something that exists or is explicitly marked as work to build.

**Corrections to earlier drafts, from reading the source.** `ip.billing.collect` does not exist — collection is gated by `bill.update`. There is **no `RowVersion` or any concurrency token** on `OpdBill`, `OpdBillPayment`, `Refund` or `OpdBillItem`, so the concurrent-cashier protection described in §14 is work to build rather than existing behaviour; the idempotency keys on payments are real. The ward assignment route is `PUT /api/ip-management/journeys/{id}/ward`, and bed history reads from `GET .../bed-assignments`. Receipts are `RCP-{yyyyMMdd}-{seq:D8}`. `journey_implant_usage`, the charge reconciliation service, the slot board and the outbox dead-letter endpoints do not exist in any form today. Most consequentially, **`journey_audit_log` is written only for journey lifecycle actions plus pre-op approval and clinical-evaluation amendment** — vitals, medications, PAC, checklists, investigations and WHO safety sign-offs produce no audit row at all.

---

## 1. Executive Summary

### 1.1 Verdict on the existing architecture

The domain boundaries defined in the SoT document are **correct and, in the backend, largely implemented correctly**. This analysis found no reason to invert ownership:

- IP Management owns clinical/operational state (`PatientJourney`, `StateTransitionValidator`, `ChecklistGateService`).
- Auth `OpdBill` + append-only `opd_bill_payments` is a genuinely well-built financial ledger (append-only lines, derived header projections, idempotency keys, transactional outbox to CCMS).
- CCMS owns coverage/claims with a DB-seeded workflow FSM and an idempotency guard.
- Auth owns bed inventory with a real `BedLifecyclePolicy` FSM.

**Do not rewrite these.** The problems are at the seams, in RBAC provisioning, in the OT→charge path, and in the frontend.

### 1.2 The eight findings that matter

| # | Finding | Severity | Owner |
|---|---|---|---|
| F1 | Almost every IP and billing permission code enforced in code is **never seeded into the `permissions` table**. Granular RBAC silently collapses onto `ward.checklist.edit` / `ot.safety.sign`. | **P0** | Auth |
| F2 | Frontend **fails open** when the JWT permission claim is empty (`ip-role-actions.operational()`, `canBill`, `resolveBillingDashboardAccess` → `'full'`). | **P0** | FE |
| F3 | Every IP surface deep-links to `/dashboard/billing/opd?billId=…&journeyId=…`, but that page **never reads search params**. The cashier journey from IP is a dead end — which is exactly why billing buttons keep multiplying inside the IP panel. | **P0** | FE |
| F4 | **Dual money write path** still live in the UI: `PatientQuickPanel` and the journey billing tab call `ipManagementApi.addBilling` (a *projection*), bypassing receipt numbering, idempotency, refund/reversal rules and the CCMS outbox. | **P0** | IP + FE |
| F5 | **No charge capture from OT.** `inv_surgery_consumables` records IOL/consumable usage against `surgery_id`, but there is **no path to `opd_bill_items`**. IOL and consumable revenue leakage is structural, not accidental. | **P0** | Billing + Inventory |
| F6 | **Implant/IOL data is scattered across five stores** with no single per-patient implant usage record: `iol_catalog_master` (IP, read-only), `iol_inventory` + `iol_stock_adjustments` (Auth), `inv_item_master`/`inv_purchase_items` (Inventory), `patient_journey.Iol*`, `iol_returns` + `intra_op_note.ImplantUsed` (IP). | **P0** | Cross-module |
| F7 | Mark Ready for OT has **no preflight in the census** (user clicks and receives a raw server exception), **no outbox event**, and **no reverse transition** when a patient becomes ineligible. | **P1** | IP |
| F8 | No **day-care batch/slot** model, no **recliner/chair** bed type, and `bed_inventory` links to wards by **string name** rather than FK. For a high-flow eye hospital this is the main throughput blocker. | **P1** | IP + Auth |

### 1.3 Answers to the six explicit decisions in the brief

| Requirement | Decision after analysis |
|---|---|
| **IP is an operational/clinical app** | Confirmed. Reinforce it: IP stops *writing* money entirely (retire the `addBilling` UI path), and *displays* Billing/CCMS reads. |
| **Complete billing lifecycle via integration** | Achievable without moving ownership. Two things are genuinely missing: (a) itemised charge capture from OT/inventory, (b) a working navigational handoff to the cashier screen. |
| **Mark Ready for OT in one click** | Supported and recommended — but with a **preflight gate call** so the button is pre-disabled with reasons, not one-click-then-error. Keep all four hard blocks; add a permitted **Revert to Admitted** action. |
| **Cashiers on the IP screen** | Yes — via a **persona-scoped census layout** (`resolveIpPersona`), not a separate page. Cashier sees money + identity + location; clinical actions hidden. Money is collected against **Billing APIs**, never `addBilling`. |
| **Overlay vs split pane** | **Persona-specific.** Census (nurse/coordinator/cashier) = **non-blocking docked split pane**. High-risk multi-step clinical work (pre-op workspace, post-op, discharge) = **full-screen modal** (existing, correct). Cashier collection = **focused drawer over the split pane**. Retire the blur-backdrop overlay on the census. |
| **Inline advance/payment** | Keep it **inline in the UI**, move it **out of IP in the domain**. The cashier drawer posts to `POST /api/OpdBills/payment` with an idempotency key and prints the Billing receipt number. Per decision D3 it can also create the bill first via a new authorised route. `ipManagementApi.addBilling` is deprecated for UI use. |

### 1.5 Product decisions confirmed (detail in §26)

| # | Decision | Main consequence |
|---|---|---|
| D1 | Packages post **fully exploded component lines** plus a package discount line | Enables line-level CCMS allocation; requires catalog mapping (MD-055) |
| D2 | Opened-but-unimplanted IOLs are a **hospital write-off**, not a patient charge | Billing charges only on `usageStatus == 'Implanted'`; wastage needs its own report |
| D3 | Cashiers may **create** the IP bill as well as collect against it | Cashier bundle gains `bill.create`; needs a JWT-authorised route (BILL-033) |
| D4 | Consumables are **charged individually** | 15–25 line bills; requires grouped rendering and a double-charge guard |

### 1.4 What must not change

- `OpdBill` as the ledger; append-only `opd_bill_payments`; derived header totals.
- CCMS workflow FSM seeded in `108_ccms_workflow_seed.sql` and the `IntegrationIdempotencyGuard`.
- `BedLifecyclePolicy` and `InternalIpBedController`.
- Auth `NotificationHub` as the only SignalR stack; identity-only realtime payloads (`BillingRealtimeEvents`).
- Both outboxes (`integration_outbox_event`, `billing_ccms_outbox`) with 8-retry → `Dead`.
- `IpFinancialFieldClassification` on both sides.
- The full-screen pre-op workspace: it already has `role="dialog"`, `aria-modal`, focus trap, Escape and e2e a11y coverage. It is the best UI in the module and should be the pattern others copy.

---

## 2. Existing Architecture Understanding

### 2.1 Service topology

| Service | Host style | Responsibility | DB |
|---|---|---|---|
| `auth-service` | ASP.NET Core MVC | Auth/RBAC, **Billing (`OpdBill`)**, **bed inventory**, `NotificationHub`, counselling packages, `iol_inventory`, service catalog | Shared Postgres |
| `ip-management-service` | **Azure Functions** (~120 routes, 18 function files) | `PatientJourney` lifecycle, pre-op, ward, OT documentation, post-op, discharge, checklist gates, integration outbox | Same shared Postgres |
| `ccms-service` | **Azure Functions** (~100 routes) | Coverage, eligibility, pre-auth, claims, settlement; generic workflow FSM | Own schema in Postgres |
| `inventory-service` | **Azure Functions** | Item master, batches, GRN, procure-to-pay, `inv_surgery_consumables` (OT issue) | Own tables, RLS |
| `notification-service` | — | Secondary; `NotificationHub` in Auth is the one in use | — |
| `hospital-portal-web` | Next.js App Router | All UI | — |

### 2.2 Cross-service contracts in place today

```
IP ──X-Internal-Key──> Auth  /api/internal/ip-billing/{ensure-bill,summary,payment,reverse,apply-coverage-allocation}
IP ──X-Internal-Key──> Auth  /api/internal/ip-beds/{lifecycle,list}
IP ──X-Internal-Key──> Auth  /api/notifications/internal/{push-dept,push-user,push-tenant}
IP ──X-Internal-Key──> Auth  /api/internal/ot-sync/{surgery-done,release-for-rebook}
IP ──outbox──────────> CCMS  JourneyAdmitted, SurgeryCompleted, PatientClinicallyDischarged, EmergencyFcApplied
IP ──sync HTTP───────> CCMS  /ccms/integration/validate-admission  (fail-closed on coverage)
Billing ──outbox─────> CCMS  BillFinalized, PaymentReceived, PaymentReversed, PatientObligationChanged
CCMS ────────────────> Auth  /api/internal/ip-billing/apply-coverage-allocation, /claim-status-changed
CCMS ────────────────> IP    /api/ip/ccms-callback (COVERAGE_APPROVED, SETTLEMENT_RECEIVED)
Inventory ───────────> (nothing)          ← F5: the missing edge
```

### 2.3 Structural observations

1. **IP has no EF `Migrations/` folder.** Schema lives in `IpManagementDbContext` + `consolidated/migrations/*.sql`. Only the outbox self-bootstraps (`IntegrationOutboxService.EnsureSchemaAsync`). Drift risk is real and unguarded.
2. **`billing_ccms_outbox` is also created at runtime** (`EnsureSchemaAsync`), not by EF migration.
3. **Optimistic concurrency exists on `patient_journey.updated_at`** but **not** on `opd_bills`, `opd_bill_payments` or `bed_inventory`.
4. **Dual auth layers in IP**: HTTP-level `IpChecklistAuth` plus service-level `JourneyCommandAuthContext`. Background/UAT callers can arrive unbound.

---

## 3. Current IP Management Workflow

### 3.1 Clinical state machine as implemented

```
Expected → Admitted → ReadyForSurgery → SentToOT → InOT → SurgeryCompleted → PostOp
        → ReadyForDischarge → Discharged
SentToOT → ReadyForSurgery        (OT return)
InOT     → ReadyForSurgery        (OT return)
Discharged → ReadyForDischarge    (discharge reversal)
CancelledSurgery → Expected       (rebook)
AdmissionCancelled → (terminal)
```
Source: `StateTransitionValidator.ClinicalAllowed`. `OtState`: `NotSent → SentToOT → Accepted → InProgress → Completed`. `FinancialState`: `NotCreated → Draft → Estimated → Confirmed → PartiallyPaid`, with `Paid`/`Settled` unreachable from IP by design.

### 3.2 Mark Ready for OT — current behaviour (traced)

`POST /ip-management/journeys/{id}/clinical-transition` with `newState: "ReadyForSurgery"`.

1. Permission: `ip.ot.mark_ready` **or** `ward.checklist.edit` (`IpChecklistAuth`), re-checked in `JourneyCommandAuthContext`.
2. `MutationGuard` (merged MR / lock), then `expectedUpdatedAt` concurrency check.
3. `StateTransitionValidator.ValidateClinical(Admitted → ReadyForSurgery)`.
4. `ChecklistGateService.AddMarkReadyHardBlocksAsync` — **four hard blocks, all severity `block`**:

| Code | Meaning |
|---|---|
| `critical_labs_unverified` | Critical investigations not ward-verified |
| `surgical_consent_unsigned` | Consent completion row exists but unsigned |
| `laterality_not_attested` | Site marking missing or eye mismatch vs `EyeOperated` |
| `pac_incomplete` | PAC assessment not complete |

5. **No financial gate, no coverage gate at Mark Ready.** Financial warnings are at **Admit**; the billing hard gate is at **OT Accept** (`SurgicalSafetyService.ValidateBillingGateForAcceptAsync`).
6. `acknowledgeWarnings` **cannot** bypass these — they are blocks, not warnings.
7. Side effects: `WardChecklistAutoSyncService` auto-completes `informed_ot_team`; `journey_audit_log` row `ClinicalStateChanged`; fire-and-forget dept notification to OT + ward; `WardJourneyChanged` SignalR.
8. **No outbox event.** **No reverse transition** to `Admitted`.

**Assessment:** the *rules* are correct and clinically defensible (they map well to RCOphth/GIRFT never-event prevention: consent, laterality, PAC, critical results). The *interaction* is wrong on the census — see §10.

### 3.3 Two competing entry points

| Surface | Route | Fetch | Mark Ready UX |
|---|---|---|---|
| IP census | `/dashboard/ip-management` | react-query + SignalR invalidation | Blind one-click in `PatientQuickPanel`, `acknowledgeWarnings: true`, error surfaced as raw string |
| Ward board | `/dashboard/ip-management/ward` | manual `useState` + 45 s poll + `useWardRealtime` | Full pre-op workspace with `PreOpMarkReadyFooter` showing hard blocks and "Open step" links |

The ward implementation is the correct model; the census needs the same *information*, not the same *number of screens*.

---

## 4. Current Billing Workflow

### 4.1 What is strong

- `opd_bill_payments` is **append-only** with `payment_kind ∈ {Payment, Advance, Discount, Refund, Reversal}` and `reversed_payment_id`.
- Header `amount_paid` / `balance_due` / status are **projections** recomputed by `OpdBillLedgerCalculator` — no drifting totals.
- **Idempotency:** unique filtered index `ux_opd_bill_payments_idempotency (tenant_id, idempotency_key)`; refund completion key `refund:{id}`; one-reversal-per-payment guard.
- **One IP bill per journey:** unique `ux_opd_bills_patient_journey`.
- **Transactional outbox** `billing_ccms_outbox` enqueued in the same `SaveChangesAsync`, drained every 5 s, 8 retries → `Dead`.
- Finalized bills reject further payments/discounts/reversals; lock/unlock requires a reason and is audited.

### 4.2 What is missing

| Gap | Detail |
|---|---|
| **Charge capture** | `EnsureInpatientBillAsync` writes a **single `gross_amount` from `PackageAmount`**. No line items are posted for the package, IOL, consumables, room, or procedure. `BillItemService` exists and is catalog-driven but is only reachable by manual UI entry. |
| **Package model on the bill** | `CounsellingPackageTemplate` / `MasterDataService.CalculatePackageCostAsync` compute a package price at counselling time; nothing explodes that into `opd_bill_items` with inclusions/exclusions/upgrade lines. |
| **Tax** | `BillItemService` hardcodes tax `0` ("No tax in V2 catalog"). |
| **Concurrency** | No `RowVersion` on `OpdBill`. Two cashiers finalising/discounting concurrently is last-write-wins on the header (ledger lines are safe). |
| **Permission seeding** | `bill.create`, `bill.update`, `bill.view`, `opd_bill.refund`, `opd_bill.view`, `opd_bill.refund.authorize` appear only in C# — no SQL seed found. |
| **Billing rules CRUD** | `/api/OpdBills/rules*` has **no `[RequirePermission]`**. |

---

## 5. Current Coverage & Claims Workflow

CCMS is the most complete state machine in the system: 30 states, DB-seeded transitions, `WorkflowEngine.FireAsync` matching `(from_state_id, trigger_event)`, and `WorkflowTransitionPolicy` blocking raw operational triggers without `ccms.workflow.admin`.

**Money split** is computed by `CoverageAllocationEngine`:
```
disallowed        = excluded line items
coveredByInsurance= min(payable, approvedLimit)
copay             = covered × copay%
effectiveCovered  = covered − copay − deductible
patientShare      = payable − effectiveCovered + excludedTotal
```
Stored in `ccms_billing_summaries` / `ccms_coverage_allocations`, projected by `CoverageShareProjection`, pushed to Billing via `apply-coverage-allocation`.

**Gaps:**
- `payment-received`, `payment-reversed`, `patient-obligation-changed`, `claim-status-changed` are **ack-only** — logged, not applied. Settlement reconciliation against actual collections is therefore manual.
- Allocation is per **line item**, but IP bills currently have **no line items** (F5). So coverage allocation for IP is effectively header-level only.
- Most CCMS Functions are JWT-only; only pre-auth/claims/enhancement/clarification routes have granular permissions.

---

## 6. Current OT Workflow

| Step | Endpoint | Gate |
|---|---|---|
| Send to OT | `clinical-transition → SentToOT` | med-log warning |
| Accept in OT | `POST /journeys/{id}/accept` | **billing gate** (`SurgicalSafetyService.ValidateBillingGateForAcceptAsync`: Emergency FC, privileged override, or linked `OpdBillId`); before-anaesthesia checklist is warn-only |
| Start surgery | `POST /journeys/{id}/start-surgery` | WHO checklist |
| Complete surgery | `clinical-transition → SurgeryCompleted` | emits **`SurgeryCompleted`** outbox → CCMS |
| Intra-op | `GET/POST /journeys/{id}/intra-op`, `/sign` | `ImplantUsed`, `ImplantPower` free text |
| IOL verify | `POST /journeys/{id}/verify-iol-barcode` | sets `IolBarcodeVerified`, `IolBarcode` |
| IOL return | `/journeys/{id}/iol-returns` | post-op unused IOL |

**The critical break:** `verify-iol-barcode` and `intra_op_note.ImplantUsed` are **documentation only**. They do not decrement `inv_stock_batches`, do not create an implant registry row, and do not create a bill line. Meanwhile `inv_surgery_consumables` (inventory) records the same event from the other side keyed on `surgery_id`, with `Amount` computed at **purchase rate** — a cost figure, not a charge.

This is the single largest revenue-integrity gap and it matches the external evidence in §17.

---

## 7. Persona Analysis

Personas are derived from `PermissionSeeder`, `IpChecklistAuth`, `ip-role-actions.ts`, `billing-dashboard-access.ts`, and the seeded departments (`IPD_BILLING`, `CASHIER`, `ACCOUNTS`).

| Persona | Primary goal | Primary screen | Must see | Must NOT see | Key actions |
|---|---|---|---|---|---|
| **Ward nurse** | Get today's list ready for OT safely | Ward board + pre-op workspace | Readiness, blockers, vitals, consent, PAC, laterality | Ledger detail, payer contracts, refunds | Admit, pre-op steps, Mark Ready, transfer bed, post-op |
| **Ward clerk** | Beds, attendants, documents | Ward board | Bed/ward, admission type, documents | Clinical assessments, money | Bed transfer, attendant details |
| **IP coordinator** | Census throughput, exceptions | **IP census (split pane)** | Location, next action + owner, all three blocker classes, batch/slot | Full ledger; itemised charges | Mark Ready, chase blockers, escalate |
| **OT coordinator** | List order, turnover, safety | OT board | OT state, WHO, surgeon/theatre, implant availability | Ledger | Accept, start, complete, return |
| **Surgeon** | Right patient, right eye, right IOL | OT board + intra-op | Laterality, biometry/IOL plan, consent | Refunds, payer contracts | Sign CE amend, intra-op note, implant scan |
| **Cashier** | Collect, receipt, clear | **IP census (cashier layout)** + `/billing/opd` | Bill status, patient due, advance, receipts, FC status, pending financial actions | Clinical notes, PAC, WHO, consent content | Collect advance/payment, print receipt |
| **Billing executive** | Correct, complete bill | `/billing/opd` + IP billing dashboard | Line items, package, IOL/consumables, discounts | Clinical documentation detail | Add/edit items, discount, finalize |
| **Insurance/TPA executive** | Pre-auth, claims, settlement | CCMS workspace | Coverage, limits, approvals, denials | Cash drawer operations | Pre-auth, claim, settlement |
| **Finance user** | AR, aging, reconciliation | IP billing dashboard (`finance` scope) | Aging, payer mix, refunds/adjustments | Clinical | Reports, reconciliation |
| **Inventory/pharmacy** | Stock, batch, expiry, implants | Inventory module | Reservations, consumption, returns | Patient clinical record | Issue, return, reconcile |
| **Administrator** | Config, RBAC, overrides | Admin | Everything, audited | — | Emergency FC, discharge override, unlock |

**Persona gap:** the codebase has a `CASHIER` **department** but **no cashier permission bundle and no cashier UI scope in IP**. `resolveBillingDashboardAccess` maps the role string `cashier` to `'full'` finance visibility — arguably too much (a cashier does not need payer contract economics) and it is role-string based rather than permission based.

---

## 8. Domain Ownership Analysis

### 8.1 Ownership matrix (target — confirms SoT, adds the missing rows)

| Concern | Owner (SoT) | Initiated by | Stored in | Consumed by | Verdict |
|---|---|---|---|---|---|
| Admission lifecycle | IP | Ward/coordinator | `patient_journey` | Billing, CCMS, OT | Correct today |
| Patient location / bed | **Auth beds** (occupancy) + IP (`assigned_bed_id`, history) | Ward | `bed_inventory`, `journey_bed_assignment` | Census, ward | Correct today |
| Pre-op readiness | IP | Nurse/anaesthetist | pre-op clearance chain | Mark Ready gate | Correct today |
| OT scheduling / state | IP + Auth OT sync | OT coordinator | `patient_journey`, OT schedule | Ward, census | Correct today |
| **Implant/IOL usage (clinical truth)** | **IP** | Surgeon/OT nurse (scan) | **NEW `journey_implant_usage`** | Inventory, Billing, CCMS, recall | **Missing** |
| **Implant/IOL stock** | **Inventory** | Store/OT | `inv_stock_batches`, `inv_purchase_items` | IP reservation | Partially present |
| **Consumable usage** | **Inventory** (`inv_surgery_consumables`) | OT nurse | inventory tables | Billing | Present, unconnected |
| **Charge capture (charge items)** | **Billing** | Events from IP/Inventory | **`opd_bill_items`** | CCMS allocation, claim | **Missing for IP** |
| Package definition & pricing | Auth (counselling/master) | Counsellor | `counsellor_packages`, templates | Billing explode | Present, not exploded |
| Advances/payments/receipts/refunds | **Billing** | Cashier | `opd_bill_payments` | IP display, CCMS | Correct today |
| Financial clearance decision | **Billing data + IP policy** | System | derived | Gates | Correct today |
| Coverage/pre-auth/claims/settlement | **CCMS** | TPA executive | `ccms_*` | Billing allocation, IP display | Correct today |
| Realtime | Auth `NotificationHub` | All | — | All | Correct today |
| Cross-module events | Both outboxes | All | outbox tables | All | Correct; needs 2 new events |

### 8.2 Ownership violations found

| Violation | Evidence | Fix |
|---|---|---|
| IP writes money from the UI | `PatientQuickPanel.AddTransactionForm` → `ipManagementApi.addBilling`; journey `[id]` billing tab `handleAddTransaction` | Retire from UI; cashier drawer calls Billing |
| Cost masquerading as charge | `inv_surgery_consumables.Amount` = qty × **purchase rate** | Charge price must come from service catalog / `variant_prices` in Billing |
| Coverage economics leaking into a clinical screen | `PatientQuickPanel` renders payer share + block reason without a permission scope | Persona-scoped rail |
| Role-string RBAC | `billing-dashboard-access.ts` matches role names | Move to permission codes with role names as fallback |

### 8.3 Unnecessary coupling

- `PatientQuickPanel` calls three APIs on open (`getJourneyAudit`, `getFinancialSummary`, `getPreauthStatus`) for **every row click**, none cached in react-query — N+1 on a 155-row census.
- `PatientJourney` carries `TotalAdvances`, `TotalPaid`, `PackageAmount`, `BalanceDue` (DB-generated) as compat projections. Keep for backward compatibility, but the UI must read `getFinancialSummary` (already the case in the panel; **not** the case in the census table, which uses `j.balanceDue` for KPIs and the financial filter).

---

## 9. End-to-End Target Workflow

Ownership per step. **Bold = change required.**

| # | Step | Owner | Initiator | Authoritative store | Event out | On failure |
|---|---|---|---|---|---|---|
| 1 | Registration | Auth patient | Front office | `patient` | — | — |
| 2 | Counselling estimate / package selection | Auth counselling | Counsellor | `counsellor_packages` | `counselling-completed` → CCMS | retry |
| 3 | Coverage case creation | CCMS | Auto from (2) | `ccms_coverage_cases` | — | idempotent |
| 4 | Eligibility + policy capture + pre-auth | CCMS | TPA exec | `ccms_*` | — | manual |
| 5 | Expected journey onboarded | IP | Scheduler | `patient_journey` | — | — |
| 6 | **Batch/slot assignment** | **IP** | **Coordinator** | **NEW `journey_slot`** | **`JourneyScheduled`** | warn |
| 7 | Admission (validate coverage sync, fail-closed) | IP | Ward | `patient_journey` | `JourneyAdmitted` → CCMS | compensate bed |
| 8 | Bed/recliner occupy | Auth beds | IP | `bed_inventory`, `journey_bed_assignment` | — | compensate admit |
| 9 | **Ensure IP bill + explode package into line items** | **Billing** | **IP `ensure-bill`** | **`opd_bills` + `opd_bill_items`** | `BillCreated` | retry; bill exists guard |
| 10 | Pre-op readiness | IP | Nurse | pre-op chain | — | — |
| 11 | **Mark Ready (preflighted, one click)** | IP | Nurse/coordinator | `patient_journey` | **`JourneyReadyForOt`** | blocked with reasons |
| 12 | Send to OT → Accept → Start | IP | Ward/OT | `patient_journey` | realtime | billing gate at Accept |
| 13 | **Implant scan in OT** | **IP (clinical) → Inventory (stock) → Billing (charge)** | **Surgeon/OT nurse** | **`journey_implant_usage`** + `inv_stock_ledger` + `opd_bill_items` | **`ImplantUsed`** | queued, reconcilable |
| 14 | **Consumable confirmation in OT** | **Inventory → Billing** | OT nurse | `inv_surgery_consumables` + `opd_bill_items` | **`ConsumablesConsumed`** | queued |
| 15 | Surgery completed | IP | OT | `patient_journey` | `SurgeryCompleted` → CCMS | retry |
| 16 | Recovery / post-op | IP | Nurse | post-op tables | realtime | — |
| 17 | Advances / payments | **Billing** | **Cashier (from IP census)** | `opd_bill_payments` | `PaymentReceived` → CCMS | idempotency key |
| 18 | Coverage allocation | CCMS → Billing | CCMS | `ccms_billing_summaries` → `insurance_claim_amount` | `PatientObligationChanged` | retry |
| 19 | Discharge clearance | IP policy over Billing/CCMS data | Ward | derived | — | override audited |
| 20 | Clinical discharge | IP | Ward | `patient_journey` | `PatientClinicallyDischarged` | retry |
| 21 | Final bill + finalize | Billing | Billing exec | `opd_bills` | `BillFinalized` → CCMS | retry |
| 22 | Claim packet + submit | CCMS | TPA exec | `ccms_claim_packets` | — | manual |
| 23 | **Settlement + reconciliation against collections** | **CCMS + Billing** | TPA exec / finance | `ccms_settlements` | **apply, not ack-only** | reconciliation report |

---

## 10. UI/UX Gap Analysis

> This section states what is wrong today. The corresponding **screen-by-screen target design — wireframes plus API/BE/DB/module/permission mapping for all 18 surfaces — is §20.4 to §20.7.** Each problem below is resolved by a named screen (S-nn) there.

### 10.1 IP Census — `/dashboard/ip-management`

**Current behaviour.** 9-column table, 9 clinical tabs, a financial `<select>`, 4 KPI cards computed client-side from `j.balanceDue` (a projection, not the ledger). Row click opens `PatientQuickPanel`: a 380 px fixed panel over a `bg-black/30 backdrop-blur` full-screen backdrop.

**Problems (evidence-based):**

| # | Problem | Evidence |
|---|---|---|
| U1 | Backdrop blur hides the census; the coordinator loses the list they were working | `PatientQuickPanel.tsx` backdrop `fixed inset-0 z-40` |
| U2 | **No `role="dialog"`, no `aria-modal`, no focus trap, no Escape** — the only IP overlay with none of these | vs `WardPatientDrawer` which has all four |
| U3 | `MiniStepper` shows 5 steps but the machine has 9 states; `ReadyForSurgery`, `SentToOT`, `PostOp`, `ReadyForDischarge` are invisible — the control misrepresents state | `STEPS` vs `STATE_ORDER` |
| U4 | 9 px labels (`text-[9px]`), 10 px section headings on care-critical data | fails WCAG-adjacent clinical legibility |
| U5 | Question headings ("What is owed?", "What can I do?") and internal jargon (`server: bill.update / ip.billing.collect`, `Billing owns the invoice (OpdBill)`) in a nurse-facing screen | panel body |
| U6 | **Four** competing billing CTAs: Open Billing, Open/Create IP Bill, Refund, Financial adjustment + sticky Open Billing Tab | panel actions |
| U7 | All actions are equal-weight pastel cards — no primary/secondary/destructive hierarchy | panel actions |
| U8 | Blind Mark Ready: `runClinicalAction()` sends `acknowledgeWarnings: true` with no preflight; hard blocks return as a raw exception string | `PatientQuickPanel.runClinicalAction` |
| U9 | Inline `AddTransactionForm` writes to the projection path | F4 |
| U10 | Every row click fires 3 uncached requests | panel `useEffect` |
| U11 | No persona scoping: nurse, coordinator and cashier see one layout | — |
| U12 | No URL state — refresh loses selection; no keyboard row navigation | `useState` only |
| U13 | KPI "Outstanding Dues" sums `j.balanceDue` (journey projection) while the billing dashboard reads the ledger — two numbers, same label | `page.tsx` `kpiStats` |

### 10.2 Other surfaces

| Surface | Verdict |
|---|---|
| **Ward pre-op workspace** | **Best in module.** Keep. 8-step nav, hard-block footer with "Open step", full a11y, e2e covered. Use as the design reference. |
| Ward board | Correct interaction model; **inconsistent data layer** (manual fetch + poll while census uses react-query) and its inline modals lack dialog semantics |
| `WardPostOpWorkspaceModal`, `JourneyModal`, ward inline modals, OT inline modals | No `role="dialog"` / `aria-modal` / focus trap / Escape |
| OT board | Functionally rich; uses `react-hot-toast` while OPD billing uses `sonner` — two toast systems |
| IP billing dashboard | Correct: reads the ledger, role-scoped columns. Only issue is `resolveBillingDashboardAccess` fail-open + role-string matching |
| `/dashboard/billing/opd` | **Ignores `billId` / `patientId` / `journeyId` query params** (F3). Uses Radix `Dialog` — the primitive the rest of IP should adopt |
| Design system | `src/components/ui` has Radix `dialog`, `alert-dialog`, **`sheet`** — and IP uses **none of them**, hand-rolling `fixed inset-0` panels instead |

---

## 11. Backend / API Gap Analysis

| # | Gap | Current | Required |
|---|---|---|---|
| B1 | Mark Ready preflight not used by census | `GET /journeys/{id}/transition-gates?newState=` exists | Census calls it on row select (or batch-preflights the visible page) |
| B2 | No `JourneyReadyForOt` outbox event | notification only | Add outbox event for OT board + analytics + CCMS timing |
| B3 | No revert from `ReadyForSurgery` | forward-only | Add `ReadyForSurgery → Admitted` with reason + permission `ip.ot.unmark_ready` |
| B4 | No implant usage API | `verify-iol-barcode` sets flags only | `POST /journeys/{id}/implants` creating a registry row + events |
| B5 | No charge capture endpoint | — | `POST /api/internal/ip-billing/charge-items` (idempotent, batch) |
| B6 | Package not exploded | `EnsureInpatientBillAsync` sets `gross_amount` | Explode template into `opd_bill_items` with inclusion/exclusion/upgrade lines |
| B7 | CCMS ack-only handlers | payment/obligation/claim-status logged | Apply to settlement reconciliation |
| B8 | Billing rules routes unprotected | no `[RequirePermission]` | Add `bill.admin` |
| B9 | No `RowVersion` on `OpdBill` | — | Add concurrency token; return 409 |
| B10 | No batch/slot API | `SurgeryScheduledAt` only | `journey_slot` CRUD + board query |
| B11 | Inventory has no billing client | — | Consumption → charge event |
| B12 | `bed_type` lacks `Recliner`/`DayCareChair` | General/ICU/Emergency | Extend enum + `BedLifecyclePolicy` unchanged |
| B13 | IP journeys list returns unbounded rows for the census | paged server-side per SoT Phase 8, but the FE filters client-side across all 9 tabs | Server-side tab counts endpoint |

---

## 12. Database Gap Analysis

### 12.1 New tables

| Table | Purpose | Key columns | Constraints |
|---|---|---|---|
| `journey_implant_usage` | Clinical implant registry (FHIR `Device`/`Procedure.usedReference` analogue) | `id`, `tenant_id`, `journey_id` FK, `patient_id`, `eye`, `item_id`, `catalog_ref`, `brand`, `model`, `power`, `serial_number`, `batch_number`, `udi_barcode`, `usage_status` (`Implanted\|Opened_Unused\|Wasted\|Returned`), `surgeon_user_id`, `scanned_at`, `scanned_by_user_id`, `inventory_txn_id`, `charge_item_id`, `charge_status`, audit | UNIQUE `(tenant_id, serial_number)` where `usage_status='Implanted'`; index on `journey_id`, `batch_number` |
| `journey_slot` | Day-care batch/slot | `id`, `tenant_id`, `branch_id`, `slot_date`, `session` (`Morning\|Afternoon\|Evening`), `theatre_id`, `sequence_no`, `planned_arrival_at`, `journey_id` | UNIQUE `(tenant_id, theatre_id, slot_date, session, sequence_no)` |
| `ip_charge_capture_outbox` *(or reuse `integration_outbox_event`)* | Implant/consumable → charge | standard outbox | UNIQUE `idempotency_key` |

**Recommendation:** reuse `integration_outbox_event` with new event types rather than creating a third outbox. Do not add a fourth outbox pattern.

### 12.2 Modified tables

| Table | Change | Why |
|---|---|---|
| `opd_bills` | add `row_version` (xmin or bytea concurrency token) | B9 |
| `opd_bill_items` | add `source_type` (`Package\|Implant\|Consumable\|Manual\|Room\|Procedure`), `source_ref_id`, `idempotency_key` UNIQUE `(tenant_id, idempotency_key)` | Duplicate-charge prevention, traceability |
| `bed_inventory` | add `ward_id` FK → `ward.id`; extend `bed_type` with `Recliner`, `DayCareChair` | F8; string `ward_name` join is fragile |
| `inv_surgery_consumables` | add `journey_id`, `charge_status`, `charge_item_id` | Link OT consumption to the IP episode and its charge |
| `patient_journey` | add `slot_id` FK, `unmark_ready_reason`, `unmarked_ready_at/by` | B3, B10 |
| `permissions` | **seed all missing IP + billing codes** | F1 |

### 12.3 Data integrity risks found

1. `ip_billing_transactions` is a live legacy shadow ledger writable from the UI — a second set of books. Freeze writes, keep reads.
2. No FK from `bed_inventory` to `ward` — orphan/mismatched ward names possible.
3. IP schema has no migration history → drift between `IpManagementDbContext` and `consolidated/migrations`.
4. `billing_ccms_outbox` and `integration_outbox_event` self-create at runtime — a failed `EnsureSchemaAsync` silently disables cross-module integration.
5. `inv_surgery_consumables` links to `surgery_id` + `patient_name`/`patient_ip_no` **strings** — not a reliable join to `patient_journey`.

---

## 13. Integration / Event Gap Analysis

### 13.1 New events required

| Event | Producer | Consumer | Payload | Idempotency key |
|---|---|---|---|---|
| `JourneyReadyForOt` | IP outbox | OT board, analytics, CCMS timing | journeyId, slotId, readyAt, actor | `JourneyReadyForOt:{journeyId}:{readyAt}` |
| `ImplantUsed` | IP outbox | Inventory (stock), Billing (charge) | journeyId, implantUsageId, itemId, serial, batch, power, status | `ImplantUsed:{implantUsageId}` |
| `ImplantUsageReversed` | IP outbox | Inventory, Billing | implantUsageId, reason | `ImplantUsageReversed:{implantUsageId}` |
| `ConsumablesConsumed` | Inventory | Billing | journeyId, lines[], consumptionId | `ConsumablesConsumed:{consumptionId}` |
| `ChargeItemsPosted` | Billing | IP (display), CCMS (allocation) | billId, itemIds | `ChargeItemsPosted:{billId}:{batchId}` |

### 13.2 Failure and reconciliation design

- **Transaction boundary:** the clinical write (`journey_implant_usage`) and the outbox row commit together. Stock and charge are **eventually consistent** — never block the surgeon.
- **Retry:** existing 8-retry → `Dead` in both outboxes. Reuse; do not invent a new retry policy.
- **Duplicate charge prevention:** `opd_bill_items.idempotency_key = ImplantUsed:{implantUsageId}` unique per tenant. A replayed event is a no-op.
- **Reversal:** wrong implant entry → `usage_status = Wasted` or a correction row; Billing posts a **negative/credit line** (never deletes) with key `ImplantReversed:{implantUsageId}`.
- **Reconciliation job (new, daily):** three-way match `journey_implant_usage` ⟷ `inv_stock_ledger` ⟷ `opd_bill_items`. Output an exception report: implanted-but-not-charged, charged-but-not-implanted, stock-out-without-usage. This directly addresses the leakage pattern in §17.
- **Dead-letter surfacing:** both outboxes can reach `Dead` with no operator UI. Add an admin integration-health page.

---

## 14. State Machine Recommendations

### 14.1 Principle

The brief proposed `Admitted → Pre-Op Pending → Pre-Op In Progress → Ready for OT → …`. **Do not adopt it as written.** Pre-op progress is already modelled richly and correctly as a **readiness projection** (`PreOpReadinessEngine`, `ChecklistPhaseStatus` jsonb, `readinessCompleted/Total`). Promoting it to clinical states would duplicate that engine, add two new transition edges to validate, and break every existing tab, filter, test and e2e helper.

**Recommendation:** keep the existing 9-state clinical machine; add **one** state (`Recovery`) only if post-op recovery must be operationally distinct from ward post-op; add **one** reverse edge (un-mark-ready); expose pre-op progress as the derived readiness meter it already is.

### 14.2 Clinical / admission (target)

| From | To | Trigger | Actor | Validation | Side effects | Event | Reversal |
|---|---|---|---|---|---|---|---|
| — | `Expected` | onboard from counselling/OT finalize | System | scheduling guard | — | — | `AdmissionCancelled` |
| `Expected` | `Admitted` | Admit | Ward (`ip.admit`) | CCMS validate (fail-closed on coverage REJECTED), bed available; financial/P0-P2 = **warn** | bed occupy, ensure bill, **explode package** | `JourneyAdmitted` | `AdmissionCancelled` |
| `Admitted` | `ReadyForSurgery` | Mark Ready | Ward/coord (`ip.ot.mark_ready`) | **4 hard blocks** (consent, laterality, PAC, critical labs) | auto-complete `informed_ot_team`, notify OT | **`JourneyReadyForOt`** *(new)* | **`ReadyForSurgery → Admitted`** *(new)* |
| `ReadyForSurgery` | `Admitted` | **Un-mark ready** *(new)* | Ward (`ip.ot.unmark_ready`) | not yet `SentToOT`; **reason required** | reverse auto-sync; notify OT | `JourneyReadyReverted` | forward again |
| `ReadyForSurgery` | `SentToOT` | Send to OT | Ward (`ip.ot.send`) | med-log **warn** | OT board | realtime | `SentToOT → ReadyForSurgery` (exists) |
| `SentToOT` | `InOT` | Accept | OT (`ip.ot.accept`) | **billing gate**; before-anaesthesia **warn** | — | realtime | `InOT → ReadyForSurgery` (exists) |
| `InOT` | `SurgeryCompleted` | Complete | OT (`ip.surgery.complete`) | WHO sign-out | **implant + consumable reconciliation prompt** | `SurgeryCompleted` | correction rows only |
| `SurgeryCompleted` | `PostOp` | Begin post-op | Ward (`ip.discharge`… → **split to `ip.postop.manage`**) | — | — | realtime | — |
| `PostOp` | `ReadyForDischarge` | Mark ready D/C | Ward | **not money-gated** (SoT Phase 9) | — | realtime | — |
| `ReadyForDischarge` | `Discharged` | Discharge | Ward (`ip.discharge`) | **patient obligation only** (not TPA balance); override = `ip.discharge.override` + reason | bed vacate, outbox | `PatientClinicallyDischarged` | `Discharged → ReadyForDischarge` (exists, `ip.discharge.cancel`) |

Off-ramps unchanged: `CancelledSurgery` (cancel-today, from `Admitted`/`ReadyForSurgery`/`SentToOT`), `AdmissionCancelled`, rebook `CancelledSurgery → Expected`.

**Permission split needed:** `SurgeryCompleted → PostOp` and `PostOp → ReadyForDischarge` currently both require `canDischarge` (`ip.discharge`). Introduce `ip.postop.manage` so a recovery nurse can advance post-op without holding discharge rights.

### 14.3 Other machines

**Patient location** — unchanged: `BedLifecyclePolicy` `Available → Reserved → Occupied → Cleaning → Available`, plus `transfer-out`, `release`. Add `Recliner`/`DayCareChair` as bed **types**, not new states.

**Pre-op (derived, not a state column):** `NotStarted → InProgress → BlockedOnDept → ReadyToMarkReady`, computed from `PreOpCompletion` + `PreOpSectionClearance` + PAC + investigations. Already effectively present; formalise as a named derived enum used identically by ward workspace, census rail and OT board.

**Implant usage (new):**
```
Reserved → Issued → Scanned → Implanted → Charged
                          ↘ Opened_Unused / Wasted → (no charge or wastage charge per policy)
                          ↘ Returned → stock credit
Implanted → Reversed (correction, audited, credit line)
```

**Billing:** `Draft → Generated → PartiallyPaid → Paid → Finalized → Locked`, derived from the ledger by `OpdBillLedgerCalculator`. Never set by IP. Refund overlay: `none → requested → approved/rejected → completed`.

**Payment:** append-only. `Payment | Advance | Discount | Refund | Reversal`. A payment is never mutated; only reversed.

**Coverage / claim:** unchanged — CCMS 30-state DB-seeded FSM. Do not duplicate in IP.

---

## 15. Financial Integrity Analysis

| Risk | Current control | Verdict | Action |
|---|---|---|---|
| Duplicate payment | `ux_opd_bill_payments_idempotency` + `AddPaymentDto.IdempotencyKey` | Strong — **if the caller sends a key** | Make the cashier drawer always generate a client key (`payment:{billId}:{uuid}`) |
| Duplicate charge | none for implants/consumables | **Missing** | `opd_bill_items.idempotency_key` unique |
| Missing charge | none | **Missing** | Three-way reconciliation job (§13.2) |
| Partial payment | ledger-derived `partially_paid` | Correct | — |
| Refund | append-only `Refund` line + `refunds` workflow + `refund:{id}` key | Strong | — |
| Reversal | one-per-payment guard + `reversed_payment_id` | Strong | — |
| Discount | append-only `Discount` line | Correct | Add approval threshold policy |
| Package upgrade (premium IOL) | not modelled on the bill | **Missing** | Upgrade line = premium IOL price − package IOL allowance |
| Item charged twice by package + consumption (D1 + D4) | no guard | **Missing** | `source_ref_id` overlap check at post time; reconciliation bucket 4 |
| Unmapped item priced at purchase rate | no mapping exists | **Missing** | MD-055 resolver returns `Unmapped` → exception queue; never a fallback price |
| Implant write-offs invisible in revenue (D2) | no wastage reporting | **Missing** | Mandatory reason + wastage report in INV-051 |
| Insurance adjustment | `apply-coverage-allocation` → `insurance_claim_amount` | Correct at header | Needs line-level once items exist |
| Concurrent cashiers | header last-write-wins | **Weak** | `RowVersion` + 409 |
| Second set of books | `ip_billing_transactions` writable | **Weak** | Freeze UI writes |
| Auditability | `IAuditService` best-effort on bill mutations | Adequate; "best-effort" is a gap for money | Make financial audit failure fail the transaction |
| Two "outstanding" numbers | census KPI from `j.balanceDue`, dashboard from ledger | **Inconsistent** | Census KPIs must read the ledger aggregate |

---

## 16. Security / Compliance Analysis

| Area | Finding | Severity | Remediation |
|---|---|---|---|
| **RBAC provisioning** | `ip.admit`, `ip.ot.mark_ready`, `ip.ot.send`, `ip.ot.accept`, `ip.surgery.start`, `ip.surgery.complete`, `ip.discharge`, `ip.bed.transfer`, `ip.billing.collect/refund/adjust`, `ip.view`, `bill.create/update/view`, `opd_bill.refund/view/refund.authorize` are enforced in code but **not seeded** in any migration | **P0** | Seed all codes + role bundles (Nurse, Ward Clerk, IP Coordinator, OT Coordinator, Surgeon, **Cashier**, Billing Exec, TPA Exec, Finance, Admin) |
| **Least privilege** | Everything collapses onto `ward.checklist.edit` / `ot.safety.sign`, so a ward nurse can admit, mark ready, send to OT and discharge | **P0** | Same as above |
| **Fail-open frontend** | `operational()` returns `true` on empty permissions; `canBill` `\|\| list.length === 0`; `resolveBillingDashboardAccess` returns `'full'` on empty roles+perms | **P0** | Fail closed with an explicit dev-only env flag |
| **Unprotected API** | `/api/OpdBills/rules*` has no `[RequirePermission]` | **P1** | Add `bill.admin` |
| **Internal key surface** | `X-Internal-Key` grants unauthenticated access to `ensure-bill`, `payment`, `reverse` | **P1** | Confirm the key is per-environment, rotated, never in the browser bundle; add mTLS or network policy |
| **Clinical vs financial separation** | Census panel shows payer share and coverage block reasons to any authenticated user | **P1** | Persona scoping |
| **Audit** | Financial audit is best-effort; clinical audit is solid (`journey_audit_log` with correlation) | **P1** | Fail-closed financial audit |
| **WCAG** | Census panel and several ward/OT modals lack `role="dialog"`, `aria-modal`, focus trap and Escape; 9–10 px text on clinical data; colour-only status in places | **P1** | Adopt Radix `Dialog`/`Sheet` (already in `src/components/ui`); minimum 12 px body |
| **OWASP** | No IDOR issues found (tenant scoping is consistent); `[AllowAnonymous]` on `ServiceCatalogController` exposes the price catalog | **P2** | Require auth on catalog |
| **PHI in realtime** | `BillingRealtimeEvents` deliberately sends identity-only payloads — **correct**, keep | — | — |

---

## 17. External Industry Research Findings

Research was used to **validate or challenge** conclusions, not to import generic hospital workflow.

### 17.1 High-flow / day-case ophthalmic surgery (RCOphth HFAC 2025; GIRFT Further Faster Ophthalmology 2026)

| Finding | Implication for this codebase |
|---|---|
| One-stop pre-assessment before the surgical day is the primary determinant of on-the-day flow | **Validates** the existing pre-op clearance chain and the four Mark Ready hard blocks. Keep them. |
| **Staggered arrival**, 15–30 min pre-procedure (45 min if dilating in hospital) | **Challenges** the current model: there is no arrival-time or batch concept. Supports `journey_slot` with `planned_arrival_at`. |
| Push system: patients pre-prepared and waiting, not "sent for" | Supports a **Ready-for-OT queue view** ordered by slot sequence, and a `JourneyReadyForOt` event so the OT board updates without polling. |
| Target arrival-to-discharge **under 60 minutes**; turnover ≤ 5 min | **Challenges** any UX that costs the ward nurse extra screens. Supports one-click Mark Ready with preflight, and non-blocking census panels. |
| "Bespoke perioperative data collection… eliminate irrelevant data (VTE, falls, CJD)" | **Validates** the ophthalmology-specific checklist design; **challenges** any move to generic long-stay inpatient forms. |
| Risk stratification and **bespoke safety checks to reduce never events such as wrong implant errors** | **Directly supports** the `journey_implant_usage` registry with laterality and serial capture — the current free-text `IntraOpNote.ImplantUsed` is a never-event exposure. |

### 17.2 Implant traceability and OR charge capture

| Finding | Implication |
|---|---|
| UDI/GTIN barcode scanning at point of use as the single source of truth linking clinical care, supply chain and billing (peer-reviewed; >$600k/yr recognition increase in one cardiac programme) | **Validates** F5/F6 as a revenue-integrity defect, not a nice-to-have. Model `udi_barcode` on `journey_implant_usage`. |
| CMS proposed rule (Apr 2026): UDI capture for implantable devices as a Promoting Interoperability measure from CY2027 | Not binding in India, but a strong argument for capturing serial/UDI now rather than retrofitting. |
| Inpatient leakage concentrates in "implant and supply capture: high-cost items used during the encounter but not connected cleanly to the account" and "department charge lag" | Describes this system exactly: `inv_surgery_consumables` has the usage, `opd_bills` has the account, nothing joins them. |
| Remedy pattern: automated charge triggers connecting orders/documentation/supply usage to charge creation, plus pre-bill edits | Supports the event-driven `ImplantUsed`/`ConsumablesConsumed` → `opd_bill_items` design and the pre-finalize reconciliation check. |

### 17.3 FHIR R4 alignment (Encounter → ChargeItem → Account → Claim)

The recommended target model maps cleanly onto FHIR without adopting FHIR internally:

| FHIR R4 | This system |
|---|---|
| `Encounter` | `patient_journey` |
| `Account` ("bucket" for charges; carries coverage responsibility) | `opd_bills` (one per journey — already unique-constrained) |
| `ChargeItem` (created when products are *provisioned*; pricing resolved by the billing engine, not the poster) | **`opd_bill_items` posted from `ImplantUsed`/`ConsumablesConsumed`** — and note FHIR's explicit rule that the posting system should **not** apply pricing rules. This validates the decision that Inventory must **not** send `purchase_rate` as a charge; Billing resolves price from the catalog. |
| `Coverage` / `Claim` | CCMS coverage case / claim packet |
| `Device` / `Procedure.usedReference` | `journey_implant_usage` |

### 17.4 EHR UX patterns (Epic Hyperspace Storyboard / Connect Care inpatient sidebar)

| Pattern | Implication |
|---|---|
| Persistent context panel **beside** the work area, never covering the list | Census must use a docked split pane, not a blur overlay |
| Role/specialty-conditional content in the sidebar | Persona-scoped census rail (nurse / coordinator / cashier) |
| Sidebar index links with distinct "open in main", "open in sidebar", "open popup" actions | Justifies one billing link with a clear destination instead of four competing CTAs |
| Persistent patient header for wrong-patient prevention | Identity strip must stay visible while the drawer is open |

---

## 18. Comprehensive Gap Matrix

| Area | Current Implementation | Expected Behavior | Gap | Sev | Recommendation | Module Owner |
|---|---|---|---|---|---|---|
| IP admission | `AdmitAsync` + CCMS fail-closed + bed occupy + compensation | Same | None | — | Keep | IP |
| Census layout | Blur overlay drawer, no a11y | Non-blocking split pane, persona-scoped | Yes | P0 | TASK IP-001/002 | FE |
| Census KPIs | Client-side sum of `j.balanceDue` | Ledger-derived | Two conflicting numbers | P1 | Read ledger aggregate | FE + Billing |
| Bed management | `BedLifecyclePolicy` FSM, internal API, history table | Same + recliner + ward FK | Partial | P1 | TASK DB-004 | Auth |
| Patient movement | Transfer with rollback, unique open assignment | Same | None | — | Keep | IP |
| Pre-op | Rich clearance chain + readiness engine | Same | None | — | Keep | IP |
| **Mark Ready for OT** | 4 hard blocks; blind one-click on census; no event; forward-only | Preflighted one-click; event; reversible | Yes | P1 | TASK IP-010/011/012 | IP + FE |
| OT workflow | Accept/start/complete + WHO + intra-op | Same + implant scan | Partial | P0 | TASK OT-020 | IP |
| Recovery | `PostOp` state exists | Optional distinct Recovery | Minor | P3 | Defer | IP |
| Discharge | Typed discharge, obligation-only gate, override audited | Same | None | — | Keep | IP |
| **Charge capture** | Package amount only; no line items | Itemised from package + implants + consumables | Yes | **P0** | TASK BILL-030/031/032 | Billing |
| Advance/payment | Append-only ledger, idempotent, receipts | Same, reachable from IP | Navigation broken | **P0** | TASK FE-003 | Billing + FE |
| **Cashier** | No persona, no scope, dead-end deep links | Cashier layout + collect drawer | Yes | **P0** | TASK FE-004, SEC-040 | FE + Auth |
| Package billing | Priced at counselling, not exploded | Exploded with inclusions/exclusions/upgrades | Yes | P1 | TASK BILL-031 | Billing |
| Consumables | `inv_surgery_consumables` isolated | Feeds charges + reconciles | Yes | **P0** | TASK INV-050 | Inventory + Billing |
| **IOL / implants** | 5 disconnected stores, free-text intra-op | Single registry with serial/power/status/UDI | Yes | **P0** | TASK OT-020, DB-002 | IP |
| Coverage | CCMS FSM, allocation engine | Same | None | — | Keep | CCMS |
| Pre-authorization | Full lifecycle with clarifications/enhancements | Same | None | — | Keep | CCMS |
| Claims | Packet generation, submission, queries | Same | None | — | Keep | CCMS |
| Settlement reconciliation | Ack-only handlers for payment events | Apply and reconcile | Yes | P1 | TASK CCMS-060 | CCMS |
| Financial clearance | Emergency FC fail-closed, audited, outbox | Same | None | — | Keep | IP |
| Audit | Clinical strong; financial best-effort | Both fail-closed | Partial | P1 | TASK SEC-042 | Auth |
| Notifications | `NotificationHub`, identity-only payloads | Same + dead-letter visibility | Partial | P2 | TASK OPS-070 | Auth |
| **Permissions** | Codes enforced, **never seeded**; FE fails open | Seeded, role-bundled, fail-closed | Yes | **P0** | TASK SEC-040/041 | Auth + FE |
| APIs | ~120 IP routes, well-structured | + implant, charge, slot, unmark-ready | Partial | P1 | §11 | All |
| Database | No IP migration history; runtime DDL for outboxes | Versioned migrations | Yes | P1 | TASK DB-005 | All |
| Integrations | Two outboxes with retry/dead; inventory unconnected | + implant/consumable/charge events | Partial | P0 | §13 | All |
| Reporting | IP billing dashboard reads ledger | + implant reconciliation, slot throughput | Done | P2 | TASK RPT-080 | Billing |
| Day-care batch/slot | Absent | Slot board with staggered arrival | Yes | P1 | TASK IP-013 | IP |

---

## 19. Recommended Target Architecture

```
                      ┌──────────────────────────────────────────┐
                      │  Patient (Auth) · Counselling · Catalog    │
                      └───────────────┬──────────────────────────┘
                                      │
        ┌─────────────────────────────▼──────────────────────────────┐
        │  IP MANAGEMENT  — clinical / operational source of truth    │
        │  patient_journey · pre-op chain · journey_slot (new)        │
        │  journey_bed_assignment · journey_implant_usage (new)       │
        │  journey_audit_log · integration_outbox_event               │
        └───┬──────────────┬───────────────┬──────────────────┬──────┘
            │ beds         │ ensure-bill   │ outbox           │ scan
            │ (internal)   │ (internal)    │                  │
   ┌────────▼───────┐  ┌───▼───────────────▼────┐   ┌─────────▼─────────┐
   │ AUTH BEDS      │  │ BILLING (Auth OpdBill) │   │ INVENTORY          │
   │ bed_inventory  │  │ opd_bills (Account)    │◄──┤ stock, batches     │
   │ BedLifecycle   │  │ opd_bill_items         │   │ inv_surgery_       │
   │ Policy         │  │   (ChargeItem)         │   │   consumables      │
   └────────────────┘  │ opd_bill_payments      │   └────────────────────┘
                       │   (append-only ledger) │        ConsumablesConsumed
                       │ billing_ccms_outbox    │
                       └───────────┬────────────┘
                                   │ BillFinalized / PaymentReceived /
                                   │ PaymentReversed / PatientObligationChanged
                       ┌───────────▼────────────┐
                       │ CCMS — coverage/claims │
                       │ 30-state workflow FSM  │
                       │ allocation engine      │
                       └───────────┬────────────┘
                                   │ apply-coverage-allocation
                                   └──────────► Billing (payer/patient split)

   Realtime: Auth NotificationHub only — identity-only payloads, all surfaces invalidate + refetch
```

### 19.1 Boundary rules (enforced, not aspirational)

1. **IP never writes money.** It may *request* (`ensure-bill`) and *read* (`financial-summary`, `preauth-status`).
2. **Inventory never sets a price.** It reports quantity and item identity; Billing resolves price from the catalog (FHIR `ChargeItem` rule, §17.3).
3. **CCMS never moves clinical state.** It supplies coverage decisions; IP decides what that means for admission/discharge.
4. **Billing never blocks the surgeon.** Charge posting is asynchronous and reconcilable.
5. **Every cross-module write carries an idempotency key** and lands in one of the two existing outboxes.

### 19.2 Explicitly do not change

`OpdBillLedgerCalculator`; append-only payments; `ux_opd_bills_patient_journey`; `BedLifecyclePolicy`; CCMS `WorkflowEngine` + seeded transitions; `IntegrationIdempotencyGuard`; both outbox retry policies; `IpFinancialFieldClassification`; identity-only SignalR payloads; the four Mark Ready hard blocks; the ward pre-op workspace UX.

---

## 20. Recommended UI/UX

### 20.1 Interaction pattern by persona and task

| Task | Pattern | Rationale |
|---|---|---|
| Census browse + triage | **Docked split pane** (list left ~65%, context rail right ~35%, no backdrop) | Coordinator keeps the list; matches Epic Storyboard; 1366 px nursing PCs fit 6 columns + rail |
| Census on < 1280 px | Drawer with dim (no blur), Radix `Sheet` | Small-screen fallback only |
| Pre-op / post-op / discharge (multi-step, high-risk) | **Full-screen modal** (existing `WardPreOpWorkspaceModal`) | Focus, prevents mis-clicks, already accessible |
| Cashier collection | **Focused drawer over the split pane** (Radix `Dialog`) | Money entry needs focus + confirmation, but the census must stay behind it |
| OT board | **Full page** | Shared display, list-first |
| Bill detail | **Full page** `/billing/opd` | Complex, long-lived task |

**Rejected:** blur-backdrop overlay on the census (hides work), and full-page navigation for row inspection (loses list position on a 155-row census).

#### 20.1.1 Census row click — decision record

The most visible instance of the pattern above, and the one raised in review. Today `PatientQuickPanel` mounts `fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]` plus a `fixed right-0 top-0 bottom-0 z-50 w-[380px]` sheet: selecting a patient dims and blurs the entire dashboard and covers the app's own navigation. A scrim signals *the application is suspended until you deal with this*, which is the correct signal for a payment or a cancellation and the wrong one for reading a row in a worklist. The mismatch — not any individual field — is what makes the panel read as unprofessional.

| Option | Verdict | Reasoning |
|---|---|---|
| Modal popup | **Reject** | A modal is a commitment to one decision, then exit. A patient summary is reference material consulted *while* working the list, forty times a session. It blocks the list entirely, cannot be compared against its own row, and imitates the pattern already causing the problem. |
| Full page only | **Right destination, wrong default** | Correct for depth and already built as S-10. As the only response to a row click it costs a navigation and a return per patient, losing scroll position and filters. |
| Overlay drawer (today) | **Reject** | Hides the list, sits over the app chrome, squeezes clinical + financial + audit content into 380 px, and holds selection in `useState` so a refresh loses the patient and the view cannot be shared. |
| **Docked split pane → full page** | **Adopted** | Pane is in the layout and narrows the table; nothing covered, nothing dimmed. Answers triage in place and carries one route into the full record for everything else. |

Six changes make it read as clinical software:

1. **Remove the scrim and the `fixed` positioning.** The pane joins the grid, starting below the app header.
2. **Add a patient identification banner** that never scrolls and never truncates: name, UHID, age, sex, DOB, allergy/risk alerts, and the **operating eye**. This is the genuinely missing piece, not merely a cosmetic one — laterality currently renders as the two letters `OD` inside a grey subtitle beside the procedure. In an eye hospital the operating side is the field a wrong-site event turns on, so it gets a bordered block, is spelled out as `RIGHT`/`LEFT` with the abbreviation beneath, and is never conveyed by colour alone. A missing value renders as a blocker, never as blank.
3. **Widen to 440 px** and order content by clinical risk in fixed zones, so staff learn where to look.
4. **Move selection into the URL** as `?patient={id}` instead of `useState`: refresh-safe, back-button-correct, shareable.
5. **One primary action** in a pinned footer, chosen by state and permission; demote the rest (this is also where the four competing billing CTAs collapse to one).
6. **Escalate, do not expand.** Audit history, implants and the billing ledger belong on S-10, which has room for them.

Zone order in the pane: (1) identification, (2) where the patient is, (3) what is blocking, (4) money, (5) coverage, (6) recent activity, then the pinned action footer. Zones 1–3 are unconditional; 4–6 are permission-scoped per §S-02 and are hidden rather than greyed out when not permitted. The identification banner itself is persona-invariant — safety identifiers are not a matter of role — with the sole exception of the clinical alert strip, which a cashier does not see.

Responsive: docked at ≥ 1280 px; Radix `Sheet` **with** a scrim at 1024–1280 px, where an overlay is honest because it genuinely is a temporary interruption; card list navigating to S-10 below 1024 px.

Rendered in [S-01](mockups/ip-target/s-01-ip-census.html) (option comparison, before/after, banner states, zones) and [S-02](mockups/ip-target/s-02-patient-context-rail.html) (per-persona pane).

### 20.2 Design deliverables in this section

| Sub-section | Contains |
|---|---|
| §20.3 | Persona variants of the patient context rail |
| §20.4 | **Screen inventory** — all 18 surfaces with route, persona, pattern, status and owning task |
| §20.5 | **Shared layout shells** — the three shells every surface must use |
| §20.6 | **Screen-by-screen specifications** — wireframe, zones, and a data & action map resolving each element to API → backend → database → module → permission → event |
| §20.7 | **Cross-screen traceability** — capability → screens → API → service → table → owner |
| §20.8 | Visual and content rules |

Full census and rail wireframes are in **S-01** and **S-02** (§20.6); they are not duplicated here.

### 20.3 Persona variants of the same rail

| Block | Nurse / Coordinator | Cashier | Surgeon |
|---|---|---|---|
| Identity + location | Yes | Yes | Yes |
| Readiness + blockers | **Primary** | Financial blockers only | Clinical only |
| Clinical actions | **Primary** | Hidden | Limited |
| Money | One-line due + link | **Primary**: bill status, advance, due, receipts, **[Collect payment]** | Hidden |
| Coverage | Status chip | Status + payer share | Hidden |
| Activity | 3 events | Financial events | Clinical events |

Implement as `resolveIpPersona(permissions, roles)` returning `'ward' | 'coordinator' | 'cashier' | 'clinical' | 'admin'`, deriving from **permission codes** with role strings as fallback. Reuse the existing `resolveIpRoleActions` for capability, add persona for **ordering and emphasis** only — never as a security boundary.

### 20.4 Screen inventory

Eighteen screens/surfaces make up the target IP ecosystem. `Keep` means the implementation is already correct and only inherits the global design-system rules in §20.8. The **Mockup** column links to a rendered static HTML version of the same specification.

Each mockup now also carries, where the domain supports it, an **Add action with its resulting history panel** and a **Messages table** giving the user-facing copy for every failure and success on that screen. Read [conventions](mockups/ip-target/conventions.html) first — it holds the rules those two additions follow and the verified endpoint inventory they are mapped against.

| ID | Screen / surface | Route or component | Primary persona | Pattern | Status | Tasks | Mockup |
|---|---|---|---|---|---|---|---|
| **S-01** | IP Census | `/dashboard/ip-management` | IP coordinator | Split pane | Modify | IP-001, IP-010 | [html](mockups/ip-target/s-01-ip-census.html) |
| **S-02** | Patient Context Rail | `PatientQuickPanel` → `PatientContextRail` | All (persona-scoped) | Docked rail / Sheet | Rebuild | IP-002 | [html](mockups/ip-target/s-02-patient-context-rail.html) |
| **S-03** | Collect Payment Drawer | `CollectPaymentDrawer` (new) | Cashier | Radix Dialog | New | FE-004, BILL-033 | [html](mockups/ip-target/s-03-collect-payment.html) |
| **S-04** | Ward Board | `/dashboard/ip-management/ward` | Ward nurse | Table + drawer + modals | Modify | UX-090 | [html](mockups/ip-target/s-04-ward-board.html) |
| **S-05** | Pre-Op Workspace | `WardPreOpWorkspaceModal` | Ward nurse | Full-screen modal | **Keep** | — | [html](mockups/ip-target/s-05-preop-workspace.html) |
| **S-06** | OT Board | `/dashboard/ip-management/operation-theatre` | OT coordinator | Full page | Modify | OT-020, UX-090 | [html](mockups/ip-target/s-06-ot-board.html) |
| **S-07** | OT Implant Scan | `ImplantScanPanel` (new) | Surgeon / OT nurse | Panel in S-06 | New | OT-020 | [html](mockups/ip-target/s-07-implant-scan.html) |
| **S-08** | Post-Op / Recovery | `WardPostOpWorkspaceModal` | Recovery nurse | Full-screen modal | Modify | UX-090 | [html](mockups/ip-target/s-08-postop-workspace.html) |
| **S-09** | Discharge Workspace | `WardDischargeSummaryModal` | Ward nurse | Full-screen modal | Modify | UX-090 | [html](mockups/ip-target/s-09-discharge-workspace.html) |
| **S-10** | Journey Detail | `/dashboard/ip-management/journey/[id]` | Coordinator / auditor | Full page split | Modify | FE-005 | [html](mockups/ip-target/s-10-journey-detail.html) |
| **S-11** | IP Billing Dashboard | `/dashboard/ip-management/billing` | Finance / billing | Full page | Modify | SEC-041, RPT-080 | [html](mockups/ip-target/s-11-ip-billing-dashboard.html) |
| **S-12** | Bill Detail | `/dashboard/billing/opd` | Billing executive | Full page | Modify | FE-003, BILL-030 | [html](mockups/ip-target/s-12-bill-detail.html) |
| **S-13** | Day-Care Slot Board | `/dashboard/ip-management/slots` (new) | IP / OT coordinator | Full page board | New | IP-013, RPT-080 | [html](mockups/ip-target/s-13-slot-board.html) |
| **S-14** | Charge Exception & Catalog Mapping | `/dashboard/admin/charge-mapping` (new) | Billing admin | Full page | New | MD-055 | [html](mockups/ip-target/s-14-charge-mapping.html) |
| **S-15** | Reconciliation & Wastage Report | `/dashboard/admin/charge-reconciliation` (new) | Finance / stores | Full page | New | INV-051 | [html](mockups/ip-target/s-15-reconciliation.html) |
| **S-16** | Integration Health | `/dashboard/admin/integration-health` (new) | IT admin | Full page | New | OPS-070 | [html](mockups/ip-target/s-16-integration-health.html) |
| **S-17** | Reason-Required Confirmation | `ReasonConfirmDialog` (shared) | All | Radix AlertDialog | New (shared) | IP-011, UX-090 | [html](mockups/ip-target/s-17-reason-confirm.html) |
| **S-18** | Coverage Context Panel | `CoverageContextBlock` in S-02/S-10 | Coordinator / TPA | Read-only block | Modify | IP-002 | [html](mockups/ip-target/s-18-coverage-context.html) |

### 20.5 Shared layout system

Three shells cover every surface. Nothing new should invent a fourth.

```
SHELL A — LIST + CONTEXT (S-01, S-04, S-06, S-13)
┌─ page header: title · scope · refresh · cross-module link ─────────────┐
├─ KPI strip (server-derived, never client-summed) ──────────────────────┤
├─ filter bar (persisted to URL) ────────────────────────────────────────┤
├─ tab strip (server counts) ─────────────────────────┬─ CONTEXT RAIL ──┐│
│  data table (virtualised >100 rows)                 │  identity        ││
│                                                     │  situation       ││
│                                                     │  blockers        ││
│                                                     │  actions         ││
│                                                     │  money/coverage  ││
│  footer: showing N of M · keyboard hints            │  activity        ││
└─────────────────────────────────────────────────────┴──────────────────┘

SHELL B — FULL-SCREEN WORKSPACE (S-05, S-08, S-09)
┌─ sticky header: patient identity · state · close ──────────────────────┐
├─ step nav (left) ─┬─ step content (centre, scrolls) ───────────────────┤
│                   │                                                    │
├───────────────────┴────────────────────────────────────────────────────┤
└─ sticky footer: readiness/hard blocks + ONE primary action ────────────┘

SHELL C — FOCUSED TASK DIALOG (S-03, S-07, S-17)
┌─ title + close ────────────────────────────────────────────────────────┐
│  context recap (read-only, what the user is acting on)                 │
│  form fields (minimal)                                                 │
│  consequence preview ("after this: due ₹0")                            │
└─ cancel · primary ─────────────────────────────────────────────────────┘
```

**Shell rules.** Shell A never covers its own list. Shell B is used only when the task is multi-step and clinically high-risk. Shell C is always a Radix `Dialog`/`AlertDialog` with focus trap, Escape and `aria-modal`. All three take identity from one `PatientIdentityHeader` component so wrong-patient risk is mitigated identically everywhere.

### 20.6 Screen specifications

Each screen lists its wireframe, zones, and a **data & action map** resolving every element down to API → backend → database → owning module → permission → event. Column meanings are constant: *FE* = component/hook, *API* = HTTP route, *BE* = function/controller → service, *DB* = authoritative table, *Perm* = required permission.

---

#### S-01 — IP Census · `/dashboard/ip-management`

**Primary:** IP coordinator. **Secondary:** ward nurse, cashier, admin.
**Purpose:** answer *who is here, where are they, what is blocking them, what happens next* for the whole branch, and launch the single next action.

```
┌──────────────────────────────────────────────────────────────┬─────────────────────┐
│ IP Management · Downtown Hospital        [⟳ Refresh] [Billing]│  S-02 CONTEXT RAIL  │
├──────────────────────────────────────────────────────────────┤                     │
│ ┌────────┐┌────────┐┌────────┐┌────────┐                     │                     │
│ │In-house││ In OT  ││Ready OT││Pt. dues│  ← server-derived    │                     │
│ │  155   ││   6    ││   12   ││₹1.62Cr │                      │                     │
│ └────────┘└────────┘└────────┘└────────┘                     │                     │
├──────────────────────────────────────────────────────────────┤                     │
│ [From][To][UHID][Name..............][Search] [Clear]  Slot:AM │                     │
├──────────────────────────────────────────────────────────────┤                     │
│ All 178 │In-House 108│Ready OT 12│Sent 6│InOT 0│Post-Op 3│... │                     │
│                                        Financial: [All ▾]     │                     │
├──────────────────────────────────────────────────────────────┤                     │
│ STATE      PATIENT        PROCEDURE   WARD/BED  SLOT NEXT     │                     │
│ ●Admitted  Meena Iyer     LASIK OD    DC · B-04 AM-3 Ready OT │                     │
│            UAT-002 · 54F                             (Ward)   │                     │
│ ▸SELECTED ─────────────────────────────────────────────────── │                     │
│ ●Admitted  Ananya         Corneal     DC · B-05 AM-4 Ready OT │                     │
│ ●Ready OT  Amit           Retinal     DC · B-07 AM-1 Send OT  │                     │
├──────────────────────────────────────────────────────────────┤                     │
│ Showing 24 of 178 · ↑↓/j k move · Enter open · / search       │                     │
└──────────────────────────────────────────────────────────────┴─────────────────────┘
```

**Zones**

| Zone | Content | Rules |
|---|---|---|
| Header | Title, branch, refresh, "Billing dashboard" link | One cross-module link only |
| KPI strip | In-house · In OT · Ready for OT · Patient dues | **Dues must come from the ledger aggregate, not `j.balanceDue`** (fixes the two-numbers defect) |
| Filter bar | Date range, UHID, name, **slot/session** | Mirrored to URL |
| Tab strip | 9 clinical tabs + financial secondary filter | Counts from server, not client filtering |
| Table | State · Patient · Procedure · Ward/Bed · **Slot** · Next action · blockers | Virtualise beyond 100 rows |
| Rail | S-02 | Docked ≥1280 px |

**Data & action map**

| Element | FE | API | BE | DB | Module | Perm |
|---|---|---|---|---|---|---|
| Row list | `useIpJourneysQuery` → `ipManagementApi.listJourneys` | `GET /ip-management/journeys` | `JourneyFunctions` → `PatientJourneyService.ListAsync` | `patient_journey` | IP | `ip.view` |
| Tab counts | new `useIpTabCountsQuery` | `GET /ip-management/journeys/dashboard-summary` | `PatientJourneyService.GetDashboardSummaryAsync` | `patient_journey` | IP | `ip.view` |
| KPI dues | `useIpBillingDashboardQuery` (summary slice) | `GET /opdbills/ip-dashboard` | `OpdBillsController` → `OpdBillService.GetIpBillingDashboardAsync` → `IpBillingDashboardCalculator` | `opd_bills`, `opd_bill_payments` | Billing | `bill.view` / `ip.view` |
| Next action + blockers | `buildIpRowSituation` (pure) | — | — | derived from row DTO | IP | — |
| Slot column | `useSlotsQuery` (new) | `GET /ip-management/slots` | `SlotFunctions` (new) | `journey_slot` (new) | IP | `ip.view` |
| Realtime refresh | `useNotificationHubInvalidation` | SignalR `/notificationHub` | `NotificationHub` + `push-tenant` | — | Auth | authenticated |
| Row select | local + URL `?journeyId=` | — | — | — | FE | — |

**States.** *Empty:* "No patients match these filters" + Clear. *Loading:* skeleton rows; rail skeleton, never a spinner. *Error:* inline banner + Retry, last good data retained. *Stale:* subtle "updated 2 min ago" when the hub is down and polling is active. *Permission:* a user without `ip.view` never reaches the route (`ProtectedRoute`).

**Interactions.** `↑↓`/`j k` move selection · `Enter` open rail · `Esc` clear · `/` focus search · `Shift+B` open billing for the selected patient (cashier). Selected row carries `aria-selected` and a 4 px left accent.

**Responsive.** ≥1280 px split pane · 1024–1280 px rail as Radix `Sheet` · <1024 px card list with sheet.

---

#### S-02 — Patient Context Rail · `PatientContextRail`

**Primary:** persona-dependent. **Replaces:** `PatientQuickPanel`.
**Purpose:** the whole answer for one patient, without leaving the census.

```
┌─────────────────────────────────┐   Persona = coordinator / ward
│ Meena Iyer                    ✕ │
│ UAT-002 · 54F · LASIK · OD      │  ← PatientIdentityHeader (shared)
├─────────────────────────────────┤
│ ●Admitted  ○Not sent  ⚑Day care │  ← status badges (clinical/OT/flags)
├─────────────────────────────────┤
│ LOCATION                        │
│ Day Care Ward · Bed 04 · AM-3   │
│ Next: Mark ready for OT (Ward)  │
├─────────────────────────────────┤
│ BLOCKERS                        │
│ ⛔ Surgical consent unsigned     │
│    → Open consent step          │
│ ⛔ PAC incomplete → Open PAC     │
│ ⚠ Patient due ₹90,000           │
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │  Mark Ready for OT          │ │ ← disabled, reasons above
│ └─────────────────────────────┘ │
│ Transfer bed                    │
│ View full journey               │
├─────────────────────────────────┤
│ PAYMENTS                        │
│ Billed ₹1,20,000                │
│ Collected ₹30,000 · Due ₹90,000 │
│ [ Open billing ]                │ ← ONE link
├─────────────────────────────────┤
│ COVERAGE            (S-18)      │
│ Star Health · Approved          │
│ Payer share ₹80,000             │
├─────────────────────────────────┤
│ ACTIVITY                        │
│ Admitted · 24 Aug 01:21 pm      │
│ Bed assigned · 01:19 pm         │
│ View all →                      │
└─────────────────────────────────┘
```

**Persona variants** (same component, different section order and visibility — see §20.3)

| Persona | Section order | Hidden |
|---|---|---|
| Ward / coordinator | Identity → Location → Blockers → Actions → Payments → Coverage → Activity | Refund, adjust |
| Cashier | Identity → **Payments (expanded + Collect)** → Coverage → Location → Activity | Clinical actions, blockers other than financial |
| Clinical / surgeon | Identity → Location → Clinical blockers → Journey link → Activity | Payments, coverage |
| Admin | All, plus Emergency FC and discharge override | — |

**Data & action map**

| Element | FE | API | BE | DB | Module | Perm | Event |
|---|---|---|---|---|---|---|---|
| Identity/status | row DTO (no fetch) | — | — | `patient_journey` | IP | `ip.view` | — |
| Location / next action | `buildIpRowSituation` | — | — | derived | IP | — | — |
| Blockers (clinical) | `useTransitionGatesQuery` | `GET /ip-management/journeys/{id}/transition-gates?newState=ReadyForSurgery` | `ChecklistGateFunctions` → `ChecklistGateService.EvaluateTransitionAsync` | pre-op chain, `pac_assessment`, ward investigations | IP | `ip.view` | — |
| Blockers (financial/coverage) | `buildIpRowSituation` + summary | `GET /journeys/{id}/financial-summary` | `JourneyFunctions` → `BillingService.GetFinancialSummaryAsync` → `AuthBillingClient` → `OpdBillService.GetInpatientSummaryAsync` | `opd_bills`, `opd_bill_payments` | Billing | `ip.view` | — |
| **Mark Ready** | `ipManagementApi.transitionClinical` | `POST /journeys/{id}/clinical-transition` | `PatientJourneyService.TransitionClinicalAsync` | `patient_journey`, `journey_audit_log` | IP | `ip.ot.mark_ready` \| `ward.checklist.edit` | `JourneyReadyForOt` (new) |
| **Un-mark ready** | `ipManagementApi.transitionClinical` + S-17 | same, `newState=Admitted` | same, new guard | + `unmark_ready_reason` | IP | `ip.ot.unmark_ready` | `JourneyReadyReverted` |
| Admit | `ipManagementApi.admitPatient` | `POST /journeys/{id}/admit` | `PatientJourneyService.AdmitAsync` | `patient_journey`, `journey_bed_assignment`, `bed_inventory` | IP + Auth beds | `ip.admit` | `JourneyAdmitted` |
| Transfer bed | `ipManagementApi.transferBed` | `POST /journeys/{id}/transfer-bed` | `PatientJourneyService.TransferBedAsync` → `AuthBedLifecycleClient` | `journey_bed_assignment`, `bed_inventory` | IP + Auth | `ip.bed.transfer` | — |
| Payments block | `getFinancialSummary` | as above | as above | `opd_bills`, `opd_bill_payments` | Billing | `ip.view` | — |
| **Collect payment** | opens **S-03** | — | — | — | Billing | `ip.billing.collect` | — |
| Open billing | `router.push('/dashboard/billing/opd?billId=…&journeyId=…')` | — | — | — | FE | `bill.view` | — |
| Coverage (S-18) | `ipManagementApi.getPreauthStatus` | `GET /journeys/{id}/financial/preauth-status` | `PatientJourneyService.GetPreauthStatusAsync` → `CcmsAdmissionClient` | `ccms_coverage_cases`, `ccms_coverage_authorizations` | CCMS | `ip.view` | — |
| Emergency FC | `ipManagementApi.applyEmergencyFc` + S-17 | `POST /journeys/{id}/emergency-fc` | `PatientJourneyService.ApplyEmergencyFcAsync` | `patient_journey`, `journey_audit_log` | IP | `ip.emergency_fc.apply` (fail-closed) | `EmergencyFcApplied` |
| Discharge override | `ipManagementApi.applyDischargeOverride` + S-17 | `PUT /journeys/{id}/discharge-override` | `ApplyDischargeOverrideAsync` | `patient_journey` | IP | `ip.discharge.override` | — |
| Activity | `ipManagementApi.getJourneyAudit` | `GET /journeys/{id}/audit` | `GetAuditLogsAsync` | `journey_audit_log` | IP | `ip.view` | — |

**Performance rule.** All three per-patient reads (gates, financial summary, preauth) go through react-query keyed on `journeyId` with `staleTime` ≈ 30 s, so re-selecting a row is free. Today they are uncached `useEffect` calls firing on every click.

**Removed from the current panel:** `MiniStepper` (misrepresents 9 states as 5), `AddTransactionForm` (projection write path), three of the four billing CTAs, all permission-code and `OpdBill` jargon, question-style headings.

---

#### S-03 — Collect Payment Drawer · `CollectPaymentDrawer` (new)

**Primary:** cashier. **Shell:** C.
**Purpose:** collect an advance or payment in context, against the Billing ledger, with a receipt.

```
┌───────────────────────────────────────────┐
│ Collect payment — Meena Iyer          ✕   │
│ UAT-002 · Day Care Ward · Bed 04           │
├───────────────────────────────────────────┤
│ Billed         ₹1,20,000                   │
│ Payer share    ₹80,000  (Star Health)      │
│ Collected      ₹30,000                     │
│ Patient due    ₹10,000                     │
├───────────────────────────────────────────┤
│ Type   (•) Advance  ( ) Payment            │
│ Mode   [Cash ▾]                            │
│ Amount [₹ 10,000                    ]      │
│ Ref    [                            ]      │
│ Notes  [                            ]      │
├───────────────────────────────────────────┤
│ After this payment · Patient due ₹0        │ ← consequence preview
├───────────────────────────────────────────┤
│              [Cancel]  [ Collect ₹10,000 ] │
└───────────────────────────────────────────┘

  ── no bill yet (financialState = NotCreated) ──
│ No bill exists for this admission.         │
│              [Cancel] [Create bill & collect]│  ← D3, needs bill.create
```

**Data & action map**

| Element | FE | API | BE | DB | Module | Perm | Event |
|---|---|---|---|---|---|---|---|
| Context recap | cached `getFinancialSummary` | `GET /journeys/{id}/financial-summary` | `BillingService` → Auth internal | `opd_bills`, `opd_bill_payments` | Billing | `ip.view` | — |
| **Create bill** (D3) | `opdBillingApi.ensureIpBill` (new) | `POST /api/OpdBills/ip-ensure` (**TASK BILL-033**) | `OpdBillsController` → `OpdBillService.EnsureInpatientBillAsync` + package explosion | `opd_bills`, `opd_bill_items` | Billing | `bill.create` + `ip.billing.collect` | `BillCreated` |
| **Collect** | `opdBillingApi.addPayment` | `POST /api/OpdBills/payment` | `OpdBillsController` → `OpdBillService.AddPaymentAsync` | `opd_bill_payments` (append-only) | Billing | `bill.update` \| `ip.billing.collect` | `PaymentReceived` → CCMS + hub |
| Receipt | response `receiptNumber` | — | sequence `opd_receipt_number_seq` | `opd_bill_payments.receipt_number` | Billing | — | — |
| Print | client print view | — | — | — | FE | — | — |

**Rules.** Client generates `idempotencyKey = payment:{billId}:{uuid}` before submit and reuses it on retry — this is what makes double-submit safe. Amount must be > 0 and is warned (not blocked) above patient due, since advances legitimately exceed current dues. Disabled with an explicit reason when the bill is finalized or locked. **Never** calls `ipManagementApi.addBilling`. Refunds and adjustments are deliberately absent — they deep-link to S-12.

**States.** *Success:* inline receipt number + Print + auto-refresh of S-01/S-02. *Duplicate key:* treated as success, showing the original receipt. *Finalized bill:* form replaced by an explanation and a link to S-12. *409:* refresh summary and ask the user to re-confirm the amount.

---

#### S-04 — Ward Board · `/dashboard/ip-management/ward`

**Primary:** ward nurse. **Shell:** A. **Status:** interaction model is correct; data layer and modal semantics change.

```
┌──────────────────────────────────────────────────────┬──────────────────┐
│ Ward · Day Care          [⟳] [Slot board]            │ WardPatientDrawer│
├──────────────────────────────────────────────────────┤ (existing, keep) │
│ Expected 12 │ Admitted 108 │ Ready 12 │ Post-op 3     │                  │
├──────────────────────────────────────────────────────┤                  │
│ PATIENT      READINESS        BED    SLOT   ACTION    │                  │
│ Meena Iyer   ███████░░ 7/9    B-04   AM-3   Pre-Op ▸  │                  │
│ Ananya       █████████ 9/9    B-05   AM-4   Mark ready│                  │
└──────────────────────────────────────────────────────┴──────────────────┘
        │ opens
        ▼
   S-05 Pre-Op Workspace (full-screen)
```

**Data & action map**

| Element | FE | API | BE | DB | Module | Perm |
|---|---|---|---|---|---|---|
| Board rows | **migrate to** `useIpJourneysQuery` (from manual `useState`) | `GET /ip-management/journeys` | `PatientJourneyService.ListAsync` | `patient_journey` | IP | `ip.view` |
| KPI strip | `fetchWardDashboardSummary` | `GET /journeys/dashboard-summary` | `GetDashboardSummaryAsync` | `patient_journey` | IP | `ip.view` |
| Readiness meter | `WardReadinessMeter` from row DTO | — | `PreOpReadinessEngine` (server rollup) | pre-op chain | IP | `ip.view` |
| Realtime | `useWardRealtime` → align with `useNotificationHubInvalidation` | SignalR | `NotificationHub` | — | Auth | — |
| Cancel today / admission | existing modals → wrap in S-17 | `POST /journeys/{id}/cancel-today-surgery` \| `/cancel-admission` | `CancelTodaySurgeryAsync` / `CancelAdmissionAsync` | `patient_journey`, `journey_bed_assignment`, `bed_inventory` | IP + Auth | `ward.checklist.edit` \| `ot.safety.sign` |
| Rebook | `rebookCancelledSurgery` | `POST /journeys/{id}/rebook` | `RebookCancelledSurgeryAsync` | `patient_journey` | IP | as above |

**Changes only:** react-query for cache parity with S-01; Radix semantics for the five inline modals; reason-required confirmations routed through S-17. No workflow change.

---

#### S-05 — Pre-Op Workspace · `WardPreOpWorkspaceModal` · **KEEP**

**Primary:** ward nurse. **Shell:** B. This is the reference implementation — 8-step nav, server readiness rollup, hard-block footer with "Open step", `role="dialog"`, `aria-modal`, focus trap, Escape, e2e a11y coverage.

```
┌─ Meena Iyer · UAT-002 · Day Care B-04 · Admitted ──────────── ✕ ─┐
│ ①Admit      │                                                    │
│ ②Clinical   │   [ step content ]                                 │
│ ③Consent    │                                                    │
│ ④Investig.  │                                                    │
│ ⑤PAC        │                                                    │
│ ⑥Dept clear │                                                    │
│ ⑦Fasting    │                                                    │
│ ⑧Coverage   │                                                    │
├─────────────┴────────────────────────────────────────────────────┤
│ Readiness ███████░░ 7 of 9                                        │
│ ⛔ Hard stops: consent unsigned → Open step · PAC → Open step      │
│                              [ Save & Mark Ready for Surgery ]    │
└───────────────────────────────────────────────────────────────────┘
```

**Mapping (abridged — the module is unchanged)**

| Step | API family | BE service | DB |
|---|---|---|---|
| Admit | `POST /journeys/{id}/admit` | `AdmitAsync` | `patient_journey`, `bed_inventory` |
| Clinical evaluation | `/journeys/{id}/pre-op/*` | `PreOpFunctions` | `pre_op_completion`, `pre_op_section_item` |
| Consent | `/pre-op/consent*` | `PreOpFunctions` | `pre_op_consent_detail` |
| Investigations | `/journeys/{id}/investigation-checklist` | `WardInvestigationChecklistService` | ward investigation tables |
| PAC | `/journeys/{id}/pac*` | `PacAssessmentService` | `pac_assessment` |
| Dept clearance | `/pre-op/sections/*` | `PreOpFunctions` | `pre_op_section_clearance` |
| Fasting / meds | `/journeys/{id}/medication-log` | `MedicationLogFunctions` | `pre_op_medication_log` |
| Coverage (read) | `/financial/preauth-status` | `GetPreauthStatusAsync` | CCMS tables |
| Mark Ready | `POST /clinical-transition` | `TransitionClinicalAsync` | `patient_journey`, `journey_audit_log` |

**Only change:** the footer's hard-block presentation becomes a shared component reused by S-02, so census and workspace state identical reasons in identical words.

---

#### S-06 — OT Board · `/dashboard/ip-management/operation-theatre`

**Primary:** OT coordinator, surgeon. **Shell:** A (full page, expandable rows).

```
┌────────────────────────────────────────────────────────────────────┐
│ Operation Theatre · Today · AM session          [⟳] [Slot board]   │
├────────────────────────────────────────────────────────────────────┤
│ Sent to OT 6 │ In OT 1 │ Completed 14 │ Turnover avg 6m            │
├────────────────────────────────────────────────────────────────────┤
│ SEQ PATIENT      EYE PROCEDURE  SURGEON   OT STATE     ACTION      │
│ AM-1 Amit        OD  Retinal    Dr. Rao   In progress  Complete ▸  │
│  └ expanded ─────────────────────────────────────────────────────  │
│     WHO checklist ✔ · Anaesthesia ✔                                │
│     ┌ IMPLANTS & CONSUMABLES ───────────────── S-07 ─────────────┐ │
│     │ IOL  Alcon SN60WF  +21.0D  SN 88213  ✔ Implanted           │ │
│     │ [ + Scan implant ]   Consumables: 6 recorded               │ │
│     └────────────────────────────────────────────────────────────┘ │
│     Intra-op note · Return to ward · Complete surgery              │
│ AM-2 Meena       OD  LASIK      Dr. Iyer  Sent to OT   Accept ▸    │
└────────────────────────────────────────────────────────────────────┘
```

**Data & action map**

| Element | FE | API | BE | DB | Module | Perm | Event |
|---|---|---|---|---|---|---|---|
| List (slot-ordered) | `useIpJourneysQuery` + `useSlotsQuery` | `GET /journeys`, `GET /ip-management/slots` | `ListAsync`, `SlotFunctions` | `patient_journey`, `journey_slot` | IP | `ip.view` | — |
| Accept in OT | `acceptInOT` | `POST /journeys/{id}/accept` | `AcceptInOtAsync` + `ValidateBillingGateForAcceptAsync` | `patient_journey` | IP | `ip.ot.accept` \| `ot.safety.sign` | realtime |
| Start surgery | `startSurgery` | `POST /journeys/{id}/start-surgery` | `StartSurgeryAsync` | `patient_journey` | IP | `ip.surgery.start` | realtime |
| WHO checklist | `OtSurgicalSafetyChecklist` | `/journeys/{id}/surgical-safety` | `SurgicalSafetyService` | `surgical_safety_checklist` | IP | `ot.safety.sign` |  |
| Intra-op note | `saveIntraOpNote` | `POST /journeys/{id}/intra-op` | `IntraOpNoteService` | `intra_op_note` | IP | `ot.safety.sign` | — |
| **Implant panel** | **S-07** | `POST /journeys/{id}/implants` | new handler | `journey_implant_usage` | IP | `ot.safety.sign` | `ImplantUsed` |
| Consumables recorded | read from inventory | `GET surgery/consumables?surgeryId=` | `SurgeryConsumableService` | `inv_surgery_consumables` | Inventory | tenant/user hdr | — |
| **Complete surgery** | `transitionClinical` | `POST /clinical-transition` | `TransitionClinicalAsync` | `patient_journey` | IP | `ip.surgery.complete` | `SurgeryCompleted` |
| Return to ward | `transitionClinical` → `ReadyForSurgery` | same | same | `patient_journey` | IP | `ip.ot.accept` | realtime |

**New pre-completion gate (soft).** Before `SurgeryCompleted`, show a reconciliation summary: *"1 implant, 6 consumables recorded. Charges post automatically."* If zero implants are recorded for a procedure whose package expects one, warn — **do not block**. Blocking the surgeon is never acceptable; the reconciliation report (S-15) is the safety net.

---

#### S-07 — OT Implant Scan · `ImplantScanPanel` (new)

**Primary:** surgeon, OT nurse. **Shell:** C, embedded in S-06.
**Purpose:** the wrong-implant control and the charge trigger, in one action.

```
┌─────────────────────────────────────────────┐
│ Record implant — Amit · OD · Retinal    ✕   │
├─────────────────────────────────────────────┤
│ Scan or enter barcode / UDI                 │
│ [ ▮ 08901234567890                      ]   │
│                                             │
│ Resolved                                    │
│   Alcon SN60WF · IOL · +21.0 D              │
│   Batch B-2291 · Serial 88213 · Exp 06/2028 │
│                                             │
│ Eye     (•) OD   ( ) OS      ← must match   │
│ Status  (•) Implanted                       │
│         ( ) Opened, not used                │
│         ( ) Wasted     ( ) Returned         │
│ Reason  [ required unless Implanted     ]   │
├─────────────────────────────────────────────┤
│ Implanted → charge posts automatically      │
│ Opened/Wasted → hospital write-off, no charge│  ← D2
├─────────────────────────────────────────────┤
│                    [Cancel]  [ Record ]     │
└─────────────────────────────────────────────┘
```

**Data & action map**

| Element | FE | API | BE | DB | Module | Perm | Event |
|---|---|---|---|---|---|---|---|
| Barcode resolve | `ipManagementApi.verifyIolBarcode` | `POST /journeys/{id}/verify-iol-barcode` | `VerifyIolBarcodeAsync` | `iol_catalog_master`, inventory batch | IP + Inventory | `ot.safety.sign` | — |
| Record usage | `ipManagementApi.recordImplant` (new) | `POST /journeys/{id}/implants` | new handler → usage service | **`journey_implant_usage`** | IP | `ot.safety.sign` \| `ip.surgery.complete` | `ImplantUsed` |
| Correct / reverse | `ipManagementApi.updateImplant` (new) | `PATCH /journeys/{id}/implants/{usageId}` | same | `journey_implant_usage` | IP | same | `ImplantUsageReversed` |
| → stock effect | outbox consumer | internal | `StockService` deduct / wastage | `inv_stock_ledger`, `inv_stock_batches` | Inventory | internal | — |
| → charge effect | outbox consumer, **only if `Implanted`** | `POST /api/internal/ip-billing/charge-items` | `OpdBillService` + `BillItemService` | `opd_bill_items` | Billing | internal key | `PatientObligationChanged` |
| Price resolution | — | — | MD-055 resolver → `variant_prices` | `service_variant_item_map` (new) | Billing | — | — |

**Validation.** Eye mismatch against `journey.EyeOperated` is a **hard block**. Serial already implanted elsewhere is a hard block. Journey must be `InOT` or `SurgeryCompleted`. Reason mandatory for any status other than `Implanted`. The clinical row and the outbox row commit in one transaction; stock and charge are eventually consistent so a Billing or Inventory outage never blocks theatre.

---

#### S-08 — Post-Op / Recovery · `WardPostOpWorkspaceModal`

**Primary:** recovery nurse. **Shell:** B. Content unchanged; gains dialog semantics and a permission split.

| Element | FE | API | BE | DB | Module | Perm |
|---|---|---|---|---|---|---|
| Nurse checklist | `saveNurseChecklist` | `/journeys/{id}/nurse-checklist` | `PostOpFunctions` | post-op checklist tables | IP | `ward.checklist.edit` |
| IOL sticker check | post-op checklist | `/journeys/{id}/post-op/iol-sticker` | `WardPostOpChecklistService` | `patient_journey.WardPostopIolChecks` | IP | `ward.checklist.edit` |
| IOL return | `recordIolReturn` | `/journeys/{id}/iol-returns` | `PostOpFunctions` | `iol_returns` → **migrate into `journey_implant_usage`** | IP | `ward.checklist.edit` |
| Post-op instructions | `savePostOpInstructions` | `/journeys/{id}/post-op-instructions` | `PostOpFunctions` | `post_op_instruction` | IP | `ward.checklist.edit` |
| Mark ready for discharge | `transitionClinical` | `POST /clinical-transition` | `TransitionClinicalAsync` | `patient_journey` | IP | **`ip.postop.manage`** (new split from `ip.discharge`) |

---

#### S-09 — Discharge Workspace · `WardDischargeSummaryModal`

**Primary:** ward nurse. **Shell:** B.

```
┌─ Discharge — Meena Iyer · Ready for discharge ──────────── ✕ ─┐
│ CLEARANCE                                                     │
│  ✔ Clinical   ✔ Post-op checklist   ✔ Discharge summary       │
│  ⛔ Patient due ₹10,000            [ Collect now (S-03) ]      │
│  ✔ Coverage — TPA settlement pending (does not hold the bed)  │
├───────────────────────────────────────────────────────────────┤
│ Discharge type [Routine ▾]                                    │
│ Summary [ ...auto-drafted, editable... ]                      │
├───────────────────────────────────────────────────────────────┤
│ Override available (admin) · reason required                  │
│                              [ Discharge patient ]            │
└───────────────────────────────────────────────────────────────┘
```

| Element | FE | API | BE | DB | Module | Perm | Event |
|---|---|---|---|---|---|---|---|
| Blockers by category | `discharge-blocker-categories` | `GET /transition-gates?newState=Discharged` | `ChecklistGateService` | mixed | IP | `ip.view` | — |
| Patient due | `getFinancialSummary` | `/financial-summary` | `PatientObligationCalculator` | `opd_bills`, `opd_bill_payments` | Billing | `ip.view` | — |
| Summary | `saveDischargeSummary` | `/journeys/{id}/discharge-summary` | `PostOpFunctions` | `discharge_summary` | IP | `ward.checklist.edit` | — |
| Discharge | `dischargeWithType` | `POST /journeys/{id}/discharge` | `DischargeWithTypeAsync` | `patient_journey`, bed vacate | IP + Auth | `ip.discharge` | `PatientClinicallyDischarged` |
| Override | S-17 | `PUT /discharge-override` | `ApplyDischargeOverrideAsync` | `patient_journey` | IP | `ip.discharge.override` | — |
| Cancel discharge | `cancelDischarge` | `POST /cancel-discharge` | `CancelDischargeAsync` | `patient_journey` | IP | `ip.discharge.cancel` | — |

**Rule preserved from SoT Phase 9:** the gate is **patient obligation only**. TPA settlement pending must never hold a bed, and the UI must say so explicitly.

---

#### S-10 — Journey Detail · `/dashboard/ip-management/journey/[id]`

**Primary:** coordinator, auditor. **Shell:** full-page split (stepper left, tabs right). **Change:** the billing tab becomes **read-only**.

| Tab | API | BE | DB | Change |
|---|---|---|---|---|
| Overview | `getJourneyDetail` | `GetDetailAsync` | `patient_journey` | — |
| Ward | `updateWardAssignment` | `UpdateWardAssignmentAsync` | `patient_journey`, beds | — |
| Pre-op | pre-op reads | `PreOpFunctions` | pre-op chain | — |
| **Billing** | `getFinancialSummary` + `listBilling` | Auth internal summary | `opd_bills`, `opd_bill_payments` | **Remove `handleAddTransaction`**; read-only + "Open billing" (FE-005) |
| **Implants** (new) | `listImplants` | new handler | `journey_implant_usage` | New tab |
| OT | intra-op reads | `IntraOpNoteService` | `intra_op_note` | — |
| Post-op | post-op reads | `PostOpFunctions` | post-op tables | — |
| Discharge | discharge summary | `PostOpFunctions` | `discharge_summary` | — |
| Audit | `getJourneyAudit` | `GetAuditLogsAsync` | `journey_audit_log` | — |

---

#### S-11 — IP Billing Dashboard · `/dashboard/ip-management/billing`

**Primary:** finance, billing executive. **Status:** correct (reads the ledger); only the access resolver changes.

| Element | FE | API | BE | DB | Module | Perm |
|---|---|---|---|---|---|---|
| KPIs, aging, payer mix, pipeline | `useIpBillingDashboardQuery` | `GET /opdbills/ip-dashboard` | `OpdBillService.GetIpBillingDashboardAsync` → `IpBillingDashboardCalculator` | `opd_bills`, `opd_bill_payments` | Billing | `bill.view` \| `opd_bill.view` \| `bill.update` \| `ip.view` |
| Unbilled activity tile | same query (`unbilledActivity*`) | same | `IChargeReconciliationService.GetUnbilledActivityAsync` (S-15, catalog prices) | `journey_implant_usage`, `inv_surgery_consumables` | Billing | `bill.view` |
| Charge status column | `chargeStatus` / `chargeStatusLabel` | same | `GetChargeStatusByJourneyAsync` (batch, not N+1 completeness) | same + `charge_exception` | Billing | finance/full only |
| Column scope | `resolveBillingDashboardAccess` | — | — | — | FE | **fail-closed after SEC-041** |
| Row → bill | deep link | — | — | — | FE | `bill.view` |

Unbilled activity is implants implanted and consumables issued in the dashboard window whose charge status is not Posted/Credited. Amounts are catalog (`variant_prices` via MD-055), never purchase rate. Unmapped open exceptions are counted separately and shown on the row as “N unmapped”.

---

#### S-12 — Bill Detail · `/dashboard/billing/opd`

**Primary:** billing executive, cashier. **Shell:** full page. **Two changes, both load-bearing.**

```
┌─ Bill IPD-2026-00841 · Meena Iyer · Journey UAT-002 ──────────────┐
│ ← Back to IP Management            Status: Partially paid         │
├───────────────────────────────────────────────────────────────────┤
│ ▾ PACKAGE                                        ₹1,00,000        │  ← D1 exploded
│    Phaco surgery                    1 × 62,000     62,000         │
│    IOL (package allowance)          1 × 18,000     18,000         │
│    OT charges                       1 × 12,000     12,000         │
│    Day care bed                     1 ×  8,000      8,000         │
│    Package discount                            −    0             │
│ ▾ IMPLANTS                                          ₹14,000       │
│    Alcon SN60WF +21.0D  SN 88213    1 × 14,000     14,000         │  ← from S-07
│ ▾ CONSUMABLES (6)                                    ₹6,000       │  ← D4 itemised
│    Viscoelastic · Phaco cassette · Blade · Trypan …               │
│ ▸ PROCEDURE / OTHER                                      ₹0       │
├───────────────────────────────────────────────────────────────────┤
│ Gross 1,20,000 · Discount 0 · Tax 0 · Net 1,20,000                │
│ Payer share 80,000 · Collected 30,000 · Patient due 10,000        │
├───────────────────────────────────────────────────────────────────┤
│ ⚠ 1 consumable is unmapped and not charged → Charge exceptions    │  ← MD-055
├───────────────────────────────────────────────────────────────────┤
│ [Add item] [Discount] [Collect] [Refund] [Finalize]               │
└───────────────────────────────────────────────────────────────────┘
```

| Element | FE | API | BE | DB | Module | Perm | Event |
|---|---|---|---|---|---|---|---|
| **Deep-link context** | `useSearchParams()` (**FE-003**) | `GET /opdbills/{id}` | `OpdBillsController` | `opd_bills` | Billing | `bill.view` | — |
| **Grouped line items** | new grouped renderer (**BILL-030**) | `GET /api/BillItems/bill/{billId}` | `BillItemService` | `opd_bill_items` | Billing | `bill.view` | — |
| Add item | `addBillItem` | `POST /api/BillItems` | `BillItemService.AddBillItemAsync` | `opd_bill_items` | Billing | `bill.update` | — |
| Payment | `addPayment` | `POST /opdbills/payment` | `AddPaymentAsync` | `opd_bill_payments` | Billing | `bill.update` | `PaymentReceived` |
| Discount | `applyDiscount` | `POST /opdbills/discount` | `ApplyDiscountAsync` | `opd_bill_payments` (`Discount` line) | Billing | `bill.update` | `PatientObligationChanged` |
| Refund | refund workflow | `/api/Refunds/*` | `RefundService` | `refunds`, `opd_bill_payments` | Billing | `opd_bill.refund` (+ authorize) | `RefundCreated` |
| Finalize | `finalizeBill` | `POST /opdbills/{id}/finalize` | `FinalizeBillAsync` | `opd_bills` | Billing | `bill.update` | `BillFinalized` → CCMS |
| Charge-completeness warning | S-15 feed | reconciliation API | reconciliation job | `opd_bill_items`, `journey_implant_usage`, `inv_surgery_consumables` | Billing | `bill.view` | — |

---

#### S-13 — Day-Care Slot Board · `/dashboard/ip-management/slots` (new)

**Primary:** IP coordinator, OT coordinator. **Purpose:** staggered arrival and session batching — the throughput model RCOphth/GIRFT high-flow guidance depends on and the system currently cannot express.

```
┌─ Slot board · 24 Aug · Theatre 1 ─────────────────────────────────┐
│  MORNING (07:30–12:30)                    AFTERNOON (13:30–17:00) │
│ ┌───────────────────────────────┐  ┌────────────────────────────┐ │
│ │ 1 Amit      Retinal  OD 07:15 │  │ 1 Kavya   Cataract OS 13:15│ │
│ │   ✔ Ready                     │  │   ⛔ PAC pending            │ │
│ │ 2 Meena     LASIK    OD 07:45 │  │ 2 …                        │ │
│ │   ⛔ Consent                   │  │                            │ │
│ │ 3 Ananya    Corneal  OS 08:15 │  │ [ + Assign patient ]       │ │
│ └───────────────────────────────┘  └────────────────────────────┘ │
│ Unassigned (4): Harsh · Tara · …    drag to a slot                │
├───────────────────────────────────────────────────────────────────┤
│ Ready 8/12 · Avg arrival→discharge 58m · Turnover 6m              │
└───────────────────────────────────────────────────────────────────┘
```

| Element | FE | API | BE | DB | Module | Perm |
|---|---|---|---|---|---|---|
| Board | `useSlotsQuery` | `GET /ip-management/slots?date=&theatreId=` | `SlotFunctions` (new) | `journey_slot` (new) | IP | `ip.view` |
| Assign / reorder | `assignSlot`, `reorderSlot` | `POST/PATCH /ip-management/slots` | `SlotFunctions` | `journey_slot`, `patient_journey.slot_id` | IP | `ip.ot.send` \| `ward.checklist.edit` |
| Readiness chip | gates per journey | `GET /transition-gates` | `ChecklistGateService` | pre-op chain | IP | `ip.view` |
| Throughput metrics | slot + journey timestamps | `GET /ip-management/slots/metrics` | `SlotFunctions` | `journey_slot`, `patient_journey` | IP | `ip.view` |

**Constraint.** Unique `(tenant_id, theatre_id, slot_date, session, sequence_no)`; reorder is a transactional resequence, audited. A patient past `SentToOT` cannot be reassigned.

---

#### S-14 — Charge Exception & Catalog Mapping · `/dashboard/admin/charge-mapping` (new)

**Primary:** billing admin. **Purpose:** decisions D1 and D4 make catalog mapping mandatory; this is where unmapped items are resolved before they become lost revenue.

```
┌─ Charge mapping ──────────────────────────────────────────────────┐
│ Unmapped items in use (last 90 days)              [Only blocking] │
├───────────────────────────────────────────────────────────────────┤
│ ITEM                     TYPE        USES  LAST USED   MAP TO     │
│ Trypan Blue 0.06%        Consumable   142  24 Aug   [select ▾][✔] │
│ Phaco cassette Centurion Consumable   138  24 Aug   [select ▾][✔] │
│ Premium IOL PanOptix     IOL           12  23 Aug   [select ▾][✔] │
├───────────────────────────────────────────────────────────────────┤
│ Blocked charges awaiting mapping: 14 · est. ₹86,400               │
└───────────────────────────────────────────────────────────────────┘
```

| Element | FE | API | BE | DB | Module | Perm |
|---|---|---|---|---|---|---|
| Unmapped list | `useChargeExceptionsQuery` | `GET /api/ChargeMapping/exceptions` | new admin service | `charge_exception` (new) | Billing | `bill.admin` |
| Create mapping | `createItemMapping` | `POST /api/ChargeMapping` | MD-055 resolver admin | `service_variant_item_map` (new) | Billing | `bill.admin` |
| Replay blocked charges | `replayExceptions` | `POST /api/ChargeMapping/replay` | charge poster | `opd_bill_items` | Billing | `bill.admin` |

---

#### S-15 — Reconciliation & Wastage · `/dashboard/admin/charge-reconciliation` (new)

**Primary:** finance, stores. **Purpose:** the safety net that makes asynchronous charge capture trustworthy, plus the wastage visibility that decision D2 requires.

```
┌─ Charge reconciliation · 24 Aug ──────────────────────────────────┐
│ ① Implanted, not charged      3   ₹42,000   [review]              │
│ ② Charged, not implanted      0        ₹0                         │
│ ③ Stock out, no usage         2        —    [review]              │
│ ④ Package/consumable overlap  1    ₹1,200   [review]              │
│ ⑤ Unmapped items             14   ₹86,400   → S-14                │
├───────────────────────────────────────────────────────────────────┤
│ WASTAGE (write-offs, no patient charge)                           │
│ Wrong power 2 · Capsule rupture 1 · Damaged 1   cost ₹38,000      │
│ by surgeon · by item · by month                    [export]       │
└───────────────────────────────────────────────────────────────────┘
```

| Element | FE | API | BE | DB | Module | Perm |
|---|---|---|---|---|---|---|
| Buckets 1–4 | `useReconciliationQuery` | `GET /api/ChargeReconciliation` | daily job + on-demand query | `journey_implant_usage`, `inv_stock_ledger`, `opd_bill_items` | Billing | `bill.view` + `bill.admin` for actions |
| Bucket 5 | link to S-14 | — | — | `charge_exception` | Billing | `bill.admin` |
| Wastage report | `useWastageQuery` | `GET /api/ChargeReconciliation/wastage` | reconciliation service | `journey_implant_usage` (status + reason), `inv_stock_ledger` | IP + Inventory | `bill.view` |

---

#### S-16 — Integration Health · `/dashboard/admin/integration-health` (new)

**Primary:** IT admin. **Purpose:** both outboxes can reach `Dead` after 8 retries today with no operator visibility.

| Element | FE | API | BE | DB | Module | Perm |
|---|---|---|---|---|---|---|
| IP outbox stats | `useOutboxStatsQuery` | `GET ip-management/integration/outbox/stats` | `OutboxFunctions` | `integration_outbox_event` | IP | `integration.admin` |
| Billing outbox stats | new | `GET /api/internal/billing-outbox/stats` | `BillingCcmsOutboxService.GetStats` | `billing_ccms_outbox` | Billing | `integration.admin` |
| Dead-letter list + requeue | `requeueEvent` | `POST …/requeue` | outbox services | both outbox tables | Both | `integration.admin` |

---

#### S-17 — Reason-Required Confirmation · `ReasonConfirmDialog` (shared)

**Shell:** C, Radix `AlertDialog`. **Used by:** un-mark ready, cancel today, cancel admission, Emergency FC, discharge override, implant reversal, refund request.

```
┌─ Revert "Ready for OT"? ──────────────────────────┐
│ Meena Iyer · UAT-002                              │
│ The OT team will be notified and the patient will │
│ return to Admitted.                               │
│                                                   │
│ Reason (required)                                 │
│ [ BP 180/100, deferred pending physician review ] │
│                                                   │
│ Recorded against your user and audited.           │
│                    [Cancel]  [ Revert to Admitted]│
└───────────────────────────────────────────────────┘
```

**Contract.** Props: title, consequence sentence, minimum reason length, destructive flag, confirm label. Every consumer writes a `journey_audit_log` row with the reason and a correlation id. The primary button stays disabled until the reason meets minimum length. This one component removes six bespoke inline forms.

---

#### S-18 — Coverage Context Block · `CoverageContextBlock`

**Embedded in:** S-02, S-05 step 8, S-10. **Read-only by design** — IP never mutates coverage.

| Element | FE | API | BE | DB | Module | Perm |
|---|---|---|---|---|---|---|
| Coverage status chip | `getPreauthStatus` | `GET /journeys/{id}/financial/preauth-status` | `GetPreauthStatusAsync` → `CcmsAdmissionClient` | `ccms_coverage_cases` | CCMS | `ip.view` |
| Payer share | `getFinancialSummary` | `/financial-summary` | `PatientObligationCalculator` | `ccms_billing_summaries` → `opd_bills.insurance_claim_amount` | CCMS → Billing | `ip.view` (hidden for clinical persona) |
| Block reason | preauth DTO | same | `CoverageStatusClassifier` | `ccms_coverage_authorizations` | CCMS | `ip.view` |
| Open coverage case | deep link to CCMS workspace | — | — | — | CCMS | `ccms.*` |

**Copy rule.** Use `coverage-payment-terminology.ts` labels consistently: *Coverage status* ≠ *Patient payment* ≠ *Clinical discharge*. Conflating them is what produced the current panel's confusing "What is covered?" block.

### 20.7 Cross-screen traceability

Every screen resolves to existing or specified backend surface. Nothing in the design requires an unowned capability.

| Capability | Screens | API | Service | DB | Owner |
|---|---|---|---|---|---|
| Journey read | S-01, S-02, S-04, S-06, S-10, S-13 | `GET /ip-management/journeys*` | `PatientJourneyService` | `patient_journey` | IP |
| Clinical transition | S-02, S-04, S-05, S-06, S-08 | `POST /clinical-transition` | `TransitionClinicalAsync` | `patient_journey`, `journey_audit_log` | IP |
| Gate preflight | S-02, S-05, S-09, S-13 | `GET /transition-gates` | `ChecklistGateService` | pre-op chain | IP |
| Bed lifecycle | S-02, S-04, S-09 | `POST /api/internal/ip-beds/lifecycle` | `BedLifecyclePolicy` | `bed_inventory`, `journey_bed_assignment` | Auth |
| Financial read | S-02, S-03, S-09, S-11 | `/financial-summary`, `/opdbills/ip-dashboard` | `OpdBillService`, calculators | `opd_bills`, `opd_bill_payments` | Billing |
| Financial write | S-03, S-12 | `/api/OpdBills/*` | `OpdBillService` | `opd_bill_payments`, `opd_bill_items` | Billing |
| Charge capture | S-07, S-12, S-14, S-15 | `/api/internal/ip-billing/charge-items` | `BillItemService` | `opd_bill_items` | Billing |
| Implant registry | S-06, S-07, S-08, S-10, S-15 | `/journeys/{id}/implants` | new usage service | `journey_implant_usage` | IP |
| Coverage read | S-02, S-05, S-09, S-18 | `/financial/preauth-status` | `CcmsAdmissionClient` | `ccms_*` | CCMS |
| Slot management | S-01, S-06, S-13 | `/ip-management/slots` | `SlotFunctions` | `journey_slot` | IP |
| Audit | S-02, S-10, S-17 | `/journeys/{id}/audit` | `GetAuditLogsAsync` | `journey_audit_log` | IP |
| Realtime | all list screens | SignalR `/notificationHub` | `NotificationHub` | — | Auth |
| Integration ops | S-16 | outbox stats/requeue | outbox services | both outbox tables | IP + Billing |

### 20.8 Visual and content rules

- One accent colour (blue). Semantic colour only for status: teal in-house, amber OT, red blocker/due, orange Emergency FC, rose cancelled.
- One filled primary button per surface; everything else outline/ghost; destructive = outline red with reason.
- Minimum 12 px body text; no 9–10 px on clinical or financial data. Status never conveyed by colour alone.
- Remove internal jargon from user-facing copy: no permission codes, no "OpdBill", no "What can I do?" headings. Use Location, Blockers, Actions, Payments, Coverage, Activity.
- Adopt Radix `Dialog`/`Sheet` from `src/components/ui`; retire hand-rolled `fixed inset-0` overlays. Standardise on **one** toast library.

---

## 21. Phased Implementation Plan

### Phase 0 — Safety and correctness (P0, no new features)

**Objective:** make RBAC real, stop the second set of books, and unblock the cashier path.

> Decisions D1–D4 (§26) are binding from Phase 2 onward. As a result, Phase 2 now opens with **TASK MD-055** (catalog mapping, gates BILL-031 and INV-050), and **TASK BILL-033** (authorised cashier bill creation) joins Phase 1.

| Area | Work |
|---|---|
| Database | Seed all missing IP + billing permission codes; create role→permission bundles including **Cashier** |
| Backend | `[RequirePermission("bill.admin")]` on billing-rules routes; financial audit fail-closed |
| Frontend | Remove fail-open defaults (`operational`, `canBill`, `resolveBillingDashboardAccess`); `/billing/opd` reads search params; remove `AddTransactionForm` from `PatientQuickPanel` and the journey billing tab |
| Tests | RBAC matrix per persona; deep-link e2e; assert no UI path calls `addBilling` |
| Risk | Users may lose access if bundles are wrong → ship behind a migration that grants existing effective permissions first, then tighten |
| Rollback | Permission seed is additive; UI changes revertible per component |

### Phase 1 — Census UX and Mark Ready (P0/P1)

Split pane + a11y + persona rail + preflighted one-click Mark Ready + `ip.ot.unmark_ready` + `JourneyReadyForOt` event + cashier collect drawer (Billing API). Depends on Phase 0.

### Phase 2 — Charge capture foundation (P0)

`opd_bill_items.source_type/source_ref_id/idempotency_key` + grouped bill rendering (BILL-030); **catalog mapping for package components and consumables (MD-055 — first, gates the rest)**; internal batch charge endpoint (BILL-032); exploded package on `ensure-bill` per D1 (BILL-031); `OpdBill.RowVersion`. Depends on nothing in Phase 1 — can run in parallel.

### Phase 3 — Implant registry and OT scan (P0)

`journey_implant_usage`; OT scan UI; `ImplantUsed`/`ImplantUsageReversed` events; inventory stock decrement; Billing charge line; wastage/return handling. Depends on Phase 2.

### Phase 4 — Consumables and reconciliation (P0/P1)

`inv_surgery_consumables.journey_id` + charge status; `ConsumablesConsumed` → charge; daily three-way reconciliation job + exception report; pre-finalize charge completeness check. Depends on Phase 3.

### Phase 5 — Day-care throughput (P1)

`journey_slot`; recliner/chair bed types; `bed_inventory.ward_id` FK; slot board; staggered arrival; Ready-for-OT queue ordered by slot.

### Phase 6 — Coverage reconciliation and reporting (P1/P2)

Apply (not ack) payment/obligation events in CCMS; settlement vs collection reconciliation; implant reconciliation report; slot throughput and arrival-to-discharge metrics. **RPT-080** surfaces unbilled activity on S-11 from the existing S-15 reconciliation service and adds `GET /ip-management/slots/throughput` for the period report (one-day board metrics stay on `/slots/metrics`).

### Phase 7 — Platform hygiene (P1/P2)

IP EF migrations or a schema-drift CI check; replace runtime `EnsureSchemaAsync` with versioned migrations; unify toast/dialog libraries; ward board on react-query; integration dead-letter admin page.

---

## 22. Cursor-Ready Implementation Tasks

Each task is independently promptable. Phase and dependencies are stated. All tasks inherit the repo rule: trace FE → API → BE → DB → integrations; validate transitions server-side; make financial operations auditable; run build, lint, type-check, migrations, tests.

**Task ↔ screen index.** Every UI task points at a specification in §20.6; every screen has an owning task. Use the screen spec as the acceptance reference when prompting.

| Task | Screens (§20.6) | Backend / data surface |
|---|---|---|
| SEC-040 | all (persona bundles) | `permissions`, `role_permissions` |
| SEC-041 | S-01, S-02, S-11 | — (frontend resolvers) |
| SEC-042 | S-12 | `OpdBillsController` rules routes, audit |
| FE-003 | **S-12** | `GET /opdbills/{id}` |
| IP-001 | **S-01** | — (layout, a11y, URL state) |
| IP-002 | **S-02**, S-18 | gates + financial summary + preauth reads |
| IP-010 | S-01, **S-02** | `GET /transition-gates` |
| IP-011 | S-02, S-04, **S-17** | `POST /clinical-transition` + new guard |
| IP-012 | S-06, S-13 | `integration_outbox_event` |
| IP-013 | **S-13**, S-01, S-06 | `journey_slot`, `SlotFunctions` |
| BILL-030 | **S-12** | `opd_bill_items`, `OpdBill.RowVersion` |
| BILL-031 | S-12 | `EnsureInpatientBillAsync` explosion |
| BILL-032 | S-07, S-12 | `charge-items` internal endpoint |
| BILL-033 | **S-03** | `POST /api/OpdBills/ip-ensure` |
| MD-055 | **S-14** | `service_variant_item_map`, `charge_exception` |
| OT-020 | **S-07**, S-06, S-08, S-10 | `journey_implant_usage` |
| INV-050 | S-06, S-12 | `inv_surgery_consumables` → charges |
| INV-051 | **S-15**, S-11, S-12 | reconciliation job + wastage report |
| RPT-080 | **S-11**, S-13, S-15 | unbilled tile, charge status, slot throughput |
| FE-004 | **S-03**, S-02 | `POST /opdbills/payment` |
| FE-005 | **S-10** | deprecate `addBilling` UI path |
| DB-004 | S-04, S-13 | `bed_inventory.ward_id`, recliner types |
| DB-005 | — | migrations / drift CI |
| CCMS-060 | S-11, S-18 | CCMS integration handlers |
| OPS-070 | **S-16** | outbox stats + requeue |
| UX-090 | S-04, S-06, S-08, S-09, **S-17** | Radix primitives, one toast system |

---

### TASK SEC-040 — Seed IP and billing permissions with role bundles

**Phase:** 0 · **Priority:** P0 · **Depends on:** none

**Objective:** Make the permission codes already enforced in code actually exist, and define role bundles per persona (including Cashier), so least privilege becomes real instead of collapsing onto `ward.checklist.edit`.

**Database:** New migration `consolidated/migrations/1xx_ip_billing_rbac_seed.sql`, idempotent (`WHERE NOT EXISTS`), following the pattern of `141_rbac_repair.sql`:
- Insert permissions: `ip.view`, `ip.admit`, `ip.bed.transfer`, `ip.ot.mark_ready`, `ip.ot.unmark_ready`, `ip.ot.send`, `ip.ot.accept`, `ip.surgery.start`, `ip.surgery.complete`, `ip.postop.manage`, `ip.discharge`, `ip.discharge.override`, `ip.billing.collect`, `ip.billing.refund`, `ip.billing.adjust`, `bill.create`, `bill.update`, `bill.view`, `bill.admin`, `opd_bill.view`, `opd_bill.refund`, `opd_bill.refund.authorize`.
- Insert `role_permissions` bundles: Nurse, Ward Clerk, IP Coordinator, OT Coordinator, Surgeon, **Cashier** (`ip.view`, `ip.billing.collect`, `bill.view`, `bill.update`, `bill.create`, `opd_bill.view` — `bill.create` per decision D3, which allows a cashier to create the IP bill for an admitted patient who has none), Billing Executive, TPA Executive, Finance, Admin.
- **Grandfather step first:** grant the new IP codes to every role that currently holds `ward.checklist.edit` or `ot.safety.sign`, so no one loses access on deploy. Tightening is a separate, reviewed migration.

**Backend:** No code change; verify `PermissionService` resolves the new codes into the JWT `permission` claim.

**Permissions:** This task *is* the permission model.

**Acceptance criteria:**
- Every code referenced in `IpChecklistAuth.cs` and `ip-role-actions.ts` exists in `permissions`.
- A user in the Cashier bundle can open the IP census and collect payment, and cannot admit, mark ready, send to OT or discharge.
- A user in the Nurse bundle can run the clinical path and cannot refund or adjust.
- Re-running the migration is a no-op.

**Tests:** SQL verification script (pattern of `_verify_ward_migrations.sql`); `AuthService.Tests` role→permission resolution; `IpManagementService.Tests/RoleActionAuthTests` extended per persona; e2e login-as-cashier and login-as-nurse capability assertions.

---

### TASK SEC-041 — Remove frontend fail-open permission defaults

**Phase:** 0 · **Priority:** P0 · **Depends on:** SEC-040

**Objective:** Stop granting capability when the JWT permission claim is empty.

**Frontend:**
- `src/lib/ip-management/ip-role-actions.ts` — `operational()` must not return `true` for an empty list; remove `|| list.length === 0` from `canBill`.
- `src/lib/ip-management/billing-dashboard-access.ts` — remove the `roles.length === 0 && perms.length === 0 → 'full'` branch; default to the most restrictive scope.
- `src/hooks/use-ip-checklist-permissions.ts` — `canWard()` fails closed.
- Add a single dev escape hatch: `NEXT_PUBLIC_PERMISSIONS_FAIL_OPEN=true`, only honoured when `NODE_ENV !== 'production'`, logged loudly.

**Backend:** none (server already fail-closed).

**Acceptance criteria:** With an empty permission claim, no IP mutation button renders and the billing dashboard shows the ward scope. UAT/dev with the flag set behaves as today.

**Tests:** Unit tests per helper for empty / wildcard / partial claims; e2e for a permissionless user.

---

### TASK SEC-042 — Protect billing rules routes and make financial audit fail-closed

**Phase:** 0 · **Priority:** P1 · **Depends on:** SEC-040

**Backend:** Add `[RequirePermission("bill.admin")]` to the `/api/OpdBills/rules*` GET/POST/PUT/DELETE actions in `OpdBillsController`. In `OpdBillService`, financial audit writes currently swallow failures; make audit write inside the same `SaveChangesAsync` so a failed audit fails the money mutation.

**Acceptance criteria:** Unauthorised rule CRUD returns 403; a forced audit failure rolls back the payment.

**Tests:** Controller authorization tests; a service test with an audit repository that throws.

---

### TASK FE-003 — Make `/dashboard/billing/opd` honour IP deep links

**Phase:** 0 · **Priority:** P0 · **Depends on:** none

**Objective:** Every IP surface already links with `?billId=` / `?patientId=` / `?journeyId=`; the page ignores them. Fixing this removes most of the reason billing UI keeps leaking into IP.

**Frontend:** In `src/app/dashboard/billing/opd/page.tsx` read `useSearchParams()`:
- `billId` → fetch and auto-select that bill.
- `journeyId` (no `billId`) → resolve the IP bill via the journey financial summary; if none, pre-fill the create flow.
- `patientId` → filter to that patient.
- Show a "Back to IP Management" affordance carrying `journeyId`.
- Wrap in `<Suspense>` as required for `useSearchParams` in the App Router.

**Acceptance criteria:** Clicking "Open billing" from the census lands on the correct bill with the payment action reachable in one further click.

**Tests:** e2e — census → open billing → correct bill selected; journey with no bill → create flow pre-filled.

---

### TASK IP-001 — Replace the census overlay with a docked split pane

**Phase:** 1 · **Priority:** P0 · **Depends on:** none

**Objective:** Stop hiding the census behind a blur backdrop; keep the coordinator's list visible while inspecting a patient.

**Frontend:**
- `src/app/dashboard/ip-management/page.tsx` — two-column grid at ≥1280 px (list, then a fixed 440 px pane); below that render the rail as a Radix `Sheet` with dim (no blur); below 1024 px render rows as cards that navigate to S-10.
- `src/components/ip-management/PatientQuickPanel.tsx` — delete both the `fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]` backdrop and the `fixed right-0 top-0 bottom-0 z-50 w-[380px]` positioning; the component becomes layout-agnostic and receives its presentation mode as a prop. It must no longer render above the app header.
- Table sheds its lowest-priority columns when the pane is open rather than horizontally scrolling.
- Add `role="region"`/`aria-label` in docked mode and `role="dialog"` + `aria-modal` + `useFocusTrap` + Escape in sheet mode.
- Keyboard: `j`/`k` and ↑/↓ move row selection, `Enter` opens, `Esc` clears, `/` focuses search; `aria-selected` on the selected row.
- URL state `?tab=&patient=&fin=`; selection moves out of `useState` so refresh, back and link-sharing all work.

**Backend / DB / Integration:** none.

**Permissions:** unchanged.

**Acceptance criteria:** With the rail open the table remains readable and scrollable; no scrim or blur is rendered at ≥1280 px and the app header stays visible and clickable; Escape closes only in sheet mode; refresh restores the selected patient and the URL carries `?patient=`; the identification banner stays fixed while the pane body scrolls, and no field within it is truncated at 440 px; axe reports no new violations.

**Tests:** e2e for split-pane visibility, keyboard navigation, URL restore, and absence of a scrim element at desktop width; a unit test asserting a journey with a null operating eye renders the laterality blocker rather than an empty banner slot; a11y assertions mirroring `ip-ward-preop-workspace.spec.ts:136`.

---

### TASK IP-002 — Rebuild the patient context rail (content, hierarchy, persona)

**Phase:** 1 · **Priority:** P0 · **Depends on:** IP-001, SEC-040

**Objective:** Turn a pastel action dump into a clinical context panel with one primary action.

**Frontend:**
- New `src/lib/ip-management/ip-persona.ts` → `resolveIpPersona(permissions, roles)` returning `'ward' | 'coordinator' | 'cashier' | 'clinical' | 'admin'`. Permission-first, role-string fallback. **Emphasis only — not a security boundary.**
- Rail sections in order: **patient identification banner** → status badges → location + next action + owner (`buildIpRowSituation`) → blockers grouped by `discharge-blocker-categories` → money block (read-only, one "Open billing" link) → coverage line → 3 recent activity events + "View all" → pinned footer with **one** primary action plus "Open full record".
- The identification banner (§20.1.1) is a distinct sub-component, `PatientIdentificationBanner`: pinned, non-scrolling, no truncation or ellipsis on any field. Renders name, UHID (monospace), age, sex, DOB, the clinical alert strip, and the operating eye as a bordered block spelling out `RIGHT`/`LEFT` above the `OD`/`OS` abbreviation. Laterality must not be communicated by colour alone, and a null value renders as the blocker "Operating eye must be recorded before theatre" rather than as an empty slot. The banner is persona-invariant except for the alert strip, which is omitted for the cashier persona.
- Delete `MiniStepper` (it misrepresents 9 states as 5); replace with the location line plus clinical/OT badges.
- Delete `AddTransactionForm` from this component.
- Collapse the four billing CTAs into one destination.
- Remove jargon: no permission codes, no "OpdBill", no question headings.
- Persona ordering per §20.3.
- Minimum 12 px body text.

**Backend:** required for the alert strip only — everything else in the banner is already available.

- `PatientJourneyRowDto` already carries `eyeOperated`, `uhid`, `patientName`, `patientDob` and `patientAge`, so laterality and the identifiers need no API change.
- **Gap:** there is no patient-level allergy or risk-flag source to drive the alert strip. The only allergy fields in the system today are `allergyKnown` / `allergyDetails` on `BeforeAnaesthesiaSectionDto` — captured at the WHO sign-in *inside theatre*, which is both far too late for a census banner and scoped to a checklist rather than to the patient. Surfacing an alert strip therefore requires a patient-level clinical alert source (allergies, anticoagulation, diabetes) exposed on the journey row. Until that exists the strip must render **nothing at all** rather than an empty or "no known allergies" state, because an absent alert must never be presented as a cleared one.

**Acceptance criteria:** Exactly one filled primary button; exactly one billing link; no permission code strings in rendered text; cashier persona shows no clinical action; nurse persona shows no refund/adjust; a journey with a null `eyeOperated` renders the laterality blocker; the alert strip is absent rather than reassuring when no alert source is wired.

**Tests:** Component tests per persona snapshot; e2e assertions on single-primary-action and single-billing-link; unit tests for null laterality and for absent-vs-cleared alert rendering.

---

### TASK IP-010 — Preflight Mark Ready in the census (one click, no blind failure)

**Phase:** 1 · **Priority:** P1 · **Depends on:** IP-002

**Objective:** Keep one-click Mark Ready but tell the user *before* the click when it cannot succeed.

**Frontend:**
- On row selection call `ipManagementApi.getTransitionGates(journeyId, 'ReadyForSurgery')` (endpoint exists) via react-query with a short `staleTime`.
- If blocked: disable the primary button, list hard blocks, and render "Open step" links into `WardPreOpWorkspaceModal` at the relevant step — reuse the presentation of `PreOpMarkReadyFooter`.
- If clear: single click calls `transitionClinical`. Do **not** send `acknowledgeWarnings: true` blindly; send it only after the user acknowledges a shown warning.
- Optimistic row state with rollback on 409/400; surface `formatApiError` text, never a raw exception.

**Backend:** none required. Optionally add `POST /ip-management/journeys/transition-gates/batch` if per-row preflight proves chatty on a 155-row census.

**Acceptance criteria:** A patient with unsigned consent shows a disabled button and the reason before any click; a clear patient transitions in one click; a stale row returns 409 and refetches.

**Tests:** Unit tests for gate→UI mapping; e2e for blocked and clear paths, including a concurrency conflict.

---

### TASK IP-011 — Add reversible Mark Ready (`ip.ot.unmark_ready`)

**Phase:** 1 · **Priority:** P1 · **Depends on:** SEC-040

**Objective:** Day-care patients become ineligible after being marked ready (BP, drops not instilled, late consent withdrawal). Today the only exit is cancel/rebook.

**Backend:**
- `StateTransitionValidator.ClinicalAllowed[ReadyForSurgery]` gains `Admitted`.
- Guard in `TransitionClinicalAsync`: allowed only while `OtState == NotSent`; **reason required** (min length); permission `ip.ot.unmark_ready`.
- Reverse `WardChecklistAutoSyncService` auto-completion of `informed_ot_team`.
- Audit row action `ClinicalStateReverted` with reason and correlation id.
- Notify OT + ward dept (fire-and-forget, existing client).
- Emit outbox `JourneyReadyReverted`.

**Database:** `patient_journey` gains `unmark_ready_reason`, `unmarked_ready_at`, `unmarked_ready_by_user_id` (nullable — backward compatible).

**Frontend:** Secondary action in the rail and in the ward drawer, reason-required confirmation dialog.

**Acceptance criteria:** Revert allowed from `ReadyForSurgery` only while not sent to OT; rejected without reason; rejected without permission; audit and event recorded.

**Tests:** `StateTransitionValidatorTests` new edge; service tests for guard/reason/permission; e2e revert then re-mark.

---

### TASK IP-012 — Emit `JourneyReadyForOt`

**Phase:** 1 · **Priority:** P1 · **Depends on:** none

**Backend:** In `TransitionClinicalAsync`, when the new state is `ReadyForSurgery`, `IntegrationOutboxService.Enqueue` with event type `JourneyReadyForOt`, `LifecycleEventPayload`, idempotency key `JourneyReadyForOt:{journeyId}:{readyAtTicks}`. Add the type to `IntegrationOutboxEvent` event-type constants. CCMS consumption is optional (ack-only initially) — the primary consumers are the OT board and throughput analytics.

**Acceptance criteria:** Exactly one outbox row per mark-ready; replay is deduped; a CCMS outage does not block the transition (outbox retries).

**Tests:** `IntegrationOutboxServiceTests` extension; lifecycle integrity test asserting the row.

---

### TASK IP-013 — Day-care batch / slot model

**Phase:** 5 · **Priority:** P1 · **Depends on:** IP-002

**Objective:** Support staggered arrival and session batching (RCOphth HFAC), which the current `SurgeryScheduledAt`-only model cannot express.

**Database:** New `journey_slot` (§12.1) + `patient_journey.slot_id` FK. Unique `(tenant_id, theatre_id, slot_date, session, sequence_no)`; index on `(tenant_id, slot_date, session)`.

**Backend:** `SlotFunctions` — list/create/assign/reorder/unassign; validation that the journey is not past `SentToOT`; audit on assignment change.

**Frontend:** Slot column and filter on the census; a Ready-for-OT queue ordered by `sequence_no`; `planned_arrival_at` shown on the rail; slot board on the OT page.

**Acceptance criteria:** A patient can be placed in AM/PM session with a sequence; reordering is audited; the Ready-for-OT queue reflects slot order.

**Tests:** Unique-constraint tests; reorder concurrency; Playwright `e2e/ip-census-slot-assign.spec.ts` (mocked IP APIs + Auth login) — assign AM-1 → census cell + rail; Ready-for-OT tab ordered by `sequence_no`.

---

### TASK BILL-030 — Charge item traceability and idempotency

**Phase:** 2 · **Priority:** P0 · **Depends on:** none

**Objective:** Make `opd_bill_items` capable of receiving automated charges without duplicating them.

**Database:** `opd_bill_items` gains `source_type` (`Package|PackageDiscount|Implant|Consumable|Room|Procedure|Manual`), `source_ref_id uuid null`, `idempotency_key varchar(200) null`; unique filtered index `(tenant_id, idempotency_key) where idempotency_key is not null`. `opd_bills` gains a concurrency token (`RowVersion`).

**Backend:** `BillItemService` accepts and honours `idempotencyKey`; duplicate key is a no-op returning the existing row. `OpdBillService` mutations return 409 on concurrency-token mismatch.

**Frontend (required by D1 + D4):** Decisions D1 (exploded packages) and D4 (itemised consumables) mean a cataract bill can carry 15–25 lines instead of one. The bill view and the printed bill must **group by `source_type`** with collapsible sections and per-group subtotals (Package, Implants, Consumables, Procedure, Room, Manual). Without this, correct itemisation makes the bill unreadable at the counter.

**Acceptance criteria:** Posting the same charge twice yields one line; concurrent finalize/discount returns 409 rather than silently overwriting; a 20-line bill renders grouped with subtotals and prints on one page.

**Tests:** Duplicate-post test; concurrency test with two contexts; ledger recalculation unchanged; grouped rendering snapshot at 20+ lines.

---

### TASK BILL-031 — Explode the package into bill line items on `ensure-bill`

**Phase:** 2 · **Priority:** P1 · **Depends on:** BILL-030

**Objective:** Replace the single `gross_amount = PackageAmount` header with itemised, claim-ready lines. **Decision D1 applies: fully exploded component lines plus a package discount line.**

**Backend:** In `EnsureInpatientBillAsync`, resolve the package template (`CounsellingPackageTemplate` / `MasterDataService.CalculatePackageCostAsync`) and:
- Post **one line per component** at its catalog price via the MD-055 resolver, `source_type='Package'`, `source_ref_id = componentId`, idempotency key `Package:{journeyId}:{templateId}:{componentId}`.
- Post a single **`Package Discount`** line so `sum(items) == agreed package amount`. This is a bill item, not a ledger `Discount` payment line — do not confuse the two.
- Exclusions are **not** posted here; they become chargeable when actually consumed (implant/consumable path).
- Premium-IOL upgrade is its own line: `premium price − package IOL allowance`.
- **Fail loudly on an unmapped component** (MD-055 exception queue). Never skip a component silently — a skipped component is lost revenue that no report would surface.

**Acceptance criteria:** `sum(items) == gross_amount == agreed package amount`; re-running `ensure-bill` does not duplicate lines; CCMS allocation operates per line; an unmapped component blocks explosion with an actionable error rather than producing a short bill.

**Tests:** Ledger equality test; idempotent re-run; allocation over exploded lines; unmapped-component failure path; premium-IOL upgrade arithmetic.

---

### TASK BILL-032 — Internal batch charge-posting endpoint

**Phase:** 2 · **Priority:** P0 · **Depends on:** BILL-030

**Backend:** `POST /api/internal/ip-billing/charge-items` (`X-Internal-Key`), body `{ tenantId, patientJourneyId, actorUserId, idempotencyKey, lines[] }` where each line is `{ sourceType, sourceRefId, serviceVariantId|serviceCode, quantity, unitPriceOverride?, notes }`.
- **Billing resolves price from the catalog** (`variant_prices`); a caller-supplied cost is ignored unless the caller holds an override right. This follows the FHIR `ChargeItem` rule that the posting system must not apply pricing.
- Rejects if the bill is finalized/locked → returns a distinct code so callers can queue a post-finalize correction.
- Recalculates the ledger; enqueues `PatientObligationChanged`.

**Acceptance criteria:** Batch posting is atomic per request and idempotent per key; finalized bills reject with an actionable code.

**Tests:** Happy path, duplicate key, unknown catalog item, finalized bill, partial-failure rollback.

---

### TASK OT-020 — Implant/IOL registry and OT scan

**Phase:** 3 · **Priority:** P0 · **Depends on:** BILL-032

**Objective:** Replace free-text `IntraOpNote.ImplantUsed` and the flag-only `verify-iol-barcode` with a real per-patient implant record — the wrong-implant never-event control and the charge trigger.

**Database:** New `journey_implant_usage` (§12.1). Unique serial where implanted; indexes on `journey_id`, `batch_number`, `udi_barcode`.

**Backend:**
- `POST /ip-management/journeys/{id}/implants` — body `{ itemId|catalogRef, serialNumber, batchNumber, udiBarcode, power, eye, usageStatus, surgeonUserId }`.
  - Validation: journey in `InOT` or `SurgeryCompleted`; `eye` matches `journey.EyeOperated` (**hard block on mismatch**); serial not already implanted elsewhere; catalog resolvable.
  - Permission: `ot.safety.sign` or `ip.surgery.complete`.
  - Transaction: insert usage row **plus** outbox `ImplantUsed` in one commit.
- `PATCH /ip-management/journeys/{id}/implants/{usageId}` — status change to `Wasted`/`Returned`/`Reversed` with reason; emits `ImplantUsageReversed`.
- `GET` list for the journey.
- Keep `verify-iol-barcode` for backward compatibility; have it create/update a registry row.

**Integration:** Outbox `ImplantUsed` (payload **must include `usageStatus`**) → (a) Inventory stock decrement or wastage entry, (b) charge posting **only when `usageStatus == 'Implanted'`** (decision D2).

**Decision D2 — opened-but-unimplanted is a hospital write-off:**
- `Opened_Unused` / `Wasted` → inventory wastage ledger entry, **no `opd_bill_items` row**.
- `wastage_reason` is **mandatory** on those statuses (wrong power, capsule rupture, contamination, damaged) and audited.
- `Implanted → Wasted` after a charge exists emits `ImplantUsageReversed` → Billing posts a **credit line**, never deletes.
- Because write-offs never appear in revenue, wastage needs dedicated reporting (INV-051).

**Frontend:** Scan step in the OT intra-op flow: scan → resolve → confirm eye + power → save; status selector with a required reason when not `Implanted`; list of recorded implants; pre-completion summary before `SurgeryCompleted`.

**Acceptance criteria:** Eye mismatch rejected; duplicate serial rejected; one charge line per **implanted** item regardless of event replay; `Opened_Unused`/`Wasted` produce zero charge lines and one wastage entry; wastage without a reason is rejected; reversal produces a credit line, never a delete; the surgeon is never blocked by a billing or inventory outage.

**Tests:** Validation matrix; outbox emission with each `usageStatus`; charge-suppression for wastage statuses; missing-reason rejection; duplicate replay; reversal credit; e2e OT scan → bill line appears, and e2e wastage → no bill line.

---

### TASK INV-050 — Consumable consumption → charge

**Phase:** 4 · **Priority:** P0 · **Depends on:** BILL-032

**Database:** `inv_surgery_consumables` gains `journey_id uuid null`, `charge_status`, `charge_item_id`; index on `journey_id`.

**Backend (inventory-service):** On `IssueSurgeryConsumablesAsync` / issue-in-OT, emit `ConsumablesConsumed` with `{ journeyId, consumptionId, lines[] }` — **quantity and item identity only, no price**. Add a small outbox in inventory following the existing pattern, or route through the IP outbox if the journey context is available there (prefer the latter to avoid a third outbox).

**Integration:** Consumer posts to `charge-items` with key `ConsumablesConsumed:{consumptionId}`. Price resolves via the MD-055 item→variant mapping; **an unmapped item goes to the exception queue and is never posted at purchase rate**.

**Decision D4 — consumables are charged individually.** Every issued consumable becomes a bill line, so:
- A cataract case may add 6–12 lines. Bill UI and printed bill group by `source_type` with collapse/expand (BILL-030).
- **Double-charge guard:** if a consumable is also a package component already posted by BILL-031, it must not be charged again. Both paths carry `source_ref_id`; the consumer checks for an existing package line covering the same item before posting, and INV-051 reconciles any overlap that slips through.

**Acceptance criteria:** OT consumable issue produces exactly one charge batch; replay is a no-op; missing `journey_id` and unmapped items route to exception queues rather than silently dropping; an item already covered by a package line is not double-charged.

**Tests:** Emission, idempotent replay, unmapped-journey path, unmapped-item path, package/consumable overlap suppression.

---

### TASK INV-051 — Three-way reconciliation job and exception report

**Phase:** 4 · **Priority:** P1 · **Depends on:** OT-020, INV-050

**Backend:** Daily job matching `journey_implant_usage` ⟷ `inv_stock_ledger` ⟷ `opd_bill_items`. Exception buckets:
1. Implanted but not charged
2. Charged but not implanted
3. Stock-out without recorded usage
4. **Package/consumable overlap** — the same item charged by both BILL-031 and INV-050 (introduced by D1 + D4)
5. **Unmapped items** from the MD-055 exception queue

Plus a pre-finalize check surfaced in the billing UI ("2 implants recorded, 1 charge missing").

**Wastage report (required by D2):** because opened-unused and wasted implants are written off, they never appear in revenue and would otherwise be invisible. Produce a separate report by reason, surgeon, item and period, with cost at purchase rate, so write-off volume is governable.

**Acceptance criteria:** A seeded mismatch appears in the correct bucket; finalize warns when charges are incomplete; the wastage report reconciles to `inv_stock_ledger` wastage entries.

**Tests:** Fixture-driven reconciliation tests per bucket; wastage report totals vs ledger.

---

### TASK RPT-080 — Unbilled activity, charge status, slot throughput

**Phase:** 6 · **Priority:** P2 · **Depends on:** INV-051, IP-013, SEC-041

**Objective:** Make same-day charge leakage visible on the IP billing dashboard, and give coordinators/finance a period slot-throughput report. Do not invent a second ledger or a second three-way match.

**Billing (money):** `GET /opdbills/ip-dashboard` includes `unbilledActivityCount/Amount` from `IChargeReconciliationService.GetUnbilledActivityAsync` (S-15 bucket 1 + pending/exception consumables, catalog prices, branch via `patient_journey.branch_id`). Per-row `chargeStatus` (`complete` \| `missing_charges` \| `unmapped`) from a batch completeness lookup — unmapped wins. Keep `IpBillingDashboardCalculator` ledger-only.

**IP (timestamps):** `GET /ip-management/slots/throughput?branchId=&from=&to=` over `journey_slot` history (prefer active row per journey-day) joined to `patient_journey` surgery/discharge times. Same arrival→discharge (0–24h) and turnover (<180m) windows as `/slots/metrics`. Cap 93 days.

**Frontend:** Unbilled KPI + charge-status column on `/dashboard/ip-management/billing` (finance/full). Period page `/dashboard/ip-management/throughput`. S-15 date range + CSV export. No new tables.

**Tests:** Unbilled catalog amount; posted implants excluded; other-branch excluded; charge-status classifier; slot throughput calculator (dedup, average, turnover, cancelled).

---

### TASK FE-004 — Cashier persona and collect-payment drawer

**Phase:** 1 · **Priority:** P0 · **Depends on:** SEC-040, IP-002, FE-003

**Objective:** Give cashiers a first-class IP experience without duplicating the billing domain in IP.

**Frontend:**
- Cashier rail layout per §20.3 (money-first, clinical hidden).
- New `CollectPaymentDrawer` (Radix `Dialog`) showing billed / collected / patient due / payer share, then type, mode, amount, reference, notes.
- Submits `opdBillingApi.addPayment` (`POST /api/OpdBills/payment`) with a client-generated `idempotencyKey`; shows the returned **receipt number** and a Print action.
- **Decision D3 — no-bill path:** when `financialState === 'NotCreated'`, the primary action becomes **"Create bill and collect"**, calling `POST /api/OpdBills/ip-ensure` (TASK BILL-033) and then the payment endpoint. Hidden if the persona lacks `bill.create`.
- Disabled with explanation when the bill is finalized/locked or the persona lacks `ip.billing.collect`/`bill.update`.
- **Never** calls `ipManagementApi.addBilling`.
- Refunds and adjustments are **not** in this drawer; they deep-link to `/billing/opd`.

**Backend:** payment endpoint exists; bill creation needs TASK BILL-033.

**Acceptance criteria:** A cashier can collect an advance from the census in ≤3 clicks and obtain a receipt number; a cashier can create-then-collect for a patient with no bill in one flow; double-submit creates one payment; a nurse never sees the drawer.

**Tests:** e2e cashier collect + double-submit idempotency; e2e create-and-collect; permission-hidden tests for nurse and for a cashier without `bill.create`.

---

### TASK FE-005 — Deprecate the journey projection write path

**Phase:** 0/1 · **Priority:** P0 · **Depends on:** FE-004

**Frontend:** Remove `handleAddTransaction` from `/dashboard/ip-management/journey/[id]`; render the billing tab read-only with an "Open billing" link. Mark `ipManagementApi.addBilling` `@deprecated` with a comment pointing to the Billing API.

**Backend:** Keep `POST /journeys/{id}/billing` for backward compatibility and tests; add a structured warning log when it is called with a browser-origin JWT.

**Acceptance criteria:** No UI path writes `ip_billing_transactions`; existing e2e that relied on it are migrated to the Billing API helper.

**Tests:** Repo-wide assertion that no component imports `addBilling`; migrate `e2e/helpers` accordingly.

---

### TASK DB-004 — Bed model for day-care

**Phase:** 5 · **Priority:** P1 · **Depends on:** none

**Database:** `bed_inventory` gains `ward_id uuid null` FK → `ward.id` (backfill by matching `ward_name`, keep the column for compatibility) and extends `bed_type` with `Recliner`, `DayCareChair`.

**Backend:** `BranchCapacityService` prefers `ward_id`, falls back to `ward_name`. `BedLifecyclePolicy` unchanged.

**Acceptance criteria:** Existing beds keep working; new beds resolve by FK; recliners are assignable and appear in ward capacity.

**Tests:** Backfill migration test; capacity query by `ward_id`; FSM unchanged; Wave 7 `W7-SMOKE-*` alias attach (`167_bed_inventory_wave7_ward_attach.sql`) so those beds resolve on the branch DayCare ward; Available recliner/chair seed (`_seed_w7_smoke_available_beds.sql`) for admit/transfer smoke.

---

### TASK DB-005 — Close the schema-drift gap

**Phase:** 7 · **Priority:** P1 · **Depends on:** none

**Objective:** IP has no migration history and two outboxes self-create at runtime.

**Work:** Either add EF migrations to `ip-management-service` with a baseline matching current production, or add a CI job that diffs `IpManagementDbContext` against a database built purely from `consolidated/migrations` and fails on drift. Replace `IntegrationOutboxService.EnsureSchemaAsync` and `BillingCcmsOutboxService.EnsureSchemaAsync` with versioned migrations (retain the runtime call as a logged no-op for one release).

**Acceptance criteria:** CI fails on an intentionally introduced drift; a fresh database built from migrations boots both services with no runtime DDL.

---

### TASK CCMS-060 — Apply payment and obligation events instead of acking them

**Phase:** 6 · **Priority:** P1 · **Depends on:** BILL-031

**Backend:** `IntegrationFunctions` handlers for `payment-received`, `payment-reversed`, `patient-obligation-changed` currently log and return 200. Apply them: update collection-aware settlement projections and drive `SETTLEMENT_PENDING → PARTIAL_SETTLEMENT | FULL_SETTLEMENT` where the workflow permits. Preserve the `IntegrationIdempotencyGuard`.

**Acceptance criteria:** A recorded payment moves reconciliation state; replay is a no-op; no clinical state is touched.

**Tests:** Handler tests per event; idempotency; a settlement reconciliation scenario.

---

### TASK OPS-070 — Integration health and dead-letter surface

**Phase:** 7 · **Priority:** P2 · **Depends on:** none

Both outboxes can reach `Dead` after 8 retries with no operator visibility. Add an admin page reading `integration_outbox_event` and `billing_ccms_outbox` stats (`GET ip-management/integration/outbox/stats` exists) with filters, error text, and a permissioned requeue action (`integration.admin`).

---

### TASK UX-090 — Consolidate dialog, drawer and toast primitives

**Phase:** 7 · **Priority:** P2 · **Depends on:** IP-001

Adopt `src/components/ui/dialog.tsx` and `sheet.tsx` across IP/ward/OT; retire hand-rolled `fixed inset-0` overlays in `WardPostOpWorkspaceModal`, `JourneyModal`, ward inline modals and OT inline modals. Standardise on one toast library (`sonner` or `react-hot-toast`, not both). Migrate the ward board to react-query for cache parity with the census.

**Acceptance criteria:** Every IP overlay has dialog semantics, focus trap and Escape; one toast provider in the tree; axe clean.

---

## 23. Testing Strategy

### 23.1 UI

Each screen in §20.6 is its own acceptance unit: the wireframe defines the zones that must render, the data & action map defines the network calls that must fire (and the ones that must **not** — a cashier collection must never hit `ipManagementApi.addBilling`), and the persona table defines what must be absent.

| Flow | Assertions |
|---|---|
| Screen acceptance (S-01…S-18) | Zones render in the specified order; every mapped call fires against the mapped route; unmapped/legacy routes are asserted absent |
| Nurse census | Split pane visible with list readable; clinical actions present; refund/adjust absent |
| Cashier census | Money-first rail; collect drawer; clinical actions absent; receipt number displayed |
| Mark Ready blocked | Button disabled, four hard-block reasons rendered, "Open step" navigates to the right pre-op step |
| Mark Ready clear | One click transitions; row updates; OT board receives the event |
| Un-mark ready | Reason required; blocked once sent to OT |
| Billing deep link | Census → bill selected → payment reachable |
| OT implant scan | Eye mismatch rejected; duplicate serial rejected; charge line appears |
| Coverage | Status chip matches CCMS classifier; payer share hidden from clinical personas |
| A11y | Every overlay: role, aria-modal, focus trap, Escape; axe clean; 12 px minimum |
| Keyboard | j/k/Enter/Esc/`/` on the census |

### 23.2 API

| Category | Cases |
|---|---|
| Happy path | Admit → Mark Ready → Send → Accept → Start → Complete → PostOp → ReadyForDischarge → Discharged |
| Validation | Illegal transitions per `StateTransitionValidator`; eye mismatch; missing reason on override/unmark |
| Authorization | Per persona × per endpoint matrix, including the internal-key routes |
| Idempotency | Payment key; charge-item key; implant event replay; outbox dedupe |
| Concurrency | `expectedUpdatedAt` 409 on the journey; `RowVersion` 409 on the bill; two cashiers on one bill; two nurses marking ready |
| Retry | Outbox 8 retries → `Dead`; requeue |
| Integration failure | CCMS down at admit (fail-closed on coverage, allow otherwise); bed service down; billing down during implant charge (usage still recorded) |

### 23.3 Database

Constraint tests for every new unique index; transaction rollback on audit failure; migration up/down on a production-shaped snapshot; backfill correctness for `bed_inventory.ward_id`; reconciliation query correctness.

### 23.4 End-to-end master scenario

```
Register → counselling package → coverage case → Expected journey → assign AM slot
→ Admit (coverage validated, bed occupied, bill created with exploded package lines)
→ Pre-op (consent, laterality, PAC, critical labs) → Mark Ready (one click)
→ Send to OT → Accept (billing gate) → Start
→ Scan IOL (registry + stock + charge) → confirm consumables (charge)
→ Complete surgery → PostOp → Cashier collects advance from census (receipt)
→ CCMS allocation applies payer/patient split → Ready for Discharge (not money-gated)
→ Discharge (patient obligation only) → Finalize bill → Claim → Settlement → Reconcile
```

### 23.5 Failure scenarios (must all be covered)

Billing unavailable during implant charge · CCMS unavailable at admit and at bill-finalize · duplicate event replay · payment double-submit · implant charge failure then reconciliation catch · OT cancellation after Mark Ready · patient cancellation with bed release · discharge reversal · wrong implant entry and reversal credit · refund after finalize · concurrent cashier collection · slot reassignment mid-flow.

---

## 24. Risks and Dependencies

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| RBAC tightening locks out live users | Ward stops working | Medium | Grandfather grant first (SEC-040), tighten in a separate reviewed migration, keep a documented rollback |
| Removing frontend fail-open breaks dev/UAT | Team blocked | High | Dev-only env flag, loud logging, never honoured in production |
| Package explosion changes `gross_amount` semantics | Financial reporting shifts | Medium | Assert `sum(items) == gross_amount`; run in shadow mode first, compare, then switch |
| Charge automation double-charges | Direct patient impact | Low with keys | Unique idempotency index + reconciliation report + pre-finalize check |
| Implant registry duplicates existing IOL stores | More fragmentation | Medium | Registry is the **usage** record only; catalog stays in Auth/Inventory; migrate `iol_returns` and `intra_op_note.ImplantUsed` into it in Phase 3 rather than leaving four writers |
| Split pane regresses on 1366 px | Nurse complaints | Medium | Column priority + horizontal scroll; pilot on real hardware before rollout |
| Schema drift between EF model and SQL migrations | Production incident | Medium | DB-005 CI check |
| Inventory has zero tests | Regressions in charge path | High | Add a test project as part of INV-050 |
| Two outboxes reaching `Dead` unnoticed | Silent integration loss | Medium | OPS-070 |

**Dependencies:** SEC-040 gates FE-004, IP-002, IP-011, BILL-033. BILL-030 gates BILL-031/032 and MD-055. **MD-055 gates BILL-031 and INV-050** (decisions D1 and D4 both require catalog-resolved pricing). BILL-032 gates OT-020 and INV-050. OT-020 + INV-050 gate INV-051. BILL-033 gates the create-and-collect path in FE-004. FE-003 should ship before IP-002 so the single billing link has a working destination.

**Risks introduced by decisions D1–D4:**

| Risk | Impact | Mitigation |
|---|---|---|
| Unmapped package components or consumables (D1, D4) | Silent revenue loss or blocked explosion | MD-055 exception queue; explosion fails loudly rather than producing a short bill |
| Bill line count 15–25× today (D1, D4) | Unreadable bill at the counter; slow print | Grouped collapsible rendering with subtotals (BILL-030) |
| Same item charged by both package explosion and consumable consumption (D1 + D4) | Patient double-charged | `source_ref_id` overlap check at post time + reconciliation bucket 4 (INV-051) |
| Write-offs invisible in revenue (D2) | Ungoverned wastage | Mandatory `wastage_reason` + dedicated wastage report (INV-051) |
| Cashier bill creation widens rights (D3) | Bills created outside billing review | Guarded to admitted journeys with no existing bill; distinct audit actor marker; parity test vs admit-created bills |

---

## 25. Assumptions

1. Emphasis-only personas: `resolveIpPersona` affects ordering and visibility, never authorisation. The server stays authoritative.
2. `X-Internal-Key` is environment-scoped, rotated, and never shipped to the browser. If not, that becomes a P0 ahead of everything here.
3. `PermissionService` resolves DB permissions into the JWT `permission` claim without code change once the codes exist.
4. Charge prices come from the existing service catalog (`variant_prices`); no new pricing engine. Decisions D1 and D4 make this load-bearing: package components and consumables must be **mapped** to catalog variants (TASK MD-055) before automated posting can work at all.
5. Tax remains 0 for the V2 catalog; the `tax_amount` column stays for future GST.
6. Nursing PCs are ≥1366×768; billing desks are typically ≥1920.
7. Recovery does not need to be a distinct clinical state; `PostOp` suffices for day-care.
8. `ip_billing_transactions` must be retained for historical reads and existing tests; only UI writes stop.
9. UDI capture is desirable for traceability and recall, not a current Indian regulatory obligation.
10. One IP bill per journey remains correct (already enforced by `ux_opd_bills_patient_journey`).

---

## 26. Resolved Decisions (previously blocking)

All four blocking questions were answered by the product owner. They are now **binding requirements** for Phases 2–4, and the affected tasks below have been updated accordingly.

### D1 — Package billing shape: **fully exploded component lines + package discount line**

Every package component is posted to `opd_bill_items` at its catalog price, followed by a single `Package Discount` line so that `sum(items) == agreed package amount`.

| Consequence | Detail |
|---|---|
| CCMS | Coverage allocation and exclusions now operate per line, as `CoverageAllocationEngine` was designed to |
| Claims | Claim packets carry itemised detail instead of a lump sum |
| **New dependency** | Package templates must map to service catalog variants. `CounsellingPackageTemplate` does not currently hold `service_variant_id` per component → **TASK MD-055** |
| Discount line | `source_type='Package'`, `payment_kind` unaffected (this is a bill item, not a ledger discount line) |
| Risk | An unmapped component would silently drop revenue → explosion must **fail loudly**, not skip |

### D2 — Opened-but-unimplanted IOL: **hospital write-off, no patient charge**

`usage_status ∈ {Opened_Unused, Wasted}` produces an **inventory wastage entry only**. No `opd_bill_items` row is created.

| Consequence | Detail |
|---|---|
| Billing rule | The `ImplantUsed` consumer charges **only** when `usage_status == 'Implanted'` |
| Event contract | `ImplantUsed` must carry `usageStatus`; Billing branches on it |
| Correction | `Implanted → Wasted` after charging emits `ImplantUsageReversed` → **credit line**, never a delete |
| Cost visibility | Write-offs are invisible in revenue, so wastage needs its own reporting → **wastage report added to TASK INV-051** |
| Governance | `wastage_reason` is mandatory and audited (wrong power, capsule rupture, contamination, damaged) |

### D3 — Cashier scope: **may also create the bill for an admitted patient with no bill**

| Consequence | Detail |
|---|---|
| RBAC | The Cashier bundle in **TASK SEC-040** gains `bill.create` |
| **New endpoint** | `EnsureInpatientBillAsync` is reachable only via `X-Internal-Key` with **no permission check** — a browser-originated cashier call needs a JWT-authorised route → **TASK BILL-033** |
| Side effect | Cashier-created bills are exploded per D1, so the cashier indirectly triggers package posting. The explosion must be identical regardless of who triggers it |
| Guard | Creation permitted only when the journey is admitted (not `Expected`, not cancelled) and no bill exists (`ux_opd_bills_patient_journey` already enforces uniqueness) |
| Audit | Bill creation records the cashier as actor, distinguishable from the internal IP admit path |

### D4 — Consumables: **charged individually to the patient**

Every consumable issued in OT becomes a bill line.

| Consequence | Detail |
|---|---|
| Volume | A cataract case may produce 6–12 additional lines. The bill UI and printed bill need **grouping by `source_type`** with collapse/expand → folded into **TASK BILL-030** |
| **New dependency** | Charge price must resolve from the service catalog, but consumables live in `inv_item_master`. There is no item→variant mapping → **TASK MD-055** |
| Unmapped items | Must land in an exception queue, never be silently skipped or posted at purchase rate |
| Interaction with D1 | If a consumable is also a package component, it must not be charged twice. Explosion and consumption both key on `source_ref_id`; the reconciliation job in **TASK INV-051** must detect package/consumable overlap |
| Claims | Itemised consumables improve claim substantiation but increase disallowance surface — CCMS exclusion rules matter more now |

### D5 — Derived: two new tasks

D1, D3 and D4 each surfaced work that did not exist in the original plan. Both are **P0 blockers for Phase 2**, not optional.

---

### TASK MD-055 — Catalog mapping for package components and consumables

**Phase:** 2 (must precede BILL-031 and INV-050) · **Priority:** P0 · **Depends on:** BILL-030

**Objective:** D1 and D4 both require every chargeable thing to resolve to a priced service catalog variant. Package templates and `inv_item_master` currently have no such mapping, so automated charge posting has nothing to price against.

**Database:**
- New `service_variant_item_map`: `id`, `tenant_id`, `item_id` FK → `inv_item_master`, `service_variant_id` FK → `service_variants`, `effective_from`, `effective_to`, audit. Unique `(tenant_id, item_id)` where active.
- `CounsellingPackageTemplate` component rows gain `service_variant_id` (nullable during migration, required after backfill).

**Backend:**
- Resolver service: `item_id` → `service_variant_id` → `variant_prices`. Returns an explicit `Unmapped` result rather than a fallback price.
- **Unmapped items go to an exception queue** (`charge_exception` rows), surfaced in the reconciliation report. Never post at purchase rate, never silently skip.
- Admin API to list unmapped items in use and create mappings.

**Frontend:** Admin screen listing unmapped items ranked by usage frequency, with inline mapping.

**Acceptance criteria:** Every consumable and package component used in the last 90 days resolves to a priced variant or appears in the exception queue; no charge is ever posted at purchase rate.

**Tests:** Resolver mapped/unmapped/expired-mapping cases; exception queue population; backfill migration correctness.

---

### TASK BILL-033 — JWT-authorised IP bill creation for cashiers

**Phase:** 1 · **Priority:** P0 · **Depends on:** SEC-040, BILL-031

**Objective:** D3 requires a cashier to create an IP bill from the census. The only current path (`EnsureInpatientBillAsync`) is internal-key-only with no permission check and must not be exposed to the browser.

**Backend:** New `POST /api/OpdBills/ip-ensure` on `OpdBillsController`:
- `[RequirePermission("bill.create")]` plus a service-layer check for `ip.billing.collect` or `bill.update`.
- Body `{ patientJourneyId }`. Resolves the journey, validates it is admitted and not cancelled/discharged, then delegates to the **same** `EnsureInpatientBillAsync` used by IP — including package explosion (D1), so behaviour is identical regardless of caller.
- Idempotent: returns the existing bill if `ux_opd_bills_patient_journey` already has one.
- Audit records the cashier as actor with a distinct source marker.

**Frontend:** In `CollectPaymentDrawer`, when `financialState === 'NotCreated'`, show "Create bill and collect" as the primary action; hide it if the persona lacks `bill.create`.

**Acceptance criteria:** A cashier creates the bill and collects in one flow; the resulting bill is byte-identical to one created by the IP admit path; a second call returns the same bill; a nurse receives 403.

**Tests:** Authorization matrix; idempotent double-call; parity test comparing cashier-created vs admit-created bills; e2e cashier create-and-collect.

---

## 27. Final Recommendation

**Keep the architecture. Fix the seams, the provisioning, and the frontend.**

The backend ownership model in this system is better than the UI suggests. The ledger is append-only and idempotent, CCMS has a real workflow engine, beds have a real FSM, and both outboxes retry to a dead-letter state. None of that should be rewritten.

What is actually broken falls into three groups:

1. **Provisioning and enforcement (P0).** Permission codes are enforced in code but were never seeded, and the frontend fails open when the claim is empty. Today's least privilege is an illusion — a ward nurse can admit, mark ready, send to OT and discharge, and a cashier cannot be given a coherent IP role at all. Fix this before any UX work; it is one migration plus three helper functions.

2. **The clinical→financial edge (P0).** Nothing connects OT consumption to the patient account. `inv_surgery_consumables` has the usage, `opd_bills` has the account, and the only link is a nurse remembering. For a high-volume eye hospital where IOLs and consumables are the dominant variable cost, this is the largest financial defect in the system, and the external evidence (UDI-based charge capture, inpatient leakage patterns) is unambiguous about both the cause and the remedy. The fix is event-driven and additive: an implant usage registry in IP, quantity-only events, and price resolution in Billing — which also happens to be exactly the FHIR `ChargeItem` contract.

3. **The IP census experience (P0/P1).** The panel the user flagged is a symptom. Billing CTAs multiplied inside a clinical panel because the deep link to the cashier screen never worked, and clinical actions became blind one-click calls because the preflight endpoint that already exists was never wired up. Fixing the destination and the preflight removes most of the reason the panel grew the way it did; the split pane, persona rail and accessibility work then make it a professional clinical surface rather than a consumer slide-over.

Sequence: **Phase 0 (safety) → Phase 1 (census + Mark Ready + cashier) → Phase 2–4 (charge capture, implants, consumables, reconciliation) → Phase 5–7 (day-care throughput, coverage reconciliation, platform hygiene).** Phase 0 and Phase 2 can run in parallel; everything else is dependency-ordered above.

**All four open decisions are resolved (§26):** exploded package lines with a discount line (D1), opened-unused implants written off with no patient charge (D2), cashiers may create the bill as well as collect (D3), and consumables charged individually (D4). D1 and D4 together mean every chargeable thing must resolve to a priced catalog variant, which neither package templates nor `inv_item_master` currently do — so **TASK MD-055 (catalog mapping) is now the first task of Phase 2** and gates both BILL-031 and INV-050. D3 adds **TASK BILL-033**, a JWT-authorised bill-creation route, because the only existing path is internal-key-only with no permission check and must not be exposed to a browser.

The combined effect of D1 and D4 is a much richer bill — 15–25 lines where there is one today — which is correct for claims and coverage allocation but makes grouped, collapsible bill rendering a hard requirement rather than a nicety. That is folded into BILL-030.

