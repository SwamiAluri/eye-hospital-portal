# Finalize Surgery + OT Preparation
# Product Decision — Surgery-Date Discoverability & Operational Clarity

| Field | Value |
|-------|--------|
| **Document type** | **PRODUCT OWNER DECISION RECORDING — GOVERNANCE ONLY** |
| **Decision family** | **PD-OTPREP-01 … PD-OTPREP-10** |
| **Date prepared** | 2026-09-23 |
| **Date decision-recording session** | 2026-09-23 |
| **Program** | Hospital Portal — Finalize Surgery / OT Preparation |
| **Mode** | Formal Product Owner decision recording |
| **Product Decision Status** | **RECORDED — see §7 register** |
| **Implementation Authorized** | **PARTIAL** — Discoverability package (PD-OTPREP-01…05) authorized separately; PD-OTPREP-06…10 still **NOT** authorized for implementation |
| **Package 1 Manual UAT** | **IN PROGRESS** (unchanged by this artifact) |
| **Package 1 Acceptance** | **NOT RECORDED** |
| **Production code / API / DB / permissions / routes / FSM / ownership modified** | **NO** |

---

## 1. Metadata

| Item | Value |
|------|--------|
| Artifact path | `docs/product-decisions/finalize-surgery-ot-preparation-operational-model-product-decision.md` |
| Artifact disposition | **RECONCILED** — created 2026-09-23; re-validated against same Product Decision prompt (no duplicate; no decision changes on re-submission) |
| Related (do not replace) | `docs/product-decisions/finalize-surgery-ot-preparation-product-decision.md` (**PD-FS-01 … PD-FS-13**) |
| Related (do not replace) | `docs/product-decisions/finalize-surgery-ot-preparation-implementation-authorization.md` (Package 1 — already completed) |
| Authorizes | **Nothing** — governance recording only |
| Does not authorize | Implementation, UX build, API/DB/permission/route/FSM/ownership change |
| Does not create | Slice 14, Phase 3J, Package 2, new OT worklist/entity |
| Does not reopen | Phase 3I, Slice 13, C-01 Waiting List |
| Product Owner name | **Decision recorded — name not supplied** |

### Recording integrity rule

| Rule | Application |
|------|-------------|
| Record explicit selections for this session | **YES — applied** |
| Infer DECIDED from audit-only recommendations without this recording session | **FORBIDDEN** |
| Mark DECIDED without named option | **FORBIDDEN** |
| Silently invent SequenceNo continuation formula | **FORBIDDEN** |
| Silently accept past-date policy without explicit PO choice | **FORBIDDEN** (PD-OTPREP-07) |
| Implementation from PD approval alone | **FORBIDDEN** — separate Implementation Authorization required |

### Decision vs Package 1 vs UAT vs acceptance

| Layer | Status |
|-------|--------|
| Package 1 implementation | **COMPLETE** (prior authorization) |
| Package 1 Manual UAT | **IN PROGRESS** |
| Package 1 Acceptance | **NOT RECORDED** |
| Operational-model audit | **COMPLETE** — see §3 |
| This Product Decision family (PD-OTPREP-01…10) | **RECORDED** — see §7 |
| Implementation Authorization for discoverability package | **YES** — `finalize-surgery-ot-preparation-discoverability-implementation-authorization.md` (PD-OTPREP-01…05 only) |
| Discoverability implementation | **NOT STARTED** |
| Acceptance of discoverability behavior | **NOT RECORDED** (behavior not implemented) |

**Do not mark Package 1 PASS, ACCEPTED, or CLOSED solely because this Product Decision is recorded.**

Governance sequence remains:

```text
PRODUCT DECISION (this artifact)
  → separate bounded IMPLEMENTATION AUTHORIZATION
  → IMPLEMENTATION
  → AUTOMATED TESTS
  → MANUAL UAT
  → ACCEPTANCE
```

These stages must not be collapsed.

---

## 2. Trigger

| Item | Value |
|------|--------|
| Trigger type | Package 1 Manual UAT observation |
| Domain | OT Preparation discoverability / operational clarity |
| Nature | Operators may miss Finalised cases scheduled for tomorrow / +2 / next week because UI defaults to “today” and requires knowing which surgery date to select |
| Not a SoT defect | Core Prepare / Load OT List date model is **correct** (surgery `StartTime` day) |

