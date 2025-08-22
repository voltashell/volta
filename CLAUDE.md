# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI Flock is a distributed system of AI agents running in isolated Docker containers, communicating via NATS messaging. The system features:
- Multiple AI agents with Claude integration running in Docker containers
- NATS message bus for inter-agent communication
- Web-based monitoring interface with terminal access
- MCP (Model Context Protocol) server for structured agent communication
- Shared file system for agent collaboration

## Common Development Commands

### System Management
```bash
# Start entire system (agents + NATS + monitor)
npm run flock:up

# Stop all services
npm run flock:down

# Restart system with clean state
npm run flock:restart

# View logs for all containers
npm run flock:logs

# Check container status
npm run flock:status

# Clean shared storage
npm run flock:clear-shared
```

### Building Components
```bash
# Build agent TypeScript code
cd agents && npm run build

# Build monitor Next.js app
cd monitor && npm run build

# Build MCP server
cd mcp-server && npm run build

# Type checking for agents
cd agents && npm run type-check
```

### Development Mode
```bash
# Run monitor in dev mode with hot reload
npm run flock:monitor:dev

# Run agents in dev mode
cd agents && npm run dev

# Run MCP server in dev mode
cd mcp-server && npm run dev
```

### Testing & Debugging
```bash
# Access agent shells
docker exec -it agent-1 /bin/bash
docker exec -it agent-2 /bin/bash
docker exec -it agent-3 /bin/bash

# View individual agent logs
npm run flock:logs:agent1
npm run flock:logs:agent2
npm run flock:logs:agent3

# Test NATS messaging
node scripts/send-message.js
node scripts/test-client.js

# Test with custom repository
./scripts/start-with-repo.sh
```

## Architecture & Key Components

### Container Architecture
The system uses Docker containers for isolation with the following structure:
- **Agents (agent-1, agent-2, agent-3)**: TypeScript-based AI agents with Claude integration
- **NATS**: Message broker for pub/sub communication between agents
- **Monitor**: Next.js web dashboard with Socket.IO for real-time updates and xterm.js terminals
- **MCP Server**: Model Context Protocol server for structured agent communication

### Key Directories & Files

**Root Level:**
- `docker-compose.local.yml`: Full system orchestration (all services)
- `docker-compose.yml`: Monitor-only deployment
- `package.json`: Main project scripts for system management

**Agents (`/agents/`):**
- `src/index.ts`: Main agent implementation with NATS subscription and task processing
- `src/claude.ts`: Claude API integration service
- `src/mcp-client.ts`: MCP client for agent communication
- `src/types.ts`: TypeScript type definitions for tasks, events, and configs
- `src/utils.ts`: Utility functions for logging, validation, and file operations

**Monitor (`/monitor/`):**
- `src/app/page.tsx`: Main monitor dashboard React component
- `src/components/ContainerWindow.tsx`: Container log/terminal window component
- `src/components/Terminal.tsx`: xterm.js terminal implementation
- `src/types/monitor.ts`: TypeScript types for monitor data structures

**MCP Server (`/mcp-server/`):**
- `src/index.ts`: MCP server implementation with NATS integration
- `src/websocket-transport.ts`: WebSocket transport layer for MCP

**Shared Storage (`/shared/`):**
- `agents/agent-{1,2,3}/`: Per-agent persistent storage directories
- `common/`: Shared data accessible by all agents
- `logs/`: Centralized logging directory

### Communication Patterns

**NATS Topics:**
- `tasks.*`: Task distribution to agents
- `task.result`: Task completion results
- `agent.<id>.events`: Agent-specific events
- `agent.heartbeat`: Health monitoring
- `broadcast`: System-wide announcements

**MCP Tools:**
- `send_message`: Send messages to specific agents or broadcast
- `list_agents`: List all registered agents with status
- `get_agent_info`: Get detailed information about an agent
- `request_capability`: Request specific capabilities from agents

### Agent Processing Flow
1. Agent connects to NATS and subscribes to task topics
2. Receives task from NATS subscription
3. Validates task structure using type guards
4. Processes task (optionally using Claude for AI tasks)
5. Writes result to shared storage
6. Publishes result to NATS
7. Updates internal statistics

## Important Implementation Details

### Environment Variables
- `AGENT_ID`: Unique identifier for each agent
- `NATS_URL`: NATS server connection URL (default: nats://nats:4222)
- `SHARED_DIR`: Shared storage directory (default: /shared)
- `ANTHROPIC_API_KEY`: Claude API key for AI processing
- `CLAUDE_MODEL`: Claude model to use (default: claude-3-5-sonnet-20241022)
- `CUSTOM_REPO_PATH`: Optional path to mount external repository

### Security & Isolation
- Agents run as non-root users with limited permissions
- Resource limits enforced (CPU: 0.5 cores, Memory: 512MB per agent)
- Network isolation: agents can only communicate via NATS
- Shared storage provides controlled inter-agent data exchange

### File System Access (Agents)
- `/shared/agents/{AGENT_ID}/`: Agent-specific persistent storage
- `/home/agent/workspace/`: Private workspace for temporary files
- `/workspace/repo/`: External repository mount (when configured)
- `/shared/common/`: Shared read/write area for collaboration

### TypeScript Configuration
- Strict mode enabled for type safety
- ES2020 target with CommonJS modules
- Source maps generated for debugging
- Declaration files generated for type exports

## Development Workflow Tips

1. **Making Agent Changes**: Edit TypeScript files in `/agents/src/`, rebuild with `npm run agents:build`, then restart containers
2. **Monitor Updates**: Edit React components in `/monitor/src/`, changes hot-reload in dev mode
3. **Testing Agent Communication**: Use scripts in `/scripts/` directory for sending test messages
4. **Debugging**: Access agent terminals via web UI at http://localhost:3000 or use `docker exec`
5. **Custom Repository**: Set `CUSTOM_REPO_PATH` in `.env` to mount external codebases into agents

## Key Files to Understand

- `agents/src/index.ts`: Core agent logic and NATS integration
- `monitor/src/app/page.tsx`: Monitor dashboard implementation
- `docker-compose.local.yml`: System configuration and service definitions
- `agents/src/types.ts`: Type definitions for entire agent system
- `mcp-server/src/index.ts`: MCP server implementation