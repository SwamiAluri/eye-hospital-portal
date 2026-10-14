# Patient Directory — Filter UX Audit & PD-DIR-UX-05 Proposal

> **SUPERSEDED (2026-10-06) — Final Gen-1 Search-first Filter UX**
>
> Model C (primary identity strip + **More filters** advanced Sheet) is **SUPERSEDED**.
>
> **Final Gen-1 product decision (implemented):**
>
> | Surface | Contents |
> |---|---|
> | **Search** | Name / MRN / Phone / Email via `q` only — no duplicate filter fields |
> | **Census** | All \| Active only |
> | **Filters** | **One** Filters control → **one** Sheet: **Gender** + **DOB From/To** |
> | **Count / chips** | Gender (1) + DOB range (1) only |
>
> **Not exposed in Directory UI:** More filters; Name/MRN/Phone/Email filters; Diagnosis; Appointment/Admission ranges; Department; Provider; Ward; Care/Program codes; Engagement types; Patient Type (counselling-session-local); Saved Filters; Favorites; Assigned-to-me.
>
> Legacy query keys remain parseable for URL/API compatibility but have no Directory UI controls/chips.
> B.1A worklist: ACCEPTED / CLOSED. Slice E/F/G: not started.

Document type: Audit / Product Decision Gate (historical) + Gen-1 supersession note  
Date: 2026-10-05 (original) · Superseded: 2026-10-06  
Status of this file: **SUPERSEDED by Final Gen-1 Search-first Filter UX**  

Application / production code: Directory frontend Gen-1 correction (see report)  
Database, APIs, DTOs, routes, permissions: **unchanged**  
B.1A status: **ACCEPTED / CLOSED** — do not reopen.

Original Slice C (five-tab census presentation): **SUPERSEDED** by PD-DIR-UX-18–21.  
PD-DIR-UX-05 Model C / Slice D dual-surface design: **SUPERSEDED** by Final Gen-1 (above).

Evidence base (repository facts as of 2026-10-05):

- `PatientHubPage.tsx` — toolbar Filters toggle, inline filter mount, chips, census
- `PatientAdvancedFilterSheet.tsx` — `variant="inline"` vs full Sheet form
- `PatientFilterChips.tsx`
- `PatientSavedFiltersSection.tsx`
- `patient-lookup-filters.ts` — URL parse/build, `countActiveFilters`, `toPatientLookupFilters`
- `patient-lookup.api.ts` — `buildPatientLookupQueryParams`
- `types/patient-lookup.ts` — `PatientLookupFilters`
- `PatientLookupService.cs` — server predicates
- Prior reconciliation: `docs/audits/patient-directory-ux-data-contract-reconciliation.md` §13 / PD-DIR-UX-05

---

## 1. Current filter implementation audit

### 1.1 Live Directory path (what users actually see)

| Surface | Behavior |
|---|---|
| Search | Debounced `q` via `PatientDirectorySearch` + URL sync (`replaceDirectoryUrlState`). Not a filter-sheet field. |
| Filters button | Toggles `filtersExpanded`. Shows count when `countActiveFilters(urlState) > 0`. |
| Expanded panel | **`PatientAdvancedFilterSheet variant="inline"`** only. |
| Inline panel contents | **Identity only:** Name, DOB from, DOB to, MRN, Phone, Gender + Clear / Apply Filters. |
| Advanced groups in live path | **Not rendered.** Clinical / Schedule / Location / Care / Saved are unreachable from the current Directory mount. |
| Chips | `PatientFilterChips` under the toolbar; removable chips + Clear all. Supports advanced keys if present in URL. |
| Census | **All \| Active** (`tab=all` / `tab=current`). Filter apply preserves `tab`. |
| Favorites / Assigned to me | URL + API still support `favorites` / `assigned`; **no Directory UI toggles** (consistent with PD-DIR-UX-05). |

### 1.2 Code that exists but is not mounted on the live Directory

`PatientAdvancedFilterSheet` Sheet mode (`variant="sheet"`, default) still contains:

