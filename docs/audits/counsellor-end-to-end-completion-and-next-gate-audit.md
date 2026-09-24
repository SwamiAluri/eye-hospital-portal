# HOSPITAL PORTAL — Counsellor End-to-End Completion and Next-Gate Audit

| Field | Value |
|-------|--------|
| **Date** | 2026-09-24 |
| **Document type** | **GOVERNANCE / AUDIT ONLY** |
| **Mode** | Reconcile original Counsellor end-to-end scope vs current implementation, Product Decisions, Implementation Authorizations, automated tests, Manual UAT, acceptance/closure, deferred, and out-of-scope |
| **Production code / API / DB / permissions / routes / UI / tests / business rules modified** | **NO** |
| **Product Decision created** | **NO** |
| **Implementation Authorization created** | **NO** |
| **Next gate started** | **NO** |
| **Phase 3I reopened** | **NO** |
| **Slice 14 / Phase 3J created** | **NO** |
| **C-01 reopened** | **NO** |

---

## 1. Executive Summary

The Counsellor module’s **operational and counselling journey is largely implemented** against AuthService `api/Counseling` and the existing Hospital Portal design system. Certified ownership (Phase 3I / Slices 1–13), C-01 Waiting List redesign, Slice 11 Analytics My Work (reporting-only), RESP2 OT Preparation responsibility, and Package LA Finalize modal lifecycle are **formally accepted/closed**.

What blocks calling the Counsellor module **product-complete** is **not** a missing Wave 2 redesign or a new ownership slice. It is **residual Manual UAT + formal acceptance** for already-implemented Wave 2 (Quote → Decision → Insurance → Notes → Finish) and adjacent residual areas A–M, per Portfolio Decision 1 (2026-09-22) and the residual Manual UAT plan.

**Overall Counsellor status:** **IMPLEMENTATION COMPLETE / UAT PENDING** (module-level; not uniformly ACCEPTED / CLOSED).

**Exactly one next gate (Counsellor E2E):** **Execute Stage 1 Manual UAT for Wave 2 Quote → Finish (residual areas A–E)** using `docs/audits/counsellor-residual-acceptance-manual-uat-plan.md`. Do not implement.

### Evidence conflict (STOP note — OT Prep Package B / C)

This audit brief assumed OT Preparation **Package B (Print)** and **Package C (PD-OTPREP-10)** were already accepted/closed. Repository acceptance artifacts do **not** support that:

| Package | Repo status (authoritative) |
|---------|-----------------------------|
| RESP2 | **ACCEPTED / CLOSED** (2026-09-24) |
| Package LA | **ACCEPTED / CLOSED** (2026-09-24) |
| Package B — Dedicated OT Preparation Print | **IMPLEMENTATION COMPLETE**; Manual UAT **NOT EXECUTED**; Acceptance **NOT RECORDED** |
| Package C — PD-OTPREP-10 | **IMPLEMENTATION COMPLETE**; Manual UAT **NOT EXECUTED**; Acceptance **NOT RECORDED** |

**DECISION REQUIRED — IMPLEMENTATION NOT AUTHORIZED** for treating B/C as closed. Classify B/C as **Manual UAT gap + Acceptance evidence gap** on the Finalize/OT adjacent track. Do **not** reopen RESP2/LA. Do **not** redesign OT Preparation.

---

## 2. Original Counsellor Scope

Original / planning surfaces (historical unless noted):

| Source | Role |
|--------|------|
| Waiting List worklist plans/specs (`docs/superpowers/plans/2026-09-05…`, `2026-09-07…`) | Early Waiting List UX plans — superseded by C-01 closed package |
| Phase 3H product decisions + Phase 3I readiness audit | Ownership & work-allocation program plan (Slices 1→12 roadmap) — program later **CLOSED** |
| Phase 3I Slices 1–13 delivery chain | Certified ownership, Sessions RR, navigation, Analytics My Work |
| C-01 Waiting List Dashboard Redesign PD | Bounded WL UX after Slice 13 — **ACCEPTED + CLOSED** |
| Wave 2 session workspace (Quote → Decision → Insurance → Notes → Finish) | Implemented journey; formal UAT gated by **PD-S13-K** (no redesign) |
| Follow-up / Analytics Phase 2W–2Z | Honesty + analytics packages; 2W formal SIGNED incomplete; 2X blocked |
| Apps operational docs (`counselling-rollout.md`, field matrix, guides) | Supporting — **≠** formal acceptance SoT |
| Archive `COUNSELOR_*` / Phase 4 enhancements | **HISTORICAL / SUPERSEDED** |

**Canonical end-to-end journey to reconcile:**

```text
WAITING LIST
  → COUNSELLING SESSION (Wave 2)
    → QUOTE
    → DECISION
    → INSURANCE / COVERAGE / DOCUMENTS
    → SESSION NOTES
    → FINISH / COMPLETE
  → DOWNSTREAM (Follow-up | Finalize Surgery → OT Preparation | Analytics)
```

Related operational areas in scope for classification (not all require new work): Ownership (Assign/Claim/Reassign/ReQueue/History/RR), Patient Header/Details/Clinical Recommendations, Follow-up Center, Finalize/OT Prep/OT Print, Analytics/My Work, Post-Surgery boundary, responsive, a11y, automated tests, Manual UAT, acceptance governance.

---

## 3. Current End-to-End Journey

