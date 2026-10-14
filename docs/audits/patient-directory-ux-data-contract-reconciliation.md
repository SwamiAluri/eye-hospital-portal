# Patient Directory — UX / Data Contract Reconciliation

Status: AUDIT ONLY. Application changes: 0.
Baseline: Slice A is implemented (OPD & Registration placement, bounded worklist, footer pagination, Favorite / Assigned-to-me / Merge removed from Directory chrome).
This document does not authorize implementation.

Sources inspected: `PatientLookupDtos.cs`, `PatientLookupService.cs`, `PatientEngagementService.cs`, `PatientHubPage` / table / context cluster / filter sheet / preview, `/dashboard/patients/new`, `PatientDuplicateDetectionService`, `PatientMergeService`, Counsellor waiting-list grid and row, portal `Dialog` and `Sheet` primitives.

---

## 1. Executive summary

Slice A fixed structure and navigation. The remaining gap is information density, not another shell.

The live lookup row already returns visit reason, schedule or check-in time, provider name and role, station, room, wait minutes, acuity, engagement pills (OPD, queue, IP, counselling, pre-auth, CCMS, billing, camp), department codes, and an IP admission snapshot. The Directory paints one of those signals into a single Context cell and hides the rest. That is why the list feels sparse. Splitting the existing payload into scanable columns does not require a new API, DTO, join, or permission.

Do not copy the Counsellor seven-column model (Patient, Visit, Procedure, Owner, Payment, Status, Action). Those columns are counselling-session facts. Directory columns must stay hospital-wide discovery facts that the lookup DTO already owns.

A second finding blocks a naive “care program” column: `CareProgramCodes` are open-visit **department codes**, not the Cataract / Glaucoma catalog shown in the filter. The filter matches those codes to `Departments.DepartmentCode`. The UI must not label that field as a clinical program until a product decision says so.

Census predicates, search, page size 25, permissions, Patient 360, the Add Patient route, and the ≥ 0.95 create block stay certified. Preview width, inline filters, Dialog presentation of the wizard, and any duplicate-review UI are presentation decisions. Merge retirement is a data-integrity decision, not a Directory chrome decision.

## 2. Current UX assessment

What Slice A got right:

- One navigation entry under **OPD & Registration**, route `/dashboard/patients`, permission `patient.view`.
- Bounded main for that exact path. Rows scroll inside the worklist. `PatientHubPagination` sits in the footer. Page size 25.
- Identity line is the certified compact form: MRN · age · sex, plus avatar and name link to `/dashboard/patients/{id}`.
- Row click / Enter / Space opens Preview. Nested Check-in and More do not.
- Header actions that remain: Add Patient (`patient.create`), Export CSV (`patient.export`), Refresh, Filters sheet, census tabs.

What still fails the workflow:

- Desktop columns are Patient | Context | Actions. Context stacks engagement, reason, schedule, queue/ward, and acuity in one cell. Provider, service code, and secondary engagements are on the row object and invisible.
- Census is five text tabs with branch-wide counts. The “N patients” label is the filtered `totalCount`. Those two numbers answer different questions and are easy to misread. There are no KPI cards, which is correct. The tabs themselves are visually lighter than the portal’s status-pill worklists.
- Filters are a right Sheet (`sm:max-w-sm`). Search is the only always-visible query. Favorite and Assigned-to-me controls are gone; the query keys still parse.
- Docked preview is `w-[42%] max-w-[480px] min-w-[360px]` from the `xl` breakpoint. The 480px cap wins on a normal workstation. Patient 360 is an icon (`Expand to full profile`) plus a footer button (`Open full profile`). The footer also repeats Check-in.
- The page has no in-page `h1`. The title comes from the sidebar label in the top nav. That avoids the duplicate “Patients” heading. It is not a missing title.

## 3. User POV assessment

No new roles or permissions are proposed. Visibility stays `patient.view` for the list, `patient.create` for Add Patient, `patient.export` for export, `appointment.view` for Book appointment.

