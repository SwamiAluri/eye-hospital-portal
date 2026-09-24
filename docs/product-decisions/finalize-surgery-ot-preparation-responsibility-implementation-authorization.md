# Finalize Surgery + OT Preparation
# Bounded Implementation Authorization —
# Responsibility Remediation (PD-OTPREP-RESP-01…10)

| Field | Value |
|-------|--------|
| **Document type** | **BOUNDED IMPLEMENTATION AUTHORIZATION — GOVERNANCE ONLY** |
| **Title** | Finalize Surgery + OT Preparation — Responsibility Remediation Implementation Authorization |
| **Package name** | Finalize / OT Preparation — Responsibility Remediation |
| **Date** | 2026-09-23 |
| **Status** | **IMPLEMENTATION AUTHORIZED — RESPONSIBILITY REMEDIATION ONLY (A–J)** |
| **Implementation started by this task** | **NO** |
| **Production code / API / DB / permissions / routes / FSM / ownership / UI / tests modified by this task** | **NO** — this artifact is governance only |

---

## Authorization statement

```text
This authorization permits implementation of the Responsibility Remediation
scope (A–J) only, under the recorded Product Decision PD-OTPREP-RESP-01…10.

It does NOT authorize Package B (Print).
It does NOT authorize Package C (PD-OTPREP-10).
It does NOT authorize backend / API / DB / permission / FSM / SequenceNo /
ownership changes.

RESPONSIBILITY REMEDIATION IMPLEMENTATION AUTHORIZATION: YES
PACKAGE B PRINT AUTHORIZATION: NO
PACKAGE C PD-OTPREP-10 AUTHORIZATION: NO
NEW API AUTHORIZATION: NO
BACKEND CHANGE AUTHORIZATION: NO
DB CHANGE AUTHORIZATION: NO
PERMISSION CHANGE AUTHORIZATION: NO
FSM CHANGE AUTHORIZATION: NO
OWNERSHIP CHANGE AUTHORIZATION: NO
SEQUENCENO CHANGE AUTHORIZATION: NO
SUBSET SELECTION AUTHORIZATION: NO
PAST-DATE POLICY AUTHORIZATION: NO
TIMEZONE CHANGE AUTHORIZATION: NO
PACKAGE 1 REOPEN: NO
PHASE 3I REOPEN: NO
SLICE 14: DOES NOT EXIST
PHASE 3J: NOT CREATED
C-01 REOPEN: NO
```

---

## 1. Metadata

| Item | Value |
|------|--------|
| Artifact path | `docs/product-decisions/finalize-surgery-ot-preparation-responsibility-implementation-authorization.md` |
| Artifact disposition | **NEW** |
| Authorizes | Tightly bounded **frontend presentation** change for standalone OT Preparation per **PD-OTPREP-RESP-01…10** |
| Does not authorize | Package B · Package C · new API · backend · DB · FSM · ownership · SequenceNo · subset selection · late-add (PD-OTPREP-06) |
| Product Owner | Not supplied in repository context (consistent with RESP Product Decision) |
| Product Decision | `docs/product-decisions/finalize-surgery-ot-preparation-responsibility-product-decision.md` — **RECORDED — 10 DECIDED** (2026-09-23) |
| Trigger audit | `docs/audits/finalize-surgery-ot-preparation-responsibility-audit.md` |
| Next gate | Separate **IMPLEMENTATION** task (not started by this governance task) |

---

## 2. Product Decision register (authorized)

