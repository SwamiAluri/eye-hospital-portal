# L-CRT-01 — Authorized Result Discovery UX  
# Product Decision Closure (PD-CRT-UX-01)

**Date:** 2026-10-12  
**Slice:** L-CRT-01 Manual UAT entry-point UX/IA correction (decision closure only)  
**Mode:** PRODUCT DECISION / UX IA CLOSURE ONLY — no application source, UI, routes, APIs, schema, migrations, permissions, role grants, CriticalResultEvent backend, ResultStatus, L-TST-01A, L-VER-01, L-AUTH-01, Collection, Specimen, Receiving, Barcode, Pathology, Reporting, Amendments, Instrument/Runs/QC, Referral, or Billing implementation  

**Parent stamp:** `PRODUCT_DECISIONS_CLOSED_L_CRT_01_AUTHORIZED`  
**Parent closure:** [enterprise-lms-critical-results-decision-closure.md](./enterprise-lms-critical-results-decision-closure.md)  
**Implementation baseline (Critical):** [enterprise-lms-critical-results-implementation.md](./enterprise-lms-critical-results-implementation.md)  
**PRE-UAT baseline:** [enterprise-lms-critical-results-pre-uat-verification.md](./enterprise-lms-critical-results-pre-uat-verification.md)  

```text
PRODUCT_DECISIONS_CLOSED_L_CRT_01_AUTHORIZED
  → L-CRT-01 Critical Results implemented + PRE-UAT passed
  → Manual UAT entry-point gap confirmed (ClinicallyAuthorized → Mark Critical)
  → UX correction audit (read-only)
  ↓
PD-CRT-UX-01 (THIS DOCUMENT)
  ← PRODUCT OWNER APPROVED (bounded Authorized Results discovery)
  ↓
SEPARATE ENGINEERING IMPLEMENTATION TASK
  ← AUTHORIZED BY THIS STAMP
  ← NOT IMPLEMENTED BY THIS DOCUMENT
```

---

## 1. Document purpose

This document formally closes the small UX/IA product decision required to unblock Manual UAT for the already-implemented L-CRT-01 Critical Results slice.

It authorizes a **separate** engineering task to add a discoverable **Authorized Results** worklist under Results & Authorization so staff can open an existing ClinicallyAuthorized Result Detail and use the already-implemented **Mark as Critical** action.

**This document does not implement that UX.**

It does **not** broaden the L-CRT-01 CriticalResultEvent model, ResultStatus lifecycle, Critical event-backed queue (AD-CRT-06), Testing/Verification/Authorization semantics, permissions, or backend contracts beyond reusing the existing Testing Work Queue filter.

---

## 2. Problem and confirmed UAT blocker

### 2.1 Problem

L-CRT-01 Mark Critical is implemented in `CriticalResultPanel` (mounted from `ResultDraftEntry` on Manual Results). Classification for ClinicallyAuthorized Results is approved and implemented on that panel.

Manual UAT cannot reach that panel for existing ClinicallyAuthorized Results because no discoverable UI worklist supplies:

- `orderTestId`
- `specimenId`
- `operatingBranchId`

required by:

```text
/dashboard/lms/testing/manual-results
  ?orderTestId={guid}
  &specimenId={guid}
  &operatingBranchId={guid}
```

### 2.2 Confirmed UAT blocker

```text
ClinicallyAuthorized Result
    ↓  (missing discoverable UI path)
Result Detail (ResultDraftEntry)
    ↓
Mark as Critical (CriticalResultPanel)
```

The Critical Results queue cannot solve first-time classification because it is **event-backed** and only lists existing `CriticalResultEvent` rows.

---

## 3. Discovery findings (certified)

| Surface | Route | Behavior relevant to blocker |
|---|---|---|
| Testing Workbench | `/dashboard/lms/testing` | L-TST-01A Draft-oriented default work queue |
| Verification | `/dashboard/lms/results/verification` | Filters Draft |
| Authorization | `/dashboard/lms/results/authorization` | Filters TechnicalVerified; can Open Result Detail |
| Critical Results | `/dashboard/lms/results/critical` | Event-backed CriticalResultEvents only |
| Manual Results | `/dashboard/lms/testing/manual-results` | Result Detail / draft-entry; requires OT + Specimen + branch |
| Results hub | `/dashboard/lms/results` | Placeholder |
| Work Queue | `/dashboard/lms/work-queue` | Placeholder |