- Identity (full)
- Clinical — diagnosis
- Schedule — appointment + admission ranges
- Location — department, provider, ward
- Care — program codes, engagement types, patient types
- Saved — saved filter sets (`patientHubFiltersApi`)
- Optional Recent patients (only when `onRecentPatientSelect` is passed; live page does not pass it)

**Gap:** The live Directory can no longer set advanced filters through UI, but URL state, chips, API client, and server still honor those keys if present in the URL.

### 1.3 State / apply / clear (certified behavior)

| Action | Behavior |
|---|---|
| Apply | `onApply({ ...draft, page: 1 })` then closes panel |
| Clear (panel) | Clears filter fields; **preserves** `branchId`, `tab`, `q`, `previewPatientId`; sets `page: 1`; applies immediately |
| Clear all (chips) | Same preserve set as Clear |
| Individual chip remove | Updates that key only via `applyState` |
| Census change | `applyState({ ...urlState, tab, page: 1 })` — filters retained |
| Search change | Updates `q` / search state independently; does not clear filters |
| Pagination | Existing page in URL; Apply resets to 1 |
| Browser back/forward | URL is SoT via existing Directory URL sync |
| Refresh | Refetches lookup + stats with current filters |

### 1.4 Performance

- Lookup remains one existing `GET` with query params from `toPatientLookupFilters`.
- Stats remain branch census (ignore `q` and advanced filters) — unchanged.
- Opening Sheet historically loads departments; doctor list loads when department selected. Inline path does **not** load those.
- No client-side filtering of the worklist.

---

## 2. Current filter inventory

**Frequency** = hospital-workflow estimate for Directory discovery (not telemetry).  
**Primary / Advanced** = proposed presentation class for PD-DIR-UX-05 (not current UI visibility).

| Filter | Query key | Current UI (live) | Default | Server meaning (from `PatientLookupService`) | User-facing meaning | Typical Directory use | Likely frequency | Primary? | Advanced? | Remain available? | Misleading risk |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Search box | `q` | Search input | empty | Name / MRN / phone / email contains (≥2 chars) | Quick find | Reception find patient | Very high | N/A (Search) | No | Yes | Overlaps Name/MRN/Phone filters |
| Census All | `tab=all` or omit | Tab | all | No tab filter | Branch patient list | Default census | Very high | Census | — | Yes | — |
| Census Active | `tab=current` | Tab “Active” | — | Existing Current predicate | Operationally active patients | Ward/OPD today | Very high | Census | — | Yes | — |
| Name | `name` | Inline | empty | Full name contains | Exact-ish name narrow | Same-name disambiguation | High | Yes | No | Yes | Redundant with `q` if both used |
| MRN | `mrn` | Inline | empty | MRN contains | MRN lookup | Records / billing handoff | High | Yes | No | Yes | Mild overlap with `q` |
| Phone | `phone` | Inline | empty | Contact contains | Phone lookup | Reception | High | Yes | No | Yes | Mild overlap with `q` |
| Gender | `gender` | Inline select | Any | Exact gender match (case-insensitive) | Sex filter | Disambiguation | Medium | Yes | No | Yes | Display vs stored casing |
| DOB from/to | `dobFrom`, `dobTo` | Inline date pickers | empty | DOB range | Age/DOB band | Disambiguation | Medium | Yes | No | Yes | — |
| Diagnosis | `diagnosis` | **Not in live UI** (Sheet only) | empty | Active diagnosis code/description contains | Clinical diagnosis search | Rare Directory discovery | Low | No | Yes | Yes | Pulls Directory toward clinical search |
| Appointment from/to | `appointmentFrom`, `appointmentTo` | **Not in live UI** | empty | Non-cancelled appointment in range | Appointment date band | Schedule research | Low–med | No | Yes | Yes | Overloaded vs check-in time elsewhere |
| Admission from/to | `admissionFrom`, `admissionTo` | **Not in live UI** | empty | Open journey `CreatedAt` in range | IP admission window | IP ops | Low–med | No | Yes | Yes | Journey create ≠ formal discharge |
| Department | `departmentId` | **Not in live UI** | empty | Any visit with department | Visit department | Ops narrow | Med | No | Yes | Yes | — |
| Provider | `providerId` | **Not in live UI** | empty | Open visit AssignedTo/ConsultantId | Assigned clinician | Ops narrow | Med | No | Yes | Yes | — |
| Ward | `wardName` | **Not in live UI** | empty | Bed inventory ward name contains | Ward | IP discovery | Low–med | No | Yes | Yes | — |
| Care programs | `programCodes` | **Not in live UI** | empty | Open visits whose `Departments.DepartmentCode` matches selected codes | UI labels “Cataract/Glaucoma/…” | Specialty narrow | Med | No | Yes | Yes | **High** — catalog ≠ clinical “care program”; codes are department codes |
| Engagements | `engagementTypes` | **Not in live UI** | empty | Patient has matching active engagement type | OPD/Queue/IP/… | Ops narrow within Active | Med | No | Yes | Yes | Can duplicate Active census intent if overused |
| Patient type | `patientTypes` | **Not in live UI** | empty | Open counselling session `PatientType` in {Cash, Insurance, CoPay, CGHS, Camp} | UI says “Patient type” | Counselling-adjacent | Low | No | Yes | Yes | **High** — not hospital payment ledger; counselling session type |
| Favorites | `favorites=1` | **No UI** | off | Favorite rows for user | Favorites | Retired from Directory | — | No | No | Parse/API only | Keep absent from UI |
| Assigned to me | `assigned=1` | **No UI** | off | Assigned-to-me predicate | My patients | Retired from Directory | — | No | No | Parse/API only | Keep absent from UI |
| Saved sets | (saved-filter API) | **Not in live UI** | — | Named filter blob applied to URL state | Saved searches | Power users | Low | No | Yes | Yes | — |

