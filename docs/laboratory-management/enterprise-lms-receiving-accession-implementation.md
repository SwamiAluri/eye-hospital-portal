# L-COL-01D — Receiving & Accession Foundation  
# Implementation Report

**Date:** 2026-10-11  
**Slice:** L-COL-01D  
**Status:** `IMPLEMENTATION_COMPLETE_READY_FOR_MANUAL_UAT`  
**Product closure:** [enterprise-lms-receiving-accession-decision-closure.md](./enterprise-lms-receiving-accession-decision-closure.md)  
**Configuration:** approved values in implementation task + MasterValue entity `lms.specimen_rejection_reason`

---

## 1. Audit (pre-change)

| Area | Finding |
|---|---|
| `LmsSpecimen` | Collected only; no receive/reject/accession |
| Idempotency | `lms_specimen_idempotency`, op `complete_collection` |
| RowVersion | `int` concurrency token |
| Permissions | `lms.specimens.receive` defined, unused |
| UI | Informational landing at `/dashboard/lms/specimens` |
| MasterValue | No LMS rejection entity type |
| Accession | None; LAB/COL sequences are other domains |

---

## 2. Database

### Migration
`LaboratoryApi/Migrations/20261011075112_AddLmsSpecimenReceivingAccession.cs`

### `lms_specimens` additive columns
| Column | Purpose |
|---|---|
| `accession` (varchar 19) | `ACC-YYYYMMDD-NNNNNN` |
| `accession_date` | UTC receive date |
| `accession_sequence` | daily integer |
| `received_at_utc`, `received_by_user_id` | receiver |
| `receiving_branch_id`, `receiving_location_text` | branch + optional location |
| `rejection_reason_code`, `rejection_reason_label_snapshot` | governed reason + historical label |
| `rejected_at_utc`, `rejected_by_user_id` | rejector |

### New table
`lms_accession_number_sequences` — unique `(tenant_id, sequence_date)`, atomic upsert +1

### Indexes
- Unique filtered `(tenant_id, accession)` where not null  
- Unique filtered `(tenant_id, accession_date, accession_sequence)` where not null  
- `(tenant_id, receiving_branch_id)`

### Accession length (authoritative)
| Expression | Length |
|---|---|
| `ACC` + `-` + `YYYYMMDD` + `-` + `NNNNNN` | 3+1+8+1+6 = **19** |
| Example `ACC-20261011-000001` | **19** |
| Column / EF `HasMaxLength` | **19** |
| Runtime check | `accession.Length != 19` → fail |

Any earlier “maximum length: 18” wording was incorrect and must not be used.

### Accession concurrency (authoritative)
| Environment | Mechanism | Role |
|---|---|---|
| **PostgreSQL (production)** | `INSERT … ON CONFLICT (tenant_id, sequence_date) DO UPDATE SET last_value = last_value + 1 RETURNING last_value` | **Correctness guarantee** (multi-instance safe) |
| Unique indexes on `(tenant_id, accession)` and `(tenant_id, accession_date, accession_sequence)` | Database | **Authoritative uniqueness** |
| `SemaphoreSlim` | Non-Npgsql / InMemory tests only | **Not** a production correctness mechanism |

### Gap policy
Accession allocation is concurrency-safe. Sequence gaps may occur if a mutation fails after allocation (e.g. audit fail-closed revert). Gaps are **accepted**; sequence counters are not rolled back.

### Fail-closed Receive
1. Validate → allocate accession → SaveChanges (Received) → audit  
2. On audit failure: compensating revert to Collected + clear accession fields (fail-closed)  
3. Sequence value is not reused (gap may remain)

---

## 3. Rejection reasons (CONFIG-A)

