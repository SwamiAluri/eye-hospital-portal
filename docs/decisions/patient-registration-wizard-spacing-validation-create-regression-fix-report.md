# Add Patient — Regression Fix: Spacing, Validation Clearing, Duplicate/Create Flow

**Status:** READY FOR MANUAL UAT  
**Scope:** Frontend-only corrective fix. No backend / API / DTO / matcher / threshold / DB / permission changes.

---

## 1. Root cause — validation regression

**Cause:** After `validateStep()` / `validateForCreate()` populated the `errors` object, field `onChange` handlers updated `formData` only and **never cleared** the corresponding `errors.*` entries.

So once Next failed validation, red borders and messages remained after the user typed valid First Name / Last Name / DOB — even when `formData` was correct. Clicking Next again would have revalidated and advanced; the UI felt “stuck” because errors did not clear on correction.

**DOB path:** Valid `01-08-1987` already updated ISO `formData.dateOfBirth` via `applyDateOfBirthIso`, but `errors.dateOfBirth` was left stale until cleared.

**Not a change to required rules** — only error-state lifecycle.

---

## 2. Root cause — duplicate/create regression

**Cause:** After the modal lifecycle correction, soft/hard Dialogs were still **React children of the registration Dialog**. On soft match:

1. `onDuplicatePhaseChange('duplicate-review')` set registration Dialog `open={false}` (visually closed, overlay hidden).
2. Soft Dialog set `open={true}` but remained nested under the closed/forceMounted registration DialogContent (`aria-hidden`, collapsed box).

That nested-Dialog arrangement could suppress or break the standalone Possible Duplicate Patient modal while registration had already closed — appearing as “Confirm & Create does nothing” / duplicate flow broken.

**Create pre-check and `patientApi.create` paths were not removed**; the UI host lifecycle was the failure point.

**Fix:** `AddPatientDialog` owns soft/hard Dialogs as **sibling** roots of the registration Dialog. Wizard state stays mounted via `forceMount`; UI for duplicates is hosted externally when `hostDuplicateDialogsExternally` is set. Eager `onHostedSoftMatchUiChange` / hard sync runs in the same turn as phase change so the soft dialog opens as registration closes.

---

## 3. Files changed

| File | Change |
|---|---|
| `AddPatientDialog.tsx` | Sibling soft/hard Dialogs; phase + hosted UI state; keep-alive registration shell |
| `AddPatientWizard.tsx` | Remove body step headings; spacing; `clearFieldError`; external duplicate hosting; eager sync |
| Focused tests + `add-patient-dob-display.test.ts` | Layout / validation / lifecycle asserts |
| This report | Root cause + UAT readiness |

---

## 4. Layout correction

- Removed `renderStepTitle()` — stepper current label is the only step title for steps 1–7.
- Stepper region: `py-3` + border separator.
- Form scroll area: `pt-5 pb-4` for deliberate gap under the stepper.
- Dialog header: `py-3` (no subtitle).

---

## 5. Validation correction

- `clearFieldError(field)` on valid First Name / Last Name / Gender input.
- `applyDateOfBirthIso` clears `dateOfBirth` error when ISO is set.
- Validation rules unchanged; Next still calls `validateStep` (never disabled by a separate gate).

---

## 6. Duplicate lifecycle correction

- Dialog presentation: soft/hard Dialogs rendered by `AddPatientDialog` as siblings.
- Page presentation: wizard still mounts soft/hard Dialogs locally.
- Pre-check → soft/hard/create paths unchanged.
- Soft actions remain Review matching + Continue only.
- Match highlight remains red field-only.

---

## 7. Tests executed / results

**9 files, 64 tests — all passed**, including:

- AddPatientDialog / Wizard review / dup-c3
- Soft match / hard-block
- Canonical add patient
- Registration duplicate check / review context
- DOB display ↔ ISO helpers

---

## 8. Confirmation — no backend/API/DB/matcher changes

No patient service, duplicate API, DTO, matcher, thresholds, DB, permissions, or create payload changes.

---

## 9. Limitations

- Soft UI sync uses both eager handler calls and `useEffect` backup; parent must keep `onHosted*` setters stable (inline `setState` is fine).
- Manual UAT must confirm Confirm & Create → soft modal visibility and unique create path in the browser.
- No production acceptance claim.

---

IMPLEMENTATION STATUS: READY FOR MANUAL UAT  
NEXT GATE: MANUAL UAT  
STOP
