# Laboratory Management — L3-PD Remaining Product Decisions Workshop

**Date:** 2026-10-08  
**Type:** PRODUCT / ARCHITECTURE DECISION WORKSHOP  
**Mode:** READ-ONLY — **NO IMPLEMENTATION**  
**Status:** WORKSHOP COMPLETE — MANY ITEMS REMAIN PRODUCT DECISION REQUIRED  

**Authoritative companions:**
- [laboratory-management-product-definition-v3.md](./laboratory-management-product-definition-v3.md)
- [laboratory-management-e2e-gap-analysis.md](./laboratory-management-e2e-gap-analysis.md)
- [laboratory-management-roadmap-rebaseline.md](./laboratory-management-roadmap-rebaseline.md)
- [laboratory-management-pd-lab-int-01-cross-domain-integration.md](./laboratory-management-pd-lab-int-01-cross-domain-integration.md)
- [laboratory-management-l2-order-composer-ux-correction-implementation.md](./laboratory-management-l2-order-composer-ux-correction-implementation.md)
- **PO approval matrix:** [laboratory-management-product-owner-decision-matrix.md](./laboratory-management-product-owner-decision-matrix.md)  
- **PO decision closure:** [laboratory-management-product-owner-decision-closure.md](./laboratory-management-product-owner-decision-closure.md) — selected decisions **APPROVED**; L3 coding not auto-authorized

```text
L3-PD REMAINING DECISIONS COMPLETE
NO IMPLEMENTATION PERFORMED
L2 ACCEPTANCE NOT CLAIMED
L3 IMPLEMENTATION NOT STARTED
L3-COM-01 GATED BY L2 ACCEPTANCE / PROGRAM WAIVER
```

Decision status values used below:  
**APPROVED** · **PRODUCT DECISION REQUIRED** · **EXISTING CERTIFIED** · **RECOMMENDED** · **FUTURE** · **NOT APPLICABLE**

---

## 1. Executive summary

This workshop closes **what can be closed from repository evidence + prior approvals**, and explicitly leaves **hospital commercial/clinical policy** open where the repo does not encode a Laboratory rule.

| Outcome | Result |
|---|---|
| Integration boundaries | Remain **APPROVED** via PD-LAB-INT-01 (P1–P10) |
| Commercial architecture (Option C, price SoT, no Lab ledger) | **APPROVED** |
| Charge timing, unpaid gates, insurance depth, SourceType choice, multi-item rollup policy, edit/cancel/hold ACL, Order Summary financial contents, notification catalog mandates, TAT calendar rules, package vs panel commercial explosion | **PRODUCT DECISION REQUIRED** |
| L3-COM-01 mapping slice | COM-01/COM-02 **APPROVED** in PO closure; coding still **GATED BY L2 ACCEPTANCE / PROGRAM WAIVER** + separate implementation prompt |
| L2 Order Composer | Unchanged; Manual UAT remains L2 gate |

**Do not guess.** Recommendations are labeled **RECOMMENDED** and are **not** approved business rules.

---

## 2. Current Laboratory state

| Item | State |
|---|---|
| L2 clinical catalog + multi-test order | Implemented |
| Order Composer UX / footer hardening | Implemented |
| FE laboratory tests | 69 passed |
| BE laboratory regression | 53 passed (baseline) |
| Manual UAT | In progress — L2 acceptance **not claimed** |
| L3 implementation | **Not started** |
| ServiceVariant links on LTD | Schema ready; bootstrap **0 linked** |
| Lab → OpdBill posting | **Absent** |
| Status machine enforcement | **Absent** (vocabulary only) |
| LabReportItem per-item status | **Absent** |

---

## 3. Decision scope

In scope: PD-LAB-COM-01/02/03, BILL-01/02/04/05/06, MULTI-02, ORD-EDIT/CXL/HOLD, PAY-01, FIN-VIS-01, UX-SUM-01, INS-01/02, NOTIF-01, TAT-01, PKG-01, EXT-COM-01, acceptance gates, L3 authorization.

Out of scope: any code, schema, API, UI, permission, migration, charge posting, ServiceVariant population, L3-COM-01 implementation, L2 acceptance claim.

---

## 4. Repository evidence (investigated)

