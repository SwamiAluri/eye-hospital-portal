# Patient Directory — Master Forensic Discovery and Redesign Audit

**Status:** Read-only. No frontend, backend, database, API, permission, route, navigation, component, or test changes were made for this audit.

**Date:** 29 September 2026

**Scope:** Live implementation after Patient Directory Slices 1–8 (stabilization and measurement). This document starts the redesign program. It does not approve implementation.

**Evidence classes used below**

| Label | Meaning |
|---|---|
| EXISTING FACT | Proven from current source, or from the Slice 8 read-only measurement |
| OBSERVED PROBLEM | Proven mismatch, dead path, or misleading UX |
| RECOMMENDATION | Design direction. Not a requirement until accepted |
| PRODUCT DECISION REQUIRED | Repository does not define the intended product behavior |
| ENGINEERING DECISION REQUIRED | Implementation choice after a product decision, or a proven contract defect |
| SECURITY DECISION REQUIRED | Authorization, PHI, or tenant/branch exposure |
| DEFERRED | Leave until a later redesign phase |

Slices 1–7 are treated as accepted constraints unless a product decision explicitly reopens them. Slice 8 is measurement evidence only.

Historical documents that are **not** the live system:

- `PATIENT_DIRECTORY_IMPLEMENTATION_PLAN.md` describes `PatientDirectoryHub.tsx` and a 14-tab modal. That component is not the live page.
- `apps/hospital-portal-web/docs/patient-ui-component-registry.md` still describes preview clinical sub-tabs. Slice 4 removed that preview content. The registry is stale.
- `apps/hospital-portal-web/docs/patient-hub-implementation-spec.md` is a build plan, not certified behavior.

---

## 1. Executive summary

Patient Directory is the staff route `/dashboard/patients`. It renders `PatientHubPage`. The sidebar label is **Patient Directory**, under the **Doctor's Desk** section, gated by `patient.view`. Opening a patient goes to `/dashboard/patients/[id]`, which renders `PatientRecordPage`. That record is a second product surface, not the directory list.

The directory already behaves as a **branch-scoped patient census and discovery worklist**. It is not a doctor chart, a front-office queue, a counsellor waiting list, a billing ledger, or an insurance desk. It still contains controls and a record shell that reach into those domains.

**Why it exists (from the implementation, not from a product charter).** The repository does not contain a product decision that states the purpose. What the code does is: find patients for the signed-in user’s effective branch, classify them by engagement and registration age, and hand off into modules that already own the next action. **PRODUCT DECISION REQUIRED** before a redesign freezes that purpose.

**Who can use it today.** Anyone whose role includes `patient.view` and who can select an authorized branch. Counsellor least-privilege seeding includes `patient.view` and `patient.create` (`PermissionSeeder` / migration `191_counsellor_patient_workflow_rbac.sql`) and does not include `patient.update`. The nav test `counsellor-rbac-nav.test.ts` expects a counsellor with `patient.view` to see Patient Directory inside Doctor’s Desk. That is evidence the placement is a navigation accident, not proof the directory is doctor-only.

**Certified slice outcomes that a redesign must not silently undo**

| Slice | What the code now does |
|---|---|
| 1 | Directory URL, UI filters, and `GET /api/patients/lookup` agree |
| 2 | Lookup export uses the same effective-branch resolution as lookup; route actions gate `patient.view` / `create` / `update` / `export` where those slices required it |
| 3 | Check-in and counsellor actions are navigation handoffs. `patient-handoff.ts` states they do not create a visit, a counselling session, or a `CounselorId` |
| 4 | Preview is identity, visit context, data-quality, emergency contact, and recent visits. Clinical mini-panels are not in `PatientPreviewPanel` |
| 5 | Fourteen record tab keys stay in the type union and are hidden from the shell (`HIDDEN_FROM_RECORD_SHELL`) |
| 6 | Examination caller contract repair. Tab comment still says examinations stay hidden because of that history |
| 7 | Patient update keeps the stored MRN. `GenerateMedicalRecordNumber()` runs on create. Index `ix_patients_tenant_mrn` is not unique |
| 8 | On the development database, SQL execution was sub-millisecond to a fraction of a millisecond. Wall time was round trips |

---

## 2. What Patient Directory currently is

EXISTING FACT. It is a branch-required discovery page:

1. Resolve an authorized branch (`useBranchContext` / `ResolveEffectiveBranchAsync`).
2. List patients with `GET /api/patients/lookup` (`patient.view`).
3. Show census counts with a second call `GET /api/patients/lookup/stats` (`branchId` only).
4. Enrich each page of rows with active operational context from `PatientEngagementService` (open visit, queue, IP journey, counselling, pre-authorization, acuity, wait, station, assigned provider name).
5. Preview a selected row without leaving the list.
6. Navigate to the record, front-desk check-in, appointment schedule (if `appointment.view`), print summary, or (from the record toolbar, not the directory row) the counsellor waiting list.

The page title in the hub is **Patients**, not “Patient Directory” (`PatientHubPage.tsx`). The sidebar label is Patient Directory.

Authoritative list identity is the auth-service `Patient` row: `Id` (GUID), `TenantId`, optional `BranchId`, `MedicalRecordNumber`, demographics, `Status` (default `"Active"`), `DeletedAt`. The lookup base query uses tenant, `DeletedAt == null`, and `BranchId == null || BranchId == selectedBranch`. It does **not** filter on `Patient.Status`.

---

## 3. What it currently is not

EXISTING FACT, from code boundaries:

- It is not the Doctor’s Desk examination workspace (`/dashboard/doctors-desk`, permission `CLINICAL:EXAMINATION:VIEW`).
- It is not the front-office queue (`/dashboard/frontdesk/queue`) or the check-in form. Check-in is a link.
- It is not the counsellor waiting list or session. Counsellor handoff is a link. Directory code does not set `CounselorId`.
- It is not billing (`OpdBill`) or CCMS. Insurance on the record is a tab that calls patient-insurance APIs. Census “insurance” engagement is an open `InsurancePreAuthorization`, not a claim.
- It is not an ownership work-allocation system in the counsellor sense. “Assigned to me” means an open `Visit.AssignedTo` equals the current user. It does not mean counsellor ownership.
- It is not the patient portal (`/patient/*`, `/dashboard/patient-portal`).
- It is not `/admin/patients`, which keeps a local mock array.

The record route currently **hosts** clinical documentation (`EncounterPage` can save encounter documentation), billing and insurance tabs, and scheduling. That hosting is a boundary problem. Those capabilities remain owned by their modules even when a tab or encounter page is mounted under `/dashboard/patients`.

---

## 4. Complete route map

Parent layouts for `/dashboard/patients/*`:

| Layer | File | Behavior |
|---|---|---|
| Root | `src/app/layout.tsx` | Theme, React Query, auth |
| Dashboard | `src/app/dashboard/layout.tsx` | Token gate, `ProtectedRoute` with **no** permission, sidebar, top nav |
| Patients | `src/app/dashboard/patients/layout.tsx` | `PatientWorkspaceProvider` only |

No `next.config` redirect for these paths was found. No `error.tsx` under `dashboard/patients`.

| Route | Component | Permission on the page | Purpose | Remain / move / merge / deprecate |
|---|---|---|---|---|
| `/dashboard/patients` | `page.tsx` → dynamic `PatientHubPage` (`ssr: false`) | `ProtectedRoute` `patient.view` | Directory | Remain as the discovery surface. **PRODUCT DECISION REQUIRED** on nav placement |
| loading | `patients/loading.tsx` | n/a | Skeleton whose column labels (Name, MRN, Age, Phone, Last Visit, Status) do **not** match the live table | Replace when the table is redesigned |
| `/dashboard/patients/[id]` | `PatientRecordProvider` + `PatientRecordPage` | **No** `patient.view` on this page. Dashboard auth only | Patient record shell. `?tab=` | Remain as record. **SECURITY DECISION REQUIRED** on the missing page permission |
| `/dashboard/patients/new` | `NewPatientPage` full registration | **Not found** on the page | `patientApi.create`, then profile. Add Patient on the hub opens `PatientFormModal` instead | **PRODUCT DECISION REQUIRED.** Two create UIs exist |
| `/dashboard/patients/merge` | `PatientMergePage` | Client `patient.update`. API `patient.update` | Merge duplicate into primary | Keep out of the daily list. Admin/MPI action |
| `/dashboard/patients/book` | `UnifiedAppointmentBooking` | **Not found** | Booking page. Row “Book appointment” does **not** use this route; it uses `/dashboard/appointments/schedule?patientId=` | **DEPRECATE candidate.** Inbound production link was not found |
| `/dashboard/patients/[id]/encounter/[visitId]` | `EncounterPage` | **Not found** | Clinical documentation. Save exists (`saveNow`) | **PRODUCT DECISION REQUIRED.** This is a clinical workspace mounted inside the patient route |
| `/dashboard/patients/[id]/summary/print` | `PatientPrintSummaryPage` | **Not found** | `window.print()` of summary | Keep as a print surface, not a directory feature |

Query parameters the hub actually reads (`parseLookupUrlParams`): `tab`, `q`, `page`, `sortBy`, `sortDir`, `favorites`, `assigned`, `engagementTypes`, `programCodes`, `patientTypes`, `gender`, `mrn`, `phone`, `name`, `diagnosis`, `providerId`, `departmentId`, `wardName`, `dobFrom`, `dobTo`, `appointmentFrom`, `appointmentTo`, `admissionFrom`, `admissionTo`, `preview`.

`?action=new` (`specialty-clinics/cataract`) and `?id=` (`PatientFormModal`) are **not** parsed by the hub.

Other patient routes that are not this directory: `/admin/patients` (mock), `/dashboard/patient-portal` (simulated comment in source), `/patient/*` (consumer portal).

Sidebar entry: `sidebar-menu-sections.tsx`, section **Doctor's Desk**, label **Patient Directory**, href `/dashboard/patients`, `requiredPermission: 'patient.view'`. Siblings: Doctor’s Desk (`CLINICAL:EXAMINATION:VIEW`), Junior Doctor (`clinical_examination.view`), Advanced Services (`/dashboard/telemedicine`, permission null).

`DashboardRouter.tsx` does not land any role on `/dashboard/patients`. Doctors land on `/dashboard/doctors-desk`. Counsellors land on the waiting list. Fallback is front desk.

