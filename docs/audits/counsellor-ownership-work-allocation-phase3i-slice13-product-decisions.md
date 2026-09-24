# Phase 3I Slice 13 — Counsellor Ownership + UX Continuity  
# PRODUCT DECISION RECORD

| Field | Value |
|-------|--------|
| **Document date** | 2026-09-21 |
| **Acceptance date** | 2026-09-21 |
| **Mode** | **PRODUCT DECISION ACCEPTANCE** — no production code, API, DB, migration, permission, ownership, UI, formula, route, or test changes in this task |
| **Source readiness audit** | `docs/audits/counsellor-ownership-work-allocation-phase3i-slice13-readiness-audit.md` (Sections **1–35** — ownership readiness + UX Continuity Reconciliation) |
| **Prior certified gates** | Phase 3I Slice 12 **COMPLETE / DELIVERY ACCEPTED** (`phase3i-slice12-acceptance.md`); PD-S12-01…19 **ACCEPTED**; Phase 3H Hybrid E / PD-WL / PD-FOLLOWUP / PD16 / PD-POST-01 context; Slices 1–11 certified behaviors |
| **Convention** | Under `docs/audits/` to match Phase 3H / Phase 3I records |
| **Document status** | **ACCEPTED** |
| **Product Decision Review** | **COMPLETE** |
| **Product acceptance** | **ACCEPTED** |
| **Final Slice 13 scope selection** | **PACKAGE B — RR + COUNSELLOR NAVIGATION** |

| Change gate (this task) | Value |
|-------------------------|--------|
| Production code changed | **NO** |
| API changed | **NO** |
| DB / schema changed | **NO** |
| Permission changed | **NO** |
| UI / routes / components changed | **NO** |
| Tests changed | **NO** |
| Existing Slice 13 readiness audit changed | **NO** |
| Slice 12 artifacts changed | **NO** |
| Implementation started | **NO** |
| Slice 13 implementation | **NOT STARTED** |

---

## 1. Status

| Metric | Status |
|--------|--------|
| Slice 12 | **COMPLETE / DELIVERY ACCEPTED** — **do not reopen** |
| Slice 13 readiness audit (ownership) | **COMPLETE** |
| Slice 13 UX Continuity Reconciliation | **COMPLETE** |
| Slice 13 Product Decision Record | **ACCEPTED** |
| Formal Product Owner acceptance | **ACCEPTED** |
| Approved Slice 13 scope | **PACKAGE B — RR + COUNSELLOR NAVIGATION** |
| Implementation (this task) | **NOT STARTED** / **NOT AUTHORIZED BY THIS ACCEPTANCE ALONE** |
| Automated tests (Slice 13 implementation) | **NOT STARTED** |
| Manual UAT | **NOT STARTED** |
| Delivery Acceptance | **NOT STARTED** |
| Slice 13 production delivery | **NOT STARTED** |

### Gate summary

```text
SLICE 12                  ✅ COMPLETE / DELIVERY ACCEPTED
SLICE 13 AUDIT            ✅ COMPLETE
UX CONTINUITY             ✅ COMPLETE
PRODUCT DECISION REVIEW   ✅ COMPLETE
PRODUCT OWNER ACCEPTANCE  ✅ ACCEPTED — PACKAGE B
IMPLEMENTATION            ❌ NOT STARTED (separate prompt required)
AUTOMATED TESTS           ❌ NOT STARTED FOR SLICE 13 IMPLEMENTATION
MANUAL UAT                ❌ NOT STARTED
DELIVERY ACCEPTANCE       ❌ NOT STARTED
```

### Acceptance vs implementation (mandatory distinction)

> **Product Owner acceptance authorizes Package B as the bounded implementation scope for Slice 13. This acceptance does not itself implement any production changes. A separate implementation prompt and implementation gate are required.**

| Concept | Status |
|---------|--------|
| **PRODUCT DECISION ACCEPTANCE** | **ACCEPTED** |
| **IMPLEMENTATION AUTHORIZATION** | **NOT GRANTED IN THIS TASK** — requires separate explicit implementation prompt |

### Purpose of this record

Answer:

> What bounded work should be authorized as the next Counsellor ownership / work-allocation / UX slice after Slice 12?

**Accepted answer:** **PACKAGE B — RR + COUNSELLOR NAVIGATION**, consisting of implementation decisions **PD-S13-A = C**, **PD-S13-B = B**, and **PD-S13-D = C** only.

---

## 2. Decision taxonomy (mandatory)

Every item below is classified as one of:

| Classification | Meaning |
|----------------|---------|
| **ACCEPTED / CERTIFIED** | Locked; not open for redesign in Slice 13 |
| **PROPOSED — PRODUCT DECISION REQUIRED** | Options presented; Product Owner must choose |
| **DEFERRED** | Known open; not forced into Slice 13 by this draft |
| **OUT OF SCOPE** | Explicitly excluded unless separately approved |
| **TECHNICAL DEFECT / REGRESSION** | Evidence suggests correctness gap vs accepted wording/behavior |
| **INSUFFICIENT EVIDENCE** | Cannot decide without more Product brief / targeted audit |

This record distinguishes:

| Bucket | Content |
|--------|---------|
| **A** | Ownership / work-allocation decisions |
| **B** | UX / workflow decisions |
| **C** | Technical defect / regression candidates |
| **D** | Deferred decisions requiring separate future work |
| **E** | Items that should **not** enter Slice 13 |

**Language rule:** This draft does **not** use “best / preferred / recommended / highest priority / winner / primary choice.” Product Owner supplies selection language upon acceptance.

