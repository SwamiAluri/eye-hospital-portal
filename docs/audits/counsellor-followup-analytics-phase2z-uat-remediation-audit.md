# Phase 2Z — UAT vs Implementation Remediation Audit

| Field | Value |
|-------|--------|
| **Date** | 2026-09-12 |
| **Basis** | Manual browser UAT is source of truth; code/tests are supporting evidence only |
| **Scope** | PD13 / PD14 / PD15 / counsellor filter / Analytics branch auth / CSV / print |
| **Status** | **REMEDIATION IMPLEMENTED — awaiting manual UAT** (not certified) |

### Remediation applied (2026-09-15) — F-01…F-05

| ID | Fix |
|----|-----|
| F-01 | `GET /api/Counseling/counselors` (`counseling_sessions.read`); FE maps firstName/lastName; API failure surfaces error (no silent empty) |
| F-02 | Agreed/Conversion drill: `patientAgreedToSurgery=true` + `pendingDecision=false` |
| F-03 | Funnel: Agreed/Declined/Pending % vs Eligible; Exception/Other counts only |
| F-04 | `GET /Counseling/sessions` (+ patient sessions) always uses `FollowupBranchAccessService`; unauthorized → 403; omitted → authorized scope |
| F-05 | Compact KPI strip: Total, Agreed, Declined, Pending, Exception, Other, Eligible, Conversion, Decision + Avg Days + Callbacks |

**Not certified.** Manual UAT required before Phase 2Z PASS.

This audit originally did **not** implement fixes. It does not rewrite historical Phase2V/2W conclusions.

---

## 1. Executive status

Phase 2Z has substantial **backend** and **partial frontend** work checked in, and automated unit tests pass for partition/drill-down URL builders. Manual UAT nonetheless shows that **most end-to-end Phase 2Z behaviors are incomplete, mismatched, or non-functional** for a counsellor/admin operating the Analytics page.

Primary themes:

1. **Counsellor picker does not load real counsellors** (API contract / permission / mapping mismatch).
2. **PD13 Agreed (and Conversion) drill-downs do not match the mutually exclusive Agreed partition** (include Pending+Agreed).
3. **Funnel percentages still treat Exception/Other as “eligible outcome” percentages**, contradicting PD13.
4. **Session-list drill-down destination exists**, but **session list is not branch-authorized** like Analytics — security gap on drill-down.
5. **Partition KPIs are weak in the Summary strip** (Total + Conversion only; Decision/Exception/Other mostly funnel-adjacent).
6. Earlier **AuthService-down** failures are **ENVIRONMENT**; once Auth is up, the defects above remain product/integration defects.

**PHASE 2Z STATUS: UAT BLOCKED**

---

## 2. UAT matrix