---

## 5. Complete UI inventory

Live directory composition (`PatientHubPage`): sticky header, classification tabs, search, filter toggles, chips, table or mobile cards, selection bar, advanced filter Sheet, add-patient modal, docked preview or drawer.

| Element | What it displays | Why it exists in code | Data / API | Useful now | Duplicates | Redesign |
|---|---|---|---|---|---|---|
| Header title “Patients” | Count or “Updating…” | Page chrome | Lookup `totalCount` | Yes | Label disagrees with sidebar | **PRODUCT DECISION REQUIRED** on the name |
| Classification tabs | All, Current, New, Discharged, High priority + counts | Census | `GET /patients/lookup` `tab`; counts from `lookup/stats` | Yes, if names match predicates | Stats ignore the search and filters the list is using | Keep as census only after naming decision |
| Search autosuggest | Name, MRN, phone, email placeholder | Find a person | `GET /patients/suggest` when length ≥ 2; Enter also sets `q` | Yes | Suggest and list search are two matchers | Keep. See Part 5 |
| Favorites toggle | Starred rows for the current user | Personal bookmark | `favoritesOnly` | Bookmark, not a queue | Not counsellor “my work” | Remain a saved filter. Do not brand it as ownership |
| Assigned to me | Open visits where `Visit.AssignedTo` is the user | Provider work filter | `assignedToMe` | Only for visit assignment | Not counsellor assignment | **PRODUCT DECISION REQUIRED** whether this belongs on a shared directory |
| Filters button | Opens Sheet | Advanced constraints | URL state → lookup query | Yes | Some fields overlap quick search | Keep as advanced |
| Filter chips | Active advanced filters | Removable URL state | Same | Yes | `q` has no chip | Add search chip only if UX review wants it |
| Branch | Empty state or TopNav select | Required scope | `useBranchContext` | Yes | Not in the hub toolbar when a branch is already selected | Keep branch as context, not a table column |
| Table | Favorite, patient, reason/visit, schedule, queue/station, acuity, highlights, assigned, actions | Operational census row | Lookup row DTO from `MapRow` | Mixed | Queue/acuity duplicate live desks | **PRODUCT DECISION REQUIRED** which columns stay on discovery vs stay in the owning desk |
| Row checkbox | Local `Set` | Selection | Client only | Weak | Selection bar only clears | Hide or keep only if a real bulk action is approved |
| Selection bar | “N selected”, Clear | Incomplete bulk UI | None | No operational action | — | **HIDE** until a product decision names a bulk action |
| Mobile cards | Same identity and row actions | Below `md` | Same row | Yes | — | Keep a card, do not drop identity or handoffs |
| Preview | See Part 7 | Context before the record | Summary + recent visits | Yes, after Slice 4 | — | Remain a Sheet/split, not a chart |
| Add Patient modal | Registration | Create | `POST /patients` via form | Yes | Competes with `/patients/new` | One create path. **PRODUCT DECISION REQUIRED** |
| Export CSV | Download | `patient.export` | `GET /patients/lookup/export` | Partial | Export drops some filters the list applies | Fix contract in a backend slice. Do not redesign around the bug |
| Merge link | `/dashboard/patients/merge` | `patient.update` | Merge API | MPI admin | — | Keep off the primary task row |
| Refresh | Refetch lookup + stats | Manual | Two queries | Yes | SignalR also refetches | Keep |
| Empty branch | Select or none | Guard | Branch context | Yes | — | Keep |
| Loading skeleton | List pulse | Fetch | — | Yes | Skeleton columns are wrong | Align with the real columns |
| Error / empty table copy | In `PatientHubTable` | Failure and zero rows | Query state | Yes | — | Keep explicit empty and error |
| Omnisearch Ctrl+K | `PatientGlobalSearch` | Built, not mounted | `GET /patients/omni-search` | Dead in the live shell | Second search | **HIDE / DEPRECATE** until a global search decision |
| Saved filters / recent patients | Inside the filter Sheet | Convenience | Recent-views API | Contextual | — | Remain inside advanced search, not the primary toolbar |
| Acuity dot/badge | `low` / `medium` / `high` / `critical` | `AcuityScoringService` | Engagement bundle | Misleading if read as triage protocol | Doctor desk / queue priority | **PRODUCT DECISION REQUIRED** |
| Highlights pills | Program codes + engagement labels | Summarize why the patient is “active” | Engagement bundle | Yes as context | Repeats counsellor/IP/queue state | Keep short labels. Do not add workflow buttons |
| Assigned column | Provider name and role from the open visit | Display | Engagement bundle | Display only. Does not assign | Counsellor ownership | Do not add assign/reassign here |
| Favorite star | Toggle | `PUT /patients/{id}/favorite` with `patient.view` | `patient_favorites` | Personal | — | Keep. No audit of clinical state |

Mobile: cards replace the table under the `md` breakpoint (`PatientHubMobileCards`). Preview uses a drawer when the split pane cannot dock.

Accessibility that exists: classification `role="tablist"`, search label via placeholder (weak), row menu `aria-label="More actions"`, favorite `aria-label`, preview close/expand/call labels, branch `<select aria-label="Select branch">`. Dialogs that use Radix (`DropdownMenu`, filter `Sheet`) get focus behavior from those primitives. The preview drawer and docked pane were not re-tested in a browser for this audit. **Not a verification of WCAG.** Slice 4/5 UAT was prior work; this audit did not re-run the browser.

---

## 6. Complete tab inventory

### Directory classification (not record tabs)

See Part 6. Only five tabs. Favorites and Assigned to me are toggles.

### Patient record shell (visible)

Groups in `patient-record-tabs.ts`:

| Group | Visible | Overflow (More) |
|---|---|---|
| Clinical | Overview, Vitals, Medications, Lab results, Imaging | Medical records, Allergies, Prescriptions, Optical, Notes, Communications |
| Admin | Encounters, Visits, Scheduling, Consents | none |
| Billing & pathways | Billing, Insurance | none |

Record tabs have **no permission field**. Check-in gate (`patient-record-gate.ts`) blocks Vitals, Medications, Lab results, Examinations, and Prescriptions unless the client believes the patient is checked in, or a role string in `OVERRIDE_ROLES` grants an override. The override writes `console.log('EMERGENCY OVERRIDE LOGGED:'…)` and local state. It is not an API audit. **SECURITY DECISION REQUIRED.**

| Tab | In shell | Belongs in record vs owning module | Evidence |
|---|---|---|---|
| Overview | Yes | Record summary | `PatientRecordOverview` widgets. “Open” documents points at hidden `documents` and is rewritten to overview |
| Vitals | Yes, gated | Clinical module / encounter | Gate is client-side |
| Medications | Yes, gated | Pharmacy/EHR. Tab component is `PharmacyTab` | Name and component disagree |
| Lab results | Yes, gated | Laboratory | Check-in gate |
| Imaging | Yes | Diagnostics. Button “Open in Imaging Module (coming soon)” is disabled | Placeholder action inside a visible tab |
| Medical records | Overflow | Record history | `MedHistoryTab` |
| Allergies | Overflow | MPI/clinical | `patient-allergies` API, `patient.view` / `patient.update` |
| Prescriptions | Overflow, gated | Clinical / pharmacy | Distinct from medications |
| Optical | Overflow | Optical POS is a different module. This tab calls `opticalOrdersApi` | Boundary is unclear. **PRODUCT DECISION REQUIRED** |
| Notes | Overflow | Could be clinical notes or counselling notes. API is `patient-notes` | Not counsellor session notes |
| Communications | Overflow | `patient-communications` | Not the communications module |
| Encounters | Yes | `TimelineTab` | Naming overlaps visits and the encounter route |
| Visits | Yes | `VisitsTab` | Operational visit list |
| Scheduling | Yes | Appointments module | Toolbar Book/Reschedule/Cancel stay on this tab when opened from the record |
| Consents | Yes | `patient-consents` | Record-appropriate |
| Billing | Yes | Billing module | **PRODUCT DECISION REQUIRED** whether any charge UI stays here |
| Insurance | Yes | CCMS / patient insurance policy rows | Two insurance concepts exist (policy table vs pre-auth). See Part 10 |

### Hidden from the shell (still in the union; deep links rewrite to overview)

`eye_history`, `examinations`, `diagnoses`, `documents`, `admissions`, `counseling`, `surgery`, `preop`, `procedures`, `queue`, `referrals`, `feedback`, `portal_access`.

Several of those components are still Coming Soon badges (Counseling, Referrals, Procedures, Pre-op, Feedback, Admissions). Queue and Portal buttons have no `onClick`. Surgery queries by patient **name** and the shell does not pass `patientName`, so the list stays empty. Examinations remain hidden per the Slice 6 comment.

**RECOMMENDATION.** Do not resurrect hidden placeholder tabs inside the record. Handoff to the module that already owns the workflow. Deleting components is a later cleanup decision, not this audit.

---

## 7. Complete action inventory

Directory and preview actions are navigation or favorites, except create, export, merge, and favorite persistence.

