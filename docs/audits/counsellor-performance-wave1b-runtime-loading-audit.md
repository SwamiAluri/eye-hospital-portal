# Counsellor Performance — Wave 1B Runtime and Loading UX Audit

| Field | Value |
|-------|--------|
| **Status** | **AUDIT COMPLETE — NO IMPLEMENTATION AUTHORIZED** |
| **Date** | 2026-09-26 |
| **Type** | Read-only audit |
| **Follows** | Performance Wave 1 implementation (`counsellor-performance-wave1-implementation-report.md`) |
| **Production code** | **NONE MODIFIED** |
| **Tests** | **NONE MODIFIED** |
| **Manual UAT** | **NOT EXECUTED** by this audit |
| **Acceptance** | **NOT RECORDED** |
| **Implementation Authorization** | **NOT CREATED** |

This audit explains remaining navigation, row-click, and loading behavior after Wave 1. It does not authorize a fix.

---

## 1. Status

Code was inspected. No production file, test, API, DTO, database object, permission, route, or visual token was changed.

User-reported slowness from Manual UAT is the reason for the audit. This session did not repeat that UAT and did not time the browser.

---

## 2. Audit date

2026-09-26.

---

## 3. Scope

Routes:

- `/dashboard/counsellors-desk/waiting-list`
- `/dashboard/counsellors-desk/sessions`
- `/dashboard/counsellors-desk/finalize-surgery` (Finalize Surgery and OT Preparation)
- `/dashboard/counsellors-desk/surgery-followup`
- `/dashboard/counselor/analytics`

Also inspected: Waiting List row activation, demographics modal import, Finalize row open, `FinalizeOtModal` fetch, shared `dashboard/layout.tsx` token gate, and Wave 1 gates.

**MEASURED** means read from source. **INFERRED** means a likely effect of that source. **UNKNOWN** means a trace is still required. **UNAVAILABLE — TOOLING LIMITATION** means this environment has no browser performance tooling, so no duration was captured.

---

## 4. Existing Performance Wave 1 baseline

Wave 1 implemented PERF-02, PERF-03, and PERF-05, and protected PERF-04 Option A. Its implementation report recorded browser timings as **UNAVAILABLE**. That baseline is unchanged. This audit does not add millisecond or percentage claims.

Wave 1 did not define a loading-state standard. The loading gaps below are separate from those packages.

---

## 5. Navigation traces

Shared path for every dashboard route, including these five:

1. Navigation click in the existing sidebar.
2. App Router transition. `apps/hospital-portal-web/src/app/dashboard/loading.tsx` renders `DashboardLoadingSkeleton`.
3. `dashboard/layout.tsx` returns that same skeleton until `isClient` and a token exist, then mounts `Sidebar` and `TopNav`.
4. The page mounts inside `ProtectedRoute`.
5. Each page starts its own TanStack queries.
6. Response updates query state, client filters run where they already do, then the worklist or charts render.

| Route | First queries after mount | Data-bearing UI gate | Cost class from source |
|-------|---------------------------|----------------------|------------------------|
| Waiting List | `GET /Counseling/waiting-list` (`useWaitingListQuery`). OT-return calls are gated (PERF-02) | Worklist skeleton while `isLoading && patients.length === 0`. Summary cards render immediately from `tabCounts` | Network or server for the queue. Client filter after the array arrives. Shared token gate is separate |
| Sessions | Paged `useCounselingSessions` | `isPending` shows “Loading sessions…”. Empty copy only after that | Network or server for one page. Not a full population dump |
| Finalize | Filtered `useFinalizeListQuery`. Catalog query stays disabled until OT Preparation (PERF-03) | Worklist skeleton while the filtered list is loading. Summary cards render `statsBar` immediately | Network or server for the filtered list. Client tab filter on the downloaded array |
| OT Preparation | Same page. Catalog query enables when `activeWorkspace === 'ot-preparation'` | Catalog worklist skeleton while `catalogQuery.isLoading && catalogRecords.length === 0`. Summary still shows `otPrepFiltered.length` | Same undated catalog request, now on workspace switch |
| Follow-up | Stats plus the active list. Cold and Post-Surgery stay disabled until that tab is selected | KPI strip uses `—` while `statsQuery` is pending. List skeleton while the current list is loading | Network or server. Tab waterfall only after a later tab |
| Analytics | Summary, trends, aging, counsellor picker in parallel (PERF-05 still one aggregation inside aging) | `isPending` shows pulse blocks and hides KPI numbers. Charts render only inside `{data && …}` | Slowest of the parallel calls. Recharts remains in this route module |

