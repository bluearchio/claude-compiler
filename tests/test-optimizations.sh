#!/bin/bash

# Test script to verify optimizations without calling Claude
# This isolates the performance improvements we've made

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../claude-compiler.sh" 2>/dev/null

# Override the claude command to avoid actual execution
claude() {
    echo "MOCK: claude called with $# arguments"
    echo "First argument: $1"
    return 0
}

# Override check_claude_command to avoid the actual check
check_claude_command() {
    CLAUDE_COMMAND_CHECKED="1"
    echo "Mock: Claude command check passed"
}

echo "=== Testing Performance Optimizations ==="
echo

# Test 1: Cache variables are properly initialized
echo "1. Testing cache variable initialization:"
echo "   FRONT_LOADED_CACHE: '${FRONT_LOADED_CACHE}'"
echo "   FRONT_LOADED_MTIME: '${FRONT_LOADED_MTIME}'"
echo "   CLAUDE_COMMAND_CHECKED: '${CLAUDE_COMMAND_CHECKED}'"
echo

# Test 2: Front-loaded prompt loading (first time - should read file)
echo "2. Testing front-loaded prompt loading (first call):"
time result1=$(load_front_loaded_prompt)
echo "   Result length: ${#result1} characters"
echo "   Cache populated: FRONT_LOADED_CACHE length = ${#FRONT_LOADED_CACHE}"
echo

# Test 3: Front-loaded prompt loading (second time - should use cache)
echo "3. Testing front-loaded prompt loading (second call - cached):"
time result2=$(load_front_loaded_prompt)
echo "   Result length: ${#result2} characters"
echo "   Results match: $([[ "$result1" == "$result2" ]] && echo "YES" || echo "NO")"
echo

# Test 4: Combine prompts function
echo "4. Testing combine prompts function:"
time combined=$(combine_prompts "Test user prompt")
echo "   Combined prompt length: ${#combined} characters"
echo

# Test 5: Multiple calls to test caching efficiency
echo "5. Testing cache efficiency (10 rapid calls):"
time for i in {1..10}; do
    load_front_loaded_prompt >/dev/null
done
echo

# Test 6: Command checking with cache
echo "6. Testing command check caching:"
time check_claude_command
echo "   First check done"
time check_claude_command
echo "   Second check done (should be cached)"
echo

echo "=== Optimization Tests Complete ==="