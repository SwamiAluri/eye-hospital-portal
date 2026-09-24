# Phase 3I Slice 13 Package B — Counselling Sessions Pagination & UX Purpose Audit

| Field | Value |
|-------|--------|
| **Document date** | 2026-09-22 |
| **Mode** | **AUDIT ONLY** — no production code modified |
| **Route** | `/dashboard/counsellors-desk/sessions` |
| **RR route** | `/dashboard/counsellors-desk/sessions?reassignmentRequired=true` |
| **Product Decision SoT** | `docs/audits/counsellor-ownership-work-allocation-phase3i-slice13-product-decisions.md` |
| **Package B decisions (unchanged)** | **PD-S13-A = C** · **PD-S13-B = B** · **PD-S13-D = C** |
| **Related reports** | `phase3i-slice13-package-b-implementation-report.md`, `phase3i-slice13-package-b-ux-remediation-report.md` |

---

## Final status

**PAGINATION / UX PURPOSE AUDIT COMPLETE**  
**NO IMPLEMENTATION PERFORMED**  
**READY FOR BOUNDED IMPLEMENTATION** (classification **B** — Product Decision still required for page-size / page-state URL policy)

---

## 1. Executive summary

Counselling Sessions already uses a **server-side paginated API**. The backend filters (including Reassignment Required), sorts, counts, then `Skip`/`Take`s. The response returns `TotalCount`, `Page`, `PageSize`, and `TotalPages`.

The Sessions UI currently **hard-codes `page: 1` and `pageSize: 50`**, displays `totalCount` in the header, and renders only the returned page with a scrollable table and **no pagination controls**.

Therefore:

- Pagination is **not** a new API/business-rule problem.
- It is a **frontend exposure gap** against an existing contract.
- RR filtering already runs **before** pagination on the server (desired order).
- Exact default page size and whether `page` lives in the URL are **Product Decisions** (evidence shows multiple Counsellor defaults: 10 / 20 / 50).

**Classification: B — EXISTING API SUPPORT**

---

## 2. Current Sessions architecture

| Layer | Location | Role |
|-------|----------|------|
| Page | `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/sessions/page.tsx` | List UI, RR pill, Open / Reassign, empty states |
| Hook | `apps/hospital-portal-web/src/hooks/use-counseling-sessions.ts` → `useCounselingSessions` | TanStack Query wrapper |
| FE API | `apps/hospital-portal-web/src/lib/api/counseling-sessions.api.ts` → `getAll` | `GET /counseling/sessions?...` |
| Controller | `microservices/auth-service/AuthService/Controllers/CounselingController.cs` → `GetAllSessions` | `[FromQuery] SessionFilters`, PD16 branch scope |
| Service | `CounselingWorkflowService.GetAllSessionsAsync` | Filters → RR → Count → Order → Skip/Take → DTO |
| Models | `CounselingWorkflowModels.cs` → `SessionFilters`, `SessionListResponse` | Page defaults + response metadata |
| RR FE helpers | `reassignment-required-filter.ts`, `sessions-rr-reassign.ts` | Query toggle; Reassign CTA gating |

**Current FE list request (evidence):**

```ts
// sessions/page.tsx
page: 1,
pageSize: 50,
```

Plus optional filters including `reassignmentRequired` when the RR pill is active.

---

## 3. Current API pagination contract

### Request

| Parameter | Supported? | Evidence |
|-----------|------------|----------|
| `page` | **Yes** | FE appends `page`; BE `SessionFilters.Page` default **1** |
| `pageSize` | **Yes** | FE appends `pageSize`; BE `SessionFilters.PageSize` default **20** |
| `offset` / `limit` | **No** | Not present; pagination is page/pageSize + `Skip`/`Take` |

Model defaults (`CounselingWorkflowModels.cs`):

```csharp
public int Page { get; set; } = 1;
public int PageSize { get; set; } = 20;
```

Controller list endpoint binds the full `SessionFilters` from query (`GetAllSessions([FromQuery] SessionFilters filters)`).

### Response (`SessionListResponse`)

| Field | Present? | Notes |
|-------|----------|-------|
| `Sessions` | Yes | Page of rows |
| `TotalCount` | Yes | Count **after** filters (incl. RR) |
| `Page` | Yes | Echo of requested page |
| `PageSize` | Yes | Echo of requested page size |
| `TotalPages` | Yes | `Ceiling(TotalCount / PageSize)` |
| `hasNext` / `hasPrevious` | **No** | Derive from `Page` / `TotalPages` |