| Persona | Identify | See immediately | Filter | Act | Preview | Patient 360 | Owning module |
|---|---|---|---|---|---|---|---|
| Reception / Front Office | Name, MRN, age, sex, and whether this is the person at the desk | Today’s engagement, reason, station, scheduled or checked-in time | Name, MRN, phone, appointment range | Check-in; Book appointment when permitted | Phone, emergency contact, recent tokens | Demographics and history | Front Office check-in, Appointments |
| Medical Records | MRN plus lookalike discrimination | Active vs historical engagement, last visit time | MRN, name, DOB range, diagnosis | Open the record | Recent visits, data-quality gaps | Full chart | Documents live on Patient 360 |
| Nurse / clinical support | Correct patient before handing off | Station, room, wait, acuity, provider | Provider, department, engagement type | Preview, then the owning desk | Current visit and acuity source summary | Orders and notes | Doctor’s Desk, Ward, Queue |
| General authorized staff | Enough identity to avoid opening the wrong chart | One current-status pill | Search `q` | Preview or name → 360 | Same discovery snapshot | Longitudinal record | Their own module |
| Known-patient search | Name or MRN match | Confirm age and sex | `q` (min 2; name, MRN, phone, email; not Health ID) | Open 360 | Only if several rows look alike | Destination | — |
| Lookalike discrimination | Name plus MRN, age, sex. Phone is on the DTO and in search, not on the row | Provider and reason when two rows share a name | Phone and DOB in the sheet | Preview before acting | Phone and emergency contact | — | — |
| Current engagement | Which workflow currently owns the patient | Primary engagement pill and status | Engagement types already in the sheet | Handoff, not counselling or billing actions on the row | Secondary engagements | Not the destination | The module named by the engagement |
| Longitudinal need | Identity only | Not diagnoses, meds, labs, bills | — | Name link | Must not grow into a chart | Patient 360 | Clinical, billing, coverage, documents |

## 4. Current information architecture

```
Dashboard main (exact path /dashboard/patients, overflow hidden)
  Header: filtered count, Add Patient, Export, Refresh
  Search + Filters button
  Chips
  Census tabs: All, Current, New, Discharged, High priority
  Worklist: Patient | Context | Actions
  Footer pagination
  Preview dock or floating drawer
```

Context today (`PatientHubContextCluster`): one primary engagement (priority IP, queue, OPD, counselling, insurance, CCMS, billing, camp), reason, schedule string, queue/station/room or admitted badge, acuity label. Empty signals are omitted. Care-program chips are not rendered.

## 5. Target information architecture

```
Page shell (existing bounded main)
  Header: filtered result count, Add Patient, Export, Refresh
  Search
  Collapsible filters using the existing groups and query keys
  Census: the same five predicates, presented as compact status tabs, not a second KPI row
  Discovery worklist: identity, engagement, visit, location, actions
  Pagination footer
  Preview beside the list on wide desktop, drawer below xl
```

Provider and service stay available in Preview until the column model in section 9 is approved. Putting every DTO field on the row recreates a mini chart.

## 6. Counsellor reference assessment

Counsellor waiting list, inspected in code:

- Shell: flex column, `min-h-0`, `overflow-hidden`, row region scrolls, pagination is a sibling (`WaitingListQueueWidget`, `WaitingListQueuePagination`). Slice A already uses this mechanic on a white Hospital Portal surface.
- Large-desktop tracks (`WAITING_LIST_WORK_GRID_TRACKS`): Patient | Visit | Procedure | Owner | Payment / Coverage | Status | Action.
- Header and rows share one grid class so columns align. Directory uses a `<table>` with sticky header. Either a table or a shared grid is acceptable. Do not import `waiting-list-work-grid` or counselling tokens.
- Summary: five statistic cards **and** status pills (`WaitingListSummaryWidget`). Those cards are counselling queue counts. Directory census numbers are the same five concepts as the tabs. A second card row would duplicate them.
- Filters: inline toolbar (`WaitingListFilterToolbar`), not a Sheet. Directory filters are richer (identity, diagnosis, dates, ward, saved searches) and do not fit that one toolbar row.
- Row: avatar, name, identity line; primary and secondary lines per column; status pill; overflow or workflow button. Row activates the counselling session. Directory row must keep opening Preview. The name stays the Patient 360 link.
- Detail: `WaitingListPatientDetailSheet`. Directory already has a preview pane. Do not add a second demographics sheet.
- Dialogs: Assign and Reassign. Those are ownership mutations. Directory must not gain them.
- Spacing: `staff-worklist-row`, existing page padding tokens. Reuse those classes. Do not reuse `counselling-*` colors.

Other portal patterns that already exist and are enough:

- `Sheet` right side, default `sm:max-w-sm`.
- `Dialog` sizes through `6xl` and `full` (`max-w-[min(96rem,calc(100vw-2rem))]`, max height `calc(100vh-2rem)`). A large wizard dialog does not need a new dialog primitive.
- Status pills are small rounded chips. Engagement styles already exist in `HUB_ENGAGEMENT_STYLES`.
- Buttons: emerald primary, gray border secondary. Check-in is secondary text; Add Patient is primary. Keep that hierarchy.

## 7. Directory vs Counsellor distinction

