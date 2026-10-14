# L-COL-01D — PRE-UAT Verification & Correction Gate

**Date:** 2026-10-11  
**Slice:** L-COL-01D Receiving & Accession  
**Final status:** `PRE_UAT_VERIFICATION_PASSED`  
**Also:** `IMPLEMENTATION_COMPLETE_READY_FOR_MANUAL_UAT`

Mode: VERIFY → CORRECT ONLY IF REQUIRED → TEST → DOCUMENT → STOP.  
No manual UAT executed. No L-COL-01E. No new product functionality.

---

## 1. Verification summary

| Gate | Result |
|---|---|
| 1. Schema correct | PASS — accession varchar/EF max 19; sequence table + unique indexes |
| 2. Migration correct | PASS — `20261011075112_AddLmsSpecimenReceivingAccession` + `migrations/68_lms_specimen_rejection_reasons.sql` (idempotent upserts) |
| 3. MasterValue correct | PASS — entity `lms.specimen_rejection_reason`; exactly 10 approved codes |
| 4. Accession format | PASS — `ACC-YYYYMMDD-NNNNNN` unchanged |
| 5. Accession length = 19 | PASS — math 3+1+8+1+6; runtime check; tests; docs corrected |
| 6. Database concurrency safe | PASS — PostgreSQL `INSERT … ON CONFLICT … RETURNING`; SemaphoreSlim InMemory-only |
| 7. Receive transaction safe | PASS — validate → allocate → mutate → audit → compensate on audit fail |
| 8. Reject transaction safe | PASS — same fail-closed compensate pattern |
| 9. Idempotency tested | PASS — replay / `idempotency_conflict`; ops `complete_collection` / `receive` / `reject` |
| 10. RowVersion tested | PASS — zero + stale → 409 `concurrency_conflict` |
| 11. Audit tested | PASS — `RECEIVE_SPECIMEN` / `REJECT_SPECIMEN` allowlist + fail-closed tests |
| 12. AuthService tests passed | PASS — see §7 |
| 13. Frontend tests passed | PASS — see §9 |
| 14. LaboratoryApi tests passed | PASS — see §8 |
| 15. Regression tests passed | PASS — Collection/Order/Catalogue + Pathology FE |
| 16. No role grants | PASS — permissions used; no production user/role grant changes in this gate |
| 17. No out-of-scope changes | PASS — no barcode/labels/custody/billing/Pathology SoT/01E |

---

## 2. Corrections made (this gate)

| Correction | Why |
|---|---|
| Accession max length documented/enforced as **19** (not 18) | Format `ACC-YYYYMMDD-NNNNNN` is mathematically 19 |
| `ExpectedRowVersion == 0` rejected for Receive/Reject | Prevented skipping concurrency check |
| Concurrent allocation test + length==19 test | Gate requirements |
| Reject audit-failure fail-closed test | Strengthen compensate path |
| AuthService process stopped (PID lock) then tests run | File lock blocked rebuild |
| Docs: concurrency SoT, gap policy, fail-closed | Align implementation report with code |

No accession format change. No new rejection codes. No product decision reopen.

---

## 3. Accession concurrency evidence

**Math:** `ACC` + `-` + `YYYYMMDD` + `-` + `NNNNNN` = 3+1+8+1+6 = **19**.

**PostgreSQL (production correctness):**

```sql
INSERT INTO lms_accession_number_sequences (id, tenant_id, sequence_date, last_value)
VALUES (…)
ON CONFLICT (tenant_id, sequence_date)
DO UPDATE SET last_value = lms_accession_number_sequences.last_value + 1
RETURNING last_value
```

- Scope: TenantId + UTC date  
- Unique filtered indexes on `(tenant_id, accession)` and `(tenant_id, accession_date, accession_sequence)`  
- **Not** `SELECT MAX(...) + 1`

**SemaphoreSlim:** used only when `!IsNpgsql()` (InMemory tests). Documented as **not** the multi-instance correctness guarantee.

**Test:** `Concurrent_receive_allocations_produce_unique_accessions` — 8 parallel Receives → unique accessions, unique sequences, length 19, sequence `LastValue == 8`.

**Gap policy:** gaps after failed post-allocation mutation/audit are **accepted**; sequence not rolled back.

---

## 4. Transaction / fail-closed evidence

Receive path:

1. Idempotency claim (`receive`)  
2. Branch + patient confirmation vs authoritative specimen/order context  
3. RowVersion (≠ 0 and match)  
4. State Collected → allocate accession → set Received fields → `SaveChanges`  
5. Platform audit `RECEIVE_SPECIMEN`  
6. On audit failure → `RevertReceiveAsync` (status Collected, accession fields cleared) → 503 `audit_unavailable`  
7. Sequence gap may remain (approved)

Reject: analogous compensate via `RevertRejectAsync`.

Tests: audit failure leaves Collected / no accession / no rejection reason; Order remains Submitted; OrderTests remain Ordered.

Architecture: established LabApi compensate-after-SaveChanges + fail-closed (no new transaction bus invented).

---

## 5. MasterValue evidence

