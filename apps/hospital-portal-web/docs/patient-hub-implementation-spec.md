# Patient Hub — Implementation Spec

Single source of truth for the **Patient Hub** (lookup list) and **Patient Record** (profile, encounter, export). Implements a unified patient roof across OPD, IP, counselling, insurance/CCMS, billing, camps, and queues.

**Related docs:** [counselling-ui-component-registry.md](./counselling-ui-component-registry.md) (UI patterns), [master-data-integration-matrix.md](./master-data-integration-matrix.md).

**Feature flag:** ~~`NEXT_PUBLIC_PATIENT_HUB_V2=true`~~ **Removed** — Patient Hub is always enabled (Phase 5).

**Theme:** Emerald primary + navy sidebar (`globals.css`). Reference mockups may use purple; map accents to emerald.

### 0.3 Design tokens (hub / record)

Documented Tailwind conventions (no new CSS variables required):

| Token | Usage |
|-------|--------|
| Underline tab | `border-b-2 border-emerald-600`, active `text-emerald-800 font-semibold` |
| Row card | `rounded-lg border border-gray-100`, selected `border-l-4 border-l-emerald-600 bg-emerald-50/70` |
| Acuity dots | `low` gray · `medium` amber · `high` orange · `critical` red |
| Station / engagement chips | `HUB_ENGAGEMENT_STYLES` / `HUB_PROGRAM_STYLES` in `patient-hub-row-display.ts` |
| Preview vitals card | `rounded-xl border border-gray-200 bg-gray-50 p-3` |
| Split pane (docked preview) | List ~58% · panel `w-[42%] max-w-[480px] min-w-[360px]` |
| Preview mode storage | `localStorage` key `patient-hub-preview-mode`: `docked` \| `floating` |

---

## 1. Vision

| Route | Purpose |
|-------|---------|
| `/dashboard/patients` | **Patient Hub** — search, classify, preview, navigate (list only) |
| `/dashboard/patients/[id]` | **Patient Record** — full profile, tabs, bento overview |
| `/dashboard/patients/[id]/encounter/[visitId]` | **Encounter** — HPI, vitals, PE, meds (Phase 4) |
| `/dashboard/patients/[id]/summary/print` | **Print summary** (Phase 2) |

All modules (counsellor desk, doctors desk, frontdesk, IP, CCMS, camps, specialty clinics) deep-link into these routes via `lib/patients/patient-routes.ts`.

---

## 2. Locked product decisions

| Topic | Decision |
|-------|----------|
| Care program | Specialty tracks: Cataract, Glaucoma, Retina, **LASIK** → DB code `REFRACTIVE` |
| Assigned to me | Open encounter where `visits.assigned_to = current user` |
| PHI in search UI | **Full MRN and full phone** in list + autosuggest |
| List route | `/dashboard/patients` = list only (no inline widget grid) |
| Profile route | `/dashboard/patients/[id]` = full patient record |
| List interaction | **Row click → preview drawer**; **name click → full profile** |
| Advanced filters (v1) | **Right Sheet** (not dedicated query-builder page) |
| Branch scoping | Always filter by user's selected `branchId` |
| Current tab | **All active engagements** — OPD, IP, counselling, insurance, billing, camp, queue, etc. |
| High priority | **Clinical acuity first**, then queue priority |
| Multi-tab patient charts | **Phase 3** |
| Export | **CSV + print + PDF** patient summary |
| Discharged tab | Clinical discharge only; outstanding billing = separate badge |
| Camp OPD | In **Current** when checked in or camp-registered today |
| Primary engagement column | Highest acuity engagement drives Reason + Schedule |
| PDF scope | Full 10-section clinical snapshot + hospital letterhead |

### Defaults (confirmed for implementation)

- **PDF:** Demographics, engagements, allergies/alerts, diagnoses, meds, vitals, recent visits, insurance, balance, generated metadata.
- **One row per patient** with multiple `activeEngagements[]` badges (not one row per workflow).

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Patient Hub (/dashboard/patients)                              │
│  Toolbar → Tabs → Table (+ pagination) → Preview panel          │
│  xl+: docked split OR floating drawer; <xl: overlay / bottom    │
└───────────────────────────┬─────────────────────────────────────┘
                            │ name click
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  Patient Record (/dashboard/patients/[id])                      │
│  Summary header → Tabs → Bento / Timeline → Recent visits rail   │
└───────────────────────────┬─────────────────────────────────────┘
                            │ continue encounter
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  Encounter (/patients/[id]/encounter/[visitId])                 │
│  HPI pills → Vitals capture → PE notes → Med quick-add          │
└─────────────────────────────────────────────────────────────────┘

