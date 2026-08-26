-- =============================================================================
-- 169_ip_vital_threshold.sql
-- W-06 A4 — tenant vitals compare for Mark Ready (warn only).
--
-- Locked D-A: dilation/vitals are warnings, not a 5th hard block.
-- Application code always emits severity=warn even if a row is later set to block.
-- Missing tenant row uses in-code defaults (180/110, pulse 40–140, SpO2 92, 38.5 C).
-- Idempotent.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS ip_vital_threshold (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      uuid NOT NULL UNIQUE,
    systolic_max   int NOT NULL DEFAULT 180,
    diastolic_max  int NOT NULL DEFAULT 110,
    pulse_min      int NOT NULL DEFAULT 40,
    pulse_max      int NOT NULL DEFAULT 140,
    spo2_min       numeric(5,2) NOT NULL DEFAULT 92,
    temp_max_c     numeric(4,1) NOT NULL DEFAULT 38.5,
    severity       varchar(16) NOT NULL DEFAULT 'warn'
      CHECK (severity IN ('warn', 'block')),
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE ip_vital_threshold IS
    'W-06 A4 tenant vitals thresholds. Mark Ready uses warn only (D-A).';

INSERT INTO ip_vital_threshold (
    id, tenant_id, systolic_max, diastolic_max, pulse_min, pulse_max,
    spo2_min, temp_max_c, severity, created_at, updated_at)
SELECT gen_random_uuid(), j.tenant_id, 180, 110, 40, 140, 92, 38.5, 'warn', now(), now()
FROM (SELECT DISTINCT tenant_id FROM patient_journey) j
WHERE NOT EXISTS (
    SELECT 1 FROM ip_vital_threshold t WHERE t.tenant_id = j.tenant_id
);

COMMIT;
