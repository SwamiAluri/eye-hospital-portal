# DUP-C.3 Implementation Report

**Status:** IMPLEMENTATION COMPLETE — MANUAL UAT NEXT  
**Phase:** Patient Directory → Duplicate Prevention → DUP-C.3  
**Recorded:** 2026-10-05  

**Prerequisites accepted:**

- `docs/decisions/patient-duplicate-dup-c3a-matching-safety-normalization-forensic-audit.md`
- `docs/decisions/patient-duplicate-dup-c3a1-normalization-composite-implementation-report.md`
- DUP-C.2 `POST /api/patients/registration/check-duplicates` (`patient.create`)

---

## 1. Scope implemented

Soft-match **review-before-create** UX in the canonical `AddPatientWizard`:

1. On Create Patient → call create-scoped duplicate pre-check  
2. No soft candidates → existing `POST /api/patients`  
3. Soft candidates → Possible Duplicate Patient dialog  
4. Back to Registration / Continue Registration  
5. Continue → existing create; server ≥0.95 hard-block unchanged  
6. Fail-closed if pre-check errors (no silent create)

No matcher, threshold, permission, migration, Merge, or success-screen changes.

---

## 2. Files changed

| File | Change |
|---|---|
| `apps/hospital-portal-web/src/lib/api/patients.api.ts` | `checkDuplicatesForRegistration` |
| `apps/hospital-portal-web/src/lib/patients/registration-duplicate-check.ts` | Parse / soft-gate / identity fingerprint helpers |
| `apps/hospital-portal-web/src/lib/patients/registration-duplicate-check.test.ts` | **New** |
| `apps/hospital-portal-web/src/components/patients/DuplicatePatientSoftMatchDialog.tsx` | **New** soft dialog |
| `apps/hospital-portal-web/src/components/patients/DuplicatePatientSoftMatchDialog.test.tsx` | **New** |
| `apps/hospital-portal-web/src/components/patients/AddPatientWizard.tsx` | Pre-check + soft dialog + ack invalidation |
| `apps/hospital-portal-web/src/components/patients/AddPatientWizard.dup-c3.test.tsx` | **New** wiring tests |
| `apps/hospital-portal-web/src/lib/patients/canonical-add-patient.test.ts` | Expect create-scoped pre-check |
| `apps/hospital-portal-web/src/components/patients/AddPatientDialog.test.tsx` | Expect soft wiring / loading labels |
| `apps/hospital-portal-web/src/components/patients/DuplicatePatientHardBlockDialog.test.tsx` | Allow create-scoped check string |

---

## 3. Registration flow before/after

**Before:** Create Patient → `POST /api/patients` only  

**After:**

```
Create Patient
  → POST /patients/registration/check-duplicates
  → no soft candidates / ExactNameDOB → POST /patients
  → soft candidates → dialog
       → Back (no create)
       → Continue → POST /patients
  → create 400 hard-block → existing DUP-B.2 dialog
```

---

## 4. Pre-check integration

- Trigger: final Create Patient submit only (not per keystroke / step)  
- API: `patientApi.checkDuplicatesForRegistration` → `/patients/registration/check-duplicates`  
- Payload: firstName, lastName, dateOfBirth, contactNumber, email  
- Soft review when `shouldShowSoftDuplicateReview` is true  
- ExactNameDOB in pre-check → **skip soft dialog**, proceed to create (server hard-block authoritative)

---

## 5. Soft-match dialog behavior

- Title: **Possible Duplicate Patient**  
- Copy: similar-information review (not “Duplicate patient found”)  
- Note: continuing creates only if final server check permits  
- Actions: **Back to Registration** · **Continue Registration**  
- No Create Anyway / Ignore / Merge / Open Patient 360 / Select  

---

## 6. Candidate data displayed

From minimized DUP-C.2 only: name, MRN, DOB, age (derived), gender, MatchType presentation.  
Not shown: phone, email, confidence, DifferenceReason, clinical/billing/insurance.

---

## 7. Match basis presentation

Reuses `resolveDuplicateMatchPresentation` (DUP-B):