Backend: PatientLookupService + AcuityScoringService + PatientSummaryService
         + engagement aggregation (BFF) across auth-service + external APIs
```

### Engagement sources (unified “Current” tab)

| Type | Active rule | Source |
|------|-------------|--------|
| OPD | Visit not completed/cancelled | `visits` |
| Queue | waiting / in-consultation | `queue_items`, visit station |
| IP | Active journey, not discharged | ip-management `PatientJourney` |
| Counselling | Session not in terminal state | counselling-service |
| Insurance/CCMS | Active pre-auth / draft case | CCMS coverage cases |
| Billing | At billing station or outstanding balance | billing API + visit |
| Camp | `IsCampPatient` or camp reg + checked in today | IP journey + camp module |

---

## 4. Classification tabs

| Tab | Filter (branch-scoped, dedupe by `patient_id`) |
|-----|------------------------------------------------|
| **All** | No extra filter |
| **Current** | ≥1 active engagement (see §3) |
| **New** | Registered in last 30 days (configurable) |
| **Discharged** | No active engagement; last encounter/journey completed (clinical) |
| **High priority** | `clinicalAcuity >= high` OR queue emergency/urgent; sort acuity ↓ then queue ↓ |

**Engagement / patient type filters** (chips in toolbar + advanced sheet — not separate top-level tabs):

- Engagement: OPD · IP · Counselling · Insurance · Billing · Camp · …
- Patient type: Cash · Insurance · CGHS · Camp · … (`patient-type-master`)
- Care program: Cataract · LASIK · Glaucoma · Retina → `department_code`

---

## 5. Clinical acuity scoring

`AcuityScoringService.Compute(patientId, branchId)` → `low | medium | high | critical`.

| Signal | Weight |
|--------|--------|
| Emergency visit / `is_emergency` | Critical |
| Critical unacknowledged lab | Critical |
| Severe allergy on file | High |
| Flagged abnormal vitals (latest) | High |
| `PatientNote.priority = critical` | High |
| IP urgent clinical state | High |
| Default | Low |

**High priority sort:** clinical acuity (desc) → queue priority (emergency > urgent > follow-up > normal) → wait time / appointment time.

---

## 6. UI specification — Patient Hub

### 6.1 Layout

| Zone | Content |
|------|---------|
| Header | Title “Patients”, count, **Add Patient**, Export CSV, Merge, Refresh |
| Toolbar | `PatientSearchAutosuggest` (patients only), Filters, Favorites, Assigned to me, `PatientFilterChips` |
| Tabs | Underline classification: All · Current · New · Discharged · High priority (+ count badges) |
| Table | `PatientHubTable` (desktop) / `PatientHubMobileCards` (`md:hidden`), 25/page; **sticky** hub header + table `thead` |
| Pagination | `PatientHubPagination` — “Showing X–Y of Z” + numbered pages |
| Preview | **Docked** (`xl+`, default): `PatientPreviewSplitPane` → `PatientPreviewPanel`. **Floating**: `PatientPreviewDrawer` (overlay). **&lt; md**: bottom sheet. Toggle persisted in `patient-hub-preview-mode`. |

**URL:** `?preview={patientId}` when preview open; filter/tab/page params unchanged.

### 6.2 Table columns (merged ophthalmology model)

| # | Column | Sortable | Notes |
|---|--------|----------|-------|
| ☐ | Select | — | Page bulk select; selection bar when ≥1 |
| ★ | Favorite | — | Star toggle |
| 1 | **Patient** | `name` | Avatar, name link, `MRN · age · gender`, phone line |
| 2 | **Reason / visit** | — | `ReasonVisitCell` + visit-type chip |
| 3 | **Schedule** | `scheduledAt` | Open-visit datetime |
| 4 | **Queue / station** | `waitingMinutes` | `QueueStationCell` — wait · station · room; IP ward |
| 5 | **Acuity** | `acuity` | `AcuityDot` + tooltip / `sr-only` |
| 6 | **Highlights** | — | `HighlightsPills` — programs + engagements, `+N` |
| 7 | **Assigned** | — | Provider + role; hidden when docked (`xl`/`2xl`) |
| 8 | **Actions** | — | View · Check-in · ⋮ (`PatientHubRowActions`) |

Removed standalone columns: MRN, Contact, Last visit, Care program, Engagements (merged above).

### 6.3 Row interaction

| Action | Behavior |
|--------|----------|
| **Name click** | Navigate `/dashboard/patients/[id]` (`stopPropagation`) |
| **Row click** | Open/update preview; emerald left bar when selected |
| **Re-click same row** | Close preview |
| **Star / actions** | `stopPropagation` |
| **URL** | `?preview={patientId}` when preview open |

### 6.4 Autosuggest & omnisearch

**Hub inline (`PatientSearchAutosuggest`):**

- Min **2** characters; debounce 250ms; patients only
- Footer hint: “Search all categories with Ctrl+K”
- Ranking: exact MRN → MRN prefix → name → phone (`PatientLookupRanking`)

**Global (`PatientGlobalSearch` + `OmnisearchTabs`, Ctrl+K):**

| Tab scope | Action on select |
|-----------|------------------|
| Patients | Profile |
| Care programs | Hub `?programCodes=` |
| Conditions | Hub `?diagnosis=` |
| Procedures | Hub `?q=` |
| Providers | Hub `?providerId=` |
| Insurance | Hub filters / profile `?tab=insurance` |
| IP | Hub `?engagementTypes=ip` |
| Camps | Hub `?engagementTypes=camp` |

API: `GET /api/patients/omni-search?branchId=&scope=&q=&limit=`

### 6.5 Advanced filter sheet

Right `Sheet` (`sm:max-w-lg`), sections:

1. **Recent patients** — horizontal avatar row (top)
2. **Quick filters** — checkboxes: Favorites · Assigned to me
3. **Identity** — Name, DOB range, MRN, Phone, Gender (icon inputs)
4. **Clinical** — diagnosis search
5. **Schedule** — appointment + admission ranges
6. **Provider & location** — department, provider, ward
7. **Care programs** — pills: Cataract, Glaucoma, Retina, Cornea, LASIK
8. **Engagements** — OPD · Queue · IP · Counselling · Insurance · Camp · Billing
9. **Patient type** — Cash · Insurance · …
10. **Saved filters** — `PatientSavedFiltersSection`

Footer: **Clear** (text, left) · **Apply** (emerald, right) → chips + URL sync.

### 6.6 Preview panel

Shared body: `PatientPreviewPanel` (used by split pane + drawer).

- **Header:** Avatar, identity, IP/acuity/engagement pills, Call, Dock↔Float (`PreviewModeToggle`, `xl+`), Expand, Close
- **Cards:** Visit info · Emergency contact · Vitals grid (friendly empty; no placeholder VA/IOP cards)
- **Sub-tabs:** Vitals · **Eye** (VA/IOP) · Records · Meds · Labs
- **Visit card:** Reason may show **OD/OS/OU** laterality chip when inferable from text
- **Footer:** Continue encounter (if assigned) · Open full profile · Check-in · Print
- **PHI:** `logPhiAccess(preview)` + `recordRecentView` on open

---

## 7. UI specification — Patient Record

### 7.1 Shell (Phase 2–3)

Extract from `PatientDetailsModal` into `PatientRecordPage` + `PatientRecordProvider` (shared with preview drawer and embedded modal).

```
← Patients    [◀ ▶ prev/next]                    [Actions ⋮]
┌─ STICKY SUMMARY HEADER ─────────────────────────────────────┐
│ Avatar | Name (age, gender) | MRN | Visit type | Reason    │
│ PCP | Acuity pill | Program pills | Risk tags | Phone      │
├──────────────────────────────┬──────────────────────────────┤
│ MAIN TABS                    │ RECENT VISITS RAIL           │
│ Overview | Vitals | …        │ + New Visit                  │
└──────────────────────────────┴──────────────────────────────┘
```

### 7.2 Overview bento (screenshot 1)

| Card | Source |
|------|--------|
| Medical history | `MedHistoryTab` summary, allergy pills |
| Vitals | Latest vitals API |
| Files & documents | `DocumentsTab` top 3 + upload |
| Forms | Table: title, assign date, type, status (stub until forms API) |
| Activity bar | Consultation / surgery / no-show counts |

### 7.3 Grouped tabs (`PatientRecordTabGroups`)

**Row 1 — segment:** Clinical · Admin · Billing

**Row 2 — visible tabs in active group** (+ **More** dropdown for overflow in Clinical):

| Group | Visible tabs | More (Clinical overflow) |
|-------|----------------|---------------------------|
| **Clinical** | Overview, Vitals, Eye history, Examinations, Diagnoses, Medications, Lab results, Imaging | Medical records, Allergies, Prescriptions, Optical, Queue, Referrals, Notes, Communications, Feedback, Portal |
| **Admin** | Documents, Encounters, Visits, Scheduling, Consents | — |
| **Billing & pathways** | Billing, Insurance, Admissions, Counseling, Surgery, Pre-op, Procedures | — |

- URL `?tab=` unchanged; group auto-resolves from active tab
- **Quick actions:** Check-in · Emergency · Book appt (primary); **More actions** dropdown (Counselor, Pre-auth near top)

### 7.4 Phase 3 additions

- **Multi-tab workspace** — horizontal patient tabs (screenshot 1), max ~8, LRU eviction
- **Patient switcher rail** — recent + search (screenshot 4)
- **Customize charts** — widget layout editor, `user_chart_layout` JSON
- **Timeline** — year filter, `TimelineTab`

### 7.5 Data quality

| Banner | Trigger |
|--------|---------|
| Incomplete record | Missing phone, emergency contact, allergies NKDA, etc. |
| Duplicate hint | `POST /patients/check-duplicates` on profile load |
| Stale vitals | BP/glucose/IOP past threshold — “Record now?” |

### 7.6 Security on record

- Port `BlockedTabContent` + `EmergencyOverrideDialog` check-in gates
- `VIEW_PHI` on sensitive tabs
- PHI audit on profile open

---

## 8. UI specification — Encounter (Phase 4)

Route: `/dashboard/patients/[id]/encounter/[visitId]`

| Section | UI |
|---------|-----|
| Header | `PatientContextBar` pattern |
| HPI | Pill groups by category → structured JSON + free text |
| Vitals | Toggle chips; steppers for HR/temp; dual inputs for BP; IOP/VA for ophthalmology |
| Physical exam | Textarea + templates |
| Medications | Suggested one-click + custom add |

Unify with `DoctorExaminationForm` + optometry patterns — avoid a third parallel form stack.

---

## 9. Export

| Format | Phase | Route / API |
|--------|-------|-------------|
| **CSV** | 2 | `GET /api/patients/lookup/export?format=csv` — server-side for current filters |
| **Print** | 2 | `/dashboard/patients/[id]/summary/print` — `@media print` |
| **PDF** | 3 | `GET /api/patients/{id}/summary/export?format=pdf` — server PDF + letterhead |

**PDF sections:** demographics, active engagements, allergies/alerts, diagnoses, current meds, latest vitals, recent visits (5), insurance, outstanding balance, generated at/by.

**Permissions:** `patient.export` · **Audit:** `EXPORT_CSV`, `PRINT`, `EXPORT_PDF`, `VIEW_PHI`.

---

## 10. API contract

### 10.1 Lookup

```
GET /api/patients/suggest?branchId=&q=&limit=
GET /api/patients/lookup?branchId=&page=&pageSize=&sortBy=&sortDir=&q=&tab=&...
GET /api/patients/lookup/stats?branchId=
GET /api/patients/lookup/export?format=csv&...
GET /api/patients/omni-search?branchId=&scope=&q=&limit=
PUT /api/patients/{id}/favorite
```

**Omni-search scopes:** `patients` · `care_programs` · `conditions` · `procedures` · `providers` · `insurance` · `ip` · `camps`

**Lookup sort:** `name` · `mrn` · `lastvisit` · `scheduledat` · `acuity` · `waitingminutes`

**Branch rule:**

```sql
tenant_id = @tenantId
AND deleted_at IS NULL
AND (branch_id IS NULL OR branch_id = @branchId)
```

### 10.2 Profile

```
GET /api/patients/{id}/summary?branchId=
GET /api/patients/{id}/visits/recent?limit=
GET /api/patients/{id}/data-quality
GET /api/patients/{id}/vitals/staleness
GET /api/patients/{id}/vitals/latest          (exists)
GET /api/patients/{id}/summary/export?format=pdf
```

### 10.3 Vitals (Phase 2 — close gap)

```
GET  /api/vitals/patient/{id}?limit=
POST /api/vitals/patient/{id}
```

Wire `widgets.api.ts` `getVitalsHistory` / `recordVitals` (currently calls missing controller).

### 10.4 Clinical (Phase 4)

```
GET /api/clinical/hpi-templates
GET /api/clinical/medication-suggestions?patientId=&diagnosis=
```

### 10.5 Saved filters

Reuse `SearchController`: `SaveSearch`, `GetUserSavedSearches`, `ExecuteSavedSearch` with `SearchScope.Patient`.

### 10.6 Lookup row DTO

```typescript
type PatientLookupRow = {
  id: string;
  firstName: string;
  lastName: string;
  mrn: string;
  dateOfBirth: string;
  gender: string;
  phone?: string;
  email?: string;
  photoThumbnailUrl?: string;
  isFavorite: boolean;
  lastVisitAt?: string;
  careProgramCodes?: string[];
  reasonForVisit?: string;
  scheduledAt?: string;
  clinicalAcuity: 'low' | 'medium' | 'high' | 'critical';
  queuePriority?: 'normal' | 'urgent' | 'emergency' | 'follow-up';
  activeEngagements: Array<{
    type: 'opd' | 'ip' | 'counselling' | 'insurance' | 'billing' | 'camp' | 'queue';
    label: string;
    status?: string;
    priority?: string;
    deepLink?: string;
    since?: string;
  }>;
  waitingMinutes?: number | null;
  currentStation?: string | null;
  roomNumber?: string | null;
  assignedProviderRole?: string | null;
  assignedProviderName?: string | null;
};
```

**Summary vitals (preview / profile):** `latestVitals` may include `visualAcuityOd`, `visualAcuityOs`, `iopOd`, `iopOs` (omitted when absent).

---

## 11. Database

### 11.1 New tables

| Table | Columns (key) | Phase |
|-------|-----------------|-------|
| `patient_favorites` | tenant_id, user_id, patient_id, created_at UNIQUE | 1–2 |
| `patient_recent_views` | tenant_id, user_id, patient_id, viewed_at | 2 (optional localStorage in P1) |
| `user_chart_layout` | user_id, layout_json | 3 |

### 11.2 Seeds & master data

| Item | Phase |
|------|-------|
| Department `REFRACTIVE` — “LASIK & Refractive Surgery” | 1 |
| Master group `clinical.specialty_track`: CATARACT, GLAUCOMA, RETINA, REFRACTIVE | 1 |
| Master group `clinical.hpi_template` | 4 |
| Master group `clinical.pe_template` | 4 |

**Files:** `SeedController.cs`, `Program.cs` dev seed, `MasterValueService.cs`.

### 11.3 Indexes

- `patients (tenant_id, medical_record_number)`
- `patients (tenant_id, branch_id)`
- `patients (tenant_id, last_name, first_name)`
- `visits (tenant_id, branch_id, patient_id, status)`
- `patient_vital_signs (patient_id, measurement_date)`

### 11.4 Optional optimization (Phase 5)

- Materialized `patient_active_engagement` if live aggregation is slow
- `pg_trgm` on name/MRN for fuzzy search

---

## 12. Frontend module structure

```
app/dashboard/patients/
  page.tsx                              → PatientHubPage (feature flag)
  [id]/page.tsx                         → PatientRecordPage
  [id]/encounter/[visitId]/page.tsx     → EncounterPage (P4)
  [id]/summary/print/page.tsx           → PrintSummaryPage (P2)

