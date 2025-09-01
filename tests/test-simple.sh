#!/bin/bash

echo "Starting test..."

# Check argument handling
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    echo "Script is being run directly"
    
    if [[ ! -t 0 ]]; then
        echo "Input is piped"
    elif (($# > 0)); then
        echo "Arguments provided: $*"
        case "${1,,}" in
            help)
                echo "This is help"
                ;;
            init)
                echo "This is init"
                ;;
            *)
                echo "Unknown command: $1"
                ;;
        esac
    else
        echo "No arguments - would start interactive"
    fi
fi

echo "Test complete"