| Area | Evidence | Class |
|---|---|---|
| Hybrid catalog | `LaboratoryTestDefinition.ServiceVariantId` optional; create validates active variant; bootstrap sets `null` | Schema **GREEN**; population **RED** |
| Price tables | `variant_prices`: global / `branch_id` / `payer_id`, effective dates | **EXISTING CERTIFIED** commercial SoT |
| Resolver | `IChargeCatalogResolver` / `ChargeCatalogResolver`: Mapped / Unmapped / NonChargeable / Unpriced; `ResolveVariantAsync` selects payer-global then global (branch param exists on pick helper but **branch override not applied in current ResolveVariantAsync path**) | **YELLOW** — use carefully; bill staging may need branch context |
| Non-chargeable (existing) | `ServiceVariantItemMaps.IsChargeable` + `NonChargeableReason` → `ChargeResolveKind.NonChargeable` (inventory/item maps — **not** LTD) | **EXISTING** for item maps; **not** Lab LTD mechanism |
| BillChargeSource | `Package`, `PackageDiscount`, `Implant`, `Consumable`, `Room`, `Procedure`, `Manual`; unknown → **Manual** | **EXISTING CERTIFIED**; **no Laboratory** value |
| OPD items | `OpdBillItem` + `ServiceVariantId`, `SourceType`, `SourceRefId`, `IdempotencyKey` | **EXISTING CERTIFIED** |
| ItemType DTO | `investigation` among OpdBill item type strings | **YELLOW** (DTO taxonomy ≠ BillChargeSource) |
| Package explosion | `OpdBillService.PackageExplosion` — commercial package components; unmapped chargeable components fail explosion | **EXISTING CERTIFIED** (Billing packages ≠ Lab clinical panels) |
| IP bill | `EnsureIpBillForJourneyAsync` / `PatientJourneyId` | **EXISTING CERTIFIED** IP path |
| Refunds/discounts | OpdBill discount/refund/credit + financial audit staging | **EXISTING CERTIFIED** Billing |
| Billing↔CCMS | `billing_ccms_outbox` + idempotency unique index | **EXISTING CERTIFIED** |
| Permissions (finance) | e.g. `bill.view`, `bill.create`, `opd_bill.view`, `opd_bill.refund`, `opd_bill.refund.authorize`, `ip.billing.collect`, `ip.billing.refund`, `ccms.billing.read` | **EXISTING CERTIFIED** codes |
| Lab permissions | `laboratory.view` (nav/page); API lab mutate via `patient.view`/`patient.update` | **YELLOW** / **ORANGE** |
| Notifications | Hub + NotificationService; settings stub `lab_results`; **no** Lab CommunicationIntent catalog | Pattern **GREEN**; Lab intents **RED** |
| Audit | `IAuditService` | Pattern **GREEN**; Lab history weak |
| Documents | Slice 4 LabReport canonical attach (attach ≠ complete) | **EXISTING CERTIFIED** |
| P360 | Clinical + documents lab projection | **EXISTING CERTIFIED** |
| Orphans | `lab.api.ts` / archive `lab_order` — not Lab SoT | Confirmed orphan |
| Lab unpaid gate | No Lab code gating on payment | **Absent** — policy **PRODUCT DECISION REQUIRED** |
| Lab TAT calendar/SLA engine | `TurnaroundHours` on LTD; no holiday/business-hours Lab SLA engine found | Hours field **YELLOW**; SLA policy **PRODUCT DECISION REQUIRED** |

---

## 5. Approved decisions (this workshop + priors)

| ID | Topic | Decision | Status |
|---|---|---|---|
| PD-LAB-INT-01 | Cross-domain boundaries | P1–P10 remain in force | **APPROVED** |
| PD-LAB-CAT-01 | Hybrid catalog | ServiceVariant = commercial; LTD = clinical; optional link | **APPROVED** |
| — | Price SoT | Prices live in `variant_prices` / Billing resolver — **never** copied onto LTD as SoT | **APPROVED** |
| — | No Lab ledger | No LaboratoryBill/Payment/Receipt/Ledger/ClaimsEngine | **APPROVED** |
| — | Integration path preference | Prefer Lab → Billing → CCMS for financial/claim reflection; avoid Lab→CCMS dual financial write | **APPROVED** (INT-01 / this workshop) |
| — | Status vocabulary | Preserve six statuses; soft-delete ≠ `cancelled` | **APPROVED** |
| — | No silent Manual classification | Must not silently post Lab charges as Manual without Product Decision on SourceType | **APPROVED** (principle) |
| — | Mutation boundary | Billing/CCMS/P360/Notifications must not mutate Lab clinical state except via explicit Lab API contracts | **APPROVED** |
| Slice 4 | Documents | Remain certified; attach ≠ complete | **EXISTING CERTIFIED** |

---

## 6. Product decisions required (blocking)

