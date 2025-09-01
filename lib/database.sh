#!/bin/bash

# Claude Compiler Database Layer - Pure Bash Implementation
# High-performance SQLite operations without Node.js dependencies

# Prevent multiple inclusions
[[ -n "$DATABASE_LOADED" ]] && return 0
readonly DATABASE_LOADED=1

# Configuration (only set if not already defined)
[[ -z "$DB_DIR" ]] && readonly DB_DIR="${SCRIPT_DIR:-$(dirname "${BASH_SOURCE[0]}")/..}/db"
[[ -z "$SESSION_DB" ]] && readonly SESSION_DB="$DB_DIR/sessions.db"
[[ -z "$TODO_DB" ]] && readonly TODO_DB="$DB_DIR/todos.db"

# Ensure database directory exists
mkdir -p "$DB_DIR"

# Database utility functions
db_exec() {
    local db_file="$1"
    local sql="$2"
    local format="${3:-}"
    
    # SQLite3 will create the database file if it doesn't exist
    # Pipe SQL to sqlite3 to handle multi-line statements properly
    if [[ -n "$format" ]]; then
        echo "$sql" | sqlite3 "$db_file"
    else
        echo "$sql" | sqlite3 "$db_file" 2>/dev/null
    fi
}

db_query() {
    local db_file="$1"
    local sql="$2"
    
    echo "$sql" | sqlite3 "$db_file" 2>/dev/null
}

db_query_json() {
    local db_file="$1"
    local sql="$2"
    
    echo ".mode json
$sql" | sqlite3 "$db_file" 2>/dev/null
}

# Initialize databases with schemas
init_databases() {
    local session_schema todo_schema
    
    # Create database directory if it doesn't exist
    mkdir -p "$DB_DIR"
    
    # Read schema files
    if [[ -f "$DB_DIR/schemas/session-schema.sql" ]]; then
        session_schema=$(< "$DB_DIR/schemas/session-schema.sql")
    else
        echo "Error: Session schema not found at $DB_DIR/schemas/session-schema.sql" >&2
        return 1
    fi
    
    if [[ -f "$DB_DIR/schemas/todo-schema.sql" ]]; then
        todo_schema=$(< "$DB_DIR/schemas/todo-schema.sql")
    else
        echo "Error: Todo schema not found at $DB_DIR/schemas/todo-schema.sql" >&2
        return 1
    fi
    
    # Initialize session database
    echo "  → Creating session database..."
    if db_exec "$SESSION_DB" "$session_schema"; then
        echo "    ✓ Session database created: $(basename "$SESSION_DB")"
    else
        echo "    ✗ Failed to create session database" >&2
        return 1
    fi
    
    # Initialize todo database
    echo "  → Creating todo database..."
    if db_exec "$TODO_DB" "$todo_schema"; then
        echo "    ✓ Todo database created: $(basename "$TODO_DB")"
    else
        echo "    ✗ Failed to create todo database" >&2
        return 1
    fi
    
    return 0
}

# Generate UUID (bash implementation)
generate_uuid() {
    if command -v uuidgen >/dev/null 2>&1; then
        uuidgen | tr '[:upper:]' '[:lower:]'
    else
        # Fallback UUID generation using random numbers
        printf '%08x-%04x-%04x-%04x-%012x\n' \
            $((RANDOM << 16 | RANDOM)) \
            $((RANDOM)) \
            $((RANDOM & 0x0fff | 0x4000)) \
            $((RANDOM & 0x3fff | 0x8000)) \
            $((RANDOM << 16 | RANDOM << 16 | RANDOM))
    fi
}

# Escape SQL strings (prevent injection)
sql_escape() {
    local input="$1"
    printf '%s' "$input" | sed "s/'/''/g"
}

# JSON-like data handling for metadata fields
json_encode() {
    local key value json_parts=()
    
    # Parse key=value pairs from arguments
    for arg in "$@"; do
        if [[ "$arg" =~ ^([^=]+)=(.*)$ ]]; then
            key="${BASH_REMATCH[1]}"
            value="${BASH_REMATCH[2]}"
            json_parts+=("\"$key\":\"$(sql_escape "$value")\"")
        fi
    done
    
    printf '{%s}' "$(IFS=','; echo "${json_parts[*]}")"
}

