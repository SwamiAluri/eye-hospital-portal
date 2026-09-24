# Finalize Surgery + OT Preparation
# RESP2 Revised Responsibility — Engineering Implementation Report

| Field | Value |
|-------|--------|
| **Document type** | **ENGINEERING IMPLEMENTATION REPORT** |
| **Date** | 2026-09-23 |
| **Package** | Finalize / OT Preparation — RESP2 Revised Responsibility |
| **Status** | **IMPLEMENTATION COMPLETE — AUTOMATED TESTS RUN — STOPPED BEFORE MANUAL UAT** |
| **Manual UAT** | **REQUIRED — NOT EXECUTED** |
| **Acceptance** | **NOT RECORDED** |

---

## 1. Authorization reference

`docs/product-decisions/finalize-surgery-ot-preparation-revised-responsibility-implementation-authorization.md`

**Status used:** IMPLEMENTATION AUTHORIZED — RESP2 BOUNDED SCOPE ONLY

## 2. Product Decision reference

`docs/product-decisions/finalize-surgery-ot-preparation-revised-responsibility-product-decision.md`

**Register:** PD-OTPREP-RESP2-01…10 — 10 DECIDED / 0 PENDING

**Trigger audit:** `docs/audits/finalize-surgery-ot-preparation-revised-responsibility-audit.md`

---

## 3. Scope A–Z (authorized implementation)

| Area | Status |
|------|--------|
| **A** Finalised worklist replaces date-dashboard primary UX | **IMPLEMENTED** |
| **B** Explicit row selection (individual / multi / deselect / select-all-visible / clear) | **IMPLEMENTED** |
| **C** Eligibility = Finalised only (no invented blockers) | **IMPLEMENTED** |
| **D** Prepare OT on selected rows only; existing `Date + Items[]` | **IMPLEMENTED** |
| **E** Same-ScheduleDate batch constraint; mixed-date blocked | **IMPLEMENTED** |
| **F** Prepare confirmation with selected count | **IMPLEMENTED** |
| **G** SequenceNo continuation from max OTPrepared for date | **IMPLEMENTED** (FE) |
| **H** Post-Prepare: remain on OT Prep, refresh, optional View OT Prepared | **IMPLEMENTED** |
| **I** FinalizeOtModal / updateOtDetails reuse; FSM untouched | **IMPLEMENTED** (preserve) |
| **J** Remove primary date-dashboard presentation | **IMPLEMENTED** |
| **K** Finalization Finalised + OT Prepared surfaces protected | **PRESERVED** |
| **L** No backend / API / DB / permissions / routes / entities / ownership | **PRESERVED** |

Out of scope (not implemented): Package B Print · Package C / PD-OTPREP-10 · cross-date Prepare · cross-page Select All · SequenceNo renumber/gap-fill · new API/route/entity.

---

## 4. Files changed (this RESP2 implementation)

| Path | Change |
|------|--------|
| `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/finalize-surgery/page.tsx` | OT Prep → Finalised worklist + selection Prepare |
| `apps/hospital-portal-web/src/lib/counsellors-desk/ot-preparation-resp2.ts` | **NEW** — filter / selection / same-date / SequenceNo helpers |
| `apps/hospital-portal-web/src/lib/counsellors-desk/ot-preparation-resp2.test.ts` | **NEW** — unit coverage for RESP2 helpers |
| `apps/hospital-portal-web/src/lib/counsellors-desk/ot-preparation-surgery-date-catalog.test.ts` | Page-contract assertions updated for RESP2 |
| `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/finalize-surgery/finalize-ot-prep-resp2.test.tsx` | **NEW** — page source contracts |
| `apps/hospital-portal-web/src/components/counsellors-desk/session/counselling-session-theme.css` | `finalize-ot-prep-work-grid` tracks |
| `apps/hospital-portal-web/e2e/finalize-surgery-ot-discoverability.spec.ts` | RESP2 Playwright journeys |
| `apps/hospital-portal-web/e2e/ops-ui-alignment-uat.spec.ts` | OT Prep expectations aligned to RESP2 |
| `docs/product-decisions/finalize-surgery-ot-preparation-revised-responsibility-implementation-report.md` | **THIS REPORT** |

Helpers retained (not deleted): `ot-preparation-surgery-date-catalog.ts` (historical RESP helpers still unit-tested).

---

## 5. Finalisation worklist implementation

OT Preparation primary surface is a **Finalised-only** worklist:

- Data: existing unfiltered finalize catalog (`useFinalizeListQuery` + `OT_PREP_SURGERY_DATE_CATALOG_FILTERS`)
- Client filter: `filterFinalisedForOtPrepWorklist` (date / UHID / name)
- Pagination: existing `WaitingListQueuePagination` + `sliceWaitingListPage`
- Row layout aligned with Finalization worklist patterns + selection column
- No new route; same `/dashboard/counsellors-desk/finalize-surgery` workspace tab

---

## 6. Selection implementation

- Per-row checkbox (`OtPrepWorkRow`)
- Multi-select via Set of ids
- Deselect individual / Clear selection
- Select all visible = `selectAllVisibleIds(otPrepPaged)` (current page only)
- Changing page/filters reconciles via `reconcileSelectionToVisible` (no cross-page selection)

---

## 7. Select-all-visible semantics

**IMPLEMENTED as:** all **eligible Finalised rows visible on the current page**.

**NOT:** all filtered across pagination · branch-wide · DB-wide · hidden rows · other pages.

---

## 8. Same-date validation

Before Prepare / confirmation:

- `resolveSinglePrepareScheduleDate`
- Mixed ScheduleDates → block Prepare, toast + inline hint: “Selected surgeries must have the same surgery date.”
- No silent split into multiple Prepare requests

---

## 9. Prepare request behavior

- Existing `counsellorsDeskApi.submitPrepareOtList({ date, items })`
- Items built only from selected eligible Finalised rows in **worklist order**
- Unselected Finalised rows not submitted (partial preparation supported)
- Finalization toolbar “Prepare OT List” remains the certified date-scoped modal path (unchanged API)

---

## 10. Partial preparation

Explicitly supported: user may select a subset of Finalised rows for one ScheduleDate and Prepare only those.

---

## 11. SequenceNo inspection (pre-impl proof)

| Check | Result |
|-------|--------|
| A. Obtain existing OTPrepared SequenceNo for ScheduleDate without new API | **PASS** — `catalogRecords` includes OTPrepared; `mapOtRecord` spreads `sequenceNo` |
| B. Submit continued sequences via existing Prepare `Items[].sequence` | **PASS** — FE supplies `sequence` on each item |

**IMPLEMENTATION BLOCKED?** **NO**

---

## 12. SequenceNo continuation implementation

```text
highestExistingSequence = max(SequenceNo among OTPrepared for ScheduleDate D)
  (null/absent treated as 0)

selected (worklist order) → highest+1, highest+2, …
```

Helpers: `highestOtPreparedSequenceForDate`, `buildContinuedPrepareItems`, `selectedRecordsInWorklistOrder`.

Does **not**: renumber existing · fill gaps · reset · rewrite historical · use checkbox click order.

---

## 13. Worklist / request ordering

Selected rows collected with `selectedRecordsInWorklistOrder(otPrepFiltered, selectedIds)` — filtered worklist order, not Set insertion / click order. Covered by unit tests.

---

## 14. Post-Prepare behavior

On success:

- Remain on OT Preparation
- Clear selection
- Invalidate finalize list + refetch catalog (prepared rows leave Finalised eligibility)
- Concise success toast
- Optional **View OT Prepared** → Finalization workspace + OTPrepared tab (+ date when known)

On 409 time conflict: opens existing `PrepareOtListModal` with selected records and continued sequences for time resolution (same API).

---

## 15. FinalizeOtModal reuse

OT Prep **Open** uses the same `FinalizeOtModal` / `scheduleId` path as Finalization. No second modal. FSM / edit→NotConfirmed behavior unchanged (modal + existing update APIs).

---

## 16. Date-dashboard removal

Removed from **primary** OT Prep presentation:

- Surgery-date catalog pills as primary navigation
- Ready / Dates-requiring metrics strip
- Ready preview grid / completion-summary-first / day-state empty panels
- “Prepare New List” date-dashboard CTA

ScheduleDate retained as filter + Prepare batch constraint.

---

## 17. Finalization protections

Preserved:

- Finalised search / filters / pagination / editing / confirm-finalise
- OT Prepared tab search / date / Reopen / Print / pagination / status
- No duplicate OTPrepared operational grid on OT Prep

---

## 18. API / backend verification

| Item | Result |
|------|--------|
| New Prepare endpoint | **NONE** |
| API contract change | **NONE** (this task) |
| Backend service edits by this task | **NONE** |

Note: workspace had **pre-existing dirty** microservice/DB files unrelated to this RESP2 FE task; they were **not** modified as part of RESP2 implementation.

