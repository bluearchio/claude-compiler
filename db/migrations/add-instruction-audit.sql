-- Migration: Add Instruction Audit Tables
-- Purpose: Create comprehensive audit trail for instruction execution with cryptographic verification
-- Created: 2025-08-30

-- ============================================================================
-- INSTRUCTION AUDIT TABLES
-- ============================================================================

-- Main instruction execution audit table
CREATE TABLE IF NOT EXISTS instruction_executions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    execution_id TEXT NOT NULL UNIQUE,
    instruction_id TEXT NOT NULL,
    instruction_file TEXT,
    description TEXT,
    
    -- Execution metadata
    started_at TEXT NOT NULL,
    completed_at TEXT,
    duration_ms INTEGER,
    
    -- State machine tracking
    initial_state TEXT NOT NULL DEFAULT 'INIT',
    final_state TEXT,
    state_transitions INTEGER DEFAULT 0,
    
    -- Execution results
    status TEXT CHECK(status IN ('pending', 'running', 'completed', 'failed', 'aborted', 'rolled_back')),
    success BOOLEAN DEFAULT 0,
    error_message TEXT,
    
    -- Cryptographic verification
    hash_chain_root TEXT,
    merkle_root TEXT,
    verification_hash TEXT,
    
    -- Resources
    files_modified INTEGER DEFAULT 0,
    resources_used TEXT, -- JSON array
    
    -- Agent/user information
    initiated_by TEXT NOT NULL,
    agent_type TEXT,
    session_id TEXT,
    
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- State transition audit log
CREATE TABLE IF NOT EXISTS instruction_state_transitions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    execution_id TEXT NOT NULL,
    
    -- State transition details
    from_state TEXT NOT NULL,
    to_state TEXT NOT NULL,
    transition_timestamp TEXT NOT NULL,
    transition_duration_ms INTEGER,
    
    -- Verification
    pre_conditions_checked TEXT, -- JSON array
    pre_conditions_passed BOOLEAN,
    post_conditions_checked TEXT, -- JSON array
    post_conditions_passed BOOLEAN,
    
    -- Cryptographic proof
    transition_hash TEXT NOT NULL,
    previous_hash TEXT,
    block_index INTEGER,
    
    -- Additional context
    metadata TEXT, -- JSON object
    
    FOREIGN KEY (execution_id) REFERENCES instruction_executions(execution_id)
);

-- Individual step execution audit
CREATE TABLE IF NOT EXISTS instruction_steps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    execution_id TEXT NOT NULL,
    step_id TEXT NOT NULL,
    
    -- Step details
    step_index INTEGER NOT NULL,
    description TEXT,
    action_type TEXT,
    action_data TEXT, -- JSON
    
    -- Execution timing
    started_at TEXT,
    completed_at TEXT,
    duration_ms INTEGER,
    
    -- Results
    status TEXT CHECK(status IN ('pending', 'running', 'completed', 'failed', 'skipped', 'rolled_back')),
    result TEXT, -- JSON
    error_message TEXT,
    
    -- Dependencies
    dependencies TEXT, -- JSON array of step_ids
    dependencies_met BOOLEAN DEFAULT 1,
    
    -- Verification
    verification_type TEXT,
    verification_passed BOOLEAN,
    verification_details TEXT, -- JSON
    step_hash TEXT NOT NULL,
    
    -- Rollback information
    rollback_action TEXT, -- JSON
    rollback_snapshot TEXT, -- JSON
    rolled_back BOOLEAN DEFAULT 0,
    
    FOREIGN KEY (execution_id) REFERENCES instruction_executions(execution_id),
    UNIQUE(execution_id, step_id)
);

-- Constraint enforcement audit
CREATE TABLE IF NOT EXISTS instruction_constraints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    execution_id TEXT NOT NULL,
    
    -- Constraint details
    constraint_id TEXT NOT NULL,
    constraint_type TEXT NOT NULL,
    constraint_description TEXT,
    
    -- Evaluation
    evaluated_at TEXT NOT NULL,
    evaluation_result BOOLEAN NOT NULL,
    evidence TEXT, -- JSON
    
    -- Enforcement
    enforcement_action TEXT,
    violation_severity TEXT CHECK(violation_severity IN ('info', 'warning', 'error', 'critical')),
    
    -- Cryptographic proof
    constraint_hash TEXT,
    
    FOREIGN KEY (execution_id) REFERENCES instruction_executions(execution_id)
);