| | Directory | Counsellor waiting list |
|---|---|---|
| Question | Which patient, what is current, where next? | Which counselling case, who owns it, what is the next counselling action? |
| Population | Branch patients, census tabs | Counselling work queue |
| Row activation | Preview | Session |
| Name | Patient 360 | Patient context sheet |
| Status | Engagement type already stored, not a session status | Session status pill |
| Payment / pre-auth | Not a directory column | Payment column and pre-auth action |
| Owner | Display of assigned provider if shown. No Assign | Assign / Reassign |
| Procedure / eye | Not a directory column | Procedure column |

## 8. Column / data audit

Classification key: (1) lookup DTO (2) lookup API query but not on the row (3) authoritative elsewhere (4) new API (5) new aggregation (6) sensitive or permission-gated (7) not appropriate on Directory.

| Field | Class | Notes |
|---|---|---|
| Name, MRN, DOB, gender, photo | 1 | DOB is used to compute age. Raw DOB is not on the row line today. |
| Phone, email | 1 and 6 | Searchable. Phone is appropriate in Preview and in the identity sheet. Showing it on every row is an open decision. Email is not needed for matching at the desk. |
| Health ID | Suggest DTO only | Not on lookup row. Adding it is a search-contract change, out of scope. |
| Acuity | 1 | `AcuityScoringService` from emergency, queue priority, allergy, critical notes, abnormal vitals, urgent IP. Default `low` when no bundle. Authoritative for discovery, not a clinical diagnosis. |
| Reason for visit | 1 | Open visit appointment reason, else next appointment reason. |
| ScheduledAt | 1 | Open-visit `CheckedInAt`, else appointment date + start time. The label “Schedule” overstates checked-in patients. |
| Last visit | 1 | Not shown. Useful in Preview, not required on every directory row. |
| Provider name and role | 1 | From open visit assignee, else queue role mapping. Display only. |
| Station, room, wait minutes | 1 | Queue preferred; else visit station and check-in wait. IP ward replaces station when admitted. |
| IP admission | 1 | Admitted flag, time, ward, clinical state, procedure name. Procedure is an IP snapshot, not an OT board. |
| Engagements | 1 | Built in `PatientEngagementService`: OPD, billing station, queue, IP, counselling, camp, CCMS from package JSON, pre-auth. Labels and statuses only. |
| CareProgramCodes | 1 with a labeling hazard | Department codes of open visits, matched by `DepartmentCode`. Not diagnoses. |
| Department name | 2 | Filter `departmentId` exists. Display name is not on the row. Showing the code is possible today. Showing the name needs a DTO field or client catalog join. Do not add that in the next slice unless approved. |
| Diagnosis | 2 | Filter joins active `PatientDiagnoses` to code and description. The text is not on the row. Diagnosis on the directory row is Patient 360 territory. |
| Patient type | 2 | Filter is open counselling-session `PatientType` (Cash, Insurance, CoPay, CGHS, Camp). It is not a patient master field and is not on the lookup row. A Payment column would copy Counsellor and would be wrong for non-counselled patients. |
| Insurance policy, blood group, allergies, emergency contact, vitals | 3 | `PatientSummary` used by Preview, not the list. Policy numbers and vitals stay off the worklist. |
| Branch | Page scope | `ResolveEffectiveBranchAsync`. A branch column would repeat the header. |
| Billing amounts, coverage adjudication, counselling notes, OT state, follow-up tasks | 7 | Owning modules. |
| Favorite, assigned-to-me | 1 and 2, UI removed | Do not restore as columns. |

Existing sort keys the API still accepts: `name` (default), `mrn`, `lastVisit`, `scheduledAt`, `acuity`, `waitingMinutes`. Visible sort control is name only. Engagement sorts load every matching patient id into memory. Do not add sort headers for fields that trigger that path until a performance decision exists.

## 9. Proposed desktop columns

Proposal only. Approve before implementation. All fields below are class (1) unless noted.

| Column | Purpose | Fields | Sensitivity | Sort today | Filter today | Tablet | Mobile | Home |
|---|---|---|---|---|---|---|---|---|
| Patient | Safe identification | Avatar, full name, MRN, age, sex | Name and MRN are PHI already on this screen | `name` | `q`, name, MRN, gender, DOB | Keep | Card title | Directory |
| Engagement | Where the patient is in the hospital | Primary engagement label and status. Extra types as a `+n` only, not a paragraph | Operational | None without a new sort | `engagementTypes` | Keep | One pill | Directory |
| Visit | Why they are here and when | Reason; then either appointment time or “Checked in” plus time, because `scheduledAt` is overloaded | Clinical-adjacent reason | `scheduledAt` exists but means check-in-or-appointment | Appointment range, diagnosis stays a filter | Keep | One secondary line | Directory |
| Location | Where to find them | Station or ward, room, wait minutes when present. IP badge when admitted without a ward | Operational | `waitingMinutes` exists but is an in-memory sort | Ward name, department id | Move into Visit or Preview | Fold into the secondary line | Directory when present, else omit the cell |
| Actions | Next navigation | Check-in; More → Book appointment if `appointment.view` | — | — | — | Keep | Check-in on the card | Directory |

