# Add Patient Registration — Review Navigation & Duplicate Review Context

**Status:** IMPLEMENTATION COMPLETE — READY FOR MANUAL UAT  
**Phase:** Canonical Add Patient — compact stepper + duplicate-review context  
**Recorded:** 2026-10-05  
**Scope:** Frontend-only UX refinement (no backend/matcher changes)

---

## 1. Files changed

| File | Change |
|---|---|
| `apps/hospital-portal-web/src/components/patients/AddPatientWizard.tsx` | Compact numbered stepper; duplicate-review context; field highlights |
| `apps/hospital-portal-web/src/components/patients/DuplicatePatientSoftMatchDialog.tsx` | Candidate selection + Review matching information |
| `apps/hospital-portal-web/src/components/patients/DuplicatePatientHardBlockDialog.tsx` | Candidate selection; Review matching → Review context |
| `apps/hospital-portal-web/src/lib/patients/registration-duplicate-review-context.ts` | **New** — signal→field map (no inference) |
| `apps/hospital-portal-web/src/lib/patients/registration-duplicate-review-context.test.ts` | **New** |
| Focused wizard/dialog/canonical tests | Updated for stepper + review navigation |
| `docs/decisions/patient-registration-review-navigation-duplicate-context-implementation-report.md` | This report |

---

## 2. Stepper behavior

- Replaced seven truncated full-label track with **compact numbered circles**.
- **Current** step: numbered pill + **full label** (`whitespace-nowrap`, not truncated).
- **Reached/completed**: clickable numbered circles (existing progression rules via `highestStepReached`).
- **Unreached/skipped**: subdued, non-clickable; full name via `title` + Tooltip + `aria-label`.
- No `Personal Info…` truncation; `overflow-x-hidden` on stepper row.

---

## 3. Duplicate review navigation

Soft dialog: **Edit Registration** · **Review matching information** · **Continue Registration**  
Hard dialog: **Back to Registration** · **Review matching information**

**Review matching information** closes the dialog, opens **Review & Confirm**, and sets `duplicateReviewContext` from the **selected** candidate only.

---

## 4. Candidate selection behavior

When multiple candidates exist, each is a radio option. Default selection = first candidate. Review matching uses only that candidate’s server `matchedAttributes` / `differentAttributes`.

---

## 5. Field highlighting behavior

In duplicate-review context:

- Compact amber banner: “Possible duplicate detected” + selected patient label  
- **Matched** fields: restrained red outline/background + “Matches selected patient”  
- **Different** fields: neutral comparison note + “Different from selected patient” (not a validation error)  
- Completeness Complete/Needs attention semantics unchanged  
- Values remain fully visible  

Mapping is identifier-only (`FirstName`→first name, `Phone`→Mobile, etc.). No client field comparison.

---

## 6. Edit behavior

Section **Edit** actions unchanged (Personal/Contact/Identity/Guardian/Emergency/Insurance). Form state preserved. Stepper can return to Review once reached.

---

## 7. Duplicate re-check behavior

Changing identity fields (`firstName`, `lastName`, `dateOfBirth`, `phone`, `email`) clears:

- soft acknowledgement key  
- `duplicateReviewContext` (stale highlights)

Next **Confirm & Create Patient** re-runs the existing registration duplicate pre-check. No client mutation of evidence arrays.

---

## 8. Tests and results

Focused vitest: **58 passed / 0 failed**

Includes stepper, soft/hard dialog selection, review-context mapping, Review & Confirm, DUP-C.3, hard-block, and canonical add-patient regressions.

---

## 9. Confirmation — no backend/API/DB/matcher changes

Confirmed. No AuthService, DTO, threshold, MatchType, normalization, permission, or migration changes.

---

## 10. Manual UAT readiness

Ready for UAT of: compact stepper; Candidate A vs B independent highlights; Different ≠ error; Edit clears stale context; Confirm rechecks; unique create path.

---

## 11. Limitations

- Hard-block candidates typically lack `matchedAttributes`/`differentAttributes` (create-scoped soft path has them); Review opens with banner but may show few/no field highlights until soft evidence is present.  
- Tooltip portal content is not asserted in SSR markup tests (`title`/`aria-label` cover a11y).  
- Production acceptance is not claimed.

---

IMPLEMENTATION STATUS: READY FOR MANUAL UAT  
NEXT GATE: MANUAL UAT  
STOP