-- Cryptographic verification records
CREATE TABLE IF NOT EXISTS instruction_verifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    execution_id TEXT NOT NULL,
    
    -- Verification details
    verification_type TEXT NOT NULL, -- 'hash_chain', 'merkle_tree', 'signature', 'zk_proof'
    verification_timestamp TEXT NOT NULL,
    
    -- Cryptographic data
    algorithm TEXT DEFAULT 'sha256',
    input_data TEXT, -- JSON
    computed_hash TEXT,
    expected_hash TEXT,
    
    -- Results
    verified BOOLEAN NOT NULL,
    violation_type TEXT,
    violation_details TEXT, -- JSON
    
    -- Chain of custody
    previous_verification_id INTEGER,
    chain_position INTEGER,
    
    FOREIGN KEY (execution_id) REFERENCES instruction_executions(execution_id),
    FOREIGN KEY (previous_verification_id) REFERENCES instruction_verifications(id)
);

-- Rollback operations audit
CREATE TABLE IF NOT EXISTS instruction_rollbacks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    execution_id TEXT NOT NULL,
    
    -- Rollback trigger
    triggered_at TEXT NOT NULL,
    trigger_reason TEXT NOT NULL,
    triggered_by_step TEXT,
    
    -- Rollback execution
    started_at TEXT,
    completed_at TEXT,
    
    -- Steps rolled back
    steps_to_rollback INTEGER,
    steps_rolled_back INTEGER,
    rollback_success BOOLEAN,
    
    -- State restoration
    files_restored TEXT, -- JSON array
    state_snapshot TEXT, -- JSON
    
    -- Errors
    rollback_errors TEXT, -- JSON array
    
    FOREIGN KEY (execution_id) REFERENCES instruction_executions(execution_id)
);

-- Audit event log (immutable)
CREATE TABLE IF NOT EXISTS instruction_audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    execution_id TEXT NOT NULL,
    
    -- Event details
    event_timestamp TEXT NOT NULL,
    event_type TEXT NOT NULL,
    event_source TEXT,
    
    -- Event data
    event_data TEXT NOT NULL, -- JSON
    
    -- Cryptographic proof
    event_hash TEXT NOT NULL,
    previous_event_hash TEXT,
    hash_chain_index INTEGER,
    
    -- Signature (if applicable)
    signed_by TEXT,
    signature TEXT,
    
    -- Immutability flag
    immutable BOOLEAN DEFAULT 1,
    
    FOREIGN KEY (execution_id) REFERENCES instruction_executions(execution_id)
);

-- Resource locks for concurrent execution prevention
CREATE TABLE IF NOT EXISTS instruction_resource_locks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    execution_id TEXT NOT NULL,
    
    -- Resource identification
    resource_type TEXT NOT NULL, -- 'file', 'database', 'api', etc.
    resource_path TEXT NOT NULL,
    
    -- Lock details
    locked_at TEXT NOT NULL,
    lock_type TEXT DEFAULT 'exclusive', -- 'shared', 'exclusive'
    released_at TEXT,
    
    -- Lock verification
    lock_token TEXT NOT NULL UNIQUE,
    
    FOREIGN KEY (execution_id) REFERENCES instruction_executions(execution_id),
    UNIQUE(resource_path, lock_token)
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_executions_status ON instruction_executions(status);
CREATE INDEX IF NOT EXISTS idx_executions_session ON instruction_executions(session_id);
CREATE INDEX IF NOT EXISTS idx_executions_timestamp ON instruction_executions(started_at);

CREATE INDEX IF NOT EXISTS idx_transitions_execution ON instruction_state_transitions(execution_id);
CREATE INDEX IF NOT EXISTS idx_transitions_timestamp ON instruction_state_transitions(transition_timestamp);

CREATE INDEX IF NOT EXISTS idx_steps_execution ON instruction_steps(execution_id);
CREATE INDEX IF NOT EXISTS idx_steps_status ON instruction_steps(status);

CREATE INDEX IF NOT EXISTS idx_constraints_execution ON instruction_constraints(execution_id);
CREATE INDEX IF NOT EXISTS idx_constraints_result ON instruction_constraints(evaluation_result);

CREATE INDEX IF NOT EXISTS idx_verifications_execution ON instruction_verifications(execution_id);
CREATE INDEX IF NOT EXISTS idx_verifications_type ON instruction_verifications(verification_type);