| Action | Where | Permission | Effect | State mutation from directory |
|---|---|---|---|---|
| Add Patient | Hub | `patient.create` client and `POST /patients` server | Opens `PatientFormModal`. Toast “Patient registered”. Stays on the hub | Creates a patient. MRN generated server-side. Duplicate check at confidence ≥ 0.95 returns 400 |
| Export CSV | Hub | `patient.export` | Blob download | Read. Audit `LogDataAccessAsync` on export |
| Merge | Hub link and duplicate banner | `patient.update` | `POST /patients/{primaryId}/merge` after confirm | MPI merge. Not a list gesture |
| Refresh | Hub | `patient.view` already required to see the page | Refetch | None |
| Favorite star | Row | `patient.view` on `PUT /patients/{id}/favorite` | Insert/delete `patient_favorites` | User bookmark only. Does not check that the patient exists |
| View / name | Row | none beyond page | `/dashboard/patients/{id}` | None |
| Check-in | Row, preview | **No client permission** | `/dashboard/frontdesk/check-in?patientId=` | **None in directory code.** Visit creation happens in Visits check-in if the user completes front desk |
| Book appointment | Row menu | `appointment.view` | `/dashboard/appointments/schedule?patientId=` | None until the schedule page saves |
| Quick preview | Menu / row click | none | Sets preview | PHI log `POST /patients/{id}/phi-access` and recent-view POST |
| Continue encounter | Preview and record header | none in the preview | `/dashboard/patients/{id}/encounter/{assignedVisitId}` only if the id exists | Navigation. `EncounterPage` can save documentation after arrival |
| Print | Preview, record, toolbar | none on the page | Print route | Read |
| PDF | Record | UI does not check `patient.export`. API requires it | `GET /patients/{id}/summary/export` | Read + audit |
| Counselor | Record More menu | not gated in the toolbar | Waiting list `?patientId=` because `onOpenCounseling` is not passed | Navigation. `resolveCounsellorSessionHandoff` opens one existing session only when exactly one session matches. It does not start a session |
| Pre-auth | Record menu | none in UI | Insurance tab | Not a CCMS case create |
| Queue status | Record menu | none | `/dashboard/frontdesk/queue` | None |
| Reschedule / Cancel appt | Record menu | none | Stay on scheduling tab | Does not cancel in the menu handler |
| No-show | Record menu | none | Modal: “This action is coming soon…” | **None. Dead** |
| Send SMS | Record menu | none | Modal says communications are not connected | **None. Dead** |
| Call (toolbar) | Record menu | none | Coming soon modal. Header phone is a real `tel:` | Menu call is dead. Header `tel:` is not a logged communication |
| Upload doc | Record menu | none | Pushes `?tab=documents`, which the shell rewrites to overview | **Broken** |
| Emergency | Record toolbar | none | Check-in URL plus `emergency=1` | Navigation only |
| Check-in gate override | Record | Client role-name set | Local override | **Not an audit record** |
| Clear selection | Selection bar | none | Clears a client `Set` | None |
| Customize chart layout | Overview | none | `ChartLayoutEditor` | Client layout. Not clinical data |

**No assign, reassign, or queue-transition actions exist on the directory row.** That is important. Do not add them in a visual redesign without a product decision. Doing so would copy counsellor/front-office ownership into the directory.

Bulk actions beyond clear: **not implemented**.

---

## 8. Search and filter architecture

Path: URL (`patient-lookup-filters.ts`) → `buildPatientLookupQueryParams` → `GET /api/patients/lookup` → `PatientsController.LookupPatients` → `PatientLookupService.LookupAsync`.

Pipeline order: base patients → `q` → advanced filters → tab → assigned-to-me → favorites → engagement types → program codes → patient types → count → page → engagement enrichment for the page.

Base:

```text
TenantId match AND DeletedAt == null AND (BranchId == null OR BranchId == selected branch)
```

Page size is clamped 1–100. The hub requests 25. Export uses page size 5000 through `LookupAsync`, so it inherits the 100 clamp. **ENGINEERING DEFECT.** The export method sets `PageSize = 5000`, then `LookupAsync` clamps to 100. CSV cannot contain the filtered population beyond 100 rows. This was visible in source (`ExportCsvAsync` and `Math.Clamp(query.PageSize, 1, 100)`). Slice 8 did not measure export.

| Filter | UI | Bound | Applied | Match |
|---|---|---|---|---|
| `q` | Yes | Yes | Yes, if length ≥ 2 | Partial contains on first+last, MRN, phone, email. Shorter `q` is ignored and the list stays unfiltered |
| Name | Advanced | Yes | Yes | Partial full name. No minimum |
| MRN | Advanced and inside `q` | Yes | Partial lowercased `MedicalRecordNumber` | Not exact. Not unique in the database |
| Phone | Advanced and inside `q` | Yes | `ContactNumber` contains. Not lowercased | |
| Email | Placeholder on search only | **No dedicated parameter** | Only inside `q` | |
| Gender | Advanced | Yes | Exact, case-insensitive | |
| DOB range | Advanced | Yes | Inclusive on `DateOfBirth` | |
| Diagnosis | Advanced | Yes | Active `patient_diagnosis` joined to `diagnosis_code`, partial code or description | Subquery has **no tenant or branch filter** |
| Provider | Advanced | Yes | Open visit `AssignedTo` or `ConsultantId` | **No tenant or branch** on the visit subquery |
| Department | Advanced | Yes | Any non-deleted visit with that department, **including completed** | **No tenant or branch** |
| Ward | Advanced | Yes | `bed_inventory.WardName` contains, any bed with a patient, not only occupied | **No tenant or branch** |
| Appointment dates | Advanced | Yes | `appointment` date range, status ≠ `Cancelled` (Completed still included) | **No tenant or branch** |
| Admission dates | Advanced | Yes | Undischarged `patient_journey.CreatedAt` in range | **No tenant or branch** |
| Engagement types | Advanced | Yes | In-memory match on bundles: opd, queue, ip, counselling, billing, camp, insurance, ccms if sent | Loads **all** branch bundles when the id list is empty |
| Program codes | Advanced | Yes | Department code → open visits in those departments | Tenant and exact branch on visits. Department catalog itself is not branch-scoped in this query |
| Patient types | Advanced | Yes | Non-terminal counselling `PatientType` | Status literals `Completed` / `Cancelled` / `NoShow` are case-sensitive here, unlike census sets that use case-insensitive comparison |
| Favorites | Toggle | Yes | `patient_favorites` for tenant+user | Favorite row has no branch |
| Assigned to me | Toggle | Yes | Open visit, tenant, exact branch, `AssignedTo == user`. `ConsultantId` is not used | Different rule from the provider filter |

Suggest (`GET /patients/suggest`, minimum 2 characters in the UI) is a different ranker (`PatientLookupRanking`). It treats a normalized MRN and `HealthId` as the same needle first, then contains. Census `q` does not search `HealthId`.

**Export drop (EXISTING DEFECT).** `ExportCsvAsync` copies `q`, tab, favorites, assigned, engagements, programs, patient types, gender, MRN, phone, DOB, and appointment range. It does **not** copy name, diagnosis, provider, department, ward, or admission range. Those filters change the list and not the CSV.

**Stats ignore filters.** Tab badges are branch-wide census counts, not “count of the current search”.

**Filters that work for the list:** the table above, within the tenant hole on advanced subqueries.

**Filters shown but not a census tab:** favorites, assigned to me.

**Backend concepts not exposed as their own controls:** `Patient.Status`, `HealthId` as its own field (suggest only), email as its own advanced field.

**SECURITY:** diagnosis, provider, department, ward, appointment, and admission subqueries are not tenant-scoped in `ApplyAdvancedFilters`. **SECURITY DECISION REQUIRED** before relying on them in a redesign. Do not treat client filters as isolation.

---

## 9. Census semantics

Counts and membership are **not** `Patient.Status`.

| UI | API `tab` | Kind | Predicate |
|---|---|---|---|
| All | `all` (sent even when the URL omits `tab`) | Full branch census, including null `BranchId` | Base query only |
| Current | `current` | Cross-module active census | Patient id ∈ `GetCurrentPatientIdsAsync` |
| New | `new` | Registration age | `Patient.CreatedAt >= UtcNow.AddDays(-30)`. No visit rule |
| Discharged | `discharged` | Completed-visit census minus anyone still current | Not in the current set, and a visit at this tenant and **exact** branch with `DeletedAt == null` and `Status == "completed"` (exact string, not the case-insensitive set used for “current”) |
| High priority | `high_priority` | Derived acuity over the engagement universe | `LoadForPatientsAsync` with an empty id list, then keep bundles whose `ClinicalAcuity` is `high` or `critical`, or whose `QueuePriority` is emergency or urgent |

**Current membership (union).** All of these queries run. Billing, camp, and CCMS do not add patients beyond the sets that already include them, but they still run.

| Source | Entity / table | Branch | Rule |
|---|---|---|---|
| Open visit | `Visit` / `visits` | exact | Not deleted. Status not in {completed, cancelled} case-insensitive |
| Queue | `QueueItem` / `queue_item` | exact | Status in {waiting, called, in-progress} |
| IP | `PatientJourneyReadOnly` / `patient_journey` | **null or match** | Not deleted, `!IsDischarged` |
| Counselling | `CounselingSession` / `counseling_sessions` | **null or match** | Not deleted. Status not in {completed, cancelled, noshow} case-insensitive |
| Insurance | `InsurancePreAuthorization` | exact | Status not in {approved, rejected, cancelled, closed, denied} |
| Billing station | open visits whose `CurrentStation` contains `"billing"` | exact | Subset of open visits |
| Camp | counselling `PatientType == "Camp"` and `SessionDate >= UtcNow.Date` and non-terminal | null or match | Subset of counselling except the date cut |
| CCMS marker | counselling `PackageAddonsJson` contains `ccmsCoverageCaseId` and non-terminal | null or match | Subset of counselling. Not the CCMS case table |

**High priority is not “current plus a flag”.** It scores bundles loaded for the whole branch engagement universe, then acuity (`AcuityScoringService.Compute`): emergency visit → critical; critical note, urgent IP state, severe allergy, or abnormal vitals → high; queue priority emergency/urgent → high. Default when no bundle is `low` (`MapRow`).

**Null branch.** Patients with `BranchId == null` appear in **every** selected branch’s All list. IP and counselling with null branch also enter Current for every selected branch. Visits and queues do not use the null-branch rule; they require an exact branch.

**Tenant.** Base patient query and the engagement id queries filter `TenantId`. Several advanced filters do not (Part 8).

**What each tab is not**

| Tab | Is not |
|---|---|
| All | Not “every status”. Deleted patients are excluded. Inactive `Patient.Status` is included if not soft-deleted |
| Current | Not “in clinic today”. A non-terminal counselling session or an undischarged journey with a null branch qualifies |
| New | Not “new visit” and not “first visit today” |
| Discharged | Not IP discharge. It is “has a completed visit here and is not in the current union”. A patient discharged from IP who still has an open counselling session stays out of Discharged because they are still current |
| High priority | Not a clinical triage protocol and not the front-office emergency queue by itself |
| Favorites | Not a census tab |
| Assigned to me | Not a census tab and not counsellor ownership |

**OBSERVED PROBLEM.** The words Current, Discharged, and High priority will be read as clinical or administrative states. The code defines them as cross-module projections. Renaming requires **PRODUCT DECISION REQUIRED**. Do not change the predicates inside a visual redesign.

