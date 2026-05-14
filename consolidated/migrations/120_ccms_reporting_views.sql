-- ============================================================
-- Migration 120: CCMS Reporting Views
-- ============================================================

BEGIN;

-- ── Case Summary View ────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_ccms_case_summary AS
SELECT
    cc.tenant_id,
    cc.id                   AS case_id,
    cc.case_number,
    cc.current_state,
    cc.payer_type,
    cc.patient_id,
    cc.patient_name,
    cc.approved_amount,
    ip.name                 AS insurance_provider_name,
    tpa.name                AS tpa_provider_name,
    gs.scheme_name          AS govt_scheme_name,
    cp.package_name         AS coverage_package_name,
    ca.pre_auth_number,
    ca.valid_to             AS preauth_valid_to,
    cc.created_at,
    cc.updated_at,
    fy.year_code            AS financial_year_code
FROM ccms_coverage_cases cc
LEFT JOIN ccms_financial_years        fy  ON cc.financial_year_id    = fy.id
LEFT JOIN ccms_insurance_providers    ip  ON cc.insurance_provider_id = ip.id
LEFT JOIN ccms_tpa_providers          tpa ON cc.tpa_provider_id       = tpa.id
LEFT JOIN ccms_government_schemes     gs  ON cc.government_scheme_id  = gs.id
LEFT JOIN ccms_coverage_packages      cp  ON cc.coverage_package_id   = cp.id
LEFT JOIN LATERAL (
    SELECT pre_auth_number, valid_to
    FROM ccms_coverage_authorizations
    WHERE coverage_case_id = cc.id AND deleted_at IS NULL
    ORDER BY created_at DESC
    LIMIT 1
) ca ON true
WHERE cc.deleted_at IS NULL;

-- ── Settlement Summary View ──────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_ccms_settlement_summary AS
SELECT
    s.tenant_id,
    s.id                    AS settlement_id,
    s.settlement_number,
    s.settlement_type,
    s.settled_amount,
    s.claim_amount,
    s.outstanding_amount,
    s.payment_date,
    s.payment_reference,
    cc.case_number,
    cc.patient_name,
    cc.payer_type,
    ip.name                 AS insurance_provider_name,
    tpa.name                AS tpa_provider_name
FROM ccms_settlements s
JOIN ccms_coverage_cases cc ON s.coverage_case_id = cc.id
LEFT JOIN ccms_insurance_providers ip ON cc.insurance_provider_id = ip.id
LEFT JOIN ccms_tpa_providers tpa       ON cc.tpa_provider_id       = tpa.id
WHERE s.deleted_at IS NULL;

-- ── Pending Claims View ──────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_ccms_pending_claims AS
SELECT
    clp.tenant_id,
    clp.id                  AS claim_id,
    clp.claim_number,
    clp.claimed_amount,
    clp.claim_type,
    clp.submitted_at,
    clp.expected_settlement_date,
    cc.case_number,
    cc.patient_name,
    cc.payer_type,
    cc.current_state,
    ip.name                 AS insurance_provider_name,
    tpa.name                AS tpa_provider_name
FROM ccms_claim_packets clp
JOIN ccms_coverage_cases cc ON clp.coverage_case_id = cc.id
LEFT JOIN ccms_insurance_providers ip ON cc.insurance_provider_id = ip.id
LEFT JOIN ccms_tpa_providers tpa       ON cc.tpa_provider_id       = tpa.id
WHERE clp.deleted_at IS NULL
  AND clp.status = 'active'
  AND cc.current_state NOT IN ('FULL_SETTLEMENT', 'RECONCILED', 'CLOSED', 'REJECTED', 'CANCELLED', 'ABORTED');

COMMIT;
