# L-PORTAL-01 — Patient Portal Identity Linkage  
# Prerequisite Implementation Specification (Conditional)  
# (DIRECTION APPROVED — FORMAL CLOSURE PENDING DETAILS)

**Date:** 2026-10-14 (reconciled with Product Decision Closure)  
**Mode:** CONDITIONAL SPECIFICATION — documentation only; **not** implementation authorization  

**Depends on:**  
- [Identity Product Decision Closure](./enterprise-lms-patient-portal-identity-product-decision-closure.md) (`PRODUCT_DECISIONS_CLOSED_L_PORTAL_01`)  
- [Identity readiness audit](./enterprise-lms-patient-portal-identity-readiness-audit.md)  
- [Identity decision package](./enterprise-lms-patient-portal-identity-decision-package.md)  
- [Product Owner decision review](./enterprise-lms-patient-portal-identity-product-decision-review.md)  
- [Product Owner decision form](./enterprise-lms-patient-portal-identity-product-owner-decision-form.md)  
- L-REP-04 PD-PP-11 baseline (closed; access rules carried forward)

```text
SPECIFICATION_STATUS = CONDITIONAL
PRODUCT_DECISIONS_CLOSED_L_PORTAL_01 = PRESERVED
L_PORTAL_01_IMPLEMENTATION_AUTHORIZATION = GRANTED
CONFIGURABLE_POLICY_MODEL_RECORDED
AUDIT_EVENT_CONTRACT = RATIFIED_APPROVE_WITH_EDITS
PORTAL_AUTH_LOGIN_SUCCESS_FAILURE_AUDIT = BEST_EFFORT
RUNTIME_IMPLEMENTATION = NOT_STARTED
L_REP_04_PATIENT_PATH_REMAINS_BLOCKED
BLOCKER-PP-IDENTITY-01 = OPEN
```

**Implementation authorization granted**; audit contract **ratified**. Runtime **NOT_STARTED** until bounded plan/security review ([implementation readiness](./enterprise-lms-patient-portal-identity-implementation-readiness.md)). Separates **confirmed repository capability** from **planned** capability.

---

## 1. Goals

1. Establish an **authoritative authenticated Patient Portal principal**.  
2. Establish a **verified** association: one active verified Portal principal per Patient and one active Patient per Portal principal (PD-ID-06 `APPROVED_DIRECTION`; lifecycle `PENDING_DETAIL`).  
3. Provide a **server-side resolution** of `PatientId` that does **not** trust caller-supplied patient identifiers as proof.  
4. Fail closed on missing, ambiguous, invalid, stale, unverified, or conflicting linkage (PD-ID-07 `APPROVED_DIRECTION`).  
5. Prevent staff credentials from acting as a patient identity (PD-ID-08 `APPROVED_DIRECTION`).  
6. Unblock **future** L-REP-04 patient content authorization design — without implementing L-REP-04 publication.

---

## 2. Explicit exclusions

- L-REP-04 Publish / Withdraw / patient Official PDF list/open  
- NotificationHub / email-SMS delivery as identity SoT  
- New proxy/guardian authorization system  
- Pathology / `/dashboard/laboratory` / CUT C/D changes  
- Inferring patient from email, name, phone, MRN, or branch membership  
- Silent permission/role grants  
- Full Portal module rewrite (appointments, payments, etc.) unless PD-ID-09 expands scope  
- Self-registration / self-serve linking UX (PD-ID-10 `APPROVED_DIRECTION` forbids)  
- Treating `PROPOSED_RECOMMENDATION` detail rows as implementation-ready contracts  

---

## 3. Confirmed repository capability vs planned capability

### 3.1 Confirmed in repository (reuse candidates — not portal-identity complete)

