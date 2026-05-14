-- ============================================================
-- Migration 109: CCMS Master Data Tables
-- Insurance Providers, TPA Providers, Government Schemes,
-- Coverage Packages, Package Procedures, Exclusion Rules,
-- Document Requirements
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Insurance Providers ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ccms_insurance_providers (
    id                      UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id               UUID        NOT NULL,
    provider_name           VARCHAR(150) NOT NULL,
    provider_code           VARCHAR(30)  NOT NULL,
    license_number          VARCHAR(50),
    contact_email           VARCHAR(150),
    contact_phone           VARCHAR(20),
    portal_url              TEXT,
    api_endpoint            TEXT,
    api_credentials_json    JSONB,          -- encrypted field
    claim_submission_mode   VARCHAR(20)  NOT NULL DEFAULT 'manual',  -- manual|portal|api
    pre_auth_required       BOOLEAN      NOT NULL DEFAULT TRUE,
    address_json            JSONB,
    created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by_user_id      UUID,
    updated_by_user_id      UUID,
    deleted_at              TIMESTAMPTZ,
    status                  VARCHAR(20)  NOT NULL DEFAULT 'active',
    row_version             INT          NOT NULL DEFAULT 1,
    CONSTRAINT uq_ccms_ins_prov_code UNIQUE (tenant_id, provider_code)
);

-- ── TPA Providers ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ccms_tpa_providers (
    id                      UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id               UUID        NOT NULL,
    tpa_name                VARCHAR(150) NOT NULL,
    tpa_code                VARCHAR(30)  NOT NULL,
    insurance_provider_id   UUID        REFERENCES ccms_insurance_providers(id),
    contact_email           VARCHAR(150),
    contact_phone           VARCHAR(20),
    portal_url              TEXT,
    claims_email            VARCHAR(150),
    tat_days_preauth        INT         NOT NULL DEFAULT 3,
    tat_days_claim          INT         NOT NULL DEFAULT 30,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_user_id      UUID,
    updated_by_user_id      UUID,
    deleted_at              TIMESTAMPTZ,
    status                  VARCHAR(20) NOT NULL DEFAULT 'active',
    row_version             INT         NOT NULL DEFAULT 1,
    CONSTRAINT uq_ccms_tpa_code UNIQUE (tenant_id, tpa_code)
);

-- ── Government Schemes ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ccms_government_schemes (
    id                          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id                   UUID        NOT NULL,
    scheme_name                 VARCHAR(150) NOT NULL,
    scheme_code                 VARCHAR(30)  NOT NULL,
    scheme_type                 VARCHAR(20)  NOT NULL DEFAULT 'state', -- central|state|local
    administered_by             VARCHAR(150),
    benefit_limit_per_year      NUMERIC(14,2),
    benefit_limit_per_case      NUMERIC(14,2),
    eligibility_criteria_json   JSONB,
    covered_procedures_json     JSONB,
    documents_required_json     JSONB,
    portal_url                  TEXT,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_user_id          UUID,
    updated_by_user_id          UUID,
    deleted_at                  TIMESTAMPTZ,
    status                      VARCHAR(20) NOT NULL DEFAULT 'active',
    row_version                 INT         NOT NULL DEFAULT 1,
    CONSTRAINT uq_ccms_govt_scheme_code UNIQUE (tenant_id, scheme_code)
);

-- ── Coverage Packages ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ccms_coverage_packages (
    id                      UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id               UUID        NOT NULL,
    package_name            VARCHAR(150) NOT NULL,
    package_code            VARCHAR(30)  NOT NULL,
    insurance_provider_id   UUID        REFERENCES ccms_insurance_providers(id),
    tpa_provider_id         UUID        REFERENCES ccms_tpa_providers(id),
    government_scheme_id    UUID        REFERENCES ccms_government_schemes(id),
    package_type            VARCHAR(20) NOT NULL DEFAULT 'insurance', -- insurance|tpa|govt|cashless
    sum_insured_amount      NUMERIC(14,2) NOT NULL DEFAULT 0,
    room_rent_limit         NUMERIC(14,2),
    icu_rent_limit          NUMERIC(14,2),
    sub_limits_json         JSONB,
    waiting_period_days     INT         NOT NULL DEFAULT 0,
    copay_percent           NUMERIC(5,2) NOT NULL DEFAULT 0,
    deductible_amount       NUMERIC(14,2) NOT NULL DEFAULT 0,
    valid_from              DATE,
    valid_to                DATE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_user_id      UUID,
    updated_by_user_id      UUID,
    deleted_at              TIMESTAMPTZ,
    status                  VARCHAR(20) NOT NULL DEFAULT 'active',
    row_version             INT         NOT NULL DEFAULT 1,
    CONSTRAINT uq_ccms_pkg_code UNIQUE (tenant_id, package_code)
);

-- ── Package Procedures ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ccms_package_procedures (
    id                      UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id               UUID        NOT NULL,
    coverage_package_id     UUID        NOT NULL REFERENCES ccms_coverage_packages(id),
    procedure_code          VARCHAR(50) NOT NULL,
    procedure_name          VARCHAR(200) NOT NULL,
    approved_amount         NUMERIC(14,2) NOT NULL DEFAULT 0,
    requires_preauth        BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_user_id      UUID,
    updated_by_user_id      UUID,
    deleted_at              TIMESTAMPTZ,
    status                  VARCHAR(20) NOT NULL DEFAULT 'active',
    row_version             INT         NOT NULL DEFAULT 1
);

