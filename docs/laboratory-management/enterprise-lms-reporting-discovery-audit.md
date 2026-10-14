# L-REP-01 — Reporting / Release  
# Discovery Audit

**Date:** 2026-10-12  
**Slice:** L-REP-01 — Reporting / Release (discovery only)  
**Mode:** DISCOVERY / AUDIT ONLY — no application code, schema, migrations, APIs, UI, permissions seeding/grants, ResultStatus, Critical, Pathology, CanonicalDocument, Amendments, PDF generation, Final/Released, or patient publication implementation  

**Upstream accepted:** L-COL-01B … 01E · L-TST-01A · L-VER-01 · L-AUTH-01 · L-CRT-01 · L-CRT-UX-01  
**Acceptance stamp:** `ACCEPTED_L_CRT_01_AND_L_CRT_UX_01`  
**Acceptance closure:** [enterprise-lms-critical-results-acceptance-closure.md](./enterprise-lms-critical-results-acceptance-closure.md)

```text
ACCEPTED_L_CRT_01_AND_L_CRT_UX_01
  → L-REP-01 Discovery Audit (THIS DOCUMENT)
  ↓
PRODUCT OWNER DECISIONS (separate)
  → Decision Closure (separate)
  → Implementation (separate — not authorized here)
```

**Final discovery status:**

# DISCOVERY_COMPLETE_READY_FOR_PRODUCT_OWNER_DECISION

---

## 1. Document purpose

Establish the factual repository baseline for Enterprise LMS Reporting / Release after Clinical Authorization and Critical Results acceptance. Identify what exists, what can be reused (GREEN / YELLOW / RED), what is missing, and which Product / Architecture decisions must close before any L-REP-01 implementation.

**This document does not approve product decisions and does not implement Reporting.**

---

## 2. Source hierarchy and PRD/BRD availability

| Priority | Source | Role in this audit |
|---|---|---|
| 1 | Enterprise LMS PRD/BRD v1.0 | Functional SoT — **physical PRD/BRD file not present in repository** (no `*PRD*` under `docs/`). Requirements used via certified extractions in prior LMS discovery/decision closures and V3 where cited. |
| 2 | Approved LMS Product Decision closures (esp. L-AUTH, L-CRT acceptance) | Certified boundaries: ResultStatus ends at ClinicallyAuthorized; Reporting/Final/Released deferred |
| 3 | Accepted implementation / PRE-UAT / acceptance reports | Runtime evidence for Result / Critical |
| 4 | Repository code / schema / tests | Factual current state |
| 5 | Shared Hospital Portal services (CanonicalDocument, NotificationHub, QuestPDF elsewhere) | Reuse candidates |
| 6 | Pathology / legacy LabReport | Reference only — **not** LMS SoT unless Product Owner later approves |

**Architecture context:** [laboratory-management-product-definition-v3.md](../decisions/laboratory-management-product-definition-v3.md) (§3–5, §13–14, §21–22, §26 L6/L9) still describes a **LabReport-rooted** target with Final Release (`completed`) and DiagnosticReport mapping. Enterprise LMS has since delivered a **separate LaboratoryApi Result path**. Resolving that coexistence for Reporting is a **primary Product Decision** (see PD-REP-01 / PD-REP-26).

Companion decision package (organizing only, no approvals): [enterprise-lms-reporting-decision-package.md](./enterprise-lms-reporting-decision-package.md).

---

## 3. Certified Result lifecycle (preserved — not modified)

### 3.1 Aggregate and versions

