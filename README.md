# Volta Shell

<div align="center">

![Volta Shell Logo](https://img.shields.io/badge/Volta-Shell-blue?style=for-the-badge)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![Docker](https://img.shields.io/badge/Docker-Required-blue?logo=docker)](https://www.docker.com/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green?logo=node.js)](https://nodejs.org/)

**A distributed system of AI agents running in isolated Docker containers with web-based terminals and real-time monitoring**

[Quick Start](#quick-start) • [Documentation](#documentation) • [Contributing](#contributing) • [Architecture](#architecture)

</div>

## 🚀 What is Volta Shell?

Volta Shell is a containerized multi-agent AI system that provides:

- **🤖 Multiple AI Agents**: 3 isolated agents with Gemini CLI integration
- **🖥️ Web-Based Terminals**: Full terminal access to each agent via browser
- **📡 NATS Messaging**: Distributed communication between agents
- **📊 Real-Time Monitoring**: Live logs, metrics, and container statistics
- **🔒 Security Hardened**: Container isolation with resource limits
- **📁 Shared Storage**: Collaborative workspace between agents

Perfect for AI research, distributed computing experiments, and multi-agent workflows.

## ✨ Key Features

### 🖥️ **Web-Based Agent Terminals**
- Full terminal access in browser using xterm.js
- Interactive shells with TTY support
- Direct Gemini CLI integration (`gc` for chat, `gp` for quick prompts)
- Real-time terminal emulation with colors and keyboard support

### 📊 **Advanced Monitoring**
- Tabbed interface (Logs + Terminal views)
- Real-time container statistics (CPU, memory, network)
- Socket.IO live updates
- Container management (restart, scale)

### 🔧 **Developer Experience**
- Mount external repositories for AI-assisted coding
- Hot-reload development mode
- TypeScript throughout
- Comprehensive logging and debugging tools

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

## 🚀 Quick Start

### Prerequisites

- **Docker Desktop** (required)
- **Node.js 18+** (for development)
- **Gemini API Key** ([Get one here](https://makersuite.google.com/app/apikey))

### 1. Clone & Setup

```bash
git clone https://github.com/your-username/volta-shell.git
cd volta-shell

# Copy environment template
cp .env.example .env

# Edit .env and add your Gemini API key
GEMINI_API_KEY="your_api_key_here"
```

### 2. Start the System

```bash
# Start all services (NATS + 3 agents + monitor)
npm run volta:up

# Or use Docker Compose directly
docker-compose -f docker-compose.local.yml up --build
```

### 3. Access the Dashboard

Open [http://localhost:4000](http://localhost:4000) in your browser

- **Logs Tab**: View real-time container logs
- **Terminal Tab**: Interactive shell access to each agent
- **Stats**: Live CPU, memory, and network metrics


### 🔧 Development Mode

```bash
# Start with hot-reload for monitor
npm run volta:monitor:dev

# Build agents in watch mode
cd agents && npm run dev
```

### 🔧 Advanced Configuration

<details>
<summary><strong>Custom Repository Mounting</strong></summary>

Mount external codebases for AI-assisted development:

```bash
# In .env file
CUSTOM_REPO_PATH=~/my-project

# Repository will be available at /shared/workspace in all agents
```
</details>

<details>
<summary><strong>Auth0 Authentication (Optional)</strong></summary>

For production deployments with user authentication:

```bash
# In .env file
AUTH0_DOMAIN="your-domain.auth0.com"
AUTH0_CLIENT_ID="your_client_id"
AUTH0_CALLBACK_URL="http://localhost:4000"
```
</details>

<details>
<summary><strong>Electron App (Experimental)</strong></summary>

Run the dashboard as a desktop application:

```bash
npm run electron:dev      # Development
npm run electron:build    # Build distributable
```
</details>

## 📁 Project Structure

```
volta-shell/
├── 📊 monitor/                 # Web monitoring dashboard
│   ├── src/
│   │   ├── app/               # Next.js 14 app router
│   │   │   ├── page.tsx       # Main dashboard
│   │   │   └── layout.tsx     # App layout
│   │   ├── components/        # React components
│   │   │   ├── ContainerWindow.tsx  # Agent log/terminal tabs
│   │   │   └── Terminal.tsx         # xterm.js terminal component
│   │   └── types/             # TypeScript interfaces
│   ├── server.ts              # Custom server (Socket.IO + node-pty)
│   ├── Dockerfile             # Production-ready container
│   └── package.json           # Dependencies & scripts
│
├── 🤖 agents/                  # AI agent implementation
│   ├── src/
│   │   ├── index.ts           # Main agent logic + NATS
│   │   ├── gemini.ts          # Gemini API integration
│   │   ├── types.ts           # Shared type definitions
│   │   └── utils.ts           # Helper functions
│   ├── scripts/               # Shell helper scripts
│   │   ├── setup-env.sh       # Environment setup
│   │   └── setup-permissions.sh # Security configuration
│   ├── Dockerfile             # Multi-stage build (Alpine + Node.js)
│   ├── package.json           # Agent dependencies
│   └── tsconfig.json          # TypeScript configuration
│
├── 📁 shared/                  # Persistent storage (auto-created)
│   ├── agents/                # Per-agent directories
│   │   ├── agent-1/           # Agent 1 workspace
│   │   ├── agent-2/           # Agent 2 workspace
│   │   └── agent-3/           # Agent 3 workspace
│   ├── common/                # Shared files between agents
│   └── logs/                  # Centralized logging
│
├── 🐳 docker-compose.local.yml # Full system orchestration
├── 🐳 docker-compose.yml       # Monitor-only deployment
├── 📜 scripts/                 # Management utilities
│   └── clear-shared.sh        # Clean shared directories
├── 🔧 .env.example            # Environment template
├── 📦 package.json            # Root project scripts
└── 📖 README.md               # This file
```

### Key Files to Understand

| File | Purpose |
|------|---------|
| `package.json` | Root npm scripts (`volta:*` commands) |
| `docker-compose.local.yml` | Complete system definition |
| `agents/src/index.ts` | Main agent logic and NATS integration |
| `monitor/src/app/page.tsx` | Web dashboard UI |
| `monitor/server.ts` | WebSocket server for terminals |
| `.env.example` | Configuration template |

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

## 📋 Available Commands

### System Management
```bash
# 🚀 Start everything (monitor + agents + NATS)
npm run volta:up

# 🛑 Stop all services
npm run volta:down

# 🔄 Restart with clean state
npm run volta:restart

# 📊 View logs for all containers
npm run volta:logs

# 📈 Check container status
npm run volta:status

# 🧹 Clean shared storage
npm run volta:clear-shared
```

### Individual Container Management
```bash
# 📋 View individual agent logs
npm run volta:logs:agent1
npm run volta:logs:agent2
npm run volta:logs:agent3

# 🖥️ Open terminal sessions
npm run volta:shell:agent1
npm run volta:shell:agent2
npm run volta:shell:agent3

# 🚀 Open all terminals at once
npm run volta:bash:all
```

### Development & Monitoring
```bash
# 🔧 Monitor development (hot reload)
npm run volta:monitor:dev

# 📱 Open monitor dashboard
npm run volta:monitor

# 📊 Live CLI monitoring
npm run volta:cli-monitor

# 📈 Container statistics
npm run volta:stats
```

### Scaling & Advanced
```bash
# 📈 Scale agents
npm run volta:scale

# 🔄 Reset everything (nuclear option)
npm run volta:reset

# 📁 View shared directories
npm run volta:shared
```

## 🤖 Agent Capabilities

Each agent provides a full interactive environment:

- **🖥️ Full bash shell** with command history and completion
- **📁 File system access** - create and edit files in `/home` and `/shared`
- **🤖 Gemini AI integration** - interactive chat (`gc`) and quick prompts (`gp`)
- **📺 Screen sessions** for background processes
- **📡 NATS messaging** for inter-agent communication

### Gemini CLI Commands

```bash
# Interactive chat session
gc

# Quick one-off prompt  
gp "Explain quantum computing"

# Check available models
gemini models list

# Direct Gemini command
gemini -p "Write a Python function to sort a list"
```

## Security

Volta Shell implements multiple layers of security:

### Container Isolation
- **Non-root execution**: Agents run as unprivileged user `agent`
- **Resource limits**: CPU, memory, and PID constraints
- **Network isolation**: Agents can only communicate with NATS
- **Filesystem restrictions**: Limited write access to designated areas

### Directory Permissions
- `/home`: Full read-write access for agent workspace
- `/shared`: Read-write access for inter-agent communication
- `/app`: No access (application code protected)
- `/tmp`, `/run`: No access (system directories protected)

### API Key Management
- Environment variables for secure key storage
- Per-agent configuration isolation
- No hardcoded credentials in containers

## 🤝 Contributing

We welcome contributions! Here's how to get started:

### Development Setup

1. **Fork & Clone**
   ```bash
   git clone https://github.com/your-username/volta-shell.git
   cd volta-shell
   ```

2. **Install Dependencies**
   ```bash
   # Root dependencies
   npm install
   
   # Agent dependencies
   cd agents && npm install
   
   # Monitor dependencies
   cd ../monitor && npm install
   ```

3. **Start Development Environment**
   ```bash
   # Terminal 1: Start agents and NATS
   npm run volta:up
   
   # Terminal 2: Start monitor in dev mode
   npm run volta:monitor:dev
   ```

### Making Changes

- **Agents**: Edit TypeScript files in `agents/src/`
- **Monitor**: Edit React components in `monitor/src/`
- **Documentation**: Update README.md or add to `docs/`

### Testing

```bash
# Type checking
cd agents && npm run type-check
cd monitor && npm run type-check

# Build everything
npm run agents:build
cd monitor && npm run build
```

### Pull Request Process

1. Create a feature branch: `git checkout -b feature/amazing-feature`
2. Make your changes and test thoroughly
3. Update documentation if needed
4. Submit a pull request with a clear description

### Areas We Need Help With

- 🐛 **Bug fixes** - Check [Issues](https://github.com/your-username/volta-shell/issues)
- 📚 **Documentation** - Improve guides and examples
- 🧪 **Testing** - Add unit and integration tests
- 🎨 **UI/UX** - Enhance the web dashboard
- 🔒 **Security** - Review and improve container security
- 🚀 **Performance** - Optimize agent communication and resource usage

## 📚 Documentation

- [Architecture Overview](./NATS_ARCHITECTURE.md) - Deep dive into NATS messaging
- [Agent Development](./agents/README.md) - Building and customizing agents
- [Security Model](./docs/SECURITY.md) - Container isolation details
- [API Reference](./docs/API.md) - NATS topics and message formats

## 🐛 Troubleshooting

### Common Issues

<details>
<summary><strong>🔧 Container won't start</strong></summary>

```bash
# Check container logs
npm run volta:logs

# Restart specific container
docker-compose -f docker-compose.local.yml restart agent-1

# Nuclear option - rebuild everything
npm run volta:reset
```
</details>

<details>
<summary><strong>🖥️ Terminal not working</strong></summary>

This is usually a `node-pty` native module issue:

```bash
# Force rebuild containers
docker-compose -f docker-compose.local.yml down
docker system prune -f
npm run volta:up
```
</details>

<details>
<summary><strong>🔑 Gemini API errors</strong></summary>

```bash
# Check API key is set
echo $GEMINI_API_KEY

# Test API key in agent
npm run volta:shell:agent1
# Then in agent terminal:
gemini models list
```
</details>

## 🎯 Use Cases

- **🔬 AI Research**: Multi-agent experiments and coordination
- **💻 Development**: AI-assisted coding with multiple agents
- **🎓 Education**: Learning distributed systems and containerization
- **🧪 Prototyping**: Testing multi-agent workflows
- **📊 Monitoring**: Real-time system observation and debugging

## 🏗️ Roadmap

- [ ] **Claude Integration** - Add Claude API support alongside Gemini
- [ ] **Agent Templates** - Pre-configured agent types for specific tasks
- [ ] **Plugin System** - Extensible agent capabilities
- [ ] **Kubernetes Support** - Deploy to K8s clusters
- [ ] **Web IDE** - Built-in code editor in the dashboard
- [ ] **Agent Marketplace** - Share and discover agent configurations

## 📄 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [NATS](https://nats.io/) - Fantastic messaging system
- [xterm.js](https://xtermjs.org/) - Web-based terminal emulation
- [Next.js](https://nextjs.org/) - React framework for the dashboard
- [Docker](https://docker.com/) - Containerization platform

---

<div align="center">

**⭐ Star this repo if you find it useful! ⭐**

[Report Bug](https://github.com/your-username/volta-shell/issues) • [Request Feature](https://github.com/your-username/volta-shell/issues) • [Discussions](https://github.com/your-username/volta-shell/discussions)

</div>
