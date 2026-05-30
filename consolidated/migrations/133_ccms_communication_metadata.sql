-- Store inbound email parse drafts and linkage metadata on communication logs
ALTER TABLE ccms_communication_logs
    ADD COLUMN IF NOT EXISTS metadata_json jsonb;

COMMENT ON COLUMN ccms_communication_logs.metadata_json IS
    'Optional JSON: inbound parse draft (suggestedDecision, approvedAmount, etc.)';
