# Finalize Surgery + OT Preparation
# Bounded Implementation Authorization —
# FinalizeOtModal Lifecycle Actions & Reporting Time (PD-FS-LA-01…06)

| Field | Value |
|-------|--------|
| **Document type** | **IMPLEMENTATION AUTHORIZATION — GOVERNANCE ONLY** |
| **Title** | Finalize Surgery + OT Preparation — Finalize Modal Lifecycle Remediation Implementation Authorization |
| **Package name** | **Package LA — Finalize Modal Lifecycle Remediation** |
| **Date** | 2026-09-24 |
| **Status** | **IMPLEMENTATION AUTHORIZED — FINALIZE MODAL LIFECYCLE REMEDIATION ONLY** |
| **Conditional element** | **LA-04 Cancel Surgery removal — gated by Condition C-LA-04 (§6)** |
| **Implementation started by this task** | **NO** |
| **Production code / API / DB / permissions / routes / FSM / ownership / UI / tests modified by this task** | **NO** — this artifact is governance only |

---

## Authorization statement

```text
This authorization permits implementation of the approved PD-FS-LA-01…06
Option A remediation ONLY (6 DECIDED / 0 PENDING).

It does NOT authorize cancellation eligibility changes.
It does NOT authorize backend cancellation status guards.
It does NOT authorize FSM changes, new lifecycle states, or a new cancellation state/workflow.
It does NOT authorize new API / backend / DB / permission / ownership changes.
It does NOT authorize a new modal, route, or entity.
It does NOT authorize RESP2 / OT Preparation redesign.
It does NOT authorize Package B (Print) or Package C (PD-OTPREP-10).

PACKAGE LA IMPLEMENTATION AUTHORIZATION: YES (LA-04 removal conditional — §6)
CANCELLATION ELIGIBILITY CHANGE AUTHORIZATION: NO
BACKEND CANCELLATION RULE AUTHORIZATION: NO
NEW API AUTHORIZATION: NO
BACKEND CHANGE AUTHORIZATION: NO
DB / MIGRATION AUTHORIZATION: NO
PERMISSION CHANGE AUTHORIZATION: NO
FSM CHANGE AUTHORIZATION: NO
OWNERSHIP CHANGE AUTHORIZATION: NO
NEW MODAL / ROUTE / ENTITY AUTHORIZATION: NO
RESP2 CHANGE AUTHORIZATION: NO
PACKAGE B PRINT AUTHORIZATION: NO
PACKAGE C PD-OTPREP-10 AUTHORIZATION: NO
PHASE 3I REOPEN: NO
SLICE 14: DOES NOT EXIST
PHASE 3J: NOT CREATED
C-01 REOPEN: NO
```

---

## 1. Metadata

| Item | Value |
|------|--------|
| Artifact path | `docs/product-decisions/finalize-surgery-ot-preparation-finalize-modal-lifecycle-implementation-authorization.md` |
| Artifact disposition | **NEW** |
| Product Decision | `docs/product-decisions/finalize-surgery-ot-preparation-finalize-modal-lifecycle-product-decision.md` — **DECIDED — 6 DECIDED / 0 PENDING** (all Option A) |
| Trigger audit | `docs/audits/finalize-surgery-ot-preparation-finalize-modal-reporting-time-uat-findings.md` |
| Confirmed defect in scope | **UAT-FS-RT-01** — Reporting Time display/validation synchronization |
| Authorizes | Bounded **frontend** remediation: Reporting Time list normalization + FinalizeOtModal state-aware footer presentation |
| Does not authorize | Backend/API/DB · FSM · cancellation eligibility · permissions · ownership · RESP2 · Package B/C |
| Product Owner | Decision recorded — name not supplied |
| Next gate | Separate **IMPLEMENTATION** task (not started by this governance task) |
| Implementation report (to be created by implementer) | `docs/product-decisions/finalize-surgery-ot-preparation-finalize-modal-lifecycle-implementation-report.md` |

---

## 2. Governance baseline

| Area | Status |
|------|--------|
| PD-FS-LA-01…06 | **DECIDED — Option A (all six)** |
| This IA | **AUTHORIZED — Package LA only** |
| Implementation | **NOT STARTED** |
| RESP2 implementation | **COMPLETE** — Manual UAT required; Acceptance not recorded |
| RESP2 model | **PROTECTED — no changes authorized** |
| Package B / Package C | **NOT STARTED — NOT AUTHORIZED** |

