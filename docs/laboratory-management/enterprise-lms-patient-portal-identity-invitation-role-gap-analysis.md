# L-PORTAL-01 — Patient Portal Invitation, Account Provisioning and Role Authorization Gap Analysis

**Date:** 2026-10-14  
**Mode:** AUDIT / RECOMMENDATION ONLY — no Gate B grants, HTTP, S3, S4, or L-REP-04  
**Status stamp:**

```text
PORTAL_INVITATION_ROLE_GAP_ANALYSIS = COMPLETE
GATE_A = ACCEPTED (catalogue-only portal.invite.create)
GATE_B = BLOCKED_PRODUCT_DECISION_REQUIRED (no grants authorized or implemented)
PORTAL_INVITE_HTTP = NOT_AUTHORIZED
S3_PORTAL_AUTH = NOT_AUTHORIZED
S4_VERIFY_REMEDIATE = NOT_AUTHORIZED
L_REP_04 = NOT_AUTHORIZED
BLOCKER-PP-IDENTITY-01 = OPEN
PD-PP-01…12 / PD-ID-* = PRESERVED
PROPOSED_GRANT_MATRIX = PROPOSAL_NOT_SETTLED_DECISION
```

**Authoritative inputs re-checked against repository (2026-10-14):**  
Gate A catalogue/seeder; `PermissionService` / `PermissionAuthorizationHandler`; role-grant catalogues; `IPortalInvitationService`; product decision closure / form / bounded plan / readiness; FE stubs (`PortalAccessTab`, patient hub, counsellor RBAC).

---

## 1. Executive recommendation

1. Treat **staff-user administration** (`user.manage` / activation), **MPI patient.create**, **Portal invitation** (`portal.invite.create`), **link verification**, and **remediation** as **five separate capabilities**. Do not copy the `patient.create` six-role cohort into the invite grant set.
2. **Gate B remains blocked** until Product Owner approves an **exact** inviter `NormalizedName` matrix. Engineering can propose; it cannot settle ownership from code alone because no live Portal-invite workflow owner exists.
3. **Proposal (not settled):** first Gate B seeder grant **`RECEPTIONIST` only**; optionally add **`MEDICAL RECORDS OFFICER`** if PO confirms MPI/records ownership of staff-delivered invite handoff. **Do not** auto-include Counsellor, Nurse, IP Coordinator, LMS, or Front Desk without explicit PO yes.
4. **ADMIN / SUPERADMIN / SUPER ADMIN:** retain existing wildcard `*` behavior; **add no explicit** `RolePermission` for `portal.invite.create`. Future `[RequirePermission("portal.invite.create")]` on the **staff** JWT scheme will already succeed for those roles via JWT `permission=*` or DB fallback.
5. **FRONT DESK** (`NormalizedName` = `FRONT DESK`) is a **distinct role identity** used in tests/catalog exclusions; it is **not** an alias of `RECEPTIONIST` and is **not** in `PatientCreateRoleGrantCatalog`. Department code `FRONT_DESK` is a department, not a role. Do not equate them.
6. Operational Portal invite still needs (separately authorized): Gate B grants → staff invite HTTP → accept HTTP → S3 Portal JWT/login + FE cutover → S4 verify (go-live gated) → only then L-REP-04 eligibility. Staff-delivered token path is the approved first delivery channel; email/SMS wiring remains later.

---

## 2. Verified current-state findings (re-audit)

