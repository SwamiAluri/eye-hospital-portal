# Counsellor Performance — Deep Audit

| Field | Value |
|-------|--------|
| **Date** | 2026-09-25 |
| **Type** | Read-only audit |
| **Production code** | **NONE MODIFIED** |
| **Tests** | **NONE MODIFIED** |
| **API** | **NONE MODIFIED** |
| **Database** | **NONE MODIFIED** |
| **Performance behavior** | **UNCHANGED** |

No timings in this document were captured in a browser. Where a duration is not written, it was not measured.

---

## 1. Executive summary

The slowness reported across Waiting List, Sessions, Finalize / OT Preparation, Follow-up Center, and Analytics is not one shared calculation bug. The code shows three different kinds of cost that can feel like the same delay.

1. **Shared first paint.** Every dashboard page, including these five, waits until the browser has a token, then mounts the shell (`Sidebar`, `TopNav`, Query client). That cost is shared. Its duration was not measured.
2. **Large list payloads on Waiting List and Finalize / OT.** Waiting List loads the full active queue, then filters and pages it in the browser. Finalize always issues two OT-schedule reads. One of them omits the date and loads every schedule in the authorized branches. Follow-up and Sessions already page on the server.
3. **Work that runs even when the user has not opened that tab or modal.** Waiting List, after a branch id exists, loads OT-return journeys and then one session list per patient. Finalize mounts `FinalizeOtModal` with the page. Analytics fires summary, trends, aging, and a counsellor picker together, and the aging query runs five counts of the same pending population.

Button, modal, and save delay was not timed. The likely split is: opening a already-mounted Finalize modal is client work; Finalise, Reopen, Prepare, and Re-queue wait on a POST and then on list invalidation.

---

## 2. Scope

Surfaces:

- `/dashboard/counsellors-desk/waiting-list`
- `/dashboard/counsellors-desk/sessions`
- `/dashboard/counsellors-desk/finalize-surgery` (Finalize and OT Preparation)
- `/dashboard/counsellors-desk/surgery-followup`
- `/dashboard/counselor/analytics`

Shared: `dashboard/layout.tsx`, `AuthProvider`, `ReactQueryProvider`, counsellor query hooks, Auth Service `CounselingController`, `OtFinalizeService`, `CounselingWorkflowService`, `CounselingAnalyticsService`.

---

## 3. Environment

Repository inspection on 2026-09-25. Next.js staff app in `apps/hospital-portal-web`. Counselling HTTP API in `microservices/auth-service`. No running profiler, no server trace, no database `EXPLAIN`.

---

## 4. Measurement limitations

| Item | Status |
|------|--------|
| Browser navigation time | **UNKNOWN** |
| First meaningful paint | **UNKNOWN** |
| Request duration and waterfall | **UNKNOWN** |
| Main-thread blocking | **UNKNOWN** |
| Modal open milliseconds | **UNKNOWN** |
| Mutation round-trip time | **UNKNOWN** |

**MEASURED** below means read from source (call sites, query options, SQL shape). **INFERRED** means a likely user-facing effect of that source. **UNKNOWN** means it needs a trace.

---

## 5. Page-by-page findings

### Waiting List

**MEASURED**

- One TanStack query: `GET /Counseling/waiting-list`. `staleTime` is 60 seconds (`LIST_STALE_MS`).
- API filters are branch and applied date range, with `type: 'All'`. Status and owner filters run in the client on the returned array.
- The API loads the queue with joins and `ToListAsync` and does not `Skip`/`Take`. A second query loads every SurgeryDone OT session id for the tenant before that join.
- After `branchId` exists, an effect calls `ipManagementApi.listJourneys` and then `getPatientSessions` once per distinct patient who has an OT return reason. That does not wait for the OT Returned tab.
- Add-patient and patient-form modals are `dynamic()` imports. They are not in the first bundle chunk.
- The worklist is not virtualized. The page slices the filtered array for display.

**INFERRED**

- Time to first rows tracks the waiting-list GET plus client filter. A large queue makes both the response and the render heavier.
- The OT-return fan-out adds a waterfall of extra GETs on every visit that has a branch, even if the user never opens OT Returned.
- Returning to the page inside 60 seconds can use the cached list. After 60 seconds it refetches.

**UNKNOWN:** row counts, response bytes, and whether the extra journey calls overlap the main list.

