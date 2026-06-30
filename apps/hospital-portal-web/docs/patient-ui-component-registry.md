# Patient Hub UI Component Registry

Single source of truth for Patient Hub / Patient Record components, primitives, and `data-testid` conventions.

## Policy

1. **Hub & record** (`components/patients/lookup/**`, `components/patients/record/**`, `components/patients/encounter/**`) use shared patient lib helpers under `@/lib/patients/*`.
2. **Patient search** must go through `@/lib/patients/unified-patient-search` → `patientLookupApi.suggest` (branch-scoped). Do not add new `/patients/search` multi-call patterns.
3. **E2E** uses `patientLookupTestIds` and `patientEncounterTestIds` — add test IDs when introducing interactive hub/record UI.

## Routes

| Route | Component |
|-------|-----------|
| `/dashboard/patients` | `PatientHubPage` |
| `/dashboard/patients/[id]` | `PatientRecordPage` + `PatientRecordProvider` |
| `/dashboard/patients/[id]/encounter/[visitId]` | `EncounterPage` |
| `/dashboard/patients/merge` | Merge admin (gated `patient.update`) |

## Hub components

| Component | Path | Purpose |
|-----------|------|---------|
| `PatientHubPage` | `lookup/PatientHubPage.tsx` | Main list: tabs, filters, table / mobile cards, preview split |
| `PatientHubTable` | `lookup/PatientHubTable.tsx` | Desktop merged-column table |
| `PatientHubClassificationTabs` | `lookup/PatientHubClassificationTabs.tsx` | Underline All / Current / … tabs |
| `PatientHubPagination` | `lookup/PatientHubPagination.tsx` | Page numbers + range label |
| `PatientHubMobileCards` | `lookup/PatientHubMobileCards.tsx` | Responsive card layout (`md:hidden`) |
| `PatientSearchAutosuggest` | `lookup/PatientSearchAutosuggest.tsx` | Hub inline search → unified suggest |
| `PatientGlobalSearch` | `lookup/PatientGlobalSearch.tsx` | Ctrl+K omnisearch dialog |
| `OmnisearchTabs` | `lookup/OmnisearchTabs.tsx` | Scope tabs inside omnisearch |
| `PatientAdvancedFilterSheet` | `lookup/PatientAdvancedFilterSheet.tsx` | Advanced filters + URL sync |
| `PatientFilterChips` | `lookup/PatientFilterChips.tsx` | Active filter chips |
| `PreviewModeToggle` | `lookup/PreviewModeToggle.tsx` | Docked ↔ floating preview |
| `PatientPreviewSplitPane` | `lookup/PatientPreviewSplitPane.tsx` | List + docked panel layout (`xl+`) |
| `PatientPreviewPanel` | `lookup/PatientPreviewPanel.tsx` | Shared preview body (cards, sub-tabs, footer) |
| `PatientPreviewDrawer` | `lookup/PatientPreviewDrawer.tsx` | Floating / mobile preview shell |
| `PatientPreviewTabPanels` | `lookup/PatientPreviewTabPanels.tsx` | Preview tabs (vitals, records, meds, labs) |
| `PreviewVitalsGrid` | `lookup/PreviewVitalsGrid.tsx` | Preview vitals card grid |
| `AcuityDot` | `lookup/AcuityDot.tsx` | Acuity color dot + `sr-only` label |
| `QueueStationCell` | `lookup/QueueStationCell.tsx` | Wait · station · room (or IP ward) |
| `HighlightsPills` | `lookup/HighlightsPills.tsx` | Care program + engagement pills |
| `ReasonVisitCell` | `lookup/ReasonVisitCell.tsx` | Reason for visit + type chip |
| `PatientHubRowActions` | `lookup/PatientHubRowActions.tsx` | Row action menu |
| `BranchSwitcher` | `lookup/BranchSwitcher.tsx` | Branch context |
| `IpAdmittedBadge` | `lookup/IpAdmittedBadge.tsx` | IP admission pill |
| `PatientRecentPatientsSection` | `lookup/PatientRecentPatientsSection.tsx` | Recent views rail |
| `PatientSavedFiltersSection` | `lookup/PatientSavedFiltersSection.tsx` | Saved filter presets |
| `PatientDataQualityBanner` | `lookup/PatientDataQualityBanner.tsx` | Missing-field warnings |
| `PatientHubSelectionBar` | `lookup/PatientHubSelectionBar.tsx` | Bulk row selection count + clear |