Query keys for programs in URL: `programCodes` (comma list). Client serializes via `serializeList`.

---

## 3. User / workflow analysis

Directory job: **hospital-wide discovery + lightweight current context**, then handoff.

Filters should help:

1. Find the right person when Search alone is ambiguous.
2. Narrow All / Active without becoming Doctor Desk / Counsellor / Billing / OT.

Filters should **not**:

- Replace module worklists (engagement-heavy boards, ownership queues).
- Require clinical diagnosis literacy as the default path.
- Duplicate Search for every keystroke (dedicated MRN/Phone/Gender remain useful for precise disambiguation).

**Redundancy with Search / All / Active:**

- `q` already covers name, MRN, phone, email → Name/MRN/Phone filters are **precision tools**, not replacements for Search.
- Active census already narrows “in hospital now” → Engagement filters are advanced refinements, not primary census replacements.
- Do **not** restore New / Discharged / High priority as primary tabs. Any future use as filters is a **separate product decision**.

---

## 4. Problems / gaps

1. **Advanced filters unreachable** in the live Directory (inline-only mount) while URL/API still support them.
2. **Identity filters overlap Search** without guidance (when to use Filters vs `q`).
3. **Misleading Care program labels** vs department-code server semantics.
4. **Misleading Patient type** vs counselling session type.
5. **Chips can surface advanced filters** from URL even when UI cannot set them.
6. **Stats vs filtered total** still easy to confuse (presentation copy, not calculation).
7. Full Sheet still loads departments/doctors when opened — acceptable for Advanced; keep off primary path.
8. Original PD-DIR-UX-05 left **inline layout OPEN**; live code partially adopted Model B’s identity strip without closing Advanced access.

---

## 5. Model A / B / C / D comparison