| Component | Path | Confirmed capability |
| --- | --- | --- |
| MPI Patient aggregate | `AuthService/Models/Domain/Patient.cs` | Authoritative patient record SoT (includes `DeceasedDate`) |
| Identity user | `AuthService/Models/Identity/AppUser.cs` | Staff-oriented principal store; `UserType` field exists; **no** `PatientId` / portal link |
| Staff JWT issuance | `JwtService.cs`, `AuthController.Login` | Staff token pattern; **no** `patientId` claim |
| Staff activation delivery | `UsersController` `send-activation` (`user.manage`) + NotificationService | Secure OTP/email/SMS for **staff AppUser** activation — **not** patient-portal invite E2E |
| General audit infra | `AuditService` (`LogAsync`, `StageAsync`), hash chain; default write retention 2555 days | Reusable infra pattern; **not** portal event catalogue |
| LMS fail-closed audit pattern | `InternalAuditController` 500 on write failure; Laboratory `PlatformAuditClient` | Pattern reference for future portal fail-closed design |
| Portal FE shell | `app/patient/login`, `layout` | UI shell only (mock login; hardcoded `PAT-001`) |

### 3.2 Planned / not present (blocked pending decisions + future auth)

| Capability | Status |
| --- | --- |
| AuthService `/portal/*` authentication APIs | **Absent** |
| Portal invite E2E + inviter permission | **Absent** — PD-ID-03-D1…D4 |
| Patient↔principal verification workflow | **Absent** — PD-ID-04-D1…D2 |
| Link store (`portal_patient_links` or equivalent) | **Absent** — model choice deferred to impl after closure |
| Portal remediation permission + APIs | **Absent** — PD-ID-07-D1…D3 |
| Distinct patient-principal token issuance | **Absent** — PD-ID-08 (+ dual-account D1) |
| Portal identity audit action names / allowlist | **Absent** — PD-ID-11-D1…D3 |
| Real Portal login replacing mock | **Planned** after formal closure + impl auth |

### 3.3 Stubs — not authority

| Surface | Path | Note |
| --- | --- | --- |
| Client type hints | `patient-portal.api.ts` | Not a contract |
| Staff portal stubs | `PortalAccessTab`, `patients-enhanced` portal methods | Orphaned / Phase 5; not backend |

---

## 4. Proposed authentication and identity-linkage architecture (conditional)

```text
[Portal Login UX]
    → AuthService Portal authentication (PD-ID-05/08)
    → Issue patient-principal token/session (distinct from staff use)
    → Load verified User↔Patient linkage (PD-ID-04/06/07)
    → Server resolves PatientId
[Patient APIs / future L-REP-04]
    → Authorize using server-resolved PatientId only
    → Reject if linkage missing/ambiguous/unverified
    → Ignore or refuse override via client patientId
```

**Trust boundaries**

| Boundary | Rule | Binding basis |
| --- | --- | --- |
| Browser | Never authoritative for PatientId | PD-PP-11 + PD-ID directions |
| Staff JWT | Must not authorize patient-principal endpoints | PD-ID-08 `APPROVED_DIRECTION` |
| Branch claim / BranchId | Insufficient for patient record access | PD-PP-11 |
| Linkage table/API | SoT for association; unverified links deny | PD-ID-04/06/07 |
| LaboratoryApi (future) | Consumes resolved PatientId from Auth/Portal gate — does not invent linkage | PD-ID-05 |
| Dual staff+patient human | Independently authenticated contexts **if** PD-ID-08-D1 approved | `PROPOSED_RECOMMENDATION` / `PENDING_DETAIL` |

**Failure behavior (binding intent from PD-PP-11 + approved directions)**

| Condition | Behavior |
| --- | --- |
| Unauthenticated | 401 |
| Staff token on patient endpoint | 403 |
| No linkage / unverified | 403 fail closed |
| Ambiguous / conflicting / stale linkage | 403 fail closed |
| Client supplies different `patientId` | Deny / ignore; server-resolved id wins |
| Expired / invalid token | 401 |
| Lifecycle edge case without valid active link | Deny until remediated (PD-ID-06 proposal) |

---

## 5. Data model options (proposals only — not authorized)

| Option | Sketch | Notes |
| --- | --- | --- |
| **M1** | AuthService table `portal_patient_links` (UserId, PatientId, TenantId, VerificationStatus, VerifiedAt, …) | Clear separation from clinical Status |
| **M2** | Columns on `AppUser` (`LinkedPatientId`, verification flags) | Simpler; cardinality harder if multi-link ever needed |

