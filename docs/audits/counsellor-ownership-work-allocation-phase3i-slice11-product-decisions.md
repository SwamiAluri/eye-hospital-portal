# Phase 3I Slice 11 — Analytics / My Work  
# PRODUCT DECISION RECORD

| Field | Value |
|-------|--------|
| **Document date** | 2026-09-21 |
| **Mode** | PRODUCT DECISION ONLY — no production code, API, DB, migration, permission, ownership, UI, or formula changes in this task |
| **Source audit** | `docs/audits/counsellor-ownership-work-allocation-phase3i-slice11-readiness-audit.md` |
| **Prior decision SoT** | `docs/audits/counsellor-ownership-work-allocation-phase3h-product-decisions.md` (PD-ANALYTICS-01, PD-WL-01, PD-WL-02, PD-FOLLOWUP-01, PD-SUP-01, PD7 Hybrid E, PD16, PD13–PD15); Slice 8 ReQueue; Slice 9 Finalize/Post-Surgery; Slice 10 Follow-up honesty Accepted |
| **Convention** | Placed under `docs/audits/` to match existing Phase 3H / Phase 3I decision and audit records (no new parallel `docs/product-decisions/` tree) |
| **Sign-off convention** | Same as Phase 3H: workshop-agreed decisions may drive implementation after an **explicit separate implementation prompt**; named hospital formal signatures remain optional and are not fabricated here |

---

## 1. Status

| Metric | Status |
|--------|--------|
| Slice 11 readiness audit | **COMPLETE** — READY FOR PRODUCT DECISION |
| Slice 11 product decisions PD-S11-01…10 | **RESOLVED** (this document) |
| Decision status for IDs below | **WORKING — AGREED FOR IMPLEMENTATION WORKFLOW / NOT FORMALLY SIGNED** |
| Gate for a future implementation prompt | **READY FOR IMPLEMENTATION** |
| Production code changed by this task | **NO** |
| Slice 11 implementation started | **NO** |
| Slice 12 started | **NO** |

### Implementation gate (mandatory)

> **Slice 11 implementation must not begin from the readiness audit alone.**  
> Implementation must wait for a **separate explicit implementation approval / prompt** after this Product Decision Record is accepted.  
> This document does **not** authorize code, API, schema, permission, or UI changes.

---

## 2. Source audit summary

The Slice 11 readiness audit established:

1. Slice 11 is **Analytics scope** (My Work vs Authorized Branch), not a new operational worklist.
2. Ownership SoT remains `CounselingSession.CounselorId`.
3. Waiting List / Follow-up / Finalize / Post-Surgery remain shared operational surfaces.
4. Existing Analytics APIs already accept `counselorId` but FE defaults to **All counselors**.
5. Critical inconsistency: Analytics + sessions drill still use **CreatedBy fallback** when `CounselorId` is null — conflicts with PD-WL-02.
6. No new table/queue/assignment entity is required for the planned scope.

---

## 3. Existing certified / working constraints (do not silently reopen)

| ID / Slice | Rule | Slice 11 stance |
|------------|------|-----------------|
| **PD-ANALYTICS-01** | My Work + Authorized Branch; normal default My Work; filter ≠ entitlement; same Phase 2Z formulas | **Formally confirmed** by PD-S11-01 / 08 / 09 / 10 |
| **PD-WL-01** | Waiting List shared; no CounselorId visibility filter | **Preserved** — not personalized |
| **PD-WL-02** | `CounselorId` may be NULL; `CreatedByUserId` ≠ ownership | **Preserved** — drives PD-S11-03 / 04 |
| **PD-FOLLOWUP-01** + Slice 10 Accepted | Follow-up Center shared; no My Follow-ups; Original Counsellor = historical attribution | **Reaffirmed** by PD-S11-06 |
| **PD-FS-01 / PD-S9-18** | Finalize / Post-Surgery not counsellor My Work surfaces | **Preserved** |
| **Slice 8** | ReQueue → `CounselorId` NULL; `OwnershipRequeued` only if previously owned | **Preserved** — consequence via PD-S11-05 |
| **PD13 / PD14 / PD15** | Partition formulas; PendingDecision aging; drill destinations | **Unchanged** |
| **PD16** | Server-side branch authorization | **Unchanged** |
| **PD-SUP-01** | Permission-based supervisory auth; **no** new Supervisor role | **Preserved** — PD-S11-08 uses `counseling_sessions.reassign` |
| **PD7 Hybrid E** | Shared queues + owned active counselling | **Preserved** |
| Ownership History | Timeline / audit — not automatic KPI denominator | **Preserved** |

