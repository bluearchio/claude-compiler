# How to Use the Instruction Verification Compiler

## Quick Start

### 1. Create an Instruction File

Create a JSON file that describes what you want to do:

```json
{
  "id": "my-task-001",
  "description": "Run tests and deploy if passing",
  "steps": [
    {
      "id": "run-tests",
      "description": "Execute test suite",
      "action": {
        "type": "command",
        "command": "npm test"
      },
      "verification": {
        "type": "contains",
        "text": "passing"
      },
      "dependencies": []
    },
    {
      "id": "build",
      "description": "Build the project",
      "action": {
        "type": "command",
        "command": "npm run build"
      },
      "verification": {
        "type": "file_exists",
        "path": "dist/index.js"
      },
      "dependencies": ["run-tests"]
    }
  ],
  "constraints": [
    {
      "type": "file_exists",
      "path": "package.json",
      "description": "Project must have package.json"
    },
    {
      "type": "no_errors",
      "description": "No errors allowed during execution"
    }
  ],
  "resources": {
    "files": ["package.json", "src/", "dist/"]
  },
  "verification": {
    "type": "test_passes"
  }
}
```

### 2. Execute the Instruction

```bash
node scripts/instruction-compiler.js my-instruction.json
```

### 3. What Happens

The system will:
1. **Validate** your instruction format
2. **Check** all constraints before starting
3. **Execute** each step in order
4. **Verify** each step completed correctly
5. **Abort** immediately if anything fails
6. **Save** complete audit trail to database

## How to Know It's Working

### Live Indicators During Execution

```
✅ State transition: INIT -> VALIDATE        # States can't be skipped
✅ State transition: VALIDATE -> PLAN         # Each transition is verified
✅ State transition: PLAN -> VERIFY_PLAN      # Hash chain being built
✅ State transition: VERIFY_PLAN -> EXECUTE   # All pre-conditions met
  ⏳ Executing: Run tests                     # Currently running
    ✅ Completed: run-tests                   # Step verified
  ⏳ Executing: Build the project            # Next step
    ❌ Failed: build - Error message         # Immediate abort
🛑 EXECUTION ABORTED: Error details          # System stopped
📋 Audit trail saved with 5 entries         # Evidence preserved
```

### Check the Audit Trail

```bash
# See all executions
sqlite3 db/tasks.db "SELECT * FROM instruction_executions;"

# See specific execution details
sqlite3 db/tasks.db "SELECT * FROM instruction_audit_log WHERE execution_id='my-task-001';"

# Check for violations
sqlite3 db/tasks.db "SELECT * FROM instruction_violations;"
```

### Monitor in Real-Time

```bash
# Watch the audit log live
watch -n 1 'sqlite3 db/tasks.db "SELECT event_type, event_timestamp FROM instruction_audit_log ORDER BY event_timestamp DESC LIMIT 10;"'

# Check current state
sqlite3 db/tasks.db "SELECT execution_id, status, final_state FROM instruction_executions WHERE status='running';"
```

## Common Use Cases

### 1. Safe Deployment Pipeline

```json
{
  "id": "safe-deploy",
  "description": "Deploy only if all checks pass",
  "steps": [
    {
      "id": "lint",
      "action": {"type": "command", "command": "npm run lint"},
      "verification": {"type": "contains", "text": "0 errors"}
    },
    {
      "id": "test",
      "action": {"type": "command", "command": "npm test"},
      "verification": {"type": "contains", "text": "passing"},
      "dependencies": ["lint"]
    },
    {
      "id": "build",
      "action": {"type": "command", "command": "npm run build"},
      "verification": {"type": "file_exists", "path": "dist/"},
      "dependencies": ["test"]
    },
    {
      "id": "deploy",
      "action": {"type": "command", "command": "npm run deploy"},
      "verification": {"type": "contains", "text": "deployed"},
      "dependencies": ["build"]
    }
  ],
  "constraints": [
    {"type": "no_errors", "description": "Any error stops deployment"}
  ]
}
```

### 2. Database Migration with Rollback

```json
{
  "id": "db-migration",
  "description": "Migrate database with automatic rollback on failure",
  "steps": [
    {
      "id": "backup",
      "action": {"type": "command", "command": "pg_dump mydb > backup.sql"},
      "verification": {"type": "file_exists", "path": "backup.sql"}
    },
    {
      "id": "migrate",
      "action": {"type": "command", "command": "psql mydb < migration.sql"},
      "verification": {"type": "contains", "text": "SUCCESS"},
      "rollback": {"type": "command", "command": "psql mydb < backup.sql"},
      "dependencies": ["backup"]
    },
    {
      "id": "verify",
      "action": {"type": "command", "command": "npm run db:verify"},
      "verification": {"type": "contains", "text": "schema valid"},
      "dependencies": ["migrate"]
    }
  ]
}
```