Navigation duration, first meaningful content time, skeleton duration, request duration, response bytes, cache hit, and main-thread cost: **UNAVAILABLE — TOOLING LIMITATION**.

**INFERRED:** On a later click inside an already-authorized dashboard, the layout token gate often does not replay, so the remaining wait is that page’s query plus render. The shell is still a shared first-load cost. It does not by itself explain why Finalize or Waiting List can feel heavier than Sessions. That split was already in the deep audit and is still untimed.

---

## 6. Patient-click traces

### A. Waiting List row

**MEASURED.** `WaitingListWorkRow` calls `onRowClick`. `handleRowClick` in `waiting-list/page.tsx`:

- Sets `selectedId`.
- If the row is eligible for initial assign and the user can assign, it sets `assignPatient` and returns. That is an assign dialog, not a patient chart.
- Otherwise it calls `navigateToSession`, which `router.push`es `/dashboard/counsellors-desk/{sessionId}?from=waiting-list` and may call `counsellingAzureApi.start` for Pending or Repeat Counselling.

The row click is a **route change into the counselling session**, not a Waiting List modal. Demographics is a different control: `handleDemographics` sets state, and `PatientFormModal` is a `dynamic()` import. Add Patient is also `dynamic()`. Those chunks are not on the ordinary row path.

Where delay can sit, from source, without a clock:

| Step | Evidence grade |
|------|----------------|
| Click handler and selection state | **MEASURED** local state. Duration **UNKNOWN** |
| Assign dialog, only on the eligible path | **MEASURED** state. No list refetch in the click itself |
| Session route navigation and that page’s own load | **MEASURED** `router.push`. Time **UNKNOWN**. This is the likely user-visible wait for a normal row. **INFERRED**, not timed |
| Azure start call | **MEASURED** fire-and-forget before navigation for some statuses. Duration **UNKNOWN**. It is not awaited |

The modal is not the bottleneck for the ordinary row. The audit does not claim the session API is the bottleneck either. Both remain **UNKNOWN** until a click trace exists.

### B. Finalize row

**MEASURED.** `openRow` sets `selectedId` and `modalOpen`. `FinalizeOtModal` is already mounted (PERF-06 was not implemented). `isOpen` false returns `null`, so the dialog is not visible until open.

On open, an effect runs `Promise.all` of:

- `getOtScheduleDetail(scheduleId)`
- `getSurgeons()`
- `getOtTheaters()`
- `getAnesthetists()`

While `isLoading` is true, the dialog shell is visible with pulse placeholders in the header and body. Content replaces that when the slowest of those four calls finishes.

| Step | Evidence grade |
|------|----------------|
| Click to visible dialog shell | **MEASURED** state toggle of an already imported component. Milliseconds **UNKNOWN** |
| Detail content | **MEASURED** four parallel requests. Which one dominates **UNKNOWN** |
| Lazy chunk | **Not on this path.** Static import |

Do not treat the modal mount as the open delay. Do not treat a single API as proven. The open path’s network fan-out is real source evidence. Its wall-clock share is **UNKNOWN**.

---

## 7. Loading-state matrix

