# Patient Directory — Complete Redesign Reconciliation Audit

Document type: UX / architecture reconciliation audit  
Date: 2026-10-01  
Status: AUDIT ONLY  

Application code changed by this file: **NO**  
APIs, DTOs, database, migrations, permissions, routes, tests: **NO**  
Implementation authorization: **NOT GRANTED**

This audit supersedes the visual direction of the Slice 1 directory chrome. It does not delete or replace:

- `docs/audits/patient-directory-master-forensic-redesign-audit.md` (2026-09-29)
- `docs/decisions/patient-directory-redesign-ux-contract.md` (2026-10-01)
- `docs/decisions/patient-360-product-decision-contract.md`
- `docs/decisions/patient-create-role-grant-decision.md`

Slice 1 was implemented and then rejected as the final UX. Certified business rules from Slices 1–8 and Patient 360 remain in force. Proposed decisions below are **not implemented**.

Evidence labels:

| Label | Meaning |
|---|---|
| FACT | Current source |
| CERTIFIED | Accepted rule that this audit does not reopen |
| DIRECTED | Stated in this review as the desired Directory UX |
| DECISION REQUIRED | A business or architecture choice is still missing |
| DO NOT IMPLEMENT | Recorded only |

---

## 1. Executive Summary

`/dashboard/patients` is a branch-scoped discovery worklist (`PatientHubPage`) gated by `patient.view`. Patient 360 is `/dashboard/patients/[id]`. The directory already searches, filters, pages, and hands off on the server. Slice 1 made the row leaner and removed the selection bar. That pass is **not** the accepted page.

The rejected experience is structural:

- Favorites and Assigned to me are still first-class directory controls.
- Filters open a right Sheet.
- The patient route is **not** on the bounded staff shell. Main content scrolls as a page, so pagination sits at the end of the list.
- Docked preview is capped at 480px (`w-[42%] max-w-[480px]`).
- “Open full profile” is a footer button plus a small header icon.
- Add Patient navigates to a full page. The wizard is not a Dialog component.
- Merge is a directory header link. Merge also rewrites visits, appointments, prescriptions, and imaging orders, and Patient 360 links to the same page.

Counsellor waiting list is the quality reference for a bounded worklist (scroll inside the queue, pagination in the footer, `overflow-hidden` shell). It is not the column, filter, or ownership template.

No new API is required for the directed UI changes except where a later slice would **delete** shared data. Favorite rows, `Visit.AssignedTo`, saved searches, and merge are shared or cross-module. Directory UI can stop showing them without dropping those stores.

---

## 2. Original Patient Directory Objective

**CERTIFIED.**

The directory answers: which patient, what current context, and where next.

Patient 360 answers: what authorized longitudinal information exists.

The owning module remains the system of record. The directory must not become Doctor’s Desk, Front Office, Counsellor, billing, insurance, surgery, follow-up, OT, a second chart, or a second registration form.

---

## 3. Current Implementation Snapshot

| Item | Fact |
|---|---|
| Route | `/dashboard/patients` → dynamic `PatientHubPage`, `patient.view` |
| Title | Sidebar and top nav: Patient Directory. Slice 1 removed the in-page `h1` “Patients”. Result count remains as plain text |
| Shell | Dashboard `main` is `overflow-auto` with page padding. Directory is **not** in `noPadRoutes` or the counselling ops canvas (`dashboard/layout.tsx`) |
| Search | Debounced `q` (300ms) plus autosuggest (250ms, min 2 characters) |
| Filters | `PatientAdvancedFilterSheet` (right Sheet). Explicit Apply |
| Census | All, Current, New, Discharged, High priority. Counts from `GET /api/patients/lookup/stats` |
| Worklist | Table from `md`. Cards below `md`. Columns: Favorite, Patient, Context, Actions |
| Actions | Name → `/dashboard/patients/{id}`. Row → preview. Check-in. More → Book appointment when `appointment.view` |
| Preview | Docked at ≥1280px, else Sheet. Split pane `w-[42%] max-w-[480px] min-w-[360px]` |
| Add | `buildCanonicalAddPatientHref` → `/dashboard/patients/new?returnTo=` |
| Merge | Header link when `patient.update` → `/dashboard/patients/merge` |
| Export | Header button when `patient.export` |
| Selection bar | Unmounted. `PatientHubSelectionBar.tsx` still exists |

---

## 4. What Is Already Certified

Preserve unless a later decision says otherwise:

1. Census predicates (`ApplyTabFilterAsync`, `GetCurrentPatientIdsAsync`) and tab URL values.
2. Stats are branch totals. They do not follow `q` or advanced filters.
3. Tenant and effective-branch resolution, including null-branch inclusion on lookup.
4. Lookup request and response contracts.
5. Search `q` (name, MRN, phone, email, minimum 2 characters). Health ID is suggest-only.
6. Page size 25. Server sort keys remain even where the table no longer shows a sort header.
7. `patient.view`, `patient.create`, `patient.export`, `patient.update` for merge.
8. Canonical wizard route `/dashboard/patients/new`. Server generates MRN on create.
9. Server duplicate block at match confidence **≥ 0.95**.
10. Patient 360 route and completed sections. Timeline and Surgery/OT stay “not available”.
11. Preview content boundary: identity, visit, data quality, emergency contact, recent visits. No vitals grid.
12. Check-in and appointment links. Counsellor handoff library does not create a session.
13. Soft delete (`DeletedAt`).
14. Queue-hub invalidation of lookup keys (`usePatientHubRealtime`).
15. Export permission and branch resolution. Export completeness (100-row clamp, dropped filters) stays a known defect, not part of this UX pass.

---

## 5. What Is Not Accepted

**DIRECTED.** Slice 1 is not the final Directory UX.

Not accepted:

- Favorite star and Favorites toggle on the directory.
- Assigned to me on the directory.
- Right-side filter Sheet as the filter experience.
- Page-level scroll that hides pagination.
- Wide operational grid **or** a context cell that still feels like a mini chart. The target remains a compact identity / context / action worklist, with columns confirmed in section 16.
- Preview stuck at a 480px cap, with Patient 360 buried in the footer.
- Add Patient as a full-page navigation from the directory when a dialog of the same wizard is feasible.
- Merge as a directory header action.

Accepted and retained unless a defect forces a change: row opens preview; name opens Patient 360; census predicates; server search and filters; existing handoff URLs.

---

## 6. Current UX Problems