Held out of the desktop row until a separate approval, because they are already on the DTO but increase width and clinical density:

- Provider name and role → Preview visit card (already loaded).
- Acuity → Preview header badge (already there). A quiet acuity mark may return on the Engagement pill only when value is high or critical, using the existing High priority census meaning. Low acuity on every row is noise.
- Department code → do not show as “Care program”.
- Phone → Preview and Filters, not every row.

Permissions: no new codes. Check-in route stays `/dashboard/frontdesk/check-in?patientId=`. Book appointment stays `/dashboard/appointments/schedule?patientId=`.

## 10. Proposed tablet columns

Below `xl` (the current preview-dock breakpoint, 1280px):

Patient, Engagement, Visit, Actions.

Location folds into the Visit secondary line when present. Preview uses the existing floating drawer, not the dock. No new breakpoint system.

## 11. Proposed mobile cards

Keep `PatientHubMobileCards`. Hierarchy:

1. Avatar, name, MRN · age · sex.
2. One engagement pill.
3. One line: reason, else station or ward, else schedule.
4. Check-in. More → Book appointment under the same permission.

Do not add phone, provider, programs, or acuity-low. Cards stay inside the existing bounded scroller with pagination outside it.

## 12. Census / tab audit

| Tab | Predicate | Count source |
|---|---|---|
| All | No tab filter. Branch patients, not deleted, branch null or selected branch | Stats `All`, branch-wide |
| Current | Open visit, active queue, undischarged IP journey, non-terminal counselling, non-terminal pre-auth, visit station containing “billing”, today’s camp sessions | Stats `Current` |
| New | `CreatedAt` within 30 days | Stats `New` |
| Discharged | Not in Current, and a completed visit exists at the branch | Stats `Discharged` |
| High priority | Acuity high or critical, or queue priority in the high set | Stats `HighPriority`. This path calls `LoadForPatientsAsync` with an empty id list and scores the branch. |

Stats ignore `q`, advanced filters, favorites, and assigned-to-me. Filtered `totalCount` is a different number and is what the header and pagination use. Do not merge those calculations.

Visual recommendation: keep the five tabs as a compact segmented control using existing border and emerald active styles. Do not add KPI cards. Do not rename the tabs. Do not change URL values `all | current | new | discharged | high_priority`. Page still resets to 1 on tab change.

Count-clarity copy (which number is branch census vs filtered) is an open presentation decision. It is not a calculation change.

## 13. Filter audit

Existing sheet groups after Slice A:

| Group | Controls | Class | Query keys |
|---|---|---|---|
| Identity | Name, MRN, phone, gender, DOB from/to | Primary for records and reception | `name`, `mrn`, `phone`, `gender`, `dobFrom`, `dobTo` |
| Clinical | Diagnosis text | Advanced | `diagnosis` |
| Schedule | Appointment from/to, admission from/to | Schedule and location | `appointmentFrom`, `appointmentTo`, `admissionFrom`, `admissionTo` |
| Location | Department, provider, ward name | Advanced | `departmentId`, `providerId`, `wardName` |
| Care | Program codes, engagement types, patient type | Care / engagement. Program codes are department codes | `programs`, engagement list, `patientTypes` |
| Saved | Saved searches | Advanced | Existing saved-search API, separate from lookup query |
| Removed from UI | Favorites, Assigned to me | Obsolete on the Directory surface | `favorites`, `assigned` still parse |

`q` stays the search box, not a sheet field. Search fields stay name, MRN, phone, email. Health ID stays on suggest only.

Recommendation: a collapsible panel under search, same groups, same keys, same apply-resets-page-1 behavior. The Sheet can remain the mobile presentation. Do not delete diagnosis, ward, patient type, or saved searches. Patient type must keep its current meaning (open counselling session type) and must not be relabeled “payment” without a product decision.

## 14. Preview audit

Current pane (`PatientPreviewSplitPane`, `PatientPreviewPanel`):

- Width: 42% with a 480px cap and 360px floor, docked at `xl`, drawer otherwise. Internal body scrolls. Header and footer are shrink-0. That scroll pattern already matches the target.
- The 480px cap prevents 40–50% of a 1400–1600px content area. Removing `max-w-[480px]` and keeping `w-[42%]` (optionally `min-w-[360px]` and `max-w-[50%]`) is a CSS change on this component only. It is supported. It is not approved until the column model is stable, because a wider preview plus more columns will crowd the list.
- Header: identity, MRN, acuity, all engagement pills, call link, dock toggle, expand icon, close.
- Body: data-quality banner, visit card, emergency contact, up to the recent-visits query. Summary API is a second call already used. Do not add sections.
- Footer: Continue encounter if `assignedVisitId`, Open full profile, Check in, Print.
- Target header action: a text link “Open Patient 360” using the existing `patientProfileUrl`. The expand icon can go once the text action exists. The footer duplicate “Open full profile” should not remain if the header action is approved.
- Keep Continue encounter, Check in, and Print. Do not add Assign, counselling, billing, or coverage actions.

