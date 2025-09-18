# AI Flock

A distributed system of AI agents running in isolated Docker containers, communicating via NATS messaging and sharing data through a secure file system. Features a comprehensive web-based monitoring interface with full terminal access to each agent.

## Overview

AI Flock provides strict isolation between AI agents using Docker containers with security hardening. Each agent operates independently with controlled communication through a NATS message bus, shared storage access, and includes Gemini CLI integration for interactive AI conversations. The system includes a Next.js-based monitor application providing real-time logs, metrics, and **full web-based terminals** for each agent.

## 🆕 New Features

### Web-Based Agent Terminals
- **Full terminal access** in the browser for each agent container
- **Interactive shells** with proper TTY support using xterm.js
- **Direct Gemini CLI integration** - run `gemini` for interactive AI chat sessions
- **File system access** - create, edit, and manage files directly in agent containers
- **Real-time terminal emulation** with colors, cursor control, and full keyboard support

### Enhanced Monitoring
- **Tabbed interface** - switch between Logs and Terminal views for each agent
- **Real-time container statistics** - CPU, memory, and network usage
- **Socket.IO integration** - live updates without page refresh
- **Container management** - restart containers directly from the web interface

### Custom Repository Access
- **Mount external codebases** into agent containers for AI-assisted editing
- **Supports absolute paths** and tilde expansion (`~/repositories/project`)
- **Shared access** across all agents to the same repository
- **Automatic validation** of paths before container startup
- **Permission management** for cross-platform compatibility

## Architecture

### Core Components
- **3 AI Agents**: Each with Gemini CLI, bash shell, and persistent storage
- **NATS Message Bus**: Lightweight pub/sub for agent coordination
- **Monitor Dashboard**: Next.js web app with real-time monitoring and terminals
- **Shared Storage**: Per-agent directories with controlled access

### Isolation Strategy
- **VM Level**: Docker Desktop's Linux VM or traditional VM (Vagrant) provides the base isolation layer
- **Container Level**: Each agent runs in Docker with security hardening:
  - Non-root user execution with writable workspace
  - Resource limits (CPU, memory, PIDs) 
  - Isolated network (agents can only reach NATS)
  - TTY support for interactive terminal sessions

### Communication & Storage
- **NATS Messaging**: Agent coordination and task distribution
- **WebSocket**: Real-time browser-to-agent terminal connections
- **Shared Storage**: Per-agent directories (`/shared/agents/<id>/`)
- **Agent Home**: Writable file system at `/home`
- **Collaborative Repository**: Optional mount at `/shared/workspace` for multi-agent collaborative editing

## Quick Start

### Prerequisites
- Docker Desktop (recommended for Apple Silicon)
- Node.js 18+ (for host machine)
- GEMINI_API_KEY environment variable set

### Start the System

#### Basic Setup
```bash
# 1. Set your Gemini API key
export GEMINI_API_KEY="your_api_key_here"

# 2. Start all services (NATS + 3 agents + monitor)
docker-compose -f docker-compose.local.yml up --build

# 3. Open the monitor dashboard
open http://localhost:4000
```

#### With Custom Repository
```bash
# 1. Configure environment (.env file)
GEMINI_API_KEY="your_api_key_here"
CUSTOM_REPO_PATH="~/repositories/my-project"

# 2. Use the startup script with validation
./scripts/start-with-repo.sh

# 3. Access repository in agents at /workspace/repo
# Open terminal in web UI and run:
cd /workspace/repo
ls -la
```

### Authentication
The monitor uses Auth0 for user login. Configure the following environment variables:
```bash
NEXT_PUBLIC_AUTH0_DOMAIN="YOUR_DOMAIN.auth0.com"
NEXT_PUBLIC_AUTH0_CLIENT_ID="your_client_id"
NEXT_PUBLIC_AUTH0_CALLBACK_URL="http://localhost:3000"
```
The dashboard and Electron app are inaccessible until you sign in with Auth0. After signing in on the web dashboard, downloading and launching the Electron app will reuse the same Auth0 session so you're signed in automatically.

#### Electron App (Experimental)
```bash
# Launch monitor in an Electron window
npm run electron:dev

# Build a distributable Electron package
npm run electron:build
```