| Problem | Evidence |
|---|---|
| Discovery chrome still teaches two work-allocation ideas the directory should not own | Favorites toggle and star; Assigned to me toggle; both also inside the filter sheet Quick section |
| Filters are a second surface | `PatientAdvancedFilterSheet` uses shadcn `Sheet` |
| Pagination is not pinned to the worklist | `PatientHubPagination` is `mt-4` under the table, inside `overflow-auto` (`PatientHubPage`). The route’s `main` is `overflow-auto` because `/dashboard/patients` is not a no-pad / ops-canvas route |
| Preview is a narrow rail | `max-w-[480px]` overrides a 42% width on a normal monitor |
| Patient 360 is a footer action | `Open full profile` is in the preview footer. The header only has an unlabeled-to-sighted icon (`aria-label="Expand to full profile"`) |
| Registration leaves the directory | Hub `router.push` to the wizard page. The page sets `isInModal` only when `window.self !== window.top` |
| Merge is a peer of Add Patient | Header `Link` to `/dashboard/patients/merge` |
| Two population numbers | Tab badges are unfiltered branch counts. The toolbar count is the filtered `totalCount` |
| Export can look complete and is not | `LookupAsync` clamps page size to 100. `ExportCsvAsync` drops several advanced filters |

---

## 7. User POV / Operational Journey

Staff open Patient Directory from the existing sidebar placement (still under Doctor’s Desk; menu move stays deferred).

1. See one title: Patient Directory.
2. Search or open the inline filters.
3. Optionally narrow with an existing census tab.
4. Scan a short list: who this is, what is active, what to do next.
5. Click the row for a wide context panel. Open Patient 360 from that panel’s header when the full chart is needed.
6. Hand off with Check-in or Book appointment. Do not register a second way, assign a counsellor, or merge records from this page.

The wizard remains the only create path. After create, `returnTo` already returns the user to the directory.

---

## 8. Counsellor Reference Analysis

Inspected:

- Waiting list: `WaitingListSummaryWidget`, `WaitingListFilterToolbar`, `WaitingListQueueWidget`, `WaitingListWorkRow`, `WaitingListPatientDetailSheet`
- Session chrome, journey rail, action bar
- Finalize Surgery / OT preparation page
- Follow-up Center
- Analytics route only as another ops-canvas page (`/dashboard/counselor/analytics` is no-pad)

Reusable interaction facts:

- Ops pages opt the dashboard `main` into `flex flex-col overflow-hidden` so the page does not grow the browser scroll.
- `WaitingListQueueWidget` is `min-h-0 flex-1 flex-col overflow-hidden`. Rows scroll in `overflow-y-auto`. Pagination is a sibling **outside** that scroller.
- One title lives in `TopNav`.
- Primary vs outline actions, Sheet for patient context, Dialog for assign.
- Empty, loading (`role="status"`), and error (`role="alert"` or toast) are explicit.
- Row keyboard activation exists on the waiting-list row.

Do not copy: five KPI cards, nine status tabs, seven queue columns, owner filter, Assign/Reassign, pre-auth, journey rail, session action bar, teal tokens, 1600px density override, UHID-as-MRN labeling.

---

## 9. Shared Hospital Portal Design Patterns

| Pattern | Where it already exists | Directory use |
|---|---|---|
| Staff shell | Navy sidebar, white `TopNav`, Inter, emerald `primary-*`, gray canvas | Keep |
| Bounded main | `isCounsellingOpsCanvas` / `isNoPad` in `dashboard/layout.tsx` | Directory needs the same **height contract**, not the counselling canvas color |
| Worklist scroll + footer | `WaitingListQueueWidget` | Adopt the flex pattern |
| Sheet | shadcn `Sheet` | Keep for preview on small widths. Stop using it as the only filter host |
| Dialog | shadcn `Dialog` | Candidate host for the wizard after the form is extracted |
| Density tokens | `staff-worklist-row` in `globals.css` | Already on directory rows. Do not import counsellor CSS overrides |
| Toasts | `react-hot-toast` | Keep |
| Permissions | `useHasPermission` + `ProtectedRoute` | Keep existing codes |

---

## 10. Directory-Specific UX Principles

1. Discovery, not a queue of owned work.
2. One title. No KPI strip.
3. Filters are part of the page, collapsed by default after the search row.
4. Census tabs keep today’s words and predicates. Only the visual treatment may change.
5. The worklist is the scrollport. Pagination stays visible.
6. The row is identity, one context cluster, next action.
7. Preview is a wide context bridge, not Patient 360.
8. Create uses the existing six-step wizard. Merge is not a daily directory tool.
9. Color carries a label. No new palette.

---

## 11. Current Page Composition

```text
Dashboard main (overflow-auto, padded)     ← page can scroll
  Sticky white header
    result count | Add Patient, Export, Merge, Refresh
    Search | Filters (opens Sheet) | Favorites | Assigned to me
    chips
    census tabs
  Column overflow-auto
    mobile cards OR table
    pagination (follows the rows)
  Preview rail max 480px OR floating sheet
```

---

## 12. Target Page Composition

**DIRECTED. Not authorized.**

```text
Dashboard main for this route: flex column, overflow hidden
  Page toolbar
    Patient Directory (top nav)
    result count
    Add Patient | Export | Refresh
    (no Merge, no Favorites, no Assigned to me)
  Search
  Collapsible inline filters (existing fields, classified below)
  Census tabs (same keys)
  Worklist surface (flex-1 min-h-0)
    sticky header
    scrollable rows
    pagination footer (outside the row scroller)
  Preview: about half the work area, no 480px cap
    header: identity + Open Patient 360
```

Merge stays available from Patient 360’s duplicate hint until a separate merge decision (section 24).

---

## 13. Search Audit

| Fact | Detail |
|---|---|
| List box | `PatientSearchAutosuggest`. Selecting a hit navigates to the profile |
| List query | `q` debounced 300ms into the URL. Page resets to 1 |
| Server | `ApplySearchFilter`: contains on name, MRN, phone, email. Ignored under 2 characters. **Not** `health_id` |
| Suggest | Separate call, 250ms, max 8. Suggest **does** match Health ID |
| Tenant / branch | Lookup is tenant + effective branch. Suggest is branch-scoped |
| Sort interaction | Search does not clear `sortBy` |
| Empty | “No patients match your filters.” |
| Error | Table/card alert plus toast |
| Health ID | **DEFERRED.** Do not add it to `q` in the UX slice |

No second search. Do not mount `PatientGlobalSearch`.

---

## 14. Filter Inventory and Classification

All of these are already server-side on `GET /api/patients/lookup`, except saved-filter storage, which is the shared saved-search API. Applying filters does **not** change census predicates. Tab badges stay branch totals. Branch is the effective branch, not a filter chip.