Slice 8 on the development database (`hospitalportal`, PostgreSQL 17.11, largest measured branch 103 of 361 non-deleted patients): stats returned `all=103`, `current=0`, `new=0`, `discharged=0`, `high=0`. That environment did not exercise non-empty current or high-priority membership. Definitions above are from source. Emptiness is an environment fact, not proof the predicates are unused in other data.

---

## 10. Preview architecture

Trigger: row click or Quick preview. URL `preview=` is local to the hub (`PatientHubPage`). It is not a lookup filter.

Component: `PatientPreviewPanel` inside `PatientPreviewSplitPane` when docked, otherwise `PatientPreviewDrawer`.

Data:

- Row already on screen (lookup DTO).
- `GET /patients/{id}/summary?branchId=` via `usePatientSummaryQuery` (`skipPhiAudit: true` on the preview call site).
- `GET /patients/{id}/visits/recent`.
- `POST /patients/{id}/phi-access` with reason `preview` (errors swallowed).
- `POST /patients/{id}/recent-view`.

Shown: name, age, gender, MRN, phone `tel:`, IP badge, acuity, engagement pills, data-quality banner, visit info card, emergency contact, recent visits (token, station/status, check-in time).

Actions: Continue encounter (only with `assignedVisitId`), Open full profile, Check in, Print, expand, close, dock toggle.

Not shown (Slice 4): vitals grid as a chart, medications, labs, exam findings. `PreviewVitalsGrid.tsx` still exists in the tree. It is not mounted by `PatientPreviewPanel`. **KEEP the unmounted file until a cleanup phase. Do not remount it in a redesign without a product decision.**

Focus and keyboard: close button has an accessible name. This audit did not browser-test focus trap. The filter UI uses Radix Sheet. The preview shell should be checked against Radix Sheet in the redesign rather than a custom overlay.

**RECOMMENDATION (not a requirement).** Preview should answer “who is this, why are they in this census, what is the safe next handoff?” It should not document, bill, or counsel. The current footer already matches that boundary except Continue encounter, which jumps into a writable clinical page. Whether that link stays is **PRODUCT DECISION REQUIRED**.

---

## 11. Patient record architecture

`/dashboard/patients/[id]` is a separate surface.

Header: back to `/dashboard/patients`, identity from summary, phone, previous/next from saved navigation, print, PDF, continue encounter, compact `QuickActionsToolbar`.

Data spine: `PatientRecordProvider` loads summary and recent visits for the effective branch. It does not call `patientApi.getById` (the mock fallback).

**What the repository currently puts in the record**

- Identity summary and overview widgets.
- Clinical views that are either gated (vitals, medications, labs, prescriptions) or overflow (allergies, medical history, optical orders, notes, communications).
- Administrative lists: encounters timeline, visits, scheduling, consents.
- Financial/coverage views: billing tab, insurance tab.
- A hidden set of operational workflows (counselling, surgery, admissions, queue, referrals) that Slice 5 removed from navigation because they were placeholders or owned elsewhere.

**RECOMMENDATION.** The record should remain the longitudinal patient view: identity, demographics, consents, and read-oriented history that other modules do not already present as the work surface. Operational work stays in the owning module:

| Concern | Owning module already in this platform | Record role |
|---|---|---|
| Check-in and queue | Front office | Handoff |
| Examination | Doctor’s Desk / optometry examination routes | Handoff. Do not revive the hidden examinations tab as the exam workspace |
| Counselling | Counsellors desk | Handoff. Hidden Counseling tab is Coming Soon |
| Surgery / OT / IP | IP, OT, ward | Handoff. Hidden admissions/surgery/pre-op are Coming Soon |
| Charges and payments | Billing / cashier | **PRODUCT DECISION REQUIRED** whether a read-only balance stays |
| Claims | CCMS | Handoff. Patient insurance policies are a different table |
| Optical shop | Optical | **PRODUCT DECISION REQUIRED** |
| Documents | Documents / medical records | Hidden documents tab is not a working drop zone in the shell |

Encounter documentation at `.../encounter/[visitId]` is a clinical write surface. It is mounted under the patient route. **PRODUCT DECISION REQUIRED** whether that URL remains, moves under the clinical module, or stays as a deep link that the directory does not own.

---

## 12. Backend architecture

All directory HTTP endpoints found are on auth-service `PatientsController` (`api/Patients`), class `[Authorize]`, tenant from the JWT.

| Method | Route | Permission | Service |
|---|---|---|---|
| GET | `suggest` | `patient.view` | `PatientLookupService.SuggestAsync` after branch resolve |
| GET | `omni-search` | `patient.view` | `PatientOmniSearchService` |
| GET | `lookup` | `patient.view` | `LookupAsync` |
| GET | `lookup/export` | `patient.export` | `ExportCsvAsync` |
| GET | `lookup/stats` | `patient.view` | `GetStatsAsync` |
| GET | `recent-views` | `patient.view` | `PatientRecentViewsService` |
| POST | `{id}/recent-view` | `patient.view` | same |
| POST | `{id}/phi-access` | `patient.view` | `IAuditService` |
| PUT | `{id}/favorite` | `patient.view` | `ToggleFavoriteAsync` |
| GET | `` | `patient.view` | `IPatientService.GetAllPatientsAsync` (no branch resolve) |
| GET | `search` | `patient.view` | `SearchPatientsAsync` (legacy, not the hub) |
| GET | `{id}` | `patient.view` | `GetPatientByIdAsync` |
| POST | `{id}/merge` | `patient.update` | `IPatientMergeService` |
| GET | `{id}/summary` | `patient.view` | `IPatientSummaryService`. **Required `branchId`. Does not call `ResolveEffectiveBranchAsync`** |
| GET | `{id}/visits/recent` | `patient.view` | summary service |
| GET | `{id}/data-quality` | `patient.view` | summary service |
| GET | `{id}/vitals/staleness` | `patient.view` | summary service |
| GET | `{id}/summary/export` | `patient.export` | PDF service |
| POST | `check-duplicates` | `patient.view` | `PatientDuplicateDetectionService` |
| POST | `` | `patient.create` | branch resolve, duplicate check, `CreatePatientAsync`, MRN generated |
| PUT | `{id}` | `patient.update` | update. MRN preserved (Slice 7). **No branch resolve** |
| DELETE | `{id}` | `patient.delete` | hard delete via `Remove` in `PatientService.DeletePatientAsync` despite a client comment that says soft delete |
| POST/DELETE | `{id}/photo` | `patient.edit` | blob storage |
| GET | `{id}/vitals/latest` | `patient.view` | direct `PatientVitalSigns` |

Sibling controllers used by record tabs, not by the directory list: `patient-notes`, `patient-allergies`, `patient-insurance`, `patient-consents`, `patient-communications` (reads `patient.view`, writes `patient.update`). `patient-medical-history` and `patient-investigations` use `counseling_sessions.read` / `update`, not `patient.*`.

Check-in is not on `PatientsController`. It is `POST api/Visits/checkin` and `check-in` on `VisitsController`, class `[Authorize]` without `RequirePermission` on those methods.

**Duplicate lookup.** Hub list uses `/patients/lookup`. Legacy `/patients/search` and `patientApi.getAll` still exist. Registry policy says new search must use suggest. `patientApi.getById` falls back to `getMockPatientById` on failure. Directory summary does not use that method. CCMS and examination history do. **Do not wire the directory redesign to `getById`.**

**Client vs server authorization.** Hub create, export, and merge are client-gated and server-gated. Record PDF is server-gated only. Record route is not client-gated with `patient.view`. Summary GET does not re-check branch membership.

**Role-name checks in lookup.** Not found in `PatientsController` or `PatientLookupService`. Omni-search uses role names to find provider users, not to authorize the caller. Record check-in override uses caller role **names** on the client.

---

## 13. Database architecture

Runtime patient table used by auth-service fluent config and by Slice 8 plans is **`patient`** (`AppDbContext` `ToTable("patient")`). The class attribute still says `[Table("patients")]`. Counselling’s read-only projection maps `patients` and excludes migrations. Module 30 SQL foreign keys reference `patients(id)`. Favorites SQL references `patient(id)`. **ENGINEERING GAP:** two names exist in the repository. The measured database plans used `patient`.

### Identity row (`patient`)

| Concern | Evidence |
|---|---|
| Key | `id` UUID |
| Tenant | `tenant_id` required |
| Branch | `branch_id` nullable |
| MRN | `medical_record_number` required, max 50. Create format `MRN-{UTC yyyy-MM}-{5 chars of a guid}`. Update does not replace it. Index `ix_patients_tenant_mrn` is not unique |
| Other identifier | `health_id` nullable. Suggest can match it. Census `q` does not. Counselling comments call `health_id` UHID |
| Status | `status` default `Active`. **Not used by directory census** |
| Soft delete | `deleted_at`. Lookup excludes it. `DeletePatientAsync` **removes the row** |
| RLS | Not established on the base `patient` table from module 30 (that script does not create `patient`) |

### Hub tables in `module30_patient_directory_hub.sql`

`patient_allergies`, `patient_consents`, `patient_communications`, `lab_reports`, `patient_insurance`, `patient_notes`, `optical_orders`. Each has `tenant_id`, `patient_id`, status-like columns, `deleted_at`, and tenant RLS policies. These feed record tabs. They are not the census.

### Tables the lookup and engagement path actually query

From source, and confirmed as relation names in Slice 8 plans where noted:

| Relation | Role in directory |
|---|---|
| `patient` | Identity |
| `patient_favorites` | Stars |
| `visits` | Current, discharged, assigned-to-me, programs, provider, department, acuity inputs |
| `appointment` (fluent `ToTable("appointment")`; attribute `appointments`) | Schedule column and appointment filter |
| `queue_item` | Current, wait, station |
| `patient_journey` | Current IP, admission filter |
| `counseling_sessions` | Current, patient type, camp, CCMS JSON marker |
| `insurance_pre_authorizations` in EF snapshot | Current insurance engagement |
| `department` | Program codes |
| `patient_diagnosis`, `diagnosis_code` | Diagnosis filter |
| `bed_inventory` | Ward filter and IP display |
| `patient_vital_signs`, `patient_notes` | Acuity scoring, not the list columns directly |
| `users` | Assigned provider include |