| Surface | State | Indicator | Visible | Content underneath | Empty before resolve | Misleading zero | Skeleton matches final | Blocks whole page | Localized | Accessible status | Consistent |
|---------|-------|-----------|---------|--------------------|----------------------|-----------------|------------------------|-------------------|-----------|-------------------|------------|
| Shared shell | Token missing | `DashboardLoadingSkeleton` | Yes | No page yet | No operational zero | No | Shell, not the Counsellor layout | Yes | Shared, not the page | Pulse only, not `role="status"` | All staff routes |
| Waiting List worklist | Initial / refetch with no rows | 7-row pulse grid, `aria-hidden` | Yes | No | No. `queueEmpty` requires `!isLoading` | No | Yes, worklist columns | No. Summary stays up | Worklist only | Hidden from assistive tech | Same pulse idea as Follow-up and Finalize |
| Waiting List summary | Same initial load | None. `tabCounts[key] ?? 0` | Numbers | Cards are the final cards | Counts look final | **Yes, 0 while the queue request is pending** | No | No | Cards are not marked loading | No loading semantics | Differs from Follow-up `—` and Analytics pulse |
| Waiting List refresh | `isFetching` with rows | “Refreshing” spinner in the footer | Yes if footer shows | Rows stay | No | No | N/A | No | Footer | Text, not tied to the grid | Unique copy |
| Waiting List OT Returned | Tab selected | Same worklist skeleton via `otReturnedLoading` | Yes | No | Empty only after load finishes with zero rows | Summary OT Returned count is `otReturnedRows.length`, so **0 until that deferred load finishes** | Yes for the list | No | List | `aria-hidden` skeleton | Tab lazy load is correct; the count card is early |
| Waiting List row | Click | None on the row | No | Navigation or assign dialog | N/A | N/A | N/A | No | None | No pending state | Sessions Open also has no row spinner |
| Sessions | Initial | Spinner and “Loading sessions…”, `role="status"` | Yes | No list | Empty only when `!isPending` | No list count pills | Text center, not a row skeleton | The list region | Yes | **Yes** | Different from the pulse grids |
| Sessions | Error | Alert and Retry | Yes | No list | No | No | N/A | List region | Yes | `role="alert"` | Clearer than Finalize catalog |
| Finalize worklist | Initial | Local `WorklistSkeleton` | Yes | No | “No records found” only when `!isLoading` | No in the list | Pulse rows | List region | Yes | `aria-hidden` | Like Waiting List |
| Finalize summary | Same | None. `statsBar` from `records` | 0, 0, 0 | Final card chrome | **Yes** | **Yes while the filtered list is pending** | No | No | No loading flag | No | Same defect as Waiting List cards |
| OT Preparation | Catalog fetch | Worklist skeleton while `isLoading` | Yes | No rows | “No Finalised surgeries” only when not loading and length is 0 | Finalised card uses `otPrepFiltered.length`, so **0 during that fetch** | List yes, card no | No | List yes | `aria-hidden` | Workspace switch has a list loader |
| OT Preparation | Catalog error | No `isError` branch found | Empty copy can show | Yes, the empty message | Not during fetch. After failure the empty copy is the wrong state | Yes, 0 | No | No | No | No alert | Worse than Sessions and Analytics |
| Finalize Open | Modal fetch | Pulse header and body | Dialog is up | Form hidden while `isLoading` | Header “—” only after load if detail is missing | No numeric operational zero in the shell | Partial. Not the full form | Dialog only | Yes | Dialog labelled. Skeleton not `role="status"` | Better than a blank row, still silent |
| Follow-up KPIs | Stats pending | Labels `…` and value `—` | Yes | Cards | No numeric zero | **No** | Card chrome stays | No | Cards | Placeholder text | Best KPI pattern in this module |
| Follow-up list | Current tab | 7-row pulse, `aria-hidden` | Yes | No | Empty only after `!showSkeleton` | List totals use 0 only as fallback; tab labels use `—` until that tab has been fetched | Yes | No | List | Hidden | Matches Waiting List list |
| Follow-up | Unopened tab | Query `enabled` false until selected | List for the new tab skeletons once enabled | — | First paint of a not-yet-fetched tab is guarded by `isLoading` once enabled | Tab badge avoids 0 via `—` | Yes | No | Per tab | Same skeleton | Correct lazy tab |
| Analytics summary | `isPending` | Pulse blocks, `data-testid="analytics-loading"`, `aria-hidden` | Yes | KPI numbers not rendered (`{data && …}`) | “No data” for a mix is inside `{data && …}` | **No** on first load | Rough block, not the KPI strip | Below the toolbar | Region | Hidden | Closest to a page skeleton |
| Analytics trends | Trends pending while summary exists | Pulse bar | Yes | Widget title stays | Empty chart only after the trends query settles | No | Short bar, not the chart | No | Widget | No status role | Localized |
| Analytics refresh | `isFetching` | Spinning refresh icon, button disabled | Yes | Previous data stays | No | No | N/A | No | Button | `aria-label="Refresh"` | Good pending action |
| Mutations | Finalise, Prepare, Re-queue | Existing submit flags and toasts. Not re-audited line by line | Mixed | Depends on the dialog | Not the reported empty-card issue | N/A | N/A | Dialog or button | Mostly button | Varies | Out of the empty-card defect |