---

## 3. Audit reference

| Item | Value |
|------|--------|
| Authoritative audit | `docs/audits/finalize-surgery-ot-preparation-operational-model-audit.md` |
| Audit date | 2026-09-23 |
| Audit type | AUDIT ONLY — no implementation |
| Prior comprehensive audit (context) | `docs/audits/finalize-surgery-ot-preparation-comprehensive-audit.md` |
| Parent Product Decision (FSM / ownership / Package 1 PD-FS) | `docs/product-decisions/finalize-surgery-ot-preparation-product-decision.md` |

Audit findings treated as authoritative for this recording (unless marked pending verification in that audit):

- Authoritative OT Preparation date = `StartTime` → surgery calendar day → `ScheduleDate`
- No `FinalisedAt` on `ot_finalize_schedule`
- Prepare / GetOtList / FE prepare scope already date-scoped to surgery date
- Primary gap = **discoverability / operational clarity**, not date SoT
- Late-add technically possible at app layer; UX/SequenceNo policy undefined
- `ux_ot_finalize_prepared_date` live presence **UNKNOWN**
- OTPrepared StartTime change via Upsert vs GuardLocked = FSM asymmetry

---

## 4. Current governance baseline

| Area | Status |
|------|--------|
| Phase 3I | **CLOSED** |
| Slice 13 | **CLOSED** |
| Slice 14 | **DOES NOT EXIST** |
| Phase 3J | **NOT CREATED** |
| C-01 Waiting List | **ACCEPTED + CLOSED** |
| Finalize Surgery + OT Preparation Product Decision (PD-FS-01…13) | **APPROVED / RECORDED** |
| Package 1 Implementation Authorization | **COMPLETED** |
| Package 1 Implementation | **COMPLETE** |
| Package 1 Manual UAT | **IN PROGRESS** |
| Package 1 Acceptance | **NOT RECORDED** |
| This discoverability Product Decision | **RECORDED** (this artifact) |
| Discoverability Implementation Authorization | **YES** — see `finalize-surgery-ot-preparation-discoverability-implementation-authorization.md` (PD-OTPREP-01…05 only; implementation not started) |

### Existing OT Preparation business model (locked — unchanged by this artifact)

1. Finalize Surgery and OT Preparation are shared operational surfaces.
2. No `CounselorId` ownership.
3. No My Finalize.
4. No My OT Preparation.
5. No Assign / Reassign / ReQueue for OT Preparation.
6. No Supervisor ownership.
7. No `OTPreparationOwnerId`.
8. OT Preparation is one logical operational list per branch/date (**PD-FS-11**).
9. Persistence remains row-based.
10. `SequenceNo` represents operational ordering.
11. OTPrepared rows are locked according to the existing FSM.
12. Load OT List is date-scoped.
13. Prepare is date-scoped.
14. Existing FSM must not be changed without a separate explicit state-machine Product Decision.

---

## 5. Verified OT Preparation date model (LOCKED)

**DO NOT change the OT Preparation date model.**

| Concept | Authoritative definition |
|---------|--------------------------|
| **OT Preparation date** | Calendar day of `ot_finalize_schedule.start_time` (`StartTime`) → API `ScheduleDate` |
| **Finalisation date** | **Not** a first-class field; **never** the OT Preparation grouping key |
| **Prepared event time** | `PreparedAt` — prepare metadata only; not the list date key |

**Example (verified):**

| Event | Calendar day |
|-------|----------------|
| Finalised | 23 Sep |
| Surgery (`StartTime`) | 25 Sep |
| OT Preparation list | **25 Sep** |

Already enforced by:

- `PrepareOtListAsync`
- `GetOtListAsync`
- FE `selectFinalisedForPrepareDate` / `scheduleDate`
- `ScheduleDate` derived from `StartTime`

**Forbidden by this Product Decision family:**

- Introducing `FinalisedAt`
- Creating a Finalised-today worklist
- Changing Prepare / GetOtList date semantics
- Treating Finalisation day as OT Preparation day

---

## 6. Problem statement

The date **source of truth is correct**. The operational gap is **discoverability and clarity**:

