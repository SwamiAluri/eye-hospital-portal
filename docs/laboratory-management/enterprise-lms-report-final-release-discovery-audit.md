# L-REP-02 — Report Finalization & Release  
## Discovery / Audit

**Date:** 2026-10-12  
**Mode:** DISCOVERY / AUDIT ONLY — no code, schema, migrations, APIs, UI, permission seeds/grants, ResultStatus, L-AUTH/L-VER/L-TST/L-CRT, Pathology, CanonicalDocument, PDF, patient publication, or Notification implementation  
**Upstream:** L-REP-01 Report Foundation + Draft source-uniqueness correction (PD-REP-DRAFT-UNIQUE-01)  
**Authoritative sources:** L-REP-01 Product Decision Closure; L-REP-01 implementation / PRE-UAT / uniqueness docs; LaboratoryApi + Hospital Portal code; Product Definition V3 (Pathology LabReport narrative = historical coexistence context only)

---

## 1. Executive summary

L-REP-01 delivered a **Draft-only** LaboratoryApi Report aggregate with immutable ResultVersion snapshots, multi-result composition, Draft source uniqueness claims, idempotency, RowVersion, tenant/branch auth, platform audit, and Draft UI. Conceptual `ReportStatuses.Final` / `Released` exist as **unused constants**; no Finalize/Release APIs, metadata columns, numbering, signatory model, PDF attach, or download exist.

L-REP-01 Product Decisions **already approve** the Report lifecycle principles (Draft → Final → Released), Finalization freeze semantics, Release as a distinct post-Final operation, permission catalogue family, audit/idempotency/concurrency patterns, and explicit CONFIGURATION_REQUIRED gates for numbering, templates, signatory/release authority, and retention when those values are needed.

**Discovery verdict:** Finalization and Release **cannot** be implemented safely yet without Product Owner closure of remaining operational decisions and (for release-capable work) resolution of **CONFIGURATION_REQUIRED** authority/numbering/document dependencies. Evidence is sufficient to produce a Product Decision Package for L-REP-02; it is **not** sufficient to authorize implementation.

| Question | Answer |
| --- | --- |
| Can Finalization be implemented now? | **No** — PRODUCT_DECISION_REQUIRED + optional CONFIGURATION_REQUIRED |
| Can Release be implemented now? | **No** — PRODUCT_DECISION_REQUIRED + **CONFIGURATION_REQUIRED** (PD-REP-15) |
| Can both be one bounded slice? | **Only if** PO closes all open decisions and accepts a minimal metadata-only scope; discovery **recommends split** (Finalize first, Release second) |
| PDF required for first Final/Release? | **Not mandated** by L-REP-01 principles; PO must decide whether L-REP-02 includes document bytes |
| Business Report Number required? | **CONFIGURATION_REQUIRED** if Final/Release need one; GUID remains sufficient for Draft |

**Final stamp:** `DISCOVERY_COMPLETE_READY_FOR_PRODUCT_OWNER_DECISION`

---

## 2. Current L-REP-01 certified baseline

Verified in repository (no L-REP-01 changes in this task):

| Capability | Status |
| --- | --- |
| `LmsReport` / `LmsReportVersion` / `LmsReportVersionSource` | Implemented |
| `LmsReportDraftSourceClaim` + unique `(tenant_id, result_version_id)` | Implemented (uniqueness correction) |
| Draft create / list / get / append version | Implemented (append only while `Status == Draft`) |
| Eligible-sources (excludes claimed ResultVersions) | Implemented |
| Exact ResultVersion provenance + immutable snapshots | Implemented |
| Multi-result same patient/order context | Implemented |
| Idempotency `create_report_draft` / `append_report_version` | Implemented |
| RowVersion concurrency | Implemented |
| Tenant + operating-branch authorization | Implemented |
| Platform audit `CREATE_REPORT_DRAFT` / `APPEND_REPORT_VERSION` (fail-closed) | Implemented |
| Permission catalogue `lms.reports.*` (no role grants by design) | Seeded as definitions |
| Draft UI (`ReportsWorkbench`, `ReportDetailView`) | Implemented |
| Finalize / Release mutations | **Absent** |
| Report business number | **Absent** |
| Signatory / release-authority tables | **Absent** |
| PDF / CanonicalDocument attach for LMS Report | **Absent** |
| `ResultStatus` Final / Released / Published | **Absent** (correct) |