---

## 4. Formal decisions PD-S11-01 through PD-S11-10

---

### PD-S11-01 — My Work definition

| Field | Value |
|-------|--------|
| **Decision ID** | **PD-S11-01** |
| **Question** | Is Slice 11 My Work formally an Analytics reporting scope, rather than a new operational worklist? |
| **Current repository evidence** | Phase 3I Slice 11 scope; PD-ANALYTICS-01; Analytics at `/dashboard/counselor/analytics`; no My Work UI/table/queue exists; Waiting List / Follow-up intentionally shared |
| **Existing certified constraints** | PD-ANALYTICS-01; PD-WL-01; PD-FOLLOWUP-01; PD-S9-18; no duplicate worklist rule |
| **Options** | **A** Analytics attribution scope · **B** New operational owned-session worklist · **C** Personalized Waiting List / Follow-up · **D** Other evidence-backed model |
| **Selected option** | **A — Analytics attribution scope** |
| **Recommended / recorded decision** | Slice 11 My Work is the **Analytics reporting scope** that attributes counselling sessions to the current counsellor via **`CounselorId`**, within server-authorized branch scope and existing date windows. It is **not** an operational task queue. |
| **Rationale** | Matches certified PD-ANALYTICS-01 and Hybrid E. Options B/C overturn shared-queue decisions and create duplicate worklists without architectural need. |
| **Changes certified behavior?** | **No** — formally confirms PD-ANALYTICS-01 (previously working/unsigned). |
| **Downstream implementation impact** | FE scope default/labels on Analytics only; reuse existing Analytics + sessions drill APIs; no new routes/tables/queues. |
| **Acceptance criteria** | Slice 11 does **not** create: a new queue; a My Work table; duplicate assignment state; My Follow-ups; personalized Waiting List; personalized Finalize/Post-Surgery. Analytics remains read-only reporting. |

---

### PD-S11-02 — Session population / status semantics

| Field | Value |
|-------|--------|
| **Decision ID** | **PD-S11-02** |
| **Question** | Within the Analytics date window, which counselling sessions are included in My Work? |
| **Current repository evidence** | Analytics includes all non-deleted sessions in `SessionDate` window (all Status values), then applies PD13 partitions; not filtered to InProgress-only |
| **Existing certified constraints** | PD13–PD15 / Phase 2Z formulas unchanged; My Work ≠ task queue (PD-S11-01) |
| **Options** | **A** All non-deleted attributed sessions in window · **B** Only active/non-terminal · **C** Other explicit population |
| **Selected option** | **A — All non-deleted sessions attributed to the counsellor within the selected reporting window** |
| **Recommended / recorded decision** | My Work uses the **same session population** as existing Analytics for the chosen scope: soft-deleted excluded; date window by **`SessionDate`**; attribution per PD-S11-03/04; **all session Status values** (including Completed, Cancelled, NoShow if present) remain in the reporting set. PD13 partitions continue to classify outcomes. Completed sessions **remain in My Work reporting** when they match date + attribution — as **historical Analytics attribution**, not as actionable todos. |
| **Rationale** | Preserves Phase 2Z denominators. Restricting to active-only would silently redesign formulas and turn My Work into a task queue. |
| **Changes certified behavior?** | **No** — reaffirms Phase 2Z population; only scope default/attribution filter change later. |
| **Downstream implementation impact** | No formula changes; do not add Status=InProgress-only filters for My Work. |
| **Acceptance criteria** | Conversion/Decision/Eligible formulas unchanged under My Work vs Branch (same definitions, different attribution scope). Completed attributed sessions still count in windowed KPIs. UI copy does not present Analytics as an actionable worklist. |

---

### PD-S11-03 — NULL CounselorId

