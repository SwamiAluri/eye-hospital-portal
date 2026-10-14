# Patient Directory Redesign — Product Decision and UX Contract

Document type: Product Decision / UX Contract  
Date: 2026-10-01  
Status of this file: decision record only  

Application code changed by this file: **NO**  
Database, APIs, DTOs, routes, permissions, UI, migrations, tests: **NO**  
Manual UAT: **NOT EXECUTED**  
Acceptance of an implementation slice: **NOT RECORDED**  
Implementation authorization: **NOT GRANTED**

This contract converts the Patient Directory reconciliation audit into decisions a later slice may implement. It does not start that slice.

Evidence base (repository facts, not new business rules):

- Reconciliation audit, 2026-10-01, phase “PATIENT DIRECTORY — COMPLETE REDESIGN RECONCILIATION AUDIT” (session record)
- `docs/audits/patient-directory-master-forensic-redesign-audit.md` (2026-09-29; historical where Add Patient and Patient 360 have since moved)
- `docs/decisions/patient-360-product-decision-contract.md` (PD-A through PD-H)
- `docs/design/patient-360-information-architecture.md`
- `docs/decisions/patient-create-role-grant-decision.md` (2026-10-01)
- Live directory: `/dashboard/patients` → `PatientHubPage`
- Live record: `/dashboard/patients/[id]` → `PatientRecordPage`

Status labels used below:

| Label | Meaning |
|---|---|
| **APPROVED PRODUCT DECISION** | Settled for the directory redesign. A later authorized slice may implement it. This file does not. |
| **PRESERVED CERTIFIED BEHAVIOR** | Already accepted. This contract does not reopen it and does not change it. |
| **DEFERRED DECISION** | Named, and explicitly not part of the first slice. |
| **IMPLEMENTATION SCOPE** | What the first authorized slice is allowed to touch after a separate approval. |
| **OUT OF SCOPE** | Not part of this contract’s implementation, even after approval of this file. |

---

## 1. Product objective

**APPROVED PRODUCT DECISION.**

`/dashboard/patients` is the hospital-wide patient discovery directory.

`/dashboard/patients/[id]` is Patient 360, the longitudinal read surface for the same `patient.id`.

The directory answers: which patient is this, and where does the next action live.

It provides:

1. Patient discovery
2. Patient recognition
3. Current operational context already on the lookup row
4. Clear next-step navigation
5. Handoff into the module that owns the next workflow
6. Responsive and keyboard-accessible discovery
7. A hospital-grade hierarchy using the existing Hospital Portal visual language

It remains a discovery and navigation surface.

It does not become a counselling workspace, Front Office, billing desk, insurance/CCMS desk, surgery or OT workspace, follow-up worklist, clinical chart, appointment product, registration product, ownership system, or a second Patient 360.

Counsellor is the quality reference for polish. It is not the layout template and not the source of directory business rules.

---

## 2. Directory vs Patient 360 boundary

**PRESERVED CERTIFIED BEHAVIOR**, restated so the redesign does not merge the two pages.

| Question | Directory | Preview | Patient 360 | Owner of the work |
|---|---|---|---|---|
| Who is this patient? | Name, MRN, age, sex | Same identity, existing preview wording | Identity band | Patient / MPI |
| What is active right now? | One compact context cluster from the current lookup row | Existing visit card, warnings, recent visits | Overview and section bodies | The modules that produced the facts |
| Where next? | Check-in link, book link, name → record | Existing preview actions, including open record | Header and section handoffs already on the record | The destination module |
| Chart, vitals, medications, labs, imaging | Not on the row | Not in preview | Clinical section | Clinical / diagnostics |
| Check-in | Link | Link | Existing record link | Front Office |
| Book appointment | Overflow link | Unchanged | Unchanged | Appointments |
| Counselling session, assign, ownership | Not a directory workflow | Not a preview workflow | Read context only | Counsellor waiting list and session |
| Billing, payment, claims, pre-auth processing | Not present | Not present | Coverage read stacks already on 360 | Billing / CCMS |
| Surgery, OT, follow-up | Not present | Not present | Surgery/OT remains “not available” on 360 | Those operational modules |
| Register a patient | Header navigates to the wizard | — | Not a 360 section | `/dashboard/patients/new` |

Navigation relationship:

```text
/dashboard/patients          discover, select, hand off
        row click     →      preview on the same URL (?preview=)
        patient name  →      /dashboard/patients/{id}     understand, review, go to owner
```

