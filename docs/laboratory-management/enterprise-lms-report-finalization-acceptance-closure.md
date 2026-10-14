# L-REP-02A — Report Finalization (Metadata Only)  
# Acceptance Closure

**Date:** 2026-10-12  
**Mode:** DOCUMENTATION / FORMAL ACCEPTANCE CLOSURE ONLY — no application code, schema, API, UI, permission, role-grant, ResultStatus, Release, PDF, numbering, download, publication, NotificationHub, Amendments, Pathology, CanonicalDocument, Orders/Collection/Specimen/Receiving/Barcode, Testing, Verification, Clinical Authorization, or Critical Results changes  

**Authoritative references:**

| Document | Role |
|---|---|
| [enterprise-lms-report-finalize-decision-closure.md](./enterprise-lms-report-finalize-decision-closure.md) | Product Decision Closure (`PRODUCT_DECISIONS_CLOSED_L_REP_02A_AUTHORIZED`) |
| [enterprise-lms-report-finalization-implementation.md](./enterprise-lms-report-finalization-implementation.md) | Implementation report |
| [enterprise-lms-report-finalization-implementation-audit.md](./enterprise-lms-report-finalization-implementation-audit.md) | Implementation audit |
| [enterprise-lms-report-finalization-pre-uat-verification.md](./enterprise-lms-report-finalization-pre-uat-verification.md) | PRE-UAT automated evidence |
| [enterprise-lms-report-finalization-audit-runtime-blocker.md](./enterprise-lms-report-finalization-audit-runtime-blocker.md) | Runtime audit blocker + operational resolution |
| Upstream | L-REP-01 Report Foundation + Draft source uniqueness (certified) |

```text
PRODUCT_DECISIONS_CLOSED_L_REP_02A_AUTHORIZED
  → L-REP-02A implemented + PRE-UAT automated evidence
  → AuthService stale-process audit blocker resolved operationally
  → Manual UAT PASSED (UI evidence below)
  ↓
L-REP-02A ACCEPTED  (THIS DOCUMENT)
  ↓
Next gate (NOT started): L-REP-02B — Release (requires separate Product Decision / Decision Closure)
```

---

## 1. Acceptance status

# ACCEPTED_L_REP_02A

| Gate | Status |
|---|---|
| Product Decision Closure | **`PRODUCT_DECISIONS_CLOSED_L_REP_02A_AUTHORIZED`** |
| Implementation complete | **YES** (Draft → Final metadata only) |
| PRE-UAT automated | **YES** (LaboratoryApi.Tests 291; Auth 3; LMS FE 92; Reports UI 9) |
| Runtime audit blocker | **RESOLVED** (AuthService rebuild/restart; `FINALIZE_REPORT` HTTP 200) |
| Manual UAT | **`MANUAL_UAT_PASSED`** |
| Formal acceptance | **`ACCEPTED_L_REP_02A`** |

Acceptance is based on Product Decision stamps, implementation/PRE-UAT documentation, runtime operational resolution, repository verification against those stamps, **and** Manual UAT exercised through the UI (evidence in §8). Automated tests alone do not constitute acceptance.

---

## 2. Product Decision Closure reference

| Stamp | Source |
|---|---|
| `PRODUCT_DECISIONS_CLOSED_L_REP_02A_AUTHORIZED` | [enterprise-lms-report-finalize-decision-closure.md](./enterprise-lms-report-finalize-decision-closure.md) |

Scope authorized: **Draft → Final metadata only.**

---

## 3. L-REP-02A scope

| In scope | Out of scope (explicit) |
|---|---|
| `Report.Status` Draft → Final | Release / `Released` status transitions |
| Freeze current `ReportVersion` (no new version) | PDF / document bytes / download |
| `FinalizedAtUtc` / `FinalizedByUserId` | Business Report number |
| Append/edit blocked after Final | Patient publication / patient-visible |
| Source claims retained | NotificationHub delivery |
| `POST …/finalize` + `lms.reports.finalize` | Amendments |
| `finalize_report` idempotency + RowVersion | Pathology changes |
| `FINALIZE_REPORT` platform audit (fail-closed) | CanonicalDocument write path |
| Finalization confirmation UI + Final metadata | Production role grants |

---

## 4. Finalization semantics (certified)