---

## 3. Certified constraints — LOCKED (ACCEPTED / CERTIFIED)

**Do not reopen as Product Decision questions.** Slice 13 (whatever Product later selects) must preserve unless a later **approved** Product Decision explicitly supersedes.

| Constraint | Source |
|------------|--------|
| Hybrid E — shared operational queues + explicit ownership for active counselling | Phase 3H PD7 / Slices 1–12 |
| Ownership SoT = `CounselingSession.CounselorId` | Hybrid E / PD7 |
| `CreatedByUserId` ≠ ownership | Certified |
| Waiting List remains **shared** | PD-WL-01 |
| NULL owner is **valid** | PD-WL-02 |
| Opening / viewing does **not** establish ownership | PD-START-01 |
| Explicit Assign / Claim-for-lifecycle / Reassign | Slices 3 / 6 / lifecycle claim |
| ReQueue → `CounselorId = NULL` | Slice 8 |
| Version / CAS authoritative | Slice 7 |
| Ownership History authoritative | Slice 5 |
| PD16 server-side branch authorization | PD16 |
| Follow-up remains **shared**; **no** My Follow-ups | Slice 10 |
| Analytics My Work is **reporting only** (≠ operational worklist) | Slice 11 |
| Finalize Surgery remains **shared** (not counsellor ownership SoT) | Slice 9 |
| Reassignment Required is an **operational condition** (not lifecycle Status) | Slice 12 |
| No automatic leave transfer / no automatic `CounselorId` clearing / no automatic ReQueue | Slice 12 |
| No new Supervisor role | PD-SUP-01 |
| No new ownership entity unless explicitly approved later | Phase 3H / Slice 12 |
| No cross-branch bypass | PD-S12-16 |
| No duplicate leave worklist | PD-S12-14 |

### Slice 12 confirmation (do not reopen delivery)

Authoritative: `docs/audits/phase3i-slice12-acceptance.md` — RR detection, inactive target protection on Assign/Reassign, stamp retained on deactivate, Sessions RR filter shipped, Delivery Accepted.

---

## 4. Decision matrix overview

| Group | Topic | Bucket | Classification | Product Owner decision | Package B |
|-------|-------|--------|----------------|------------------------|-----------|
| **A** | Sessions / RR remediability | Ownership + UX | **ACCEPTED** | **OPTION C** | **IN PACKAGE** |
| **B** | Counsellor sidebar / navigation | UX / IA | **ACCEPTED** | **OPTION B** | **IN PACKAGE** |
| **C** | Admin deactivation handoff | Ownership ops / UX | **ACCEPTED** | **OPTION B** | **OUT OF PACKAGE** |
| **D** | Waiting List ↔ RR Reassign eligibility | Ownership + UX | **ACCEPTED** | **OPTION C** | **IN PACKAGE** |
| **E** | Claim availability alignment | Technical / security-adjacent | **DEFERRED** | **DEFER** | **OUT** |
| **F** | Post-Surgery ownership (PD-POST-01 / D6) | Ownership SoT | **DEFERRED** | **DEFER + targeted D6/SoT audit** | **OUT** |
| **G** | Legacy Admin-stamped ownership | Ownership data | **ACCEPTED** | **OPTION D** | **OUT OF PACKAGE** |
| **H** | Bulk remediation | Ops tooling | **ACCEPTED** | **OPTION C** | **OUT OF PACKAGE** |
| **I** | Counsellor Dashboard | UX | **ACCEPTED** | **OPTION A** | **OUT OF PACKAGE** |
| **J** | Waiting List UX beyond certified lifecycle | UX | **ACCEPTED** | **OPTION A** | **OUT OF PACKAGE** |
| **K** | Wave 2 session workspace | UX governance | **ACCEPTED** | **OPTION B** | **OUT OF PACKAGE** |
| **L** | ReQueue → History UX | UX governance | **ACCEPTED** | **OPTION A** | **OUT OF PACKAGE** |
| **M** | Clinical Recommendations | UX / clinical context | **ACCEPTED** | **OPTION A** | **OUT OF PACKAGE** |

Audit findings mapped: **F6–F12, F14–F15** (and UX Continuity §§22–35).

---

# Decision Group A — Reassignment Required remediability

| Field | Value |
|-------|--------|
| **Decision ID** | **PD-S13-A** |
| **Bucket** | Ownership / work-allocation + UX |
| **Classification** | **ACCEPTED** |
| **Audit evidence** | F6, F7; §8–10; Continuity matrix rows 4–5, 15–16; PD-S12-14 |
| **Package B** | **IN PACKAGE** |

### Decision question

Should the authoritative Sessions / Reassignment Required surface provide **direct remediation**?

### Current evidence (locked facts)

- RR **detection** works (Slice 12 Delivery Accepted).
- Sessions is the authoritative **discovery** surface per PD-S12-14.
- Sessions row action is currently **Open-only**.
- **Reassign** UI lives on Waiting List (FE Pending\|Processed).
- **ReQueue** UI lives on Follow-up Active/Cold.
- Session detail `[id]` has no Assign / Reassign / ReQueue CTAs.
- PD-S12-14 wording calls Sessions the authoritative remediation surface; implementation “open → existing Reassign UI” is **not** true on the Open path (**TECHNICAL DEFECT / REGRESSION** risk vs accepted wording — not a reopen of Slice 12 detection).

### OPTION A — Keep Sessions discovery-only; retain multi-surface remediation

