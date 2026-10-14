# Laboratory Management — Product Owner Decision Closure

**Date:** 2026-10-08  
**Type:** PRODUCT DECISION CLOSURE (BUSINESS-POLICY CONTRACT)  
**Mode:** NO IMPLEMENTATION · NO CODE · NO SCHEMA · NO API · NO UI · NO PERMISSIONS  
**Status:** PRODUCT DECISIONS RECORDED — L3 CODING NOT AUTHORIZED BY THIS DOCUMENT ALONE  

**Sources:**
1. [laboratory-management-product-definition-v3.md](./laboratory-management-product-definition-v3.md)
2. [laboratory-management-e2e-gap-analysis.md](./laboratory-management-e2e-gap-analysis.md)
3. [laboratory-management-roadmap-rebaseline.md](./laboratory-management-roadmap-rebaseline.md)
4. [laboratory-management-pd-lab-int-01-cross-domain-integration.md](./laboratory-management-pd-lab-int-01-cross-domain-integration.md)
5. [laboratory-management-l3-product-decisions.md](./laboratory-management-l3-product-decisions.md)
6. [laboratory-management-product-owner-decision-matrix.md](./laboratory-management-product-owner-decision-matrix.md)

**Consistency check:** Selected decisions align with Option C hybrid catalog, INT-01 P1–P10, existing `variant_prices` / Billing ownership, `BillChargeSource` (no Laboratory value today), `ChargeCatalogResolver` kinds, Slice 4 attach≠complete, and six-status vocabulary. **No repository contradiction found** that would require STOP.

```text
PRODUCT OWNER DECISION CLOSURE COMPLETE
PRODUCT DECISIONS RECORDED
NO IMPLEMENTATION PERFORMED
NO CODE CHANGES
NO SCHEMA CHANGES
NO API CHANGES
NO UI CHANGES
L2 ACCEPTANCE NOT CLAIMED
L3 IMPLEMENTATION NOT STARTED
L3-COM-01 GATED BY L2 ACCEPTANCE / PROGRAM WAIVER
READY FOR NEXT EXPLICIT IMPLEMENTATION GATE
```

---

## 1. Executive decision summary

This closure converts Product Owner–selected recommendations into **APPROVED** business policy for Laboratory Management L3 planning, while keeping detailed finance cells, security/schema follow-ups, and external-lab commercials explicitly **PENDING** / **DEFERRED**.

| Outcome | Result |
|---|---|
| Commercial / billing ownership model | **APPROVED** |
| Charge at specimen collection (OPD); IP hybrid | **APPROVED** |
| Clinical vs financial separation (order without mapping OK; post requires mapping) | **APPROVED** |
| Typed Laboratory BillChargeSource (policy) | **APPROVED** — schema change not done |
| Unpaid must not block create/process/verify; STAT collect not hard-blocked | **APPROVED** |
| Order Summary Sheet clinical-first pattern | **APPROVED** |
| Multi-item: parent status SoT; no `partially_completed` | **APPROVED** |
| External lab commercials | **DEFERRED** (L12) |
| Detailed refund matrix cells, release-gate UX, hold×collect, TAT clock stamps, schema/security for COM-02 & SourceType | **PENDING** follow-up |
| L3 coding | **Not started; not auto-authorized** |

---

## 2. Decisions approved

| ID | Status |
|---|---|
| PD-LAB-COM-01 | **APPROVED** |
| PD-LAB-COM-02 | **APPROVED** (Option A semantics; field not implemented) |
| PD-LAB-COM-03 | **APPROVED** (chain + SoT; branch gap = implementation finding) |
| PD-LAB-BILL-01 | **APPROVED** (OPD charge at specimen collection) |
| PD-LAB-BILL-02 | **APPROVED** (ownership only; detailed cells → Finance follow-up) |
| PD-LAB-BILL-04 | **APPROVED** (hybrid OPD/IP) |
| PD-LAB-BILL-05 | **APPROVED** (conceptual idempotency identity) |
| PD-LAB-BILL-06 | **APPROVED** (typed Laboratory source; code not changed) |
| PD-LAB-PAY-01 | **APPROVED** (baseline gates; detail follow-ups) |
| PD-LAB-FIN-VIS-01 | **APPROVED** |
| PD-LAB-UX-SUM-01 | **APPROVED** |
| PD-LAB-INS-01 | **APPROVED** |
| PD-LAB-INS-02 | **APPROVED** |
| PD-LAB-MULTI-02 | **APPROVED** (initial model) |
| PD-LAB-ORD-EDIT | **APPROVED** (baseline) |
| PD-LAB-ORD-CXL | **APPROVED** |
| PD-LAB-ORD-HOLD | **APPROVED** (baseline; collection rule follow-up) |
| PD-LAB-NOTIF-01 | **APPROVED** (catalog ownership + core intents) |
| PD-LAB-TAT-01 | **APPROVED** (elapsed hours; clock stamps follow-up) |
| PD-LAB-PKG-01 | **APPROVED** |
| PD-LAB-INT-01 P1–P10 | **APPROVED** (reaffirmed) |
| PD-LAB-CAT-01 Option C | **APPROVED** (reaffirmed) |

