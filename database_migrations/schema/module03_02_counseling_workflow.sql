-- =====================================================
-- Module 3: Counselor Management - Counseling Workflow
-- Migration: module03_02_counseling_workflow.sql
-- Description: Counseling sessions, queue management, notes, documents
-- Author: AI Assistant
-- Date: 2026-02-22
-- =====================================================

-- =====================================================
-- 1. COUNSELING SESSIONS (Main Entity)
-- =====================================================
CREATE TABLE IF NOT EXISTS counseling_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    branch_id UUID,
    
    -- Links
    patient_id UUID NOT NULL,
    visit_id UUID, -- Links to opd_visit
    referred_by_doctor_id UUID NOT NULL,
    counselor_id UUID, -- Assigned counselor
    
    -- Session Details
    session_number VARCHAR(50) UNIQUE,
    session_type VARCHAR(30) DEFAULT 'Initial' CHECK (session_type IN ('Initial', 'Followup', 'Recheck', 'Urgent')),
    session_date DATE NOT NULL DEFAULT CURRENT_DATE,
    session_start_time TIMESTAMPTZ,
    session_end_time TIMESTAMPTZ,
    duration_minutes INTEGER,
    
    -- Patient Type
    patient_type VARCHAR(50) NOT NULL CHECK (patient_type IN ('Cash', 'Insurance', 'CoPay', 'ESH', 'CGHS', 'Arograshree', 'SGHS', 'Camp')),
    
    -- Clinical Information (Snapshot from Doctor)
    clinical_summary JSONB, -- {diagnosis, chiefComplaint, visualAcuity, iop, etc}
    recommended_surgery VARCHAR(100),
    recommended_iol VARCHAR(100),
    iol_power VARCHAR(50),
    urgency VARCHAR(20) CHECK (urgency IN ('Routine', 'Urgent', 'Emergency')),
    
    -- Session Outcome
    package_discussed BOOLEAN DEFAULT FALSE,
    patient_agreed_to_surgery BOOLEAN DEFAULT FALSE,
    pending_decision BOOLEAN DEFAULT TRUE,
    decision_date DATE,
    reasons_for_delay TEXT,
    
    -- Status
    status VARCHAR(30) DEFAULT 'Scheduled' CHECK (status IN ('Scheduled', 'InProgress', 'Completed', 'Cancelled', 'NoShow')),
    
    -- Audit Fields
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_user_id UUID,
    updated_at TIMESTAMPTZ,
    updated_by_user_id UUID,
    deleted_at TIMESTAMPTZ,
    
    -- Constraints
    CONSTRAINT fk_counseling_session_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(id) ON DELETE CASCADE,
    CONSTRAINT fk_counseling_session_branch FOREIGN KEY (branch_id) REFERENCES branch(id),
    CONSTRAINT fk_counseling_session_patient FOREIGN KEY (patient_id) REFERENCES patient(id),
    CONSTRAINT fk_counseling_session_doctor FOREIGN KEY (referred_by_doctor_id) REFERENCES users(id),
    CONSTRAINT fk_counseling_session_counselor FOREIGN KEY (counselor_id) REFERENCES users(id)
);

-- =====================================================
-- 2. COUNSELOR QUEUE (Real-time Queue Management)
-- =====================================================
CREATE TABLE IF NOT EXISTS counselor_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    branch_id UUID NOT NULL,
    
    -- Session Link
    session_id UUID NOT NULL UNIQUE,
    patient_id UUID NOT NULL,
    
    -- Queue Details
    token_number VARCHAR(20) NOT NULL,
    queue_type VARCHAR(30) DEFAULT 'Counseling',
    queue_position INTEGER NOT NULL,
    
    -- Priority Calculation
    priority_score DECIMAL(5,2) DEFAULT 50.00, -- urgency × wait_time formula
    urgency_level VARCHAR(20) CHECK (urgency_level IN ('Low', 'Normal', 'High', 'Critical')),
    
    -- Timing
    added_to_queue_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    estimated_wait_minutes INTEGER,
    called_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    actual_wait_minutes INTEGER,
    
    -- Status
    status VARCHAR(30) DEFAULT 'Waiting' CHECK (status IN ('Waiting', 'Called', 'InProgress', 'Completed', 'Cancelled', 'NoShow')),
    
    -- Audit Fields
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    
    -- Constraints
    CONSTRAINT fk_counselor_queue_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(id) ON DELETE CASCADE,
    CONSTRAINT fk_counselor_queue_branch FOREIGN KEY (branch_id) REFERENCES branch(id),
    CONSTRAINT fk_counselor_queue_session FOREIGN KEY (session_id) REFERENCES counseling_sessions(id) ON DELETE CASCADE,
    CONSTRAINT fk_counselor_queue_patient FOREIGN KEY (patient_id) REFERENCES patient(id)
);

