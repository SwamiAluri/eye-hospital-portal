# Finalize Surgery + OT Preparation
# UAT Findings & Operational UX Reconciliation Audit
# PD-OTPREP-01…05

| Field | Value |
|-------|--------|
| **Document type** | **AUDIT ONLY — NO IMPLEMENTATION** |
| **Date** | 2026-09-23 |
| **Scope** | Reconcile Manual UAT observations vs Product Decisions, Implementation Authorization, completed PD-OTPREP-01…05 implementation |
| **Production / API / DB / permissions / routes / FSM / ownership modified** | **NO** |

---

## 1. Metadata

| Item | Value |
|------|--------|
| Artifact path | `docs/audits/finalize-surgery-ot-preparation-uat-findings-operational-ux-reconciliation-audit.md` |
| Trigger | Human Manual UAT observations on Surgery-Date Discoverability package |
| Authorizes | **Nothing** |
| Does not authorize | Remediation, Product Decisions, Implementation Authorization, Print fixes, auto-load, rescheduling, horizons |

---

## 2. Audit-only declaration

This task is **AUDIT ONLY**.

No production code, APIs, database, permissions, routes, FSM, ownership, SequenceNo, UAT status, or acceptance status were modified.

UAT observations are **not** silently converted into Implementation Authorization.

---

## 3. Governance baseline (unchanged by this audit)

| Area | Status |
|------|--------|
| Phase 3I | **CLOSED** |
| Slice 13 | **CLOSED** |
| Slice 14 | **DOES NOT EXIST** |
| Phase 3J | **NOT CREATED** |
| C-01 | **ACCEPTED + CLOSED** |
| Package 1 | **IMPLEMENTED** |
| Package 1 Manual UAT | **IN PROGRESS** |
| Package 1 Acceptance | **NOT RECORDED** |
| PD-OTPREP-01…10 | **RECORDED** |
| Discoverability Implementation Authorization | **AUTHORIZED — PD-OTPREP-01…05 ONLY** |
| Discoverability implementation | **COMPLETE** (repository evidence below) |
| Discoverability automated tests | **PASSED** (Vitest 27; Playwright Chromium 3 — as reported; re-verified by file inspection) |
| Discoverability Manual UAT | **IN PROGRESS / NOT YET ACCEPTED** |
| Discoverability Acceptance | **NOT RECORDED** |

---

## 4. Authoritative sources

| ID | Artifact |
|----|----------|
| A | `docs/product-decisions/finalize-surgery-ot-preparation-product-decision.md` |
| B | `docs/product-decisions/finalize-surgery-ot-preparation-operational-model-product-decision.md` |
| C | `docs/product-decisions/finalize-surgery-ot-preparation-implementation-authorization.md` |
| D | `docs/product-decisions/finalize-surgery-ot-preparation-discoverability-implementation-authorization.md` |
| E | `docs/audits/finalize-surgery-ot-preparation-comprehensive-audit.md` |
| F | `docs/audits/finalize-surgery-ot-preparation-operational-model-audit.md` |

**Implementation inspected:**

- `apps/hospital-portal-web/src/lib/counsellors-desk/ot-preparation-surgery-date-catalog.ts`
- `apps/hospital-portal-web/src/lib/counsellors-desk/ot-preparation-surgery-date-catalog.test.ts`
- `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/finalize-surgery/page.tsx`
- `apps/hospital-portal-web/e2e/finalize-surgery-ot-discoverability.spec.ts`
- `OtFinalizeService.ReopenAsync` / `GuardLocked` / Prepare / GetOtList
- `FinalizeSurgeryRecord` type

---

## 5. Current implementation summary

**FACT:** PD-OTPREP-01…05 are implemented as a frontend-first package.

| Area | Behavior (verified from code) |
|------|-------------------------------|
| Catalog | `buildSurgeryDateCatalog(catalogRecords)` — distinct `scheduleDate` with Finalised/OTPrepared counts; sorted ascending; **no invented dates** |
| Catalog data | Second `useFinalizeListQuery` with empty date/uhid/name (`OT_PREP_SURGERY_DATE_CATALOG_FILTERS`) → existing `GET /Counseling/ot-schedule` without `date` |
| Navigation | Horizontal date pills + secondary native date input |
| Day state | `resolveOtPreparationDayPresentation` → ready / prepared / none / loaded_prepared |
| Load | Explicit `handleLoadOtList` → `getOtList(day)`; selection does **not** call Load |
| Stale | `selectOtPrepSurgeryDate` clears `otList` + `otListLoadedForDate` when date changes |
| Wording | Title: `OT Preparation — Surgery Date: {otPrepDateLabel}`; subtitle from `otDayPresentation` (otListDate context) |
| Prepared rows | Sequence + name + joined metadata line + Reopen |
| Print (OT Prep toolbar) | `window.print()` on the SPA page |
| Print (Finalization row) | Separate `printOtSlip(rec)` popup HTML |

