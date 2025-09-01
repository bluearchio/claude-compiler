#!/bin/bash

# Claude Compiler Task Management - Pure Bash Implementation
# Handles TODO/task lifecycle, dependencies, and workflow tracking

# Source database layer
[[ -z "$DATABASE_LOADED" ]] && source "$(dirname "${BASH_SOURCE[0]}")/database.sh"

# Task management functions

# Create a new task
todo_create() {
    local task_text="$1"
    local description="$2"
    local priority="${3:-3}"
    local category="${4:-}"
    local assigned_to="${5:-}"
    local parent_task_id="${6:-}"
    
    if [[ -z "$task_text" ]]; then
        echo "Error: Task text required" >&2
        return 1
    fi
    
    # Validate priority
    if [[ ! "$priority" =~ ^[1-4]$ ]]; then
        echo "Error: Priority must be 1-4" >&2
        return 1
    fi
    
    # Create metadata
    local metadata
    metadata=$(json_encode \
        "created_by=${assigned_to:-system}" \
        "original_priority=$priority"
    )
    
    # Insert task
    local sql="
        INSERT INTO todos (
            task, description, status, priority, category, 
            assigned_to, parent_task_id, metadata
        ) VALUES (
            '$(sql_escape "$task_text")',
            '$(sql_escape "$description")',
            'open',
            $priority,
            '$(sql_escape "$category")',
            '$(sql_escape "$assigned_to")',
            $([ -n "$parent_task_id" ] && echo "$parent_task_id" || echo "NULL"),
            '$(sql_escape "$metadata")'
        );
        SELECT last_insert_rowid();
    "
    
    local task_id
    task_id=$(db_query "$TODO_DB" "$sql")
    
    echo "Task created with ID: $task_id"
    echo "$task_id"
}

# Update task status
todo_update_status() {
    local task_id="$1"
    local new_status="$2"
    local session_id="${3:-}"
    local reason="${4:-}"
    
    if [[ -z "$task_id" || -z "$new_status" ]]; then
        echo "Error: Task ID and status required" >&2
        return 1
    fi
    
    # Validate status
    case "$new_status" in
        open|in_progress|completed|blocked|cancelled) ;;
        *) echo "Error: Invalid status: $new_status" >&2; return 1 ;;
    esac
    
    # Update task
    local update_sql="
        UPDATE todos 
        SET status = '$(sql_escape "$new_status")',
            assigned_to = '$(sql_escape "$session_id")'
    "
    
    # Add reason for blocked tasks
    if [[ "$new_status" == "blocked" && -n "$reason" ]]; then
        update_sql="$update_sql, blocked_reason = '$(sql_escape "$reason")'"
    fi
    
    update_sql="$update_sql WHERE id = $task_id;"
    
    db_exec "$TODO_DB" "$update_sql"
    
    # Log status change
    todo_add_comment "$task_id" "$session_id" "Status changed to: $new_status${reason:+ ($reason)}"
    
    echo "Task $task_id status updated to: $new_status"
}

# Get task details
todo_get() {
    local task_id="$1"
    
    if [[ -z "$task_id" ]]; then
        echo "Error: Task ID required" >&2
        return 1
    fi
    
    db_query "$TODO_DB" "
        SELECT id, task, description, status, priority, category,
               assigned_to, created_at, updated_at, completed_at,
               blocked_at, blocked_reason, parent_task_id, metadata
        FROM todos 
        WHERE id = $task_id;
    "
}