### Using the Web Interface
1. **View Logs**: Click the "Logs" tab to see real-time container logs
2. **Access Terminal**: Click the "Terminal" tab for full shell access
3. **Run Gemini**: In any terminal, type `gc` for interactive Gemini chat
4. **Create Files**: Use `touch`, `nano`, `vim` - full file system access
5. **Quick Commands**: Use `gp "your prompt"` for one-off Gemini queries

## Project Structure

```
ai-flock/
├── monitor/                    # 🆕 Web monitoring dashboard
│   ├── src/
│   │   ├── app/               # Next.js app router
│   │   ├── components/        
│   │   │   ├── ContainerWindow.tsx  # Agent log/terminal tabs
│   │   │   └── Terminal.tsx         # xterm.js terminal component
│   │   └── types/             # TypeScript interfaces
│   ├── server.ts              # Custom server with Socket.IO + node-pty
│   ├── Dockerfile             # Debian-based for native module support
│   └── package.json           # Next.js + Socket.IO + xterm.js
├── agents/                     # TypeScript agent implementation  
│   ├── src/
│   │   ├── index.ts           # Agent code with NATS integration
│   │   └── gemini.ts          # Gemini API integration
│   ├── scripts/               # 🆕 Terminal helper scripts
│   │   ├── gemini-wrapper.sh  # Interactive Gemini support
│   │   └── setup-env.sh       # Environment configuration  
│   ├── Dockerfile             # Multi-stage build with bash + Gemini CLI
│   └── package.json           # Agent dependencies
├── shared/                     # Shared storage (mounted to all containers)
│   ├── agents/                # Per-agent working directories
│   │   ├── agent-1/.gemini/   # Persistent Gemini configuration
│   │   ├── agent-2/.gemini/   
│   │   └── agent-3/.gemini/
│   ├── common/                # Shared read-only data
│   └── logs/                  # Centralized logging
├── docker-compose.local.yml   # 🆕 Full system orchestration
├── docker-compose.yml         # Monitor-only deployment
└── scripts/                   # Management utilities
```

## Web Dashboard Features

### Container Windows
Each agent has a dedicated window showing:
- **Real-time logs** with timestamps and color coding
- **Container statistics** (CPU, memory, network I/O)
- **Tab interface** switching between Logs and Terminal
- **Restart button** for container management
- **Command execution** with results inline

### Terminal Interface
- **Full xterm.js terminal** with professional appearance
- **Real PTY allocation** using node-pty for proper terminal emulation
- **Interactive programs** work correctly (vim, nano, gemini)
- **Window resizing** with automatic fit
- **Copy/paste support** and keyboard shortcuts
- **Color themes** with syntax highlighting

### Gemini Integration
Each agent container includes:
- **Gemini CLI** pre-installed and configured
- **API key management** via persistent `.env` files
- **Interactive chat** - just type `gc` in any terminal
- **Quick prompts** - use `gp "your question"` for one-off queries
- **Persistent configuration** stored in shared volumes

## Commands

### System Management
```bash
# Start everything (monitor + agents + NATS)
docker-compose -f docker-compose.local.yml up --build

# Monitor only (if agents are running separately)
docker-compose up --build

# Stop all services
docker-compose -f docker-compose.local.yml down

# View logs
docker-compose -f docker-compose.local.yml logs -f

# Scale agents
docker-compose -f docker-compose.local.yml up -d --scale agent-1=2
```

### Direct Container Access
```bash
# SSH into agent containers (alternative to web terminal)
docker exec -it agent-1 /bin/bash
docker exec -it agent-2 /bin/bash  
docker exec -it agent-3 /bin/bash

# Access NATS container
docker exec -it nats /bin/sh
```

### Development
```bash
# Monitor development (with hot reload)
cd monitor && npm run dev

# Agent development
cd agents && npm run build

# TypeScript type checking
npm run type-check
```

## Agent Features

### Interactive Capabilities
Each agent provides:
- **Full bash shell** with command history and completion
- **File system access** - create and edit files in `/home`
- **Gemini AI integration** - interactive chat and prompt processing  
- **Screen sessions** for background processes
- **Network access** to NATS broker for agent communication

### Environment Setup
- **Home directory**: `/shared/agents/${AGENT_ID}/` (persistent)
- **Home Directory**: `/home/` (writable) 
- **Gemini config**: Automatically configured with API key
- **Shell aliases**: `gc` (Gemini chat), `gp` (quick prompt)

