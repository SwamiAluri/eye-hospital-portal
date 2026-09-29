# Counsellor Cross-Module Grid and Filter UX Audit

| Field | Value |
|-------|--------|
| **Date** | 2026-09-25 |
| **Document type** | **GOVERNANCE / PRODUCT DESIGN DISCOVERY ONLY** |
| **Mode** | Repository-grounded UX and information-architecture audit of the five Counsellor operational and reporting surfaces |
| **Production code / API / DTO / DB / permissions / ownership / workflow / routes / UI / tests modified** | **NO** |
| **Product Decision created** | **NO** (candidates only) |
| **Implementation Authorization created** | **NO** |
| **Phase 3I reopened** | **NO** |
| **Slice 14 / Phase 3J created** | **NO** |
| **C-01 reopened** | **NO** |
| **Packages LA / B Print / C reopened** | **NO** |

This audit does not authorize implementation. A proposed change that needs a business rule, API, permission, or ownership change is classified **PRODUCT DECISION REQUIRED**.

---

## 1. Executive summary

The five Counsellor surfaces do **not** share one grid. They share counselling visual tokens (pills, widgets, density) and, in places, the same pagination helpers. Column sets, markup, filters, and what a number counts are different on purpose.

| Surface | What the grid is today |
|---------|------------------------|
| Waiting List | Certified seven-zone CSS grid. Patient, UHID, age, and sex are already one hierarchical cell. |
| Sessions | Semantic table. Name, session date, surgery, decision, Open / Reassign. |
| Finalize Surgery | Five-zone CSS grid plus a separate OT Preparation workspace on the same route. |
| Follow-up Center | One CSS grid, three different list contracts (Active, Cold, Post-Surgery). |
| Analytics | Reporting page. KPI strip, funnel, mixes, trends, and a pending-decision aging table. Not a queue. |

**Answer to the primary UX question:** share a **common interaction model** and **module-specific information architecture**. Do not give every module the same columns. Do not introduce a new table framework. The existing counsellor worklists (`waiting-list-work-grid`, `finalize-surgery-work-grid`, `FOLLOWUP_WORK_GRID`) and the two real tables (Sessions, aging) are the reuse base. `src/components/ui/table.tsx` exists and is not the counsellor worklist source of truth. TanStack Table is not in use.

**Waiting List column split (Patient | UHID | Age/Gender as default columns) is not recommended.** PD-C01-03 locked lightweight Age/Gender inside the patient identity line. C-01 is accepted and closed. Splitting those fields into default columns would reopen that package for a density change. UHID and age/sex stay inside the Patient cell (hierarchical). Eye stays secondary under Procedure.

**Sessions is the main presentation gap.** The list API already returns medical record number, eye, doctor name, and session type. The grid shows none of them. Age and sex are **not** on the list DTO (they exist only on session detail). Labeling the medical record number “UHID” is a product decision, because Waiting List prefers HealthId and falls back to medical record number.

**Column resize and drag-reorder are not recommended for this standard.** They are not implemented anywhere in these surfaces, they have no accessible non-drag path today, and they do not fix the scanning problem. Optional column visibility is a later product decision, and only for fields already on an authoritative DTO. Data-type column filters are mostly unsupported and would need API work where lists are server-paged.

**One next gate:** a Product Decision review of the candidates in this audit (`PD-CGX` candidates below). That review adopts or rejects the interaction standard. It does not implement it, does not reopen Phase 3I, C-01, or Packages LA / B / C, and does not create Slice 14 or Phase 3J.

---

## 2. Governance baseline (protected)

Preserved as certified. This audit does not reopen them.

| Item | Status used by this audit | Evidence |
|------|---------------------------|----------|
| Phase 3I | Formally closed. Slices 1–13 delivered. | `docs/audits/counsellor-ownership-work-allocation-phase3i-program-product-decision.md`, slice closure artifacts |
| Slice 14 | Does not exist | Program status audits |
| Phase 3J | Does not exist | Same |
| Waiting List ownership | Shared queue. `CounselorId` is display and mutation target, not a visibility filter | `CounselingController.GetWaitingList` comment; PD16 branch scope |
| Opening / viewing | Must not establish ownership | Waiting List row click: Done / owned Repeat is view; Assign is an explicit dialog |
| Follow-up Center | Shared. No My Follow-ups queue | Phase 3I Slice 10 / PD-FOLLOWUP-01; `formatOriginalCounsellorAttribution` |
| Analytics My Work | Reporting scope, not an operational queue | `ANALYTICS_MY_WORK_LABEL = 'My Work'`; Slice 11 |
| Finalize Surgery | Shared list inside authorized branches | `GetFinalizeListAsync` (PD-S9-12) |
| OT Preparation | RESP2 responsibility model. Not a second product worklist | Same route, workspace tab `ot-preparation` |
| Package LA | Accepted / closed | User governance baseline; Package LA acceptance artifacts (2026-09-24) |
| Package B Print | Accepted / closed — do not reopen to restyle | User governance baseline. (A 2026-09-24 E2E audit recorded B/C Manual UAT as not yet executed. This audit does **not** reopen that conflict.) |
| Package C | Accepted / closed — do not reopen | User governance baseline; same note as Package B |
| C-LA-04 | Deferred | Cancel-presentation redesign remains deferred |
| PD-C01-02 | Client-side Waiting List pagination (10 / 25 / 50). Server pagination out of scope unless a later PD | C-01 product decision |
| PD-C01-03 | Lightweight Age/Gender. Empty values omitted. DOB not on Waiting List DTO | C-01 product decision |
| PD-C01-04 | Pre-Auth membership locked. Presentation only. Not a lifecycle status | C-01 product decision |
| PD-C01-05 | Limited Waiting List URL state. No PHI in the URL | C-01 product decision |
| PD-C01-06 | Add Patient is a referral path only | C-01 product decision |
| C-01 | **ACCEPTED = YES, CLOSED = YES** (2026-09-22) | `docs/audits/counsellor-c01-waiting-list-dashboard-redesign-acceptance-closure.md` |

Historical file `counsellor-c01-waiting-list-dashboard-redesign-uat-observations.md` still says C-01 was not accepted. The acceptance-closure artifact supersedes that status. It is not rewritten here.

---

## 3. Evidence inventory

### 3.1 Source-of-truth table

| Surface | Route | Page | Grid | API | DTO | Backend SoT |
|---------|-------|------|------|-----|-----|-------------|
| Counsellor Waiting List | `/dashboard/counsellors-desk/waiting-list` | `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/waiting-list/page.tsx` | `WaitingListQueueWidget` + `WaitingListWorkRow` (`waiting-list-work-grid`). OT Returned uses the same work grid via `toOtReturnedWaitingListPatient` | `counsellorsDeskApi.getWaitingList` → `GET /Counseling/waiting-list`. OT Returned rows from IP journey projection (`ipManagementApi`), not this DTO | `WaitingListPatientDto` / FE `WaitingListPatient` | AuthService `CounselingController.GetWaitingList` (queue + session + patient). Shared within authorized branches |
| Counselling Sessions | `/dashboard/counsellors-desk/sessions` | `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/sessions/page.tsx` | Inline `<table>` in the page (not a shared grid component) | `useCounselingSessions` → `GET /Counseling/sessions` | `CounselingSessionDto` inside `SessionListResponse`. Detail-only fields live on `CounselingSessionDetailsDto` | `CounselingWorkflowService.GetAllSessionsAsync` |
| Finalize Surgery | `/dashboard/counsellors-desk/finalize-surgery` | `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/finalize-surgery/page.tsx` | In-page CSS grids `finalize-surgery-work-grid` and `finalize-ot-prep-work-grid`. Modal: `FinalizeOtModal` | `useFinalizeListQuery` → `GET /Counseling/ot-schedule` | `OtScheduleResponse` / FE `FinalizeSurgeryRecord` | `OtFinalizeService.GetFinalizeListAsync` |
| Follow-up Center | `/dashboard/counsellors-desk/surgery-followup` | `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/surgery-followup/page.tsx` | `FOLLOWUP_WORK_GRID` in `followup-presentation.ts` | Active `GET /Counseling/followups/active`; Cold `GET /Counseling/followups/cold-leads`; Post-Surgery `GET /Counseling/followups/post-surgery`; stats `GET /Counseling/followups/stats` | `ActiveFollowupItemDto`, `ColdLeadItemDto`, `PostSurgeryFollowupItemDto`, `FollowupStatsDto` | AuthService follow-up list services. Post-Surgery is journey-based, not the session allowlist |
| Counsellor Analytics | `/dashboard/counselor/analytics` | `apps/hospital-portal-web/src/app/dashboard/counselor/analytics/page.tsx` rendering `CounselorAnalyticsTab` | Not an operational grid. Drill table: `FollowupAgingTable`. Surgery mix is a custom row list | `GET /counseling/analytics/summary`, `/trends`, `/followup-aging`. Counselor options from the analytics counselor endpoint | `CounselingAnalyticsSummaryDto` and aging session projection (`AgingSession`) | `CounselingAnalyticsService` |

Nav labels and permission `counseling_sessions.read` for all five items: `sidebar-menu-sections.tsx`.

**Not inferred:** Waiting List frontend type includes `contactNumber`, `bloodGroup`, `dob`, address, and emergency contacts. `WaitingListPatientDto` does **not** project them. PD-C01-03 records that the Waiting List DTO does not project DOB or blood group. Those FE fields are not evidence that the list API returns them.

### 3.2 Product decisions and audits (relevant)

| Topic | Artifact |
|-------|----------|
| C-01 IA, pagination, Age/Gender, Pre-Auth, URL, referral | `docs/product-decisions/counsellor-c01-waiting-list-dashboard-redesign-product-decision.md` |
| C-01 closure | `docs/audits/counsellor-c01-waiting-list-dashboard-redesign-acceptance-closure.md` |
| Ownership program | `docs/audits/counsellor-ownership-work-allocation-phase3i-program-product-decision.md` |
| Sessions pagination / RR | Slice 12 and Slice 13 product decisions; `docs/audits/phase3i-slice13-package-b-acceptance.md` (Sessions Package B, not OT Print) |
| Follow-up / analytics formulas | `docs/audits/counsellor-followup-analytics-phase2w-product-decisions.md`; PD13–PD15 referenced in analytics KPI copy |
| Module completion snapshot | `docs/audits/counsellor-end-to-end-completion-and-next-gate-audit.md` (2026-09-24). This audit does not reopen its OT Print UAT conflict |
| Manual UAT plan (Wave 2 residual) | `docs/audits/counsellor-residual-acceptance-manual-uat-plan.md` — session workflow, not this grid standard |

### 3.3 Automated tests (current, not exhaustive of every helper)

| Surface | Unit / component | E2E (active suite `apps/hospital-portal-web/e2e/`) |
|---------|------------------|-----------------------------------------------------|
| Waiting List | `WaitingListWorkRow.test.tsx`, `WaitingListQueueWidget.test.tsx`, `WaitingListFilterToolbar.test.tsx`, `WaitingListSummaryWidget.test.tsx`, `waiting-list-pagination.test.ts`, URL-state tests | `ops-ui-alignment-uat.spec.ts` (stat strip) |
| Sessions | `sessions-pagination.test.ts`, `sessions-pagination.contract.test.ts`, RR reassign tests | Wave 2 counselling specs cover the session **workspace**, not this list grid |
| Finalize | Package 1 / RESP2 / print helpers under `src/lib/counsellors-desk/` | `finalize-surgery-package1.spec.ts`, `finalize-surgery-ot-discoverability.spec.ts`, `finalize-surgery-ot-prep-package-b-print.spec.ts`, `finalize-surgery-ot-prepared-bulk-print.spec.ts` |
| Follow-up | Follow-up presentation / attribution tests co-located with Slice 10 | No dedicated Follow-up Center grid spec identified in this pass |
| Analytics | `counselor-analytics-filter.test.ts`, `analytics-scope.test.ts` | Not a grid interaction suite |