# List tasks with filters
todo_list() {
    local status_filter="$1"
    local priority_filter="$2"
    local assigned_filter="$3"
    local limit="${4:-50}"
    
    local where_clauses=()
    
    if [[ -n "$status_filter" ]]; then
        where_clauses+=("status = '$(sql_escape "$status_filter")'")
    fi
    
    if [[ -n "$priority_filter" ]]; then
        where_clauses+=("priority = $priority_filter")
    fi
    
    if [[ -n "$assigned_filter" ]]; then
        where_clauses+=("assigned_to = '$(sql_escape "$assigned_filter")'")
    fi
    
    local where_clause=""
    if [[ ${#where_clauses[@]} -gt 0 ]]; then
        where_clause="WHERE $(IFS=' AND '; echo "${where_clauses[*]}")"
    fi
    
    db_query "$TODO_DB" "
        SELECT id, task, status, priority, category, assigned_to, 
               created_at, updated_at
        FROM todos 
        $where_clause
        ORDER BY priority ASC, created_at DESC 
        LIMIT $limit;
    "
}

# Add comment to task
todo_add_comment() {
    local task_id="$1"
    local session_id="$2"
    local comment="$3"
    
    if [[ -z "$task_id" || -z "$comment" ]]; then
        echo "Error: Task ID and comment required" >&2
        return 1
    fi
    
    db_exec "$TODO_DB" "
        INSERT INTO task_comments (task_id, session_id, comment)
        VALUES (
            $task_id,
            '$(sql_escape "$session_id")',
            '$(sql_escape "$comment")'
        );
    "
    
    echo "Comment added to task $task_id"
}

# Get task comments
todo_get_comments() {
    local task_id="$1"
    
    if [[ -z "$task_id" ]]; then
        echo "Error: Task ID required" >&2
        return 1
    fi
    
    db_query "$TODO_DB" "
        SELECT id, session_id, comment, created_at
        FROM task_comments 
        WHERE task_id = $task_id
        ORDER BY created_at ASC;
    "
}

# Add task dependency
todo_add_dependency() {
    local task_id="$1"
    local depends_on_id="$2"
    
    if [[ -z "$task_id" || -z "$depends_on_id" ]]; then
        echo "Error: Both task IDs required" >&2
        return 1
    fi
    
    # Check for circular dependencies
    if todo_check_circular_dependency "$task_id" "$depends_on_id"; then
        echo "Error: Circular dependency detected" >&2
        return 1
    fi
    
    db_exec "$TODO_DB" "
        INSERT OR IGNORE INTO task_dependencies (task_id, depends_on_task_id)
        VALUES ($task_id, $depends_on_id);
    "
    
    echo "Dependency added: Task $task_id depends on Task $depends_on_id"
}

# Check for circular dependencies
todo_check_circular_dependency() {
    local task_id="$1"
    local depends_on_id="$2"
    
    # Simple check: see if depends_on_id already depends on task_id
    local count
    count=$(db_query "$TODO_DB" "
        WITH RECURSIVE dep_chain(task_id, level) AS (
            SELECT depends_on_task_id, 1
            FROM task_dependencies
            WHERE task_id = $depends_on_id
            
            UNION ALL
            
            SELECT td.depends_on_task_id, dc.level + 1
            FROM task_dependencies td
            JOIN dep_chain dc ON td.task_id = dc.task_id
            WHERE dc.level < 10
        )
        SELECT COUNT(*)
        FROM dep_chain
        WHERE task_id = $task_id;
    ")
    
    [[ "$count" -gt 0 ]]
}

# Get task dependencies
todo_get_dependencies() {
    local task_id="$1"
    
    if [[ -z "$task_id" ]]; then
        echo "Error: Task ID required" >&2
        return 1
    fi
    
    db_query "$TODO_DB" "
        SELECT td.depends_on_task_id, t.task, t.status, t.priority
        FROM task_dependencies td
        JOIN todos t ON t.id = td.depends_on_task_id
        WHERE td.task_id = $task_id
        ORDER BY t.priority ASC;
    "
}

# Get blocked tasks (tasks waiting for dependencies)
todo_get_blocked() {
    db_query "$TODO_DB" "
        SELECT t.id, t.task, t.status, t.priority,
               GROUP_CONCAT(dt.task || ' (' || dt.status || ')') as blocking_tasks
        FROM todos t
        JOIN task_dependencies td ON td.task_id = t.id
        JOIN todos dt ON dt.id = td.depends_on_task_id
        WHERE t.status IN ('open', 'blocked')
          AND dt.status != 'completed'
        GROUP BY t.id, t.task, t.status, t.priority
        ORDER BY t.priority ASC;
    "
}

# Get ready tasks (no blocking dependencies)
todo_get_ready() {
    local session_id="${1:-}"
    
    local assigned_clause=""
    if [[ -n "$session_id" ]]; then
        assigned_clause="AND (t.assigned_to IS NULL OR t.assigned_to = '$(sql_escape "$session_id")')"
    fi
    
    db_query "$TODO_DB" "
        SELECT t.id, t.task, t.status, t.priority, t.category
        FROM todos t
        WHERE t.status = 'open'
          AND t.id NOT IN (
              SELECT DISTINCT td.task_id
              FROM task_dependencies td
              JOIN todos dt ON dt.id = td.depends_on_task_id
              WHERE dt.status != 'completed'
          )
          $assigned_clause
        ORDER BY t.priority ASC, t.created_at ASC;
    "
}

# Get task statistics
todo_get_statistics() {
    local session_id="${1:-}"
    
    local where_clause=""
    if [[ -n "$session_id" ]]; then
        where_clause="WHERE assigned_to = '$(sql_escape "$session_id")'"
    fi
    
    db_query "$TODO_DB" "
        SELECT 
            COUNT(*) as total_tasks,
            SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open_tasks,
            SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_tasks,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
            SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) as blocked_tasks,
            SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_tasks,
            SUM(CASE WHEN priority = 1 THEN 1 ELSE 0 END) as critical_tasks,
            SUM(CASE WHEN priority = 2 THEN 1 ELSE 0 END) as high_priority_tasks
        FROM todos 
        $where_clause;
    "
}

# Search tasks by text
todo_search() {
    local search_term="$1"
    local limit="${2:-20}"
    
    if [[ -z "$search_term" ]]; then
        echo "Error: Search term required" >&2
        return 1
    fi
    
    db_query "$TODO_DB" "
        SELECT id, task, description, status, priority, category
        FROM todos 
        WHERE task LIKE '%$(sql_escape "$search_term")%'
           OR description LIKE '%$(sql_escape "$search_term")%'
        ORDER BY priority ASC, created_at DESC
        LIMIT $limit;
    "
}

# Complete task (shorthand)
todo_complete() {
    local task_id="$1"
    local session_id="${2:-}"
    
    todo_update_status "$task_id" "completed" "$session_id" "Task completed"
}

# Block task (shorthand)
todo_block() {
    local task_id="$1"
    local session_id="$2"
    local reason="$3"
    
    todo_update_status "$task_id" "blocked" "$session_id" "$reason"
}

# Start working on task (shorthand)
todo_start() {
    local task_id="$1"
    local session_id="${2:-}"
    
    todo_update_status "$task_id" "in_progress" "$session_id" "Work started"
}

# Get task history/audit trail
todo_get_history() {
    local task_id="$1"
    
    if [[ -z "$task_id" ]]; then
        echo "Error: Task ID required" >&2
        return 1
    fi
    
    db_query "$TODO_DB" "
        SELECT field_name, old_value, new_value, changed_by, changed_at
        FROM task_history 
        WHERE task_id = $task_id
        ORDER BY changed_at ASC;
    "
}