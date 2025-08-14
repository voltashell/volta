# AI Flock

A distributed system of AI agents running in isolated Docker containers, communicating via NATS messaging and sharing data through a secure file system. Provides VM-level isolation using Docker Desktop or traditional VMs.

## Overview

AI Flock provides strict isolation between AI agents using Docker containers with security hardening. Each agent operates independently with controlled communication through a NATS message bus and shared storage access through dedicated directories.

## Architecture

### Isolation Strategy
- **VM Level**: Docker Desktop's Linux VM or traditional VM (Vagrant) provides the base isolation layer
- **Container Level**: Each agent runs in Docker with security hardening:
  - Non-root user execution (UID 1001)
  - Read-only root filesystem with tmpfs mounts
  - Dropped Linux capabilities (CAP_DROP: ALL)
  - Resource limits (CPU, memory, PIDs)
  - Isolated network (agents can only reach NATS)

### Communication & Storage
- **NATS Messaging**: Lightweight pub/sub for agent coordination
- **Shared Storage**: Per-agent directories with controlled access
- **Logging**: Centralized logging to shared directory
- **TypeScript**: Fully typed agent implementation with strict type checking

## Quick Start

### Prerequisites
- Docker Desktop (recommended for Apple Silicon)
- Node.js 18+ (for host machine)
- Optional: Vagrant + VirtualBox/Parallels for traditional VM

### Docker Desktop Approach (Recommended)
```bash
# 1. Start NATS and 3 agents
npm run flock:up

# 2. Test the system
npm run flock:test

# 3. View logs
npm run flock:logs

# 4. Monitor system
npm run flock:status
```

### Traditional VM Approach
```bash
# 1. Start VM and install Docker
npm run vm:up

# 2. Build agent image
npm run vm:agents:build

# 3. Start NATS and 3 agents
npm run vm:agents

# 4. Test the system
npm run vm:agents:test
```

## Project Structure

```
ai-flock/
├── agents/                 # TypeScript agent implementation
│   ├── index.ts           # Agent code with NATS integration
│   ├── tsconfig.json      # TypeScript configuration
│   ├── Dockerfile         # Multi-stage build container
│   └── package.json       # Agent dependencies and scripts
├── vm/                    # VM orchestration
│   └── docker-compose.yml # NATS + agents configuration  
├── shared/                # Shared storage (synced to VM)
│   ├── agents/           # Per-agent working directories
│   ├── common/           # Shared read-only data
│   └── logs/             # Centralized logging
├── scripts/               # Management utilities
│   ├── provision.sh      # VM setup with Docker installation
│   ├── manage-agents.sh  # Agent lifecycle management
│   └── test-client.js    # Task publishing test client
├── aws/                   # Cloud deployment (ECS Fargate)
│   ├── cloudformation.yaml # Infrastructure as code
│   └── scripts/          # Deployment automation
├── docker-compose.local.yml # Local Docker Desktop setup
└── Vagrantfile           # Traditional VM configuration
```

## Commands

### Docker Desktop Commands (Primary)
```bash
# System Management
npm run flock:up          # Start NATS + 3 agents (builds if needed)
npm run flock:down        # Stop all services
npm run flock:restart     # Restart everything
npm run flock:status      # Show container status
npm run flock:stats       # Show resource usage
npm run flock:reset       # Complete cleanup (removes volumes)

# Testing & Monitoring
npm run flock:test        # Run test client to send tasks
npm run flock:logs        # View all logs in real-time
npm run flock:monitor     # Live system dashboard
npm run flock:shared      # Check shared directories

# Individual Service Management
npm run flock:logs:agent1 # Agent 1 logs only
npm run flock:logs:agent2 # Agent 2 logs only  
npm run flock:logs:agent3 # Agent 3 logs only
npm run flock:logs:nats   # NATS logs only

# Shell Access
npm run flock:shell:agent1  # SSH into agent-1 container
npm run flock:shell:agent2  # SSH into agent-2 container
npm run flock:shell:agent3  # SSH into agent-3 container
npm run flock:shell:nats    # SSH into NATS container

# Scaling
npm run flock:scale       # Scale to 6 agents total (2 of each type)
```

### Agent Development
```bash
# TypeScript Development
npm run agents:build      # Compile TypeScript agents
npm run agents:dev        # Run agent with ts-node (development)
npm run agents:type-check # Check types without compilation
npm run agents:clean      # Clean compiled files

# Build and test cycle
npm run agents:build && npm run flock:restart && npm run flock:test
```

### Traditional VM Commands
```bash
# VM Management
npm run vm:up          # Start and provision VM
npm run vm:ssh         # SSH into VM  
npm run vm:down        # Stop VM
npm run vm:destroy     # Destroy VM

# Agent Management (inside VM)
npm run vm:agents            # Start NATS + 3 agents
npm run vm:agents:build      # Build agent Docker image
npm run vm:agents:down       # Stop all services
npm run vm:agents:logs       # View service logs
npm run vm:agents:test       # Publish test tasks
```

## Agent Contract

### TypeScript Interfaces
```typescript
interface Task {
  id: string;
  type: string;
  data: any;
  timestamp?: string;
}

interface TaskResult {
  agentId: string;
  taskId: string;
  status: 'completed' | 'failed' | 'processing';
  timestamp: string;
  result: string;
  error?: string;
}
```