| Step | Canonical route / surface | Implementation |
|------|---------------------------|----------------|
| Landing | `/dashboard/counsellors-desk/waiting-list` | Live; role landing via `DashboardRouter` |
| Sessions list | `/dashboard/counsellors-desk/sessions` | Live; RR filter + Reassign |
| Session workspace | `/dashboard/counsellors-desk/[id]` | Live Wave 2 shell: Quote → Decision → Notes + Coverage/Insurance + Outpatient |
| Follow-up | `/dashboard/counsellors-desk/surgery-followup` | Live Active / Cold / Post-Surgery |
| Finalize / OT Prep | `/dashboard/counsellors-desk/finalize-surgery` | Live dual workspace + FinalizeOtModal + print helpers |
| Analytics / My Work | `/dashboard/counselor/analytics` | Live reporting scope (My Work vs Authorized Branch) |

**Permissions (authoritative FE patterns):** `counseling_sessions.read` / `.update` / `.reassign` / `.create`; outpatient checklist `counsellor.outpatient_checklist.edit`.

**API SoT:** AuthService Counseling (`counsellors-desk.api.ts`, `counseling-sessions.api.ts`) + CCMS coverage/documents clients. Frontend is not transactional SoT.

---

## 4. Authoritative Closed Items

Do **not** reopen:

| Item | Status | Authoritative artifact |
|------|--------|------------------------|
| Phase 3I Ownership & Work Allocation | **FORMALLY CLOSED** (Option A) | `counsellor-ownership-work-allocation-phase3i-program-product-decision.md` |
| Slice 13 | **CLOSED** | `…slice13-closure.md` |
| Slice 13 Package B (Sessions RR / nav / pagination) | **DELIVERY ACCEPTED** | `phase3i-slice13-package-b-acceptance.md` |
| Slice 12 Leave / RR | **DELIVERY ACCEPTED** | `phase3i-slice12-acceptance.md` |
| Slice 11 Analytics My Work | **ACCEPTANCE GRANTED** (reporting-only) | `phase3i-slice11-implementation-report.md` |
| C-01 Waiting List Redesign | **ACCEPTED + CLOSED** (UAT 15/15) | `counsellor-c01-waiting-list-dashboard-redesign-acceptance-closure.md` |
| Certified ownership model | **LOCKED** | Phase 3I program PD |
| RESP2 OT Preparation | **ACCEPTED / CLOSED** | `finalize-surgery-ot-preparation-revised-responsibility-acceptance.md` |
| Package LA Finalize modal | **ACCEPTED / CLOSED** | `finalize-surgery-ot-preparation-finalize-modal-lifecycle-acceptance.md` |
| Slice 14 | **DOES NOT EXIST** | Explicit prohibitions |
| Phase 3J | **NOT CREATED** | Explicit prohibitions |

**Portfolio Decision 1 (2026-09-22):** Manual UAT / acceptance completion for residual A–M **AUTHORIZED**; production implementation **NOT** authorized. Residual A–M **NOT RUN / NOT ACCEPTED**.

---

## 5. Master Completion Matrix

Gap class legend (exactly one per row’s **Genuine Gap?** where a gap exists; otherwise **I. CERTIFIED / CLOSED** or **H. OUT OF SCOPE** as applicable):

| Code | Meaning |
|------|---------|
| A | IMPLEMENTATION GAP |
| B | AUTOMATED TEST GAP |
| C | MANUAL UAT GAP |
| D | ACCEPTANCE / GOVERNANCE EVIDENCE GAP |
| E | PRODUCT DECISION REQUIRED |
| F | IMPLEMENTATION AUTHORIZATION REQUIRED |
| G | DEFERRED |
| H | OUT OF SCOPE |
| I | CERTIFIED / CLOSED |
| J | REGRESSION |