---

## 6. PD-OTPREP-01…05 acceptance-criteria reconciliation

| AC | Expected | Evidence | Result |
|----|----------|----------|--------|
| **AC-01** | Finalised today / surgery tomorrow discoverable under tomorrow | Catalog keys off `scheduleDate`; unit test AC-01/02/03; UAT shows distinct future dates (e.g. 07 Apr ready) | **PASS** |
| **AC-02** | +2 discoverable | Same | **PASS** |
| **AC-03** | Next week discoverable when present in data | Same — only if that ScheduleDate exists in loaded records | **PASS** |
| **AC-04** | Finalisation date never determines Prep date | No FinalisedAt; catalog ignores Confirmed-only “today” noise in unit test | **PASS** |
| **AC-05** | Dates from authoritative ScheduleDate | `buildSurgeryDateCatalog` | **PASS** |
| **AC-06** | No arbitrary horizon | No 7/30/60/90 generation | **PASS** |
| **AC-07** | Select does not auto-load | `selectOtPrepSurgeryDate` clears only; e2e asserts no Prepared list | **PASS** |
| **AC-08** | Explicit Load remains | `finalize-ot-load-list` → `getOtList` | **PASS** |
| **AC-09** | Ready vs prepared distinguishable | Day kinds + catalog counts | **PASS** |
| **AC-10** | Empty ≠ no Finalised | Ready messaging vs “No eligible surgeries” | **PASS** |
| **AC-11** | Surgery-date wording | Title includes Surgery Date | **PASS** |
| **AC-12** | Subtitle uses otListDate context | `otDayPresentation` / not `finalisedForDate` | **PASS** |
| **AC-13** | Date change no silent wrong-date rows | Clear on date change | **PASS** |
| **AC-14** | Backend Prepare/GetOtList unchanged | No BE file changes in package | **PASS** |
| **AC-15** | FSM unchanged | No FSM edits | **PASS** |
| **AC-16** | No ownership | No CounselorId / My Work | **PASS** |
| **AC-17** | No new OT entity | Catalog is presentation only | **PASS** |
| **AC-18** | Permissions / branch isolation unchanged | Same APIs/permissions | **PASS** |

**FACT:** Against AC-01…18, the discoverability package meets the authorized criteria.

**FACT:** UAT observations below are largely **beyond** or **adjacent to** AC-01…18 (Print, density, auto-load preference, reschedule entry point, relative labels).

---

## 7. UAT observation inventory

| ID | Observation (human) | Topic |
|----|---------------------|-------|
| UAT-01 | Prefer operational sequence Today / Tomorrow / Next 2 days / Next week | Catalog labeling / navigation |
| UAT-02 | When prepared, Load should “obviously” show prepared list / visible by default | Explicit Load |
| UAT-03 | Prepared OT List feels passive; alignment/scannability insufficient | Prepared list UX |
| UAT-04 | Change surgery date should be directly accessible from OT Prep | Reschedule / Reopen |
| UAT-05 | Print is not working | Print |
| UAT-06 | UI feels clumsy / not professional / AI-like text concerns | Visual / copy |

---

## 8. Surgery-date catalog analysis

### What the catalog shows (FACT)

- Absolute calendar labels via `formatScheduleDate` (e.g. `02 Apr 2026`).
- Counts: `N ready` or `N prepared` (if ready=0).
- Only dates with ≥1 Finalised and/or OTPrepared in the unfiltered finalize list.
- Sorted by `scheduleDate` ascending (includes past dates if still Finalised/OTPrepared in data).

### Relative labels without inventing dates (FACT + RECOMMENDATION)

| Concept | Assessment |
|---------|------------|
| Apply “Today” / “Tomorrow” / weekday to an **actual** ScheduleDate | Compatible with PD-OTPREP-01/02 — label only, same SoT |
| Treat “Next week” as a **generated empty week** | **Violates** “dates from existing data only” |
| Treat “Next week” as label for an **actual** ScheduleDate ~7 days out | Label-only — possible; needs presentation rule (**Product Decision** if operators expect a range selector) |
| Rolling “today + next 7 calendar days” including days with zero surgeries | **New Product Decision** — invents dates / horizon |

