# Phase 3I Slice 13 Package B — Counselling Sessions UX Remediation Report

| Field | Value |
|-------|--------|
| **Document date** | 2026-09-22 |
| **Package** | Package B — RR + Counsellor Navigation (UX remediation only) |
| **Product Decision SoT** | `docs/audits/counsellor-ownership-work-allocation-phase3i-slice13-product-decisions.md` |
| **Functional implementation SoT** | `docs/audits/phase3i-slice13-package-b-implementation-report.md` |
| **Accepted decisions (unchanged)** | **PD-S13-A = C** · **PD-S13-B = B** · **PD-S13-D = C** |
| **Backend business-rule change** | **NO** |
| **Manual UAT (visual UX)** | **PASS** (2026-09-22) — Product Owner |
| **Delivery Acceptance** | **DELIVERY ACCEPTED** — `docs/audits/phase3i-slice13-package-b-acceptance.md` |

---

## Final status

**UX REMEDIATION IMPLEMENTED**  
**AUTOMATED VALIDATION: PASS**  
**MANUAL UAT: PASS**  
**UX REMEDIATION: DELIVERY ACCEPTED**

---

## 1. Scope

Bounded frontend UX polish for:

`/dashboard/counsellors-desk/sessions`

Goals:

- Healthcare-grade operational worklist appearance
- Consistency with Waiting List / Follow-up Counsellor chrome
- Clear RR active state
- Clear Open (primary) / Reassign (secondary) hierarchy
- Polished RR empty state

Explicitly excluded: ownership rules, APIs, permissions, RR predicate, routes, Waiting List / Follow-up redesign, ReQueue on Sessions, Owner column product decision, backend changes.

---

## 2. Pre-implementation audit

| Surface | Patterns reused |
|---------|-----------------|
| Waiting List | `shellPage` density, `sessionWidget`, compact title, two-line empty, row-action outline CTAs |
| Follow-up Center | `pillTab` / `pillTabCurrent`, worklist widget chrome, empty-state structure |
| Tokens | `counsellingSessionTokens` (`shellPage`, `sessionWidget`, `pillTab`, `pillTabCurrent`, `statusPill*`) |
| Actions | `CounsellingButton`, `WaitingListReassignDialog` |
| Gating | `canShowSessionsRrReassign`, `COUNSELLING_SESSIONS_REASSIGN_PERMISSION`, existing RR URL helpers |

**Pre-change UX gaps**

1. Shell spacing looser than Waiting List / Follow-up  
2. RR filter looked like a generic outline/default button  
3. RR duplicated as filter chip while also toggled in header  
4. Decision rendered as plain text  
5. Open and Reassign both outline; Reassign sorted before Open  
6. RR empty state was a single muted line (felt unfinished)  
7. Table proportions / density less scan-friendly than Counsellor worklists  

---

## 3. UX issues addressed

| Issue | Remediation |
|-------|-------------|
| Page chrome | Matched Counsellor `gap-0.5` / breakpoint padding; kept back + title + compact count |
| RR filter | Native button using `pillTab` / `pillTabCurrent` + `aria-pressed` |
| RR duplication | Removed RR from chip list; chips remain for other URL filters only |
| Table IA | Same columns; `table-fixed` proportions; denser header/rows; sticky header retained |
| Decision | Existing `statusPill` variants (Pending / Agreed / Declined) |
| Owner context | Secondary under Patient when RR filter active only (presentation; no Owner column) |
| Actions | Open = `variant="default"` first; Reassign = outline secondary when gated |
| RR empty | Two-line approved copy |
| Responsive | Surgery stacks under patient on small widths; action wrap; no new min-width force |

---

## 4. Approved design decisions implemented

1. Page shell / hierarchy — Counsellor density; compact session count metadata  
2. RR filter — `pillTab` / `pillTabCurrent`; `?reassignmentRequired=true` semantics unchanged  
3. Table — columns preserved; density / pills / proportions improved  
4. Owner — secondary under Patient in RR view only  
5. Actions — Open primary, Reassign secondary; `canShowSessionsRrReassign` unchanged  
6. RR empty — approved two-line copy  
7. a11y — `aria-pressed`, accessible action labels, focus via existing button patterns  

---

## 5. Files changed

| File | Change |
|------|--------|
| `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/sessions/page.tsx` | UX remediation only (presentation / layout / hierarchy) |
| `apps/hospital-portal-web/src/lib/counsellors-desk/sessions-package-b-ux.contract.test.ts` | **New** focused UX contract tests |
| `docs/audits/phase3i-slice13-package-b-ux-remediation-report.md` | This report |

**Not changed:** backend services, APIs, RR detection, permissions, gating helpers, sidebar nav, Waiting List, Follow-up, dialog mutation path.

---

## 6. Certified behavior regression check