### 3. File Processing with Verification

```json
{
  "id": "process-files",
  "description": "Process files with integrity checks",
  "steps": [
    {
      "id": "validate-input",
      "action": {"type": "file_read", "path": "input.json"},
      "verification": {"type": "file_exists", "path": "input.json"}
    },
    {
      "id": "transform",
      "action": {"type": "command", "command": "node transform.js input.json output.json"},
      "verification": {"type": "file_exists", "path": "output.json"},
      "dependencies": ["validate-input"]
    },
    {
      "id": "verify-output",
      "action": {"type": "command", "command": "node verify.js output.json"},
      "verification": {"type": "contains", "text": "valid"},
      "dependencies": ["transform"]
    }
  ]
}
```

## Verification Methods

### Method 1: Check Exit Code
```bash
node scripts/instruction-compiler.js my-instruction.json
echo $?  # 0 = success, 1 = failed
```

### Method 2: Query Database
```bash
# Get last execution status
sqlite3 db/tasks.db "SELECT status, success FROM instruction_executions ORDER BY started_at DESC LIMIT 1;"
```

### Method 3: Check Hash Chain
```bash
# Verify cryptographic integrity
sqlite3 db/tasks.db "SELECT hash_chain_root FROM instruction_executions WHERE execution_id='my-task-001';"
```

### Method 4: Review Violations
```bash
# See what went wrong
sqlite3 db/tasks.db "SELECT * FROM instruction_violations WHERE execution_id='my-task-001';"
```

## Proof It's Working

### 1. Try to Break It
```bash
# Create instruction that will fail
echo '{
  "id": "will-fail",
  "steps": [{
    "id": "bad-step",
    "action": {"type": "command", "command": "exit 1"},
    "verification": {"type": "contains", "text": "success"}
  }],
  "constraints": [{"type": "no_errors"}]
}' > fail-test.json

node scripts/instruction-compiler.js fail-test.json
# Watch it abort immediately
```

### 2. Verify Immutability
```bash
# Try to modify audit log (will fail)
sqlite3 db/tasks.db "UPDATE instruction_audit_log SET event_type='HACKED';"
# Error: Audit log entries are immutable
```

### 3. Check Hash Chain
```bash
# Run verification engine test
node scripts/verification-engine.js
# See hash chain validation and tamper detection
```

## Error Messages and What They Mean

| Error | Meaning | System Response |
|-------|---------|-----------------|
| "Illegal state transition" | Tried to skip required steps | Immediate abort |
| "Pre-conditions not met" | Requirements not satisfied | Won't proceed |
| "Step verification failed" | Output didn't match expected | Rollback & abort |
| "Constraint violated" | Rule broken during execution | Stop everything |
| "Invalid hash" | Tampering detected | Reject operation |

## Advanced Usage

### Custom Verification Functions
```javascript
// In your instruction:
"verification": {
  "type": "custom",
  "function": "checkCustomCondition",
  "expected": true
}
```

### Parallel Execution
```json
"steps": [
  {"id": "test1", "parallel": true},
  {"id": "test2", "parallel": true},
  {"id": "test3", "parallel": true},
  {"id": "collect", "dependencies": ["test1", "test2", "test3"]}
]
```

### Conditional Steps
```json
"steps": [{
  "id": "conditional-step",
  "condition": {"type": "file_exists", "path": "optional.txt"},
  "action": {"type": "command", "command": "process optional.txt"},
  "skipOnConditionFail": true
}]
```

## Troubleshooting

### "Execution aborted" - How to Debug
1. Check audit log for last successful step
2. Review error message for specific failure
3. Verify all file paths and commands are correct
4. Ensure dependencies are properly ordered

### "Hash chain invalid" - What to Do
1. Don't modify the audit database manually
2. Check for system clock issues
3. Ensure no concurrent modifications

### "Rollback failed" - Recovery Steps
1. Check rollback snapshots exist
2. Verify file permissions
3. Manual recovery from `.rollback/` directory

## Command Reference

```bash
# Execute instruction
node scripts/instruction-compiler.js <instruction.json>

# Verify system is working
node tests/instruction-compiler/verify-system.js

# Check audit trail
sqlite3 db/tasks.db "SELECT * FROM instruction_audit_log;"

# Monitor executions
watch -n 1 'sqlite3 db/tasks.db "SELECT * FROM instruction_execution_summary;"'

# Clean old snapshots
node scripts/rollback-manager.js cleanup 3600000
```