### Counselling Sessions

**MEASURED**

- `useCounselingSessions` calls the paged sessions API. Page size is fixed. `staleTime` is 60 seconds.
- The service counts the filtered query, then `Skip`/`Take`s one page (`CounselingWorkflowService`, around the session list query).
- Reassignment Required is a server filter on that same query.
- Pagination changes the URL and therefore the query key, so each page is a new request unless that key is still fresh.

**INFERRED**

- This page should not transfer the whole session population. Open delay is the sessions GET plus the shared shell.
- Count plus page is two SQL statements per request. That is normal paging, not an N+1 over rows.

**UNKNOWN:** whether the count query is slow on the current data volume.

### Finalize Surgery / OT Preparation

**MEASURED**

- On every visit the page starts two queries:
  - `useFinalizeListQuery(debouncedFilters)` — date, UHID, and name. Empty date means no date SQL filter.
  - `useFinalizeListQuery(OT_PREP_SURGERY_DATE_CATALOG_FILTERS)` — `date: ''`, so `GetFinalizeListAsync` does not apply a date predicate and `ToListAsync`s every non-deleted schedule in the authorized branches.
- `GetFinalizeListAsync` then loads patients for incomplete rows and sessions for checklist fields. Those are batched, not one query per row.
- UHID and name filters use `ToLower().Contains(...)`.
- `FinalizeOtModal` is imported statically and rendered with the page (`isOpen` only toggles visibility).
- List `staleTime` is 60 seconds. Two keys mean two caches.
- Client status tabs filter the array already downloaded.

**INFERRED**

- Opening Finalize always pays for the full OT catalog as well as the filtered list. That is the strongest structural reason this route can feel slower than Sessions or Follow-up.
- The modal’s code and first render are paid on page load, not on the first Open click. Open itself should then be a state flip unless the open path also fetches detail.

**UNKNOWN:** whether Open then calls `GET /Counseling/ot-schedule/{id}` and how long that detail is. The list endpoint is separate from the detail endpoint.

### Follow-up Center

**MEASURED**

- Active, Cold, and Post-Surgery list hooks exist. `enabled` follows `tabFetched`, so inactive populations are not fetched until that tab has been opened.
- Stats (`GET /Counseling/followups/stats`) are requested on load and are not gated by the tab.
- Lists use page size 20 and server `page` / `pageSize`.
- History drawer, contact log, and reminder modal are `dynamic()` imports.
- `staleTime` is 60 seconds. `invalidateFollowups` invalidates the `followups` key prefix, which covers lists and stats.

**INFERRED**

- First visit is stats plus the active page, in parallel. Later tabs add their own request. That is a small waterfall only when the user changes tabs, not on first paint.
- Re-queue invalidates follow-ups and the waiting list, so a save is followed by more GETs.

**UNKNOWN:** stats query SQL cost. It was not traced line by line in this pass.

### Analytics

**MEASURED**

- On load, in parallel: summary (`staleTime` 5 minutes), trends (5 minutes), follow-up aging (2 minutes), and counsellor picker (10 minutes, `refetchOnWindowFocus: false`).
- Summary groups session type and surgery type, and counts callbacks twice (`CounselingAnalyticsService`).
- Aging counts the pending population once, then four more `CountAsync` calls with different date bounds on the same query shape.
- Refresh calls `invalidateQueries` on the analytics key, which refetches the active analytics queries.
- Charts are in the same tab component. There is no separate chart chunk for the funnel (`ConversionFunnelChart` is a static import of Recharts).

**INFERRED**

- First open waits on the slowest of those four calls. Aging’s five counts are the clearest repeated aggregation in this audit.
- Recharts is in the Analytics bundle, so navigating to Analytics can pay a chunk load that the other four pages do not.

**UNKNOWN:** chunk size and whether the picker call is on the critical path for the KPI strip.

---

## 6. Network findings

Default Query client (`ReactQueryProvider`): `staleTime` 5 minutes, `gcTime` 10 minutes, `refetchOnWindowFocus: false`, `retry: 1`. List hooks override `staleTime` to 60 seconds.