---

## 8. Premature empty states

| Place | What the user sees while the request is pending | Classification |
|-------|--------------------------------------------------|----------------|
| Waiting List worklist | Skeleton, not “no patients” | **VALID** |
| Waiting List summary cards and tab counts | `0` from an empty `patients` array | **PREMATURE EMPTY STATE** |
| Waiting List OT Returned count on the summary, after the tab is selected but before `loadOtReturned` finishes | `0` | **PREMATURE EMPTY STATE** |
| Waiting List OT Returned list | Skeleton | **VALID** |
| Sessions list | “Loading sessions…”, then empty copy | **VALID** |
| Finalize worklist | Skeleton, then “No records found” | **VALID** |
| Finalize Scheduled / Awaiting / Surgery Done cards | `0` from `records.length` before the list returns | **PREMATURE EMPTY STATE** |
| OT Preparation worklist | Skeleton while `catalogQuery.isLoading` | **VALID** |
| OT Preparation Finalised count | `0` until catalog rows exist | **PREMATURE EMPTY STATE** |
| OT Preparation empty copy after a failed catalog request | “No Finalised surgeries” because there is no error branch | **PREMATURE EMPTY STATE** for failure, not for the in-flight request |
| Follow-up KPI values | `—` | **VALID** |
| Follow-up list | Skeleton, then empty message | **VALID** |
| Analytics KPIs and funnel | Hidden behind the pending pulse | **VALID** |
| Analytics “No data” on Session Types | Only after summary `data` exists and `bySessionType.length === 0` | **VALID** |
| Finalize modal | Pulse shell, not an empty patient name as a final result | **VALID** |

Operational zeros after a successful empty payload remain valid. The defect is showing those zeros **before** the request resolves.

---

## 9. Runtime measurements

| Item | Result |
|------|--------|
| Navigation duration | **UNAVAILABLE — TOOLING LIMITATION** |
| First meaningful content | **UNAVAILABLE — TOOLING LIMITATION** |
| First data-bearing content | **UNAVAILABLE — TOOLING LIMITATION** |
| Skeleton duration | **UNAVAILABLE — TOOLING LIMITATION** |
| Request count and duration | **UNAVAILABLE — TOOLING LIMITATION** |
| Response size | **UNAVAILABLE — TOOLING LIMITATION** |
| Cache hit or miss | **UNAVAILABLE — TOOLING LIMITATION** |
| Client render cost | **UNAVAILABLE — TOOLING LIMITATION** |
| Chunk load on Waiting List row | **Not applicable** to the ordinary row. Demographics and Add Patient are `dynamic()`. Chunk time **UNKNOWN** |
| Finalize Open to dialog | **UNAVAILABLE — TOOLING LIMITATION** |

No performance improvement is claimed.

---

## 10. Measurement limitations

No browser performance panel, navigation timing, click timeline, or network waterfall was available. Prior Wave 1 and the deep audit also had no browser timings. Source evidence can show *what* runs and *which UI branch* is taken. It cannot rank which wait the user feels.

