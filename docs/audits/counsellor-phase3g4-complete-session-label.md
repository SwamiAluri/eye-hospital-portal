# Phase 3G.4 — Complete Session label (acceptance report)

**Date:** 2026-09-16  
**Scope:** Terminology correction only. No API / lifecycle / permission / document-gate changes.  
**UAT status:** Automated validation only — **not certified**. Manual Amelia checklist below.

---

## 1. Audit findings

Final counselling mutation was already:

`CounsellingActionBar` → `onSaveSession` → `handleSave` → `saveCounsellingSession` →  
`PUT /Counseling/sessions/{id}` → optional OT → `POST /Counseling/sessions/{id}/complete` →  
`CompleteSessionAsync` → `Status = "Completed"`.

Footer primary was mislabelled **"Save session"** while behaving as completion.  
**Save Draft**, **Close**, and journey-rail **Finish** were already distinct.

## 2. Occurrence classification (pre-change)

| Occurrence | Class | Action |
|---|---|---|
| `counselling-session-actions.ts` labels `'Save session'` (×4) | A — final CTA | → `counsellingCopy.completeSession` |
| `counselling-copy.ts` `saveSession: 'Save Session'` | A | → `completeSession: 'Complete Session'`; deprecated alias |
| `session-status-summary.ts` `nextAction = 'Save session'` | A | → `'Complete Session'` |
| `counselling-finish-outcome.ts` “Use Save session…” | A | → Complete Session wording |
| Success toast `Session saved successfully` | A | → `Session completed successfully` |
| Controller error/info toasts for `handleSave` | A | → complete wording |
| Disabled reason `Saving session…` while `isSaving` | A | → `Completing session…` |
| Waiting-list empty hint “Save Session” | A | → Complete Session |
| Counsellor guide / UI registry docs | D — docs | Updated |
| E2E comments / annotations | D | Updated |
| `kind: 'save_session'`, `onSaveSession`, `saveCounsellingSession`, `btnSaveSession`, API `saveSession` | C — internal | **Retained** |
| Save Draft / `Could not save session` (draft errors) | B — draft | Unchanged |
| Journey rail `Finish` | A≠mutation | Unchanged |
| `SessionNotesWidget` / widgets `saveSessionNotes` | unrelated | Unchanged |

## 3. Changed locations (why)

User-facing final-completion wording only; handlers/API/kind unchanged.

## 4. Internal `save_session` retained

Confirmed: `ActionBarPrimaryKind` still includes `'save_session'`; primary still `kind: 'save_session'`; test id `counselling-btn-save-session` unchanged.

## 5. Final CTA before / after

| | Before | After |
|---|---|---|
| Label | Save session | **Complete Session** |
| Handler | `onSaveSession` → `handleSave` | Same |
| API | PUT + POST complete | Same |

## 6. Save Draft

Unchanged: `saveCounsellingDraft` → PUT only; no `completeSession`; remain in session; label **Save Draft**.

## 7. Complete Session

Still: `saveCounsellingSession` → PUT → optional OT → `completeSession` / addon → existing Finish summary destination on success.

## 8. Close

Unchanged: dirty → Save & Close / Leave Without Saving / Cancel; Save & Close uses draft path only.

## 9. Completion API

No backend changes. Still `POST .../sessions/{id}/complete` → `CompleteSessionAsync`.

## 10. Tests added/updated

- **Added:** `counselling-complete-session-label.test.ts` (label, draft distinct, Close, double-submit disable reasons, docs ≠ gate, nextAction, finish copy)
- **Updated:** `counselling-session-actions.test.ts`, `session-status-summary.test.ts`, `counselling-insurance-doc-completion.test.ts`, `save-counselling-session.fs01.test.ts` (toast), `counselling-progress.test.ts` (describe title)

## 11. Test results

```
npx vitest run …counselling-complete-session-label…
  …session-actions… …session-status-summary… …insurance-doc-completion…
  …save-counselling-session.fs01… …counselling-progress… …session-close…
→ 7 files, 106 tests passed
```

## 12. Build / typecheck

Full `tsc --noEmit` reports **pre-existing** parse errors in  
`WaitingListFilterToolbar.tsx` (unrelated; not modified in this phase).  
No tsc diagnostics matched Phase 3G.4 touched counselling-session files.

## 13–17. Confirmations

| Item | Status |
|---|---|
| No API changes | Yes |
| No DB/migration changes | Yes |
| No permission changes | Yes |
| No lifecycle changes | Yes |
| Insurance document gating unchanged (Phase 3F) | Yes — tests still green |
| Submit to Claims doc gate unchanged | Yes |
| Journey rail Finish unchanged | Yes |

---

## Manual Amelia UAT checklist (do not certify)

### A. Save Draft
1. Open counselling session  
2. Make a small edit  
3. Click **Save Draft**  
4. Expect: succeeds, remain in session, **not** Completed  

### B. Complete Session
5. Satisfy existing prerequisites  
6. Primary CTA reads **Complete Session** (not Save session)  
7. Click **Complete Session**  
8. Expect existing PUT → complete POST sequence  
9. Expect existing success destination (Finish summary when applicable)  
10. Session completed via existing backend  

### C. Close
11–18. Dirty Close → Cancel / Leave Without Saving / Save & Close — **none** call complete  

### D. Insurance docs
19–22. Incomplete required docs: Save Draft available; completion follows existing contract; Submit to Claims still document-gated  

### E. Responsive
Footer at 1920 / 1600 / 1440 / 1280  

### F. Network
Complete Session: existing completion endpoints only; no duplicate concurrent complete on double-click  

**STOP.** Do not claim UAT or certification from this report.