| Field | Value |
|-------|--------|
| **Decision ID** | **PD-S11-03** |
| **Question** | When `CounselorId` is NULL, is the session included in My Work? |
| **Current repository evidence** | Unassigned sessions intentional (PD-WL-02); Admin create → NULL (PD-ADM-01); ReQueue → NULL (Slice 8); code may still include via CreatedBy fallback |
| **Existing certified constraints** | `CounselorId` = ownership SoT; `CreatedByUserId` ≠ ownership |
| **Options** | Include via CreatedBy · Exclude when NULL · Other |
| **Selected option** | **Exclude when `CounselorId` is NULL** |
| **Recommended / recorded decision** | Sessions with **`CounselorId = NULL` are not included in My Work**. Consequences: Admin-created unassigned, Waiting List unassigned, ReQueued, and pre-assignment sessions are **out of My Work** until explicitly owned. They remain on **shared** Waiting List / Follow-up as applicable. They appear in **Authorized Branch** aggregate (when `counselorId` filter omitted) if otherwise in date/branch scope. |
| **Rationale** | Direct consequence of ownership SoT. Including NULL via creator invents ownership. |
| **Changes certified behavior?** | **No** for ownership rules. **Yes for current Analytics code behavior** if CreatedBy fallback is removed (see PD-S11-04) — that is aligning code to certified policy, not overturning policy. |
| **Downstream implementation impact** | Attribution filter = `CounselorId == scopeUserId` only (when My Work / peer filter applied). |
| **Acceptance criteria** | NULL-owner session never appears under My Work KPIs or My Work sessions drill. Same session still visible on shared WL when queue-eligible. |

---

### PD-S11-04 — CreatedBy fallback (**CRITICAL**)

| Field | Value |
|-------|--------|
| **Decision ID** | **PD-S11-04** |
| **Question** | Keep, remove, or narrow the Analytics/sessions effective-owner fallback `CounselorId == id OR (CounselorId == null AND CreatedByUserId == id)`? |
| **Current repository evidence** | `CounselingAnalyticsService.BuildSessionQuery` / aging / callbacks; `CounselingWorkflowService.GetAllSessionsAsync` — same fallback for PD15 drill parity |
| **Existing certified constraints** | PD-WL-02 / field distinctions: CreatedBy ≠ ownership; Phase 3H C4 flagged fallback risk; Slice 11 audit requires rethink without breaking drill **parity** |
| **Options** | **A** Remove entirely · **B** Retain · **C** Narrow legacy/reporting-only (must not be ownership) |
| **Selected option** | **A — Remove CreatedBy fallback entirely** |
| **Recommended / recorded decision** | Effective counselor filter becomes **strict stamp only**: |

```text
WHEN counselorId filter is provided:
  CounselingSession.CounselorId == counselorId
  AND DeletedAt IS NULL
  (+ existing tenant / PD16 branch / SessionDate window predicates)

WHEN counselorId filter is omitted:
  No counselor attribution filter (Authorized Branch aggregate within PD16)
```

| Surface | Rule after this decision |
|---------|--------------------------|
| Analytics summary | Strict `CounselorId` when filtered |
| Analytics trends | Strict `CounselorId` when filtered |
| Analytics aging | Strict `CounselorId` when filtered |
| Callback metrics joined to counselor filter | Same strict session ownership join (no CreatedBy) |
| Sessions drill-down (PD15) | **Same strict filter** — parity = identical attribution predicate as KPIs, not preservation of CreatedBy |
| NULL CounselorId | Excluded from filtered My Work / peer scope (PD-S11-03) |
| ReQueue | Leaves filtered My Work (PD-S11-05) |
| Admin-created NULL | Excluded from My Work; included in Branch aggregate if in window |

**CreatedByUserId remains creator audit only.** It must not appear in counselor attribution filters. Ownership History remains timeline-only — not a substitute denominator.