---

## 11. Root-cause matrix

| ID | Surface | User action | Symptom | Root cause | Evidence | Measurement | Class | Severity | Current mitigation | Recommended direction | Risk | Product Decision | Implementation Authorization |
|----|---------|-------------|---------|------------|----------|-------------|-------|----------|--------------------|-----------------------|------|------------------|------------------------------|
| L1 | All five routes | Open the route | Slow first paint | Shared layout waits for client token, then each page waits on its own query | `layout.tsx` skeleton gate. Page queries as above | Gate **MEASURED**. Duration **UNKNOWN** | Shared, then network or server | Unknown until timed | Shared skeleton | Do not change the shell in a Counsellor package. Time it under Package A | Shell change would hit every staff module | Yes, if the shell is changed | Yes |
| L2 | Waiting List | Open the page | List arrives late | Full active queue still downloaded (PERF-04 Option A) | `useWaitingListQuery` unchanged. No `Skip`/`Take` added | **MEASURED** call. Bytes **UNKNOWN** | Network or server, then client filter | Unknown | 60s stale time from the existing hook | Do not reopen Option B here | Changing paging changes C-01 counts | Already decided: Option A | Not for Option B |
| L3 | Waiting List and Finalize | Open the page | Cards show 0, then jump | Summary is derived from the not-yet-loaded array and is not gated on `isLoading` | `WaitingListSummaryWidget` `tabCounts[key] ?? 0`. `statsBar` from `records` | **MEASURED** UI branch. How long 0 stays **UNKNOWN** | Client presentation | UX defect, duration unknown | Worklist skeleton only | Gate card values on the same pending flag the list already uses | Must not change counts after success | Yes, loading presentation | Yes |
| L4 | Waiting List | Click a patient row | Next screen feels slow | Row navigates to the session route. It does not open a Waiting List modal | `handleRowClick` → `navigateToSession` | Path **MEASURED**. Time **UNKNOWN** | Route plus that page’s requests | Unknown | None on the row | Trace Package A before any session-page change | Session workflow is certified | Yes, if behavior changes | Yes |
| L5 | Finalize | Click a row | Dialog content feels slow | Dialog opens immediately, then four requests run together | `openRow` plus `Promise.all` in `FinalizeOtModal` | Path **MEASURED**. Time **UNKNOWN** | Network and/or server after a client state flip | Unknown | In-dialog pulse | Keep the shell. Do not lazy-mount (PERF-06). Time the four calls before combining them | Fewer lookups can change who is on the form | Yes, if calls are dropped or merged | Yes |
| L6 | Module | Any load | Loaders differ, some are invisible to assistive tech | Three patterns: text `role="status"` (Sessions), `aria-hidden` pulse grids, and ungated numeric cards | Sections 7 and 8 | **MEASURED** | Client | Consistency defect | Partial | One state rule using existing primitives. Package B | Visual change during load only | Yes | Yes |
| L7 | OT Preparation | Catalog failure | “No Finalised surgeries” | Empty branch does not check `catalogQuery.isError` | Page empty condition | **MEASURED** | Client | Wrong recovery | None | Error state, not an empty population. Package B | Must not look like a true zero | Yes | Yes |

No ID above is a measured millisecond ranking. L2 remains the protected full-queue architecture, not a new bottleneck proof.

---

## 12. Loading standard proposal

Use the existing counselling surfaces and `components/ui/skeleton.tsx` (`animate-pulse`). Do not add a design system, a chart library, or a second toast system. A new shared loading component is **not required** to state the rule. Extracting one new primitive would be **PRODUCT / ARCHITECTURE DECISION REQUIRED** and is not proposed as the first step.

### States

**LOADING.** The request for that region has not succeeded and has not failed. Show a skeleton or an explicit pending label in that region only.

**SUCCESS WITH DATA.** Show the values the request returned, including a real zero.

**SUCCESS EMPTY.** Show the existing empty copy only after success and an empty payload.

**ERROR.** Show the existing alert and retry pattern (Sessions and Analytics already do this). Do not use the empty copy.