## 15. Action audit

| Action | Class | Rule |
|---|---|---|
| Name link | Navigation to Patient 360 | Keep. No other row link. |
| Row click / Enter / Space | Preview | Keep. |
| Check-in | Owning-module handoff | Keep on the row and in Preview. |
| Book appointment | Owning-module handoff, `appointment.view` | Keep under More. |
| Add Patient | Primary header, `patient.create` | Keep. Route `/dashboard/patients/new`. |
| Export | Secondary header, `patient.export` | Keep. Do not fix the 100-row clamp in a UX slice. |
| Refresh | Secondary | Keep. |
| Filters | Secondary | Keep until inline presentation is approved. |
| Continue encounter | Preview, only with `assignedVisitId` | Keep. |
| Print summary | Preview | Keep. |
| Open Patient 360 from Preview | Navigation | Header, after approval. |
| Merge | Not a Directory action | Stay on Patient 360 hint and `/dashboard/patients/merge`. |
| Favorite, Assigned to me | Removed | Do not restore. |
| Counsellor, billing, CCMS, OT actions | Not appropriate | Owning modules. |

## 16. Add Patient Dialog audit

Canonical route: `/dashboard/patients/new`. One page, about six steps in the same component, not an extracted form.

Steps: 1 Personal, 2 Contact, 3 Identity documents, 4 Guardian (skipped when not required), 5 Emergency contact, 6 Insurance. Continue and Back live in the page. Submit is `POST /api/patients`. `patient.create` gates the Directory button via `buildCanonicalAddPatientHref`. `returnTo` is sanitized. `isInModal` is `window.self !== window.top` (iframe), not a React Dialog.

A portal `Dialog` size `full` or `6xl` can host the same component with `h` bounded, header and stepper sticky, body scrolling, footer sticky. Mobile is the same dialog at full viewport. The route should remain the URL that opens that dialog, or the dialog should be a presentation of that route. Creating a second form is out of scope.

Wizard does not call check-duplicates before submit. The server blocks create when any match is ≥ 0.95. Failure uses the API message. No “Create anyway”.

## 17. Duplicate / Merge audit

Matching (`PatientDuplicateDetectionService`):

- Exact name + DOB: 1.0
- Phone: 0.95
- Email: 0.90
- Fuzzy name + DOB: ≥ 0.80
- `IsDuplicate` is true if any match ≥ 0.80
- Create (including the alternate create path) blocks only when some match ≥ 0.95

UI: Patient 360 `PatientDuplicateHintBanner` calls check-duplicates and links to merge when `patient.update`. Directory does not. The wizard does not surface 0.80–0.94 warnings.

Merge (`patient.update`): re-points visits, appointments, prescription, imaging orders; deletes `patient_favorites`; soft-deletes the duplicate and sets status Merged. Does not re-point counselling, bills, CCMS, or IP journeys. IP has a separate merged-patient guard. No unmerge.

Directory must not grow a merge button. Do not weaken 0.95. Do not invent an override role. Long-term retirement of merge is a data-integrity product decision after cross-domain re-pointing exists. It is not a UX slice.

## 18. Directory vs Patient 360 matrix

| Information | Directory | Preview | Patient 360 | Owning module |
|---|---|---|---|---|
| Name, MRN, age, sex, photo | Yes | Yes | Yes | MPI |
| Phone | Search and filter | Yes | Yes | Registration |
| Current engagement | Primary pill | All pills | As existing sections | Named workflow |
| Reason, time, station, wait | Yes, if approved columns | Visit card | Not the worklist | Front Office / clinical desk |
| Provider display | Preview unless column approved | Yes | Existing | Clinical assignment |
| Acuity | High/critical hint only if approved | Badge | Not a diagnosis list | Scoring service |
| Diagnoses, meds, labs, imaging | No | No | Clinical / documents | EHR, lab, imaging |
| Insurance policy | No | No | Coverage section | CCMS |
| Bills | No | No | Coverage / administration as already built | Billing |
| Counselling session | Engagement label only | No session controls | No new counselling panel | Counsellor |
| Admission snapshot | Location / badge from DTO | Existing badge | Existing | IP / Ward |
| Surgery / follow-up tasks | No | No | Existing stubs stay | OT, Follow-up |
| Documents, communications | No | No | Existing sections | Records |

