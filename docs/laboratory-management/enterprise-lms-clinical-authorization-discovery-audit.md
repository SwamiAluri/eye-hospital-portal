# L-AUTH-01 — Clinical Authorization  
# Discovery / Audit

**Date:** 2026-10-12  
**Slice candidate:** L-AUTH-01 — Clinical Authorization (boundary pending Product Owner)  
**Mode:** DOCUMENTATION / DISCOVERY / AUDIT ONLY — no application code, schema, migrations, APIs, UI, permissions, seed data, role grants, or workflows modified  

**Upstream certified boundary:**

| Slice | Status |
|---|---|
| L-COL-01B … L-COL-01E | **ACCEPTED** |
| L-TST-01A | **ACCEPTED** — Draft Result SoT |
| L-VER-01 | **IMPLEMENTED / PRE-UAT exercised** — Draft → `TechnicalVerified` only |

**Authoritative context:**

| Source | Role |
|---|---|
| Enterprise LMS PRD/BRD v1.0 (via prior LMS discovery extractions) | Functional SoT |
| [enterprise-lms-verification-decision-closure.md](./enterprise-lms-verification-decision-closure.md) | Closed L-VER-01; Clinical Authorization **separate** (PD-VER-17) |
| [enterprise-lms-testing-decision-closure.md](./enterprise-lms-testing-decision-closure.md) | PD-TST-10 deferred Clinical Authorization to L-AUTH-01 |
| [enterprise-lms-testing-discovery-audit.md](./enterprise-lms-testing-discovery-audit.md) | PRD extraction (WF-07, SM-TEST, RES-01/03) |
| LaboratoryApi Result domain (inspected 2026-10-12) | Runtime evidence after L-VER-01 |

```text
L-VER-01 CERTIFIED UPSTREAM
  Draft → TechnicalVerified
  (NOT clinically authorized / Final / released / patient-visible)
  ↓
THIS AUDIT — what exists vs Clinical Authorization gap
  ↓
enterprise-lms-clinical-authorization-decision-package.md
  ↓
STOP — wait for Product Owner closure
  ← NOT AUTHORIZED FOR IMPLEMENTATION BY THESE DOCUMENTS
```

**This document does not authorize or implement Clinical Authorization.**

Where the PRD or approved closures do not define a rule, the classification is **DECISION REQUIRED**. No silent choices. No invented clinical policy.

---

## 1. Purpose

Audit the repository and Result domain to prepare a Product Owner decision gate for **L-AUTH-01 — Clinical Authorization**.

Preserve all accepted upstream behavior. Do **not** introduce a silent `TechnicalVerified → Final` transition.

---

## 2. Current Result domain (repository evidence — post L-VER-01)

### 2.1 Entities

| Artifact | Path | What exists |
|---|---|---|
| `LmsResult` | `LaboratoryApi/Domain/LmsResult.cs` | Aggregate: Order/OrderTest/Specimen/tenant/branch, catalogue snapshot, datatype, values, `CurrentVersionNumber`, `RowVersion`. **Status:** `Draft` \| `TechnicalVerified`. **L-VER metadata:** `VerifiedByUserId`, `VerifiedAtUtc`, `VerifiedVersionNumber`. **No clinical authorization fields** |
| `LmsResultVersion` | `LaboratoryApi/Domain/LmsResultVersion.cs` | Append-only value history (values + comment + created actor/time). **No verify/authorize metadata** |
| `LmsResultIdempotencyRecord` | Domain + `lms_result_idempotency` | CREATE/UPDATE draft + **verify_result** |
| `ResultStatuses` | `ResultEnums.cs` | `Draft`, `TechnicalVerified` only |
| Idempotency ops | `ResultEnums.cs` | `create_result_draft`, `update_result_draft`, `verify_result` |
| Audit actions | `ResultEnums.cs` | `CREATE_RESULT_DRAFT`, `UPDATE_RESULT_DRAFT`, `VERIFY_RESULT` |

**Uniqueness (L-TST-01A):** one Result aggregate per `(tenant_id, order_test_id, specimen_id)`.

### 2.2 Service / API / DTO

