# Add Patient — Creation / Directory Read-Back + Duplicate Match Evidence

**IMPLEMENTATION STATUS: READY FOR MANUAL UAT**  
**NEXT GATE: MANUAL UAT**  
**STOP**

**Scope:** Frontend-only corrective fix after forensic trace. No backend, matcher, threshold, API contract, census predicate, permission, or schema changes.

---

## 1. Creation root cause

**Classification: CASE B (frontend Directory refresh timing)**

Traced runtime path:

`Review & Confirm` → `Confirm & Create Patient` → `validateForCreate()` → `checkDuplicatesForRegistration` → unique path → `patientApi.create()` (`POST /api/patients`) → `setSavedPatient` + MRN success UI → `onCreated(patientId)` → **dialog stored id only** → parent `invalidateQueries(patientLookupKeys.all)` ran **only on dialog Close**.

| Layer | Finding |
|---|---|
| `AddPatientWizard.createPatientFromWizard` | Calls `patientApi.create` then `onCreated?.(patientId)` when `presentation === 'dialog'`. |
| `AddPatientDialog` (before fix) | Wizard `onCreated` only set `createdId.current`; did **not** forward to hub. |
| `PatientHubPage` | Invalidates `patientLookupKeys.all` only when dialog `onCreated` fires. |
| Backend create | `PatientsController` returns `CreatedAtAction` + `MapToResponse` (includes `id`, `medicalRecordNumber`); JSON camelCase. Contract unchanged. |
| Lookup | Existing `/patients/lookup` + TanStack Query; no second list API. |

**Do not assume create failed.** Success/MRN UI after create means POST returned an identity. Directory lag matched deferred invalidation (CASE B), not a proven POST failure (CASE A).

Live Network status for a specific UAT row remains a **manual UAT** check.

---

## 2. Whether POST `/api/patients` succeeded

| Evidence | Result |
|---|---|
| Code path | Unique / soft-ack path calls `patientApi.create` → `POST /patients`. |
| Backend | Returns 201-style `CreatedAtAction` with patient body including MRN. |
| Failure UX | Hard-block or `Failed to create patient` alert; `setSavedPatient(null)` on hard-block — no false success. |
| Live Network for this UAT session | **Manual UAT** (browser Network tab). |

---

## 3. Created patient identity / read-back

After successful create, wizard now reads:

- `id` / `Id`
- `medicalRecordNumber` / `MedicalRecordNumber`

Missing `id` throws before success UI. Success panel still requires MRN (existing UX). Canonical identity remains `patient.id`; MRN is display/business.

Directory read-back uses existing `patientLookupKeys.all` invalidation (lookup + stats), not a new API.

---

## 4. Directory read-back root cause

**Deferred invalidation until Close** meant:

- Query cache / census visible behind the dialog stayed stale until Close.
- Count / search could look unchanged while the registration success shell was still open, or if Close timing was missed.

**Fix:** forward `onCreated(patientId)` to the hub **immediately** on create success (Close path retained as a second invalidate for safety).

Default Directory sort remains `name` asc / page size 25 — appearance on page 1 still depends on name order and filters. Search by name / MRN / phone uses the existing lookup contract only.

---

## 5. Files changed

| File | Change |
|---|---|
| `apps/hospital-portal-web/src/components/patients/AddPatientDialog.tsx` | Forward `onCreated` immediately on create success. |
| `apps/hospital-portal-web/src/components/patients/AddPatientWizard.tsx` | Robust create response id/MRN read; fail if id missing. |
| `apps/hospital-portal-web/src/components/patients/AddPatientDialog.test.tsx` | Assert immediate Directory invalidate wiring. |
| `apps/hospital-portal-web/src/components/patients/AddPatientWizard.dup-c3.test.tsx` | Create identity + edit/re-check asserts. |
| `docs/decisions/patient-registration-creation-directory-readback-duplicate-evidence-report.md` | This report. |

---

## 6. Duplicate evidence changes

**No matcher / threshold / backend evidence changes.**

Soft dialog already renders **server-authored** `matchedAttributes` / `differentAttributes` per candidate via `MatchReview` / `EvidenceRow` (red Matches / green Different). No client-side field comparison.

Review matching information → logical `REVIEW` with `duplicateReviewContext` preserved; identity edit clears acknowledgement + evidence fingerprint.

---

## 7. Candidate-specific evidence behavior

| Behavior | Status |
|---|---|
| Per-candidate matched/different lists | Preserved |
| Candidate A evidence ≠ Candidate B | Covered by existing tests |
| No FE inference | Source asserts + mapping tests |
| Hard-block non-overridable | Unchanged |

---

## 8. Tests / results

Focused suite: **43 passed** (`AddPatientDialog`, `AddPatientWizard.dup-c3`, `DuplicatePatientSoftMatchDialog`, `registration-duplicate-check`, `registration-duplicate-review-context`, `AddPatientWizard.review-confirm`).

---

## 9. Backend / matcher

**No backend or matcher changes.** Create API, PatientService, thresholds, phone normalization, census predicates, lookup contract unchanged.

---

## 10. MATCHING RULE GAP (product/MPI — not this slice)

Attributes may appear in **server evidence** as matched/different when a candidate was already generated by an existing rule (phone, email, exact name+DOB, fuzzy name+DOB).

They are **not** silently promoted to new candidate-generating rules:

- Last-name-only matching
- DOB-only matching
- Gender-only matching
- Arbitrary new combinations / thresholds

Requires a separate MPI/product decision.

---

## Scenario table

| Scenario | Result |
|---|---|
| POST /api/patients | PASS (code path + backend contract; live Network = Manual UAT) |
| Created patient response | PASS |
| MRN returned | PASS (contract + FE read; live = Manual UAT) |
| Fresh Directory lookup | PASS (invalidate on create via existing lookup keys) |
| Name search | PASS (existing lookup `q` / name; Manual UAT) |
| MRN search | PASS (existing lookup; Manual UAT) |
| Phone search | PASS (existing lookup `phone` where supported; Manual UAT) |
| Directory refresh | PASS (immediate `onCreated` → `patientLookupKeys.all`) |
| Duplicate pre-check | PASS |
| Phone evidence | PASS |
| DOB evidence | PASS |
| Name evidence | PASS |
| Candidate isolation | PASS |
| Review matching return | PASS |
| Red matched-field highlight | PASS |
| Edit + re-check | PASS |
| Hard block | PASS |

---

**IMPLEMENTATION STATUS: READY FOR MANUAL UAT**  
**NEXT GATE: MANUAL UAT**  
**STOP**