### Environment Variables
- `AGENT_ID`: Unique agent identifier
- `NATS_URL`: NATS broker connection string  
- `SHARED_DIR`: Shared storage mount point (`/shared`)

### NATS Message Topics
- `tasks.*`: Task distribution to agents
- `task.result`: Task completion notifications
- `agent.<id>.events`: Agent-specific events
- `agent.<id>.heartbeat`: Health monitoring (30s interval)
- `broadcast`: System-wide announcements

### File System Layout
- `/shared/agents/<id>/`: Agent working directory
- `/shared/common/`: Shared read-only resources
- `/shared/logs/<id>.log`: Agent log files

## Deployment Options

### 1. Docker Desktop (Recommended)
**Best for:** Development, testing, Apple Silicon Macs
- ✅ Easy setup and management
- ✅ Good isolation via Docker Desktop's VM
- ✅ Excellent performance on Apple Silicon
- ✅ Built-in monitoring and debugging tools

### 2. Traditional VM (Vagrant)
**Best for:** Maximum isolation, production-like testing
- ✅ Hardware-level VM isolation
- ✅ Full control over VM configuration
- ❌ Requires VirtualBox/VMware compatibility
- ❌ Higher resource overhead

### 3. AWS ECS Fargate
**Best for:** Production deployment, cloud scaling
- ✅ Serverless container orchestration
- ✅ Auto-scaling and load balancing
- ✅ Enterprise-grade security and compliance
- See `aws/README.md` for deployment guide

## Security Features

### Container Security
- **User namespaces**: Non-root user (UID 1001)
- **Filesystem**: Read-only root with tmpfs for `/tmp` and `/run`
- **Capabilities**: All Linux capabilities dropped
- **Privileges**: No new privileges allowed
- **Resources**: CPU (0.5 cores), memory (256MB), PID limits (50)

### Network Isolation
- **Custom bridge network**: Isolated `bus` network for NATS communication
- **No direct agent-to-agent**: Agents can only communicate via NATS
- **No exposed ports**: Agent containers have no published ports

### TypeScript Security
- **Strict typing**: Prevents runtime type errors
- **Input validation**: Typed interfaces for all messages
- **Error boundaries**: Comprehensive error handling with types

## Development Workflow

### Adding New Agent Types
1. Extend TypeScript interfaces in `agents/index.ts`
2. Implement new message handlers with proper typing
3. Build and test: `npm run agents:build && npm run flock:restart`
4. Validate with: `npm run flock:test`

### Debugging Agents
```bash
# View specific agent logs
npm run flock:logs:agent1

# Access agent shell for debugging
npm run flock:shell:agent1

# Check TypeScript compilation
npm run agents:type-check

# Monitor system resources
npm run flock:stats
```

### Testing Isolation
```bash
# Test network isolation
npm run flock:shell:agent1
# Try: ping agent-2  # Should fail
# Try: nc -z nats 4222  # Should succeed

# Test file system isolation
ls -la /shared/agents/  # Should only see own directory + others (read-only)

# Test resource limits
npm run flock:stats  # Monitor CPU/memory usage
```

## Monitoring & Observability

### Real-time Monitoring
```bash
npm run flock:monitor     # Live dashboard
npm run flock:stats       # Resource usage
npm run flock:status      # Container health
```

### Log Analysis
```bash
# Centralized logging
tail -f shared/logs/agent-1.log

# Docker logs
npm run flock:logs

# NATS monitoring
curl http://localhost:8222/varz
```

### Health Checks
- **Container health**: Built-in Docker health checks
- **Agent heartbeats**: 30-second NATS heartbeat messages
- **NATS monitoring**: HTTP endpoint at port 8222

## Performance Tuning

### Resource Allocation
- **CPU limits**: Adjust in `docker-compose.local.yml`
- **Memory limits**: Configure per-agent memory allocation
- **Storage**: Monitor shared directory performance

### Scaling
```bash
# Scale agents horizontally
npm run flock:scale

# Custom scaling
docker-compose -f docker-compose.local.yml up -d --scale agent-1=5
```

## Troubleshooting

### Common Issues

**TypeScript compilation errors**
- Run: `npm run agents:type-check`
- Fix type errors in `agents/index.ts`
- Rebuild: `npm run agents:build`

**Agents fail to connect to NATS**
- Check: `npm run flock:logs:nats`
- Verify: `docker inspect nats`
- Network: `docker network ls`

**Container startup failures**
- Check: `npm run flock:status`
- Logs: `npm run flock:logs:agent1`
- Build: `docker images | grep ai-agent`

**Docker Desktop issues**
- Restart Docker Desktop
- Check VM resources in Docker Desktop settings
- Clear containers: `npm run flock:reset`

### Debugging Commands
```bash
# System diagnostics
docker system info
docker system df

# Network debugging
docker network inspect ai-flock_bus

# Container inspection
docker inspect agent-1 | jq '.Config.Env'
```

## Migration Guide

### From VM to Docker Desktop
1. Stop VM: `npm run vm:down`
2. Start Docker Desktop: `npm run flock:up`
3. Test: `npm run flock:test`

### From JavaScript to TypeScript
The agents are now fully TypeScript with:
- Strict type checking
- Comprehensive interfaces
- Better error handling
- Multi-stage Docker builds

All existing functionality remains the same with enhanced type safety.