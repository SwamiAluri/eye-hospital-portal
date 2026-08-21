-- Phase 3 residual — LIVE APPLY for legacy Auth insurance → CCMS bridges
--
-- Environment note: Auth + CCMS share the same Postgres database (`hospitalportal`).
-- No FDW required. Staging tables are optional for cross-environment ETL only.
--
-- Prefer LINK over CREATE (no duplicate cases).
-- Default dry_run = true. Set p_dry_run=false to persist.
--
-- Examples:
--   SELECT * FROM apply_phase3_legacy_insurance_bridge(NULL, true);   -- all tenants, preview
--   SELECT * FROM apply_phase3_legacy_insurance_bridge('<tenant>', false);

BEGIN;

CREATE TABLE IF NOT EXISTS ccms_phase3_legacy_bridge_batch (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id           UUID NOT NULL DEFAULT gen_random_uuid(),
    ran_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    tenant_id          UUID NULL,
    case_id            UUID NULL,
    legacy_preauth_id  UUID NULL,
    session_preauth_id UUID NULL,
    action             TEXT NOT NULL, -- link_legacy | link_session | orphan_report
    dry_run            BOOLEAN NOT NULL DEFAULT true,
    notes              TEXT NULL
);

-- Repair early installs that incorrectly used batch_id as the row PK.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ccms_phase3_legacy_bridge_batch' AND column_name = 'batch_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ccms_phase3_legacy_bridge_batch' AND column_name = 'id'
  ) THEN
    ALTER TABLE ccms_phase3_legacy_bridge_batch DROP CONSTRAINT IF EXISTS ccms_phase3_legacy_bridge_batch_pkey;
    ALTER TABLE ccms_phase3_legacy_bridge_batch ADD COLUMN id UUID DEFAULT gen_random_uuid();
    UPDATE ccms_phase3_legacy_bridge_batch SET id = gen_random_uuid() WHERE id IS NULL;
    ALTER TABLE ccms_phase3_legacy_bridge_batch ALTER COLUMN id SET NOT NULL;
    ALTER TABLE ccms_phase3_legacy_bridge_batch ADD PRIMARY KEY (id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_ccms_phase3_bridge_batch_id
    ON ccms_phase3_legacy_bridge_batch (batch_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ccms_cases_legacy_preauth
    ON ccms_coverage_cases (legacy_preauth_id)
    WHERE legacy_preauth_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ccms_cases_session_preauth
    ON ccms_coverage_cases (session_preauth_id)
    WHERE session_preauth_id IS NOT NULL;

CREATE OR REPLACE FUNCTION apply_phase3_legacy_insurance_bridge(
    p_tenant_id UUID DEFAULT NULL,
    p_dry_run   BOOLEAN DEFAULT true
)
RETURNS TABLE (
    action_out   TEXT,
    case_id_out  UUID,
    bridge_id    UUID,
    tenant_out   UUID,
    status_out   TEXT,
    detail_out   TEXT
)
LANGUAGE plpgsql AS $$
DECLARE
    v_rec RECORD;
    v_batch UUID := gen_random_uuid();
BEGIN
    -- ── 1) Link Module 3.6 pre-auths to existing cases by session_id ─────────
    FOR v_rec IN
        SELECT
            c.id AS case_id,
            p.id AS legacy_id,
            p.tenant_id,
            p.session_id,
            p.pre_auth_number
        FROM insurance_pre_authorizations p
        JOIN ccms_coverage_cases c
          ON c.tenant_id = p.tenant_id
         AND c.session_id = p.session_id
         AND c.deleted_at IS NULL
        WHERE p.deleted_at IS NULL
          AND (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id)
          AND c.legacy_preauth_id IS NULL
          AND NOT EXISTS (
                SELECT 1 FROM ccms_coverage_cases x
                WHERE x.legacy_preauth_id = p.id
          )
        ORDER BY p.created_at
    LOOP
        IF NOT p_dry_run THEN
            UPDATE ccms_coverage_cases
               SET legacy_preauth_id = v_rec.legacy_id,
                   updated_at = NOW()
             WHERE id = v_rec.case_id
               AND legacy_preauth_id IS NULL;

            INSERT INTO ccms_phase3_legacy_bridge_batch (
                batch_id, tenant_id, case_id, legacy_preauth_id, action, dry_run, notes
            ) VALUES (
                v_batch, v_rec.tenant_id, v_rec.case_id, v_rec.legacy_id,
                'link_legacy', false,
                coalesce(v_rec.pre_auth_number, 'linked by session')
            );
        END IF;

        action_out  := 'link_legacy';
        case_id_out := v_rec.case_id;
        bridge_id   := v_rec.legacy_id;
        tenant_out  := v_rec.tenant_id;
        status_out  := CASE WHEN p_dry_run THEN 'dry_run' ELSE 'applied' END;
        detail_out  := 'Linked insurance_pre_authorizations → coverage case by session_id';
        RETURN NEXT;
    END LOOP;

    -- ── 2) Link insurance_preauth_requests by session_id ─────────────────────
    FOR v_rec IN
        SELECT
            c.id AS case_id,
            r.id AS session_preauth_id,
            r.tenant_id,
            r.session_id,
            r.preauth_request_number
        FROM insurance_preauth_requests r
        JOIN ccms_coverage_cases c
          ON c.tenant_id = r.tenant_id
         AND c.session_id = r.session_id
         AND c.deleted_at IS NULL
        WHERE r.deleted_at IS NULL
          AND (p_tenant_id IS NULL OR r.tenant_id = p_tenant_id)
          AND c.session_preauth_id IS NULL
          AND NOT EXISTS (
                SELECT 1 FROM ccms_coverage_cases x
                WHERE x.session_preauth_id = r.id
          )
        ORDER BY r.created_at
    LOOP
        IF NOT p_dry_run THEN
            UPDATE ccms_coverage_cases
               SET session_preauth_id = v_rec.session_preauth_id,
                   updated_at = NOW()
             WHERE id = v_rec.case_id
               AND session_preauth_id IS NULL;

            INSERT INTO ccms_phase3_legacy_bridge_batch (
                batch_id, tenant_id, case_id, session_preauth_id, action, dry_run, notes
            ) VALUES (
                v_batch, v_rec.tenant_id, v_rec.case_id, v_rec.session_preauth_id,
                'link_session', false,
                coalesce(v_rec.preauth_request_number, 'linked by session')
            );
        END IF;

        action_out  := 'link_session';
        case_id_out := v_rec.case_id;
        bridge_id   := v_rec.session_preauth_id;
        tenant_out  := v_rec.tenant_id;
        status_out  := CASE WHEN p_dry_run THEN 'dry_run' ELSE 'applied' END;
        detail_out  := 'Linked insurance_preauth_requests → coverage case by session_id';
        RETURN NEXT;
    END LOOP;

    -- ── 3) Report orphans (no case for session) — do NOT auto-create ─────────
    FOR v_rec IN
        SELECT p.id AS legacy_id, p.tenant_id, p.session_id, p.pre_auth_number
        FROM insurance_pre_authorizations p
        WHERE p.deleted_at IS NULL
          AND (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id)
          AND NOT EXISTS (
                SELECT 1 FROM ccms_coverage_cases c
                WHERE c.legacy_preauth_id = p.id
                   OR (c.tenant_id = p.tenant_id AND c.session_id = p.session_id AND c.deleted_at IS NULL)
          )
        ORDER BY p.created_at
        LIMIT 500
    LOOP
        IF NOT p_dry_run THEN
            INSERT INTO ccms_phase3_legacy_bridge_batch (
                batch_id, tenant_id, case_id, legacy_preauth_id, action, dry_run, notes
            ) VALUES (
                v_batch, v_rec.tenant_id, NULL,
                v_rec.legacy_id, 'orphan_report', false,
                coalesce(v_rec.pre_auth_number, 'no matching coverage case')
            );
        END IF;

        action_out  := 'orphan_report';
        case_id_out := NULL;
        bridge_id   := v_rec.legacy_id;
        tenant_out  := v_rec.tenant_id;
        status_out  := 'needs_manual_or_migrate_128';
        detail_out  := 'No CCMS case for session; use migrate_legacy_preauths_to_ccms only after review';
        RETURN NEXT;
    END LOOP;