| Finding | Impact |
|---------|--------|
| OT Preparation defaults to today’s UTC date | Operators may open the wrong day relative to local hospital day and relative to future surgery dates |
| Manual native date picker only | Future Finalised surgeries are hidden unless the operator knows the surgery date |
| No surgery-date catalog | Tomorrow / +2 / next week cases are correctly scoped by backend but not conveniently discoverable |
| Single “no prepared list” empty state | Can imply “no Finalised surgeries” when Finalised cases still exist for that date |
| Prepared vs ready dates unclear | Operators cannot easily see which dates need Prepare vs already OTPrepared |
| Late-add wording unclear | Second Prepare for same date is technically possible; UX does not state append semantics |
| Explicit Load on date change | Stale list / empty panel after date change without Load |
| Subtitle source mismatch | OT Prep subtitle can use Finalization `filters.date` context instead of `otListDate` |

Audit classification of primary discoverability gaps: **bounded UX**, with API/query only if loaded Finalize data proves insufficient.

---

## 7. Product Decision register

### Summary

| ID | Topic | Selected | Status | Implementation authorization |
|----|-------|----------|--------|------------------------------|
| **PD-OTPREP-01** | Surgery-date discoverability | **A** | **DECIDED** | **AUTHORIZED** — discoverability Implementation Authorization (not started) |
| **PD-OTPREP-02** | Date selection / navigation | **A** | **DECIDED** | **AUTHORIZED** — discoverability Implementation Authorization (not started) |
| **PD-OTPREP-03** | Prepared vs ready / empty-state honesty | **A** | **DECIDED** | **AUTHORIZED** — discoverability Implementation Authorization (not started) |
| **PD-OTPREP-04** | Date-change / Load behavior | **B** *(historical)* · **SUPERSEDED by PD-OTPREP-UAT-03** | **SUPERSEDED** | Remediation auth **NONE** until separate Implementation Authorization |
| **PD-OTPREP-05** | Contextual wording | **A** | **DECIDED** | **AUTHORIZED** — discoverability Implementation Authorization (not started) |
| **PD-OTPREP-06** | Late-add + SequenceNo | **A** (append) · SequenceNo rule **PENDING** | **PARTIALLY DECIDED** | **NONE** — not part of discoverability-only package without SequenceNo rule |
| **PD-OTPREP-07** | Past-date preparation | — | **PENDING PRODUCT OWNER SELECTION** | **NONE** |
| **PD-OTPREP-08** | Timezone / hospital-local day | **C** | **DECIDED** | **NONE** — no TZ change until defect |
| **PD-OTPREP-09** | `ux_ot_finalize_prepared_date` | **C** | **DECIDED** | **NONE** — no schema change; aligns with **PD-FS-12** |
| **PD-OTPREP-10** | OTPrepared StartTime via Upsert vs GuardLocked | **A** | **DECIDED (FSM direction)** | **NONE** — **not** in discoverability package; separate FSM Implementation Authorization required |

---

### PD-OTPREP-01 — Surgery-date discoverability

**Options**

| Option | Description |
|--------|-------------|
| **A** | Use existing Finalize / OT-related loaded data to expose distinct `ScheduleDate` values (e.g. dates with ready Finalised counts). No new OT list entity. No new operational worklist. |
| **B** | Add a dedicated API for dates with eligible Finalised cases — only if existing loaded data is technically insufficient. |
| **C** | Keep manual date picker only — no additional discoverability. |

| Field | Value |
|-------|--------|
| **Selected decision** | **OPTION A** |
| **Status** | **DECIDED** |
| **Rationale** | Smallest change that exposes the already-correct StartTime SoT; avoids new worklist/entity; avoids premature API unless loaded data is proven insufficient |
| **Evidence source** | Operational-model audit §§9–10, §14 G4/G5; FE finalize list already carries `scheduleDate` |
| **Implementation authorization status** | **NONE** |

---

### PD-OTPREP-02 — Date selection / navigation model

**Options**

| Option | Description |
|--------|-------------|
| **A** | Surgery-date catalog / selectable dates where Finalised (and related OT) cases exist |
| **B** | Upcoming-date list with counts (same data, list presentation) |
| **C** | Full calendar navigator |
| **D** | Keep unrestricted manual date picker only |