| MatchType | Presentation |
|---|---|
| ExactNameDOB | Exact name + date of birth (soft skipped; create path) |
| PhoneMatch | Phone number / “Phone number matches…” |
| EmailMatch | Email address / “Email address matches…” |
| FuzzyNameDOB | Similar name + DOB chips + explanation |

Numeric confidence never displayed.

---

## 8. Back behavior

Closes soft dialog; wizard data preserved; no create.

---

## 9. Continue behavior

Sets in-session acknowledgement for current identity fingerprint → `POST /api/patients` once. Does not merge or link identities.

---

## 10. Acknowledgement invalidation

`registrationIdentityFingerprint(firstName, lastName, DOB, phone, email)`.  
Cleared when any of those fields change (`useEffect`). Next submit re-runs pre-check.

---

## 11. Final server hard-block behavior

Unchanged: create 400 → `DuplicatePatientHardBlockDialog`; no Continue on hard-block; no bypass.

---

## 12. Error handling

**Product note:** No prior certified fail-open policy for pre-check failures.  
Slice forbids silent create on pre-check failure.

**Implemented:** **fail-closed** — alert  
`Unable to verify possible duplicate patients. Please try again before creating this patient.`  
— no create (covers 401/403/500/network/timeout uniformly).

---

## 13. Authorization

Uses existing `patient.create` endpoint only. Does not call view-gated `/patients/check-duplicates`. No new permissions/roles.

---

## 14. Accessibility

Existing Dialog/DialogTitle/DialogDescription pattern; footer buttons named; candidates are non-button rows; Escape/focus follow existing Dialog; mobile full-height pattern matches hard-block.

---

## 15. PHI logging

No console logging of candidates, payloads, or check responses. Create error log is message-only (`Error creating patient`).

---

## 16. Automated tests and results

Focused Vitest (7 files): **51 passed / 0 failed**

Includes: helpers, soft dialog, hard-block regression, canonical Add Patient, dialog entry, DUP-C.3 wiring.

---

## 17. Tests not run

| Not run | Why |
|---|---|
| Backend AuthService suite | No backend changes in this slice |
| Full portal Vitest / Playwright | Out of focused slice |
| Shared PostgreSQL create | Forbidden |
| Manual UAT | Next gate |

---

## 18. Out-of-scope confirmation

Did **not** change: matcher, thresholds, PhoneMatch 0.90, ExactNameDOB 1.00, MatchTypes, permissions, migrations, patient data, Merge, Directory/360, success/Registration Card UX, surname/DOB-only/Health ID/EMPI matching.

---

## 19. Product decisions discovered during implementation

| ID | Finding | Resolution in this slice |
|---|---|---|
| PD-DUP-C3-ERR | No certified fail-open/fail-closed for pre-check transport/auth errors | Implemented **fail-closed** per slice “do not silently proceed”; confirm in UAT if product wants different messaging |
| PD-DUP-C3-EXACT | Minimized DTO has no MatchConfidence; ExactNameDOB always hard | Soft dialog skipped for ExactNameDOB; create → hard-block |
| PD-DUP-C3-FUZZY | FuzzyNameDOB may still be ≥0.95 without confidence on wire | Soft dialog may show; Continue → create → hard-block if server says so (no bypass) |

---

## 20. Manual UAT scenarios to execute

1. Unique identity → no soft dialog → success  
2. Shared email only → soft dialog → Back (no create)  
3. Shared email → Continue → create succeeds  
4. PhoneMatch format variants → soft dialog (not hard) → Continue  
5. Exact name + DOB → hard-block (no soft Continue)  
6. Fuzzy mid-band → soft → Continue  
7. Change phone after soft review → Create re-runs pre-check  
8. Pre-check offline/401 → fail-closed alert; no create  
9. Directory dialog + `/dashboard/patients/new` entry points  
10. Confirm no Patient 360 / Merge / Create Anyway in soft dialog  
11. Registration card success path after Continue unchanged  

---

## NEXT GATE

**Manual UAT of DUP-C.3 soft duplicate review.**

Do **not** start another duplicate-matching slice until UAT is accepted.