| # | Area | Original Planned Scope | Current Implementation | Product Decision | Implementation Authorization | Automated Tests | Manual UAT | Acceptance | Current Status | Evidence | Genuine Gap? | Next Action | Do Not Do |
|---|------|------------------------|------------------------|------------------|------------------------------|------------------|------------|------------|----------------|----------|--------------|-------------|-----------|
| 1 | Waiting List | Counsellor operational landing / shared queue | Implemented C-01 UX + Phase 3I ownership | C-01 PD APPROVED; Phase 3I CLOSED | C-01 historical IA used | Vitest + Playwright/ops shells; prior C-01 suites | **PASS 15/15** | **ACCEPTED + CLOSED** | **I** | C-01 acceptance-closure | No (I) | None | Redesign WL; reopen C-01 |
| 2 | Waiting List Search | Quick search | Debounced search + URL state | C-01 | Closed with C-01 | Filter toolbar / URL tests | Covered in C-01 | Closed with C-01 | **I** | C-01; `waiting-list-url-state` | No (I) | None | Change search semantics |
| 3 | Waiting List Filters | Status/type/owner/dates; Apply/Reset | Implemented; owner client-side; Pre-Auth tab | C-01; preauth membership locked | Closed | Client-filters / preauth / toolbar tests | Covered in C-01 | Closed | **I** | C-01 PD + page | No (I) | None | Change filter semantics |
| 4 | Waiting List Pagination | 10/25/50 client-side | Implemented | C-01 (server-side WL pagination out of C-01) | Closed | Pagination tests | Covered in C-01 | Closed | **I** | C-01 | No (I) | None | Server-side WL pagination without new PD |
| 5 | Waiting List Pre-Auth | Pre-Auth presentation / queue | Tab + membership helper + deferred CCMS badges | C-01 / preauth rules locked | Closed | `waiting-list-preauth` tests | Covered in C-01 | Closed | **I** | `waiting-list-preauth.ts` | No (I) | None | Change Pre-Auth membership semantics |
| 6 | Add Patient / Referral | Add to waiting list | Modal → `POST /Counseling/sessions` | Within desk ops | Present | `add-patient-to-waiting-list` tests | Within C-01 / desk | Closed for C-01 UX | **I** | Waiting list page | No (I) | None | Invent new referral ownership |
| 7 | Ownership / Assign | Explicit CounselorId assign | Assign dialog + API | Phase 3I CLOSED | Slices 3+ | FE + BE Assign contracts | Certified in 3I | Closed with 3I | **I** | Phase 3I program PD | No (I) | Residual UAT may re-check invariants only | Reopen ownership; new Supervisor role |
| 8 | Claim | Claim-for-lifecycle | Implemented | Phase 3I | Lifecycle claim slice | Claim contract tests | Certified | Closed | **I** | lifecycle claim contracts | No (I) | None | Silent claim on open/view/start |
| 9 | Reassign | Supervisory A→B | Dialog + `.reassign` | Phase 3I Slice 6 | Closed | BE Reassign suites | Certified | Closed | **I** | Slice 6 tests/reports | No (I) | None | Auto leave transfer |
| 10 | ReQueue | Clear CounselorId → NULL | Follow-up ReQueue + history | Phase 3I Slice 8 | Closed | BE ReQueue + FE slice8 | Certified semantics; presentation UAT residual | Semantics closed; UX presentation residual **C/D** | Mixed | Slice 8 + ReQueue→History report | Presentation: **C** + **D** | Residual Area F Manual UAT | Redesign ReQueue; auto ReQueue |
| 11 | Ownership History | Authoritative history | SessionHistoryModal + GET history | Phase 3I Slice 5 | Closed | History suites | Certified | Closed | **I** | Slice 5 / history tests | No (I) | Residual F may validate Re-queued label | Invent second history store |
| 12 | Sessions / Reassignment Required | RR condition + Sessions UX | Sessions list RR chip + Reassign | Slice 12/13 Package B | Package B IA used | Package B FE suites | **PASS** Package B | **DELIVERY ACCEPTED** | **I** | Package B acceptance | No (I) | None | Make RR a lifecycle Status |
| 13 | Counselling Session | Wave 2 workspace shell | Full shell + phases + coverage | PD-S13-K Option B (UAT, no redesign) | No redesign IA (impl present) | wave2* Playwright + units | **NOT RUN** residual A–E | **No Wave 2 acceptance pack** | **C** + **D** | Residual UAT plan; PD-S13-K | **C** + **D** | **Execute Wave 2 Manual UAT A–E** | Redesign Wave 2; invent new Dashboard |
| 14 | Quote | Estimate/package/IOL/investigations | Estimate phase + packages + print gate | PD-S13-K; calc rules certified by existing APIs | N/A redesign | wave2d3/e4 + estimate-engine units | **NOT RUN** | No pack | **C** + **D** | Wave 2 Quote | **C** + **D** | Manual UAT Area A | Change calculation SoT |
| 15 | Decision | Payment / insurer / decision / schedule | Decision phase | PD-S13-K | N/A | wave2d4 + decision UI tests | **NOT RUN** | No pack | **C** + **D** | Wave 2 Decision | **C** + **D** | Manual UAT Area B | Invent new decision rules |
| 16 | Insurance | Coverage / policy / estimate / docs path | CoveragePreauthPanel + CCMS | PD-S13-K; deep CCMS ≠ Wave 2 acceptance | N/A | wave2c + coverage units | **NOT RUN**; W2-I-03 clarification optional | No pack | **C** + **D** (+ optional **E** for depth) | Residual plan §10.C | **C** + **D** | Manual UAT Area C (shell); clarify deep CCMS only if Product requires | Redesign Insurance; change Pre-Auth membership |
| 17 | Documents / Pre-Auth | Doc checklist / GeneratePreAuth / MarkSent | Coverage documents tab + CCMS APIs | Existing CCMS contracts | Present | Doc completion / wave2c | Residual with Insurance | No Counsellor stage acceptance | **C** + **D** | CoverageDocumentsTab | **C** + **D** | UAT with Area C | Wire OCR without PD |
| 18 | Session Notes | Notes / flags / wrap-up | Wrapup phase; ReQueue stripped from Notes | PD-S13-K / PD-S13-L | N/A | Notes + requeue presentation | **NOT RUN** | No pack | **C** + **D** | Wave 2 Notes | **C** + **D** | Manual UAT Area D | Put ReQueue back in Notes |
| 19 | Finish | Complete + finish summary | Complete Session + Finish summary | PD-S13-K; ownership on complete locked | N/A | Finish UX contracts | **NOT RUN** | No pack | **C** + **D** | Wave 2 Finish | **C** + **D** | Manual UAT Area E | Violate owner+Version on Complete |
| 20 | Patient Header | Identity / status / actions | SessionPageHeader | Pattern via desk UX; no separate PD file | N/A | Header tests | Covered indirectly | Pattern accepted in completion audit | **I** (pattern) | SessionPageHeader | No | Optional residual observation | Replace design system |
| 21 | Patient Details | Demographics sheet | PatientDemographicsSheet integration | Existing patient pattern | N/A | Present | Indirect | Pattern OK | **I** | Examination sheet reuse | No | None | Break patient context |
| 22 | Clinical Recommendations | Sheet action | Hybrid: doctor line from session; optometrist **UX placeholder** | **PD-S13-M Option A** — keep placeholder | Explicitly out of Package B | Sheet tests | N/A clinical SoT | Policy accepted as deferred | **G** | PD-S13-M; placeholder.ts | **G** | No action / keep placeholder | Convert placeholder to clinical SoT without PD |
| 23 | Follow-up Center | Shared Active/Cold/Post-Surgery | Implemented; Original Counsellor historical | Phase 3I honesty certified; Phase 2Y honesty UAT open; 2W unsigned | 2Y impl present | Follow-up page + ReQueue tests | Phase 2Y **NOT RUN**; shared model certified | Shared model **I**; 2Y honesty **C/D** | Mixed | Slice 10; phase2y; residual L | 2Y: **C** + **D** | Residual Area L after Stage 1 | Create My Follow-ups; new ownership |
| 24 | Finalize Surgery | Shared finalize queue | Implemented; Slice 9 honesty; LA closed | Slice 9 + Package LA | LA IA used | Package1 + LA tests | LA **PASS**; residual J/K **NOT RUN** | LA **CLOSED**; honesty **I**; residual fixes **C/D** | Mixed | LA acceptance; residual plan J–K | Residual: **C** + **D** | Residual J–K UAT (after Wave 2 or parallel) | Change ownership; reopen LA |
| 25 | OT Preparation | Shared OT Prep (RESP2) | RESP2 Finalised worklist model | RESP2 PD 01–10 | RESP2 IA used | RESP2 Playwright/Vitest | RESP2 **PASS** | RESP2 **CLOSED** | **I** | RESP2 acceptance | No (I) | None for RESP2 | Redesign OT Prep / reopen RESP2 |
| 26 | OT Print | Dedicated prepared-list print (Pkg B) + bulk slips | Package B impl complete; bulk adjacent | Package B Print IA | Used | Package B Playwright + Vitest | **NOT EXECUTED** | **NOT RECORDED** | **C** + **D** | Package B impl report | **C** + **D** | Adjacent Manual UAT for Package B (not Counsellor Stage 1) | Treat as closed without acceptance; redesign print |
| 27 | Analytics | Summary/trends/aging/conversion | Implemented Phase 2D APIs + 2Z honesty | Slice 11 + Phase 2Z | Slice 11 accepted; 2Z UAT open | Analytics unit + BE | Slice 11 UI PASS; 2Z **NOT RUN** | Slice 11 **I**; 2Z **C/D** | Mixed | Slice 11; phase2z; residual M | 2Z: **C** + **D** | Residual Area M | Turn My Work into operational queue |
| 28 | My Work | Reporting-only attribution | Scope filter My Work vs Authorized Branch | Slice 11 PD | Accepted | analytics-scope tests | Slice 11 | **ACCEPTED** | **I** | Slice 11 | No (I) | None | Duplicate worklist |
| 29 | Post-Surgery boundary | Shared Post-Surgery; ownership SoT deferred | Shared tabs; no D6 SoT | **PD-S13-F DEFERRED** | None | Boundary tests only | N/A | Deferred | **G** | PD-S13-F | **G** | Stop — PD required before impl | Implement Post-Surgery ownership |
| 30 | Responsive UX | Desktop-first + responsive | WL/session/finalize responsive shells | Design system + C-01/Wave 2 | Present | Many responsive Playwright shells | Partial via C-01/Package B/RESP2 | Closed packages covered; Wave 2 residual | Mixed | e2e responsive* | Wave 2 residual **C** | Observe during Wave 2 UAT | Mobile-first redesign of staff desk |
| 31 | Accessibility | Keyboard / a11y associations | Journey keyboard tests in wave2 specs | Platform a11y rules | Present | wave2 a11y scenarios | Residual with Wave 2 | No dedicated a11y acceptance pack | **C** + **D** | wave2d2/d4/d5 | **C** + **D** | Observe during Wave 2 UAT | Invent new a11y framework |
| 32 | Automated E2E coverage | Journey automation | Strong wave2* + finalize/OT + followup/analytics specs | N/A | N/A | **Present** (≠ Manual UAT) | N/A | N/A | Automated strong; acceptance ≠ tests | e2e inventory | No (automation present) | Do not treat as Manual UAT | Skip Manual UAT because Playwright exists |
| 33 | Manual UAT / acceptance governance | Formal UAT → acceptance | Portfolio Decision 1 + residual plan READY | Portfolio Decision 1 APPROVED | UAT authorized; impl not | N/A | A–M **NOT RUN** | A–M **NOT ACCEPTED** | **C** + **D** | Portfolio PD; residual UAT plan | **C** + **D** | **Execute residual Manual UAT Stage 1** | Mark ACCEPTED without evidence |

