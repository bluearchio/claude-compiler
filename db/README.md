# Claude Compiler Database System

This directory contains the database schemas and services for managing tasks and sessions in Claude Compiler.

## Structure

```
db/
├── schemas/          # SQL schema definitions
│   ├── todo-schema.sql    # Task management schema
│   └── session-schema.sql # Session tracking schema
├── services/         # Database service modules
│   ├── todo-service.js    # Task operations
│   └── session-service.js # Session operations
├── todo.db          # SQLite database for tasks (created on first use)
└── session.db       # SQLite database for sessions (created on first use)
```

## TODO Database

Tracks all tasks with priorities, statuses, and assignments.

### Tables:
- `todos` - Main task table
- `task_dependencies` - Task dependency tracking
- `task_comments` - Comments and notes on tasks
- `task_history` - Audit trail of task changes

### Task Statuses:
- `open` - New task, not started
- `in_progress` - Currently being worked on
- `completed` - Successfully finished
- `blocked` - Cannot proceed due to dependency
- `cancelled` - No longer needed

### Task Priorities:
1. `CRITICAL` - Must be done immediately
2. `HIGH` - Important, do soon
3. `MEDIUM` - Normal priority (default)
4. `LOW` - Nice to have, do when possible

## SESSION Database

Tracks all Claude Code sessions and their activities.

### Tables:
- `sessions` - Main session registry
- `session_activities` - Detailed activity log
- `session_prompts` - All prompts and responses
- `session_tasks` - Links sessions to tasks
- `session_file_changes` - Files modified in session
- `session_conflicts` - Detected conflicts between sessions
- `session_messages` - Inter-session communication

### Session Types:
- `claude_code` - Claude Code SDK sessions
- `agent` - Agent-based sessions
- `cli` - Command-line sessions
- `api` - API-based sessions

### Session Statuses:
- `active` - Currently running
- `paused` - Temporarily suspended
- `completed` - Finished successfully
- `failed` - Ended with error
- `dormant` - Inactive for >15 minutes

## Usage

### From Node.js:

```javascript
const TodoService = require('./services/todo-service');
const SessionService = require('./services/session-service');

// Create services
const todoService = new TodoService();
const sessionService = new SessionService();

// Create a task
const task = await todoService.createTask('Implement feature X', {
    priority: 2,
    category: 'feature'
});

// Start a session
const session = await sessionService.registerSession(
    'claude_code',
    'my-project',
    '/path/to/project'
);

// Link task to session
await sessionService.linkTaskToSession(session.sessionId, task.id);
```

### From CLI:

```bash
# Task management
claude-todo create "Fix bug in login" -p 1 -c bug
claude-todo list --status open
claude-todo complete 5

# Session management
claude-session list --active
claude-session view abc123
claude-session cleanup
```

## Automatic Features

### Session Management:
- Sessions automatically marked dormant after 15 minutes of inactivity
- File conflicts detected when multiple sessions modify same files
- Automatic cleanup of old dormant sessions

### Task Management:
- Automatic timestamp updates on task changes
- History tracking for all status changes
- Automatic completion timestamp when marked complete

## Database Maintenance

### Cleanup dormant sessions:
```bash
claude-session cleanup --minutes 30
```

### View statistics:
```bash
claude-todo stats
claude-session stats
```

### Reset databases:
```bash
rm db/*.db
claude-compiler init
```

## Integration with External Projects

When using Claude Compiler in your project:

1. The databases will be created automatically on first use
2. Sessions track which project is using them
3. Tasks can be assigned to specific sessions
4. Conflicts are detected between concurrent sessions
5. All activity is logged for audit purposes