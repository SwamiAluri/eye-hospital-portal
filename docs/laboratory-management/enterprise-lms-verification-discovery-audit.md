# L-VER-01 — Technical Verification  
# Discovery / Audit

**Date:** 2026-10-12  
**Slice candidate:** L-VER-01 — Technical Verification (name/boundary pending Product Owner)  
**Mode:** DOCUMENTATION / DISCOVERY / AUDIT ONLY — no application code, schema, migrations, APIs, UI, permissions, seed data, role grants, or workflows modified  

**Upstream acceptance:**

| Slice | Status |
|---|---|
| L-COL-01B … L-COL-01E | **ACCEPTED** |
| L-TST-01A | **ACCEPTED** — [enterprise-lms-testing-acceptance-closure.md](./enterprise-lms-testing-acceptance-closure.md) |

**Authoritative context:**

| Source | Role |
|---|---|
| Enterprise LMS PRD/BRD v1.0 | Functional SoT |
| [enterprise-lms-testing-decision-closure.md](./enterprise-lms-testing-decision-closure.md) | Closed L-TST-01A decisions; Verification **DEFERRED** |
| [enterprise-lms-testing-discovery-audit.md](./enterprise-lms-testing-discovery-audit.md) | PRD extraction for Testing / Results |
| [enterprise-lms-testing-implementation.md](./enterprise-lms-testing-implementation.md) | Runtime Result Draft SoT |
| LaboratoryApi Result domain (inspected) | Current implementation evidence |

```text
L-TST-01A ACCEPTED (Draft only)
  ↓
THIS AUDIT — what exists vs Verification gap (preserved)
  ↓
enterprise-lms-verification-decision-package.md
  ↓
enterprise-lms-verification-decision-closure.md
  ← PRODUCT_DECISIONS_CLOSED_L_VER_01_AUTHORIZED
  ← L-VER-01 AUTHORIZED FOR SEPARATE IMPLEMENTATION TASK
  ← NOT IMPLEMENTED BY THESE DOCUMENTS
```

**Authorization (2026-10-12):** Product Owner decisions closed in [enterprise-lms-verification-decision-closure.md](./enterprise-lms-verification-decision-closure.md). This discovery audit is **preserved** as evidence and is not the authorization stamp.

---

## 1. Purpose

Audit the repository and LaboratoryApi Result domain to prepare a Product Owner decision gate for the next Verification slice (**L-VER-01**).

**This document does not authorize or implement Verification.**

Where the PRD or approved closures do not define a rule, the classification is **PRODUCT_DECISION_REQUIRED**. No silent choices.

---

## 2. Current Result domain (repository evidence)

### 2.1 Entities

| Artifact | Path / location | What exists |
|---|---|---|
| `LmsResult` | `LaboratoryApi/Domain/LmsResult.cs` | Aggregate linked to `OrderId`, `OrderTestId`, `SpecimenId`, `TenantId`, `OperatingBranchId`, catalogue item/version, datatype, **Status = Draft only**, current version number, numeric/qualitative/unit/comment, actor timestamps, **RowVersion** |
| `LmsResultVersion` | `LaboratoryApi/Domain/LmsResultVersion.cs` | Append-only version rows (values + comment + created actor/time). **No verification metadata fields** |
| `LmsResultIdempotencyRecord` | Domain + table `lms_result_idempotency` | CREATE/UPDATE draft idempotency |
| `ResultStatuses` | `ResultEnums.cs` | **Only** `Draft` |
| Idempotency ops | `ResultEnums.cs` | `create_result_draft`, `update_result_draft` only |
| Audit actions | `ResultEnums.cs` | `CREATE_RESULT_DRAFT`, `UPDATE_RESULT_DRAFT` only |

**Uniqueness (approved L-TST-01A):** one Result aggregate per `(tenant_id, order_test_id, specimen_id)`.

### 2.2 Service / API / DTO