| Filter | URL / query | Class | Note |
|---|---|---|---|
| Search `q` | `q` | Core | Keep on the discovery bar, not inside the sheet |
| MRN, name, phone, gender | `mrn`, `name`, `gender`, `phone` | Core identity | Useful when `q` is too broad. Gender is on the patient row |
| DOB range | `dobFrom`, `dobTo` | Secondary | Identity disambiguation |
| Favorites | `favorites=1` | Remove from Directory UX | Infrastructure stays (section 25) |
| Assigned to me | `assigned=1` | Remove from Directory UX | Predicate is open `Visit.AssignedTo`. The visit field is shared (section 26) |
| Care programs | `programCodes` | Secondary / operational | Cataract, glaucoma, retina, cornea, LASIK. Open visits at those departments |
| Engagement types | `engagementTypes` | Secondary | OPD, queue, IP, counselling, insurance, billing, camp. Operational, not clinical charting |
| Patient type | `patientTypes` | Operational / payer | Cash, Insurance, CoPay, CGHS, Camp. Implemented via non-terminal counselling sessions |
| Diagnosis text | `diagnosis` | Advanced | Joins diagnoses. Easy to confuse with Patient 360 |
| Provider, department | `providerId`, `departmentId` | Advanced | Visit assignment / department. Operational |
| Ward | `wardName` | Advanced | Bed/ward. IP operational |
| Appointment range | `appointmentFrom/To` | Secondary | Scheduling context |
| Admission range | `admissionFrom/To` | Advanced | Undischarged journeys |
| Saved filters | `/search/saved` scope Patient, field `HubLookupFilters` | Shared saved-search | Used by the sheet’s Saved section. Not directory-only storage. Keep until a decision on whether staff save lookup filters |
| Census tab | `tab` | Navigation, not a sheet filter | Section 15 |

Sheet sections today: Quick, Identity, Clinical, Schedule, Location, Care, Saved (`FILTER_SHEET_SECTIONS`).

**DIRECTED:** render this inventory in a collapsible region on the page. Default open set should be identity (MRN, name, phone, gender) plus Clear/Apply. The rest stay behind an Advanced disclosure **using the same controls**. Do not add filter meanings. Do not drop server parameters.

Saved filters and recent patients can stay inside Advanced. Recent-patient selection currently opens preview (`onRecentPatientSelect`).

**DECISION REQUIRED:** whether patient type, engagement, and care program belong in the default open set or only under Advanced. This audit recommends Advanced, because they are operational slices, not identity.

---

## 15. Census Audit

| Tab | URL | Predicate (unchanged) | Count |
|---|---|---|---|
| All | `all` | Base branch set | `stats.all` |
| Current | `current` | Union of open visits, active queue, undischarged IP, non-terminal counselling, non-terminal pre-auth, billing station, today’s camp, counselling JSON with `ccmsCoverageCaseId` | `stats.current` |
| New | `new` | `CreatedAt` within 30 days | `stats.new` |
| Discharged | `discharged` | Completed visit at this branch and not in the current set | `stats.discharged` |
| High priority | `high_priority` | Acuity high/critical or queue emergency/urgent | `stats.highPriority` |

Facts: counts are server-derived and branch-scoped. Changing a tab resets page to 1 and sends `tab` on the lookup. Tabs are filters of the same list, not routes. Component: `PatientHubClassificationTabs` (`role="tablist"`, `aria-selected`). It is directory-specific.

**DIRECTED (PD-DIR-10):** restyle active state, spacing, and wrapping to the staff tab quality. Do not rename. Do not add categories. Do not use counsellor pill tabs or KPI cards.

---

## 16. Worklist / Table Audit

Current columns after Slice 1:

| Column | Why it is there | Sort | Keep in target |
|---|---|---|---|
| Favorite star | Per-user `patient_favorites` | No | **Remove from Directory UX** |
| Patient | Name link, `formatPatientHubIdentityLine` (MRN · age · sex) | `name` server sort | Yes |
| Context | Primary engagement, reason, schedule, queue/station, acuity label | No combined sort. Server still accepts `scheduledAt`, `waitingMinutes`, `acuity` | Yes, one cluster. Do not restore separate columns |
| Actions | Check-in, More → book | No | Yes |

Hidden since Slice 1, data still on the DTO: reason, schedule, queue, acuity, highlights, assigned provider, phone, selection. Preview still reads the row and summary.

Phone is not on the row (good for density). It remains searchable and is a `tel:` link in preview. DOB is not shown as a date; age is. Sex is the stored gender string.

Assigned provider is not a directory column. The Assigned-to-me **filter** is separate and is directed for removal.

Sorting stays server-side. Removing a header does not remove the API sort key.

**DIRECTED:** do not add columns because the DTO has fields. Do not turn Context into a second visit card; the cluster already omits empty signals. Care-program pills stay off the row.

---

## 17. Scroll and Pagination Audit

| Fact | Evidence |
|---|---|
| Shell | `/dashboard/patients` uses padded `overflow-auto` main. Counsellor waiting list uses `overflow-hidden` flex main |
| Page | `PatientHubPage` is `h-full min-h-0`, but its parent is a padded block inside a scrolling main, so `h-full` does not lock to the monitor |
| List scroller | Inner column is `overflow-auto` and **includes** pagination |
| Header sticky | Directory header is `sticky top-0` inside the page, not a worklist header inside a bounded pane |
| Table header | `thead` is `sticky top-0` inside the table |
| Pagination | `PatientHubPagination`. Hidden when `totalCount <= 0`. Page size fixed at 25. Not a page-size control |
| Existing pattern to reuse | `WaitingListQueueWidget`: `min-h-0 flex-1`, row `overflow-y-auto`, footer outside |

**DIRECTED (PD-DIR-04):** put `/dashboard/patients` on the existing bounded-main contract (same idea as no-pad ops pages) **without** the counselling gray theme. Rows scroll. Pagination is the worklist footer. Do not invent a pixel height.

Mobile: the card list should be that same scroll body. Do not keep a separate document scroll for cards.

Keyboard: row tabIndex remains. A scrolling container must not trap Tab.

---

## 18. Patient Identity Safety Audit

