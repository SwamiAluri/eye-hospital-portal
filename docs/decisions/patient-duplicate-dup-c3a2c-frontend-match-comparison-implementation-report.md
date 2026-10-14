# DUP-C3A.2c Frontend Match Comparison Implementation Report

**Status:** IMPLEMENTATION COMPLETE — MANUAL UAT NEXT  
**Phase:** Patient Directory → Duplicate Prevention → DUP-C3A.2c  
**Recorded:** 2026-10-05  
**Scope:** Frontend Possible Duplicate Patient comparison UX (server evidence only)

**Prerequisites consumed:** DUP-C3A.1 · DUP-C.2 · DUP-C.3 · DUP-C3A.2 audit · DUP-C3A.2b backend evidence (accepted)

---

## 1. Scope

Redesigned `DuplicatePatientSoftMatchDialog` into a concise identity comparison surface that renders:

- NEW REGISTRATION (local wizard draft)
- EXISTING PATIENT (create-scoped minimized candidates)
- MATCH REVIEW from server `matchedAttributes` / `differentAttributes`
- Footer actions: **Edit Registration** · **Continue Registration**

No backend matcher/threshold/permission/migration changes. No Merge / Patient360 / hard-block redesign.

---

## 2. Files changed

| File | Change |
|---|---|
| `apps/hospital-portal-web/src/components/patients/DuplicatePatientSoftMatchDialog.tsx` | Comparison UX redesign |
| `apps/hospital-portal-web/src/components/patients/AddPatientWizard.tsx` | Pass `registrationDraft`; `onEditRegistration` |
| `apps/hospital-portal-web/src/lib/patients/registration-duplicate-check.ts` | Parse evidence; label/phone-ending helpers; map evidence into soft candidates |
| `apps/hospital-portal-web/src/lib/patients/duplicate-hard-block.ts` | Optional evidence fields on candidate type |
| `apps/hospital-portal-web/src/lib/api/patients.api.ts` | Type the create-scoped evidence arrays |
| `apps/hospital-portal-web/src/components/patients/DuplicatePatientSoftMatchDialog.test.tsx` | DUP-C3A.2c coverage |
| `apps/hospital-portal-web/src/lib/patients/registration-duplicate-check.test.ts` | Evidence parse + labels |
| `apps/hospital-portal-web/src/components/patients/AddPatientWizard.dup-c3.test.tsx` | Draft/edit wiring assertions |
| `docs/decisions/patient-duplicate-dup-c3a2c-frontend-match-comparison-implementation-report.md` | This report |

**No AuthService / backend files changed.**

---

## 3. Final dialog structure

```
Possible Duplicate Patient
Review the existing patient before continuing.
────────────────────────────────
NEW REGISTRATION
  [name]
  [DOB · Gender · Phone ending ####]
────────────────────────────────
EXISTING PATIENT
  Candidate N
    [name]
    [MRN · DOB · age · Gender]
    MATCH REVIEW
      ✓ First name
      ✓ Date of birth
      ✓ Phone number
      — Last name differs
────────────────────────────────
[Edit Registration]  [Continue Registration]
```

Shell: existing Dialog primitive, counselling-session styling, ~640px desktop width (`40rem`), fixed header + new-registration + footer; candidate list scrolls independently.

---

## 4. New Registration presentation

From wizard `formData` only:

- First + last name
- DOB (existing `formatDuplicateCandidateDob`)
- Gender (capitalized display)
- Phone as **masked ending only** when ≥4 digits (`Phone ending 3210`); otherwise omitted

Does **not** show: address, insurance, clinical, billing, documents, emergency/guardian, full phone, email.

---

## 5. Existing Patient presentation

Per candidate (create-scoped DTO):

- Name, MRN, DOB, age (safe derive), gender

Does **not** show: phone, email, address, clinical/billing/insurance, tenant/branch, confidence, DifferenceReason.

---

## 6. Match evidence rendering

Frontend maps server signals → labels only:

| Signal | Matched | Different |
|---|---|---|
| FirstName | First name | First name differs |
| LastName | Last name | Last name differs |
| DateOfBirth | Date of birth | Date of birth differs |
| Phone | Phone number | Phone number differs |
| Email | Email | Email differs |

Unknown signals ignored. No client-side field comparison. MatchType chips/explanations removed from soft dialog (evidence is primary). Numeric confidence never rendered.

---

## 7. Candidate-specific evidence

