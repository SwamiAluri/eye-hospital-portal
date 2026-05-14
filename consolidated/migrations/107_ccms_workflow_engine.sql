-- ============================================================
-- Migration 107: CCMS Workflow Engine Tables
-- ============================================================
-- 5 tables: definitions, states, transitions, instances, history
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Workflow Definitions ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ccms_workflow_definitions (
    id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id           UUID        NOT NULL,
    name                VARCHAR(100) NOT NULL,
    code                VARCHAR(50)  NOT NULL,
    version             INT          NOT NULL DEFAULT 1,
    is_active           BOOLEAN      NOT NULL DEFAULT TRUE,
    config_json         JSONB,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by_user_id  UUID,
    updated_by_user_id  UUID,
    deleted_at          TIMESTAMPTZ,
    status              VARCHAR(20)  NOT NULL DEFAULT 'active',
    row_version         INT          NOT NULL DEFAULT 1,
    CONSTRAINT uq_ccms_wf_def_code_version UNIQUE (tenant_id, code, version)
);

-- ── Workflow States ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ccms_workflow_states (
    id                      UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id               UUID        NOT NULL,
    workflow_definition_id  UUID        NOT NULL REFERENCES ccms_workflow_definitions(id),
    state_code              VARCHAR(50) NOT NULL,
    state_label             VARCHAR(100) NOT NULL,
    is_initial              BOOLEAN     NOT NULL DEFAULT FALSE,
    is_final                BOOLEAN     NOT NULL DEFAULT FALSE,
    is_terminal             BOOLEAN     NOT NULL DEFAULT FALSE,   -- rejected/cancelled/aborted/expired
    sort_order              INT         NOT NULL DEFAULT 0,
    meta_json               JSONB,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_user_id      UUID,
    updated_by_user_id      UUID,
    deleted_at              TIMESTAMPTZ,
    status                  VARCHAR(20) NOT NULL DEFAULT 'active',
    row_version             INT         NOT NULL DEFAULT 1,
    CONSTRAINT uq_ccms_wf_state_code UNIQUE (workflow_definition_id, state_code)
);

-- ── Workflow Transitions ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ccms_workflow_transitions (
    id                      UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id               UUID        NOT NULL,
    workflow_definition_id  UUID        NOT NULL REFERENCES ccms_workflow_definitions(id),
    from_state_id           UUID        NOT NULL REFERENCES ccms_workflow_states(id),
    to_state_id             UUID        NOT NULL REFERENCES ccms_workflow_states(id),
    trigger_event           VARCHAR(50) NOT NULL,
    requires_role           VARCHAR(100),
    is_automatic            BOOLEAN     NOT NULL DEFAULT FALSE,
    guard_condition_json    JSONB,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_user_id      UUID,
    updated_by_user_id      UUID,
    deleted_at              TIMESTAMPTZ,
    status                  VARCHAR(20) NOT NULL DEFAULT 'active',
    row_version             INT         NOT NULL DEFAULT 1
);

-- ── Workflow Instances ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ccms_workflow_instances (
    id                      UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id               UUID        NOT NULL,
    workflow_definition_id  UUID        NOT NULL REFERENCES ccms_workflow_definitions(id),
    current_state_id        UUID        NOT NULL REFERENCES ccms_workflow_states(id),
    entity_type             VARCHAR(50) NOT NULL,    -- 'coverage_case'
    entity_id               UUID        NOT NULL,
    context_json            JSONB,
    started_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at            TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_user_id      UUID,
    updated_by_user_id      UUID,
    deleted_at              TIMESTAMPTZ,
    status                  VARCHAR(20) NOT NULL DEFAULT 'active',
    row_version             INT         NOT NULL DEFAULT 1
);

-- ── Workflow History ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ccms_workflow_history (
    id                      UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id               UUID        NOT NULL,
    workflow_instance_id    UUID        NOT NULL REFERENCES ccms_workflow_instances(id),
    from_state_id           UUID        REFERENCES ccms_workflow_states(id),
    to_state_id             UUID        NOT NULL REFERENCES ccms_workflow_states(id),
    trigger_event           VARCHAR(50) NOT NULL,
    actor_user_id           UUID,
    notes                   TEXT,
    transitioned_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    meta_json               JSONB,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_user_id      UUID,
    updated_by_user_id      UUID,
    deleted_at              TIMESTAMPTZ,
    status                  VARCHAR(20) NOT NULL DEFAULT 'active',
    row_version             INT         NOT NULL DEFAULT 1
);

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ccms_wf_def_tenant    ON ccms_workflow_definitions (tenant_id);
CREATE INDEX IF NOT EXISTS idx_ccms_wf_state_def     ON ccms_workflow_states (workflow_definition_id);
CREATE INDEX IF NOT EXISTS idx_ccms_wf_trans_def     ON ccms_workflow_transitions (workflow_definition_id);
CREATE INDEX IF NOT EXISTS idx_ccms_wf_trans_from    ON ccms_workflow_transitions (from_state_id);
CREATE INDEX IF NOT EXISTS idx_ccms_wf_inst_entity   ON ccms_workflow_instances (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_ccms_wf_inst_tenant   ON ccms_workflow_instances (tenant_id);
CREATE INDEX IF NOT EXISTS idx_ccms_wf_hist_inst     ON ccms_workflow_history (workflow_instance_id);

-- ── Row-Level Security ───────────────────────────────────────────────────────
ALTER TABLE ccms_workflow_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ccms_workflow_states      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ccms_workflow_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ccms_workflow_instances   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ccms_workflow_history     ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ccms_workflow_definitions' AND policyname='tenant_isolation') THEN
        CREATE POLICY tenant_isolation ON ccms_workflow_definitions FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ccms_workflow_states' AND policyname='tenant_isolation') THEN
        CREATE POLICY tenant_isolation ON ccms_workflow_states FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ccms_workflow_transitions' AND policyname='tenant_isolation') THEN
        CREATE POLICY tenant_isolation ON ccms_workflow_transitions FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ccms_workflow_instances' AND policyname='tenant_isolation') THEN
        CREATE POLICY tenant_isolation ON ccms_workflow_instances FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ccms_workflow_history' AND policyname='tenant_isolation') THEN
        CREATE POLICY tenant_isolation ON ccms_workflow_history FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true));
    END IF;
END $$;

COMMIT;
