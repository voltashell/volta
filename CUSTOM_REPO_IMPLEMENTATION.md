# Custom Repository Path Implementation Plan

## Overview
This document outlines the implementation plan for adding the ability to specify a custom repository path that AI agents can edit, allowing users to mount external codebases (e.g., `~/repositories/codebase`) into the agent containers.

## Current Architecture Analysis
- Agents currently mount `./shared:/shared` volume containing per-agent directories
- Each agent has writable workspace at `/home/agent/workspace/` 
- Agents run with different UIDs (1001, 1002, 1003) for isolation
- Current volume structure: `./shared:/shared` maps to `/shared/agents/<id>/` for persistent storage

## Implementation Steps

### Step 1: Configuration Mechanism ✅
**Objective**: Create environment variable `CUSTOM_REPO_PATH` to specify the repository path

**Tasks**:
- Add `CUSTOM_REPO_PATH=` to `.env.example` with documentation
- Support both absolute paths (`/full/path/to/repo`) and tilde expansion (`~/repositories/codebase`)
- Make it optional - system works normally without it
- Add validation for path format and existence

**Implementation Details**:
```bash
# Example usage
export CUSTOM_REPO_PATH="~/repositories/my-project"
# or
export CUSTOM_REPO_PATH="/absolute/path/to/repository"
```

### Step 2: Docker Compose Modifications ✅
**Objective**: Update `docker-compose.local.yml` to conditionally mount custom repository

**Tasks**:
- Add conditional volume mount to all agent services
- Add environment variable `CUSTOM_REPO_PATH` to agent containers
- Ensure proper permissions with user mapping
- Handle empty/unset `CUSTOM_REPO_PATH` gracefully

**Implementation Details**:
```yaml
# Add to each agent service
volumes:
  - ./shared:/shared
  - ${CUSTOM_REPO_PATH}:/workspace/repo:rw  # Only if CUSTOM_REPO_PATH is set
environment:
  - CUSTOM_REPO_PATH=${CUSTOM_REPO_PATH:-}
  - REPO_MOUNT_PATH=/workspace/repo
```

### Step 3: Agent Environment Updates ✅
**Objective**: Modify agent containers to handle the custom repository

**Tasks**:
- Add `/workspace/repo` as standard mount point for custom repositories
- Update agent startup scripts to set appropriate permissions
- Add environment variable `REPO_PATH=/workspace/repo` when custom repo is mounted
- Create symlinks or aliases for easy access

**Implementation Details**:
- Mount point: `/workspace/repo` (consistent across all agents)
- Environment variable: `REPO_PATH` points to mounted repository
- Startup script validates mount and sets permissions

### Step 4: Validation & Error Handling ✅
**Objective**: Add startup validation and error handling

**Tasks**:
- Check if `CUSTOM_REPO_PATH` exists and is readable before Docker startup
- Validate it's a directory (not a file)
- Provide clear error messages if path is invalid
- Add health checks to ensure mount is successful
- Handle permission issues gracefully

**Implementation Details**:
```bash
# Validation script example
if [[ -n "$CUSTOM_REPO_PATH" ]]; then
  if [[ ! -d "$CUSTOM_REPO_PATH" ]]; then
    echo "Error: CUSTOM_REPO_PATH '$CUSTOM_REPO_PATH' is not a directory"
    exit 1
  fi
  if [[ ! -r "$CUSTOM_REPO_PATH" ]]; then
    echo "Error: CUSTOM_REPO_PATH '$CUSTOM_REPO_PATH' is not readable"
    exit 1
  fi
fi
```

### Step 5: Permission Management ✅
**Objective**: Handle file permissions properly for cross-platform compatibility

**Tasks**:
- Ensure agents can read/write to the mounted repository
- Consider using bind mounts with proper UID/GID mapping
- Add option to run with host user permissions when needed
- Handle macOS, Linux, and Windows Docker Desktop differences

**Implementation Details**:
- Use `user: "${UID:-1000}:${GID:-1000}"` for permission mapping
- Add `--user` flag option for Docker Compose
- Document platform-specific permission considerations

