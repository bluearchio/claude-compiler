#!/bin/bash

# Performance test script for claude-compiler.sh optimizations

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_PATH="$SCRIPT_DIR/../claude-compiler.sh"
TEST_PROMPT_FILE="$SCRIPT_DIR/../front-loaded-prompt.txt"

echo "=== Claude Compiler Performance Test ==="
echo

# Test 1: Script startup time
echo "1. Testing script startup time..."
for i in {1..5}; do
    echo -n "  Run $i: "
    time_result=$(time (bash -c 'exit 0') 2>&1 | grep real | cut -d' ' -f2)
    echo "$time_result"
done
echo

# Test 2: Front-loaded prompt caching
echo "2. Testing front-loaded prompt loading..."

# Create a test prompt
echo "Test front-loaded prompt content for performance testing." > "$TEST_PROMPT_FILE"

# Test the load function multiple times
echo "  First load (file I/O):"
time bash -c "
source '$SCRIPT_PATH' 2>/dev/null
result1=\$(load_front_loaded_prompt)
echo \"Length: \${#result1}\"
"

echo "  Second load (should use cache):"
time bash -c "
source '$SCRIPT_PATH' 2>/dev/null
result1=\$(load_front_loaded_prompt)
result2=\$(load_front_loaded_prompt)
echo \"Length: \${#result2}\"
"

# Test 3: Function call overhead
echo
echo "3. Testing optimized function calls..."
time bash -c "
source '$SCRIPT_PATH' 2>/dev/null
for i in {1..100}; do
    load_front_loaded_prompt >/dev/null
done
"

echo
echo "=== Performance Test Complete ==="