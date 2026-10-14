# Patient Directory — Slice B.1A Implementation Report

Document type: Implementation result + decision register update  
Date: 2026-10-05  
Slice: **B.1A — Action, density, empty-state & census UX refinement**  
Status: **IMPLEMENTATION COMPLETE · AUTOMATED TESTS PASS · MANUAL UAT PENDING**

Application code changed: **YES** (frontend presentation/interaction only)  
Backend / DTO / census predicates / search semantics / permissions: **NO**  
Next slice: **BLOCKED** pending manual UAT

---

## 1. Approved decisions (this slice)

| ID | Decision | Class |
|---|---|---|
| PD-DIR-UX-18 | Primary census views: **All \| Active**. "Active" is the user-facing label for the existing **Current** predicate (`tab=current`). | APPROVED PRODUCT DECISION · IMPLEMENTED |
| PD-DIR-UX-19 | **New** removed from primary census navigation. Backend New predicate retained. | APPROVED PRODUCT DECISION · IMPLEMENTED |
| PD-DIR-UX-20 | **High priority** removed from primary census navigation. Scoring/predicate retained. | APPROVED PRODUCT DECISION · IMPLEMENTED |
| PD-DIR-UX-21 | **Discharged** removed from primary census navigation pending authoritative discharge definition. Backend predicate retained. | APPROVED PRODUCT DECISION · IMPLEMENTED |

Also implemented (presentation-only, authorized by Slice B.1A gate):

- Three-dot / More overflow menu removed from Directory rows
- Direct action model: Check-in · Print Card · Book appointment
- Current Visit density refinement (max two visual lines)
- Shared desktop column track for header + rows
- Field-specific empty states where semantics are known
- No backend or business-rule changes

---

## 2. Files changed

### Production

- `apps/hospital-portal-web/src/components/patients/lookup/PatientHubClassificationTabs.tsx`
- `apps/hospital-portal-web/src/components/patients/lookup/PatientHubRowActions.tsx`
- `apps/hospital-portal-web/src/components/patients/lookup/PatientHubTable.tsx`
- `apps/hospital-portal-web/src/components/patients/lookup/PatientHubContextCluster.tsx`
- `apps/hospital-portal-web/src/lib/patients/patient-hub-row-display.ts`

### Tests

- `PatientHubClassificationTabs.test.tsx`
- `PatientHubRowActions.test.tsx`
- `PatientHubAppointmentCell.test.tsx`
- `PatientHubTable.a11y.test.tsx`
- `PatientHubMobileCards.test.tsx`
- `patient-hub-row-display.test.ts`
- `patient-directory-visual-language.test.ts`
- `patient-directory-slice-e4.test.tsx`

### Documentation

- `docs/audits/patient-directory-ux-data-contract-reconciliation.md` (decision register + PD-DIR-UX-18–21)
- `docs/decisions/patient-directory-slice-b1a-action-density-census-report.md` (this file)

---

## 3. Exact UI changes

1. Census primary tabs: **All** + **Active** only (Active → `current`).
2. Actions: direct text actions with `·` separators; no `…` / More menu.
3. Desktop column track: Patient (flex) | Phone 7rem | Current Visit ~11rem | Provider 7.5rem | Location 6.5rem | Next Appointment 8rem | Actions ~15.5rem.
4. Current Visit: reason + compact status line (`Checked in · time · Queue +1`).
5. Empty states: Phone → "Not available"; Current Visit → "No active visit"; Next Appointment → "No upcoming appointment"; Provider/Location → neutral `—`.

---

## 4. Action behavior

| Action | When shown | Notes |
|---|---|---|
| Check-in | `canDirectoryOfferCheckIn` | Unchanged rule |
| Print Card | Always (existing Registration Card dialog) | Unchanged workflow |
| Book appointment | `appointment.view` **and** `canDirectoryOfferBookAppointment` | Direct button; suppressed when Next Appointment already shows an upcoming time |

Nested clicks stop propagation (no accidental Preview).

---

## 5. Three-dot removal

`MoreHorizontal`, DropdownMenu, and "More actions" removed from `PatientHubRowActions`. Book appointment is a direct control.

---

## 6. Column alignment / width

`PATIENT_HUB_COLUMN_TRACK` is the single authoritative track used by header `th`, body `td`, and `colgroup`. Current Visit is width-constrained so it no longer dominates the row.

---

## 7. Current Visit density

Engagement pills removed from the Current Visit cell. Engagement folds into the secondary status line. Max two primary content lines (+ optional folded provider on tablet).

---

## 8. Empty-state changes

Semantic empties only where field meaning is known. Provider/Location keep a neutral dash (no invented "Not assigned" / "No provider").

---

## 9–11. Census predicate confirmation

| UI | Query / predicate | Changed? |
|---|---|---|
| All | `all` | Label only — unchanged |
| Active | `current` | **Label only** — no `active` query value |
| (hidden) New | `new` | Still parseable; not in primary tabs |
| (hidden) Discharged | `discharged` | Still parseable; not in primary tabs |
| (hidden) High priority | `high_priority` | Still parseable; not in primary tabs |

Stats keys (`all`, `current`, `new`, `discharged`, `highPriority`) unchanged. Counts still come from existing stats query.

---

## 12. Search regression

`replaceDirectoryUrlState` / `shouldHydrateSearchFromUrl` / popstate path preserved. URL-sync and directory search tests pass.

---

## 13. Automated tests

Broader Directory regression run:

```text
Test Files  22 passed (22)
Tests       99 passed (99)
```

Includes focused B.1A action/census/density/empty-state tests plus B.1 search/url-sync, layout, auth, filters, appointment dialog, preview boundary, and slice e3/e4 contracts.

---

## 14. Limitations

1. **Book appointment vs future appointment when checked in:** Lookup `scheduledAt` is overloaded. When the visit is checked in, Next Appointment is empty and Book remains offered. A separate future appointment cannot be detected from the row alone without a new API field.
2. **Legacy census URLs** (`tab=new|discharged|high_priority`) still drive the list/predicate if present; they simply have no primary tab chrome.
3. **Provider empty state** remains `—` because absence of `assignedProviderName` does not reliably mean "unassigned."

---

## 15. Future / open product decisions

- Authoritative **discharge** population (source, timestamp, window, workflow) before any Discharged primary view.
- Whether **New** or **High priority** should return as secondary filters (not primary tabs).
- Dedicated **next appointment** field on lookup when patient is already checked in (to safely suppress Book).
- Multi-token search quality (out of scope).

---

## 16. Explicit out-of-scope confirmation

Not touched: Patient 360, Filters redesign, Preview redesign, Add Patient, duplicate detection, backend search/`q`, census SQL/stats, page size, pagination, branch resolution, permissions, Counsellor ownership, billing/CCMS/IP/OT, MRN, merge, AcuityScoringService.

---

## Manual UAT checklist (required — pending)

See Slice B.1A gate sections UAT-1 through UAT-16 in the authorizing brief.

**Final status**

```text
SLICE B.1A IMPLEMENTATION: COMPLETE
AUTOMATED TESTS: PASS (22 files / 99 tests)
MANUAL UAT: PENDING
NEXT SLICE: BLOCKED
```