| Element | Location / behavior |
|---|---|
| Aggregate | `LmsResult` (`LaboratoryApi/Domain/LmsResult.cs`) — links OrderTest + Specimen; TenantId + OperatingBranchId |
| Versions | `LmsResultVersion` — append-oriented version rows; `CurrentVersionNumber` on Result |
| Status enum | `ResultStatuses`: **Draft**, **TechnicalVerified**, **ClinicallyAuthorized** only (`ResultEnums.cs`) |
| Verify metadata | `VerifiedByUserId`, `VerifiedAtUtc`, `VerifiedVersionNumber` |
| Authorize metadata | `AuthorizedByUserId`, `AuthorizedAtUtc`, `AuthorizedVersionNumber` |
| Critical | Orthogonal `LmsCriticalResultEvent` bound to `ResultId` + `ResultVersionNumber` — does **not** change ResultStatus |
| Concurrency | Integer `RowVersion` concurrency token on Result / Critical event |
| Idempotency | `lms_result_idempotency` for result draft/verify/authorize/critical ops |
| Audit | Platform audit via AuthService internal API; fail-closed on critical mutations |
| APIs | `/api/lms/testing/...` work queue, draft, verify, authorize, critical (TestingFunctions) |
| UI | Testing / Verification / Authorization / Authorized Results / Critical — **no Report UI** |

### 3.2 Proven lifecycle

```text
Draft → TechnicalVerified → ClinicallyAuthorized
```

**Proven absences on ResultStatus:** Final, Released, Published, Critical (as status).

**Proven separations (accepted closures):** ClinicallyAuthorized ≠ Final / Released / patient-visible / report published / PDF generated.

**This audit did not modify any of the above.**

---

## 4. Reporting existence in LaboratoryApi (Enterprise LMS)

| Capability | Status |
|---|---|
| `LmsReport` / ReportVersion / ReportStatus entities | **ABSENT** |
| Report migrations | **ABSENT** |
| Report services / DTOs / Functions routes | **ABSENT** |
| PDF generation in LaboratoryApi | **ABSENT** |
| Finalization / Release / Publish endpoints | **ABSENT** |
| Report amendment entities | **ABSENT** |
| FE `/dashboard/lms/reports` | Placeholder (`LmsCapabilityPage`); capability `reports` = **`not_implemented`** |
| FE `/dashboard/lms/results/amendments` | Placeholder; capability `results-amendments` = **`not_implemented`** |
| FE `lms-reports.api.ts` | **ABSENT** |
| `lms.reports.view` | FE constant only (`lms-permissions.ts`) — **not seeded** in AuthService Enterprise LMS catalogs |

**Shell test:** `LaboratoryDbContextShellTests` asserts LaboratoryApi sources do **not** reference `LabReport` / `laboratory_test_definitions`.

**Conclusion:** There is **no Enterprise LMS Report domain** in LaboratoryApi today.

---

## 5. Legacy Pathology Laboratory reporting (AuthService LabReport)

Pathology / legacy Laboratory is **not** a separate microservice. It is AuthService `LabReport` + FE `/dashboard/laboratory` + Patient 360 lab surfaces.

| Concern | Path / behavior | Reuse class |
|---|---|---|
| Root entity | `AuthService/Models/Domain/LabReport.cs` | **YELLOW** — V3 historical SoT; **not** Enterprise LMS Result SoT |
| Items | `LabReportItem` | **YELLOW** |
| REST | `LabReportsController` → `/api/lab-reports` | **YELLOW** for LMS Reporting SoT |
| Workflow status | `ordered` … **`completed`**, cancelled, on_hold (string workflow — not LMS ResultStatus) | **YELLOW** — V3 maps `completed` ≈ final released for **legacy only** |
| Complete / “release” proxy | `POST …/complete` | **YELLOW** — no LMS immutability/versioning model |
| Interpretation | Flat string incl. `critical` | **RED** as Critical SoT (L-CRT-01 owns CriticalResultEvent) |
| PDF generation | **ABSENT** (user attach only) | — |
| Attach PDF | `POST …/attach-report` + content stream via CanonicalDocument | **GREEN** as **document storage pattern**, not clinical SoT |
| FE client | `lab-reports.api.ts` | **YELLOW** for P360/legacy; **RED** as LMS Reports route SoT |
| LMS FE | Tests forbid `/lab-reports` on LMS orders/collection/specimens/overview | Boundary preserved |

**Critical rule for L-REP-01:** Pathology LabReport must **not** become the Enterprise LMS Reporting SoT merely because it already has complete/attach. Product Owner must decide coexistence (PD-REP-01 / PD-REP-26).

---

## 6. Report domain model

**Enterprise LMS Report domain:** **NOT IMPLEMENTED.**