### Pill unwieldiness (FACT)

Horizontal scroll of pills scales with distinct Finalised/OTPrepared dates in branch data. No truncation/windowing in code. Many dates → scrollable clutter (UX risk, not AC failure).

---

## 9. Date navigation / horizon analysis

| Dimension | Current | Notes |
|-----------|---------|-------|
| **A. Data discoverability** | Present | Actual ScheduleDates from loaded records |
| **B. Date navigation** | Pills + native date input | Catalog is primary; picker secondary |
| **C. Date range / horizon** | All matching dates in data | No horizon filter |
| **D. Relative labeling** | Not implemented | Absolute `en-IN` dates only |

**Q2 answer (FACT):** A rolling horizon that **invents** empty future days (e.g. always show next 7 days) **would violate** PD-OTPREP-01/02 / Implementation Authorization (“Do NOT invent a 7-day horizon”).

**Q1 answer:** Relative labels on **actual** ScheduleDates only = allowed direction under existing decisions as **bounded UX refinement** (presentation), provided no empty dates are fabricated. Explicit Product Decision recommended if “Next week” is interpreted as a range control rather than a label.

---

## 10. Explicit Load analysis

### PD-OTPREP-04 (FACT)

**SELECTED: Option B** — date selection changes context; operator explicitly clicks Load OT List. Auto-load and hybrid auto-load are **not** authorized.

### Current behavior (FACT)

1. Selecting a pill/input updates `otListDate`, clears prior `otList` if date changed.
2. Before Load: day-state panel shows ready / prepared / none (for prepared-only: “OT list already prepared… Use Load OT List to view”).
3. Load calls `getOtList(selected day)` and sets `otListLoadedForDate`.
4. No auto-load path in `selectOtPrepSurgeryDate`.
5. Stale clear implemented.
6. Title always shows selected surgery date; loaded list header repeats `otPrepDateLabel`.

### Classification of UAT-02

| Question | Answer |
|----------|--------|
| Existing behavior correct per decision? | **Yes** (explicit Load) |
| UX clarity issue within PD-OTPREP-04? | **Yes** — prepared dates still require Load; secondary copy may feel redundant |
| Implementation defect? | **No** vs AC-07/08 |
| Product Decision required to auto-load? | **Yes** — changing to auto-load / hybrid reverses PD-OTPREP-04 Option B |

**RECOMMENDATION (not authorization):** Prefer improving prepared-state copy/CTA emphasis under PD-OTPREP-03/04/05 **without** auto-load, unless Product Owner reopens PD-OTPREP-04.

---

## 11. Prepared OT List operational UX analysis

### Currently displayed (FACT)

| Element | Presentation |
|---------|--------------|
| SequenceNo | Left number (`sequenceNo ?? idx+1`) |
| Patient name | Bold primary line |
| UHID · surgery · eye · startTime · theatre | Single muted joined line |
| Action | Reopen only |
| Status badge | **Not shown** (implied by being on prepared list) |
| PreparedAt / PreparedBy | **Available on type/API; not rendered** |
| Surgeon | On record; **not shown** on prepared row |
| ReportingTime / package / anesthesia | Available on record; **not shown** |

### Comparison to Finalization queue (FACT)

Finalization uses a denser multi-column work grid with StatusBadge, schedule column, primary actions. OT Prep prepared list is a simplified divided list — **intentional density difference**, but UAT finds it too passive for OT workstation scanning.

### Gap classification (per field/UX)

| Gap | Class |
|-----|-------|
| Missing column headers / alignment vs Finalization grid | **B** — bounded UX within discoverability/presentation (if scoped as list scannability under PD-OTPREP-03/05) **or D** if treated as new operational worklist layout |
| Surgeon / PreparedAt not shown though available | **B** (use existing authoritative fields) |
| No status badge on prepared rows | **A/B** — list is OTPrepared-only; badge optional |
| Want new clinical fields not on record | **H** / do not invent |

**Do not** invent a new table entity. Prefer reusing Finalization / counselling desk table patterns with **existing** fields.

---

## 12. Surgery-date modification / Reopen analysis

### Certified path (FACT)