**OT Prep Package C (PD-OTPREP-10)** — not a numbered required row above but adjacent: Implementation **COMPLETE**; Manual UAT **NOT EXECUTED**; Acceptance **NOT RECORDED** → **C** + **D**. Do not reopen RESP2/LA. Do not implement further Package C scope in this audit.

---

## 6. Waiting List Status

| Check | Result |
|-------|--------|
| Canonical route | `/dashboard/counsellors-desk/waiting-list` |
| Summary/KPI, search, filters, grouping, Apply/Reset | Implemented (C-01) |
| Owner filter | Client-side (All/Mine/Unassigned/Other) — intentional |
| Status/type incl. Pre-Auth Queue / OT Returned | Implemented |
| Worklist rows, hierarchies, owner/payment/Pre-Auth/status/actions | Implemented |
| Pagination 10/25/50 client-side + URL state | Implemented |
| Age/Gender, Add Patient, loading/empty/error | Implemented |
| Responsive / a11y / design system | Within C-01 accepted package |
| Filter semantics | Must not change |

**Classification:** **I. CERTIFIED / CLOSED** (C-01 ACCEPTED + CLOSED, 2026-09-22).  
**Regression found this audit:** **NONE.**  
**Do not redesign Waiting List.**

---

## 7. Counselling Session Wave 2 Status