No table/entity for LMS Report / ReportVersion / report content / release metadata under LaboratoryApi.

---

## 7. Report lifecycle audit

| Candidate state | Enterprise LMS | Legacy LabReport |
|---|---|---|
| Draft report | **NOT IMPLEMENTED** | Implicit pre-complete |
| Verified report | **NOT IMPLEMENTED** | N/A (different model) |
| Authorized report | **NOT IMPLEMENTED** | N/A |
| Final report | **NOT IMPLEMENTED** | Approximated by status `completed` (**YELLOW** — OPEN for LMS) |
| Released report | **NOT IMPLEMENTED** | Same as completed in V3 legacy vocabulary |
| Published / patient-visible | **NOT IMPLEMENTED** | P360 shows lab rows / attached docs — not LMS release |
| Corrected / Amended report | **NOT IMPLEMENTED** | Ordinary PUT still possible on LabReport (**RED** vs V3 immutability intent) |
| Cancelled | **NOT IMPLEMENTED** (LMS Report) | LabReport cancelled exists |

All LMS Report lifecycle states are **OPEN PRODUCT DECISION**.

---

## 8. Result → Report boundary

| Question | Finding |
|---|---|
| Does a report bind to one ResultVersion? | **OPEN PRODUCT DECISION** — no LMS Report exists |
| Multi-result / multi-OrderTest / multi-Specimen report? | **OPEN PRODUCT DECISION** (legacy LabReport supports multi-item; LMS Result is per OrderTest+Specimen) |
| Report content snapshot? | **OPEN PRODUCT DECISION** |
| Can released report change? | **OPEN PRODUCT DECISION** (V3 says released immutable — not implemented in LMS) |
| Regeneration overwrite? | **NOT IMPLEMENTED** |
| Result immutable after report generation? | **NOT IMPLEMENTED** — Result already has verify/authorize immutability patterns; report binding undefined |
| Corrected reports representation? | **OPEN** — tied to Amendments (deferred) |

**EXISTING BEHAVIOR (Result only):** One `LmsResult` per OrderTest+Specimen; `ResultVersion` numbers; Critical binds exact ResultVersion; ClinicallyAuthorized does not create a report.

---

## 9. Final / Release / Publication audit

| Capability | Service owner | Status |
|---|---|---|
| Finalization | — | **ABSENT** (LMS); legacy `complete` **YELLOW** |
| Release | — | **ABSENT** (LMS) |
| Publish / patient visibility | — | **ABSENT** (LMS); P360 projects legacy lab metadata |
| Clinician portal visibility | — | **ABSENT** as LMS release |
| Download / print PDF | Legacy attach stream; QuestPDF elsewhere (PatientSummary, Imaging — **not** LMS Result) | **YELLOW** pattern reuse |
| Secure report delivery | — | **ABSENT** |
| Report notification | — | **ABSENT** (Critical uses in-app intent only) |

---

## 10. Patient 360 / CanonicalDocument infrastructure

| Asset | Finding | Class |
|---|---|---|
| `CanonicalDocument` + associations | AuthService; `domain=lab`, `entityType=LabReport` | **GREEN** storage/identity |
| `LabReportCanonicalDocumentService` | Attach does not change clinical status | **GREEN** pattern |
| Patient 360 Documents | Attach/download for lab | **YELLOW** for LMS — currently LabReport-centric |
| Patient document permissions | `patient.patient_document.*`, `patient.view/update` for lab content | **YELLOW** — not `lms.reports.*` |
| Clinical SoT in CanonicalDocument | Explicitly **not** — bytes + metadata | Must remain **downstream** |

**Recommendation posture (not approval):** CanonicalDocument is a **downstream document/content storage candidate**, not the LMS Report SoT.

---

## 11. Notification / delivery audit

| Channel | LaboratoryApi | Notes |
|---|---|---|
| In-app tenant push | **EXISTS** — `PlatformNotificationClient` → AuthService `push-tenant` | Used for **`lab.result.critical` only** |
| Email / SMS / WhatsApp from LaboratoryApi | **ABSENT** | Must not invent for Reporting in discovery |
| Delivery orchestration / retry / patient delivery | Not wired for lab report release | **OPEN** / **CONFIGURATION REQUIRED** |