# Extract value from simple JSON
json_extract() {
    local json="$1"
    local key="$2"
    
    # Simple regex extraction for basic JSON
    if [[ "$json" =~ \"$key\":\"([^\"]*) ]]; then
        printf '%s' "${BASH_REMATCH[1]}"
    fi
}

# Get current timestamp in SQLite format
current_timestamp() {
    date '+%Y-%m-%d %H:%M:%S'
}

# Database health check
check_databases() {
    local status=0
    
    echo "Checking database health..."
    
    # Check session database
    if [[ -f "$SESSION_DB" ]]; then
        if db_query "$SESSION_DB" "SELECT 1;" >/dev/null 2>&1; then
            echo "  ✓ Session database: OK ($(du -h "$SESSION_DB" 2>/dev/null | cut -f1))"
        else
            echo "  ✗ Session database: CORRUPT"
            status=1
        fi
    else
        echo "  ✗ Session database: NOT INITIALIZED"
        echo "    Run: ./claude-compiler.sh init"
        status=1
    fi
    
    # Check todo database
    if [[ -f "$TODO_DB" ]]; then
        if db_query "$TODO_DB" "SELECT 1;" >/dev/null 2>&1; then
            echo "  ✓ Todo database: OK ($(du -h "$TODO_DB" 2>/dev/null | cut -f1))"
        else
            echo "  ✗ Todo database: CORRUPT"
            status=1
        fi
    else
        echo "  ✗ Todo database: NOT INITIALIZED"
        echo "    Run: ./claude-compiler.sh init"
        status=1
    fi
    
    return $status
}

# Database cleanup utilities
cleanup_dormant_sessions() {
    local minutes="${1:-30}"
    local cutoff_time
    
    cutoff_time=$(date -d "$minutes minutes ago" '+%Y-%m-%d %H:%M:%S' 2>/dev/null) || \
    cutoff_time=$(date -v -"${minutes}M" '+%Y-%m-%d %H:%M:%S' 2>/dev/null) || {
        echo "Error: Unable to calculate cutoff time" >&2
        return 1
    }
    
    echo "Cleaning up sessions inactive since: $cutoff_time"
    
    local count
    count=$(db_query "$SESSION_DB" "
        UPDATE sessions 
        SET status = 'dormant' 
        WHERE last_activity < '$cutoff_time' 
          AND status = 'active';
        SELECT changes();
    ")
    
    echo "Marked $count sessions as dormant"
}

# Database statistics
show_database_stats() {
    local session_count todo_count active_sessions
    
    echo "=== Database Statistics ==="
    
    # Session stats
    session_count=$(db_query "$SESSION_DB" "SELECT COUNT(*) FROM sessions;")
    active_sessions=$(db_query "$SESSION_DB" "SELECT COUNT(*) FROM sessions WHERE status = 'active';")
    echo "Sessions: $session_count total, $active_sessions active"
    
    # Todo stats
    todo_count=$(db_query "$TODO_DB" "SELECT COUNT(*) FROM todos;")
    local open_todos completed_todos
    open_todos=$(db_query "$TODO_DB" "SELECT COUNT(*) FROM todos WHERE status = 'open';")
    completed_todos=$(db_query "$TODO_DB" "SELECT COUNT(*) FROM todos WHERE status = 'completed';")
    echo "Tasks: $todo_count total, $open_todos open, $completed_todos completed"
    
    # Database sizes
    if command -v du >/dev/null; then
        local session_size todo_size
        session_size=$(du -h "$SESSION_DB" 2>/dev/null | cut -f1)
        todo_size=$(du -h "$TODO_DB" 2>/dev/null | cut -f1)
        echo "Database sizes: sessions=$session_size, todos=$todo_size"
    fi
    
    echo "=========================="
}