| Stage | Implemented | Automated tests | Manual UAT | Formal acceptance |
|-------|-------------|-----------------|------------|-------------------|
| Session shell / SessionPageHeader | YES | YES | Residual with A–E | **NO** dedicated Wave 2 pack |
| Quote | YES | Playwright wave2d3/e4 + units | **NOT RUN** | **NO** |
| Decision | YES | wave2d4 + units | **NOT RUN** | **NO** |
| Insurance / Coverage / Documents | YES | wave2c + coverage units | **NOT RUN** | **NO** |
| Session Notes | YES | wave2d5/e5 + units | **NOT RUN** | **NO** |
| Finish / Complete | YES | Finish contracts | **NOT RUN** | **NO** |
| Save Draft / Save Session | YES | Dual-draft / save contracts | Residual | **NO** |
| Ownership ACL / visibility / history | YES (Phase 3I) | Strong | Certified for ownership; Wave 2 residual may re-check | Ownership **CLOSED**; Wave 2 journey **NOT** |

**Dedicated Wave 2 acceptance artifact:** **ABSENT** → classify as **ACCEPTANCE EVIDENCE GAP** (and **MANUAL UAT GAP**), **not** automatically as a code defect.

**PD-S13-K:** Formal UAT required before further Wave 2 UX; **no redesign**.

**Journey transitions WAITING LIST → … → FINISH:** Implemented in code + automated suites; **not** Manual-UAT-passed; **not** formally accepted.

---

## 8. Ownership Status

| Capability | Status |
|------------|--------|
| Assign / Claim / Reassign / ReQueue | Implemented + Phase 3I certified/closed |
| CounselorId vs CreatedByUserId | Locked semantics |
| Open/view/start ≠ ownership | Locked |
| CAS / Version / 409 | Locked |
| Ownership History | Locked |
| Reassignment Required | Condition not Status — Slice 12/13 accepted |
| Follow-up / Finalize / Analytics My Work ownership boundaries | Locked (shared / reporting-only as applicable) |

**Do not reopen Phase 3I. Do not create Slice 14 / Phase 3J.**

Residual ownership-**adjacent** UAT only: ReQueue→History presentation (Area F), PD-B/PD-C (Areas H–I) — **no new ownership slice**.

---

## 9. Follow-up Status

| Aspect | Status |
|--------|--------|
| Shared Active / Cold / Post-Surgery | Implemented; shared model **certified** in Phase 3I |
| Contact / reminder / ReQueue | Implemented |
| Original Counsellor historical attribution | Present (Slice 10 honesty) |
| My Follow-ups | **Must not create** |
| Phase 2Y operational honesty | Implemented; Manual UAT **NOT RUN** → residual Area L |
| Phase 2W formal SIGNED | **0 SIGNED** → **E** (governance) |
| Phase 2X lifecycle EXIT / clinical SoT | **BLOCKED / DEFERRED** |

**Classification:** Shared operational Follow-up = **I** for Phase 3I honesty boundaries; residual honesty UAT = **C** + **D**; 2W/2X = **E** / **G**.

---

## 10. Finalize / OT Preparation Closure

| Package | Acceptance artifact? | Status |
|---------|---------------------|--------|
| RESP2 | YES | **ACCEPTED / CLOSED** |
| Package LA | YES | **ACCEPTED / CLOSED** |
| Package B — Dedicated OT Print | **NO** | Impl complete; UAT not executed; acceptance not recorded |
| Package C — PD-OTPREP-10 | **NO** | Impl complete; UAT not executed; acceptance not recorded |
| C-LA-04 Cancel presentation redesign | N/A | **DEFERRED** |

**Regression scan (governance only):** No certified regression evidence found that would reopen RESP2 or Package LA. Residual Counsellor Finalize fixes (null-branch, row-open 403) remain in residual UAT plan Areas J–K (**NOT RUN**).

**Conflict with audit brief assumption that B/C are closed:** See Executive Summary — **DECISION REQUIRED — IMPLEMENTATION NOT AUTHORIZED** to mark B/C closed without acceptance artifacts.

---

## 11. Analytics Status

