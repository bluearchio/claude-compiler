#!/bin/bash

# Simple debug script to test the execution flow
echo "Starting debug test..."

first_arg=$(echo "$1" | tr '[:upper:]' '[:lower:]')
echo "First arg converted: '$first_arg'"

case "$first_arg" in
    help|h|-h|--help)
        echo "Matched help - calling show_help"
        echo "Help would be shown here"
        exit 0
        ;;
    *)
        echo "No match for '$first_arg'"
        echo "Would proceed to other logic"
        ;;
esac

echo "Debug test complete"