**Distinction (mandatory):** Clinical Report Release ≠ Notification Delivery. Notification may announce release; it must not define release.

---

## 12. Amendment / correction audit

| Area | Finding |
|---|---|
| LMS Amendments UI | Placeholder `not_implemented` |
| LMS Amendment tables/APIs | **ABSENT** |
| ResultVersion history | Append-only draft/verify versions exist; **not** released-report amendment chain |
| L-CRT / L-AUTH closures | Amendments explicitly **future separate slice** |
| Legacy LabReport | Mutable via PUT — **RED** vs V3 released-immutability intent |

**Reporting requires Product Decisions** on whether L-REP-01 includes any correction boundary or hard-defers Amendments (PD-REP-17). Discovery recommends **deferring Amendments** unless PO explicitly expands first slice.

---

## 13. Pathology coexistence findings

| Rule | Status |
|---|---|
| Pathology remains separate boundary (accepted LMS slices) | **PRESERVED** |
| LabReport as LMS Reporting SoT | **RED without explicit PO approval** |
| Document attach pattern reuse | **GREEN** |
| Interpretation=`critical` as Critical SoT | **RED** (L-CRT-01 owns events) |
| Parallel dual clinical SoTs for same patient result | **YELLOW / OPEN** — must be decided |

---

## 14. Permissions / authorization audit

| Permission / gate | Status |
|---|---|
| `lms.view`, testing/result/verify/authorize/critical.* | Seeded Enterprise LMS catalogs (no Critical role grants by design) |
| `lms.reports.view` | FE-only constant — **not seeded** |
| `lms.reports.*` generate/release/publish/download | **ABSENT** — **CANDIDATE ONLY — PRODUCT DECISION REQUIRED** |
| Legacy lab | `patient.view` / `patient.update` + `laboratory.view` for L0 UAT roles |
| Admin `reports.view` / `ccms.report.*` | Unrelated analytics/CCMS — **not** LMS clinical reports |

**This discovery did not create, seed, or grant any permissions.**

---

## 15. Tenant / branch / site audit

| Concern | Current LMS Result support |
|---|---|
| Tenant isolation | Yes — Result / Critical require TenantId |
| Operating branch | Yes — OperatingBranchId + ValidateUserBranch |
| Performing branch | On OrderVersion; Result uses operating/receiving branch rules |
| Laboratory section / site masters for report ownership | **CONFIGURATION REQUIRED** / largely absent as report policy |
| Release authority / signatory matrix | Deferred historically (PRD-RES-03 / PD-LAB-VER-02 style) — **OPEN** |
| Patient visibility scope | **OPEN PRODUCT DECISION** |

Do not invent a new organization hierarchy in implementation without PO decision.

---

## 16. Configuration dependency audit

| Dependency | Status |
|---|---|
| Report templates / branding | **CONFIGURATION REQUIRED** |
| Reference intervals / units on report | Catalogue has nullable refs; **no report renderer** |
| Signatory authority | **CONFIGURATION REQUIRED** |
| Report numbering / naming | **CONFIGURATION REQUIRED** |
| Release policy | **CONFIGURATION REQUIRED** |
| Patient visibility / delivery channels | **CONFIGURATION REQUIRED** |
| Document retention | **CONFIGURATION REQUIRED** |
| Amendment policy | **CONFIGURATION REQUIRED** (or deferred with Amendments) |
| Site/branch applicability for reports | **CONFIGURATION REQUIRED** |

Missing configuration must be recorded as **CONFIGURATION REQUIRED**, not invented as hard-coded clinical policy.

---

## 17. Product Decision Register (not approved)