| Field | Value |
|-------|--------|
| **Selected decision** | **OPTION A** |
| **Status** | **DECIDED** |
| **Rationale** | Companion to PD-OTPREP-01 A: operators select from dates present in authoritative schedule data. Counts may appear on catalog entries as display of existing row status — not a separate worklist. **Do not invent** an arbitrary 7/30/60/90-day horizon; dates come from existing data only. Calendar (C) rejected as heavier than needed. Manual-only (D) rejected as preserving the UAT gap. |
| **Evidence source** | Operational-model audit §10; PD-OTPREP-01 |
| **Implementation authorization status** | **NONE** |
| **Note** | Option B (upcoming list with counts) is **not** selected as the primary navigation model; counts on catalog rows under A remain allowed as presentation of existing data. |

---

### PD-OTPREP-03 — Prepared vs ready / empty-state honesty

**Options**

| Option | Description |
|--------|-------------|
| **A** | Explicitly distinguish: Ready for OT Preparation · OT list already prepared · No eligible surgeries for selected date |
| **B** | Keep current single prepared-list empty state |

| Field | Value |
|-------|--------|
| **Selected decision** | **OPTION A** |
| **Status** | **DECIDED** |
| **Rationale** | UI must not imply “No prepared list” == “No Finalised surgeries.” Distinctions use **existing** status fields (`Finalised` / `OTPrepared` / absence) — no new FSM statuses |
| **Evidence source** | Operational-model audit §§11, 13–14 |
| **Implementation authorization status** | **NONE** |

---

### PD-OTPREP-04 — Date-change / Load behavior

**Options**

| Option | Description |
|--------|-------------|
| **A** | Selecting a surgery date automatically loads that date’s OTPrepared list |
| **B** | Selecting a date updates context; operator explicitly clicks Load OT List |
| **C** | Hybrid: discovered date selection auto-loads; arbitrary/manual date still requires explicit Load |

| Field | Value |
|-------|--------|
| **Selected decision** | **OPTION B** *(historical)* |
| **Status** | **SUPERSEDED** for Load interaction by **PD-OTPREP-UAT-03** (`finalize-surgery-ot-preparation-uat-remediation-product-decision.md`) — auto-load **existing** OTPrepared rows on date selection (READ/LOAD only; no auto-Prepare) |
| **Rationale (original)** | Current application interaction model uses explicit **Load OT List**. Selecting B **minimizes behavioral change** while discoverability (PD-OTPREP-01/02) and empty-state honesty (PD-OTPREP-03) address the UAT gap. Option C deferred unless a later Implementation Authorization revisits interaction model fit. |
| **Evidence source** | Operational-model audit §4 (explicit Load); prompt guidance to prefer B when C does not clearly fit; **UAT remediation PD 2026-09-23** |
| **Implementation authorization status** | Historical discoverability Package used Option B. Remediation to UAT-03 requires **separate** Implementation Authorization (not this artifact). |
| **Clarity requirement (non-FSM)** | Date change must not leave **misleading** stale prepared rows without operator awareness — honesty may include clearing or labeling stale context **without** changing to auto-Load (details belong in Implementation Authorization) |

---

### PD-OTPREP-05 — OT Preparation contextual wording

**Options**

| Option | Description |
|--------|-------------|
| **A** | All OT Preparation wording explicitly surgery-date based (e.g. “OT Preparation — Surgery Date: 25 Sep”); correct subtitle to use `otListDate` / surgery-date context |
| **B** | Keep existing wording |

| Field | Value |
|-------|--------|
| **Selected decision** | **OPTION A** |
| **Status** | **DECIDED** |
| **Rationale** | Prevents operators from reading Finalisation day as Prep day; fixes known subtitle source mismatch (`finalisedForDate` vs `otListDate`) |
| **Evidence source** | Operational-model audit §4 subtitle finding; §13 UX gaps |
| **Implementation authorization status** | **NONE** |

---

### PD-OTPREP-06 — Late finalisation after prepared list

**Scenario:** Sep 25 list already prepared; a new Sep 25 patient is Finalised afterward.  
**Current service capability:** Additional Finalised rows can be prepared for the same date (slot collision / validation apply).

**Options**

| Option | Description |
|--------|-------------|
| **A** | Explicitly support “Add to prepared list”: existing OTPrepared remain locked; new Finalised may be appended; UI communicates append; **SequenceNo continuation policy must be defined** |
| **B** | Once a date is prepared, no additional patients without separate reopen/reset workflow |
| **C** | Keep current technical behavior; do not expose special append semantics |

