# L-CAT-01B — Read-Only Platform Audit Verification

**Date:** 2026-10-09  
**Mode:** Read-only — no code, schema, data, permission, or lifecycle changes  
**Subject:** UAT catalogue item display name **UAT Test 003**, internal code **UAT-TEST-002**, version **v2 Active**  

## Final determination

**PASS**

All four required lifecycle actions for **v2** are present in platform `audit_log` with correct tenant, actor, resource type, and resource id mapping. No duplicate retry rows were found for the v2 lifecycle sequence.

---

## 1. Catalogue identity (from database)

| Field | Value |
|---|---|
| Catalogue item id | `ceaa49bd-3eb7-4a96-a4eb-d303f9af185e` |
| Tenant id | `155fe198-6ae5-4a01-9254-ead5b427247e` |
| Type | `TEST` |
| Latest version id | `374db3af-7487-4c75-aa00-4847609dd1c5` (**v2**) |
| Current active version id | `374db3af-7487-4c75-aa00-4847609dd1c5` (**v2**) |
| Soft-deleted | false |

| Version | Version id | Status | Display name | Internal code |
|---|---|---|---|---|
| v1 | `683da9a2-14a3-4913-9835-3515a4003e31` | Superseded | UAT Test 002 | UAT-TEST-002 |
| v2 | `374db3af-7487-4c75-aa00-4847609dd1c5` | **Active** | **UAT Test 003** | UAT-TEST-002 |

| Actor (safe) | Value |
|---|---|
| User id | `dddddddd-dddd-dddd-dddd-dddddddddddd` |
| Email | `admin@test.com` |

Discipline on both versions: `HISTOPATHOLOGY_CYTOPATHOLOGY`.

---

## 2. Required lifecycle actions for v2 — presence

Scoped to `resource_type = LmsCatalogueVersion` and `resource_id = v2` (`374db3af-…`):

| Required action | Present on v2? | Count on v2 |
|---|---|---|
| `CREATE_VERSION` | **Yes** | 1 |
| `SUBMIT_REVIEW` | **Yes** | 1 |
| `APPROVE` | **Yes** | 1 |
| `ACTIVATE` | **Yes** | 1 |

---

## 3. Exact audit entries (safe fields only)

### A. Required v2 lifecycle sequence

| # | Audit id | Timestamp (UTC) | Action | ResourceType | ResourceId | TenantId | UserId | Status/outcome | Old → New | SessionId |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `c5c8f833-335c-4b84-86be-87ff69aaa0c0` | 2026-10-08 20:33:38.902059+00 | `CREATE_VERSION` | `LmsCatalogueVersion` | `374db3af-7487-4c75-aa00-4847609dd1c5` | `155fe198-…` | `dddddddd-…` (`admin@test.com`) | `active` | → `status=Draft` | *(empty)* |
| 2 | `1e219902-82fa-4f17-be07-d09a0b0e0db8` | 2026-10-08 20:36:07.738511+00 | `SUBMIT_REVIEW` | `LmsCatalogueVersion` | `374db3af-…` | `155fe198-…` | `dddddddd-…` | `active` | `Draft` → `Review` | *(empty)* |
| 3 | `09e6715e-3f26-40c4-9f6e-f9c317049bcf` | 2026-10-08 20:36:44.458139+00 | `APPROVE` | `LmsCatalogueVersion` | `374db3af-…` | `155fe198-…` | `dddddddd-…` | `active` | `Review` → `Approved` | *(empty)* |
| 4 | `f492efdd-4f0c-4cad-a646-539d9c7ff21b` | 2026-10-08 20:38:50.868674+00 | `ACTIVATE` | `LmsCatalogueVersion` | `374db3af-…` | `155fe198-…` | `dddddddd-…` | `active` | `Approved` → `Active` | *(empty)* |

Also present on v2 (supporting, not in the required four):