| Artifact | Evidence |
|---|---|
| `ResultService` | Work queue, work item, get/create/update **Draft** only. Update rejects non-Draft. No verify method |
| `ResultDtos` | Draft DTOs + create/update draft requests with `ExpectedRowVersion` / idempotency key. No verify DTO |
| `TestingFunctions` | Routes under `/api/lms/testing/*` — work-queue, work-items, results GET/POST/PUT. **No verify endpoint** |
| Permissions (BE) | `lms.testing.view` \| `manage` \| `result` only (`LaboratoryAuthz`) |

### 2.3 Status / concurrency / idempotency / audit / authz

| Concern | Current state |
|---|---|
| Result status model | **Draft only** (PD-TST-05 APPROVED for L-TST-01A) |
| RowVersion / concurrency | Optimistic concurrency on update; stale → `409 concurrency_conflict` |
| Idempotency | Operation-specific CREATE/UPDATE draft; hash conflict → `409 idempotency_conflict` |
| Audit | Platform `audit_log`; fail-closed; allowlisted CREATE/UPDATE draft only |
| Tenant authorization | Tenant-scoped queries; cross-tenant → not visible / denied |
| Branch authorization | `ValidateUserBranchAsync` / `403 branch_unauthorized` |

### 2.4 UI

| Surface | Status |
|---|---|
| `/dashboard/lms/testing` (+ workbench) | **Implemented** (Testing Work Queue) |
| `/dashboard/lms/testing/manual-results` | **Implemented** (Manual Result Draft) |
| `/dashboard/lms/results/verification` | **Stub only** — capability `results-verification` = `not_implemented` |
| `/dashboard/lms/results/authorization` | Stub / not_implemented |
| `/dashboard/lms/results/critical`, `/amendments` | Stub / not_implemented |

Draft UI explicitly states no verification / authorization / release / abnormal / critical in L-TST-01A.

### 2.5 Permissions catalog

| Code | In AuthService catalog? | Role grants |
|---|---|---|
| `lms.testing.view` | **Yes** | None |
| `lms.testing.manage` | **Yes** | None |
| `lms.testing.result` | **Yes** | None |
| `lms.testing.verify` | **No** (not present in seed catalog) | N/A |
| `lms.results.verify` | **No** | N/A |

Discovery previously listed `lms.testing.verify` **or** `lms.results.verify` as candidates only — **PRODUCT_DECISION_REQUIRED**.

---

## 3. Current L-TST-01A lifecycle (intentional stop at Draft)

```text
OrderTest (Ordered)
  + Received Specimen (linked)
  + Submitted Order
  + local eligible catalogue
        ↓
  Testing Work Queue (eligible)
        ↓
  Result Draft create  →  Status = Draft, Version 1
        ↓
  Result Draft update  →  Status = Draft, append Version N
        ↓
  STOP  (L-TST-01A ACCEPTED boundary)
```

**Confirmed by PD-TST-04 / PD-TST-05 / PD-TST-09:** L-TST-01A intentionally stops at **Draft**. Technical Verification was **OUT_OF_SCOPE / DEFERRED to L-VER-01**.

OrderTest remains **Ordered**. No Testing-driven OrderTest / Specimen / CollectionTask / Receiving / Barcode mutation.

---

## 4. Verification gap (what is missing)

| Gap | Evidence |
|---|---|
| No Result status beyond Draft | `ResultStatuses` has only `Draft` |
| No verify API / service method | `ResultService` has no verify path |
| No verification metadata on aggregate or version | No verified-by / verified-at / verification reason fields |
| No verification event/history entity | Absent |
| No verification work queue implementation | Stub route only |
| No verification permission | Not catalogued |
| No verification audit actions | Not allowlisted |
| No return-to-draft / reject-from-verify lifecycle | Absent |
| No same-person policy enforcement | Explicitly deferred (PD-TST-11) |
| No clinical authorization | Separate L-AUTH-01 (PD-TST-10) |
| No critical / amendment / reporting / instrument | Deferred / out of scope |

**Do not implement these gaps in this audit.**

---

## 5. PRD requirements relevant to Verification

Extracted from Enterprise LMS PRD/BRD v1.0 via prior Testing discovery (not re-invented). Classification relative to L-VER-01 preparation:

### 5.1 APPROVED / EXISTING (upstream or L-TST-01A)

| ID | Requirement (summary) | Status |
|---|---|---|
| PRD / AD-TST-01 | LaboratoryApi owns LMS Testing/Result domain | **APPROVED EXISTING** |
| AD-TST-02 | LMS Result aggregate + versioning; no in-place overwrite of released clinical records | **APPROVED EXISTING** (Draft foundation live) |
| AD-TST-03 | OrderTest not mutated by Testing | **APPROVED EXISTING** |
| AD-TST-04 | Pathology isolated | **APPROVED EXISTING** |
| AD-TST-06 | Idempotency + RowVersion concurrency patterns | **APPROVED EXISTING** |
| PD-TST-02 | Eligibility base: Submitted + Ordered + Received + tenant/branch + local | **APPROVED EXISTING** (Testing); Verification eligibility still open |
| PD-TST-05 | Draft only in L-TST-01A | **APPROVED EXISTING** |
| PD-TST-08 | No hard-coded intervals/flags/criticals | **APPROVED EXISTING** principle |
| PD-TST-12 | Rejected specimens not eligible for Testing | **APPROVED EXISTING** |
| PD-TST-19 / PRD-BILL | No billing mutation; clinical ≠ financial SoT | **APPROVED EXISTING** |
| PRD-AUDIT pattern | Platform `audit_log` fail-closed | **APPROVED EXISTING** (actions for verify still open) |
| Upstream A–N | Collection/Specimen/Receiving/Barcode/Order boundaries | **APPROVED EXISTING** |

### 5.2 NOT YET DECIDED (PRODUCT_DECISION_REQUIRED for L-VER-01)

| ID | Requirement (summary) | Why open |
|---|---|---|
| PRD-WF-07 | Technical verification then clinical authorization per test policy | Stages exist in PRD; LMS Verification slice boundary / status names not closed |
| PRD-SM-TEST | … Result Draft → Technical Verified → Authorization Pending → Final … | Exact LMS Result status after Draft not approved |
| PRD-RES-01 | Distinguish draft, technical verification, clinical authorization, preliminary, final, amended, corrected, cancelled | MVP Verification subset not closed |
| PRD-RES-02 (validation subset) | Units / completeness / structured validation | What Verification validates vs Draft already validates is open; live intervals/flags remain config |
| PRD-RES-03 | Signatory / discipline / site / delegation | Primarily Clinical Authorization; must not collapse into Verification without decision |
| PRD persona | Bench scientist performs technical verification | Role/permission mapping not decided |
| Same-person | PRD allows same person when credentialed; still distinct events | PD-TST-11 deferred — reopen for L-VER-01 |
| Grain | Per OrderTest / result / component / report | Not decided for Verification |
| Permissions | `lms.testing.verify` vs `lms.results.verify` | Naming + ownership open |
| Reject / return | Whether verifier can return to Draft / reject | Not decided |
| UI | Verification queue vs extend Testing workbench | Not decided |

### 5.3 DEFERRED (explicitly later than first Verification slice unless PO expands)

| ID | Topic | Disposition |
|---|---|---|
| PRD-RES-03 (full matrix) | Clinical authorization / signatory | **DEFERRED** → L-AUTH-01 |
| PRD-RES-04 | Critical detection / communication | **DEFERRED** → L-CRT-01 |
| PRD-RES-05/06 | Versioned reports / patient release | **DEFERRED** → Reporting |
| Amendments after Final | New version after final | **DEFERRED** → L-AMD (later) |
| PRD-SPC-07/09 | Instrument / autoverification / delta / reflex | **DEFERRED** |
| PRD-QC | QC gates blocking release | **DEFERRED** |
| PRD-REF-* | Referral inbound results | **DEFERRED** |
| Two-person check / attachments | PD-TST-17 | **DEFERRED** |
| Autoverification | Configuration + later | **DEFERRED** / **CONFIGURATION_REQUIRED** |
| Production role grants | Ongoing LMS rule | **DEFERRED** / forbidden in decision docs |

