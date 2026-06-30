# Ward & IP Journey — Deployment Runbook

**Purpose:** Go-live checklist, stage ownership, and environment verification for the IP ward journey module.  
**Audience:** DevOps, release managers, ward/OT leads  
**Related docs:** [ward-journey-user-workflows.md](./ward-journey-user-workflows.md), [ward-preop-workspace-spec.md](./ward-preop-workspace-spec.md), [ward-journey-qa-matrix.md](./ward-journey-qa-matrix.md), [ward-journey-rbac-audit.md](./ward-journey-rbac-audit.md), [ward-journey-staff-training.md](./ward-journey-staff-training.md)

**Routes**

| Surface | Path |
|---------|------|
| Ward dashboard | `/dashboard/ip-management/ward` |
| Operation Theatre | `/dashboard/ip-management/operation-theatre` |
| Counselling | `/dashboard/counsellors-desk/...` |
| Patient merge | `/dashboard/patients/merge` |

**Backend:** `microservices/ip-management-service`

---

## 1. Stage ownership

Each clinical stage has **one primary owning team** and **one primary UI surface**. Do not duplicate workflows across surfaces.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  COUNSELLING                                                                 │
│  Journey creation · P0 checklist · Schedule · Postpone/rebook · G6 guard   │
│  Route: /dashboard/counsellors-desk                                          │
│  API: POST /ip-management/journeys/onboard-expected                          │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │ clinicalState = Expected
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  WARD DASHBOARD + PRE-OP WORKSPACE                                           │
│  Expected · Admitted · ReadyForSurgery · (PostOp · ReadyForDischarge)       │
│  Route: /dashboard/ip-management/ward                                        │
│  Modal: WardPreOpWorkspaceModal · WardPostOpWorkspaceModal · AdmitModal · Discharge   │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │ Send to OT
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  OPERATION THEATRE (exclusive owner SentToOT → SurgeryCompleted)             │
│  Accept · OT details · Start/end surgery · Move to Post-Op Ward              │
│  Route: /dashboard/ip-management/operation-theatre                           │
│  API: accept · start-surgery · clinical-transition → PostOp                    │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │ Move to Post-Op Ward
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  WARD (PostOp · ReadyForDischarge · Discharged read-only)                    │
│  WardPostOpWorkspaceModal · WardDischargeSummaryModal                          │
└─────────────────────────────────────────────────────────────────────────────┘

        ┌──────────────────────────────────────────┐
        │  JOURNEY MODAL (read-only all stages)      │
        │  Timeline · billing · deep links           │
        └──────────────────────────────────────────┘
```

### Ownership matrix

| Clinical state | Primary owner | Primary UI | Ward visibility |
|----------------|---------------|------------|-----------------|
| *(pre-Expected)* | Counselling | Counselling session | — |
| **Expected** | Ward | Ward Pre-Op Workspace + AdmitModal | Stat card + filter |
| **Admitted** | Ward | Ward Pre-Op Workspace | Stat card + filter |
| **ReadyForSurgery** | Ward | Ward Pre-Op Workspace + SendToOTModal | Stat card + filter |
| **SentToOT** | **OT only** | OT page | **All tab only** (by design) |
| **InOT** | OT | OT page | In OT filter |
| **SurgeryCompleted** | OT → Ward handoff | OT page (Move to Post-Op) | Surgery Done filter |
| **PostOp** | Ward | WardPostOpWorkspaceModal | Post-Op filter |
| **ReadyForDischarge** | Ward + Doctor | Discharge Summary Modal | Ready for D/C filter |
| **Discharged** | Archive | Journey Modal (read-only) | Hidden unless toggle |

### Parallel state dimensions

| Dimension | Values | Where shown |
|-----------|--------|-------------|
| `clinicalState` | Expected … Discharged | Ward status badge, filters |
| `otState` | NotSent → Completed | Ward OT column; OT page |
| `financialState` | NotCreated → Settled | Journey Modal, Case Sheet |
| `postOpState` | NotStarted → Completed | Journey Modal |

---

## 2. Clinical state machine (reference)

**Forward path (unchanged in production):**

```
Expected → Admitted → ReadyForSurgery → SentToOT → InOT → SurgeryCompleted → PostOp → ReadyForDischarge → Discharged
                              ↑_______________|
                         OT return (before surgery ends)