---

## 3. Decisions deferred

| ID | Status | Notes |
|---|---|---|
| PD-LAB-EXT-COM-01 | **DEFERRED** | External/send-out commercials — L12 future PO pass |
| Calendar/holiday TAT engine | **DEFERRED** / **FUTURE** | Separate slice if required |
| Independent item-status schema | **DEFERRED** | Only if future PO requires; not in initial model |
| Counsellor bridge billing map | **DEFERRED** | PD-LAB-14-DETAIL / L16 |

---

## 4. Decisions still pending (follow-up)

See §“DECISIONS STILL REQUIRING EXPLICIT FOLLOW-UP” below. These remain **PENDING** and are **not** silently approved.

---

## 5. Commercial policy

### PD-LAB-COM-01 — **APPROVED**

1. `LaboratoryTestDefinition` = clinical identity.  
2. `ServiceVariant` = commercial/billable identity.  
3. LTD → ServiceVariant mapping = governed master data.  
4. Clinical ordering must not silently invent a price.  
5. Unmapped LTD is **not** automatically non-chargeable.  
6. Null `ServiceVariantId` = **UNMAPPED** unless explicit non-billable semantics apply (COM-02).  
7. Unmapped chargeable test must **not** become financially actionable.  
8. Clinical ordering **may** proceed without commercial mapping.  
9. Financial posting / priced financial estimate **requires** valid mapping (+ priced resolver result).  
10. **No** silent Manual billing fallback.  
11. Mapping changes must be auditable.  
12. Mapping ownership uses existing catalog / Billing master-data administration paths.  
13. **No** new permissions invented in this closure.

**Principle:** Clinical care and financial readiness are separate.

### PD-LAB-COM-02 — **APPROVED**

- Preferred representation: **Option A** — explicit Laboratory catalog-level non-billable semantics.  
- Rationale: distinguish UNMAPPED vs non-billable; `ServiceVariantItemMaps.IsChargeable` is **not** the Lab catalog rule.  
- **Not implemented** here. Schema/security for the field = follow-up (see § follow-up).

### PD-LAB-COM-03 — **APPROVED**

```text
LTD → ServiceVariant → variant_prices
    → existing Billing resolver / branch-aware price resolution
    → Billing staging / OpdBill
```

- Price SoT = Billing / `variant_prices`.  
- Never copy price onto LTD as financial SoT.  
- **Implementation finding:** `ChargeCatalogResolver.ResolveVariantAsync` currently does not apply `branch_id` override in the amount pick sequence — must be addressed in a later implementation design, not in this closure.

### PD-LAB-PKG-01 — **APPROVED**

- `LaboratoryPanel` ≠ Billing Package.  
- Clinical grouping vs commercial grouping remain separate.  
- Do not automatically reuse Billing package explosion for Lab panels.  
- Commercial behavior configured explicitly per Laboratory panel.

---

## 6. Billing policy

### PD-LAB-BILL-01 — **APPROVED**

- **Normal OPD laboratory:** charge at **specimen collection**.  
- No temporary alternate charge trigger invented here.  
- **IP:** hybrid association per BILL-04.  
- **STAT/emergency:** clinical workflow must not be blocked merely because payment has not occurred (see PAY-01).  
- Detailed emergency billing exceptions not in repo remain operational follow-up — not invented rules.

### PD-LAB-BILL-02 — **APPROVED (ownership)**

| Domain | Owns |
|---|---|
| Laboratory | Clinical status; clinical cancellation state |
| Billing | Financial reversal; refund; credit/adjustment |

Laboratory must **never** directly mutate the financial ledger.

**Detailed state-by-state accounting cells are NOT fully approved** — see Finance follow-up.

### PD-LAB-BILL-04 — **APPROVED**

- **Hybrid:** OPD → existing OPD Billing model; IP → existing IP journey/bill model.  
- No `LaboratoryBill`.  
- Capture `VisitId` / `PatientJourneyId` where applicable.  
- No duplicate billing hierarchy.