| ID | Selection | Authorized here? |
|----|-----------|------------------|
| **PD-OTPREP-RESP-01** | **B** — OT Preparation = preparation-only workspace | **YES** |
| **PD-OTPREP-RESP-02** | **B** — Finalization → OT Prepared = authoritative prepared worklist | **YES** |
| **PD-OTPREP-RESP-03** | **B** — Remove duplicate OTPrepared grid from standalone OT Prep | **YES** |
| **PD-OTPREP-RESP-04** | **A** — Ready predicate = Finalised + ScheduleDate day match | **YES** |
| **PD-OTPREP-RESP-05** | **A** — Prepare all remaining eligible Finalised; no subset UI | **YES** |
| **PD-OTPREP-RESP-06** | **B** — Completion summary after Prepare (no full prepared grid) | **YES** |
| **PD-OTPREP-RESP-07** | **B** — View OT Prepared → existing Finalization → OT Prepared | **YES** |
| **PD-OTPREP-RESP-08** | **B** — Preparation-oriented metrics (existing data only) | **YES** (bounded — §8) |
| **PD-OTPREP-RESP-09** | **A** — Retain actual ScheduleDate catalog | **YES** |
| **PD-OTPREP-RESP-10** | **A** — Retain None / no-eligible family | **YES** |

---

## 3. Authoritative responsibility model

```text
OT PREPARATION
  = preparation-only workspace
  = identify + prepare Finalised surgeries for selected ScheduleDate

SURGERY FINALIZATION → OT Prepared
  = authoritative operational review for already-prepared surgeries
  = search · filter · Reopen · Print · pagination (existing surface)
```

Do **not** create another prepared-worklist entity or route.

Same route remains: `/dashboard/counsellors-desk/finalize-surgery`  
Workspaces remain UI tabs only (`finalization` | `ot-preparation`).

---

## 4. Current governance baseline

| Area | Status |
|------|--------|
| Responsibility audit | **COMPLETE** |
| RESP Product Decision | **RECORDED — 10 DECIDED** |
| This Implementation Authorization | **YES — THIS DOCUMENT** |
| Responsibility Implementation | **NOT STARTED** |
| Package A | Historical implementation retained; affected presentation ACs **superseded/narrowed** (§11) |
| Package B / C | **NOT AUTHORIZED** |
| Manual UAT / Acceptance (RESP) | **NOT EXECUTED / NOT RECORDED** |

Governance sequence:

```text
AUDIT                         ✓
PRODUCT DECISION (RESP)       ✓
IMPLEMENTATION AUTHORIZATION  ✓ (this document)
IMPLEMENTATION                ← next task (NOT started here)
AUTOMATED TESTS + PLAYWRIGHT
STOP
MANUAL UAT
ACCEPTANCE
```

Do not collapse gates.  
Do not mark UAT PASS or Acceptance because this authorization exists.

---

## 5. Pre-implementation inspection (FACT — frontend only)

Inspected for this authorization (no code modified):

| Area | Existing source |
|------|-----------------|
| Page | `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/finalize-surgery/page.tsx` |
| Eligibility | `selectFinalisedForPrepareDate` in `prepare-ot-date-scope.ts` |
| Catalog / day presentation | `ot-preparation-surgery-date-catalog.ts` |
| Catalog data | Existing unfiltered finalize catalog query already on page (`catalogRecords`) |
| Prepare mutation | Existing `submitPrepareOtList` + Prepare modal (maps all eligible rows) |
| Prepared list READ | `getOtList` — used by Package A OT Prep auto-load + prepared grid |
| Finalization OT Prepared | Same page: `activeTab === 'OTPrepared'` + filters + Reopen + Print |

**Backend / API / DB changes: NOT REQUIRED** for the authorized FE-only presentation split.

If during implementation a backend change appears necessary:

```text
IMPLEMENTATION BLOCKED — BACKEND CHANGE REQUIRED BUT NOT AUTHORIZED.
```

Do not modify the backend.

---

## 6. Exact authorized scope (A–J)

| ID | Scope | Authorized |
|----|-------|------------|
| **A** | OT Preparation preparation-focused presentation | **YES** |
| **B** | Finalised eligible surgery presentation for selected ScheduleDate | **YES** |
| **C** | Preparation-oriented metrics using existing data only (§8) | **YES** |
| **D** | Removal of duplicate OTPrepared operational grid from standalone OT Prep | **YES** |
| **E** | Completion summary after successful Prepare | **YES** |
| **F** | View OT Prepared navigation to existing Finalization → OT Prepared | **YES** |
| **G** | Existing actual ScheduleDate catalog retained | **YES** |
| **H** | Existing Prepare mutation retained (all remaining eligible Finalised) | **YES** |
| **I** | Existing FSM / SequenceNo / ownership retained | **YES** (preserve — no change work) |
| **J** | Existing Surgery Finalization OT Prepared worklist protected | **YES** (preserve — no weakening) |

