# Add Patient — Duplicate Review Return + Dynamic Optional Step Numbering

**Status:** READY FOR MANUAL UAT  
**Scope:** Frontend-only. No backend / API / DTO / matcher / threshold / DB / permission changes.

---

## 1. Root cause — Review matching → Personal Information

`AddPatientDialog` gated the registration Dialog with:

```ts
open={open && phase === 'registration'}
```

On soft duplicate, phase became `duplicate-review` → Dialog `open={false}`. Even with `forceMount`, returning via **Review matching information** toggled Dialog `open` false→true and could **remount** `AddPatientWizard`, resetting `useState` defaults:

- `currentStep` / `currentStepId` → PERSONAL (1)
- form state lost or appears as a fresh wizard

`openDuplicateReviewForCandidate` did call `setCurrentStep(7)`, but that update was applied to an instance that was discarded on remount—or the remounted instance started at step 1.

**Fix:** Keep registration Dialog `open={open}` for the whole Add Patient session. While `phase === 'duplicate-review'`, set `modal={false}`, hide overlay/close, and collapse the shell visually. Soft/hard remain sibling Dialogs. Wizard state (including logical `REVIEW`) survives.

---

## 2. How logical REVIEW is restored

`openDuplicateReviewForCandidate` now sets:

```ts
setCurrentStepId('REVIEW');
markStepReached('REVIEW');
```

plus `duplicateReviewContext` from the **selected** candidate, then closes soft/hard UI and sets phase back to `registration`.

Display number is **not** hard-coded to 6 or 7; it comes from `applicableSteps`.

---

## 3. FormData preservation

Wizard stays mounted for the session (`Dialog open={open}`). `formData` is not reset on phase transitions.

---

## 4. Selected candidate / evidence preservation

Selected candidate is passed into `openDuplicateReviewForCandidate(candidate)`. Context stores that candidate’s `matchedAttributes` / `differentAttributes` only. Soft dialog local selection remains the source of which candidate is passed.

---

## 5. How applicableSteps are calculated

`getApplicableRegistrationSteps(guardianApplicable)` in `registration-wizard-steps.ts`:

- Always includes PERSONAL, CONTACT, IDENTITY, EMERGENCY, INSURANCE, REVIEW
- Includes GUARDIAN only when existing `needsGuardianStep()` is true (age &lt; 18 or ≥ 65)

Display number = index + 1 in that list.

---

## 6. Adult step sequence (Guardian not applicable)

1 Personal · 2 Contact · 3 Identity · 4 Emergency · 5 Insurance · 6 Review  

No phantom Guardian number. Review display = 6.

---

## 7. Guardian-required sequence

1 Personal · 2 Contact · 3 Identity · 4 Guardian · 5 Emergency · 6 Insurance · 7 Review  

Review display = 7. Guardian display = 4.

---

## 8. Files changed

| File | Change |
|---|---|
| `registration-wizard-steps.ts` (+ test) | Logical ids, applicableSteps, layout mode helpers |
| `AddPatientDialog.tsx` | Session-stable Dialog open + modal=false during duplicate |
| `AddPatientWizard.tsx` | `currentStepId`, applicable stepper, REVIEW return, Edit by id |
| Focused tests | Updated for logical steps + dialog lifecycle |
| This report | Root cause + UAT readiness |

---

## 9. Tests / results

**10 files, 63 tests — all passed**, including `registration-wizard-steps.test.ts`, dialog/wizard/dup/soft/hard/canonical/DOB suites.

---

## 10. Confirmation — no backend/API/DB/matcher changes

No patient service, duplicate API, DTO, matcher, thresholds, DB, or permission changes.

---

## Limitations

- Two Dialog roots can be “open” while registration is non-modal and invisible; verify focus/Escape in UAT.
- Guardian eligibility rule unchanged; only display membership in the stepper.
- No production acceptance claim.

---

IMPLEMENTATION STATUS: READY FOR MANUAL UAT  
NEXT GATE: MANUAL UAT  
STOP