## 19. Permission / security audit

Unchanged codes: `patient.view`, `patient.create`, `patient.export`, `patient.update` (merge page and 360 hint only), `appointment.view` (Book). Backend authorization stays authoritative. UI hiding is not the control.

Sensitive fields already returned to anyone who can load the directory: phone, email, reason, provider, station, acuity, IP procedure name. That is the current certified lookup, not a new exposure. Do not add policy numbers, vitals, or free-text clinical notes to the row. Preview already audits PHI access via `logPhiAccess`. A wider column set of existing lookup fields does not add an endpoint.

## 20. Performance / API audit

Proposed columns in section 9 are populated by the existing page lookup: one list request plus stats. Preview already adds summary and recent-visits when opened. No client-side enrichment is required for those columns.

Costs that already exist and must not be worsened:

- Engagement-key sorts materialize all matching ids.
- High priority census loads engagement bundles for the branch.
- Program and patient-type filters query visits or counselling sessions for ids, then filter patients.
- Export requests a large page size; `LookupAsync` clamps to 100 and drops some filter fields. Out of scope.

A department **name** column, a true clinical program column, or Health ID on `q` would be a contract change. Not required for the proposed model.

## 21. Accessibility audit

Keep: table semantics, `aria-sort` on name, row `tabIndex={0}`, Enter/Space only when the event target is the row, links and buttons `stopPropagation`, focus rings, census `role="tablist"`, preview close and expand labels, More `aria-label`.

Gaps to carry into implementation, not to invent a framework for:

- The page has no local `h1`. Top nav supplies the title. Do not add a second visible “Patients” heading. If a later slice needs a programmatic heading, it must be the existing “Patient Directory” string, visually consistent with other worklists that rely on the top nav.
- Identity is name plus the MRN line. Screen-reader name should stay the visible text, not a new spoken format.
- Moving filters inline must keep labels associated with inputs, as the sheet already does.
- A Dialog wizard must use the existing Dialog focus trap. Do not build a second trap.
- Touch: Check-in and tab targets should remain at least the current control size. Do not shrink them to fit extra columns.

## 22. Responsive audit

| | Desktop ≥ 1280 | Tablet &lt; 1280 | Mobile |
|---|---|---|---|
| Columns / cards | Patient, Engagement, Visit, Location, Actions | Patient, Engagement, Visit, Actions | Card hierarchy in section 11 |
| Preview | Dock, proposed wider share after approval | Existing drawer | Existing drawer |
| Filters | Collapsible under search, after approval | Same, or Sheet if width is tight | Existing Sheet is acceptable |
| Census | Same five tabs, wrap | Wrap | Horizontal wrap, already `flex-wrap` |
| Pagination | Footer outside the scroller | Same | Same |
| Keyboard | Existing row and nested-control rules | Same | Cards already use the same activation helper |

Do not introduce a new responsive system. `md:hidden` cards and `hidden md:block` table already exist.

## 23. Decision register