| ID | Topic | Status |
|---|---|---|
| PD-REP-01 | Report aggregate ownership (LaboratoryApi vs LabReport vs hybrid) | **OPEN** |
| PD-REP-02 | Report-to-Result relationship (1:1 ResultVersion vs multi-result) | **OPEN** |
| PD-REP-03 | ReportVersion binding to ResultVersion | **OPEN** |
| PD-REP-04 | Report content snapshot semantics | **OPEN** |
| PD-REP-05 | Report lifecycle states | **OPEN** |
| PD-REP-06 | Finalization semantics | **OPEN** |
| PD-REP-07 | Release semantics | **OPEN** |
| PD-REP-08 | Publication semantics | **OPEN** |
| PD-REP-09 | Patient visibility | **OPEN** |
| PD-REP-10 | Clinician visibility | **OPEN** |
| PD-REP-11 | Report generation timing (on authorize vs explicit generate) | **OPEN** |
| PD-REP-12 | PDF/document generation | **OPEN** |
| PD-REP-13 | Report numbering | **OPEN** / **CONFIGURATION REQUIRED** |
| PD-REP-14 | Report template ownership | **OPEN** / **CONFIGURATION REQUIRED** |
| PD-REP-15 | Signatory / authority | **OPEN** / **CONFIGURATION REQUIRED** |
| PD-REP-16 | Multi-result report composition | **OPEN** |
| PD-REP-17 | Amendment/correction boundary vs L-REP first slice | **OPEN** (recommend defer) |
| PD-REP-18 | Report delivery | **OPEN** |
| PD-REP-19 | Notification behavior on release | **OPEN** |
| PD-REP-20 | Audit requirements | **RECOMMENDED** fail-closed pattern from Result/Critical |
| PD-REP-21 | Permission model (`lms.reports.*`) | **OPEN** — candidates only |
| PD-REP-22 | Tenant/branch/site scope | **OPEN** |
| PD-REP-23 | Retention | **CONFIGURATION REQUIRED** |
| PD-REP-24 | Patient 360 integration | **OPEN** |
| PD-REP-25 | CanonicalDocument integration (storage only vs SoT) | **RECOMMENDED** storage only |
| PD-REP-26 | Pathology / LabReport coexistence | **OPEN** |
| PD-REP-27 | Release idempotency | **RECOMMENDED** |
| PD-REP-28 | Concurrency | **RECOMMENDED** RowVersion pattern |
| PD-REP-29 | Failure/retry semantics | **OPEN** |
| PD-REP-30 | Analytics freshness | **NOT APPLICABLE** to first clinical release slice |

**Recommendations are not approvals.**

---

## 18. Architecture Decision Register (candidates — not approved)

| ID | Topic | Status |
|---|---|---|
| AD-REP-01 | Report ownership service (LaboratoryApi vs AuthService) | **OPEN** |
| AD-REP-02 | Report aggregate/storage | **OPEN** |
| AD-REP-03 | ResultVersion binding | **OPEN** |
| AD-REP-04 | ReportVersion model | **OPEN** |
| AD-REP-05 | Document storage (CanonicalDocument) | **RECOMMENDED** candidate |
| AD-REP-06 | PDF generation approach | **OPEN** |
| AD-REP-07 | Release transaction boundary | **OPEN** |
| AD-REP-08 | Notification orchestration | **OPEN** (reuse push-tenant pattern) |
| AD-REP-09 | Audit | **RECOMMENDED** platform audit fail-closed |
| AD-REP-10 | Idempotency | **RECOMMENDED** |
| AD-REP-11 | Concurrency | **RECOMMENDED** |
| AD-REP-12 | Patient 360 integration | **OPEN** |
| AD-REP-13 | Pathology coexistence | **OPEN** |
| AD-REP-14 | Amendments | **OPEN** / defer |
| AD-REP-15 | Delivery | **OPEN** |

---

## 19. Possible first-slice options (not chosen)

| Option | Description | Blockers / notes |
|---|---|---|
| **A** | Report foundation + ReportVersion model in LaboratoryApi (no release) | Needs PD-REP-01…05 |
| **B** | Report composition / preview from ClinicallyAuthorized ResultVersion | Needs templates/signatory decisions or honest “preview only” |
| **C** | Finalization foundation (status only, no patient visibility) | Needs PD-REP-05/06; must not collapse into ResultStatus without PO |
| **D** | Release foundation + document attach | Needs PD-REP-07/12/25; CanonicalDocument **GREEN** |
| **E** | Report document generation (PDF) | Needs templates/branding (**CONFIGURATION REQUIRED**); QuestPDF exists elsewhere (**YELLOW**) |
| **F** | Release + delivery + notification | Highest scope; many OPEN decisions |