---

## 3. Implementation objective

Correct the confirmed Reporting Time queue-validation defect (UAT-FS-RT-01) and make FinalizeOtModal footer presentation explicitly state-aware, while preserving every certified lifecycle, cancellation, OTPrepared recovery, Finalise, and RESP2 behavior.

---

## 4. Pre-implementation repository findings (FACT — inspected 2026-09-24)

These findings bound the implementation. They were verified by source inspection while preparing this IA.

### 4.1 LA-01 is achievable frontend-only

| Fact | Evidence |
|------|----------|
| Backend list/mutation DTOs return `ReportingTime` as `TimeSpan?` (machine-readable) | `OtFinalizeService.ToResponse` |
| Single list normalization point | `mapOtRecord` in `src/lib/api/counsellors-desk.api.ts` — used by finalize list, OT list, and modal `onStatusChange` (`page.tsx` → `mapOtRecord(updated)`) |
| Defect location | `mapOtRecord` sets `reportingTime: fmtOtTime(r.reportingTime)` → 12h string that `isReportingTimeValid` rejects |
| Queue gate | `page.tsx` `handleAction('confirm')` → `isReportingTimeValid(rec.reportingTime)` |
| Modal detail path | `getOtScheduleDetail` → `toHHMM` → `HH:mm` (already correct) |
| Existing formatter | `formatCounsellingTimeDisplay` (`src/lib/counsellors-desk/counselling-time.ts`) — `HH:mm` → `hh:mm AM/PM` |

**Conclusion:** No API/backend change is required for LA-01. If the implementer finds otherwise, apply §10 STOP rule.

### 4.2 List display consumers of `rec.reportingTime` (must keep 12h display)

| Location | Use |
|----------|-----|
| `finalize-surgery/page.tsx` ~L454 | Row meta `· Report {reportingTime}` |
| `finalize-surgery/page.tsx` ~L458 | Row meta `Report {reportingTime}` |
| `finalize-surgery/page.tsx` ~L957 | Existing single-record print slip `Reporting Time` cell |

Implementer must search again for any additional consumers before changing the mapper.

### 4.3 Cancellation UI entry points (critical for LA-04)

| Entry point | Current behavior |
|-------------|------------------|
| FinalizeOtModal footer `Cancel Surgery` (NotConfirmed / Confirmed / Finalised) | Opens reason dialog → `cancelOtSchedule` — **the only reachable UI cancellation entry point in the Finalize surface** |
| Queue `handleAction('cancel')` | Opens modal + toast “Open the case to cancel with a required reason.” — **not reachable**: `resolveFinalizeQueuePrimaryAction` never returns `cancel` |
| Other UI callers of `cancelOtSchedule` | **None found** in `apps/hospital-portal-web/src` |

**Consequence:** Removing `Cancel Surgery` from the modal footer (PD-FS-LA-04 Option A) leaves **no reachable UI path** to cancel a NotConfirmed / Confirmed / Finalised surgery from the Finalize surface. Backend eligibility and API remain unchanged. See Condition **C-LA-04** (§6).

### 4.4 Modal Finalise removal consequence

After LA-02, a Confirmed record opened in the modal shows `Close · Save (will revert)`. Finalise remains available through the queue primary CTA (`resolveFinalizeQueuePrimaryAction('Confirmed')` → `finalise`). Modal `onStatusChange` already closes the modal after mutations; operators Finalise from the row.

### 4.5 Existing tests coupled to removed footer actions

| Test | Coupling | Required handling |
|------|----------|-------------------|
| `e2e/finalize-surgery-package1.spec.ts` Journey B | Clicks modal `Cancel Surgery`; **self-skips** if CTA absent | Must **not** be left to silently skip — update to assert the approved presentation and record lost UI coverage truthfully (§9) |
| `finalize-package1.test.tsx` | Source contracts: `finalize-cancel-confirm-dialog`, `cancelOtSchedule(... cancelReason)`, `isReportingTimeValid(rec.reportingTime)` | Keep passing; do not weaken |
| `finalize-cancel-toast-slice9.test.tsx` | Source contract: `cancelOtSchedule` with `cancelReason` | Keep passing; do not weaken |