### PD-LAB-BILL-05 — **APPROVED (conceptual)**

Identity: `tenantId + labReportId + labReportItemId + chargeReason [+ chargeKind]`.  
Exact string format = implementation design aligned with Billing conventions.

### PD-LAB-BILL-06 — **APPROVED (policy)**

- Typed **Laboratory** `BillChargeSource`.  
- Do **not** use Manual + implicit Lab semantics.  
- Code/schema change not performed; Billing/security approval may be required before implementation.

---

### Finance follow-up (BILL-02 detailed cells)

The following require **FINANCE DECISION** confirmation before charge posting goes live:

| Clinical context | Clinical cancel? | Reverse? | Refund? | Credit? | Notes |
|---|---|---|---|---|---|
| `ordered`, no charge yet | Likely yes | N/A | N/A | N/A | Confirm |
| `ordered`, charge posted (if any interim) | Confirm | Confirm | Confirm | Confirm | Timing is collect — rare |
| `sample_collected`, pre-result | Confirm | Confirm | Confirm | Confirm | |
| `in_progress` | Confirm | Confirm | Confirm | Confirm | |
| After verify / `completed` | Confirm (usually amend, not cancel) | Confirm | Confirm | Confirm | Refund authorize perms |
| `on_hold` with/without charge | Confirm | Confirm | Confirm | Confirm | |
| Partial multi-item cancel | Confirm | Per-item reverse | Confirm | Confirm | Couples MULTI-02 |
| Specimen reject / recollect | Confirm | Confirm | Confirm | Confirm | Couples L4 |

---

## 7. Payment policy

### PD-LAB-PAY-01 — **APPROVED**

| Gate | Policy |
|---|---|
| Order creation | **No** payment block |
| Processing | **No** payment block |
| Verification | **No** payment block |
| Specimen collection | **No hard-block** for STAT/emergency due to payment |
| Routine OPD self-pay collect | May use approved financial **warning / soft gate** — exact UX/ACL = follow-up |
| Patient result release | Financial release gate **MAY** exist; must be explicit; must **never** create false “paid” | Exact behavior = follow-up |

Clinical Laboratory workflow must not become unsafe or clinically invalid merely because payment is outstanding.

---

## 8. Financial visibility policy

### PD-LAB-FIN-VIS-01 — **APPROVED**

- Lab operational UI is **clinical-first**.  
- Lab technicians: **no** financial amounts by default.  
- Lab managers: controlled summary only via **existing** approved permissions.  
- Ordering clinicians: limited estimate/status where approved.  
- Billing / Finance / CCMS: existing Billing/CCMS workbenches and permissions.  
- No duplicate financial permissions unless a later **Security Decision**.  
- Laboratory must not become a cashier workbench.

---

## 9. Order UX policy

### PD-LAB-UX-SUM-01 — **APPROVED**

- Use existing Hospital Portal **right-side Sheet** pattern.  
- Appear during composition / confirmation.  
- Summarize: patient, clinician, selected tests, codes, specimen, priority, TAT, indication/notes as appropriate.  
- Financial / insurance only where FIN-VIS / INS authorize.  
- Clinical confirmation + Billing handoff/deep-link where appropriate.  
- **Must not** become Billing, cashier, claims, CCMS workbench, or Lab ledger.  
- **Must not** redesign the L2 selected-test table.

---

## 10. Insurance policy

### PD-LAB-INS-01 — **APPROVED**

- Lab does **not** submit claims.  
- Chain: Laboratory → Billing → CCMS.  
- CCMS authoritative for insurance/claims.  
- Lab may consume authorized insurance status.  
- Unavailable insurance must not automatically prevent clinical ordering.  
- Commercial handling follows Billing/CCMS policy.

### PD-LAB-INS-02 — **APPROVED**

- Lab may show read-only insurance **status** where authorized.  
- Amounts require FIN-VIS authorization.  
- Claim details remain CCMS-owned.  
- No Laboratory claims workbench.

---

## 11. Multi-item lifecycle policy

### PD-LAB-MULTI-02 — **APPROVED (initial)**

- Parent `LabReport` status remains the Laboratory status vocabulary SoT.  
- **No** `partially_completed`.  
- Items may become clinically ready at different times.  
- Parent completion: all reportable/pending items resolved per lifecycle policy.  
- Financial identity at **LabReportItem** / charge-line level.  
- Patient-visible results may release per result-release policy without a new parent status.  
- Future independent item statuses require a **separate** product/schema decision.

