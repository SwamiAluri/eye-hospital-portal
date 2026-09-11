-- ============================================================
-- Migration 188: Counsellor Follow-up Center + Analytics indexes
-- Phase 2E — Database / Query Performance Optimization
--
-- Adds partial B-tree indexes aligned to Phase 2B / 2D IQueryable shapes:
--   - Analytics Summary / Trends / Aging (session_date window)
--   - Active / Cold Follow-up (patient_intention + last_contact_date)
--   - Aging PendingDecision subset (pending_decision = true)
--   - Callback analytics (callback_date across all statuses)
--   - Post-Surgery Follow-up (discharged journeys)
--
-- Non-destructive: CREATE INDEX IF NOT EXISTS only.
-- Does NOT drop overlapping legacy indexes (cleanup is a separate decision).
-- Does NOT add FTS/trigram for Follow-up q (leading-wildcard LIKE).
-- Does NOT implement due-date rules.
-- ============================================================

BEGIN;

-- 1) Analytics date-window on counseling_sessions
-- Query shape: tenant_id + deleted_at IS NULL + session_date >= from AND < to
CREATE INDEX IF NOT EXISTS idx_cs_analytics_tenant_session
    ON counseling_sessions (tenant_id, session_date)
    WHERE deleted_at IS NULL;

-- 2) Active / Cold Follow-up intention filter + Active last_contact ordering
-- Query shape: tenant_id + deleted_at IS NULL + patient_intention IN (...)
--              ORDER BY last_contact_date (Active; nulls sorted in app expression)
CREATE INDEX IF NOT EXISTS idx_cs_followup_intention_contact
    ON counseling_sessions (tenant_id, patient_intention, last_contact_date)
    WHERE deleted_at IS NULL;

-- 3) Analytics Aging — PendingDecision population within session_date window
-- Query shape: tenant_id + deleted_at IS NULL + pending_decision = true
--              + session_date range (optional branch/counselor filters after)
CREATE INDEX IF NOT EXISTS idx_cs_pending_decision_session
    ON counseling_sessions (tenant_id, session_date)
    WHERE deleted_at IS NULL
      AND pending_decision = true;

-- 4) Callback analytics across all statuses (not only Scheduled/Missed)
-- Query shape: tenant_id + deleted_at IS NULL + callback_date range
-- Note: idx_callback_branch_date remains for Scheduled/Missed operational lists.
CREATE INDEX IF NOT EXISTS idx_callback_tenant_date
    ON counselor_callback_requests (tenant_id, callback_date)
    WHERE deleted_at IS NULL;

-- 5) Post-Surgery Follow-up discharged journeys
-- Query shape: tenant_id + is_discharged = true + deleted_at IS NULL
--              + optional branch_id + ORDER BY discharged_at DESC
CREATE INDEX IF NOT EXISTS idx_pj_discharged_followup
    ON patient_journey (tenant_id, branch_id, discharged_at DESC)
    WHERE deleted_at IS NULL
      AND is_discharged = true;

COMMIT;