| Field | Directory row | Preview | Patient 360 | Lookup API |
|---|---|---|---|---|
| Name | Yes, link | Header | Header | `firstName`, `lastName` |
| MRN | Identity line | Yes | `MRN {mrn}` | `mrn` |
| Age | Derived in the identity line | Derived | Derived | `dateOfBirth` |
| Sex / gender | Identity line | Yes | Yes | `gender` |
| Phone | Not on the row | `tel:` | Header `tel:` | `phone` |
| Health ID | No | No | Summary type has no `healthId` | Not on lookup row. Suggest only |
| Branch | Viewing branch is context, not a column | No | No | Filter is the selected branch |

**DIRECTED (PD-DIR-12):** name + MRN + age + sex is the row identity. That is enough to reduce look-alikes without putting phone on every row. Phone stays in search and in preview for the selected patient. Do not add Health ID to the row until D9 (deferred search) is decided, and do not relabel MRN as UHID.

Wording still differs (`Y` vs `y`, “MRN ” prefix). Aligning labels is cosmetic and optional. Do not change the identity fields.

---

## 19. Preview Panel Audit

| Fact | Detail |
|---|---|
| Open | Row click and keyboard on the row set `preview` |
| Desktop | Split pane, dock from 1280px. Width class is 42% **and** `max-w-[480px]` |
| Smaller | `PatientPreviewDrawer` sheet. Bottom sheet under 768px |
| Scroll | Panel body is `overflow-y-auto`. Independent of the list if the pane itself has `h-full` |
| Content | Identity, acuity and engagement chips, data-quality banner, visit card, emergency contact, five recent visits |
| Excluded | Vitals, meds, labs, imaging, counselling controls. `PreviewVitalsGrid` is unmounted |
| Loading | Pulse block when summary loads |
| APIs | Summary with `skipPhiAudit: true`, recent visits, PHI access post, recent-view post |

**DIRECTED (PD-DIR-05):** on the bounded desktop shell, the pane should be about half the work area (the existing 42% is in range) **without** the 480px cap. Keep `min-w` so it cannot collapse. Do not change preview APIs or clinical content.

**DIRECTED (PD-DIR-06):** “Open Patient 360” is a text action in the preview header, top-right, next to Close. The footer copy of the same link can be removed once the header action exists, so there is one labeled path. The expand icon alone is not that path.

---

## 20. Preview Action / Handoff Matrix

| Action | Behavior | Owner | Permission | Placement now | Directory role | Proposed |
|---|---|---|---|---|---|---|
| Row click | Toggle preview | Directory | `patient.view` | Row | Primary discovery | Keep |
| Patient name | Profile URL | Patient 360 | Page `patient.view`; record route does not re-check | Row | Primary navigation | Keep. Only row link to 360 |
| Expand icon | Same profile URL | Patient 360 | — | Preview header, icon | Duplicate of Open full profile | Replace with the labeled header action |
| Open full profile | Same profile URL | Patient 360 | — | Preview footer, filled button | Contextual handoff | Move to header. Label: Open Patient 360 |
| Continue encounter | `.../encounter/{visitId}` only if `assignedVisitId` | Encounter page | Not gated on the link | Preview footer | Clinical handoff, not a directory workflow | Keep as secondary, only when a visit id exists. Do not put it on every row |
| Check in | Front Office `?patientId=` | Front Office | Front desk enforces | Row and preview | Handoff | Keep on the row. Preview may keep it as secondary |
| Print | `/summary/print` | Print surface | — | Preview footer | Read | Secondary. Not a row action |
| Book appointment | Schedule `?patientId=` | Appointments | `appointment.view` | Row More | Handoff | Keep in More. Do not use `/dashboard/patients/book` |
| Counsellor | Not on the row | Waiting list | Waiting list | Record toolbar | Deferred D6 | Do not add in the next UX slice |
| Favorite | `PUT /patients/{id}/favorite` | Lookup favorites | `patient.view` | Row star | Remove from UX | Section 25 |
| Add Patient | Wizard route | MPI | `patient.create` | Header | Create | Section 22 |
| Export | CSV download | Lookup export | `patient.export` | Header | Read | Keep. Section 28 |
| Merge | Merge page | MPI merge | `patient.update` | Header | Remove from directory chrome | Section 24 |
| Refresh | Refetch lookup + stats | Directory | — | Header | Local | Keep |

---

## 21. Patient 360 Boundary

| Belongs on the directory | Belongs on preview | Belongs on Patient 360 |
|---|---|---|
| Search, filters, census, page of patients | Selected patient’s identity and current visit context | Overview, Clinical, Care, Documents, Coverage, Administration |
| Check-in and book links | Warnings, emergency contact, five visits | Vitals, meds, diagnoses, imaging, OCT, labs |
| Add Patient entry | Open Patient 360 | Counselling history, bills, CCMS, IP history |
| — | — | Timeline and Surgery/OT “not available” states |

Do not rebuild Patient 360. Completed reads stay as they are. Known record issues that are **not** this redesign: the record page does not declare `patient.view`; financial and CCMS panels call APIs and then treat 401/403 as unavailable; summary `branchId` is not passed through `ResolveEffectiveBranchAsync`.

---

## 22. Add Patient Wizard Audit

| Fact | Detail |
|---|---|
| Route | `apps/hospital-portal-web/src/app/dashboard/patients/new/page.tsx`. `NewPatientPage` is the page default export, about 1,700 lines, not a shared component |
| Steps | Six: personal, contact, identity documents, guardian (skipped when not required), emergency contact, medical/photo. Stepper is inline |
| Create | `patientApi.create` → `POST /api/patients`. MRN generated on the server |
| returnTo | `sanitizeAddPatientReturnTo`. Directory passes `/dashboard/patients` |
| Permission | API `patient.create`. The page has no second gate. The hub button does |
| Modal today | `isInModal` is **iframe detection** (`window.self !== window.top`), not a React Dialog. Direct directory navigation is a full page |
| Unsaved changes | No route blocker found in the page |
| Duplicate UX | The wizard source does not call `check-duplicates` (`canonical-add-patient.test.ts`). Submit shows `alert` with `response.data.message` or “Unknown error”. A 95% server reject uses `message` and should appear in that alert. There is no match list and no override |
| Other callers | Front desk, waiting list, booking, and `/admin/patients` use the same href helper |
| Dialog primitive | shadcn `Dialog` exists. It supports focus trap and Escape |

**DIRECTED (PD-DIR-07):** keep `/dashboard/patients/new` addressable for every caller. Directory Add Patient should present the **same** wizard in a large Dialog (about 80–90% width and height, sticky header and footer, internal scroll). Mobile uses the existing full-screen dialog/sheet behavior.

**Blocker for a drop-in:** the wizard is not extracted. An iframe-in-a-dialog would keep the route but is a poor focus and URL model. The safe shape is: extract the form body, render it from the route page **and** from a Dialog. Do not write a second form. Do not delete the route.