| Artifact | Evidence |
|---|---|
| `ResultService` | Work queue, work item, Draft CRUD, **`VerifyAsync`** (`Draft` → `TechnicalVerified`). Update Draft blocked when `TechnicalVerified`. **No authorize / clinical-auth method** |
| Verify behavior | Requires tenant + branch; RowVersion; optional expected current version; structural completeness; eligibility (Submitted/Ordered/Received/local); audit fail-closed; already verified → `409 already_verified` |
| TestingFunctions | `/api/lms/testing/*` including verify. **No authorize endpoint** |
| Permissions (BE) | `lms.testing.view` \| `manage` \| `result` \| **`lms.testing.verify`**. **No authorize permission constant** |

### 2.3 Status / concurrency / idempotency / audit / authz

| Concern | Current state |
|---|---|
| Result status model | `Draft` → `TechnicalVerified` only |
| Clinical Authorization states | **Absent** (`AuthorizationPending`, `ClinicallyAuthorized`, `Final`, `Released` not in code) |
| RowVersion | Optimistic concurrency; stale → `409 concurrency_conflict` |
| Idempotency | Operation-specific; hash conflict → `409 idempotency_conflict` |
| Audit | Platform `audit_log`; fail-closed; `VERIFY_RESULT` allowlisted in AuthService |
| Tenant / branch | Tenant-scoped; `ValidateUserBranchAsync` / `403 branch_unauthorized` |
| Same-person (verify vs draft author) | **Allowed** for L-VER-01 (PD-VER-06). **No rule** comparing verifier vs clinical authorizer (L-AUTH not implemented) |

### 2.4 UI

| Surface | Status |
|---|---|
| `/dashboard/lms/testing` (+ workbench) | **Implemented** — Testing Work Queue |
| Result detail / `ResultDraftEntry` | **Implemented** — Draft entry + **Technical Verification** action; read-only after TechnicalVerified; copy states TV ≠ Clinical Authorization |
| `/dashboard/lms/results/verification` | Capability marked `implemented` (presentation); TV action lives in Testing Result detail |
| `/dashboard/lms/results/authorization` | **Stub** — `not_implemented` (`lms-capability-registry.ts`) |
| `/dashboard/lms/results/critical`, `/amendments` | Stub / `not_implemented` |
| Overview KPI “Results awaiting authorization” | Nav/overview link to stub — **must not** be treated as live SoT queue |

### 2.5 Permissions catalog

| Code | AuthService seed catalog | Role grants | FE constant |
|---|---|---|---|
| `lms.testing.view` / `manage` / `result` / `verify` | **Yes** (`EnterpriseLmsTestingPermissionCatalog`) | **No production grants** from LMS decision docs | Yes |
| `lms.authorization.view` | **No** AuthService seed found | N/A | FE string only (`lms-permissions.ts`) |
| `lms.results.authorize` (or similar) | **Absent** | N/A | **Absent** |

### 2.6 Catalogue fields (not live clinical SoT)

| Field | Location | Classification |
|---|---|---|
| `AuthorizationRequired` (`authorization_required`) | `LmsCatalogueVersion` | **YELLOW** — catalogue flag exists; **not** enforced as Clinical Authorization eligibility/authority SoT today |
| Opaque clinical/config refs | Catalogue | **YELLOW** — must not invent signatory/interval/critical evaluation |

---

## 3. Critical upstream boundaries (must preserve)

From L-VER-01 closure (PD-VER-03/07/10/16/17/18/19) and implementation:

```text
Draft
  ↓
TechnicalVerified     ← certified; analytically/technically verified only
```

| Must remain true | Evidence |
|---|---|
| TechnicalVerified ≠ clinically authorized | `ResultStatuses` comment; FE copy; PD-VER-03/17 |
| No Final / Released / patient-visible from L-VER | PD-VER-17/18 |
| No OrderTest mutation | PD-VER- / AD-VER-; verify asserts Ordered |
| No CollectionTask / Specimen / Receiving / Barcode / Catalogue / Pathology mutation | L-VER boundaries |
| Draft update blocked after TechnicalVerified | `ResultService` |
| TechnicalVerified → Draft forbidden in L-VER | PD-VER-10 VERIFY-FORWARD-ONLY |

**Forbidden silent transition:** `TechnicalVerified → Final`.

---

