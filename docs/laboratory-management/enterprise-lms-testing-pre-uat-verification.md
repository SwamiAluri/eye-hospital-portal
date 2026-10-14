# L-TST-01A — PRE-UAT Verification

**Date:** 2026-10-11  
**Slice:** L-TST-01A — Testing Work Queue + Manual Result Draft  
**Authorization:** `PRODUCT_DECISIONS_CLOSED_L_COL_01F_AUTHORIZED`  
**Implementation baseline:** `IMPLEMENTATION_COMPLETE_READY_FOR_PRE_UAT`

---

## Gate purpose

PRE-UAT **evidence / correction** gate only.

- Manual UAT was **not** executed  
- L-VER-01 / L-AUTH-01 / L-CRT-01 / Reporting / Instrument / Runs-QC / Referral Results / Billing were **not** started  
- Product scope was **not** expanded  

---

## Automated evidence (executed 2026-10-11)

| Suite | Command / filter | Passed | Failed | Skipped | Total |
|---|---|---:|---:|---:|---:|
| LaboratoryApi `ResultServiceTests` | `FullyQualifiedName~ResultServiceTests` | 25 | 0 | 0 | 25 |
| LaboratoryApi Barcode | `FullyQualifiedName~SpecimenBarcodeServiceTests` | 28 | 0 | 0 | 28 |
| LaboratoryApi Receiving | `FullyQualifiedName~SpecimenReceivingServiceTests` | 19 | 0 | 0 | 19 |
| LaboratoryApi Collection | `FullyQualifiedName~CollectionServiceTests\|CollectionAssignInvalidGuidTests` | 33 | 0 | 0 | 33 |
| LaboratoryApi Specimen | `FullyQualifiedName~SpecimenServiceTests` | 19 | 0 | 0 | 19 |
| LaboratoryApi combined LMS regression + Result | Result + Barcode + Receiving + Collection + Specimen filters | 116 | 0 | 0 | 116 |
| AuthService Testing permission catalog | `FullyQualifiedName~EnterpriseLmsTestingPermissionTests` | 2 | 0 | 0 | 2 |
| AuthService Result audit allowlist | `FullyQualifiedName~Allowlist_Covers_Lms_Result` | 1 | 0 | 0 | 1 |
| Frontend Testing UI | `vitest run …/enterprise-lms-testing-ui.test.ts` | 4 | 0 | 0 | 4 |

---

## Evidence checklist

### 1. UPDATE audit failure atomicity — **PASS**

Code: `ResultService.UpdateDraftAsync` → fail-closed `RevertUpdateAsync` (restore prior aggregate fields/RowVersion; remove new `ResultVersion`; orphan check throws `audit_unavailable`).

Regression: `Audit_Failure_Fail_Closed_On_Update_Restores_Persisted_State`

| Step | Observed |
|---|---|
| Existing Draft loaded | Yes |
| Update persists then audit forced to fail | Yes |
| API | `503` / `audit_unavailable` |
| Persisted Result after failure | Prior numeric/comment/version/RowVersion/Draft status |
| New ResultVersion | Not present |
| Retry after audit recovery | Succeeds; version advances to 2 |
| OrderTest | Remains `Ordered` |

Create-path fail-closed remains covered by `Audit_Failure_Fail_Closed_On_Create`.

### 2. CREATE idempotency — **PASS**

Tests: `Idempotent_Create_Replays_And_Hash_Conflict_Is_409`, `Create_Idempotency_Replay_Does_Not_Duplicate_Version`

| Case | Result |
|---|---|
| Same tenant + key + hash | Deterministic replay; same Result ID; 1 Result; 1 ResultVersion; create audit once |
| Same tenant + key + different hash | `409` / `idempotency_conflict`; no extra Result/Version |

### 3. UPDATE idempotency — **PASS**

Test: `Update_Idempotency_Replay_And_Hash_Conflict`

| Case | Result |
|---|---|
| Same tenant + key + hash | Replay; no second ResultVersion; update audit once |
| Same tenant + key + different hash | `409` / `idempotency_conflict`; no extra version; data unchanged |