**Evidence-supported recommendation (not approval):** Prefer a **bounded Report foundation** that:

1. Lives in **LaboratoryApi** (same SoT as `LmsResult`), **or** explicitly bridges to LabReport with PO stamp.  
2. Binds to **ClinicallyAuthorized ResultVersion** (snapshot decision still OPEN).  
3. Keeps Critical orthogonal.  
4. Uses CanonicalDocument only for **bytes**.  
5. Defers patient publication, Amendments, and escalation.

Hard blockers before a release-capable slice: signatory authority, release policy, template/branding, report numbering, patient visibility decision, Pathology coexistence decision.

---

## 20. Future UAT / testing gate (not executed)

| Gate | Requirement (future) |
|---|---|
| Automated tests | Report aggregate, version binding, release immutability, idempotency, audit fail-closed, permissions, no ResultStatus pollution |
| PRE-UAT | Migration, schema, services running, eligible ClinicallyAuthorized Result, document storage if in scope |
| Manual UAT | Generate/preview/finalize/release paths per approved decisions; prove ResultStatus unchanged; prove no patient visibility if out of scope |
| Acceptance | Separate acceptance closure after Manual UAT |

**No Manual UAT executed. No new tests written for unimplemented Reporting.**

---

## 21. Certified functionality regression status

| Slice | Modified by this audit? |
|---|---|
| L-COL-01B … 01E | **No** |
| L-TST-01A | **No** |
| L-VER-01 | **No** |
| L-AUTH-01 | **No** |
| L-CRT-01 / L-CRT-UX-01 | **No** |
| Pathology | **No** |

**NO APPLICATION IMPLEMENTATION WAS PERFORMED.**

---

## 22. Reuse matrix summary

| Candidate | Class | Notes |
|---|---|---|
| `LmsResult` / ResultVersion / ClinicallyAuthorized | **GREEN** | Upstream clinical input to Reporting |
| CriticalResultEvent | **GREEN** (display on report later) | Orthogonal; not Report SoT |
| Testing work queue / Authorized Results UI patterns | **GREEN** | Worklist patterns for future report queues |
| Platform audit + idempotency patterns | **GREEN** | |
| PlatformNotificationClient / push-tenant | **GREEN** pattern | Not release SoT |
| CanonicalDocument attach/stream | **GREEN** storage | Not clinical SoT |
| QuestPDF (PatientSummary / Imaging) | **YELLOW** | Different domains |
| Legacy LabReport + complete | **YELLOW** coexistence / **RED** as silent LMS SoT |
| LabReport Interpretation critical | **RED** Critical SoT |
| Orphan `lab.api.ts` patterns | **RED** | |
| Analytics `reports.view` / CCMS reports | **RED** for clinical LMS reports |

---

## 23. Hard blockers for implementation

1. **Ownership decision:** LaboratoryApi Report vs LabReport root vs hybrid (PD-REP-01 / PD-REP-26).  
2. **Result→Report cardinality and snapshot rules** (PD-REP-02…04).  
3. **Lifecycle vocabulary:** Final/Released as Report states vs ResultStatus (must not silently extend ResultStatus).  
4. **Signatory / release authority configuration.**  
5. **Template / branding / numbering configuration.**  
6. **Patient visibility / publication decision.**  
7. **Amendment boundary** relative to first Reporting slice.  
8. **Permission catalog design** for `lms.reports.*` (candidates only today).

---

## 24. Files created by this discovery

| File | Role |
|---|---|
| `docs/laboratory-management/enterprise-lms-reporting-discovery-audit.md` | This audit |
| `docs/laboratory-management/enterprise-lms-reporting-decision-package.md` | PO decision organizing package (no approvals) |

---

## FINAL STATUS

**DISCOVERY_COMPLETE_READY_FOR_PRODUCT_OWNER_DECISION**

**Next step:** Product Owner review → Product Decision Closure → separate implementation prompt.

**STOP.** Do not implement Reporting / Final / Released / PDF / patient publication / Amendments / permission grants.