## Record & encounter

| Component | Path | Purpose |
|-----------|------|---------|
| `PatientRecordPage` | `record/PatientRecordPage.tsx` | Full chart shell + tab routing |
| `PatientRecordTabGroups` | `record/PatientRecordTabGroups.tsx` | Clinical / Admin / Billing segment + overflow |
| `PatientRecordShellHeader` | `lookup/PatientRecordShellHeader.tsx` | Record page header |
| `QuickActionsToolbar` | `patients/QuickActionsToolbar.tsx` | Check-in, emergency, book, More actions |
| `PatientOverviewFormsCard` | `record/PatientOverviewFormsCard.tsx` | Consents on overview |
| `CcmGoalsWidget` / `CcmQualityWidget` | `record/` | CCM read-only placeholders |
| `EncounterPage` | `encounter/EncounterPage.tsx` | Visit documentation shell |
| `EncounterHpiSection` | `encounter/EncounterHpiSection.tsx` | HPI pills + free text |
| `EncounterVitalsSection` | `encounter/EncounterVitalsSection.tsx` | Vitals capture |
| `EncounterPhysicalExamSection` | `encounter/EncounterPhysicalExamSection.tsx` | PE templates |
| `EncounterMedicationsSection` | `encounter/EncounterMedicationsSection.tsx` | Med quick-add |

## Shared search (import these)

| Module | Use for |
|--------|---------|
| `@/lib/patients/unified-patient-search` | `searchPatientsUnified`, `unifiedHitToPatient` |
| `@/lib/api/patient-lookup.api` | `suggest`, `lookup`, `exportCsv`, favorites, `omniSearch` |
| `@/lib/api/frontdesk.api` | Frontdesk board + unified patient search |
| `@/lib/optometry/optometry-patient-search` | Optometry directory (unified first) |
| `PatientSearchCombobox` | Generic combobox (billing, orders, etc.) |
| `PatientSearchSelector` | Walk-in / registration flows |

## Specialty clinics

| Clinic page | Program code (`GET /patients/lookup?programCodes=`) |
|-------------|-----------------------------------------------------|
| Cataract | `CATARACT` |
| Glaucoma | `GLAUCOMA` |
| Retina | `RETINA` |
| Cornea | `CORNEA` |
| LASIK / refractive | `REFRACTIVE` |

Hook: `useSpecialtyClinicPatients(programCode)` → `patientLookupApi.lookup`.

## Lib helpers (unit-tested)

| Module | Tests |
|--------|-------|
| `patient-hub-preview-mode` | `patient-hub-preview-mode.test.ts` |
| `patient-hub-row-display` | `patient-hub-row-display.test.ts` |
| `patient-hub-pagination` | `patient-hub-pagination.test.ts` |
| `patient-omni-search-nav` | `patient-omni-search-nav.test.ts` |
| `patient-record-tabs` | `patient-record-tabs.test.ts` |
| `preview-vitals-helpers` | `preview-vitals-helpers.test.ts` |
| `patient-lookup-filters` | `patient-lookup-filters.test.ts` |
| Hub cell components | `lookup/*.test.tsx` (`AcuityDot`, `QueueStationCell`, `HighlightsPills`) |

## Test IDs

- Hub: `src/lib/patients/patient-lookup-test-ids.ts`
- Encounter: `src/lib/patients/patient-encounter-test-ids.ts`
- E2E: `e2e/patient-hub.spec.ts`

## E2E

`npm run test:e2e:patient-hub` (Playwright project `chromium-hub`, viewport 1400×900).

| Area | Coverage |
|------|----------|
| Hub load | Search, tabs, branch switcher, filters, favorites, export |
| Table | Sort (`acuity`, `scheduledAt`), bulk select bar, pagination page 2 |
| Preview | Split pane ↔ floating drawer toggle; mobile bottom sheet |
| Omnisearch | Ctrl+K, care programs tab, patients → profile |
| Record | Tab groups (clinical/billing), More overflow, workspace tabs, prev/next |
| Encounter | HPI + vitals save smoke |

Helpers: `e2e/helpers/patient-hub.ts`, setup: `e2e/hub.setup.ts`.