-- =====================================================
-- 3. COUNSELING SESSION NOTES (Free-text Notes)
-- =====================================================
CREATE TABLE IF NOT EXISTS counseling_session_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    
    -- Session Link
    session_id UUID NOT NULL,
    
    -- Note Content
    note_type VARCHAR(30) CHECK (note_type IN ('General', 'PatientEducation', 'CostDiscussion', 'Concerns', 'FollowupPlan', 'Internal')),
    note_text TEXT NOT NULL,
    
    -- Metadata
    is_confidential BOOLEAN DEFAULT FALSE,
    tags TEXT[], -- ['IOL Selection', 'Insurance Query', 'Cost Concern']
    
    -- Audit Fields
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_user_id UUID NOT NULL,
    updated_at TIMESTAMPTZ,
    updated_by_user_id UUID,
    deleted_at TIMESTAMPTZ,
    
    -- Constraints
    CONSTRAINT fk_session_note_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(id) ON DELETE CASCADE,
    CONSTRAINT fk_session_note_session FOREIGN KEY (session_id) REFERENCES counseling_sessions(id) ON DELETE CASCADE,
    CONSTRAINT fk_session_note_created_by FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);

-- =====================================================
-- 4. COUNSELING SESSION DOCUMENTS (Uploaded Documents)
-- =====================================================
CREATE TABLE IF NOT EXISTS counseling_session_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    
    -- Session Link
    session_id UUID NOT NULL,
    
    -- Document Details
    document_type VARCHAR(50) CHECK (document_type IN ('ReferralLetter', 'PreviousReport', 'InsuranceCard', 'PolicyDocument', 'IDProof', 'AddressProof', 'LabReport', 'Imaging', 'Other', 'AudioRecording')),
    document_name VARCHAR(200) NOT NULL,
    document_description TEXT,
    
    -- File Storage
    file_path VARCHAR(500) NOT NULL, -- Azure Blob path
    file_type VARCHAR(50), -- PDF, JPEG, PNG, DOCX
    file_size_bytes BIGINT,
    
    -- Verification
    is_verified BOOLEAN DEFAULT FALSE,
    verified_by_user_id UUID,
    verified_at TIMESTAMPTZ,
    verification_notes TEXT,
    
    -- Status
    status VARCHAR(20) DEFAULT 'active',
    
    -- Audit Fields
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_user_id UUID NOT NULL,
    updated_at TIMESTAMPTZ,
    updated_by_user_id UUID,
    deleted_at TIMESTAMPTZ,
    
    -- Constraints
    CONSTRAINT fk_session_document_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(id) ON DELETE CASCADE,
    CONSTRAINT fk_session_document_session FOREIGN KEY (session_id) REFERENCES counseling_sessions(id) ON DELETE CASCADE,
    CONSTRAINT fk_session_document_verified_by FOREIGN KEY (verified_by_user_id) REFERENCES users(id),
    CONSTRAINT fk_session_document_created_by FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);

-- =====================================================
-- INDEXES
-- =====================================================