---

## 6. Existing code reuse classification

| Candidate | Classification | Rationale |
|---|---|---|
| `LmsResult` / `LmsResultVersion` / `ResultService` patterns | **GREEN** | Safe reusable foundation for Verification extension of the same SoT |
| Testing Work Queue eligibility projection | **GREEN** / **YELLOW** | Eligibility rules are reusable base; Verification may filter `HasDraft` / Draft-only — exact filter **PRODUCT_DECISION_REQUIRED** |
| Tenant / branch authz (`ValidateUserBranchAsync`) | **GREEN** | Reuse established LMS pattern |
| RowVersion + `409 concurrency_conflict` | **GREEN** | Reuse |
| Operation-specific idempotency store pattern | **GREEN** | New operation key(s) needed — design in implementation after approval |
| Platform `audit_log` + fail-closed | **GREEN** | New action codes need PO + allowlist in later implementation task |
| LMS FE Testing Workbench / Result Draft UI patterns | **GREEN** | Visual/UX pattern reuse; Verification screens not built |
| FE stub `/dashboard/lms/results/verification` | **YELLOW** | Route placeholder exists; must become real capability only after authorization — do not invent fake queue data |
| Permission catalog pattern (`EnterpriseLmsTestingPermissionCatalog`) | **GREEN** | Pattern reuse; verify code not yet chosen |
| Catalogue `authorization_required` / opaque refs | **YELLOW** | Exists as catalogue fields/refs; **not** live Verification authority SoT; must not fake signatory rules |
| Pathology `LabReport` / `LabReportItem` / `/dashboard/laboratory` | **RED** | Must not be reused as LMS Verification SoT (AD-TST-04) |
| Pathology VerifiedByName-style fields (gap docs) | **RED** | Not LMS clinical Verification SoT |
| Billing / payment services | **RED** | Must not mutate or own Verification |
| Autoverification config refs | **YELLOW** / **RED for first slice SoT** | Opaque refs only; auto-verify **DEFERRED** |

---

## 7. Configuration dependency audit

| Dependency | Present as live governed config? | Blocks a bounded technical-verify-only first slice? | Notes |
|---|---|---|---|
| Reference intervals | Opaque catalogue refs only | **No** if Verification does not calculate abnormal flags | Must not invent intervals |
| Units masters | `PermittedUnits` free string; entered unit on Draft | **No** for basic verify of existing Draft value | Stronger units governance later |
| Qualitative coded dictionaries | Not a live master | **No** if Verification accepts Draft qualitative string already validated at entry | Do not invent codes |
| Critical thresholds | Not configured | **No** — critical workflow deferred | Must not invent thresholds |
| Abnormal thresholds | Not configured | **No** — evaluation deferred unless PO expands | Must not invent |
| Laboratory / section context | No new LMS section hierarchy; PD forbids inventing org hierarchy | **Dependency / open** for section-scoped authority | Document as dependency; do not invent L0 section tree |
| Verifier authority matrix | Absent | **Open** — may start as permission + branch only | Signatory matrix more L-AUTH-01 |
| Delegation | Absent | **Does not block** if out of first slice | **CONFIGURATION_REQUIRED** later |
| Signatory rules | Absent | **Does not block technical Verification** if kept separate from Clinical Authorization | L-AUTH-01 |
| Auto-verification rules | Opaque refs / deferred | **Does not block** manual Verification | **DEFERRED** |
| Two-person verification | Deferred (PD-TST-17) | **Open policy** (same-person) | **PRODUCT_DECISION_REQUIRED** |

**Honesty rule:** Implementation must not present intervals, criticals, abnormal flags, or authority matrices as configured when they are not.

---

## 8. Proposed L-VER-01 boundary (recommendation only — not authorized)

### 8.1 Candidate IN SCOPE