Result lifecycle remains: Draft → TechnicalVerified → ClinicallyAuthorized.  
Report lifecycle remains conceptual: Draft → Final → Released (Draft only persisted).

---

## 3. PRD / BRD / prior decision requirements relevant to Final/Release

### 3.1 Product Definition V3 (historical Pathology narrative)

V3 describes AuthService `LabReport` → Final Release (`status → completed`) with document attach. That path is **legacy Pathology**, not LMS Report SoT (PD-REP-01 / PD-REP-26 / AD-REP-13). Reuse for LMS Final/Release semantics: **RED as SoT**; document-attach pattern: **YELLOW**.

### 3.2 L-REP-01 APPROVED principles (binding)

| ID | Binding rule for L-REP-02 |
| --- | --- |
| PD-REP-05 / AD-REP-07 | Final / Released are **Report** states; never ResultStatus |
| PD-REP-06 | Finalization **freezes** ReportVersion/content; no silent edit after Final; corrections → new ReportVersion / future Amendments |
| PD-REP-07 | Release is **distinct** after Final; not notification, publication, Clinical Authorization, or Critical acknowledgement |
| PD-REP-08 | Released ≠ patient-visible |
| PD-REP-11 | No auto Finalize/Release from Clinical Authorization |
| PD-REP-12 | PDF not automatic; templates/branding configuration-owned |
| PD-REP-13 | Numbering configuration-owned; do not invent |
| PD-REP-14 | Templates configuration-owned |
| PD-REP-15 | Finalization/release authority must be governed; if absent → CONFIGURATION_REQUIRED for release-capable work |
| PD-REP-17 / AD-REP-14 | Amendments out of first reporting slices |
| PD-REP-19 / AD-REP-08 / AD-REP-15 | Release ≠ delivery; future: Released → Notification Intent → Orchestration |
| PD-REP-20 / AD-REP-09 | Platform `audit_log`; fail-closed |
| PD-REP-21 | Catalogue family includes finalize/release/download; no grants; no `lms.reports.publish` |
| PD-REP-22 | Tenant + operating branch; additional authority needs governed config |
| PD-REP-23 | Retention configuration-owned |
| PD-REP-25 / AD-REP-05 | CanonicalDocument = downstream bytes only |
| PD-REP-27 / AD-REP-10 | Operation-specific idempotency for Release (and Finalize by AD-REP-10) |
| PD-REP-28 / AD-REP-11 | RowVersion 409 |
| PD-REP-29 | Fail-closed; no inventing retry policy |

---

## 4. Current repository evidence (what exists vs placeholders)

| Concern | Evidence | Exists? |
| --- | --- | --- |
| Draft status persistence | `LmsReport.Status = Draft` | Yes |
| Final / Released transitions | Constants only in `ReportEnums`; no service paths | Conceptual only |
| Version freezing | Snapshots immutable; Append restricted to Draft | Partial (Draft freeze of sources; no Final gate) |
| Report mutation after create | AppendVersion while Draft | Yes |
| Download | Permission catalogue text only; no API/UI | No |
| Document generation | No LMS Report PDF | No |
| Report numbering | No `LmsReportNumber*` / report sequence | No (GUID only) |
| Signatory fields on Report | None on `LmsReport` / `LmsReportVersion` | No |
| Release metadata (releasedAt/By) | None | No |
| Retention enforcement | None for LMS Report | No |

---

## 5. Finalization audit (Draft → Final)