| ID | Blocking for | Why open |
|---|---|---|
| PD-LAB-COM-01 | L3-COM-01 | Chargeability + mapping ownership/process not product-approved |
| PD-LAB-COM-02 | L3-COM-01 | Non-chargeable representation for LTD not defined (item-map mechanism ≠ Lab) |
| PD-LAB-BILL-01 | L3-COM-02 / pay gates | Charge timing not in repo for Lab |
| PD-LAB-BILL-06 | L3-COM-02 | Laboratory SourceType not in `BillChargeSource` |
| PD-LAB-BILL-04 | L3-COM-02 | OPD vs IP / encounter bill association policy for Lab |
| PD-LAB-BILL-02 | Cancel/reject finance | Reversal matrix not approved |
| PD-LAB-BILL-05 | L3-COM-02 | Exact idempotency key string shape |
| PD-LAB-PAY-01 | Clinical vs finance coupling | No unpaid Lab gate in code |
| PD-LAB-MULTI-02 | Lifecycle + finance partial | Item vs parent status model |
| PD-LAB-ORD-* | L3-WF-01 | Edit/cancel/hold/resume policy |
| PD-LAB-FIN-VIS-01 | L3-UX-01 | Who sees money in Lab UI |
| PD-LAB-UX-SUM-01 | L3-UX-01 | Sheet timing/contents |
| PD-LAB-INS-01/02 | Insurance display / when | Depth & timing |
| PD-LAB-NOTIF-01 | L3-NOTIF-01 | Which intents required |
| PD-LAB-TAT-01 | Analytics/breach | Calendar/SLA rules |
| PD-LAB-PKG-01 | Panel commercial | Panel vs package explosion |
| PD-LAB-EXT-COM-01 | L12 commercials | Future send-out finance |

---

## 7. Deferred / future decisions

| ID | Topic | Status |
|---|---|---|
| PD-LAB-EXT-COM-01 | External lab cost/referral reconciliation | **FUTURE** (L12) — still needs PO before send-out go-live |
| PD-LAB-CRIT-02 | Critical thresholds/escalation | **FUTURE** L7 (prior V3) |
| PD-LAB-VER-02 / PERM-02 | Verify roles / permission cutover | **FUTURE** L6 |
| PD-LAB-QC-02 | QC rules | **FUTURE** L8 |
| PD-LAB-14-DETAIL | Counsellor bridge billing map | **FUTURE** L16 |
| FHIR/HL7/LIS IFACE | Partner specs | **FUTURE** L10–L13 |

---

## 8. Commercial model

### PD-LAB-COM-01 — Laboratory commercial mapping

| Field | Content |
|---|---|
| **ID** | PD-LAB-COM-01 |
| **Decision** | **PRODUCT DECISION REQUIRED** for operational policy. Architecture constraints below are **APPROVED**. |
| **APPROVED constraints** | (1) Mapping uses optional `LaboratoryTestDefinition.ServiceVariantId` — no price fields on LTD. (2) Mapping is **tenant-scoped** (LTD + ServiceVariant are tenant entities). (3) Mapping is **not branch-specific at FK level** — branch differentials use `variant_prices.branch_id`. (4) Catalog admin API may set/clear link today; **who may** and **audit depth** need PO + Security alignment. |
| **PRODUCT DECISION REQUIRED** | Which LTDs are chargeable; who owns mapping process; whether order create allowed without mapping; whether collection allowed when unmapped; audit requirements beyond generic IAuditService. |
| **Evidence** | LTD model; bootstrap `ServiceVariantId = null`; Linked ServiceVariant = 0; L2 docs forbid auto-map. |
| **RECOMMENDED (not approved)** | Block Order Summary price display for unmapped chargeable tests; allow clinical order create for unmapped until COM-01 closed — **or** block create — **PO must choose**. |
| **Owner** | Product Owner + Billing master-data owner + Lab catalog owner |
| **Slice** | Blocks **L3-COM-01** |
| **Acceptance (when approved)** | Written rules for chargeable/unmapped/non-chargeable; admin ACL named from **existing** permissions or Security Decision |

### PD-LAB-COM-02 — Non-chargeable representation

| Field | Content |
|---|---|
| **ID** | PD-LAB-COM-02 |
| **Decision** | **PRODUCT DECISION REQUIRED** |
| **Evidence** | `ChargeResolveKind.NonChargeable` via `ServiceVariantItemMaps.IsChargeable` — applies to **item maps**, not LTD. No LTD `IsChargeable` column. Null `ServiceVariantId` today means **unmapped**, not authoritative non-chargeable. |
| **Do not** | Invent LTD boolean without PO + schema decision |
| **RECOMMENDED options for PO** | (A) Null SV + explicit “non-chargeable” catalog flag (new — needs Security/schema). (B) Map to a designated non-billable ServiceVariant / SC flag if Billing already supports. (C) Administrative list of local codes — weak. |
| **Slice** | Blocks honest L3-COM-01 / UX estimate |

### PD-LAB-COM-03 — Price resolution sequence

