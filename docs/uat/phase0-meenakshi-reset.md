# Phase 0 — Meenakshi UAT reset

Run migration **131** to link **CCMS-2627-000014** to counsellor session `bb000001-2222-2222-2222-000000000006` and reset workflow to **DRAFT**.

## What it does

- Sets `session_id` on the case
- Resets `current_state` → `DRAFT`, clears approval/pre-auth fields
- Resets workflow instance to DRAFT; clears workflow history
- Soft-deletes orphan pre-auth, billing, claims, settlements, events (from sidebar-only walkthrough)

## Run (PostgreSQL)

From repo root, using the same connection as CCMS `local.settings.json`:

```bash
psql "Host=...;..." -f consolidated/migrations/131_ccms_uat_meenakshi_link_reset.sql
```

Or paste the SQL into your DB client.

## After migration

1. Open counsellor session: `/dashboard/counsellors-desk/bb000001-2222-2222-2222-000000000006`
2. **Coverage & Pre-Auth** tab → save insurance draft
3. Open CCMS case **CCMS-2627-000014** → verify **Draft** state and **Next Step** panel (Phase 1)

## If case number differs

Edit `v_case_number` in `131_ccms_uat_meenakshi_link_reset.sql` before running.
