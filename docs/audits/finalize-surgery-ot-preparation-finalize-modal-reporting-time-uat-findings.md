# Finalize Surgery + OT Preparation
# FinalizeOtModal Lifecycle Actions & Reporting Time
# UAT Findings Audit

| Field | Value |
|-------|--------|
| **Document type** | **AUDIT / UAT FINDINGS ONLY — NO IMPLEMENTATION** |
| **Date** | 2026-09-23 |
| **Finding family** | FinalizeOtModal lifecycle action presentation · Reporting Time Confirm synchronization |
| **Production / API / DB / permissions / routes / FSM / ownership / tests modified** | **NO** |
| **Implementation Authorization created** | **NO** |
| **Acceptance** | **NOT RECORDED** |

---

## Distinction legend

| Label | Meaning |
|-------|---------|
| **FACT** | Verified from repository source inspection |
| **OBSERVATION** | UAT / screenshot-reported behavior (reconciled against FACT) |
| **DEFECT** | Confirmed mismatch between intended certified rule and current implementation |
| **PRODUCT DECISION REQUIRED** | Needs explicit Product Owner selection before Implementation Authorization |
| **PROPOSED — NOT APPROVED** | Candidate UX model recorded for decision; not authorized |

---

## 1. Governance baseline

| Area | Status |
|------|--------|
| RESP2 Product Decision (PD-OTPREP-RESP2-01…10) | **RECORDED — 10 DECIDED** |
| RESP2 Implementation Authorization | **RECORDED** |
| RESP2 Implementation | **COMPLETE** |
| RESP2 Automated tests | **PASSED** (per implementation report) |
| RESP2 Manual UAT | **REQUIRED — NOT COMPLETED** |
| RESP2 Acceptance | **NOT RECORDED** |
| Package 1 (PD-FS-01…07 runtime alignment) | **IMPLEMENTED** (historical) |
| PD-FS-03 Reporting Time prerequisite | **CERTIFIED — PRESERVE** |
| PD-FS-05 OTPrepared no Cancel in UI / Reopen recovery | **CERTIFIED — PRESERVE** |
| PD-FS-06 Reopen metadata retention | **CERTIFIED — PRESERVE** |
| PD-FS-07 Finalised/Confirmed edit → NotConfirmed | **CERTIFIED — PRESERVE** |
| RESP2 OT Preparation worklist model | **DIRECTIONALLY ACCEPTABLE — DO NOT REDESIGN** |
| This audit | **COMPLETE** |
| Product Decision (PD-FS-LA-*) | **SEPARATE ARTIFACT — PENDING OWNER** |
| Implementation Authorization for this scope | **NONE** |
| Package B / Package C | **NOT STARTED** |
| Phase 3I / Slice 14 / Phase 3J / C-01 | **CLOSED / DOES NOT EXIST / NOT CREATED / CLOSED** |

### RESP2 model preserved (do not reopen)

```text
OT PREPARATION
  = Finalised worklist
  = explicit selection
  = same ScheduleDate batch constraint
  = selected-only Prepare
  = continued SequenceNo
  = Finalization OT Prepared remains authoritative prepared worklist
```

---

## 2. UAT evidence

| Item | Value |
|------|--------|
| Trigger | Manual UAT of Finalize / OT Preparation after RESP2 |
| Evidence type | Screenshots + operator description (not substitute for source inspection) |
| Inspection method | Repository source of FinalizeOtModal, page Confirm handler, API mappers, OtFinalizeService |
| Screenshots | Treated as **OBSERVATION**; classified only after code reconciliation |

### Authoritative context sources read

1. `docs/product-decisions/finalize-surgery-ot-preparation-product-decision.md`
2. `docs/product-decisions/finalize-surgery-ot-preparation-implementation-authorization.md`
3. `docs/product-decisions/finalize-surgery-ot-preparation-revised-responsibility-product-decision.md`
4. `docs/product-decisions/finalize-surgery-ot-preparation-revised-responsibility-implementation-authorization.md`
5. `docs/product-decisions/finalize-surgery-ot-preparation-revised-responsibility-implementation-report.md`
6. `docs/audits/finalize-surgery-ot-preparation-operational-model-audit.md`
7. `docs/audits/finalize-surgery-ot-preparation-uat-findings-operational-ux-reconciliation-audit.md`