**NOTHING BEYOND A–J IS AUTHORIZED.**

---

## 7. Locked predicates and behaviors

### 7.1 Ready predicate (RESP-04 A)

```text
status === 'Finalised'
AND scheduleDate / StartTime calendar day === selected ScheduleDate
```

Reuse `selectFinalisedForPrepareDate`. Presentation only. Not a new FSM state.  
No insurance / payment / theatre / ownership / clinical / slot-completeness blockers.

### 7.2 Prepare semantics (RESP-05 A)

Prepare New List prepares **ALL remaining eligible Finalised** for the selected ScheduleDate.

**Forbidden:** checkboxes · row selection · deselect · partial preparation · selection dialogs · row-level Prepare buttons (unless already certified — current certified model is list-level Prepare).

Reuse existing Prepare modal + `submitPrepareOtList` request contract.  
Do not change SequenceNo / audit / FSM transition behavior.

### 7.3 ScheduleDate catalog (RESP-09 A)

Retain `buildSurgeryDateCatalog` / relative label behavior. Actual dates only. No generated horizons. StartTime → ScheduleDate SoT unchanged.

### 7.4 None state (RESP-10 A)

Retain concise None / no-eligible-surgeries family when selected actual ScheduleDate has no eligible Finalised.

### 7.5 Post-Prepare (RESP-06 B)

After success: **completion summary only** on OT Preparation.

Conceptual copy (refine within design system):

```text
OT list prepared
N surgeries prepared
```

Do not render full OTPrepared operational table on OT Prep.  
Do not invent lifecycle status. Backend state remains OTPrepared.

### 7.6 Already-prepared date (Case D)

If selected ScheduleDate has OTPrepared rows (detectable from existing `catalogRecords` / catalog `preparedCount`) and **no** remaining eligible Finalised:

- Do **not** render duplicate OTPrepared grid  
- Show already-prepared / completion-style presentation  
- Provide **View OT Prepared** (RESP-07)

Derive prepared presence from **existing finalize/catalog records** where possible. Do not create a new API.  
`getOtList` may remain available for other consumers; OT Prep must not depend on rendering its grid.

### 7.7 Date switching

Date A → Date B: clear stale preparation-queue / completion UI for A; derive/render only B. Never show A rows under B.

---

## 8. Metrics (RESP-08 B) — bounded, existing data only

**No backend metric API.**

### Authorized metric sources (already on page)

| Metric (conceptual) | Safe derivation | Source |
|---------------------|-----------------|--------|
| **Ready for OT Preparation** (selected date) | `selectFinalisedForPrepareDate(catalogRecords, selectedScheduleDate).length` | Existing catalog finalize records + RESP-04 predicate |
| **Dates requiring preparation** | Count of `buildSurgeryDateCatalog(catalogRecords)` entries where `readyCount > 0` | Existing catalog helper |

### Explicitly omitted / not authorized as strip metrics

| Candidate | Decision |
|-----------|----------|
| Legacy strip **Surgery Dates / Ready / Prepared** (Package A presentation) | **Replace** per RESP-08 B — do not retain “Prepared” as a primary OT Prep strip metric that implies OT Prep is the prepared worklist |
| Any metric requiring a new endpoint or invented business rule | **OMIT** |
| Totals that cannot be derived from loaded catalog/finalize fields | **OMIT** |

Implementation may refine labels within the design system but must not invent new predicates.

If either authorized metric cannot be derived safely from loaded data: **omit that metric** rather than inventing a rule or calling a new API.

---

## 9. View OT Prepared (RESP-07 B)

Authorized approach (FE only, same page):