| Dimension | Impact |
|-----------|--------|
| Ownership | SoT unchanged; human remediation via WL Reassign and/or Follow-up ReQueue |
| UX | Operators discover on Sessions, remedi ate elsewhere |
| API | None |
| Permission | None |
| New queue/entity | **No** |
| Risk | RR rows without WL Pending/Processed projection may lack FE Reassign path (F7) |
| Test | Document multi-surface path; no new Sessions CTA tests required |
| Relationship to PD-S12-14 | Accepts discovery-only interpretation; leaves wording/implementation tension unresolved unless Product explicitly accepts Option A |

### OPTION B — Add direct Reassign **and** ReQueue actions to Sessions

| Dimension | Impact |
|-----------|--------|
| Ownership | SoT unchanged; remediations reuse existing Assign/Reassign/ReQueue semantics |
| UX | Sessions becomes remediable in-place for RR population |
| API | Reuse existing endpoints; **no new ownership entity** |
| Permission | Expect reuse of `counseling_sessions.reassign` / existing ReQueue ACL — **do not invent new codes** unless Product separately decides |
| New queue/entity | **No** (must not create duplicate leave queue) |
| Risk | Medium — must not change certified detection predicates; ReQueue availability on Sessions may broaden ops path beyond Follow-up |
| Test | Sessions list + RR filter remediation UAT; CAS/409; history |
| Relationship to PD-S12-14 | Aligns Sessions with “authoritative remediation surface” wording |

### OPTION C — Add **Reassign only** to Sessions; preserve ReQueue on Follow-up

| Dimension | Impact |
|-----------|--------|
| Ownership | SoT unchanged; ReQueue path unchanged |
| UX | Primary transfer on Sessions; release-to-queue remains Follow-up |
| API | Reuse Reassign API on Sessions host |
| Permission | Reuse `.reassign` |
| New queue/entity | **No** |
| Risk | Lower surface expansion than Option B; ReQueue still multi-surface |
| Test | Sessions Reassign + existing Follow-up ReQueue regression |
| Relationship to PD-S12-14 | Partial alignment (transfer yes; ReQueue still elsewhere) |

### OPTION D — Provide Sessions **detail** remediation with reuse of existing APIs

| Dimension | Impact |
|-----------|--------|
| Ownership | SoT unchanged |
| UX | Open → detail hosts Reassign and/or ReQueue (Product must also pick B vs C for which actions) |
| API | Reuse existing |
| Permission | Reuse existing |
| New queue/entity | **No** |
| Risk | List remains Open-only unless combined with B/C; detail must not imply Open = ownership |
| Test | `[id]` remediation CTAs + ownership lock preservation |
| Relationship to PD-S12-14 | Aligns remediation with Open path narrative |

### Product Owner decision — ACCEPTED

| Field | Value |
|-------|--------|
| **Selected option** | **OPTION C** — Add **Reassign only** to Sessions; preserve ReQueue on Follow-up |
| **Package B** | **IN PACKAGE** |
| **Accepted intent** | Sessions is the authoritative RR discovery/remediation surface for **ownership transfer**; Sessions receives Reassign for applicable RR records; reuse existing Reassign API, permissions, CounselorId SoT, CAS/409, Ownership History; **do not** add ReQueue to Sessions; Follow-up ReQueue unchanged; Slice 12 RR detection predicates unchanged; no other ownership mutation authorized by this decision |

---

# Decision Group B — Counsellor sidebar / navigation

| Field | Value |
|-------|--------|
| **Decision ID** | **PD-S13-B** |
| **Bucket** | UX / Information Architecture |
| **Classification** | **ACCEPTED** |
| **Audit evidence** | F8; Continuity matrix row 17; §8 nav evidence |
| **Package B** | **IN PACKAGE** |

### Decision question

Should Counselling Sessions / Reassignment Required become directly discoverable in Counsellor navigation?

### Current evidence

Counsellor sidebar today:

- Waiting List  
- Finalize Surgery  
- Follow-up Center  
- Analytics  

**Absent:** Counselling Sessions / Reassignment Required.  
Reachable via direct URL and Analytics KPI drilldown (drilldown does **not** set `reassignmentRequired`).

### OPTION A — Keep direct URL / drilldown only

| Check | Result |
|-------|--------|
| Route structure change | **No** |
| New page | **No** |
| Ownership SoT | Unchanged |
| Risk | Discoverability of authoritative RR surface remains low |

### OPTION B — Add Counselling Sessions navigation entry

| Check | Result |
|-------|--------|
| Route structure change | **No new route** — link existing `/dashboard/counsellors-desk/sessions` |
| Nav config change | **Yes** — `sidebar-menu-sections.tsx` only (if later implemented) |
| Ownership SoT | Unchanged |
| Risk | Low if link-only; must not invent a second worklist |

### OPTION C — Combined Sessions / Reassignment Required navigation concept

| Check | Result |
|-------|--------|
| Route structure change | **Possibly** — either deep-link `?reassignmentRequired=true` on existing Sessions route (**no new route**) **or** a new route/alias (**would require Product approval** of route addition) |
| Ownership SoT | Unchanged |
| Risk | Must not create duplicate leave queue; labeling must preserve RR as condition not Status |

### Product Owner decision — ACCEPTED

| Field | Value |
|-------|--------|
| **Selected option** | **OPTION B** — Add Counselling Sessions navigation entry |
| **Package B** | **IN PACKAGE** |
| **Accepted intent** | Add existing `/dashboard/counsellors-desk/sessions` to Counsellor nav; **no** new route/alias; **no** duplicate worklist; **no** new RR queue; discoverability only; RR filter semantics unchanged. Implementation of nav is **not** performed in this acceptance task. |

