# Claude Code Integration Guide

## 🔗 Integrating Claude Compiler with Claude Code

This document explains how to integrate the Claude Compiler system into any Claude Code project to ensure deterministic instruction execution.

## 📋 MANDATORY Integration Requirements

### 1. Update CLAUDE.md

Add this section to your project's `.claude/CLAUDE.md`:

```markdown
## CRITICAL: Instruction Verification Compiler

### MANDATORY USAGE
For ANY complex multi-step instruction, ALL agents MUST use the Claude Compiler system:

**Location**: `../claude-compiler/` (relative to project root)
**Trigger Words**: "ensure", "follow correct", "align all", multi-step processes

### When to Use
- ✅ Multi-step deployments
- ✅ Database migrations  
- ✅ File processing pipelines
- ✅ Agent coordination tasks
- ✅ Any instruction with dependencies
- ✅ Operations requiring rollback
- ✅ Tasks needing audit trail

### Usage Pattern
```bash
# 1. Create instruction file
echo '{
  "id": "task-name",
  "description": "What this does", 
  "steps": [...],
  "constraints": [...]
}' > task.json

# 2. Execute with verification
node ../claude-compiler/scripts/instruction-compiler.js task.json

# 3. Monitor if needed
node ../claude-compiler/scripts/monitor-dashboard.js
```

### Agent Integration
```javascript
const { InstructionStateMachine } = require('../claude-compiler/scripts/instruction-compiler');

// Replace TodoWrite with verified execution
const machine = new InstructionStateMachine(instructionDefinition);
const result = await machine.execute();
```
```

### 2. Agent Modification Pattern

For each agent that handles complex tasks:

```javascript
// OLD WAY (unreliable)
async function complexTask(steps) {
  for (const step of steps) {
    await executeStep(step); // No verification, can fail silently
  }
}

// NEW WAY (verified)
async function complexTask(steps) {
  const instruction = {
    id: `task-${Date.now()}`,
    description: "Complex multi-step task",
    steps: steps.map(step => ({
      id: step.id,
      description: step.description,
      action: step.action,
      verification: step.verification,
      dependencies: step.dependencies || []
    })),
    constraints: [
      { type: "no_errors", description: "Any error aborts execution" }
    ]
  };

  const { InstructionStateMachine } = require('../claude-compiler/scripts/instruction-compiler');
  const machine = new InstructionStateMachine(instruction);
  
  try {
    const result = await machine.execute();
    return { success: true, auditTrail: result.auditLog };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

### 3. Project Structure

```
your-claude-code-project/
├── .claude/
│   └── CLAUDE.md                    # Updated with compiler requirements
├── src/
├── tests/
└── ../claude-compiler/             # Compiler system (sibling directory)
    ├── scripts/
    ├── tests/  
    ├── db/
    └── examples/
