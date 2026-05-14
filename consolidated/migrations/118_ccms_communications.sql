-- ============================================================
-- Migration 118: CCMS Communications
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS ccms_communication_logs (
    id                      UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id               UUID        NOT NULL,
    coverage_case_id        UUID        NOT NULL REFERENCES ccms_coverage_cases(id),
    channel                 VARCHAR(20) NOT NULL,  -- email|sms|whatsapp|portal
    direction               VARCHAR(10) NOT NULL DEFAULT 'outbound',  -- inbound|outbound
    recipient_type          VARCHAR(20) NOT NULL,  -- patient|tpa|insurance|internal
    recipient_ref           VARCHAR(200),
    subject                 VARCHAR(200),
    body                    TEXT,
    template_code           VARCHAR(50),
    sent_at                 TIMESTAMPTZ,
    delivered_at            TIMESTAMPTZ,
    read_at                 TIMESTAMPTZ,
    error_message           TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_user_id      UUID,
    updated_by_user_id      UUID,
    deleted_at              TIMESTAMPTZ,
    status                  VARCHAR(20) NOT NULL DEFAULT 'active',
    row_version             INT         NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS ccms_communication_templates (
    id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id           UUID        NOT NULL,
    template_code       VARCHAR(50) NOT NULL,
    channel             VARCHAR(20) NOT NULL,
    language_code       VARCHAR(5)  NOT NULL DEFAULT 'en',
    subject_template    VARCHAR(200),
    body_template       TEXT        NOT NULL,
    is_system_template  BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_user_id  UUID,
    updated_by_user_id  UUID,
    deleted_at          TIMESTAMPTZ,
    status              VARCHAR(20) NOT NULL DEFAULT 'active',
    row_version         INT         NOT NULL DEFAULT 1,
    CONSTRAINT uq_ccms_tmpl UNIQUE (tenant_id, template_code, channel, language_code)
);

CREATE INDEX IF NOT EXISTS idx_ccms_comm_log_case    ON ccms_communication_logs (coverage_case_id);
CREATE INDEX IF NOT EXISTS idx_ccms_comm_tmpl_code   ON ccms_communication_templates (tenant_id, template_code);

ALTER TABLE ccms_communication_logs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ccms_communication_templates ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ccms_communication_logs' AND policyname='tenant_isolation') THEN
        CREATE POLICY tenant_isolation ON ccms_communication_logs FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ccms_communication_templates' AND policyname='tenant_isolation') THEN
        CREATE POLICY tenant_isolation ON ccms_communication_templates FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true));
    END IF;
END $$;

COMMIT;