| Field | Content |
|---|---|
| **ID** | PD-LAB-COM-03 |
| **Decision** | **APPROVED** as architecture: `LTD → ServiceVariant → variant_prices → IChargeCatalogResolver / Billing staging → OpdBill`. Lab must not store a second price SoT. |
| **PRODUCT DECISION REQUIRED** | Exact API used for Order Summary when branch override required (current `ResolveVariantAsync` path does not apply `branch_id` override in the amount pick sequence observed). Discount/package application remains Billing-owned at bill time. |
| **Evidence** | `VariantPrice` comments; `ChargeCatalogResolver`; OpdBill staging |
| **Price visibility** | Gated by **PD-LAB-FIN-VIS-01** |
| **Unavailable price** | Resolver returns Unmapped / Unpriced / NonChargeable — UI must not invent amounts (**APPROVED**) |
| **Slice** | L3-UX-01 / L3-COM-02 |

---

## 9. Billing model

### PD-LAB-BILL-01 — Charge timing

| Candidate | Clinical | Financial | Cancel/reject | Evidence for Lab |
|---|---|---|---|---|
| A. Order creation | Immediate liability | Early charge; high cancel reversal load | Complex | Lab create does **not** post today |
| B. Order confirmation | Needs confirm step (absent) | Cleaner | Needs confirm UX | **No Lab confirm event** |
| C. Specimen collection | Matches draw | Misses never-collected orders | Reject/recollect finance | Collect thin today |
| D. Processing | Late | Under-bills no-shows | — | No processing entity |
| E. Other hospital event | Journey/package explosion etc. | Existing IP package patterns | — | IP package ≠ Lab |

| Field | Content |
|---|---|
| **ID** | PD-LAB-BILL-01 |
| **Decision** | **PRODUCT DECISION REQUIRED** — repository has **no** Lab charge-timing rule; must not select A–E by guess |
| **Owner** | Product Owner + Finance + Lab ops |
| **Dependencies** | COM-01, BILL-04/05/06, PAY-01 |
| **Slice** | Blocks **L3-COM-02**; does not by itself block mapping-only L3-COM-01 once COM-01/02 approved |
| **Acceptance** | Written matrix for OPD/IP/self-pay/insurance × cancel/reject/recollect |

### PD-LAB-BILL-06 — BillChargeSource

| Option | Pros | Cons |
|---|---|---|
| A. Add typed `Laboratory` (or Investigation) source | Traceability, analytics, CCMS clarity | Requires Billing Security/schema decision |
| B. Reuse existing investigation ItemType | DTO already mentions `investigation` | Not equal to `BillChargeSource`; weak for BILL-030 grouping |
| C. Manual + Lab SourceRef | Works today via Normalize→Manual | **Forbidden to silent-default** without PO; poor reporting |
| D. Other | — | Must cite evidence |

| Field | Content |
|---|---|
| **ID** | PD-LAB-BILL-06 |
| **Decision** | **PRODUCT DECISION REQUIRED** (choice among A–D). Principle **APPROVED**: do not silently classify Lab as Manual. |
| **Evidence** | `BillChargeSource.cs` All[] has no Laboratory |
| **Slice** | L3-COM-02 |
| **Acceptance** | Chosen SourceType + SourceRef → LabReport/Item; reports filterable |

### PD-LAB-BILL-05 — Idempotency / correlation

| Field | Content |
|---|---|
| **ID** | PD-LAB-BILL-05 |
| **Decision** | **PRODUCT DECISION REQUIRED** for exact key string. **RECOMMENDED** conceptual identity: `tenantId + labReportId + labReportItemId + chargeReason` (+ optional charge-kind). Align with existing `IdempotencyKey` on bill items / charge exceptions. |
| **Evidence** | OpdBill DTOs `IdempotencyKey`; package keys like `Package:{journey}:{template}`; charge exception unique key |
| **Must prevent** | Double-submit, API retry, reverse-duplicate |
| **Slice** | L3-COM-02 |

### PD-LAB-BILL-04 — OPD / IP / encounter association

| Field | Content |
|---|---|
| **ID** | PD-LAB-BILL-04 |
| **Decision** | **PRODUCT DECISION REQUIRED** |
| **Evidence** | LabReport has nullable `VisitId` only — no bill FK. OPD: `CreateBillAsync`. IP: `EnsureIpBillForJourneyAsync` + `PatientJourneyId`. Cross-branch protection exists in Billing patterns generally — Lab policy undefined. |
| **APPROVED** | Lab must not create a parallel bill type |
| **PRODUCT DECISION REQUIRED** | Source encounter; fallback if no visit/journey; who creates bill; branch resolution; attach-to-existing vs new |
| **Slice** | L3-COM-02 |

### PD-LAB-BILL-02 — Cancel / reversal / refund

