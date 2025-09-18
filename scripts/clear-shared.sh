#!/bin/bash

# Clear shared folder script for Volta Shell
# This script removes temporary files and logs while preserving essential structure

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SHARED_DIR="$(dirname "$SCRIPT_DIR")/shared"

echo "🧹 Clearing shared folder: $SHARED_DIR"

# Remove temporary files and logs
echo "Removing temporary files..."
find "$SHARED_DIR" -name "*.swp" -delete 2>/dev/null || true
find "$SHARED_DIR" -name "*.tmp" -delete 2>/dev/null || true
find "$SHARED_DIR" -name "*.log" -delete 2>/dev/null || true

# Remove task result files
echo "Removing task result files..."
find "$SHARED_DIR" -name "task-*.json" -delete 2>/dev/null || true

# Remove generated content files (but preserve .gitkeep)
echo "Removing generated content files..."
find "$SHARED_DIR" -type f -name "*.txt" ! -name ".gitkeep" -delete 2>/dev/null || true
find "$SHARED_DIR" -type f -name "message" -delete 2>/dev/null || true

# Clear agent-specific directories but preserve .env files
echo "Clearing agent directories..."
for agent_dir in "$SHARED_DIR"/agents/agent-*; do
    if [ -d "$agent_dir" ]; then
        echo "  Clearing $(basename "$agent_dir") (preserving .env files)..."
        
        # Find and remove everything except .env files
        find "$agent_dir" -type f ! -name "*.env" -delete 2>/dev/null || true
        
        # Remove empty directories (but not the agent directory itself)
        find "$agent_dir" -type d -empty -not -path "$agent_dir" -delete 2>/dev/null || true
    fi
done

# Clear logs directory
echo "Clearing logs directory..."
if [ -d "$SHARED_DIR/logs" ]; then
    rm -f "$SHARED_DIR/logs"/*.log 2>/dev/null || true
fi

# Preserve essential structure
echo "Ensuring essential directories exist..."
mkdir -p "$SHARED_DIR/agents"
mkdir -p "$SHARED_DIR/common"
mkdir -p "$SHARED_DIR/logs"

echo "✅ Shared folder cleared successfully!"
echo "📁 Preserved structure:"
echo "   - agents/ (agent-specific directories)"
echo "   - common/ (shared resources)"
echo "   - logs/ (system logs)"