| Topic | Finding |
| --- | --- |
| Who may Finalize | **PRODUCT_DECISION_REQUIRED** — catalogue has `lms.reports.finalize`; no role grants; no signatory registry |
| Permission | Candidate: `lms.reports.finalize` (catalogue-only today; LaboratoryAuthz constant unused in Functions) |
| Tenant / branch | Reuse Report pattern (tenant + `ValidateUserBranch` + Report.OperatingBranchId match) — **GREEN** |
| Signatory authority | **CONFIGURATION_REQUIRED** — no LMS report signatory / lab authority model (IP PreOp consent signatory is unrelated **RED**) |
| Reporting lab/section authority | **CONFIGURATION_REQUIRED** / absent as report policy |
| Clinician/signatory required? | **PRODUCT_DECISION_REQUIRED** |
| Multiple signatories? | **PRODUCT_DECISION_REQUIRED** — do not invent |
| Draft creator may Finalize? | **PRODUCT_DECISION_REQUIRED** (same-person rules from verify/authorize are Result-domain; not automatically Report-domain) |
| Source ResultVersion states | Draft create already requires ClinicallyAuthorized authorized version; **PRODUCT_DECISION_REQUIRED** whether Finalize re-validates live Result status vs trusts Draft snapshots |
| Source amended later | Snapshots immutable; live Result mutation does not rewrite Report (certified). Future Amendments slice owns corrections after Final |
| Explicit ReportVersion selection | Current model uses `CurrentVersionNumber`; **PRODUCT_DECISION_REQUIRED** whether Finalize freezes current version in place or creates a new Final ReportVersion |
| Draft completeness | No completeness checklist exists; multi-source Draft may have N sources — **PRODUCT_DECISION_REQUIRED** if all sources must remain claim-bound / CA |
| Immutability after Final | Approved principle (PD-REP-06); Append must reject non-Draft (already rejects non-Draft) |
| Audit action | Candidate naming aligned with existing UPPER_SNAKE: `FINALIZE_REPORT` (not in allowlist yet — future seed only) |
| Idempotency | New operation key e.g. `finalize_report` — pattern **GREEN**; not implemented |
| Concurrency | ExpectedRowVersion / RowVersion — pattern **GREEN** |
| Failure | Fail-closed on audit; no Final success without persist — pattern **GREEN** |

**Can Finalization proceed without Amendments?** Yes in principle (PD-REP-17): Final forbids in-place edit; Amendments deferred.

---

## 6. Release audit (Final → Released)

| Topic | Finding |
| --- | --- |
| Who may Release | **PRODUCT_DECISION_REQUIRED** + **CONFIGURATION_REQUIRED** (PD-REP-15) |
| Permission | Candidate: `lms.reports.release` (catalogue-only; unused) |
| Tenant / branch | Same as Final — **GREEN** pattern |
| Signatory / release authority | **CONFIGURATION_REQUIRED** — no governed source; must not infer from Admin/doctor/Pathology/CCMS |
| Final mandatory? | Yes by approved lifecycle (PD-REP-05/07) |
| Bound Final ReportVersion | **PRODUCT_DECISION_REQUIRED** — bind `CurrentVersionNumber` at Release vs explicit version |
| New ReportVersion on Release? | **PRODUCT_DECISION_REQUIRED** — Release may be metadata-only on aggregate |
| Release metadata | Not modeled; likely needs releasedAtUtc / releasedByUserId (schema later) |
| Audit | Candidate `RELEASE_REPORT`; allowlist not present |
| Idempotency | PD-REP-27 — required; not implemented |
| Document bytes required? | **PRODUCT_DECISION_REQUIRED** — not mandated by PD-REP-12 for foundation; Pathology often attaches bytes before/at completed (**YELLOW** analogy only) |
| Numbering required? | **PRODUCT_DECISION_REQUIRED** / **CONFIGURATION_REQUIRED** if yes |
| Templates/branding | **CONFIGURATION_REQUIRED** if PDF in slice |
| CanonicalDocument | Downstream only if PO includes document attach — **YELLOW** reuse of storage pattern; **RED as SoT** |
| Retention | **CONFIGURATION_REQUIRED** if enforcement in slice (PD-REP-23) |
| Notification intent | **PRODUCT_DECISION_REQUIRED** whether Release emits intent in same slice vs defer (architecture allows defer; delivery must not define Release) |