| Item | Status |
|------|--------|
| Dashboard/page `/dashboard/counselor/analytics` | Implemented |
| Metrics / trends / aging / conversion / follow-up aging | Implemented via analytics APIs |
| Counsellor filtering | Implemented |
| My Work | **Reporting only** — Slice 11 **ACCEPTED** |
| Phase 2Z honesty remediation | Implemented; Manual UAT **NOT RUN** → residual Area M |
| Duplicate operational queue | **Must not create** |

---

## 12. Patient Header / Clinical Recommendations Status

| Surface | Status | Next |
|---------|--------|------|
| Patient Header | Implemented | No action / optional UAT observation |
| Patient Details | Implemented (demographics sheet) | No action |
| Clinical Recommendations | Doctor line from session; optometrist **UX placeholder** per **PD-S13-M** | **No action** — do not invent clinical SoT |

**Required action type:** **No action** (policy deferred). Not UAT-blocked for module E2E Stage 1. Product Decision already exists (keep placeholder). New clinical integration would need a **new** Product Decision.

---

## 13. UAT / Acceptance Evidence Matrix

| Scope | Automated | Manual UAT | Formal acceptance |
|-------|-----------|------------|-------------------|
| C-01 Waiting List | YES | **PASS 15/15** | **YES — CLOSED** |
| Phase 3I / Slice 12 / Slice 13 Package B | YES | PASS (cited) | **YES — CLOSED** |
| Slice 11 My Work | YES | UI PASS | **YES** |
| Wave 2 A–E | YES (Playwright ≠ Manual) | **NOT RUN** | **NO** |
| ReQueue→History F | YES (prior report) | **NOT RUN** | **NO** |
| PD-A/B/C G–I | YES (prior reports) | **NOT RUN** | **NO** |
| Finalize residual J–K | YES | **NOT RUN** | **NO** |
| Phase 2Y L | YES | **NOT RUN** | **NO** |
| Phase 2Z M | YES | **NOT RUN** | **NO** |
| Phase 2W N | N/A | Sign-off incomplete | **0 SIGNED** |
| RESP2 | YES | **PASS** | **YES — CLOSED** |
| Package LA | YES | **PASS** | **YES — CLOSED** |
| OT Prep Package B Print | YES | **NOT EXECUTED** | **NOT RECORDED** |
| OT Prep Package C | YES (BE/Vitest; Playwright not on Pkg C build) | **NOT EXECUTED** | **NOT RECORDED** |

---

## 14. Deferred Items

| Item | Gap class |
|------|-----------|
| PD-S13-C Admin→RR handoff | **G** |
| PD-S13-E Claim availability helper | **G** |
| PD-S13-F Post-Surgery ownership / D6 | **G** |
| PD-S13-M Clinical SoT (optometrist) | **G** (policy: keep placeholder) |
| PD-S13-PAG-04 MaxPageSize | **G** |
| Phase 2X lifecycle EXIT / clinical SoT | **G** (blocked) |
| C-LA-04 Cancel Surgery presentation redesign | **G** |
| JWT session invalidation; HR leave auto-transfer | **G** / **H** |
| Server-side Waiting List pagination; DTO enrichment; My Queue; WL ReQueue | **H** / out of closed C-01 |

---

## 15. Out-of-Scope Items

- Reopen Phase 3I / create Slice 14 / create Phase 3J  
- Reopen or redesign C-01 Waiting List  
- Redesign Finalize / OT Preparation (RESP2 / LA)  
- Change ownership semantics; automatic leave transfer / clear / ReQueue  
- New Supervisor role; automatic ownership transfer  
- Dedicated Counsellor Dashboard without **new** Product Decision (**PD-S13-I Option A** = Waiting List remains landing; NO ACTION)  
- Convert Analytics My Work into operational queue / create duplicate worklists / My Follow-ups  
- Convert Clinical Recommendations placeholder into clinical SoT without new PD  
- Deep CCMS claim lifecycle as Wave 2 residual unless Product clarifies (W2-I-03)  
- OCR / unwired capabilities without explicit Product Decision (**existing capability / not automatically authorized**)  
- Post-Surgery ownership implementation  
- Archive “module complete” claims  

---

## 16. Genuine Implementation Gaps

**None identified that reopen Phase 3I, redesign Wave 2, or authorize a new Counsellor implementation program.**

| Apparent “gap” | Correct classification |
|----------------|------------------------|
| Wave 2 not accepted | **C** + **D** (impl present) |
| Residual A–M not accepted | **C** + **D** |
| OT Prep Package B/C not accepted | **C** + **D** (impl complete; adjacent track) |
| Phase 2W unsigned | **E** (governance sign-off) |
| Phase 2X / PD-S13-F / clinical SoT | **G** / blocked |
| Dedicated Counsellor Dashboard | **H** under PD-S13-I Option A — new PD required to change |

If live Manual UAT discovers a certified behavior break → classify **J. REGRESSION** and **STOP** (do not silently authorize fix in this audit).

---

## 17. Product Decision Gaps

| Topic | Status |
|-------|--------|
| Dedicated Counsellor Dashboard | **PD-S13-I Option A** already decided: **NO ACTION** (WL landing). Future dashboard = **new PD required / NOT AUTHORIZED** |
| Clinical Recommendations SoT | **PD-S13-M** keep placeholder — no new PD needed for Stage 1 |
| Phase 2W PD2–PD16 formal SIGNED | **OPEN (0 SIGNED)** — blocks Phase 2X only |
| Wave 2 Insurance depth (W2-I-03) | Optional clarification if Product requires full CCMS lifecycle inside Wave 2 UAT |
| OT Prep Package B/C “closed” claim vs repo | **DECISION REQUIRED** to reconcile Product Owner belief vs missing acceptance artifacts — **implementation not authorized** by this audit |
| PD-C-04 optional sub-items | Remain deferred |