```bash
node apps/hospital-portal-web/scripts/load-test-patient-lookup.mjs
```

## IP Ward Pre-Op Workspace

Spec: [ward-preop-workspace-spec.md](./ward-preop-workspace-spec.md)

Route: `/dashboard/ip-management/ward`

### Components (Phases 3–9 — wired)

| Component | Path | Purpose |
|-----------|------|---------|
| `WardPreOpWorkspaceModal` | `components/ip-management/WardPreOpWorkspaceModal.tsx` | Unified Expected / Admitted / ReadyForSurgery shell |
| `WardChecklistStepper` | `components/ip-management/WardChecklistStepper.tsx` | §0–§4 sub-nav inside Ward Checklist tab |
| `InvestigationsResultsPanel` | `components/ip-management/investigations/InvestigationsResultsPanel.tsx` | §1 Investigations & Results |
| `InvestigationResultRow` | `components/ip-management/investigations/InvestigationResultRow.tsx` | Single test: value, verify, upload, preview |
| `InvestigationDocumentPreview` | `components/ip-management/investigations/InvestigationDocumentPreview.tsx` | Inline report preview |
| `DepartmentClearancePanel` | `components/ip-management/department-clearance/DepartmentClearancePanel.tsx` | §2 dept clearance |
| `PacInvestigationSummary` | `components/ip-management/PacInvestigationSummary.tsx` | Read-only lab summary inside PAC §4 |
| `WardPreOpGateBanner` | `components/ip-management/WardPreOpGateBanner.tsx` | Next-transition gate preview |
| `CounsellingPreOpInvestigationsPanel` | `components/counsellors-desk/session/CounsellingPreOpInvestigationsPanel.tsx` | Optional counsellor draft values (Phase 9) |

### Workspace v2 step panels & primitives (Phases 5–12)

| Component | Path | Step / role |
|-----------|------|-------------|
| `ConsentAuthorizationPanel` | `components/ip-management/preop/ConsentAuthorizationPanel.tsx` | ④ single consent writer (Phase 5) |
| `FinancialClearancePanel` | `components/ip-management/preop/FinancialClearancePanel.tsx` | ⑤ single financial source (Phase 6) |
| `FastingMedicationPanel` | `components/ip-management/preop/FastingMedicationPanel.tsx` | ⑥ NPO widget + meds (Phase 7) |
| `AllergyBanner` | _removed (2026-06-29)_ | was a reusable PAC allergy banner (Phase 7); removed from Step ⑥ |
| `ClinicalEvaluationPanel` | `components/ip-management/preop/ClinicalEvaluationPanel.tsx` | ② doctor sign-off + §2 engine (Phase 8) |
| `BedsideSafetyPanel` | `components/ip-management/preop/BedsideSafetyPanel.tsx` | ⑦ WHO sign-in, derived (Phase 10) |
| `PreOpReadinessBar` | `components/ip-management/preop/PreOpReadinessBar.tsx` | sticky top "X of N ready · M blockers" verdict + gate chip (Phase 13) |
| `StatusChip` | `components/ip-management/preop/primitives/StatusChip.tsx` | single status vocabulary (Phase 1) |
| `DerivedTick` | `components/ip-management/preop/primitives/DerivedTick.tsx` | read-only auto-tracked row, `memo` (Phase 1/12) |
| `ReadinessMeter` | `components/ip-management/preop/primitives/ReadinessMeter.tsx` | per-section progress (Phase 1) |
| `computePreOpReadiness` / `usePreOpReadiness` | `lib/ip-management/preop-readiness.ts` · `hooks/use-preop-readiness.ts` | single per-step readiness rollup powering the bar + rail (Phase 13) |

**Phase 12 hardening:** `WardPreOpWorkspaceModal` is an accessible `role="dialog"` (`aria-modal`, `aria-labelledby`, `useFocusTrap`, Escape-to-close, `focus-visible`) with a **Print pre-op summary** deep-link (`printSummary` → `patients/[id]/summary/print`); global `prefers-reduced-motion` honored.

**Phase 13 readiness:** the modal computes one `usePreOpReadiness` rollup that powers the sticky `PreOpReadinessBar` (top verdict, hosts the moved `WardPreOpGateChip`) and per-step counts/blocker badges/`StatusChip` in `WardPreOpStepNav`; opens on the role's step via `defaultStepForRole`; header shows a payer/balance/outpatient context line.

