#!/bin/bash

# This script is sourced by /etc/profile.d/agent-env.sh inside agent containers.
# Keep it minimal and robust; avoid dependencies on other scripts.

# Terminal settings
export TERM=xterm-256color

# PATH enhancements (prepend common locations, preserve existing PATH)
export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"

# If a custom repository is mounted, expose a consistent path for convenience
if [ -n "$CUSTOM_REPO_PATH" ] && [ -d "/home/workspace/repo" ]; then
  export REPO_PATH="/home/workspace/repo"
fi

# Helpful aliases for interactive shells
alias ll='ls -alF'
alias la='ls -A'
alias l='ls -CF'

# Prompt showing the agent id when available
if [ -n "$AGENT_ID" ]; then
  export PS1='[\u@'"$AGENT_ID"' \W]\\$ '
fi