**Do not add tables/columns in this documentation task.** Final choice depends on PD-ID-06 and PD-ID-05 after formal closure.

---

## 6. Account-linking and verification (approved vs open)

| Topic | Product policy status | Still open (blocks closure) |
| --- | --- | --- |
| Account creation (PD-ID-03) | Staff-initiated; dedicated invite permission; configurable delivery; expiry **min 1h / max 72h / default 24h** (hospital configures within bounds); staff re-invite invalidates prior | Exact permission code = technical pending |
| Verification (PD-ID-04) | Catalogue: staff checklist; in-person evidence; OTP+staff confirmation; demographic-only forbidden; pending expire; verified until revoke | Checklist/document/OTP assurance field contents = engineering residual (not invented) |
| Cardinality / lifecycle (PD-ID-06) | 1:1 active; same-principal recovery; deny deceased; no silent merge; audited reassignment only | None |
| Conflicts (PD-ID-07) | Fail closed; dedicated remediation permission; dual control wrong-patient; deny+revoke+re-verify+audit | Exact permission **code** = technical pending |
| Principals (PD-ID-08) | Distinct contexts; dual accounts allowed; staff token ≠ patient | None |
| Self-reg UX (PD-ID-10) | No automatic self-reg/self-link | — |
| Audit (PD-ID-11) | Catalogue **ratified** (`APPROVE_WITH_EDITS`); login BEST_EFFORT; mutations/resolve denials fail closed; retention **2,555 days** | Runtime emitters not implemented |
| Configurability | Hospital/tenant policy + per-invite selection within bounds; server-enforced; fail closed on missing/invalid policy; **no** new policy engine in this doc slice | Policy store/UI at authorized impl |

---

## 7. Authorization rules (intended; not implemented)

1. Patient-principal authentication required for Portal patient APIs.  
2. Server resolves linked `PatientId`; APIs scope data to that id only.  
3. Cross-patient access denied.  
4. Branch membership alone denied.  
5. Unverified proxy/guardian denied (no mechanism exists).  
6. Staff LMS permissions remain unchanged and separate.  
7. Staff token never establishes patient identity.  

---

## 8. Privacy and audit requirements

- No PHI in client logs, URLs, or demo consoles beyond existing platform rules  
- Audit identity events per ratified contract ([implementation readiness §5](./enterprise-lms-patient-portal-identity-implementation-readiness.md)): login BEST_EFFORT; mutations/resolve denials fail closed  
- Confirmed: general AuthService audit infra exists; runtime portal emitters **not** implemented; do not expand LMS InternalAudit allowlist for AuthService-owned portal writes  
- PO-approved Portal identity audit retention: **2,555 days** (PD-ID-11-D2) — explicit business decision, not silent infra inheritance  
- Future L-REP-04 patient-open audit remains distinct (PD-PP-09)  

---

## 9. Automated test matrix (required when implementation authorized)

Identify locations from repository patterns:

| Layer | Likely location |
| --- | --- |
| AuthService | `microservices/auth-service/AuthService.Tests/` (new identity/link tests) |
| Portal FE | `apps/hospital-portal-web` — new tests beside patient login / api clients |
| Regression | Existing LMS Official PDF / permission tests must remain green |

| ID | Scenario |
| --- | --- |
| T-ID-01 | Unauthenticated Portal requests rejected |
| T-ID-02 | Authenticated staff credentials cannot be used as patient identity |
| T-ID-03 | Missing patient linkage denied |
| T-ID-04 | Ambiguous or conflicting linkage denied |
| T-ID-05 | Supplied `patientId` cannot override server-resolved identity |
| T-ID-06 | Patient A cannot access Patient B records |
| T-ID-07 | Branch membership alone cannot establish patient access |
| T-ID-08 | Unverified proxy/guardian access denied |
| T-ID-09 | Token/session expiration and invalid credentials rejected |
| T-ID-10 | Existing staff LMS authorization unchanged |
| T-ID-11 | Legacy Pathology and existing Portal mock modules unchanged unless explicitly in authorized scope |