### Legacy wrappers (deprecated — Phase 11)

| Component | Path | Maps to |
|-----------|------|---------|
| `PreOpChecklistModal` | *(removed Phase 4)* | `WardPreOpWorkspaceModal` |
| `WardUpdationModal` (standalone) | *(removed Phase 4)* | `WardPreOpWorkspaceModal` / `WardPreOpCareTabsPanel` |
| `WardInvestigationChecklist` | `components/ip-management/WardInvestigationChecklist.tsx` | Re-export → `InvestigationsResultsPanel` |
| `ChecklistPhaseSummary` / `WardChecklistStepper` | `components/ip-management/*` | **Retained (Phase 12):** still power the read-only Journey surface (`JourneyPreOpSummary`, `WardChecklistSection` type) — not removed |

### Existing IP components (reuse)

| Component | Path |
|-----------|------|
| `AdmitModal` | `ward/page.tsx` |
| `WardChecklist` | `components/ip-management/WardChecklist.tsx` |
| `WardInvestigationChecklist` | `components/ip-management/WardInvestigationChecklist.tsx` → superseded by `InvestigationsResultsPanel` |
| `PacAssessmentForm` | `components/ip-management/PacAssessmentForm.tsx` |
| `PreOpMedicationLog` | `components/ip-management/PreOpMedicationLog.tsx` |
| `PreOpTab` | `components/ip-management/PreOpTab.tsx` |
| `ChecklistPhaseSummary` | `components/ip-management/ChecklistPhaseSummary.tsx` |
| `WardExpectedP0Banner` | `components/ip-management/WardExpectedP0Banner.tsx` |
| `SendToOTModal` | `ward/page.tsx` |

### Test IDs (`src/lib/ip-management/ward-preop-test-ids.ts`)

| ID | Element |
|----|---------|
| `ward-management-page` | Ward list page root |
| `ward-status-tab-{state}` | Status filter tab |
| `ward-journey-row-{journeyId}` | Journey table row |
| `ward-preop-workspace` | Modal root |
| `ward-preop-tab-ward-checklist` | Ward Checklist top tab |
| `ward-preop-tab-vitals` | Vitals top tab |
| `ward-preop-tab-med-log` | Medication Log top tab |
| `ward-preop-section-investigations` | §1 stepper section |
| `ward-preop-section-clearance` | §2 stepper section |
| `ward-preop-section-ward-safety` | §3 stepper section |
| `ward-preop-section-pac` | §4 stepper section |
| `ward-preop-investigation-row-{itemKey}` | Investigation result row |
| `ward-preop-investigation-verify-{itemKey}` | Verify button |
| `ward-preop-investigation-upload-{itemKey}` | Upload report |
| `ward-preop-btn-admit` | Footer Admit (Expected) |
| `ward-preop-btn-mark-ready` | Footer Mark Ready (Admitted) |
| `ward-preop-btn-send-ot` | Footer Send to OT (ReadyForSurgery) |

### E2E (planned)

| `ward-preop-phase-progress` | P0–P4 phase strip |
| `ward-preop-phase-{key}` | Phase chip (p0–p4) |
| `ward-preop-gate-warnings` / `ward-preop-gate-clear` | Gate banner |

### E2E

`e2e/ip-ward-preop-workspace.spec.ts` — smoke tests + gated full flows (`E2E_WARD_FULL_FLOWS=1`).

Run: `npm run test:e2e:ward-preop`

Existing: `e2e/ip-checklist-rbac.spec.ts`, `e2e/ip-checklist-closure.spec.ts`.

### Ward Command Center (dashboard list)

Route `/dashboard/ip-management/ward` (`WardManagementPage`). The list is a clean, single-pipeline command center — KPIs, stage tabs (incl. the **Cancelled** lane), filters, a minimal table, and a right-side detail drawer. Detailed pre-op work stays in `WardPreOpWorkspaceModal` (single source of truth); the list never duplicates it.