---

# Decision Group C — Admin deactivation handoff

| Field | Value |
|-------|--------|
| **Decision ID** | **PD-S13-C** |
| **Bucket** | Ownership ops / Admin UX |
| **Classification** | **ACCEPTED** |
| **Audit evidence** | F9; Slice 12 PD-S12-14/15 optional warn/drill |
| **Package B** | **OUT OF PACKAGE** — accepted direction only; not in Package B implementation |

### Decision question

Should Admin Users deactivation warn or deep-link to affected open counselling ownership?

### Locked Slice 12 behavior (preserve)

Deactivation sets `UserStatus = inactive` only. It does **not** clear `CounselorId`. Automatic transfer / auto-ReQueue remain forbidden.

### OPTION A — No additional handoff

| Impact | Notes |
|--------|-------|
| Ownership | Unchanged |
| UX | Generic deactivate confirm remains |
| Risk | IAM operators may not know open owned sessions remain |

### OPTION B — Informational warning + link to existing RR surface

| Impact | Notes |
|--------|-------|
| Ownership | SoT unchanged; still Option B “allow then remediate” |
| UX | Warn + deep-link Sessions RR — **not** a second worklist |
| API | Query/count via existing RR filter patterns |
| Risk | Low–medium if informational only |

### OPTION C — Required remediation before deactivation

| Impact | Notes |
|--------|-------|
| Ownership | Still must **not** auto-clear stamps without separate PD |
| UX | Hard-block deactivate until remedi ated |
| Risk | **High** vs Slice 12 accepted Option A rejection for hard-block; would reopen leave policy |
| Note | **Do not silently select C** |

### Product Owner decision — ACCEPTED (OUT OF PACKAGE B)

| Field | Value |
|-------|--------|
| **Selected option** | **OPTION B** — Informational warning + link to existing RR surface |
| **Package B** | **OUT OF PACKAGE** |
| **Accepted intent** | Admin deactivation may warn that open counselling ownership may need remediation and may deep-link existing RR; **must not** auto-transfer, auto-clear CounselorId, auto-ReQueue, or hard-block deactivate; Slice 12 deactivation semantics remain authoritative. **Not included** in Package B implementation unless a later Product Decision expands scope. |

---

# Decision Group D — Waiting List ↔ RR remediability alignment

| Field | Value |
|-------|--------|
| **Decision ID** | **PD-S13-D** |
| **Bucket** | Ownership + UX |
| **Classification** | **ACCEPTED** |
| **Audit evidence** | F7; Continuity §27 |
| **Package B** | **IN PACKAGE** |
| **Coupled to** | **PD-S13-A = OPTION C** |

### Decision question

Should Waiting List Reassign eligibility be aligned with the RR population?

### Current mismatch

| Surface | Eligibility (evidence) |
|---------|------------------------|
| RR filter | Open session statuses **Scheduled \| InProgress** + unavailable owner predicates |
| Waiting List Reassign FE | Owned **Pending \| Processed** only (`isWaitingListEligibleForReassign`) |
| Waiting List data | Queue-backed projection |

### OPTION A — Keep current boundaries

| Business / UX | RR items may exist that FE cannot Reassign from WL; multi-surface workaround continues |
| Ownership | SoT unchanged |
| Risk | Remediability holes remain |

### OPTION B — Expand Waiting List Reassign eligibility

| Business / UX | Broader transfer CTAs on WL for owned active counselling states Product selects |
| Ownership | SoT unchanged if server Reassign already allows; FE gate widened |
| Risk | Must not break shared-queue semantics or certified lifecycle CTA matrix without care |
| Test | WL Reassign matrix expansion + CAS |

### OPTION C — Make Sessions the primary remediation host for RR; leave WL eligibility unchanged

| Business / UX | Aligns with Decision Group A Options B/C/D; WL stays as today |
| Ownership | SoT unchanged |
| Dependency | Practically couples to **PD-S13-A** selection |
| Risk | Lower WL churn; requires Sessions remediability if chosen |

### Product Owner decision — ACCEPTED

| Field | Value |
|-------|--------|
| **Selected option** | **OPTION C** — Make Sessions the primary RR remediation host; leave Waiting List eligibility unchanged |
| **Package B** | **IN PACKAGE** |
| **Accepted intent** | Sessions is primary RR ownership-transfer host; Waiting List Reassign eligibility **unchanged**; do **not** broaden WL lifecycle CTAs in Package B; shared WL and certified lifecycle remain |

---

# Decision Group E — Claim availability alignment

| Field | Value |
|-------|--------|
| **Decision ID** | **PD-S13-E** |
| **Bucket** | Technical defect / security-adjacent |
| **Classification** | **DEFERRED** |
| **Audit evidence** | F12; Slice 12 Assign/Reassign use `EvaluateOwnershipTargetAvailabilityAsync`; Claim does not |
| **Package B** | **OUT** |

### Decision question

Should Claim-for-lifecycle use the same unavailable-target protection as Assign/Reassign?

### OPTION A — Treat as acceptable (inactive users cannot normally login)

| Impact | Relies on login gate; residual risk mainly unrevoked JWT (tied to PD-S12-19 / F4 **OUT OF SCOPE** unless separate security track) |
| Change | None |

### OPTION B — Align Claim with Slice 12 availability helper

| Impact | Claim actor/target inactive `UserStatus` gated like Assign/Reassign |
| API | Backend Claim path change |
| Permission | None expected |
| Risk | Low if scoped to helper reuse; must preserve Claim intent semantics |

