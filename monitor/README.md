# AI Flock Monitor

A Next.js-based web dashboard for monitoring and managing AI Flock agents with real-time logs, container statistics, and **full terminal access** to each agent container.

## Features

### 🖥️ Web-Based Terminals
- **Full xterm.js terminal** for each agent container
- **Real PTY support** using node-pty for proper terminal emulation
- **Interactive shells** with bash completion, colors, and keyboard shortcuts
- **Direct container access** - equivalent to `docker exec -it agent-1 /bin/bash`

### 📊 Real-Time Monitoring
- **Live container logs** with timestamps and error highlighting
- **Container statistics** - CPU, memory, network I/O
- **Tabbed interface** - switch between Logs and Terminal views
- **Container management** - restart containers with one click

### 🤖 Gemini Integration
- **Pre-configured Gemini CLI** in each agent terminal
- **Interactive AI chat** - type `gc` for Gemini sessions
- **Quick prompts** - use `gp "question"` for one-off queries
- **Persistent configuration** with API key management

## Architecture

### Frontend (Next.js)
- **React components** with TypeScript for type safety
- **Socket.IO client** for real-time WebSocket communication
- **xterm.js** for professional terminal emulation
- **Tailwind CSS** for responsive design

### Backend (Custom Server)
- **Node.js with TypeScript** custom server replacing Next.js default
- **Socket.IO server** for WebSocket communication
- **node-pty integration** for real pseudo-terminal allocation
- **Docker API access** via Docker socket for container management

### Container Integration
- **Docker socket mount** - `/var/run/docker.sock:/var/run/docker.sock:ro`
- **Root privileges** for Docker daemon access
- **WebSocket proxying** to agent containers
- **Real-time log streaming** from Docker containers

## Getting Started

### Prerequisites
- Docker Desktop with running AI Flock agents
- Node.js 18+ for development
- Agent containers: `agent-1`, `agent-2`, `agent-3`, `nats`

### Development Mode
```bash
# Install dependencies
npm install

# Start development server (requires running agents)
npm run dev

# Open browser
open http://localhost:3000
```

### Production Mode
```bash
# Build and start with Docker (recommended)
docker-compose up --build

# Or build manually
npm run build
npm start
```

### Full System Start
```bash
# Start everything (agents + monitor + NATS)
docker-compose -f ../docker-compose.local.yml up --build
```

## Project Structure

```
monitor/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── layout.tsx         # Root layout with global styles
│   │   ├── page.tsx           # Main dashboard page
│   │   └── api/
│   │       └── socket/
│   │           └── route.ts   # API route (unused - using custom server)
│   ├── components/
│   │   ├── ContainerWindow.tsx # Agent container UI with logs/terminal tabs
│   │   └── Terminal.tsx       # xterm.js terminal component
│   └── types/
│       └── monitor.ts         # TypeScript interfaces
├── server.ts                   # Custom server with Socket.IO + node-pty
├── Dockerfile                  # Debian-based build for native modules
├── package.json               # Dependencies: Next.js, Socket.IO, xterm.js, node-pty
└── tailwind.config.js         # Tailwind CSS configuration
```

## Components

### ContainerWindow.tsx
Main component for each agent, featuring:
- **Tabbed interface** (Logs/Terminal)
- **Real-time log display** with syntax highlighting
- **Container statistics** (CPU, memory, I/O)
- **Command execution** with inline results
- **Restart functionality** for container management

### Terminal.tsx
xterm.js integration providing:
- **Full terminal emulation** with color support
- **Keyboard shortcuts** and copy/paste
- **Window resizing** with automatic fitting
- **WebSocket communication** to backend PTY
- **Connection management** with automatic cleanup

### Custom Server (server.ts)
Node.js server handling:
- **Next.js integration** for serving React app
- **Socket.IO WebSocket** server for real-time communication
- **node-pty management** for terminal sessions
- **Docker container interaction** via spawn processes
- **Log streaming** from Docker containers

## API & Communication

### WebSocket Events (Socket.IO)

#### Terminal Events
```typescript
// Client -> Server
'terminal-start' { container: string }
'terminal-input' { container: string, data: string }
'terminal-resize' { container: string, cols: number, rows: number }
'terminal-stop' { container: string }

// Server -> Client
'terminal-output' { container: string, data: string }
'terminal-exit' { container: string }
```