No new routes. No query contract changes on the record. Directory does not pass `section` or `tab`.

---

## 3. Counsellor UX reference principles

**APPROVED PRODUCT DECISION.** Reuse the principles. Do not reuse the counsellor skin.

Shared Hospital Portal language to keep on the directory:

- Staff chrome (navy sidebar, white top nav, Inter)
- Emerald primary accent already used by the directory (`bg-emerald-600` and existing gray borders)
- White and gray surfaces, existing border, radius, and `shadow-sm`
- Existing button hierarchy: one filled primary, bordered secondary actions
- shadcn `Sheet` and `DropdownMenu`
- Existing acuity/status treatment that includes a text label
- Shared worklist density tokens (`staff-worklist-row` and the related variables in `globals.css`)
- Existing `focus-visible` treatment
- Explicit loading, empty, and error states

Interaction quality to match:

- One page identity in the staff top bar
- A task-first toolbar
- Dense, readable rows
- One primary page action and quieter secondary actions
- Context without a dashboard
- Preview in the existing sheet / docked pane
- The current breakpoint behavior
- Keyboard access to the row’s preview action

---

## 4. Counsellor-specific patterns explicitly excluded

**OUT OF SCOPE** as visual or behavioral sources.

Do not copy:

- `.counselling-session` tokens, `--counselling-primary`, or any teal theme
- `.counsellor-scrollbar`
- The waiting-list five KPI cards, or the finalize / OT / follow-up metric strips
- Counsellor status tabs or `STATUS_BADGE_MAP`
- Owner column, owner filter, Assign, Reassign, or “You”
- Pre-auth chips and pre-auth actions
- Journey rail and session action bar
- Counselling lifecycle labels
- Waiting-list, finalize, or follow-up column sets
- The counsellor CSS override that forces 44px rows under 1600px
- A second Add Patient modal

Do not add KPI cards to justify visual richness. Census tabs already carry the five branch counts.

---

## 5. Approved D1–D10 decisions

### D1 — Page identity

**APPROVED PRODUCT DECISION.**

One visible page identity: **Patient Directory**.

The top staff navigation title is that identity. The in-page `h1` “Patients” and its subtitle composition are removed. No replacement in-page title is introduced.

The filtered result count may remain as compact feedback on the discovery surface. It is not a second heading and not a page subtitle.

### D2 — Census labels

**PRESERVED CERTIFIED BEHAVIOR.**

Keep these labels exactly:

- All
- Current
- New
- Discharged
- High priority

Do not rename them in this redesign. Do not reinterpret them. Do not change `ApplyTabFilterAsync`, `GetCurrentPatientIdsAsync`, stats calculations, or URL `tab` values.

A future terminology change is a separate product decision.

### D3 — Census counts

**PRESERVED CERTIFIED BEHAVIOR.**

Counts stay branch census totals. They do not follow `q`, advanced filters, Favorites, or Assigned to me.

Do not change the stats API.

Captioning that distinction is **DEFERRED**. It is not part of the first implementation slice.

### D4 — Row information architecture

**APPROVED PRODUCT DECISION.**

Each row is three zones, in this order:

```text
PATIENT IDENTITY  →  CURRENT CONTEXT  →  NEXT ACTIONS
```

Identity, using fields and formatting that already exist:

- Patient name
- MRN, age, and sex through the current `formatPatientHubIdentityLine` (MRN remains the display identifier)

Current context is one cluster, not a second worklist. It may show only values the lookup row already returns. It must not add sources, DTO fields, or a new aggregate, and it must not repeat Patient 360.

The approved desktop columns are:

| Column | Contents | Rule |
|---|---|---|
| Favorite | Existing star | Keep. It is a row control, not a discovery column. |
| Patient | Name link, then the existing identity line | The name is the only direct record link in the row. |
| Context | One cell | Compose existing signals in this order, omitting any that are empty: engagement label, reason for visit, schedule, queue/station, acuity with its existing text label. Do not render care programs, room, phone, or assigned provider as their own columns. |
| Actions | Check-in, then More | See section 8. |

Hide as separate columns, without deleting the DTO fields: selection, Reason / visit, Schedule, Queue / station, Acuity, Highlights, Assigned. Preview continues to read those fields from the existing row and summary.

Do not keep the current wide grid because the DTO still contains those properties.

### D5 — Record / preview interaction model

**APPROVED PRODUCT DECISION.**