Other entry points can keep navigating until a later decision. This audit does not move them.

---

## 23. Duplicate Prevention Audit

| Question | Fact |
|---|---|
| When | `POST /api/patients` and update call `CheckDuplicatesAsync` before write. `POST /api/patients/check-duplicates` is a separate read (`patient.view`) |
| Compared | Exact name + DOB (confidence 1.0), phone (0.95), email (0.90), fuzzy name + same DOB (≥ 0.80). Tenant, not deleted |
| `IsDuplicate` | True if any match is ≥ 0.80 |
| Create block | Only if some match is **≥ 0.95**. Exact name+DOB and phone block. Email (0.90) and fuzzy matches under 0.95 **do not** block |
| User sees | Blocked create: alert text from `message`, or “Unknown error”. No list of candidates in the wizard |
| Bypass | No override permission and no “create anyway” control. Changing the submitted phone/name is the only way past a 95% block |
| After the fact | `PatientDuplicateHintBanner` on Patient 360 calls `check-duplicates` and, when `patient.update`, links to the merge page. It shows matches at the 0.80 `IsDuplicate` rule |
| Entry consistency | Every `POST /api/patients` hits the same server block. The wizard, front desk, and counsellor all use that POST. None of them show an 80% review UI. The 80% path is the record banner only |
| Server authority | Yes. The client does not decide the 95% block |

**DIRECTED (PD-DIR-09):** prevention stays on the create API. Do not lower the 0.95 block. Do not add a client bypass.

**DECISION REQUIRED:** whether matches from 0.80 up to but not including 0.95 must be shown in the wizard before create, and whether anyone may proceed. That policy does not exist. Do not invent an approver role. Until it exists, the wizard should at least surface the server’s existing `message` and `duplicates` payload on a 400 instead of a bare alert. Showing the payload is presentation of a current response, not a new threshold.

Merge is not the primary prevention tool (section 24).

---

## 24. Merge Dependency Audit

| Item | Fact |
|---|---|
| UI | `/dashboard/patients/merge` (`PatientMergePage`). Directory header link. Patient 360 duplicate banner uses `patientMergeUrl` |
| API | `POST` merge on `PatientsController.MergePatients`, `patient.update` |
| Writes | Transaction: re-point `visits`, `appointments`, `prescription`, `imaging_orders` to the primary id; delete `patient_favorites` for the duplicate; set duplicate `DeletedAt`, `Status = "Merged"` |
| Not rewritten in this service | Counselling sessions, bills, CCMS, IP journeys, lab rows are not in `PatientMergeService`. IP has its own `IsPatientMerged` read and blocks mutations |
| Irreversible | No unmerge in this service. Soft-deleted duplicate remains |
| Audit | Controller logs a merge description. Domain audit depth beyond that was not expanded here |
| Callers | Directory and the 360 banner. No counsellor or front-desk merge button found |

**DIRECTED (PD-DIR-08):** remove Merge from the directory header.

**Do not delete** the route, API, or IP merged-patient behavior in that UI change. The 360 banner still needs the page until a product decision retires merge.

**DECISION REQUIRED:** whether merge remains an MPI/admin tool at all, given it does not re-point every clinical and financial store. That is a data-integrity decision, not a directory chrome decision.

---

## 25. Favorite Dependency Audit

Classification: **Directory lookup infrastructure, plus a side effect in merge. Not a clinical workflow.**

| Use | Shared? |
|---|---|
| `patient_favorites` table, `PatientFavorite` entity | Auth-service. Lookup and toggle only |
| `PUT /api/patients/{id}/favorite` | `patient.view` |
| Lookup `favoritesOnly`, row `isFavorite` | Directory request/response |
| URL `favorites=1` | Directory |
| Filter sheet and chips | Directory |
| Export copies the flag | Export DTO. Export tests pass `favoritesOnly: true` |
| Merge deletes favorites for the duplicate | `PatientMergeService` |
| Saved-search `isFavorite` | **Different** flag on saved searches (`SearchService`). Not the patient star |

No ward, counsellor, billing, or report screen was found that lists patient favorites.

**DIRECTED (PD-DIR-01):** remove the star, the toolbar toggle, the sheet checkbox, and the chip from the directory UI.

**Do not drop** the table, endpoint, or DTO in that slice. A later slice may remove them only after export tests and merge SQL are updated together. That later slice is backend and is out of the UX sequence until requested.

---

## 26. Assigned-to-Me Dependency Audit

Classification: **Directory filter on a shared visit field.**

| Use | Shared? |
|---|---|
| Lookup `assignedToMe` | Directory query only |
| Implementation | Open visit `AssignedTo == current user`, tenant and exact branch (`ApplyAssignedToMeFilter`) |
| `Visit.AssignedTo` | Clinical/operational assignment. Used outside the directory. **Do not remove the column or the concept** |
| UI | Toolbar, sheet, chip, URL `assigned=1` |
| Export | Export accepts the flag |

**DIRECTED (PD-DIR-02):** remove the directory toggle, sheet checkbox, and chip.

**Do not** rename or delete `AssignedTo`. Counsellor ownership stays unrelated (PD-D).

---

## 27. Selection / Bulk Action Audit

| Item | Status |
|---|---|
| `PatientHubSelectionBar` | File remains. Not mounted |
| Checkboxes | Removed from the table in Slice 1 |
| Page state | `selectedIds` removed from `PatientHubPage` |
| Bulk API | None |
| Export | Does not read a selection set. It re-runs lookup |
| Tests | e2e now expects the bar and select-all to be absent |

Classification: **incomplete directory UI, now unmounted.** Not required for export. Safe to leave the unused component until a cleanup slice. Do not build bulk actions to justify it.

---

## 28. Export Audit

| Fact | Detail |
|---|---|
| UI | Header button, `patient.export` |
| API | `GET /api/patients/lookup/export`, same permission, effective branch, PHI export audit |
| Selection | Independent |
| Filters | UI sends the current lookup params. Server export copy **drops** name, diagnosis, provider, department, ward, and admission range |
| Census | `tab` is copied |
| Cap | Request asks 5000. `LookupAsync` clamps to 100 |
| Server-side | Yes |

**CERTIFIED:** permission and branch resolution stay. **Deferred defect:** completeness. Removing selection does not change export. Do not fix export inside the UX slices.

---

## 29. Responsive Audit