Additional findings:

1. Backend already supports `GET /lms/testing/work-queue?resultStatus=ClinicallyAuthorized` — **no new Result list API required**.  
2. `testingWorkQueuePrimaryAction` currently returns `null` for ClinicallyAuthorized.  
3. `CriticalResultPanel` already supports Mark as Critical for TechnicalVerified and ClinicallyAuthorized.  
4. No generic Result-by-id detail route exists — and none is authorized by this decision.  
5. TechnicalVerified Results can already be opened via Authorization when TV items exist; the Manual UAT gap for current data is **ClinicallyAuthorized discovery**.

---

## 4. Decision register

| ID | Decision | Status |
|---|---|---|
| **PD-CRT-UX-01** | Dedicated **Authorized Results** discovery under Results & Authorization; ClinicallyAuthorized-only; reuses existing Testing Work Queue API and existing Result Detail / CriticalResultPanel; unblocks L-CRT-01 Manual UAT entry point; does **not** broaden CriticalResultEvent model | **APPROVED** |

### PD-CRT-UX-01 — Approved behavior

1. Add a dedicated discovery surface under **Results & Authorization → Authorized Results**.  
2. List only `ResultStatus = ClinicallyAuthorized`.  
3. Reuse `GET /lms/testing/work-queue?resultStatus=ClinicallyAuthorized`.  
4. Reuse existing: `TestingWorkbench`, work-queue contracts, `testingWorkQueuePrimaryAction`, `ResultDraftEntry`, `CriticalResultPanel`.  
5. Selecting a row opens existing Manual Results Result Detail with `orderTestId`, `specimenId`, `operatingBranchId`.  
6. `CriticalResultPanel` remains the authoritative Mark as Critical UI.  
7. Critical Results queue remains **EVENT-BACKED ONLY**.  
8. Do **not** place eligible-but-not-yet-critical Results into the Critical event queue.  
9. Do **not** modify default Testing Workbench semantics.  
10. Do **not** modify Verification semantics.  
11. Do **not** modify Authorization semantics.  
12. Do **not** modify L-TST-01A, L-VER-01, or L-AUTH-01 product/lifecycle stamps.  
13. No new Result-by-id API.  
14. No new Result aggregate or backend state machine.  
15. No CriticalResultEvent backend changes.  
16. No ResultStatus changes.  
17. No Critical ResultStatus.  
18. No permission or role changes authorized by this UX decision.  
19. No production role grants.  
20. No database / schema / migration changes.

---

## 5. Exact route / navigation

| Item | Approved value |
|---|---|
| Nav parent | Results & Authorization |
| Nav label | **Authorized Results** |
| Route | `/dashboard/lms/results/authorized` |
| Detail (reuse) | `/dashboard/lms/testing/manual-results?orderTestId={guid}&specimenId={guid}&operatingBranchId={guid}` |
| Critical event queue (unchanged) | `/dashboard/lms/results/critical` |

Capability registry: add/update entry for Authorized Results **only if** required by the existing LMS capability-registry pattern (same class of FE registration used by Verification / Authorization / Critical). No new permission codes.

---

## 6. Reuse strategy

| Layer | Reuse |
|---|---|
| Worklist API | Existing `GET /lms/testing/work-queue` with `resultStatus=ClinicallyAuthorized` |
| Worklist UI | Existing `TestingWorkbench` composed like Verification/Authorization pages |
| Row action | Extend `testingWorkQueuePrimaryAction` so ClinicallyAuthorized → `open-result` (same destination pattern as TechnicalVerified) |
| Result Detail | Existing `ResultDraftEntry` on Manual Results |
| Mark Critical | Existing `CriticalResultPanel` (no Critical UI rewrite) |

