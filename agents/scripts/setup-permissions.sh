#!/bin/bash

# Agent Filesystem Permission Setup Script
# This script sets up the filesystem permissions for AI Flock agents
# Called during Docker container initialization

set -e

# Create necessary directories
mkdir -p /tmp
mkdir -p /run
mkdir -p /home/agent/workspace
mkdir -p /home/workspace/repo
mkdir -p /shared/agents

# Set ownership of directories
chown -R agent:agent /app
chown -R agent:agent /tmp
chown -R agent:agent /run
chown -R agent:agent /entrypoint.sh
chown -R root:agent /home/agent
chown -R agent:agent /home/workspace
chown -R root:agent /shared

# Set specific file permissions
chmod +x /etc/profile.d/agent-env.sh
chmod 644 /home/CLAUDE.md
chmod +x /entrypoint.sh

# Set directory permissions - agent can only READ home and shared folders
chmod 755 /home/agent          # agent can read/execute but not write
chmod 755 /home/agent/workspace
chmod 755 /home/workspace/repo
chmod 755 /shared              # agent can read/execute but not write
chmod 755 /shared/agents

# Set workspace as writable (only place agent can write)
chmod 775 /home/agent/workspace
chmod 775 /home/workspace/repo

# Remove write permissions from home and shared for agent user
chmod 755 /home/agent          # read/execute only for agent
chmod 755 /shared              # read/execute only for agent

echo "Agent filesystem permissions configured successfully"