| Gesture | Result | Destination |
|---|---|---|
| Row click, and keyboard activation of the row | Preview | Existing `preview` URL on `/dashboard/patients` |
| Patient name | Patient 360 | Existing `/dashboard/patients/{id}` |
| Check-in | Front Office | Existing `/dashboard/frontdesk/check-in?patientId=` |
| More | Secondary navigation only | Existing destinations |
| Preview “open record” control | Patient 360 | Existing profile URL |

Remove from the row:

- The separate **View** action
- **Open full profile**
- **Quick preview**

Do not create routes. Do not change destinations. Do not change preview contents. Do not restore vitals, eye, medications, labs, or `PreviewVitalsGrid`.

### D6 — Counsellor handoff

**APPROVED PRODUCT DECISION** for the only legal shape. **DEFERRED** for the first slice.

If a later slice exposes it, the only allowed shape is a secondary overflow item that calls the existing `buildCounsellorHandoffHref` with `patientId` only.

That item must not create a session, set `CounselorId`, Start, Assign, Reassign, or show counsellor ownership. Waiting list authorization stays on the waiting list.

The first implementation slice does not add this item. The record toolbar keeps the existing Counselor link. Density of the first slice stays at check-in plus the existing book action.

### D7 — Selection bar

**APPROVED PRODUCT DECISION.**

Hide `PatientHubSelectionBar`.

Also hide the row and header selection checkboxes that exist only to feed that bar. Leaving checkboxes without the bar would keep a bulk affordance with no action.

Do not add merge-selected, export-selected, assign-selected, message-selected, or any other bulk workflow.

A future bulk action requires its own product decision.

### D8 — Sidebar location

**PRESERVED CERTIFIED BEHAVIOR** for this redesign. **DEFERRED** as a navigation program.

Leave the sidebar item where it is, under Doctor’s Desk, label Patient Directory, permission `patient.view`.

PD-A remains in force: Patients is conceptually a shared hospital destination. PD-A still does not authorize a menu move. A sidebar move is a separate decision.

### D9 — Health ID search

**DEFERRED DECISION.**

Do not change lookup `q`. Do not add Health ID to list search. Do not change `PatientLookupService` or indexes. Suggest stays as it is, including its current Health ID behavior.

### D10 — `patient.create` visibility

**DEFERRED DECISION.**

Do not change grants, roles, or the Add Patient button rule. The button stays behind the existing `patient.create` check.

The canonical wizard remains `/dashboard/patients/new`.

---

## 6. Target Directory IA

**APPROVED PRODUCT DECISION.**

```text
PAGE CONTEXT
  Top-nav title: Patient Directory
  No in-page title
  Result count: compact feedback only
  Primary: Add Patient
  Secondary: Export, Merge when patient.update, Refresh
  No KPI cards

DISCOVERY TOOLBAR
  Search
  Filters
  Favorites
  Assigned to me
  Applied filter chips
  No second search, and PatientGlobalSearch stays unmounted

CENSUS
  All | Current | New | Discharged | High priority
  Existing predicates, URL values, stats, and branch behavior

PATIENT WORKLIST
  Desktop: dense table, shared worklist density tokens
  Mobile: cards with the same three zones
  Pagination unchanged (25)

PREVIEW
  Existing docked pane or sheet
  Existing boundary
```

Assigned to me stays the certified filter: open visit `AssignedTo` for the current user. The control label stays **Assigned to me**. It is not counsellor ownership.

---

## 7. Target row anatomy

**APPROVED PRODUCT DECISION.** **IMPLEMENTATION SCOPE** for the first slice.

Desktop, left to right:

1. Favorite star, with the current accessible name.
2. Patient. Name is a link to `/dashboard/patients/{id}`. Under it, the current identity line (MRN · age · sex).
3. Context. One cell. Empty signals are omitted. Order when present: engagement label, reason for visit, schedule, queue/station, acuity text plus the existing acuity tint. Color is not the only status cue.
4. Actions. **Check-in**, then **More**.

More contains **Book appointment** only when `appointment.view` is already true, using `/dashboard/appointments/schedule?patientId=`.

More does not contain View, Open full profile, Quick preview, or, in the first slice, Counsellor.

The row click target is preview. The name link, check-in link, favorite control, and More trigger do not also toggle preview (the existing action-area click isolation stays).

Mobile cards use the same order: identity, one context cluster, check-in and More. They do not reintroduce the hidden columns as a stack of labeled fields.

`patients/loading.tsx` matches this anatomy. It does not keep the old skeleton columns (Name, MRN, Age, Phone, Last Visit, Status).

