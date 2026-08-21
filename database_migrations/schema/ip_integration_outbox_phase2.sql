-- Phase 2: IP × CCMS integration outbox
-- Safe to run repeatedly (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS integration_outbox_event (
    id               UUID PRIMARY KEY,
    tenant_id        UUID NOT NULL,
    event_type       VARCHAR(80) NOT NULL,
    aggregate_type   VARCHAR(80) NOT NULL,
    aggregate_id     UUID NOT NULL,
    correlation_id   UUID NULL,
    payload_json     TEXT NOT NULL,
    idempotency_key  VARCHAR(200) NOT NULL,
    occurred_at      TIMESTAMPTZ NOT NULL,
    status           VARCHAR(20) NOT NULL,
    retry_count      INT NOT NULL DEFAULT 0,
    last_attempt_at  TIMESTAMPTZ NULL,
    processed_at     TIMESTAMPTZ NULL,
    error            TEXT NULL,
    created_at       TIMESTAMPTZ NOT NULL,
    updated_at       TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_integration_outbox_idempotency
    ON integration_outbox_event (idempotency_key);

CREATE INDEX IF NOT EXISTS ix_integration_outbox_pending
    ON integration_outbox_event (status, occurred_at)
    WHERE status IN ('Pending', 'Failed');

COMMENT ON TABLE integration_outbox_event IS
  'Phase 2 transactional outbox for reliable IP → CCMS lifecycle events';