### OPTION C — Separate product/security decision before changing

| Impact | Explicit coupling to JWT revoke / session invalidation track before Claim change |
| Classification | **DEFERRED** relative to UX Slice 13 |

### Product Owner decision — DEFERRED

| Field | Value |
|-------|--------|
| **Selected option** | **DEFER** |
| **Reason** | Technical/security-adjacent; requires separate decision track (not silently included in UX/RR Package B) |
| **Preserve** | Current Claim behavior; **no** Claim availability check changes; **no** JWT/session invalidation changes in Package B |
| **Package B** | **OUT** |

---

# Decision Group F — Post-Surgery ownership (PD-POST-01 / D6)

| Field | Value |
|-------|--------|
| **Decision ID** | **PD-S13-F** |
| **Bucket** | Ownership SoT (not merely UX) |
| **Classification** | **DEFERRED** — **ADDITIONAL TARGETED AUDIT REQUIRED** |
| **Audit evidence** | F10; Phase 3H PD-POST-01; Slice 9 PD-S9-05/25 deferred |
| **Package B** | **OUT** |

### Locked facts

| Fact | Status |
|------|--------|
| Post-Surgery is currently **shared** | Certified boundary honesty (Slice 9) |
| Does **not** use `CounselingSession.CounselorId` as Post-Surgery ownership | Evidence: Follow-up Post-Surgery DTO has no counselor owner fields |
| Explicit assignment was **deferred** | Slice 9 |
| Auto-inheritance from counselling owner is **NOT certified** | Phase 3H / Slice 9 |
| Persistence SoT (**D6**) is **unresolved** | **INSUFFICIENT EVIDENCE** for implementation |

### Decision dimensions (do not invent answers)

1. Should Post-Surgery have explicit ownership?  
2. Where should that ownership persist?  
3. Who can assign / reassign?  
4. Should ownership be branch-scoped (PD16)?  
5. Should ownership history / CAS apply?  
6. Should assignment be **independent** of counselling `CounselorId`?  
7. What is the UI surface (Follow-up Post-Surgery tab vs other)?  

### Product / engineering gate

> **ADDITIONAL TARGETED AUDIT REQUIRED** for D6 persistence SoT before any Post-Surgery ownership implementation prompt.

### Product Owner decision — DEFERRED

| Field | Value |
|-------|--------|
| **Selected option** | **DEFER + targeted D6 / persistence SoT audit** |
| **Accepted direction** | Post-Surgery remains **shared**; no Post-Surgery CounselorId ownership; no auto-inherit from counselling owner; no Post-Surgery assign/reassign/history/CAS implementation; D6 SoT needs separate targeted audit; future implementation needs separate PD after that audit |
| **Package B** | **OUT** — **NOT** part of Package B |
| **Slice 13 inclusion** | **NOT IN PACKAGE B** |

---

# Decision Group G — Legacy Admin-stamped ownership

| Field | Value |
|-------|--------|
| **Decision ID** | **PD-S13-G** |
| **Bucket** | Ownership data hygiene |
| **Classification** | **ACCEPTED** |
| **Audit evidence** | F11; Phase 3H remaining unresolved; PD-ADM-01 / PD-WL-02 |
| **Package B** | **OUT OF PACKAGE** |

### Decision question

How should legacy Admin-stamped ownership be handled?

### Locked rule

**NO SILENT BACKFILL.**

### OPTION A — Operational remediation only

Use existing Reassign / ReQueue / RR detection when rows become operationally relevant.

### OPTION B — Controlled data migration

Requires **separate migration audit** + explicit criteria + history preservation. **Not** implementable from this PDR alone.

### OPTION C — Both, with explicit migration criteria

Ops path now; migration for defined cohorts after migration audit.

### OPTION D — Leave historical data untouched unless operationally affected

No proactive campaign; remediate when RR / ops encounters rows.

### Product Owner decision — ACCEPTED (OUT OF PACKAGE B)

| Field | Value |
|-------|--------|
| **Selected option** | **OPTION D** — Leave historical data untouched unless operationally affected |
| **Package B** | **OUT OF PACKAGE** |
| **Accepted intent** | **NO** silent backfill; **NO** automatic migration; **NO** bulk historical rewrite; historical data untouched unless operationally remediable via existing workflows; **no** migration in Package B |

---

# Decision Group H — Bulk remediation

| Field | Value |
|-------|--------|
| **Decision ID** | **PD-S13-H** |
| **Bucket** | Ops tooling |
| **Classification** | **ACCEPTED** |
| **Audit evidence** | F14 — no bulk API found; weak product need evidence |
| **Package B** | **OUT OF PACKAGE** |

### OPTION A — No bulk operation

### OPTION B — Future bulk remediation audit (only if Product asserts need)

### OPTION C — Product-provided operational requirement **before** considering bulk

**Rule:** Do **not** treat bulk remediation as automatically necessary for Slice 13.

### Product Owner decision — ACCEPTED (OUT OF PACKAGE B)

| Field | Value |
|-------|--------|
| **Selected option** | **OPTION C** — Require an operational requirement before considering bulk |
| **Package B** | **OUT OF PACKAGE** |
| **Accepted intent** | No bulk remediation / API / UI / worklist in Package B; bulk requires explicit operational requirement + separate PD before any future implementation |

---

# Decision Group I — Counsellor Dashboard

