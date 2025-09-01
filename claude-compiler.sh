#!/bin/bash

# Claude Compiler v2.0 - Pure Bash Implementation
# Complete session tracking, task management, and Claude integration without Node.js

# Configuration
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly FRONT_LOADED_FILE="$SCRIPT_DIR/front-loaded-prompt.txt"
readonly SESSION_DIR="$SCRIPT_DIR/.sessions"
readonly CURRENT_SESSION_FILE="$SESSION_DIR/current-session.txt"

# Database configuration
readonly DB_DIR="$SCRIPT_DIR/db"
readonly SESSION_DB="$DB_DIR/sessions.db"
readonly TODO_DB="$DB_DIR/todos.db"

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m'

# Global variables
CURRENT_SESSION_ID=""
CURRENT_PROJECT_NAME=""
CLAUDE_COMMAND_CHECKED=""
FRONT_LOADED_CACHE=""
FRONT_LOADED_MTIME=""

# Initialize session directory
[[ ! -d "$SESSION_DIR" ]] && mkdir -p "$SESSION_DIR"

# Load libraries
source "$SCRIPT_DIR/lib/database.sh" 2>/dev/null || echo "Warning: database.sh not found"
source "$SCRIPT_DIR/lib/sessions.sh" 2>/dev/null || echo "Warning: sessions.sh not found"
source "$SCRIPT_DIR/lib/todos.sh" 2>/dev/null || echo "Warning: todos.sh not found"

# Front-loaded prompt functions
load_front_loaded_prompt() {
    [[ ! -f "$FRONT_LOADED_FILE" ]] && { echo ""; return; }
    cat "$FRONT_LOADED_FILE" 2>/dev/null || echo ""
}

save_front_loaded_prompt() {
    printf '%s' "$1" > "$FRONT_LOADED_FILE" || return 1
    FRONT_LOADED_CACHE=""
    printf "${GREEN}✓${NC} Front-loaded prompt saved\n"
}

show_front_loaded_prompt() {
    local prompt
    prompt=$(load_front_loaded_prompt)
    
    printf '\n=== Current Front-loaded Prompt ===\n'
    if [[ -n "$prompt" ]]; then
        printf '%s\n' "$prompt"
    else
        printf '(No front-loaded prompt set)\n'
    fi
    printf '=== End of Front-loaded Prompt ===\n\n'
}

edit_front_loaded_prompt() {
    local current_prompt new_prompt
    current_prompt=$(load_front_loaded_prompt)
    
    printf '\n=== Edit Front-loaded Prompt ===\n'
    printf 'Current prompt:\n'
    if [[ -n "$current_prompt" ]]; then
        printf '%s\n' "$current_prompt"
    else
        printf '(empty)\n'
    fi
    
    printf '\nEnter new front-loaded prompt (press Ctrl+D when done):\n'
    new_prompt=$(cat)
    
    if [[ "$new_prompt" != "$current_prompt" ]]; then
        save_front_loaded_prompt "$new_prompt"
    else
        printf 'No changes made.\n'
    fi
}

combine_prompts() {
    local user_prompt="$1" front_loaded
    front_loaded=$(load_front_loaded_prompt)
    
    if [[ -n "$front_loaded" ]]; then
        printf '%s\n\n%s' "$front_loaded" "$user_prompt"
    else
        printf '%s' "$user_prompt"
    fi
}

preview_combined_prompt() {
    local user_prompt="$1"
    printf '\n=== Combined Prompt Preview ===\n'
    combine_prompts "$user_prompt"
    printf '\n=== End of Preview ===\n\n'
}

# Check if claude command exists
check_claude_command() {
    [[ "$CLAUDE_COMMAND_CHECKED" == "1" ]] && return 0
    
    if ! command -v claude >/dev/null 2>&1; then
        printf "${RED}❌ ERROR: 'claude' command not found${NC}\n"
        printf "Please install Claude CLI:\n"
        printf "  npm install -g @anthropic-ai/claude-code\n\n"
        return 1
    fi
    
    CLAUDE_COMMAND_CHECKED="1"
    return 0
}