## 4. PRD / prior-extraction requirement mapping

*(PRD text as previously extracted in Testing/Verification discovery; not re-invented here.)*

| ID | PRD meaning (summary) | Repository today | L-AUTH disposition |
|---|---|---|---|
| PRD-WF-07 | Technical verification **then** clinical authorization per **test policy** | TV implemented; clinical auth **absent** | **IN SCOPE for decision** |
| PRD-SM-TEST | … Technical Verified → **Authorization Pending** → **Final** … | Only Draft/TV statuses | Status names/transitions **DECISION REQUIRED** |
| PRD-RES-01 | Distinguish draft, technical verification, clinical authorization, preliminary, final, amended, corrected, cancelled | Draft + TechnicalVerified only | MVP Clinical Auth subset **DECISION REQUIRED** |
| PRD-RES-03 | Authorized signatory workflow by test/discipline/site/flags/delegation | No matrix; catalogue flag only | **CONFIGURATION / DECISION REQUIRED** |
| Persona | Bench scientist = technical verify; Pathologist/authorized signatory = clinical authorization | No LMS clinical-authority SoT | Role/mapping **DECISION REQUIRED** — Admin/Doctor ≠ authorizer |
| Same-person | Allowed when properly credentialed; events remain distinct | L-VER allows draft author to verify; verify↔authorize **unruled** | **DECISION REQUIRED** for L-AUTH |
| Reports | Versioned report after authorization/release path | No LMS report SoT | Reporting **OUT** of L-AUTH unless PO expands |
| Critical | Separate communication/ack workflow | Absent | **L-CRT-01 BOUNDARY** |
| Amendments | New version after Final; re-auth rules | Absent | **Amendment BOUNDARY** |

---

## 5. Clinical Authorization domain questions

| Question | Finding |
|---|---|
| Who may clinically authorize? | PRD: pathologist / authorized signatory. Repo: **no** governed clinical-authority matrix. **DECISION REQUIRED** |
| Grain (Result / Version / OrderTest / panel / report)? | Result aggregate is LMS SoT; PRD also speaks report after auth. **DECISION REQUIRED** (recommend Result + current version — see decision package) |
| Authority/eligibility model? | **MISSING** as live SoT. Permission ≠ clinical authority unless PO approves. **CONFIGURATION / DECISION REQUIRED** |
| Branch/site tied? | LMS pattern: tenant + operating branch (L-VER). Section/discipline deferred. **DECISION REQUIRED** for L-AUTH first slice |
| Section/discipline/specialty tied? | **Absent** hierarchy (forbidden to invent — L-VER AD). **CONFIGURATION / DECISION REQUIRED** |
| Clinician/lab professional required? | PRD personas; no platform clinical-credential SoT found for LMS. **DECISION REQUIRED** |
| Can technical verifier also clinically authorize? | PRD allows when credentialed. L-VER same-person rule does **not** decide this. **DECISION REQUIRED** (A/B/C/D) |
| Two-person review required? | Not established as universal LMS rule. **DECISION REQUIRED** |
| Universal vs configurable? | PRD “per test policy” + catalogue `authorization_required`. Policy engine **MISSING**. **DECISION REQUIRED** |
| Operates on exact TechnicalVerified version? | L-VER binds `VerifiedVersionNumber` = current at verify. Post-TV Draft edit blocked → version stable until amendment slice. Authorization version binding **DECISION REQUIRED** (recommend bind current = verified version) |
| Result changes after TV? | Draft update **blocked**. Amendment slice future. **DECISION REQUIRED** for post-auth correction |
| Is TechnicalVerified immutable once auth starts? | No auth start state today. Intermediate pending state **DECISION REQUIRED** |
| Return for correction / reject / cancel / revoke? | Not implemented. Amendment vs revoke **DECISION REQUIRED** |
| Authorization vs report release? | PRD separates authorization and reporting/release/Final. L-VER forbids collapsing. **Must keep separate** |
| Patient-visible at authorization? | **Not established** that Clinical Auth alone publishes. **DECISION REQUIRED** (recommend NO) |
| Creates/releases report? | **Recommend NO** for L-AUTH-01; Reporting separate |
| Critical relationship? | **L-CRT-01 BOUNDARY** — prerequisite vs parallel **DECISION REQUIRED** |
| Amendment relationship? | Future slice; re-verify/re-authorize **DECISION REQUIRED** |