| Audit id | Timestamp (UTC) | Action | Notes |
|---|---|---|---|
| `6578c8ce-0ace-43c0-baa6-b76801272415` | 2026-10-08 20:35:04.659622+00 | `UPDATE_DRAFT` | One draft edit before submit; outcome `active` |

### B. Related v1 history (same item; expected, not duplicates of v2)

These are **separate resource ids** (v1), documenting the prior Active lifecycle that was later superseded when v2 was created:

| Timestamp (UTC) | Action | ResourceId (v1) | Old → New |
|---|---|---|---|
| 2026-10-08 20:33:27.410308+00 | `CREATE_DRAFT` | `683da9a2-…` | → Draft |
| 2026-10-08 20:33:32.983056+00 | `SUBMIT_REVIEW` | `683da9a2-…` | Draft → Review |
| 2026-10-08 20:33:34.712542+00 | `APPROVE` | `683da9a2-…` | Review → Approved |
| 2026-10-08 20:33:36.299321+00 | `ACTIVATE` | `683da9a2-…` | Approved → Active |
| 2026-10-08 20:33:38.723327+00 | `SUPERSEDE` | `683da9a2-…` | Active → Superseded; `supersededBy=374db3af-…` |

---

## 4. Actor / tenant / resource mapping

| Check | Result |
|---|---|
| Tenant on all audits for this item’s versions | Matches catalogue `tenant_id` `155fe198-6ae5-4a01-9254-ead5b427247e` |
| Actor on all audits | `dddddddd-dddd-dddd-dddd-dddddddddddd` / `admin@test.com` |
| Actor matches version lifecycle columns | `created_by` / `submitted_by` / `approved_by` / `activated_by` on v2 = same user id |
| ResourceType | Always `LmsCatalogueVersion` |
| ResourceId for required v2 actions | Always v2 id `374db3af-7487-4c75-aa00-4847609dd1c5` |
| CREATE_VERSION targets new Draft v2 | Yes |
| SUBMIT / APPROVE / ACTIVATE order vs timestamps | Chronological and consistent with DB `submitted_at` / `approved_at` / `activated_at` |

---

## 5. Duplicates / unexpected entries

| Check | Result |
|---|---|
| Duplicate `CREATE_VERSION` on v2 | **None** (count 1) |
| Duplicate `SUBMIT_REVIEW` on v2 | **None** (count 1) |
| Duplicate `APPROVE` on v2 | **None** (count 1) |
| Duplicate `ACTIVATE` on v2 | **None** (count 1) |
| Extra `SUBMIT_REVIEW` / `APPROVE` / `ACTIVATE` on v1 | Expected prior-lifecycle history, **not** retries of v2 |
| `RETURN_TO_DRAFT` / `RETIRE` for these versions | **0** |
| Unexpected actions for v2 | Only expected `UPDATE_DRAFT` before submit |

**No retry-induced duplicate lifecycle audits on v2.**

---

## 6. PASS/FAIL

| Criterion | Result |
|---|---|
| `CREATE_VERSION` present for v2 | PASS |
| `SUBMIT_REVIEW` present for v2 | PASS |
| `APPROVE` present for v2 | PASS |
| `ACTIVATE` present for v2 | PASS |
| Actor / tenant / resource mapping correct | PASS |
| No duplicate v2 lifecycle retries | PASS |
| **Overall** | **PASS** |

---

## 7. Issues requiring implementation changes?

**None identified for audit coverage of this UAT path.**

Observation (informational, not a fail for this verification):

- `SessionId` / correlation fields on these internal audit writes are **empty**. Platform audit still recorded action, resource, actor, tenant, timestamps, outcome (`status=active`), and old/new status values. If product later requires correlation propagation for LaboratoryApi → AuthService audit, that would be a separate enhancement — not required to pass this UAT audit check.

---

## STOP

- No audit records created  
- No lifecycle mutations  
- Active v2 not retired or superseded  
- L-ORD-01 not started  