| **Rationale** | Option B preserves a certified contradiction. Option C invites ownership-like semantics under another name. Option A aligns Analytics with ownership SoT; PD15 “parity” means drill and KPIs share one predicate — both without CreatedBy. |
| **Changes certified behavior?** | **Does not overturn** PD-WL-02 / PD-ANALYTICS-01. **Does change current production Analytics/list code semantics** (removes fallback). Must be called out in implementation UAT as intentional alignment. |
| **Downstream implementation impact** | Backend: remove CreatedBy OR branches in Analytics + GetAllSessions counselor filter. Frontend: no CreatedBy dependence. Tests: regression that NULL+CreatedBy match is **excluded**; formula snapshots still pass under Branch scope. |
| **Acceptance criteria** | Deterministic: for counselor scope `U`, session with `CounselorId=null`, `CreatedByUserId=U` → **not** in My Work summary/trends/aging/sessions drill. Session with `CounselorId=U` → included when in date/branch window. Branch aggregate (`counselorId` omitted) still includes NULL-owner sessions. |

---

### PD-S11-05 — ReQueue behavior in My Work

| Field | Value |
|-------|--------|
| **Decision ID** | **PD-S11-05** |
| **Question** | After ReQueue clears `CounselorId` to NULL, what happens to the session in My Work? |
| **Current repository evidence** | Slice 8: ReQueue → NULL; `OwnershipRequeued` only if previously owned; CreatedBy fallback may currently retain in Analytics |
| **Existing certified constraints** | Slice 8 ReQueue semantics unchanged; PD-S11-03/04; no ownership resurrection via CreatedBy |
| **Options** | **A** Immediately leaves stamp-based My Work · **B** Remains via CreatedBy · **C** Other |
| **Selected option** | **A — Immediately leaves stamp-based My Work** |
| **Recommended / recorded decision** | On successful ReQueue, the session **immediately exits My Work** for the previous owner because `CounselorId` is NULL. It does **not** remain via `CreatedByUserId`. It returns to shared Waiting List as unassigned. Prior owner may still see it under **Authorized Branch** aggregate if in window. Slice 8 ReQueue implementation is **not** changed by this decision. |
| **Rationale** | Required consistency with PD-S11-03/04 and Slice 8. Option B resurrects ownership through creator. |
| **Changes certified behavior?** | **No** for ReQueue. Analytics attribution after ReQueue changes only because fallback is removed (PD-S11-04). |
| **Downstream implementation impact** | No ReQueue code changes. Tests: Assign → My Work includes → ReQueue → My Work excludes (same user, same window). |
| **Acceptance criteria** | UAT path: Assign to counsellor A → open Analytics My Work → session in KPIs/drill → ReQueue with reason → refresh My Work → session **absent**; Waiting List shows Unassigned; History shows `OwnershipRequeued` when previously owned. |

---

### PD-S11-06 — Follow-up relationship

| Field | Value |
|-------|--------|
| **Decision ID** | **PD-S11-06** |
| **Question** | What is the relationship between My Work and Follow-up Center / Post-Surgery? |
| **Current repository evidence** | PD-FOLLOWUP-01; Slice 10 Accepted (Original Counsellor label; no My Follow-ups); Post-Surgery without counselling owner ACL |
| **Existing certified constraints** | Do not redesign Follow-up; do not add owner filters |
| **Options** | Reaffirm shared · Overturn to My Follow-ups · Other |
| **Selected option** | **Reaffirm shared Center; no My Follow-ups** |
| **Recommended / recorded decision** | (1) Follow-up Center remains **shared**. (2) **No My Follow-ups**. (3) Slice 11 must **not** add owner filtering to Follow-up Center. (4) Historical `CounselorId` may still contribute to **Analytics My Work** if the underlying session is in the Analytics population and stamp matches (reporting only). (5) Post-Surgery / Finalize remain **outside** Slice 11 ownership personalization. |
| **Rationale** | Overturning would undo Slice 10 Accepted and PD-FOLLOWUP-01 without product need. |
| **Changes certified behavior?** | **No** |
| **Downstream implementation impact** | Aging → Follow-up Center drill remains **unscoped** path; no counselorId on Center APIs. |
| **Acceptance criteria** | Center UI has no My Follow-ups / Assigned to Me; no `counselorId` list filter added; Analytics may still show historical attributed sessions in KPIs. |

---

### PD-S11-07 — Branch scope