| ID | Decision | Class |
|---|---|---|
| PD-DIR-UX-01 | Desktop columns: Patient, Engagement, Visit, Location, Actions, using existing DTO fields only. Acuity-on-every-row, provider column, phone column, and “care program” label are not part of this proposal. Provider, Appointment, and Registration are not worklist columns. | APPROVED / AUTHORIZED (Slice B) |
| PD-DIR-UX-02 | Tablet drops Location into the Visit line and uses the drawer. | APPROVED / AUTHORIZED (Slice B) |
| PD-DIR-UX-03 | Mobile card order in section 11. | APPROVED / AUTHORIZED (Slice B) |
| PD-DIR-UX-04 | Census stays five tabs and current predicates. Visual restyle only. No KPI cards. Count calculations unchanged. | Predicates APPROVED BY EXISTING CERTIFIED BEHAVIOR. Visual treatment IMPLEMENTATION DETAIL after this audit is accepted. |
| PD-DIR-UX-05 | Keep every current filter and query key. Presentation may become a collapsible panel. Favorites and Assigned-to-me stay absent from the UI. | Keys APPROVED. **Inline layout OPEN → PROPOSED Model C** (primary identity inline + Advanced Sheet). See `docs/decisions/patient-directory-filter-ux-audit-pd-dir-ux-05-proposal.md` (2026-10-05). Awaiting product approval. Implementation NOT STARTED. |
| PD-DIR-UX-06 | Preview content stays identity, visit, data quality, emergency contact, recent visits. Width may drop the 480px cap toward 42–50%. | Content APPROVED. Width OPEN PRODUCT DECISION. |
| PD-DIR-UX-07 | Preview header gains a text “Open Patient 360”. Footer keeps Continue encounter, Check-in, Print, and drops the duplicate profile button. | OPEN PRODUCT DECISION |
| PD-DIR-UX-08 | Add Patient remains `/dashboard/patients/new` and the same six-step form. A large existing Dialog may present it. | Route and form APPROVED. Dialog presentation OPEN PRODUCT DECISION. |
| PD-DIR-UX-09 | Do not change 0.80 / 0.95. Do not add Create Anyway. Any warning UI for 0.80–0.94 is a later product decision. | Thresholds APPROVED. New warning UI OPEN and blocked. |
| PD-DIR-UX-10 | Merge stays off the Directory. Backend and Patient 360 hint stay. Retirement waits on cross-domain re-point and unmerge policy. | Removal from Directory APPROVED. Lifecycle OPEN and OUT OF SCOPE for UX slices. |
| PD-DIR-UX-11 | Directory discovers and navigates. Patient 360 is the longitudinal record. Matrix in section 18. | APPROVED BY EXISTING CERTIFIED BEHAVIOR |
| PD-DIR-UX-12 | Do not add policy numbers, vitals, or diagnosis text to the worklist. Phone stays off the default row. | APPROVED for the worklist. Changing phone visibility OPEN. |
| PD-DIR-UX-13 | Proposed columns need no new API. Do not add engagement sorts, Health ID search, or department-name enrichment in the next slice. | APPROVED as a constraint. Performance work on the high-priority full-branch load is OUT OF SCOPE. |
| PD-DIR-UX-18 | Primary census navigation is **All \| Active**. UI label "Active" maps only to the existing certified `current` predicate/URL value. No new `active` query value, API, or calculation. | APPROVED / IMPLEMENTED (Slice B.1A) |
| PD-DIR-UX-19 | **New** removed from primary census tab navigation. Backend New predicate, calculation, query parsing, and stats retained unchanged. | APPROVED / IMPLEMENTED (Slice B.1A) — predicate retained |
| PD-DIR-UX-20 | **High priority** removed from primary census tab navigation. AcuityScoringService, high-priority predicate, count, and backend support retained unchanged. | APPROVED / IMPLEMENTED (Slice B.1A) — scoring/predicate retained |
| PD-DIR-UX-21 | **Discharged** removed from primary census tab navigation pending a future authoritative discharge definition (source, timestamp, window, workflow). Backend Discharged predicate retained unchanged. | APPROVED / IMPLEMENTED (Slice B.1A) — predicate retained; discharge population OPEN |

> Note: PD-DIR-UX-04 (five primary tabs) is superseded for **primary navigation presentation only** by PD-DIR-UX-18–21. Certified backend predicates and stats remain unchanged.

### B.1A layout correction (2026-10-05)

Live browser UAT found header/body column drift despite a shared `PATIENT_HUB_COLUMN_TRACK` class contract. Root cause and fix are recorded in `docs/decisions/patient-directory-slice-b1a-column-alignment-correction-report.md`. Presentation-only; no census/API/search changes.

### B.1A final visual refinement (2026-10-05)

After alignment UAT passed, density polish redistributed column shares (Patient/Current Visit wider; Actions 16%), Directory phone became plain `+91-XXXXXXXXXX` text, and sex labels render as MALE/FEMALE. See `docs/decisions/patient-directory-slice-b1a-final-visual-refinement-report.md`. Presentation-only.

## 24. Gap register

| Gap | Evidence | Needs new contract? |
|---|---|---|
| Context cell hides provider, location, and secondary engagements | DTO mapped in `MapRow`; UI uses `pickPrimaryVisitEngagement` | No, if columns stay inside the DTO |
| Care-program wording ≠ department codes | `ProgramCodes` filter joins `Departments.DepartmentCode` | Yes, before any program column |
| `scheduledAt` is check-in or appointment | `PatientEngagementService` assignment | No, if the label distinguishes the two |
| Stats vs filtered total | Stats query ignores `q` and advanced filters | Copy only, not a new calculation |
| Preview 480px cap and duplicate profile action | `PatientPreviewSplitPane` and panel footer | No |
| Wizard is a page, modal flag is iframe | `new/page.tsx` | No, if the same component is shown in `Dialog` |
| 0.80 matches do not surface on create | Controller blocks only ≥ 0.95 | Yes, before any warning UI |
| Merge misses counselling, billing, CCMS, IP | `PatientMergeService` SQL | Yes, before retirement |
| Export clamp and dropped filters | `LookupAsync` page size 1–100 | Separate from UX density |

## 25. Proposed bounded implementation slices

Sequence is driven by the review finding (sparse discovery list) and by dependency (columns before a wider preview). None of these slices is authorized by this audit.

### Slice B — Discovery columns

