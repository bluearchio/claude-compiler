# Claude Compiler v2.0

A high-performance CLI wrapper for Claude that adds session tracking, task management, and automatic context injection.

## Purpose

Claude Compiler enhances Claude CLI with three core capabilities:

1. **Session Tracking** - Monitors all AI interactions, prevents conflicts between concurrent sessions, and maintains audit trails
2. **Task Management** - SQLite-based task system with priorities, dependencies, and full history tracking
3. **Front-loading** - Automatically prepends context/instructions to every Claude command for consistency

Designed for coordinating multiple AI agents, managing complex workflows, and maintaining enterprise-grade audit trails.

## Starting the CLI

```bash
# Make executable (first time only)
chmod +x claude-compiler.sh

# Initialize databases (first time only)
./claude-compiler.sh init

# Start interactive mode
./claude-compiler.sh

# Or execute a single command
./claude-compiler.sh "Your prompt here"
```

## Available Commands

### Session Management
- `init` - Initialize databases
- `start <project> [type]` - Start new session (type: cli/agent/api)
- `end` - End current session
- `status` - Show current session status
- `list [status]` - List all sessions

### Task Management
- `todo create <task> [priority] [category]` - Create new task (priority: 1-4)
- `todo list [status]` - List tasks
- `todo update <id> <status>` - Update task status
- `todo complete <id>` - Mark task completed
- `todo start <id>` - Start working on task
- `todo block <id> <reason>` - Block task with reason
- `todo view <id>` - Show task details
- `todo stats` - Show statistics
- `todo search <term>` - Search tasks

### Prompt Management
- `edit` or `e` - Edit front-loaded prompt
- `show` or `s` - Show current front-loaded prompt
- `preview <prompt>` - Preview combined prompt
- `json <prompt>` - Run Claude with JSON output

### Database Operations
- `db stats` - Show database statistics
- `db check` - Check database health
- `db cleanup [minutes]` - Clean dormant sessions

### General
- `help` or `h` - Show all commands
- `quit` or `q` - Exit CLI
- `<any text>` - Send prompt to Claude with automatic tracking

## Requirements

- Bash 3.2+ (macOS) or Bash 4.0+ (Linux)
- Claude CLI: `npm install -g @anthropic-ai/claude-code`
- SQLite3 (usually pre-installed)