---

## 5. Authorized scope — Package LA

### LA-01 — Reporting Time synchronization (fix UAT-FS-RT-01)

**Authorized:**

- Normalize list-record `reportingTime` in `mapOtRecord` to machine-readable `HH:mm` (from TimeSpan `HH:mm:ss`; ISO datetime → local `HH:mm` as today’s ISO branch implies).
- Render 12-hour display at every display consumer (§4.2) with the existing `formatCounsellingTimeDisplay` — no new formatter library.
- Queue Confirm continues to gate on `isReportingTimeValid(rec.reportingTime)` — now receiving machine-readable data.
- Modal Confirm path unchanged (already validates form `HH:mm`).

**Preferred boundary:** frontend mapper / display / validation path only. A separate `reportingTimeDisplay` field is **not** required and should be avoided unless the implementer documents why display-time formatting is insufficient.

**Must preserve:** Reporting Time is required for Confirm (PD-FS-03). Missing → rejected. Invalid → rejected.

**Must not:** remove the prerequisite · broaden validation · add insurance/payment/clinical/theatre blockers · add an API · change backend contract · change FSM · change `startTime` formatting (out of scope).

### LA-02 — State-aware FinalizeOtModal footer

**Authorized presentation model (exact):**

| Status | Footer actions |
|--------|----------------|
| NotConfirmed | Close · Save · Confirm |
| Confirmed | Close · Save (will revert) |
| Finalised | Close · Save (will revert) |
| OTPrepared | Close · Reopen Case |
| SurgeryDone | Close |
| Cancelled | Close · Reopen Case |

**Recommended implementation shape:** a pure presentation helper in the existing `src/components/counsellors-desk/finalize-ot-modal-presentation.ts` (alongside `shouldShowCancellationReason`) that resolves footer actions by status, consumed by `FinalizeOtModal.tsx`. This makes all six states unit-testable.

**Presentation-only.** No FSM, eligibility, API, modal, route, or entity change. Existing `cannotFinalize` permission-disable behavior must be preserved.

### LA-03 — Save semantics (preserve)

- Keep label `Save (will revert)` for Confirmed and Finalised; `Save` for NotConfirmed.
- Keep the dirty-state amber banner (“Editing a {status} record will revert it to Not Confirmed”).
- Certified behavior unchanged: Confirmed / Finalised → Save → **NotConfirmed** (backend `UpdateDetailsAsync`).
- No copy redesign.

### LA-04 — Cancel Surgery presentation (conditional — see §6)

**Authorized (subject to C-LA-04):** Remove `Cancel Surgery` from the generic FinalizeOtModal footer for all states.

**Must preserve unchanged:**

- `counsellorsDeskApi.cancelOtSchedule` client method and backend `CancelAsync`
- reason requirement (FE + BE)
- confirmation dialog (`finalize-cancel-confirm-dialog`) and its handler code — **retain, do not delete**; gate its trigger through the presentation helper so the certified PD-FS-04 workflow remains intact and re-attachable
- `CancelReason` persistence and existing back-sync
- backend `CanCancel` / eligibility

**Must not:** add status guards · restrict cancellation to OTPrepared · add a cancellation state · change backend eligibility · change FSM · invent a new cancellation entry point or workflow · modify the unreachable queue `handleAction('cancel')` branch (record it as a known limitation instead).

### LA-05 — OTPrepared protection

- Footer remains `Close · Reopen Case`. No `Cancel Surgery`.
- Reopen → Confirmed; retains `SequenceNo`, `PreparedAt`, `PreparedBy` (PD-FS-06). No change.
- Form remains locked (`LOCKED_STATUSES`).

### LA-06 — Terminal states

- SurgeryDone: `Close` only; form locked/view-oriented.
- Cancelled: `Close · Reopen Case`; cancellation reason read-only (`shouldShowCancellationReason`).
- No recovery-eligibility change; no new Cancelled workflow.

### Critical Finalise protection