| Field | Value |
|-------|--------|
| **Decision ID** | **PD-S13-I** |
| **Bucket** | UX |
| **Classification** | **ACCEPTED** |
| **Audit evidence** | F15; Continuity §28 — **NO FORMAL DASHBOARD SoT FOUND** |
| **Package B** | **OUT OF PACKAGE** |

### Locked constraints if any dashboard is ever defined

- Analytics **My Work** remains **reporting-only**.  
- A Dashboard must **not** become a duplicate leave worklist.  
- Do **not** invent dashboard cards or metrics in this PDR.

### OPTION A — Keep Waiting List as Counsellor landing

Matches current `DashboardRouter` / legacy `/dashboard/counselor` redirect.

### OPTION B — Define a dedicated Counsellor Dashboard in a **future** UX/product decision

Requires Product brief defining audience, cards, and SoT APIs.

### OPTION C — Create a dedicated dashboard **only after** defining authoritative metric/data sources

Same as B with explicit metric SoT prerequisite.

### Product Owner decision — ACCEPTED (OUT OF PACKAGE B)

| Field | Value |
|-------|--------|
| **Selected option** | **OPTION A** — Keep Waiting List as Counsellor landing |
| **Package B** | **OUT OF PACKAGE** |
| **Accepted intent** | Waiting List remains Counsellor landing; **no** new Dashboard; **no** invented cards/metrics; Analytics My Work remains reporting-only; **no** duplicate operational worklist; **no** Dashboard implementation in Package B |

**Metrics invented in this acceptance:** **NONE**

---

# Decision Group J — Waiting List UX (beyond certified lifecycle)

| Field | Value |
|-------|--------|
| **Decision ID** | **PD-S13-J** |
| **Bucket** | UX |
| **Classification** | **ACCEPTED** |
| **Audit evidence** | Continuity §27 |
| **Package B** | **OUT OF PACKAGE** |

### CERTIFIED (already implemented — do not describe as unimplemented redesign)

- Shared list  
- Lifecycle CTAs  
- Explicit Assign  
- Claim-for-lifecycle  
- Reassign (WL Pending\|Processed)  
- Owner indicators  
- Opening ≠ ownership  
- PD16  

### Potential future UX (not yet a certified redesign program)

- Visual density  
- Copy reduction  
- Next-action clarity  
- Badge/label refinement  
- Re-evaluate Auth dual-store sync (**separate deferred technical/product item**)

### OPTION A — No further Waiting List UX change

### OPTION B — Targeted visual polish only (no business-rule change)

### OPTION C — Targeted lifecycle UX refinement (may require additional PDs if behavior changes — e.g. Re-eval Auth sync)

### Product Owner decision — ACCEPTED (OUT OF PACKAGE B)

| Field | Value |
|-------|--------|
| **Selected option** | **OPTION A** — No further Waiting List UX change in Slice 13 |
| **Package B** | **OUT OF PACKAGE** |
| **Accepted intent** | Preserve certified Waiting List UX/lifecycle; **no** visual redesign; **no** lifecycle CTA expansion; **no** business-rule changes; **no** Auth dual-store sync change; **no** additional WL UX in Package B |

---

# Decision Group K — Wave 2 session workspace

| Field | Value |
|-------|--------|
| **Decision ID** | **PD-S13-K** |
| **Bucket** | UX governance |
| **Classification** | **ACCEPTED** |
| **Audit evidence** | Continuity matrix rows 6–12; Wave 2 e2e harnesses; thin formal docs acceptance pack |
| **Package B** | **OUT OF PACKAGE** |

### Current evidence

Wave 2 Quote / Decision / Insurance / Notes / Finish UX exists with Playwright coverage. Formal documentation/acceptance pack under `docs/audits/` is thin.

### OPTION A — Treat current Wave 2 UX as accepted baseline

### OPTION B — Require formal acceptance / UAT closure before further UX work

### OPTION C — Perform targeted UX polish after explicit scope definition

**Rule:** Do **not** reimplement Wave 2.

### Product Owner decision — ACCEPTED (OUT OF PACKAGE B)

| Field | Value |
|-------|--------|
| **Selected option** | **OPTION B** — Require formal UAT / acceptance closure before further Wave 2 UX work |
| **Package B** | **OUT OF PACKAGE** |
| **Accepted intent** | Existing Wave 2 Quote/Decision/Insurance/Notes/Finish remains implemented; **do not** reimplement Wave 2; formal acceptance/UAT is a governance prerequisite before additional Wave 2 UX changes; **no** Wave 2 redesign in Package B. **Not** an authorization to start UAT in this acceptance task. |

---

# Decision Group L — ReQueue → History UX

| Field | Value |
|-------|--------|
| **Decision ID** | **PD-S13-L** |
| **Bucket** | UX governance |
| **Classification** | **ACCEPTED** |
| **Audit evidence** | `counsellor-session-requeue-notes-to-history-ux-report.md` — **READY FOR MANUAL UAT / NOT ACCEPTED** |
| **Package B** | **OUT OF PACKAGE** |

### OPTION A — Complete UAT / acceptance as a prerequisite (to further related UX)

### OPTION B — Reopen UX design

### OPTION C — Leave pending without further work

### Product Owner decision — ACCEPTED (OUT OF PACKAGE B)

| Field | Value |
|-------|--------|
| **Selected option** | **OPTION A** — Complete UAT / acceptance as a prerequisite |
| **Package B** | **OUT OF PACKAGE** |
| **Accepted intent** | Existing ReQueue → History UX remains current implementation; complete its manual UAT/acceptance when explicitly scheduled; **do not** reopen UX design or redesign the workflow; **not** included in Package B. **Not** permission to start UAT in this acceptance task. |