---

## 6. Current vs candidate lifecycle

### 6.1 Current (certified)

```text
Draft
  ↓ (L-VER-01 Technical Verification)
TechnicalVerified
```

### 6.2 PRD-aligned candidate sequence (options — not chosen)

```text
Draft
  ↓
TechnicalVerified
  ↓
AuthorizationPending (?)     ← DECISION REQUIRED whether explicit pending state needed
  ↓
ClinicallyAuthorized (?)     ← DECISION REQUIRED name/meaning
  ↓
Final / Released             ← Reporting/release — OUT of L-AUTH unless PO expands
```

**Do not assume** Clinical Authorization = Final = Released = Patient-visible.

---

## 7. Version binding findings

| Topic | Evidence | Gap |
|---|---|---|
| TV binds version | `VerifiedVersionNumber` on `LmsResult` | — |
| Historical versions | Append-only `LmsResultVersion`; not rewritten on verify | — |
| Auth metadata placement | None | **DECISION REQUIRED** — recommend aggregate fields mirroring TV pattern |
| Auth invalid if newer version | Draft edit blocked after TV → no newer draft without amendment | Post-amendment re-auth **DECISION REQUIRED** |

---

## 8. Clinical authority / eligibility findings

| Candidate source | Present? | Reuse for L-AUTH SoT |
|---|---|---|
| Platform permission catalog | Pattern yes; authorize code **absent** | **YELLOW** — permission alone ≠ clinical authority |
| Hospital Portal roles (Admin/Doctor) | Exist platform-wide | **RED** as clinical authorizer policy (PD-TST-10 / PD-VER-05 principle) |
| LMS section/discipline/specialty matrix | **Absent** | Cannot invent; **CONFIGURATION / DECISION REQUIRED** |
| Catalogue `authorization_required` | Field exists | **YELLOW** — may gate “auth required vs not” only after PO defines meaning |
| Provider/credential registry for LMS | **Not found** as LMS SoT | **CONFIGURATION / DECISION REQUIRED** |
| Pathology LabReport / VerifiedByName | Pathology domain | **RED** — not LMS Clinical Auth SoT |

---

## 9. Same-person findings

| Pair | Current rule |
|---|---|
| Draft author ↔ Technical Verifier | **Allowed** (PD-VER-06 APPROVED for L-VER) |
| Technical Verifier ↔ Clinical Authorizer | **No runtime rule**; PRD allows when credentialed; **DECISION REQUIRED** for L-AUTH (A Allowed / B Prohibited / C Config / D By test-section) |
| Two-person mandatory | **Not established** |

---

## 10. Validation findings (structural vs clinical)

| Class | L-VER today | L-AUTH candidate (decision) |
|---|---|---|
| Structural completeness | Required for verify | Likely reaffirm or rely on TV already done |
| Clinical interpretation / ranges / criticals | **Forbidden** invent | **Must not invent** (PD-TST-08 / PD-VER-08/09) |
| Authority eligibility | Permission + branch | **DECISION REQUIRED** depth |
| Version correctness | Current version | Bind authorized version **DECISION REQUIRED** |

---

## 11. Critical / Reporting / Amendment boundaries

| Slice | Relationship to L-AUTH-01 |
|---|---|
| L-CRT-01 | Separate. Whether auth blocked until critical complete = **DECISION REQUIRED / L-CRT-01 BOUNDARY**. Do not implement critical notify in L-AUTH |
| Reporting / Final release | Separate. Auth must not silently publish reports or patient portal results |
| Amendments | Separate. Post-auth correction path **DECISION REQUIRED** without implementing amendment tables now |

---

## 12. Audit findings

| Item | Finding |
|---|---|
| Audit SoT | Platform `audit_log` (APPROVED EXISTING) |
| Existing LMS result actions | CREATE/UPDATE draft, VERIFY_RESULT |
| Clinical Auth action | **Absent** — candidate e.g. `AUTHORIZE_RESULT` (**DECISION REQUIRED**) |
| Fail-closed | Established LMS pattern — recommend reuse |
| Second audit system | **Forbidden** |

---

