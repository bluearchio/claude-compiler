# Claude Compiler Architecture

## Overview
Claude Compiler is a pure Bash implementation that wraps the Claude CLI with session tracking, task management, and prompt injection capabilities.

## Core Components

### 1. Main Script (`claude-compiler.sh`)
- Entry point for all functionality
- Handles both interactive and non-interactive modes
- Manages the main command loop

### 2. Library Modules (`lib/`)
- **database.sh**: SQLite database operations and utilities
- **sessions.sh**: Session management functions
- **todos.sh**: Task/TODO management functions

### 3. Database Layer (`db/`)
- **sessions.db**: Tracks all AI assistant sessions
- **todos.db**: Manages tasks and their states
- **schemas/**: SQL schema definitions

### 4. Configuration (`config/`)
- Reserved for future configuration files

### 5. Tests (`tests/`)
- Performance and optimization test scripts
- Unit tests for individual components

## Data Flow

1. User input → `claude-compiler.sh`
2. Front-loaded prompt injection (if configured)
3. Session tracking (database update)
4. Claude CLI execution
5. Response output
6. Session update (completion status)

## Session Management

Sessions prevent conflicts between concurrent AI assistants:
- Each session gets a unique UUID
- Sessions track: project, status, activity timestamps
- Automatic dormancy detection after 15 minutes
- File locking mechanism (planned)

## Task Management

SQLite-based task tracking:
- Hierarchical structure: Goals → Components → Tasks
- Priority levels (1-4)
- Status tracking: open, in_progress, completed, blocked
- Full audit trail in task_log table

## Design Principles

1. **Pure Bash**: No Node.js dependencies
2. **SQLite for persistence**: Lightweight, file-based databases
3. **Modular architecture**: Separate concerns into libraries
4. **Session safety**: Prevent concurrent modification conflicts
5. **Audit trails**: Complete history of all operations