| Endpoint | Method | Caller | When | Duplicate risk |
|----------|--------|--------|------|----------------|
| `/Counseling/waiting-list` | GET | `useWaitingListQuery` | Waiting List mount / filter dates / after 60s | One query per filter key |
| IP journeys `ReadyForSurgery` | GET | Waiting List effect | When `branchId` is set | Extra vs the waiting-list GET |
| `/Counseling/patients/{id}/sessions` | GET | Same effect | Once per OT-return patient | N calls |
| `/Counseling/sessions` | GET | `useCounselingSessions` | Sessions page and URL page changes | One page per key |
| `/Counseling/ot-schedule` | GET | Finalize page | Twice per visit (filtered list and undated catalog) | Two overlapping reads |
| `/Counseling/followups/active` | GET | Follow-up | Active tab | Not duplicated with cold/post until those tabs open |
| `/Counseling/followups/cold-leads` | GET | Follow-up | After Cold tab | — |
| `/Counseling/followups/post-surgery` | GET | Follow-up | After Post-Surgery tab | — |
| `/Counseling/followups/stats` | GET | Follow-up | Every visit | Independent of the list |
| `/counseling/analytics/summary` | GET | Analytics | Mount | Parallel with trends and aging |
| `/counseling/analytics/trends` | GET | Analytics | Mount | Parallel |
| `/counseling/analytics/followup-aging` | GET | Analytics | Mount | Parallel |
| `/Counseling/counselors` | GET | Analytics picker | Mount | 10-minute stale time |

No request log was captured. “Duplicate” here means two calls the source always starts, not two identical calls observed in the network panel.

---

## 7. React / client findings

**MEASURED**

- Waiting List, Sessions, Finalize, and Follow-up are client pages. Filters and pages are state or URL state. Query keys include those values, so a URL page change does not refetch with the same key.
- Waiting List and Finalize derive tab counts and visible rows with `filter` on the full downloaded array inside render or `useMemo`. That work repeats when parent state changes (selection, modal open, page size).
- Finalize selection updates are `Set` state on the page that also holds both lists, so a checkbox updates the page that renders the worklist.
- Follow-up keeps three list queries but disables the ones not yet opened.
- No list virtualization was found on these worklists.

**INFERRED**

- Checkbox and tab changes on Finalize re-render the long list because the list is not split from the selection state. That can make buttons feel late when the catalog is large. It does not by itself explain delay on Sessions or Analytics.
- `dynamic()` modals on Waiting List and Follow-up defer their code until first open. That trades first-open delay for a lighter first page load. Finalize does the opposite for `FinalizeOtModal`.

**UNKNOWN:** render durations and whether a single checkbox is actually slow.

---

## 8. API findings

**MEASURED**

- Waiting List: authorized branches, optional dates, then the full matching queue. No page parameters on this endpoint.
- Sessions: page and page size are applied in the service after `CountAsync`.
- OT schedule list: optional date. Omitted date returns the branch set ordered by start time, then patient and session lookups for that set.
- Follow-up lists: page and page size default 20.
- Analytics summary and aging are aggregations, not row dumps. Aging issues five counts.

Mutations (confirm, finalise, reopen, prepare, re-queue) are POST endpoints on the same controller. After success, the client invalidates the related list keys, which triggers another GET if the query is mounted.

---

## 9. Database findings

**MEASURED** from query shape only. No timings and no `EXPLAIN`.

| Query | Shape | Classification |
|-------|--------|----------------|
| Waiting List | Pre-query of all SurgeryDone session ids for the tenant, then join queue, session, patient, two user left joins, `ToListAsync` without paging | Unbounded read |
| OT schedule list | Filter tenant, not deleted, branch set, optional date, `ToLower().Contains` on UHID and name, `ToListAsync`, then patient and session batches | Unbounded when date is omitted. Contains cannot use a simple equality index |
| Sessions list | `CountAsync` then `Skip`/`Take` | Paged |
| Follow-up lists | Paged service methods | Paged |
| Analytics aging | One pending query counted five times | Repeated aggregation on the same population |

**PERFORMANCE IMPLEMENTATION CANDIDATE — DATABASE CHANGE REQUIRED** if a later authorization wants indexes or query rewrites for the unbounded waiting-list and undated OT list. This audit does not name an index. The query text alone is not an `EXPLAIN`.

---

## 10. Shared infrastructure findings

**MEASURED**

