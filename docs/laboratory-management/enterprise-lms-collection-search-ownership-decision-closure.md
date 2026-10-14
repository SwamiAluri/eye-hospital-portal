# L-COL-01B — Collection Claim / Assign Ownership + Search Decision Closure

**Date:** 2026-10-09  
**Slice:** L-COL-01B (documentation / product decision closure only)  
**Mode:** DOCUMENTATION ONLY — no application code, schema, permissions, APIs, UI, or role grants changed  
**Upstream diagnostic:** [enterprise-lms-collection-search-ownership-diagnostic.md](./enterprise-lms-collection-search-ownership-diagnostic.md) (`PRODUCT_DECISION_REQUIRED`)  
**Upstream ownership baseline:** PD-COL-16 (shared queue + optional claim/assign) in [enterprise-lms-collection-specimen-decision-closure.md](./enterprise-lms-collection-specimen-decision-closure.md)  
**Implementation report (traceability):** [enterprise-lms-collection-task-implementation-report.md](./enterprise-lms-collection-task-implementation-report.md)

```text
L-COL-01B foundation implemented → Manual UAT (partial)
  ↓
Search + ownership diagnostic (PRODUCT_DECISION_REQUIRED)
  ↓
PD-COL-OWN-* + search defect approval (THIS DOCUMENT)  ← CLOSED
  ↓
Follow-up implementation slice → see enterprise-lms-collection-search-ownership-implementation-report.md
  (`IMPLEMENTATION_COMPLETE_READY_FOR_TARGETED_UAT`)
  ↓
Final UAT + Product Owner waiver → L-COL-01B ACCEPTED
  (enterprise-lms-collection-task-final-uat-audit.md /
   enterprise-lms-collection-task-acceptance-closure.md)
```

**L-COL-01B acceptance (2026-10-09):** **ACCEPTED** — see [enterprise-lms-collection-task-acceptance-closure.md](./enterprise-lms-collection-task-acceptance-closure.md).

---

## Gate determination

# PRODUCT_DECISIONS_CLOSED_IMPLEMENTATION_READY

Ownership interaction rules, Release semantics, assignee eligibility, search defect scope, user-picker deferral, and Specimen/Receiving non-goals are closed for a subsequent **implementation** task. This document does **not** implement those changes.

---

## 1. Evidence reviewed

| Document / asset | Role |
|---|---|
| `enterprise-lms-collection-search-ownership-diagnostic.md` | Actual Claim/Assign/Release/search behavior; proposed PD-COL-OWN-01…05 |
| `enterprise-lms-collection-specimen-decision-closure.md` | PD-COL-16 hybrid queue; leave/reassignment out of first slice |
| `enterprise-lms-collection-specimen-discovery-audit.md` | Queue vs ownership distinction |
| `enterprise-lms-collection-task-implementation-report.md` | L-COL-01B shipped semantics + known GUID limitation |
| `enterprise-lms-collection-task-implementation-audit.md` | Pre-impl audit / API surface |
| Product Owner approvals in this request | Authoritative decision text for PD-COL-OWN-* / search / picker |

---

## 2. Relationship to PD-COL-16

| Field | Content |
|---|---|
| **Parent decision** | **PD-COL-16** — Shared branch-scoped Collection queue with optional claim/assignment |
| **This closure** | Refines PD-COL-16 with enforceable Claim ↔ Assign interaction, Release, assignee eligibility, and worklist display rules |
| **Unchanged from PD-COL-16** | Shared queue visibility ≠ individual ownership; open detail does not claim; create does not auto-assign creator |
| **Still deferred (PD-COL-OWN-04)** | Forced release / manager reassignment / leave workflows |

---

## 3. Product decisions

Status legend: **APPROVED** | **DEFERRED** | **UNCHANGED** (non-goal reaffirmation).

---

### PD-COL-OWN-01 — Accountability

| Field | Content |
|---|---|
| **ID** | PD-COL-OWN-01 |
| **Status** | **APPROVED** |
| **Approved rule** | `AssignedToUserId` = planned allocation of the CollectionTask. `ClaimedByUserId` = active operational ownership. If both exist, **both** are authoritative for their respective meanings (Assigned = planned assignee; Claimed = active claimant/operator). No single field replaces the other. Worklist/detail UX **must not hide Assigned when Claim is present**. |
| **Rationale** | Diagnostic showed UI preferred “Claimed” and hid Assigned when both set, inventing a false single-owner display. Product needs dual semantics preserved for planning vs active operation. |
| **Implementation consequence** | Backend continues to store both fields. FE worklist + detail must show **both** Claimed and Assigned (or clear dual labels) when present. Do not collapse to one ownership chip that suppresses Assigned. |
| **Out-of-scope consequence** | Does not define who may complete transitions solely from ownership (status machine remains separate unless a later PD says otherwise). Does not add force-reassign. |

---

### PD-COL-OWN-02 — Claim / Assign interaction