FE type `SessionListResponse` already models `totalCount` / `page` / `pageSize` / `totalPages` (camel + Pascal aliases).

### Sorting

Server-side, deterministic:

```csharp
.OrderByDescending(s => s.SessionDate)
.ThenByDescending(s => s.CreatedAt)
.Skip((filters.Page - 1) * filters.PageSize)
.Take(filters.PageSize)
```

No FE sorting of the Sessions list.

### Defaults / limits

| Item | Value | Evidence |
|------|-------|----------|
| Model default page size | **20** | `SessionFilters.PageSize = 20` |
| Sessions UI current request | **50** | `sessions/page.tsx` |
| Patient-sessions helper | **50** | `GetPatientSessions` hard-codes `PageSize = 50` |
| Max page size clamp on Sessions list | **None found** | Unlike Follow-up (`FollowupQueryContracts.MaxPageSize = 100`) |
| Returns entire authorized population? | **No** (when pageSize applied) | Always `Take(PageSize)` after filters |

### Is pagination supported but unused by UI?

**Yes.** The UI already sends `page`/`pageSize` and reads `totalCount`, but never changes `page` and never renders pagination chrome. If `TotalCount > 50`, the header count can exceed visible rows with no way to advance pages.

---

## 4. Current RR filtering semantics

### Where `reassignmentRequired=true` is applied

1. **FE:** Sessions page reads URL → `parseReassignmentRequiredParam` → sets `filters.reassignmentRequired` → API appends `reassignmentRequired=true`.
2. **BE:** `GetAllSessionsAsync` applies `ApplyReassignmentRequiredFilter` when `filters.ReassignmentRequired == true` **before** `CountAsync` / `Skip` / `Take`.

### Order (actual current behavior)

```text
Authorized branch/tenant scope + other SessionFilters
    ↓
Reassignment Required filter (when true)   ← server
    ↓
Count → TotalCount
    ↓
OrderBy SessionDate DESC, CreatedAt DESC
    ↓
Skip / Take (page, pageSize)
    ↓
UI (currently always page 1)
```

**Classification of RR vs pagination:** **A — before pagination on the server.**

Not frontend-filtered for the list population. Reassign CTA gating (`canShowSessionsRrReassign`) is a separate UI rule that requires the RR filter to be on; it does not redefine RR membership.

Desired semantics from the audit brief match the current server path. **Do not change this.**

---

## 5. Existing pagination patterns

| Surface | Style | Component / helper | Page size | Notes |
|---------|-------|--------------------|-----------|-------|
| Waiting List | **Client-side** slice of already-loaded queue | `WaitingListQueuePagination` + `waiting-list-pagination.ts` | Default **10**; options **10 / 25 / 50** | Presentational; not a Sessions API pattern |
| Follow-up Center | **Server-side** page | Inline Prev/Next footer; `FOLLOWUP_PAGE_SIZE = 20` in `use-counsellors-desk-queries.ts`; uses `getWaitingListTotalPages` for display math | **20** fixed | Closest behavioural match to Sessions API |
| Finalize Surgery | Reuses Waiting List pagination helpers | `WaitingListQueuePagination` | Same as WL | Client-side |
| Generic shadcn | `components/ui/pagination.tsx` | Generic `Pagination` | Caller-defined | Not used by Counsellor Sessions/WL/Follow-up today |

**Reuse recommendation (bounded, not implemented):** Prefer Follow-up’s **server page + quiet footer** pattern and/or presentational reuse of `WaitingListQueuePagination` **driven by server `TotalCount` / current page** (do **not** client-slice a fake full list). Do **not** invent a new pagination component unless Product rejects reuse.

---

## 6. Sessions UX purpose

**Purpose (from Package B + current implementation):** operational entry to existing counselling-session records.

| Aspect | Current support |
|--------|-----------------|
| Find session → Open | Yes — Open is primary CTA |
| Columns Patient / Session date / Surgery / Decision / Action | Yes |
| Not a new worklist / lifecycle / dashboard | Yes — same route + list DTO |
| Compact count metadata | Yes — header `totalCount` |