Do **not** treat CollectionTask “Release” or Result Clinical Authorization as Report Release.

---

## 7. Configuration audit

| Dependency | Gate |
| --- | --- |
| Report numbering format/sequence/scope | **CONFIGURATION_REQUIRED** (if Final/Release need business number) |
| Report templates / branding | **CONFIGURATION_REQUIRED** (if PDF in slice) |
| Signatory / release authority | **CONFIGURATION_REQUIRED** (for release-capable; PD-REP-15) |
| Retention duration | **CONFIGURATION_REQUIRED** (if enforcement required) |
| Patient publication policy | Out of L-REP-02 unless separately approved |
| Delivery channels | Out of slice |

LMS sequence infrastructure for Orders / Collection / Accession / Barcode is a **YELLOW** technical pattern for a *future* report number sequence — **not** a governed report-numbering policy.

---

## 8. Signatory / release authority audit

| Candidate | Classification |
| --- | --- |
| `lms.reports.finalize` / `lms.reports.release` permissions | **YELLOW** — catalogue exists; may be sufficient **only if** PO explicitly accepts permission+tenant+branch as governed authority |
| User/role Admin / Doctor | **RED** as substitute authority |
| Pathology LabReport completer | **RED** |
| Laboratory section masters | **ABSENT** / **CONFIGURATION_REQUIRED** |
| IP PreOpConsentDetail signatory | **RED** (unrelated domain) |
| Staff credential/qualification registry for reports | **ABSENT** |

**Missing dependency:** authoritative LMS Report signatory / release-authority configuration (effective dates, eligibility, delegation).

---

## 9. Numbering audit

| Item | Finding |
| --- | --- |
| Governed LMS Report Number config | **Absent** |
| Report sequence table | **Absent** |
| Draft GUID Report ID | **Sufficient for Draft-only** (L-REP-01) |
| Invented prefix/format | **Forbidden** (PD-REP-13) |

If Final/Release require a human Report Number → **CONFIGURATION_REQUIRED** before implementation.

---

## 10. Template / PDF audit

| Candidate | Classification |
| --- | --- |
| QuestPDF in AuthService (`PatientSummaryPdfService`, `ImagingExportService`) | **YELLOW** — renderer technology exists; not LMS Report template policy |
| AuthService `ReportService` TODO PDF | **RED** for LMS |
| Hard-coded LMS clinical layout | **RED** / forbidden without config |
| Browser print of snapshot UI | **YELLOW** interim for staff-only view — PO decision |

**Is PDF required for first Final/Release?** Not by L-REP-01 principles. Discovery recommends: **metadata Final/Release can be designed without PDF** if PO explicitly scopes document generation out; if PDF is in scope → **CONFIGURATION_REQUIRED**.

---

## 11. CanonicalDocument audit

| Use | Classification |
| --- | --- |
| LMS Report clinical SoT | **RED** |
| Downstream storage of generated bytes after Final/Release | **GREEN** principle (PD-REP-25); implementation later |
| Pathology `LabReportCanonicalDocumentService` attach | **YELLOW** pattern for association/hash; **RED** entity/domain reuse |

---

## 12. Permission audit

| Code | Seeded definition | Used by LMS Report APIs/UI | Role grants |
| --- | --- | --- | --- |
| `lms.reports.view` | Yes | Yes (view/list/detail) | Not by L-REP-01 design |
| `lms.reports.manage` | Yes | Yes (create Draft) | Not by design |
| `lms.reports.finalize` | Yes (catalogue-only description) | **No** | Not by design |
| `lms.reports.release` | Yes (catalogue-only) | **No** | Not by design |
| `lms.reports.download` | Yes (catalogue-only) | **No** | Not by design |
| `lms.reports.publish` | **Absent** (correct) | — | — |