| Surface | Now | Target |
|---|---|---|
| Desktop | Table `md+`, horizontal scroll `min-w-[40rem]` | Same table inside the bounded pane |
| Under `md` | `PatientHubMobileCards` | Same identity / context / actions. Scroll inside the worklist, not the document |
| Filters | Sheet full width on small screens | Inline region that stacks. One control set |
| Census | `flex-wrap` tabs | Keep wrapping. Do not invent a breakpoint |
| Preview | Dock ≥1280px; sheet otherwise | Half work area on large screens. Sheet remains below the dock threshold |
| Add Patient | Full page | Large dialog; full-screen dialog on small viewports using existing Dialog/Sheet |
| Actions | Check-in + More | Same. Touch targets stay at least the current control size |

Do not adopt the 1600px counsellor grid.

---

## 30. Accessibility Audit

Present: top-nav title, census tablist, table `aria-label`, `aria-sort` on the name header, named favorite and More (when booking is allowed), sheet titles, preview header buttons, row `tabIndex` with Enter/Space only when the event target is the row, loading/error roles on mobile, pagination nav.

Gaps for the target UX:

- Census tabs have no `aria-controls`.
- An inline filter region needs a button with `aria-expanded`.
- Moving Patient 360 to the header needs a visible text name, not only the expand icon.
- The wizard `alert()` is not a dialog with focus return. A real Dialog should trap focus and restore it on close.
- Preview sheet is Radix and already traps focus. A wider split pane is not a modal; Escape should still close preview if it does today (verify in UAT; the panel has an explicit Close).
- Contrast stays on existing emerald/gray/acuity classes. No new colors.
- Status text stays with acuity (`High` plus “High acuity” for screen readers via `AcuityDot`).

Do not add an accessibility framework.

---

## 31. Loading / Empty / Error Audit

| State | Now | Rule |
|---|---|---|
| Branch loading | Pulse | Keep |
| No branch | `PatientHubEmptyBranch` | Keep. This is a precondition, not “no patients” |
| List loading | Table skeletons; mobile `role="status"` | Route `loading.tsx` matches the four-column skeleton |
| Updating | “Updating…” in the count | Keep |
| Empty list | “No patients match your filters.” | Keep. Do not say “no history” |
| Lookup error | `role="alert"` plus toast | Keep as failure, not empty |
| Preview summary loading | Pulse in the panel | Keep |
| Preview / 360 401 | 360 sections say “not available to this sign-in” | Do not copy that sentence onto an empty directory |
| Create failure | `alert` | Replace only when the wizard moves into a Dialog, and show the server message |
| Duplicate banner failure | Swallowed (`catch` empty) | Patient 360. Do not treat failure as “no duplicates” in a future wizard review |

---

## 32. Backend / API Contract Audit

The target UX in sections 12–20 can be built on the current lookup, stats, summary, recent visits, create, check-in URL, and schedule URL.

| Need | Contract |
|---|---|
| List, search, filters, tabs, paging, name sort | Existing lookup. **No new API** |
| Hide favorite / assigned-to-me in the UI | Stop sending the flags. Endpoints may remain |
| Inline filters | Same query params |
| Bounded scroll | CSS/layout only |
| Wider preview | CSS only. Same summary calls |
| Header Open Patient 360 | Existing route |
| Wizard in a dialog | Same `POST /api/patients` after extraction. **No new API** |
| Show duplicate payload on 400 | Existing error body. **No new API** |
| 80–95% review policy | **DECISION REQUIRED** before any new endpoint or permission |
| Remove favorite storage | **Later backend slice.** Not required for the UI |
| Merge removal from header | No API change |
| Export completeness | Deferred backend defect |
| Health ID in `q` | Deferred. Would be a bounded lookup change |

---

## 33. Authorization / Tenant / Branch Audit

Unchanged by the target UX:

- Directory page: `patient.view`.
- Lookup, stats, favorite toggle, summary: `patient.view`.
- Create: `patient.create`. Tenant from JWT. Branch via `ResolveEffectiveBranchAsync`.
- Export: `patient.export`.
- Merge: `patient.update`.
- Book: `appointment.view` on the menu item.
- Check-in: no extra directory permission.
- Counsellor: not on the directory row.

Do not add permissions. Do not copy counsellor branch rules into lookup. Lookup already uses `FollowupBranchAccessService`.

---

## 34. Database / Performance Audit

From source and the 2026-09-29 Slice 8 measurement (development database, not re-run):

| Item | Classification |
|---|---|
| Lookup statements | Batched engagement queries after the page, not a per-row N+1 |
| Search / current / high-priority / stats wall time | Round trips (about 0.5–0.9s). SQL plans were sub-millisecond on that small database |
| Stats + lookup on every view | Acceptable until a non-empty census is measured. **Requires measurement** before indexes |
| High-priority and acuity/wait sorts | Load matching ids then score in memory. **Optimization candidate**, not a UX blocker |
| Phone contains search | No `contact_number` index in the hub migration scripts. **Optimization candidate** only after measurement |
| Existing indexes | Raw SQL: tenant+MRN, tenant+branch, tenant+name. Not in the EF model. Prefix `Contains` will not use them as a prefix index |
| Inline filters | Same request as the sheet. No extra query |
| Preview | Extra summary, visits, PHI, recent-view calls. Already true. Not part of list scroll |

Do not add indexes in the UX slices.

---

## 35. Component Dependency Map

| Component | Responsibility | API | Disposition |
|---|---|---|---|
| `patients/page.tsx` | Permission gate, dynamic hub | — | Retain |
| `patients/loading.tsx` | Skeleton | — | Update only when the shell columns change |
| `PatientHubPage` | State, URL, toolbar | Lookup, stats, export | Refactor for shell, inline filters, hidden favorite/assigned |
| `PatientHubTable` | Desktop rows | — | Retain. Remove star column when PD-DIR-01 is approved |
| `PatientHubMobileCards` | Small-screen rows | — | Retain. Same hierarchy |
| `PatientHubContextCluster` | One context cell | Row DTO only | Retain |
| `PatientHubRowActions` | Check-in, book | Navigation | Retain |
| `PatientHubClassificationTabs` | Census | Stats | Restyle only |
| `PatientAdvancedFilterSheet` | Filter Sheet | Departments, providers, saved search | Replace host with inline region. Keep field components |
| `PatientFilterChips` | Applied filters | URL | Retain. Drop favorite and assigned chips with the toggles |
| `PatientSavedFiltersSection` | Saved searches | `/search/saved` | Keep under Advanced unless a decision removes saved lookup filters |
| `PatientHubPagination` | Pager | — | Move to worklist footer |
| `PatientHubSelectionBar` | Unused bulk bar | — | Leave unused. Cleanup later |
| `PatientPreviewPanel` / split / drawer | Context | Summary, visits | Refactor header action and width |
| `PatientSearchAutosuggest` | Search | Suggest | Retain |
| `new/page.tsx` | Wizard | `POST /patients` | Extract for dialog. Route stays |
| `merge/page.tsx` | Merge UI | Merge API | Remove directory link only. Page stays |
| `PatientDuplicateHintBanner` | 360 hint | `check-duplicates` | Out of directory slice. Still links to merge |
| `patient-hub-row-activation` | Keyboard rule | — | Retain |
| `patient-handoff` | Check-in and counsellor URLs | — | Do not change |
| `canonical-add-patient` | Wizard href | — | Extend only if the dialog still needs `returnTo` for full-page callers |