Each candidate renders its own `matchedAttributes` / `differentAttributes`. Multiple PhoneMatch candidates can show different DOB/name evidence independently.

---

## 8. Edit Registration behavior

- Closes soft dialog (`closeSoftMatchDialog`)
- Returns to Add Patient Wizard with form state intact
- Does **not** call `POST /api/patients`
- Existing identity fingerprint effect clears soft acknowledgement when identity fields change
- Next Create Patient re-runs `registration/check-duplicates`

---

## 9. Continue Registration behavior

Unchanged DUP-C.3 path:

1. Set in-session acknowledgement for current fingerprint  
2. Close dialog  
3. `POST /api/patients`  
4. Final server duplicate detection remains authoritative  

No Merge/link/bypass.

---

## 10. Identity acknowledgement behavior

`registrationIdentityFingerprint` + `softMatchAcknowledgedKey` unchanged. Identity edits invalidate acknowledgement; soft review runs again before create.

---

## 11. Hard-block regression

`DuplicatePatientHardBlockDialog` untouched. Soft Continue → create → ≥0.95 still opens hard-block with no Continue on that dialog. Focused hard-block tests passed.

---

## 12. Pre-check error behavior

Fail-closed alert preserved:

> Unable to verify possible duplicate patients. Please try again before creating this patient.

No create on pre-check failure.

---

## 13. Accessibility

- DialogTitle / DialogDescription retained  
- Evidence list uses non-button semantics with aria-label summarizing matched/different  
- Check icons aria-hidden; difference marker text-based (`—`) so meaning is not color-only  
- Edit / Continue have accessible names; candidates are not actionable controls  
- Escape / focus trap remain Dialog defaults  

---

## 14. Responsive behavior

- Desktop ~640px, compact height  
- Mobile: existing full-viewport Dialog pattern (`100dvh`, no rounded corners)  
- Candidate list scrolls; footer remains reachable  
- No separate mobile workflow  

---

## 15. PHI/privacy review

| Item | Soft dialog |
|---|---|
| Candidate phone/email | Not rendered |
| New registration full phone | Not rendered (ending only) |
| MatchConfidence / 0.90 | Not rendered |
| DifferenceReason | Not rendered |
| MatchType raw / explanation prose | Not rendered |
| Frontend field equality for evidence | Not used |

---

## 16. Automated tests

Focused vitest run (**45 passed / 0 failed**):

- `DuplicatePatientSoftMatchDialog.test.tsx` (8)
- `registration-duplicate-check.test.ts` (9)
- `AddPatientWizard.dup-c3.test.tsx` (5)
- `DuplicatePatientHardBlockDialog.test.tsx` (7)
- `AddPatientDialog.test.tsx` (6)
- `canonical-add-patient.test.ts` (10)

Coverage includes: structure, evidence labels, multi-candidate independence, PHI omissions, Edit/Continue actions, no MatchType prose, scroll container, wiring regressions.

---

## 17. Tests not run

- Full frontend suite / Playwright e2e  
- Backend AuthService suite (no backend changes)  
- Shared PostgreSQL / live create UAT  

---

## 18. Out-of-scope confirmation

Not implemented / unchanged:

- Matcher rules, thresholds, MatchTypes, phone normalization  
- Health ID / EMPI / address / government ID  
- Candidate ranking (PD-DUP-C3A2-07)  
- Merge / Patient Directory / Patient360 redesign  
- Registration success / Registration Card redesign  
- Permissions, roles, migrations, patient data changes  
- Backend evidence computation  

---

## 19. Product decisions discovered

None new. Consumed approved PD-DUP-C3A2-01…06. PD-DUP-C3A2-07 remains deferred.

Local masked phone ending for NEW REGISTRATION uses form digits only (not candidate telecom).

---

## 20. Screenshots / manual verification notes

Automated markup tests only in this slice. Manual UAT should verify:

1. Soft PhoneMatch shows First name / DOB / Phone ticks + Last name differs when backend emits them  
2. New registration shows masked phone ending, not full number  
3. Edit Registration returns to wizard with values preserved  
4. Continue Registration creates via existing POST and still hard-blocks ExactNameDOB / ≥0.95  
5. Multiple candidates show independent evidence  
6. Keyboard reachability of both footer actions  

**NEXT GATE:** MANUAL UAT — DUP-C3A.2c Possible Duplicate Patient comparison UX.  
Do **not** start the next Patient Directory item until UAT is accepted.