Catalogue family is **sufficient as permission codes** for Product Decision Closure. Grants remain out of discovery; production assignment is an ops decision outside this audit.

Future audit allowlist will need `FINALIZE_REPORT` / `RELEASE_REPORT` (or equivalent) — **not present** today (only `CREATE_REPORT_DRAFT`, `APPEND_REPORT_VERSION`, `LmsReport`, `LmsReportVersion`).

---

## 13. Audit / idempotency / concurrency audit

| Concern | Pattern available | L-REP-02 need |
| --- | --- | --- |
| Platform `audit_log` SoT | Yes | Finalize/Release fail-closed writes |
| Idempotency table `lms_report_idempotency` | Yes | New operations: finalize + release |
| RowVersion on `LmsReport` | Yes | ExpectedRowVersion on mutations |
| Same key + same hash | Replay | Required |
| Same key + different hash | 409 `idempotency_conflict` | Required |
| Stale RowVersion | 409 `concurrency_conflict` | Required |

---

## 14. Result provenance audit

| Rule | Status |
| --- | --- |
| Exact ResultVersion on sources | Certified |
| Snapshot ≠ live projection | Certified |
| Finalize must not rewrite ResultVersion | Required / not implemented |
| Release must not change ResultStatus | Required |
| No upstream Testing/Verify/Authorize mutation | Required |
| CriticalResultEvent orthogonal | Certified boundary |
| Draft source claims after Final | **PRODUCT_DECISION_REQUIRED** — keep claims (block reuse) vs release on Final/Released (likely keep until Amendment) |

Additional provenance for Final/Released: recommend storing finalize/release actor+timestamp on Report (or Final/Released ReportVersion metadata) without mutating source snapshots.

---

## 15. Critical Results boundary

Preserve L-CRT-01. Do not block Finalize/Release on Critical acknowledgement unless PO separately requires it (**not** recommended for L-REP-02). Display of Critical flags on Released reports can be deferred to a later UX slice.

---

## 16. Notification boundary

| Item | Finding |
| --- | --- |
| NotificationHub | Existing platform capability |
| Release → Intent → Orchestration | Approved architecture; **not wired** for LMS Report |
| SMS/email/WhatsApp | Out of scope |
| Does Release require intent in L-REP-02? | **PRODUCT_DECISION_REQUIRED** — safe default: defer intent emission |

---

## 17. Patient 360 / Patient Portal boundary

| Item | Finding |
| --- | --- |
| Auto publication on Release | Forbidden (PD-REP-08) |
| Patient 360 as Report SoT | Forbidden (PD-REP-24) |
| Future consumer path | LMS Report → publication/discovery → P360/Portal |

Out of L-REP-02 implementation unless separately approved.

---

## 18. Pathology coexistence boundary

| Item | Classification |
| --- | --- |
| LabReport SoT for LMS | **RED** |
| Dual-write / migrate / redirect | **RED** / forbidden |
| Parallel Pathology completed + LMS Released | **YELLOW** coexistence — document only; no sync |
| Impact on Final/Release | None if boundaries preserved |

---

## 19. Amendment boundary

Final/Release can proceed **without** Amendments if PO accepts: Final/Released are immutable in place; corrections wait for a future amendment slice (PD-REP-17). If PO requires correction policy before Final → **PRODUCT_DECISION_REQUIRED** (would block).

---

## 20. Retention boundary

No governed LMS Report retention duration found. Draft retention not required for Final/Release transitions. Released document retention: **CONFIGURATION_REQUIRED** if enforcement included; otherwise defer.

---

## 21. Download / view / print