**MEASURED DISCREPANCY.** Slice 8 `EXPLAIN` planned the insurance engagement query against `archived_insurance_pre_authorizations`. That name is **NOT FOUND** in the repository. The EF snapshot maps `InsurancePreAuthorization` to `insurance_pre_authorizations`. Why the live planner used the archived name is **NOT ESTABLISHED FROM REPOSITORY**.

**Denormalized / derived data (not SoT).** Lookup row fields `clinicalAcuity`, `waitingMinutes`, `currentStation`, `reasonForVisit`, `activeEngagements`, and `assignedProviderName` are computed at read time. They are not columns on `patient`.

**MRN lifecycle.** Assigned once at create. Not client-editable through the update DTO. Not unique per tenant. **PRODUCT DECISION REQUIRED** if MRN must be unique, human-meaningful, or stable across merge.

**Merge.** `POST /patients/{primaryId}/merge` exists. This audit did not re-trace every child table the merge service rewrites. Do not describe merge side effects beyond “merge service plus audit” without reading that service in the implementation slice that touches merge.

**Patient status lifecycle.** A string default exists. Directory census does not transition it. **NOT ESTABLISHED** which workflow is allowed to change `Patient.Status`.

---

## 14. Permissions and security

| Code | Server | Client directory |
|---|---|---|
| `patient.view` | Lookup, suggest, stats, favorite, summary, PHI log, recent views, get, search, get-all | Hub page and sidebar. **Not** the record page |
| `patient.create` | Create | Add Patient button |
| `patient.update` | Update, merge, and writes on notes/insurance/consents/communications/allergies | Merge link and duplicate banner |
| `patient.export` | CSV and PDF | CSV button. PDF button is not client-gated |
| `patient.delete` | Delete | No directory control found |
| `patient.edit` | Photo | No directory control found |
| `appointment.view` | Not re-audited here | Book appointment menu item |
| `counseling_sessions.read` | Medical history and investigations reads | Not the directory list |

Plural codes `patients.view` and similar appear only as sample strings in role-admin mock UIs. They are not `[RequirePermission]` codes.

Branch resolution for lookup, suggest, omni-search, stats, CSV, and create uses `IFollowupBranchAccessService.ResolveEffectiveBranchAsync` (user’s branches). A requested branch outside that set is unauthorized. Omitting branch is allowed only when the user has exactly one branch.

Gaps already in source:

- Summary, update, delete, get-by-id, and legacy search do not all use that branch resolver. Summary trusts the query `branchId` after `patient.view`.
- Advanced filter subqueries omit tenant (Part 8).
- Record route and encounter route have no `patient.view` page gate.
- Check-in endpoints on `VisitsController` have no `RequirePermission` in the methods found.
- Emergency override is a client role-name list and a `console.log`.
- Favorite toggle does not verify the patient id.
- `GetAllPatients` returns the tenant list without branch resolve. The hub does not call it. It remains reachable with `patient.view`.

**PHI.** Preview and record log `phi-access`. Preview swallows log failures and still shows data. Names, phone, MRN, and DOB are on the list. CSV export includes phone and reason. **Do not add diagnosis, insurance numbers, or clinical notes to the directory grid without a security decision.**

---

## 15. Cross-module integrations

| Module | From directory | URL / API | Mutation by the directory |
|---|---|---|---|
| Front office check-in | Row, preview, record toolbar | `/dashboard/frontdesk/check-in?patientId=` (`patient-handoff.ts`) | No |
| Front office queue | Record menu only | `/dashboard/frontdesk/queue` | No |
| Appointments | Row menu | `/dashboard/appointments/schedule?patientId=` | No |
| Appointments book route | Unlinked from the row | `/dashboard/patients/book` | Unused inbound |
| Counsellor | Record More → Counselor. Directory row has **no** counsellor button | Waiting list `?patientId=`, or one session if the handoff resolver finds exactly one | No session create, no `CounselorId` |
| Doctor’s Desk | Sidebar sibling. Examination pages link **back** to `/dashboard/patients/{id}` | Back links from visual acuity, tonometry, retinoscopy, refraction, keratometry, contact lens, auto-refraction | Those pages are not launched by the directory row |
| Encounter documentation | Preview and record “Continue encounter” | `/dashboard/patients/{id}/encounter/{visitId}` | Save happens on the encounter page |
| Billing | Record tab and toolbar | Tab `billing`. OPD create page can bounce **back** to `/dashboard/patients` when patient is missing | Directory does not post a charge |
| Insurance / CCMS | Record tab. Engagement filter can match pre-auth and a JSON marker on counselling | Tab `insurance`. Omni-search can build `?tab=insurance` but omnisearch is unmounted | Directory does not create a coverage case |
| IP / ward | Row may show IP badge and ward from journey/bed | Print summary used by `WardPreOpWorkspaceModal` | Directory does not admit or discharge |
| Diagnostics | Biometry “Go to Patient List” | `/dashboard/patients` | Inbound only |
| Specialty clinics | `useSpecialtyClinicPatients(programCode)` calls the same lookup | `programCodes=` | Shared API. Cataract “New Patient” uses `?action=new`, which the hub ignores |
| Documents | Upload doc menu | Hidden tab, then stripped | Broken |
| Communications | Record tab and dead SMS modal | `patient-communications` vs unconnected SMS | Tab may write with `patient.update`. SMS menu does not |
| Analytics / ownership allocation | No directory integration found | — | Do not invent one |

SignalR: `usePatientHubRealtime` subscribes to the existing queue hub (`QueueUpdated`, `PatientStatusChanged`, `PatientCalled`) and refreshes the list. It is not a second bus. A redesign should keep one subscription and invalidate lookup, not poll.

---

## 16. Doctor’s Desk and navigation

EXISTING FACT. Patient Directory sits in the Doctor’s Desk sidebar group because that is where the menu array places it. The route permission is `patient.view`, which is also granted to the counsellor catalog. The Doctor’s Desk page permission is a different code (`CLINICAL:EXAMINATION:VIEW`). Role landing does not open the directory.

**RECOMMENDATION — PRODUCT DECISION REQUIRED.** Treat it as shared hospital patient discovery, not as a doctor tool. Candidate placements (not chosen here): a top-level Patients item visible to every role that has `patient.view`. Do not move the menu in the first visual slice. Navigation is a product decision and a permission-visibility change.

Route rename (`/dashboard/patients` → something else): **DEFERRED**. Many back-links and specialty-clinic lookups use this path. Renaming is not a shell restyle.

---

## 17. User journeys

Each journey’s completion state is the destination module, not a directory status change, unless noted.

| Journey | Entry | What the code does | Completion | Failure | Ownership / audit |
|---|---|---|---|---|---|
| A. Search → preview → record | Hub search or row | Suggest navigates to the profile on select. Row opens preview. Preview opens profile | Record shell loaded | Empty branch, lookup error, summary error | PHI log on preview. Record summary may also audit (controller optional PHI path) |
| B. Search → check-in | Row or preview | Front-desk URL with `patientId` | Front desk owns check-in | Front desk ignores id: out of scope here; Slice 3 was accepted to pass it | Directory does not create a visit |
| C. Search → appointment | Row menu if `appointment.view` | Schedule URL | Schedule module | Hidden if no permission | None in directory |
| D. Search → counsellor | **Not on the row.** Record More menu | Waiting list or exactly one session | Counsellor desk | Zero or many sessions stay on the list | No `CounselorId` write |
| E. Search → existing encounter | Preview/record if `assignedVisitId` | Encounter route | User can save documentation | No visit id: link hidden | Clinical write is the encounter page |
| F. Search → billing | Record only | Billing tab | Whatever `BillingTab` loads | Not on the directory row | Financial SoT remains billing |
| G. Search → insurance | Record tab | Insurance tab | Policy UI | Not a CCMS handoff | |
| H. Search → clinical record | Record clinical tabs or encounter | Gated tabs or encounter | Check-in gate may block | Override is local only | |
| I. Search → documents | Upload doc | Rewrites to overview | **Fails** | Hidden tab | |
| J. Search → communication | Communications tab or SMS menu | Tab uses API. SMS menu is a stub | Split behavior | | |
| K. Create | Add Patient modal, or unused `/new` | `POST /patients` | Hub toast or `/new` navigates to profile | Duplicate ≥ 0.95 | Audit on create path exists in controller |
| L. Edit | Not a directory row action. Record/form paths use `PUT` | MRN preserved | | | |
| M. Merge | Merge page | Confirm + merge API | Profile of primary | Needs `patient.update` | |
| N. Favorite | Star | PUT favorite | Row star state | | Not clinical audit |
| O. Assigned to me | Toggle | Open visits assigned to user | Filtered list | Empty if the user is not `Visit.AssignedTo` | Not an assignment action |
| P. Current | Tab | Engagement union | | Misleading label | Read |
| Q. High priority | Tab | Acuity / queue priority | | Empty in the Slice 8 dataset | Read |
| R. New | Tab | Created in 30 days | | Includes inactive registrations | Read |
| S. Discharged | Tab | Completed visit and not current | | Not IP discharge | Read |

---

## 18. UX and design-system audit

Compared with the platform rules (desktop worklists, emerald/navy, Lucide, Radix Sheet, no second toast library) and with the counsellor pattern of a focused workspace, explicit actions, and a right-side sheet.

| Observation | Evidence |
|---|---|
| Directory is already a desktop worklist with a mobile card fallback | Table vs `PatientHubMobileCards` |
| Advanced filters already use a right-side Sheet | `PatientAdvancedFilterSheet` |
| Preview is a split pane or drawer, not a full route | Matches a contextual panel. It is not the counsellor session sheet |
| Header says “Patients” while nav says “Patient Directory” | Ambiguous |
| Census words do not match their predicates | Part 6 |
| Row has View, Check-in, and More. Counsellor is buried on the record | Inconsistent handoff hierarchy |
| Selection without a bulk action | Noise |
| Dead menus (No-show, SMS, Call, Upload doc) | Look like workflows |
| Loading skeleton columns do not match the table | Trust |
| Omnisearch is implemented and unmounted | Two search designs |
| Record is a tab encyclopedia (three groups, overflow, hidden keys) | Opposite of a focused workspace |
| Check-in gate copy and role override sit in the record | Clinical workflow inside the chart shell |
| Density | Many columns (queue, acuity, programs, assignee) on a discovery page | High for “find a patient”, justified only if this page is an operational census. **PRODUCT DECISION REQUIRED** |
| Toasts | Add Patient uses `react-hot-toast` | Consistent with the platform |
| Icons | Lucide | Consistent |

