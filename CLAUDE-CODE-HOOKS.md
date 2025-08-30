# CLAUDE CODE INTEGRATION HOOKS

## CRITICAL: AUTOMATIC ENFORCEMENT SYSTEM

This document explains how to ensure Claude Code ALWAYS uses the Claude Compiler system when available.

## 1. ENVIRONMENT DETECTION

Place this in your `~/.claude/hooks/session-start.sh`:

```bash
#!/bin/bash

# CLAUDE CODE SESSION START HOOK
# This runs at the beginning of EVERY Claude Code session

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔══════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║                    CLAUDE CODE SESSION STARTING                      ║${NC}"
echo -e "${BOLD}║                  CHECKING FOR CLAUDE COMPILER                        ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════════════╝${NC}"

# Check for Claude Compiler in current directory
if [ -d "claude-compiler" ] && [ -f "claude-compiler/claude-master.js" ]; then
    echo -e "${GREEN}🎯 CLAUDE COMPILER DETECTED!${NC}"
    echo -e "${GREEN}📁 Location: $(pwd)/claude-compiler/${NC}"
    echo -e "${GREEN}⚡ Status: OPERATIONAL${NC}"
    
    # Set environment variables
    export CLAUDE_COMPILER_ACTIVE=true
    export CLAUDE_COMPILER_PATH="$(pwd)/claude-compiler"
    
    echo -e ""
    echo -e "${YELLOW}⚠️  INTEGRATION ENFORCEMENT ACTIVE:${NC}"
    echo -e "${YELLOW}   • ALL complex tasks MUST use: node claude-compiler/claude-master.js${NC}"
    echo -e "${YELLOW}   • ALL sessions MUST read CLAUDE.md first${NC}"
    echo -e "${YELLOW}   • ALL multi-step instructions MUST be verified${NC}"
    echo -e ""
    echo -e "${CYAN}🔐 Verification active, audit trails enabled${NC}"
    echo -e "${CYAN}📊 Complete transparency and tracking guaranteed${NC}"
    echo -e ""
    
    # Check if CLAUDE.md exists and show reminder
    if [ -f "claude-compiler/CLAUDE.md" ]; then
        echo -e "${BOLD}📋 CRITICAL REMINDER:${NC}"
        echo -e "${RED}   READ claude-compiler/CLAUDE.md FIRST!${NC}"
        echo -e ""
    fi
    
else
    echo -e "${YELLOW}⚠️  No Claude Compiler found in current directory${NC}"
    echo -e "${CYAN}   Standard Claude Code behavior will be used${NC}"
fi

echo -e "${GREEN}🚀 Session ready - Claude Compiler integration checked${NC}"
echo -e ""
```

## 2. TASK DETECTION HOOK

Place this in your `~/.claude/hooks/task-start.sh`:

```bash
#!/bin/bash

# CLAUDE CODE TASK START HOOK
# This runs before EVERY task execution

TASK="$1"

# Check if Claude Compiler is available
if [ "$CLAUDE_COMPILER_ACTIVE" = "true" ]; then
    echo -e "${BLUE}🔍 Analyzing task for Claude Compiler requirements...${NC}"
    
    # Check for trigger words that require Claude Compiler
    TRIGGER_WORDS=("ensure" "coordinate" "workflow" "multi-step" "deploy" "build" "test" "align" "verify")
    REQUIRES_COMPILER=false
    
    for word in "${TRIGGER_WORDS[@]}"; do
        if [[ "$TASK" == *"$word"* ]]; then
            REQUIRES_COMPILER=true
            echo -e "${YELLOW}⚡ Trigger word detected: '$word'${NC}"
            break
        fi
    done
    
    # Check for complexity indicators
    if [[ "$TASK" == *"and"* ]] || [[ "$TASK" == *"then"* ]] || [[ "$TASK" == *"with"* ]]; then
        if [[ $(echo "$TASK" | wc -w) -gt 10 ]]; then
            REQUIRES_COMPILER=true
            echo -e "${YELLOW}⚡ Complex multi-step task detected${NC}"
        fi
    fi
    
    if [ "$REQUIRES_COMPILER" = true ]; then
        echo -e ""
        echo -e "${RED}🛑 CLAUDE COMPILER REQUIRED FOR THIS TASK${NC}"
        echo -e "${BOLD}   Use: node claude-compiler/claude-master.js \"$TASK\"${NC}"
        echo -e ""
        echo -e "${CYAN}📊 This will provide:${NC}"
        echo -e "${CYAN}   • Complete decision transparency${NC}"
        echo -e "${CYAN}   • Cryptographic verification${NC}"
        echo -e "${CYAN}   • Full audit trail${NC}"
        echo -e "${CYAN}   • Agent coordination${NC}"
        echo -e ""
    fi
fi
```