| # | Prior claim | Re-verify result | Evidence |
| --- | --- | --- | --- |
| 1 | `PortalInvitePermissionCatalog` defines `portal.invite.create` | **Confirmed** | `SeedData/PortalInvitePermissionCatalog.cs` |
| 2 | `SeedPortalInvitePermissionsAsync` seeds definition only | **Confirmed** — adds `Permission` rows; **zero** `RolePermission` writes | `PermissionSeeder.cs` ~1485–1523 |
| 3 | Permissions resolve role → RolePermission → Code | **Confirmed** | `PermissionService.GetUserPermissionsAsync` |
| 4 | ADMIN / SUPERADMIN / SUPER ADMIN → `*` | **Confirmed** | `IsUnrestrictedAdministrativeRole`; tests in `AdminAuthorizationNormalizationTests` |
| 5 | User-specific grants not on effective path | **Confirmed** | No user→permission join in `GetUserPermissionsAsync` |
| 6 | `RolesController` assign replaces full set | **Confirmed** | `POST {id}/permissions` removes all then re-adds |
| 7 | `PatientCreateRoleGrantCatalog` + seeder = idempotent pattern | **Confirmed** | `SeedPatientCreateRoleGrantsAsync` |
| 8 | Admin permissions UI is role-based | **Confirmed** | `/dashboard/admin/permissions`, `PermissionAssignmentModal` |
| 9 | `PortalAccessTab` is Phase 5 stub | **Confirmed** | Badge “Phase 5 Feature - PatientPortalController”; no API |
| 10 | PD-ID-03-D1 dedicated permission; forbid `user.manage` reuse | **Preserved** | Decision form § PD-ID-03-D1 |
| 11 | PD-ID-09-D1 Portal Access surface default OUT | **Preserved** | Decision form / closure |

**Additional verified facts**

- Handler honors JWT `permission` claims first (`*` or exact code), then DB `HasPermissionAsync` (`PermissionAuthorizationHandler`).
- Staff login loads permissions via `GetUserPermissionsAsync` into JWT (`JwtService` emits one claim per permission string, including `*`).
- Portal invitation **domain** service exists (`PortalInvitationService`); **no** public invite/accept controllers.
- S1 resolve fail-closed + mandatory `portal.resolve.denied` remain; accept creates **unverified** link only.
- `portal.link.remediate` / `portal.link.remediate_approve` remain **proposals** (not Gate A seeded).

---

## 3. Exact role inventory and `NormalizedName` evidence

Roles are tenant-scoped `AppRole` rows. Matching for grants uses **`NormalizedName`** (uppercase), not `RoleCode`, in patient-create and similar seeders. Roles are **not** fully enumerated in a single static seed list; live DB roles vary by tenant. Catalogue/test evidence establishes these identifiers:

| Exact `NormalizedName` | Typical display `Name` (evidence) | How evidenced | Distinct from |
| --- | --- | --- | --- |
| `ADMIN` | Admin | `Program.cs` / `DevTenantBootstrap` / `SeedController` create | — |
| `SUPERADMIN` | SuperAdmin | `IsUnrestrictedAdministrativeRole`; Admin auth tests | `SUPER ADMIN` (space variant also recognized) |
| `SUPER ADMIN` | Super Admin | Wildcard matcher accepts this string | Not proven as separately seeded everywhere |
| `COUNSELLOR` | Counsellor | Counseling seeders; counsellor FE RBAC tests | Alias `COUNSELOR` also matched in counselling seeders |
| `COUNSELOR` | Counselor | Matched alongside COUNSELLOR in `PermissionSeeder` counselling links | Spelling variant, not FRONT DESK |
| `RECEPTIONIST` | Receptionist | `PatientCreateRoleGrantCatalog`; session-doc tests | **Not** FRONT DESK |
| `FRONT DESK` | Front Desk | Appears as **rejected/excluded** role in Lab L0 / Patient360 / Oct / vitals tests; counsellor session-doc negative fixture | Space-separated role name; **≠** `RECEPTIONIST` |
| `FRONTDESK` | (variant) | Excluded-name lists in some permission tests | Collapsed spelling; **do not assume** live role exists |
| `MEDICAL RECORDS OFFICER` | Medical Records Officer | `PatientCreateRoleGrantCatalog`; Patient360 diagnosis approved list | — |
| `NURSE` | Nurse | `PatientCreateRoleGrantCatalog` | — |
| `IP COORDINATOR` | IP Coordinator | `PatientCreateRoleGrantCatalog` | — |
| `DOCTOR`, `LAB TECHNICIAN`, `LAB MANAGER`, … | various | Other catalogues / exclusions | Out of invite default |

