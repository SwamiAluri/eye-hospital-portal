# Finalize Surgery + OT Preparation
# Package LA — Finalize Modal Lifecycle Remediation
# Engineering Implementation Report

| Field | Value |
|-------|--------|
| **Document type** | **ENGINEERING IMPLEMENTATION REPORT** |
| **Date** | 2026-09-24 |
| **Package** | Package LA — Finalize Modal Lifecycle Remediation |
| **Status** | **IMPLEMENTATION COMPLETE — AUTOMATED TESTS RUN — STOPPED BEFORE MANUAL UAT** |
| **C-LA-04** | **DEFERRED** — Cancel Surgery presentation intentionally preserved |
| **Manual UAT** | **REQUIRED — NOT EXECUTED** |
| **Acceptance** | **NOT RECORDED** |

---

## 1. Implementation status

**COMPLETE** for authorized Package LA scope with C-LA-04 deferred (Cancel Surgery retained).

## 2. Governing Product Decision

`docs/product-decisions/finalize-surgery-ot-preparation-finalize-modal-lifecycle-product-decision.md`

**Status:** DECIDED — 6 DECIDED / 0 PENDING (all Option A)

## 3. Governing Implementation Authorization

`docs/product-decisions/finalize-surgery-ot-preparation-finalize-modal-lifecycle-implementation-authorization.md`

**Status used:** IMPLEMENTATION AUTHORIZED — FINALIZE MODAL LIFECYCLE REMEDIATION ONLY  
**C-LA-04:** DEFERRED (ii) — recorded in IA acknowledgement table 2026-09-24

## 4. C-LA-04 = DEFERRED

C-LA-04 was deferred; cancellation presentation and behavior were intentionally preserved.

- `Cancel Surgery` remains on NotConfirmed / Confirmed / Finalised modal footers
- Cancel confirmation dialog, reason requirement, `cancelOtSchedule`, persistence, and eligibility unchanged
- No new cancellation entry point added
- Cancellation e2e Journey B retained (skips only when no cancelable row is available in the environment — not because the CTA was removed)

## 5. Files changed (this Package LA task)

| Path | Change |
|------|--------|
| `apps/hospital-portal-web/src/lib/counsellors-desk/counselling-time.ts` | Added `normalizeOtReportingTimeToHhMm` |
| `apps/hospital-portal-web/src/lib/counsellors-desk/counselling-time.test.ts` | LA-01 unit coverage |
| `apps/hospital-portal-web/src/lib/api/counsellors-desk.api.ts` | `mapOtRecord.reportingTime` → machine `HH:mm` |
| `apps/hospital-portal-web/src/lib/api/counsellors-desk.map-ot-record.la.test.ts` | **NEW** — mapOtRecord LA-01 contracts |
| `apps/hospital-portal-web/src/components/counsellors-desk/finalize-ot-modal-presentation.ts` | `resolveFinalizeOtModalFooterActions` |
| `apps/hospital-portal-web/src/components/counsellors-desk/finalize-ot-modal-presentation.test.ts` | Footer matrix + queue Finalise protection |
| `apps/hospital-portal-web/src/components/counsellors-desk/FinalizeOtModal.tsx` | Footer consumes resolver; modal Finalise removed |
| `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/finalize-surgery/page.tsx` | 12h display via `formatCounsellingTimeDisplay` (row + print) |
| `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/finalize-surgery/finalize-package1.test.tsx` | LA contracts (display, no modal Finalise, Cancel retained) |
| `apps/hospital-portal-web/e2e/finalize-surgery-package1.spec.ts` | Package LA Confirmed queue/modal Finalise visibility journey |
| `docs/product-decisions/finalize-surgery-ot-preparation-finalize-modal-lifecycle-implementation-authorization.md` | C-LA-04 → DEFERRED (ii) acknowledgement |
| `docs/product-decisions/finalize-surgery-ot-preparation-finalize-modal-lifecycle-implementation-report.md` | **THIS REPORT** |

Pre-existing uncommitted changes in the working tree (other packages) were **not** reverted.

---

## 6. LA-01 — Reporting Time implementation

**Defect fixed:** UAT-FS-RT-01

| Layer | Behavior |
|-------|----------|
| Normalization | `normalizeOtReportingTimeToHhMm` — TimeSpan `HH:mm:ss` / ISO → `HH:mm`; rejects 12h display strings |
| List record | `mapOtRecord` stores machine `HH:mm` on `reportingTime` |
| Queue Confirm | `isReportingTimeValid(rec.reportingTime)` now receives `HH:mm` |
| Display | Row meta + OT slip use `formatCounsellingTimeDisplay` → e.g. `05:00 PM` |
| Modal | Unchanged — detail path already `HH:mm`; `CounsellingTimePicker` unchanged |
| Backend | Unchanged — ReportingTime Confirm prerequisite preserved |
| `startTime` | Still `fmtOtTime` 12h (explicitly out of LA-01 scope) |

---

## 7. LA-02 — State matrix implementation

`resolveFinalizeOtModalFooterActions(status)` drives the modal footer (Close always separate):