Aligned with Package B intent for normal mode.

---

## 7. RR UX purpose

**Purpose:** filtered remediation view of certified Slice 12 RR sessions on the **same** Sessions route.

| Aspect | Current support |
|--------|-----------------|
| Same route + `?reassignmentRequired=true` | Yes |
| Not a second worklist / route / lifecycle state | Yes (PD-S13-B = B) |
| Identify → Review → Reassign | Yes when gating satisfied |
| Open secondary | Yes (Open always; Reassign conditional) |
| Not Waiting List replacement | Yes (PD-S13-D = C; WL eligibility unchanged) |
| Not Analytics My Work | Yes |

**Open Product Decision (presentation only, not ownership):** whether RR empty / dense populations need additional chrome beyond current empty copy — **not** required for pagination classification.

---

## 8. Current data-scale evidence

| Question | Finding |
|----------|---------|
| Exact normal-mode production volume | **Unavailable** in repo/docs for this audit |
| Exact RR production volume | **Unavailable**; tests use small fixtures (`Phase3ISlice12ReassignmentRequiredTests`) |
| Practical UI upper bound today | **50 rows** (`pageSize: 50`, `page: 1`) |
| API upper bound | No Sessions-specific max clamp found; unbounded `PageSize` theoretically possible |
| Is rendering “all sessions” appropriate? | UI never requests “all”; it requests one page of 50. Showing `totalCount` without paging is misleading when `TotalCount > PageSize` |

**Conclusion:** Lack of production telemetry does **not** justify classification D. The contract already paginates; the UI gap is structural (silent truncation risk).

---

## 9. Navigation / state behavior

| Action | Current behavior |
|--------|------------------|
| Open session | `router.push(/dashboard/counsellors-desk/{id}?from=sessions)` — **no list page param** |
| Return via header Back | `router.back()` — restores prior history entry if present |
| Toggle RR | `router.replace` with `toggleReassignmentRequiredInSearchParams` — preserves other query params; **no page state today** |
| Browser refresh | URL filters restored; always reloads **page 1** (hard-coded) |
| Back/Forward | Driven by browser history of `replace`/`push` URLs |
| Query param changes | Refetch via React Query key including filters |

**If pagination is introduced, state to consider (recommendation only):**

- Current `page` (and optionally `pageSize`)
- Preserve page across Open → Back **or** reset to 1 (Product Decision)
- Reset page to **1** when RR toggle / other filters change
- Prefer URL `page` for refresh/shareability (aligned with RR query pattern) vs React state only

---

## 10. Reassign interaction implications

Existing mutation path (unchanged by this audit):

- API: existing Reassign
- Dialog: `WaitingListReassignDialog`
- Permission: `counseling_sessions.reassign`
- Ownership: `CounselorId`
- CAS/version + 409 + Ownership History + PD16: preserved via dialog/service

Post-action today: `refetch()` on success and ownership conflict; close clears local dialog state.

**Pagination implications (recommendations only):**

| Event | Implication |
|-------|-------------|
| Successful Reassign | Refetch current page; if page becomes empty and `page > 1`, clamp to last available page |
| 409 conflict | Existing dialog refresh + list `refetch` — keep; then same empty-page clamp |
| Failed Reassign | No list mutation required |
| Dialog close without submit | No page change |

Do **not** change mutation semantics to “solve” pagination.

---

## 11. Empty-state behavior

| Case | Current |
|------|---------|
| Normal Sessions, zero rows | Title + secondary (“No sessions match these filters”) |
| RR Sessions, zero rows | “No sessions require reassignment” + “None match the Reassignment Required filter.” |
| Last row removed from a page after Reassign | **N/A today** (always page 1). With multi-page UI, need clamp/empty handling |

Existing empty patterns are sufficient for A/B; last-page-empty is a future pagination edge case only.

---

## 12. UX consistency findings

| Dimension | Sessions vs Waiting List / Follow-up |
|-----------|--------------------------------------|
| Page chrome | Aligned after UX remediation (`shellPage` density) |
| Table density | Improved; still HTML table vs WL CSS grid — acceptable |
| Pagination | **Gap** — WL/Follow-up have footers; Sessions does not |
| Count display | Sessions shows total only; WL/Follow-up show “Showing X–Y of Z” when paginated |
| Action hierarchy | Open primary / Reassign secondary — aligned with Package B UX approval |
| Filter treatment | RR pill aligned with Follow-up pills |
| Empty state | Aligned two-line pattern |
| Responsive | Surgery collapses under patient on small widths |