**Department vs role:** `SeedController` SQL seeds department `FRONT_DESK` / “Front Desk”. That is a **department** row, **not** proof of role `NormalizedName` `FRONT DESK` or alias to Receptionist.

**Live DB caveat:** This audit did **not** query shared/prod Postgres for role rows. Grant seeders only link roles that **already exist** with matching `NormalizedName`.

---

## 4. Role-by-capability matrix

Legend: **Yes** = implemented + enforced; **Partial** = related capability only; **No** = absent; **\*** = covered by admin wildcard if endpoint uses `RequirePermission`; **Proposal** = recommended for PO, not granted.

| Exact `NormalizedName` | Display (typical) | Existing responsibilities (evidence) | Patient registration (`patient.create`) | Staff-user admin (`user.*` / `user.manage`) | Portal invitation (`portal.invite.create`) | Portal identity verification | Portal link remediation | Admin `*` | Proposed invitation decision | Rationale | PO approval required |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `RECEPTIONIST` | Receptionist | Patient hub / front-desk check-in adjacency; in `patient.create` grant set | **Yes** (if role exists + grant seeded) | **No** (not evidenced) | Catalogue exists; **no grant**; **no HTTP/UI** | **No** (S4) | **No** (S4) | No | **Recommend (proposal)** | Closest named role to registration/onboarding handoff among grant catalogues; staff-delivered token ops fit reception desk | Confirm sole first recipient? |
| `MEDICAL RECORDS OFFICER` | Medical Records Officer | MPI/records adjacency; `patient.create` + some Patient360 read grants | **Yes** (if granted) | **No** | Same gap as above | **No** | **No** | No | **Optional recommend** | Plausible identity/records owner; not proven as invite owner | Include in Gate B? Y/N |
| `FRONT DESK` | Front Desk | Named in negative/exclusion tests; FE routes under `/dashboard/frontdesk/*` are **workflow areas**, not role grants | **No** (not in `PatientCreateRoleGrantCatalog`) | **No** | **No** | **No** | **No** | No | **Unresolved / exclude by default** | Distinct from Receptionist; no invite ownership evidence; may not exist in every tenant | If live role exists, decide grant vs use Receptionist only |
| `COUNSELLOR` / `COUNSELOR` | Counsellor | Counselling desk, sessions, `patient.view`/`patient.create` for counsellor workflow | **Yes** (workflow seeder) | **No** | **No** grant; counsellor UI is counselling, not portal invite | **No** | **No** | No | **Unresolved — investigate, do not auto-exclude or auto-grant** | Counsellors create/select patients in counselling flows; PO may want invite from that context later; PD-ID-09 keeps Portal Access tab OUT; least privilege argues against bundling with counselling RBAC by default | Explicit Y/N for Counsellor (and spelling variant) |
| `NURSE` | Nurse | Clinical/IP; `patient.create` cohort | **Yes** (if granted) | **No** | **No** | **No** | **No** | No | **Exclude (proposal)** | Clinical create ≠ portal account provisioning | Confirm exclude |
| `IP COORDINATOR` | IP Coordinator | IP coordination; `patient.create` cohort | **Yes** (if granted) | **No** | **No** | **No** | **No** | No | **Exclude (proposal)** | IP workflow ≠ portal invite | Confirm exclude |
| `ADMIN` | Admin | Tenant admin; unrestricted `*` | **\*** | **\*** (and typically holds user admin perms) | **\*** for future staff `RequirePermission`; **no** explicit RolePermission today | S4 N/A | S4 N/A | **Yes** | **No explicit grant** | Wildcard already authorizes; explicit grant adds no least-privilege value | Confirm retain `*` only |
| `SUPERADMIN` / `SUPER ADMIN` | SuperAdmin | Same wildcard model | **\*** | **\*** | **\*** | S4 N/A | S4 N/A | **Yes** | **No explicit grant** | Same as ADMIN | Confirm |
| LMS Lab roles (`LAB TECHNICIAN`, `LAB MANAGER`) | Lab | LMS/Lab permissions | Not in patient.create set | **No** | **No** | **No** | **No** | No | **Exclude** | L-REP / lab ownership ≠ portal invite; L-REP-04 unauthorized | — |
| Doctor / Surgeon / Billing / Pharmacy / … | various | Domain-specific | Varies | **No** | **No** | **No** | **No** | No | **Exclude** | No invite ownership evidence | — |

