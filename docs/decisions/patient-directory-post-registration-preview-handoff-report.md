# Patient Directory — Post-Registration Created Patient Handoff

**IMPLEMENTATION STATUS: READY FOR MANUAL UAT**  
**NEXT GATE: MANUAL UAT**  
**STOP**

---

## 1. Forensic findings preserved

Prior forensic investigation remains authoritative:

- Unique create → `POST /api/patients` **201** → DB row → lookup returns same `patient.id`
- Directory search works; census/lookup contracts unchanged
- This slice does **not** modify creation or read-back infrastructure

---

## 2. Files changed

| File | Change |
|---|---|
| `apps/hospital-portal-web/src/lib/patients/created-patient-preview-handoff.ts` | Map existing summary → Preview row; resolve by `patient.id` |
| `apps/hospital-portal-web/src/lib/patients/created-patient-preview-handoff.test.ts` | Unit + hub wiring asserts |
| `apps/hospital-portal-web/src/components/patients/lookup/PatientHubPage.tsx` | Store created id; on dialog close open existing Preview; preserve URL filters |
| `apps/hospital-portal-web/src/lib/patients/canonical-add-patient.test.ts` | Assert Directory handoff wiring |
| `docs/decisions/patient-directory-post-registration-preview-handoff-report.md` | This report |

---

## 3. How `created patient.id` is handed off

1. Successful wizard create → `onCreated(patientId)` (existing).
2. `PatientHubPage` stores `createdHandoffPatientId.current = patientId` and invalidates `patientLookupKeys.all` (existing).
3. On Add Patient dialog **close** (`onOpenChange(false)`), consumes the stored id and opens Preview.
4. Failed create / hard-block never sets the handoff id → no Preview open.

Canonical identity: **`patient.id` only**.

---

## 4. How Preview is opened

Existing `openPreview(row)` + `previewPatientId` URL state.

1. If created id is already on the current lookup page → use that row.
2. Else → existing `patientLookupApi.getSummary(patientId, branchId)` → map to a Preview row stub → `openPreview`.

No second Preview, no new modal, no Patient 360 auto-navigation.

---

## 5. Search / filter context preservation

Handoff spreads `urlStateRef.current` and only sets `previewPatientId`.

Does **not** clear: `q`, census tab, filters, sort, branch, page.

---

## 6. Filtered-out newly created patients

When current search/filters hide the new patient:

- Worklist filters remain unchanged (patient may not appear in the table).
- Preview still opens via existing **summary** contract keyed by `patient.id`.
- Closing Preview returns to the original Directory context.

---

## 7. Tests

Focused suite: **30 passed** (`created-patient-preview-handoff`, `canonical-add-patient`, `AddPatientDialog`, `AddPatientWizard.dup-c3`).

Also re-ran Preview boundary / lookup filters / soft-match suites as regression.

---

## 8. Confirmations

| Constraint | Status |
|---|---|
| No backend changes | Yes |
| No API / DTO / DB / matcher changes | Yes |
| No permission / census / lookup contract changes | Yes |
| Duplicate soft/hard flows unchanged | Yes |
| Success / Registration Card UX preserved | Yes |

---

## 9. Manual UAT

A. Create unique patient from Directory → success MRN + Registration Card.  
B. Close registration.  
C. Verify Preview opens for **exact created `patient.id`** (MRN as display confirmation).  
D. Verify search/filter/census/sort/branch unchanged.  
E. With a non-matching search active, create another unique patient → Preview still opens; search unchanged.  
F. Close Preview → original Directory context intact.  
G. Open Patient 360 from Preview.  
H. Confirm duplicate / hard-block paths do **not** open Preview.

---

## 10. Limitations

- Deep-link `?preview=<id>` alone still cannot hydrate Preview if the patient is absent from the current filtered page and no prior in-memory row exists (pre-existing). Handoff always sets both in-memory row and `previewPatientId`.
- No “Newly registered” badge added (avoid inventing a new visual pattern).

---

**IMPLEMENTATION STATUS: READY FOR MANUAL UAT**  
**NEXT GATE: MANUAL UAT**  
**STOP**
