-- TODO Database Schema for Claude Compiler
-- Tracks all tasks across sessions with priority and status management

-- Main todos table
CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'open' CHECK(status IN ('open', 'in_progress', 'completed', 'blocked', 'cancelled')),
    priority INTEGER DEFAULT 3 CHECK(priority BETWEEN 1 AND 4), -- 1=critical, 2=high, 3=medium, 4=low
    category TEXT,
    assigned_to TEXT, -- Session ID that owns this task
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    blocked_at TIMESTAMP,
    blocked_reason TEXT,
    parent_task_id INTEGER,
    metadata JSON, -- Flexible field for additional data
    FOREIGN KEY (parent_task_id) REFERENCES todos(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_todos_status ON todos(status);
CREATE INDEX IF NOT EXISTS idx_todos_priority ON todos(priority);
CREATE INDEX IF NOT EXISTS idx_todos_assigned_to ON todos(assigned_to);
CREATE INDEX IF NOT EXISTS idx_todos_parent_task ON todos(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_todos_created_at ON todos(created_at);

-- Task dependencies table (for complex workflows)
CREATE TABLE IF NOT EXISTS task_dependencies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    depends_on_task_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES todos(id) ON DELETE CASCADE,
    FOREIGN KEY (depends_on_task_id) REFERENCES todos(id) ON DELETE CASCADE,
    UNIQUE(task_id, depends_on_task_id)
);

-- Task comments/notes table
CREATE TABLE IF NOT EXISTS task_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    session_id TEXT,
    comment TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES todos(id) ON DELETE CASCADE
);

-- Task history table (audit trail)
CREATE TABLE IF NOT EXISTS task_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    field_name TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    changed_by TEXT, -- Session ID
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES todos(id) ON DELETE CASCADE
);

-- Trigger to update the updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_todos_timestamp 
AFTER UPDATE ON todos
FOR EACH ROW
BEGIN
    UPDATE todos SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Trigger to log history on status changes
CREATE TRIGGER IF NOT EXISTS log_status_change
AFTER UPDATE OF status ON todos
FOR EACH ROW
BEGIN
    INSERT INTO task_history (task_id, field_name, old_value, new_value, changed_by)
    VALUES (NEW.id, 'status', OLD.status, NEW.status, NEW.assigned_to);
END;

-- Trigger to set completed_at when status changes to completed
CREATE TRIGGER IF NOT EXISTS set_completed_timestamp
AFTER UPDATE OF status ON todos
FOR EACH ROW
WHEN NEW.status = 'completed' AND OLD.status != 'completed'
BEGIN
    UPDATE todos SET completed_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Trigger to set blocked_at when status changes to blocked
CREATE TRIGGER IF NOT EXISTS set_blocked_timestamp
AFTER UPDATE OF status ON todos
FOR EACH ROW
WHEN NEW.status = 'blocked' AND OLD.status != 'blocked'
BEGIN
    UPDATE todos SET blocked_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;