- Verification eligibility over existing Draft Results (building on L-TST-01A eligibility)  
- Verification Work Queue (or governed reuse of Testing queue with verify action) — **UX choice open**  
- Result detail showing Draft / version history (read)  
- Explicit **Verify** mutation on eligible Draft  
- Immutable verification record / status transition as approved by PO  
- Platform audit + fail-closed  
- Operation-specific idempotency + RowVersion concurrency  
- Permission catalog addition (no role grants)  
- Automated tests + PRE-UAT + Manual UAT after a future authorized implementation  

### 8.2 Candidate OUT OF SCOPE

- Clinical Authorization (L-AUTH-01)  
- Critical Results (L-CRT-01)  
- Reporting / Final release / patient portal  
- Amendments after Final  
- Instrument results / Runs / QC / Calibration  
- Auto-verification  
- Referral inbound results  
- Billing  
- Pathology migration  
- OrderTest / Specimen / CollectionTask / Receiving / Barcode lifecycle mutation  
- Hard-coded clinical thresholds / interpretation  

**These are candidates for Product Owner decision, not approvals.**

---

## 9. Requirements traceability

| Requirement | Current LMS support | L-TST-01A support | L-VER-01 gap | Decision required? | Proposed disposition |
|---|---|---|---|---|---|
| PRD-WF-07 technical verification | None beyond Draft SoT | Draft entry only | Verify action + status + authority | **Yes** | L-VER-01 candidate |
| PRD-WF-07 clinical authorization | None | None | Full authz workflow | **Yes** (separate) | **DEFERRED** L-AUTH-01 |
| PRD-RES-01 status distinction | Draft only | Draft only | Next status name/transition | **Yes** | Close in decision package |
| PRD-SM-TEST Technical Verified | Absent | Stops at Draft | State after Draft | **Yes** | Close status model |
| Bench scientist verify persona | No role mapping | Result entry perms only | Verify permission / actor | **Yes** | Catalog only; no grants |
| Same-person policy | None | Deferred PD-TST-11 | Policy for verify vs creator | **Yes** | Reopen PD-VER-06 |
| Traceability / version history | Append-only Draft versions | Yes | Verification metadata / immutability | **Yes** | Preserve append-only |
| PRD-AUDIT | Platform pattern | CREATE/UPDATE draft | VERIFY_* actions | **Yes** | Allowlist later |
| Concurrency / idempotency | Patterns exist | Draft ops | Verify ops | **Yes** (design) | Reuse pattern |
| PRD-RES-02 intervals/flags | Refs only | Persist value/unit/comment | Must not invent calc | **Config later** | Keep out unless configured |
| PRD-RES-04 critical | None | Forbidden | Separate workflow | **Yes** (boundary) | **DEFERRED** L-CRT-01 |
| PRD-RES-05/06 reporting | None | Forbidden | Report availability | **Yes** (boundary) | **DEFERRED** Reporting |
| Amendments | None | Forbidden | Post-verify correction path | **Yes** | **DEFERRED** L-AMD |
| Rejected specimen exclusion | Enforced for Testing | Yes | Must remain for Verify | Reaffirm | Carry forward |
| Pathology separation | Enforced | Yes | Must remain | Reaffirm | **APPROVED EXISTING** |
| Billing separation | Enforced | Yes | Must remain | Reaffirm | **OUT_OF_SCOPE** |

---

## 10. No-code / no-schema confirmation (this audit task)

This discovery audit produces documentation only. It does **not**:

- Modify application source  
- Create migrations or alter schema  
- Modify database rows  
- Modify permission seeds or role grants  
- Modify APIs or UI  
- Modify L-TST-01A behavior  

---

## 11. Handoff

Product Owner decisions are closed in:

**[enterprise-lms-verification-decision-closure.md](./enterprise-lms-verification-decision-closure.md)**

Pre-approval register (historical): [enterprise-lms-verification-decision-package.md](./enterprise-lms-verification-decision-package.md)

**Status:** `PRODUCT_DECISIONS_CLOSED_L_VER_01_AUTHORIZED`  
**Implementation:** **AUTHORIZED FOR SEPARATE TASK — NOT STARTED / NOT PERFORMED BY THIS AUDIT**