There is **no** automated test for column resize, reorder, or a Columns menu, because those controls do not exist.

### 3.4 Manual UAT / acceptance (grid-relevant)

| Surface | Acceptance status for the **current** grid |
|---------|-----------------------------------------------|
| Waiting List | **C-01 ACCEPTED / CLOSED.** Age/Gender, Pre-Auth membership, URL state, client pagination, and referral behavior are protected |
| Sessions list | Slice 12/13 Reassignment Required + pagination **delivery accepted**. Not a C-01-style column redesign |
| Finalize Surgery + OT Preparation | RESP2, Package LA, Package B Print, and Package C are **protected as accepted/closed** for this audit. C-LA-04 remains **deferred**. Grid restyle is out of scope for those packages |
| Follow-up Center | Phase 2 presentation rules (no SLA/priority chrome) and Slice 10 historical attribution are certified. No separate “grid UX” acceptance artifact |
| Analytics | Slice 11 My Work = reporting scope is certified. PD13–PD15 formulas are certified |

---

## 4. Current grid inventory

Widths below are the implemented tracks, not pixel measurements from a screenshot. Below 768px the counsellor CSS grids collapse to one column (`counselling-session-theme.css`). Column cues on Waiting List are `max-md:hidden`. Nothing in these five surfaces supports user column resize, reorder, or a visibility menu. Nothing uses column-header sort.

### 4.1 Waiting List — rendered columns

Grid tracks (768–1599px and ≥1600px) are in `counselling-session-theme.css` and documented in `waiting-list-layout.ts`. Large-desktop floors: Patient `minmax(10rem, 1.2fr)`, Visit `minmax(6.25rem, 0.85fr)`, Procedure/Eye `minmax(7.25rem, 0.95fr)`, Owner `minmax(5.25rem, 0.7fr)`, Payment/Coverage `minmax(5.75rem, 0.8fr)`, Status `minmax(4.75rem, 6.25rem)`, Action `minmax(9.5rem, 11rem)`.

| Column | Current label | Data field | Source DTO | Source API | Data type | Width | Required? | Filter | Sort | Visibility | Responsive | Action relationship | Evidence |
|--------|---------------|------------|------------|------------|-----------|-------|-----------|--------|------|------------|------------|---------------------|----------|
| Patient | Patient | `patientName` + secondary `uhid`, `age`, sex | `WaitingListPatientDto` | `GET /Counseling/waiting-list` | text + computed age | fluid 1.2fr | Always shown | Quick search matches name and UHID | Queue position (server `orderby q.QueuePosition`). No header sort | Always | &lt;768 stacks with the row | Patient button opens demographics sheet. Row activation opens session or Assign. Does not claim ownership | `WaitingListWorkRow.tsx` |
| Visit | Visit | Primary `type` (OT Returned: “Surgery”). Secondary doctor + `time` | Same. `Type`, `Doctor`, `Time` | Same | enum-like type + text + time string | 0.85fr | Always | Type dropdown (Procedure/Surgery). Search matches doctor | None | Always | Hidden header &lt;768; cell remains inside stack | None | Type badge is visit category, not a clock time |
| Procedure / Eye | Procedure / Eye | `surgeryName` primary, `eye` secondary | `SurgeryName`, `Eye` (`SurgeryTentativeEye`) | Same | text | 0.95fr | Always | Search matches procedure name | None | Always | Same | None | Eye omitted when blank |
| Owner | Owner | `counselorName` or Unassigned; “You” when current user | `CounselorId`, `CounselorName` | Same | text | 0.7fr | Always | Client Owner filter (not sent to API) | None | Always | Same | Enables Assign / Reassign visibility. Display is not ACL | `resolveOwnershipRelation` |
| Payment / Coverage | Payment / Coverage | `patientType` primary. Pre-Auth hint secondary when coverage | `PatientType` plus client CCMS badge | List API + deferred CCMS badges | text | 0.8fr | Always | None on the column. Pre-Auth **tab** is a membership filter | None | Always | Same | Pre-Auth hint click opens coverage when it is not the primary Action | PD-C01-04 |
| Status | Status | Mapped queue status badge. OT Returned overrides with reason | Mapped in controller | Same | enum | 4.75–6.25rem | Always | Status tabs | None | Always | Same | Action label depends on status | Mapping in `GetWaitingList` |
| Action | Action | Lifecycle CTA | Derived | Same | action | 9.5–11rem | Always | None | None | Always | Same | Assign, Reassign, Start Counseling, View, Continue, Re-evaluate, Start Repeat, Pre-Auth | `waiting-list-lifecycle-action` |

**Combined:** Patient (name, UHID, age, sex). Visit (type or “Surgery”, doctor, time). Procedure / Eye. Payment (type + coverage hint).

**Inside another column, not its own:** UHID, age, sex, doctor, clock time, eye, Pre-Auth state (unless Pre-Auth tab makes it the Action).

**In the DTO, not a column:** `slNo`, `remarks`, `followUpDate` / `followUpReason` (Repeat context via attention rules, not a column), package upgrade fields (Add-on), `version`, `branchId`.

**On the FE type, not on the DTO:** contact, blood group, DOB, address, emergency contacts. **Do not show.**

### 4.2 Sessions — rendered columns

`table-fixed` colgroup: 28% / 16% / 26% / 12% / 18%. Sticky header. Surgery column `hidden` below `sm`.

| Column | Label | Field actually rendered | DTO field available | API | Type | Width | Filter | Sort | Responsive | Action |
|--------|-------|-------------------------|---------------------|-----|------|-------|--------|------|------------|--------|
| Patient | Patient | `patientName`, else session number. Owner line **only** when Reassignment Required is on | `PatientName`, `PatientMrn`, `CounselorName` exist. Age/gender **do not** on list DTO | `GET /Counseling/sessions` | text | 28% | URL chips only. No search box | Server `SessionDate` desc, then `CreatedAt`. No header sort | Surgery folds under name &lt;`sm` | None |
| Session date | Session date | `sessionDate` locale date. No time | `SessionDate`, also `SessionStartTime` unused | Same | date | 16% | `sessionDateFrom` / `sessionDateTo` URL params from analytics drill-down | Fixed server order | Always | None |
| Surgery | Surgery | `recommendedSurgery` | Also `SurgeryTentativeEye`, `DoctorName`, `SessionType` unused on the row | Same | text | 26% | `recommendedSurgery` exact URL param | None | Hidden &lt;`sm` | None |
| Decision | Decision | Pending / Agreed / Declined / — from `pendingDecision` and `patientAgreedToSurgery` | `Status` and `CurrentStage` exist and are **not** this column | Same | derived enum | 12% | URL `pendingDecision`, `patientAgreedToSurgery`, `analyticsOutcome` | None | Always | None |
| Action | Action | Open; Reassign when RR filter + permission + eligible owner | — | Navigation to `/dashboard/counsellors-desk/{id}?from=sessions` | action | 18% | None | None | Always | Primary Open; secondary Reassign |

List hydration (`GetAllSessionsAsync`): `PatientName`, `PatientMrn` = **MedicalRecordNumber only** (not HealthId), `DoctorName`, `CounselorName`, `SurgeryTentativeEye`. `CounselingSessionDetailsDto` adds `PatientAge`, `PatientGender`, `PatientHealthId` on **GET by id**, not on the list.

### 4.3 Finalize Surgery — rendered zones

Cues: Patient, Surgery, Status, Schedule, Action. OT Prepared adds a selection checkbox column. Tracks in the same CSS file (Patient ~1.55fr, Surgery ~1.2fr, Status ~5.25–7.25rem, Schedule ~1.05fr, Action ~7–9.25rem).

| Zone | Label | What is inside | DTO | API | Notes |
|------|-------|----------------|-----|-----|-------|
| Patient | Patient | Name. Secondary: UHID · payment type. ≥1600 a third line: surgeon, package, payment mode, checklist summary. Lock and duplicate icons | `OtScheduleResponse` `PatientName`, `Uhid`, `PatientType`, `DoctorName`, `PackageName`, `PaymentMode`, `ChecklistSummary`, `IsLocked` | `GET /Counseling/ot-schedule` | Age/gender **not** on list DTO |
| Surgery | Surgery | `surgeryName`. Secondary anesthesia and/or reporting time | `SurgeryName`, `AnesthesiaType`, `ReportingTime` | Same | Eye is **not** in this cell |
| Status | Status | `StatusBadge` of FSM status | `Status` | Same | Not Confirmed, Confirmed, Finalised, OT Prepared, Cancelled, Surgery Done |
| Schedule | Schedule | Date · eye · start time · theatre. Secondary package rate | `ScheduleDate`, `Eye`, `StartTime`, `TheatreName`, `PackageRate` | Same | Eye hidden inside schedule |
| Select | (blank cue) | Checkbox | row id | FE only | OT Prepared print selection, and OT Preparation selection. Already authorized. Not a new selection model |
| Action | Action | Primary FSM action; Print OT Slip when not in print-select mode | `canConfirm` / `canFinalise` / etc. | Same | Opens `FinalizeOtModal` or runs the authorized transition. Sequence number is not a column |

Pagination is **client** `sliceWaitingListPage` over the list returned for the current date/UHID/name filters. Default page size is Waiting List’s default (10) via shared helper. Status tabs filter client-side after fetch. Counts for the summary are computed on the **filtered population in memory**, not the current page — same pattern as the page’s `statsBar` (Scheduled, Awaiting Finalise, Surgery Done). OT Preparation summary is Finalised and Selected, local to that workspace.

### 4.4 Follow-up Center — shared visual columns, different sources

`FOLLOWUP_WORK_GRID`: `minmax(0,1.4fr) minmax(0,1fr) minmax(0,0.9fr) minmax(0,0.9fr) auto`. Cues: Patient, Procedure, Status, Contact, Action. Procedure/Status/Contact hidden below `sm`. Header row is `aria-hidden` (cues are `<span>`, not column headers).

| Cue | Active (`ActiveFollowupItemDto`) | Cold (`ColdLeadItemDto`) | Post-Surgery (`PostSurgeryFollowupItemDto`) |
|-----|----------------------------------|--------------------------|-----------------------------------------------|
| Patient | Name. Secondary: `#UHID` · phone · original counsellor | Same | Name. `#UHID` · phone. **No** counsellor line (DTO has no CounselorId) |
| Procedure | `recommendedSurgery` | `recommendedSurgery` | `surgeryType` (different field and source) |
| Status | Intention pill | Intention pill (Declined / Referred) | “Nd since discharge” and condition at discharge |
| Contact | Last contact date · attempt count, or Never contacted | Session date · last contact | Discharge date · pending post-op visits |
| Action | Log contact, reminder, history, Re-queue, open session | Same | Reminder always. Contact, history, open **only** when authoritative `sessionId` exists. **No** Re-queue |