| Rule | Requirement |
|------|-------------|
| Modal Confirmed footer | Finalise **removed** (LA-02 presentation only) |
| `resolveFinalizeQueuePrimaryAction('Confirmed')` | Must remain `{ label: 'Finalise', action: 'finalise' }` — **unchanged** |
| `page.tsx` `handleAction('finalise')` | **Unchanged** |
| `counsellorsDeskApi.finaliseOtSchedule` / backend `FinaliseAsync` | **Unchanged** |
| FSM Confirmed → Finalised | **Unchanged** |
| Replacement Finalise workflow | **Forbidden** |

---

## 6. Condition C-LA-04 — Product Owner acknowledgement required before removing Cancel Surgery

**Reason:** §4.3 shows the modal footer is the only reachable UI cancellation entry point. The Product Decision text for PD-FS-LA-04 Option A anticipated exposure “only through an explicit state-appropriate action if/where the existing product model requires it”; repository inspection found **no** such existing entry point. Removing the button therefore makes UI cancellation unavailable from the Finalize surface for NotConfirmed / Confirmed / Finalised (API and eligibility unchanged). This is an operational consequence the Product Owner must acknowledge explicitly; it must not be introduced silently.

| Resolution | Effect on implementation |
|------------|--------------------------|
| **C-LA-04 (i) — Acknowledge** | Owner accepts that UI cancellation is unavailable from the Finalize surface until a separate Product Decision defines a state-appropriate entry point. Implementer removes `Cancel Surgery` from the footer per LA-04. |
| **C-LA-04 (ii) — Defer removal** | `Cancel Surgery` stays in the footer for NotConfirmed / Confirmed / Finalised until a separate Product Decision defines a state-appropriate entry point. All other Package LA scope proceeds. LA-04 reported **DEFERRED**. |

**Acknowledgement record:**

| Field | Value |
|-------|--------|
| C-LA-04 resolution | **DEFERRED (ii)** — Product Owner deferred Cancel Surgery removal for this Package LA implementation; footer Cancel Surgery retained so cancellation remains reachable from Finalize surface |
| Recorded by | Product Owner directive in Package LA implementation task |
| Date | 2026-09-24 |

**Implementer rule:** If C-LA-04 is still PENDING when implementation starts, implement all other Package LA scope, **leave `Cancel Surgery` in place**, and report LA-04 as **BLOCKED — C-LA-04 PENDING** with overall status **PARTIAL**. Do not decide C-LA-04 yourself.

---

## 7. Certified rules that must remain

| Rule | Source |
|------|--------|
| Reporting Time is Confirm prerequisite | PD-FS-03 |
| Cancel reason + confirmation + persistence + back-sync | PD-FS-04 |
| OTPrepared: no Cancel CTA; Reopen recovery | PD-FS-05 / PD-FS-LA-05 |
| Reopen retains SequenceNo / PreparedAt / PreparedBy | PD-FS-06 |
| Confirmed/Finalised edit/save → NotConfirmed | PD-FS-07 / RESP2-08 / PD-FS-LA-03 |
| RESP2 Finalised worklist / selected Prepare / same-date / SequenceNo continuation | RESP2 |

### RESP2 protection

```text
OT Preparation
  = Finalised worklist
  = explicit selection
  = same ScheduleDate batch constraint
  = selected-only Prepare
  = continued SequenceNo
  = Finalization OT Prepared remains authoritative prepared worklist
```

No RESP2 changes are authorized. The RESP2 OT Prep Finalised row continues to open the existing FinalizeOtModal; the footer change it inherits (Finalised: `Close · Save (will revert)`) is the approved LA presentation, not a RESP2 change.

---

## 8. Out of scope (absolute)

Cancellation eligibility changes · backend cancellation status guards · FSM changes · new lifecycle states · new cancellation state · new cancellation workflow or entry point · new modal · new route · new entity · DB changes · migrations · permissions · ownership · CounselorId · Assign/Reassign/Requeue · My Work · RESP2 redesign · OT Preparation redesign · Package B Print · Package C / PD-OTPREP-10 · Phase 3I · Slice 14 · Phase 3J · C-01 · `startTime` formatting · unrelated Finalization changes · unrelated Counsellor changes.

---

## 9. Expected files (indicative — implementer must verify)

