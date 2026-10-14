# DUP-C3A.2d — Possible Duplicate Patient Match Review Visual Refinement

**Status:** IMPLEMENTATION COMPLETE — READY FOR MANUAL UAT  
**Phase:** Patient Directory → Duplicate Prevention → DUP-C3A.2d  
**Recorded:** 2026-10-05  
**Scope:** Frontend presentation-only Match Review visual refinement  

---

## 1. Files changed

| File | Change |
|---|---|
| `apps/hospital-portal-web/src/components/patients/DuplicatePatientSoftMatchDialog.tsx` | Match Review two-state rows; New Registration name emphasis |
| `apps/hospital-portal-web/src/components/patients/DuplicatePatientSoftMatchDialog.test.tsx` | Visual/a11y assertions for Matches/Different |
| `docs/decisions/patient-duplicate-dup-c3a2d-match-review-visual-refinement-report.md` | This report |

No backend, API, DTO, database, permission, matcher, or wizard-flow files changed.

---

## 2. UI changes

Match Review compact rows:

| State | Icon | Attribute | Explicit label |
|---|---|---|---|
| `matchedAttributes` | Red check (`text-red-600`) | Bold label | **Matches** |
| `differentAttributes` | Green check (`text-green-600`) | Bold label | **Different** |

Removed dash/minus indicators and “X differs” prose. State is always icon + text (`aria-label` e.g. `First name: Matches`). New Registration name uses slightly stronger emphasis (`font-bold`). Dialog structure, actions, scrolling, and candidate isolation unchanged.

---

## 3. Tests executed / results

Focused vitest: **47 passed / 0 failed**

- `DuplicatePatientSoftMatchDialog.test.tsx` (10)
- `registration-duplicate-check.test.ts` (9)
- `AddPatientWizard.dup-c3.test.tsx` (5)
- `DuplicatePatientHardBlockDialog.test.tsx` (7)
- `AddPatientDialog.test.tsx` (6)
- `canonical-add-patient.test.ts` (10)

Not run: Playwright e2e, full suite, backend AuthService tests (no backend change).

---

## 4. Confirmation — no backend / API / DB / permission / matching changes

Confirmed: presentation-only. No AuthService, DTO, route, threshold, MatchType, normalization, migration, or permission changes.

---

## 5. Confirmation — server evidence remains SoT

UI still renders only server `matchedAttributes` / `differentAttributes`. No client-side comparison of name/DOB/phone/email. Candidate evidence remains per-candidate.

---

## 6. Limitations

- Color mapping is intentional product UX (red = matches, green = different) and is unconventional vs typical traffic-light semantics; text labels compensate for a11y.
- Manual visual UAT still required for density/contrast on real workstations.
- Production acceptance is not claimed.

---

IMPLEMENTATION STATUS: READY FOR MANUAL UAT  
NEXT GATE: MANUAL UAT  
STOP
