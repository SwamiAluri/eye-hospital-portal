# Counsellor Wave 2 Insurance Coverage Runtime Loop Defect Report

## 1. Defect Summary

During Manual UAT of Counsellor Wave 2 (Decision → Insurance), selecting Payment Type = Insurance with an insurer (e.g. United India Insurance) produced:

- repeated `"Failed to load coverage case"` toasts
- UI showing `"Pre-auth not required"` when that flag was set
- eventual React `"Maximum update depth exceeded"` with the stack pointing at `CoveragePreauthPanel.tsx`

This was a frontend lifecycle defect (unstable effect/query identities + non-idempotent form sync + unbounded error toasts), not a Pre-Auth business-rule or CCMS contract change.

## 2. Reproduction

- **Route / surface:** `/dashboard/counsellors-desk/[sessionId]?from=waiting-list`
- **Journey:** Quote completed → Decision active → Insurance available
- **Decision:** Payment Type = Insurance; Insurance Company selected
- **Insurance:** `CoveragePreauthPanel` mounts (coverage tab)
- **Observed:**
  - repeated identical `"Failed to load coverage case"` notifications
  - `"Pre-auth not required"` empty state when `notRequiredPreAuth` is true (existing truthful product state)
  - browser unhandled runtime error: Maximum update depth exceeded → `CoveragePreauthPanel.tsx`

## 3. Root Cause

**ROOT CAUSE G — multiple interacting causes**

| Layer | Evidence |
|---|---|
| Component | `CoveragePreauthPanel.tsx` |
| Primary thrash | `useCoverageDocumentRequirements` used `query.data ?? []`, creating a **new empty array every render** when requirements were unloaded |
| Effect / query | Unstable `documentSlots` → unstable `refreshDocCount` → unstable `load` `useCallback` → `useEffect([load])` re-invoked `load()` continuously |
| Request lifecycle | Each `load()` called `GET /ccms/coverage-cases/by-session/{sessionId}` (`getCaseBySessionId`). Failures hit the outer `catch` |
| Notification lifecycle | Every failed `load()` called `toast.error('Failed to load coverage case')` with no per-lifecycle guard |
| Form sync | Counselling sync effect always `setForm`’d a new object from `mergeFormWithCounsellingSession` (always spreads `{ ...base }`) even when sync fields were unchanged |
| Parent props | `CounsellingSessionPageContent` passed `Array.from(selectedInvestigations)` inline, recreating `counsellingCtx` when the parent re-rendered |
| Workspace callback | `handleCaseWorkspaceChange` always wrote parent state (now equality-guarded) |

`"Pre-auth not required"` is the existing empty UI when `needsCoverageWorkflow(paymentType, notRequiredPreAuth)` is false. Hooks/effects still ran before that early return, so the load/toast loop could occur **while** that empty state was on screen.

API contract (`getCaseBySessionId`): HTTP GET; 200 returns case; **204/404 → null (not an error)**. Toast spam required a true thrown failure (network/auth/5xx) **and** repeated `load()` invocations.

## 4. Why the Loop Happened

Proven cycle:

1. Render `CoveragePreauthPanel`
2. `useCoverageDocumentRequirements` → `requirements = query.data ?? []` (new `[]` identity)
3. `slots` `useMemo` recomputes → new `documentSlots`
4. `refreshDocCount` identity changes
5. `load` identity changes (deps included `refreshDocCount`)
6. `useEffect([load, refreshKey])` runs `load()`
7. `load` `setState` (`setLoading` / `setForm` / `setCase_`) and may toast on failure
8. Re-render → step 2 repeats

When counselling context identity also thrashed (inline investigation arrays / parent state updates), the counselling sync effect compounded updates by always returning a new form object.

## 5. Why Notification Spam Happened

One underlying failure was re-executed on every recreated `load` identity. Each failure path called `toast.error('Failed to load coverage case')` with no “already toasted for this lifecycle” guard → unbounded identical toasts.

## 6. Fix Applied

Bounded frontend-only changes:

| File | Change |
|---|---|
| `src/hooks/use-coverage-document-requirements.ts` | Export `EMPTY_DOCUMENT_REQUIREMENTS`; use as `query.data` fallback |
| `src/components/counsellors-desk/coverage/CoveragePreauthPanel.tsx` | Stable empty insurer options; `refreshDocCountRef` / counselling / draft refs so `load` deps stay stable; skip load when pre-auth not required; idempotent counselling sync via `coverageFormsSyncEqual`; one toast per load-failure lifecycle (`loadErrorToastedRef`) |
| `src/lib/counsellors-desk/coverage-form-sync-equal.ts` | New helper for sync-field equality |
| `src/components/counsellors-desk/session/CounsellingSessionPageContent.tsx` | Memoize investigation / estimate-line props passed into the panel |
| `src/hooks/use-counselling-session-controller.ts` | Equality-guard `handleCaseWorkspaceChange` |

**Tests added:**

- `src/hooks/use-coverage-document-requirements.stability.test.ts`
- `src/lib/counsellors-desk/coverage-form-sync-equal.test.ts`
- `src/components/counsellors-desk/coverage/CoveragePreauthPanel.runtime-loop.contract.test.ts`

## 7. Business Behavior Preserved

No changes to:

- Insurance / Pre-Auth membership business rules
- When pre-auth is / is not required
- CCMS API contracts / endpoints / response semantics
- Session ownership / CounselorId / CreatedByUserId / ACL
- Version / optimistic concurrency / 409
- Permissions, routes, FSM, Wave 2 journey stages
- `"Pre-auth not required"` copy and meaning

Genuine coverage load failures still surface **once** per load lifecycle.

## 8. Automated Tests

**Added / focused**

```text
npx vitest run \
  src/hooks/use-coverage-document-requirements.stability.test.ts \
  src/lib/counsellors-desk/coverage-form-sync-equal.test.ts \
  src/components/counsellors-desk/coverage/CoveragePreauthPanel.runtime-loop.contract.test.ts
```

Result: **PASS** (9 tests)

**Regression**

```text
npx vitest run \
  src/lib/ccms/coverage-visit-policy-persist-contract.test.ts \
  src/components/ccms/VisitPolicyList.refresh.test.ts \
  src/lib/counsellors-desk/counselling-journey-navigation.test.ts \
  src/lib/counsellors-desk/counselling-session-navigation.test.ts \
  src/lib/ccms/ccms-visit-policy-prereq.hydration-sync.test.ts \
  src/components/counsellors-desk/coverage/CoveragePreauthRail.test.tsx
```

Result: **PASS** (all listed)

## 9. Browser / Playwright Validation

Attempted:

```text
npx playwright test \
  e2e/counselling-wave2e1-uat.spec.ts \
  e2e/counselling-wave2e2-uat.spec.ts \
  e2e/counselling-wave2e2r-uat.spec.ts \
  --project=chromium
```

**Result:** Could not execute in this agent environment — Playwright Chromium binary missing (`browserType.launch: Executable doesn't exist` … run `npx playwright install`).

**Manual UAT still required** on the real session that reproduced the defect.

## 10. Network Validation

| | Behavior |
|---|---|
| **Before (code-proven)** | Unstable `load` identity → repeated `GET .../coverage-cases/by-session/{sessionId}` + repeated error toasts on failure |
| **After (expected)** | Single load per session / refreshKey / payment / notRequiredPreAuth change when workflow needed; **no load** when pre-auth not required; at most one failure toast per lifecycle; 30s poll unchanged for in-flight cases |

Live network capture left for Manual UAT.

## 11. Remaining Issues

- Playwright browsers not installed in this agent environment — Wave 2 e2e not re-run here.
- If `getCaseBySessionId` still fails once due to backend/auth/environment, the UI will show **one** toast (expected). That is not this runtime-loop defect.
- No backend change was required or authorized.

## 12. UAT Status

**IMPLEMENTATION COMPLETE — AUTOMATED TESTS PASS — MANUAL UAT REQUIRED**

Do **not** mark Wave 2 accepted.  
Do **not** mark Counsellor module accepted.

Stop here before Notes / Finish or any other Counsellor work.