### 4. Tenant authorization — **PASS**

Tests: `Wrong_Tenant_Denied`, `Tenant_Cannot_Read_Or_Mutate_Other_Tenant_Result`

| Case | Result |
|---|---|
| Tenant A cannot read tenant B work item | `404` (empty/not visible) |
| Tenant A cannot read tenant B Result | `404` |
| Tenant A cannot create Result for tenant B work | `404` |
| Tenant A cannot update tenant B Result | `404` |

No new tenant hierarchy introduced.

### 5. Branch authorization — **PASS**

Tests: `Unauthorized_Branch_Denied`, `Unauthorized_Branch_Denies_WorkItem_Create_And_Update`, `Client_Other_Branch_Still_Server_Authorized`

Uses `ValidateUserBranchAsync` / existing platform branch denial (`403` / `branch_unauthorized`).

| Case | Result |
|---|---|
| Authorized tenant + authorized branch | Success (happy-path create/update/queue tests) |
| Authorized tenant + unauthorized branch | Denied for queue, work item, create, update |
| Client supplies another branch | Server still denies (`403`) |

### 6. Catalogue ResultDatatype semantics — **PASS**

Catalogue values used as-is: **Numeric**, **Qualitative**.  
Free-text comment is an **ancillary** field on the Draft (not a new catalogue datatype).

| Case | Evidence |
|---|---|
| Numeric / Qualitative accepted | `Create_And_Update_Draft_Keep_OrderTest_Ordered`, `Qualitative_Value_Supported` |
| Comment ancillary only | `Comment_Is_Ancillary_Not_A_Catalogue_Datatype` |
| Unsupported / unknown datatype | `Unsupported_Datatype_Rejected`, `Unknown_Catalogue_Datatype_Rejected_Honestly` → `unsupported_datatype` |
| No auto reference interval / abnormal / critical / interpretation | `No_Hardcoded_Flag_Or_Interpretation_Fields` |

No new master/enum/catalogue datatype added for this gate.

### 7. ResultVersion foundation — **PASS**

| Case | Evidence |
|---|---|
| First Draft creates version 1 | Create tests + version counts |
| Update appends Draft version | `Result_Versions_Are_Append_Only_And_Not_Overwritten` |
| Old versions not overwritten | Same |
| Idempotent update does not add version | `Update_Idempotency_Replay_And_Hash_Conflict` |
| Failed update/audit leaves no orphan version | `Audit_Failure_Fail_Closed_On_Update_Restores_Persisted_State` |
| RowVersion concurrency | `Stale_RowVersion_Returns_409` |

No Final / Amended / Released / Verified / Authorized states introduced.

### 8. Regression boundary — **PASS**

Primary: `Upstream_Lifecycles_Unchanged_After_Draft`, `Create_And_Update_Draft_Keep_OrderTest_Ordered`, plus Collection / Specimen / Receiving / Barcode suites (see table above).

Proven / preserved:

- OrderTest remains `Ordered`  
- CollectionTask / Specimen / Receiving / Barcode / Order lifecycle unchanged by Testing draft  
- Pathology remains separate (not invoked)  
- Testing does not generate barcode or accession  
- Testing does not create CollectionTask or trigger Receiving / billing  

---

## Environment PRE-UAT

| Item | Status |
|---|---|
| Apply migration `20261011161033_AddLmsResultDraftTesting` to target DB | **Applied** (tables present) |
| Restart LaboratoryApi | **Done** (post Work Queue fix) |
| Restart AuthService (permission seed + audit allowlist) | **Done** |
| Frontend navigate Testing | **Operator Manual UAT** |
| Smoke: queue honesty, create draft, update draft | **Pending Manual UAT** |

---

## Manual UAT blocker correction (2026-10-11) — Work Queue HTTP 500

### Observed