| Item | Value |
|---|---|
| Runtime SoT | Platform MasterValue |
| Entity type | `lms.specimen_rejection_reason` |
| Group | `lab_diagnostics` |
| Scope | Tenant-wide |
| Seed SQL | `migrations/68_lms_specimen_rejection_reasons.sql` |
| C# defaults | `MasterValueService.GetDefaultSeedValues` |
| Lookup map | `MasterDataLookupService` |
| LabApi validate | `POST api/internal/lms/validate-master-value` |
| LabApi list | `GET api/internal/lms/master-values?entityType=…` |
| FE list | `GET /api/lms/specimens/rejection-reasons` (proxies active approved codes) |

### Approved codes (exact)
1. PATIENT_IDENTITY_MISMATCH — Patient identity mismatch  
2. SPECIMEN_MISMATCH — Specimen does not match order  
3. SPECIMEN_QUALITY_UNACCEPTABLE — Specimen quality unacceptable  
4. INSUFFICIENT_SPECIMEN — Insufficient specimen  
5. WRONG_CONTAINER — Incorrect specimen container  
6. DAMAGED_CONTAINER — Container damaged or compromised  
7. LABELING_ERROR — Specimen labeling error  
8. TRANSPORT_CONDITION_FAILURE — Transport condition failure  
9. SPECIMEN_CONTAMINATION_SUSPECTED — Specimen contamination suspected  
10. OTHER_GOVERNED_REASON — Other governed rejection reason  

Persist on Reject: `RejectionReasonCode` + `RejectionReasonLabelSnapshot`.

---

## 4. Accession (CONFIG-B)

| Item | Value |
|---|---|
| Format | `ACC-YYYYMMDD-NNNNNN` |
| Prefix | `ACC` |
| Date | server UTC receive date |
| Width | 6 digits |
| Period | daily |
| Increment | +1 |
| Scope | TenantId + UTC date + sequence |
| Check digit | none |
| Allocation | atomic PostgreSQL upsert / InMemory semaphore |
| Forbidden | `SELECT MAX + 1` |
| On Collect / Reject | no accession |

---

## 5. APIs

| Method | Route | Permission |
|---|---|---|
| GET | `/api/lms/specimens` | view ∨ manage |
| GET | `/api/lms/specimens/{id}` | view ∨ manage |
| GET | `/api/lms/specimens/by-collection-task/{id}` | view ∨ manage |
| GET | `/api/lms/specimens/rejection-reasons` | view ∨ manage ∨ receive |
| POST | `/api/lms/specimens/{id}/receive` | **receive** |
| POST | `/api/lms/specimens/{id}/reject` | **receive** |
| POST | `/api/lms/collection/tasks/{id}/complete-collection` | manage ∧ collect (unchanged) |

### Receive body
`expectedRowVersion`, `receivingBranchId`, `patientIdentityConfirmed`, `confirmedMrn`, `confirmedPatientName`, `confirmedDateOfBirth`, optional `receivingLocationText`, `idempotencyKey`

### Reject body
`expectedRowVersion`, `operatingBranchId`, `rejectionReasonCode`, patient confirmation fields, `idempotencyKey`

Client cannot set status, accession, actor, or timestamps.

---

## 6. Authorization

| Code | Use |
|---|---|
| `lms.specimens.view` | Worklist / detail / reasons read |
| `lms.specimens.receive` | Receive + Reject |
| `lms.specimens.manage` | Not required for ordinary Receive/Reject |

Branch: `PlatformReferenceClient.ValidateUserBranchAsync`  
**No role grants added.**

---

## 7. State machine

Allowed: `Collected → Received`, `Collected → Rejected`  
Forbidden: all other transitions including reverse and self-repeat.

---

## 8. Audit

| Action | When |
|---|---|
| `RECEIVE_SPECIMEN` | Successful receive |
| `REJECT_SPECIMEN` | Successful reject |

Platform `audit_log` via `IPlatformAuditClient`; fail-closed with specimen revert.

---

## 9. Idempotency / concurrency

| Concern | Behavior |
|---|---|
| Store | `lms_specimen_idempotency` |
| Ops | `complete_collection`, `receive`, `reject` |
| Same key + hash | Replay |
| Same key + different hash | 409 `idempotency_conflict` |
| RowVersion | 409 `concurrency_conflict` (ExpectedRowVersion ≠ 0 and mismatch) |