---

## 12. Cancellation / hold / edit policy

### PD-LAB-ORD-EDIT — **APPROVED (baseline)**

| Phase | Allowed |
|---|---|
| While `ordered` | Indication, notes, priority, ordering clinician (where valid), test selection subject to commercial/lifecycle rules |
| After `sample_collected` | Core collected test identity and specimen identity **immutable** |

No silent changes that invalidate collected specimens or financial identity.

### PD-LAB-ORD-CXL — **APPROVED**

- Explicit clinical lifecycle action → `cancelled`.  
- **Not** soft-delete.  
- Authorized, auditable.  
- Respects Billing reversal rules and multi-item rules.  
- No deletion-based cancellation mechanism.

### PD-LAB-ORD-HOLD — **APPROVED (baseline)**

- `on_hold` is a real operational state.  
- Hold must prevent inappropriate processing/release.  
- Resume returns to correct active lifecycle.  
- Auditable.  
- No controlled hold-reason vocabulary invented here.  
- Collection-under-hold exact rule = follow-up.

---

## 13. Notification policy

### PD-LAB-NOTIF-01 — **APPROVED**

- Use existing Notification Hub / NotificationService.  
- Core intents: result ready/released; order cancellation; critical result; TAT breach where TAT policy active.  
- Order-created / specimen-collected: **optional**, not mandatory noise.  
- Payment notifications: **Billing-owned**.  
- Insurance notifications: **Billing/CCMS-owned**.  
- Critical ack (if implemented): authorized **Laboratory API** only.  
- No second notification system; no channel hard-wiring in Lab.

---

## 14. TAT policy

### PD-LAB-TAT-01 — **APPROVED (initial)**

- Initial measurement: **elapsed hours** from catalog `TurnaroundHours`.  
- No holiday/business-hours SLA engine in this policy slice.  
- Calendar-aware SLA = future decision + slice.  
- **Recommended baseline (not implemented):** start at specimen collection; stop at result release — exact timestamps remain follow-up until confirmed for implementation.

---

## 15. Panel / package policy

See §5 PD-LAB-PKG-01 — **APPROVED**.

---

## 16. Cross-domain integration contract

Reaffirms **PD-LAB-INT-01** P1–P10. No second event bus. No Laboratory financial ledger.

| Path | SoT | Direction | Mutate Lab? | Audit | Idempotency | Patient visibility |
|---|---|---|---|---|---|---|
| Lab → Billing | Billing ledger | Lab command → Billing | **No** | Billing + correlation | Conceptual BILL-05 | Via Billing / FIN-VIS |
| Billing → CCMS | CCMS claims | Existing outbox | **No** | CCMS/Billing | Outbox keys | Limited / portal rules |
| Lab → Documents | Documents platform | Attach/associate | Status unchanged (attach≠complete) | Docs + Lab | Canonical identity | Released/attached |
| Lab → Notifications | Comms orchestration | Intent → delivery | Crit ack via Lab API only | Comms | Dedupe by event | Prefs / released |
| Lab → P360 | Lab + Docs read models | Read projection | **No** | Access | N/A | Released per policy |
| Lab → Analytics | Derived | Query / metrics | **No** | As required | N/A | N/A |

---

## 17. DECISIONS STILL REQUIRING EXPLICIT FOLLOW-UP

| # | Topic | Classification |
|---|---|---|
| 1 | BILL-02 detailed reversal/refund/credit cells by status | **FINANCE DECISION** |
| 2 | PAY-01 exact routine OPD collection warning/soft-gate UX/ACL | **PRODUCT DECISION FOLLOW-UP** |
| 3 | PAY-01 exact patient-facing result release financial gate | **PRODUCT DECISION FOLLOW-UP** |
| 4 | ORD-HOLD exact specimen-collection behavior while on hold | **PRODUCT DECISION FOLLOW-UP** |
| 5 | TAT exact start/stop timestamp fields & events | **PRODUCT DECISION FOLLOW-UP** + **IMPLEMENTATION DESIGN** |
| 6 | Any new security permissions (mapping admin / Lab finance view) | **SECURITY DECISION** — none invented here |
| 7 | Schema approval for COM-02 non-billable catalog semantics | **SECURITY DECISION** / schema gate + **IMPLEMENTATION DESIGN** |
| 8 | Branch-aware Billing resolver implementation detail | **IMPLEMENTATION DESIGN** (finding recorded) |
| 9 | Exact BillChargeSource schema/code change + Billing approval | **SECURITY DECISION** / Billing change control + **IMPLEMENTATION DESIGN** |
| 10 | Exact idempotency string format | **IMPLEMENTATION DESIGN** |
| 11 | Emergency billing exception details beyond PAY-01 | **FINANCE DECISION** / operational |
| 12 | External lab commercials | **FUTURE** (DEFERRED EXT-COM-01) |

