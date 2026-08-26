# IP × CCMS Waves 3–7

## Wave 3 — Beds
- Master: Auth `bed_inventory` (`Available` → `Reserved` → `Occupied` → `Cleaning` → `Available`).
- IP stores `patient_journey.assigned_bed_id` only (no second bed table).
- Internal API: `POST /api/internal/ip-beds/lifecycle` (`reserve` | `occupy` | `transfer-out` | `vacate` | `cleaned`).
- Admit with `assignedBedId` occupies; ward update transfers; clinical discharge vacates to Cleaning.

## Wave 4 — Multi-day IP MVP
- `ip_daily_progress_note`
- `POST/GET .../journeys/{id}/progress-notes`
- `discharge_planning_ready` + `POST .../discharge-planning`
- Out of scope: MAR, pharmacy, diet, handover EHR.

## Wave 5 — Claim query
- After `CLAIM_SUBMITTED` / `CLAIM_IN_PROCESS`.
- `POST /ccms/claims/{id}/query` and `/query-response`.
- Reuses `ccms_clarification_items` (prefixed `[CLAIM …]`). `query_status` on claim packet.

## Wave 6 — Analytics
- Same-DB CCMS read model: `GET /ccms/analytics/journey-kpis`.
- No live joins to IP/Auth databases.
- Operational analytics page shows Emergency FC, partial approval, open claim queries, pre-auth TAT.

## Wave 7 — Staging smoke
See `ip-ccms-wave7-staging-smoke.md`.

## SQL
`database_migrations/schema/ip_ccms_waves_3_to_6.sql`
