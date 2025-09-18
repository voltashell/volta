# AI Flock Agents

TypeScript-based containerized AI agents with Gemini CLI integration, interactive shell support, and NATS messaging for distributed task processing.

## Features

### 🤖 AI Integration
- **Gemini CLI** pre-installed and configured in each container
- **Interactive chat sessions** via `gc` command
- **Quick prompts** using `gp "your question"`
- **Persistent API key configuration** stored in shared volumes

### 🖥️ Interactive Shell Environment  
- **Full bash shell** with command history and completion
- **Writable home directory** at `/home`
- **Screen session support** for background processes
- **Development tools**: nano, vim, curl, git

### 📡 Distributed Communication
- **NATS messaging** for task coordination
- **TypeScript interfaces** for type-safe messaging
- **Heartbeat monitoring** with 30-second intervals
- **Result publishing** with structured responses

### 🔒 Security & Isolation
- **Container isolation** with resource limits
- **Non-root execution** with dedicated user account
- **Network restrictions** - only NATS access allowed
- **TTY support** for interactive web terminals

## Architecture

### Container Structure
```
Agent Container:
├── /app/                    # Application code
│   ├── dist/               # Compiled TypeScript
│   └── node_modules/       # Dependencies
├── /home/agent/            # User home (writable)
│   ├── workspace/          # Development workspace  
│   └── .bashrc            # Shell configuration
├── /shared/agents/{id}/    # Persistent storage
│   └── .gemini/.env       # Gemini configuration
└── /usr/local/bin/        # Helper scripts
    ├── gc                 # Gemini chat wrapper
    └── gemini-shell       # Interactive Gemini
```

### TypeScript Components
- **index.ts** - Main agent logic with NATS integration
- **gemini.ts** - Gemini API client and chat handling
- **types.ts** - Shared type definitions
- **utils.ts** - Common utilities and helpers

## Getting Started

### Prerequisites
- Docker Desktop
- GEMINI_API_KEY environment variable
- NATS server (included in docker-compose)

### Build and Run
```bash
# Build agent image
docker build -t ai-agent .

# Run with docker-compose (recommended)
docker-compose -f ../docker-compose.local.yml up --build

# Run individual agent (manual)
docker run -d \
  --name agent-1 \
  -e AGENT_ID=agent-1 \
  -e NATS_URL=nats://nats:4222 \
  -e GEMINI_API_KEY=$GEMINI_API_KEY \
  -v $(pwd)/../shared:/shared \
  --network ai-flock_bus \
  ai-agent
```

### Interactive Usage
```bash
# Access agent shell (via web terminal or docker exec)
docker exec -it agent-1 /bin/bash

# Quick commands once inside:
gc                    # Start interactive Gemini chat
gp "Hello Gemini"     # Quick prompt
touch test.txt        # Create files
ls -la               # List files
```

## Development

### TypeScript Development
```bash
# Install dependencies
npm install

# Compile TypeScript
npm run build

# Type checking
npm run type-check

# Development mode
npm run dev
```

### Project Structure
```
agents/
├── src/
│   ├── index.ts           # Main agent entry point
│   ├── gemini.ts          # Gemini API integration  
│   ├── types.ts           # Type definitions
│   └── utils.ts           # Utility functions
├── scripts/               # Shell helper scripts
│   └── setup-env.sh       # Environment setup
├── Dockerfile             # Multi-stage container build
├── tsconfig.json          # TypeScript configuration
└── package.json           # Dependencies and scripts
```

## Agent Implementation

### Core Agent Logic (index.ts)
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
  result: string;
  timestamp: string;
  error?: string;
}
```

### NATS Message Handling
- **Subscribes to**: `tasks.*`, `agent.{id}.events`, `broadcast`
- **Publishes to**: `task.result`, `agent.{id}.heartbeat`
- **Connection management**: Automatic reconnection with retry logic
- **Error handling**: Comprehensive error catching and reporting

### Gemini Integration (gemini.ts)
```typescript
class GeminiService {
  // Initialize with API key and model
  async generateResponse(prompt: string): Promise<string>
  
  // Stream responses for interactive chat
  async streamResponse(prompt: string): AsyncIterable<string>
  
  // Handle conversation context
  async continueConversation(messages: Message[]): Promise<string>
}
```

## Configuration

### Environment Variables
```bash
# Required
AGENT_ID=agent-1              # Unique agent identifier
NATS_URL=nats://nats:4222     # NATS broker connection
GEMINI_API_KEY=your_api_key   # Gemini API authentication