| Field | Content |
|---|---|
| **ID** | PD-LAB-BILL-02 |
| **Decision** | **PRODUCT DECISION REQUIRED** for Lab×finance matrix |
| **APPROVED** | Financial mutation owned by Billing (refund/discount/credit/OT-020-style reverse lines). Lab changes only Lab state via Lab APIs. |
| **Evidence** | OpdBill cancel/refund/discount/credit + financial audit; no Lab hooks |
| **Need PO matrix** | Cancel before/after charge; reject; recollect; after process/result/verify/release; partial multi-item |
| **Slice** | L3-WF + L3-COM-02 |

---

## 10. Payment policy

### PD-LAB-PAY-01 — Unpaid gate

| Context | Gate at create / confirm / collect / process / verify / release |
|---|---|
| Self-pay OPD | **PRODUCT DECISION REQUIRED** (all cells) |
| Insurance OPD | **PRODUCT DECISION REQUIRED** |
| IP | **PRODUCT DECISION REQUIRED** (often bill-on-journey; do not assume) |
| Emergency | **PRODUCT DECISION REQUIRED** |
| Package | **PRODUCT DECISION REQUIRED** |

| Field | Content |
|---|---|
| **ID** | PD-LAB-PAY-01 |
| **Decision** | **PRODUCT DECISION REQUIRED** — repo has **no** Lab unpaid gate; must not assume unpaid=blocked or unpaid=allowed |
| **APPROVED** | Payment failure must not create false “paid”; Billing failure must not corrupt Lab clinical save (INT-01) |
| **Slice** | Blocks clinical-finance coupling in L3+ |

---

## 11. Insurance model

### PD-LAB-INS-01 — Timing / ownership

| Field | Content |
|---|---|
| **ID** | PD-LAB-INS-01 |
| **Decision** | **PRODUCT DECISION REQUIRED** for when eligibility/preauth runs |
| **APPROVED** | Prefer Lab → Billing → CCMS; CCMS owns claims/settlement; no Lab claims engine |
| **Evidence** | billing_ccms_outbox; CCMS functions; FE `estimatedLab` is estimate-only |
| **Slice** | After COM + BILL |

### PD-LAB-INS-02 — Lab-visible insurance fields

| Field | Lab-visible? |
|---|---|
| Eligible / not / auth required / authorized | **PRODUCT DECISION REQUIRED** |
| Covered amount / patient share | **PRODUCT DECISION REQUIRED** (+ FIN-VIS) |
| Claim status / rejection reason | **PRODUCT DECISION REQUIRED** (often CCMS-only) |
| Patient-visible insurance detail | **PRODUCT DECISION REQUIRED** |

**APPROVED:** Do not expose insurance/financial data without approved visibility rules.

---

## 12. Financial visibility

### PD-LAB-FIN-VIS-01

| Persona | Unit price / payable / paid / outstanding / ins status |
|---|---|
| Lab Technician | **PRODUCT DECISION REQUIRED** (default **RECOMMENDED**: hide money) |
| Lab Manager | **PRODUCT DECISION REQUIRED** |
| Ordering Clinician / Doctor | **PRODUCT DECISION REQUIRED** |
| Front Office | **PRODUCT DECISION REQUIRED** |
| Billing Clerk / Cashier / Finance | Use existing `bill.view` / `opd_bill.view` / `ip.billing.*` / refund authorize — **EXISTING CERTIFIED** in Billing UI |
| Insurance/CCMS | `ccms.billing.read` etc. — **EXISTING** in CCMS |
| Admin | Wildcard / grants — existing |
| Patient | Portal/billing rules — **PRODUCT DECISION REQUIRED** for Lab surfaces |

| Field | Content |
|---|---|
| **ID** | PD-LAB-FIN-VIS-01 |
| **Decision** | **PRODUCT DECISION REQUIRED** for Lab UI; **APPROVED** reuse existing Billing/CCMS permission codes — **do not invent** new names in this workshop |
| **Slice** | L3-UX-01 |

---

## 13. Multi-item lifecycle

### PD-LAB-MULTI-02

| Scenario | Current model behavior | Required product rule |
|---|---|---|
| A completed + B pending | Single parent status only | **PRODUCT DECISION REQUIRED** |
| A cancelled + B completed | No item cancel | **PRODUCT DECISION REQUIRED** |
| A rejected + B pending | No specimen entity | **PRODUCT DECISION REQUIRED** (with L4) |
| A completed + B cancelled | — | **PRODUCT DECISION REQUIRED** |
| All completed | Parent → completed (Complete API) | Exists clinically; verify gate later |
| All cancelled | Soft-delete ≠ cancelled | **PRODUCT DECISION REQUIRED** |
| All on hold | Vocabulary only | **PRODUCT DECISION REQUIRED** |

| Field | Content |
|---|---|
| **ID** | PD-LAB-MULTI-02 |
| **Decision** | **PRODUCT DECISION REQUIRED** |
| **APPROVED** | Do **not** introduce `partially_completed` without explicit vocabulary approval |
| **Evidence** | `LabReportItem` has no Status/result fields; parent `LabReport.Status` only |
| **If PO requires independent item lifecycle** | Explicit model change required (item status and/or parent rollup rules) — mark as architecture impact |
| **Financial** | Partial reversal rules couple to BILL-02 |
| **Slice** | L3-WF / L4 / L5 |