**Do not** copy the full `PatientCreateRoleGrantCatalog` set (`ADMIN`, `COUNSELLOR`, `RECEPTIONIST`, `MEDICAL RECORDS OFFICER`, `NURSE`, `IP COORDINATOR`) into Portal invite grants.

---

## 5. Admin wildcard assessment

| Check | Result |
| --- | --- |
| Detection | `PermissionService.IsUnrestrictedAdministrativeRole` → `ADMIN` \| `SUPERADMIN` \| `SUPER ADMIN` (trim + upper) |
| DB path | Active admin role → `GetUserPermissionsAsync` returns `["*"]`; `HasPermissionAsync` true for any code including `portal.invite.create` |
| JWT path | Login puts `*` into `permission` claims; handler succeeds if claim `*` present |
| Consistency | Handler JWT-first then DB fallback — both honor `*` |
| Future staff invite endpoint | On **default staff** JWT scheme + `RequirePermission("portal.invite.create")`, Admin succeeds **without** RolePermission row |
| Portal JWT (S3, unauthorized) | Separate scheme/audience planned; Admin staff wildcard must **not** become patient Portal authority |
| Admin UI invite action | **None** — `PortalAccessTab` stub; admin permissions UI assigns roles generally |
| Explicit Admin RolePermission benefit | **None** for security; optional only for matrix cosmetics — **rejected** |
| Recommendation | **(1) Retain existing wildcard; add no explicit ADMIN/SUPERADMIN grants** |

Caveat: if a future endpoint used a scheme that omits permission claims and bypassed this handler, behavior could differ — out of scope; do not change wildcard now.

---

## 6. Invitation workflow end-to-end gaps

Intended path (product + plan + S2 service):

```text
Staff selects existing tenant patient
  → Create invite (staff_delivered_token) + supersede prior pending
  → Staff hands opaque token to patient (no NotificationService in S2)
  → Patient accepts (email/password) → Patient AppUser + unverified link; invite used
  → Portal login (S3) may succeed; resolve still DENIED until S4 verify
  → Verified link → resolve PatientId → later L-REP-04 access (unauthorized now)
```

| Step | Current state | Gap |
| --- | --- | --- |
| Select existing patient | Patient hub / counselling / front-desk routes exist for patient context | No authorized “Invite to Portal” action |
| Tenant scope | Service enforces `command.TenantId` == patient/creator tenant | Branch scope on permission row (`Scope=branch`) **not** enforced in invitation service |
| Create invite | `IPortalInvitationService.CreateAsync` | No HTTP; no Gate B grants for non-admin staff |
| Supersede / expiry / used / invalid | Implemented in service + InMemory tests | No staff UI; Postgres concurrency test skipped without connection |
| Accept → Patient principal + unverified link | `AcceptAsync` domain only | No anonymous accept HTTP; no patient-facing UI |
| Resolve blocked while unverified | S1 `PortalPatientResolveService` | OK for foundation |
| Sign-in / records | Mock portal login / `PAT-001` still FE | S3 + FE cutover unauthorized |
| Delivery | Policy enables `staff_delivered_token` | Email/SMS not wired; ops process for handoff undefined |
| Verification | PD-ID-04 catalogue approved; field content residual | S4 + go-live gate |
| Audit | Create/supersede/expire/reject/link_unverified via `StageAsync`; resolve deny mandatory | Login audits BEST_EFFORT (S3) |