| Item | Value |
|---|---|
| Entity type | `lms.specimen_rejection_reason` |
| Codes | exactly the 10 approved codes |
| SQL seed | `migrations/68_…sql` — `ON CONFLICT (entity_type)` / `ON CONFLICT (tenant_id, entity_type, code)` |
| C# seed | `MasterValueService.GetDefaultSeedValues` — skips entity types already present for tenant |
| Runtime | active-only for new Reject; unknown code rejected; code + label snapshot persisted; no free-text bypass |

Duplication: SQL upsert + C# “skip if entity type already seeded” → idempotent when both run.

---

## 6. Authorization evidence

| Permission | Routes |
|---|---|
| `lms.specimens.view` (or manage) | list / detail / by-collection-task |
| `lms.specimens.view` \| manage \| receive | rejection-reasons |
| `lms.specimens.receive` only | Receive + Reject |

Receive/Reject do **not** require `lms.specimens.manage`.  
Server-side: JWT + permission gate + `ValidateUserBranchAsync` + tenant-scoped specimen load.  
No role grants / production user modifications in this gate.

---

## 7. AuthService test result

AuthService process lock resolved (local process stopped). Rebuild succeeded.

```text
dotnet test microservices/auth-service/AuthService.Tests/AuthService.Tests.csproj --no-build
  --filter "FullyQualifiedName~InternalAudit|FullyQualifiedName~InternalLms|FullyQualifiedName~EnterpriseLmsSpecimen|FullyQualifiedName~InternalLmsMasterValue"
→ Passed: 33, Failed: 0

dotnet test … --no-build --filter "FullyQualifiedName~MasterValue"
→ Passed: 4, Failed: 0
```

Covers audit allowlist (`RECEIVE_SPECIMEN` / `REJECT_SPECIMEN`), internal LMS master-value validation/lookup, related MasterValue regression.

---

## 8. LaboratoryApi test result

```text
dotnet test microservices/laboratory-service/LaboratoryApi.Tests/LaboratoryApi.Tests.csproj
  --filter "FullyQualifiedName~Specimen|FullyQualifiedName~Collection|FullyQualifiedName~Order|FullyQualifiedName~Catalogue"
→ Passed: 143, Failed: 0
```

Includes specimen receiving suite (length 19, concurrency, zero RowVersion, audit fail-closed, Order/OrderTest boundary) plus Collection / Order / Catalogue regression.

---

## 9. Frontend test result

```text
npx vitest run src/app/dashboard/lms src/lib/lms src/app/dashboard/laboratory
→ Test Files 17 passed; Tests 143 passed (0 failed)
```

LMS specimens/collection/orders/catalogue + Pathology `/dashboard/laboratory` regression untouched as SoT.

---

## 10. Regression result

| Area | Result |
|---|---|
| Collection | PASS (LabApi filter + FE collection tests) |
| Order | PASS (LabApi + FE orders) |
| Catalogue | PASS (LabApi + FE catalogue) |
| Pathology FE | PASS (`src/app/dashboard/laboratory` vitest, 9 files) |
| L-COL-01C Complete Collection | PASS (included in Specimen filter) |

---

## 11. Migration status

| Artifact | Status |
|---|---|
| `20261011075112_AddLmsSpecimenReceivingAccession` | Present; additive; accession max 19; sequence table; unique indexes |
| `migrations/68_lms_specimen_rejection_reasons.sql` | Present; idempotent upserts |

Not applied to production by this gate. Compatible with existing L-COL-01C specimen data (additive columns / new table only).

---

## 12. Documentation status

| Doc | Status |
|---|---|
| `enterprise-lms-receiving-accession-implementation.md` | Length 19; PG concurrency SoT; gap policy; fail-closed |
| Config / decision closures | Product decisions not reopened; no lingering “max length 18” as authoritative |
| This file | PRE-UAT gate record |

---

## 13. UAT readiness

All 17 readiness checks in §1 PASS.

**Final status:** `PRE_UAT_VERIFICATION_PASSED`  
**Also:** `IMPLEMENTATION_COMPLETE_READY_FOR_MANUAL_UAT`

### Manual UAT checklist (for operators — not executed here)

1. Sign in with authorized specimen-view user.  
2. Open LMS Specimens.  
3. Verify Collected specimen appears.  
4. Verify MRN/name/DOB.  
5. Open Receive.  
6. Confirm patient identity (MRN, name, DOB).  
7. Receive specimen.  
8. Verify Received.  
9. Verify accession `ACC-YYYYMMDD-NNNNNN` (**19** chars).  
10. Verify sequence.  
11. Verify receiver/time.  
12. Verify Order remains Submitted.  
13. Verify OrderTest remains Ordered.  
14. Verify audit `RECEIVE_SPECIMEN`.  
15. Repeat Receive (same idempotency) — replay, no second accession.  
16. Verify no duplicate accession.  
17. Test stale RowVersion → 409.  
18. Reject another Collected specimen.  
19. Verify governed reason list (10 codes).  
20. Verify reason stored + label snapshot.  
21. Verify no accession on rejected specimen.  
22. Verify audit `REJECT_SPECIMEN`.  
23. Attempt Receive on Rejected — blocked.  
24. Unauthorized branch — blocked.  
25. Missing `lms.specimens.receive` — actions unavailable/forbidden.  
26. Verify no barcode/label functionality.  
27. Verify CollectionTask / Orders / Catalogue / Pathology behavior unchanged.  

STOP — do not start L-COL-01E from this gate.