---

## 18. Next Gate

**Given everything already completed, the smallest bounded next action required to move the Counsellor module toward genuine end-to-end completion is:**

```text
NEXT AUTHORIZED GATE =
  CONTROLLED HUMAN MANUAL UAT — Stage 1
  Residual Areas A–E (Wave 2 Quote → Decision → Insurance → Notes → Finish)
  Plan: docs/audits/counsellor-residual-acceptance-manual-uat-plan.md
  Authorization: Portfolio Decision 1 (2026-09-22)
```

**Why this gate (dependency order):**

1. Wave 2 is the core counselling E2E journey and is **implemented + automated-tested** but **not** Manual-UAT-passed or formally accepted (**PD-S13-K**).  
2. Portfolio Decision 1 already authorizes residual Manual UAT; **implementation is not authorized**.  
3. Residual UAT plan Stage 1 explicitly prioritizes A–E before F and later areas.  
4. C-01 / Phase 3I / RESP2 / LA are closed — do not divert into redesign.  
5. OT Prep Package B/C Manual UAT is a **parallel adjacent** Finalize/OT gate — not a substitute for Wave 2 Counsellor E2E acceptance.

**Do not start the next gate in this task.**

After Stage 1 PASS → record Wave 2 acceptance pack → continue residual Stage 2+ per plan → only then consider module product-COMPLETE.

---

## 19. Next-Month Forecast

Forecast from repository evidence only (no invented story points/deadlines). “Next month” = residual acceptance completion track already authorized + adjacent OT Prep UAT evidence gaps discovered 2026-09-24.

### Must complete

1. Execute Manual UAT Stage 1 Wave 2 A–E and record evidence.  
2. On PASS, create formal Wave 2 acceptance/closure artifact (governance).  
3. Continue residual UAT plan Stages 2–5 (F, G–I, J–K, L–M) as scheduled under Decision 1.  
4. Resolve Phase 2W formal SIGNED checklist (governance Area N) or explicitly document pause.

### Should validate

- ReQueue→History (Area F)  
- PD-A / PD-B / PD-C (Areas G–I)  
- Finalize null-branch + row-open 403 (Areas J–K)  
- Phase 2Y Follow-up honesty (Area L)  
- Phase 2Z Analytics honesty (Area M)  
- **Adjacent:** OT Prep Package B Print Manual UAT + acceptance recording  
- **Adjacent:** OT Prep Package C Manual UAT + acceptance recording  

### Product decisions required

- **None** to start Wave 2 Manual UAT (already authorized).  
- Phase 2W formal SIGNED before Phase 2X.  
- New PD only if Product wants: Counsellor Dashboard (overrides PD-S13-I), clinical SoT (overrides PD-S13-M), Post-Surgery ownership (PD-S13-F), or Insurance-depth expansion.  
- Product Owner reconciliation if OT Prep B/C were believed closed without acceptance artifacts.

### Deferred

- PD-S13-C/E/F/M (clinical SoT), MaxPageSize, Phase 2X, C-LA-04, HR leave auto-transfer, JWT invalidation, server-side WL pagination, My Queue, WL ReQueue.

### Out of scope

- Phase 3I reopen; Slice 14; Phase 3J; C-01 redesign; ownership model changes; duplicate worklists; My Follow-ups; operationalizing Analytics My Work; OT Prep redesign packages; production implementation during UAT track.

### Not planned

- Archive Phase 4 Counsellor enhancements (SignalR/charts/export) as current scope.  
- Historical mock “Counsellor Dashboard” concepts without new PD.  
- Patient chart `CounselingTab` “Coming Soon” as desk E2E blocker (separate patient-chart surface).

---

## 20. Explicit Non-Actions / Protected Boundaries

- Do not reopen Phase 3I  
- Do not create Slice 14  
- Do not create Phase 3J  
- Do not reopen C-01  
- Do not redesign Finalize / OT Preparation (RESP2 / LA)  
- Do not change ownership semantics  
- Do not create duplicate worklists  
- Do not create a Counsellor Dashboard without Product Decision  
- Do not convert Analytics My Work into an operational queue  
- Do not invent clinical source-of-truth integration  
- Do not implement deferred items  
- Do not treat Playwright as Manual UAT  
- Do not treat Manual UAT as acceptance without an acceptance artifact  
- Do not authorize implementation from this audit  

---

## 21. Evidence Index

### Current authoritative