- `dashboard/layout.tsx` returns a loading skeleton until `isClient` and a token exist, then renders `Sidebar` and `TopNav` on every staff route.
- `AuthProvider` hydrates auth from storage and initializes API clients in one effect. It does not fetch the counsellor lists.
- Query focus refetch is off. There is no Next.js `middleware.ts` in the web app.
- These five routes are no-pad routes. Layout padding is not an extra counsellor fetch.
- `TopNav` title logic for Finalize is a window event. It does not fetch data.

**INFERRED**

- “Every Counsellor page feels slow to open” matches this shared shell plus each page’s own first query. The shell is not enough to explain Finalize being heavier than Sessions, or Waiting List starting extra journey calls.
- Notification and SignalR hubs were not on these page files in this pass. They are not the identified list-load path.

**UNKNOWN:** sidebar permission fetch on each navigation, and how long the skeleton stays on a warm session.

---

## 11. Modal and mutation findings

| Action | Where the wait sits | Evidence |
|--------|---------------------|----------|
| Open Finalize case | **DURING MOUNT** of the page, then **BEFORE OPEN** is a state toggle | Modal is always in the tree. Detail GET on open was not traced here. **UNKNOWN** if Open also fetches |
| Waiting List add patient / Follow-up sheets | **BEFORE OPEN** chunk load | `dynamic()` |
| Finalise, confirm, reopen, prepare | **DURING API MUTATION**, then **DURING REFRESH** | POST plus `invalidateFinalizeList` / list patch |
| Re-queue | **DURING API MUTATION**, then **DURING REFRESH** | POST plus follow-up and waiting-list invalidation |
| Analytics Refresh | **DURING REFRESH** | Invalidates analytics keys |
| Close | **UNKNOWN** | No close handler was profiled. Close of a mounted Finalize modal should be a state update |

No mutation latency was measured.

---

## 12. Root-cause matrix

| ID | Finding | Class | Cause | Evidence grade |
|----|---------|-------|-------|----------------|
| F1 | Shared shell waits for client token before any Counsellor page | P1 | SHARED INFRASTRUCTURE | INFERRED effect, MEASURED gate |
| F2 | Waiting List returns the full active queue | P1 | SERVER / DATABASE | MEASURED |
| F3 | Waiting List OT-return loads journeys plus one sessions GET per patient on every visit with a branch | P1 | NETWORK / CLIENT | MEASURED call pattern, UNKNOWN duration |
| F4 | Finalize always loads the undated OT catalog plus the filtered list | P1 | NETWORK / DATABASE | MEASURED |
| F5 | Finalize modal is mounted with the page | P2 | CLIENT | MEASURED |
| F6 | Analytics aging runs five counts | P2 | DATABASE | MEASURED |
| F7 | Analytics pulls Recharts in the route module | P2 | CLIENT | MEASURED import |
| F8 | Full-array filter and no virtualization on Waiting List and Finalize | P2 | CLIENT | MEASURED; severity UNKNOWN without row counts |
| F9 | Sessions and Follow-up are server-paged | — | — | Not a population dump |
| F10 | List stale time is 60 seconds, focus refetch off | — | CLIENT | Limits repeat fetches; not a delay by itself |

No P0 is recorded. A P0 would need a measured outage or a trace showing one shared blocker. That trace does not exist yet.

---

## 13. Classification

| Priority | Items |
|----------|--------|
| P0 | None from this evidence |
| P1 | F1, F2, F3, F4 |
| P2 | F5, F6, F7, F8 |
| P3 | None isolated. Header spacing is not a performance finding |

---

## 14. Measured, inferred, unknown

See sections 5 through 11. Do not treat inferred delay as a benchmark.

---

## 15. Recommended remediation order

Do not implement from this file.

### 1. Trace before code

- **Root cause:** durations are unknown.
- **Evidence:** no browser or SQL profile in this audit.
- **Proposed change:** one controlled pass that records navigation, request waterfall, and modal open for the five routes. No behavior change.
- **Expected benefit:** confirms which of F2–F4 actually dominate.
- **Risk:** none if read-only.
- **Modules:** all five.
- **API/DB:** no.

### 2. Waiting List payload (F2)

- **Root cause:** full queue materialized in SQL and sent to the client.
- **Evidence:** `GetWaitingList` `ToListAsync` without `Take`.
- **Proposed change:** only after a product decision. Server paging would change the current client filters and card counts.
- **Expected benefit:** smaller first response if the queue is large.
- **Risk:** changes C-01 count and filter behavior if counts stop being computed from the full list.
- **Modules:** Waiting List.
- **API/DB:** yes. **Requires a product decision.**