| Step | Behavior |
|------|----------|
| OTPrepared | `IsLocked`; UpdateDetails/UpdateSlot blocked by `GuardLocked` |
| Reopen | Immediate (no confirm dialog); OTPrepared → **Confirmed**; unlock; **retains** SequenceNo / PreparedAt / PreparedBy (PD-FS-06) |
| After Reopen | Editable via Finalization / modal; StartTime change via UpdateDetails resets **Confirmed/Finalised → NotConfirmed** |
| Upsert from counselling | Can overwrite StartTime and reset even when locked — **asymmetry**; PD-OTPREP-10 Option A = require Reopen (direction decided; **not implemented** in discoverability package) |

### Direct “Change Surgery Date” from OT Prep prepared row

| Assessment | |
|------------|--|
| Allowed while OTPrepared without Reopen? | **No** (GuardLocked paths) |
| Supported after Reopen via certified workflow? | **Yes** — edit schedule then re-Confirm/Finalise |
| New CTA “Change Surgery Date” / “Reopen & Edit”? | **Not authorized**; would need UX decision + possibly PD-OTPREP-10 implementation auth |
| Classification of UAT-04 | **I** for discoverability package · **E/D** for FSM/reschedule entry · Reopen path already exists (**A** capability / **B** discoverability of the path) |

**Q6:** Direct surgery-date editing from OTPrepared row is **not** allowed under certified GuardLocked workflow.  
**Q7:** Reopen **does** provide the unlock route; date edit is then via existing Finalize/modal workflow — not a dedicated OT Prep editor.  
**Q8:** PD-OTPREP-10 **does** need separate Implementation Authorization before enforcing Upsert/GuardLocked alignment or building reschedule UX on OTPrepared.

---

## 13. Print functionality investigation

### FACTS

| Item | Evidence |
|------|----------|
| OT Prep toolbar Print | `onClick={() => window.print()}` — prints **current browser page** (full SPA chrome) |
| Finalization per-row Print | `printOtSlip(rec)` — dedicated HTML window then `window.print()` |
| Discoverability package | Retained toolbar `window.print()`; did not introduce a list print layout |
| `@media print` OT Prep layout | **Not found** in this page for prepared list |
| Automated tests for Print | **None** in discoverability suite |
| Part of PD-OTPREP-01…05 AC? | **No** |
| Certification | Slip print exists for Finalization rows; OT Prep list Print is a weak/pre-existing toolbar affordance |

### Why UAT reports “Print is not working”

**Most likely (INFERENCE from code):** `window.print()` on the dashboard SPA does not produce a usable OT list slip (wrong content / blank / capped by browser popup / layout). It is **not** wired to `printOtSlip` or a dedicated prepared-list print document.

### Classification (Q9/Q10)

| Label | Fit |
|-------|-----|
| Implementation regression caused by PD-OTPREP-01…05 | **Unlikely** — same `window.print()` pattern retained |
| Existing functional defect / incomplete capability | **Primary — F / incomplete** |
| Environment/browser limitation | Possible secondary (popup blockers) — **G** if verified |
| Separate product requirement for list Print | If Product Owner wants certified OT list print → **D** + Implementation Authorization |

**Do not fix in this audit.**

---

## 14. Visual / UX / accessibility audit

| Dimension | Assessment | Class |
|-----------|------------|-------|
| Hierarchy | Title + subtitle + catalog + controls + list is clear | **A** with polish needs |
| Density | Day-state empty panels + dashed borders add whitespace; list rows light | **B** |
| Alignment | Prepared rows wrap (`flex-wrap`); metadata in one truncated line; unlike Finalization columns | **B** |
| Typography | Matches counselling tokens; secondary messages can feel instructional | **B** (copy tighten under PD-OTPREP-05) |
| Scanning | Sequence meaningful; eye/time/theatre buried in muted join | **B** |
| Responsive | Horizontal catalog scroll OK; row wrap may misalign actions | **B** |
| A11y | Catalog `aria-pressed`; Load/Prepare testids; Reopen labeled; day-state `data-ot-prep-kind` | **A** with room for status announcement |
| AI-like copy | Secondary strings like “Use Prepare New List when ready” / “Use Load OT List to view…” are mildly instructional | **B** under PD-OTPREP-05 |

**Q11:** Under PD-OTPREP-05: tighten wording, subtitle/title consistency, reduce instructional tone.  
**Q12:** Auto-load, new reschedule CTAs, invented horizons, certified Print redesign → **new PD / separate auth**.