---

# Decision Group M — Clinical Recommendations

| Field | Value |
|-------|--------|
| **Decision ID** | **PD-S13-M** |
| **Bucket** | UX / clinical contextual surface |
| **Classification** | **ACCEPTED** |
| **Audit evidence** | Continuity matrix row 19; `clinical-recommendations-placeholder.ts` |
| **Package B** | **OUT OF PACKAGE** |

### Current UX shell (implemented)

- Patient Header action  
- Right-side Sheet  
- Doctor information from session path  
- Optometrist information = **static UX placeholder** (not clinical SoT)

### OPTION A — Keep placeholder explicitly as UX-only

### OPTION B — Define a clinical source-of-truth integration requirement

### OPTION C — Defer Clinical Recommendations data work outside Slice 13

**Rule:** Do **not** invent clinical data sources in this PDR.

### Product Owner decision — ACCEPTED (OUT OF PACKAGE B)

| Field | Value |
|-------|--------|
| **Selected option** | **OPTION A** — Keep placeholder explicitly as UX-only |
| **Package B** | **OUT OF PACKAGE** |
| **Accepted intent** | Patient Header action + right-side Sheet remain; Doctor info uses existing source; Optometrist content remains static UX placeholder (**not** clinical SoT); **no** invented clinical data source; **no** clinical workflow changes; **no** Clinical Recommendations data work in Package B |

---

## 5. Items that should NOT enter Slice 13 (Bucket E / OUT OF SCOPE)

Unless separately and explicitly approved by Product:

| Item | Classification |
|------|----------------|
| HR leave integration / temporary leave without IAM signal | **OUT OF SCOPE** (PD-S12-01) |
| JWT / session invalidation redesign | **OUT OF SCOPE** (PD-S12-19) |
| New Supervisor role | **OUT OF SCOPE** |
| New ownership entity (default) | **OUT OF SCOPE** |
| Duplicate leave queue | **OUT OF SCOPE** |
| Automatic transfer / automatic `CounselorId` clear / automatic ReQueue | **OUT OF SCOPE** |
| Cross-branch bypass | **OUT OF SCOPE** |
| Silent legacy data migration / silent backfill | **OUT OF SCOPE** |
| Redesign of unrelated hospital modules | **OUT OF SCOPE** |
| OT work as ownership Slice 13 | **OUT OF SCOPE** |
| Billing | **OUT OF SCOPE** |
| Analytics as operational queue / My Work worklist | **OUT OF SCOPE** |
| Invented dashboard metrics | **OUT OF SCOPE** / **INSUFFICIENT EVIDENCE** |
| Full Waiting List visual redesign as if unimplemented | **OUT OF SCOPE** framing error — certified lifecycle already shipped |
| Wave 2 full reimplementation | **OUT OF SCOPE** |
| Reopening Slice 12 detection predicates | **OUT OF SCOPE** |

---

## 6. Slice 13 scope packages — APPROVED SELECTION

Candidate packages A–F were presented for Product Owner selection (historically unranked).

### APPROVED: PACKAGE B — RR + COUNSELLOR NAVIGATION

| Field | Value |
|-------|--------|
| **Status** | **APPROVED** as Slice 13 bounded implementation scope |
| **Implementation decisions IN PACKAGE** | **PD-S13-A = OPTION C**; **PD-S13-B = OPTION B**; **PD-S13-D = OPTION C** |
| **Accepted but OUT OF PACKAGE** | PD-S13-C = B; PD-S13-G = D; PD-S13-H = C; PD-S13-I = A; PD-S13-J = A; PD-S13-K = B; PD-S13-L = A; PD-S13-M = A |
| **Deferred (OUT)** | PD-S13-E = DEFER; PD-S13-F = DEFER + targeted D6/SoT audit |

### Package B implementation intent (authorized for a future implementation prompt only)

1. Add **Reassign** capability to the existing Sessions surface for the applicable RR population.  
2. Reuse existing Reassign APIs, permissions, ownership semantics, CAS/409, and Ownership History.  
3. Preserve **ReQueue** on Follow-up (do **not** add ReQueue to Sessions).  
4. Keep Waiting List Reassign eligibility **unchanged**.  
5. Add the existing Counselling Sessions route to Counsellor navigation.  
6. Do **not** create a new route.  
7. Do **not** create a new worklist.  
8. Do **not** create a new ownership entity.  
9. Do **not** change RR detection.  
10. Do **not** change CounselorId ownership semantics.  
11. Do **not** change branch authorization (PD16).  
12. Do **not** change lifecycle state semantics.

### Explicitly OUT of Package B

PD-S13-C implementation · PD-S13-E Claim availability · PD-S13-F Post-Surgery · PD-S13-G migration/backfill · PD-S13-H bulk · PD-S13-I Dashboard · PD-S13-J additional WL UX · PD-S13-K Wave 2 redesign · PD-S13-L ReQueue→History redesign · PD-S13-M clinical data integration · new Supervisor role · new ownership entity · new leave/RR worklist · automatic transfer / CounselorId clear / ReQueue · cross-branch access · JWT redesign · HR leave · Billing · OT · unrelated modules · reopening Slice 12 detection · redesign of certified Slices 1–12.

### Historical candidate packages (not selected)

Packages A, C, D, E, F remain documented as unselected alternatives from the draft PDR. They are **not** approved for Slice 13 by this acceptance.

---

## 7. Design-system constraints (carry-forward)

