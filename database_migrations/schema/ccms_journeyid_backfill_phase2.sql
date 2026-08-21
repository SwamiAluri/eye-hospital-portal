-- Phase 2: JourneyId backfill for IP-linked coverage cases
-- Safe / idempotent: only fills NULL JourneyId when a unique admitted journey
-- matches the coverage case SessionId. Does not overwrite existing JourneyId.

-- Preview (read-only):
-- SELECT c.id AS case_id, c.session_id, j.id AS journey_id
-- FROM ccms_coverage_case c
-- JOIN patient_journey j
--   ON j.counseling_session_id = c.session_id
--  AND j.deleted_at IS NULL
--  AND j.clinical_state IN (
--      'Admitted','ReadyForSurgery','SentToOT','InOT','SurgeryCompleted',
--      'PostOp','ReadyForDischarge','Discharged'
--  )
-- WHERE c.deleted_at IS NULL
--   AND c.journey_id IS NULL
--   AND c.session_id IS NOT NULL;

UPDATE ccms_coverage_case c
SET journey_id = j.id,
    updated_at = NOW()
FROM patient_journey j
WHERE c.deleted_at IS NULL
  AND c.journey_id IS NULL
  AND c.session_id IS NOT NULL
  AND j.counseling_session_id = c.session_id
  AND j.deleted_at IS NULL
  AND j.clinical_state IN (
      'Admitted','ReadyForSurgery','SentToOT','InOT','SurgeryCompleted',
      'PostOp','ReadyForDischarge','Discharged'
  )
  -- Prefer a single match: if multiple journeys share a session, take the latest admitted.
  AND j.id = (
      SELECT j2.id
      FROM patient_journey j2
      WHERE j2.counseling_session_id = c.session_id
        AND j2.deleted_at IS NULL
      ORDER BY j2.admitted_at DESC NULLS LAST, j2.created_at DESC
      LIMIT 1
  );

COMMENT ON COLUMN ccms_coverage_case.journey_id IS
  'IP PatientJourney link — required for surgery/discharge lifecycle; backfilled in Phase 2';