| Field | Value |
|-------|--------|
| **Selected decision (append semantics)** | **OPTION A** |
| **Status** | **PARTIALLY DECIDED** |
| **Rationale** | Matches existing service capability and day-of operational reality; Option B would be a behavior restriction requiring stronger FSM/ops justification; Option C leaves the UAT clarity gap |
| **SequenceNo continuation** | **PENDING EXPLICIT PRODUCT OWNER RULE — DO NOT INVENT** |
| **Until SequenceNo rule is recorded** | Preserve current client-supplied `SequenceNo` semantics (**Regression invariant 11**). Append UX may be authorized only after SequenceNo rule is decided **or** Implementation Authorization explicitly scopes append UI to “operator-assigned sequence” without claiming auto-continuation |
| **Evidence source** | Operational-model audit §§6 F/G, 11–12; `PrepareOtListAsync` |
| **Implementation authorization status** | **NONE** — late-add package is **out of scope** for a discoverability-only Implementation Authorization until SequenceNo rule is closed or explicitly scoped |

---

### PD-OTPREP-07 — Past-date preparation policy

**Options**

| Option | Description |
|--------|-------------|
| **A** | Past dates may still be prepared if eligible |
| **B** | Past dates are read-only / historical Load only |
| **C** | Restrict based on configurable operational window |

| Field | Value |
|-------|--------|
| **Selected decision** | **NONE — PENDING PRODUCT OWNER SELECTION** |
| **Status** | **PENDING PRODUCT OWNER SELECTION** |
| **Rationale** | Prompt forbids silently accepting a default. Current code allows past-date Prepare (no min on date picker). Policy must be explicit before any restriction or affirmation is implemented |
| **Evidence source** | Operational-model audit Scenario K |
| **Implementation authorization status** | **NONE** — **do not implement** past-date restriction or affirmation from this artifact alone |

---

### PD-OTPREP-08 — Timezone / hospital-local surgery-day policy

**Options**

| Option | Description |
|--------|-------------|
| **A** | Surgery calendar day follows hospital-local timezone |
| **B** | Continue UTC calendar-day semantics |
| **C** | Defer until a concrete UAT defect demonstrates a wrong-day issue |

| Field | Value |
|-------|--------|
| **Selected decision** | **OPTION C** |
| **Status** | **DECIDED** |
| **Rationale** | Repo shows UTC/local considerations (FE `toISOString` default; SQL `AT TIME ZONE 'UTC'`; CLR `.Date`). Changing TZ without a reproducible wrong-day defect risks financial/clinical date drift. Defer. |
| **Evidence source** | Operational-model audit §8 |
| **Implementation authorization status** | **NONE** — **no timezone behavior change** under this family until defect + separate authorization |

---

### PD-OTPREP-09 — Live `ux_ot_finalize_prepared_date` verification and disposition

**Repository SQL declares** unique partial index `ux_ot_finalize_prepared_date` on `(DATE(start_time AT TIME ZONE 'UTC'), tenant_id)` where `status = 'OTPrepared' AND deleted_at IS NULL`.  
EF model does not confirm it. Live presence **UNKNOWN**. If live, conflicts with multi-patient same-date Prepare (**PD-FS-11** / multi-patient Prepare preserve).

**Options**

| Option | Description |
|--------|-------------|
| **A** | Verify live and retain if intentional |
| **B** | Verify live and remove/alter if conflicting |
| **C** | Defer until environment verification is available |

| Field | Value |
|-------|--------|
| **Selected decision** | **OPTION C** |
| **Status** | **DECIDED** |
| **Rationale** | Aligns with **PD-FS-12 Option C**. Schema must not be modified by this Product Decision. Multi-patient Prepare service behavior remains unchanged until verification + separate DB authorization |
| **Evidence source** | Operational-model audit §7; `OT_FINALIZE_SCHEDULE_MIGRATION.sql`; PD-FS-12 |
| **Implementation authorization status** | **NONE** — **no schema change** |
| **Technical verification** | **PENDING — LIVE DATABASE** (same gate family as FS-G-13 / PD-FS-12) |

---

### PD-OTPREP-10 — OTPrepared StartTime change via Upsert vs GuardLocked