**Operational before “real invitation workflow”:** Gate B matrix + staff create API + accept API + ops SOP for token handoff + S3 login + S4 verify (for data access) + FE without `PAT-001`.

---

## 7. Staff account creation vs Patient Portal provisioning

| Capability | Permission / pattern | Owner domain | Portal invite? |
| --- | --- | --- | --- |
| **A. Staff-user administration** | `user.create`, `user.activate`, `user.manage` (e.g. `send-activation`) | AuthService `UsersController`; staff OTP ~48h | **No** — PD-ID-03-D1 forbids silent reuse |
| **B. Portal invitation / patient principal provisioning** | `portal.invite.create` (Gate A); accept creates `UserType=Patient` | AuthService portal identity | **This capability** — separate grants |
| **C. Patient / MPI registration** | `patient.create` / `patient.view` on `PatientsController`; FE `PatientHubPage` | MPI | **Does not imply** invite |
| **D. Verify / remediate links** | Proposed `portal.link.remediate` (+ approve) | S4 | **Separate** Gate A/B later |
| **E. Portal access / patient data** | Portal JWT + resolve + future L-REP-04 | S3 / L-REP-04 | **Distinct** from staff invite |

Overlaps today: Counsellor/Receptionist may hold `patient.create` while having **zero** portal invite authority — correct until Gate B.

---

## 8. Missing capabilities checklist

| Area | Missing |
| --- | --- |
| Authorization | Gate B role grants; remediation permission definitions (Gate A for those codes) |
| API | Staff create/supersede; anonymous accept; Portal login; resolve HTTP; verify/remediate |
| UI | Staff invite action (Portal Access tab OUT by default); patient accept/login cutover |
| Delivery | Ops SOP for staff-delivered token; email/SMS NotificationService portal wiring |
| Verification | Method field/content ops details; S4 dual-control |
| Audit | Already defined for invite mutations; login BEST_EFFORT at S3 |
| Auth schemes | Dual JWT (S3) — staff `*` must not authenticate as Portal patient |

---

## 9. Security and operational risks

| Risk | Mitigation |
| --- | --- |
| Over-broad invite grants (= all `patient.create` roles) | Separate matrix; exclude Nurse/IP/Counsellor unless PO approves |
| Using `user.manage` for portal invite | Forbidden by PD-ID-03-D1 |
| Admin `*` overreach on patient data | Keep Portal endpoints on Portal scheme (S3); resolve re-check |
| Token theft pre-accept | Single-use, hash-only, 1–72h expiry, HTTPS, short TTL |
| Accept ≠ verify confusion | Hard rule in service; UAT must prove unverified cannot resolve |
| FRONT DESK / RECEPTIONIST confusion | Grant by exact `NormalizedName` only |
| Replace-all role API for Gate B | Use idempotent seeder catalogue only |
| Staff-delivered token without SOP | Ops decision before production handoff |

---

## 10. Recommended least-privilege inviter model (proposal)

```text
Primary inviter (proposal): RECEPTIONIST
Optional second (proposal): MEDICAL RECORDS OFFICER — PO opt-in only
Admin/SuperAdmin: wildcard * only — no RolePermission row
Counsellor: PO decision required (default lean exclude for first slice)
FRONT DESK: exclude unless PO proves distinct live role + ownership
Nurse / IP Coordinator / LMS / clinical / billing: exclude
New roles: do not create
User-specific grants: do not use
```

Staff-delivered single-use token remains the first policy-enabled delivery path (PD-ID-03-D2 / plan C7).

---

## 11. Exact proposed Gate B grant matrix (PROPOSAL — not authorized)

| Recipient `NormalizedName` | Permission | Grant method | Notes |
| --- | --- | --- | --- |
| `RECEPTIONIST` | `portal.invite.create` | Idempotent `RolePermission` seeder (new catalogue mirroring patient.create grants) | **Proposed primary** |
| `MEDICAL RECORDS OFFICER` | `portal.invite.create` | Same | **Proposed optional** — only if PO checks yes |
| `ADMIN` / `SUPERADMIN` / `SUPER ADMIN` | — | **None** | Already covered by `*` |
| All others | — | **None** | Explicit non-recipients |

