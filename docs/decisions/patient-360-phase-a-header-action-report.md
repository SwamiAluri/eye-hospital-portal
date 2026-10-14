# Patient 360 Phase A — Header / Action System

Date: 2026-10-06  
Status: **PHASE A COMPLETE — AUTOMATED TESTS COMPLETE — MANUAL UAT PASSED — ACCEPTED**  
Acceptance: **accepted** (manual UAT PASS recorded 2026-10-06)

Route: `/dashboard/patients/[id]`  
Blueprint: `docs/decisions/patient-360-complete-ux-redesign-blueprint.md`

---

## A. Scope implemented

Patient 360 header actions are now a **direct patient-context bar**:

- Continue encounter **XOR** Check-in (unchanged helper)
- **Schedule** (general appointment only)
- **Billing** (view existing OPD bills)
- **Print**
- **Export PDF** (`patient.export`)

The generic **More** menu is removed from Patient 360.

**Not implemented:** Overview through Timeline redesign, Generate New Bill, Counselling Appointment, Edit Patient, Queue, CCMS, patient switcher, Timeline Rx fix.

---

## B. Files changed

| File | Why |
|---|---|
| `apps/hospital-portal-web/src/components/patients/record/PatientRecordPage.tsx` | Action bar; reuse Directory booking dialog; drop More / Open Counselling / broken schedule URL |
| `apps/hospital-portal-web/src/lib/patients/patient-lookup-test-ids.ts` | `recordSchedule`, `recordBilling`, `recordSummaryOverflow` |
| `apps/hospital-portal-web/src/lib/patients/patient-360-phase-a.test.ts` | New Phase A contract tests |
| `apps/hospital-portal-web/src/lib/patients/patient-360-ux-2-1.test.ts` | Align header assertions with Phase A |
| `apps/hospital-portal-web/src/lib/patients/patient-handoff.test.ts` | Counsellor handoff is not a header action; Care still uses it |
| `apps/hospital-portal-web/e2e/patient-hub.spec.ts` | Assert More and header Open Counselling are absent |
| `docs/decisions/patient-360-phase-a-header-action-report.md` | This report |

`PatientDirectoryAppointmentDialog` / `UnifiedAppointmentBooking` **not modified**.

---

## C. Header changes

Identity/context band is unchanged (avatar, name, MRN, age, formatted sex, visit, station/provider, engagements, IP, acuity).

Actions sit to the right (wrap on smaller screens):

| Action | Visual | Notes |
|---|---|---|
| Continue / Check-in | Primary (emerald) | XOR via `resolvePatient360PrimaryActions` |
| Schedule | Outline | Opens existing booking dialog |
| Billing | Outline | OPD `?patientId=` |
| Print | Outline; `sm+` | Existing print URL |
| Export PDF | Outline; `sm+` | Existing blob export |
| Summary | Outline; `<sm` only | Overflow labeled **Summary**, not More |

---

## D. Schedule implementation

**PD-S2:** Reuses `PatientDirectoryAppointmentDialog` with `patientId={summary.id}` → `resumePatientId={patientId}` inside the existing dialog.

- Visibility: `appointment.view` (same as Directory)
- Does **not** navigate to `/dashboard/appointments/schedule?patientId=`
- Does **not** add Counselling Appointment (**PD-S1**)
- Mutation remains `POST /appointments` inside `UnifiedAppointmentBooking`
- Dialog certified copy (“without leaving the directory”) was **not** changed

---

## E. Billing implementation

**PD-B1:** View only.

- Link: `/dashboard/billing/opd?patientId={id}`
- Gate: `useHasAnyPermission([...BILLING_DESK_VIEW_PERMISSIONS])` — existing union (`bill.view`, `opd_bill.view`, `bill.update`, `ip.billing.collect`, `bill.create`)
- No IP billing route
- No `/dashboard/billing/opd/create`
- No Generate New Bill
- No payment/refund/charge from 360

Coverage section still has its existing **Open Billing** link (section redesign is Phase F).

---

## F. Print / Export implementation

- Print: `patientPrintSummaryUrl` → `/dashboard/patients/{id}/summary/print`, `target=_blank`
- Export: existing `patientLookupApi.exportSummaryPdf` / `GET /patients/{id}/summary/export?format=pdf`
- Export UI still requires `patient.export`
- Desktop (`sm+`): Print and Export are direct buttons
- Narrow: labeled **Summary** overflow contains **only** Print and Export PDF

---

## G. Permission behavior

