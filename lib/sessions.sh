#!/bin/bash

# Claude Compiler Session Management - Pure Bash Implementation
# Handles session lifecycle, conflict detection, and coordination

# Source database layer
[[ -z "$DATABASE_LOADED" ]] && source "$(dirname "${BASH_SOURCE[0]}")/database.sh"

# Session management functions

# Start a new session
session_start() {
    local project_name="$1"
    local session_type="${2:-cli}"
    local working_dir="${3:-$(pwd)}"
    local session_id
    
    session_id=$(generate_uuid)
    
    # Create session record
    local metadata
    metadata=$(json_encode \
        "startup_time=$(date +%s)" \
        "working_directory=$working_dir" \
        "pid=$$"
    )
    
    db_exec "$SESSION_DB" "
        INSERT INTO sessions (
            session_id, type, name, status, started_at, 
            last_activity, host_project, working_directory, metadata
        ) VALUES (
            '$(sql_escape "$session_id")',
            '$(sql_escape "$session_type")',
            '$(sql_escape "$project_name")',
            'active',
            '$(current_timestamp)',
            '$(current_timestamp)',
            '$(sql_escape "$project_name")',
            '$(sql_escape "$working_dir")',
            '$(sql_escape "$metadata")'
        );
    "
    
    # Log session start activity
    session_log_activity "$session_id" "session_started" \
        "project=$project_name" "type=$session_type" "working_dir=$working_dir"
    
    echo "$session_id"
}

# End a session
session_end() {
    local session_id="$1"
    local status="${2:-completed}"
    
    if [[ -z "$session_id" ]]; then
        echo "Error: Session ID required" >&2
        return 1
    fi
    
    # Update session status
    db_exec "$SESSION_DB" "
        UPDATE sessions 
        SET status = '$(sql_escape "$status")',
            ended_at = '$(current_timestamp)'
        WHERE session_id = '$(sql_escape "$session_id")';
    "
    
    # Log session end activity
    session_log_activity "$session_id" "session_ended" "status=$status"
    
    echo "Session $session_id ended with status: $status"
}

# Get session info
session_get() {
    local session_id="$1"
    
    if [[ -z "$session_id" ]]; then
        echo "Error: Session ID required" >&2
        return 1
    fi
    
    db_query "$SESSION_DB" "
        SELECT session_id, type, name, status, started_at, ended_at,
               last_activity, host_project, working_directory
        FROM sessions 
        WHERE session_id = '$(sql_escape "$session_id")';
    "
}

# List sessions with filters
session_list() {
    local status_filter="$1"
    local limit="${2:-50}"
    
    local where_clause=""
    if [[ -n "$status_filter" ]]; then
        where_clause="WHERE status = '$(sql_escape "$status_filter")'"
    fi
    
    db_query "$SESSION_DB" "
        SELECT session_id, type, name, status, started_at, host_project
        FROM sessions 
        $where_clause
        ORDER BY started_at DESC 
        LIMIT $limit;
    "
}

# Update session activity timestamp
session_heartbeat() {
    local session_id="$1"
    
    if [[ -z "$session_id" ]]; then
        return 1
    fi
    
    db_exec "$SESSION_DB" "
        UPDATE sessions 
        SET last_activity = '$(current_timestamp)'
        WHERE session_id = '$(sql_escape "$session_id")';
    "
}

# Log session activity
session_log_activity() {
    local session_id="$1"
    local activity="$2"
    shift 2
    
    local data
    data=$(json_encode "$@")
    
    db_exec "$SESSION_DB" "
        INSERT INTO session_activities (session_id, activity, timestamp, data)
        VALUES (
            '$(sql_escape "$session_id")',
            '$(sql_escape "$activity")',
            '$(current_timestamp)',
            '$(sql_escape "$data")'
        );
    "
    
    # Update session heartbeat
    session_heartbeat "$session_id"
}

# Log a prompt execution
session_log_prompt() {
    local session_id="$1"
    local prompt_type="$2"
    local prompt_text="$3"
    local response_text="$4"
    local execution_time="${5:-0}"
    local tokens="${6:-0}"
    
    db_exec "$SESSION_DB" "
        INSERT INTO session_prompts (
            session_id, prompt_type, prompt_text, response_text,
            timestamp, execution_time_ms, tokens_used
        ) VALUES (
            '$(sql_escape "$session_id")',
            '$(sql_escape "$prompt_type")',
            '$(sql_escape "$prompt_text")',
            '$(sql_escape "$response_text")',
            '$(current_timestamp)',
            $execution_time,
            $tokens
        );
    "
}