| Path | Expected change |
|------|-----------------|
| `apps/hospital-portal-web/src/lib/api/counsellors-desk.api.ts` | `mapOtRecord` reportingTime → machine `HH:mm` |
| `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/finalize-surgery/page.tsx` | Display consumers format via `formatCounsellingTimeDisplay` (no Confirm logic change) |
| `apps/hospital-portal-web/src/components/counsellors-desk/finalize-ot-modal-presentation.ts` | Footer action resolver (+ cancel-trigger predicate) |
| `apps/hospital-portal-web/src/components/counsellors-desk/FinalizeOtModal.tsx` | Footer consumes resolver |
| Colocated `*.test.ts(x)` | New/updated unit + source-contract tests |
| `apps/hospital-portal-web/e2e/finalize-surgery-package1.spec.ts` | Journey B updated (no silent skip) |
| `apps/hospital-portal-web/e2e/*` (new or existing finalize spec) | State-specific footer visibility |
| `docs/product-decisions/finalize-surgery-ot-preparation-finalize-modal-lifecycle-implementation-report.md` | **NEW** report |

Any file outside this list requires justification in the report. Any backend/microservice file change = unauthorized.

---

## 10. API / backend boundary

No API/backend change is authorized. §4.1 indicates none is needed.

If during implementation an API/backend change appears necessary:

```text
STOP.
Do not implement it.
Report: IMPLEMENTATION BLOCKED — CURRENT AUTHORIZATION DOES NOT AUTHORIZE
THE REQUIRED API/BACKEND CHANGE.
```

---

## 11. UI / design system

Use existing Hospital Portal counselling primitives (`CounsellingButton`, existing dialog, existing tokens). No new component library, theme, modal, or visual language. Keep the modal compact, task-focused, accessible (keyboard, focus, labelled buttons), and responsive (footer wraps at narrow widths as today). No additional explanatory copy.

---

## 12. Test requirements

Tests must be added/updated; none may be weakened, deleted to pass, or converted to silent skips.

### LA-01 — Reporting Time

1. Persisted valid Reporting Time (TimeSpan `HH:mm:ss`) mapped by `mapOtRecord` passes `isReportingTimeValid` → queue Confirm proceeds
2. 12-hour display remains correct at row meta and print slip
3. Machine-readable `HH:mm` remains available on the list record for validation
4. Missing Reporting Time rejected (queue gate + backend)
5. Invalid Reporting Time rejected
6. Modal Confirm behavior unchanged (validate → save details → Confirm)

### LA-02 — Footer visibility (every state)

| Status | Expected |
|--------|----------|
| NotConfirmed | Close / Save / Confirm |
| Confirmed | Close / Save (will revert) |
| Finalised | Close / Save (will revert) |
| OTPrepared | Close / Reopen Case |
| SurgeryDone | Close |
| Cancelled | Close / Reopen Case |

### LA-03 — Save

7. `Save (will revert)` for Confirmed
8. `Save (will revert)` for Finalised
9. Dirty-state banner remains
10. Save still results in NotConfirmed (existing backend behavior; assert via existing tests / contract)

### LA-04 — Cancellation (per C-LA-04 resolution)

11. `Cancel Surgery` absent from generic footer (if C-LA-04 (i)); present as today (if (ii) or PENDING)
12. Cancellation path intact: `cancelOtSchedule` client + dialog + handler retained; backend Cancel tests pass
13. Cancellation reason still required (FE contract + BE `ArgumentException`)
14. Confirmation dialog retained (`finalize-cancel-confirm-dialog`)
15. `CancelReason` persistence unchanged (backend tests)
16. Cancellation eligibility unchanged (`CanCancel` / `CancelAsync` untouched; diff shows no backend change)

**Truthfulness rule:** If Cancel Surgery is removed, report that end-to-end UI coverage of the cancel dialog (Journey B) is no longer reachable from the Finalize surface, rather than letting it self-skip.

### LA-05 — OTPrepared

17. No Cancel CTA
18. Reopen Case present
19. Reopen metadata preservation intact (existing backend tests)

### LA-06 — Terminal states

20. SurgeryDone Close-only
21. Cancelled Close + Reopen Case
22. Cancelled reason read-only

### Finalise protection

23. `resolveFinalizeQueuePrimaryAction('Confirmed', true).action === 'finalise'` (existing test retained)
24. Finalise FSM transition unchanged (backend untouched)
25. Modal Finalise removal does not affect queue Finalise

### RESP2 regression