1. Report.Status transitions Draft → Final.  
2. Finalization freezes the CURRENT ReportVersion.  
3. Finalization does NOT create a new ReportVersion.  
4. CurrentVersionNumber remains the frozen version.  
5. Append/edit is blocked after Final.  
6. Source claims remain retained after Final.  
7. The claimed ResultVersion cannot become a new Draft source.  
8. Finalization does not change ResultStatus.  
9. Finalization does not release the Report.  
10. Finalization does not make the Report patient-visible.  
11. Finalization does not generate PDF/document bytes.  
12. Finalization does not assign a business Report number.  
13. Finalization does not emit NotificationHub delivery.  
14. Amendments remain future scope.  
15. Pathology remains unchanged.  
16. CanonicalDocument remains downstream document storage only and is unchanged.  
17. Audit is platform `audit_log` and fail-closed.  
18. Finalization requires `lms.reports.finalize` plus tenant/operating-branch authorization.  
19. Idempotency operation is `finalize_report`.  
20. Optimistic concurrency uses RowVersion / 409.  
21. No production role grants in this closure.

---

## 5. Implementation evidence

| Item | Evidence |
|---|---|
| Migration | `20261012190000_AddLmsReportFinalizationMetadata` (`finalized_at_utc`, `finalized_by_user_id`) |
| API | `POST /api/lms/reports/{reportId}/finalize` |
| Permission | `lms.reports.finalize` (catalogue + endpoint enforcement; **no role grants**) |
| Idempotency | `finalize_report` |
| Audit action / resource | `FINALIZE_REPORT` / `LmsReport` |
| Fail-closed | Audit failure → Draft retained; no Finalized* persisted |
| UI | Finalize confirmation; Final metadata; honesty copy (no Release/PDF/patient-visible) |
| Primary report | [enterprise-lms-report-finalization-implementation.md](./enterprise-lms-report-finalization-implementation.md) |

---

## 6. Runtime audit blocker and operational resolution

| Item | Detail |
|---|---|
| Symptom | Confirm Finalize → `"Audit unavailable. Report finalization was not completed."` → Draft retained |
| Root cause | **Stale AuthService process** without `FINALIZE_REPORT` in loaded allowlist (HTTP 400 `action_not_allowed`) |
| Classification | Runtime / process state — **not** application business-logic defect |
| Correction | Rebuild + restart AuthService only |
| Post-restart probe | `FINALIZE_REPORT` + `LmsReport` → **HTTP 200** `status=logged` `outcome=success` |
| Fail-closed preserved | Yes — no audit bypass |
| Doc | [enterprise-lms-report-finalization-audit-runtime-blocker.md](./enterprise-lms-report-finalization-audit-runtime-blocker.md) |
| Status after correction | `L_REP_02A_AUDIT_RUNTIME_BLOCKER_RESOLVED_READY_FOR_MANUAL_UAT` |

---

## 7. Automated test evidence

Inspected from PRE-UAT verification (no application code changed in this acceptance task):

| Suite | Result |
|---|---|
| Full `LaboratoryApi.Tests` | **291 passed** (includes Finalize, append block, claims, ResultStatus isolation, audit fail-closed, idempotency, RowVersion) |
| PostgreSQL concurrent Finalize | **Passed** (`PostgreSQL_Concurrent_Finalize_Same_Draft_Succeeds_Exactly_Once`) |
| Auth allowlist + reports permission | **3 passed** (`FINALIZE_REPORT` allowlisted; `lms.reports.finalize` catalogue) |
| LMS FE (`src/app/dashboard/lms` + `src/lib/lms`) | **92 passed** |
| Reports UI | **9 passed** (Finalize confirmation; no Release/PDF download actions) |

Key Finalize unit coverage (LaboratoryApi):

- `Finalize_Draft_To_Final_Preserves_Version_And_Blocks_Append`
- `Finalize_Idempotency_Replay_And_Conflict_And_Stale_RowVersion`
- `Finalize_Audit_Failure_Fails_Closed_And_Claims_Remain`
- `Finalize_Keeps_Claim_Blocking_New_Draft`

---

## 8. Manual UAT evidence (`MANUAL_UAT_PASSED`)

Manual UAT was exercised against `/dashboard/lms/reports` after AuthService restart.

### 8.1 Successful finalization path

- Existing Draft Report opened.  
- **Finalize Report** action visible.  
- Confirmation displayed (freeze version; block edits/append; does not Release; not patient-visible).  
- **Confirm Finalize** succeeded.  
- Status = **Final**.  
- Current version remains **1**.  
- `FinalizedAtUtc` populated.  
- `FinalizedByUserId` populated (user id display — approved for this slice; no separate display-name decision).  
- UI states content is frozen; append/edit unavailable; Release not implemented.  
- ReportVersion history: **Version 1 only**.  
- Snapshot unchanged (source Result ClinicallyAuthorized; value `67.9 ml`; comment `test`).

### 8.2 Final manual checks (A–I)