-- ── Exclusion Rules ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ccms_exclusion_rules (
    id                      UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id               UUID        NOT NULL,
    coverage_package_id     UUID        NOT NULL REFERENCES ccms_coverage_packages(id),
    exclusion_type          VARCHAR(30) NOT NULL,  -- diagnosis|procedure|condition
    exclusion_code          VARCHAR(50) NOT NULL,
    description             TEXT,
    is_absolute             BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_user_id      UUID,
    updated_by_user_id      UUID,
    deleted_at              TIMESTAMPTZ,
    status                  VARCHAR(20) NOT NULL DEFAULT 'active',
    row_version             INT         NOT NULL DEFAULT 1
);

-- ── Document Requirements ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ccms_document_requirements (
    id                      UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id               UUID        NOT NULL,
    insurance_provider_id   UUID        REFERENCES ccms_insurance_providers(id),
    tpa_provider_id         UUID        REFERENCES ccms_tpa_providers(id),
    government_scheme_id    UUID        REFERENCES ccms_government_schemes(id),
    document_type           VARCHAR(50) NOT NULL,
    document_name           VARCHAR(150) NOT NULL,
    is_required             BOOLEAN     NOT NULL DEFAULT TRUE,
    applies_at              VARCHAR(20) NOT NULL DEFAULT 'preauth', -- preauth|admission|claim
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_user_id      UUID,
    updated_by_user_id      UUID,
    deleted_at              TIMESTAMPTZ,
    status                  VARCHAR(20) NOT NULL DEFAULT 'active',
    row_version             INT         NOT NULL DEFAULT 1
);

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ccms_ins_prov_tenant     ON ccms_insurance_providers (tenant_id);
CREATE INDEX IF NOT EXISTS idx_ccms_tpa_tenant          ON ccms_tpa_providers (tenant_id);
CREATE INDEX IF NOT EXISTS idx_ccms_tpa_ins_prov        ON ccms_tpa_providers (insurance_provider_id);
CREATE INDEX IF NOT EXISTS idx_ccms_govt_tenant         ON ccms_government_schemes (tenant_id);
CREATE INDEX IF NOT EXISTS idx_ccms_pkg_tenant          ON ccms_coverage_packages (tenant_id);
CREATE INDEX IF NOT EXISTS idx_ccms_pkg_ins_prov        ON ccms_coverage_packages (insurance_provider_id);
CREATE INDEX IF NOT EXISTS idx_ccms_pkg_tpa             ON ccms_coverage_packages (tpa_provider_id);
CREATE INDEX IF NOT EXISTS idx_ccms_pkg_govt            ON ccms_coverage_packages (government_scheme_id);
CREATE INDEX IF NOT EXISTS idx_ccms_pkg_proc_pkg        ON ccms_package_procedures (coverage_package_id);
CREATE INDEX IF NOT EXISTS idx_ccms_excl_pkg            ON ccms_exclusion_rules (coverage_package_id);
CREATE INDEX IF NOT EXISTS idx_ccms_doc_req_ins         ON ccms_document_requirements (insurance_provider_id);
CREATE INDEX IF NOT EXISTS idx_ccms_doc_req_tpa         ON ccms_document_requirements (tpa_provider_id);
CREATE INDEX IF NOT EXISTS idx_ccms_doc_req_govt        ON ccms_document_requirements (government_scheme_id);

-- ── Row-Level Security ───────────────────────────────────────────────────────
ALTER TABLE ccms_insurance_providers  ENABLE ROW LEVEL SECURITY;
ALTER TABLE ccms_tpa_providers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE ccms_government_schemes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ccms_coverage_packages    ENABLE ROW LEVEL SECURITY;
ALTER TABLE ccms_package_procedures   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ccms_exclusion_rules      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ccms_document_requirements ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ccms_insurance_providers' AND policyname='tenant_isolation') THEN
        CREATE POLICY tenant_isolation ON ccms_insurance_providers FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ccms_tpa_providers' AND policyname='tenant_isolation') THEN
        CREATE POLICY tenant_isolation ON ccms_tpa_providers FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ccms_government_schemes' AND policyname='tenant_isolation') THEN
        CREATE POLICY tenant_isolation ON ccms_government_schemes FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ccms_coverage_packages' AND policyname='tenant_isolation') THEN
        CREATE POLICY tenant_isolation ON ccms_coverage_packages FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ccms_package_procedures' AND policyname='tenant_isolation') THEN
        CREATE POLICY tenant_isolation ON ccms_package_procedures FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ccms_exclusion_rules' AND policyname='tenant_isolation') THEN
        CREATE POLICY tenant_isolation ON ccms_exclusion_rules FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ccms_document_requirements' AND policyname='tenant_isolation') THEN
        CREATE POLICY tenant_isolation ON ccms_document_requirements FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true));
    END IF;
END $$;

COMMIT;
