# Add Patient — Final Wizard / Duplicate Modal Lifecycle Correction

**Status:** READY FOR MANUAL UAT  
**Scope:** Frontend-only. No backend / API / DTO / matcher / threshold / DB / permission / create-behavior changes.

---

## 1. Files changed

| File | Change |
|---|---|
| `apps/hospital-portal-web/src/components/patients/AddPatientDialog.tsx` | Phase model (`registration` / `duplicate-review`); close registration shell before duplicate; forceMount keep-alive; remove subtitle |
| `apps/hospital-portal-web/src/components/patients/AddPatientWizard.tsx` | Three-mode stepper; DOB DD-MM-YYYY; standalone soft/hard Dialogs; `onDuplicatePhaseChange`; header cleanup |
| `apps/hospital-portal-web/src/components/ui/dialog.tsx` | Optional `hideOverlay` for keep-alive host |
| Focused tests (dialog / review / dup-c3 / hard-block / canonical) | Updated asserts |
| `docs/decisions/patient-registration-final-wizard-duplicate-modal-lifecycle-correction-report.md` | This report |

`DuplicatePatientSoftMatchDialog` still has no Edit Registration (prior correction retained).

---

## 2. Stepper layout implementation

Reusable layout from `currentStep` + step lists:

- `LEFT_CURRENT` when `currentStep === 1`
- `CENTER_CURRENT` when `currentStep` is 2–6
- `RIGHT_CURRENT` when `currentStep === 7`

Exposed as `data-stepper-layout`. Connectors remain between numbered steps only (never through the current label). Click rules unchanged.

---

## 3. Step 1 behavior

Personal Information (number + full label) sits on the **left**. Steps 2–7 distribute across the remaining right space. Label is not centered or truncated.

---

## 4. Steps 2–6 behavior

Current step + full label is **centered**. Prior numbers left, following numbers right, connectors adapt.

---

## 5. Step 7 behavior

Steps 1–6 on the **left**; **Review & Confirm** on the **right**. Full label visible; not centered; no ellipsis layout.

---

## 6. Header cleanup

Removed visible **Patient registration** subtitle from:

- `AddPatientDialog` (sr-only description retained for a11y)
- Page-mode wizard header

Header title remains **Register New Patient**.

---

## 7. DOB input behavior

- Visible text field: placeholder `DD-MM-YYYY`, typed entry with digit masking
- Calendar icon opens native `input[type=date]` picker (`showPicker` when available)
- Both paths call `applyDateOfBirthIso` → same `formData.dateOfBirth` (ISO `yyyy-MM-dd` SoT)
- Age calculation / validation / API payload unchanged
- Approximate-age path also uses `applyDateOfBirthIso`

---

## 8. Duplicate modal lifecycle

`AddPatientDialog` phase:

1. Soft/hard detected → `onDuplicatePhaseChange('duplicate-review')`
2. Registration Dialog `open` becomes false (visually closed, overlay hidden, close button hidden)
3. Wizard stays mounted via `forceMount` while session `open` is true (form state preserved)
4. `DuplicatePatientSoftMatchDialog` / `HardBlockDialog` open as **standalone** Dialog portals (own backdrop)

Result: one active modal, one backdrop, application page behind duplicate — not Register New Patient.

---

## 9. Candidate state preservation

Wizard instance (and thus `formData`, step, `duplicateReviewContext`, soft candidates) remains mounted across phase flips. Selected candidate evidence is applied only via `openDuplicateReviewForCandidate(selected)`.

---

## 10. Review return behavior

Review matching information → close soft/hard → `onDuplicatePhaseChange('registration')` → registration shell reopens → step 7 with selected evidence highlights. No stacked dialogs.

---

## 11. Duplicate field highlight

Unchanged simplified treatment: red field container for server `matchedAttributes` only; no Match copy/badge; `differentAttributes` stay normal.

---

## 12. Tests and results

Focused suite: **7 files, 51 tests, all passed.**

---

## 13. Confirmation of no backend/API/DB/matcher changes

No patient service, duplicate API, DTO, matcher, thresholds, DB, permissions, or create payload changes.

---

## 14. Manual UAT readiness

Ready for UAT tracks A–I in the prompt (stepper modes 1/2/5/7, header, DOB, close-then-open duplicate, review return, edit/recheck).

---

## 15. Limitations

- Registration shell uses `forceMount` keep-alive while visually closed; if Radix/browser quirks surface, verify focus trap and aria-hidden during duplicate phase.
- DOB display draft (`dobDisplayText`) is UI-only until a valid DD-MM-YYYY parses; incomplete typing does not invent ISO values.
- Page presentation still shows the registration page under the soft/hard Dialog (not a modal stack).
- No production acceptance claim.

---

IMPLEMENTATION STATUS: READY FOR MANUAL UAT  
NEXT GATE: MANUAL UAT  
STOP