- Page `/dashboard/lms/testing` rendered
- Work Queue UI showed: `Request failed with status code 500`
- Failing request: `GET /api/lms/testing/work-queue?operatingBranchId={branch}&page=1&pageSize=25`
- Permission required: one of `lms.testing.view|manage|result`

### Root cause

`System.InvalidOperationException` in `ResultService.ListWorkQueueAsync` (Count/OrderBy path):

> The LINQ expression … `.ReceivedAtUtc)` could not be translated

Against PostgreSQL, EF Core could not translate OrderBy/Count over a **positional record constructor projection** that also left-joined `lms_results`. InMemory tests did not catch this.

Migration/schema was **not** the cause (`20261011161033_AddLmsResultDraftTesting` already applied; `lms_results` / `lms_result_versions` / `lms_result_idempotency` present).

### Fix

- Replace Result left-join + record-ctor projection with a **scalar property-init** eligibility projection (`EligibleWorkScalar`)
- Order/Count/Skip/Take on scalar columns (`ReceivedAtUtc`, `SortOrder`)
- Attach optional draft metadata in a second query after paging
- Eligibility rules unchanged (Submitted + Ordered + Received + local TEST/PANEL + branch)

Files: `LaboratoryApi/Services/ResultService.cs`

### Tests added

- `Empty_Work_Queue_Returns_Empty_Page_Not_Error`
- `Work_Queue_Allows_Null_Or_Unsupported_ResultDatatype_Without_Crash`
- `Work_Queue_HasDraft_Filter_And_Draft_Enrichment`
- `ResultServicePostgresWorkQueueTests.PostgreSQL_Work_Queue_Empty_Does_Not_Throw_Translation_Error` (real Npgsql)

### Test results (post-fix)

| Suite | Passed | Failed | Skipped | Total |
|---|---:|---:|---:|---:|
| ResultServiceTests + ResultServicePostgresWorkQueueTests | 29 | 0 | 0 | 29 |
| Combined LMS regression + Result filter | 128 | 0 | 0 | 128 |
| FE `enterprise-lms-testing-ui.test.ts` | 4 | 0 | 0 | 4 |

### Manual Work Queue recheck

After LaboratoryApi restart:

- `GET /api/lms/testing/work-queue?operatingBranchId=…&page=1&pageSize=25` → **HTTP 200**
- Body: honest empty page (`totalCount=0`, `items=[]`) when no eligible work
- No EF translation exception in host logs

Full Manual UAT checklist **not** re-run in this correction task.

---

## Explicit non-claims

- Manual UAT **not** completed  
- L-TST-01A **not** accepted  
- Verification / Authorization / Reporting / Instrument / Runs-QC / Referral Results / Billing **not** started  

---

## Gate status

# UAT_DATA_READY_FOR_L_TST_01A

## UAT catalogue configuration closure (2026-10-11)

UAT-only catalogue/order data. Not a Testing implementation change. Not acceptance.

| Item | Value |
|---|---|
| Catalogue item | UAT Orderable CBC / `UAT-ORD-01C-001` (`5a078cb7-8778-4cff-b39f-8a7e737c37f9`) |
| v1 | `d0c22738-c883-4b93-bc7d-51b348eeab39` → **Superseded**, ResultDatatype still **null** |
| v2 | `e148fc4d-ce57-4269-94b9-143d3319ad98` → **Active**, ResultDatatype = **Numeric** |
| Lifecycle | Active → Supersede → Draft v2 → Review → Approved → Active |
| New order | `LAB-20261011-000001` Submitted |
| OrderTest | `166bd4b9-5d29-4a47-ad57-f4e920e02d91` Ordered @ v2 |
| Specimen | `95c097dd-a35e-4635-94f5-ce0127d4e76b` Received / `ACC-20261011-000002` |
| Work queue | eligible with Numeric |

`UpdateCatalogueDraftRequest` does not expose ResultDatatype; Numeric was set on **Draft v2 only** after governed Supersede, then lifecycle continued. Active v1 was not edited in place. Prior order `LAB-20261009-000006` unchanged.

- Manual UAT checklist **not** completed  
- L-TST-01A **not** accepted