**LOADING is not EMPTY.** A pending count is not `0`.

### By region

| Region | While LOADING | After success |
|--------|---------------|---------------|
| A. Initial page | Keep the shared shell skeleton only for the token gate. Do not replace it here | Page mounts |
| B. Summary / KPI | Reserve the same cards. Show a pulse or `—`, not `0`, until that query succeeds. Follow-up already does the `—` form | Existing certified numbers |
| C. Worklist | Keep the current 7-row pulse. Add `role="status"` and visually hidden “Loading” text. Remove `aria-hidden` from the only loading message | Existing rows or empty copy |
| D. Tab or workspace lazy load | Skeleton in the list that is fetching. Do not fetch ahead of Wave 1 gates | Existing tab population |
| E. Modal or sheet | Keep the dialog shell. Keep a content skeleton until its own request finishes | Existing form |
| F. Action pending | Disable the button and keep the existing spinner or label on that button | Existing success toast |
| G. Refresh | Keep previous rows. Keep the existing Refreshing or spinning icon. Do not replace numbers with 0 | Same data refreshed |
| H. Error | Alert and retry in that region. Leave prior data in place on refresh failure when the cache still has it | — |
| I. Empty | Existing copy, only in SUCCESS EMPTY | — |

This changes what is painted during LOADING. It does not change the numbers, ordering, or actions after SUCCESS.

---

## 13. Performance recommendations

1. Treat loading presentation and runtime speed as different problems. The 0-while-loading cards are **MEASURED**. Their duration is **UNKNOWN**.
2. Do not reopen PERF-04 Option B, PERF-06, or PERF-07 from this audit. Row slowness is not proven to be the modal bundle or the lack of virtualization.
3. Next evidence is a browser trace (Package A), not another source-only pass.
4. The safest product change that this source supports is Package B: stop painting operational zeros before the request resolves, and give the existing skeletons a status announcement.
5. Finalize Open’s four calls are a candidate only after they are timed. Merging them is an API decision, not part of Package B.

---

## 14. Protected certified behavior

Recommendations must not change, after the request succeeds:

- C-01, seven-zone worklist, counts, filters, Owner, actions, pagination, branch authorization
- accepted Sessions correction
- Finalize / OT FSM, RESP2, SequenceNo, Prepare, Reopen, one-schedule-date rule, print
- Follow-up attribution, ReQueue, stats source
- Analytics formulas, My Work, Authorized Branch, funnel, mixes, trends, aging, drill-down, CSV, Print, Refresh
- permissions and ownership
- Wave 2 and Visual Polish

---

## 15. Wave 1 regression findings

| Package | Still intact | Evidence |
|---------|--------------|----------|
| PERF-02 | **Yes** | Waiting List effect returns unless `activeTab === 'OtReturned'` before `listJourneys` and `getPatientSessions` |
| PERF-03 | **Yes** | Catalog `useFinalizeListQuery` second argument is `activeWorkspace === 'ot-preparation'`. Filtered list uses the default `enabled` |
| PERF-04 Option A | **Yes** | `useWaitingListQuery` still loads the waiting-list query. Client `applyWaitingListClientFilters` still builds the visible rows and tab counts |
| PERF-05 | **Yes** | `GetFollowupAgingAsync` still uses one `GroupBy` aggregation. DTO and callers were not part of this audit’s edits because nothing was edited |

No Wave 1 regression was found in source. Runtime behavior was not re-timed.

---

## 16. Proposed bounded packages

None of these are authorized.

### Package A — Browser timing baseline

| Item | Proposal |
|------|----------|
| Scope | Read-only timings for the five routes, Waiting List row navigation, and Finalize Open until dialog content |
| Files | None, unless a later decision allows a non-production trace. No monitoring platform |
| Behavior affected | None |
| Protected behavior | All of section 14 |
| Tests | None for a manual trace |
| UAT | The trace itself |
| Rollback | N/A |
| Dependencies | A running staff session and existing browser tools |
| Product Decision | No, if nothing ships |
| Implementation Authorization | No, if nothing ships |