### Implementation inspected

| Area | Path / symbol |
|------|----------------|
| Modal | `FinalizeOtModal.tsx` |
| Queue Confirm | `finalize-surgery/page.tsx` → `handleAction('confirm')` |
| Time display / picker | `CounsellingTimePicker`, `counselling-time.ts` |
| List mapper | `mapOtRecord` / `fmtOtTime` in `counsellors-desk.api.ts` |
| Detail mapper | `getOtScheduleDetail` / `toHHMM` |
| Save payload | `ot-details-save-payload.ts` → `toTimeSpan` |
| Validation helpers | `isReportingTimeValid` in `finalize-surgery-package1.ts` |
| Backend Confirm / Cancel / UpdateDetails / Reopen | `OtFinalizeService.cs` |
| Queue primary CTA | `resolveFinalizeQueuePrimaryAction` |
| Cancel reason presentation | `shouldShowCancellationReason` |

---

## 3. Screenshot observations

### UAT Observation 1 — Reporting Time

**OBSERVATION:** FinalizeOtModal visibly shows:

```text
Reporting Time *
05:00 PM
```

Attempting Confirm produces toast:

```text
Reporting time is required to confirm. Open the case to set it.
```

This appears internally inconsistent (value displayed, Confirm rejected as missing).

### UAT Observation 2 — FinalizeOtModal actions (Finalised)

**OBSERVATION:** From a Finalised surgery opened through OT Preparation / Finalization, actions resembling:

- Close
- Save
- Confirm
- Cancel Surgery

**Concern:** Action set may not accurately communicate lifecycle state; modal may look like a generic “all lifecycle actions” dialog.

---

## 4. Reporting Time technical audit

### 4.1 Display value (modal)

| Question | Answer | Classification |
|----------|--------|----------------|
| What does Reporting Time control display? | `CounsellingTimePicker` renders `formatCounsellingTimeDisplay(value)` → 12-hour string e.g. `05:00 PM` | **FACT** |
| What is stored in modal form state? | 24-hour `HH:mm` from `getOtScheduleDetail` → `toHHMM` (e.g. `17:00`) | **FACT** |
| Display vs state | Display is derived 12h; form state remains `HH:mm` | **FACT** |

### 4.2 Modal Confirm path

| Step | Behavior | Classification |
|------|----------|----------------|
| Validate | `validate()` checks `form.reportingTime` with `isReportingTimeValid` (expects `HH:mm` / `HH:mm:ss`) | **FACT** |
| Persist before confirm | `updateOtDetails` with `buildOtDetailsSavePayload` → `reportingTime: toTimeSpan(form.reportingTime)` (`HH:mm:00`) | **FACT** |
| Confirm API | `confirmOtSchedule(scheduleId)` | **FACT** |
| Backend | `ConfirmAsync` requires `entity.ReportingTime.HasValue`; else `ArgumentException("Reporting time is required to confirm.")` | **FACT** |
| Modal toast on FE fail | Sets field error (`Reporting time is required to confirm` / `Enter a valid reporting time (HH:MM)`); **does not** emit the “Open the case…” toast | **FACT** |

### 4.3 Queue / worklist Confirm path

| Step | Behavior | Classification |
|------|----------|----------------|
| Primary CTA for NotConfirmed | `resolveFinalizeQueuePrimaryAction` → action `confirm` | **FACT** |
| Validation | `isReportingTimeValid(rec.reportingTime)` on **list-mapped** record | **FACT** |
| On failure | Toast: `Reporting time is required to confirm. Open the case to set it.` **and** opens FinalizeOtModal | **FACT** |
| Exact toast source | **Only** `finalize-surgery/page.tsx` `handleAction('confirm')` — not modal Confirm | **FACT** |