---

## 8. Action hierarchy

**APPROVED PRODUCT DECISION.**

| Level | Action | Owner | Directory behavior |
|---|---|---|---|
| Page primary | Add Patient | MPI wizard | Navigate to `/dashboard/patients/new` with the existing `returnTo` helper. Visible only with `patient.create`. |
| Page secondary | Export CSV | Lookup export | Existing button, `patient.export`. This contract does not change the export contract. |
| Page secondary | Merge | MPI merge | Existing link, `patient.update`. |
| Page secondary | Refresh | Directory | Refetch lookup and stats. |
| Row, identity | Patient name | Patient 360 | The only row link to the record. |
| Row, primary operational link | Check-in | Front Office | Existing href. |
| Row, overflow | Book appointment | Appointments | Existing href, existing permission. |
| Row, deferred overflow | Counsellor | Waiting list | Not in the first slice. See D6. |
| Preview | Open record, check-in, print, continue encounter when a visit id already exists | Unchanged owners | Do not edit the preview action set. |
| Removed | View, Open full profile, Quick preview, selection, bulk bar | — | Do not replace them with new workflows. |

Directory-owned work in this slice is limited to discovery state on the URL (search, filters, census tab, favorite toggle, preview id). Every other action is navigation.

---

## 9. Preview boundary

**PRESERVED CERTIFIED BEHAVIOR.**

Preview stays a context surface: identity, visit context, data-quality warnings, emergency contact, recent visits, and the handoffs it already has.

It is not a clinical chart, Doctor’s Desk, counselling session, or billing workspace.

Do not add vitals, medications, labs, billing, insurance, counselling controls, or clinical chart widgets. Do not remount `PreviewVitalsGrid`.

Dock versus sheet, the 1280px dock threshold, and preview URL behavior stay as implemented.

---

## 10. Visual design standard

**APPROVED PRODUCT DECISION.**

Use the Hospital Portal staff language the directory already uses.

Keep:

- Staff chrome and Inter
- Emerald as the directory primary
- Gray text, white panels, `border-gray-200`, existing radius, existing `shadow-sm`
- Filled primary for Add Patient only
- Bordered secondary actions for Export, Merge, Refresh, and Filters
- Existing census tab treatment
- Existing `Sheet` and `DropdownMenu`
- Existing acuity pills that include words
- Shared worklist density tokens
- Existing focus-visible rings

Do not introduce counsellor teal, a new color, a new theme, new design tokens, a new component library, a new card system, a new page framework, or a KPI system.

---

## 11. Responsive contract

**PRESERVED CERTIFIED BEHAVIOR.**

| Width | Behavior |
|---|---|
| Below `md` | Existing card list, updated to the three-zone hierarchy |
| `md` and up | Table, horizontal scroll if needed |
| 1280px and up, dock mode stored | Existing docked preview |
| Below that | Existing preview sheet (bottom sheet under the current mobile threshold, right drawer otherwise) |
| Filters | Existing single sheet at every width |

Do not import the counsellor 1600px density override. Do not add breakpoints.

---

## 12. Accessibility contract

**APPROVED PRODUCT DECISION.** The first slice closes the known row-keyboard gap and keeps the rest.

Required on the redesigned directory:

- Keyboard-operable row preview (Enter and Space on the row)
- Visible focus
- The patient name remains a real link and its own tab stop
- Check-in remains a real link
- Favorite and More keep accessible names
- Table element, header cells, and `aria-sort` on sortable headers that remain
- Census tablist, `aria-selected`, and the current accessible name “Patient classification”
- Filter and preview sheets keep a title
- Loading, empty, and error remain programmatically exposed (`role="status"` / `role="alert"` as they are today)

Do not invent an interaction widget when `DropdownMenu`, `Sheet`, a link, or a button already exists.

Sortable headers that are removed from the table lose their in-table sort control. Sorting behavior of the lookup API is unchanged; this contract does not add new sort headers for hidden fields.

---

## 13. Duplicate-flow rules

**APPROVED PRODUCT DECISION.**

If the directory does not own the workflow, it navigates. It does not recreate the workflow.