Server pagination, page size **20** (`FOLLOWUP_PAGE_SIZE`). Stats endpoint scope is documented as the **filtered population**, not the page (`FollowupStatsDto.Scope = "filtered"`).

### 4.5 Analytics — tables that exist

Aging table columns (`FollowupAgingTable`): Patient, Surgery, Phone, Days, Action (Open). `min-w-[28rem]`, horizontal scroll. No UHID column in this table.

Surgery-type block uses a custom bar row (Surgery, Volume, Total, Conv%), not a data grid.

KPI strip (summary): Total, Agreed, Declined, Pending, Exception, Other, Eligible, Conversion, Decision, plus further items including Avg Days in the same `kpiItems` array. Sub-labels encode PD13 partition language (`Partition`, `T−Ex−Other`, `Agreed÷Elig`, `(A+D)÷Elig`).

### 4.6 Cross-cutting inconsistencies (observed, not proposed as defects against certified IA)

| Topic | Observation |
|-------|-------------|
| Markup | Waiting List, Finalize, Follow-up are CSS grids with `role="columnheader"` or `aria-hidden` cues. Sessions and aging are `<table>`. |
| Page title | Finalize has `<h1>` Surgery Finalization / OT Preparation. Waiting List, Sessions, Follow-up, and Analytics have **no** page `<h1>` in the page component. Nav is the only name. |
| Patient identity | WL hierarchical (name + UHID · age · sex). Finalize hierarchical (name + UHID · type). Follow-up hierarchical (name + `#UHID` · phone). Sessions is **name only**. Aging is **name only**, phone in its own column. |
| UHID source | WL: HealthId, else medical record number. Sessions list: medical record number only, **not rendered**. Finalize: `Uhid` on `OtScheduleResponse`. Follow-up: `Uhid` rendered with a `#` prefix. |
| Eye | WL secondary under procedure. Finalize inside schedule line. Sessions `SurgeryTentativeEye` not rendered. Follow-up not on these DTOs. |
| Owner | WL always a column (current owner). Sessions only under RR. Follow-up Active/Cold is historical attribution in the patient line, explicitly not ACL. Post-Surgery has no owner field. Analytics counselor control is a **reporting scope**, not a row owner. |
| Status | WL queue status. Sessions **decision** partition, not `CounselingSession.Status`. Finalize FSM. Follow-up intention or discharge aging. Different words for different domains — that part is correct. Capitalization differs (Session date vs Patient; Processing vs Processed key). |
| Dates | WL time is queue-added local `hh:mm tt`. Sessions locale date, no time. Finalize schedule date + start time, reporting time nested. Follow-up `en-GB` short date. Analytics last-updated `en-IN` time; periods are 7/14/30 and aging 30/90/180/365. |
| Pagination | WL client 10/25/50, numbered. Sessions server 20, numbered, URL `page`. Finalize client, shared Waiting List pager. Follow-up server 20, Prev / `n / n` only. Analytics aging is bucket panels, not pages. |
| KPI vs tabs | WL shows five cards **and** the same counts on tabs (Patients/All, Pending, Processing, Done, Repeat). Other status tabs (Add-on, Surgery Done, OT Returned, Pre-Auth) are tabs only. |

---

## 5. Waiting List deep dive

**Hierarchy today:** five KPI cards → status pill tabs (with counts) → queue widget containing toolbar (search, From/To, Type, Owner, Clear, New patient, Schedule counselling) → column cues → rows → client pagination.

**KPI / tabs**

Cards (`WORKLOAD_STATS`): Patients, Pending, Processing, Done, Repeat Counselling. Values are `tabCounts`, not a second formula.

`tabCounts` is computed from the fetched list after the **type** filter. OT Returned uses the IP projection count. Pre-Auth uses the locked membership predicate. Dependencies do **not** include quick search or Owner. Date range changes the API result, so it changes the counts. Search and Owner change the rows and the pager, **not** the cards or tab badges.

Counts are the **fetched population** (authorized branch + date range + type), not the current page. Label “Patients” is the All count after type, which matches the All tab. It is not “patients matching the search”.

Certified tabs remain the state control. Cards repeat four of those states plus All. That duplication is the C-01 composition (summary strip + tabs). Removing either would reopen C-01. This audit does **not** recommend removing them.

**Filters**

| Control | Scope | Where applied |
|---------|--------|----------------|
| From / To | Server `FromDate` / `ToDate` on queue `AddedToQueueAt` | API |
| Type Procedure / Surgery | Also sent as `Type` **and** applied again on the client | Both |
| Status tabs | Client, except the status is not the only server filter. Pre-Auth is client membership (PD-C01-04). OT Returned is a different query | Client / separate source |
| Owner Mine / Unassigned / Other | Client only. Comment: never sent to waiting-list API. Does not change shared visibility | Client |
| Quick search | Client contains on name, UHID, procedure, doctor, counsellor name. Placeholder also says MRN. There is no separate MRN field in the toolbar | Client |
| URL | Limited explicit state (PD-C01-05): tab, type, owner, search, page, page size. No PHI | URL |

**Compressed screenshot pattern vs split columns**

| Field | Recommendation | Class |
|-------|----------------|-------|
| Patient name | Default, primary line of Patient | DEFAULT (certified) |
| UHID | Stay on the secondary line of Patient. Do not add a default column | Merged hierarchical. Copy-from-cell is a later optional presentation item, not a new field |
| Age / Gender | Stay on that secondary line. PD-C01-03. Omit when age is not &gt; 0 or sex is empty | Merged. **Do not split** |
| Visit type | Stay as Visit primary | DEFAULT |
| Doctor | Stay as Visit secondary. Own column would add an eighth zone on an already tight workstation track | Merged. Optional column would be a C-01 reopen → **do not** |
| Time | Stay as Visit secondary. It is queue-added time, not appointment time. Relabeling needs a product decision if operators read it as surgery time | Merged. Meaning = **E** if the label changes |
| Procedure | Default primary | DEFAULT |
| Eye | Stay secondary under procedure | Merged |
| Owner | Default column. Required for Assign/Reassign scanning on a shared queue | DEFAULT |
| Payment / Coverage | Default column. Pre-Auth hint stays here except when Pre-Auth is the primary action | DEFAULT (PD-C01-04 presentation) |
| Status | Default | DEFAULT |
| Action | Default, workflow-only | DEFAULT |

**Not recommended as new default columns:** phone, DOB, blood group, address, remarks, token, queue position. Remarks and token exist in the query and are not the operational scan the certified grid was accepted with. Phone and DOB are not on the DTO.

Pagination stays client-side (PD-C01-02). Referral / Schedule counselling stays the certified path (PD-C01-06).

---

## 6. Counselling Sessions deep dive

Sessions is a **server-paged registry and drill-down target** (analytics, total count, RR), not a second Waiting List.

| Question | Finding |
|----------|---------|
| Shared patient identity | Share the **pattern** (name primary, identifier secondary), not Waiting List’s age/sex line. Age/sex are not on the list DTO |
| UHID explicit? | `PatientMrn` is returned and not shown. It is medical record number, not the Waiting List HealthId-first rule. Showing it as a secondary line is an existing-API presentation change. **Calling it UHID is a product decision** |
| Doctor / procedure / eye | Procedure is already the Surgery column. `DoctorName` and `SurgeryTentativeEye` are on the list DTO and not rendered. Eye as secondary under Surgery matches Waiting List **without** a new column. Doctor as a default column is not justified on this registry |
| Session stage | `CurrentStage` and `Status` exist. The certified column is **Decision** (Pending / Agreed / Declined). Do not replace Decision with lifecycle status. Showing stage beside Decision would create a second status and needs a product decision |
| Owner | Keep owner as **contextual secondary text only while Reassignment Required is on**. A permanent Owner column would look like a personal queue and conflicts with shared-list semantics. Current owner filter in the API (`CounselorId` query) is how analytics scopes the list; it is already a URL chip (“Counselor filtered”), not a new My Sessions queue |
| Reassignment Required | Keep the pill filter and the row Reassign action (permission-gated). Do not turn RR into a Decision or Status value (Slice 12) |
| Last activity / session date | Session date is shown and is the server sort. `CreatedAt` is a tie-break and not a useful operator column. `SessionStartTime` exists and is unused; showing a time **under** the date is optional presentation of an existing field. Confirming that operators need clock time is a product decision; the field itself is not a data gap |
| Open / Reassign | Keep both visible. Open is primary. Reassign stays secondary and only in the RR state. Do not bury Reassign only in a row overflow, or the accepted RR workflow becomes harder to see |
| Pagination | Server page size **20**, numbered pages, URL `page`, reset to page 1 when RR toggles (Slice 13). Waiting List is client 10/25/50. Follow-up is server 20 with a simpler pager. **Do not unify page size** with Waiting List. Shared footer **wording** (“Showing x–y of z”) is a presentation alignment that Sessions already has |

**UI-only (existing list fields, no rule change)** — still needs the next Product Decision before anyone implements, because Sessions presentation was accepted in Slice 13:

- Secondary line: medical record number, labeled with the approved identifier name.
- Surgery cell: procedure primary, `SurgeryTentativeEye` secondary when present.
- Do not add Age/Gender until the list API projects them (**D** / **E**).

**Not UI-only**

- Patient-name search. `SessionFilters.Search` comment says “session number or patient name”. The query filters **session number only** (`SessionNumber.Contains`). A search box that promises patient name is **DATA SOURCE INSUFFICIENT** until the API is explicitly extended.
- Age, gender, HealthId on the list.

---

## 7. Finalize Surgery deep dive

Accepted workflow stays. This section is presentation only.

| Element | Current | Presentation note | Boundary |
|---------|---------|-------------------|----------|
| Workspaces | Surgery Finalization and OT Preparation on one route | Keep both. OT Preparation is not a second product | RESP2 protected |
| Status tabs | All, Not Confirmed, Confirmed, Finalised, OT Prepared, Cancelled, Surgery Done | Keep. They are FSM states | Do not alter FSM |
| Search | Separate UHID and Patient Name fields, debounced, server query `uhid` / `name` | Clearer than a single omnibox. Align placeholder capitalization only | No new search fields |
| Date | Schedule date filter; OT Preparation uses surgery-date catalog rules | Keep date meaning distinct from Waiting List queue dates | `prepare-ot-date-scope` protected |
| Patient | Name + UHID · type, with surgeon/package/checklist compressed at wide width | Keep hierarchical. Do not split UHID into a default column | — |
| Surgery date / time | Inside Schedule, with eye and theatre | Keep one Schedule cell. Splitting Date, Time, Theatre, Eye into four default columns reproduces the compressed screenshot problem | UI-only split = optional later, not default |
| Procedure | Surgery column | DEFAULT | — |
| Eye | Inside schedule line (`eyes`) | Hierarchical secondary. Separate default column not required for scanning at current density | Field exists (`Eye`) |
| Surgeon | Quiet metadata under patient at ≥1600, else concatenated | Contextual, not a missing data gap | — |
| Theatre | Inside schedule line | Same | — |
| Status | Own column + tabs | DEFAULT. Text badge, not color alone (`StatusBadge` label) | — |
| Actions | FSM primary + print | Keep. Print selection checkbox only where already authorized (OT Prepared / OT Preparation) | Do not add selection on other tabs |
| Sequence number | Not a column | Leave it off the grid | SequenceNo semantics protected |
| Pagination | Client slice of the fetched schedule list | Matches current non-paged API (`List<OtScheduleResponse>`, no page envelope) | Server paging would be **D** |
| Modal | `FinalizeOtModal` from row / primary action | Keep. Do not move confirmation fields onto the grid | Package LA protected |
| KPIs | Scheduled, Awaiting Finalise (`NEEDS_ATTENTION_KPI_LABEL`), Surgery Done. OT prep: Finalised, Selected | Useful and local. “Awaiting Finalise” is a defined count, not a duplicate of the Confirmed tab label. Confirm in implementation notes that it is population-scoped in memory for the active filters, not the page | Do not invent OT KPIs |