END;
$$;

COMMENT ON FUNCTION apply_phase3_legacy_insurance_bridge IS
  'Phase 3: idempotent link of Auth legacy preauth IDs onto existing CCMS cases. Dry-run by default. Does not create duplicate cases.';

-- Rollback helper for last applied batch hour (link_* only)
CREATE OR REPLACE FUNCTION rollback_phase3_legacy_insurance_bridge(
    p_since TIMESTAMPTZ DEFAULT NOW() - INTERVAL '1 hour'
)
RETURNS INT
LANGUAGE plpgsql AS $$
DECLARE
    n INT := 0;
BEGIN
    UPDATE ccms_coverage_cases c
       SET legacy_preauth_id = NULL,
           updated_at = NOW()
      FROM ccms_phase3_legacy_bridge_batch b
     WHERE c.id = b.case_id
       AND b.action = 'link_legacy'
       AND b.dry_run = false
       AND b.ran_at >= p_since
       AND c.legacy_preauth_id = b.legacy_preauth_id;
    GET DIAGNOSTICS n = ROW_COUNT;

    UPDATE ccms_coverage_cases c
       SET session_preauth_id = NULL,
           updated_at = NOW()
      FROM ccms_phase3_legacy_bridge_batch b
     WHERE c.id = b.case_id
       AND b.action = 'link_session'
       AND b.dry_run = false
       AND b.ran_at >= p_since
       AND c.session_preauth_id = b.session_preauth_id;

    RETURN n;
END;
$$;

COMMIT;

-- Field mapping smoke (documentation query)
SELECT
  'insurance_pre_authorizations.id' AS source_field,
  'ccms_coverage_cases.legacy_preauth_id' AS target_field,
  'preserve + link by session_id' AS id_strategy
UNION ALL
SELECT
  'insurance_preauth_requests.id',
  'ccms_coverage_cases.session_preauth_id',
  'preserve + link by session_id';
