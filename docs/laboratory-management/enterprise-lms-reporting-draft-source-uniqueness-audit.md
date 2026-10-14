# L-REP-01 — Draft Report Source Uniqueness Audit

**Date:** 2026-10-12  
**Mode:** AUDIT FIRST (implementation follows this document)  
**Defect:** Manual UAT — multiple Draft Reports created from the same ClinicallyAuthorized ResultVersion  
**Product decision:** PD-REP-DRAFT-UNIQUE-01

---

## 1. Confirmed UAT defect

Multiple independent Draft Report aggregates were created from the same exact ResultVersion provenance:

| Field | Observed |
| --- | --- |
| Order | LAB-20261012-000001 |
| Distinct Report IDs | a34dfddc…, c08ddff2…, 3d83734c… |
| ResultVersionNumber | 1 |
| Provenance ResultVersionId | 533b7dd7-28e9-48ac-8dc2-74b898b072d7 |
| Status at snapshot | ClinicallyAuthorized |

This is a **business uniqueness violation**, not an idempotency failure. Distinct idempotency keys correctly created distinct Reports because no ResultVersion exclusivity rule existed.

The Create Draft UI continues to list the same ClinicallyAuthorized ResultVersion after it is already bound to a Draft, because `eligible-sources` does not exclude used sources.

---

## 2. Why the same ResultVersion remains eligible repeatedly

`ReportService.ListEligibleSourcesAsync`:

- Filters `lms_results` by tenant, operating branch, `Status == ClinicallyAuthorized`, and non-null `AuthorizedVersionNumber`.
- Does **not** join `lms_report_version_sources`, `lms_reports`, or any exclusivity store.
- Therefore every ClinicallyAuthorized Result remains selectable forever, including after Draft Report creation.

Frontend `ReportsWorkbench` only renders whatever eligible-sources returns; it has no client-side “already in draft” filter.

---

## 3. Why the backend currently permits multiple Reports

`ReportService.CreateDraftAsync` / `ResolveEligibleSourcesAsync` enforce:

1. ClinicallyAuthorized status  
2. Exact authorized ResultVersionNumber  
3. Tenant + operating branch  
4. Same patient + order reporting context  
5. OrderTest remains Ordered  
6. Idempotency key + request hash  

They do **not** check whether `ResultVersionId` (or ResultId + ResultVersionNumber) is already attached to another Draft Report.

`AppendVersionAsync` reuses the same `ResolveEligibleSourcesAsync` path and likewise has no exclusivity check.

---

## 4. Existing unique constraints

On `lms_report_version_sources` today:

- Unique: `(report_version_id, result_id, result_version_number)` — uniqueness **within one ReportVersion only**.
- Non-unique indexes on `(tenant_id, result_id)` and `result_version_id`.

There is **no** tenant-scoped uniqueness on `result_version_id` across Reports. No partial unique index on Draft status. No exclusivity claim table.

Idempotency uniqueness is on `(tenant_id, idempotency_key)` only — orthogonal to this defect.

---

## 5. Should uniqueness be enforced at the database level?

**Yes.** Application pre-check alone is not race-safe across concurrent LaboratoryApi instances.

### Why not a unique index directly on `lms_report_version_sources.result_version_id`?

That would be **incorrect** for the approved versioning model:

- Append Draft ReportVersion may re-snapshot the same ResultVersion on a **later** ReportVersion of the **same** Report.
- Historical immutable source rows must remain.
- Multi-result composition places multiple distinct ResultVersions on one ReportVersion (that part is fine), but same ResultVersion across ReportVersions of one Report must remain allowed.

### Safe race-safe model (minimal)

Introduce `lms_report_draft_source_claims`:

| Column | Role |
| --- | --- |
| `tenant_id` + `result_version_id` | **UNIQUE** — authoritative Draft exclusivity |
| `report_id` | Owning active Draft Report |
| `result_id`, `result_version_number` | Provenance for conflict messaging |
| `created_at_utc` | Audit/debug |

Semantics:

- A ResultVersion may appear in **at most one** claim row per tenant → at most one active Draft Report.
- Multiple ResultVersions may claim the same `report_id` → multi-result composition preserved.
- Same ResultVersion may still appear on multiple `lms_report_version_sources` rows for that same Report’s version history.
- No new Report lifecycle status invented; foundation remains Draft-only. Claims apply while Report `status = Draft` (all foundation Reports).