No second OT Prepared worklist. No ownership column. Counselor is not the row actor here.

---

## 8. Follow-up Center deep dive

Active, Cold, and Post-Surgery do **not** share one data source. The UI reuses one grid skeleton. That reuse is acceptable. The words inside Status and Contact must stay source-specific.

| | Active | Cold | Post-Surgery |
|--|--------|------|----------------|
| Authoritative source | `GET /Counseling/followups/active` allowlist intentions | `GET /Counseling/followups/cold-leads` | `GET /Counseling/followups/post-surgery` journeys |
| DTO | `ActiveFollowupItemDto` | `ColdLeadItemDto` | `PostSurgeryFollowupItemDto` |
| Patient | Name, UHID, phone | Same | Name, UHID, phone |
| Procedure / context | `recommendedSurgery` | `recommendedSurgery` | `surgeryType` |
| Date | Session date on DTO, **not shown** (contact date is shown) | Session date shown in Contact | `dischargeDate` / days since discharge |
| Intention / reason | Intention pill. `lastContactOutcome` on DTO, not shown | Intention pill. `additionalNotes` on DTO, not a column | Condition at discharge. Not an intention |
| Original counsellor | `formatOriginalCounsellorAttribution` — historical, **not** ACL | Same | **Not available.** Do not invent from a latest session (Phase 2X forbids opportunistic session link) |
| Status | Intention | Intention | Discharge aging + condition |
| Next action | Open session, log contact, reminder, history, Re-queue | Same | Subset. Re-queue absent. Session actions omitted when `sessionId` is null |
| Pagination | Server 20 | Server 20 | Server 20 |
| Filters | Search `q`, intention allowlist | Search `q` only | Search `q` only |

Search placeholder says “name, MRN, phone, or procedure”. The audit did not re-read the SQL `q` predicate line-by-line in this pass. **Do not add columns that assume `q` matches a field the list does not return.** UHID, phone, and procedure are on the DTOs and are already rendered.

**Preserve**

- Shared center. No My Follow-ups operational queue.
- Historical counsellor line is not current-ownership ACL (PD-FOLLOWUP-01).
- ReQueue stays the certified Active/Cold action (version, expected counsellor, reason, session type).
- Post-Surgery does not gain a counsellor owner column from an unlinked session.

**Columns desired by operators but not authoritative**

| Desired | Classification |
|---------|----------------|
| Current follow-up owner | **DATA SOURCE INSUFFICIENT.** CounselorId on Active/Cold is original counselling attribution |
| Post-Surgery original counsellor | **DATA SOURCE INSUFFICIENT** on `PostSurgeryFollowupItemDto` |
| Eye | Not on these list DTOs |
| Age / gender | Not on these list DTOs |
| Generic due date / SLA | Explicitly rejected (Phase 2Y). `OverdueSinceDate` / `AlertLevel` remain on the Active DTO and must **not** return as priority chrome |
| `urgentHigh` KPI | On the stats DTO for compatibility. UI intentionally does not show “High Priority” |

`lastContactOutcome` (Active/Cold) and `additionalNotes` (Cold) are on the DTO. Showing them as a secondary line is an existing-API presentation option, not a new source. Default recommendation: leave them off the scan row; they belong in history / contact log. Putting notes on every row raises PHI density.

---

## 9. Analytics deep dive

Analytics is a reporting surface. Drill-down destinations already go to the Sessions list (and Follow-up Center where the aging/follow-up links are built). Those destinations stay.

| Control | Current | Classification |
|---------|---------|----------------|
| KPI cards | Summary partition + rates from `CounselingAnalyticsSummaryDto`. Several cards navigate via existing `analytics-drilldown` hrefs | Keep formulas (PD13–PD15). Do not add operational queue counts |
| Scope | Counselor `<select>`: empty value = **Authorized Branch**; current user = **My Work**; other options = peer counselors | Reporting scope. My Work must not become a worklist |
| Branch | `selectedBranchId` from the auth store, else the user’s branch. **There is no second branch dropdown on this page** | Do not add a parallel branch control that could bypass Follow-up branch authorization |
| Period | 7 / 14 / 30 day pills for summary and trends. Aging has its own 30/90/180/365 | Two period controls are intentional (different populations). Label them so “period” is not one widget |
| Funnel | Decision funnel; stage click uses existing drill hrefs | Keep |
| Trends | Daily strip from `/analytics/trends` | Keep |
| Aging | Pending-decision buckets. **Not** the Follow-up Active intention list (file comment) | Keep as a report table |
| Export | Client CSV of summary (`buildCounselorAnalyticsCsv`) | Keep. Do not export a new patient grid |
| Print | `window.print` + `AnalyticsPrintReport` | Keep |

**Grid alignment without becoming a queue**

- Use the same status-pill and table-header typography as Sessions for the aging table.
- Do not add Owner, Assign, Reassign, Pre-Auth, or row selection.
- Open stays a drill-down, not a claim.
- Phone in the aging table is existing report data. It is more PHI than Waiting List shows. Narrowing print/export columns is a product decision if print currently includes phone; this audit did not treat print layout as a defect.

Visual alignment (spacing, header case, “Showing” language where a table is paged) is in scope for a presentation standard. Aging is not paged; do not invent pager chrome.

---

## 10. Candidate common interaction patterns

| Pattern | Supported today | Recommendation |
|---------|-----------------|----------------|
| A. Column resize | No | **Do not adopt** in this standard. No operational evidence, no keyboard alternative, conflicts with fluid `fr` tracks that already retune by breakpoint |
| B. Column reorder | No | **Do not adopt.** Drag-only reorder fails the accessibility rule. Remembered order would also create per-user layouts with no audit need identified |
| C. Column visibility | No | **Candidate only** for fields already returned and classified OPTIONAL. Not for Waiting List’s certified seven zones. Requires a non-drag control (menu + checkboxes). Persistence (session vs user profile) is a product decision |
| D. Sorting | Server orders are fixed (queue position; session date; finalize list order from the service; follow-up list order from the service). No clickable headers | Header sort on a **client-held** list (Waiting List, Finalize) would change scan order away from queue/schedule sequence → **product decision**, even though the rows are already in memory. Header sort on Sessions and Follow-up requires API `sort` → **D** |
| E. Column filtering | Not present | See type matrix. Do not add an alphabetical filter to every column |

**Data-type filter matrix — technical support**

| Type | Useful operators | Today | To do it properly |
|------|------------------|-------|-------------------|
| Text contains | Waiting List quick search (client, selected fields). Follow-up `q` (server). Finalize name and UHID are separate contains-style server filters. Sessions search API is session-number contains only | Existing, uneven | A Sessions patient-name contains is **D**. Column menus on top of these would duplicate the toolbar |
| Text starts-with / exact | Not in the grids | Missing | Not justified |
| Enum multi-select | Status is tabs (single). Follow-up intention is single select. Payment type is not a filter | Tabs are the right enum control | Column multi-select would be a second status model → **E** |
| Date before / after / between | Waiting List From/To (server). Finalize one schedule date. Sessions URL from/to. Analytics periods | Existing, different labels | Standardize labels only |
| Time before / after | Not a filter | Missing | Surgery time filter on Finalize would be **E** (schedule meaning) and possibly **D** |
| Numeric range | Not a filter. Package rate is display-only | Missing | Do not add |
| Boolean yes/no | Sessions URL booleans (pending, agreed, RR) | Existing via chips / pill, not a column filter | Keep |

**Standardize the toolbar, not a filter-per-column grid.**

---

## 11. Column design analysis

Classes: **CORE** (scan every day), **SECONDARY** (useful, not always), **CONTEXTUAL** (only in a state), **OPTIONAL** (Columns menu, if that menu is ever approved), **REMOVE**, **DATA GAP**, **PRODUCT DECISION**.

### Waiting List

| Field | Class |
|-------|--------|
| Patient name | CORE |
| UHID inside Patient | CORE (hierarchical, not its own column) |
| Age / sex inside Patient | CORE as certified lightweight secondary — not a separate column |
| Visit type | CORE |
| Doctor, queue time inside Visit | SECONDARY hierarchical |
| Procedure | CORE |
| Eye under procedure | SECONDARY hierarchical |
| Owner | CORE |
| Payment type | CORE |
| Pre-Auth hint | CONTEXTUAL (coverage rows) |
| Status | CORE |
| Action | CORE |
| Separate UHID, Age/Gender, Doctor, Eye columns | **Do not.** Would reopen C-01 |
| Phone, DOB, blood group | DATA GAP on this DTO |

### Sessions

| Field | Class |
|-------|--------|
| Patient name | CORE |
| Medical record number as secondary | SECONDARY — **PRODUCT DECISION** on the label UHID vs MRN |
| Session date | CORE |
| Procedure | CORE |
| Eye under procedure | SECONDARY, existing DTO, not shown |
| Decision | CORE |
| Open | CORE |
| Reassign | CONTEXTUAL (RR) |
| Owner name | CONTEXTUAL (RR). Not a default column |
| Doctor | OPTIONAL only after a visibility PD. Not default |
| Session type | OPTIONAL / **PRODUCT DECISION** (easy to confuse with Decision) |
| `Status` / `CurrentStage` | **PRODUCT DECISION** — do not show beside Decision by default |
| Age / sex / HealthId | DATA GAP on the **list** DTO |
| Session start time | OPTIONAL existing field; default off |

### Finalize

| Field | Class |
|-------|--------|
| Patient name + UHID | CORE hierarchical |
| Procedure | CORE |
| FSM status | CORE |
| Schedule (date, time, eye, theatre) | CORE hierarchical |
| Anesthesia / reporting time under procedure | SECONDARY |
| Surgeon, package, checklist | CONTEXTUAL quiet line (already wide-only) |
| Payment type inside identity | SECONDARY |
| Package rate under schedule | SECONDARY |
| Action / print | CORE where the FSM allows |
| Selection checkbox | CONTEXTUAL (already authorized tabs only) |
| Sequence number | **Do not show** (certified semantics — not a scan column) |
| Separate Eye, Theatre, Surgeon default columns | OPTIONAL at most. Default **no**, to protect density |
| Age / sex | DATA GAP on `OtScheduleResponse` |

### Follow-up