| ID | Requirement | Classification | Evidence summary |
|----|-------------|----------------|------------------|
| A1 | Mutually exclusive backend partition | **PASS** (backend) | `CounselingAnalyticsOutcomeClassifier` + summary counts |
| A2 | Eligible denominator Conversion/Decision | **PASS** (backend) | `EligibleOutcomeSessions` used for rates |
| A3 | Exception/Other in Total, out of rates | **PASS** (backend rates) / **FAIL — frontend integration** (funnel % for Exception/Other vs eligible) | Funnel charts Exception/Other as % of Eligible |
| A4 | UI shows Exception / Other / Eligible honestly | **FAIL — frontend integration defect** | Tiny conditional footnote; no Decision KPI; Exception% misleading |
| A5 | Funnel mutually exclusive presentation | **CONDITIONAL / FAIL — frontend** | Stages exclusive in counts if API correct; % rules wrong for Exception/Other |
| A6 | Agreed drill = Agreed partition only | **FAIL — frontend integration defect** | `patientAgreedToSurgery=true` **without** `pendingDecision=false` |
| A7 | Conversion drill = Agreed partition | **FAIL — frontend integration defect** | Same as Agreed href |
| B1 | Aging PendingDecision-only | **PASS** (backend + UI title) | Aging API + “PendingDecision Aging” |
| B2 | Aging period 30/90/180/365, default 365 | **PASS** (UI + hook) | `AGING_ANALYTICS_PERIODS`; default state 365 |
| B3 | Aging independent of Summary 7/14/30 | **PASS** | Separate `agingPeriod` state |
| B4 | Buckets 0–3 / 4–7 / 8–14 / 15+ | **PASS** | Config + API |
| B5 | No Critical/High/Medium/Normal labels | **PASS** (text) / **ACCEPTABLE GAP** (colour urgency chrome remains) | Labels removed; red/orange/amber pills remain |
| B6 | Aging bucket → sessions + pending | **PASS** (URL builder) / **CONDITIONAL** (list auth/filter fidelity) | `List` button → sessions href |
| B7 | Aging never → Active Center | **PASS** | Pending list ≠ surgery-followup; workload link separate |
| C1 | Total → sessions list | **PASS** (wiring) / **CONDITIONAL** (list auth) | KPI click |
| C2 | Declined → agreed=false + pending=false | **PASS** (URL) | Matches Declined partition (classic) |
| C3 | Pending → pending=true | **PASS** (URL) | |
| C4 | Surgery → recommendedSurgery | **PASS** (URL) | |
| C5 | Follow-up workload → Center | **PASS** | Explicit link |
| C6 | Sessions list applies query params | **PASS** (page + API client) | `/sessions` reads params |
| D1 | Counsellor selector visible | **PASS** (control present) | Select “All counselors” |
| D2 | Counsellor options load | **FAIL — missing / frontend–API defect** | `GET /users` ignores `role`; needs `user.view`; labels wrong |
| D3 | counselorId propagates Summary/Trends/Aging/CSV/drill | **PASS** (code path when id set) | Filters include counselorId |
| D4 | Clear counsellor restores broader scope | **PASS** (code) | `null` omits param |
| E1 | Analytics unauthorized branch → 403 | **PASS** (backend) | Controller + `FollowupBranchAccessService` |
| E2 | Omitted branch → authorized set only | **PASS** (backend Analytics) | |
| E3 | Drill-down session list branch security | **FAIL — authorization defect** | `GET /sessions` trusts client `branchId`; no FollowupBranchAccess |
| F1 | CSV PD13 + window + branch + counsellor | **PASS** (export builder) | |
| F2 | CSV matches displayed Summary | **PASS** when Summary loaded | Uses same `data` object |
| G1 | Print no Due/Overdue/SLA/urgency labels | **PASS** (labels) / **ACCEPTABLE GAP** | No dedicated print CSS; aging colours still print |
| ENV | AuthService on 5073 | **ENVIRONMENT ISSUE** (when down) | Prior UAT blocker |

---

## 3. Failures with reproduction

### F-01 — Counsellor picker empty / non-functional

| | |
|--|--|
| **Screen** | `/dashboard/counselor/analytics` toolbar |
| **Action** | Open counsellor select |
| **Expected** | List of counsellors; selecting one filters Analytics |
| **Actual** | Often only “All counselors”; no usable options |
| **FE** | `CounselorAnalyticsTab.useCounselorOptions` → `GET /users?role=Counselor` |
| **BE** | `UsersController.GetAll` — **ignores `role`**; requires `user.view`; returns `firstName`/`lastName` not `name` |
| **Root cause** | Wrong data source contract; soft-fail hides errors |
| **Phase2Z?** | **Yes** (picker introduced in 2Z) |
| **Minimal fix** | Use an existing counsellor/user listing that (a) caller can access with counselling permissions, (b) filters counselors server-side, (c) maps display names; do not invent new IAM roles |

### F-02 — Agreed / Conversion drill population ≠ PD13 Agreed

| | |
|--|--|
| **Screen** | Analytics KPI Conversion / Funnel Agreed |
| **Action** | Click Agreed or Conversion |
| **Expected** | Sessions in **Agreed partition only** (Agreed && !Pending) |
| **Actual** | `patientAgreedToSurgery=true` only → includes **Pending+Agreed** (classified Pending in PD13) |
| **FE** | `analytics-drilldown.ts` `buildAgreedSessionsHref` / `buildConversionSessionsHref` |
| **BE** | Session list filter is boolean AND, not PD13 classifier |
| **Root cause** | Drill filter not aligned to classifier precedence |
| **Phase2Z?** | **Yes** |
| **Minimal fix** | Add `pendingDecision=false` (and keep `patientAgreedToSurgery=true`) for Agreed/Conversion drills; add FE test asserting this |

