#!/bin/bash

# Global environment setup for agent containers

# Export environment variables
export HOME="/shared/agents/${AGENT_ID}"
export GEMINI_CONFIG_DIR="/shared/agents/${AGENT_ID}/.gemini"

# Load Gemini configuration if it exists
if [ -f "$GEMINI_CONFIG_DIR/.env" ]; then
    export $(grep -v '^#' "$GEMINI_CONFIG_DIR/.env" | xargs) 2>/dev/null
fi

# Ensure PATH includes our custom scripts
export PATH="/usr/local/bin:$PATH"

# Create aliases
alias gp="gemini -p"
alias gi="gc"

# Set custom prompt
PS1="\[\033[1;34m\]${AGENT_ID}\[\033[0m\]:\w\$ "