**Current audit finding:** GuardLocked paths block StartTime changes on OTPrepared; counsellor Upsert can change StartTime and reset to NotConfirmed / unlocked.

**Options**

| Option | Description |
|--------|-------------|
| **A** | Require Reopen before any OTPrepared schedule-date change |
| **B** | Explicitly allow Upsert to reset OTPrepared to NotConfirmed |
| **C** | Define a dedicated state-machine transition |

| Field | Value |
|-------|--------|
| **Selected decision** | **OPTION A** |
| **Status** | **DECIDED (direction) — FSM GOVERNANCE** |
| **Rationale** | Aligns locked OTPrepared with Reopen recovery path (**PD-FS-05/06** family). Upsert bypass is asymmetry, not certified “date move” UX. Subject to verification against certified counselling scheduling workflow before Implementation Authorization |
| **Evidence source** | Operational-model audit Scenario P / §12 |
| **Implementation authorization status** | **NONE** |
| **Package boundary** | **EXPLICITLY OUT OF SCOPE** for any future surgery-date discoverability Implementation Authorization. Requires **separate FSM / counselling-scheduling Implementation Authorization** after workflow verification |

---

## 8. Decision rationale (cross-cutting)

| Principle | Application |
|-----------|-------------|
| Preserve date SoT | All PD-OTPREP decisions assume StartTime/`ScheduleDate` remains authoritative |
| Prefer UI honesty over new domain objects | Catalog from existing data; no OT list entity; no ownership |
| Minimize interaction-model churn | Explicit Load retained (PD-OTPREP-04 B) |
| Do not invent SequenceNo math | PD-OTPREP-06 partial |
| Do not silently set past-date policy | PD-OTPREP-07 pending |
| Do not change TZ/schema/FSM in discoverability work | PD-OTPREP-08/09/10 deferred or separate package |

---

## 9. Explicitly deferred / out of scope

### Deferred pending further Product Owner / technical gates

| Item | Gate |
|------|------|
| PD-OTPREP-07 past-date policy selection | Explicit PO option A/B/C |
| PD-OTPREP-06 SequenceNo continuation formula | Explicit PO rule |
| PD-OTPREP-08 timezone change | Reproducible UAT wrong-day defect + separate authorization |
| PD-OTPREP-09 index drop/retain/alter | Live DB verification + separate schema authorization |
| PD-OTPREP-10 Upsert/GuardLocked enforcement | Separate FSM Implementation Authorization + counselling workflow verification |
| Dedicated dates API (PD-OTPREP-01 B) | Only if loaded data proven insufficient during a future Implementation Authorization |

### Explicitly NOT authorized by this artifact

- Phase 3I reopening · Slice 14 · Phase 3J
- Counsellor ownership / `CounselorId` / My Finalize / My OT Preparation
- Assign / Reassign / ReQueue · Supervisor · `OTPreparationOwnerId`
- New OT worklist / entity · new OT lifecycle states
- New FSM transitions except as separately authorized under PD-OTPREP-10 path
- `FinalisedAt` field · changing StartTime date-scoping · changing Prepare/GetOtList SoT
- C-01 changes · Phase2X · financial/insurance/clinical/payment blockers
- New authorization / permission model
- Schema changes before live verification

---

## 10. Implementation authorization boundary

| Statement | Status |
|-----------|--------|
| This Product Decision artifact alone authorizes implementation | **NO** |
| Discoverability Implementation Authorization (separate artifact) | **YES** — `docs/product-decisions/finalize-surgery-ot-preparation-discoverability-implementation-authorization.md` |
| Scope of that authorization | **PD-OTPREP-01 … PD-OTPREP-05 only** |
| Implementation performed under that authorization | **NOT STARTED** |
| PD-OTPREP-06…10 implementation | **NOT AUTHORIZED** |
| Next gate | **Bounded implementation** under the discoverability Implementation Authorization |

### Package split (updated)

| Package | PD items | Status |
|---------|----------|--------|
| Discoverability / clarity | 01, 02, 03, 04, 05 | **Implementation Authorized** — not started |
| Late-add | 06 after SequenceNo rule | Not authorized |
| FSM Upsert lock alignment | 10 only | Not authorized |
| Schema index disposition | 09 after live verify | Not authorized |

