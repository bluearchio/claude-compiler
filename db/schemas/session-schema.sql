-- SESSION Database Schema for Claude Compiler
-- Tracks all Claude Code sessions, activities, and conflicts

-- Main sessions table
CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT UNIQUE NOT NULL, -- UUID for the session
    type TEXT NOT NULL CHECK(type IN ('claude_code', 'agent', 'cli', 'api')),
    name TEXT, -- Human-readable session name
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'paused', 'completed', 'failed', 'dormant')),
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    host_project TEXT, -- Which project is using this session
    working_directory TEXT, -- Current working directory
    metadata JSON -- Session configuration and context
);

-- Session activities table (detailed activity log)
CREATE TABLE IF NOT EXISTS session_activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    activity TEXT NOT NULL, -- command/prompt/response/error
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    data JSON, -- Activity details (command text, response, etc.)
    FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
);

-- Session prompts table (stores all prompts sent)
CREATE TABLE IF NOT EXISTS session_prompts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    prompt_type TEXT CHECK(prompt_type IN ('user', 'front_loaded', 'combined')),
    prompt_text TEXT NOT NULL,
    response_text TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    execution_time_ms INTEGER, -- Time taken to execute
    tokens_used INTEGER,
    metadata JSON,
    FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
);

-- Session tasks junction table (links sessions to todos)
CREATE TABLE IF NOT EXISTS session_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    task_id INTEGER NOT NULL, -- References todos table in todo.db
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
);

-- Session file changes table (tracks files modified)
CREATE TABLE IF NOT EXISTS session_file_changes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    file_path TEXT NOT NULL,
    change_type TEXT CHECK(change_type IN ('created', 'modified', 'deleted', 'renamed')),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    old_content_hash TEXT,
    new_content_hash TEXT,
    metadata JSON,
    FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
);

-- Session conflicts table (tracks conflicting sessions)
CREATE TABLE IF NOT EXISTS session_conflicts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session1_id TEXT NOT NULL,
    session2_id TEXT NOT NULL,
    conflict_type TEXT CHECK(conflict_type IN ('file_lock', 'version_mismatch', 'resource_conflict', 'task_overlap')),
    conflict_details JSON,
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    resolution TEXT,
    FOREIGN KEY (session1_id) REFERENCES sessions(session_id) ON DELETE CASCADE,
    FOREIGN KEY (session2_id) REFERENCES sessions(session_id) ON DELETE CASCADE
);

-- Session messages table (for inter-session communication)
CREATE TABLE IF NOT EXISTS session_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_session_id TEXT,
    to_session_id TEXT NOT NULL,
    message_type TEXT CHECK(message_type IN ('info', 'warning', 'error', 'request', 'response')),
    message TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP,
    metadata JSON,
    FOREIGN KEY (from_session_id) REFERENCES sessions(session_id) ON DELETE CASCADE,
    FOREIGN KEY (to_session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_type ON sessions(type);
CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_sessions_last_activity ON sessions(last_activity);
CREATE INDEX IF NOT EXISTS idx_session_activities_session ON session_activities(session_id);
CREATE INDEX IF NOT EXISTS idx_session_activities_timestamp ON session_activities(timestamp);
CREATE INDEX IF NOT EXISTS idx_session_prompts_session ON session_prompts(session_id);
CREATE INDEX IF NOT EXISTS idx_session_tasks_session ON session_tasks(session_id);
CREATE INDEX IF NOT EXISTS idx_session_file_changes_session ON session_file_changes(session_id);
CREATE INDEX IF NOT EXISTS idx_session_file_changes_path ON session_file_changes(file_path);
CREATE INDEX IF NOT EXISTS idx_session_conflicts_session1 ON session_conflicts(session1_id);
CREATE INDEX IF NOT EXISTS idx_session_conflicts_session2 ON session_conflicts(session2_id);
CREATE INDEX IF NOT EXISTS idx_session_messages_to ON session_messages(to_session_id);

-- Trigger to update last_activity timestamp
CREATE TRIGGER IF NOT EXISTS update_session_last_activity
AFTER INSERT ON session_activities
FOR EACH ROW
BEGIN
    UPDATE sessions SET last_activity = CURRENT_TIMESTAMP 
    WHERE session_id = NEW.session_id;
END;

-- Trigger to mark sessions as dormant after inactivity
CREATE TRIGGER IF NOT EXISTS mark_dormant_sessions
AFTER UPDATE ON sessions
FOR EACH ROW
WHEN NEW.last_activity < datetime('now', '-15 minutes') AND NEW.status = 'active'
BEGIN
    UPDATE sessions SET status = 'dormant' WHERE session_id = NEW.session_id;
END;

-- Trigger to detect file conflicts
CREATE TRIGGER IF NOT EXISTS detect_file_conflicts
AFTER INSERT ON session_file_changes
FOR EACH ROW
BEGIN
    INSERT INTO session_conflicts (session1_id, session2_id, conflict_type, conflict_details)
    SELECT DISTINCT NEW.session_id, sfc.session_id, 'file_lock', 
           json_object('file_path', NEW.file_path, 'conflict_time', datetime('now'))
    FROM session_file_changes sfc
    JOIN sessions s ON s.session_id = sfc.session_id
    WHERE sfc.file_path = NEW.file_path
      AND sfc.session_id != NEW.session_id
      AND s.status = 'active'
      AND sfc.timestamp > datetime('now', '-5 minutes');
END;