---

## 10. UI

| Surface | Behavior |
|---|---|
| `/dashboard/lms/specimens` | Receiving worklist (`SpecimenWorkbench`) |
| Receive dialog | MRN/name/DOB confirm, branch, optional location |
| Reject dialog | Governed reasons from API |
| Detail | Received/Rejected fields; actions when Collected + receive perm |

No claim/assign, TAT KPIs, barcode, or labels.

---

## 11. Tests

Authoritative PRE-UAT totals: [enterprise-lms-receiving-accession-pre-uat-verification.md](./enterprise-lms-receiving-accession-pre-uat-verification.md).

### Backend
```text
dotnet test microservices/laboratory-service/LaboratoryApi.Tests/LaboratoryApi.Tests.csproj
  --filter "FullyQualifiedName~Specimen|FullyQualifiedName~Collection|FullyQualifiedName~Order|FullyQualifiedName~Catalogue"
→ Passed: 143, Failed: 0
```

Includes L-COL-01C regression + L-COL-01D receiving suite (`SpecimenReceivingServiceTests`).

### Frontend
```text
npx vitest run src/app/dashboard/lms src/lib/lms src/app/dashboard/laboratory
→ Passed: 143, Failed: 0 (17 files)
```

### AuthService
Allowlist updated for `RECEIVE_SPECIMEN` / `REJECT_SPECIMEN`. Local AuthService process stopped to clear file lock; then:

```text
dotnet test microservices/auth-service/AuthService.Tests/AuthService.Tests.csproj --no-build
  --filter "FullyQualifiedName~InternalAudit|FullyQualifiedName~InternalLms|FullyQualifiedName~EnterpriseLmsSpecimen|FullyQualifiedName~InternalLmsMasterValue"
→ Passed: 33, Failed: 0

dotnet test … --filter "FullyQualifiedName~MasterValue"
→ Passed: 4, Failed: 0
```

---

## 12. Out of scope (confirmed not implemented)

- Barcode / labels / printers  
- Custody / aliquots / referral receiving  
- Testing / results / reporting / authorization  
- Billing  
- Specimen ownership / claim / assign  
- Pathology migration  
- Production role grants  
- L-COL-01E  

---

## 13. Manual UAT checklist (do not execute in this task)

1. Sign in with authorized specimen-view user.  
2. Open LMS Specimens.  
3. Verify Collected specimen appears.  
4. Verify MRN/name/DOB.  
5. Open Receive.  
6. Confirm patient identity.  
7. Receive specimen.  
8. Verify Received.  
9. Verify accession `ACC-YYYYMMDD-NNNNNN` (19 chars).  
10. Verify sequence.  
11. Verify receiver/time.  
12. Verify Order remains Submitted.  
13. Verify OrderTest remains Ordered.  
14. Verify audit `RECEIVE_SPECIMEN`.  
15. Repeat Receive.  
16. Verify no duplicate accession.  
17. Test concurrency/409.  
18. Reject another Collected specimen.  
19. Verify governed reason list.  
20. Verify reason stored.  
21. Verify label snapshot.  
22. Verify no accession on rejected specimen.  
23. Verify audit `REJECT_SPECIMEN`.  
24. Attempt Receive on Rejected — blocked.  
25. Test unauthorized branch — blocked.  
26. Test missing `lms.specimens.receive` — actions unavailable/forbidden.  
27. Verify no barcode/label functionality.  
28. Verify CollectionTask behavior.  
29. Verify Orders behavior.  
30. Verify Catalogue behavior.  
31. Verify Pathology regression.  
32. Apply SQL migration `68_lms_specimen_rejection_reasons.sql` and LaboratoryApi EF migration before UAT.

---

## FINAL STATUS

**IMPLEMENTATION_COMPLETE_READY_FOR_MANUAL_UAT**

Do not claim UAT passed. Do not claim acceptance. Do not start L-COL-01E.
