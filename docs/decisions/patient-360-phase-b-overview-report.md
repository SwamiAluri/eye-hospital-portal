# Patient 360 Phase B — Overview Workspace

Date: 2026-10-06  
Status: **PHASE B COMPLETE — AUTOMATED TESTS COMPLETE — MANUAL UAT REQUIRED — STOP**  
Acceptance: **not claimed**

Route: `/dashboard/patients/[id]`  
Blueprint: `docs/decisions/patient-360-complete-ux-redesign-blueprint.md`  
Phase A: `docs/decisions/patient-360-phase-a-header-action-report.md` (accepted 2026-10-06)

---

## A. Scope implemented

Overview only. The card-grid (Patient snapshot, Current care context, Clinical snapshot, Recent activity, Data quality, Next actions) is replaced by a sparse orientation workspace:

1. **Now** — only when `scheduledAt` and/or care programs exist
2. **Clinical flags** — summary vitals + registration allergy text
3. **Recent activity** — existing recent-visit GET, max 3 rows, table

Omitted when they would duplicate certified chrome:

- Header identity / visit / station / provider / IP / acuity / engagements
- Data quality (already listed in the shell `PatientDataQualityBanner`)
- Next step Continue / Check-in (already in the Phase A header)

**Not implemented:** Clinical through Timeline redesign, Timeline Rx fix, Generate New Bill, counselling appointment, Edit Patient, extra APIs.

---

## B. Initial audit findings

| Item | Existing source | Permission | Notes |
|---|---|---|---|
| Identity / context | `GET /patients/{id}/summary` | `patient.view` | Header already shows name, MRN, age, sex, visit, station, provider, engagements, IP, acuity |
| `scheduledAt` | same summary | `patient.view` | Not in header → Now |
| `careProgramCodes` | same summary | `patient.view` | Not in header → Now |
| Latest vitals / registration allergy | `summary.latestVitals`, `summary.allergies` | `patient.view` | Clinical flags; `diagnosisIncluded` remains false |
| Data quality | `summary.dataQuality` | `patient.view` | Shell banner already renders issues + stale vitals |
| Recent visits | `GET /patients/{id}/visits/recent` via `usePatientRecentVisitsQuery` (limit 5, Overview shows 3) | `patient.view` | DTO: id, checkedInAt, status, visitType, currentStation, tokenNumber |
| Encounter handoff | `patientEncounterUrl` when visit id = `assignedVisitId` | existing encounter route | VIEW/HANDOFF only |
| Duplicate MPI dump | Overview previously listed DOB/phone/email/blood/emergency | — | Removed from Overview (Admin remains owner) |

No new endpoint, query, permission, or DTO was required.

---

## C. Overview information hierarchy

```text
Overview heading
  Now            (omit if nothing beyond header)
  Clinical flags (always; concise empty sentence if none)
  Recent activity (table, empty, unauthorized, or unavailable)
```

Data quality and Next step groups are **not mounted**.

---

## D. Existing APIs/data sources reused

- Summary: already loaded by `PatientRecordProvider` / `usePatientSummaryQuery`
- Recent visits: already loaded by `usePatientRecentVisitsQuery`
- Failure honesty: `recentVisitsQuery.isError` + HTTP status 401/403 vs other

No additional fetch from Overview.

---

## E. UI/presentation changes

- Removed `md:grid-cols-2` card wall and local bordered `Block`s
- Section headings + definition lists + existing `ui/table` (overflow-auto)
- Compact Now `dl` (Scheduled, Care programs)
- Clinical flags `dl` (BP/pulse/temp/SpO2/weight/height, VA/IOP, registration allergy text labeled as such)
- Recent activity columns: Date | Visit | Station / reason | Status | Open encounter when applicable
- “Full journey in Care” is a `?section=care` navigation link (not a mutation)
- Same emerald focus/link treatment as other Patient 360 handoffs

---

## F. Empty / error / unavailable behavior

| State | Copy |
|---|---|
| No Now facts | Group omitted |
| No vitals and no allergy text | “No clinical flags recorded.” |
| Authorized recent visits, zero rows | “No visits recorded.” (replaces “No visits were returned.”) |
| Recent visits 401/403 | “Recent activity is not available to this sign-in.” |
| Recent visits other failure | “Recent activity is not available in Patient 360.” |
| Loading | “Loading visits.” |
| No data-quality issues, or issues already in shell | Data quality group omitted |
| Header already owns Continue XOR Check-in | Next step omitted |

