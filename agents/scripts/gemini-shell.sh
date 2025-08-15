#!/bin/bash

# Gemini Shell Helper Script
# This script provides easy access to Gemini CLI in a proper TTY environment

# Set up environment
export HOME="/shared/agents/${AGENT_ID}"
export GEMINI_CONFIG_DIR="/shared/agents/${AGENT_ID}/.gemini"

# Load Gemini configuration if it exists
if [ -f "$GEMINI_CONFIG_DIR/.env" ]; then
    export $(grep -v '^#' "$GEMINI_CONFIG_DIR/.env" | xargs)
fi

# Function to start Gemini in a screen session
start_gemini_screen() {
    # Check if screen session already exists
    if screen -list | grep -q "gemini-${AGENT_ID}"; then
        echo "🔄 Attaching to existing Gemini session..."
        screen -r "gemini-${AGENT_ID}"
    else
        echo "🚀 Starting new Gemini session..."
        screen -S "gemini-${AGENT_ID}" bash -c "gemini"
    fi
}

# Function to run Gemini with a prompt
run_gemini_prompt() {
    gemini -p "$@"
}

# Main logic
if [ $# -eq 0 ]; then
    # No arguments - start interactive session
    start_gemini_screen
else
    # Arguments provided - run as prompt
    run_gemini_prompt "$@"
fi