| Action | Owner | Directory |
|---|---|---|
| Add Patient | `/dashboard/patients/new` | Existing navigation |
| Check-in | Front Office check-in | Existing link |
| Book appointment | Appointment scheduler | Existing link |
| Counselling | Waiting list | Not added in the first slice. Later, link only |
| Billing | Billing | No directory action |
| Insurance / CCMS | CCMS | No directory action |
| Surgery / OT | Finalize Surgery / OT | No directory action |
| Follow-up | Follow-up Center | No directory action |
| Clinical documentation | Encounter / Doctor’s Desk | No new directory action. Preview’s existing continue-encounter link stays |
| Patient 360 | Patient record | Name link and the existing preview action |

No second registration form. No second worklist. No ownership controls. No operational state machine on this page.

This contract does not delete `/dashboard/patients/book`, `/admin/patients`, or specialty new-patient entry points.

---

## 14. Certified behavior preservation list

**PRESERVED CERTIFIED BEHAVIOR.** Unchanged by this contract and by the first slice:

- `patient.id` as the identity key
- MRN display semantics, including `formatPatientHubIdentityLine`
- Tenant isolation
- Effective branch resolution
- Null-branch inclusion already implemented on lookup
- Census predicates and census URL values
- Stats as branch totals
- `patient.view`, `patient.create`, `patient.export`, and `patient.update` for merge
- Add Patient wizard and `buildCanonicalAddPatientHref`
- Check-in route and appointment route
- Counsellor handoff function behavior (no session create, no `CounselorId`)
- Preview boundary
- Patient 360 sections, including Timeline and Surgery/OT unavailable states
- Realtime lookup invalidation on the existing queue hub
- Lookup API and lookup DTO
- Sorting and filter semantics on the server
- Page size 25
- Favorites and Assigned to me as existing URL filters
- Sidebar placement

---

## 15. First implementation slice

**IMPLEMENTATION SCOPE.** Not authorized by this file.

Name: Directory chrome and worklist clarity.

Allowed after a separate implementation approval:

| File area | Allowed change |
|---|---|
| `PatientHubPage` | Remove the duplicate heading. Keep the result count as compact feedback. Hide the selection bar and its checkbox state. Do not add KPI cards. Do not mount omnisearch. |
| `PatientHubTable` | Three-zone columns in section 7. Hide the selection column and the redundant columns. |
| `PatientHubMobileCards` | Same hierarchy. |
| `PatientHubRowActions` | Remove View, Open full profile, and Quick preview. Keep Check-in and Book appointment. Do not add Counsellor. |
| Selection call site | Hide the bar and the checkboxes. |
| `patients/loading.tsx` | Match the new columns. |
| Tests and e2e | Update only assertions that named the removed controls or old skeleton columns. |

Still required inside that slice, because they are part of the approved interaction model:

- Row keyboard activation for preview
- Name link isolated from row activation
- Existing permissions on Add Patient, Export, Merge, and Book appointment
- Existing URLs for add, check-in, book, profile, and preview

Not allowed inside that slice: backend, API, DTO, database, permissions, Patient 360, Counsellor, sidebar moves, export behavior, Health ID search, census SQL, stats, route deletion.

---

## 16. Explicit out-of-scope list

**OUT OF SCOPE.**

- Implementing this contract in the same change as the document
- Patient 360 redesign or record permission gate
- Counsellor waiting list, session, finalize, OT, follow-up
- Front Office check-in behavior
- Appointment scheduling behavior
- Billing, CCMS, clinical documentation
- Export row cap and dropped export filters
- Health ID on lookup `q`
- `patient.create` grant or visibility alignment
- Sidebar move out of Doctor’s Desk
- Census relabeling or filter-aware counts
- Bulk actions
- Deleting `/dashboard/patients/book`, `/admin/patients`, or specialty registration links
- New themes, tokens, KPI cards, or a second search
- Database indexes and query rewrites

---

## 17. Acceptance criteria for the implementation slice

A later slice is acceptable only when all of the following are true. They are not claims about the current UI.