**Pagination is the primary remaining structural gap** supported by API evidence. Other polish items are not required for this gate.

---

## 13. Pagination classification

### **B — EXISTING API SUPPORT**

API already supports pagination; UI does not expose page navigation; frontend implementation is bounded; **no backend business-rule / RR / ownership change required**.

---

## 14. Evidence supporting classification B

1. `SessionFilters` / `SessionListResponse` already define page metadata (`CounselingWorkflowModels.cs`).
2. `GetAllSessionsAsync` already `Count` → `Order` → `Skip`/`Take` → returns `TotalPages`.
3. FE `counseling-sessions.api.ts` already sends `page` / `pageSize` and types response metadata.
4. Sessions page hard-codes `page: 1`, `pageSize: 50` and never updates `page`.
5. RR is applied **before** pagination on the server (`ApplyReassignmentRequiredFilter` then `CountAsync`).
6. No missing DTO fields are required for a basic Prev/Next or page-number footer.
7. Not **A** alone: client-side slicing of a full population is **not** how Sessions works today (and would be wrong if TotalCount ≫ pageSize).
8. Not **C**: no API/business change required for basic paging.
9. Not **D**: silent first-page truncation + existing Counsellor pagination patterns justify wiring UI to the existing contract.

---

## 15. Smallest recommended next implementation

**Scope (recommendation only — not implemented):**

1. Drive `page` from UI state (preferably URL query `page`) instead of hard-coded `1`.
2. Keep server `pageSize` at a Product-chosen value (see §16).
3. Render a quiet footer when `totalCount > pageSize` (Follow-up Prev/Next **or** `WaitingListQueuePagination` with `itemLabel="sessions"`, fed by server totals — **no client slice of incomplete data**).
4. Reset `page` to 1 when RR / other filters change.
5. After Reassign `refetch`, clamp page if current page exceeds `TotalPages`.
6. Preserve certified gating, dialog, Open primacy, RR semantics.
7. Focused FE tests: page query → API filters; RR still before page; no ReQueue; gating unchanged.

**Do not:** change backend, RR predicate, ownership, permissions, Waiting List, or invent a new design system.

---

## 16. Product Decisions required

| ID | Question | Why not invent |
|----|----------|----------------|
| **PD-S13-PAG-01** | Sessions default `pageSize`? Candidates from evidence: **20** (API/Follow-up default), **50** (current Sessions UI request), or WL-style selectable **10/25/50** | Multiple live Counsellor defaults exist |
| **PD-S13-PAG-02** | Persist `page` in URL vs React state only? | Affects refresh / Back / deep-link from Analytics filters |
| **PD-S13-PAG-03** | After Open → return, restore prior page or reset to 1? | `from=sessions` today does not encode page |
| **PD-S13-PAG-04** (optional) | Enforce a Sessions `MaxPageSize` on backend (Follow-up has 100)? | Not required to ship FE paging; security/perf hygiene only |

Until PD-S13-PAG-01 (and preferably PAG-02) are accepted, implementers must not invent page size.

---

## 17. Explicit out-of-scope confirmation

This audit did **not** modify:

- backend / API / DTOs / database / migrations  
- permissions / ownership / RR detection  
- Waiting List / Follow-up / Analytics / Dashboard  
- Sessions UI / pagination implementation  
- new worklist / route / pagination component / design system  

Certified Package B / Slice 12 behaviors remain locked as listed in the audit brief.

---

## 18. Final gate recommendation

| Gate | Recommendation |
|------|----------------|
| Next | Accept **PD-S13-PAG-01** (+ **PAG-02** recommended) |
| Then | Bounded **frontend-only** Sessions pagination implementation against existing API (**classification B**) |
| Do not | Start API redesign, change RR order, or claim Delivery Acceptance from this audit |
| Manual UAT / Delivery | Still gated on prior UX remediation Manual UAT + any pagination UAT after implementation |

---

## Git safety (this task)

Intended artifact of this task:

- `docs/audits/phase3i-slice13-package-b-pagination-audit.md` **only**

No production code changes authorized or performed under this audit.
