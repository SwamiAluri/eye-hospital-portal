-- ============================================================
-- Migration 125: CCMS Underwriting Condition Code seed data
--   Creates the reference table ccms_underwriting_conditions
--   (standard pre-existing condition catalog) and seeds the
--   standard chronic conditions used by the UnderwritingPanel.
-- ============================================================

BEGIN;

-- ── Reference table ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ccms_underwriting_conditions (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    condition_code  VARCHAR(50) NOT NULL,
    condition_name  VARCHAR(200) NOT NULL,
    category        VARCHAR(50) NOT NULL DEFAULT 'chronic',   -- chronic|lifestyle|infectious|other
    sort_order      INT         NOT NULL DEFAULT 0,
    is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_underwriting_condition_code UNIQUE (condition_code)
);

COMMENT ON TABLE ccms_underwriting_conditions IS
    'Catalog of pre-existing conditions shown in the underwriting capture panel.';

-- ── Seed: standard chronic conditions ────────────────────────────────────

INSERT INTO ccms_underwriting_conditions (condition_code, condition_name, category, sort_order)
VALUES
    ('DIABETES_T1',     'Diabetes Mellitus – Type I',             'chronic',    10),
    ('DIABETES_T2',     'Diabetes Mellitus – Type II',            'chronic',    20),
    ('HYPERTENSION',    'Hypertension (High Blood Pressure)',      'chronic',    30),
    ('HEART_DISEASE',   'Coronary Artery / Heart Disease',        'chronic',    40),
    ('ASTHMA',          'Asthma / COPD',                          'chronic',    50),
    ('KIDNEY_DISEASE',  'Chronic Kidney Disease',                 'chronic',    60),
    ('LIVER_DISEASE',   'Chronic Liver Disease / Cirrhosis',      'chronic',    70),
    ('THYROID',         'Thyroid Disorder (Hypo / Hyper)',        'chronic',    80),
    ('CANCER',          'Cancer / Malignancy (current or past)',  'chronic',    90),
    ('EPILEPSY',        'Epilepsy / Seizure Disorder',            'chronic',   100),
    ('ARTHRITIS',       'Arthritis / Joint Disorder',             'chronic',   110),
    ('PSYCHIATRIC',     'Psychiatric / Mental Health Disorder',   'chronic',   120),
    ('ALCOHOL_USE',     'Alcohol Dependency',                     'lifestyle', 200),
    ('TOBACCO_USE',     'Tobacco / Smoking',                      'lifestyle', 210),
    ('HIV_RISK',        'HIV / AIDS',                             'infectious',300),
    ('STD',             'Other Sexually Transmitted Disease',     'infectious',310)
ON CONFLICT (condition_code) DO NOTHING;

-- ── ccms_visit_insurance_policies: store underwriting as structured JSON ──
-- The underwriting_snapshot_json column was created in migration 122.
-- Document the expected schema here for reference:
--
-- {
--   "conditions": [
--     { "code": "DIABETES_T2", "sinceYear": 2015 },
--     { "code": "HYPERTENSION", "sinceYear": 2018 }
--   ],
--   "alcoholUse": false,
--   "tobaccoUse": true,
--   "hivRisk": false,
--   "otherAilments": "Seasonal allergies"
-- }

COMMIT;