### NATS Integration
- **Task processing** via `tasks.*` topics
- **Result publishing** to `task.result` topic
- **Agent events** on `agent.<id>.events`
- **Heartbeat monitoring** every 30 seconds

## Gemini CLI Usage

### In Web Terminal
```bash
# Interactive chat session
gc

# Quick one-off prompt  
gp "Explain Docker containers"

# Check Gemini models
gemini models list

# Direct Gemini command
gemini -p "Write a Python function to sort a list"
```

### Configuration
Each agent has persistent Gemini configuration in:
```
/shared/agents/agent-1/.gemini/.env
/shared/agents/agent-2/.gemini/.env  
/shared/agents/agent-3/.gemini/.env
```

Configuration includes:
- `GEMINI_API_KEY`: Your API key
- `GEMINI_MODEL`: Model to use (default: gemini-1.5-flash)

## Troubleshooting

### Monitor Container Issues

#### node-pty Native Module Error
If you see errors like `Cannot find module '../build/Debug/pty.node'` or `invalid ELF header`, this indicates a platform/architecture mismatch with the `node-pty` native module.

**Symptoms:**
```
Error: Cannot find module '../build/Debug/pty.node'
Error: /app/node_modules/node-pty/build/Release/pty.node: invalid ELF header
```

**Solution:**
The Dockerfile has been updated to rebuild native modules in the production stage. Force a rebuild:

```bash
# Clear Docker build cache and rebuild
docker-compose -f docker-compose.local.yml down
docker system prune -f
docker-compose -f docker-compose.local.yml up --build --force-recreate
```

**Root Cause:** This typically happens when building on Apple Silicon (M1/M2) but running on x86_64, or when Docker uses cached layers from a different architecture.

### General Issues

#### Container Won't Start
```bash
# Check container logs
docker-compose -f docker-compose.local.yml logs monitor

# Restart specific container
docker-compose -f docker-compose.local.yml restart monitor
```

#### Port Already in Use
```bash
# Find process using port 4000
lsof -i :4000

# Kill process or change port in docker-compose.local.yml
```

## Custom Repository Access

### Overview
The custom repository feature allows you to mount external codebases into all agent containers, enabling AI-assisted development on your existing projects. All agents share access to the same repository mounted at `/workspace/repo`.

### Configuration
Edit your `.env` file (copy from `.env.example` if needed):
```bash
# Mount a repository from your home directory
CUSTOM_REPO_PATH=~/repositories/my-project

# Or use an absolute path
CUSTOM_REPO_PATH=/Users/username/projects/my-app
```

### Usage Examples
```bash
# 1. Basic usage with validation
export CUSTOM_REPO_PATH="~/repositories/my-project"
./scripts/start-with-repo.sh

# 2. Direct Docker Compose (no validation)
export CUSTOM_REPO_PATH="/absolute/path/to/repo"
docker-compose -f docker-compose.local.yml up --build

# 3. Access in agent terminals
docker exec -it agent-1 /bin/bash
cd /workspace/repo
ls -la  # Your repository files
```

### Web Terminal Access
1. Open the monitor at http://localhost:4000
2. Click on any agent's Terminal tab
3. Navigate to your repository:
AI Flock runs multiple instances of Claude in isolated Docker containers. Each agent connects to a shared NATS message bus and uses a shared directory for exchanging data.

## Usage

1. Set the required environment variables:
   ```bash
   export ANTHROPIC_API_KEY="your_api_key"
   ```
2. Build and start the containers:
   ```bash
   npm run flock:up
   ```
3. View container status or logs:
   ```bash
   npm run flock:status
   npm run flock:logs
   ```
4. Stop the system:
   ```bash
   npm run flock:down
   ```

## Scripts
- `flock:up` – initialize directories and start NATS plus three Claude agents.
- `flock:down` – stop all containers and reset directories.
- `flock:status` – show running containers.
- `flock:shell:agent1/2/3` – open a shell in an agent container.

## Project Structure
- `agents/` – Claude agent implementation and Dockerfile.
- `scripts/` – helper scripts for initializing volumes.
- `docker-compose.local.yml` – defines agent and NATS containers.
- `shared/` – mounted volumes for agent data.

The repository is focused solely on Docker-based deployment; no virtual machines or monitoring front-ends are included.
