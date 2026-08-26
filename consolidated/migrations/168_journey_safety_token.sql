-- =============================================================================
-- 168_journey_safety_token.sql
-- W-05 A5 — one active inpatient wristband token per journey (FR-3.2).
--
-- token_code = WB-{yyMMdd}-{seq:D5} per tenant/day.
-- barcode_value encodes token_code + UHID + laterality (not a second MRN).
-- Reprint updates printed_at; it does not mint a second active token.
-- Idempotent.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS journey_safety_token (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      uuid NOT NULL,
    journey_id     uuid NOT NULL REFERENCES patient_journey(id),
    token_code     varchar(32) NOT NULL,
    barcode_value  varchar(64) NOT NULL,
    laterality     varchar(8),
    printed_at     timestamptz,
    printed_by     uuid,
    revoked_at     timestamptz,
    created_at     timestamptz NOT NULL DEFAULT now(),
    created_by     uuid NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_journey_safety_token_active
    ON journey_safety_token (tenant_id, journey_id) WHERE revoked_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_journey_safety_token_code
    ON journey_safety_token (tenant_id, token_code);

COMMENT ON TABLE journey_safety_token IS
    'W-05 A5 inpatient wristband. One active token per journey until revoked.';

COMMIT;
