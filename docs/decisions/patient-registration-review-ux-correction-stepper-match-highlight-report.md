# ADD PATIENT — Review & Confirm UX Correction  
# Full-width stepper + duplicate match field highlight

**Status:** IMPLEMENTATION COMPLETE — READY FOR MANUAL UAT  
**Phase:** Canonical Add Patient — visual/interaction correction after UAT  
**Recorded:** 2026-10-05  
**Scope:** Frontend-only  

---

## 1. Files changed

| File | Change |
|---|---|
| `apps/hospital-portal-web/src/components/patients/AddPatientWizard.tsx` | Full-width connected stepper; remove duplicate banner; stronger match-field row treatment |
| `apps/hospital-portal-web/src/components/patients/AddPatientDialog.test.tsx` | Stepper assertions |
| `apps/hospital-portal-web/src/components/patients/AddPatientWizard.review-confirm.test.tsx` | Banner absence + connector assertions |
| `apps/hospital-portal-web/src/lib/patients/canonical-add-patient.test.ts` | Stepper / banner regressions |
| `docs/decisions/patient-registration-review-ux-correction-stepper-match-highlight-report.md` | This report |

---

## 2. Stepper correction

- Removed **“Registration progress”** label.
- Removed Tooltip / `title` hover full-name behavior.
- Stepper is **full width** (`w-full`) across the modal header.
- Seven numbered circles remain; **only the current step** shows its full label (`whitespace-nowrap`, no truncation).

---

## 3. Connector behavior

- Connector line between every adjacent pair (`registration-step-connector-{2..7}`).
- `data-connector-state="complete" | "upcoming"`.
- Completed/active path uses counselling-primary muted line; future path uses border muted line.
- Existing click/validation progression rules unchanged (`highestStepReached`).

---

## 4. Duplicate banner removal

Removed amber banner:

- Possible duplicate detected  
- Review the highlighted information…  
- Selected patient: …

No replacement alert/banner. Duplicate meaning is carried by field highlights only.

---

## 5. Match-field highlighting

For server `matchedAttributes` only:

- Full field row: red border + light red background  
- Compact **✓ Match** indicator  
- Explicit **Matches selected patient** text  
- Actual label + registration value remain visible  

`differentAttributes` keep neutral **Different from selected patient** (not validation-error red). Completeness Complete / Needs attention remains independent.

---

## 6. Candidate isolation

Unchanged: selected candidate’s evidence only; mapping via `duplicateEvidenceForField` (no client comparison).

---

## 7. Edit / recheck behavior

Unchanged: section Edit; identity field changes clear `duplicateReviewContext` + soft acknowledgement; Confirm re-runs existing duplicate pre-check.

---

## 8. Tests and results

Focused vitest: **58 passed / 0 failed**.

---

## 9. Confirmation — no backend/API/DB/matcher changes

Confirmed.

---

## 10. Manual UAT readiness

Ready to verify: full-width connected stepper at Review and at step 5; no progress label/tooltips; no amber banner; Candidate A/B field highlights; Edit clears stale context; unique create.

---

## 11. Limitations

- Hard-block responses without `matchedAttributes` still do not invent highlights (documented; backend decision deferred).  
- Production acceptance not claimed.

---

IMPLEMENTATION STATUS: READY FOR MANUAL UAT  
NEXT GATE: MANUAL UAT  
STOP