---

## 14. Edit / cancel / hold / resume

### PD-LAB-ORD-EDIT-01 / CXL-01 / HOLD-01

| Topic | Decision |
|---|---|
| Can edit after create? | **PRODUCT DECISION REQUIRED** (fields, cutoff, who) |
| Add/remove tests after create? | **PRODUCT DECISION REQUIRED** (finance + MULTI-02) |
| Change clinician / indication / priority? | **PRODUCT DECISION REQUIRED** |
| Cancel who/when | **PRODUCT DECISION REQUIRED** |
| On hold / resume who/when | **PRODUCT DECISION REQUIRED** |
| Soft-delete as cancel? | **APPROVED: No** — soft-delete ≠ `cancelled` |
| New statuses? | **APPROVED: No** without explicit vocabulary decision |
| Notifications / finance / specimen effects | Depend on BILL-02, NOTIF-01, L4 |

| Status | **PRODUCT DECISION REQUIRED** (policy) + soft-delete rule **APPROVED** |
| Slice | L3-WF-01 |

---

## 15. Order Summary UX requirements

### PD-LAB-UX-SUM-01

| Field | Content |
|---|---|
| **ID** | PD-LAB-UX-SUM-01 |
| **Decision** | **PRODUCT DECISION REQUIRED** for timing/contents; pattern **RECOMMENDED** |
| **RECOMMENDED UX pattern** | Right-side Sheet / quote-style (Counselling `CounsellingQuotePanel` / `CounsellingQuoteBottomSheet` / estimate patterns) — **not** a new UI framework; **not** redesign L2 table |
| **Ownership of values** | Patient/clinician/tests/codes/specimen/TAT → Lab. Unit price/subtotal/discount/payable/paid → Billing. Shares/auth → Insurance/CCMS. |
| **When Sheet appears** | Composition / pre-create / post-create / pre-pay — **PRODUCT DECISION REQUIRED** |
| **Unavailable financials** | Show explicit unavailable/unmapped — never invent |
| **Slice** | L3-UX-01 (after FIN-VIS + COM-01) |
| **Do not implement in this workshop** | — |

---

## 16. Notification catalog

### PD-LAB-NOTIF-01

| Intent | Trigger | Recipients | Channel ownership | Ack | Required? |
|---|---|---|---|---|---|
| `lab.order.created` | Order created | Lab queue / clinician **PD** | Orchestration | No | **PRODUCT DECISION REQUIRED** |
| `lab.order.cancelled` | Cancel | Clinician / lab **PD** | Orchestration | No | **PRODUCT DECISION REQUIRED** |
| `lab.specimen.required` | Ready to collect | Phlebotomy **PD** | Orchestration | No | **PRODUCT DECISION REQUIRED** |
| `lab.specimen.rejected` | Reject | Ordering clinician + lab | Orchestration | No | **RECOMMENDED** L4 |
| `lab.recollection.required` | Recollect | Clinician / patient **PD** | Orchestration | No | **PRODUCT DECISION REQUIRED** |
| `lab.result.ready` | Released | Clinician; patient prefs | Orchestration + Hub | No | **RECOMMENDED** L6; prefs stub exists |
| `lab.result.critical` | Critical | On-call / clinician | Orchestration | **Yes via Lab API** | **PRODUCT DECISION REQUIRED** (CRIT-02) |
| `lab.result.amended` | Amend release | Clinician | Orchestration | No | **RECOMMENDED** L9 |
| `lab.tat.breach` | SLA breach | Ops / clinician | Orchestration | No | **PRODUCT DECISION REQUIRED** (TAT-01) |
| `lab.external.result.received` | Ext ingest | Lab review | Orchestration | No | **FUTURE** L12 |
| `lab.payment.required` | Unpaid gate | Patient / FO | **Billing-owned** preferred | No | **PRODUCT DECISION REQUIRED**; likely **NOT** Lab-owned |

| Field | Content |
|---|---|
| **ID** | PD-LAB-NOTIF-01 |
| **Decision** | **PRODUCT DECISION REQUIRED** for mandatory set |
| **APPROVED** | No SMS/WhatsApp/email hard-wiring in Lab; use orchestration; notifications must not mutate Lab state; crit ack uses Lab API if approved |
| **PHI** | Minimal necessary; no PHI in URLs/logs |
| **Evidence** | Settings stub `lab_results` only; toast on create is local UX |
| **Slice** | L3-NOTIF-01 / L6–L7 |

---

## 17. TAT / SLA policy

### PD-LAB-TAT-01