---

## 18. Implementation dependencies

```text
L2 MANUAL UAT → L2 ACCEPTANCE (or explicit program waiver)
        ↓
COM-01 + COM-02 APPROVED  (this closure)  → L3-COM-01 may be proposed in a separate bounded prompt
        ↓
BILL-01/04/05/06 APPROVED + follow-ups for SourceType schema / idempotency string
        + FIN-VIS / UX-SUM APPROVED
        ↓
Separate prompt: L3-COM-02 / L3-UX-01 (after Finance cells as needed)
        ↓
MULTI-02 / ORD-* APPROVED → L3-WF-01 (separate prompt)
        ↓
NOTIF-01 / TAT follow-ups → L3-NOTIF-01 (separate prompt)
```

Each slice must still follow: **AUDIT → PRODUCT DECISION → IMPLEMENTATION → AUTOMATED TESTS → MANUAL UAT → ACCEPTANCE → NEXT SLICE**.

---

## 19. L2 / L3 gate status

| Gate | Status |
|---|---|
| L2 Order Composer | Implemented |
| FE / BE baselines | 69 / 53 passed |
| L2 Manual UAT | **Not accepted** |
| L2 acceptance | **NOT CLAIMED** |
| L3 implementation | **NOT STARTED** |
| L3-COM-01 | **AUTHORIZED ONLY AFTER** (1) L2 acceptance **OR** explicitly approved program waiver, **and** (2) COM-01 approved, **and** (3) COM-02 approved |
| Other L3 slices | **Not** automatically authorized by this document |

COM-01 and COM-02 are **APPROVED** in this closure; the remaining hard gate for L3-COM-01 is therefore **L2 acceptance or program waiver**, plus a separately bounded implementation prompt.

---

## 20. Explicit out-of-scope (this closure)

Code, schema, migrations, APIs, UI, permissions, tests, ServiceVariant population, charge posting, billing/insurance/notification/lifecycle implementation, BillChargeSource code change, non-billable field implementation.

---

## 21. Final decision register

| ID | PO Decision |
|---|---|
| PD-LAB-COM-01 | **APPROVED** |
| PD-LAB-COM-02 | **APPROVED** |
| PD-LAB-COM-03 | **APPROVED** |
| PD-LAB-BILL-01 | **APPROVED** |
| PD-LAB-BILL-02 | **APPROVED** (ownership); detailed cells **PENDING** Finance |
| PD-LAB-BILL-04 | **APPROVED** |
| PD-LAB-BILL-05 | **APPROVED** (conceptual) |
| PD-LAB-BILL-06 | **APPROVED** (policy); schema **PENDING** impl/security |
| PD-LAB-PAY-01 | **APPROVED** (baseline); collect soft-gate & patient release gate **PENDING** |
| PD-LAB-FIN-VIS-01 | **APPROVED** |
| PD-LAB-UX-SUM-01 | **APPROVED** |
| PD-LAB-INS-01 | **APPROVED** |
| PD-LAB-INS-02 | **APPROVED** |
| PD-LAB-MULTI-02 | **APPROVED** |
| PD-LAB-ORD-EDIT | **APPROVED** |
| PD-LAB-ORD-CXL | **APPROVED** |
| PD-LAB-ORD-HOLD | **APPROVED** (baseline); collect-on-hold **PENDING** |
| PD-LAB-NOTIF-01 | **APPROVED** |
| PD-LAB-TAT-01 | **APPROVED** (elapsed hours); clock stamps **PENDING** |
| PD-LAB-PKG-01 | **APPROVED** |
| PD-LAB-EXT-COM-01 | **DEFERRED** |

---

## Final status

```text
PRODUCT OWNER DECISION CLOSURE COMPLETE
PRODUCT DECISIONS RECORDED
NO IMPLEMENTATION PERFORMED
NO CODE CHANGES
NO SCHEMA CHANGES
NO API CHANGES
NO UI CHANGES
L2 ACCEPTANCE NOT CLAIMED
L3 IMPLEMENTATION NOT STARTED
L3-COM-01 GATED BY L2 ACCEPTANCE / PROGRAM WAIVER
READY FOR NEXT EXPLICIT IMPLEMENTATION GATE
```