```

**Additive cancel-today edges (Phase 2 — implemented):**

| From | To | Condition |
|------|-----|-----------|
| Admitted | Expected | Cancel today + bed release |
| ReadyForSurgery | Expected | Cancel today |
| SentToOT | Expected | Cancel today + `otState` not Accepted |

---

## 3. Pre-deployment checklist

### 3.1 Services & infrastructure

| # | Check | Pass |
|---|-------|------|
| 1 | `ip-management-service` deployed and healthy | ☐ |
| 2 | PostgreSQL migrations applied (incl. `142_ward_investigation_results.sql`, `143_patient_journey_cancel_annotations.sql`) | ☐ |
| 3 | Auth permissions seeded: `ward.checklist.edit`, `ward.investigation.enter`, `ward.investigation.verify`, `anaesthesia.pac.edit` | ☐ |
| 4 | CCMS integration reachable (admit pre-auth — G11) | ☐ |
| 5 | OT booking / schedule service reachable (Send to OT, cancel release, rebook sync) | ☐ |
| 6 | Unified ward workspace is default (Phase 4 — feature flag removed) | ☐ |

### 3.2 Configuration

| # | Check | Pass |
|---|-------|------|
| 7 | Ward master + beds seeded (`80_ward_master.sql`, `93_seed_wards.sql`) | ☐ |
| 8 | Pre-op section items seeded (Form 1, Form 2, clearance categories) | ☐ |
| 9 | Branch ID assigned for ward users | ☐ |
| 10 | Feature flag defaults documented for day-care (= IPD UI, R10) | ☐ |

### 3.3 Smoke tests (minimum)

Run [ward-journey-qa-matrix.md](./ward-journey-qa-matrix.md) WF-01, WF-03, WF-04 before full UAT.  
Automated smoke: `npm run test:e2e:ward-journey` (requires live API + `npm run resolve:e2e:ward` for full flows).

| # | Smoke | Pass |
|---|-------|------|
| 11 | Ward dashboard loads journeys for branch | ☐ |
| 12 | Open Expected patient → workspace → §1 save result | ☐ |
| 13 | Admit patient (warn-only gates acknowledge) | ☐ |
| 14 | Send to OT from ReadyForSurgery | ☐ |
| 15 | OT accept patient on OT page | ☐ |

---

## 4. Post-deployment verification (per environment)

Use QA matrix IDs **WF-01 through WF-10**. Sign off each workflow section in [ward-journey-qa-matrix.md](./ward-journey-qa-matrix.md).

| Workflow | Required phase | Sign-off role |
|----------|----------------|---------------|
| WF-01 Expected | Phase 1+ | Ward nurse lead |
| WF-02 Admitted | Phase 1+ | Ward nurse lead |
| WF-03 ReadyForSurgery | Phase 1+ | Ward nurse lead |
| WF-04 SentToOT | Existing | OT lead |
| WF-05 InOT | Existing | OT lead |
| WF-06 SurgeryCompleted → PostOp | Existing + Phase 3 | OT + Ward leads |
| WF-07 PostOp | Phase 3 | Ward nurse lead |
| WF-08 ReadyForDischarge | Existing | Doctor + Ward |
| WF-09 Discharged | Existing | Admin |
| WF-10 Cancel today | Phase 2 | Ward + Counselling leads |

**Environment record**

| Field | Value |
|-------|-------|
| Environment | |
| Deploy date | |
| Release version / commit | |
| Verified by | |
| WF-01…WF-10 status | |

---

## 5. Rollback considerations

| Scenario | Action |
|----------|--------|
| Workspace UI broken | Revert frontend deploy; unified workspace is the only ward path (legacy modals removed Phase 4) |
| Gate service regression | Revert `ChecklistGateService` deploy; gates remain warn-only |
| Cancel-today API issues | Disable cancel UI; manual OT + counselling process |
| OT integration failure on cancel | Manual OT slot release; journey state corrected via admin |

**Do not** roll back forward clinical state machine migrations without DBA review — journey rows may be mid-flight.

---

## 6. Training handoff

Use **[ward-journey-staff-training.md](./ward-journey-staff-training.md)** for role-specific quick reference and sign-off table.

| Role | Doc section | Key message |
|------|-------------|-------------|
| Ward nurse | WF-01, WF-02, WF-03, WF-07 | Pre-op workspace; gates are warn-only; OT owns queue after Send |
| OT staff | WF-04, WF-05, WF-06 | Accept/start/end; **Move to Post-Op Ward** triggers PostOp state |
| Counsellor | Stage 0 in workflows doc | Schedule, rebook, P0; same-day single-eye rule (G6) |
| Anaesthetist | §4 PAC, WF-02 | PAC after admit; Form 5 at discharge |
| Admin | WF-09, merge page | Discharged read-only; patient merge blocks ward |

Full workflows: [ward-journey-user-workflows.md](./ward-journey-user-workflows.md) Part V.

---

## 7. Monitoring & support

| Signal | Where | Action if failing |
|--------|-------|-------------------|
| Ward list empty | Browser network tab → `GET /ip-management/journeys` | Check branchId, service health |
| Admit 403/400 | AdmitModal error | CCMS pre-auth (G11) or permissions |
| Gate warnings mismatch | Compare progress strip vs AdmitModal | See [ward-journey-rbac-audit.md](./ward-journey-rbac-audit.md); gates aligned Phase 1 |
| Patient stuck SentToOT | OT page queue | OT accept or return to ward |
| Cancel blocked | Error message | OT must return if Accepted |

---

## 8. Production go-live (Phase 5.5)

**Prerequisites:** Phases 1–4 deployed to staging; Phase 5.4 staging UAT sign-off (WF-01…WF-10) in [ward-journey-qa-matrix.md](./ward-journey-qa-matrix.md); `npm run test:e2e:ward-journey` green against staging API.

### 8.1 Deploy sequence

| Step | Action | Owner | Pass |
|------|--------|-------|------|
| 1 | Tag release / record commit SHA | Release manager | ☐ |
| 2 | Apply PostgreSQL migrations on production (`142_ward_investigation_results.sql`, `143_patient_journey_cancel_annotations.sql`, any later ward migrations) | DBA / DevOps | ☐ |
| 3 | Deploy `ip-management-service` to production; verify health endpoint | DevOps | ☐ |
| 4 | Deploy `auth-service` (G6 guard, counselling OT prepare) if not already on same release train | DevOps | ☐ |
| 5 | Deploy hospital-portal-web frontend (unified ward workspace — no feature flag) | DevOps | ☐ |
| 6 | Confirm Auth permissions seeded: `ward.checklist.edit`, `ward.investigation.enter`, `ward.investigation.verify`, `anaesthesia.pac.edit` | Admin | ☐ |
| 7 | Confirm CCMS + OT schedule integrations reachable from production ip-management | DevOps | ☐ |
| 8 | Set `AuthService:InternalApiKey` on ip-management (rebook sync) — match counselling internal caller | DevOps | ☐ |

### 8.2 Production smoke (minimum)

Complete §3.3 smoke tests (items 11–15) in production. Add cancel-today spot check if a safe test patient exists:

| # | Smoke | Pass |
|---|-------|------|
| 16 | Ward Expected → workspace → §1 save | ☐ |
| 17 | Cancel today from Admitted test journey → Expected + `pendingRebook` badge (optional) | ☐ |
| 18 | OT accept on SentToOT test journey | ☐ |

### 8.3 Post-go-live sign-off

| Field | Value |
|-------|-------|
| Environment | **Production** |
| Deploy date | |
| Release version / commit | |
| Verified by (DevOps) | |
| Verified by (Ward lead) | |
| Verified by (OT lead) | |
| WF-01…WF-10 production spot-check | ☐ / notes |
| Rollback plan acknowledged (§5) | ☐ |

**On success:** Update Phase 5.5 row in [ward-journey-user-workflows.md](./ward-journey-user-workflows.md) Part VII and archive this sign-off table.

---

## 9. Pre-Op Workspace v2 — accessibility, performance & rollout (Phase 12)

The Workspace v2 redesign (Phases 0–11) ships **strangler-style without a feature flag**: each
phase replaced UI in place behind the existing `WardPreOpWorkspaceModal` shell, so go-live follows
the standard frontend deploy in §8.1 step 5. No new migrations are introduced by Phase 12.

### 9.1 Accessibility (WCAG 2.2 AA) — verified

| Check | Implementation | Verify |
|-------|----------------|--------|
| Dialog semantics | `role="dialog"` + `aria-modal` + `aria-labelledby` on the workspace | Screen-reader announces title on open |
| Focus trap + restore | shared `useFocusTrap` hook | Tab cycles within modal; focus returns to trigger on close |
| Keyboard close | Escape closes the workspace | `Esc` dismisses; no mouse needed |
| Visible focus | `focus-visible:ring` on close/print/derived-link controls | Tab shows a ring |
| Reduced motion | global `@media (prefers-reduced-motion: reduce)` in `globals.css` | OS "reduce motion" stops spinners/transitions |
| Derived rows | `DerivedTick` is `aria-disabled` with `sr-only` satisfied/not-satisfied text | SR reads status, control not focusable as editable |
| Role walkthrough | per-role flows in [ward-journey-qa-matrix.md](./ward-journey-qa-matrix.md) | Ward nurse / doctor / anaesthetist / counsellor sign-off |

### 9.2 Performance — verified

- **Single rollup on open** (`getPreOpClearance` / `getWardChecklist`) — no per-section fan-out.
- **Lazy step mounting** — only the active step renders (`renderStepBody`); no manual Refresh button.
- **Optimistic writes + single refetch** on save/blur; **`React.memo(DerivedTick)`** avoids re-render storms.

### 9.3 Deferred backlog (backend-dependent — not in Phase 12 scope)

These blueprint §20 "additional recommendations" require server/data work and are tracked for a
follow-up release; the Print summary deep-link (`patients/[id]/summary/print`) is the piece shipped now.

| Item | Why deferred | Pre-req |
|------|--------------|---------|
| Telemetry (time-per-step, duplicate-edit rate) | Needs an analytics sink + event schema | Product analytics service |
| Audit-timeline panel | Needs a consolidated audit query across pre-op writers | `ip-management` audit read API |
| Offline / queued auto-save with sync state | Needs a durable client queue + conflict policy | Service-worker / sync design |
| Configurable criticality via `item_config` | Needs admin UI + catalog editing | `pre_op_section_items.item_config` editor |

### 9.4 Rollback

Phase 12 is frontend-only (no schema change), so rollback = redeploy the previous web build (§5).
The §2 catalog dedupe (migration 144) and earlier ward migrations are unaffected and need no revert.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-06-26 | Workspace v2 Phase 12 — a11y (dialog/focus-trap/Escape/reduced-motion), perf (`React.memo`, lazy mount confirmed), Print summary deep-link, deferred-backlog register (§9) |
| 2026-06-25 | Phase R3 / 5.5 — production go-live checklist (§8); cancel-today marked implemented |
| 2026-06-25 | Phase 4 — RBAC audit doc, staff training, legacy modal removal, feature flag removed, `test:e2e:ward-journey` |
| 2026-06-24 | Phase 0.3 — initial runbook with stage ownership diagram and deployment checklist |
