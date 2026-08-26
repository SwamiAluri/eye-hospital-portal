-- ============================================================================
-- Migration 160: OT-020 per-patient implant / IOL usage registry
-- Clinical SoT for scanned implants. Billing and inventory are eventually
-- consistent via integration_outbox_event (ImplantUsed / ImplantUsageReversed).
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS journey_implant_usage (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id            uuid NOT NULL,
    journey_id           uuid NOT NULL REFERENCES patient_journey(id),
    patient_id           uuid NOT NULL,
    eye                  varchar(10) NOT NULL,
    item_id              uuid,
    catalog_ref          varchar(80),
    brand                varchar(120),
    model                varchar(160),
    power                numeric(6,2),
    serial_number        varchar(80),
    batch_number         varchar(80),
    udi_barcode          varchar(120),
    usage_status         varchar(24) NOT NULL,
    surgeon_user_id      uuid,
    scanned_at           timestamptz NOT NULL DEFAULT now(),
    scanned_by_user_id   uuid,
    inventory_txn_id     uuid,
    charge_item_id       uuid,
    charge_status        varchar(24) NOT NULL DEFAULT 'Pending',
    wastage_reason       text,
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now(),
    created_by_user_id   uuid,
    updated_by_user_id   uuid,
    deleted_at           timestamptz,
    status               varchar(20) NOT NULL DEFAULT 'active',
    CONSTRAINT journey_implant_usage_status_check CHECK (usage_status IN (
        'Implanted', 'Opened_Unused', 'Wasted', 'Returned', 'Reversed'
    ))
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_journey_implant_serial_implanted
    ON journey_implant_usage (tenant_id, serial_number)
    WHERE usage_status = 'Implanted'
      AND serial_number IS NOT NULL
      AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_journey_implant_usage_journey
    ON journey_implant_usage (tenant_id, journey_id, scanned_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_journey_implant_usage_batch
    ON journey_implant_usage (tenant_id, batch_number)
    WHERE batch_number IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_journey_implant_usage_udi
    ON journey_implant_usage (tenant_id, udi_barcode)
    WHERE udi_barcode IS NOT NULL AND deleted_at IS NULL;

COMMENT ON TABLE journey_implant_usage IS
    'OT-020 clinical implant registry. Unique serial while Implanted. Charges post from outbox only when usage_status=Implanted.';

COMMIT;