# Run Claude with the combined prompt
run_claude() {
    local user_prompt="$1" combined_prompt exit_code
    
    if ! check_claude_command; then
        return 1
    fi
    
    combined_prompt=$(combine_prompts "$user_prompt")
    
    printf "${BLUE}Starting Claude...${NC}\n"
    
    # Log prompt to session if we have one
    if [[ -n "$CURRENT_SESSION_ID" ]]; then
        session_log_activity "$CURRENT_SESSION_ID" "prompt_submitted" "prompt_length=${#combined_prompt}" 2>/dev/null
    fi
    
    # Execute Claude
    printf '%s' "$combined_prompt" | claude --print \
        --output-format text \
        --permission-mode default
    exit_code=$?
    
    if ((exit_code == 0)); then
        printf "\n${GREEN}✓${NC} Claude completed\n"
    else
        printf "\n${RED}✗${NC} Claude exited with code $exit_code\n"
    fi
    
    return $exit_code
}

# Session management helpers
load_current_session() {
    if [[ -f "$CURRENT_SESSION_FILE" ]]; then
        local session_info
        session_info=$(<"$CURRENT_SESSION_FILE")
        if [[ "$session_info" =~ ^([^|]+)\|(.+)$ ]]; then
            CURRENT_SESSION_ID="${BASH_REMATCH[1]}"
            CURRENT_PROJECT_NAME="${BASH_REMATCH[2]}"
            return 0
        fi
    fi
    CURRENT_SESSION_ID=""
    CURRENT_PROJECT_NAME=""
    return 1
}

save_current_session() {
    echo "$1|$2" > "$CURRENT_SESSION_FILE"
    CURRENT_SESSION_ID="$1"
    CURRENT_PROJECT_NAME="$2"
}

clear_current_session() {
    [[ -f "$CURRENT_SESSION_FILE" ]] && rm "$CURRENT_SESSION_FILE"
    CURRENT_SESSION_ID=""
    CURRENT_PROJECT_NAME=""
}

# Command handlers
handle_init() {
    printf "${BLUE}Initializing databases...${NC}\n"
    
    if [[ -f "$SESSION_DB" && -f "$TODO_DB" ]]; then
        printf "${YELLOW}Databases already exist${NC}\n"
        return 0
    fi
    
    # Initialize databases using the init script
    if [[ -f "$SCRIPT_DIR/init.sh" ]]; then
        bash "$SCRIPT_DIR/init.sh"
    else
        if init_databases 2>/dev/null; then
            printf "${GREEN}✓${NC} Databases initialized\n"
        else
            printf "${RED}✗${NC} Failed to initialize databases\n"
            return 1
        fi
    fi
}

handle_start_session() {
    local project_name="$1"
    local session_type="${2:-cli}"
    
    if [[ -z "$project_name" ]]; then
        printf "${RED}Error: Project name required${NC}\n"
        return 1
    fi
    
    # Check databases
    if [[ ! -f "$SESSION_DB" || ! -f "$TODO_DB" ]]; then
        handle_init || return 1
    fi
    
    local session_id
    session_id=$(session_start "$project_name" "$session_type" "$(pwd)" 2>/dev/null)
    
    if [[ -n "$session_id" ]]; then
        save_current_session "$session_id" "$project_name"
        printf "${GREEN}✓${NC} Session started: ${session_id:0:8}...\n"
    else
        printf "${RED}✗${NC} Failed to start session\n"
        return 1
    fi
}

handle_end_session() {
    if [[ -z "$CURRENT_SESSION_ID" ]]; then
        printf "${YELLOW}No active session${NC}\n"
        return 1
    fi
    
    session_end "$CURRENT_SESSION_ID" "completed" 2>/dev/null
    printf "${GREEN}✓${NC} Session ended\n"
    clear_current_session
}

handle_session_status() {
    # Load current session if not already loaded
    if [[ -z "$CURRENT_SESSION_ID" ]]; then
        load_current_session
    fi
    
    if [[ -z "$CURRENT_SESSION_ID" ]]; then
        printf "${YELLOW}No active session${NC}\n"
        return 1
    fi
    
    printf "${BLUE}Session Status${NC}\n"
    printf "ID: ${CURRENT_SESSION_ID:0:8}...\n"
    printf "Project: $CURRENT_PROJECT_NAME\n"
}

