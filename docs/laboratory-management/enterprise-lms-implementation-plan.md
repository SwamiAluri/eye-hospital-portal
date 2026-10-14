# Enterprise LMS Implementation Plan & Traceability (L0)

**PRD SoT:** Enterprise Hospital Laboratory Management System | PRD BRD v1.0 | 08 October 2026  
**Workspace:** `/dashboard/lms`  
**Boundary doc:** [enterprise-lms-existing-laboratory-boundary.md](./enterprise-lms-existing-laboratory-boundary.md)

## Status legend

| Status | Meaning |
|---|---|
| L0 complete | Structural workspace/IA only |
| Architecture Defined | Service/platform prerequisite documented/scaffolded |
| Planned | Future bounded slice |
| Blocked | Needs product/architecture decision |

Navigation existence ≠ implementation. Architecture ≠ catalogue.

## Traceability matrix (foundation)

| PRD capability / area | PRD theme | LMS area | Planned slice | Status | Dependencies | Open decision | Acceptance gate |
|---|---|---|---|---|---|---|---|
| Access / context | Access | Overview + context strip | L0 | L0 complete | Platform auth/branch | Lab/section selector policy | Manual UAT: LMS opens with platform context |
| LMS navigation IA | Access | Left nav | L0 | L0 complete | Sidebar pattern | Fine-grained `lms.*.view` role map | Nav visible only with `lms.view` |
| Overview indicators | Analytics/ops | Overview | L0 shell / L-OPS later | L0 complete (placeholders) | Event timestamps | Which KPIs are authoritative | No fabricated counts |
| Laboratory domain service | Architecture | LaboratoryApi | L-CAT-01A | Architecture Defined | AD-CAT-01/02 approved | AD-CAT-DB, AD-CAT-AUDIT, CI job | Architecture review |
| Work Queue | Operations | Work Queue | L-WQ-01 | Planned | Ownership model | Assignment/ownership rules | Queue empty/error honest |
| Patient / order intake | Orders | Orders | L-ORD-01B / **L-ORD-01C (UI)** | Domain/API accepted; **UI implemented — Manual UAT pending** | [PD-ORD closure](./enterprise-lms-order-product-decision-closure.md); [UI report](./enterprise-lms-order-ui-implementation-report.md) | PD-ORD-UI-01…04 closed for slice; production role grants deferred | Manual UI UAT checklist in UI report |
| Catalogue | Configuration | Configuration → Test Catalogue | L-CAT-01B | Implemented — Manual UAT accepted | L-CAT-01A accepted; internal audit; permission seed | PD-CAT-02 role grants; Billing mapping PD | Catalog CRUD UAT |
| Catalogue identity / versioning / effective dating / lifecycle / approval | Configuration | LaboratoryApi catalogue | L-CAT-01B | Implemented — Manual UAT accepted | AD-CAT-* | Overlap auto-supersede accepted | UAT-05/06 |
| Panel model / referral-test classification | Configuration | Catalogue types | L-CAT-01B | Implemented — Manual UAT accepted | — | Nested panels forbidden | UAT-03/04 |
| Tenant scope / branch applicability / audit / search / management UI | Configuration | LMS Configuration | L-CAT-01B | Implemented — Manual UAT accepted | Platform Branch IDs; audit_log | — | UAT-01/07/08 |
| Order intake | Orders | Orders | L-ORD-01B | Domain/API done — STOP | [impl report](./enterprise-lms-order-implementation-report.md) | Complete Orders UI | Orders UI slice + Manual UI UAT |
| Collection planning / custody | Collection | Collection / Specimens | L-COL-01 / L-SPC-01 | Planned | Specimen identity | Barcode policy | Collection UAT |
| Receiving / triage | Specimens | Specimens | L-RCV-01 | Planned | Custody events | Accession rules | Receiving UAT |
| Examination / runs | Testing | Testing | L-TST-01 | Planned | Work items | Instrument gateway timing | Bench UAT |
| Technical verification | Results | Results → Verification | L-VER-01 | Planned | Result versions | Dual verification | Verification UAT |
| Clinical authorization | Results | Results → Authorization | L-AUTH-01 | Planned | RBAC matrix | Who may authorize | Authorization UAT |
| Critical results | Results | Results → Critical | L-CRT-01 | Planned | Notifications | Escalation matrix | Critical UAT |
| Reporting / release | Reports | Reports | L-RPT-01 | Planned | Documents platform | Release visibility to P360 | Report UAT |
| Amendments | Results | Amendments | L-AMD-01 | Planned | Versioning | Amendment reason codes | Amendment UAT |
| Referral laboratories | Referrals | Referrals / Config partners | L-REF-01 | Planned | Partners master | Send-out billing | Referral UAT |
| Billing / revenue | Billing | Billing | L-BILL-01 | Planned | Billing SoT | Charge timing PD | No Lab-owned ledger |
| Quality / QC / CAPA | Quality | Quality | L-QC-01 / L-CAPA-01 | Planned | Equipment/reagents | QC frequency rules | Quality UAT |
| Analytics | Analytics | Analytics | L-ANL-01 | Planned | Event hooks | Dashboard pack | Analytics UAT |
| Integrations HL7/FHIR/analyzer | Integrations | Operations / later | L-INT-* | Planned | Interop platform | Gateway ownership | Integration UAT |
| Security / audit | Security | Administration | Progressive | Planned | Platform audit | New permission codes approval | Audit evidence |
| Specialist domains | Domains | Later | L-SPC-* | Planned | Core workflow | Which domains in MVP | Domain UAT |

## Recommended next slice

**L-ORD-01C Order Intake UI** — implemented; awaiting Manual UI UAT — [UI implementation report](./enterprise-lms-order-ui-implementation-report.md).

L-ORD-01B domain/API foundation is **complete** — [implementation report](./enterprise-lms-order-implementation-report.md).

Do **not** start Collection / Specimens / Testing / Results without a new slice authorization after Orders Manual UAT acceptance.

## Product decisions

| ID | Status |
|---|---|
| PD-CAT-01 Catalogue permissions (view/manage) | **APPROVED** (architecture default) |
| PD-CAT-02 Role grants for catalogue capabilities | **DECISION REQUIRED** |
| PD-CAT-03 Tenant + multi-site Branch applicability | **APPROVED** (architecture default) |
| PD-CAT-04 `lms.catalogue.approve` for activate | **APPROVED** (capability; roles via PD-CAT-02) |
| PD-ORD-01 … PD-ORD-19 Order intake | **CLOSED** — see [order product decision closure](./enterprise-lms-order-product-decision-closure.md) |
| Which roles receive `lms.view` / `lms.orders.*` | Still open (Admin `*` works); grants deferred like PD-CAT-02 |
| Legacy Pathology migration | Deferred |
| Work Queue ownership | Deferred |

## Architecture decisions

| ID | Status |
|---|---|
| AD-CAT-01 Dedicated Laboratory Service | **Approved / shell** |
| AD-CAT-02 Dedicated LMS persistence | **Approved / empty DbContext** |
| AD-CAT-DB Shared `hospitalportal` + `lms_*` | **APPROVED** |
| AD-CAT-AUDIT Platform audit via Auth internal API | **IMPLEMENTED** (`POST /api/internal/audit`) |
| CI `laboratory-build-test` | **APPROVED** |
| Event/outbox | Deferred |
| Lab report document ownership | Deferred |
| Azure Functions production deploy for LaboratoryApi | Deferred |

Closure detail: [enterprise-lms-lcat-01a-architecture-closure.md](./enterprise-lms-lcat-01a-architecture-closure.md)