| Field | Active | Cold | Post-Surgery |
|-------|--------|------|----------------|
| Name, UHID, phone | CORE hierarchical | CORE hierarchical | CORE hierarchical |
| Procedure / surgery type | CORE | CORE | CORE |
| Intention or discharge condition | CORE | CORE | CORE |
| Contact / discharge date | CORE | CORE | CORE |
| Original counsellor text | CONTEXTUAL secondary (not ACL) | CONTEXTUAL secondary | DATA GAP |
| Re-queue | CORE action | CORE action | Absent by rule — do not add |
| Open session | CORE when session id exists | CORE | CONTEXTUAL when `sessionId` present |
| Eye, age, sex, current owner | DATA GAP | DATA GAP | DATA GAP |
| Alert level / overdue SLA | REMOVE from any future design (Phase 2Y) | — | — |

### Analytics aging table

| Field | Class |
|-------|--------|
| Patient, surgery, days | CORE for this report |
| Phone | SECONDARY report field. PHI-heavy. Not a candidate to copy onto operational queues |
| Open | Drill-down, not a queue action |
| UHID | Not on the aging row model used by the table. **Do not invent** |
| Owner / status / assign | Out of scope — would turn the report into a queue |

---

## 12. Patient identity pattern

| Pattern | Definition |
|---------|------------|
| A | Three columns: Patient, UHID, Age/Gender |
| B | One cell: name, then UHID, then age/sex |
| C | Hybrid columns **and** a stacked cell |

**Choice is not taken from a screenshot.** It follows scan speed on a desktop workstation, whether UHID must be selected without the name, width, PHI, and what C-01 already certified.

| Surface | Fit | Why |
|---------|-----|-----|
| Waiting List | **B** (certified) | Seven zones already. UHID is on the row for visual match. Dedicated UHID column costs a track that Action and Status need. Age/sex are PD-C01-03 lightweight, omitted when empty. Pattern A reopens C-01 |
| Sessions | **B** for name + approved identifier. **Not** age/sex until the list DTO has them | Scanning a registry is name-first. Identifier secondary supports recognition. Age/sex would be a fabricated column today |
| Finalize | **B** for name + UHID. Age/sex not available | Schedule scanning needs the schedule cell more than a third identity column. UHID is already on the secondary line and is also a real server filter, so copy/search does not depend on a separate column |
| Follow-up | **B** for name + UHID, with phone because the job is contact | Pattern A plus phone would push actions off. Phone in the identity line is operational, not decorative. `#` prefix is inconsistent with other surfaces (label cleanup only) |
| Analytics aging | **Name column as now.** Do not add Pattern A | Report rows are already five columns. Adding UHID is a data gap. Phone stays in its column because contact is the report’s point, and print/PHI review is a product decision |

Pattern C (both a UHID column and a stacked cell) duplicates PHI and fails the density rule. It is not recommended on any of the five.

**Copying UHID:** a separate column is not required for copy if the secondary line is selectable text (it is). A copy-icon is optional chrome and still a presentation change on a certified Waiting List row — leave it out of the default standard.

---

## 13. Header / KPI / stat analysis

No new metrics. Sources are existing counters only.

| Surface | What is shown | Useful? | Matches which population? | Page or full? | Truthful label? | Weight | Tabs, cards, or both? |
|---------|---------------|---------|---------------------------|---------------|------------------|--------|------------------------|
| Waiting List cards | Patients, Pending, Processing, Done, Repeat | Yes for workload. Duplicate of four tabs | Fetched list after **type** (dates via refetch). **Ignores search and Owner** | Full fetched set, not the page | “Patients” equals All after type, not “matching search” | High: five bordered cards plus a scrolling tab strip | **Both, certified.** Do not drop either without a new PD. A future PD may say cards ignore search **or** cards follow the active row filter — that changes meaning → **E** |
| Waiting List tabs | Nine states including counts | Yes. Pre-Auth and OT Returned are not cards | Same count source as cards, plus those two extra keys | Full fetched set | Processing label vs `Processed` key is already an accepted display alias | Appropriate as the filter | Tabs are the filter. Cards are not filters |
| Sessions | `{n} sessions` only. No KPI strip | Count is the pager total (`TotalCount`) | Server filter set | Full result count, not page size | Yes | Light | No cards. RR pill is the only state control. **Do not add a KPI strip** |
| Finalize | Scheduled, Awaiting Finalise, Surgery Done | Yes | In-memory list for the active date/name/UHID query, then tab filter logic in the page | Not the page slice | “Awaiting Finalise” is a named helper, not the word Confirmed | Light strip | Status tabs **and** a 3-count strip. Not the same duplication as Waiting List’s five cards. OT Preparation replaces the strip with Finalised + Selected (workspace-local) |
| Follow-up | Tab-specific stats from `/followups/stats` | Yes: Active total, never contacted, average attempts; Cold declined/referred; Post-Surgery ≥30 days, pending visits, average days | Documented `scope = filtered` (branch, `q`, and intention on Active only) | **Not** the page | Phase 2Y labels are factual. “Referred” is shorter than “Referred Elsewhere” | Light | Tabs **and** a strip that changes with the tab. Same totals also appear on the tab badges when stats have loaded. Mild duplication of the total only. Keep both; the strip carries the non-count metrics (averages, ≥30 days) |
| Analytics | Eleven-wide partition strip | Yes for the certified formulas | Reporting window × branch × counselor scope | Population, not a page | Sub-labels are formula shorthand (`T−Ex−Other`). Operators may not read them. Rewording sub-labels without changing numbers is presentation; changing a formula is **G** (protected) | Heavy on laptop (`lg:grid-cols-11`) | No operational tabs. Period pills are the time scope. **Do not duplicate** these numbers as a second funnel legend beyond what exists |

Orphan-intention audit counts exist on follow-up stats and are correctly **not** a Center queue. Do not surface them as KPIs without a product decision.

---

## 14. Filter architecture

| Filter | Waiting List | Sessions | Finalize | Follow-up | Analytics |
|--------|--------------|----------|----------|-----------|-----------|
| Free-text search | Existing. Client contains. Toolbar. Not a full URL PHI dump (search string is in limited URL state — operators should avoid pasting clinical text; PD-C01-05 already forbids extra PHI params) | **Missing UI.** URL has no general search. API `Search` is session number only | Existing. Server UHID and name, separate fields | Existing. Server `q` | None (not a patient list) |
| Date range | Existing. Server. Module | Existing only when analytics (or a caller) sets URL dates. No date control on the page | Existing. Server single schedule date. Module | **Missing** (populations are not date-range queues). Do not invent a due-date filter | Existing. Period presets. Module. Summary also accepts from/to on the API; the page uses presets |
| Type (Procedure/Surgery) | Existing. Module + URL | Not this concept | Not this concept | Not this concept | Session-type **chart**, not a filter |
| Owner / counsellor | Existing. Client convenience. **Not** visibility. URL | URL `counselorId` from drill-down. Chip “Counselor filtered”. Not an owner column | None. Do not add | Original counsellor is display, not a filter | Counselor scope select. Reporting. **Not** a queue owner filter |
| Status / state | Tabs. Client. URL tab | Decision via URL booleans, not status tabs | Tabs. Client on fetched rows. Server can also take `status` | Tabs switch **endpoint**. Active intention filter is server | Funnel stage drills into Sessions. Not a grid filter |
| Reassignment Required | Not on Waiting List (do not add a second RR queue) | Existing pill. Server. URL | No | No | No |
| Payment / coverage | Pre-Auth tab. Membership locked | No | No column filter. Payment is display | No | No |
| Branch | Server authorized set. Client `branchId` is a request filter only | URL `branchId` within server branch enforcement | Server branch enforcement (PD-S9-12) | Server branch | Auth-store branch. No page-local branch dropdown |
| Active filter chips | Clear resets search, dates, type, owner. No chip row | Chips for drill-down params. RR is the pill, not a chip | Clear via empty fields (no chip row) | Search text is the active state. Intention select on Active | Scope sentence under the counselor select |
| URL state | Limited explicit (PD-C01-05) | `page`, RR, analytics drill params | Not the Waiting List URL model (workspace is component state) | Tab and search are component state, not URL | Component state |
| Server vs client | Dates/type/name/MRD **can** be server; status, search, owner are client after fetch | Server page | Server query, client tab + page | Server page | Server aggregates |

**Label alignment that does not change semantics (presentation candidates)**

- “From / To” vs “Session date” vs “Schedule date” — keep the nouns, because the dates mean different things. Do not rename them all “Date”.
- “Owner” on Waiting List vs “Counselor filtered” chip vs “Authorized Branch / My Work” — do not collapse these words. They are different contracts. A glossary line in the standard is enough.
- Search placeholders: Waiting List lists patient, MRN, doctor, procedure, counsellor. Follow-up lists name, MRN, phone, procedure. Finalize uses field labels UHID and Patient Name. Sessions has no box. Standard: one placeholder pattern **per module**, not one sentence copied everywhere.
- Capitalization: sentence case for toolbar labels (already mostly true). Table headers should pick one treatment. Waiting List cues are title case. Sessions headers are title case with “Session date” not “SESSION DATE” in source they are CSS `uppercase`. The uppercase utility is why Sessions looks different. Aligning to the Waiting List cue style (semibold, not 10px uppercase) is presentation-only for Sessions, Follow-up cues, and aging.

---

## 15. Grid interaction standard (not implemented)

**Candidate toolbar, only where the control already has a job:**

`[Search or named fields] [module filters] [Reset/Clear] [Refresh if the page already refreshes]`

Do **not** put Columns, Density, or a generic Filters popover on every page.

| Control | Waiting List | Sessions | Finalize | Follow-up | Analytics |
|---------|--------------|----------|----------|-----------|-----------|
| Search | Justified (exists) | Justified only for session number unless API grows. Placement candidate, **E/D** | Justified (UHID + name) | Justified | No |
| Filters | Dates, type, owner — exist | RR pill + read-only chips. No new filter builder | Date + status tabs | Intention on Active only | Period + counselor scope |
| Columns | No. Certified zones | No, until OPTIONAL fields are approved | No | No | No |
| Density | No. Desktop density is already tokenized (`staff-worklist-row`, compact 1600 spacing) | No | No | No | No |
| Reset | Exists (Clear) | Missing for chips (user uses back / URL). A Clear that strips drill params would change analytics return trips → **E** | Field clear exists implicitly by emptying inputs; OT date rules must stay | Refresh exists. Clearing search is the input | Period click resets window. No patient filters to reset |
| Sticky header | Cues are outside the scroll body (they stay put). Good | `<thead sticky>` | Cues outside scroll | Cues outside scroll but `aria-hidden` | Aging header scrolls with the small table |
| Row hover | Yes | Yes | Yes | Yes | Aging row hover |
| Row selection | Row highlight is **not** bulk select. Assign uses a dialog | None. Do not add | Checkbox only on authorized OT Prepared / OT Preparation | None. Do not add | None. Do not add |
| Primary action | Lifecycle CTA | Open | FSM action | Open session when a session exists | Open (drill-down) |
| Secondary | Assign / Reassign / Pre-Auth by rule | Reassign under RR | Print | Contact, reminder, history, Re-queue | None |
| Overflow menu | Not used. Explicit buttons match permission visibility better | Keep explicit | Keep explicit | Follow-up already fits several icon buttons; an overflow would hide Re-queue. Keep explicit | Keep explicit |
| Pagination | Numbered, page size | Numbered, fixed 20 | Numbered, shared component | Prev/next + page fraction | None |
| Result count | Pager range | Header count + pager | Pager | “N total” **and** pager range | KPI values |
| Horizontal scroll | Tracks shrink with `minmax(0, …)` then stack &lt;768 | Table can scroll (`overflow-auto`) | Same as Waiting List grid | Grid shrinks; columns hide &lt;`sm` | Aging table `overflow-x-auto` |
| Responsive collapse | &lt;768 single column; cues hidden | Surgery column hides; value moves under the name | Single column &lt;768 | Procedure, status, contact hide &lt;`sm` | KPI grid reduces columns |