| Check | Status | Evidence basis |
|---|---|---|
| A. Worklist shows Final | **Pass** | Worklist Status column binds `row.status`; Report persisted as Final (Manual UAT detail); list API returns same status field |
| B. Finalize not exposed on Final | **Pass** | Final detail UI shows frozen banner; Finalize panel gated on `status === 'Draft'` only |
| C. Append/Edit not exposed | **Pass** | Manual UAT frozen/unavailable messaging; BE `invalid_state` on Append after Final |
| D. No Release action | **Pass** | Manual UAT + FE honesty copy + no Release API/UI |
| E. No PDF/download action | **Pass** | Manual UAT honesty copy + FE tests assert no `downloadPdf` / Release Report |
| F. Source ResultVersion remains claimed / not eligible for new Draft | **Pass** | `Finalize_Keeps_Claim_Blocking_New_Draft` + L-REP-01 uniqueness preserved |
| G. ResultStatus remains ClinicallyAuthorized | **Pass** | Manual UAT snapshot + unit test |
| H. No notification emitted | **Pass** | Finalize path has no NotificationHub side effect (implementation + scope) |
| I. No patient publication | **Pass** | Finalize path has no publication side effect; honesty copy confirms not patient-visible |

---

## 9. Finalization UI evidence

| Observation | Evidence |
|---|---|
| Status Final | Detail screenshot / Manual UAT |
| Current version 1 | Manual UAT |
| Finalized by / at populated | Manual UAT (`report-finalized-by` / `report-finalized-at`) |
| Frozen-content message | Manual UAT (`report-final-frozen`) |
| Version 1 only | Manual UAT version history |
| Snapshot ClinicallyAuthorized + original value/comment | Manual UAT |

---

## 10. Source-claim uniqueness evidence

| Item | Status |
|---|---|
| Claims retained after successful Final | Unit-tested |
| Claimed ResultVersion blocked from new Draft | `Finalize_Keeps_Claim_Blocking_New_Draft` (`report_source_already_in_draft`) |
| L-REP-01 draft-source uniqueness baseline | Preserved (not weakened) |

---

## 11. Regression evidence

Full `LaboratoryApi.Tests` **291 passed** at PRE-UAT includes certified LMS slices in the LaboratoryApi test surface (Orders, Collection, Specimen, Receiving, Barcode, Testing, Verification, Clinical Authorization, Critical Results, Reporting L-REP-01 + L-REP-02A Finalize).  

No modifications were made to Orders / Collection / Specimen / Receiving / Barcode / Testing / Verification / Clinical Authorization / Critical Results / Pathology modules in this acceptance task.

FE LMS regression **92 passed**; Reports UI **9 passed**.

---

## 12. Security / authorization evidence

| Control | Status |
|---|---|
| `lms.reports.finalize` enforced on Finalize endpoint | Yes |
| Tenant isolation on Report operations | Yes (service + JWT tenant) |
| Operating branch authorization (`ValidateUserBranch` + Report branch match) | Yes |
| Catalogue seeding of finalize permission | Yes |
| Production role grants for finalize | **None** (PD-REP-21 preserved) |

---

## 13. Audit fail-closed evidence

| Path | Evidence |
|---|---|
| Success | Runtime probe HTTP 200 after Auth restart; Manual UAT Finalize succeeded |
| Failure | Unit: `Finalize_Audit_Failure_Fails_Closed_And_Claims_Remain`; Manual UAT earlier saw honest `"Audit unavailable…"` with Draft retained |
| No bypass | Operational restart only; no optional-audit / second store |

---

## 14. Explicit certified boundaries

| Boundary | Certified |
|---|---|
| Draft → Final metadata only | Yes |
| CurrentVersionNumber freeze; no new ReportVersion | Yes |
| Append blocked after Final | Yes |
| Source claims retained | Yes |
| ResultStatus unchanged (ClinicallyAuthorized) | Yes |
| Platform audit fail-closed | Yes |
| L-REP-01 foundation preserved | Yes |

---

## 15. Explicit out-of-scope items

- L-REP-02B Release  
- PDF / CanonicalDocument attachment / download  
- Business Report numbering  
- Patient publication / patient portal visibility  
- NotificationHub delivery for Finalize  
- Amendments  
- Pathology bridge  
- Production role grants  

---

## 16. No-role-grants statement

**No production role grants** were added for `lms.reports.finalize` (or any other report permission) as part of L-REP-02A implementation or this acceptance closure. Permission remains catalogue + endpoint enforcement only.

---

## 17. No-Release statement

**Release is not implemented.** There is no Release API, Release UI action, Release audit action allowlist entry for this slice, and no patient-visible publication path from Finalize. L-REP-02B was **not** started.

---

## 18. Acceptance decision

All required Product Decision, implementation, PRE-UAT automated, runtime operational, Manual UAT, security, audit fail-closed, source-claim, and boundary evidence for L-REP-02A is satisfied.

```text
ACCEPTED_L_REP_02A
```

**STOP.** Do not implement L-REP-02B Release, PDF, numbering, download, publication, notifications, or Amendments without a separate Product Decision / Decision Closure gate.
