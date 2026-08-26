-- P2 — Review orphan_report rows from Phase 3 legacy insurance bridge.
-- Does NOT create CCMS cases. Product default: leave as historical-only.
--
-- Usage:
--   SELECT * FROM review_phase3_orphan_legacy_preauths();
--
-- Controlled migrate (only if ops writes a decision record): do not run
-- apply_phase3_legacy_insurance_bridge CREATE path from here.

CREATE OR REPLACE FUNCTION review_phase3_orphan_legacy_preauths()
RETURNS TABLE (
    batch_row_id     UUID,
    batch_id         UUID,
    ran_at           TIMESTAMPTZ,
    tenant_id        UUID,
    legacy_preauth_id UUID,
    session_preauth_id UUID,
    notes            TEXT,
    recommendation   TEXT
)
LANGUAGE sql
STABLE
AS $$
    SELECT
        b.id,
        b.batch_id,
        b.ran_at,
        b.tenant_id,
        b.legacy_preauth_id,
        b.session_preauth_id,
        b.notes,
        'historical_only'::text AS recommendation
    FROM ccms_phase3_legacy_bridge_batch b
    WHERE b.action = 'orphan_report'
      AND COALESCE(b.dry_run, false) = false
    ORDER BY b.ran_at DESC, b.id;
$$;

COMMENT ON FUNCTION review_phase3_orphan_legacy_preauths() IS
    'P2: lists Phase 3 orphan legacy preauths. Default recommendation is historical_only; do not auto-create CCMS cases.';
