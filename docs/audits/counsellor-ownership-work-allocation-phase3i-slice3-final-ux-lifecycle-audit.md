# Phase 3I Slice 3 — Final Row-Click UX Fix + Lifecycle Audit

| Field | Value |
|-------|--------|
| **Date** | 2026-09-16 |
| **Slice** | Phase 3I Slice 3 only |
| **Status** | Part A **IMPLEMENTED**; Part D lifecycle **AUDIT ONLY** |

---

## 1. Part A — Implementation

### Files changed

- `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/waiting-list/page.tsx`
- `apps/hospital-portal-web/src/components/counsellors-desk/waiting-list/WaitingListAssignDialog.test.tsx`
- `docs/audits/counsellor-ownership-work-allocation-phase3i-slice3.md` (status notes)
- `docs/audits/counsellor-ownership-work-allocation-phase3i-slice3-final-ux-lifecycle-audit.md` (this report)

### UX behavior changed

`handleRowClick` for `isWaitingListEligibleForInitialAssign(patient)`:

1. `setSelectedId(patient.id)`
2. `if (canAssign) setAssignPatient(patient)` → opens existing `WaitingListAssignDialog`
3. `return`

Removed: `toast.error('Assign this session before opening it.')`

### Confirmations

- **Pending + Unassigned row click now opens Assign Session directly.**
- **Previous toast removed from this path.**
- **No ownership mutation occurs on row click.**
- **No navigation / Azure start on this path.**
- `canAssign === false`: silent block (select row, no dialog, no open) — no new toast invented.

---

## 2. Automated Tests

### Commands

```text
npx vitest run \
  src/components/counsellors-desk/waiting-list/WaitingListAssignDialog.test.tsx \
  src/components/counsellors-desk/waiting-list/WaitingListWorkRow.assign.test.tsx \
  src/lib/counsellors-desk/counselling-initial-assign-capability.test.ts \
  src/lib/api/counsellors-desk.assign.api.test.ts \
  src/lib/auth-interceptors.assign-403.test.ts \
  src/lib/counsellors-desk/waiting-list-shared-queue.test.ts \
  src/lib/counsellors-desk/counsellor-session-open-auth.test.ts \
  src/lib/counsellors-desk/counselling-auth.test.ts
```

(from `apps/hospital-portal-web`)

### Results

**33 passed / 0 failed** across 8 files.

### Coverage notes

- Direct Assign dialog open; toast string absent; eligible block has no `router.push` / Azure start / assign mutation
- Assign dialog: Assign to me gating, peer exclusion, branch picker wiring preserved
- Assign visibility / capability / API / 403 skipForbiddenRedirect / shared queue / open-auth regression preserved

---

## 3. Lifecycle Audit Matrix

| State / Action | Existing meaning | Same/New work item | CounselorId behavior | Existing action | Assignment currently required? | Ownership boundary | Future slice |
|---|---|---|---|---|---|---|---|
| Pending (queue Waiting) | Unstarted counselling queue | Same session+queue | Often NULL until Assign | Assign if unassigned; Start/Open if assigned | Yes to open if unassigned | Shared WL; ownership via Assign | 3 done; 4 ACL |
| Processed (Called/InProgress) | Active counselling | Same | Unchanged by Start | Continue / navigate | No | Owner not enforced on mutate | 4 |
| Done (Completed + agreed) | Agreed terminal (unless OT SurgeryDone) | Same | Unchanged on complete | View; Re-evaluate CTA | No | Terminal counselling | Re-eval sync TBD; 4 |
| RepeatCounselling (Completed + not agreed) | Needs return counselling | Same session (status projection) | Unchanged on complete; Start does not stamp | Open; Start Session gate | No | Same owner unless requeue later | 4; 8 if requeued |
| AddOnSurgery | Package upgrade after Done | Same | Unchanged | Open; read-only messaging | No | Same | 4 |
| SurgeryDone | OT SurgeryDone overrides Completed | Same; historical/read-only | Unchanged | View only | N/A | Not counselling work | 9 |
| OtReturned | IP ReadyForSurgery + return reason | Not a counselling queue row | N/A on journey | Re-plan / Open journey | N/A | IP ops; optional session link | 9 |
| PreAuthQueue | Coverage filter tab | Same WL rows | Display only | Pre-Auth navigate | No | Shared | — |
| Create / Add Patient | New session + Waiting queue | New session (+ queue) | Forced NULL | Add Patient | No (Assign later) | Shared Pending | 3 done |
| Assign | NULL → target | Same | Set to target (atomic if-null) | Assign dialog / Assign to me | Is the assign action | Establishes ownership | 3 done; 5 audit |
| Open / View / Navigate | Route to session | Same | No change | Row click | Blocked only Pending+NULL | Open ≠ claim (certified) | — |
| Azure start | Enrichment lock/Processed | Azure record (may create) | Auth CounselorId unchanged | Auto on Pending/Repeat click | No | Not ownership | — |
| Auth StartSession | Session InProgress; queue→InProgress | Same | Must not change | Auto Pending; Start Session on Repeat | No | PD-START-01 | 4 |
| Complete / Finish | Completed; Done vs Repeat by agreement | Same | Unchanged | Complete Session | No | — | 4 |
| Re-evaluate | Azure Done→Processed; FE local Processed | Same session (Azure) | Unchanged (no Auth ownership API) | Re-evaluate button on Done | No | Not ownership boundary today | Sync/ownership TBD |
| Repeat Start Session | Restart Completed→InProgress | Same (A) | Unchanged | Banner Start Session | No | Inherited owner if any | 4 |
| Requeue | New Waiting queue item, same session | New queue item, same session | Unchanged (not cleared) | Follow-up Re-queue | No | Should become NULL (PD-REQUEUE-01) | 8 |
| OT Cancel back-sync | Intended Repeat via cancel-ot | Same session (intended) | N/A (call missing) | Cancel OT | N/A | Broken path | Product decision |
| Mark SurgeryDone | OT status only | Same counselling id | Unchanged | OT/ward path | N/A | No counselling reclaim | 9 |