### F-03 — Funnel percentages for Exception / Other / Pending misuse Eligible

| | |
|--|--|
| **Screen** | Decision Funnel |
| **Action** | Read % under Exception / Other / Pending |
| **Expected** | Exception & Other **excluded** from normal outcome funnel percentages; Conversion/Decision use Eligible; outcome % should not present Exception/Other as eligible-outcome shares |
| **Actual** | All outcome stages (including Exception & Other) compute `count/eligible` |
| **FE** | `ConversionFunnelChart.tsx` |
| **Root cause** | Incorrect % denominator application in UI |
| **Phase2Z?** | **Yes** |
| **Minimal fix** | For Agreed/Declined/Pending: % of Eligible (or of Total for Pending if product prefers — **do not invent**; safest: Agreed/Declined vs Eligible, Pending vs Total or Eligible as count-only, Exception/Other as **counts only / % of Total** with explicit label). Require product-consistent rule: **exclude Exception/Other from “outcome %” row** |

### F-04 — Drill-down session list bypasses Analytics branch authorization

| | |
|--|--|
| **Screen** | Any drill → `/dashboard/counsellors-desk/sessions` |
| **Action** | Open list with/without `branchId` |
| **Expected** | Same authorized branch scope as Analytics; unauthorized branch rejected |
| **Actual** | `GET /Counseling/sessions` filters optional `branchId` with **no** `FollowupBranchAccessService` |
| **FE** | `sessions/page.tsx` |
| **BE** | `CounselingController.GetAllSessions` / `GetAllSessionsAsync` |
| **Root cause** | PD15 destination lacks PD16-style enforcement |
| **Phase2Z?** | **Yes** (gap introduced by choosing sessions list without auth parity) |
| **Minimal fix** | Apply same branch resolution to session list used for Analytics drills (403 unauthorized; omitted → authorized set). Do not broaden permissions |

### F-05 — Summary strip does not surface Decision / Exception / Other as first-class WHAT metrics

| | |
|--|--|
| **Screen** | Analytics KPI strip |
| **Action** | Read WHAT happened |
| **Expected** | Clear Total, Agreed, Declined, Pending, Exception, Other, Eligible, Conversion, Decision |
| **Actual** | Total, Conversion (+ eligible in sub), Avg Days, Callbacks; Decision under funnel; Exception/Other footnote if &gt;0 |
| **FE** | `CounselorAnalyticsTab` `kpiItems` |
| **Root cause** | Incomplete operational honesty presentation |
| **Phase2Z?** | **Yes** (partial) |
| **Minimal fix** | Compact KPI/stat line for partition counts + Decision % without redesigning page |

### F-06 — Session list DTO/UI field fidelity (risk)

| | |
|--|--|
| **Screen** | Sessions list Decision column |
| **Action** | View Agreed/Pending chips |
| **Expected** | Accurate `pendingDecision` / `patientAgreedToSurgery` from API |
| **Actual** | Relies on DTO fields; FE `CounselingSession` type historically used `agreedToSurgery` alias — list page checks both |
| **Classification** | **CONDITIONAL / ACCEPTABLE GAP** if DTO populated; verify in UAT once Auth up |
| **Minimal fix** | Confirm DTO mapping in live Network response; align types if missing |

### F-07 — Exception drill unavailable

| | |
|--|--|
| **Classification** | **ACCEPTABLE GAP** (documented in 2Z impl notes) |
| **Note** | No session-list filter for intention-based Exception without classifier endpoint |

### ENV-01 — AuthService not on 5073

| | |
|--|--|
| **Classification** | **ENVIRONMENT ISSUE** |
| **Note** | Causes full-page “Failed to load analytics”; not a PD13 logic defect |

---

## 4. Root cause themes

1. **Incomplete FE integration** of PD13 into drill URLs and funnel %.
2. **Counsellor filter wired to the wrong / incomplete users API.**
3. **Authorization not extended** to the new drill-down list surface.
4. **Presentation under-delivers** WHAT metrics vs approved operational questions.
5. **Environment** can still block all UAT when Auth is down.

