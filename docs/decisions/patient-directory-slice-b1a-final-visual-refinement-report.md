# Patient Directory — B.1A Final Visual Refinement

Document type: Implementation result (presentation-only density polish)  
Date: 2026-10-05  
Slice: **B.1A FINAL VISUAL REFINEMENT — Density, phone & demographic presentation**  
Status: **IMPLEMENTATION COMPLETE · AUTOMATED TESTS PASS · BROWSER VERIFICATION BLOCKED · MANUAL UAT PENDING**

Application code changed: **YES** (Directory presentation only)  
Backend / DTO / API / search / census / permissions / Patient 360: **NO**  
Next slice: **BLOCKED**

---

## 1. Files changed

- `PatientHubTable.tsx` — desktop/compact colgroup percentages
- `PatientHubRowActions.tsx` — Actions `justify-start`
- `PatientHubContextCluster.tsx` — plain-text phone + display formatting
- `patient-hub-row-display.ts` — `formatDirectoryPhoneDisplay`, `formatDirectorySexLabel`; identity line uses uppercase sex
- Tests: `patient-hub-row-display.test.ts`, `PatientHubTable.a11y.test.tsx`, `PatientHubAppointmentCell.test.tsx`, `PatientHubMobileCards.test.tsx`, `patient-directory-slice-e4.test.tsx`
- This report

---

## 2. Final desktop column percentages

| Column | Share |
|---|---|
| Patient | **21%** |
| Phone | **12%** |
| Current Visit | **20%** |
| Provider | **11%** |
| Location | **9%** |
| Next Appointment | **11%** |
| Actions | **16%** |
| **Total** | **100%** |

Compact (below xl / docked Preview):

| Column | Share |
|---|---|
| Patient | 24% |
| Phone | 13% |
| Current Visit | 22% |
| Location | 10% |
| Next Appointment | 13% |
| Actions | 18% |
| **Total** | **100%** |

Architecture preserved: one table, one colgroup, percentage SoT, no CSS-hidden Provider, `min-w-0` / overflow containment, `flex-nowrap` actions.

---

## 3. Actions whitespace reduction

Actions track **24% → 16%**. Content left/start-aligned (`justify-start`) so controls sit under the Actions header without a large trailing empty region after Book appointment.

---

## 4. Patient / Current Visit expansion

Patient **17% → 21%**; Current Visit **15% → 20%**. Space taken primarily from Actions (and a small Next Appointment trim 12% → 11%).

---

## 5–6. Phone

- **Plain text** `<span>` — no `tel:`, no anchor, no click handler, no button role.
- Presentation formatter `formatDirectoryPhoneDisplay`:
  - `+919800000003` / `9800000003` / `09800000003` → `+91-9800000003`
  - Ambiguous / non-Indian values preserved as-is
- Stored phone, search, duplicate matching, registration, backend: **unchanged**
- Scope: Directory grid (and mobile cards via same cell) only

---

## 7–9. Gender / sex

- `formatDirectorySexLabel`: `male`/`Male`/`m` → `MALE`; `female`/`Female`/`f` → `FEMALE`
- Other values use existing `formatPatientSex` (e.g. Other, Non-Binary) — not forced to MALE/FEMALE
- Identity line: `MRN · 39Y · MALE`
- **No color/badge differentiation** — no existing gender semantic token; uppercase text alone (color is not an indicator)

---

## 10. Automated tests

```text
Test Files  22 passed (22)
Tests       107 passed (107)
```

---

## 11. Browser verification

**BLOCKED — not executed in this session.**  
Manual browser UAT at 1280 / 1440 / 1600 is required (especially 1440 balance and phone plain-text).

---

## 12. Manual UAT checklist

UAT-1–UAT-22 as specified in the authorizing brief (wider Patient/Current Visit, compact Actions, plain `+91-` phone, MALE/FEMALE, alignment preserved, search/Preview/360/actions intact).

---

## 13. Remaining limitations

1. Non-Indian / ambiguous phones keep source display (no guessing).
2. No sex color treatment (intentional — no inventing design tokens).
3. Pixel balance at 1280/1440/1600 still needs human browser UAT.

---

## Explicit confirmations

- no backend / API / DTO / DB changes  
- no search / census / permission changes  
- no Patient 360 / Filters / Preview / Add Patient / duplicate changes  
- no Check-in / appointment business-rule changes  
- phone + sex changes are **presentation-only**

---

```text
B.1A FINAL VISUAL REFINEMENT: COMPLETE
AUTOMATED TESTS: PASS (22 files / 107 tests)
BROWSER VERIFICATION: BLOCKED — not run (manual UAT required)
MANUAL UAT: PENDING
NEXT SLICE: BLOCKED
```