# Optional  
GEMINI_MODEL=gemini-2.5-pro # AI model to use
SHARED_DIR=/shared            # Shared storage mount
LOG_LEVEL=info               # Logging verbosity
```

### Persistent Configuration
Each agent maintains configuration in:
```bash
/shared/agents/{AGENT_ID}/.gemini/.env
```

Contents:
```bash
GEMINI_API_KEY=your_api_key_here
GEMINI_MODEL=gemini-2.5-pro
```

### Shell Environment
The `.bashrc` provides:
- **Environment variables** automatically loaded
- **Custom aliases**: `gc`, `gp` for Gemini access
- **Colored prompt** showing agent ID
- **Working directory** defaults to `/home`

## Interactive Commands

### Gemini CLI Commands
```bash
# Interactive chat (recommended)
gc

# Quick one-off prompts  
gp "Explain Docker containers"
gp "Write a Python function to reverse a string"

# Direct Gemini CLI usage
gemini -p "Your prompt here"
gemini models list
gemini --help

# Background screen session
screen -S gemini-session gemini chat
screen -r gemini-session  # Reattach
```

### File System Operations
```bash
# Agent home directory (writable)
cd /home
touch hello.txt
echo "Hello World" > hello.txt
cat hello.txt

# Shared storage (persistent)
cd /shared/agents/$AGENT_ID
ls -la
mkdir my-project
```

### Development Tools
```bash
# Text editors
nano file.txt
vim file.txt

# Process management
ps aux
screen -ls
kill <pid>

# Network testing
curl http://httpbin.org/get
ping nats  # Should work
ping agent-2  # Should fail (isolated)
```

## Container Features

### Base Image & Tools
- **Alpine Linux** with bash shell
- **Node.js 20** for TypeScript runtime  
- **Gemini CLI** installed globally
- **Development tools**: curl, git, nano, screen
- **TTY support** for interactive sessions

### Security Configuration
- **Non-root user**: Runs as `agent` user (UID 1001-1003)
- **Resource limits**: CPU (0.5), Memory (512MB), PIDs (50)  
- **Network isolation**: Custom bridge network for NATS only
- **File system**: Writable home directory + shared volumes
- **Privilege dropping**: No additional Linux capabilities

### Multi-Stage Build
1. **Builder stage**: Compiles TypeScript to JavaScript
2. **Runtime stage**: Minimal production image with compiled code
3. **Script installation**: Copies helper scripts to `/usr/local/bin/`
4. **User setup**: Creates agent user with proper permissions

## NATS Integration

### Message Topics
```bash
# Task distribution (subscribed)
tasks.process         # General task processing
tasks.analyze        # Analysis tasks  
tasks.generate       # Content generation

# Agent communication (subscribed)
agent.agent-1.events # Agent-specific events
broadcast           # System-wide announcements

# Result publishing (published)
task.result         # Task completion results
agent.agent-1.heartbeat  # Health monitoring
```

### Connection Management
- **Automatic reconnection** with exponential backoff
- **Connection monitoring** with health checks
- **Graceful shutdown** handling with cleanup
- **Error recovery** with retry logic

## Troubleshooting

### Common Issues

**Agent won't start**
```bash
# Check container logs
docker logs agent-1

# Verify NATS connection
docker exec agent-1 nc -z nats 4222

# Check environment
docker exec agent-1 env | grep AGENT
```

**Gemini CLI issues**
```bash
# Test API key
docker exec agent-1 gemini models list

# Check configuration
docker exec agent-1 cat /shared/agents/agent-1/.gemini/.env

# Interactive test
docker exec -it agent-1 gc
```

**Terminal access problems**
```bash
# Direct shell access
docker exec -it agent-1 /bin/bash

# Check TTY allocation
docker exec agent-1 tty

# Verify screen sessions
docker exec agent-1 screen -ls
```

### Development Debugging
```bash
# TypeScript compilation
npm run build

# Watch mode for development
npm run dev

# Type checking
npm run type-check

# Docker build debugging
docker build --progress=plain .
```

## Scaling & Deployment

### Horizontal Scaling
```bash
# Scale specific agent type
docker-compose -f ../docker-compose.local.yml up -d --scale agent-1=3

# Custom agent types
# Modify docker-compose to add agent-4, agent-5, etc.
```

### Production Considerations
- **Resource monitoring**: Watch CPU/memory usage per agent
- **Log aggregation**: Centralize logs for analysis
- **Health monitoring**: Implement proper health checks
- **Secret management**: Secure API key distribution
- **Network policies**: Implement stricter network rules

### Load Testing
```bash
# Test NATS throughput
npm run test:nats

# Benchmark Gemini API calls
npm run test:gemini

# Container resource monitoring
docker stats agent-1 agent-2 agent-3
```

The AI Flock agents provide a robust foundation for distributed AI processing with full interactive capabilities, making development and debugging straightforward through web-based terminals and comprehensive logging.