---

## 19. DB verification

**NONE** by this task (no migrations, indexes, or schema edits for RESP2).

---

## 20. Permission verification

**NONE** changed. Existing `FINALIZE_OT_MUTATE_PERMISSION` gates Prepare; `COUNSELLING_SESSIONS_READ_PERMISSION` + `ProtectedRoute` unchanged.

---

## 21. FSM verification

**NONE** changed. No new states/transitions. Edit→NotConfirmed remains modal/backend behavior.

---

## 22. Ownership verification

**NONE** changed (CounselorId / Assign / Reassign / Requeue / My Work / ownership history untouched).

---

## 23. Unit / component tests

| Suite | Result |
|-------|--------|
| `ot-preparation-resp2.test.ts` | **PASS** |
| `finalize-ot-prep-resp2.test.tsx` | **PASS** |
| `ot-preparation-surgery-date-catalog.test.ts` (updated contracts) | **PASS** |
| Counsellors-desk lib + finalize page tests (broader) | **695 passed** (97 files) |

Coverage includes: Finalised filter, selection helpers, select-all-visible, reconcile, mixed/same date, SequenceNo continuation, worklist order vs click order, page contracts (no date-dashboard / no prepared grid).

---

## 24. Regression tests

Relevant existing suites executed with counsellors-desk vitest run, including finalize-ot-authorization, package1 contracts, prepare-ot-date-scope, catalog helpers, modal presentation — **PASS** within the 695.

---

## 25. Playwright tests

`e2e/finalize-surgery-ot-discoverability.spec.ts` — project **chromium**:

| Result | Count |
|--------|-------|
| Passed | **9** |
| Skipped | **0** |

Journeys covered: Finalised worklist · no date-dashboard · search/filter · selection · select all visible · clear · Prepare confirmation count/cancel · FinalizeOtModal open · View OT Prepared / Finalization OT Prepared protection · no duplicate prepared grid.

`ops-ui-alignment-uat.spec.ts` OT Prep expectations updated (not re-run in full in this session).

**Destructive live Prepare submit:** not exercised in Playwright (confirm cancel only) — safe for UAT environments.

---

## 26. Accessibility / responsive verification

Implemented:

- Semantic checkbox `aria-label` per patient
- Confirm dialog `role="alertdialog"` + labelled title/description
- Keyboard open on patient cell (Enter/Space)
- Disabled Prepare when empty / mixed-date
- Selected count in summary + button
- Work-grid CSS for tablet/desktop tracks; mobile stacks via base single-column grid

Formal a11y audit tool run: **NOT EXECUTED** (manual UAT item).

---

## 27. Git diff safety check

RESP2 intentional paths inspected:

- Frontend OT Prep page / helpers / CSS / e2e / docs report only
- **No** RESP2 edits to backend services, API contracts, DB migrations, permissions, FSM, ownership, or routes

Pre-existing unrelated dirty files in the working tree (microservices, migrations, other FE) were **not** part of this implementation and must not be attributed to RESP2.

---

## 28. Package B status

**NOT AUTHORIZED — NOT STARTED**

---

## 29. Package C status

**NOT AUTHORIZED — NOT STARTED**

---

## 30. Manual UAT status

```text
MANUAL UAT: REQUIRED — NOT EXECUTED
```

---

## 31. Acceptance status

```text
ACCEPTANCE: NOT RECORDED
```

---

## 32. Known limitations

1. SequenceNo continuation depends on catalog-loaded OTPrepared rows for the date; if catalog is incomplete for that date, highest may under-count until refresh (same data path as existing finalize list — no new API authorized).
2. Mixed-date selection is blocked client-side; user must deselect differing dates (no auto-split).
3. Select all visible is page-local by product rule — intentional.
4. Playwright does not submit live Prepare (confirm cancel only) to avoid unsafe mutation in shared UAT.

---

## 33. Implementation blockers

**NONE** — SequenceNo FE data path proved sufficient; implementation proceeded.

---

## 34. Final implementation status

```text
RESP2 IMPLEMENTATION: COMPLETE (BOUNDED FE SCOPE)
AUTOMATED TESTS: RUN (unit + chromium Playwright)
MANUAL UAT: REQUIRED — NOT EXECUTED
ACCEPTANCE: NOT RECORDED
PACKAGE B: NOT STARTED
PACKAGE C: NOT STARTED
STOP: YES — governance stop honored
```