Implementation files **only after PO approval** (not in this task):  
`PortalInviteRoleGrantCatalog.cs`, `SeedPortalInviteRoleGrantsAsync`, `Program.cs` invoke, grant tests.

---

## 12. Roles explicitly excluded (proposal) and why

| `NormalizedName` | Why exclude from first Gate B seeder |
| --- | --- |
| `NURSE`, `IP COORDINATOR` | Clinical/IP `patient.create` ≠ portal provisioning |
| `COUNSELLOR` / `COUNSELOR` | Counselling ownership; Portal Access OUT; needs separate PO yes |
| `FRONT DESK` / `FRONTDESK` | Distinct from Receptionist; not in patient.create grant set; ownership unproven |
| Lab / Doctor / Surgeon / Billing / Pharmacy / Finance / … | No invite workflow evidence |
| New invented “Portal Inviter” role | Out of scope — do not create roles |

---

## 13. Decisions remaining for Product Owner

1. Approve exact Gate B recipients (`RECEPTIONIST` only vs + `MEDICAL RECORDS OFFICER`).
2. Counsellor invite: yes / no / later.
3. If tenant has live `FRONT DESK` role: grant, merge ops into Receptionist, or ignore.
4. Confirm Admin policy: **wildcard only, no explicit grant**.
5. Confirm no user-level grants and no new roles.
6. Separate later: invite HTTP exposure; S3; S4 verify/remediate permission Gate A/B; Portal Access UI (PD-ID-09); L-REP-04.

---

## 14. Implementation sequencing and dependencies

| Order | Slice | Depends on |
| --- | --- | --- |
| Done | S1 schema + resolve | — |
| Done | S2 invitation domain service | S1 |
| Done | Gate A `portal.invite.create` definition | PO |
| **Next** | **Gate B grants** (exact matrix) | **PO approval of §11** |
| Then | Staff invite HTTP (+ optional accept HTTP) | Gate B + separate HTTP auth |
| S3 | PortalJwt + login + FE cutover / remove `PAT-001` | Invite accept usable |
| S4 | Verify + remediation dual control | Ops verification fields; remediate Gate A/B |
| Later | Email/SMS delivery wiring | Policy + NotificationService |
| Last | L-REP-04 | Identity blocker closure criteria |

---

## 15. Future tests and UAT (authorized slices only)

**Automated (future Gate B):** catalogue approved names; idempotent seed; no grants to excluded roles; Admin still `*` without RolePermission; existing Gate A / patient.create / Admin wildcard suites remain green.

**Manual UAT (after HTTP authorized):** Receptionist create → token handoff → accept → unverified → resolve deny; Admin via `*` create; Counsellor/Nurse denied; supersede; expiry; no raw token in DB/audit.

**This audit ran (InMemory, no shared DB mutation):**

```powershell
dotnet test artifacts/gate-a-test-build/AuthService.Tests.dll `
  --filter "FullyQualifiedName~PortalInvitePermissionTests|FullyQualifiedName~AdminAuthorizationNormalizationTests|FullyQualifiedName~PatientCreateRoleGrantTests"
```

**Result:** Passed **24**, Failed **0**, Skipped **0**.

---

## 16. Exact authorization required to proceed

| Next action | Authorization needed |
| --- | --- |
| Seed `RolePermission` for `portal.invite.create` | **Gate B** with **exact** approved `NormalizedName` list + Admin wildcard policy stamp |
| Expose invite/accept HTTP | Separate authorization after Gate B |
| S3 / S4 / L-REP-04 | Existing separate gates — still unauthorized |
| Change Admin `*` behavior | Security/PO decision — **not recommended** |

---

## Stop

Gap analysis complete. **No grants, endpoints, JWT, UI, or schema changes were made.**  
Await Product Owner approval of the **exact** §11 matrix (and Admin wildcard confirmation) before implementing Gate B.