| Criterion | A — Sheet only | B — All groups inline collapsible | C — Primary inline + Advanced Sheet | D — Search-first, Sheet secondary |
|---|---|---|---|---|
| Speed (common identity) | Slow (open Sheet) | Fast | Fast | Medium |
| Discoverability of advanced | High if Sheet used | High but dense | High via “More filters” | Medium |
| Screen density | Best for worklist | Worst | Balanced | Best |
| Hospital discovery fit | OK | Overloads Directory | Best | OK if advanced rare |
| Desktop | OK | Crowded with B.1A table | Best | OK |
| Tablet | Sheet OK | Cramped | Primary strip + Sheet | Sheet OK |
| Mobile | Sheet natural | Poor | Sheet for all non-search | Sheet natural |
| Active-filter visibility | Needs chips/count | Chips | Chips + Filters (N) | Chips + Filters (N) |
| Cognitive load | Medium | High | Low–medium | Low |
| Fits existing code | Sheet unused today | Would expand inline | Reuses both variants | Reuses Sheet |
| Contract change | None | None | None | None |

**Recommended model: C**

---

## 6. Recommended filter UX (summary)

```text
[ Search q …………………… ]  [ Filters (N) ▾ ]  [ More filters ]   Add Patient · Export · Refresh

── when Filters expanded (desktop/tablet) ──
Name | DOB from | DOB to | MRN
Phone | Gender | Clear | Apply

── chips when any advanced/identity filter active ──
MRN: …  ·  Gender: male  ·  Clear all

── census ──
All | Active

── worklist ──
…
```

- **More filters** opens the existing right Sheet with Clinical / Schedule / Location / Care / Saved (and identity fields already on the Sheet form for consistency).
- Mobile: prefer Sheet for both primary and advanced (or primary identity in Sheet sections) — do not force the two-row inline grid on small screens.
- Favorites / Assigned to me remain **absent** from UI.

---

## 7. Proposed PD-DIR-UX-05 (revised)

| Field | Content |
|---|---|
| **Decision** | Adopt **Model C**: primary identity filters as a collapsible inline region under Search on desktop/tablet; advanced filters in the existing right-side Sheet; chips + Filters count for active state. Keep every existing filter query key. Favorites / Assigned-to-me stay absent from Directory UI. |
| **Rationale** | Directory discovery needs fast identity disambiguation without turning the page into an ops board. Live B.1A already uses an identity inline panel but advanced filters became unreachable — Model C restores access without dumping all groups into the worklist chrome. |
| **Preserve** | Query keys, `parseLookupUrlParams` / `buildLookupUrlParams`, `toPatientLookupFilters`, server predicates, page size 25, `q` semantics, census All/Active (`tab=current`), Apply → `page: 1`, Clear preserves `tab`/`q`/`preview`, chips clear semantics, permissions, lookup API. |
| **Primary filters** | Name (`name`), DOB from/to (`dobFrom`/`dobTo`), MRN (`mrn`), Phone (`phone`), Gender (`gender`) |
| **Advanced filters** | Diagnosis (`diagnosis`); Appointment range; Admission range; Department (`departmentId`); Provider (`providerId`); Ward (`wardName`); Program codes (`programCodes`); Engagement types (`engagementTypes`); Patient types (`patientTypes`); Saved filter sets |
| **Responsive** | Desktop/tablet ≥ md: collapsible primary inline + More filters → Sheet. Narrow / mobile: Sheet-first for filter editing (identity + advanced sections). Worklist table/cards unchanged. |
| **Active-filter representation** | Keep `Filters` + numeric count when `countActiveFilters > 0`; keep removable chips + Clear all. Do not add a second summary KPI row. |
| **Apply / Clear** | Apply writes draft to URL state and resets page to 1. Clear / Clear all wipe filter keys only; preserve census tab, search `q`, preview id. Chip removal is immediate apply. Census change keeps filters. Search does not clear filters. |
| **Out of scope** | New filters; Health ID filter; acuity filter; billing/insurance/counsellor-owner filters; restoring New/Discharged/High priority tabs; relabeling program codes as clinical programs without a separate decision; relabeling patient type as payment; backend/DTO/predicate changes; Patient 360 / Preview / Add Patient / duplicate UX. |
| **Risk** | Users may still combine `q` with Name/MRN/Phone (document lightly in UI copy later). Misleading Care / Patient type labels remain until a terminology decision. Advanced Sheet unused until implemented. |
| **Dependencies** | Existing `PatientAdvancedFilterSheet` (inline + sheet), `PatientFilterChips`, `patient-lookup-filters.ts`, lookup API, design-system Button/Sheet. |
| **Class** | **PROPOSED — AWAITING PRODUCT APPROVAL** |