| Field | Value |
|-------|--------|
| **Decision ID** | **PD-S11-07** |
| **Question** | What does My Work mean when the user has multiple authorized branches? |
| **Current repository evidence** | FE passes selected `branchId` from auth store; API resolves via PD16 (`ResolveFollowupBranchesAsync`); unauthorized → 403; omit → authorized set |
| **Existing certified constraints** | PD16; do not invent new branch auth model |
| **Options** | **A** All authorized branches always · **B** Active selected branch only as hard exclusive model · **C** Existing branch selector; My Work constrained by selected/authorized branch resolution |
| **Selected option** | **C — Existing branch selector behavior; My Work constrained by the selected branch as resolved by PD16** |
| **Recommended / recorded decision** | Distinguish four concepts: |

| Concept | Meaning |
|---------|---------|
| **Authorization scope** | Server PD16 set of branches the user may access — security boundary |
| **Selected branch filter** | Client convenience; must be subset of authorized set; never grants access |
| **My Work counselor attribution** | `CounselorId == current user` (when My Work selected) |
| **Cross-branch visibility** | Only via authorized Branch aggregate / changing selected branch within PD16 — not via client `counselorId` |

My Work KPIs apply **counselor attribution + the same branch resolution already used by Analytics** (typically the currently selected branch, validated server-side). Do not invent a separate cross-branch My Work rollup in Slice 11.

| **Rationale** | Preserves PD16 and current Analytics branch UX; avoids a second authorization path. |
| **Changes certified behavior?** | **No** |
| **Downstream implementation impact** | Keep existing branch picker / auth-store wiring; ensure My Work default still sends authorized `branchId`. |
| **Acceptance criteria** | Unauthorized branchId → 403. My Work for branch B does not include sessions only in unauthorized branch C. Switching selected authorized branch changes the My Work population accordingly. |

---

### PD-S11-08 — Admin / supervisor visibility defaults

| Field | Value |
|-------|--------|
| **Decision ID** | **PD-S11-08** |
| **Question** | Default Analytics scope for normal counsellor vs Admin / reassignment-authorized user? Peer picker? |
| **Current repository evidence** | No hard-coded Supervisor role (PD-SUP-01). Slice 6 D1: supervisory reassign permission = **`counseling_sessions.reassign`** (Admin seed; **removed from Counsellor** least-privilege). Analytics picker lists counsellors; default today = All. |
| **Existing certified constraints** | PD-ANALYTICS-01; PD-SUP-01; filter ≠ entitlement; no new Supervisor role |
| **Options** | Documented below |
| **Selected option** | **Permission-based defaults + peer picker retained** |
| **Recommended / recorded decision** | |

| Actor class (capability, not role name) | Default Analytics scope |
|------------------------------------------|-------------------------|
| User **without** `counseling_sessions.reassign` (normal counsellor baseline) | **My Work** (`counselorId = current user`) |
| User **with** `counseling_sessions.reassign` (Admin / supervisory grant) | **Authorized Branch** (`counselorId` omitted; label **Authorized Branch**, not “All counselors”) |

Additional rules:

1. **Do not invent a Supervisor role.**
2. Detection for default = **permission check** on `counseling_sessions.reassign` (existing Slice 6 mapping), not role-name heuristics alone.
3. **Peer counselor picker remains available** to any user with `counseling_sessions.read` who can open Analytics — selecting a peer is a **scope filter**, not entitlement.
4. Users may switch between My Work, peer filter, and Authorized Branch within PD16.
5. “Admin can do everything” remains **rejected**; Admin default Branch is convenience, not mutate bypass.

| **Rationale** | Matches PD-ANALYTICS-01 + PD-SUP-01 with an implementable permission signal already in the repo. |
| **Changes certified behavior?** | **No** for authorization model. **Yes for FE default** (today All for everyone). |
| **Downstream implementation impact** | FE: on Analytics mount, if `hasPermission('counseling_sessions.reassign')` → Branch default; else → set counselorId to current user id. Relabel empty option to **Authorized Branch**. |
| **Acceptance criteria** | Counsellor (no reassign): lands on My Work. User with reassign: lands on Authorized Branch. Both can change picker. No new role seeded. |