### Package B — Loading presentation only

| Item | Proposal |
|------|----------|
| Scope | Gate Waiting List and Finalize summary numbers on the existing pending flags. Announce worklist skeletons. Add an error branch for the OT catalog. Do not change queries |
| Files likely | `WaitingListSummaryWidget.tsx`, `waiting-list/page.tsx` (pass a loading flag only), `finalize-surgery/page.tsx`, `WaitingListQueueWidget.tsx`, and the local Finalize and Follow-up skeletons. Sessions and Analytics are the reference, not a rewrite |
| Behavior affected | Paint during LOADING and on catalog error. Successful counts stay |
| Protected behavior | Section 14, plus PERF-02 and PERF-03 gates |
| Tests | Summary does not show numeric 0 while the source query is pending. Empty copy still appears after a successful empty payload. Catalog error is not the empty copy. Existing C-01 count tests still pass |
| UAT | Each route: loading, empty, error, refresh, OT Returned, OT Preparation |
| Rollback | Revert the loading branches only |
| Dependencies | Package A is useful but not required to fix a premature 0 that source already shows |
| Product Decision | **Yes.** Staff will see a skeleton or `—` instead of a temporary 0 |
| Implementation Authorization | **Yes**, after that decision |

### Package C — Navigation speed

| Item | Proposal |
|------|----------|
| Scope | **Not proposed as a code change.** Shared shell and full Waiting List queue are already known. Neither is authorized to change from this audit |
| Files | None until a trace shows a new cause |
| Product Decision | Required before any shell or PERF-04 change |
| Implementation Authorization | Required |

### Package D — Row and dialog speed

| Item | Proposal |
|------|----------|
| Scope | **Not a code change now.** Waiting List row delay must be traced at the session route. Finalize delay must be traced across the four Open calls. Do not lazy-mount `FinalizeOtModal` |
| Files if later proven | Session route only with its own decision. `FinalizeOtModal.tsx` only if a measured call can be removed without an API contract change |
| Behavior affected | Unknown until the trace |
| Protected behavior | Session workflow, FSM, ownership |
| Product Decision | **Yes** before dropping or merging lookups |
| Implementation Authorization | **Yes** |

### Package E — Server or database

| Item | Proposal |
|------|----------|
| Scope | **Not proposed.** No query plan and no request timing |
| Indexes | Not named |
| Product Decision | Required before any API or index work |
| Implementation Authorization | Required, and a database change would be separate |

---

## 17. Product Decisions required

- Whether temporary summary zeros may be replaced by the Follow-up `—` or by a skeleton until the same request succeeds (Package B).
- Whether Finalize Open may call fewer than the current four lookups (only after Package A).
- Whether Waiting List row delay is accepted as session-route navigation (no decision until Package A).
- No decision is requested to change C-01, FSM, formulas, ownership, or Wave 1.

---

## 18. Implementation Authorization required

Any of Package B, a later Package D change, a shell change, or a server change. This audit does not create that authorization. Package A as a manual trace does not need one.

---

## 19. Explicit non-actions

Not done and not authorized:

- production edits, test edits, indexes, schema, API or DTO changes
- PERF-04 Option B, PERF-06, PERF-07
- virtualization, broad memoization, React restructure
- shared shell, TopNav, tokens, chart library
- Analytics formula, ownership, permission, workflow, or route changes
- a new design system or a new loading library
- Manual UAT recorded as pass
- acceptance

---

## 20. Final recommendation

The premature zeros on Waiting List and Finalize summary cards are a source-proven loading defect. The reported slowness is not yet a measured ranking: shared initialization, the full waiting-list payload, session navigation after a row click, and Finalize’s four Open requests are the code-level candidates, and their durations are unknown.

Do not implement from this file. Capture a browser trace if the goal is to prove speed. Take a Product Decision before changing how pending counts are painted.

**AUDIT COMPLETE — NO IMPLEMENTATION AUTHORIZED**