1. Switch `activeWorkspace` → `'finalization'`  
2. Set status tab → `'OTPrepared'` (`activeTab`)  
3. Optionally align Finalization date filter to the selected ScheduleDate using existing `filters.date`  
4. Do **not** auto-navigate away from the app route  
5. Do **not** create a new route / worklist / duplicate search / Reopen / Print

User retains control (explicit click). **No automatic navigation** after Prepare.

---

## 10. OT Preparation target structure (conceptual)

```text
OT Preparation
concise purpose (e.g. Prepare Finalised surgeries for OT.)

[preparation-oriented metrics — §8 only]

Surgery Date catalog (actual ScheduleDates + relative labels)

Selected ScheduleDate
Ready for OT Preparation · N surgeries
Finalised eligible grid:
  Patient · Procedure · Eye · Surgery Time · Surgeon · Theatre · Status
[Prepare New List]

— OR — after Prepare / already-prepared with no remaining Finalised:
completion / already-prepared summary
[View OT Prepared]
```

**Do not** render an OTPrepared operational grid here.

Grid rules: existing Hospital Portal table patterns; content-aware columns; no selection column; no checkboxes; list-level Prepare only.

---

## 11. Package A reconciliation (exact AC impact)

Package A historical implementation and tests remain a **historical record**.  
This IA revises **standalone OT Preparation presentation** only.

### Superseded / narrowed for standalone OT Preparation

| Prior scope | Effect under this IA |
|-------------|----------------------|
| **PD-FS-11** presentation as prepared-list surface on OT Prep | **SUPERSEDED / NARROWED** — preparation workspace |
| **PD-OTPREP-UAT-03** auto-load **and render** OTPrepared grid on OT Prep | **SUPERSEDED / NARROWED** — do not render prepared grid on OT Prep |
| **PD-OTPREP-UAT-05** full Prepared OT List grid on OT Prep | **SUPERSEDED / NARROWED** |
| Package A **A3 / A5** prepared-grid presentation | **SUPERSEDED / NARROWED** |

### Package A acceptance criteria — disposition for RESP implementation

| AC | Disposition |
|----|-------------|
| **AC-A01…A04** | **RETAIN** — actual ScheduleDate catalog / relative labels / no horizons / chronological |
| **AC-A05** | **SUPERSEDED for OT Prep presentation** — do not require auto-load + render of OTPrepared grid on standalone OT Prep |
| **AC-A06…A08** | **RETAIN intent** — never auto-Prepare / never change FSM / ownership from date selection |
| **AC-A09** | **NARROWED** — if any prepared presence is shown as summary counts, it must match selected date; **no** prepared-row grid on OT Prep |
| **AC-A10** | **NARROWED** — Ready / None / already-prepared or completion states; not Package A “Prepared grid shown” honesty |
| **AC-A11…A14** | **SUPERSEDED for OT Prep prepared grid** — prepared operational grid + Reopen-on-OT-Prep-row no longer required on OT Prep; Reopen remains on Finalization → OT Prepared |
| **AC-A12** | **RETAIN** — no new worklist/entity |
| **AC-A15…A20** | **RETAIN** — no direct OTPrepared date edit · concise copy · a11y · no Print · no SequenceNo · no FSM/GuardLocked/Upsert |

Do **not** erase Package A artifacts.  
Do **not** retroactively mark Package A Acceptance PASS.

---

## 12. Auto-load / getOtList boundary

Previous Package A: selected date → `getOtList` → Prepared OT grid on OT Prep.

Under this IA:

- **Remove** standalone OT Preparation **rendering dependency** on the OTPrepared operational grid.  
- **Do not** delete or modify the `getOtList` API contract.  
- Prefer deriving preparation queue + already-prepared **presence** from existing `catalogRecords` / finalize list already loaded.  
- Stop calling `getOtList` from OT Prep **only if** it is no longer needed for authorized OT Prep presentation; do not break other certified consumers.

---

## 13. Surgery Finalization protection (RESP-02 / J)

Do **not** modify Finalization → OT Prepared:

- OT Prepared filter / status tab  
- UHID search · Patient Name search · Date filtering  
- Reopen · Print · pagination · status · prepared-row presentation  

This surface is the authoritative prepared operational worklist.

---

## 14. Explicit out of scope

Absolutely do **not** implement:

- Subset selection / checkboxes / row selection / partial preparation  
- New OT entity / new prepared worklist / new route  
- New API / backend metric API / DB schema/indexes / new permissions  
- New FSM state · SequenceNo redesign · late-add (PD-OTPREP-06)  
- Timezone redesign · past-date policy · arbitrary date horizons  
- Package B Print · Package C PD-OTPREP-10  
- Phase 3I · Slice 14 · Phase 3J · Waiting List · C-01 reopen  
- Unrelated Finalize Surgery redesign  
- Automatic navigation after Prepare  

---

## 15. Required automated tests (future implementation task)

### Unit / component

1. Actual ScheduleDate catalog unchanged  
2. Today/Tomorrow labels only decorate actual dates  
3. No generated date horizons  
4. Finalised eligibility predicate  
5. Ready state  
6. None state  
7. Already-prepared / no-remaining-work state (no duplicate grid)  
8. Prepare submits all remaining eligible Finalised rows  
9. No subset-selection controls  
10. Successful Prepare → completion summary  
11. View OT Prepared uses existing Finalization → OT Prepared (same route / workspace+tab)  
12. No duplicate Prepared OT grid on OT Preparation  
13. Date switching clears stale preparation data  
14. Existing Prepare mutation contract unchanged  

Do not create tests for unapproved behavior.

### Playwright journeys

| Journey | Expectation |
|---------|-------------|
| **A** | Open OT Preparation → preparation-focused workspace |
| **B** | Select actual ScheduleDate → Finalised eligible surgeries appear |
| **C** | No eligible Finalised → None / no-eligible |
| **D** | Already prepared + no remaining Finalised → no duplicate OTPrepared grid |
| **E** | Prepare New List → existing mutation · completion summary · no prepared grid |
| **F** | View OT Prepared → Finalization → OT Prepared |
| **G** | Finalization OT Prepared remains functional (search · date · Reopen · Print) |
| **H** | Switch ScheduleDate → stale rows cleared |
| **I** | No generated date horizons |

### Regression

Existing tests must continue passing: package1 · finalize-ot-authorization · prepare-ot-date-scope · OT prep catalog · Finalization OT Prepared · Reopen · Cancel · Reporting Time · FSM.

If regression: **STOP**. Do not weaken certified tests merely to pass.

Update Package A / discoverability e2e that assert OT Prep prepared-grid / auto-load **render** behavior to match this IA — do not silently delete coverage without replacing RESP journeys.

---

## 16. Acceptance criteria (Responsibility Remediation)

| ID | Criterion |
|----|-----------|
| **AC-RESP-01** | OT Preparation presents as preparation workspace, not primary prepared worklist |
| **AC-RESP-02** | Eligible Finalised for selected ScheduleDate shown via RESP-04 predicate |
| **AC-RESP-03** | No duplicate OTPrepared operational grid on standalone OT Prep |
| **AC-RESP-04** | Prepare New List submits all remaining eligible Finalised; no subset UI |
| **AC-RESP-05** | After Prepare → completion summary; no prepared grid |
| **AC-RESP-06** | Already-prepared + no remaining Finalised → summary + View OT Prepared; no prepared grid |
| **AC-RESP-07** | View OT Prepared opens existing Finalization → OT Prepared without new route |
| **AC-RESP-08** | Metrics only from §8 authorized derivations (or omitted) |
| **AC-RESP-09** | Actual ScheduleDate catalog / relative labels / no horizons retained |
| **AC-RESP-10** | None / no-eligible family retained |
| **AC-RESP-11** | Date switch clears stale preparation UI |
| **AC-RESP-12** | Finalization OT Prepared capabilities unmodified |
| **AC-RESP-13** | No API / backend / DB / permission / FSM / SequenceNo / ownership changes |
| **AC-RESP-14** | Package B Print untouched |
| **AC-RESP-15** | Package C / PD-OTPREP-10 untouched |