---

### PD-S11-09 — Date / period semantics

| Field | Value |
|-------|--------|
| **Decision ID** | **PD-S11-09** |
| **Question** | Does My Work use the existing Analytics date model? |
| **Current repository evidence** | Summary/trends presets 7/14/30; API custom from/to; aging independent (default 365); axis = `SessionDate`; Phase 2Z formulas |
| **Existing certified constraints** | PD-ANALYTICS-01: same analytical definitions; PD13–15 unchanged |
| **Options** | Reaffirm existing · Introduce My-Work-specific dates |
| **Selected option** | **Reaffirm existing Analytics date model** |
| **Recommended / recorded decision** | My Work introduces **no** My-Work-specific date calculation. Summary/trends use existing period presets and optional custom range. Aging retains independent existing period semantics and PendingDecision population. Primary reporting date axis remains **`SessionDate`**. |
| **Rationale** | Separate date rules would redesign Phase 2Z without benefit. |
| **Changes certified behavior?** | **No** |
| **Downstream implementation impact** | None to date helpers; reuse `CounselingAnalyticsDateWindow`. |
| **Acceptance criteria** | Same period controls under My Work and Branch; aging period still independent; formula tests unchanged. |

---

### PD-S11-10 — Permission model

| Field | Value |
|-------|--------|
| **Decision ID** | **PD-S11-10** |
| **Question** | Should My Work continue using `counseling_sessions.read` + PD16 branch + `counselorId` filter with filter ≠ entitlement? |
| **Current repository evidence** | All Analytics endpoints use `.read`; no dedicated analytics permission; catalog text already includes analytics |
| **Existing certified constraints** | PD-ANALYTICS-01 filter ≠ entitlement; PD7-PRECEDENCE |
| **Options** | **A** Keep `.read` + filter≠entitlement · **B** New analytics / peer-isolation permission |
| **Selected option** | **A — Keep existing model** |
| **Recommended / recorded decision** | My Work continues to use **`counseling_sessions.read`** + server PD16 branch authorization + optional `counselorId` **scope filter**. Filter is **not** entitlement. **Do not** create a new Analytics permission or peer-isolation permission in Slice 11. Peer-metric isolation, if ever required, is a **separate product/security decision outside ordinary Slice 11**. |
| **Rationale** | Matches certified PD-ANALYTICS-01. Isolation would be a permission-model change, not a scope UX change. |
| **Changes certified behavior?** | **No** |
| **Downstream implementation impact** | No catalog/seed changes for Slice 11. FE must not treat hidden picker as security. |
| **Acceptance criteria** | Analytics still requires `.read`. API still accepts peer `counselorId` within PD16. No new permission codes added in Slice 11. |

---

## 5. Cross-decision consistency matrix

Attribution rule used below: **My Work includes session iff** `CounselorId == currentUser` **and** session in selected PD16 branch resolution **and** `SessionDate` in Analytics window (aging: PendingDecision + aging window) **and** `DeletedAt` null.  
**Branch aggregate** omits counselor filter.  
**Operational queues** are separate surfaces.