## 13. Concurrency / idempotency findings

| Pattern | Reuse |
|---|---|
| RowVersion + 409 | **GREEN** |
| Already-authorized safe failure | Mirror `already_verified` | **GREEN** pattern |
| Idempotency store `lms_result_idempotency` | **GREEN** — new operation name e.g. `authorize_result` (**DECISION REQUIRED**) |
| Hash conflict 409 | **GREEN** |

---

## 14. Work Queue / UI findings

| Option | Evidence |
|---|---|
| Extend Testing Work Queue / Result detail | Preferred L-VER pattern (PD-VER-20); TV action already on Result detail |
| Dedicated `/dashboard/lms/results/authorization` | Stub exists; may be presentation surface **if** same Result SoT — **DECISION REQUIRED** |
| Fake KPIs / awaiting-authorization counts | Overview link exists — **must not** fabricate live metrics |

Counsellor-quality staff UX benchmark applies when UI is later authorized.

---

## 15. Configuration dependency audit

| Dependency | Classification |
|---|---|
| Authorized personnel / signatory list | **MISSING** / **CONFIGURATION / DECISION REQUIRED** |
| Discipline / section / specialty matrix | **MISSING** / **CONFIGURATION / DECISION REQUIRED** |
| Site/branch authority | Branch auth **AVAILABLE** (platform); section **MISSING** |
| Authorization matrix by test | **MISSING**; catalogue `authorization_required` **AMBIGUOUS** |
| Panel-level authorization | **NOT REQUIRED** unless PO expands (Result grain first) |
| Authority level hierarchy | **MISSING** — do not invent |
| Credential/delegation registry | **MISSING** / **CONFIGURATION / DECISION REQUIRED** |
| Critical-result completion gate | **MISSING** / **L-CRT-01 BOUNDARY** |
| Report templates | **NOT REQUIRED** for Clinical Auth if reporting deferred |

---

## 16. GREEN / YELLOW / RED reuse matrix

| Candidate | Class | Rationale |
|---|---|---|
| `LmsResult` / `LmsResultVersion` / `ResultService` patterns | **GREEN** | Same Result SoT; extend with auth transition if approved |
| Tenant + branch `ValidateUserBranchAsync` | **GREEN** | Established LMS authz |
| RowVersion / idempotency / audit fail-closed | **GREEN** | Established patterns; new op/action codes needed |
| Testing Workbench + Result detail UX | **GREEN** | Preferred operational surface |
| Permission catalog pattern | **GREEN** | Pattern only; new code needs PO |
| `lms.testing.verify` | **YELLOW** | Must **not** double as clinical authorize authority |
| Catalogue `authorization_required` | **YELLOW** | Flag only; meaning/enforcement open |
| FE stub authorization route / overview KPI | **YELLOW** | Placeholder; no fake queue |
| FE `lms.authorization.view` string | **YELLOW** | Not seeded; naming may conflict with future catalog |
| Admin / Doctor / role-name inference | **RED** | Forbidden as clinical authorizer policy |
| Pathology LabReport / laboratory dashboard | **RED** | Not LMS Clinical Auth SoT |
| Billing / payment | **RED** | Must not own/mutate Clinical Auth |
| Silent Final/Release/patient publish | **RED** | Violates PD-VER-17/18 principles |
| Invented signatory/section hierarchy | **RED** | Forbidden without PO + config ownership |

---

## 17. Absolute non-implementation confirmation

This audit did **not**: create migrations/tables; alter Result state; add APIs/UI; seed permissions/role grants; modify L-VER/L-TST; modify Orders/Specimens/Receiving/Barcode/Pathology; implement Critical/Reporting/Release/Amendments/Billing.

---

## 18. Recommended next gate

Produce and close Product Owner decisions in:

[enterprise-lms-clinical-authorization-decision-package.md](./enterprise-lms-clinical-authorization-decision-package.md)

**Final status:**

# DISCOVERY_COMPLETE_READY_FOR_PRODUCT_OWNER_DECISION

*(Configuration gaps are real and listed; they are presented as Product Decisions — including whether first-slice L-AUTH may proceed with permission+branch like L-VER, or is blocked pending signatory configuration. That choice is for the Product Owner, not assumed here.)*