| Field | Content |
|---|---|
| **ID** | PD-COL-OWN-02 |
| **Status** | **APPROVED** |
| **Approved rule** | See matrix below. Blocked Claim/Assign interactions use **409 ownership conflict** semantics. Assignment must not silently clear an active claim. Claim must not silently change `AssignedToUserId`. |
| **Rationale** | Current code allows Claimed-by-A + Assigned-to-B and first Assign while another user holds claim — unsafe coexistence. PO defines a consistent exclusivity model while keeping both fields meaningful when they agree. |
| **Implementation consequence** | Enforce rules in `CollectionService.ClaimAsync` / `AssignAsync` (and tests). Map violations to **409** with an ownership-conflict code (align naming with existing `claim_conflict` / `assign_conflict` family; do not invent silent success). |
| **Out-of-scope consequence** | No schema change. No new endpoints. No manage force-override (see PD-COL-OWN-04). |

**Interaction matrix (authoritative):**

| # | Precondition | Allowed action | Result / rejection |
|---|---|---|---|
| 1 | Unassigned + Unclaimed | Any authorized collector may **Claim** | Claimed by actor |
| 2 | Assigned to User A + Unclaimed | **Only User A** may Claim | Others → **409** ownership conflict |
| 3 | Unassigned + Claimed by User A | Another user may **not Assign** while claim active | Assign → **409** ownership conflict |
| 4 | Assigned to User A + Claimed by User A | Valid state | Retain both |
| 5 | Assigned to User A + Claimed by User B | **Not permitted** | Must be prevented by Claim/Assign rules (never reachable via allowed APIs) |
| 6 | Assigned to another user | Actor may **not Claim** | **409** ownership conflict |
| 7 | Active claim present | Assign must **not** silently clear claim | N/A (forbidden or no-op only per rules 3/4) |
| 8 | Claim | Must **not** silently change `AssignedToUserId` | Claim updates claim fields only |

**Gap vs current L-COL-01B code (diagnostic; not fixed here):**

| Area | Current behavior | Required after implementation |
|---|---|---|
| Claim when Assigned to other | Allowed | **Blocked** (409) |
| Assign while Unassigned + Claimed by other | Allowed (first assign) | **Blocked** (409) |
| Assigned A + Claimed B | Reachable today | **Forbidden** |

---

### PD-COL-OWN-03 — Release

| Field | Content |
|---|---|
| **ID** | PD-COL-OWN-03 |
| **Status** | **APPROVED** |
| **Approved rule** | Release clears **only** `ClaimedByUserId` and `ClaimedAt`. Release does **not** clear `AssignedToUserId` / `AssignedAt`. Therefore Assigned A + Claimed A → Release → Assigned A + Unclaimed. **Only the active claimant** may release their claim. |
| **Rationale** | Matches shipped Release behavior and PD-COL-16 “leave/reassignment out of first slice”; preserves planned allocation after operational release. |
| **Implementation consequence** | Keep Release semantics as approved (claim-only clear + claimant-only). Ensure FE dual display still shows Assigned after Release. Confirm 403 for non-claimer release remains. |
| **Out-of-scope consequence** | No forced release. No clear-on-release of assignment. No manager override in this slice. |

---

### PD-COL-OWN-04 — Force reassign

| Field | Content |
|---|---|
| **ID** | PD-COL-OWN-04 |
| **Status** | **DEFERRED** |
| **Deferred rule** | Do **not** implement forced release or manager reassignment in L-COL-01B. Later explicit ownership/reassignment slice. |
| **Rationale** | PD-COL-16 already deferred leave/reassignment; diagnostic confirmed manage cannot force-release today. Expanding now risks clinical/ops misuse without workflow design. |
| **Implementation consequence** | No new APIs, permissions, or UI for force-release/reassign in the follow-up ownership fix. |
| **Out-of-scope consequence** | Managers cannot take over a stuck claim in-product until a future slice; operational workaround remains out-of-band / future PD. |

---

### PD-COL-OWN-05 — Assignee eligibility

| Field | Content |
|---|---|
| **ID** | PD-COL-OWN-05 |
| **Status** | **APPROVED** |
| **Approved rule** | A CollectionTask assignee must be: same tenant; active; not soft-deleted; **authorized for Collection work via `lms.collection.collect`**. Do not allow arbitrary active tenant users who cannot perform Collection work. Do not invent a new role. Do not add role grants in this decision closure. |
| **Rationale** | Diagnostic showed Assign accepts any active same-tenant user via validate-user (existence + active only). Planned assignees who cannot collect create false allocation. |
| **Implementation consequence** | On Assign, after/with platform user validation, **require** the target user to hold `lms.collection.collect` (capability check via existing Auth/permission infrastructure — extend internal validation as needed). Reject ineligible assignees with a clear 400/409 domain code. **No** new permission codes. **No** role grants seeded by this closure. UAT still relies on existing temporary/admin grants. |
| **Out-of-scope consequence** | Does not grant `lms.collection.collect` to roles. Does not build a user picker (see User picker). Does not require assignees to hold `lms.collection.manage`. |

---

### PD-COL-SEARCH-01 — TaskNumber search case-insensitivity