Shared pager component already exists: `WaitingListQueuePagination` is used by Waiting List and Finalize. Sessions reimplemented numbered buttons with the same page-window helpers. Follow-up uses a thinner Prev/next. **Recommendation:** one pagination **footer pattern** (range text + numbered control + page size only where page size is already a product decision). Implement later only under authorization. Do not change Waiting List page-size options as part of “consistency”.

---

## 16. Responsive analysis

Staff desktop is the design center (healthcare UX rule). Breakpoints already in the counselling theme: &lt;768 stack, 768–1599 workstation, ≥1600 large desktop.

| Question | Recommendation |
|----------|----------------|
| Minimum useful width | 768px for the multi-column operational grids. Below that, a counsellor workstation is not the target, but the row must still expose identity, status, and the primary action |
| Collapse vs scroll | **Prefer horizontal scroll of the same columns between ~768 and the point where tracks fall under readable minimums**, rather than hiding Status or Action. Waiting List already keeps all seven zones from 768 up. Follow-up **hides** Procedure, Status, and Contact below `sm` — those are operational. Candidate: from 640–768, scroll instead of drop. This is presentation, but it changes a shipped Follow-up layout → authorization, not a silent tweak |
| Secondary text | Doctor, time, eye, phone, original counsellor, package, checklist stay secondary lines. They must not become the only place status lives |
| Must stay visible | Patient name, the module’s status (or decision), primary action. UHID stays on the identity line, not dropped |
| Narrow actions | Keep the text CTA. Icon-only is already used for some Follow-up and print actions and must keep the accessible name (already present on several) |
| Toolbar wrap | Waiting List uses a 5-track grid with `overflow-x-auto` rather than wrapping into a tall stack. That matches desktop-first. Do not force a mobile filter drawer |
| Column configuration UI | If a Columns menu is ever approved, it is a button, not a drag surface, and it remains available on the desktop toolbar |

Do not hide eye, procedure, or FSM status merely because the viewport is a laptop. The workstation tracks exist specifically to avoid that.

---

## 17. Accessibility

| Check | Waiting List | Sessions | Finalize | Follow-up | Analytics |
|-------|--------------|----------|----------|-----------|-----------|
| Keyboard | Row is a `role="button"` with Enter/Space. Patient cell is a nested button (demographics). Risk: nested interactive in one button | Real table. Buttons are in cells. **Better** | Same nested-button pattern as Waiting List when the row itself is clickable | Rows are not one button. Actions are separate buttons. **Better** for actions. Header cues are `aria-hidden`, so the visual columns are not in the accessibility tree | Aging uses buttons and a table |
| Sortable headers | No | No | No | No | No |
| Focus | `focus-visible` ring on row and controls | On pagination and buttons | On row and controls | On inputs and buttons | On KPI drill buttons and Open |
| Screen-reader labels | Row `aria-label` includes name, status, owner. Column headers use `role="columnheader"` on `<p>` inside `role="row"` but the rows are not `role="row"` children of `role="table"`. Incomplete table semantics | `<table aria-label="Counselling sessions">` | Grid cues. Row `aria-label` | Worklist `aria-label`. Cues not exposed | Aging tables have `aria-label`. KPI region labeled |
| Status | Text in the pill, not color alone | Text | Text | Text. Color plus label | Bucket name plus count |
| Drag | None | None | None | None | None |

**If a future PD allows reorder:** a keyboard alternative is mandatory (move up/down or a list of checkboxes). Drag is not the only mechanism. This audit’s recommendation is to **not** add drag, which removes that requirement.

**Sessions is the accessibility reference for a true grid.** Waiting List’s CSS grid is the visual reference. A shared standard should not force Waiting List onto `<table>` (that would be a C-01 markup rewrite) and should not force Analytics charts into a table. It should require: visible focus, text status, named icon buttons, and either a real table or an explicitly labeled region whose header text is not `aria-hidden` when those headers are the only names of the columns. Follow-up cue `aria-hidden` is the clearest gap.

---

## 18. Healthcare / PHI

No compliance certification is claimed.

| Topic | Observation | Guidance already in platform rules |
|-------|-------------|-------------------------------------|
| PHI density | Follow-up and aging show phone. Waiting List does not. Sessions does not show MRN even though it is fetched | Show the identifier the task needs. Do not add phone to Waiting List, Sessions, or Finalize for symmetry |
| Identity vs state | Name is semibold; status is a pill; action is a button. That distinction exists | Keep it. Do not color the whole row as the only status signal |
| Color-only | Pills include text. OT Returned uses rose plus the word. Follow-up left border (red on Cold) is extra, not the only cue | Keep text |
| Dates | Mixed locales and patterns | A presentation standard can say: operational dates as `dd MMM yyyy`, times in the existing counselling time helper, and the date’s meaning in the column or secondary label (“Queued”, “Session”, “Surgery”, “Discharged”) |
| Abbreviations | UHID, MRN, OT, RR, FSM, RE/LE/BE, Conv% | RE/LE/BE are clinical and already used. “Conv%” is report shorthand on Analytics only. Do not copy it to worklists. “T−Ex−Other” is formula shorthand — protected numbers, optional clearer subtitle only with a PD that the words are not a formula change |
| Print | Analytics print and OT slips are separate certified flows | Do not add grid “print the queue” with extra PHI |
| `#` before UHID | Follow-up only | Dropping the hash is presentation-only and low risk, still an authorization item if implemented |

Patient detail sheet on Waiting List remains the place for demographics that PD-C01-03 kept off the row.

---

## 19. Cross-module consistency matrix

| UX dimension | Waiting List | Sessions | Finalize | Follow-up | Analytics | Standardize? | Evidence | Product decision? |
|--------------|--------------|----------|----------|-----------|-----------|--------------|----------|-------------------|
| Page title | No `<h1>` | No `<h1>` (count + back) | `<h1>` changes with workspace | No `<h1>` (section title inside the list) | No `<h1>` | Yes, a visible title matching nav — presentation | Pages and nav | No, unless title copy changes meaning |
| KPI strip | 5 cards | None | 3-count or 2-count strip | Tab-specific stats | Partition strip | **No** shared metric set. Yes shared strip **density** (one quiet row, not five heavy cards) on non-WL pages. WL cards stay | Summary widgets | WL structure is certified. Changing card math is **E** |
| Tabs | Status pills | RR pill only | Workspace tabs + status pills | Three endpoint tabs | Period pills | Pill **component** already shared. Do not merge tab meanings | `pillTab` tokens | No |
| Filter toolbar | Full | Chips | Date + two search fields | Search + intention | Counselor + period | Toolbar **order** only | Section 14 | Sessions search is **E/D** |
| Search | Omnibox client | None | UHID + name server | `q` server | None | Per module | Section 14 | Sessions name search **D** |
| Active filters | Clear | Chips | Empty fields | Input value | Scope line | Chip pattern only where filters are not already visible as controls | Sessions chips | Clear-on-Sessions **E** |
| Grid header | Title-case cues | Uppercase 10px | Title-case cues | Uppercase, `aria-hidden` | Uppercase | Yes, one header style. Fix Follow-up exposing headers | CSS / pages | No for style. Follow-up a11y is presentation |
| Patient identity | Pattern B + age/sex | Name only | Pattern B + type | Pattern B + phone | Name | Pattern **B** where an identifier exists. Do not force age/sex | Section 12 | MRN label **E**. Age on Sessions **D** |
| UHID | In patient line (HealthId else MRN) | Not shown (`PatientMrn`) | In patient line | `#uhid` | Not in aging table | Show existing identifier. Do not invent HealthId on Sessions | DTOs | Label **E** |
| Doctor | In Visit | DTO unused | In quiet meta | Not on DTO | Not on aging row | Do not add a universal Doctor column | — | WL split would reopen C-01 |
| Procedure | Own zone with eye | Surgery column | Surgery zone | Procedure or surgery type | Surgery column in aging | Name the column for the source (Procedure vs Surgery). Do not force one word | — | No |
| Eye | Under procedure | On DTO, hidden | Inside schedule | DATA GAP | DATA GAP | Show under procedure/schedule where the DTO has it | Sessions + Finalize DTOs | No if kept hierarchical |
| Owner | Column, current | Contextual under RR | None | Historical line, not ACL | Scope control, not a column | **Three different meanings. Do not standardize the word “Owner” across them** | Slice 10, Slice 11, PD16 | Any merge is **E** and likely forbidden |
| Status | Queue badge | Decision badge | FSM badge | Intention or discharge | Bucket | Shared pill **component**. Not one enum | — | No |
| Dates | Queue time | Session date | Schedule | Contact or discharge | Period windows | Shared format helper. Not shared meaning | Section 18 | No |
| Actions | Explicit CTA | Open / Reassign | FSM / print | Several explicit | Open drill-down | Explicit primary. No new overflow. No new selection | — | No |
| Pagination | Client 10/25/50 | Server 20 numbered | Client numbered | Server 20 prev/next | None | Footer visual + range sentence. **Not** one page size | PD-C01-02, Slice 13 | Page-size unification **E** |
| Empty | “No patients found” + filter copy | Filter-specific | Present in page (not re-quoted) | Tab-specific | “No data” / “No trend data” | Same structure: one line, one recovery hint | Empty copy helpers | No |
| Loading | Skeleton rows | Spinner + “Loading sessions…” | Skeleton in grid | Skeleton | Pulse blocks | Skeleton for grids; do not mix a second visual language | — | No |
| Error | Page handles API errors | Retry | Page-level | Retry + “Stats unavailable” separated | Retry; trends can fail alone | Keep partial failure (stats vs list, trends vs summary) | — | No |
| Responsive | 7-zone then stack | Hide surgery column | 5-zone then stack | Hide 3 columns &lt;`sm` | KPI reflow; aging scrolls | Scroll before hiding status/action | Section 16 | Follow-up change is authorization |
| Accessibility | Grid button rows | Real table | Grid button rows | Hidden cues | Real table in buckets | Sessions/aging table semantics as the bar for **new** tables. Do not rewrite WL to `<table>` in this standard | Section 17 | WL markup rewrite would reopen C-01 |
| Column configuration | None | None | None | None | None | Not part of v1 standard | Section 10 | **E** if later |
| Sorting | Queue order fixed | Date order fixed | Service order | Service order | Bucket order | No header sort in v1 | Section 10 | Sort **E** or **D** |
| Filtering | Toolbar / tabs | URL | Toolbar / tabs | Toolbar / tabs | Scope controls | Toolbar, not column menus | Section 10 | Column filters **D/E** |
| Resizing | None | None | None | None | None | Do not add | Section 10 | No |
| Reordering | None | None | None | None | None | Do not add | Section 10 | No |

---

## 20. Data availability matrix

Proposed fields are only those discussed above. If the list DTO does not have the field, it is not “UI-only”.

