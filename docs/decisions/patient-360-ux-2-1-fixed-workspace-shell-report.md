# P360-UX-2.1 — Fixed Patient Workspace Shell

Date: 2026-10-06  
Status: **IMPLEMENTATION COMPLETE — AUTOMATED TESTS COMPLETE — MANUAL UAT REQUIRED — STOP**  
Acceptance: **not claimed** (requires your UAT and explicit acceptance)

---

## A. Scope implemented

Patient 360 at `/dashboard/patients/[id]` is now a **fixed-patient workspace**.

- Unmounted patient-switching chrome from the Patient 360 surface only (search rail, prev/next / N of M, workspace tabs).
- Stopped Patient 360 from writing workspace tabs or Directory record-nav state.
- Header identity still uses `GET /patients/{id}/summary`; sex uses `formatPatientSex`.
- Continue XOR Check-in unchanged; Book still `appointment.view`.
- Removed unscoped Queue from More.
- Removed unscoped Open CCMS from Coverage (kept patient-scoped Open Billing).
- Export PDF shown only when `useHasPermission('patient.export')`.
- Print summary and Open Counselling navigation-only handoff preserved.
- Edit Patient not added.
- Seven sections and `Patient360SectionNav` unchanged.
- No Overview/Clinical/Care/Documents/Coverage/Admin/Timeline redesign.
- Timeline prescription stub **not** fixed.

---

## B. Files changed

| File | Why |
|---|---|
| `apps/hospital-portal-web/src/components/patients/record/PatientRecordPage.tsx` | Unmount switching chrome; sex formatter; export gate; remove Queue; a11y labels; layout without rail |
| `apps/hospital-portal-web/src/components/patients/record/Patient360Coverage.tsx` | Remove unscoped Open CCMS; keep Open Billing |
| `apps/hospital-portal-web/src/lib/patients/patient-360-ux-2-1.test.ts` | New slice contract tests |
| `apps/hospital-portal-web/e2e/patient-hub.spec.ts` | Assert switching chrome absent; drop “second patient tabs” expectation |

Not deleted (other consumers / future reuse): `PatientSwitcherRail.tsx`, `PatientRecordNav.tsx`, `PatientWorkspaceTabs.tsx`, `patient-record-nav.ts`, `PatientWorkspaceProvider` (Directory layout + hub `touchPatient`), `GET /patients/suggest`.

---

## C. Patient switching controls removed

| Control | Disposition |
|---|---|
| **PatientSwitcherRail** | **Unmounted** from Patient 360. Component file **preserved**. Suggest API **preserved**. |
| **PatientRecordNav** | **Unmounted** from Patient 360. Component + `patient_hub_record_nav` helpers **preserved**. Directory still **writes** `savePatientRecordNav` on hub open; 360 **no longer reads** it. |
| **PatientWorkspaceTabs** | **Unmounted** from Patient 360. Component + `PatientWorkspaceProvider` **preserved**. Hub may still `touchPatient`; 360 **no longer** calls `touchPatient`. |
| Session consumption | Patient 360 does not call `readPatientRecordNav`, `savePatientRecordNav`, `usePatientSuggestQuery`, or workspace `touchPatient`. |

---

## D. Permissions/actions

| Action | Behavior after this slice |
|---|---|
| Continue | Unchanged. Shown when `assignedVisitId` present. XOR Check-in. |
| Check-in | Unchanged eligibility helper. Shown only when Continue is not. `aria-label="Check-in"`. |
| Book Appointment | Unchanged. `appointment.view`. `aria-label="Book appointment"`. |
| Queue | **Removed** from Patient 360. Front Desk queue unchanged. |
| Counselling | **More** → waiting-list handoff only. No Start/Assign/ReQueue. Permission model not expanded. |
| Billing | **More** + Coverage **Open Billing** with `patientId`. No IP billing. Auth behavior unchanged (still not extra-gated in 360 UI). |
| Print | **More** → existing print summary URL. |
| Export PDF | **More** only if `patient.export`. Backend contract unchanged. |
| CCMS | **Removed** unscoped Open CCMS from Coverage. |
| Edit Patient | **Not present**. |

---

## E. Backend/API/database impact

- backend changed: **NO**
- API changed: **NO**
- database changed: **NO**
- permissions changed: **NO**
- routes changed: **NO**

---

## F. Automated tests

Commands (from `apps/hospital-portal-web`):

```
npx vitest run src/lib/patients/patient-360-ux-2-1.test.ts --reporter=dot
npx vitest run src/lib/patients/patient-360- src/components/patients/record/Patient360 src/lib/patients/patient-handoff.test.ts --reporter=dot
```

Results:

- UX-2.1 file: **6 passed** (watched RED: 4 failed / 2 passed before implementation; GREEN after).
- Broader Patient 360 set: **35 files, 158 tests, 0 failed**.

Playwright `e2e/patient-hub.spec.ts` was updated for this slice but **not executed** in this session (needs live auth/hub fixtures).

---

## G. Known deferred issues

- **Deferred known defect — P360-UX-2.4/Timeline slice:** `loadPatient360Clinical` still stubs prescriptions as an empty array; Timeline therefore never shows Rx even when Clinical pages `loadPatient360Prescriptions`. **Not fixed in this slice.**
- Overview / Clinical / Care / Documents / Coverage / Administration / Timeline density redesign: later slices.
- Edit Patient: out of scope (PUT field gaps).
- More-menu Counselling / Billing still not destination-permission-gated (this slice forbade a new permission model except `patient.export`).
- Directory still persists `patient_hub_record_nav`; unused by 360 until a later Directory cleanup (out of scope).

---

## H. Manual UAT

### Desktop

1. Open Patient Directory.
2. Open a patient (Preview → profile or name).
3. Confirm Patient 360 is **one** patient (route `id`).
4. Confirm **no** Patients search rail.
5. Confirm **no** Recent rail.
6. Confirm **no** Previous/Next.
7. Confirm **no** `N of M`.
8. Confirm **no** patient-switching workspace tabs.
9. Confirm name, MRN, age, formatted sex, avatar.
10. Confirm Continue **or** Check-in, not both.
11. Confirm Book Appointment only with `appointment.view`.
12. Confirm Queue is absent from More.
13. Confirm unscoped CCMS is absent (header and Coverage).
14. Confirm Edit Patient is absent.
15. Confirm seven sections: Overview, Clinical, Care, Documents, Coverage, Administration, Timeline.
16. Browser Back returns to Directory/previous page.
17. Global sidebar still works.

Also: Export PDF appears in More only with `patient.export`; Print remains; Open Counselling does not assign a counsellor.

### Mobile / narrow viewport

1. Identity remains readable.
2. No switcher rail.
3. No horizontal patient tabs.
4. Section nav still scrolls/usable.
5. Header actions remain reachable (Check-in/Book have accessible names).
6. No new overflow from the removed rail.

### Regression

- Directory list, pagination, filters unchanged.
- Preview unchanged.
- Counsellor waiting list and ownership unchanged.
- Opening Patient 360 does not assign CounsellorId or create a visit.

---

## I. Scope guard

UX-2.2 and all later Patient 360 slices were **NOT** implemented.

---

**FINAL STATUS**

P360-UX-2.1 FIXED PATIENT WORKSPACE SHELL IMPLEMENTATION COMPLETE  
AUTOMATED TESTS COMPLETE  
MANUAL UAT REQUIRED  
STOP