### 4.4 List record formatting mismatch (root cause)

| Layer | `reportingTime` representation | Classification |
|-------|--------------------------------|----------------|
| Backend list DTO | `TimeSpan?` (serialized typically as `HH:mm:ss`) | **FACT** |
| `mapOtRecord` | `reportingTime: fmtOtTime(r.reportingTime)` → **12-hour display** e.g. `05:00 PM` | **FACT** |
| `isReportingTimeValid` | Regex `^(\d{1,2}):(\d{2})(?::(\d{2}))?$` — **rejects** `05:00 PM` | **FACT** |
| Consequence | Persisted Reporting Time that maps to a valid TimeSpan can still fail queue Confirm FE gate | **FACT** / **DEFECT** |

`fmtOtTime` (list mapper):

- ISO datetime → `toLocaleTimeString('en-IN', { hour12: true })`
- `HH:mm(:ss)` TimeSpan string → zero-padded 12h + AM/PM

Detail path intentionally keeps `HH:mm` for the picker; list path reformats for human display **into the same field used for validation**.

### 4.5 Answers to the ten audit questions

| # | Question | Finding |
|---|----------|---------|
| 1 | Displayed value | 12h display (`05:00 PM`) via picker formatter or list `fmtOtTime` |
| 2 | Modal form state | `HH:mm` when loaded via detail API |
| 3 | Value passed to Confirm (modal) | Form `HH:mm` → TimeSpan payload then Confirm API |
| 4 | Value validated before Confirm (queue) | **List** `rec.reportingTime` **after** `fmtOtTime` |
| 5 | Value sent to backend (modal Confirm) | TimeSpan string from `toTimeSpan` on form `HH:mm` |
| 6 | Persisted / retrieved | DB `reporting_time` TimeSpan; detail `toHHMM`; list `fmtOtTime` |
| 7 | Date/time normalization mismatch? | **Yes** — list display format vs `isReportingTimeValid` contract |
| 8 | Unsaved display vs other validation source? | **Yes for queue path** — validates list display string, not modal form / not raw TimeSpan |
| 9 | Stale/derived model? | **Derived list field** overwrites machine-readable time with display string |
| 10 | Frontend / backend / sync? | **Frontend list-mapper + queue validation defect**; backend Confirm prerequisite itself is consistent with PD-FS-03 when entity has ReportingTime |

### 4.6 Classification — UAT-FS-RT-01

| ID | Title | Classification |
|----|-------|----------------|
| **UAT-FS-RT-01** | Reporting Time display/validation synchronization | **DEFECT** (implementation) |

**Not:** product-decision change to remove Reporting Time prerequisite.  
**Not:** no-defect (repository evidence confirms the inconsistency).  
**Not:** backend-only (BE checks `HasValue` correctly once persisted).

**Certified rule preserved:** Reporting Time remains required for Confirm (PD-FS-03).  
**Objective:** Valid Reporting Time → Confirm allowed; missing/invalid → rejected. Current queue FE gate falsely treats valid 12h-formatted list values as invalid/missing.

### 4.7 Likely UAT reproduction path (reconciled)

**FACT:** The exact toast text including “Open the case to set it.” is emitted only by queue Confirm failure, which also opens the modal.

**OBSERVATION reconciled:** Operator sees modal with Reporting Time `05:00 PM` (picker display of a valid `HH:mm` after detail load, and/or list-derived display) simultaneously with the queue-failure toast — appearing as “Confirm inside modal rejected a visible time,” while the failing Confirm was the **queue** action that opened the case.

Modal Confirm with a valid form `HH:mm` would not produce that toast string.

---

## 5. Reporting Time expected behavior

| Condition | Expected |
|-----------|----------|
| Valid Reporting Time persisted / present in Confirm path | Confirm prerequisite **satisfied** |
| Missing / invalid Reporting Time | Confirm **rejected** with appropriate validation |
| Display format | May be 12h for humans; validation must use a machine-readable representation of the **same** value |
| New blockers | **Forbidden** in this scope: insurance, payment, clinical, theatre, new FSM, unrelated validation |