| Field | Content |
|---|---|
| **ID** | PD-LAB-TAT-01 |
| **Decision** | **PRODUCT DECISION REQUIRED** |
| **Evidence** | `TurnaroundHours` on LTD; priority enum routine/urgent/stat; **no** Lab business-hours/holiday SLA engine found in Lab path |
| **Need PO** | TAT start/stop events; routine vs urgent vs STAT; clock type; breach notify; escalation; dashboard |
| **Do not invent** | Lab-specific holiday calendars without hospital SLA evidence |
| **Slice** | Analytics / NOTIF after timestamps exist |

---

## 18. Package vs panel

### PD-LAB-PKG-01

| Concept | SoT | Notes |
|---|---|---|
| Clinical Laboratory Panel | `LaboratoryPanel` + members | Clinical composition |
| Commercial Billing Package | Billing package templates / explosion | `BillChargeSource.Package*` |

| Field | Content |
|---|---|
| **ID** | PD-LAB-PKG-01 |
| **Decision** | **PRODUCT DECISION REQUIRED** for commercial explosion of clinical panels |
| **APPROVED** | Do not conflate clinical panel membership with Billing package rules |
| **Open questions** | One SV vs many; component chargeability; discount; insurance; cancel/reverse |
| **Evidence** | PackageExplosion fails unmapped chargeable components; Lab panels sparsely populated |
| **Slice** | Before panel commercial go-live |

---

## 19. External lab commercials

### PD-LAB-EXT-COM-01

| Field | Content |
|---|---|
| **ID** | PD-LAB-EXT-COM-01 |
| **Decision** | **FUTURE** / **PRODUCT DECISION REQUIRED** before L12 commercial go-live |
| **Topics** | Patient charge vs external cost; referral fee; payer; reconciliation; refund; result dependency; TAT; partner failure |
| **Do not implement now** | — |

---

## 20. Cross-domain integration dependencies

Depends on **PD-LAB-INT-01** (approved). Financial reflection blocked on BILL-*/COM-*/INS-*/PAY-*. P360/Docs remain EXISTING CERTIFIED projection paths.

---

## 21. Permission implications

| Need | Approach | Status |
|---|---|---|
| Lab nav/workbench | `laboratory.view` | **EXISTING** |
| Lab API mutate (today) | `patient.view` / `patient.update` | **EXISTING** interim — cutover **PD-LAB-PERM-02** |
| See/collect/refund money | `bill.view`, `opd_bill.*`, `ip.billing.*`, refund authorize | **EXISTING CERTIFIED** — use in Billing UI |
| CCMS allocation view | `ccms.billing.read` etc. | **EXISTING** |
| New Lab finance permission codes | **Do not invent in this workshop** | Security Decision if needed |

---

## 22. Implementation dependencies

```text
L2 Manual UAT ──► L2 ACCEPTANCE (human)
        │
        ▼
 Product Owner closes COM-01/02 ──► L3-COM-01 (mapping) AUTHORIZED
        │
        ▼
 BILL-01/04/05/06 + PAY-01 + FIN-VIS + UX-SUM ──► L3-UX-01 / L3-COM-02
        │
 MULTI-02 + ORD-* ──► L3-WF-01
        │
 NOTIF-01 ──► L3-NOTIF-01
        │
 INS-01/02 ──► insurance display (with Billing/CCMS)
```

---

## 23. Acceptance criteria (program-level — when implementations ship)

1. One Lab order does not create duplicate charges (idempotency).  
2. Billing retains financial ownership.  
3. Laboratory retains clinical ownership.  
4. CCMS retains insurance ownership.  
5. P360 reflects Lab info without becoming Lab workbench.  
6. Billing/CCMS cannot silently mutate Lab clinical state.  
7. Financial visibility follows approved FIN-VIS.  
8. Payment failures never show false paid.  
9. Billing failures do not corrupt Lab clinical state.  
10. Retry does not duplicate financial transactions.  
11. Notifications do not mutate Lab state.  
12. Critical ack (if approved) uses authorized Lab API.  
13. Multi-item status behavior deterministic per MULTI-02.  
14. Cancellation/reversal deterministic per BILL-02.  
15. Patient-visible results follow release policy.  
16. Financial actions auditable.  
17. Slice 4 document behavior remains certified.

---

## 24. Decision register (summary table)

