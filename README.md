# AI Flock

A distributed AI agent system running in isolated Docker containers within a VM, with NATS-based messaging for coordination.

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

```bash
npm install
```

### Development

Run the project in development mode with hot reloading:

```bash
npm run dev
```

### Building

Compile TypeScript to JavaScript:

```bash
npm run build
```

### Running

Run the compiled JavaScript:

```bash
npm start
```

### Scripts

- `npm run dev` - Run with ts-node for development
- `npm run build` - Compile TypeScript to JavaScript
- `npm run start` - Run the compiled JavaScript
- `npm run watch` - Compile in watch mode
- `npm run clean` - Remove the dist directory

#### Docker Scripts

- `npm run docker:build` - Build Docker image
- `npm run docker:run` - Run Docker container
- `npm run docker:up` - Start services with docker-compose
- `npm run docker:down` - Stop services with docker-compose
- `npm run docker:logs` - View container logs

Aliases:

- `npm run dbuild` → `docker build -t ai-flock .`
- `npm run drun` → `docker run -p 3000:3000 ai-flock`
- `npm run dup` → `docker-compose up -d`
- `npm run ddown` → `docker-compose down`
- `npm run dlogs` → `docker-compose logs -f`

## Docker

This project includes Docker support for easy deployment and development.

### Running with Docker

#### Option 1: Using Docker directly

Build and run the Docker image:

```bash
# Build the image
npm run docker:build

# Run the container
npm run docker:run
```

Or manually:

```bash
# Build the image
docker build -t ai-flock .

# Run the container
docker run -p 3000:3000 ai-flock
```

#### Option 2: Using Docker Compose

```bash
# Start the application
npm run docker:up

# View logs
npm run docker:logs

# Stop the application
npm run docker:down
```

Note: This project is a console application. When the container runs, it prints a greeting and exits. There is no web server listening on a port.

### Docker Configuration

- **Dockerfile**: Multi-stage build with Node.js 18 Alpine
- **docker-compose.yml**: Service orchestration
- **.dockerignore**: Excludes unnecessary files from build context

### Development with Docker

For development with live reloading, uncomment the `ai-flock-dev` service in `docker-compose.yml` and run:

```bash
docker-compose up ai-flock-dev
```

## VM Setup & Agent Management

The AI agents run inside a Vagrant VM with Docker for strict isolation.

### Prerequisites

- Vagrant
- VirtualBox or Parallels (on macOS)
- Node.js (for host machine npm scripts)

### Quick Start

```bash
# 1. Start the VM (installs Docker and dependencies)
npm run vm:up

# 2. Build agent Docker image
npm run vm:agents:build

# 3. Start NATS and 3 agents
npm run vm:agents

# 4. View agent logs
npm run vm:agents:logs

# 5. Run a test
npm run vm:agents:test
```

### VM Management Scripts

- `npm run vm:up` - Start and provision the VM
- `npm run vm:ssh` - SSH into the VM
- `npm run vm:down` - Halt the VM
- `npm run vm:destroy` - Destroy the VM
- `npm run vm:provision` - Re-provision the VM

### Agent Management Scripts

- `npm run vm:agents` - Start NATS and agents (default: 3)
- `npm run vm:agents:build` - Build the agent Docker image
- `npm run vm:agents:down` - Stop all agents and NATS
- `npm run vm:agents:logs` - View logs from all services
- `npm run vm:agents:test` - Publish test tasks to agents

### Manual Agent Management (inside VM)

```bash
# SSH into the VM
vagrant ssh

# Navigate to project
cd /vagrant

# Build agent image
./scripts/manage-agents.sh build

# Start NATS and agents
./scripts/manage-agents.sh up 5  # Start 5 agents

# View status
./scripts/manage-agents.sh status

# Publish test tasks
./scripts/manage-agents.sh test

# View logs
./scripts/manage-agents.sh logs

# Stop everything
./scripts/manage-agents.sh down
```

## Project Structure

```
ai-flock/
├── agents/           # Agent code and Docker setup
│   ├── index.js      # Agent implementation
│   ├── Dockerfile    # Agent container image
│   └── package.json  # Agent dependencies
├── vm/               # VM orchestration
│   └── docker-compose.yml # NATS + agents setup
├── shared/           # Shared storage (synced to VM)
│   ├── agents/       # Per-agent directories
│   ├── common/       # Shared data
│   └── logs/         # Agent logs
├── scripts/          # Management scripts
│   ├── provision.sh  # VM provisioning
│   ├── manage-agents.sh # Agent management
│   └── test-client.js # Test client
├── src/              # TypeScript source files
│   └── index.ts      # Main entry point
├── Vagrantfile       # VM configuration
├── package.json      # Project scripts
└── README.md         # This file
```

## Architecture

### Isolation Layers

1. **VM Level**: Ubuntu VM via Vagrant isolates the entire system
2. **Container Level**: Each agent runs in its own Docker container with:
   - Read-only root filesystem
   - Dropped capabilities (CAP_DROP: ALL)
   - No new privileges
   - Resource limits (CPU, memory, PIDs)
   - Isolated network (can only reach NATS)

### Communication

- **NATS Messaging**: Lightweight pub/sub broker
- **Topics**:
  - `tasks.*` - Task distribution
  - `task.result` - Task completion notifications
  - `agent.<id>.events` - Agent-specific events
  - `agent.<id>.heartbeat` - Health monitoring
  - `broadcast` - System-wide announcements

### Shared Storage

- `/shared/agents/<id>/` - Per-agent working directory
- `/shared/common/` - Shared read-only data
- `/shared/logs/` - Centralized logging

## Security Features

- Non-root user in containers
- Read-only root filesystem
- Temporary filesystems for `/tmp` and `/run`
- Dropped Linux capabilities
- No new privileges flag
- Resource limits (CPU, memory, PIDs)
- Network isolation (agents cannot communicate directly)
- Separate namespaces per container