components/patients/
  lookup/
    PatientHubPage.tsx
    PatientHubToolbar.tsx
    PatientSearchAutosuggest.tsx
    PatientClassificationTabs.tsx
    PatientLookupTable.tsx
    PatientLookupRow.tsx
    PatientFilterChips.tsx
    PatientAdvancedFilterSheet.tsx
    PatientPreviewDrawer.tsx
    PatientHubEmptyStates.tsx
  record/
    PatientRecordPage.tsx
    PatientRecordProvider.tsx
    PatientSummaryHeader.tsx
    PatientOverviewBento.tsx
    RecentVisitsRail.tsx
    PatientRecordTabs.tsx
    PatientDataQualityBanner.tsx
    StaleVitalsPrompt.tsx
    PatientSwitcherRail.tsx           (P3)
    ChartLayoutEditor.tsx             (P3)
    PatientWorkspaceTabs.tsx          (P3)
  encounter/                          (P4)
    EncounterPage.tsx
    HpiPillSelector.tsx
    VitalsCaptureCard.tsx
    PhysicalExamNotes.tsx
    MedicationQuickAdd.tsx
  tabs/                               (existing — import into record)
  widgets/                            (existing — migrate from PatientDirectoryHub)

hooks/
  use-patient-lookup.ts
  use-patient-search-suggest.ts
  use-patient-favorites.ts
  use-patient-record.ts