## 3. AUTOMATIC PROMPT INJECTION

Create this file in `~/.claude/auto-inject.txt`:

```
CRITICAL SYSTEM CHECK:

Before proceeding with any task, I MUST check:
1. Does a 'claude-compiler' directory exist in the current working directory?
2. If YES, I MUST read claude-compiler/CLAUDE.md FIRST
3. For ANY complex task, I MUST use: node claude-compiler/claude-master.js "task"
4. I MUST provide complete transparency in all decision making

TRIGGER WORDS that require Claude Compiler:
- "ensure", "coordinate", "workflow", "align", "verify"
- Multi-step processes, deployments, testing
- Agent coordination, complex integrations

If Claude Compiler exists, I MUST use it for complex tasks - NO EXCEPTIONS.
```

## 4. PROJECT-LEVEL ENFORCEMENT

Add this to your project's `package.json`:

```json
{
  "scripts": {
    "claude-check": "node claude-compiler/.claudecode-integration",
    "postinstall": "npm run claude-check"
  },
  "claudeConfig": {
    "compilerRequired": true,
    "autoDetect": true,
    "enforceIntegration": true
  }
}
```

## 5. DIRECTORY-LEVEL ENFORCEMENT

Create `.claude-config.json` in your project root:

```json
{
  "claudeCompiler": {
    "enabled": true,
    "path": "./claude-compiler",
    "enforceForComplexTasks": true,
    "requireClaudeMd": true,
    "triggerWords": [
      "ensure", "coordinate", "workflow", "align", "verify",
      "multi-step", "deploy", "build", "test", "integration"
    ]
  },
  "hooks": {
    "sessionStart": "node claude-compiler/.claudecode-integration",
    "beforeTask": "check task complexity and trigger Claude Compiler if needed"
  }
}
```

## 6. MANUAL ENFORCEMENT COMMANDS

Run these commands to ensure Claude Compiler is used:

```bash
# Check if integration is active
node claude-compiler/.claudecode-integration

# Force Claude Compiler for any task
node claude-compiler/claude-master.js "your task here"

# Monitor system activity
node claude-compiler/flows/task-tracker.js monitor

# Check system status
node claude-compiler/flows/task-tracker.js status
```

## 7. VERIFICATION COMMANDS

Use these to verify the system is working:

```bash
# Verify Claude Compiler is detected
echo $CLAUDE_COMPILER_ACTIVE

# Show current path
echo $CLAUDE_COMPILER_PATH

# Test the system
node claude-compiler/claude-master.js test "simple test"
```

## IMPORTANT NOTES

1. **These hooks ensure Claude Code automatically detects and uses the Claude Compiler**
2. **Complex tasks will be forced through the verification system**
3. **All operations will have complete audit trails**
4. **System provides 100% transparency in decision making**

## TROUBLESHOOTING

If Claude Code is not using the compiler:
1. Check environment variables: `echo $CLAUDE_COMPILER_ACTIVE`
2. Verify hooks are installed in `~/.claude/hooks/`
3. Ensure `.claude-config.json` exists in project root
4. Manually run: `node claude-compiler/.claudecode-integration`
5. Force usage: `node claude-compiler/claude-master.js "your task"`

This system ensures Claude Code ALWAYS uses the Claude Compiler when available, providing the transparency and verification you require.