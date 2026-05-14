-- ============================================================
-- Migration 113: CCMS Enhancement Requests
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS ccms_enhancement_requests (
    id                      UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id               UUID        NOT NULL,
    coverage_case_id        UUID        NOT NULL REFERENCES ccms_coverage_cases(id),
    enhancement_type        VARCHAR(30) NOT NULL DEFAULT 'amount',  -- amount|procedure|room_class
    requested_amount        NUMERIC(14,2) NOT NULL DEFAULT 0,
    approved_amount         NUMERIC(14,2) NOT NULL DEFAULT 0,
    reason                  TEXT,
    reason_json             JSONB,
    submitted_at            TIMESTAMPTZ,
    decided_at              TIMESTAMPTZ,
    decision_by             UUID,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_user_id      UUID,
    updated_by_user_id      UUID,
    deleted_at              TIMESTAMPTZ,
    status                  VARCHAR(20) NOT NULL DEFAULT 'active',
    row_version             INT         NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS ccms_enhancement_events (
    id                      UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id               UUID        NOT NULL,
    enhancement_request_id  UUID        NOT NULL REFERENCES ccms_enhancement_requests(id),
    event_type              VARCHAR(50) NOT NULL,
    event_payload_json      JSONB,
    actor_user_id           UUID,
    event_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_user_id      UUID,
    updated_by_user_id      UUID,
    deleted_at              TIMESTAMPTZ,
    status                  VARCHAR(20) NOT NULL DEFAULT 'active',
    row_version             INT         NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_ccms_enh_req_case   ON ccms_enhancement_requests (coverage_case_id);
CREATE INDEX IF NOT EXISTS idx_ccms_enh_evt_req    ON ccms_enhancement_events (enhancement_request_id);

ALTER TABLE ccms_enhancement_requests  ENABLE ROW LEVEL SECURITY;
ALTER TABLE ccms_enhancement_events    ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ccms_enhancement_requests' AND policyname='tenant_isolation') THEN
        CREATE POLICY tenant_isolation ON ccms_enhancement_requests FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ccms_enhancement_events' AND policyname='tenant_isolation') THEN
        CREATE POLICY tenant_isolation ON ccms_enhancement_events FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true));
    END IF;
END $$;

COMMIT;