---

## 17. Required engineering implementation report (after coding — separate task)

Must contain:

1. Implementation Authorization artifact path  
2. Authorization status  
3. Exact scope implemented (A–J)  
4. Files changed  
5. Components/helpers changed  
6. Data sources used  
7. API usage  
8. Confirmation no API contract changes  
9. Confirmation no backend changes  
10. Confirmation no DB changes  
11. Confirmation no permission changes  
12. Confirmation no FSM changes  
13. Confirmation no SequenceNo changes  
14. Confirmation no ownership changes  
15. OT Preparation responsibility changes  
16. Prepared-grid removal details  
17. Prepare behavior  
18. Completion summary  
19. View OT Prepared navigation  
20. Metrics implemented and data source  
21. Tests  
22. Playwright  
23. Regression tests  
24. Skipped tests + exact reason  
25. Known limitations  
26. Package B confirmation  
27. Package C confirmation  
28. Manual UAT status  
29. Acceptance status  

Distinguish: **IMPLEMENTED** · **TESTED** · **NOT TESTED** · **BLOCKED** · **DEFERRED**.

---

## 18. Manual UAT / Acceptance gates

After implementation + automated tests: **STOP**.

| Gate | Status |
|------|--------|
| Manual UAT | **REQUIRED** — not executed by authorization task |
| Acceptance | **NOT RECORDED** |

Do not mark UAT PASS or Acceptance because this authorization exists.

---

## 19. Sign-off

| Role | Action | Status |
|------|--------|--------|
| Product Owner | RESP decisions recorded; authorize bounded FE implementation via this IA | **AUTHORIZED via this document — name not supplied in repository context** |
| Engineering | Begin Responsibility Remediation only after reading this artifact + RESP PD | **NOT STARTED** |
| QA / UAT | After implementation + tests | **NOT EXECUTED** |
| Acceptance | Explicit recording later | **NOT RECORDED** |

---

## 20. Control flags (summary)

```text
RESPONSIBILITY REMEDIATION IMPLEMENTATION AUTHORIZATION: YES
RESPONSIBILITY IMPLEMENTATION BY THIS TASK: NOT STARTED
PACKAGE B PRINT AUTHORIZATION: NO
PACKAGE C PD-OTPREP-10 AUTHORIZATION: NO
NEW API AUTHORIZATION: NO
BACKEND CHANGE AUTHORIZATION: NO
DB CHANGE AUTHORIZATION: NO
PERMISSION CHANGE AUTHORIZATION: NO
FSM CHANGE AUTHORIZATION: NO
OWNERSHIP CHANGE AUTHORIZATION: NO
SEQUENCENO CHANGE AUTHORIZATION: NO
SUBSET SELECTION AUTHORIZATION: NO
PAST-DATE POLICY AUTHORIZATION: NO
TIMEZONE CHANGE AUTHORIZATION: NO
PACKAGE 1 REOPEN: NO
PHASE 3I REOPEN: NO
SLICE 14: DOES NOT EXIST
PHASE 3J: NOT CREATED
C-01 REOPEN: NO
```

---

## 21. Gate summary

| Gate | Status |
|------|--------|
| **PRODUCT DECISION** | **RECORDED** — RESP-01 B · 02 B · 03 B · 04 A · 05 A · 06 B · 07 B · 08 B · 09 A · 10 A |
| **IMPLEMENTATION AUTHORIZATION** | **RECORDED — THIS BOUNDED SCOPE ONLY** |
| **IMPLEMENTATION** | **NOT STARTED** |
| **AUTOMATED TESTS** | **NOT RUN** |
| **MANUAL UAT** | **REQUIRED** (future) |
| **ACCEPTANCE** | **NOT RECORDED** |

**Next gate:** Separate bounded **IMPLEMENTATION** task under this authorization.

**STOP.**
