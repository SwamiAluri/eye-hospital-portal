# DUP-C3A.2b Backend Evidence Implementation Report

**Status:** IMPLEMENTATION COMPLETE — MANUAL UAT (BACKEND CONTRACT) NEXT  
**Phase:** Patient Directory → Duplicate Prevention → DUP-C3A.2b  
**Recorded:** 2026-10-05  
**Scope:** Backend-only create-scoped structured match evidence  

**Approved decisions consumed:** PD-DUP-C3A2-01 … 06 (PD-DUP-C3A2-07 deferred)

---

## 1. Status

Create-scoped `POST /api/patients/registration/check-duplicates` now returns per-candidate:

- `matchedAttributes`
- `differentAttributes`

Server-authored, PHI-safe attribute identifiers only. Matcher thresholds, MatchTypes, phone normalization, soft-review gate, and frontend unchanged.

---

## 2. Files changed

| File | Change |
|---|---|
| `AuthService/Models/Domain/Dtos/RegistrationDuplicateCheckDtos.cs` | Added `MatchedAttributes`, `DifferentAttributes` |
| `AuthService/Services/RegistrationDuplicateAttributeSignals.cs` | **New** — signal constants + emission order |
| `AuthService/Services/RegistrationDuplicateMatchEvidenceBuilder.cs` | **New** — evidence computation (no DB) |
| `AuthService/Services/RegistrationDuplicateCheckMapper.cs` | Map(request, …) populates evidence |
| `AuthService/Controllers/PatientsController.cs` | Passes `request` into mapper |
| `AuthService/Services/PatientDuplicateDetectionService.cs` | Exact-name normalize delegated to shared helper (same semantics) |
| `AuthService.Tests/RegistrationDuplicateMatchEvidenceTests.cs` | **New** evidence + PHI contract tests |
| `AuthService.Tests/RegistrationDuplicateCheckTests.cs` | Assert evidence on controller path |

**No frontend files changed.**

---

## 3. Final DTO contract

`RegistrationDuplicateCandidate` (JSON camelCase):

| Property | Type | Notes |
|---|---|---|
| `id` | guid | |
| `medicalRecordNumber` | string | |
| `firstName` / `lastName` | string | Existing patient identity |
| `dateOfBirth` | datetime | |
| `gender` | string? | |
| `matchType` | string | Winning rule (unchanged) |
| `matchedAttributes` | string[] | Empty array when none (**never null**) |
| `differentAttributes` | string[] | Empty array when none (**never null**) |

Signal values (stable):

`FirstName` · `LastName` · `DateOfBirth` · `Phone` · `Email`

Emission order in both lists: that same sequence.

Still excluded: phone, email, confidence, DifferenceReason, prose explanations.

---

## 4. MatchedAttributes semantics

Emitted only when the field is **safely comparable** and equal under matcher semantics:

| Signal | Comparison |
|---|---|
| FirstName / LastName | Shared normalize: trim, collapse whitespace, case-fold |
| DateOfBirth | Request has DOB and `.Date` equals candidate |
| Phone | Both sides normalize via `PatientPhoneComparisonNormalizer` and keys equal |
| Email | Both non-empty; case-insensitive trim equality |

---

## 5. DifferentAttributes semantics

Emitted when comparable and not equal (same gates as matched).  
If phone/email missing on either side → signal omitted (not forced into different).

---

## 6. ExactNameDOB behavior

Unchanged classification (**1.00**). Evidence typically:

`matchedAttributes: [FirstName, LastName, DateOfBirth]` (+ Phone/Email if also equal).

Soft-dialog skip / create hard-block path unchanged (frontend not touched).

---

## 7. PhoneMatch behavior

Unchanged classification (**0.90**). Evidence may additionally list FirstName/DOB/etc. when equal — **without** changing MatchType.

---

## 8. EmailMatch behavior

Unchanged (**0.90**). `Email` in matched when emails equal; may appear in different when both present and unequal on a phone-won candidate.

---

## 9. FuzzyNameDOB behavior

Unchanged. Evidence uses **exact** normalized name equality (not fuzzy distance). Partial name overlap does not invent FirstName match.

---

## 10. Multiple-candidate behavior

Evidence computed **per candidate** from request + that match row. Same MatchType can yield different attribute sets (e.g. DOB match vs differ). Ordering remains engine confidence-descending.

---

## 11. PHI / security assessment

| Check | Result |
|---|---|
| Raw phone/email on wire | Absent (serialization tests) |
| MatchConfidence / DifferenceReason | Absent |
| Attribute signals only identifiers | Yes |
| No extra patient load for evidence | Yes — uses match DTO fields already in memory |

---

## 12. Authorization

Still `[RequirePermission("patient.create")]` on registration/check-duplicates. No new permission / role grants.

---

## 13. Performance / DB round-trip

Evidence built in mapper from `DuplicateCheckRequest` + `PatientDuplicateMatch`. **Zero additional queries** beyond existing gender projection.

---

## 14. Automated tests

Focused filter (evidence + registration + C3A.1 + phone normalizer):

**Passed: 62 / Failed: 0**

---

## 15. Regression tests

Included in the 62: `RegistrationDuplicateCheckTests`, `PatientDuplicateDetectionDupC3A1Tests`, `PatientPhoneComparisonNormalizerTests`, new evidence suite.

---

## 16. Tests not run

| Not run | Why |
|---|---|
| Full AuthService.Tests | Out of focused slice |
| Frontend Vitest / Playwright | Backend-only; FE deferred to DUP-C3A.2c |
| Shared PostgreSQL | Forbidden |

---

## 17. Database safety confirmation

No migration, schema change, patient UPDATE/DELETE/merge, or phone rewrite.

---

## 18. Confirmation — matcher thresholds unchanged

ExactNameDOB **1.00**, PhoneMatch **0.90**, EmailMatch **0.90**, FuzzyNameDOB ≥0.80 / hard ≥0.95 unchanged. Asserted in evidence suite.

---

## 19. Confirmation — no frontend code changed

No edits under `apps/hospital-portal-web` in this slice.

---

## 20. Confirmation — Edit / Continue UI NOT implemented

No soft-dialog action renames or wizard wiring changes.

---

## 21. Unresolved product / security decisions

| Item | Status |
|---|---|
| PD-DUP-C3A2-07 ranking/grouping | Deferred (ordering preserved) |
| Frontend NEW REGISTRATION panel + Edit Registration | Next slice DUP-C3A.2c after backend UAT |
| Whether mapper overload without request (empty evidence) remains for fixtures | Kept for unit fixtures; live controller always passes request |

---

## NEXT GATE

**MANUAL UAT — BACKEND MATCH EVIDENCE CONTRACT**

Do **not** implement DUP-C3A.2c frontend comparison UX until this contract is accepted.