# Show help
show_help() {
    cat << 'EOF'

Claude Compiler v2.0

COMMANDS:
  help, h         - Show this help
  init            - Initialize databases
  start <project> - Start session
  end             - End session
  status          - Session status
  
  todo create <task> [priority] - Create task
  todo list       - List tasks
  todo complete <id> - Complete task
  
  edit, e         - Edit front-loaded prompt
  show, s         - Show front-loaded prompt
  
  db check        - Check databases
  db stats        - Database statistics
  
  quit, q         - Exit
  <text>          - Send to Claude

EOF
}

# Main interactive loop
main_interactive() {
    printf "Claude Compiler v2.0\n"
    printf "Type 'help' for commands\n\n"
    
    load_current_session
    if [[ -n "$CURRENT_SESSION_ID" ]]; then
        printf "${GREEN}Session: $CURRENT_PROJECT_NAME${NC}\n\n"
    fi
    
    local input cmd args
    while true; do
        if [[ -n "$CURRENT_PROJECT_NAME" ]]; then
            read -r -p "[$CURRENT_PROJECT_NAME]> " input || break
        else
            read -r -p "claude> " input || break
        fi
        
        [[ -z "$input" ]] && continue
        
        read -ra args <<< "$input"
        cmd=$(echo "${args[0]}" | tr '[:upper:]' '[:lower:]')
        
        case "$cmd" in
            help|h) show_help ;;
            quit|q|exit) 
                [[ -n "$CURRENT_SESSION_ID" ]] && handle_end_session
                printf "Goodbye!\n"
                exit 0
                ;;
            init) handle_init ;;
            start) handle_start_session "${args[1]}" "${args[2]}" ;;
            end) handle_end_session ;;
            status) handle_session_status ;;
            edit|e) edit_front_loaded_prompt ;;
            show|s) show_front_loaded_prompt ;;
            preview) 
                [[ -n "${input#preview }" ]] && preview_combined_prompt "${input#preview }"
                ;;
            todo)
                subcmd=$(echo "${args[1]}" | tr '[:upper:]' '[:lower:]')
                case "$subcmd" in
                    create)
                        [[ -n "${args[2]}" ]] && \
                            todo_create "${args[2]}" "" "${args[3]:-3}" "" "$CURRENT_SESSION_ID" 2>/dev/null
                        ;;
                    list)
                        todo_list "" "" "$CURRENT_SESSION_ID" 2>/dev/null
                        ;;
                    complete)
                        [[ -n "${args[2]}" ]] && \
                            todo_complete "${args[2]}" "$CURRENT_SESSION_ID" 2>/dev/null
                        ;;
                    *)
                        printf "Usage: todo [create|list|complete]\n"
                        ;;
                esac
                ;;
            db)
                subcmd=$(echo "${args[1]}" | tr '[:upper:]' '[:lower:]')
                case "$subcmd" in
                    check) check_databases 2>/dev/null ;;
                    stats) show_database_stats 2>/dev/null ;;
                    *) printf "Usage: db [check|stats]\n" ;;
                esac
                ;;
            *)
                run_claude "$input"
                ;;
        esac
    done
}

# Main execution - prioritize arguments over stdin detection
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    if (($# > 0)); then
        # Arguments provided - handle them
        first_arg=$(echo "$1" | tr '[:upper:]' '[:lower:]')
        case "$first_arg" in
            help|h|-h|--help)
                show_help
                ;;
            init)
                handle_init
                ;;
            start)
                handle_start_session "$2" "$3"
                ;;
            end)
                handle_end_session
                ;;
            status)
                handle_session_status
                ;;
            *)
                # Treat as prompt for Claude
                check_claude_command && run_claude "$*"
                ;;
        esac
    else
        # No arguments - always start interactive mode
        # (Piped input should be provided with arguments or via echo "prompt" | ./script)
        main_interactive
    fi
fi