# Record file changes
session_record_file_change() {
    local session_id="$1"
    local file_path="$2"
    local change_type="$3"
    local old_hash="${4:-}"
    local new_hash="${5:-}"
    
    db_exec "$SESSION_DB" "
        INSERT INTO session_file_changes (
            session_id, file_path, change_type, timestamp,
            old_content_hash, new_content_hash
        ) VALUES (
            '$(sql_escape "$session_id")',
            '$(sql_escape "$file_path")',
            '$(sql_escape "$change_type")',
            '$(current_timestamp)',
            '$(sql_escape "$old_hash")',
            '$(sql_escape "$new_hash")'
        );
    "
    
    session_log_activity "$session_id" "file_changed" \
        "file_path=$file_path" "change_type=$change_type"
}

# Check for session conflicts
session_check_conflicts() {
    local session_id="$1"
    
    db_query "$SESSION_DB" "
        SELECT sc.conflict_type, sc.conflict_details, sc.detected_at,
               s1.name as session1_name, s2.name as session2_name
        FROM session_conflicts sc
        JOIN sessions s1 ON s1.session_id = sc.session1_id
        JOIN sessions s2 ON s2.session_id = sc.session2_id
        WHERE (sc.session1_id = '$(sql_escape "$session_id")' 
               OR sc.session2_id = '$(sql_escape "$session_id")')
          AND sc.resolved_at IS NULL
        ORDER BY sc.detected_at DESC;
    "
}

# Send message to another session
session_send_message() {
    local from_session="$1"
    local to_session="$2"
    local message_type="$3"
    local message="$4"
    
    db_exec "$SESSION_DB" "
        INSERT INTO session_messages (
            from_session_id, to_session_id, message_type, 
            message, timestamp
        ) VALUES (
            '$(sql_escape "$from_session")',
            '$(sql_escape "$to_session")',
            '$(sql_escape "$message_type")',
            '$(sql_escape "$message")',
            '$(current_timestamp)'
        );
    "
    
    echo "Message sent from $from_session to $to_session"
}

# Check messages for a session
session_check_messages() {
    local session_id="$1"
    
    db_query "$SESSION_DB" "
        SELECT sm.id, sm.from_session_id, sm.message_type, 
               sm.message, sm.timestamp, s.name as from_session_name
        FROM session_messages sm
        LEFT JOIN sessions s ON s.session_id = sm.from_session_id
        WHERE sm.to_session_id = '$(sql_escape "$session_id")'
          AND sm.read_at IS NULL
        ORDER BY sm.timestamp ASC;
    "
}

# Mark message as read
session_mark_message_read() {
    local message_id="$1"
    
    db_exec "$SESSION_DB" "
        UPDATE session_messages 
        SET read_at = '$(current_timestamp)'
        WHERE id = $message_id;
    "
}

# Get session statistics
session_get_statistics() {
    local session_id="$1"
    
    db_query "$SESSION_DB" "
        SELECT 
            (SELECT COUNT(*) FROM session_prompts WHERE session_id = '$(sql_escape "$session_id")') as prompt_count,
            (SELECT COUNT(*) FROM session_file_changes WHERE session_id = '$(sql_escape "$session_id")') as files_changed,
            (SELECT COUNT(*) FROM session_activities WHERE session_id = '$(sql_escape "$session_id")') as activity_count,
            (SELECT AVG(execution_time_ms) FROM session_prompts WHERE session_id = '$(sql_escape "$session_id")')::INTEGER as avg_execution_time,
            (SELECT SUM(tokens_used) FROM session_prompts WHERE session_id = '$(sql_escape "$session_id")')::INTEGER as total_tokens
    "
}

# Get active sessions count
session_get_active_count() {
    db_query "$SESSION_DB" "
        SELECT COUNT(*) FROM sessions WHERE status = 'active';
    "
}

# Find sessions working on the same files
session_find_file_conflicts() {
    local session_id="$1"
    local file_path="$2"
    
    db_query "$SESSION_DB" "
        SELECT DISTINCT s.session_id, s.name, s.status, sfc.change_type, sfc.timestamp
        FROM session_file_changes sfc
        JOIN sessions s ON s.session_id = sfc.session_id
        WHERE sfc.file_path = '$(sql_escape "$file_path")'
          AND sfc.session_id != '$(sql_escape "$session_id")'
          AND s.status = 'active'
          AND sfc.timestamp > datetime('now', '-1 hour')
        ORDER BY sfc.timestamp DESC;
    "
}