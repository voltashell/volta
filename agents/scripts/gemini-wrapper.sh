#!/bin/bash

# Gemini Wrapper Script - Handles both interactive and prompt modes

# Set up environment
export HOME="/shared/agents/${AGENT_ID}"
export GEMINI_CONFIG_DIR="/shared/agents/${AGENT_ID}/.gemini"

# Load API key from .env if it exists
if [ -f "$GEMINI_CONFIG_DIR/.env" ]; then
    export $(grep -v '^#' "$GEMINI_CONFIG_DIR/.env" | xargs)
fi

# Check if we have arguments (prompt mode) or not (interactive mode)
if [ $# -eq 0 ]; then
    # No arguments - try to start interactive mode
    echo "Starting Gemini interactive session..."
    echo "Note: Type your messages and press Enter. Use Ctrl+C to exit."
    
    # Use script command to allocate a PTY for gemini (no 'chat' argument needed)
    script -q -c "gemini" /dev/null
else
    # Arguments provided - use prompt mode
    gemini -p "$@"
fi