| Action | 360 UI gate |
|---|---|
| Page | `patient.view` (`ProtectedRoute`) |
| Schedule | `appointment.view` |
| Billing | `BILLING_DESK_VIEW_PERMISSIONS` any-of |
| Print | page `patient.view` |
| Export | `patient.export` |

No new permission codes. Owning-module `ProtectedRoute` gaps (check-in, print, book page) **not** fixed in this slice.

---

## H. Counselling handling

- **Not** a primary header action
- **No** Schedule → Counselling Appointment
- **No** CounselorId / Start / Assign / ReQueue / ownership mutation
- Care still has the existing secondary **Open Counselling** link (`buildCounsellorHandoffHref`) for the later Care slice

---

## I. Backend / API / DB impact

- backend changed: **NO**
- API changed: **NO**
- database changed: **NO**
- permissions changed: **NO**
- routes changed: **NO**
- Directory / Preview / Counsellor waiting list: **NO** (360 reuses Directory dialog; dialog file unchanged)

---

## J. Automated tests

Command:

```
cd apps/hospital-portal-web
npx vitest run src/lib/patients/patient-360- src/lib/patients/patient-handoff.test.ts src/components/patients/lookup/PatientDirectoryAppointmentDialog.test.tsx src/components/patients/record/Patient360 --reporter=dot
```

- **Passed:** 37 files, **167** tests
- **Failed:** 0
- **Playwright:** **not executed** (requires live auth, branch, hub fixtures). Do not treat e2e as passed.

New/updated assertions cover XOR Continue/Check-in, Schedule dialog + no broken schedule URL, Billing dest/gate, Print/Export, no generic More, no Queue, no Edit Patient, no header Open Counselling, seven sections, fixed-patient shell, no counsellor ownership mutation.

---

## K. Manual UAT status

**PASSED.** Product-owner manual UAT completed 2026-10-06 across desktop, tablet, and mobile. Phase A is **accepted**.

Use `/dashboard/patients/{id}` with `patient.view`.

| # | Area | Pass criteria | Result |
|---|---|---|---|
| 1 | Desktop actions | Continue/Check-in, Schedule, Billing, Print, Export visible per permission | PASS |
| 2 | More | Generic More absent | PASS |
| 3 | Queue | Absent | PASS |
| 4 | Open Counselling | Not in header | PASS |
| 5 | Schedule | Existing booking UI; current patient selected; do not require creating an appointment | PASS |
| 6 | Billing | `/dashboard/billing/opd?patientId=` | PASS |
| 7 | Print | Existing summary print | PASS |
| 8 | Export | Shown only with `patient.export` | PASS |
| 9 | Tablet wrap | No clipping; Schedule + Billing reachable | PASS |
| 10 | Mobile | Continue/Check-in prominent; Schedule + Billing direct; Summary = Print/Export only | PASS |
| 11 | XOR | Never both Continue and Check-in | PASS |
| 12 | Shell | No switcher / N of M / workspace tabs | PASS |
| 13 | Seven sections | Unchanged content | PASS |
| 14 | Directory / Preview / Counsellor | Unchanged | PASS |
| 15 | Counsellor ownership | Opening Patient 360 does not assign counsellor / establish ownership | PASS |

Playwright was **not executed**. Do not treat e2e as passed. Automated unit-test results in Section J are unchanged.

---

## L. Known limitations

- Care **Open Scheduling** still points at `/dashboard/appointments/schedule?patientId=` until the Care slice (Phase D). Header Schedule is the certified path.
- Coverage still shows **Open Billing** as a section link (Phase F).
- Summary overflow is `sm:hidden`; Print/Export are `hidden sm:inline-flex`.
- Booking dialog sr-only description still mentions Directory (dialog not edited).
- Implementation-agent live browser verification was not run in the original slice. Product-owner manual UAT later **PASSED** (Section K). Playwright remains **not executed**.

---

## M. Explicit scope guard

Phase A only. Manual UAT **PASSED** and Phase A is **accepted**. This acceptance record does **not** start Phase B (Overview).

Did not change: seven-section bodies, Timeline Rx stub, Generate New Bill, counselling appointment APIs, Directory, Preview, Counsellor ownership, billing business rules, insurance, CCMS, IP/OT, permissions catalog, database.

---

**FINAL STATUS**

PHASE A COMPLETE  
AUTOMATED TESTS COMPLETE  
MANUAL UAT PASSED  
ACCEPTED  
STOP  
(Phase B not started)
