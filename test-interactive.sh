#!/bin/bash

# Test interactive mode with automated input
echo "Testing Claude Compiler Interactive Mode"
echo "========================================="

# Create a test input file
cat > test-input.txt << 'EOF'
status
todo create "Test task 1" 1
todo create "Test task 2" 2
todo list
todo complete 1
show
db check
help
quit
EOF

echo "Running interactive mode with test commands..."
./claude-compiler.sh < test-input.txt

echo "Test completed!"