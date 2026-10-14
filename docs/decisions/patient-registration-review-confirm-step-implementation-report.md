# Add Patient Registration — Review & Confirm Step Implementation Report

**Status:** IMPLEMENTATION COMPLETE — READY FOR MANUAL UAT  
**Phase:** Canonical Add Patient wizard — Review & Confirm  
**Recorded:** 2026-10-05  
**Scope:** Frontend-only seventh step before create  

---

## 1. Summary

The canonical Add Patient wizard (`/dashboard/patients/new` and Directory dialog) is now a **seven-step** flow. Insurance Information remains a data-entry step. **Review & Confirm** is a separate read-only final checkpoint. Patient creation runs only from **Confirm & Create Patient**, then the existing duplicate pre-check → create → hard-block/success path.

---

## 2. Files changed

| File | Change |
|---|---|
| `apps/hospital-portal-web/src/components/patients/AddPatientWizard.tsx` | Step 7 Review & Confirm; stepper; Confirm & Create; edit-from-review |
| `apps/hospital-portal-web/src/components/patients/AddPatientWizard.review-confirm.test.tsx` | **New** focused Review tests |
| `apps/hospital-portal-web/src/components/patients/AddPatientDialog.test.tsx` | Seven-step / Confirm assertions |
| `apps/hospital-portal-web/src/components/patients/AddPatientWizard.dup-c3.test.tsx` | Seven-step labels |
| `apps/hospital-portal-web/src/lib/patients/canonical-add-patient.test.ts` | Review / Confirm wiring |
| `docs/decisions/patient-registration-review-confirm-step-implementation-report.md` | This report |

No backend, API, DTO, DB, permission, or matcher files changed.

---

## 3. Seven-step registration flow

1. Personal Information  
2. Contact Information  
3. Identity Documents  
4. Guardian Information (skippable per existing age rule)  
5. Emergency Contact  
6. Insurance Information *(data entry only — review dump removed)*  
7. **Review & Confirm** *(read-only final checkpoint)*  

Progressive stepper uses existing ✓ / ● / ○ language; `highestStepReached` allows return to Review after Edit without a second form.

---

## 4. Review & Confirm design

- Compact completeness banner (ready vs needs attention)  
- Sectioned review groups with per-section **Edit**  
- Field rows: value + explicit Complete / Needs attention / Not provided  
- Green = complete; Red = needs attention (not duplicate “matched” semantics)  
- Icon + text (color not sole signal)  
- No patient create on entering Review or on Next from Insurance  

---

## 5. Fields displayed in Review

Uses the existing wizard `formData` only (no extra API):

- **Patient:** full/first/middle/last name, DOB, age (`calculatedAge`), gender, blood group, marital status, nationality, occupation, religion, preferred language  
- **Contact:** mobile, email, address lines, city, district, state, country, PIN/postal, landmark, full address  
- **Identity:** ID proof type, Aadhaar, national ID, passport, driving license *(Health ID hidden field omitted)*  
- **Guardian:** only when existing eligibility applies  
- **Emergency:** name, relationship, phone, email, address  
- **Insurance:** provider, policy, group, valid from/to  

Empty optional → **Not provided**. Required/invalid per existing rules → **Needs attention**.

---

## 6. Edit navigation behavior

Section **Edit** → `editRegistrationStepFromReview(step)` → corresponding data-entry step; form state preserved. Stepper can return to Review once previously reached (`highestStepReached`).

---

## 7. Duplicate-check integration

`Confirm & Create Patient` → `validateForCreate()` (existing rules) → existing `checkDuplicatesForRegistration` → soft dialog / create / ≥0.95 hard-block unchanged. No Create Anyway / Merge / override.

---

## 8. Tests executed and results

Focused vitest: **53 passed / 0 failed**

- `AddPatientWizard.review-confirm.test.tsx` (6)  
- `AddPatientDialog.test.tsx` (6)  
- `AddPatientWizard.dup-c3.test.tsx` (5)  
- `canonical-add-patient.test.ts` (10)  
- `DuplicatePatientSoftMatchDialog.test.tsx` (10)  
- `DuplicatePatientHardBlockDialog.test.tsx` (7)  
- `registration-duplicate-check.test.ts` (9)  

Not run: Playwright e2e, full suite, backend AuthService.

---

## 9. Confirmation — no backend/API/database/permission changes

Confirmed. Create still uses `patientApi.create` / `POST /api/patients`. Duplicate contract and thresholds unchanged.

---

## 10. Limitations

- Desktop seven-label stepper is dense; relies on existing truncate behavior.  
- Completeness markers reflect existing client validation only (phone/email remain optional unless invalid when filled).  
- Manual UAT still required for full field fidelity, Edit return paths, duplicate + unique create paths, and responsive/a11y.  
- Production acceptance is not claimed.

---

IMPLEMENTATION STATUS: READY FOR MANUAL UAT  
NEXT GATE: MANUAL UAT  
STOP