| # | Scenario | In My Work? | Why | Ownership field | Date semantics | Queue vs Analytics | Certified rule change? |
|---|----------|-------------|-----|-----------------|----------------|--------------------|------------------------|
| 1 | Unassigned Waiting List | **No** | NULL owner | `CounselorId` NULL | N/A for My Work | Operational WL shared | No |
| 2 | Assigned, not started | **Yes** (if in window/branch) | Stamp matches | `CounselorId` | SessionDate window | Analytics reporting; still on shared WL | No |
| 3 | InProgress | **Yes** (if in window/branch) | Stamp matches | `CounselorId` | SessionDate | Analytics reporting | No |
| 4 | Completed, retains CounselorId | **Yes** (if in window/branch) | Historical attribution | `CounselorId` retained | SessionDate | Analytics reporting — not a todo | No |
| 5 | Completed, CounselorId NULL | **No** | NULL excluded | NULL | — | May appear in Branch aggregate | No |
| 6 | ReQueued previously owned | **No** (immediate) | Cleared stamp | NULL after ReQueue | — | Shared WL unassigned | No (Slice 8 preserved) |
| 7 | Admin-created NULL-owned | **No** | NULL excluded; CreatedBy ignored | NULL; CreatedBy audit only | — | Shared WL | Aligns PD-ADM-01 |
| 8 | Counsellor-created self-owned | **Yes** (if in window/branch) | Self stamp on create | `CounselorId` = actor | SessionDate | Analytics | No |
| 9 | Reassigned A→B | Leaves A My Work; enters B My Work | Stamp moves | New `CounselorId` | SessionDate | Analytics | No |
| 10 | Follow-up Active projection | **Not as Center filter**; may be in Analytics if session stamp+window match | Center shared | Historical stamp display only for Center | SessionDate for Analytics | Center = operational shared | No |
| 11 | Follow-up Cold | Same as Active | Same | Same | Same | Shared Center | No |
| 12 | Finalize Surgery | **No** | Out of My Work personalization | N/A counselling owner on list | N/A | Operational shared | No |
| 13 | Post-Surgery | **No** | Out of Slice 11 personalization | N/A / separate | N/A | Operational shared | No |
| 14 | Cross-branch authorized user | My Work for **selected** authorized branch only | PD-S11-07 | CounselorId + branch filter | SessionDate | Analytics | No |
| 15 | Unauthorized branch | **Denied (403)** | PD16 | — | — | Security | No |
| 16 | Admin (has `.reassign`) | Default **Branch**; may select My Work/peer | PD-S11-08 | Filter when chosen | SessionDate | Analytics | FE default only |
| 17 | Normal counsellor | Default **My Work** | PD-S11-08 | Own CounselorId | SessionDate | Analytics | FE default only |
| 18 | Peer counselor selection | Shows peer’s stamp-attributed metrics | Filter ≠ entitlement | Peer's CounselorId | SessionDate | Analytics | No |
| 19 | Analytics summary | Scope-applied aggregates | PD-S11-01/02/04 | Strict CounselorId when filtered | Existing periods | Reporting | Fallback removal |
| 20 | Analytics trends | Same | Same | Same | Same | Reporting | Fallback removal |
| 21 | Analytics aging | Same + PendingDecision | PD14 unchanged | Strict CounselorId when filtered | Independent aging period | Reporting | Fallback removal |
| 22 | Sessions drill-down | Same attribution predicate as KPIs | PD15 parity = shared predicate | Strict CounselorId when filtered | Drill date params | Reporting list | Fallback removal |

---

## 6. Implementation impact (do not implement in this task)

### Expected in-scope (future implementation prompt only)

**Frontend**

- Default Analytics scope per PD-S11-08 (My Work vs Authorized Branch).
- Relabel “All counselors” → **Authorized Branch**.
- Optional explicit “My Work” label when `counselorId === currentUser`.
- Preserve counselor picker (peer filter).
- Preserve branch selector wiring (PD-S11-07).
- No Waiting List / Follow-up / Finalize UI personalization.

**Backend**

- Remove CreatedBy fallback from Analytics summary/trends/aging/callback counselor joins (PD-S11-04).
- Remove CreatedBy fallback from `GetAllSessions` counselor filter for PD15 parity (same predicate).
- Do **not** change PD13 classifier, date window helpers, or Branch authz.

**Tests (future)**

- My Work default (counsellor).
- Authorized Branch default (`.reassign` holder).
- Strict ownership attribution; NULL excluded.
- CreatedBy-only session excluded from filtered scope.
- ReQueue: Assign → My Work → ReQueue → not in My Work.
- PD13–PD15 formula regression (Branch + My Work scopes).
- PD16 unauthorized branch 403.
- Peer filter still works; not treated as authz.
- Follow-up Center still has no My Follow-ups.

### Must NOT change

- Waiting List shared visibility / no owner filter  
- Follow-up Center model / Slice 10 honesty  
- Finalize / Post-Surgery lists  
- ReQueue mutation semantics / Version CAS  
- Ownership ACL / Assign / Reassign APIs  
- Permission catalog (no new codes)  
- New Supervisor role  
- Phase 2Z metric formulas  
- Ownership History as KPI denominator  
- Slice 12 Leave / Reassignment Required  
- Patient Hub Assigned-to-me  
- New My Work table/queue/assignment entity  