1. The staff title reads Patient Directory, and the page no longer renders an `h1` of “Patients”.
2. The result count is present as compact feedback and is not a heading.
3. Add Patient, Export, Merge, and Refresh keep their current permission gates and destinations.
4. There is no KPI row.
5. Search, Filters, Favorites, Assigned to me, chips, and the five census tabs behave as they do now, including URL keys and server predicates.
6. Tab counts still ignore search and advanced filters.
7. Desktop and mobile rows show identity, one context cluster, and actions, and do not show the removed columns as separate fields.
8. The patient name is the only row control that navigates to `/dashboard/patients/{id}`.
9. View, Open full profile, and Quick preview are absent.
10. Row click and Enter/Space on the row open preview. Activating the name, check-in, favorite, or More control does not toggle preview.
11. Check-in still targets `/dashboard/frontdesk/check-in?patientId=`.
12. Book appointment still targets `/dashboard/appointments/schedule?patientId=` and still requires `appointment.view`.
13. The selection bar and selection checkboxes are absent, and no bulk action was added.
14. Preview content and preview actions are unchanged. Clinical mini-chart content stays unmounted.
15. Counsellor assign/start/reassign controls are absent. The counsellor overflow item is absent in this slice.
16. Loading, empty, and error states still exist. The route loading skeleton matches the new columns.
17. Keyboard focus is visible. Sortable remaining headers still expose `aria-sort`. Tabs and sheets keep their accessible names.
18. No counsellor theme classes are added to the directory.
19. Lookup request fields, page size, and branch behavior are unchanged.
20. Patient 360, Counsellor, Front Office, and appointment modules have no production edits in the slice.

---

## 18. UAT gate

**IMPLEMENTATION SCOPE** for the later slice. Not executed by this document.

Manual UAT, desktop and below `md`, after implementation:

- Open `/dashboard/patients` with `patient.view` and a selected branch.
- Confirm one title: Patient Directory.
- Search, apply a filter, clear a chip, toggle Favorites and Assigned to me, and switch each census tab. Confirm the list and the URL change, and that tab badges do not shrink to the filtered total.
- Open preview from the row with pointer and with Enter/Space.
- Open Patient 360 from the name only.
- Follow Check-in and confirm the Front Office URL contains `patientId`.
- With `appointment.view`, confirm Book appointment is in More and uses the schedule URL. Without it, confirm the item is absent.
- With and without `patient.create` and `patient.export`, confirm Add Patient and Export visibility.
- Confirm Merge only with `patient.update`.
- Confirm preview still shows identity, visit context, warnings, and recent visits, and does not show a vitals grid.
- Confirm no selection bar, no View, no Quick preview, no counsellor ownership actions, no KPI cards.
- Confirm empty, loading, and error presentations on the worklist.

Automated tests in that slice must be updated only where they asserted removed labels, then run. This document does not run them.

---

## 19. Future deferred decisions

**DEFERRED DECISION.** Each needs its own approval. None are implied by approval of this file.

| ID | Deferred item | What stays until then |
|---|---|---|
| D3 caption | Wording that branch tab counts are not the filtered total | Current badges, unlabeled as a new caption |
| D6 exposure | Counsellor overflow link via `buildCounsellorHandoffHref` | Record toolbar link only |
| D8 move | Sidebar group other than Doctor’s Desk | Current menu placement |
| D9 | Health ID inside lookup `q` | Current list search and current suggest |
| D10 | Whether Add Patient visibility must match the 2026-10-01 role-grant list | Current `patient.create` button gate |
| Export | Full filtered export and an explicit cap instead of the silent 100-row clamp | Current export endpoint |
| Bulk | Any multi-select action | Bar and checkboxes hidden, not redesigned |
| Extra routes | Retire `/dashboard/patients/book` or specialty `?action=new` links | Those routes remain |
| Record gate | `patient.view` on `/dashboard/patients/[id]` | Current record route |

---

## 20. Risks

- Removing View and the selection bar will fail current Vitest and Playwright assertions until those tests are updated in the implementation slice. That update is part of the slice, not of this document.
- Hiding sort headers for schedule, queue, and acuity removes those visible sort controls. The API sort parameters remain. If staff rely on those header sorts, that is a usability change bounded by section 7, not a server change.
- Tab counts will still disagree with a filtered list. D3 captioning was deferred, so the first slice must not invent a sentence that redefines the counts.
- Export can still return a partial file. The first slice must not restyle Export into a claim that the file is the full filtered census.
- Putting every context field into one cell can recreate the wide-grid density inside a single column. The omit-when-empty rule and the column removal are what keep the row scannable.
- Keyboard row activation inside a table must not swallow the name link. The acceptance criteria require both paths.
- A later D6 slice that adds Assign, Start, or a session POST would violate this contract even if the first slice was correct.

---

## Approval line

| | |
|---|---|
| Decision status | **APPROVED PRODUCT DECISION** for D1, D4, D5, D7, and the D6 rule. D2, D3, and D8 stay certified as they are. D6 exposure, D3 caption, D9, and D10 stay deferred. |
| Implementation authorization | **NOT GRANTED** |
| Next gate | Review and approve this contract, then issue a separate implementation prompt for the first slice. |