---

## 36. Product Decision Register

| ID | Statement | Status |
|---|---|---|
| PD-DIR-01 | Remove Favorite from Directory UI. Leave `patient_favorites` and the API | **DIRECTED** by this review. Not implemented. Shared storage stays |
| PD-DIR-02 | Remove Assigned to me from Directory UI. Leave `Visit.AssignedTo` | **DIRECTED.** Not implemented |
| PD-DIR-03 | Collapsible inline filters on the page. Same parameters. Advanced holds the operational filters | **DIRECTED** for the pattern. **DECISION REQUIRED** only for which secondary filters start expanded (section 14 recommendation: identity open, rest advanced) |
| PD-DIR-04 | Bounded worklist, internal row scroll, pagination in the footer. Use the existing flex shell, not a new height system | **DIRECTED** |
| PD-DIR-05 | Desktop preview about half the work area. Remove the 480px cap | **DIRECTED** |
| PD-DIR-06 | Open Patient 360 as a labeled preview-header action | **DIRECTED** |
| PD-DIR-07 | Same six-step wizard, route remains, directory launches it in a Dialog after extraction | **DIRECTED.** Blocked on extraction, not on a new API |
| PD-DIR-08 | Remove Merge from the directory header. Keep route, API, and 360 banner | **DIRECTED** for the button. **DECISION REQUIRED** before deleting merge |
| PD-DIR-09 | Do not weaken the 0.95 server block. Do not make merge the prevention tool | **DIRECTED.** **DECISION REQUIRED** for any 0.80–0.95 proceed/override rule |
| PD-DIR-10 | Census visuals may change. Predicates, labels, and URL values may not | **DIRECTED** |
| PD-DIR-11 | Row stays identity + one context cluster + actions. Not Patient 360 | **DIRECTED.** Matches certified PD-C |
| PD-DIR-12 | Row identity is name, MRN, age, sex. Phone stays off the row | **DIRECTED** |

Earlier PD-A (sidebar) and Health ID search stay deferred. This document does not move the sidebar.

---

## 37. UX Gap Register

| ID | Area | Current | Desired | Risk | Slice |
|---|---|---|---|---|---|
| G1 | Shell / scroll | Padded scrolling main; pagination follows rows | Bounded main, footer pager | Layout flag is shared `layout.tsx`. Scope it to this path only | A |
| G2 | Favorite UI | Star, toggle, chip, sheet | Hidden | None if API remains | A |
| G3 | Assigned-to-me UI | Toggle, chip, sheet | Hidden | None if `AssignedTo` remains | A |
| G4 | Filters | Right Sheet | Inline collapsible, same params | Staff lose a familiar sheet until UAT | B |
| G5 | Census look | Basic underline tabs | Staff-quality tabs, same semantics | Copy/label drift if someone “clarifies” New/Current | C |
| G6 | Preview width | 42% and max 480px | Half work area | List gets narrower. That is intended | D |
| G7 | Preview 360 action | Footer + icon | Header label | Two links until footer link is removed | D |
| G8 | Add Patient | Full-page route | Dialog of the same wizard | Wizard is not a component. Iframe hack is the wrong fix | E |
| G9 | Duplicate message | `alert` | Show existing 400 `message` and matches. No new threshold | 0.80–0.95 policy still open | F, after decision |
| G10 | Merge button | Directory header | Removed | 360 banner and route remain | A (button only) |
| G11 | Export file | Cap and dropped filters | Unchanged in UX work | Users may think export is the full census | Out of UX slices |
| G12 | Selection component | Unmounted file | Leave | None | Later cleanup |
| G13 | Phone on row | Absent | Stay absent | Look-alike risk is carried by MRN + age + sex | No slice |
| G14 | Health ID search | Not in `q` | Stay deferred | Suggest and list can disagree | No slice |
| G15 | Record `patient.view` | Missing on the page | Not this program | Deep link vs directory | Separate security |

---

## 38. Target Information Architecture

```text
TOP NAV
  Patient Directory

TOOLBAR
  filtered count
  Add Patient (primary)
  Export
  Refresh

SEARCH
  existing autosuggest

FILTERS (collapsed)
  open: MRN, name, phone, gender, Apply, Clear
  advanced: programs, engagements, patient type, diagnosis,
            provider, department, ward, dates, saved, recent
  not shown: Favorites, Assigned to me

CENSUS
  All | Current | New | Discharged | High priority

WORKLIST
  Patient | Context | Actions
  scroll
  pagination

PREVIEW
  identity
  current context already certified
  header: Open Patient 360 | Close
  secondary: Check-in, Print, Continue encounter when a visit exists
```

No KPI cards.

---

## 39. Target Interaction Model

| Gesture | Result |
|---|---|
| Row click, Enter, Space on the row | Preview |
| Name | Patient 360 |
| Open Patient 360 in the preview header | Same profile URL |
| Check-in | Front Office |
| More → Book appointment | Scheduler |
| Add Patient | Dialog hosting the canonical wizard; route still works if opened directly |
| Census tab | Same `tab` value |
| Filter Apply | Same URL keys, page 1 |
| Escape | Closes dialog or preview sheet using the existing primitive |

Nested controls must not also toggle preview (existing `shouldActivateRowPreview` rule).

---

## 40. Target Visual Language