| Locked behavior | Result |
|-----------------|--------|
| Slice 12 RR detection | Unchanged (server filter + FE query param only) |
| `CounselorId` ownership SoT | Unchanged |
| `CreatedByUserId` not ownership | Unchanged |
| Reassign API / `WaitingListReassignDialog` | Reused |
| `counseling_sessions.reassign` | Unchanged |
| CAS / version / 409 | Dialog path unchanged |
| Ownership History | Unchanged (server path) |
| PD16 | Unchanged |
| Inactive-target protection | Unchanged (dialog/API) |
| Waiting List Reassign eligibility | Untouched |
| Follow-up ReQueue | Untouched; no ReQueue on Sessions |
| Sessions route | `/dashboard/counsellors-desk/sessions` |
| RR query semantics | `toggleReassignmentRequiredInSearchParams` preserved |
| No auto transfer / clear / ReQueue | Unchanged |

---

## 7. Automated tests and exact results

Command (from `apps/hospital-portal-web`):

```text
npx vitest run
  src/lib/counsellors-desk/sessions-rr-reassign.test.ts
  src/lib/counsellors-desk/sessions-package-b.contract.test.ts
  src/lib/counsellors-desk/sessions-package-b-ux.contract.test.ts
  src/lib/counsellors-desk/reassignment-required-filter.test.ts
  src/lib/counsellors-desk/counselling-reassign-capability.test.ts
  src/components/counsellors-desk/waiting-list/WaitingListReassignDialog.test.tsx
```

**Result:** `Test Files  6 passed (6)` · `Tests  33 passed (33)` · Duration ~2.1s

Covered:

- RR filter / gating contracts  
- Package B dialog reuse / no ReQueue / sidebar  
- UX contracts (pill RR, Open primary, status pills, empty copy, no Owner column / KPI)  
- Reassign capability + WaitingListReassignDialog  

---

## 8. Lint / typecheck

| Check | Result |
|-------|--------|
| IDE diagnostics (`ReadLints` on touched files) | No issues |
| ESLint on `sessions/page.tsx` + UX contract test | **Pass** (exit 0; no reported issues) |
| Project-wide typecheck | Not required for this bounded UX change; no TS API surface changes |

---

## 9. Playwright

No existing e2e fixture targets `/dashboard/counsellors-desk/sessions` list / RR filter (`e2e/` grep empty for Sessions list selectors).

**Playwright:** not executed for this remediation (no suitable focused Sessions-list fixture).

Visual quality must be confirmed in Manual UAT.

---

## 10. Out-of-scope verification

Confirmed **not** implemented / modified in this remediation:

- New ownership rules / entity / API / schema / migrations  
- New permissions / Supervisor role / HR leave  
- Automatic transfer / clear / ReQueue / JWT invalidation  
- Dashboard / Analytics / Post-Surgery / Clinical Recommendations  
- Waiting List redesign / Follow-up redesign / Wave 2 redesign  
- New route / worklist / RR predicate / PD16 / Claim availability  

Repo working tree may contain unrelated pre-existing dirty files; **this remediation intentionally only authored the Sessions page, UX contract test, and this report.**

---

## 11. Manual UAT checklist

### Sessions

- [ ] Counselling Sessions opens from Counsellor sidebar
- [ ] Existing route remains correct
- [ ] Page hierarchy is clear
- [ ] Session count is compact and contextual
- [ ] Existing sessions remain visible

### RR Filter

- [ ] RR filter is visually clear when inactive
- [ ] RR filter is unmistakably active when selected
- [ ] aria-pressed is correct
- [ ] URL remains `?reassignmentRequired=true`
- [ ] RR population is unchanged
- [ ] No duplicate RR filter/chip state

### Table

- [ ] Existing columns preserved
- [ ] Column proportions are improved
- [ ] Rows are appropriately dense
- [ ] Decision uses existing status pill
- [ ] Header is clear
- [ ] Table is easy to scan
- [ ] No unnecessary visual clutter

### Actions

- [ ] Open is primary
- [ ] Reassign is secondary
- [ ] Reassign only appears for valid RR records
- [ ] Existing Reassign dialog works
- [ ] No ReQueue on Sessions

### RR Empty State

- [ ] "No sessions require reassignment" displayed correctly
- [ ] Secondary message displayed correctly
- [ ] Empty state does not feel visually unfinished
- [ ] No invented metrics or guidance

### Accessibility / Responsive

- [ ] Keyboard navigation works
- [ ] Focus is visible and correct
- [ ] Action labels are accessible
- [ ] RR aria-pressed is correct
- [ ] No horizontal overflow
- [ ] Responsive behavior remains usable
- [ ] Visual hierarchy remains clear

---

## 12. Screenshots

Not captured in this automated remediation run. Capture during Manual UAT if required for Delivery Acceptance.

---

## Stop condition

```text
UX REMEDIATION IMPLEMENTATION   ✅ COMPLETE
AUTOMATED VALIDATION            ✅ PASS
MANUAL UAT                      ✅ PASS (2026-09-22)
UX REMEDIATION DELIVERY         ✅ ACCEPTED
```

Authoritative Package B Delivery Acceptance:

`docs/audits/phase3i-slice13-package-b-acceptance.md`

Do **not** start another Slice 13 package or Phase 3I slice from this report. Next work requires a separate explicit Product Decision / readiness gate.
