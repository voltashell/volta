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
- **Agent Workspace**: Writable file system at `/home/agent/workspace`
- **Custom Repository**: Optional mount at `/workspace/repo` for external codebases

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
- **File system access** - create and edit files in `/home/agent/workspace`
- **Gemini AI integration** - interactive chat and prompt processing  
- **Screen sessions** for background processes
- **Network access** to NATS broker for agent communication

### Environment Setup
- **Home directory**: `/shared/agents/${AGENT_ID}/` (persistent)
- **Workspace**: `/home/agent/workspace/` (writable) 
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
   ```bash
   cd /workspace/repo
   ls -la
   
   # Use Gemini to analyze code
   gp "Explain the structure of this repository"
   
   # Edit files directly
   vim main.py
   ```

### Security Considerations
- **Trust**: Only mount repositories you trust agents to modify
- **Permissions**: All agents share the same repository access
- **Backups**: Use version control to track changes
- **Write Access**: Agents can create, modify, and delete files

### Troubleshooting
```bash
# Validate repository path
./scripts/validate-repo-path.sh

# Check mount in container
docker exec agent-1 ls -la /workspace/repo

# Permission issues on macOS
# Add your user ID to .env:
UID=$(id -u)
GID=$(id -g)
```

## Security Features

### Container Security
- **User isolation**: Each agent runs as non-root user
- **Writable workspace**: Limited writable access for development
- **Resource limits**: CPU (0.5 cores), memory (512MB)
- **Network isolation**: Agents can only communicate via NATS

### Web Interface Security
- **Docker socket access**: Monitor runs as root to manage containers
- **Local network binding**: Dashboard only accessible on localhost
- **No authentication**: Intended for development use only

### Terminal Security
- **PTY isolation**: Each terminal session is isolated per user
- **Container boundaries**: Terminal access is limited to container scope
- **Process isolation**: Each WebSocket connection gets its own PTY

## Deployment Options

### 1. Local Development (Recommended)
**Best for:** Development, testing, full feature access
- ✅ Web terminals and real-time monitoring
- ✅ Easy debugging and log analysis
- ✅ Interactive Gemini CLI access
- ✅ File system development capabilities

### 2. Docker Desktop Only
**Best for:** Lightweight testing without monitor
- ✅ Fast startup and low resource usage
- ❌ No web interface or terminals
- ❌ Manual container management required

### 3. Traditional VM (Legacy)
**Best for:** Maximum isolation testing
- ✅ Hardware-level VM isolation
- ❌ No web monitoring interface
- ❌ More complex setup and management

## Troubleshooting

### Monitor Issues
```bash
# Check monitor logs
docker logs monitor

# Rebuild monitor with dependencies
cd monitor && npm install && docker-compose up --build

# Check Docker socket access
docker ps  # Should list all containers
```

### Terminal Connection Issues
```bash
# Verify WebSocket connection
curl -I http://localhost:4000

# Check container TTY support
docker exec -it agent-1 tty

# Test node-pty installation
docker exec monitor node -e "console.log(require('node-pty'))"
```

### Gemini CLI Issues
```bash
# Check API key configuration
docker exec agent-1 cat /shared/agents/agent-1/.gemini/.env

# Test Gemini CLI directly
docker exec agent-1 gemini models list

# Verify environment
docker exec agent-1 env | grep GEMINI
```

### Common Issues
- **Terminal not loading**: Check browser console for WebSocket errors
- **Gemini auth errors**: Verify GEMINI_API_KEY is set correctly
- **Container connectivity**: Ensure Docker daemon is running
- **Build failures**: Use `--no-cache` flag for clean builds

## Development Workflow

### Adding New Features
1. **Agent modifications**: Edit TypeScript files in `agents/src/`
2. **Monitor updates**: Modify React components in `monitor/src/`  
3. **Rebuild and test**: `docker-compose -f docker-compose.local.yml up --build`
4. **Access terminals**: Use web interface for interactive testing

### Debugging Agents
1. **Web terminal**: Click Terminal tab in monitor dashboard
2. **Interactive debugging**: Use `gc` for AI assistance with debugging
3. **File inspection**: Create and edit files directly in terminals
4. **Log analysis**: Switch between Terminal and Logs tabs

The AI Flock system now provides a complete development and monitoring environment with full terminal access, making it easy to develop, test, and debug distributed AI agent systems.