#### Container Management
```typescript
// Client -> Server
'restart-container' { containerName: string }
'execute-command' { command: string, target: string, timestamp: string }

// Server -> Client
'container-restarted' { container: string, success: boolean }
'command-result' { command: string, target: string, output: string, ... }
```

#### Monitoring Events
```typescript
// Server -> Client (automatic)
'log' { container: string, data: string, timestamp: string, isError: boolean }
'stats' { ContainerStat[] } // Every 2 seconds
'error' { container: string, message: string }
```

## Terminal Features

### Interactive Capabilities
Each terminal provides full shell access:
- **bash shell** with completion and history
- **File system access** - create, edit, delete files
- **Process management** - run background processes
- **Network access** - connect to NATS and external services

### Gemini CLI Integration
Pre-configured in each agent:
```bash
gc              # Interactive Gemini chat
gp "question"   # Quick prompt
gemini --help   # Full CLI help
```

### Development Tools
Available in terminals:
- **Text editors**: `nano`, `vim`
- **File operations**: `touch`, `mkdir`, `ls`, `cat`
- **Process control**: `ps`, `top`, `kill`
- **Network tools**: `curl`, `ping` (to allowed destinations)

## Configuration

### Environment Variables
```bash
NODE_ENV=production           # Production mode
NEXT_TELEMETRY_DISABLED=1    # Disable Next.js telemetry
PORT=3000                    # Server port
HOSTNAME=0.0.0.0            # Bind address
```

### Docker Configuration
The monitor container requires:
- **Docker socket access**: `/var/run/docker.sock:/var/run/docker.sock:ro`
- **Root user**: `user: "0:0"` for Docker daemon access
- **Network access**: Same Docker network as agents

### Security Considerations
- **Development only**: No authentication implemented
- **Local network binding**: Only accessible on localhost
- **Docker socket access**: Full Docker daemon privileges
- **PTY isolation**: Each terminal session is isolated

## Development

### Hot Reload Development
```bash
# Start with hot reload (requires external agents)
npm run dev

# Watch for file changes
npm run type-check -- --watch
```

### Building
```bash
# TypeScript compilation
npm run build

# Docker build
docker build -t ai-flock-monitor .

# Clean build (no cache)
docker build --no-cache -t ai-flock-monitor .
```

### Debugging
```bash
# Check server logs
docker logs monitor

# Test WebSocket connection
curl -I http://localhost:3000

# Verify Docker access
docker exec monitor docker ps

# Check node-pty
docker exec monitor node -e "console.log(require('node-pty'))"
```

## Native Dependencies

### node-pty
Required for proper terminal emulation:
- **Platform-specific binaries** for PTY allocation
- **Compilation requirements**: Python3, make, g++
- **Debian base image** for better compatibility

### xterm.js Addons
- **FitAddon**: Automatic terminal resizing
- **WebLinksAddon**: Clickable links in terminal output
- **Color themes**: Professional terminal appearance

## Troubleshooting

### Common Issues

**Terminal not connecting**
```bash
# Check WebSocket in browser console
# Verify container is running
docker ps | grep monitor

# Check server logs
docker logs monitor
```

**Build failures**
```bash
# Clean build with no cache
docker build --no-cache .

# Check native module compilation
npm rebuild
```

**Docker socket access denied**
```bash
# Verify socket mount in docker-compose
volumes:
  - /var/run/docker.sock:/var/run/docker.sock:ro

# Check user permissions
user: "0:0"  # Must run as root
```

### Performance Optimization

**Memory usage**
- Each terminal session uses ~10-20MB
- Limit concurrent terminal sessions
- Clean up unused PTY processes

**WebSocket connections**
- Monitor active connections
- Implement connection limits if needed
- Use connection pooling for high load

## Deployment

### Local Development
```bash
# Full system
docker-compose -f docker-compose.local.yml up --build

# Monitor only
docker-compose up --build
```

### Production Considerations
- **Authentication**: Add authentication for production use
- **SSL/TLS**: Use HTTPS in production
- **Rate limiting**: Implement WebSocket rate limits
- **Monitoring**: Add application monitoring and logging

The AI Flock Monitor provides a complete web-based interface for managing and interacting with containerized AI agents, offering both monitoring capabilities and full terminal access for development and debugging.