---

## 6. FinalizeOtModal state/action audit

**FACT:** Footer actions are status-switched in `FinalizeOtModal.tsx`. Close is always present when loaded. `cannotFinalize` disables mutation buttons but does not change which buttons render.

| Status | Actions rendered (code) | What each does |
|--------|-------------------------|----------------|
| **A. NotConfirmed** | Close · Save · Confirm · **Cancel Surgery** | Save → `updateOtDetails`; Confirm → validate + updateOtDetails + `confirmOtSchedule`; Cancel → reason dialog → `cancelOtSchedule` |
| **B. Confirmed** | Close · **Save (will revert)** · Finalise · **Cancel Surgery** | Save → UpdateDetails → status **NotConfirmed**; Finalise → `finaliseOtSchedule`; Cancel → reason dialog |
| **C. Finalised** | Close · **Save (will revert)** · **Cancel Surgery** | Save → UpdateDetails → status **NotConfirmed**; Cancel → reason dialog. **No Confirm. No Finalise.** |
| **D. OTPrepared** | Close · **Reopen Case** | Reopen → `reopenOtCase` (OTPrepared → Confirmed). **No Cancel Surgery. No Save. Form locked.** |
| **E. SurgeryDone** | Close only | Locked / view-oriented; no Save / Confirm / Finalise / Cancel / Reopen in footer |
| **F. Cancelled** | Close · **Reopen Case** | Reopen → Cancelled → NotConfirmed; cancellation reason shown read-only when status Cancelled |

### Observation 2 reconciliation

| Claim | Status |
|-------|--------|
| Finalised shows Close + Save + Confirm + Cancel Surgery | **Not matching current code** for status `Finalised` |
| Finalised shows Close + Save (will revert) + Cancel Surgery | **FACT** |
| NotConfirmed shows Close + Save + Confirm + Cancel Surgery | **FACT** (matches observed button set if status was NotConfirmed / misread) |
| Confirmed shows Finalise (not Confirm) | **FACT** |

**Classification of Observation 2:** **OBSERVATION** requiring Product Decision on state-aware action presentation; partial **UX clarity** issue. Not reclassified as “Confirm wrongly available on Finalised” without evidence of wrong status branch — code does not render Confirm for Finalised.

---

## 7. Save semantics audit

| Item | Finding | Classification |
|------|---------|----------------|
| Backend UpdateDetails | Confirmed or Finalised → status set to **NotConfirmed**, unlock | **FACT** (PD-FS-07 / RESP2-08) |
| Modal Save label NotConfirmed | `Save` | **FACT** |
| Modal Save label Confirmed / Finalised | `Save (will revert)` | **FACT** |
| Amber banner when dirty on Confirmed/Finalised | “Editing a {status} record will revert it to Not Confirmed” | **FACT** |
| Certified rule | Edit/Save Finalised or Confirmed → NotConfirmed for revalidation | **PRESERVE** |
| Proposed silent change to “Save remain Finalised” | **Forbidden** without new FSM Product Decision | **PRODUCT DECISION REQUIRED** only if Owner wants to reopen |

**UAT concern:** Whether label `Save` / `Save (will revert)` is sufficiently truthful for Finalised operators. Repository already uses “Save (will revert)” for Confirmed/Finalised — Observation wording “Save” may be abbreviation.

---

## 8. Cancellation audit

### Separate questions (not collapsed)

| Q | Question | Answer |
|---|----------|--------|
| **1** | Is cancellation legally/business-operationally allowed from a lifecycle state? | Backend `CancelAsync` has **no status guard** beyond reason required; `CanCancel` true when status ∉ {Cancelled, SurgeryDone} — includes NotConfirmed, Confirmed, Finalised, **OTPrepared** | **FACT** |
| **2** | Should Cancel Surgery appear in generic FinalizeOtModal action bar? | **PRODUCT DECISION REQUIRED** (PD-FS-LA-04); current UI shows Cancel on NotConfirmed / Confirmed / Finalised only |