---

## 15. Authoritative field matrix

| Field | Source | Available now? | Used in OT Prep UI? | Authoritative? | Safe for UX use? |
|-------|--------|----------------|---------------------|----------------|------------------|
| Patient name | `FinalizeSurgeryRecord.patientName` | Yes | Yes (prepared row) | Yes | Yes |
| UHID | `uhid` | Yes | Yes (joined line) | Yes | Yes |
| Procedure | `surgeryName` | Yes | Yes (joined) | Yes | Yes |
| Eye | `eyes` | Yes | Yes (joined) | Yes | Yes |
| StartTime | `startTime` | Yes | Yes (joined) | Yes (SoT with ScheduleDate) | Yes |
| ScheduleDate | `scheduleDate` ← StartTime | Yes | Catalog + title | Yes | Yes |
| Theatre | `theaterName` | Yes | Yes (joined) | Yes | Yes |
| Surgeon | `surgeon` | Yes | **No** (prepared list) | Yes | Yes |
| SequenceNo | `sequenceNo` | Yes | Yes | Yes | Yes |
| Status | `status` | Yes | Catalog counts / day state; not badge on row | Yes | Yes |
| PreparedAt | `preparedAt` | Yes | **No** | Yes (event) | Yes |
| PreparedBy | API/response | Partial on type | **No** | Yes | Yes if mapped |
| ReportingTime | `reportingTime` | Yes | **No** on prepared list | Yes | Yes |
| IsLocked | `isLocked` | Yes | Implicit | Yes | Yes |
| Finalised / OTPrepared | status | Yes | Catalog / presentation | Yes | Yes |

---

## 16. Automated-test reconciliation

### Vitest (reported 27 passed — files inspected)

| Coverage | Present? |
|----------|----------|
| Catalog derivation / no horizon | **Yes** |
| Tomorrow / +2 / next week ScheduleDate placement | **Yes** (unit, synthetic dates) |
| Multi patient same date | **Yes** |
| OTPrepared vs Finalised counts | **Yes** |
| Ready / prepared / none / loaded_prepared | **Yes** |
| Stale clear helper | **Yes** |
| Package 1 + prepare-ot-date-scope regression | **Yes** (suite composition) |
| Print | **No** |
| Prepared-row composition | **No** |
| Reopen / reschedule | **No** (out of package) |
| Live catalog completeness vs API | **No** (unit only) |

### Playwright Chromium (reported 3 passed)

| Coverage | Present? |
|----------|----------|
| Title / catalog / Load / day state structure | **Yes** |
| Explicit Load (no auto-load on date fill) | **Yes** |
| Multi-date content / tomorrow seed | **No** — comment: requires Manual UAT seed |
| Print / Reopen / prepared-row grid | **No** |
| Firefox/WebKit | **Not executed** (browsers missing) — **G** |

**FACT:** Tests validate helpers + structural interaction well; they do **not** fully certify operational Print or dense prepared-list UX.

---

## 17. UAT finding classification matrix

| ID | Finding | Evidence | Classification | Current authorization? | Action |
|----|---------|----------|----------------|------------------------|--------|
| F-01 | Absolute date pills; want Today/Tomorrow/Next week labels | Catalog uses `formatScheduleDate` only | **B** (labels on actual dates) or **D** if “Next week” = range | Partial under 01/02/05 | Product Decision if range semantics; else bounded UX auth |
| F-02 | Rolling 7-day horizon desire | PD forbids inventing horizons | **D** if pursued | **No** | New PD |
| F-03 | Want prepared list visible without Load | PD-OTPREP-04 = B explicit Load | **D** to change; **B** for clarity copy | Auto-load **No** | Reopen PD-04 or clarify UX |
| F-04 | Prepared list passive / alignment | Row = name + joined meta | **B** | Presentation polish under 03/05 with auth | Bounded remediation auth |
| F-05 | Direct surgery-date change from OTPrepared | GuardLocked; Reopen path exists | **I** for this package; **E/D** for PD-10 | PD-10 not implemented | Separate FSM auth |
| F-06 | Reopen clarity / next step | Immediate reopen → Confirmed | **A** behavior; **B** UX guidance optional | Package 1 / PD-FS | Optional copy only |
| F-07 | Print not working | `window.print()` on SPA | **F** (incomplete/defect) | Not in AC-01…18 | Separate remediation auth |
| F-08 | Clumsy / AI-ish secondary copy | “Use Load OT List to view…” | **B** | PD-OTPREP-05 | Bounded copy polish |
| F-09 | Firefox/WebKit e2e not run | Playwright install missing | **G** | N/A | Env install if required |
| F-10 | PD-OTPREP-01…05 SoT/catalog/Load/stale/wording | Code + AC matrix | **A** | Authorized & implemented | Continue UAT |