### Future / open (not this decision)

- Whether New / Discharged / High priority ever appear as **filters** (not tabs).
- Care-program catalog terminology vs department codes.
- Patient type label honesty (counselling session type).
- Count-clarity copy (stats vs filtered total).

---

## 8. Exact next implementation slice (after approval)

**Name:** Slice D — Directory Filter Presentation (Model C)  
**Class:** Frontend presentation only  
**Blocked until:** PD-DIR-UX-05 approval

### In scope

- Wire **More filters** to existing Sheet variant (or equivalent Sheet open state).
- Keep / polish primary inline identity strip (already present).
- Ensure mobile uses Sheet-first for filter editing.
- Preserve chips, counts, Apply/Clear/URL behavior.
- Copy/tests clarifying primary vs advanced surfaces.
- Optional short helper text: Search vs Filters (presentation only).

### Likely files

- `PatientHubPage.tsx`
- `PatientAdvancedFilterSheet.tsx`
- `PatientFilterChips.tsx` (only if chip labels/a11y need polish)
- Filter-related tests under `components/patients/lookup` and `lib/patients/patient-lookup-filters*`

### Exact tests (implementation slice)

- Inline primary fields still render Name/DOB/MRN/Phone/Gender.
- More filters opens Sheet with Clinical/Schedule/Location/Care/Saved.
- Apply resets `page` to 1; Clear preserves `tab`/`q`/`preview`.
- Active count and chips update for identity and advanced keys.
- Favorites / Assigned controls remain absent.
- Census All/Active unchanged; no New/Discharged/High priority tabs.
- URL round-trip for existing keys unchanged.
- No extra lookup/stats calls beyond existing Apply/search debounce patterns.
- Search focus / URL sync regression still passes.

### Exact UAT (implementation slice)

1. Expand Filters — identity fields only in primary strip.  
2. More filters — advanced groups available.  
3. Apply identity filter — list + URL + page 1.  
4. Apply advanced filter — list + chip + count.  
5. Clear / Clear all — tab and search preserved.  
6. Switch All ↔ Active with filters on — filters retained.  
7. Desktop / tablet / mobile filter presentation usable.  
8. Keyboard: Filters toggle, Apply, Clear, chip remove, Sheet Escape.  
9. B.1A worklist density and search focus unchanged.

### Rollback boundary

Revert Directory presentation components only. URL/API/server predicates untouched.

---

## 9. Explicit out-of-scope list

- Backend / DTO / lookup service / census SQL / stats  
- Search `q` semantics  
- Permissions  
- Patient 360 / Preview / Add Patient / duplicate detection  
- Check-in / Book appointment / Print Card rules  
- Counsellor ownership  
- New filter keys  
- Restoring five-tab census  
- Slice E / F / G  

---

## 10–12. Tests / UAT / risks

Covered in §8. Risks and dependencies in PD-DIR-UX-05 table (§7).

---

## 13. Confirmation — no production code changed

This task performed **read-only** inspection and documentation.

- No edits to `PatientHubPage`, filter components, API, DTO, query builder, census, or search.
- Deliverable: this decision/audit document only (plus decision-register annotation if approved by docs practice).

---

## Final status

```text
B.1A: ACCEPTED / CLOSED
FILTER UX AUDIT: COMPLETE
PD-DIR-UX-05 MODEL C: SUPERSEDED
FINAL GEN-1 FILTER UX: Search + All|Active + Gender/DOB Sheet only
MORE FILTERS: REMOVED
NEXT: STOP — manual UAT required before Slice E/F/G
```

**STOP.**
