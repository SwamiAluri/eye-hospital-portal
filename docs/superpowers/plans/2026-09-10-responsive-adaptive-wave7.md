# Wave 7 — Responsive Adaptive Fit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline). Steps use checkbox syntax for tracking.

**Goal:** Same Hospital Portal UI at every CSS viewport; workstation `<1600` reclaims vertical chrome so Waiting List / Finalize show more complete rows; modals fit viewport; Large Desktop `≥1600` frozen.

**Architecture:** Approach B — extend Wave 5/6 CSS tokens and counsellor-scoped composition only. No new design system, no DPR layout, no device breakpoints.

**Tech Stack:** Next.js 14, Tailwind 3, counselling-session theme, Playwright e2e.

**Spec:** User Wave 7 brief (chat) + prior global responsive density design.

## Global Constraints

- `≥1600` Large Desktop SoT frozen.
- `<1600` workstation denser composition only.
- No DPR/physical-device/zoom/transform layout.
- No API/workflow/permission/calculation/counselling Quote→Finish changes.
- Global controls remain 40px; density=workstation opt-in for secondary toolbar only.
- Do not hide patient/procedure/status/attention/action/financials.
- Commit only when user explicitly requests.

## Phases

1. Waiting List chrome/toolbar/row/grid
2. Finalize Surgery mirror
3. AddPatientModal
4. PatientFormModal
5. Secondary module spot checks
6. Full screenshot matrix + Waves 1–6 regression + STOP

## Phase 1 targets @ 1280×720

- Toolbar h ≤ 76 (was ~91)
- Work row h ≤ 58 (was ~72)
- First complete row top ≤ 290 (was ~356)
- pageHOverflow ≤ 2
- Five-zone grid preserved; 1920 unchanged
