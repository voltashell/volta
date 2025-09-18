#!/bin/bash

# Agent Filesystem Permission Setup Script
# This script sets up the filesystem permissions for Volta Shell agents
# Called during Docker container initialization

set -e

# Create necessary directories
mkdir -p /tmp
mkdir -p /run
mkdir -p /shared/agents
mkdir -p /shared/workspace

# Set ownership of directories - SECURITY: Agent should NOT own system directories
# /app contains application code and should remain root-owned
# /run is a system directory that should remain root-owned
# Agent gets read-write access to /home, /shared, and /tmp
chown -R agent:agent /entrypoint.sh
chown -R agent:agent /home
chown -R agent:agent /shared

# Set specific file permissions
chmod +x /etc/profile.d/agent-env.sh
chmod 644 /home/GEMINI.md
chmod +x /entrypoint.sh

# SECURITY: Restrict agent access to system directories
# /app should not be readable or writable by agent
chmod 700 /app
# /run should have restricted access - agent cannot read/write
chmod 700 /run
# /tmp should be accessible by agent for temporary file operations
chmod 755 /tmp

# Set directory permissions - agent has read-write access to /home and /shared
chmod 775 /home                # agent can read/write/execute
chmod 775 /shared              # agent can read/write/execute
chmod 775 /shared/agents

echo "Agent filesystem permissions configured successfully"