26. Existing RESP2 tests pass (`ot-preparation-resp2.test.ts`, `finalize-ot-prep-resp2.test.tsx`, catalog tests)
27. No OT Preparation regression (existing Playwright OT Prep journeys)

---

## 13. Automated validation

Run and report actual results:

- Vitest: affected unit + source-contract tests, plus counsellors-desk regression (`src/lib/counsellors-desk/**`, `src/app/dashboard/counsellors-desk/finalize-surgery/**`, `src/components/counsellors-desk/**`)
- Existing backend tests only if needed to confirm untouched behavior (`FinalizePackage1ConfirmCancelTests`) — no backend edits
- Playwright (`apps/hospital-portal-web/e2e/`): state-specific modal footer visibility; Finalize / OT Prep journeys
- TypeScript + ESLint on touched files

**Safety:** Do not perform destructive Cancel or Prepare against unsafe live data. Use seed/UAT data; skip with an explicit reason rather than mutating unsafe records.

---

## 14. Diff safety

Before completion, inspect `git diff` and confirm **no** changes to: backend / microservices · APIs · DB / migrations · permissions · FSM · ownership · routes · RESP2 logic · Package B/C. If any exist: **STOP and revert them**, and record in the report.

**Baseline requirement (FACT, 2026-09-24):** The working tree already contains extensive uncommitted changes from prior packages, including `FinalizeOtModal.tsx`, `finalize-surgery/page.tsx`, backend services, tests, and migrations. Before editing, the implementer must capture a baseline (e.g. `git diff > <baseline>.patch` or a stash/commit checkpoint per team practice) so the diff-safety review attributes only Package LA changes. Do not revert pre-existing changes that belong to other packages.

---

## 15. Implementation report requirements

Create `docs/product-decisions/finalize-surgery-ot-preparation-finalize-modal-lifecycle-implementation-report.md` covering:

1. IA reference · 2. Product Decision reference · 3. LA-01 implementation · 4. LA-02 implementation · 5. LA-03 preservation · 6. LA-04 implementation (with C-LA-04 resolution used) · 7. LA-05 protection · 8. LA-06 protection · 9. Finalise queue protection · 10. RESP2 regression protection · 11. Files changed · 12. API/backend verification · 13. DB verification · 14. FSM verification · 15. Cancellation eligibility verification · 16. Automated tests · 17. Playwright tests · 18. Accessibility/responsive checks · 19. Git diff safety review · 20. Known limitations (including unreachable queue cancel branch and cancel UI coverage) · 21. Manual UAT status · 22. Acceptance status

Truthful results only.

---

## 16. Mandatory governance stop (for the implementation task)

After implementation and automated tests: **STOP.**

Do not perform Manual UAT · claim UAT PASS · record Acceptance · start Package B · start Package C · reopen RESP2 · start another Product Decision.

Implementation final report must state:

```text
IMPLEMENTATION: COMPLETE / BLOCKED / PARTIAL — truthful status
AUTOMATED TESTS: actual result
MANUAL UAT: REQUIRED — NOT EXECUTED
ACCEPTANCE: NOT RECORDED
PACKAGE B: NOT STARTED
PACKAGE C: NOT STARTED
```

---

## Governance status (this task)

| Gate | Status |
|------|--------|
| **PRODUCT DECISION** | **DECIDED — 6 DECIDED / 0 PENDING** |
| **IMPLEMENTATION AUTHORIZATION** | **IMPLEMENTATION AUTHORIZED — FINALIZE MODAL LIFECYCLE REMEDIATION ONLY** |
| **C-LA-04 (Cancel Surgery removal)** | **DEFERRED (ii)** — Cancel Surgery retained in Package LA |
| **IMPLEMENTATION** | **NOT STARTED** |
| **AUTOMATED TESTS** | **NOT RUN FOR THIS GOVERNANCE TASK** |
| **MANUAL UAT** | **IN PROGRESS / FINDINGS RECORDED** (Package LA: REQUIRED after implementation) |
| **ACCEPTANCE** | **NOT RECORDED** |
| **PACKAGE B** | **NOT STARTED** |
| **PACKAGE C** | **NOT STARTED** |

---

**STOP.** Implementation Authorization recorded. No production code, tests, APIs, backend, DB, permissions, FSM, ownership, routes, or RESP2 were modified by this task.