CREATE INDEX IF NOT EXISTS idx_audit_log_execution ON instruction_audit_log(execution_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON instruction_audit_log(event_timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_log_type ON instruction_audit_log(event_type);

-- ============================================================================
-- VIEWS FOR REPORTING
-- ============================================================================

-- Execution summary view
CREATE VIEW IF NOT EXISTS instruction_execution_summary AS
SELECT 
    e.execution_id,
    e.instruction_id,
    e.description,
    e.status,
    e.success,
    e.started_at,
    e.completed_at,
    e.duration_ms,
    e.final_state,
    COUNT(DISTINCT s.id) as total_steps,
    SUM(CASE WHEN s.status = 'completed' THEN 1 ELSE 0 END) as completed_steps,
    SUM(CASE WHEN s.status = 'failed' THEN 1 ELSE 0 END) as failed_steps,
    COUNT(DISTINCT c.id) as constraints_checked,
    SUM(CASE WHEN c.evaluation_result = 1 THEN 1 ELSE 0 END) as constraints_passed,
    COUNT(DISTINCT v.id) as verifications_performed,
    SUM(CASE WHEN v.verified = 1 THEN 1 ELSE 0 END) as verifications_passed
FROM instruction_executions e
LEFT JOIN instruction_steps s ON e.execution_id = s.execution_id
LEFT JOIN instruction_constraints c ON e.execution_id = c.execution_id
LEFT JOIN instruction_verifications v ON e.execution_id = v.execution_id
GROUP BY e.execution_id;

-- Violation report view
CREATE VIEW IF NOT EXISTS instruction_violations AS
SELECT 
    e.execution_id,
    e.instruction_id,
    'constraint' as violation_type,
    c.constraint_type as specific_type,
    c.constraint_description as description,
    c.evaluated_at as occurred_at,
    c.violation_severity as severity
FROM instruction_executions e
JOIN instruction_constraints c ON e.execution_id = c.execution_id
WHERE c.evaluation_result = 0

UNION ALL

SELECT 
    e.execution_id,
    e.instruction_id,
    'verification' as violation_type,
    v.verification_type as specific_type,
    v.violation_type as description,
    v.verification_timestamp as occurred_at,
    'error' as severity
FROM instruction_executions e
JOIN instruction_verifications v ON e.execution_id = v.execution_id
WHERE v.verified = 0;

-- Audit trail integrity view
CREATE VIEW IF NOT EXISTS instruction_audit_integrity AS
SELECT 
    execution_id,
    COUNT(*) as total_events,
    MIN(event_timestamp) as first_event,
    MAX(event_timestamp) as last_event,
    MAX(hash_chain_index) as chain_length,
    COUNT(DISTINCT event_type) as event_types,
    SUM(CASE WHEN signature IS NOT NULL THEN 1 ELSE 0 END) as signed_events
FROM instruction_audit_log
GROUP BY execution_id;

-- ============================================================================
-- TRIGGERS FOR AUDIT INTEGRITY
-- ============================================================================

-- Prevent modification of audit log entries
CREATE TRIGGER IF NOT EXISTS protect_audit_log
BEFORE UPDATE ON instruction_audit_log
BEGIN
    SELECT RAISE(ABORT, 'Audit log entries are immutable and cannot be modified');
END;

-- Prevent deletion of audit log entries
CREATE TRIGGER IF NOT EXISTS protect_audit_log_delete
BEFORE DELETE ON instruction_audit_log
BEGIN
    SELECT RAISE(ABORT, 'Audit log entries are immutable and cannot be deleted');
END;

-- Auto-timestamp state transitions
CREATE TRIGGER IF NOT EXISTS timestamp_state_transition
AFTER INSERT ON instruction_state_transitions
BEGIN
    UPDATE instruction_executions 
    SET state_transitions = state_transitions + 1
    WHERE execution_id = NEW.execution_id;
END;

-- Update execution status based on step failures
CREATE TRIGGER IF NOT EXISTS update_execution_on_step_failure
AFTER UPDATE OF status ON instruction_steps
WHEN NEW.status = 'failed'
BEGIN
    UPDATE instruction_executions 
    SET status = 'failed',
        completed_at = CURRENT_TIMESTAMP
    WHERE execution_id = NEW.execution_id
    AND status = 'running';
END;

-- ============================================================================
-- STORED PROCEDURES (as SQL scripts)
-- ============================================================================

-- Script to verify hash chain integrity
-- Usage: SELECT verify_hash_chain('execution-id-here');
-- This would be implemented in the application layer

-- Script to generate audit report
-- Usage: SELECT generate_audit_report('execution-id-here');
-- This would be implemented in the application layer

-- ============================================================================
-- MIGRATION METADATA
-- ============================================================================

-- Create migrations table if it doesn't exist
CREATE TABLE IF NOT EXISTS migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    applied_at TEXT NOT NULL,
    description TEXT
);

INSERT OR IGNORE INTO migrations (name, applied_at, description)
VALUES (
    'add-instruction-audit',
    CURRENT_TIMESTAMP,
    'Comprehensive audit trail system for instruction execution with cryptographic verification'
);