### Step 6: Documentation Updates ⏳
**Objective**: Update README.md and create usage documentation

**Tasks**:
- Add new environment variable documentation to README
- Create usage examples with different path formats
- Document security considerations for mounting external repositories
- Add troubleshooting section for permission issues
- Update Quick Start section with custom repo example

**Documentation Sections to Add**:
```markdown
## Custom Repository Access

### Setup
export CUSTOM_REPO_PATH="~/repositories/my-project"
docker-compose -f docker-compose.local.yml up --build

### Usage
# Access your repository in any agent terminal
cd /workspace/repo
ls -la  # Your repository files

### Security Considerations
- Only mount trusted repositories
- Be aware of file permission implications
- Custom repositories are accessible by all agents
```

### Step 7: Testing & Validation ⏳
**Objective**: Create comprehensive test scenarios

**Tasks**:
- Test with absolute paths (`/full/path/to/repo`)
- Test with tilde expansion (`~/repositories/codebase`)
- Test permission scenarios (read-only, read-write)
- Verify agents can create, edit, and delete files in custom repo
- Test error handling for invalid paths
- Cross-platform testing (macOS, Linux)

**Test Cases**:
1. **Valid absolute path**: `/Users/user/projects/test-repo`
2. **Valid tilde path**: `~/repositories/test-repo`
3. **Invalid path**: `/nonexistent/path`
4. **File instead of directory**: `~/file.txt`
5. **Permission denied**: Directory without read permissions
6. **Empty/unset variable**: System should work normally

## Usage Examples

### Basic Usage
```bash
# 1. Set custom repository path
export CUSTOM_REPO_PATH="~/repositories/my-codebase"

# 2. Start the system
docker-compose -f docker-compose.local.yml up --build

# 3. Access via web terminal
# Navigate to http://localhost:4000
# Click Terminal tab for any agent
# cd /workspace/repo
```

### Advanced Usage
```bash
# With absolute path
export CUSTOM_REPO_PATH="/Users/developer/projects/ai-project"

# With validation
if [[ -d "$CUSTOM_REPO_PATH" ]]; then
  docker-compose -f docker-compose.local.yml up --build
else
  echo "Repository path does not exist: $CUSTOM_REPO_PATH"
fi
```

## Security Considerations

### File Permissions
- Mounted repositories inherit host file permissions
- All agents (with different UIDs) will access the same repository
- Consider using appropriate file permissions (644 for files, 755 for directories)

### Access Control
- All 3 agents will have access to the mounted repository
- No isolation between agents for custom repository access
- Agents can modify, create, and delete files in the mounted repository

### Best Practices
- Only mount repositories you trust the agents to modify
- Use version control (git) to track changes made by agents
- Consider mounting as read-only for sensitive repositories
- Regular backups of important repositories

## Implementation Timeline

1. **Phase 1** (High Priority): Configuration and Docker Compose changes
2. **Phase 2** (Medium Priority): Agent environment and validation
3. **Phase 3** (Low Priority): Documentation and testing

## Backward Compatibility

This implementation maintains full backward compatibility:
- Existing functionality remains unchanged
- `CUSTOM_REPO_PATH` is optional
- Default behavior is preserved when variable is not set
- No breaking changes to existing Docker Compose files

## Future Enhancements

### Potential Improvements
- Support for multiple repository mounts
- Per-agent repository configuration
- Read-only mount options
- Repository-specific environment variables
- Integration with git for automatic change tracking

### Configuration File Support
Consider adding support for a configuration file (e.g., `ai-flock.config.yml`):
```yaml
repositories:
  - path: "~/repositories/project-1"
    mount: "/workspace/project-1"
    readonly: false
  - path: "/absolute/path/to/project-2"
    mount: "/workspace/project-2"
    readonly: true
```

This implementation plan provides a robust, secure, and user-friendly way to mount external repositories into AI agent containers while maintaining the existing architecture and security model.
