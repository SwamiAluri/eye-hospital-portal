# L-CAT-01B Pre-UAT Gate Report

**Date:** 2026-10-08  
**Slice:** Enterprise LMS Catalogue Domain  
**Order Intake:** NOT started  

## Final gate status

**READY_FOR_MANUAL_UAT**

---

## 1. Audit security verification

### Repository pattern

All AuthService `Internal*` controllers (IP beds, CCMS callback, canonical documents, etc.) authenticate with a shared `X-Internal-Key`. There is **no** stronger platform S2S pattern (HMAC, mTLS, per-service key) in the existing codebase. AD-CAT-AUDIT approved `X-Internal-Key` + tenant assertion.

### Pre-gate weakness (found)

Initial L-CAT-01B endpoint accepted:
- key-only auth;
- body-supplied `TenantId` / `ActorUserId` / `Action` / `ResourceType` without header tenant match or allowlists;

so a leaked key could write arbitrary audit actions/resources and spoof tenant/actor in the body.

### Hardening implemented (smallest safe correction)

| Control | Change |
|---|---|
| Shared key | Unchanged (platform Internal* pattern) |
| Tenant | **Required** `X-Tenant-ID` must match body `TenantId` |
| Action allowlist | Catalogue lifecycle actions only |
| ResourceType allowlist | `LmsCatalogueVersion` only |
| LaboratoryApi client | Sends per-call `X-Tenant-ID` |
| Timestamp | Server-controlled in `AuditService.LogAsync` |
| Fail-closed | Catalogue mutations compensate/revert if audit write fails |

### Residual risk (documented, matches platform)

- Anyone holding the shared Internal API key can still set `ActorUserId` (same as `InternalIpBedController` journey API).
- Network exposure of the internal key remains an ops concern (not introduced by this slice).

Actor for catalogue mutations is taken from **JWT** in LaboratoryApi before the S2S audit call; the weakness is limited to callers who already possess the internal key.

### Checklist

| # | Requirement | Status |
|---|---|---|
| 1 | Only intended service pattern (Internal key + LaboratoryApi client) | Pass (platform pattern) |
| 2 | Key alone cannot write arbitrary actions/resources | **Hardened** (allowlists) |
| 3 | Tenant not freely body-spoofable | **Hardened** (header match) |
| 4 | Actor from trusted JWT at LaboratoryApi; S2S carries that actor | Pass + residual key risk |
| 5–8 | Resource/action/reason/old/new preserved | Pass |
| 9 | Timestamp server-controlled | Pass |
| 10 | Correlation → SessionId when provided | Pass |
| 11 | Outcome success/failure in response | Pass |
| 12 | Fail-closed on audit failure | **Hardened** |

---

## 2. Effective-date verification

| Scenario | Behavior |
|---|---|
| A. Initial Draft→…→Active | Supported; `EffectiveFrom` defaults to UTC now if unset |
| B. Active/Retired/Superseded in-place edit | Rejected (`immutable_version`) |
| C. Change to Active | Explicit `supersede` → new Draft v+1; historical version preserved |
| D. Future `EffectiveFrom` on activate | Version becomes lifecycle **Active** immediately; `EffectiveFrom` stored as future. Prior Active is auto-superseded immediately. **Lifecycle Active ≠ calendar-effective.** |
| E. Overlapping effective periods | Two simultaneous lifecycle-Active versions are not retained; activate auto-supersedes prior Active. Overlap helper is informational; activate does not leave two Active rows. |
| F. Auto-supersede on activate | **Yes** — server-side, same SaveChanges, prior Active → Superseded with `SupersededByVersionId`, historical row queryable, then ACTIVATE audit. |
| G. Explicit supersede | Confirmed: marks current Active as Superseded, creates Draft v+1, clears `CurrentActiveVersionId`. |

### Product flag (not silently changed)

Explicit supersede leaves the item **without an Active version** while the replacement is Draft. This matches the written implementation report and is intentional CMS-style editing, but it is a **product/ops gap** until the new version is activated. Do not invent a dual-active or “pending effective” state without decision.

---

## 3. Versioning verification

- Deterministic integer `VersionNumber`
- Historical Active/Retired/Superseded definitions not mutated by draft edit
- Version history API/UI available
- Concurrency via `RowVersion` / `expectedRowVersion`

---

## 4. Lifecycle negative tests

Automated in `CataloguePreUatGateTests` + existing `CatalogueServiceTests`:

| Transition | Result |
|---|---|
| Draft → Approved | Rejected |
| Draft → Active | Rejected |
| Review → Active | Rejected |
| Active → Draft | Rejected |
| Retired → Active | Rejected |
| Superseded (latest Draft after supersede) → Active | Rejected until Approved path |
| Active → edit in place | Rejected |
| Retired/Superseded historical mutation | Historical rows preserved; not overwritten |
| Draft → Review → Draft → Approved → Active → Retired/Supersede | Valid |

No Rejected state invented.

---

## 5. Tenant / branch isolation

| Check | Status |
|---|---|
| TenantId mandatory on entities | Pass |
| Tenant A cannot get/list Tenant B | Pass (tests) |
| Branch filter: own branch + tenant-wide; excludes other branch | Pass (tests) |
| Empty branch rows = tenant-wide | Pass |
| No new org/site hierarchy | Pass (platform Branch IDs only) |

---

## 6. Permission verification

| Check | Status |
|---|---|
| `lms.catalogue.view\|manage\|approve` seeded | Pass |
| No role grants (PD-CAT-02) | Pass |
| `laboratory.view` does not authorize catalogue | Pass |
| Server authz on list/detail/create/draft/lifecycle routes | Pass (`CatalogueFunctions` + `LaboratoryAuthz`) |
| Admin `*` | Unchanged platform wildcard |

---

## 7. Audit coverage

| Mutation | Action | Fail-closed |
|---|---|---|
| Create draft | CREATE_DRAFT | Soft-delete compensate |
| Update draft | UPDATE_DRAFT | Field restore |
| Submit / return / approve / retire | SUBMIT_REVIEW / RETURN_TO_DRAFT / APPROVE / RETIRE | Lifecycle restore |
| Activate (+ auto-supersede) | SUPERSEDE + ACTIVATE | Status restore |
| Explicit supersede | SUPERSEDE + CREATE_VERSION | Restore Active; remove orphan draft |
| Branch changes on draft update | Covered under UPDATE_DRAFT | Yes |

---

## 8. Commercial linkage status

- `ServiceCatalogRef` nullable; activation does **not** require it.
- No LMS pricing engine; Billing remains financial SoT.

**DECISION DEFERRED:** Whether a valid Service Catalog/commercial reference is mandatory before catalogue activation.

---

## 9. UI verification

Source inspection of:

- `/dashboard/lms/configuration/test-catalogue`
- `/dashboard/lms/configuration/test-catalogue/[id]`
- `/dashboard/lms/configuration/panels`

| Check | Status |
|---|---|
| Existing LMS shell + shadcn primitives | Pass |
| No fake clinical values / KPIs | Pass |
| Lifecycle badge + gated actions | Pass |
| Permission-aware empty/unauthorized | Pass |
| Branch applicability copy (tenant-wide vs IDs) | Pass |
| Version history table | Pass |
| Audit section points to platform audit_log (not fake local rows) | Pass |
| Loading/error/empty honest | Pass |

Manual keyboard/responsive UAT remains in UAT-10.

---

## 10. Legacy regression

- Pathology LaboratoryCatalog tests: **17/17 passed**
- No changes to `/dashboard/laboratory`, `laboratory_*` tables, or Pathology catalogue APIs in this gate

---

## 11. Tests executed / results

| Suite | Result |
|---|---|
| LaboratoryApi.Tests | **53/53** (was 37; +pre-UAT gate tests) |
| AuthService EnterpriseLms + InternalAudit | **12/12** |
| AuthService LaboratoryCatalog (Pathology) | **17/17** |
| Auth combined filter (above) | **29/29** |
| FE LMS vitest (L0 + catalogue + API client) | **20/20** |

---

## 12. Remaining product decisions

1. **PD-CAT-02** — which roles receive catalogue permissions  
2. **Commercial** — Service Catalog ref mandatory before activate?  
3. **Explicit supersede gap** — accept no Active while Draft pending, or require a different transition model?  
4. **Future EffectiveFrom** — should activate be blocked until From ≤ now, or keep lifecycle Active with future From?

---

## 13. Remaining risks

- Shared Internal API key compromise still allows spoofed `ActorUserId` (platform-wide pattern).
- Explicit supersede creates an Active-less window (by design today).
- Future-dated Active versions may confuse future Order Intake if calendar-effective ≠ status Active.
- Migration must be applied before Manual UAT mutations.

---

## 14. Final gate status

**READY_FOR_MANUAL_UAT**

Proceed to Manual UAT (UAT-01…11).  
Do **not** start L-ORD-01 / Order Intake until Manual UAT acceptance and explicit next-slice approval.
