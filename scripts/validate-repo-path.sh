#!/bin/bash

# validate-repo-path.sh - Validates custom repository path before Docker startup

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to expand tilde in path
expand_path() {
    local path="$1"
    if [[ "$path" == "~"* ]]; then
        path="${path/#\~/$HOME}"
    fi
    echo "$path"
}

# Function to validate repository path
validate_repo_path() {
    local repo_path="$1"
    
    # If path is empty or not set, that's okay (optional feature)
    if [[ -z "$repo_path" ]]; then
        echo -e "${GREEN}✓${NC} Custom repository path not set (optional feature)"
        return 0
    fi
    
    # Expand tilde if present
    repo_path=$(expand_path "$repo_path")
    
    # Check if path exists
    if [[ ! -e "$repo_path" ]]; then
        echo -e "${RED}✗${NC} Error: Custom repository path does not exist: $repo_path"
        return 1
    fi
    
    # Check if it's a directory
    if [[ ! -d "$repo_path" ]]; then
        echo -e "${RED}✗${NC} Error: Custom repository path is not a directory: $repo_path"
        return 1
    fi
    
    # Check if it's readable
    if [[ ! -r "$repo_path" ]]; then
        echo -e "${RED}✗${NC} Error: Custom repository path is not readable: $repo_path"
        return 1
    fi
    
    # Check if it's writable (warning only)
    if [[ ! -w "$repo_path" ]]; then
        echo -e "${YELLOW}⚠${NC} Warning: Custom repository path is not writable: $repo_path"
        echo "  Agents may not be able to modify files in this directory"
    fi
    
    # Export the expanded path for Docker Compose
    export CUSTOM_REPO_PATH="$repo_path"
    
    echo -e "${GREEN}✓${NC} Custom repository path validated: $repo_path"
    return 0
}

# Main execution
main() {
    echo "Validating custom repository path..."
    
    # Get the custom repo path from environment or .env file
    if [[ -f .env ]]; then
        source .env
    fi
    
    if validate_repo_path "$CUSTOM_REPO_PATH"; then
        echo -e "${GREEN}✓${NC} Validation successful"
        
        # Create empty directory for Docker fallback if needed
        if [[ -z "$CUSTOM_REPO_PATH" ]] && [[ ! -d "/tmp/empty" ]]; then
            mkdir -p /tmp/empty
        fi
        
        exit 0
    else
        echo -e "${RED}✗${NC} Validation failed"
        echo "Please fix the issues above or unset CUSTOM_REPO_PATH to disable this feature"
        exit 1
    fi
}

# Run main function
main "$@"