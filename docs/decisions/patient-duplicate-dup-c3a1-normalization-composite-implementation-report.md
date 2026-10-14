# DUP-C3A.1 — Phone Normalization + High-Confidence Composite Safety  
## Implementation Report

**Status:** IMPLEMENTATION COMPLETE — MANUAL UAT NEXT  
**Phase:** Patient Directory → Duplicate Prevention → DUP-C3A.1  
**Recorded:** 2026-10-05  
**Prerequisite audit:** `docs/decisions/patient-duplicate-dup-c3a-matching-safety-normalization-forensic-audit.md`

---

## 1. Files changed

| File | Change |
|---|---|
| `microservices/auth-service/AuthService/Services/PatientPhoneComparisonNormalizer.cs` | **New** — comparison-only phone normalizer |
| `microservices/auth-service/AuthService/Services/PatientDuplicateDetectionService.cs` | Normalized name exact match; normalized phone match; PhoneMatch confidence 0.90 |
| `microservices/auth-service/AuthService/Models/Domain/Dtos/PatientDuplicateDtos.cs` | Confidence documentation updated |
| `microservices/auth-service/AuthService.Tests/PatientPhoneComparisonNormalizerTests.cs` | **New** |
| `microservices/auth-service/AuthService.Tests/PatientDuplicateDetectionDupC3A1Tests.cs` | **New** |
| `apps/hospital-portal-web/src/components/patients/AddPatientWizard.tsx` | Removed PHI success `console.log` / payload error dump |
| `apps/hospital-portal-web/src/lib/patients/canonical-add-patient.test.ts` | Asserts no PHI success logging strings |

**Not changed:** permissions, roles, APIs/DTOs wire shape, migrations, patient data, DUP-C.3 UI, wizard pre-check wiring.

---

## 2. Phone normalization approach

- Helper: `PatientPhoneComparisonNormalizer.Normalize(raw)`
- Comparison-only — **never** writes `Patient.ContactNumber`
- Strips whitespace / punctuation by extracting digits
- Canonicalizes unambiguous Indian mobile forms to 10-digit national mobile (starts 6–9):
  - `91` + 10 digits → last 10
  - trunk `0` + 10 digits → last 10
  - bare 10-digit Indian mobile → as-is
- Other international digit strings keep **full** digit sequence (no arbitrary country stripping)
- No new NuGet dependency; no patient-registration country selector existed to reuse

Approved matrix equals: `+91 98765 43210` / `+919876543210` / `98765 43210` / `9876543210`

---

## 3. Composite matching behavior

| Signal | MatchType | Confidence | Band |
|---|---|---|---|
| Exact normalized first+last + DOB (phone optional) | `ExactNameDOB` | **1.00** | Hard (≥0.95) |
| Same + normalized phone also equal | still `ExactNameDOB` | **1.00** | Hard (noted in DifferenceReason) |
| Normalized phone (any identity difference) | `PhoneMatch` | **0.90** | Soft (0.80–0.94) |
| Email | `EmailMatch` | 0.90 | Soft (unchanged) |
| Fuzzy name + DOB | `FuzzyNameDOB` | similarity | Soft unless ≥0.95 |

No new MatchType invented. Surname+DOB **alone** not added (decision 11 — would require unsafe new scoring / MatchType).

---

## 4. Exact hard-block behavior

Preserved: create/update still hard-blocks when any `MatchConfidence >= 0.95`.

Primary hard path: `ExactNameDOB` = 1.00 (including when phones match via normalization).

---

## 5. Phone-only behavior

**Authorized reclassification:** `PhoneMatch` **0.95 → 0.90**.

- IsDuplicate = true (soft band)
- Create **not** hard-blocked
- Format variants still produce `PhoneMatch`
- Family shared phone no longer unconditional hard-block

No existing automated test asserted live phone-only confidence must remain 0.95 (mapper fixture 0.95 was serialization-only). Conflict stop condition did not trigger.

---

## 6. DOB / surname behavior

- DOB alone → no match  
- Surname + DOB only → no hard-block (fuzzy usually misses dissimilar first names; no new surname rule)  
- Surname + DOB + normalized phone + different first → `PhoneMatch` 0.90 (possible-match, not hard)

---

## 7. Tenant / deleted / branch

Unchanged: tenant-scoped; `DeletedAt == null`; branch not a matching boundary.

---

## 8. PHI logging change

Removed from `AddPatientWizard` success path:

- `Saved patient data` / photo URL success logs  
- Photo upload response body log  
- Photo error dump of `response.data` (replaced with non-PHI message)

Operational `console.error('Failed to upload patient photo')` retained without payload.

---

## 9. Tests executed and results

| Suite | Result |
|---|---|
| `PatientPhoneComparisonNormalizerTests` + `PatientDuplicateDetectionDupC3A1Tests` + `RegistrationDuplicateCheckTests` | **Passed: 50 / Failed: 0** |
| Vitest: `canonical-add-patient`, `duplicate-hard-block`, `AddPatientDialog`, `DuplicatePatientHardBlockDialog` | **Passed: 34 / Failed: 0** |

---

## 10. Tests not executed and why

| Not run | Why |
|---|---|
| Full AuthService.Tests suite | Out of slice; focused filters only |
| Full Patient Directory / Patient360 suite | Not affected beyond wizard logging / matcher; no FE matcher wiring |
| Shared Azure PostgreSQL integration | Forbidden by DB safety; in-memory only |
| Manual UAT | Next gate |

---

## 11. Unresolved product / security decisions

| Item | Status |
|---|---|
| Surname+DOB alone as soft signal | Deferred — no safe existing MatchType/score without inventing |
| PhoneMatch soft UX (DUP-C.3) | Not in this slice — soft candidates exist but wizard does not pre-check |
| Normalized phone column / index | Not added (no migration); phone match loads tenant phones in memory |
| Broader international library (libphonenumber) | Not introduced |
| Matcher Information logs still include name/DOB | Pre-existing; not expanded; phone removed from phone-match warning log |

---

## 12. Confirmation — no patient data changed

No DELETE/UPDATE/merge/migration of `contact_number`. No shared-DB writes. In-memory tests only.

---

## 13. Confirmation — DUP-C.3 frontend UX NOT implemented

Wizard still does **not** call `registration/check-duplicates`. No soft-match dialog. Hard-block UX unchanged (still ≥0.95 only).

---

## Note for local env

A running `AuthService` process locking `bin/Debug` was stopped to allow the test build. Restart the auth service locally if needed for interactive UAT.

---

## NEXT GATE

**Manual UAT of duplicate matching and registration safety.**

Do **not** start DUP-C.3 until this implementation is manually accepted.