### Detail answers

| # | Question | Finding |
|---|----------|---------|
| 1 | States technically allowed (service) | Any non-terminal except that Cancelled/SurgeryDone are excluded by capability flags; service itself does not reject OTPrepared/Finalised by status | **FACT** |
| 2 | UI exposes Cancel Surgery | NotConfirmed, Confirmed, Finalised only | **FACT** |
| 3 | API path | `counsellorsDeskApi.cancelOtSchedule` → Cancel endpoint → `CancelAsync` | **FACT** |
| 4 | Reason required? | Yes — dialog + FE `isCancelReasonPresent`; BE `ArgumentException` if blank (PD-FS-04) | **FACT** |
| 5 | Persisted? | Yes — `CancelReason` column | **FACT** |
| 6 | Back-sync | Best-effort counselling call; cancel still succeeds (PD-FS-04 Option D) | **FACT** |
| 7 | OTPrepared protected model? | UI: no Cancel, Reopen recovery (PD-FS-05). API: still callable | **FACT** |
| 8 | Finalised certified cancel presentation? | Modal currently **does** show Cancel Surgery on Finalised; eligibility not restricted by PD-FS-04 | **FACT** |
| 9 | Removing button from modal | Changes **presentation** only unless Option C changes eligibility | **FACT** |

**Do not** silently decide cancellation is restricted to OTPrepared — that would be Option C / FSM change.

---

## 9. OTPrepared cancellation/recovery audit

| Topic | Current certified / implemented behavior | Classification |
|-------|------------------------------------------|----------------|
| Cancel in normal OTPrepared UI | **Not shown** (modal footer = Reopen only) | **FACT** / PD-FS-05 |
| Recovery path | **Reopen** → Confirmed; unlock | **FACT** |
| Metadata on Reopen | Retain SequenceNo, PreparedAt, PreparedBy (PD-FS-06) | **FACT** |
| Form while OTPrepared | Locked (`LOCKED_STATUSES`) | **FACT** |
| Backend Cancel on OTPrepared | Still allowed by service / `CanCancel` | **FACT** — UI concealment only |
| Regression protection | Do not invent new OTPrepared Cancel workflow; preserve Reopen-first | **PRESERVE** |

---

## 10. Existing certified rules preserved

| Rule | Status |
|------|--------|
| RESP2 OT Preparation Finalised worklist + selected Prepare + same-date + SequenceNo continuation | **PRESERVE** |
| Finalization OT Prepared authoritative prepared worklist | **PRESERVE** |
| FinalizeOtModal reuse | **PRESERVE** |
| Reporting Time required for Confirm (PD-FS-03) | **PRESERVE** |
| Finalised/Confirmed edit → NotConfirmed (PD-FS-07 / RESP2-08) | **PRESERVE** |
| OTPrepared no Cancel CTA; Reopen recovery (PD-FS-05) | **PRESERVE** |
| Reopen metadata retention (PD-FS-06) | **PRESERVE** |
| Cancel reason + confirmation dialog (PD-FS-04 A+D) | **PRESERVE** |
| Existing FSM / permissions / APIs / ownership | **PRESERVE** (no change in this task) |
| Phase 3I / Slice 14 / Phase 3J / C-01 | **Do not reopen** |

---

## 11. Confirmed defects

| ID | Title | Severity | Scope |
|----|-------|----------|-------|
| **UAT-FS-RT-01** | Reporting Time display/validation synchronization on **queue Confirm** (`fmtOtTime` 12h list field vs `isReportingTimeValid`) | Functional — false Confirm rejection / confusing open-modal toast | Frontend list mapping + queue validation path |

**Not confirmed as code defect:** Finalised footer rendering Confirm (code does not). Treat as UAT misread or status mis-identification unless reproduced with status badge = Finalised.

---

## 12. Product Decision-required questions

