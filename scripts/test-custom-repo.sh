#!/bin/bash

# test-custom-repo.sh - Test script for custom repository feature

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo -e "${BLUE}        Custom Repository Feature Test${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo

# Test 1: Validate script exists and is executable
echo -e "${BLUE}Test 1: Checking validation script...${NC}"
if [ -x "./scripts/validate-repo-path.sh" ]; then
    echo -e "${GREEN}✓${NC} Validation script is executable"
else
    echo -e "${RED}✗${NC} Validation script not found or not executable"
    exit 1
fi

# Test 2: Test with empty path (should pass - optional feature)
echo -e "\n${BLUE}Test 2: Testing with empty CUSTOM_REPO_PATH...${NC}"
unset CUSTOM_REPO_PATH
if ./scripts/validate-repo-path.sh; then
    echo -e "${GREEN}✓${NC} Empty path validation passed (optional feature)"
else
    echo -e "${RED}✗${NC} Empty path validation failed"
    exit 1
fi

# Test 3: Test with invalid path
echo -e "\n${BLUE}Test 3: Testing with invalid path...${NC}"
export CUSTOM_REPO_PATH="/nonexistent/path/to/repo"
if ./scripts/validate-repo-path.sh 2>/dev/null; then
    echo -e "${RED}✗${NC} Invalid path should have failed validation"
    exit 1
else
    echo -e "${GREEN}✓${NC} Invalid path correctly rejected"
fi

# Test 4: Test with valid directory (current directory)
echo -e "\n${BLUE}Test 4: Testing with valid directory (current)...${NC}"
export CUSTOM_REPO_PATH="$(pwd)"
if ./scripts/validate-repo-path.sh; then
    echo -e "${GREEN}✓${NC} Valid path validation passed"
    echo "  Path: $CUSTOM_REPO_PATH"
else
    echo -e "${RED}✗${NC} Valid path validation failed"
    exit 1
fi

# Test 5: Test tilde expansion
echo -e "\n${BLUE}Test 5: Testing tilde expansion...${NC}"
export CUSTOM_REPO_PATH="~"
if ./scripts/validate-repo-path.sh; then
    echo -e "${GREEN}✓${NC} Tilde expansion works"
    echo "  Expanded to: $HOME"
else
    echo -e "${RED}✗${NC} Tilde expansion failed"
    exit 1
fi

# Test 6: Check Docker Compose configuration
echo -e "\n${BLUE}Test 6: Checking Docker Compose configuration...${NC}"
if grep -q "CUSTOM_REPO_PATH" docker-compose.local.yml; then
    echo -e "${GREEN}✓${NC} Docker Compose includes CUSTOM_REPO_PATH"
    
    # Count occurrences (should be in all 3 agents)
    count=$(grep -c "CUSTOM_REPO_PATH" docker-compose.local.yml)
    if [ "$count" -ge 6 ]; then  # 2 per agent (env + volume)
        echo -e "${GREEN}✓${NC} All agents configured with custom repo support"
    else
        echo -e "${YELLOW}⚠${NC} Not all agents may be configured (found $count references)"
    fi
else
    echo -e "${RED}✗${NC} Docker Compose missing CUSTOM_REPO_PATH"
    exit 1
fi

# Test 7: Check .env.example
echo -e "\n${BLUE}Test 7: Checking .env.example...${NC}"
if [ -f ".env.example" ]; then
    if grep -q "CUSTOM_REPO_PATH" .env.example; then
        echo -e "${GREEN}✓${NC} .env.example includes CUSTOM_REPO_PATH"
    else
        echo -e "${RED}✗${NC} .env.example missing CUSTOM_REPO_PATH"
        exit 1
    fi
else
    echo -e "${RED}✗${NC} .env.example not found"
    exit 1
fi

# Test 8: Check Dockerfile updates
echo -e "\n${BLUE}Test 8: Checking Dockerfile updates...${NC}"
if grep -q "/workspace/repo" agents/Dockerfile; then
    echo -e "${GREEN}✓${NC} Dockerfile includes /workspace/repo directory"
else
    echo -e "${RED}✗${NC} Dockerfile missing /workspace/repo setup"
    exit 1
fi

# Test 9: Check startup script
echo -e "\n${BLUE}Test 9: Checking startup script...${NC}"
if [ -x "./scripts/start-with-repo.sh" ]; then
    echo -e "${GREEN}✓${NC} Startup script is executable"
else
    echo -e "${RED}✗${NC} Startup script not found or not executable"
    exit 1
fi

# Summary
echo -e "\n${BLUE}═══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ All tests passed!${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo
echo "The custom repository feature is properly configured."
echo
echo "To use it:"
echo "1. Set CUSTOM_REPO_PATH in your .env file"
echo "2. Run: ./scripts/start-with-repo.sh"
echo "3. Access your repo at /workspace/repo in any agent"
echo