### 3. OT-return fan-out (F3)

- **Root cause:** per-patient session GETs run on page entry.
- **Evidence:** `loadOtReturned` in `waiting-list/page.tsx`.
- **Proposed change:** run that effect only when the OT Returned view is selected, or replace the per-patient GETs with one server query.
- **Expected benefit:** fewer requests on ordinary waiting-list opens.
- **Risk:** OT Returned would load later, which is acceptable only if product agrees the tab may show its own loading state.
- **Modules:** Waiting List.
- **API/DB:** optional. Deferring the existing calls can stay presentation-timing. Collapsing N calls needs an API decision.

### 4. Finalize double list (F4)

- **Root cause:** undated catalog GET on every visit.
- **Evidence:** `OT_PREP_SURGERY_DATE_CATALOG_FILTERS.date === ''` and `GetFinalizeListAsync` skips the date filter, then `ToListAsync`.
- **Proposed change:** do not change the catalog rule without a product decision. A later implementation could defer the catalog until the OT workspace is opened. That keeps the same query, but not on first paint.
- **Expected benefit:** Finalize workspace opens with one list instead of two.
- **Risk:** switching to OT Preparation would then wait on the catalog. Today that wait happens up front.
- **Modules:** Finalize and OT Preparation.
- **API/DB:** not required for deferral. Required if the catalog is paged or date-bounded, because the product rule is the full date universe.

### 5. Analytics counts (F6)

- **Root cause:** five `CountAsync` executions for one pending population.
- **Evidence:** `CounselingAnalyticsService` aging method.
- **Proposed change:** one grouped query returning the same four buckets and the total. Same response shape.
- **Expected benefit:** less database time on Analytics open and refresh.
- **Risk:** bucket boundaries must stay identical.
- **Modules:** Analytics.
- **API/DB:** query change only if the JSON contract stays. Index work, if any, is a database candidate and stops at the classification below.

### 6. Modal mount (F5) and list render (F8)

- **Root cause:** large Finalize modal is always mounted; long lists re-render with page state.
- **Evidence:** static `FinalizeOtModal` on the page; list rows in the same component as selection state.
- **Proposed change:** only if a trace shows main-thread time. Options are `dynamic()` for the modal and isolating selection state. Virtualization is not recommended until row counts are known.
- **Expected benefit:** faster first paint and lighter checkbox updates.
- **Risk:** first Open pays the chunk load instead.
- **Modules:** Finalize. Waiting List only if F8 is measured.
- **API/DB:** no.

---

## 16. Performance acceptance criteria

For a future implementation, a trace must show, against this audit’s baseline (still to be captured):

- Waiting List first data request count drops only if F3 is deferred, and OT Returned still loads when that tab is used.
- Finalize first paint does not request the undated catalog unless the OT workspace is active, if that deferral is the chosen fix.
- Sessions page size, Follow-up page size, and Analytics formulas stay the same.
- Aging bucket counts stay the same if F6 is implemented.
- No ownership, FSM, or permission change.

---

## 17. Product Decision required

- Whether Waiting List may stop downloading the full queue (F2). That touches certified list behavior.
- Whether the OT catalog may load only when OT Preparation is active (F4). The full date universe itself stays a product rule unless separately changed.
- Whether OT Returned data may load only when that tab is selected (F3).

---

## 18. Implementation Authorization required

Any of the changes in section 15. Database indexes or query rewrites are:

**PERFORMANCE IMPLEMENTATION CANDIDATE — DATABASE CHANGE REQUIRED**

They are not authorized by this audit.

---

## 19. Gate

| Item | Status |
|------|--------|
| Production code | **NONE MODIFIED** |
| Tests | **NONE MODIFIED** |
| API | **NONE MODIFIED** |
| Database | **NONE MODIFIED** |
| Performance behavior | **UNCHANGED** |
| Next gate | Review these findings, then a bounded performance Product Decision and Implementation Authorization |

**COUNSELLOR PERFORMANCE DEEP AUDIT COMPLETE — NO PRODUCTION CHANGE — ROOT CAUSE REPORT READY — STOP FOR PERFORMANCE DECISION / IMPLEMENTATION AUTHORIZATION**
