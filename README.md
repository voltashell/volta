# AI Flock

A distributed system of AI agents running in isolated Docker containers within a virtual machine, communicating via NATS messaging and sharing data through a secure file system.

## Overview

AI Flock provides strict isolation between AI agents using Docker containers within a VM environment. Each agent operates independently with controlled communication through a NATS message bus and shared storage access through dedicated directories.

## Architecture

### Isolation Strategy
- **VM Level**: Ubuntu VM via Vagrant provides the base isolation layer
- **Container Level**: Each agent runs in Docker with security hardening:
  - Non-root user execution
  - Read-only root filesystem
  - Dropped Linux capabilities (CAP_DROP: ALL)
  - Resource limits (CPU, memory, PIDs)
  - Isolated network (agents can only reach NATS)

### Communication & Storage
- **NATS Messaging**: Lightweight pub/sub for agent coordination
- **Shared Storage**: Per-agent directories with controlled access
- **Logging**: Centralized logging to shared directory

## Quick Start

### Prerequisites
- Vagrant (with VirtualBox or Parallels)
- Node.js 18+ (for host machine)

### Launch the System
```bash
# 1. Start VM and install Docker
npm run vm:up

# 2. Build agent image
npm run vm:agents:build  

# 3. Start NATS and 3 agents
npm run vm:agents

# 4. Test the system
npm run vm:agents:test

# 5. View logs
npm run vm:agents:logs
```

## Project Structure

```
ai-flock/
├── agents/                 # Agent implementation
│   ├── index.js           # Agent code with NATS integration
│   ├── Dockerfile         # Hardened container image
│   └── package.json       # Agent dependencies
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
└── Vagrantfile           # VM configuration
```

## Commands

### VM Management
```bash
npm run vm:up          # Start and provision VM
npm run vm:ssh         # SSH into VM  
npm run vm:down        # Stop VM
npm run vm:destroy     # Destroy VM
```

### Agent Management
```bash
npm run vm:agents            # Start NATS + 3 agents
npm run vm:agents:build      # Build agent Docker image
npm run vm:agents:down       # Stop all services
npm run vm:agents:logs       # View service logs
npm run vm:agents:test       # Publish test tasks
```

### Manual Operations (inside VM)
```bash
# SSH into VM
vagrant ssh && cd /vagrant

# Agent lifecycle
./scripts/manage-agents.sh up 5      # Start 5 agents
./scripts/manage-agents.sh status    # View running containers
./scripts/manage-agents.sh logs      # Stream logs
./scripts/manage-agents.sh test      # Send test tasks
./scripts/manage-agents.sh down      # Stop all services
```

## Agent Contract

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

### Advanced Isolation (Optional)
- **gVisor**: VM-like isolation using `runsc` runtime
- **Kata Containers**: Hardware virtualization for stronger boundaries
- **User namespace remapping**: Additional UID/GID isolation

## Observability

### Logging
- **Centralized**: All agents log to `/shared/logs/<agent-id>.log`
- **Docker logs**: Standard container logging via `docker logs`
- **Structured**: JSON-formatted log entries with timestamps

### Monitoring
- **Health checks**: Container-level health monitoring
- **Heartbeats**: Agent heartbeats every 30 seconds to NATS
- **Resource usage**: Container resource consumption tracking

### Optional Metrics
- **Prometheus**: Node exporter for VM-level metrics
- **NATS monitoring**: Built-in NATS metrics endpoint (port 8222)

## Testing & Validation

### Isolation Tests
- **Network isolation**: Verify agents cannot communicate except via NATS
- **File system isolation**: Confirm agents cannot access other agent directories
- **Resource limits**: Validate cgroup constraints are enforced

### Functionality Tests
- **Message passing**: Publish tasks and verify agent processing
- **File operations**: Test shared directory read/write operations  
- **Error handling**: Verify graceful handling of NATS disconnection

### Performance Tests
- **Resource stress**: Stress individual agents to test isolation
- **Scaling**: Test system behavior with increased agent count
- **Throughput**: Measure message processing rates

## Cloud Deployment

For production deployment on AWS ECS Fargate, see `aws/README.md`:

```bash
# Deploy to AWS
cd aws/scripts && ./deploy.sh

# Monitor deployment  
./monitor.sh

# Clean up
./cleanup.sh
```

## Threat Model

### Assumptions
- **VM boundary**: Host OS is trusted; VM provides outer boundary
- **Container escape**: Docker provides process isolation; additional runtimes (gVisor/Kata) for stronger guarantees
- **Shared storage**: File system permissions enforce per-agent access controls

### Mitigations
- **Defense in depth**: Multiple isolation layers (VM → container → security features)
- **Principle of least privilege**: Minimal capabilities and permissions
- **Resource constraints**: Prevent resource exhaustion attacks
- **Network segmentation**: Controlled communication channels only

## Development

### Adding New Agents
1. Extend agent code in `agents/index.js`
2. Update Docker image: `npm run vm:agents:build`
3. Scale agents: `./scripts/manage-agents.sh up N`

### Customizing Agent Behavior
- **Environment variables**: Configure via docker-compose environment
- **Shared libraries**: Place in `/shared/common/` directory
- **Configuration files**: Agent-specific config in `/shared/agents/<id>/`

### Debugging
```bash
# Agent logs
npm run vm:agents:logs

# Individual agent
vagrant ssh -c "docker logs agent-1"

# NATS monitoring
vagrant ssh -c "curl http://localhost:8222/varz"
```

## Performance Tuning

### Resource Allocation
- **CPU limits**: Adjust in `vm/docker-compose.yml`
- **Memory limits**: Configure per-agent memory allocation
- **Storage**: Monitor EFS/shared directory performance

### Scaling Considerations
- **Agent count**: Optimal 3-10 agents per VM (2GB RAM)
- **NATS throughput**: Monitor message queue depth
- **VM resources**: Scale VM specs with agent count

## Troubleshooting

### Common Issues

**Agents fail to connect to NATS**
- Check NATS service health: `docker logs nats`
- Verify network connectivity in VM
- Confirm Service Discovery DNS resolution

**Shared directory permissions**
- Verify `/shared` mount in containers
- Check file ownership: `ls -la /shared/`
- Confirm vagrant user permissions

**Container startup failures**  
- Check Docker image build: `docker images`
- Review container logs: `docker logs <container>`
- Verify resource constraints aren't exceeded

For detailed troubleshooting, see the logs in `/shared/logs/` and use `docker inspect` for container configuration details.