**No implementation is authorized by this Product Decision artifact alone.** Discoverability work requires the separate Implementation Authorization (now recorded) and a separate implementation task.

---

## 11. UAT implications

| Item | Status / instruction |
|------|----------------------|
| Package 1 Manual UAT | Remains **IN PROGRESS** |
| Package 1 PASS / ACCEPTED / CLOSED | **Must not** be asserted from this recording |
| Traceability | UAT observation → operational-model audit → this PD family → discoverability Implementation Authorization → (future) implementation |
| Distinguish | Package 1 **already implemented** behavior · UAT observation · this operational-model PD · discoverability Implementation Authorization · future implementation |
| Future Manual UAT (after implementation) | Must re-cover surgery-date catalog discoverability (tomorrow/+2/next week), empty-state honesty, wording, Load behavior; plus any later-authorized late-add / past-date / TZ / FSM scenarios |

---

## 12. Regression invariants (LOCKED)

1. `StartTime` / `ScheduleDate` remains OT Preparation date SoT.
2. Finalisation date is never used as OT Preparation date.
3. No `FinalisedAt` field is introduced.
4. Prepare remains date-scoped.
5. Load OT List remains date-scoped.
6. OT Preparation remains shared.
7. No `CounselorId` ownership.
8. No My OT Preparation.
9. No new OT worklist / entity.
10. Existing FSM remains unchanged unless separately approved (PD-OTPREP-10 path is **not** an Implementation Authorization).
11. Existing `SequenceNo` semantics are preserved until an explicit late-add SequenceNo decision is made.
12. Existing branch / tenant authorization remains unchanged.
13. Existing permissions remain unchanged.
14. Existing Package 1 certified behavior remains preserved.

---

## 13. Sign-off section

| Role | Action | Status |
|------|--------|--------|
| Product Owner | Decision recording for PD-OTPREP-01…10 | **RECORDED 2026-09-23 — name not supplied** |
| Product Owner | PD-OTPREP-07 past-date selection | **STILL REQUIRED** |
| Product Owner | PD-OTPREP-06 SequenceNo continuation rule | **STILL REQUIRED** before late-add Implementation Authorization |
| Engineering / Platform | Live `ux_ot_finalize_prepared_date` verification | **PENDING** (PD-OTPREP-09 / PD-FS-12) |
| Implementation Authorization author | Create bounded auth if build desired | **NOT STARTED** |
| UAT | Package 1 | **IN PROGRESS** |
| Acceptance | Package 1 / discoverability | **NOT RECORDED** |

---

## 14. Control flags

```text
GOVERNANCE ONLY: YES
PRODUCT DECISION RECORDED: YES (with PENDING items noted)
IMPLEMENTATION AUTHORIZATION: NONE
PRODUCTION CODE CHANGES: NONE
API CHANGES: NONE
DB CHANGES: NONE
PERMISSION CHANGES: NONE
ROUTE CHANGES: NONE
FSM CHANGES: NONE
OWNERSHIP CHANGES: NONE
PACKAGE 1 UAT STATUS: IN PROGRESS (unchanged)
PACKAGE 1 ACCEPTANCE: NOT RECORDED
DISCOVERABILITY ACCEPTANCE: NOT RECORDED
SLICE 14: DOES NOT EXIST
PHASE 3J: NOT CREATED
```

**No implementation is authorized by this Product Decision artifact.**

**STOP.** Do not implement UI, surgery-date catalog, date picker, Load behavior, SequenceNo, DB index, OTPrepared rescheduling, unimplemented-behavior tests, Package 2, Slice 14, or Phase 3J from this recording alone.

---

## Appendix A — Mapping to operational-model audit classifications

| Audit gap / scenario | PD |
|----------------------|-----|
| Discoverability G4/G5 / Scenarios B–D, L | PD-OTPREP-01, 02 |
| Empty / prepared vs ready | PD-OTPREP-03 |
| Load / date change | PD-OTPREP-04 |
| Wording / subtitle | PD-OTPREP-05 |
| Late-add F/G | PD-OTPREP-06 |
| Past date K | PD-OTPREP-07 |
| Timezone §8 | PD-OTPREP-08 |
| `ux_ot_finalize_prepared_date` / PD-FS-12 | PD-OTPREP-09 |
| Scenario P Upsert vs GuardLocked | PD-OTPREP-10 |
