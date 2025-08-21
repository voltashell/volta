#!/bin/bash

# start-with-repo.sh - Wrapper script to validate custom repo and start Docker Compose

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to expand tilde in path
expand_path() {
    local path="$1"
    if [[ "$path" == "~"* ]]; then
        path="${path/#\~/$HOME}"
    fi
    echo "$path"
}

# Header
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo -e "${BLUE}           AI Flock - Starting with Custom Repository${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo

# Check if .env file exists, create from example if not
if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        echo -e "${YELLOW}⚠${NC} No .env file found. Creating from .env.example..."
        cp .env.example .env
        echo -e "${GREEN}✓${NC} Created .env file. Please edit it to add your ANTHROPIC_API_KEY"
        echo
    fi
fi

# Source environment variables
if [ -f .env ]; then
    set -a
    source .env
    set +a
fi

# Check for Claude API key
if [ -z "$ANTHROPIC_API_KEY" ] || [ "$ANTHROPIC_API_KEY" = "your_ANTHROPIC_API_KEY_here" ]; then
    echo -e "${RED}✗${NC} Error: ANTHROPIC_API_KEY not set or using default value"
    echo "  Please edit .env file and set your Claude API key"
    exit 1
fi

# Validate custom repository path if set
if [ -n "$CUSTOM_REPO_PATH" ]; then
    # Expand tilde if present
    CUSTOM_REPO_PATH=$(expand_path "$CUSTOM_REPO_PATH")
    
    echo -e "${BLUE}Custom Repository Configuration:${NC}"
    echo "  Path: $CUSTOM_REPO_PATH"
    
    # Validate the path
    if [ ! -e "$CUSTOM_REPO_PATH" ]; then
        echo -e "${RED}✗${NC} Error: Repository path does not exist"
        echo "  Please create the directory or fix the path in .env"
        exit 1
    fi
    
    if [ ! -d "$CUSTOM_REPO_PATH" ]; then
        echo -e "${RED}✗${NC} Error: Path is not a directory"
        exit 1
    fi
    
    if [ ! -r "$CUSTOM_REPO_PATH" ]; then
        echo -e "${RED}✗${NC} Error: Directory is not readable"
        exit 1
    fi
    
    # Check write permissions (warning only)
    if [ ! -w "$CUSTOM_REPO_PATH" ]; then
        echo -e "${YELLOW}⚠${NC} Warning: Directory is not writable"
        echo "  Agents may not be able to modify files"
        read -p "Continue anyway? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
    
    # Export expanded path for Docker Compose
    export CUSTOM_REPO_PATH
    
    echo -e "${GREEN}✓${NC} Custom repository validated and will be mounted at /workspace/repo"
    echo
else
    echo -e "${BLUE}ℹ${NC} No custom repository configured (CUSTOM_REPO_PATH not set)"
    echo "  Agents will use default workspace only"
    echo
    
    # Create empty directory for Docker fallback
    if [ ! -d "/tmp/empty" ]; then
        mkdir -p /tmp/empty
    fi
fi

# Display configuration summary
echo -e "${BLUE}Configuration Summary:${NC}"
echo "  • Claude API Key: ${GREEN}✓${NC} Configured"
echo "  • Claude Model: ${CLAUDE_MODEL:-claude-3-5-sonnet-20241022}"
if [ -n "$CUSTOM_REPO_PATH" ]; then
    echo "  • Custom Repository: $CUSTOM_REPO_PATH"
    echo "    → Will be mounted at: /workspace/repo"
else
    echo "  • Custom Repository: Not configured"
fi
echo

# Check Docker daemon
echo -e "${BLUE}Checking Docker...${NC}"
if ! docker info >/dev/null 2>&1; then
    echo -e "${RED}✗${NC} Error: Docker daemon is not running"
    echo "  Please start Docker Desktop and try again"
    exit 1
fi
echo -e "${GREEN}✓${NC} Docker is running"
echo

# Start services
echo -e "${BLUE}Starting AI Flock services...${NC}"
echo "  • NATS Message Bus"
echo "  • 3 AI Agents with Claude AI"
echo "  • Monitor Dashboard (http://localhost:3000)"
echo

# Build and start with Docker Compose
docker-compose -f docker-compose.local.yml up --build "$@"