#!/bin/bash

echo "Starting test main..."

# Configuration 
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "Script dir: $SCRIPT_DIR"

# Database configuration  
readonly DB_DIR="$SCRIPT_DIR/db"
readonly SESSION_DB="$DB_DIR/sessions.db"
readonly TODO_DB="$DB_DIR/todos.db"
echo "Database dir: $DB_DIR"

# Load libraries
echo "Loading libraries..."
source "$SCRIPT_DIR/lib/database.sh"
echo "Database library loaded"

source "$SCRIPT_DIR/lib/sessions.sh" 
echo "Sessions library loaded"

source "$SCRIPT_DIR/lib/todos.sh"
echo "Todos library loaded"

# Simple show_help function
show_help() {
    echo "This is help"
}

echo "Libraries loaded, processing arguments..."

# Only execute main logic if script is run directly (not sourced)
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    echo "Running directly, checking arguments"
    if (($# > 0)); then
        echo "Arguments provided: $*"
        first_arg=$(echo "$1" | tr '[:upper:]' '[:lower:]')
        echo "First arg: $first_arg"
        
        case "$first_arg" in
            help|h|-h|--help)
                echo "Showing help"
                show_help
                exit 0
                ;;
            *)
                echo "Unknown command: $first_arg"
                ;;
        esac
    else
        echo "No arguments - would start interactive mode"
    fi
fi

echo "Test complete"