Loading remains distinct from empty success.

---

## G. Files changed

| File | Why |
|---|---|
| `apps/hospital-portal-web/src/lib/patients/patient-360-overview.ts` | Now / flags / 3-row visit model; honesty helpers |
| `apps/hospital-portal-web/src/components/patients/record/Patient360Overview.tsx` | Sparse workspace UI |
| `apps/hospital-portal-web/src/lib/patients/patient-360-overview.test.ts` | Model + honesty contract |
| `apps/hospital-portal-web/src/components/patients/record/Patient360Overview.test.tsx` | Presentation contract |
| `apps/hospital-portal-web/src/lib/patients/patient-360-phase-b.test.ts` | Phase B source/regression contract |
| `docs/decisions/patient-360-phase-b-overview-report.md` | This report |

`PatientRecordPage.tsx` header/actions **not** modified.

---

## H. Backend / API / DB / permission impact

- backend changed: **NO**
- API changed: **NO**
- database changed: **NO**
- permissions changed: **NO**
- routes changed: **NO**
- Directory / Preview / Counsellor: **NO**

---

## I. Automated tests

Command:

```
cd apps/hospital-portal-web
npx vitest run src/lib/patients/patient-360- src/lib/patients/patient-handoff.test.ts src/components/patients/lookup/PatientDirectoryAppointmentDialog.test.tsx src/components/patients/record/Patient360 --reporter=dot
```

- **Passed:** 38 files, **176** tests
- **Failed:** 0

Coverage includes Overview hierarchy, omitted Now, clinical flags, 3-row visits, empty/unavailable/unauthorized copy, no header identity duplication, no Continue/Check-in in Overview, seven sections, Phase A header source contract.

---

## J. Playwright status

**Playwright not executed — live authenticated environment required.**

Do not treat e2e as passed.

---

## K. Manual UAT checklist

Use `/dashboard/patients/{id}` with `patient.view`.

**Desktop**

1. Open Patient 360.
2. Confirm fixed-patient shell remains unchanged.
3. Confirm Phase A action bar is unchanged.
4. Open Overview.
5. Confirm no patient identity/header duplication.
6. Confirm Now appears only when meaningful.
7. Confirm Clinical flags are compact and understandable.
8. Confirm Recent activity is a readable table.
9. Confirm recent activity uses “No visits recorded.” when empty.
10. Confirm Data quality appears only when issues exist (shell banner; not a second Overview card).
11. Confirm no duplicate Continue / Check-in action.
12. Confirm no giant empty cards.

**Tablet**

13. Confirm Overview remains readable.
14. Confirm recent activity remains usable.
15. Confirm no clipping or horizontal page overflow.

**Mobile**

16. Confirm groups stack naturally.
17. Confirm table remains usable.
18. Confirm no large dashboard-card stacking.
19. Confirm header/action bar from Phase A remains unchanged.

**Regression**

20. Clinical section unchanged.
21. Care section unchanged.
22. Documents unchanged.
23. Coverage unchanged.
24. Administration unchanged.
25. Timeline unchanged.
26. Directory unchanged.
27. Preview unchanged.
28. Counsellor ownership unchanged.

---

## L. Known limitations

- Token number is no longer concatenated into the visit title; columns follow the blueprint (Date, Visit, Station/reason, Status).
- `assignedVisitId` encounter handoff appears on the matching recent-visit row, not as a second primary button.
- Care programs display only from existing `careProgramCodes` labels.
- Overview still does not load medications, diagnoses, exams, labs, or appointments.
- Live browser verification was not run in this agent session.

---

## M. Explicit scope guard

Phase B only. Do **not** start Phase C (Clinical) until manual UAT and explicit acceptance of this slice.

Did not change: Phase A header, seven-section bodies other than Overview, Timeline Rx stub, Generate New Bill, counselling appointment APIs, Directory, Preview, Counsellor ownership, billing business rules, insurance, CCMS, IP/OT, permissions catalog, database.

---

**FINAL STATUS**

PHASE B COMPLETE  
AUTOMATED TESTS COMPLETE  
MANUAL UAT REQUIRED  
STOP