This audit did not re-run the app in a browser. Visual defects from Slice 3 (Assigned/Actions collision, Check-in wrap) were accepted after a layout correction. They are not re-certified here.

---

## 19. Performance architecture

**KNOWN MEASURED ISSUE (Slice 8, development database, read-only).** Wall clock from the measurement host to Azure, not SQL time:

| Scenario | Statements | Wall | SQL execution (plans) | Result |
|---|---|---|---|---|
| Search `q` | 14 | 918 ms | about 0.04–0.26 ms each | 10 rows |
| Current tab | 18 | 664 ms | sub-millisecond | 0 rows |
| High priority | 17 | 480 ms | sub-millisecond | 0 rows |
| Stats alone | 28 | 695 ms | sub-millisecond | all=103, other counts 0 |

Plans were index scans on `patient` and index scans on queue, journey, counselling, and the insurance relation, plus sequential scans on small `visits`, `appointment`, vitals, and bed tables (24 visits in that database). Sequential scans are not evidence of a production table-scan problem at this volume.

**KNOWN ARCHITECTURAL COST (source, consistent with the statement counts).** `GetCurrentPatientIdsAsync` issues a separate query per source (eight). `GetStatsAsync` repeats current, new, discharged, and high-priority work, and high priority calls `LoadForPatientsAsync` with an empty id list, which loads every open engagement in the branch and then scores it. The hub always fires lookup and stats together. A page view is two HTTP calls and, on the measured path, on the order of 14+28 round trips before preview.

**POTENTIAL ISSUE.** Empty-id engagement load will grow with open visits, queues, journeys, and sessions. Slice 8’s branch had zero current patients, so this cost was not measured under load. Do not add indexes in a redesign slice until a non-empty measurement says SQL time matters.

**POTENTIAL ISSUE.** `usePatientHubRealtime` refetches on queue hub events. Not measured.

**POTENTIAL ISSUE.** Preview adds summary, recent visits, PHI, and recent-view calls per open. Not in the Slice 8 numbers.

**NO EVIDENCE OF ISSUE.** React rerender cost. Not profiled. Export page-size clamp is a correctness bug, not a measured timeout.

**Do not start a database optimization phase** as part of the UX redesign. Slice 8’s conclusion stands: the noticeable time is round trips.

---

## 20. Dead, legacy, and placeholder inventory

| Item | Disposition |
|---|---|
| `PatientGlobalSearch` / omnisearch (no importer) | DEPRECATE or HIDE until a global-search decision |
| `?action=new`, `?id=` on the hub | DEPRECATE the links that emit them, or implement them only after a product decision. Today they do nothing |
| `/dashboard/patients/book` | DEPRECATE candidate. Row booking does not use it |
| `/dashboard/patients/new` vs modal | PRODUCT DECISION REQUIRED, then hide one |
| Selection bar with only Clear | HIDE |
| No-show, SMS, toolbar Call | HIDE |
| Upload document menu | HIDE until documents have a real destination |
| Hidden Coming Soon tabs | KEEP components unmounted (Slice 5). Do not show them. REMOVE only in a cleanup phase with approval |
| `PreviewVitalsGrid` and preview tab panels if unmounted | KEEP unused until cleanup. Do not restore |
| `PatientDirectoryHub` | Already absent. Plan file is historical |
| `/admin/patients` mock page | Not the directory. Do not merge it in |
| `GET /patients/search` and `getAll` | Legacy. Directory must keep using lookup |
| `getMockPatientById` fallback | Not on the directory summary path. Do not adopt it. Fixing other callers is out of scope for the directory redesign |
| Queue/Portal tab buttons without handlers | Already hidden. Leave hidden |
| Imaging “coming soon” button | HIDE the dead button when that tab is touched; do not build a second viewer |
| Emergency override `console.log` | SECURITY DECISION REQUIRED. Do not treat it as audit |
| Stale component registry and implementation plan | Do not implement from them |

---

## 21. Current architecture diagram

```text
Sidebar (Doctor's Desk)
  Patient Directory  --patient.view-->  /dashboard/patients
                                         PatientHubPage
                                           |-- lookup + stats (branch)
                                           |-- suggest
                                           |-- favorite
                                           |-- preview (summary, visits, phi, recent-view)
                                           |-- handoff links only
                                           +-- /dashboard/patients/[id]
                                                 PatientRecordPage
                                                   |-- summary
                                                   |-- visible tabs (clinical/admin/billing)
                                                   |-- hidden tab keys rewritten away
                                                   +-- /encounter/[visitId]  (can save)

AuthService PatientsController
  ResolveEffectiveBranchAsync (lookup family)
  PatientLookupService
    patient  (+ null branch included)
    patient_favorites
    PatientEngagementService
      visits, queue_item, patient_journey,
      counseling_sessions, insurance pre-auth,
      vitals, notes, beds, appointments, departments
```

---

## 22. Current data-flow diagram

```text
User selects branch
  -> URL state (tab, q, filters, preview)
  -> GET /api/patients/lookup     (filters + one page)
  -> GET /api/patients/lookup/stats (branch counts only)
  -> for the page: engagement bundle
  -> row DTO (identity + derived operational fields)

Preview
  -> GET summary?branchId
  -> GET visits/recent
  -> POST phi-access
  -> POST recent-view

Row Check-in / Book / View
  -> browser navigation
  -> destination module or record
  -> that module's API (not lookup)
```

---

## 23. Ideal future-state architecture

This section is a **recommendation** grounded in the boundaries the code already has. It is not approved.

1. **Purpose.** Shared discovery of a patient in the current branch, plus enough operational context to choose a handoff. Not a second desk.
2. **Information architecture.** Directory (find and hand off) and Record (longitudinal identity and history) stay two routes.
3. **Navigation.** Top-level, permission `patient.view`. **Decision required.**
4. **Main page.** One title, branch context, search, census, one primary handoff per row, overflow for the rest.
5. **Search.** One matcher. Suggest and `q` should not disagree on `HealthId`. **Decision required** if HealthId is in scope.
6. **Filters.** Quick: text. Advanced Sheet: identity and dates. Engagement/program/ward stay advanced because they join other modules.
7. **Census.** Keep server predicates until product renames or redefines them. Do not silently recode Current.
8. **Grid.** Identity (name, MRN, age/sex, phone) always. Operational columns only if the page is explicitly a census. **Decision required.**
9. **Preview.** Right-side sheet: identity, why they match the census, next handoffs. No chart.
10. **Record.** Identity, consents, read-only history. No placeholder operational tabs.
11. **Actions.** Explicit handoffs. No action that assigns, queues, checks in, or starts counselling inside the directory.
12. **Handoffs.** Keep `patient-handoff.ts` as the contract: URLs only.
13. **Ownership.** Directory does not own counsellor ownership or visit assignment. Assigned-to-me stays a filter or leaves. **Decision required.**
14. **Permissions.** `patient.view` to see directory and record. Create, update, export stay separate. Record page should use the same view permission. **Security decision.**
15. **Clinical.** Encounter documentation stays a clinical surface. Directory only links when a visit id already exists.
16. **Administrative.** Registration and merge stay MPI operations, not row clutter.
17. **Billing.** No payment controls on the directory. Read-only amounts on the record only if billing agrees. **Decision required.**
18. **Identity.** `patient.id` is the key. MRN is a human identifier, not the key. Uniqueness is undecided.
19. **Visit.** `visits` row. Directory reads it. Front desk creates it.
20. **Engagement.** A projection, not a table. Do not persist a second engagement store in the frontend.
21. **Branch.** Effective branch is mandatory. Null `BranchId` inclusion is a product rule that should be explicit. **Decision required.**
22. **Audit.** PHI view and export stay server-side. Favorites are not clinical audit. Override must not be `console.log` if it remains.
23. **API.** One lookup, one stats, one suggest. Do not add a second search for the redesign. Fix export so it uses the same filter object and is not clamped to 100 if export of the filtered set is required.
24. **Database.** Do not add census tables. Do not optimize indexes in the UX phases.
25. **Integrations.** Link out. Specialty clinics may keep `programCodes` on the same lookup.

---

## 24. Ideal future-state UX

**RECOMMENDATION.** A desktop worklist:

- Title and branch, then search, then the census.
- Filters as a Sheet with chips. No second search dialog until omnisearch is a real product.
- Table columns limited to identity plus the one operational signal the product chooses (for example engagements), with the rest in preview.
- Row actions: Open, and one handoff menu (Check-in, Appointment, Counsellor, Continue encounter when a visit exists). Favourites stay a star, not a workflow.
- Preview on the right at wide widths, drawer when narrow.
- Record: patient header (name, MRN, age, sex, branch) and a short set of history sections. Operational buttons in that header hand off; they do not embed the other module.
- Empty, error, loading, and no-branch states stay. Skeleton matches the columns.
- Copy stays short. Remove Coming Soon from anything still visible.

This follows the counsellor **pattern** (focused surface, explicit action, sheet for context, no accidental mutation). It does not copy waiting-list ownership, Start Session, or ReQueue.

---

## 25. Counsellor-reference analysis

Reusable principles already visible in this platform’s counsellor work and in `patient-handoff.ts`:

| Principle | Directory today | Use in redesign |
|---|---|---|
| Focused workspace | List is one job; record is many jobs | Split and shrink the record |
| Explicit actions | Check-in is explicit and does not check in | Keep that. Remove dead menu items that look explicit |
| Contextual identity | Preview and record show name, MRN, age, sex | Keep. Do not rebuild a second patient header system |
| Right-side Sheet | Filter Sheet exists. Preview is a pane/drawer | Use one sheet pattern |
| Shared queue vs owned work | Current tab mixes both. Assigned-to-me is visit ownership | Do not invent directory ownership |
| No accidental mutation | Handoffs are links. Favorite and create are the mutations on the list | Preserve |
| Clear boundaries | Record still hosts billing, insurance, encounter save, and dead clinical tabs | The redesign’s main structural job |
| Responsive | Table and cards exist | Keep priority fields on the card |

