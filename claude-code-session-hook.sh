#!/bin/bash

# CLAUDE CODE SESSION HOOK
# Add this to your Claude Code hooks configuration

echo "🔍 Checking for Claude Compiler system..."

if [ -d "claude-compiler" ] && [ -f "claude-compiler/claude-master.js" ]; then
    echo "🎯 CLAUDE COMPILER DETECTED!"
    echo "⚠️  ENFORCEMENT ACTIVE: Complex tasks MUST use Claude Compiler"
    echo "📋 Usage: node claude-compiler/claude-master.js \"your task\""
    echo "📖 READ: claude-compiler/CLAUDE.md for full requirements"
    export CLAUDE_COMPILER_ACTIVE=true
    export CLAUDE_COMPILER_PATH="$(pwd)/claude-compiler"
else
    echo "ℹ️  No Claude Compiler found - standard behavior"
fi