Application layer:

1. Pre-check claims (honest 409 `report_source_already_in_draft` before write).  
2. Insert claims in the same `SaveChanges` as Report + ReportVersion + sources.  
3. Map PostgreSQL unique violation to the same 409 (concurrency).  
4. On audit fail-closed revert, delete claims with the Report.

This is equally authoritative to a correctly scoped partial unique index and avoids multi-table filter index complexity.

---

## 6. How ReportVersionSource rows are represented

Each create/append builds immutable snapshot rows:

- Exact `ResultId`, `ResultVersionId`, `ResultVersionNumber`
- Value/comment/unit/datatype snapshots
- `ResultStatusAtSnapshot = ClinicallyAuthorized`
- Authorization actor/time snapshots

Identity for PD-REP-DRAFT-UNIQUE-01 is **`ResultVersionId`** (with tenant), which already encodes ResultId + version number via the ResultVersion aggregate. Do not key uniqueness on OrderId, PatientId, or ResultId alone.

---

## 7. Preserving multi-result composition

Unchanged create contract:

```
sources: [ { resultId, resultVersionNumber }, ... ]
→ one LmsReport + one ReportVersion + N source rows
```

Same-order / same-patient `context_mismatch` remains. Claims insert N rows sharing one `report_id`. No per-source Report split.

---

## 8. Existing duplicate UAT rows (non-destructive)

UAT already has multiple Drafts sharing the same ResultVersionId.

**Do not** auto-delete, merge, rewrite snapshots, or mark Final/Released.

Migration approach:

1. Create `lms_report_draft_source_claims`.  
2. Backfill with `DISTINCT ON (tenant_id, result_version_id)` choosing the **oldest** Draft Report that references that ResultVersion (by `lms_reports.created_at_utc`, then `id`).  
3. Apply UNIQUE `(tenant_id, result_version_id)`.

Effect:

- Constraint can be applied even when duplicate Drafts exist.  
- Oldest Draft retains the claim; newer duplicate Drafts remain as orphaned UAT rows but **cannot** receive new claims for that ResultVersion.  
- New creates for that ResultVersion receive 409.  
- Eligible-sources excludes claimed ResultVersions.

**UAT cleanup recommendation (manual, explicit, non-production):** operators may later archive/delete orphaned duplicate Draft Reports **only** in the UAT database after confirming they are Manual UAT artifacts. Not part of this code correction; never run against production.

---

## 9. eligible-sources correction

Exclude Results whose authorized `ResultVersion.Id` already has a draft source claim for the tenant.

Preferred: return only sources usable for a **new** Draft Report. No cross-tenant/report leakage in exclusion reasons required for this slice (simple omission is enough).

---

## 10. UI correction (minimal)

- Rely on corrected eligible-sources (used ResultVersion no longer listed).  
- After successful create, reload eligible list + reports.  
- On 409 `report_source_already_in_draft`, show honest message and reload eligibility.  
- No redesign; no Finalize/Release/PDF.

---

## 11. Exact minimal implementation

| Area | Change |
| --- | --- |
| Domain | `LmsReportDraftSourceClaim` |
| DbContext + migration | Table + unique + safe backfill |
| `CreateDraftAsync` | Claim insert + conflict mapping; revert deletes claims |
| `AppendVersionAsync` | Claim new ResultVersions for same Report; reject foreign claims |
| `ListEligibleSourcesAsync` | Exclude claimed authorized ResultVersions |
| FE | 409 handling + reload eligibility after create/conflict |
| Tests | Uniqueness, eligible exclusion, multi-result, idempotency trio, Postgres concurrency, regressions |

---

## 12. Safety gate

Proposed rule is **safe and unambiguous** given:

- Draft-only foundation status model already approved.  
- ResultVersionId identity already persisted on sources.  
- Claim table avoids incorrect unique constraint on historical source rows.  
- Multi-result and same-order context rules preserved.  
- Finalize/Release/amendment not redefined.

**STOP condition:** not triggered. Proceed to implementation.

---

## 13. Out of scope (confirmed)

Finalize, Release, PDF, numbering, signatory, patient/Portal/360 publication, amendments, Pathology, CanonicalDocument, ResultStatus changes, L-AUTH/L-VER/L-TST/L-CRT, permissions/role grants, new branch hierarchy.