| Artifact | Role |
|----------|------|
| `docs/product-decisions/hospital-portal-counsellor-product-portfolio-decision.md` | Decision 1 — Manual UAT authorized; impl NONE |
| `docs/audits/counsellor-final-acceptance-reconciliation-audit.md` | Residual A–N classification baseline |
| `docs/audits/counsellor-residual-acceptance-manual-uat-plan.md` | UAT plan READY; A–M NOT RUN |
| `docs/audits/counsellor-ownership-work-allocation-phase3i-program-product-decision.md` | Phase 3I CLOSED |
| `docs/audits/counsellor-ownership-work-allocation-phase3i-slice13-closure.md` | Slice 13 CLOSED; PD-S13-K/L |
| `docs/audits/phase3i-slice13-package-b-acceptance.md` | Sessions Package B accepted |
| `docs/audits/counsellor-c01-waiting-list-dashboard-redesign-acceptance-closure.md` | C-01 CLOSED |
| `docs/product-decisions/finalize-surgery-ot-preparation-revised-responsibility-acceptance.md` | RESP2 CLOSED |
| `docs/product-decisions/finalize-surgery-ot-preparation-finalize-modal-lifecycle-acceptance.md` | Package LA CLOSED |
| `docs/product-decisions/finalize-surgery-ot-preparation-package-b-print-implementation-report.md` | Pkg B impl; UAT/acceptance open |
| `docs/product-decisions/finalize-surgery-ot-preparation-package-c-pd-otprep-10-implementation-report.md` | Pkg C impl; UAT/acceptance open |

### Supporting implementation / tests

| Area | Paths |
|------|-------|
| FE routes | `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/*`, `…/counselor/analytics` |
| Components | `src/components/counsellors-desk/**`, `src/components/counselor/**` |
| APIs/hooks | `counsellors-desk.api.ts`, `use-counselling-session-controller.ts`, analytics/follow-up hooks |
| Playwright | `e2e/counselling-wave2*.spec.ts`, `counselling-session.spec.ts`, finalize/OT prep specs, `counsellor-followup-analytics-phase1.spec.ts` |
| Vitest | ~152 counsellor-related `*.test.ts(x)` under `apps/hospital-portal-web/src` |
| Backend | `AuthService.Tests` Phase 3I / analytics / finalize / lookup suites |

### Historical / superseded (do not override later closures)

- `counsellor-c01-…-uat-observations.md` (ACCEPTED=NO) → superseded by C-01 closure  
- `…phase3i-program-status-next-gate-audit.md` (“remains open”) → superseded by Option A  
- RESP2 acceptance footer “Package B/C NOT STARTED” → superseded by later B/C **implementation reports** (UAT still open)  
- Residual UAT plan §2.1 “portfolio PENDING” → superseded by portfolio Decision 1 recorded same day  
- Archive `COUNSELOR_*` completion claims  

---

## 22. Final Recommendation

## CURRENT COUNSELLOR STATUS

**IMPLEMENTATION COMPLETE / UAT PENDING**

The counselling and ownership journey is implemented and largely automated-tested. Certified packages (Phase 3I, C-01, Slice 11 My Work, RESP2, Package LA) are accepted/closed. The module is **not** ACCEPTED / CLOSED end-to-end until residual Manual UAT + acceptance (especially Wave 2 A–E) are recorded.

## NEXT AUTHORIZED GATE

**Manual UAT for existing Wave 2 journey (residual Areas A–E — Quote → Decision → Insurance → Notes → Finish)** per `docs/audits/counsellor-residual-acceptance-manual-uat-plan.md`, authorized by Portfolio Decision 1.

Do **not** start implementation. Do **not** redesign Wave 2.

## NEXT-MONTH FORECAST

1. **Must complete:** Wave 2 Manual UAT A–E + Wave 2 acceptance pack; continue residual A–M acceptance track; Phase 2W SIGNED governance (or explicit pause).  
2. **Must validate:** Areas F–M; adjacent OT Prep Package B and Package C Manual UAT + acceptance recording.  
3. **Product decisions:** None to begin Stage 1 UAT; 2W SIGNED before 2X; new PD only for Dashboard / clinical SoT / Post-Surgery ownership / Insurance-depth expansion; reconcile OT Prep B/C closure belief vs missing acceptance artifacts.  
4. **Deferred:** PD-S13-C/E/F/M (clinical), MaxPageSize, Phase 2X, C-LA-04, HR/JWT auto behaviors, server-side WL pagination, My Queue, WL ReQueue.  
5. **Out of scope:** Phase 3I reopen; Slice 14; Phase 3J; C-01 redesign; ownership changes; duplicate queues; Dashboard without PD; operationalizing My Work; OT Prep redesign; deferred implementation.

## PROTECTED BOUNDARIES

- Do not reopen Phase 3I  
- Do not create Slice 14  
- Do not create Phase 3J  
- Do not reopen C-01  
- Do not redesign Finalize / OT Preparation  
- Do not change ownership semantics  
- Do not create duplicate worklists  
- Do not create a Counsellor Dashboard without Product Decision  
- Do not convert Analytics My Work into an operational queue  
- Do not invent clinical source-of-truth integration  
- Do not implement deferred items  

---

## Control Flags

| Flag | Value |
|------|--------|
| PRODUCTION IMPLEMENTATION PERFORMED | **NO** |
| PRODUCT DECISION CREATED | **NO** |
| IMPLEMENTATION AUTHORIZATION CREATED | **NO** |
| NEXT GATE STARTED | **NO** |
| PHASE 3I REOPENED | **NO** |
| SLICE 14 CREATED | **NO** |
| PHASE 3J CREATED | **NO** |
| C-01 REOPENED | **NO** |
| WAVE 2 REDESIGN STARTED | **NO** |
| OT PREP REDESIGN STARTED | **NO** |

---

**END — COUNSELLOR END-TO-END COMPLETION AND NEXT-GATE AUDIT — STOP AFTER AUDIT**
