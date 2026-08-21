# IP × CCMS Phase 3 — Legacy Retirement & Financial State Consolidation

Status: **Complete after cross-check + residuals** (validated against `03-phase-3-legacy-retirement-and-financial-state-consolidation.md` §1–§10)

Preserves Phase 1 admit gate / Coverage & Payment Status projection and Phase 2 outbox / write freeze.

---

## Residuals closed in this pass

| Residual | Delivery |
|---|---|
| Live bridge APPLY | `apply_phase3_legacy_insurance_bridge(tenant?, dry_run)` — same DB (Auth+CCMS share `hospitalportal`); link-first; no duplicate case create; rollback helper |
| Archive Auth insurance tables | `auth_insurance_tables_archive_phase3.sql` — rename to `archived_*` + compatibility views (opt-in via `app.phase3_archive_insurance`) |
| Delete gallery insurance widgets | Components deleted; registry + gallery cleaned |
| Finance mock invoices | Finance page loads real OPD bills via `opdBillingApi.getOpdBills` |

---

## Apply / archive runbook

```sql
-- 1) Preview links
SELECT * FROM apply_phase3_legacy_insurance_bridge(NULL, true);

-- 2) Persist links
SELECT * FROM apply_phase3_legacy_insurance_bridge(NULL, false);

-- 3) Optional archive (after reviewing orphan_report)
SELECT set_config('app.phase3_archive_insurance', 'true', false);
\i database_migrations/schema/auth_insurance_tables_archive_phase3.sql
```

Orphans: use `migrate_legacy_preauths_to_ccms` (migration 128) only after manual review — Phase 3 APPLY does not auto-create cases.

---

## Docs / artifacts

- Dependency map: `ip-ccms-phase3-legacy-dependency-map.md`
- Bridge SQL: `database_migrations/schema/ccms_legacy_insurance_bridge_phase3.sql`
- Archive SQL: `database_migrations/schema/auth_insurance_tables_archive_phase3.sql`