---

## 7. Out of scope

Absolutely out of Slice 11 (decision + future implementation):

- Waiting List owner filtering / private My Work  
- Follow-up Center My Follow-ups / ownership redesign  
- Finalize Surgery / Post-Surgery ownership personalization  
- Leave / Reassignment Required (Slice 12)  
- New Supervisor role  
- New permission catalog entries (unless a later separate security decision)  
- New My Work DB table / counselor queue / assignment entity  
- Ownership history redesign  
- ReQueue / Version / concurrency implementation changes  
- Clinical / quote / decision / insurance workflow changes  
- Analytics formula redesign / Phase 2Z metric redesign  

---

## 8. Acceptance criteria (Slice 11 — for future UAT)

1. Normal counsellor opens Analytics → **My Work** default (own `CounselorId`).  
2. User with `counseling_sessions.reassign` opens Analytics → **Authorized Branch** default.  
3. Scope labels: My Work / Authorized Branch (not “All counselors”).  
4. Filtered counselor scope uses **strict `CounselorId`** only — no CreatedBy.  
5. NULL `CounselorId` sessions absent from My Work; present in Branch aggregate when in window.  
6. Assign → appears in My Work → ReQueue → disappears from My Work; WL unassigned.  
7. Completed sessions with retained `CounselorId` still count in windowed My Work KPIs.  
8. PD13–PD15 formulas unchanged under both scopes.  
9. Follow-up Center unchanged (no My Follow-ups).  
10. Waiting List / Finalize / Post-Surgery unchanged.  
11. Unauthorized branch still 403.  
12. Peer picker remains; filter ≠ entitlement.  
13. No new tables, queues, permissions, or Supervisor role.

---

## 9. Decision resolution checklist

| ID | Resolved? | Selected |
|----|-----------|----------|
| PD-S11-01 | **Yes** | Analytics attribution scope (confirm PD-ANALYTICS-01) |
| PD-S11-02 | **Yes** | All non-deleted attributed sessions in window (incl. Completed) |
| PD-S11-03 | **Yes** | NULL CounselorId excluded from My Work |
| PD-S11-04 | **Yes** | **Remove CreatedBy fallback** (strict CounselorId; PD15 parity = same predicate) |
| PD-S11-05 | **Yes** | ReQueue → immediately leaves My Work |
| PD-S11-06 | **Yes** | Reaffirm shared Follow-up; no My Follow-ups |
| PD-S11-07 | **Yes** | Existing branch selector + PD16; My Work uses selected authorized branch |
| PD-S11-08 | **Yes** | Default by `.reassign` permission; peer picker retained; no new Supervisor role |
| PD-S11-09 | **Yes** | Reaffirm existing date/period semantics |
| PD-S11-10 | **Yes** | Keep `.read` + filter ≠ entitlement; no new permission |

**Unresolved product decisions:** **None.**

---

## 10. Explicit implementation gate

```
AUDIT ✅
PRODUCT DECISION ✅  ← THIS DOCUMENT (WORKING — AGREED FOR IMPLEMENTATION WORKFLOW)
IMPLEMENTATION ❌   ← WAIT FOR SEPARATE EXPLICIT IMPLEMENTATION PROMPT
AUTOMATED TESTS ❌
MANUAL UAT ❌
ACCEPTANCE ❌
NEXT SLICE (12) ❌
```

**Final gate status:** **READY FOR IMPLEMENTATION**

**Mandatory stop rules:**

1. Slice 11 implementation must **not** begin from the readiness audit alone.  
2. This Product Decision Record resolves PD-S11-01…10.  
3. **Do not implement** until a separate explicit implementation approval/prompt.  
4. Do **not** start Slice 12.

---

## 11. Validation for this task

| Check | Result |
|-------|--------|
| Production code changed | **No** |
| DB migration created | **No** |
| API contract changed | **No** |
| Frontend behavior changed | **No** |
| Automated tests added/modified | **No** |
| Files created | This decision record only |

---

**END OF PRODUCT DECISION RECORD — STOP**
)