Do not import counsellor session status, `CounselorId`, quote, or surgery-package rules.

---

## 26. Product decision register

| ID | Existing fact | Observed problem | Recommendation | Decision |
|---|---|---|---|---|
| PD-01 | No charter states the purpose | Code is a cross-module census plus a chart shell | Purpose = discovery and handoff | **PRODUCT** |
| PD-02 | Menu is under Doctor’s Desk; permission is `patient.view` | Counsellors with that permission see it in a clinical section | Shared nav item. Do not move until accepted | **PRODUCT** |
| PD-03 | Five census predicates are coded | Labels mislead | Keep predicates; rename only with a written definition | **PRODUCT** |
| PD-04 | Null `BranchId` patients appear in every branch | Cross-branch visibility | Confirm or stop including null branch | **PRODUCT + SECURITY** |
| PD-05 | `Patient.Status` is unused by census | Status column is absent; people may still think tabs are status | Do not add a status filter until a lifecycle exists | **PRODUCT** |
| PD-06 | MRN generated, not unique, not editable | Two patients can share a search hit | Whether MRN must be unique | **PRODUCT + ENGINEERING** |
| PD-07 | `health_id` is suggest-only | Search box mentions email, not HealthId; HealthId is invisible to `q` | Whether HealthId/UHID is a directory key | **PRODUCT** |
| PD-08 | Assigned-to-me is `Visit.AssignedTo` | Sounds like counsellor “my work” | Keep as a visit filter, rename, or remove | **PRODUCT** |
| PD-09 | Favorites are personal | Easy to mistake for a worklist | Keep as bookmarks | **PRODUCT** to confirm |
| PD-10 | High priority is a scorer | Not a triage protocol | Keep, rename, or remove the tab | **PRODUCT** |
| PD-11 | Discharged means completed visit and not current | Not IP discharge | Rename or redefine | **PRODUCT** |
| PD-12 | New means registered in 30 days | Not a new visit | Rename or redefine | **PRODUCT** |
| PD-13 | Two create UIs | Modal vs `/new` | One path | **PRODUCT** |
| PD-14 | Encounter route can save clinical data | Directory URL owns a chart write | Where encounter URLs live | **PRODUCT** |
| PD-15 | Continue encounter on preview | Leaves discovery into documentation | Keep or remove from preview | **PRODUCT** |
| PD-16 | Billing and insurance tabs on the record | Second financial surface | Read-only vs remove vs handoff | **PRODUCT** |
| PD-17 | Row has no counsellor action; record does | Handoff is hard to find | Whether counsellor belongs on the row | **PRODUCT** |
| PD-18 | Grid includes queue, acuity, programs | Duplicates live desks | Which columns are census vs handoff-only | **PRODUCT** |
| PD-19 | Export omits filters and clamps to 100 | CSV is not the list | Fix when export remains in scope | **ENGINEERING** (after confirming export stays) |
| PD-20 | Record page lacks `patient.view` | Deep link may be wider than the hub | Gate the record the same way | **SECURITY** |
| PD-21 | Summary branch id is not resolved like lookup | Possible cross-branch summary if `patient.view` | Align branch checks | **SECURITY** |
| PD-22 | Advanced filters omit tenant | Isolation hole | Add tenant (and branch where the domain has it) | **SECURITY** |
| PD-23 | Check-in override is `console.log` plus role names | Not an audit | Remove or replace with a real audit. Do not expand it | **SECURITY** |
| PD-24 | Slice 8 SQL is cheap; round trips are not | Stats and high-priority fan out | Do not index first. Collapse calls only in a measured API slice | **DEFERRED** |
| PD-25 | Table name `patient` vs `patients` | Two mappings | Do not rename tables in the UX program | **DEFERRED** |
| PD-26 | Live plan used `archived_insurance_pre_authorizations` | Not in source | Explain before changing insurance joins | **ENGINEERING** investigation |
| PD-27 | Omnisearch unmounted | Dead product | Leave unwired | **DEFERRED** |
| PD-28 | Placeholder record tabs hidden | Components remain | Do not show them again | **PRODUCT** to confirm they stay hidden |
| PD-29 | Selection has no bulk action | Checkbox clutter | Remove in the shell slice unless a bulk action is named | **PRODUCT** |
| PD-30 | `DeletePatient` hard-deletes | No directory button, but the API exists | Do not expose delete on the directory | **PRODUCT** confirmed by absence of UI; do not add it |

---

## 27. Recommended redesign roadmap

Phases below are proposals. Each one is blocked on the decisions it names. None of this is authorized by this document.

### Phase 0 — Product decisions

- **Objective.** Accept or reject PD-01 through PD-18, PD-20, PD-28, PD-29.
- **Scope.** This register. No code.
- **Depends on.** This audit.
- **Out of scope.** Implementation.
- **Acceptance.** A written decision list that states purpose, nav, census names (or “keep codes, change labels”), preview actions, and record contents.
- **Rollback.** N/A.

### Phase 1 — Directory information architecture (frontend shell only)

- **Objective.** Apply accepted decisions to `PatientHubPage` chrome: title, which toggles remain, which row actions remain, hide dead selection if PD-29 says so.
- **Files.** `PatientHubPage.tsx`, `PatientHubTable.tsx`, `PatientHubRowActions.tsx`, `PatientHubMobileCards.tsx`, `PatientHubClassificationTabs.tsx`, filter chips, test ids and existing Vitest files for those components.
- **APIs.** None if filters and tabs stay.
- **Database.** None.
- **Depends on.** Phase 0 census and action decisions.
- **Out of scope.** Nav move, predicate changes, record tabs, export clamp, encounter page.
- **Tests.** Existing `patient-lookup-filters` and hub component tests. Update only assertions tied to removed controls.
- **UAT.** Search, each census tab, favorites, assigned, check-in URL, book URL, preview open/close, mobile card.
- **Acceptance.** No new mutation. Handoff URLs unchanged. Lookup query parameters for remaining controls unchanged.
- **Rollback.** Revert the frontend commit.

### Phase 2 — Preview boundary confirmation

- **Objective.** Only if PD-15 changes Continue encounter or the preview contents. Otherwise skip.
- **Files.** `PatientPreviewPanel.tsx` and its boundary test.
- **Depends on.** Phase 0.
- **Out of scope.** Remounting vitals.
- **Acceptance.** Preview still does not create visits or sessions.

### Phase 3 — Record shell reduction

- **Objective.** Apply PD-16 and PD-28: keep hidden tabs hidden; remove dead toolbar items; optional removal of billing/insurance from the shell only if decided.
- **Files.** `patient-record-tabs.ts`, `PatientRecordPage.tsx`, `QuickActionsToolbar.tsx`, `PatientRecordTabGroups.tsx`.
- **Depends on.** Phase 0. Does not depend on Phase 1 visually, but should not ship concurrently with an unrelated toolbar rewrite.
- **Out of scope.** New clinical APIs. Deleting tab component files (later cleanup).
- **Acceptance.** Deep links to hidden tabs still resolve safely to overview. No new write paths.

### Phase 4 — Authorization alignment

- **Objective.** PD-20 and, if accepted, summary branch resolve (PD-21).
- **Files.** `patients/[id]/page.tsx`, possibly `PatientsController` summary action.
- **Depends on.** Security decision.
- **Out of scope.** Redesign of roles.
- **Tests.** Extend `patient-directory-auth` checks. Backend authorization tests for summary branch.
- **Acceptance.** Record cannot render without `patient.view`. Summary cannot use an unauthorized branch if that decision is accepted.
- **Rollback.** Revert permission checks only if they lock out a role that product confirms must see the record. Do not roll back by weakening other endpoints.

### Phase 5 — Export contract (only if export stays)

- **Objective.** CSV uses the same `PatientLookupQuery` fields as lookup and is not silently limited to 100 rows.
- **Files.** `PatientLookupService.ExportCsvAsync`, export tests.
- **Depends on.** Confirmation that export remains.
- **Out of scope.** New columns of PHI.
- **Acceptance.** A filtered list and its CSV describe the same set, up to an explicit documented cap if 5000 is still desired.

### Phase 6 — Filter isolation

- **Objective.** PD-22. Tenant (and branch where the entity has branch) on advanced subqueries.
- **Depends on.** Security decision. Not on visual redesign.
- **Out of scope.** Changing match semantics (contains vs exact) unless product asks.
- **Acceptance.** Tests that a foreign tenant id cannot be returned by diagnosis, provider, department, ward, appointment, or admission filters.

### Phase 7 — Census and stats only if product changes definitions

- **Objective.** Implement accepted renames or definition changes in `ApplyTabFilterAsync` and `GetCurrentPatientIdsAsync`.
- **Depends on.** Written predicates. **Do not start from UX copy alone.**
- **Out of scope.** Index work.
- **Acceptance.** Each tab has a test that encodes the accepted predicate, including null branch.

### Phase 8 — Navigation placement

- **Objective.** Move the sidebar item only after PD-02.
- **Files.** `sidebar-menu-sections.tsx` and the counsellor nav test.
- **Depends on.** PD-02.
- **Out of scope.** Route rename.
- **Acceptance.** `patient.view` still shows the item. `CLINICAL:EXAMINATION:VIEW` is not required.

### Explicitly not a phase

Database index program. Round-trip collapse of stats vs lookup. Table rename `patients`/`patient`. Omnisearch revival. Merge rewrite. Hard-delete redesign.

---

## 28. Recommended frontend-first sequence

After Phase 0 decisions that do **not** change APIs:

1. Hub chrome and row actions (Phase 1).
2. Hide dead record toolbar items and keep hidden tabs hidden (part of Phase 3 that is frontend-only).
3. Preview link changes only if decided (Phase 2).
4. Stop. Do not change lookup query builders in the same slice as visual work.
5. Authorization, export, and filter isolation are separate slices because they are security and contract work, even if the files are small.

The first bounded implementation slice should be Phase 1 only, and only after the product answers: which row actions stay, whether Favorites and Assigned to me stay, and whether selection checkboxes stay.

---

## 29. Testing strategy

Existing coverage to keep green:

- `src/lib/patients/patient-lookup-filters.test.ts`
- `patient-directory-auth.test.ts`
- `patient-handoff.test.ts`
- `patient-record-tabs.test.ts`
- Hub component tests (`PatientHubTable.a11y.test.tsx`, mobile cards, preview boundary, highlights)
- Playwright `e2e/patient-hub.spec.ts` (registry: search, tabs, export, preview, omnisearch). Omnisearch assertions may already be stale if the dialog is unmounted. **Verify before trusting that spec.** This audit did not execute it.
- Backend: `PatientDirectoryExportAuthorizationTests`, `PatientMrnUpdateIntegrityTests`

New tests belong to the slice that changes behavior. A visual shell slice should assert handoff URLs and that removed buttons are absent. It should not weaken census tests.

Do not add tests that require writing bills, claims, or encounters.

---

## 30. UAT strategy

Manual UAT for the first frontend slice, on a non-production branch, with a user who has `patient.view` and one who does not:

1. No branch: empty state, no list request assumed — confirm no patient rows.
2. All tab: a known patient appears; search by MRN (2+ characters) finds them.
3. Current, New, Discharged, High priority: counts match the unfiltered branch, not the search box. Confirm that mismatch with the tester so it is not filed as a bug until product changes stats.
4. Check-in opens front desk with `patientId` and does not create a visit by itself.
5. Book is visible only with `appointment.view`.
6. Favorite toggles and survives refresh.
7. Preview shows no vitals chart, opens the record, closes by control and Escape if the shell is a dialog.
8. Record deep link `?tab=counseling` lands on overview.
9. Counsellor handoff from the record does not assign `CounselorId`.
10. User without `patient.view` does not get the hub. Record deep-link behavior is a known gap until Phase 4.

Census semantic UAT (tabs match clinical language) is **not** pass/fail until Phase 0 renames or confirms the labels.

---

## 31. Risks

| Risk | Why it matters |
|---|---|
| Redesign changes census predicates while “only changing UX” | Users lose Current/Discharged meaning that other modules’ projections define |
| A row action starts a visit or counselling session | Violates Slice 3 and creates ownership |
| Record restyle re-shows Coming Soon tabs | Returns dead operational modules into the chart |
| Export “fix” adds clinical columns | PHI expansion |
| Filter tenant fix changes who appears | Correct, but it will look like data loss |
| Navigation move without updating counsellor nav tests and role landing assumptions | Counsellors lose or gain the item unexpectedly |
| Using `getById` mock fallback in the new shell | Fabricated identity |
| Optimizing SQL before a loaded measurement | Slice 8 does not justify indexes |
| Treating this audit as approval | It is not |

---

## 32. Things that must not be changed without a new decision

- Slice 1 filter contract between URL, hub state, and lookup parameters for filters that remain.
- Slice 2 branch resolution on lookup and CSV branch scope.
- Slice 3 handoff helpers: check-in and counsellor URLs must not create visits, sessions, or `CounselorId`.
- Slice 4 preview: do not put clinical charts back.
- Slice 5 hidden tab set: do not show those keys until a product decision un-hides a specific one.
- Slice 7: update must not regenerate MRN.
- Census predicates in `ApplyTabFilterAsync` and `GetCurrentPatientIdsAsync`.
- `patient.view` / `create` / `update` / `export` codes. Do not invent `patients.*`.
- Auth-service as the patient API owner. Do not add a second patient service for the UI.
- Table renames.
- SignalR bus. Do not add socket.io.
- Billing ledger, CCMS case lifecycle, OT state, and counsellor session lifecycle.
- Hard-delete vs soft-delete behavior, until a dedicated decision.
- Mock `/admin/patients`.

---

## 33. Files inspected

Primary (read or searched in this audit):

- `apps/hospital-portal-web/src/app/dashboard/patients/page.tsx`, `layout.tsx`, `loading.tsx`, `[id]/page.tsx`, `new/page.tsx`, `merge/page.tsx`, `book/page.tsx`, `[id]/encounter/[visitId]/page.tsx`, `[id]/summary/print/page.tsx`
- `src/components/patients/lookup/PatientHubPage.tsx`, `PatientHubTable.tsx`, `PatientHubRowActions.tsx`, `PatientHubMobileCards.tsx`, `PatientPreviewPanel.tsx`, `PatientAdvancedFilterSheet.tsx`, `PatientHubClassificationTabs.tsx`, `PatientSearchAutosuggest.tsx`, `PatientGlobalSearch.tsx`
- `src/components/patients/record/PatientRecordPage.tsx`, `PatientRecordProvider.tsx`, `PatientRecordTabGroups.tsx`
- `src/components/patients/QuickActionsToolbar.tsx`, `encounter/EncounterPage.tsx` (save path only)
- `src/lib/patients/patient-lookup-filters.ts`, `patient-record-tabs.ts`, `patient-handoff.ts`, `patient-record-gate.ts`, `patient-routes.ts`
- `src/lib/api/patient-lookup.api.ts`, `patients.api.ts` (getById mock)
- `src/lib/navigation/sidebar-menu-sections.tsx`
- `src/app/dashboard/DashboardRouter.tsx` (via search)
- `microservices/auth-service/AuthService/Services/PatientLookupService.cs`
- `microservices/auth-service/AuthService/Services/PatientEngagementService.cs`
- `microservices/auth-service/AuthService/Controllers/PatientsController.cs` (via endpoint inventory)
- `microservices/auth-service/AuthService/Models/Domain/Patient.cs`
- `microservices/auth-service/AuthService/Models/Domain/InsuranceWorkflow.cs`
- `microservices/auth-service/AuthService/Context/AppDbContext.cs` (`ToTable("patient")`, `ToTable("appointment")`)
- `database_migrations/schema/module30_patient_directory_hub.sql`
- `database_migrations/scripts/20260616120000_add_patient_hub_tables.sql` (via prior search)
- Slice 8 measurement log: terminal session `204477.txt` (read-only SQL plans and timings)
- Stale references: `PATIENT_DIRECTORY_IMPLEMENTATION_PLAN.md`, `patient-ui-component-registry.md`, `patient-hub-implementation-spec.md`

Sibling patient controllers were inventoried by route, not line-read in full.

---

## 34. APIs inspected

`GET /api/patients/lookup`, `/lookup/stats`, `/lookup/export`, `/suggest`, `/omni-search`, `/recent-views`, `POST /{id}/recent-view`, `POST /{id}/phi-access`, `PUT /{id}/favorite`, `GET /api/patients`, `GET /search`, `GET /{id}`, `POST /{id}/merge`, `GET /{id}/summary`, `/visits/recent`, `/data-quality`, `/vitals/staleness`, `/summary/export`, `POST /check-duplicates`, `POST /api/patients`, `PUT /{id}`, `DELETE /{id}`, photo endpoints, `GET /{id}/vitals/latest`.

Record-adjacent: `api/patient-notes`, `api/patient-allergies`, `api/patient-insurance`, `api/patient-consents`, `api/patient-communications`, `api/patient-medical-history`, `api/patient-investigations`.

Check-in: `POST api/Visits/checkin` and `check-in` (located, not behavior-traced).

---

## 35. Database tables inspected

From source mappings and Slice 8 plans. Live DDL beyond those plans was not re-dumped.

`patient`, `patient_favorites`, `visits`, `appointment`, `queue_item`, `patient_journey`, `counseling_sessions`, `insurance_pre_authorizations` (EF) and measured relation `archived_insurance_pre_authorizations` (not in repo), `department`, `patient_diagnosis`, `diagnosis_code`, `bed_inventory`, `patient_vital_signs`, `patient_notes`, `users`.

Module 30 definitions: `patient_allergies`, `patient_consents`, `patient_communications`, `lab_reports`, `patient_insurance`, `optical_orders`.

Not opened as DDL in this pass: full `visits` column list, queue ownership columns, counselling session columns beyond the filters cited, billing ledger tables. Directory rows do not read bill line tables.

---

## 36. Gaps proven by the repository

1. No product document in `docs/` defines what Patient Directory is for. The implementation plan at the repo root is obsolete.
2. Sidebar placement and permission disagree: Doctor’s Desk section, `patient.view` shared with counsellors.
3. Census labels and predicates disagree (Current, New, Discharged, High priority).
4. `Patient.Status` is not the census.
5. Null patient branch is included in every selected branch.
6. Favorites and Assigned to me are not tabs; Assigned to me is not counsellor ownership.
7. Stats ignore the active search and filters.
8. Export drops name, diagnosis, provider, department, ward, and admission filters, and `LookupAsync` clamps page size to 100.
9. Advanced diagnosis, provider, department, ward, appointment, and admission queries are not tenant-scoped in `ApplyAdvancedFilters`.
10. `q` does not search `HealthId`; suggest does.
11. Patient-type status comparison is case-sensitive; census counselling statuses are not.
12. Discharged uses exact `"completed"`; current visit exclusion is case-insensitive.
13. Record and encounter routes are not wrapped in `patient.view`.
14. Summary does not use `ResolveEffectiveBranchAsync`.
15. Check-in override is a client role-name list and `console.log`.
16. Fourteen record tabs are hidden; several components are still Coming Soon; upload-doc navigates to a hidden tab and bounces to overview.
17. Omnisearch is unimplemented in the live shell (component exists, no importer).
18. `/dashboard/patients/book` and `/new` are parallel to the actions the hub actually uses.
19. Row selection has no bulk operation.
20. Directory check-in and counsellor actions do not mutate workflow state. Encounter **page** can save clinical documentation. That split is easy to miss.
21. EF attribute, counselling projection, module 30 SQL, and runtime `ToTable` do not agree on `patient` vs `patients`.
22. Slice 8 saw `archived_insurance_pre_authorizations`. The repository maps `insurance_pre_authorizations`.
23. `DeletePatientAsync` hard-deletes. Lookup respects `DeletedAt`. Both are true. They are not the same lifecycle.
24. MRN is not unique.
25. Slice 8 wall time is round trips on a small database. There is no measured proof that indexes are required.
26. `patientApi.getById` can return a mock patient. The directory record uses summary instead. The mock remains a hazard for any redesign that switches identity reads.
27. Component registry still documents preview clinical tabs that `PatientPreviewPanel` does not render.

---

## Stop

No implementation follows from this document. The next step is Phase 0 decisions, then one frontend slice whose scope is the accepted directory shell only.