| Component | Path | Purpose |
|-----------|------|---------|
| `WardKpiStrip` | `components/ip-management/WardKpiStrip.tsx` | 6 compact counts (OT Today · PAC Pending · Critical Labs · Financial · Delayed · Rebook); **each tile is a toggle** (`role`/`aria-pressed`) that sets a cross-cutting list filter |
| `WardReadinessMeter` | `components/ip-management/WardReadinessMeter.tsx` | Bar-only pre-op readiness in the row (`variant="row"`) + fraction in the drawer (`variant="detail"`); exposes `role="progressbar"` + `aria-valuenow/max/text` |
| `WardPatientDrawer` | `components/ip-management/WardPatientDrawer.tsx` | Right-side detail drawer: readiness fraction, key dates, **Cancellation audit** (date · from-stage · reason), deep-links into the workspace/surfaces, ward **Rebook → Expected**; focus-trapped (`useFocusTrap`), Escape-to-close |

**State machine:** `CancelledSurgery` is an off-ramp reachable from `Expected` / `Admitted` / `ReadyForSurgery` / `SentToOT` (via cancel-today). The only exit is an explicit **Rebook → Expected** (no terminal close). Backend: `StateConstants.CancelledSurgery`, `PatientJourneyService.RebookCancelledSurgeryAsync`, migration `148_patient_journey_cancelled_surgery_state.sql`.

**Server data:** `GET /ip-management/journeys/dashboard-summary` returns stage counts + KPI metrics + facets (`WardDashboardMetrics`/`WardDashboardSummaryDto`, incl. a **surgeons** facet). `GET /ip-management/journeys` accepts additive server-side filters `otRoom` · `anaesthetist` · `paymentMode` · `surgeryDate` (all optional). Per-row readiness fields + `surgeonName` (resolved from the read-only `users` table via `StaffUsers`) are pushed onto `PatientJourneyRowDto` (no per-row detail fetch). Filters: OT Room · Anaesthetist · **Surgeon** dropdowns (client-side, driven by facets). `GET /ip-management/journeys` also supports **opt-in server paging** (`limit`/`offset` query params; total returned via the `X-Total-Count` header) — the FE keeps the full-list model for instant filtering and bounds the DOM with **incremental row windowing** (renders `ROW_PAGE`=50 rows, grows via an `IntersectionObserver` sentinel).

**Real-time:** lane-changing mutations (admit · clinical transition · cancel · rebook) fire a fire-and-forget `NotifyWardChangedAsync` → auth-service `push-dept` (IPD_NURSING) → SignalR `ReceiveNotification('WardJourneyChanged', …)`. The board subscribes via `useWardRealtime` (reuses the shared `/notificationHub` connection) and does a debounced quiet refresh on `WardJourneyChanged` · `PatientReceivedFromOt` · `SurgeryCancelledRebook`; the 45s visibility-aware poll remains as a fallback. _Note: the broadcast currently targets the IPD_NURSING department group (the reachable hub group); a branch-wide group would widen reach to all roles._

**Behaviors:** role-based default view on first load (`defaultDashboardView` — Anaesthetist→PAC, Billing→Financial, OT→OT Today, Nurse→Admitted; never overrides later interaction); ⌘K/Ctrl+K live search; keyboard-activatable rows (`role="button"`, Enter/Space); `Show Discharged` is a `role="switch"`; visibility-aware quiet auto-refresh every 45s, paused while any overlay is open.

**New test IDs** (`ward-preop-test-ids.ts`): `ward-kpi-strip`, `ward-kpi-tile-{key}`, `ward-search`, `ward-filter-ot-room`, `ward-filter-anaesthetist`, `ward-readiness-meter`, `ward-row-actions`, `ward-rebook-btn`, `ward-rebook-confirm-modal`, `ward-rebook-confirm`, `ward-patient-drawer`, `ward-drawer-close`, `ward-drawer-primary-action`, `ward-drawer-view-journey`, `ward-drawer-rebook`, `ward-drawer-cancel-audit`.

**E2E:** `e2e/ip-ward-rebook.spec.ts`, `e2e/ip-ward-cancel-today.spec.ts`, `e2e/ip-ward-phase3.spec.ts`, `e2e/ip-ward-scheduling-guard.spec.ts`, `e2e/ip-ward-program-closure.spec.ts` (drawer-first: click a row → drawer primary action → modal/workspace).

---

## Deep links

`@/lib/patients/patient-routes.ts` — `patientProfileUrl`, `patientHubProgramUrl`, `patientEncounterUrl`.