1. **PD-FS-LA-01** — How should Reporting Time validation synchronize with display (fix UAT-FS-RT-01) without removing the Confirm prerequisite?
2. **PD-FS-LA-02** — Should FinalizeOtModal become explicitly state-aware for action chrome (proposed model below)?
3. **PD-FS-LA-03** — Is existing `Save (will revert)` sufficient, or must consequence copy be standardized further (without changing FSM)?
4. **PD-FS-LA-04** — Cancellation **presentation** boundary for generic modal (Options A/B/C — Owner must choose; C = separate FSM decision)?
5. **PD-FS-LA-05** — Confirm OTPrepared Cancel/Reopen boundary remains PD-FS-05 (regression protection)?
6. **PD-FS-LA-06** — SurgeryDone / Cancelled modal action boundary (view/close vs Reopen for Cancelled)?

---

## 13. Proposed state/action model

**PROPOSED — NOT APPROVED**

Purpose of FinalizeOtModal: primarily **review / edit surgery finalization information** — not a generic all-lifecycle action console.

| State | Proposed actions |
|-------|------------------|
| NotConfirmed | Close · Save · Confirm |
| Confirmed | Close · Save *(with clear revert consequence)* |
| Finalised | Close · Save *(with clear revert consequence)* |
| OTPrepared | Existing OTPrepared operational actions only (Reopen); not ordinary Finalised edit |
| SurgeryDone | View / Close only |
| Cancelled | View / Close oriented (Reopen remains if Owner keeps current Cancelled recovery) |

Cancellation presentation: see Product Decision options A/B/C — **PENDING**.

---

## 14. Out-of-scope items

- RESP2 OT Preparation redesign
- Package B / Package C
- New modal / route / entity
- FSM / permission / API / DB / ownership changes
- Changing cancellation **eligibility** (Option C) without separate PD
- Insurance / payment / clinical / theatre blockers
- Silent change of Finalised Save → remain Finalised
- Implementation Authorization
- Acceptance / UAT PASS claims

---

## 15. No implementation performed

This audit created **documentation only**.

No production code, tests, APIs, backend, DB, migrations, permissions, FSM, or RESP2 surfaces were modified.

---

## 16. No acceptance recorded

Manual UAT remains **IN PROGRESS / FINDINGS RECORDED**.  
Acceptance is **NOT RECORDED**.

---

## Contradictions (code vs certified PD narrative)

| Topic | Notes |
|-------|-------|
| PD-FS-03 historical “current implementation” table (Queue Confirm = No; BE Confirm = No) | **Stale relative to Package 1 code** — queue FE check + BE `ReportingTime.HasValue` now exist; remaining defect is **format synchronization**, not absence of the rule |
| PD-FS-04 historical “no confirm dialog / reason not collected” | **Stale** — Package 1 implemented dialog + reason; eligibility presentation still as recorded for NotConfirmed/Confirmed/Finalised |
| UAT Finalised + Confirm | **Observation ≠ code** for Finalised branch |

---

## Governance status

| Gate | Status |
|------|--------|
| **IMPLEMENTATION AUTHORIZATION** | **NONE FOR THIS TASK** |
| **IMPLEMENTATION** | **NOT STARTED** |
| **AUTOMATED TESTS** | **NOT RUN FOR THIS GOVERNANCE TASK** |
| **MANUAL UAT** | **IN PROGRESS / FINDINGS RECORDED** |
| **ACCEPTANCE** | **NOT RECORDED** |
| **PACKAGE B** | **NOT STARTED** |
| **PACKAGE C** | **NOT STARTED** |

**Recommended next governance gate:** Product Owner decision recording on `docs/product-decisions/finalize-surgery-ot-preparation-finalize-modal-lifecycle-product-decision.md` (PD-FS-LA-01…06). **Stop** after decisions — do not implement until a separate Implementation Authorization explicitly scopes fixes (especially UAT-FS-RT-01 and any approved LA presentation changes).

---

**STOP.** Audit complete. No Implementation Authorization. No code changes.
