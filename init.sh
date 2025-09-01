#!/bin/bash

# Simple initialization script for Claude Compiler databases

echo "Claude Compiler Database Initialization"
echo "========================================"

DB_DIR="./db"
SESSION_DB="$DB_DIR/sessions.db"
TODO_DB="$DB_DIR/todos.db"

# Create database directory
mkdir -p "$DB_DIR"

# Initialize session database
echo "→ Creating session database..."
if session_schema=$(< "$DB_DIR/schemas/session-schema.sql"); then
    if echo "$session_schema" | sqlite3 "$SESSION_DB"; then
        echo "  ✓ Session database created successfully"
    else
        echo "  ✗ Failed to create session database" >&2
        exit 1
    fi
else
    echo "  ✗ Session schema not found" >&2
    exit 1
fi

# Initialize todo database
echo "→ Creating todo database..."
if todo_schema=$(< "$DB_DIR/schemas/todo-schema.sql"); then
    if echo "$todo_schema" | sqlite3 "$TODO_DB"; then
        echo "  ✓ Todo database created successfully"
    else
        echo "  ✗ Failed to create todo database" >&2
        exit 1
    fi
else
    echo "  ✗ Todo schema not found" >&2
    exit 1
fi

# Show database info
echo ""
echo "Database Status:"
echo "----------------"
ls -lh db/*.db | while read -r line; do
    echo "  $line"
done

echo ""
echo "✓ Initialization complete!"
echo "  You can now use: ./claude-compiler.sh"