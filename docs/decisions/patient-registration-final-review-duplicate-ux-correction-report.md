# Add Patient — Final Review / Duplicate UX Correction

**Status:** READY FOR MANUAL UAT  
**Scope:** Frontend-only. Four bounded UX fixes. No backend / API / DTO / matcher / threshold / DB / permission / create behavior changes.

---

## 1. Files changed

| File | Change |
|---|---|
| `apps/hospital-portal-web/src/components/patients/AddPatientWizard.tsx` | Centered stepper; Review heading/banner cleanup; red field-only match highlight; soft/hard as inline single-shell views |
| `apps/hospital-portal-web/src/components/patients/DuplicatePatientSoftMatchDialog.tsx` | Removed Edit Registration; optional dismiss; Content used by wizard shell |
| `apps/hospital-portal-web/src/components/patients/DuplicatePatientHardBlockDialog.tsx` | Flex layout for shell embedding |
| `apps/hospital-portal-web/src/components/patients/DuplicatePatientSoftMatchDialog.test.tsx` | Updated for removed Edit action |
| `apps/hospital-portal-web/src/components/patients/AddPatientWizard.review-confirm.test.tsx` | Stepper / Review / highlight / single-shell asserts |
| `apps/hospital-portal-web/src/components/patients/AddPatientWizard.dup-c3.test.tsx` | Soft/hard Content + shell wiring |
| `apps/hospital-portal-web/src/components/patients/AddPatientDialog.test.tsx` | Centered stepper + highlight + shell |
| `apps/hospital-portal-web/src/components/patients/DuplicatePatientHardBlockDialog.test.tsx` | Hard Content + no nested Dialog mount |
| `apps/hospital-portal-web/src/lib/patients/canonical-add-patient.test.ts` | Canonical regression updates |
| `docs/decisions/patient-registration-final-review-duplicate-ux-correction-report.md` | This report |

---

## 2. Stepper centering implementation

- Grid: `1fr | auto | 1fr` (`registration-stepper-centered`).
- Current step (number + full label) sits in the center `auto` column.
- Left/right `ol` lists hold numbered controls only; they expand/contract with available space.
- No hard-coded per-step layouts.
- `data-current-step-label` exposes the active label for tests/UAT.
- Removed “Registration progress”; no hover tooltips for step names.
- Step 7 label remains fully visible (no max-width clip on the current group).

---

## 3. Connector behavior

- Connectors render between numbered steps on the left of current, and between current and numbered steps on the right.
- Connectors never run through the current step’s label group.
- Completed vs upcoming connector styling uses existing counselling tokens (`data-connector-state`).
- Reached/completed steps remain clickable via `goToCompletedStep`; unreached stay non-clickable.

---

## 4. Review cleanup

- On step 7, `renderStepTitle()` returns `null` — stepper is the only “Review & Confirm” title.
- Removed “Registration information is ready to review” banner and related attention-summary banner copy.
- Review sections, section Edit actions, scroll region, Back, and Confirm & Create Patient unchanged.

---

## 5. Duplicate field highlight behavior

- `matchedAttributes` (via server-built `duplicateReviewContext`) → red border/background on the field container only.
- No “Matches selected patient”, no “Match” badge.
- Completeness badge (`ReviewFieldState`) is suppressed on matched fields so Match and Complete are not clustered.
- `differentAttributes` keep normal Review appearance (no red highlight, no “Different from…” copy).
- No client-side field comparison; evidence still from `duplicateEvidenceForField` / server attributes only.

---

## 6. Duplicate action changes

Soft view footer actions only:

1. Review matching information  
2. Continue Registration  

**Edit Registration removed** (UI + props). Optional dismiss (X) returns to the wizard surface without resetting form data.

---

## 7. Single-modal architecture

- Wizard shell exposes `data-registration-surface`: `wizard` | `soft-duplicate` | `hard-duplicate`.
- Soft/hard render as `DuplicatePatientSoftMatchContent` / `DuplicatePatientHardBlockContent` **inside** the same shell.
- Wizard form/stepper are not mounted while a duplicate surface is active (not merely hidden under another Dialog).
- No nested `<DuplicatePatientSoftMatchDialog>` / `<DuplicatePatientHardBlockDialog>` from the wizard.
- Standalone Dialog wrappers remain in their modules for isolated component tests only.

---

## 8. State preservation

- Soft/hard flags only switch the visible surface; `formData`, `currentStep`, and `highestStepReached` stay in memory.
- `openDuplicateReviewForCandidate` closes soft/hard flags, sets Review step + `duplicateReviewContext`.
- Dismiss / Back to Registration closes the duplicate surface and returns to the same wizard instance.
- Identity edits still clear stale duplicate context; Confirm & Create Patient still re-runs create-scoped pre-check.

---

## 9. Tests and results

Focused suite (8 files, 59 tests): **all passed**.

```
vitest run
  DuplicatePatientSoftMatchDialog.test.tsx
  AddPatientWizard.review-confirm.test.tsx
  AddPatientWizard.dup-c3.test.tsx
  AddPatientDialog.test.tsx
  canonical-add-patient.test.ts
  DuplicatePatientHardBlockDialog.test.tsx
  registration-duplicate-review-context.test.ts
  registration-duplicate-check.test.ts
```

Coverage includes: seven numbered steps, centered current label, connectors, no Registration progress, no duplicate Review heading/banner, red field-only match, no Edit Registration, single-shell soft/hard wiring, soft/hard action preservation, canonical create path.

---

## 10. Manual UAT readiness

Ready for the four UAT tracks in the prompt:

A. Stepper centering at steps 2 / 5 / 7  
B. Review cleanup (no second heading / no green banner)  
C. Red field-only match highlight (Samuel / Phone)  
D–E. Soft actions + single modal surface (no stacked dialogs)  
F. Edit clears stale evidence; re-check on Confirm  
G. Unique patient create → success → MRN → Registration Card  

---

## 11. Limitations

- Stepper centering is CSS grid–based; extreme narrow widths may compress side numbers (overflow-x hidden on the nav). Manual check on tablet/mobile still required.
- Standalone soft/hard Dialog components still exist for unit tests; production registration path uses Content inside the wizard shell only.
- Hard-block presentation still uses matchType presentation where the hard-block payload provides it; no invented soft-style evidence rows.
- No production acceptance claim; visual UAT is the next gate.

---

IMPLEMENTATION STATUS: READY FOR MANUAL UAT  
NEXT GATE: MANUAL UAT  
STOP
