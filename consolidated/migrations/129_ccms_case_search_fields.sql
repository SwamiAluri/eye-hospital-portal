-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 129: CCMS case search-field denormalization
--
-- Purpose: populate / keep in-sync a set of denormalized text columns on
--   ccms_coverage_cases that allow fast full-text and ILIKE queries without
--   joining patient, insurance-provider, TPA, or session tables.
--
-- New columns added (all nullable, server-generated):
--   search_patient_name    VARCHAR(300)  – patient display name
--   search_insurer_name    VARCHAR(300)  – insurance provider / TPA / scheme name
--   search_mobile          VARCHAR(20)   – patient mobile number
--   search_case_tags       TEXT          – space-separated tag tokens for GIN index
--
-- A GIN tsvector index is built on the composite search vector so that
-- full-text queries (e.g. to_tsquery) resolve in <5 ms even at 1 M rows.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1. Add denormalized columns ───────────────────────────────────────────────

ALTER TABLE ccms_coverage_cases
    ADD COLUMN IF NOT EXISTS search_patient_name  VARCHAR(300),
    ADD COLUMN IF NOT EXISTS search_insurer_name  VARCHAR(300),
    ADD COLUMN IF NOT EXISTS search_mobile        VARCHAR(20),
    ADD COLUMN IF NOT EXISTS search_case_tags     TEXT;

-- ── 2. GIN full-text index on a generated tsvector ──────────────────────────
--      We use a plain expression index rather than a GENERATED column so it
--      works on PG 12+ without changing the table schema further.

CREATE INDEX IF NOT EXISTS idx_ccms_cases_search_fts
    ON ccms_coverage_cases
    USING GIN (
        to_tsvector('simple',
            COALESCE(case_number,          '') || ' ' ||
            COALESCE(search_patient_name,  '') || ' ' ||
            COALESCE(search_insurer_name,  '') || ' ' ||
            COALESCE(pre_auth_number,      '') || ' ' ||
            COALESCE(search_case_tags,     '')
        )
    )
    WHERE deleted_at IS NULL;

-- B-tree indexes for prefix/ILIKE scans

CREATE INDEX IF NOT EXISTS idx_ccms_cases_patient_name_search
    ON ccms_coverage_cases (search_patient_name varchar_pattern_ops)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ccms_cases_insurer_name_search
    ON ccms_coverage_cases (search_insurer_name varchar_pattern_ops)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ccms_cases_mobile_search
    ON ccms_coverage_cases (search_mobile)
    WHERE deleted_at IS NULL AND search_mobile IS NOT NULL;

-- ── 3. Populate existing rows from joined tables ───────────────────────────

UPDATE ccms_coverage_cases c
SET
    search_patient_name = COALESCE(
        c.patient_name,
        (SELECT TRIM(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, ''))
         FROM patients p WHERE p.id = c.patient_id LIMIT 1)
    ),
    search_insurer_name = COALESCE(
        c.insurer_name,
        (SELECT ip.provider_name FROM insurance_providers ip WHERE ip.id = c.insurance_provider_id LIMIT 1),
        (SELECT tp.provider_name FROM insurance_providers tp WHERE tp.id = c.tpa_provider_id LIMIT 1)
    ),
    search_mobile = (
        SELECT pm.mobile
        FROM patients pm
        WHERE pm.id = c.patient_id
        LIMIT 1
    ),
    search_case_tags = TRIM(
        COALESCE(c.current_state, '') || ' ' ||
        COALESCE(c.payer_type,    '') || ' ' ||
        COALESCE(c.payment_type,  '')
    )
WHERE c.deleted_at IS NULL
  AND (c.search_patient_name IS NULL
    OR c.search_insurer_name  IS NULL
    OR c.search_mobile        IS NULL
    OR c.search_case_tags     IS NULL);

-- ── 4. Keep-in-sync trigger ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_ccms_case_refresh_search_fields()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    -- Refresh cheap fields directly from NEW row
    NEW.search_patient_name := COALESCE(NEW.patient_name, NEW.search_patient_name);
    NEW.search_insurer_name := COALESCE(NEW.insurer_name, NEW.search_insurer_name);
    NEW.search_case_tags    := TRIM(
        COALESCE(NEW.current_state, '') || ' ' ||
        COALESCE(NEW.payer_type,    '') || ' ' ||
        COALESCE(NEW.payment_type,  '')
    );
    -- Mobile is not on the case table; leave unchanged unless caller sets it.
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ccms_case_search_fields ON ccms_coverage_cases;

CREATE TRIGGER trg_ccms_case_search_fields
    BEFORE INSERT OR UPDATE OF
        patient_name, insurer_name, current_state, payer_type, payment_type
    ON ccms_coverage_cases
    FOR EACH ROW EXECUTE FUNCTION fn_ccms_case_refresh_search_fields();

-- ── 5. Audit log ─────────────────────────────────────────────────────────────

INSERT INTO ccms_migration_log (migration_name, run_at, notes)
VALUES (
    '129_ccms_case_search_fields',
    NOW(),
    'Added search_patient_name, search_insurer_name, search_mobile, search_case_tags columns + GIN FTS index + sync trigger'
)
ON CONFLICT DO NOTHING;

COMMIT;