-- Counseling Sessions
CREATE INDEX IF NOT EXISTS idx_counseling_sessions_tenant ON counseling_sessions(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_counseling_sessions_branch ON counseling_sessions(branch_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_counseling_sessions_patient ON counseling_sessions(patient_id);
CREATE INDEX IF NOT EXISTS idx_counseling_sessions_doctor ON counseling_sessions(referred_by_doctor_id);
CREATE INDEX IF NOT EXISTS idx_counseling_sessions_counselor ON counseling_sessions(counselor_id);
CREATE INDEX IF NOT EXISTS idx_counseling_sessions_date ON counseling_sessions(session_date, status);
CREATE INDEX IF NOT EXISTS idx_counseling_sessions_status ON counseling_sessions(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_counseling_sessions_patient_type ON counseling_sessions(patient_type);

-- Counselor Queue
CREATE INDEX IF NOT EXISTS idx_counselor_queue_tenant_branch ON counselor_queue(tenant_id, branch_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_counselor_queue_session ON counselor_queue(session_id);
CREATE INDEX IF NOT EXISTS idx_counselor_queue_patient ON counselor_queue(patient_id);
CREATE INDEX IF NOT EXISTS idx_counselor_queue_status ON counselor_queue(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_counselor_queue_priority ON counselor_queue(branch_id, priority_score DESC, queue_position) WHERE status = 'Waiting';
CREATE INDEX IF NOT EXISTS idx_counselor_queue_date ON counselor_queue(added_to_queue_at);

-- Session Notes
CREATE INDEX IF NOT EXISTS idx_session_notes_session ON counseling_session_notes(session_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_session_notes_created_by ON counseling_session_notes(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_session_notes_type ON counseling_session_notes(note_type);

-- Session Documents
CREATE INDEX IF NOT EXISTS idx_session_documents_session ON counseling_session_documents(session_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_session_documents_type ON counseling_session_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_session_documents_verified ON counseling_session_documents(is_verified);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

ALTER TABLE counseling_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE counselor_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE counseling_session_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE counseling_session_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_counseling_sessions ON counseling_sessions
    FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation_counselor_queue ON counselor_queue
    FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation_session_notes ON counseling_session_notes
    FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation_session_documents ON counseling_session_documents
    FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true));

-- =====================================================
-- FUNCTIONS: Priority Score Calculation
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_queue_priority_score(
    p_urgency_level VARCHAR,
    p_wait_minutes INTEGER
) RETURNS DECIMAL AS $$
DECLARE
    v_urgency_weight DECIMAL := 1.0;
    v_wait_weight DECIMAL := 1.0;
BEGIN
    -- Urgency weight
    v_urgency_weight := CASE p_urgency_level
        WHEN 'Critical' THEN 4.0
        WHEN 'High' THEN 3.0
        WHEN 'Normal' THEN 2.0
        WHEN 'Low' THEN 1.0
        ELSE 1.0
    END;
    
    -- Wait time weight (increases over time)
    v_wait_weight := 1.0 + (p_wait_minutes / 30.0);
    
    -- Priority score = urgency × wait_weight
    RETURN v_urgency_weight * v_wait_weight;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================
-- TRIGGER: Auto-update Priority Score
-- =====================================================

CREATE OR REPLACE FUNCTION update_queue_priority_score()
RETURNS TRIGGER AS $$
BEGIN
    NEW.actual_wait_minutes := EXTRACT(EPOCH FROM (NOW() - NEW.added_to_queue_at)) / 60;
    NEW.priority_score := calculate_queue_priority_score(
        COALESCE(NEW.urgency_level, 'Normal'),
        COALESCE(NEW.actual_wait_minutes, 0)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_queue_priority
    BEFORE UPDATE ON counselor_queue
    FOR EACH ROW
    WHEN (OLD.status = 'Waiting' AND NEW.status = 'Waiting')
    EXECUTE FUNCTION update_queue_priority_score();

-- =====================================================
-- TRIGGER: Auto-generate Session Number
-- =====================================================

CREATE OR REPLACE FUNCTION generate_counseling_session_number()
RETURNS TRIGGER AS $$
DECLARE
    branch_code_val VARCHAR(50);
    session_count INT;
    new_session_number VARCHAR(50);
BEGIN
    SELECT branch_code INTO branch_code_val FROM branch WHERE id = NEW.branch_id;
    IF branch_code_val IS NULL THEN
        branch_code_val := 'HQ';
    ELSE
        branch_code_val := LEFT(branch_code_val, 10);
    END IF;

    SELECT COUNT(*) + 1 INTO session_count
    FROM counseling_sessions
    WHERE branch_id = NEW.branch_id
    AND session_date = CURRENT_DATE
    AND deleted_at IS NULL;

    new_session_number := 'CS-' || branch_code_val || '-' ||
        TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' ||
        LPAD(session_count::TEXT, 4, '0');

    NEW.session_number := new_session_number;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_generate_session_number
    BEFORE INSERT ON counseling_sessions
    FOR EACH ROW
    WHEN (NEW.session_number IS NULL)
    EXECUTE FUNCTION generate_counseling_session_number();

-- =====================================================
-- TRIGGER: Auto-generate Token Number
-- =====================================================

CREATE OR REPLACE FUNCTION generate_queue_token_number()
RETURNS TRIGGER AS $$
DECLARE
    v_sequence INTEGER;
BEGIN
    -- Get next token sequence for today
    SELECT COUNT(*) + 1 INTO v_sequence
    FROM counselor_queue
    WHERE branch_id = NEW.branch_id
    AND DATE(added_to_queue_at) = CURRENT_DATE
    AND deleted_at IS NULL;
    
    -- Generate token: C<SEQ> (C1, C2, C3...)
    NEW.token_number := 'C' || v_sequence::TEXT;
    
    -- Set queue position
    NEW.queue_position := v_sequence;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_generate_token_number
    BEFORE INSERT ON counselor_queue
    FOR EACH ROW
    WHEN (NEW.token_number IS NULL)
    EXECUTE FUNCTION generate_queue_token_number();

COMMENT ON TABLE counseling_sessions IS 'Counseling sessions when patients are referred for surgery counseling';
COMMENT ON TABLE counselor_queue IS 'Real-time queue management for counseling sessions';
COMMENT ON TABLE counseling_session_notes IS 'Free-text notes recorded during counseling';
COMMENT ON TABLE counseling_session_documents IS 'Documents uploaded during counseling (referrals, reports, insurance cards)';