Objective: replace the single Context cell with Engagement, Visit, and Location using fields already on `PatientLookupRow`.

Scope: `PatientHubTable`, `PatientHubMobileCards`, `PatientHubContextCluster` or a successor display component, loading skeleton, row display helpers for the schedule label, tests.

APIs involved: existing `GET` lookup and stats. Read only.

Do not touch: DTO, lookup service, census, search, filters, preview width, Add Patient, export, permissions.

Data: no new fields.

Tests: identity line unchanged; new columns render reason, engagement, station when present and omit empties; row click, name link, Check-in, Book appointment; page size 25; no Favorite, phone, diagnosis, or program chips.

UAT: a receptionist can distinguish two same-name rows and see station or reason without opening Preview. Browser page does not grow. Pagination stays put.

Out of scope: provider column, phone column, acuity-on-every-row, inline filters, preview, dialog, duplicate UI.

### Slice C — Census presentation

Objective: restyle the five tabs to the existing segmented / pill density. No KPI row.

Scope: `PatientHubClassificationTabs` and its tests only.

Do not touch: `ApplyTabFilterAsync`, stats, URL values, page reset.

UAT: same counts as before the restyle; selected tab remains announced; tab change resets to page 1.

### Slice D — Filter presentation

Objective: show the existing groups in a collapsible region under search on desktop. Sheet remains available for narrow widths if the panel does not fit.

Scope: filter layout components. Same state object and `buildLookupUrlParams`.

Do not touch: query key names, server predicates, saved-search storage, favorites parser.

UAT: each current filter still changes the same query string and resets page to 1. Favorite and Assigned-to-me controls stay absent.

### Slice E — Preview width and header action

Objective: docked preview uses about 42–50% of the content width without the 480px cap; header action reads Open Patient 360; footer does not duplicate it.

Scope: `PatientPreviewSplitPane`, `PatientPreviewPanel` action row only.

Do not touch: summary API, recent visits, emergency contact, Check-in, Continue encounter, Print, Patient 360 page.

UAT: preview scrolls internally; list remains usable beside it; name in the list and the preview action both open `/dashboard/patients/{id}`.

### Slice F — Add Patient Dialog

Objective: present the existing wizard in the portal Dialog (`full` or `6xl`), sticky stepper and footer, same route and POST.

Scope: route shell and dialog host. The step component stays the source of validation.

Do not touch: field validation, duplicate threshold, MRN generation, `returnTo` rules.

UAT: direct URL still opens the wizard; six steps and guardian skip behave as now; create still blocks ≥ 0.95.

### Slice G — Duplicate presentation

Blocked. Do not schedule until a product decision defines what 0.80–0.94 should show and confirms there is still no override. Thresholds stay as they are.

Merge redesign is not a slice in this program.

## 26. Slice UAT criteria (summary)

- B: columns match section 9; certified handoffs; no new fields; bounded scroll intact.
- C: five tabs, same counts and URLs, no KPI cards.
- D: same query keys; no deleted filters; page resets.
- E: wider preview, one Patient 360 action, existing preview body.
- F: same wizard and API inside a dialog; route remains canonical.
- G: not eligible for UAT until the decision in PD-DIR-UX-09 exists.

## 27. Risks

- Labeling department codes as care programs will send staff to the wrong meaning.
- Calling every `scheduledAt` an appointment will mis-state patients already checked in.
- Adding provider, phone, and acuity to the row at the same time as a wider preview will collapse the list on 1280px.
- High-priority tab cost is pre-existing. A visual redesign must not trigger extra full-branch loads.
- Dialog extraction can accidentally fork validation if the page JSX is copied instead of reused.

## 28. Open product decisions

The inline-filter layout in 05, preview width and header wording in 06 and 07, Dialog presentation in 08, duplicate warning UX in 09, merge lifecycle in 10, and whether phone belongs on the default row (12).

Closed / authorized for Slice B: PD-DIR-UX-01, PD-DIR-UX-02, PD-DIR-UX-03.

Closed by existing behavior and not open for the next implementation unless a new decision reopens them: route, permissions, lookup contract, census predicates, page size, search fields, 0.95 block, Check-in and appointment handoffs, Favorite and Assigned-to-me absence, Merge absence from the Directory.

## 29. Recommended next gate

PD-DIR-UX-01 through PD-DIR-UX-03 are APPROVED / AUTHORIZED for Slice B only. Do not start Slice C, D, E, or F until B is accepted in UAT, except where a later decision explicitly reorders them.

SLICE B IMPLEMENTATION STATUS: AUTHORIZED

SLICES C–F IMPLEMENTATION STATUS: NOT AUTHORIZED

NEXT GATE: Complete Slice B automated tests and manual UAT, then stop.

STOP.