| Aspect | Directory now | Counsellor reference | Target directory | Class |
|---|---|---|---|---|
| Shell | White padded scrolling page | Gray canvas, overflow hidden | Bounded main, white/gray staff surfaces, **not** teal | Shared standard |
| Title | Top nav only | Top nav only | Keep | Shared |
| Search | Autosuggest + Filters button | One toolbar row | Search, then a collapsible filter region | Directory-specific layout of existing controls |
| Tabs | Emerald underline, five census labels | Nine counselling pills | Restyle density only. Keep five labels | Shared tab pattern, not counsellor pills |
| Summary | Result count | Five KPIs | Count only | KPI cards are counsellor-specific |
| Worklist | Table or cards, page scroll | Internal scroll, footer pager | Internal scroll, footer pager | Shared ops pattern |
| Row | Identity, context, check-in | Seven operational columns | Keep the three zones. Remove the star | Directory IA |
| Status | Acuity word + tint | Saturated lifecycle pills | Keep acuity words. No new palette | Shared “text plus tint” |
| Preview | 480px cap | Context sheet `sm:max-w-md` | Half work area | Directory-specific width. Sheet primitive stays |
| Dialog | Unused for create | Assign dialog | Wizard dialog | Shared Dialog |
| Pagination | Under the rows | Outside the scroller | Outside the scroller | Shared |
| Theme | Emerald | Teal tokens | Emerald | Counsellor theme is not appropriate |

---

## 41. Proposed Implementation Slices

Not authorized. Each slice preserves census, tenant, branch, lookup semantics, page size, and permissions.

### Slice A — Shell, scroll, and directory chrome removals

Scope: opt `/dashboard/patients` into a bounded flex main (path-scoped, not the counselling canvas). Pagination becomes the worklist footer. Remove Favorite and Assigned-to-me controls and chips. Remove the Merge header link. Keep APIs, routes, and `Visit.AssignedTo`.

Likely files: `dashboard/layout.tsx` (path condition only), `PatientHubPage`, table, mobile cards, filter chips, filter sheet quick section, loading skeleton, tests that expect the toggles or merge link.

APIs: none.  
Tests: unit assertions for absent controls; pagination still calls the same page size.  
UAT: desktop scroll, pagination visible without document scroll, favorite/assigned/merge absent, check-in and add still present.  
Out of scope: filter layout, preview, wizard, export fix.

### Slice B — Inline filters

Scope: render the existing sheet fields in a collapsible page region. Identity group visible when expanded; other sections under Advanced. Delete the Sheet wrapper only after parity. Same Apply behavior and URL keys.

APIs: none.  
Out of scope: new filters, saved-search deletion.

### Slice C — Census presentation

Scope: spacing, active style, keyboard labels. No predicate or label edits.

APIs: none.

### Slice D — Preview

Scope: drop `max-w-[480px]`. Put a text “Open Patient 360” in the header. Remove the duplicate footer profile link after the header works. Keep check-in, print, and conditional continue-encounter. Do not change summary queries.

APIs: none.

### Slice E — Wizard dialog

Scope: extract the current wizard body. Route page and directory Dialog both render it. Full-page URL remains. No second form. No iframe.

APIs: none (`POST /api/patients` unchanged).  
Out of scope: other modules’ Add Patient buttons, unless they already pass `returnTo`.

### Slice F — Duplicate presentation

Scope: only after PD-DIR-09’s missing rule is decided. Until then, the maximum change is showing the existing 400 body in the wizard UI. No new threshold. No bypass.

### Not in this roadmap

Favorite table deletion, merge API deletion, export clamp, Health ID search, sidebar move, Patient 360 rebuild, counsellor changes.

---

## 42. Test Strategy

When a slice is authorized:

- Vitest for URL parsers (favorites/assigned keys may remain in the parser even if the UI hides them).
- Update only assertions that named removed controls.
- Preview boundary test stays green (no vitals).
- Canonical add-patient test stays green (one wizard, `patientApi.create`).
- Do not delete filter-parity tests.
- Playwright hub spec only with the authenticated environment. Slice 1 already changed selection and sort-header cases; a later slice must update favorite and merge cases the same way: assert the new contract, do not delete the behavior test.

---

## 43. Manual UAT Strategy

Do not accept the current screen as the redesign. UAT starts only after an authorized slice.

For Slice A, on a normal desktop monitor and below `md`:

1. Patient Directory title, no second heading.
2. No KPI cards.
3. Pagination visible without scrolling the browser.
4. Row scroll inside the worklist.
5. Favorites, Assigned to me, and Merge are absent.
6. Add Patient, Export (by permission), Refresh, search, census, check-in, and book still behave.
7. Census badges do not shrink when searching.
8. Keyboard row opens preview; name does not.
9. Empty and error states still differ.

Later slices add their own checks (inline filters, preview width, dialog wizard). Mark anything not run as NOT EXECUTED.

---

## 44. Risks / Dependencies

- Path-scoping the dashboard main is a shared layout file. A wrong matcher would change counsellor or other pages.
- Hiding Assigned to me must not be described as removing visit assignment.
- Removing the merge button while the 360 banner still links to merge is consistent only if the route stays.
- Merge does not re-point every domain. Hiding the button does not fix that.
- The 0.95 block and the 0.80 `IsDuplicate` flag are different. A UI that treats every `IsDuplicate` as a hard block would **change** create behavior. Do not do that without a decision.
- Preview at half width squeezes the table. Identity must stay readable (`min-w` on the table already exists).
- Export remains incomplete. The UX must not label it as a full extract.
- Slice 8 performance numbers are from an empty current-tab database. Do not index from this audit.

---

## 45. Open Product Decisions

1. Which secondary filters are under Advanced (recommendation in section 14).
2. Whether saved lookup filters stay (recommendation: yes, under Advanced).
3. Policy for duplicate matches below 0.95: show only, block, or allow with a named role. **No role exists today.**
4. Whether the merge route remains for MPI/360 after the directory button is gone, given incomplete re-pointing.
5. Health ID in list search (still deferred).
6. Sidebar move out of Doctor’s Desk (still deferred).
7. Whether other Add Patient entry points should open the same dialog later.

Conflicts with certified rules: none of the directed UI changes rewrite census, tenant, branch, the 0.95 block, or `patient.create`. The conflict to avoid is treating `IsDuplicate` (≥ 0.80) as the create block.

---

## 46. Final Recommendation

Approve PD-DIR-01 through PD-DIR-12 as the Directory UX contract, with the open items in section 45 left open.

Implement Slice A first. It fixes the rejected shell and removes Favorite, Assigned to me, and the Merge button without an API, a census change, or a second wizard.

Do not continue cosmetic edits on top of Slice 1. Do not copy the counsellor queue. Do not rebuild Patient 360.

---

## 47. STOP / NEXT GATE

IMPLEMENTATION STATUS: **NOT AUTHORIZED**

NEXT GATE: Review this reconciliation audit and approve the target UX/IA (PD-DIR-01 through PD-DIR-12, plus the open items that must stay open) before any implementation slice.

STOP.