```

## 🚨 Mandatory Triggers

These phrases in user instructions REQUIRE using the Claude Compiler:

### Exact Phrases
- "ensure certain command like..."
- "follow correct agent selection and agent chaining procedures"
- "align all tasks so that the database is the source of truth"
- Any instruction with "ENSURE", "GUARANTEE", "MUST"

### Pattern Triggers
- Multiple sequential steps with dependencies
- Instructions mentioning "if X then Y, otherwise Z"
- Tasks requiring rollback on failure
- Operations that modify multiple files
- Agent coordination workflows
- Quality gates (test → build → deploy)

## 📝 Example Integration

### Before (Unreliable)
```javascript
// agent code
async function deployFeature() {
  await runTests();        // Could fail silently
  await runLint();         // No verification
  await buildProject();    // No rollback if fails
  await deployToProduction(); // DANGEROUS!
}
```

### After (Verified)
```javascript
async function deployFeature() {
  const instruction = {
    id: 'safe-deploy',
    description: 'Deploy feature with full verification',
    steps: [
      {
        id: 'tests',
        action: { type: 'command', command: 'npm test' },
        verification: { type: 'contains', text: 'passing' }
      },
      {
        id: 'lint', 
        action: { type: 'command', command: 'npm run lint' },
        verification: { type: 'contains', text: '0 problems' },
        dependencies: ['tests']
      },
      {
        id: 'build',
        action: { type: 'command', command: 'npm run build' },
        verification: { type: 'file_exists', path: 'dist/' },
        dependencies: ['lint']
      },
      {
        id: 'deploy',
        action: { type: 'command', command: 'npm run deploy' },
        verification: { type: 'contains', text: 'deployed' },
        dependencies: ['build']
      }
    ],
    constraints: [
      { type: 'no_errors', description: 'Any failure aborts deployment' }
    ]
  };

  const machine = new InstructionStateMachine(instruction);
  return await machine.execute();
}
```

## 🔍 Verification Checklist

Before deploying ANY Claude Code project:

- [ ] `.claude/CLAUDE.md` updated with compiler requirements
- [ ] All agents modified to use compiler for complex tasks  
- [ ] Trigger phrases documented and handled
- [ ] Test suite includes compiler verification
- [ ] Monitoring setup for audit trail
- [ ] Rollback procedures documented

## 📊 Agent Fitness Matrix

| Agent Type | Complexity | Compiler Required | Pattern |
|------------|------------|-------------------|---------|
| workflow-orchestrator | High | ✅ ALWAYS | Multi-agent coordination |
| quality-assurance-guardian | High | ✅ ALWAYS | Test execution, verification |
| technical-architect-lead | Medium | ✅ Often | Architecture changes |
| project-manager-analyst | Medium | ✅ Often | Task breakdown, planning |
| devops-deployment-engineer | High | ✅ ALWAYS | Deployment pipelines |
| data-pipeline-architect | High | ✅ ALWAYS | ETL/ELT processes |
| general-purpose | Low | ❌ Rarely | Simple searches, reads |

## 🚀 Quick Migration Guide

### Step 1: Setup
```bash
cd your-project
git clone https://github.com/claude-compiler.git ../claude-compiler
cd ../claude-compiler
npm install
npm run init
npm test  # Verify it works
```

### Step 2: Update CLAUDE.md
```markdown
## CRITICAL: Instruction Verification Compiler
[Add the section from above]
```

### Step 3: Test Integration
```bash
cd ../claude-compiler
echo '{
  "id": "integration-test",
  "description": "Test Claude Compiler integration", 
  "steps": [
    {
      "id": "verify-project",
      "action": {"type": "file_read", "path": "../your-project/package.json"},
      "verification": {"type": "file_exists", "path": "../your-project/package.json"}
    }
  ],
  "constraints": [{"type": "file_exists", "path": "../your-project/package.json"}]
}' > integration-test.json

node scripts/instruction-compiler.js integration-test.json
```

### Step 4: Monitor
```bash
# In terminal 1
node scripts/monitor-dashboard.js

# In terminal 2 - test some instructions
node scripts/instruction-cli.js
```

## ⚠️ Common Integration Mistakes

### ❌ Don't Do This
```javascript
// Using TodoWrite for complex multi-step tasks
TodoWrite([
  { content: "Run tests", status: "pending" },
  { content: "Deploy if passing", status: "pending" }
]);
// No verification, no rollback, no audit trail
```

### ✅ Do This Instead
```javascript
// Use instruction compiler for verified execution
const instruction = {
  id: "verified-deploy",
  steps: [
    { id: "test", action: {...}, verification: {...} },
    { id: "deploy", action: {...}, dependencies: ["test"] }
  ],
  constraints: [{ type: "no_errors" }]
};
await new InstructionStateMachine(instruction).execute();
```

## 🔧 Troubleshooting Integration

### "Module not found" Error
```bash
# Fix: Ensure correct relative path
const { InstructionStateMachine } = require('../claude-compiler/scripts/instruction-compiler');
```

### "Database not found" Error  
```bash
cd claude-compiler
npm run init  # Initialize database
```

### "No audit entries" 
```bash
# Check database location
sqlite3 claude-compiler/db/tasks.db "SELECT COUNT(*) FROM instruction_audit_log;"
```

## 📈 Success Metrics

After integration, you should see:
- ✅ 0% silent failures on complex tasks
- ✅ 100% audit trail coverage for critical operations  
- ✅ Rollback capability for all deployment pipelines
- ✅ Cryptographic verification of all state changes
- ✅ Real-time monitoring of agent activities

## 🎯 Next Steps

1. **Immediate**: Update your `.claude/CLAUDE.md`
2. **Week 1**: Integrate compiler into critical agents
3. **Week 2**: Add monitoring dashboard to deployment process
4. **Month 1**: Full audit trail for all complex operations

The Claude Compiler system transforms unreliable instruction execution into deterministic, verifiable, and recoverable operations.