-- 186: One active CCMS coverage case per counselling session
-- 1) Soft-delete empty duplicate cases
-- 2) Reassign documents from losing duplicates onto the preferred survivor, then soft-delete losers
-- 3) Unique index (tenant_id, session_id) where deleted_at IS NULL AND session_id IS NOT NULL

BEGIN;

-- Preferred survivor per session: has docs first, then newest.
CREATE TEMP TABLE tmp_session_case_winners ON COMMIT DROP AS
SELECT DISTINCT ON (c.tenant_id, c.session_id)
  c.tenant_id,
  c.session_id,
  c.id AS winner_id
FROM ccms_coverage_cases c
WHERE c.deleted_at IS NULL
  AND c.session_id IS NOT NULL
ORDER BY
  c.tenant_id,
  c.session_id,
  EXISTS (
    SELECT 1 FROM ccms_documents d
    WHERE d.coverage_case_id = c.id AND d.deleted_at IS NULL
  ) DESC,
  c.created_at DESC;

-- Soft-delete empty losers (no active documents).
UPDATE ccms_coverage_cases c
SET
  deleted_at = NOW(),
  updated_at = NOW(),
  status = CASE WHEN c.status = 'active' THEN 'deleted' ELSE c.status END
FROM tmp_session_case_winners w
WHERE c.tenant_id = w.tenant_id
  AND c.session_id = w.session_id
  AND c.id <> w.winner_id
  AND c.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM ccms_documents d
    WHERE d.coverage_case_id = c.id AND d.deleted_at IS NULL
  );

-- Move active documents from remaining losers onto the winner, then soft-delete losers.
UPDATE ccms_documents d
SET
  coverage_case_id = w.winner_id,
  updated_at = NOW()
FROM ccms_coverage_cases c
JOIN tmp_session_case_winners w
  ON c.tenant_id = w.tenant_id
 AND c.session_id = w.session_id
WHERE d.coverage_case_id = c.id
  AND c.id <> w.winner_id
  AND c.deleted_at IS NULL
  AND d.deleted_at IS NULL;

UPDATE ccms_coverage_cases c
SET
  deleted_at = NOW(),
  updated_at = NOW(),
  status = CASE WHEN c.status = 'active' THEN 'deleted' ELSE c.status END
FROM tmp_session_case_winners w
WHERE c.tenant_id = w.tenant_id
  AND c.session_id = w.session_id
  AND c.id <> w.winner_id
  AND c.deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_ccms_coverage_cases_tenant_session_active
  ON ccms_coverage_cases (tenant_id, session_id)
  WHERE deleted_at IS NULL AND session_id IS NOT NULL;

COMMIT;
