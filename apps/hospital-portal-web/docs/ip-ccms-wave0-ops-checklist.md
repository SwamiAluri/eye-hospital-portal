# IP × CCMS Wave 0 — Ops rollout checklist

Run in **each environment** (dev → staging → prod) before treating Waves 1–2 as live.

Do not skip preview SQL. Do not archive until the orphan report is reviewed.

---

## 1. Schema (idempotent)

| Order | Script | Purpose |
|---|---|---|
| 1 | `database_migrations/schema/ip_integration_outbox_phase2.sql` | IP outbox table + unique idempotency key |
| 2 | `database_migrations/schema/ccms_integration_idempotency_p0.sql` | Shared CCMS consumer keys (multi-instance) |
| 3 | `database_migrations/permissions/seed_ccms_phase2_permission_aliases.sql` | `ccms.*` / Emergency FC aliases |
| 4 | `database_migrations/schema/ip_ccms_waves_3_to_6.sql` | Assigned bed id, progress notes, claim query_status |

Prefer `consolidated/migrations/164_outbox_versioned_schema.sql` for outbox tables (DB-005). Runtime CREATE is disabled.

---

## 2. Phase 3 insurance bridge (preview then APPLY)

```sql
SELECT * FROM apply_phase3_legacy_insurance_bridge(NULL, true);   -- dry run
SELECT * FROM apply_phase3_legacy_insurance_bridge(NULL, false);  -- persist links
```

Script: `database_migrations/schema/ccms_legacy_insurance_bridge_phase3.sql`

Does **not** auto-create CCMS cases. Review orphans before any `migrate_legacy_preauths_to_ccms`.

---

## 3. Optional Auth table archive

After orphan review:

```sql
SELECT set_config('app.phase3_archive_insurance', 'true', false);
\i database_migrations/schema/auth_insurance_tables_archive_phase3.sql
```

Rollback helper is in the same script family (`rollback_phase3_legacy_insurance_bridge`). Do not un-archive casually.

---

## 4. Permissions and JWT (D3)

1. Confirm `ccms.preauth.*`, `ccms.claim.*`, `ccms.clarification.write`, `ccms.enhancement.write`, `ip.emergency_fc.apply` on roles.
2. **Every user must re-login** so JWT `permission` claims are populated.
3. After Wave 1 deploy: **empty permission arrays deny** privileged CCMS/IP writes. Tokens without claims will get 401.

---

## 5. Hangfire / outbox processor (Wave 2)

IP Management (Functions host):

- `Hangfire:Enabled` = `true` (default) — Hangfire recurring job drains outbox every minute.
- Timer `ProcessIntegrationOutbox` (every 30s) is a **backup**; it no-ops when Hangfire is enabled to avoid double-claim races.
- Manual drain: `POST /api/ip-management/integration/outbox/process`
- Stats: `GET /api/ip-management/integration/outbox/stats` (function key) or JWT `…/outbox/health` (`integration.admin`)
- Admin UI: `/dashboard/admin/integration-health` (OPS-070)

---

## 6. Staging smoke (required)

Live runner: `npm run smoke:wave7` (+ `npm run test:e2e:wave7-g3-ui` for UI boxes). See `ip-ccms-wave7-staging-smoke.md`.

- [x] Cash admit while CCMS is down (must not block)
- [x] Insurance `WAITING_APPROVAL` admit BLOCK + `blockReason` on admit panel
- [x] Approved insurance admit ALLOW
- [x] Emergency FC with reason + audit (API projects FC flag; apply+audit covered by integration tests)
- [x] Duplicate `X-Idempotency-Key` on `BillFinalized` / journey events
- [x] Counselling desk shows CCMS decision (ALLOW / WARN / BLOCK) for coverage payment types
- [x] Partial approval shows patient share vs payer share on ward Coverage & Payment Status — `UAT-IP-106` + `_seed_w7_ccms_partial_approval.sql` (API + Playwright)
- [x] Outbox pending age / dead count after a forced CCMS 500 — UAT `ccms_outbox_fail` + `simulate/outbox-probe` (probe-key scoped; does not poison real deliveries)

---

## 7. Locked product policy (do not change in this wave)

PARTIAL_APPROVAL = WARN + admit allowed. Emergency FC does not override REJECTED/EXPIRED/CANCELLED/ABORTED. Coverage-based modes fail closed. Camp / empty payment mode fail open. `X-CCMS-Bypass` retained. OPD `FinalizeBillAsync` unchanged. Enhancements (Phase 4 C) unchanged.