| ID | Topic | Status | Blocks |
|---|---|---|---|
| PD-LAB-INT-01 | Cross-domain principles | **APPROVED** | — |
| PD-LAB-COM-01 | Mapping / chargeability | **PRODUCT DECISION REQUIRED** | L3-COM-01 |
| PD-LAB-COM-02 | Non-chargeable representation | **PRODUCT DECISION REQUIRED** | L3-COM-01 |
| PD-LAB-COM-03 | Price resolution chain | **APPROVED** (arch); branch API detail **PDR** | L3-UX / COM-02 |
| PD-LAB-BILL-01 | Charge timing | **PRODUCT DECISION REQUIRED** | L3-COM-02 |
| PD-LAB-BILL-02 | Cancel/reversal matrix | **PRODUCT DECISION REQUIRED** | L3-WF + COM-02 |
| PD-LAB-BILL-04 | OPD/IP bill association | **PRODUCT DECISION REQUIRED** | L3-COM-02 |
| PD-LAB-BILL-05 | Idempotency key shape | **PRODUCT DECISION REQUIRED** | L3-COM-02 |
| PD-LAB-BILL-06 | BillChargeSource | **PRODUCT DECISION REQUIRED** | L3-COM-02 |
| PD-LAB-PAY-01 | Unpaid clinical gates | **PRODUCT DECISION REQUIRED** | Coupled L3+ |
| PD-LAB-FIN-VIS-01 | Who sees money in Lab | **PRODUCT DECISION REQUIRED** | L3-UX-01 |
| PD-LAB-UX-SUM-01 | Order Summary Sheet | **PRODUCT DECISION REQUIRED** | L3-UX-01 |
| PD-LAB-INS-01/02 | Insurance timing/display | **PRODUCT DECISION REQUIRED** | Ins display |
| PD-LAB-MULTI-02 | Item vs parent lifecycle | **PRODUCT DECISION REQUIRED** | L3-WF / L4–L6 |
| PD-LAB-ORD-* | Edit/cancel/hold/resume | **PRODUCT DECISION REQUIRED** | L3-WF-01 |
| PD-LAB-NOTIF-01 | Notification catalog | **PRODUCT DECISION REQUIRED** | L3-NOTIF-01 |
| PD-LAB-TAT-01 | TAT/SLA | **PRODUCT DECISION REQUIRED** | Breach/analytics |
| PD-LAB-PKG-01 | Panel vs package | **PRODUCT DECISION REQUIRED** | Panel commercial |
| PD-LAB-EXT-COM-01 | External lab commercials | **FUTURE** / **PDR** | L12 |

---

## 25. L3 implementation authorization gate

| Slice | Authorized now? | Reason |
|---|---|---|
| **L3-COM-01** (ServiceVariant mapping) | **NO** (this workshop alone) | COM-01/02 **APPROVED** in PO closure; still needs L2 acceptance / waiver + bounded impl prompt |
| L3-UX-01 Order Summary | **NO** | UX-SUM + FIN-VIS + COM unresolved |
| L3-COM-02 charge posting | **NO** | BILL-01/04/05/06 + PAY unresolved |
| L3-ROUTE-01 PerformingLaboratory | **NO** under this workshop’s commercial gate; clinical routing still needs L2 acceptance + normal L3 kickoff — **not authorized here** |
| L3-WF-01 lifecycle | **NO** | ORD-* / MULTI-02 unresolved |
| Any Billing/Insurance/Notification implementation | **NO** | Explicit non-implementation |

**L2 acceptance:** still a separate Manual UAT gate — **not claimed**.

---

## Final report

### Evidence found
Hybrid FK, variant_prices, ChargeCatalogResolver kinds, BillChargeSource without Laboratory, OpdBill idempotency/package/IP journey patterns, billing_ccms_outbox, finance permission codes, Slice 4 + P360, notification stub only, no Lab unpaid gate, no Lab charge timing, LabReportItem without status.

### Now approved
INT-01 boundaries; Option C / price SoT / no Lab ledger; Lab→Billing→CCMS preference; soft-delete ≠ cancel; no silent Manual Lab charges; no `partially_completed` without vocabulary PD; COM-03 architectural chain; Slice 4 certified continuity.

### Remains PRODUCT DECISION REQUIRED
COM-01/02, BILL-01/02/04/05/06, PAY-01, FIN-VIS, UX-SUM, INS-01/02, MULTI-02, ORD-*, NOTIF-01, TAT-01, PKG-01 (+ EXT-COM for L12).

### Deferred
CRIT-02, VER-02, PERM-02, QC-02, counsellor bridge detail, interop IFACE.

### Unblocked vs blocked slices
- **Unblocked for coding by this workshop:** **none**.  
- **Blocked:** L3-COM-01 and all later L3 commercial/lifecycle/notification slices until listed PDs are Product-Owner approved (and L2 acceptance / explicit waiver as applicable).

### L3-COM-01 authorized?
**No.**

```text
L3-PD REMAINING DECISIONS COMPLETE
NO IMPLEMENTATION PERFORMED
L2 ACCEPTANCE NOT CLAIMED
L3 IMPLEMENTATION NOT STARTED
L3-COM-01 GATED BY L2 ACCEPTANCE / PROGRAM WAIVER
```