lib/patients/
  patient-lookup-types.ts
  patient-lookup-mappers.ts
  patient-lookup-api.ts
  patient-disambiguation.ts
  patient-routes.ts
  patient-lookup-test-ids.ts
```

---

## 13. Reuse & deprecation

### Reuse

| Asset | Use |
|-------|-----|
| `PatientAvatar`, `patient-display-utils` | Avatars, DOB, phone, MRN |
| `PatientDemographicsSheet` | Base for preview drawer |
| `PatientDetailsModal` + 24 tabs | Extract to `PatientRecordPage` |
| `PatientContextBar`, `CompactExamPatientStrip` | Encounter header |
| `useDebouncedValue` | Search debounce |
| `DuplicatePatientWarningDialog` | Data quality |
| `CheckInDialog`, `TokenSlip` | Row/drawer actions |
| `SearchService` / `SearchController` | Saved filters |
| `FrontdeskController` branch search | Reference for suggest ranking |
| shadcn: Sheet, Command, Popover, Calendar, Badge, Tabs | All new UI |

### Deprecate (after Phase 2 stable)

- ~~`PatientDirectoryHub` on `/dashboard/patients`~~ — retired; route serves `PatientHubPage`
- ~~`PatientsManagement.tsx`, `EnhancedPatientsPage.tsx`~~ — removed (orphan routes)
- ~~Client-side full-patient load + mock KPI filters in hub~~ — retired
- ~~Vitals mocks in `VitalsTrendsWidget`, `VitalsFlowsheetTab`~~ — wired to `getVitalsHistory`
- ~~Fragmented search paths~~ — unified via `searchPatientsUnified` / `patientLookupApi.suggest` (Phase 5)

**Removed in cleanup pass:** `NewPatientModal_temp`, `ComposeCommunicationModal`, `QueueDisplayTV`, `use-pre-admission-checklist`, `use-insurance` (legacy hooks).

---

## 14. Role-based actions (matrix)

| Role | List emphasis | Primary actions |
|------|---------------|-----------------|
| Front desk | Schedule, Current, New | Check-in, register, book appointment |
| Nurse | Current, High priority | Vitals, forms |
| Doctor | Assigned to me, High priority | Continue encounter, profile |
| Counsellor | Counselling engagement filter | Open counselling session |
| Billing | Bill due badge | Billing summary, collect payment |

Implement via `hasPermission` + column/action presets (document per role in Phase 0).

---

## 15. Integrations

| Module | Integration |
|--------|-------------|
| Counsellor desk | Waiting list → hub; session header → `[id]` |
| Doctors desk | Queue → hub / encounter |
| Frontdesk | Unified suggest API |
| IP management | Current tab + IP badge; `PatientQuickPanel` fields align with preview drawer |
| CCMS | Insurance engagement badge + profile insurance tab |
| Billing | Outstanding badge + summary API |
| Eye camps | Camp badge + `patientType=Camp` |
| Specialty clinics | `?programCodes=` filter (Phase 5) |
| Optometry | `PatientContextBar` shared with encounter |

**Deep links:** `patientProfileUrl(id)`, `patientEncounterUrl(id, visitId)` in `patient-routes.ts`.

---

## 16. Testing

| Phase | Tests |
|-------|-------|
| 1 | Unit: ranking, branch filter, mappers; API: pagination, tenant isolation; E2E: `e2e/patient-hub.spec.ts` smoke |
| 2 | E2E: drawer, filters, favorites, assigned-to-me, engagements, print, CSV |
| 3 | E2E: profile tabs, PDF, workspace tabs, prev/next |
| 4 | E2E: encounter HPI + vitals save |
| 5 | Regression full suite; load test lookup |

**Test IDs:** `lib/patients/patient-lookup-test-ids.ts` (mirror `coverage-test-ids.ts`).

---

## 17. Phase-by-phase implementation

### Phase 0 — Foundation (1 week)

| # | Task |
|---|------|
| 0.1 | Approve this spec |
| 0.2 | Branch switcher in `TopNav` + `BranchContext` |
| 0.3 | `patient-lookup-test-ids.ts` + UI reuse list |
| 0.4 | `PatientRecordProvider` design doc in code comments |
| 0.5 | Feature flag `NEXT_PUBLIC_PATIENT_HUB_V2` |
| 0.6 | Role × action matrix (§14) signed off |

**Exit:** Branch selection works; team aligned on phases.

---

### Phase 1 — Patient Hub MVP (3 weeks)

**DB:** `patient_favorites`, `REFRACTIVE` seed, `clinical.specialty_track`, indexes.

**BE:**

- [ ] `PatientLookupService` + suggest / lookup / stats
- [ ] Branch validation on all endpoints
- [ ] Favorites toggle
- [ ] Phase 1 Current = OPD open visit + queue only
- [ ] Basic queue priority on High priority tab

**FE:**

- [ ] `patient-lookup-api.ts` + TanStack Query hooks
- [ ] `PatientHubPage` behind flag
- [ ] Toolbar, autosuggest, classification tabs, table, pagination
- [ ] Name → `[id]` minimal shell (back link, name, MRN)
- [ ] Emerald theme; skeleton rows
- [x] `e2e/patient-hub.spec.ts` — hub smoke, sort, bulk select, pagination, dock/float, mobile sheet, omnisearch, record tab groups

**Exit:** No full-patient client load; branch required; flag demoable.

---

### Phase 2 — Preview, filters, unified Current, vitals, print (3–4 weeks)

**DB:** `patient_recent_views` (optional); vitals indexes; PHI audit wiring.

**BE:**

- [ ] Engagement aggregation: OPD + IP + queue + counselling + CCMS + billing + camp
- [ ] `AcuityScoringService`
- [ ] Extended lookup query params (§10.1)
- [ ] `GET /patients/{id}/summary`, visits/recent, data-quality, vitals/staleness
- [ ] `VitalsController` GET/POST
- [ ] CSV export + PHI audit
- [ ] Saved filter via `SearchController`

**FE:**

- [ ] `PatientPreviewDrawer` (row click, `?preview=`)
- [ ] `PatientAdvancedFilterSheet` + chips + URL sync
- [ ] Engagement badges on rows
- [ ] Data quality banners on profile/preview
- [ ] Print summary page
- [ ] Retire `PatientDirectoryHub` on route
- [ ] Check-in on row/drawer actions
- [ ] Wire vitals widgets (remove mocks)

**Exit:** Unified Current; drawer complete; real vitals; CSV + print.

---

### Phase 3 — Patient Record, PDF, multi-tab (4 weeks)

**DB:** `user_chart_layout`.

**BE:**

- [ ] PDF export endpoint
- [ ] Wire billing summary, timeline, labs (remove mocks)
- [ ] PHI audit on PDF

**FE:**

- [ ] `PatientRecordPage` + `PatientRecordProvider` (extract modal)
- [ ] Summary header, Overview bento, recent visits rail
- [ ] Full tab set from modal
- [ ] `PatientWorkspaceTabs` (multi-tab charts)
- [ ] `PatientSwitcherRail`, `ChartLayoutEditor`
- [ ] Prev/next patient navigation
- [ ] Wire `QuickActionsToolbar` (remove TODOs)
- [ ] `BlockedTabContent` + emergency override on page
- [ ] PDF download button

**Exit:** `[id]` is primary record; PDF works; modal only for embeds.

---

### Phase 4 — Encounter documentation (3 weeks)

**DB:** HPI/PE master values.

**BE:** HPI templates, medication suggestions, examination draft persistence.

**FE:**

- [ ] `EncounterPage` + HPI pills + vitals card + PE + med quick-add
- [ ] Continue encounter CTA from preview/profile
- [ ] Unify with `DoctorExaminationForm`

**Exit:** Document visit end-to-end within patient hub routes.

---

### Phase 5 — Consolidation & polish (3–4 weeks)

- [x] TopNav omnisearch (`Ctrl+K`)
- [ ] Advanced search page (query builder + saved queries) — optional
- [x] Unify all legacy patient search implementations
- [x] Specialty clinic routes → lookup API
- [x] Patient merge admin UI + backend
- [x] SignalR list invalidation on visit events
- [x] Mobile card layout; virtualized table
- [x] a11y audit (aria labels, favorite buttons, table label)
- [ ] Delete deprecated code
- [x] Load testing (`scripts/load-test-patient-lookup.mjs`)

**Exit:** Single patient platform; no duplicate search paths.

---

### Phase 6 — Backlog

- Dictation / voice notes
- CCM care-plan backend (goals, quality measures)
- Server-persisted workspace tabs
- Fuzzy search (`pg_trgm`)
- ABAC department filtering on list

---

## 18. Master checklist

Use this to verify nothing is missed before closing each phase.

### Database
- [x] `patient_favorites`
- [x] `patient_recent_views`
- [x] `REFRACTIVE` department
- [x] `clinical.specialty_track` master values
- [x] Indexes (patients, visits, vitals)
- [x] `user_chart_layout`
- [x] HPI/PE master values
- [x] PHI audit integration

### Backend
- [x] suggest / lookup / stats / export
- [x] Engagement aggregation (full roof + CCMS coverage-case signal)
- [x] AcuityScoringService
- [x] summary / visits/recent / data-quality / vitals/staleness
- [x] VitalsController
- [x] Favorites
- [x] CSV + PDF export
- [x] Saved filters (SearchController)
- [x] PHI audit middleware
- [x] Branch validation
- [x] HPI + med suggestions
- [x] Patient merge

### Frontend — Hub
- [x] PatientHubPage + flag
- [x] Branch switcher
- [x] Autosuggest
- [x] Classification tabs
- [x] Table + pagination
- [x] Row drawer / name profile
- [x] Advanced filter sheet
- [x] Engagement badges
- [x] Favorites + assigned to me
- [x] TanStack Query
- [x] Test IDs + E2E

### Frontend — Record
- [x] PatientRecordPage + Provider
- [x] Summary header + acuity
- [x] Overview bento
- [x] Recent visits rail
- [x] Tabs migrated from modal
- [x] Data quality + stale vitals
- [x] Multi-tab workspace
- [x] Switcher rail + customize charts
- [x] Prev/next
- [x] Quick actions
- [x] Check-in gates
- [x] Print + PDF

### Frontend — Encounter
- [x] Encounter route
- [x] HPI / vitals / PE / meds

### Cross-cutting
- [x] `patient-routes.ts` deep links
- [x] Module integrations (§15)
- [x] Permissions + PHI audit
- [x] Deprecations (§13)

---

## 19. Timeline estimate

| Phase | Duration | Cumulative |
|-------|----------|------------|
| 0 Foundation | 1 week | 1 week |
| 1 Hub MVP | 3 weeks | 4 weeks |
| 2 Drawer + Current + vitals + print | 3–4 weeks | 7–8 weeks |
| 3 Record + PDF + multi-tab | 4 weeks | 11–12 weeks |
| 4 Encounter | 3 weeks | 14–15 weeks |
| 5 Polish | 3–4 weeks | 17–19 weeks |

---

## 20. First implementation PR (recommended)

1. Migration: `REFRACTIVE` + `patient_favorites` + indexes  
2. `PatientLookupService` — suggest, lookup, stats  
3. Branch switcher (Phase 0)  
4. `PatientHubPage` behind flag on `/dashboard/patients`  
5. Minimal `[id]` shell  
6. `e2e/patient-hub.spec.ts` smoke test  

---

## 21. Care program mapping

| UI label | `department_code` | Display name (seed) |
|----------|-------------------|---------------------|
| Cataract | `CATARACT` | Cataract & Anterior Segment |
| Glaucoma | `GLAUCOMA` | Glaucoma |
| Retina | `RETINA` | Retina & Vitreous |
| LASIK | `REFRACTIVE` | LASIK & Refractive Surgery |

Filter: patient has qualifying visit at branch with matching `visit.department_id`. UI pill label for `REFRACTIVE` is **“LASIK”**.

---

*Last updated: 2026-06-16 — P1 widgets wired, HPI/PE master data, SignalR hub refresh, saved filters, patient merge.*