| Surface | Proposed field | Existing frontend field? | Existing DTO? | Existing API? | Existing backend source? | Authoritative? | UI-only? | API change? | Product decision? |
|---------|----------------|--------------------------|---------------|---------------|--------------------------|----------------|----------|-------------|-------------------|
| Waiting List | Separate UHID column | Rendered inside Patient | `Uhid` yes | yes | HealthId else MRN | Yes for display value | Would be presentation, but **reopens C-01** | No | Yes — do not do it under this audit |
| Waiting List | Separate Age/Gender | Rendered inside Patient | `Age`, `Gender` | yes | Computed from DOB; DOB not returned | Yes as lightweight display | Reopens PD-C01-03 | No | Yes — reject as default columns |
| Waiting List | Doctor column | Inside Visit | `Doctor` | yes | Referred-by user name | Yes | Reopens seven-zone IA | No | Reject as default |
| Waiting List | Phone | Type has `contactNumber`; **DTO does not** | No | No on this endpoint | Patient row has phone; not projected | **Not on this API** | No | Yes | **DATA SOURCE INSUFFICIENT** |
| Sessions | MRN secondary line | Not rendered. Not on the page’s `SessionsListRow` type, but JSON includes `patientMrn` | `PatientMrn` | List GET | `Patients.MedicalRecordNumber` | Authoritative as **MRN**, not as HealthId | Exposing it is FE mapping + render | No for MRN | **Yes for the label “UHID”** |
| Sessions | HealthId / WL-style UHID | No | Not on list DTO. On **details** DTO as `PatientHealthId` | GET by id only | Patient | Not on the list payload | No | Yes to add to list | **E** |
| Sessions | Eye under surgery | No | `SurgeryTentativeEye` | List GET | Session column | Yes | Yes, once authorized | No | Low — still gate through PD-CGX so Slice 13 UI is not silently expanded |
| Sessions | Doctor secondary or optional | No | `DoctorName` | List GET | Referred-by name | Yes | Yes, optional not default | No | Optional visibility is **E** |
| Sessions | Age / sex | No on list page | List no. Details yes (`PatientAge`, `PatientGender`) | Not list | Patient DOB | Not authoritative **on the list response** | No | Yes | **E** |
| Sessions | Patient name search | No control | Filter property exists | Query does **not** search name | Comment overclaims | Insufficient for name | No | Yes | **DATA SOURCE INSUFFICIENT** |
| Sessions | `CurrentStage` column | No | Yes | List GET | Session | Field exists; business meaning beside Decision is unclear | Showing it is FE | No | **E** — do not show by default |
| Finalize | Eye as its own column | Shown inside Schedule | `Eye` | yes | OT schedule | Yes | Would be layout only | No | Reject as **default** (density). Not a data gap |
| Finalize | Surgeon column | Quiet line | `DoctorName` | yes | OT schedule | Yes | Layout only | No | Reject as default |
| Finalize | Sequence column | No | `SequenceNo` | yes | OT schedule | Yes | — | No | **Do not show.** Semantics protected |
| Finalize | Age / sex | No | No on `OtScheduleResponse` | No | Not projected on list | No | No | Yes | **DATA SOURCE INSUFFICIENT** |
| Follow-up Active/Cold | Original counsellor line | Already shown | `CounselorId`, `CounselorName` | yes | CounselingSession.CounselorId | Authoritative as **historical attribution**, not ACL | Already shipped | No | **G** — do not reinterpret |
| Follow-up Active | Session date column | On DTO, contact column used instead | `SessionDate` | yes | Session | Yes | Could add and crowd Contact | No | **E** if both session date and last contact become columns |
| Follow-up Post-Surgery | Original counsellor | No | **No** | No | Must not use opportunistic latest session | No | No | Would be a new projection | **DATA SOURCE INSUFFICIENT** |
| Follow-up all | Eye, age, sex | No | No | No | Not on these DTOs | No | No | Yes | **DATA SOURCE INSUFFICIENT** |
| Follow-up | Current owner queue | No | CounselorId is not ACL | — | — | No | No | Would change ownership | **Forbidden** under certified model |
| Analytics aging | UHID column | No | Not in `AgingSession` usage (name, surgery, phone, days, id) | Not shown in the table component | Unknown without extending the aging DTO read | **Not established by the table model** | No | Likely yes | **DATA SOURCE INSUFFICIENT** until the aging DTO is cited in a PD. Do not assume |
| Analytics | New My Work queue columns | — | — | — | — | Reporting only | No | Would be a new queue | **Forbidden** |

---

## 21. Design recommendation (not implemented)

### 21.1 Common Counsellor Grid UX Standard

**One interaction model. Five information architectures.**

1. Page title visible, matching the nav label (Finalize already does this and also swaps the title for OT Preparation — keep that swap).
2. State tabs are the population switch. KPI strips never become a second, conflicting population.
3. Toolbar: module filters that already exist, then Clear or Refresh where they already exist. No Columns, Density, or per-column filter row in v1.
4. Patient identity is Pattern B when an authoritative identifier is on the list DTO. Age/sex only where the list DTO already has them (Waiting List).
5. Status is text in the shared counselling pill. Color is additional.
6. One primary action per row. Secondary actions stay explicit and permission-gated. No new row-selection model.
7. Footer states the range and the total for the active population. Page size stays whatever that surface’s product decision already set.
8. Empty, loading, and error stay specific to the module’s nouns (“sessions”, “active follow-ups”, “analytics”).
9. Headers share one typographic treatment (the Waiting List cue weight, not 10px forced uppercase).
10. No resize, no drag-reorder, no alphabetical column filters.
11. Owner, historical counsellor, and My Work are three labels and stay three labels.

**Do not** build a new grid framework. See section 22.

### 21.2 Waiting List target grid

**Retain the certified grid.**

| Zone | Target | Class |
|------|--------|-------|
| Patient (name, UHID, age, sex) | Unchanged | DEFAULT |
| Visit (type, doctor, time) | Unchanged | DEFAULT |
| Procedure / Eye | Unchanged | DEFAULT |
| Owner | Unchanged | DEFAULT |
| Payment / Coverage | Unchanged | DEFAULT |
| Status | Unchanged | DEFAULT |
| Action | Unchanged | DEFAULT |
| Split identity columns | Not in target | REMOVE as a proposal |
| KPI cards and tabs | Unchanged until a PD decides whether cards follow search/owner | PRODUCT DECISION (math only) |

### 21.3 Sessions target grid

| Column | Target | Class |
|--------|--------|-------|
| Patient | Name. Secondary: MRN **if** the label decision says MRN or UHID | DEFAULT name. Identifier SECONDARY pending **E** |
| Session date | Keep. Time underneath only if a PD wants `SessionStartTime` | DEFAULT date. Time OPTIONAL / **E** |
| Surgery | Procedure. Eye secondary when `SurgeryTentativeEye` present | DEFAULT + SECONDARY eye |
| Decision | Keep Pending / Agreed / Declined | DEFAULT |
| Owner | Only while RR is on | CONTEXTUAL |
| Doctor, session type, stage | Not default | OPTIONAL or PRODUCT DECISION |
| Age / sex | Not until list API projects them | DATA GAP |
| Action | Open + contextual Reassign | DEFAULT / CONTEXTUAL |

### 21.4 Finalize target grid

| Zone | Target | Class |
|------|--------|-------|
| Patient | Name + UHID · payment type. Wide quiet line stays | DEFAULT |
| Surgery | Name + anesthesia / reporting time | DEFAULT |
| Status | FSM badge | DEFAULT |
| Schedule | Date · eye · time · theatre; rate secondary | DEFAULT |
| Action | FSM + authorized print | DEFAULT |
| Checkbox | Authorized workspaces only | CONTEXTUAL |
| Split eye / theatre / surgeon | Not default | OPTIONAL rejected for v1 |
| Sequence | Absent | REMOVE / protected |

OT Preparation workspace stays on this page with its existing columns and selection. No second worklist.

### 21.5 Follow-up target grids

Keep one visual grid and three row templates.

| Tab | Target columns | Class |
|-----|----------------|-------|
| Active | Patient (name, UHID, phone, original counsellor) · Procedure · Intention · Last contact / attempts · Actions including Re-queue | DEFAULT. Counsellor line CONTEXTUAL meaning (historical) |
| Cold | Same skeleton. Contact cell keeps session date · last contact. Notes stay off the row | DEFAULT |
| Post-Surgery | Patient without counsellor · Surgery type · Days and condition · Discharge and pending visits · Actions that the DTO actually allows | DEFAULT. Counsellor DATA GAP |

Do not add My Follow-ups. Do not show alert level.

### 21.6 Analytics target

Keep the reporting layout. Align aging table header typography and pill usage with Sessions. Do not add worklist columns, selection, or My Work as a queue. KPI formulas unchanged. Branch remains the auth-store branch. Counselor select remains Authorized Branch / My Work / peer.

### 21.7 Common filter model

Module toolbar + state tabs. Date controls keep their nouns. No column filter menus in v1. Sessions does not gain a patient-name search until the API actually filters names.

### 21.8 Common column configuration model

**V1: none.** Certified and accepted columns stay visible. A later PD may allow a Columns checkbox menu only for OPTIONAL fields that are already on the list DTO (Sessions eye is better as a secondary line than as a toggle). Resize and reorder are out of that menu.

### 21.9 Common responsive model

Desktop tracks stay. Below the workstation width, horizontal scroll is preferred to dropping status or the primary action. Follow-up’s hide-below-`sm` behavior is the one layout that fights that rule. Waiting List’s certified tracks are not a redesign target.

### 21.10 Common accessibility model

Named controls, text status, visible focus, no drag-only features. New or revised lists that are actually tables (Sessions, aging) use `<table>`. Existing CSS worklists keep their cues **exposed** to assistive tech (Follow-up should stop marking cues `aria-hidden` when that is authorized). Do not nest a second button inside a `role="button"` row in any **new** row; fixing Waiting List and Finalize nested buttons is a behavior-sensitive a11y change and needs authorization plus regression tests, not a drive-by.

---

## 22. Shared component vs visual convention

Inspected:

| Existing piece | Role |
|----------------|------|
| `waiting-list-work-grid`, `finalize-surgery-work-grid`, `finalize-ot-prep-work-grid` | Counsellor CSS tracks in `counselling-session-theme.css` |
| `FOLLOWUP_WORK_GRID` | Tailwind tracks in `followup-presentation.ts` |
| `WaitingListQueueWidget` | Toolbar slot, cues, skeleton, empty, footer |
| `WaitingListQueuePagination` | Shared by Waiting List and Finalize |
| `WaitingListSummaryWidget` | WL-specific five cards + tabs |
| Sessions `<table>` | Page-local |
| `FollowupAgingTable` | Report-local |
| `src/components/ui/table.tsx` | Generic shadcn table (`bg-gray-50`). **Not** used by these counsellor worklists |
| TanStack Table | **Not present** |

**Recommendation: share visual and behavioral conventions. Do not create a new grid framework.**

A single reusable table that owns resize, reorder, filter operators, and column definitions would be a new counsellor architecture. It is not justified by the gaps in this audit (Sessions not showing fields it already has; inconsistent headers; Follow-up headers hidden from assistive tech; KPI math vs search).

Reasonable reuse **later**, only if a Product Decision and an Implementation Authorization say so:

| Reuse | Verdict |
|-------|---------|
| One column-definition TypeScript pattern | **Not now.** The five payloads are different. A shared type that forces the same keys will erase module IA |
| One filter component | **No.** Filters are not the same contract. Share input primitives (`CounsellingSearchInput`, `CounsellingInput`) which already exist |
| One column configuration pattern | **No** until visibility is a product requirement |
| One pagination pattern | **Yes, as a convention, extending `WaitingListQueuePagination` where page sizes match.** Follow-up’s simpler control can adopt the range sentence without adopting Waiting List’s 10/25/50 |
| One mega `CounsellorDataGrid` | **Do not create** |

---

## 23. Implementation classification

| ID | Item | Class |
|----|------|-------|
| G1 | Phase 3I ownership, shared Waiting List, view ≠ claim, shared Follow-up, My Work = report, Finalize shared, RESP2, SequenceNo, FSM | **G** |
| G2 | PD-C01-02 client pagination, PD-C01-03 Age/Gender, PD-C01-04 Pre-Auth membership, PD-C01-05 URL, PD-C01-06 referral | **G** |
| G3 | C-01 seven-zone grid | **G** — do not restyle as a new IA |
| G4 | Packages LA, B Print, C | **G** — do not reopen for UI |
| G5 | C-LA-04 | **H** |
| G6 | Slice 14, Phase 3J, second OT list, My Follow-ups queue, My Work queue | **I** |
| A1 | Header typography alignment on Sessions, Follow-up, aging | **A** then **F** before code |
| A2 | Follow-up UHID without `#` | **A** / **F** |
| A3 | Visible page titles where missing | **A** / **F** |
| A4 | Follow-up column cues not `aria-hidden` | **A** / **F** |
| A5 | Date format helper shared visually | **A** / **F** |
| B1 | Sessions: render `SurgeryTentativeEye` under surgery | **B** existing API. Still **F** and should be inside the PD so Slice 13 is not silently expanded |
| B2 | Sessions: render `PatientMrn` after label PD | **B** + **E** (label) |
| B3 | Sessions: `DoctorName` optional | **B** + **E** |
| C1 | Waiting List, Finalize, Follow-up, Analytics fields already on screen | **C** — no change required |
| D1 | Sessions patient-name search | **D** |
| D2 | Age/sex/HealthId on Sessions list | **D** |
| D3 | Age/sex on Finalize list | **D** |
| D4 | Eye/age/sex on Follow-up lists | **D** |
| D5 | Post-Surgery counsellor attribution | **D** and likely **I** (ownership boundary) |
| D6 | Server sort parameters | **D** |
| D7 | Waiting List server pagination | **D** + already **out of scope** for C-01; needs its own PD |
| E1 | Whether KPI cards follow search and Owner | **E** |
| E2 | MRN vs UHID label on Sessions | **E** |
| E3 | Header sort on client lists (queue/schedule order) | **E** |
| E4 | Columns visibility menu and persistence | **E** |
| E5 | `CurrentStage` / session `Status` beside Decision | **E** |
| E6 | Analytics subtitle wording that might be read as formula changes | **E** if words change; numbers **G** |
| E7 | Phone on Analytics print | **E** |
| F1 | Any of A1–A5, B1 after the PD says yes | **F** |
| J1 | Nested row button vs inner Patient button on Waiting List / Finalize | **J** if “fixed” without tests — activation, Assign, and demographics can regress |
| J2 | Changing WL tracks, page size, or tab counts | **J** against C-01 |
| J3 | Follow-up showing `AlertLevel` again | **J** against Phase 2Y |
| J4 | Treating historical counsellor as ACL | **J** against Slice 10 |

---

## 24. Product Decision candidates

These are candidates. This document does not approve them.

| ID | Question | Recommended answer in the review | If rejected |
|----|----------|----------------------------------|-------------|
| PD-CGX-01 | Adopt a Counsellor **interaction** standard (sections 21.1, 21.7–21.10) without a new grid component and without changing certified column sets | Adopt | Leave surfaces as they are |
| PD-CGX-02 | Waiting List remains the closed C-01 seven-zone grid (Pattern B) | Adopt — no column split | Any split reopens C-01 |
| PD-CGX-03 | Sessions may show list-DTO eye under Surgery, and MRN as a secondary line, after the label is chosen | Adopt eye. Decide MRN vs UHID explicitly | Sessions stays name + surgery + decision |
| PD-CGX-04 | Do not add resize, reorder, column filters, or a Columns menu in the same gate | Adopt | A later PD may revisit visibility only |
| PD-CGX-05 | Waiting List KPI/tab counts stay type-and-fetch scoped (ignore search and Owner), **or** they follow the visible row filter | Needs an explicit choice. Current behavior is the certified implementation | Silent change is not allowed |
| PD-CGX-06 | No shared “Owner” column across the five surfaces | Adopt | — |

Out of this decision: API expansions (D1–D7), ownership, FSM, pagination model changes, C-LA-04, Wave 2 clinical workspace UX.

---

## 25. Protected certified behavior

- Phase 3I closed. No Slice 14. No Phase 3J.
- Waiting List shared. `CounselorId` ownership semantics unchanged. Open/view does not assign.
- Follow-up Center shared. No My Follow-ups queue. Historical attribution ≠ ACL. ReQueue rules unchanged. Post-Surgery has no invented owner.
- Analytics My Work, Authorized Branch, peer counselor filter, and strict CounselorId attribution remain reporting scope.
- PD13–PD15 numbers unchanged. Existing drill-down routes unchanged.
- Finalize shared. RESP2 unchanged. No second OT Prepared worklist. FSM unchanged. SequenceNo unchanged.
- Package LA, Package B Print, Package C not reopened for visual cleanup.
- C-LA-04 stays deferred.
- PD-C01-02, 03, 04, 05, 06 unchanged.
- No duplicate operational worklist.

---

## 26. Final recommendation

### CURRENT DESIGN STATE

The five surfaces share counselling tokens and a desktop density language. They do not share columns, markup, filter contracts, pagination mechanics, or the meaning of “owner”. Waiting List is a closed seven-zone operational queue. Sessions is a thinner server-paged registry that hides identifier, eye, and doctor already returned by the API. Finalize compresses schedule details into hierarchical cells on purpose and already has an OT Preparation workspace. Follow-up reuses one grid over three sources. Analytics is a report with one small table. Column resize, reorder, visibility menus, and per-column data-type filters do not exist.

### PROPOSED COUNSELLOR GRID STANDARD

A common interaction model (title, toolbar of existing filters, text status pills, explicit primary action, range footer, empty/loading/error, one header style, Pattern B identity, no drag column chrome) plus module-specific columns. No new grid framework. No identical column set.

### WAITING LIST RECOMMENDATION

Keep the certified columns and the hierarchical Patient cell (name, UHID, age, sex). Do not split UHID or Age/Gender into default columns. Do not add phone. Leave KPI cards and tabs in place. Treat “should card counts follow search and Owner?” as a product decision, not a defect fix.

### SESSIONS RECOMMENDATION

Keep Decision, Open, contextual Reassign, and server page size 20. Show eye under surgery from the existing list DTO only after the grid PD. Show the medical record number only after a label decision (MRN vs UHID). Do not show age/sex until the list API returns them. Do not add a permanent Owner column. Do not add patient-name search until the API filters names. Reassignment Required stays a filter, not a status.

### FINALIZE RECOMMENDATION

Keep Patient, Surgery, Status, Schedule, Action, the FSM tabs, the modal, and the OT Preparation workspace including its existing selection. Keep UHID, eye, time, and theatre hierarchical. Do not add SequenceNo. Do not add a counsellor column. Do not create another OT list.

### FOLLOW-UP RECOMMENDATION

Keep three sources and one visual grid. Keep phone and historical counsellor on Active and Cold. Do not show a counsellor on Post-Surgery. Do not add My Follow-ups, SLA, or alert level. Keep Re-queue on Active and Cold only. Prefer scroll over hiding status on narrow widths only as a later authorized layout change.

### ANALYTICS RECOMMENDATION

Keep it a report. Align aging table chrome with Sessions. Do not add queue actions, row selection, or a My Work worklist. Do not change PD13–PD15. Do not add a second branch selector. Leave drill-downs on their current destinations.

### COMMON FILTER STANDARD

Tabs for state. Toolbar for the filters that already exist. Dates keep their own names. No column-level filter menus. No single omnibox forced onto Finalize or Analytics. Sessions name search is an API gap, not a missing text box.

### COLUMN RESIZE / REORDER / VISIBILITY RECOMMENDATION

Do not add resize or drag-reorder. Do not add a Columns menu in the next gate. Visibility for truly optional, already-authoritative fields can be a later product decision with a checkbox UI and a keyboard path.

### RESPONSIVE RECOMMENDATION

Stay desktop-first. Keep Waiting List’s seven zones from 768px up. Prefer horizontal scroll to hiding status or the primary action. Do not use a narrow viewport as a reason to remove procedure, eye, or clinical status.

### ACCESSIBILITY RECOMMENDATION

Textual status, visible focus, named icon buttons, no drag-only interaction. Sessions and the aging table remain the semantic-table examples. Expose Follow-up column cues to assistive technology when implementation is authorized. Do not rewrite Waiting List into a new table component as an accessibility cleanup without a decision — nested row actions are regression-sensitive.

### DATA / API GAPS

DATA SOURCE INSUFFICIENT — PRODUCT/API DECISION REQUIRED for: Sessions list age, sex, and HealthId; Sessions patient-name search (API searches session number only); Finalize age/sex; Follow-up eye, age, sex, and Post-Surgery counsellor; Analytics aging UHID (not established on the row model used by the table); any “current follow-up owner”. Waiting List phone, DOB, and blood group are not on `WaitingListPatientDto`.

### PRODUCT DECISIONS REQUIRED

PD-CGX-01 interaction standard. PD-CGX-02 Waiting List stays Pattern B. PD-CGX-03 Sessions eye and MRN label. PD-CGX-04 no resize/reorder/column filters in that gate. PD-CGX-05 Waiting List count scope versus search/owner. PD-CGX-06 owner words stay distinct. Plus the data-gap items above if anyone later wants those fields.

### IMPLEMENTATION-AUTHORIZATION ITEMS

Nothing in this audit is authorized to build. After a Product Decision adopts a subset, a separate Implementation Authorization is required before code, tests, or UAT. Likely first slice, if adopted: presentation-only header/title/a11y cue fixes and Sessions eye (existing DTO), with Waiting List byte-for-byte unchanged. MRN rendering waits on the label decision. No API, permission, ownership, or route work in that slice.

### CERTIFIED BEHAVIOR TO PROTECT

Phase 3I closed; no Slice 14; no Phase 3J; shared Waiting List; view does not claim; `CounselorId` semantics; shared Follow-up; historical attribution ≠ ACL; ReQueue; Post-Surgery session link honesty; Analytics My Work and Authorized Branch as reporting scope; PD13–PD15; existing drill-downs; Finalize shared; RESP2; FSM; SequenceNo; Packages LA, B Print, and C; C-LA-04 deferred; PD-C01-02 through PD-C01-06; no second operational worklist.

### RECOMMENDED NEXT GOVERNANCE GATE

Hold a Product Decision review of **PD-CGX-01 through PD-CGX-06** (Counsellor Grid interaction standard and the Waiting List / Sessions presentation choices in this audit). Do not implement. Do not open an Implementation Authorization in that review. Do not reopen Phase 3I, C-01, or Packages LA / B / C. Data-gap fields stay outside that gate.