**This specification task did not execute tests** (documentation / decision governance only).

---

## 10. Manual UAT scenarios (user-executed after future implementation)

| ID | Setup | Steps | Expected |
| --- | --- | --- | --- |
| UAT-ID-01 | Verified linked patient account | Portal login | Authenticated session; server knows PatientId |
| UAT-ID-02 | Account with no linkage | Login / call resolve | Denied for patient data |
| UAT-ID-03 | Staff user credentials | Attempt patient Portal APIs | Denied |
| UAT-ID-04 | Linked patient A | Request B’s id in URL/body | Denied; no B data |
| UAT-ID-05 | Ambiguous dual links (fixture) | Resolve | Denied fail closed |
| UAT-ID-06 | Expired/invalid token | Call API | 401 |
| UAT-ID-07 | Branch-only staff | No patient link | No patient Portal access |
| UAT-ID-08 | Smoke staff LMS Download/Preview | Unchanged | CUT C/D preserved |
| UAT-ID-09 | Pathology `/dashboard/laboratory` | Smoke | Unchanged |
| UAT-ID-10 | Portal modules out of slice scope | Smoke | Unchanged unless PD-ID-09 included them |

---

## 11. Migration, deployment, rollback (guidance only)

| Topic | Guidance |
| --- | --- |
| Schema | Additive linkage store when authorized; default deny until verified |
| Deploy order | AuthService identity before any Portal FE real login cutover |
| Rollback | Revert FE to mock login **or** feature-flag real auth off; deny patient APIs |
| L-REP-04 | Remains disabled until identity accepted |

---

## 12. Explicit dependencies on product decisions

| Dependency | Status | Blocks |
| --- | --- | --- |
| PD-ID-01/02 Packaging + ID | `APPROVED_DIRECTION` | Slice authorization |
| PD-ID-03/04/10 Creation + verification + UX | Product decisions closed (expiry + catalogue approved) | Link creation path (needs impl auth) |
| PD-ID-05 Ownership | `APPROVED_DIRECTION` | Service placement |
| PD-ID-06/07 Cardinality + conflicts | Detail `PRODUCT_OWNER_APPROVED` (permission codes technical pending) | Persistence + deny/remediation rules |
| PD-ID-08 Staff/patient separation | Dual-account `PRODUCT_OWNER_APPROVED` | Token/authz design |
| PD-ID-09 First-slice boundary | `APPROVED_DIRECTION` | FE scope |
| PD-ID-11 Audit | Fail-closed + retention 2,555 days; event contract **ratified** (login BEST_EFFORT) | Runtime audit wiring at authorized impl |
| PD-ID-12 L-REP-04 hard gate | `APPROVED_DIRECTION` | Sequencing |

---

## 13. Status stamps

```text
L_PORTAL_01_PREREQUISITE_SPECIFICATION_RECONCILED
SPECIFICATION_STATUS = CONDITIONAL
PRODUCT_DECISIONS_CLOSED_L_PORTAL_01 = PRESERVED
L_PORTAL_01_IMPLEMENTATION_AUTHORIZATION = GRANTED
AUDIT_EVENT_CONTRACT = RATIFIED_APPROVE_WITH_EDITS
PORTAL_AUTH_LOGIN_SUCCESS_FAILURE_AUDIT = BEST_EFFORT
BLOCKER-PP-IDENTITY-01 = OPEN
RUNTIME_IMPLEMENTATION = NOT_STARTED
L_REP_04_IMPLEMENTATION = NOT_AUTHORIZED
BOUNDED_IMPLEMENTATION_PLAN = RECORDED_AWAITING_EXPLICIT_APPROVAL
NEXT_GATE = EXPLICIT_APPROVAL_OF_BOUNDED_IMPLEMENTATION_PLAN
```

---

## 14. Mandatory stop

**STOP.** Do not implement authentication, patient identity linkage, or L-REP-04 until the [bounded plan](./enterprise-lms-patient-portal-identity-bounded-implementation-plan.md) is explicitly approved.