---

## 7. UX honesty (mandatory)

Authorized Results must communicate that listed items are:

**ClinicallyAuthorized LMS Results**

and are **not**:

- Final  
- Released  
- Published  
- Patient-visible  

Do not imply Authorized Results are final clinical reports.  
Do not introduce fake KPIs, Critical thresholds, or Critical detection automation.

---

## 8. Scope

### 8.1 In scope (authorized for separate engineering task)

- Authorized Results discovery page  
- Results & Authorization navigation entry  
- Capability registry entry if required by existing LMS pattern  
- ClinicallyAuthorized work-queue filtering (existing API)  
- Open Result action for ClinicallyAuthorized  
- Reuse of `ResultDraftEntry` + `CriticalResultPanel`  
- FE tests for the new page and primary action  
- Documentation of the UX correction (implementation / PRE-UAT notes as needed)

### 8.2 Out of scope (explicitly unauthorized)

- CriticalResultEvent backend changes  
- Critical classification / acknowledgement / notification / audit / idempotency / concurrency backend changes  
- ResultStatus changes; Critical as ResultStatus  
- Result-by-id API; new backend Result API  
- Testing Workbench default queue changes  
- Verification changes; Clinical Authorization changes  
- Collection / Specimen / Receiving / Barcode / Pathology  
- Reporting / Final / Release / Amendments / Instrument/Runs/QC / Referral / Billing  
- Critical thresholds / escalation / patient communication  
- Permission grants / production role grants  
- Schema / migrations  

---

## 9. Certified boundaries preserved

| Boundary | Status |
|---|---|
| `PRODUCT_DECISIONS_CLOSED_L_CRT_01_AUTHORIZED` Critical model | **Unchanged** |
| AD-CRT-06 Critical queue event-backed | **Preserved** |
| Result lifecycle Draft → TechnicalVerified → ClinicallyAuthorized | **Preserved** |
| Critical orthogonal to ResultStatus | **Preserved** |
| L-TST-01A / L-VER-01 / L-AUTH-01 | **Not reopened** |
| Upstream Collection / Specimen / Receiving / Barcode / Pathology | **Not reopened** |

---

## 10. Implementation gate

# PRODUCT_DECISIONS_CLOSED_L_CRT_UX_01_AUTHORIZED

**IMPLEMENTATION_NOT_STARTED**

**THIS DOCUMENT AUTHORIZES A SEPARATE FUTURE ENGINEERING IMPLEMENTATION TASK:**

**L-CRT-UX-01 — Authorized Results discovery (bounded FE only)**

That task must:

1. Implement only the in-scope items in §8.1.  
2. Obey §4 approved behavior and §7 honesty.  
3. Not broaden CriticalResultEvent or Critical Results queue semantics.  
4. Not claim Manual UAT complete.

---

## 11. Manual UAT gate (after implementation)

After L-CRT-UX-01 engineering + proportional verification:

1. Navigate **Results & Authorization → Authorized Results**.  
2. Select known ClinicallyAuthorized UAT Result.  
3. Confirm Manual Results Detail opens with correct OT / Specimen / branch.  
4. Confirm **Mark as Critical** appears (permission-aware).  
5. Continue L-CRT-01 Manual UAT (classify / queue / ack / Draft rejection / etc.) as a **separate** Manual UAT task.  

Do not treat this decision closure as Manual UAT execution.

---

## 12. Files created by this task

| File | Role |
|---|---|
| `docs/laboratory-management/enterprise-lms-critical-result-authorized-results-ux-decision-closure.md` | This decision closure |

**No application code, schema, API, permission, or role files were modified.**

---

## FINAL STATUS

**PRODUCT_DECISIONS_CLOSED_L_CRT_UX_01_AUTHORIZED**

**IMPLEMENTATION_NOT_STARTED**

**Authorized next engineering step:** separate L-CRT-UX-01 FE implementation of Authorized Results discovery (reuse Testing Work Queue + Manual Results + CriticalResultPanel).

**STOP.** Do not implement in this task.