| Item | Finding |
| --- | --- |
| `lms.reports.download` | Catalogue only |
| Draft download | Not implemented; typically discouraged |
| Final/Released download | Requires PDF/bytes decision |
| Browser print of detail | Possible interim; not governed clinical PDF |
| CanonicalDocument prerequisite | Only if persisted bytes required |

Do not implement in discovery.

---

## 22. UI discovery (minimum for Final/Release — not built)

Current: worklist, Draft create, detail, version history, snapshot preview, honesty banners.

Minimum future UI concepts (audit only):

- Status badge Final / Released  
- Finalize action + confirm (permission-gated)  
- Release action + confirm (only when Final)  
- Finalize/Release conflict/error states (409)  
- Optional release metadata display  
- No fake “coming soon” Finalize/Release buttons required by current LMS honesty convention  

---

## 23. Multi-result semantics

Final/Release apply to the **Report aggregate**, not per ResultVersion. All constituent sources on the frozen ReportVersion share the Final/Released status. Cross-order composition remains forbidden. Draft source uniqueness (PD-REP-DRAFT-UNIQUE-01) remains unchanged.

**PRODUCT_DECISION_REQUIRED:** whether every source must still be live ClinicallyAuthorized at Finalize time.

---

## 24. Data integrity / race conditions (future transactional boundaries)

| Race | Required control |
| --- | --- |
| Two Finalize on same Draft | RowVersion + status check + idempotency; exactly one wins |
| Finalize vs Append/Draft edit | Append only Draft; Finalize expects RowVersion |
| Two Release on same Final | Same pattern |
| Audit failure | Revert status transition (fail-closed) |
| Numbering allocation failure | No Released/Final success if numbering in scope |
| Document generation failure | No Released success if document required |
| Signatory validation failure | Reject before status change |
| Permission change mid-flight | Server re-check permission on mutation |

Draft source claim unique index remains race-safe for Draft create; Final/Release must not weaken it.

---

## 25. Reuse matrix

| Asset | Classification | Notes |
| --- | --- | --- |
| LaboratoryApi Report aggregate | **GREEN** | Extend status transitions only after PO |
| Report idempotency / RowVersion / audit fail-closed | **GREEN** | |
| Tenant / branch validation | **GREEN** | |
| Permission catalogue finalize/release | **YELLOW** | Codes exist; grants/ops separate; authority model open |
| Draft source claims | **GREEN** | Preserve; decide post-Final claim lifetime |
| QuestPDF elsewhere | **YELLOW** | Tech only |
| CanonicalDocument storage | **YELLOW** storage / **RED** SoT | |
| Pathology LabReport `completed` | **RED** | |
| CollectionTask Release | **RED** | Different domain |
| IP consent signatory | **RED** | |
| Order/Accession/Barcode sequences | **YELLOW** pattern only | Not report numbering policy |
| NotificationHub | **YELLOW** | Downstream of Release |
| Patient 360 lab surfaces | **YELLOW** consumer later / **RED** SoT | |

---

## 26. Configuration gates (summary)

| Gate | Status |
| --- | --- |
| Signatory / release authority | **CONFIGURATION_REQUIRED** (or PO accepts permission-only — see decision package) |
| Report numbering | **CONFIGURATION_REQUIRED** if required in slice |
| Templates / branding / PDF layout | **CONFIGURATION_REQUIRED** if PDF in slice |
| Retention enforcement | **CONFIGURATION_REQUIRED** if in slice |

---

## 27. Product decisions still required

See companion: `enterprise-lms-report-final-release-decision-package.md`.

Critical opens:

1. Finalize freeze mechanics (in-place CurrentVersion vs new Final ReportVersion)  
2. Live re-validation of ClinicallyAuthorized at Finalize  
3. Authority model (permission-only vs signatory config)  
4. Same-person / multi-signatory rules  
5. Whether L-REP-02 includes PDF/CanonicalDocument attach  
6. Whether business Report Number is required at Final and/or Release  
7. Release metadata shape; whether Release creates a ReportVersion  
8. Notification intent in-slice vs deferred  
9. Slice split (02A Finalize / 02B Release) vs combined  
10. Draft source claim lifetime after Final/Released  