---

## 4. Confirmed existing behavior

1. Waiting List UI status is a **projection** of AuthService queue + session flags + OT link — not a single DB enum.
2. Azure CounsellingApi is a **secondary** enrichment store; FE treats failures as non-blocking.
3. Auth mapping: Waiting→Pending; Called/InProgress→Processed; Completed+agreed→Done; Completed+not agreed→RepeatCounselling; OT SurgeryDone→SurgeryDone.
4. Create forces `CounselorId = null`.
5. Slice 3 Assign: Pending + NULL only; shared Waiting List; Open/Start do not assign.
6. Pending + Unassigned row click opens Assign dialog directly (this fix).
7. Repeat Counselling finish path is **same session** status projection (verdict A).
8. Repeat restart uses Auth `StartSession` on same `sessionId`; does not change `CounselorId`.
9. Re-evaluate exists: Azure Done→Processed + FE local reopen; does not mutate Auth `CounselorId`.
10. Requeue exists (`POST .../re-queue`): new Waiting queue row, same session; does **not** clear `CounselorId`.
11. OT Returned is IP-journey data (`otReturnReason`), not a counselling queue status.
12. SurgeryDone is historical/read-only; Re-evaluate blocked after surgery.

---

## 5. Decision required

1. Re-evaluate dual-store gap: Azure/FE reopen vs Auth queue may still show Done after refresh — should Auth sync be mandatory?
2. Assign required only for Pending+Unassigned today — should Repeat/Processed with NULL `CounselorId` also require Assign? (Hybrid E vs current code)
3. Requeue: clear ownership (PD-REQUEUE-01) not implemented — confirm Slice 8 semantics (new vs reuse queue row).
4. `UpdateSession` still accepts `CounselorId` write — lock/remove under Slice 4?
5. OT cancel → counselling Repeat (`cancel-ot`) call exists but target handler missing — implement or remove?
6. Post-Surgery / Follow-up ownership vs counselling `CounselorId` (Slices 9–10).
7. Unassigned mutate ACL policy when owner ACL lands (Slice 4).

---

## 6. Future slice mapping

| Finding | Slice |
|---------|-------|
| Owner mutate ACL; lock Update CounselorId bypass; Repeat Start under owner | 4 |
| Assign/Reassign/Requeue audit events | 5 |
| Change owner without requeue | 6 |
| Version/409 on Assign/mutate | 7 |
| Requeue → CounselorId NULL | 8 |
| SurgeryDone / OT Returned non-inheriting ownership | 9 |
| Follow-up Center / Requeue UX honesty | 10 |
| Analytics My Work vs shared WL | 11 |
| Leave / inactive owner surfacing | 12 |
| Re-evaluate Auth sync; OT cancel-ot wiring | Product decision (not forced into 4–12) |

**STOP** — do not start Slice 4 until UAT/product review.
