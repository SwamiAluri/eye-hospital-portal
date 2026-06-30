-- Patient Hub Phase 3 — user chart layout preferences

CREATE TABLE IF NOT EXISTS user_chart_layout (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    layout_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_user_chart_layout_user UNIQUE (tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS ix_user_chart_layout_user
    ON user_chart_layout (tenant_id, user_id);