| Field | Content |
|---|---|
| **ID** | PD-COL-SEARCH-01 |
| **Status** | **APPROVED** (defect fix) |
| **Approved rule** | Collection task-number search must be **case-insensitive** and aligned with accepted Orders worklist behavior (`ToLower` + contains). Search scope remains **`TaskNumber` only**. |
| **Rationale** | Diagnostic: EF `Contains` → PostgreSQL case-sensitive match; lowercase search returns empty; Orders already case-insensitive. |
| **Implementation consequence** | Change `CollectionService.ListAsync` search filter to case-insensitive TaskNumber contains; add/adjust automated tests. |
| **Out-of-scope consequence** | Do **not** expand search to OrderNumber, patient name, MRN, GUID, or other fields. Do **not** add debounce / stale-response FE changes in the ownership/search fix unless separately scheduled. |

---

### PD-COL-UX-01 — Assign user picker

| Field | Content |
|---|---|
| **ID** | PD-COL-UX-01 |
| **Status** | **DEFERRED** |
| **Deferred rule** | Raw User GUID assignment remains acceptable for controlled UAT. A searchable staff picker is a later UX slice. |
| **Rationale** | Known L-COL-01B limitation; controlled UAT can paste GUIDs; picker is UX expansion beyond ownership semantics. |
| **Implementation consequence** | Keep GUID input for now; eligibility (OWN-05) still enforced server-side on the GUID. |
| **Out-of-scope consequence** | No staff directory API/UI in the follow-up ownership/search implementation task. |

---

### PD-COL-SPC-BOUND — Specimen / Receiving boundary

| Field | Content |
|---|---|
| **ID** | PD-COL-SPC-BOUND |
| **Status** | **UNCHANGED** |
| **Approved / reaffirmation rule** | Do not implement Specimen, accession, barcode, label, receiving, custody, aliquots, or referral receiving in L-COL-01B ownership/search follow-up. |
| **Rationale** | AD-COL-10 / L-COL-01B non-goals; Manual UAT already observed no Specimen/Receiving behavior. |
| **Implementation consequence** | Ownership/search fix must not introduce Specimen or Receiving surfaces. |
| **Out-of-scope consequence** | Clinical collection-complete / Specimen birth remains a later approved slice. |

---

## 4. Implementation readiness checklist (for a later task)

When an implementation task is authorized, it should deliver **only**:

1. **PD-COL-SEARCH-01** — case-insensitive TaskNumber search (Orders-aligned).  
2. **PD-COL-OWN-01** — FE shows Assigned and Claimed independently when both set.  
3. **PD-COL-OWN-02** — Claim/Assign 409 ownership rules per matrix.  
4. **PD-COL-OWN-03** — confirm Release claim-only + claimant-only (already largely correct).  
5. **PD-COL-OWN-05** — assignee must have `lms.collection.collect` (no new roles/grants).  
6. Automated tests covering matrix rows + search case + ineligible assignee rejection.  
7. Targeted Manual UAT re-check (search + ownership scenarios).

**Must not** in that task: PD-COL-OWN-04 force reassign; PD-COL-UX-01 picker; search expansion; debounce unless separately approved; Specimen/Receiving; L-COL-01B acceptance stamp without UAT.

**Likely files (preview only — not changed now):**

| Area | Files |
|---|---|
| Search + ownership rules | `LaboratoryApi/Services/CollectionService.cs` |
| Assignee capability check | `PlatformReferenceClient` / Auth internal LMS validate path (extend existing; no new role) |
| Tests | `LaboratoryApi.Tests/CollectionServiceTests.cs` (+ Auth tests if validate extended) |
| Dual ownership UX | `CollectionWorkbench.tsx`, `CollectionTaskDetailSheet.tsx` |

---

## 5. Decision register

| ID | Title | Status |
|---|---|---|
| PD-COL-OWN-01 | Accountability (Assigned vs Claimed) | **APPROVED** |
| PD-COL-OWN-02 | Claim / Assign interaction | **APPROVED** |
| PD-COL-OWN-03 | Release | **APPROVED** |
| PD-COL-OWN-04 | Force reassign | **DEFERRED** |
| PD-COL-OWN-05 | Assignee eligibility (`lms.collection.collect`) | **APPROVED** |
| PD-COL-SEARCH-01 | Case-insensitive TaskNumber search | **APPROVED** (defect) |
| PD-COL-UX-01 | Staff / collector picker | **DEFERRED** |
| PD-COL-SPC-BOUND | Specimen / Receiving | **UNCHANGED** (non-goal) |

---

## 6. Confirmation — documentation only

- No application code modified.  
- No schema / migration changes.  
- No permission definition or role grant changes.  
- No API or UI changes.  
- Search fix **not** implemented.  
- Ownership behavior **not** implemented.  
- L-COL-01B **not** marked accepted.

---

## FINAL STATUS

**PRODUCT_DECISIONS_CLOSED_IMPLEMENTATION_READY** (decision-era gate; unchanged)

**Downstream acceptance (2026-10-09):** **L-COL-01B ACCEPTED** — [acceptance closure](./enterprise-lms-collection-task-acceptance-closure.md).

**STOP.** Do not start Specimen or Receiving.