---

## 18. Product Decisions required

Genuine decision gaps (not already decided):

| Topic | Why |
|-------|-----|
| **Relative “Next week” as range vs label** | Ambiguous operator ask |
| **Rolling horizon inventing empty days** | Conflicts with current PD if pursued |
| **Auto-load / hybrid Load** | Would reverse PD-OTPREP-04 Option B |
| **Certified OT Prepared list Print** | Current toolbar Print not a certified slip |
| **OT Prep prepared-list as full operational grid** | If framed as new workstation layout beyond presentation polish |

**Not required for:** keeping explicit Load; keeping StartTime SoT; Reopen-before-edit direction (already PD-OTPREP-10 Option A — needs **implementation** auth, not a new PD).

---

## 19. FSM / workflow decisions required

| Topic | Status |
|-------|--------|
| PD-OTPREP-10 Upsert vs GuardLocked enforcement | **Direction decided; implementation auth missing** |
| New OTPrepared → edit-date transition without Reopen | **Not allowed** under current GuardLocked; would be new FSM PD |
| Reopen confirmation dialog | **Not required** by evidence; Package 1 Cancel has reason — Reopen does not |

---

## 20. Separate defect/remediation candidates

| Candidate | Class | Notes |
|-----------|-------|-------|
| OT Prep toolbar Print (`window.print`) | **F** | Wire dedicated print document or remove non-functional affordance — **separate auth** |
| Prepared-list density/alignment using existing fields | **B** | Separate bounded UX remediation auth under 01…05 clarification |
| Secondary instructional copy | **B** | PD-OTPREP-05 polish |
| Playwright browser install | **G** | Environment |

---

## 21. Scope safety

Confirmed by this audit task:

```
NO production changes
NO API changes
NO DB changes
NO permission changes
NO route changes
NO FSM changes
NO ownership changes
NO SequenceNo changes
NO Print fixes
NO rescheduling fixes
NO Product Decision approval
NO Implementation Authorization
NO UAT execution
NO acceptance
NO Package 1 reopening
NO Phase 3I reopening
NO Slice 14
NO Phase 3J
```

---

## 22. Recommendation

### Facts

- PD-OTPREP-01…05 AC-01…18 are met in repository.
- Catalog shows **actual** ScheduleDates (UAT examples like 02/07/08 Apr align with model).
- Explicit Load is correct per PD-OTPREP-04.
- Reopen unlocks OTPrepared → Confirmed; date edit is not direct while locked.
- OT Prep Print uses SPA `window.print()`, unlike Finalization slip print — strong explanation for “Print not working”.

### Recommended direction (non-binding)

1. Continue Manual UAT against AC-01…18 and document Print/reschedule as **out-of-AC** observations.
2. If Product Owner wants Today/Tomorrow labels only on real dates → bounded UX remediation (no horizon).
3. If Product Owner wants auto-load → **reopen PD-OTPREP-04** first.
4. Prepared-list scannability using existing fields → bounded UX auth (not a new worklist).
5. Print → separate defect/product auth; do not fold into silent discoverability “fix”.
6. Reschedule entry → clarify Reopen → Finalize edit path; PD-OTPREP-10 implementation only if Upsert lock enforcement needed.

### Requires Product Decision

- Auto-load / hybrid Load  
- Invented rolling horizons  
- “Next week” as a date **range** control  
- Certified OT list Print specification  

### Requires separate implementation authorization

- Any of the above once decided  
- PD-OTPREP-10 enforcement  
- Print remediation  
- Bounded prepared-list / relative-label polish (even if under existing PD text — still needs explicit remediation auth to avoid scope creep)

---

## 23. UAT readiness assessment

**READY WITH OBSERVATIONS**

| Meaning | |
|---------|--|
| Discoverability ACs | Met — UAT of 01…05 can proceed / continue |
| Blocking for **discoverability acceptance**? | No AC failure found |
| Blocking for **operational happiness**? | Print (F), prepared-list density (B), Load expectation (D if auto-load desired), reschedule entry (E/I) |
| Not the same as acceptance | **Acceptance remains NOT RECORDED** |