Any future Counsellor UX authorized after acceptance must preserve Hospital Portal design system: shadcn/Radix/Tailwind/Lucide; counselling tokens; desktop-first staff UX; Sheets/Dialogs consistency; **no** new design system / UI framework / theme replacement; bounded Counsellor surfaces only.

---

## 8. Accepted Product Decision checklist

| ID | Topic | Product Owner decision | Package B |
|----|-------|------------------------|-----------|
| PD-S13-A | Sessions RR remediability | **OPTION C** | **IN PACKAGE** |
| PD-S13-B | Counsellor nav Sessions | **OPTION B** | **IN PACKAGE** |
| PD-S13-C | Admin deactivate handoff | **OPTION B** | **ACCEPTED / OUT OF PACKAGE** |
| PD-S13-D | WL ↔ RR Reassign alignment | **OPTION C** | **IN PACKAGE** |
| PD-S13-E | Claim availability alignment | **DEFER** | **DEFERRED** |
| PD-S13-F | Post-Surgery ownership SoT | **DEFER + targeted D6/SoT audit** | **DEFERRED** |
| PD-S13-G | Legacy Admin-stamped ownership | **OPTION D** | **ACCEPTED / OUT OF PACKAGE** |
| PD-S13-H | Bulk remediation | **OPTION C** | **ACCEPTED / OUT OF PACKAGE** |
| PD-S13-I | Counsellor Dashboard | **OPTION A** | **ACCEPTED / OUT OF PACKAGE** |
| PD-S13-J | Waiting List UX beyond certified | **OPTION A** | **ACCEPTED / OUT OF PACKAGE** |
| PD-S13-K | Wave 2 acceptance baseline | **OPTION B** | **ACCEPTED / OUT OF PACKAGE** |
| PD-S13-L | ReQueue → History UAT closure | **OPTION A** | **ACCEPTED / OUT OF PACKAGE** |
| PD-S13-M | Clinical Recommendations SoT | **OPTION A** | **ACCEPTED / OUT OF PACKAGE** |
| Scope | Slice 13 package | **PACKAGE B** | **APPROVED** |

---

## 9. Product Decision Review + Acceptance matrix

| ID | Decision Area | Options | Product Owner Decision | Package B |
|----|---------------|---------|------------------------|-----------|
| A | Sessions / RR remediation | A/B/C/D | **C** | **IN PACKAGE** |
| B | Sidebar / navigation | A/B/C | **B** | **IN PACKAGE** |
| C | Admin deactivation handoff | A/B/C | **B** | **ACCEPTED / OUT OF PACKAGE** |
| D | WL ↔ RR eligibility | A/B/C | **C** | **IN PACKAGE** |
| E | Claim availability | A/B/C | **DEFER** | **DEFERRED** |
| F | Post-Surgery ownership | Dimensions 1–7 | **DEFER + D6/SoT audit** | **DEFERRED** |
| G | Legacy Admin ownership | A/B/C/D | **D** | **ACCEPTED / OUT OF PACKAGE** |
| H | Bulk remediation | A/B/C | **C** | **ACCEPTED / OUT OF PACKAGE** |
| I | Counsellor Dashboard | A/B/C | **A** | **ACCEPTED / OUT OF PACKAGE** |
| J | Waiting List UX | A/B/C | **A** | **ACCEPTED / OUT OF PACKAGE** |
| K | Wave 2 workspace | A/B/C | **B** | **ACCEPTED / OUT OF PACKAGE** |
| L | ReQueue → History UX | A/B/C | **A** | **ACCEPTED / OUT OF PACKAGE** |
| M | Clinical Recommendations | A/B/C | **A** | **ACCEPTED / OUT OF PACKAGE** |

**Slice 13 scope package:** **PACKAGE B — RR + COUNSELLOR NAVIGATION** (approved).

**Validation (acceptance gate):** PD-S13-A=C · B=B · C=B · D=C · E=DEFER · F=DEFER+D6 · G=D · H=C · I=A · J=A · K=B · L=A · M=A · Package B = A+B+D only · Slice 12 not reopened · no production implementation in this task.

---

## 10. Acceptance gate (this document)

```text
PRODUCT DECISION RECORD:                    ACCEPTED

Product Decision Review:                    COMPLETE

Product Owner Acceptance:                   ACCEPTED

Slice 13 Scope:                             PACKAGE B — RR + COUNSELLOR NAVIGATION

Production Implementation:                  NOT STARTED

Automated Tests (Slice 13 implementation):  NOT STARTED

Manual UAT:                                 NOT STARTED

Delivery Acceptance:                        NOT STARTED
```

### Acceptance statement

> **Product Owner acceptance authorizes Package B as the bounded implementation scope for Slice 13. This acceptance does not itself implement any production changes. A separate implementation prompt and implementation gate are required.**

### Next gate

**SLICE 13 PACKAGE B — EXPLICIT IMPLEMENTATION PROMPT REQUIRED**

Do **not** implement Package B from this acceptance document alone.

### Explicit non-actions of this acceptance task

- Did **not** implement Package B  
- Did **not** modify navigation, Sessions UI, APIs, tests, or ownership behavior  
- Did **not** start Manual UAT or Delivery Acceptance  
- Did **not** modify the Slice 13 readiness audit  
- Did **not** alter Slice 12 decisions  
- Did **not** expand Package B  

---

**END — SLICE 13 PRODUCT DECISION RECORD ACCEPTED — PACKAGE B — STOP**

**NEXT GATE: SLICE 13 PACKAGE B — EXPLICIT IMPLEMENTATION PROMPT REQUIRED**