| Status | Right-side actions (implemented) |
|--------|----------------------------------|
| NotConfirmed | Save · Confirm · Cancel Surgery |
| Confirmed | Save (will revert) · Cancel Surgery (**no Finalise**) |
| Finalised | Save (will revert) · Cancel Surgery |
| OTPrepared | Reopen Case |
| SurgeryDone | (none) |
| Cancelled | Reopen Case |

Cancel Surgery on editable states retained due to **C-LA-04 deferred**.

---

## 8. LA-03 — Save behavior

- Confirmed / Finalised: `Save (will revert)` retained
- Dirty amber banner retained (“Editing a {status} record will revert it to Not Confirmed”)
- Backend UpdateDetails → NotConfirmed unchanged (not modified)

---

## 9. LA-04 — Cancellation explicitly preserved / deferred

See §4. No removal. No eligibility / API / FSM change.

---

## 10. LA-05 — OTPrepared protection

Footer: Close · Reopen Case only. No Cancel / Save / Confirm / Finalise. Reopen API/metadata behavior untouched.

---

## 11. LA-06 — Terminal-state presentation

- SurgeryDone: Close only
- Cancelled: Close · Reopen Case; cancellation reason still read-only via `shouldShowCancellationReason`

---

## 12. Finalise queue-level protection

- `resolveFinalizeQueuePrimaryAction('Confirmed')` → `finalise` **unchanged** (covered by existing + new unit tests)
- `handleAction('finalise')` / `finaliseOtSchedule` / FSM **unchanged**
- Modal Confirmed footer no longer calls `runAction('finalise')`

---

## 13. RESP2 regression protection

RESP2 worklist / selection / same-date Prepare / SequenceNo continuation / FinalizeOtModal reuse **unchanged**.

Vitest RESP2 suites passed. Playwright OT discoverability RESP2 journeys passed (8/8).

---

## 14. API / backend changes

**NONE**

## 15. DB / schema changes

**NONE**

## 16. Permission changes

**NONE**

## 17. FSM changes

**NONE**

## 18. Ownership changes

**NONE**

---

## 19. Automated tests and exact results

```text
npx vitest run
  counselling-time.test.ts
  finalize-ot-modal-presentation.test.ts
  finalize-package1.test.tsx
  counsellors-desk.map-ot-record.la.test.ts
  finalize-ot-authorization.test.ts
  ot-preparation-resp2.test.ts
  finalize-ot-prep-resp2.test.tsx
  ot-preparation-surgery-date-catalog.test.ts
  finalize-cancel-toast-slice9.test.tsx

Test Files  9 passed (9)
     Tests  77 passed (77)
```

TypeScript: full-project `tsc --noEmit` fails on **pre-existing** unrelated `WaitingListFilterToolbar.tsx` syntax errors. **No Package LA file errors** matched for FinalizeOtModal / counselling-time / counsellors-desk.api / finalize-surgery page / presentation helper.

---

## 20. Playwright results

```text
npx playwright test e2e/finalize-surgery-package1.spec.ts e2e/finalize-surgery-ot-discoverability.spec.ts --project=chromium

10 passed
3 skipped
```

| Spec | Result |
|------|--------|
| RESP2 OT discoverability (8 tests) | **passed** |
| Package 1 KPI | **passed** |
| Journey A Confirm | **skipped** — no suitable NotConfirmed seed row |
| Journey B Cancel | **skipped** — no cancelable seed row (CTA still present in code) |
| Package LA Confirmed Finalise queue/modal | **skipped** — no Confirmed+Finalise seed row |

Skips are environment/seed, not silent CTA removal.

---

## 21. Limitations / environment

- Playwright required `npx playwright install chromium` in this environment before run
- Mutation journeys depend on seeded Finalize data for Manual UAT
- Unreachable queue `handleAction('cancel')` branch remains (pre-existing; out of scope)

---

## 22. Manual UAT status

**REQUIRED — NOT EXECUTED**

Suggested Manual UAT focus:

1. Queue Confirm with persisted Reporting Time shown as 12h (e.g. `05:00 PM`) succeeds
2. Missing Reporting Time still blocks Confirm
3. Confirmed row: queue **Finalise** works; modal shows Save (will revert) + Cancel Surgery, **no** Finalise
4. Finalised / NotConfirmed Cancel Surgery still works (reason + dialog)
5. OTPrepared: Reopen only
6. SurgeryDone: Close only; Cancelled: Reopen
7. RESP2 Prepare selection unchanged

---

## Governance stop

| Gate | Status |
|------|--------|
| **IMPLEMENTATION** | **COMPLETE** |
| **AUTOMATED TESTS** | **77 Vitest passed; Playwright 10 passed / 3 skipped (seed)** |
| **MANUAL UAT** | **REQUIRED — NOT EXECUTED** |
| **ACCEPTANCE** | **NOT RECORDED** |
| **C-LA-04** | **DEFERRED** |
| **PACKAGE B** | **NOT STARTED** |
| **PACKAGE C** | **NOT STARTED** |

**STOP.** Awaiting Product Owner Manual UAT. Do not record Acceptance. Do not start Package B/C.