**Q13:** No AC-level defects found in PD-OTPREP-01…05 SoT/catalog/Load/stale/wording. Print is a separate functional gap.  
**Q14:** Ready for continued UAT / readiness-with-observations; **not** automatic acceptance. Remediate Print only under separate authorization if acceptance depends on Print.

---

## 24. Next governance gate

```text
CONTINUE MANUAL UAT (discoverability)
        ↓
Product Owner triage of F-01…F-08
        ↓
IF needed: Product Decision (auto-load / horizon / Print / Next-week semantics)
        ↓
IF needed: bounded Implementation Authorization (UX polish / Print / PD-10)
        ↓
Remediation + tests
        ↓
UAT re-check
        ↓
Acceptance recording (explicit)
```

Do not collapse gates. Do not treat this audit as Implementation Authorization.

---

## 25. Answers to required questions (Q1–Q14)

| Q | Answer |
|---|--------|
| **Q1** | Prefer actual ScheduleDates; relative labels (Today/Tomorrow/…) on those dates are compatible; do not invent dates. |
| **Q2** | Yes — inventing empty days in a rolling horizon violates approved PD-OTPREP-01/02. |
| **Q3** | Yes — under current PD-OTPREP-04 Option B. |
| **Q4** | Auto-load preference = **new Product Decision** (reopen PD-04), not a silent UX tweak. Clarity copy = within existing decision. |
| **Q5** | At minimum existing: SequenceNo, name, UHID, procedure, eye, StartTime, theatre; optionally surgeon, status, PreparedAt — all already authoritative. |
| **Q6** | No — not while OTPrepared under GuardLocked. |
| **Q7** | Reopen unlocks; certified edit path is Finalize/modal after Reopen — not a dedicated OT Prep date editor. |
| **Q8** | Yes — separate Implementation Authorization for PD-OTPREP-10 enforcement / Upsert alignment. |
| **Q9** | OT Prep Print calls `window.print()` on the SPA, not a dedicated OT list/slip document. |
| **Q10** | Primarily **existing incomplete capability / functional defect (F)**; not an AC regression of 01…05. |
| **Q11** | Copy tightening, hierarchy emphasis, reduce instructional tone; limited density polish. |
| **Q12** | Auto-load, reschedule CTAs, invented horizons, new Print workflow, new worklist layout. |
| **Q13** | No AC defects in authorized discoverability scope; Print + density are adjacent findings. |
| **Q14** | **READY WITH OBSERVATIONS** — not automatic acceptance. |

---

## Product-decision coverage matrix (proposed changes)

| Proposed change | Existing decision covers it? | New PD required? | Separate FSM gate? | Implementation auth required? |
|-----------------|------------------------------|------------------|--------------------|-------------------------------|
| Relative date labels on actual dates | PD-OTPREP-01/02/05 (presentation) | Optional if ambiguous | No | Yes (bounded remediation) |
| Rolling future horizon inventing days | **Conflicts** with 01/02 | **Yes** | No | Yes after PD |
| Date catalog layout polish | 01/02 presentation | No | No | Yes if changing UI |
| Auto-load | **Conflicts** with PD-04 B | **Yes** (reopen) | No | Yes after PD |
| Keep explicit Load | PD-04 B | No | No | N/A (already done) |
| Prepared-row redesign (existing fields) | 03/05 presentation | Maybe if “new grid paradigm” | No | Yes |
| Surgery-date editing while OTPrepared | GuardLocked / PD-10 | No new if keep Reopen-first | PD-10 impl | Yes (PD-10) |
| Reopen & Edit CTA | UX only | Optional | No | Yes |
| Print fix / certified list print | Not in 01…05 | Likely for certified Print | No | **Yes** |
| Wording refinement | PD-05 | No | No | Yes |
| Visual redesign beyond polish | Design-system freeze | **Yes** if new language | No | Yes |
| Responsive layout tweaks | Healthcare UX | No if within tokens | No | Yes |

---

```
AUDIT: COMPLETE
PRODUCTION CHANGES: NONE
IMPLEMENTATION: NONE
AUTOMATED TEST CHANGES: NONE
MANUAL UAT: NOT EXECUTED BY THIS AUDIT
ACCEPTANCE: NOT RECORDED

NEXT GATE:
Product Decision / bounded remediation authorization as determined by the audit.

STOP.
```