---

## 28. Architecture decisions still required

Most AD-REP-* from L-REP-01 remain binding. Additional architecture choices for L-REP-02:

| ID (candidate) | Topic |
| --- | --- |
| AD-REP-02A | Finalize is status+metadata mutation on LaboratoryApi Report (no ResultStatus) |
| AD-REP-02B | Release is status+metadata mutation after Final; document optional/deferred |
| AD-REP-02C | Audit action names + allowlist extension when implementing |
| AD-REP-02D | Claim lifetime after Final (recommend retain until Amendment) |

These are **not approved** by this discovery.

---

## 29. Recommended bounded implementation slices

**Recommended (pending PO):**

1. **L-REP-02A — Finalize (metadata)**  
   Draft → Final; freeze current ReportVersion; block Append; audit + idempotency + RowVersion; UI Finalize; **no** PDF, numbering, publication, notification.  
   **Blocked until** PO closes freeze mechanics + authority model for Finalize.

2. **L-REP-02B — Release (metadata)**  
   Final → Released; release metadata; audit + idempotency; UI Release; **no** patient publication; notification intent optional/deferred.  
   **Blocked until** PD-REP-15 authority resolved (config or explicit permission-only approval).

3. **L-REP-02C — Document/PDF** (later)  
   Templates/branding config + generation + CanonicalDocument attach + download.

4. **L-REP-02D — Business Report Number** (later or with 02B if required)  
   After numbering configuration exists.

Do **not** combine PDF + numbering + Finalize + Release + notification in one first slice unless PO explicitly forces a larger bound and all CONFIGURATION_REQUIRED gates are green.

---

## 30. Explicit out-of-scope (discovery and recommended L-REP-02)

- Patient Portal / Patient 360 publication  
- SMS / email / WhatsApp / escalation  
- Amendments / supersession / void  
- ResultStatus Final/Released/Published  
- L-AUTH / L-VER / L-TST / L-CRT / Collection / Specimen / Orders changes  
- Pathology migration / dual-write  
- CanonicalDocument as Report SoT  
- Analytics / billing  
- Production role grants / `lms.reports.publish`  
- Invented numbering, templates, signatory hierarchies, retention durations  

---

## 31. Final gate status

```text
DISCOVERY_COMPLETE_READY_FOR_PRODUCT_OWNER_DECISION
```

| Implementation readiness | Status |
| --- | --- |
| Finalization now | **Blocked** — decisions + authority clarity |
| Release now | **Blocked** — CONFIGURATION_REQUIRED / decisions |
| Combined Final+Release+PDF now | **Blocked** |

**Confirmation:** This task produced documentation only. **No implementation occurred.**

---

## 32. Files inspected (non-exhaustive)

| Area | Paths |
| --- | --- |
| Decisions | `enterprise-lms-reporting-decision-closure.md`, `decision-package.md`, `discovery-audit.md`, `implementation*.md`, uniqueness + branch docs; `laboratory-management-product-definition-v3.md` |
| Domain | `LmsReport*.cs`, `LmsReportDraftSourceClaim.cs`, `ReportEnums.cs`, `ResultEnums.cs` |
| Services/API | `ReportService.cs`, `ReportFunctions.cs`, `ReportDtos.cs`, `LaboratoryAuthz.cs` |
| Auth | `EnterpriseLmsReportsPermissionCatalog.cs`, `PermissionSeeder.cs` (reports seed), `InternalAuditController.cs` allowlist |
| FE | `ReportsWorkbench.tsx`, `ReportDetailView.tsx`, `lms-reports.api.ts`, `lms-permissions.ts` |
| Pathology/PDF | `LabReport.cs`, `LabReportsController.cs`, `LabReportCanonicalDocumentService.cs`, QuestPDF usages |
| Sequences | Order/Collection/Accession/Barcode number sequence entities (pattern only) |