---

## 5. Exact affected files

| Area | Files |
|------|--------|
| Analytics UI | `CounselorAnalyticsTab.tsx`, `ConversionFunnelChart.tsx`, `FollowupAgingTable.tsx` |
| Drill-down | `analytics-drilldown.ts`, `analytics-drilldown.test.ts` |
| Sessions list | `app/dashboard/counsellors-desk/sessions/page.tsx`, `counseling-sessions.api.ts` |
| Hooks/export | `use-counselor-analytics.ts`, `counselor-analytics-export.ts` |
| Backend Analytics | `CounselingAnalyticsOutcomeClassifier.cs`, `CounselingAnalyticsService.cs`, `CounselingController` analytics actions |
| Backend sessions | `CounselingWorkflowService.GetAllSessionsAsync`, `SessionFilters` |
| Users/counsellor | `UsersController.GetAll` (no role filter) |
| Auth branch | `FollowupBranchAccessService` (Analytics only today) |

---

## 6. Recommended fix order (do not implement yet)

1. **F-02** Align Agreed/Conversion drills with PD13 (`pendingDecision=false` + agreed true).  
2. **F-03** Fix funnel % rules for Exception/Other (and clarify Pending %).  
3. **F-01** Counsellor picker: real authorized data source + name mapping.  
4. **F-04** Branch-authorize session list for Analytics drill (reuse FollowupBranchAccess).  
5. **F-05** Compact partition + Decision visibility on Analytics.  
6. Re-run manual UAT matrix A–G with AuthService up.

Do **not** weaken branch auth, invent DueDate/Priority, or route Pending to Follow-up Center.

---

## 7. Regression risk

| Fix | Risk |
|-----|------|
| Agreed drill `pendingDecision=false` | Low; corrects over-inclusion |
| Funnel % change | Medium UX; update FE tests |
| Counsellor picker API | Medium; permission/`user.view` vs counselling-only users |
| Session list branch auth | **High** if too broad — may break non-Analytics session callers; scope carefully (Analytics drill query flag **or** always enforce for GetAllSessions — product decision) |

**ENGINEERING DESIGN DECISION REQUIRED** before F-04: enforce branch auth on **all** `GET /sessions`, or only when an Analytics drill flag/query is present? Prefer **always enforce** for consistency with PD16, but that can change legacy session-list callers — must be approved.

---

## 8. Tests required after fix

- Drill-down: Agreed/Conversion URLs include `pendingDecision=false`.
- Funnel: Exception/Other not shown as eligible-outcome %.
- Counsellor picker: non-empty options when API returns counselors (mock).
- Backend: unauthorized branch on session list (if F-04 approved) → 403.
- Regression: Phase2X/2Y/2Z partition unit tests remain green.
- Manual UAT checklist in §9.

---

## 9. Manual UAT required after fix

1. Auth on 5073; Analytics loads.  
2. Funnel counts sum to Total; Conversion/Decision match Eligible math.  
3. Counsellor select filters Summary/Trends/Aging/CSV/drills.  
4. Agreed click list count ≈ Agreed KPI (no pending+agreed extras).  
5. Pending/Aging List never land on Follow-up Center Active.  
6. Unauthorized branch → 403 on Analytics **and** drill list (if approved).  
7. CSV matches on-screen Summary.  
8. Print: no Due/Overdue/SLA/Critical-High-Medium-Normal text.

---

## 10. Explicitly NOT implemented / incomplete

- Exception / Other **drill-down** to a classifier-accurate list  
- Full Summary KPI strip for all PD13 counts + Decision %  
- Counsellor picker backed by a correct counselling-safe API  
- Branch authorization parity on Counselling Sessions list  
- Dedicated print stylesheet  
- Product rule for Pending % denominator beyond Eligible misuse  
- Phase2AA / DueDate / Priority / Next Action / Schedule Visit / Reminder / Callback redesign / FollowUps table  

---

## PHASE 2Z STATUS

# **UAT BLOCKED**

Stop. No production remediation until this audit is approved and F-04 branch-auth scope decision is confirmed.
