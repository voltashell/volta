# AI Flock Agent Specifications

This document outlines the permission model and NATS messaging capabilities for agents in the AI Flock system.

## Agent Permission Model

### Environment-Based Configuration
Agent permissions are determined through environment variables in `agents/src/index.ts`:

- **`AGENT_ID`**: Unique identifier determining agent identity
- **`NATS_URL`**: Controls which message bus the agent can connect to
- **`SHARED_DIR`**: Defines the shared directory path (`/shared` by default)
- **`GEMINI_API_KEY`**: Optional - enables AI processing capabilities
- **`GEMINI_MODEL`**: Specifies which AI model to use

### Container-Level Isolation
The primary permission enforcement happens through Docker container isolation:

**Security Features** (from `plan.md` and AWS deployment):
- **Read-only root filesystem**: `read_only: true`
- **Dropped capabilities**: `cap_drop: [ALL]`
- **No new privileges**: `security_opt: [no-new-privileges:true]`
- **Resource limits**: CPU, memory, and PID limits
- **Network isolation**: Agents can only communicate via NATS message bus

### File System Permissions
Agents have access to:
- **Agent-specific directory**: `/shared/agents/<agent-id>/`
- **Common shared directory**: `/shared/common/`
- **Write access**: Can write task results and logs to their own directory
- **Read access**: Can read from shared areas but isolated from other agents' private data

### Message Bus Permissions
Through NATS subscriptions in `setupSubscriptions()`:
- **Task processing**: Subscribe to `tasks.*` (all agents can receive tasks)
- **Agent-specific events**: Subscribe to `agent.<id>.events` (only for their own ID)
- **Broadcast messages**: Subscribe to `broadcast` (system-wide announcements)

## Key Findings

1. **No explicit permission system** - relies on container isolation and environment configuration
2. **Least privilege principle** - agents run with minimal capabilities and read-only filesystems  
3. **Network isolation** - agents can only communicate through the controlled NATS message bus
4. **File system isolation** - each agent has its own directory within the shared space
5. **Optional AI capabilities** - Gemini integration is permission-gated by API key presence

The system prioritizes **isolation over explicit permissions**, using container security features to prevent unauthorized access rather than implementing application-level permission checks.

## NATS System Capabilities

The NATS message bus enables agents to perform several key operations through a publish-subscribe messaging pattern:

### Message Subscriptions (What Agents Listen For)

#### 1. Task Processing - `tasks.*`
- **Purpose**: Receive work assignments from external systems
- **Handler**: `processTask()` function
- **Capabilities**:
  - Process any task type (`gemini`, `ai`, or generic tasks)
  - Use Gemini AI if API key is available and task type matches
  - Write results to agent's shared directory
  - Track processing statistics

#### 2. Agent-Specific Events - `agent.<id>.events`
- **Purpose**: Receive commands targeted at specific agents
- **Handler**: `handleAgentEvent()` function
- **Event Types**:
  - **`config_update`**: Receive configuration changes
  - **`status_request`**: Respond with current agent status
  - **`restart`**: Gracefully restart the agent process

#### 3. Broadcast Messages - `broadcast`
- **Purpose**: Receive system-wide announcements
- **Handler**: `handleBroadcast()` function
- **Broadcast Types**:
  - **`shutdown`**: Gracefully terminate the agent
  - **`announcement`**: Log system-wide messages
  - **Custom broadcasts**: Handle other system notifications

### Message Publishing (What Agents Send)

#### 1. Task Results - `task.result`
- **Purpose**: Report task completion status and results
- **Data**: `TaskResult` with status, processing time, and output
- **Triggers**: After processing any task from `tasks.*`

#### 2. Heartbeats - `agent.<id>.heartbeat`
- **Purpose**: Indicate agent health and status
- **Frequency**: Every 30 seconds (configurable via `HEARTBEAT_INTERVAL`)
- **Data**: Agent ID, status (`alive`/`stopping`), uptime, tasks processed
- **Special Cases**: Final heartbeat sent during shutdown

## Key Capabilities Enabled

1. **Distributed Task Processing**: Agents can receive and process work from a shared queue
2. **Health Monitoring**: System can track which agents are alive and responsive
3. **Remote Control**: Individual agents can be restarted or reconfigured remotely
4. **System Coordination**: Broadcast messages enable coordinated shutdowns or announcements
5. **Result Aggregation**: Task results are published to a central channel for collection
6. **Load Balancing**: Multiple agents can subscribe to the same task queue for parallel processing

## Communication Patterns

- **Fan-out**: Tasks broadcast to all agents via `tasks.*`
- **Point-to-point**: Agent-specific events via `agent.<id>.events`
- **Fan-in**: All agents publish results to `task.result`
- **Broadcast**: System-wide messages via `broadcast`

The NATS system essentially creates a **distributed, event-driven architecture** where agents can work independently while remaining coordinated through the message bus.

## Message Types and Data Structures

### Task
```typescript
interface Task {
  id: string;
  type: string;
  data: any;
  timestamp?: string;
  priority?: 'low' | 'normal' | 'high';
  timeout?: number;
}
```

### TaskResult
```typescript
interface TaskResult {
  agentId: string;
  taskId: string;
  status: 'completed' | 'failed' | 'processing';
  timestamp: string;
  result: string;
  error?: string;
  processingTime?: number;
}
```

### AgentEvent
```typescript
interface AgentEvent {
  type: 'config_update' | 'status_request' | 'restart' | 'custom';
  data: any;
  timestamp: string;
  source?: string;
}
```

### Heartbeat
```typescript
interface Heartbeat {
  agentId: string;
  status: 'alive' | 'stopping' | 'restarting';
  timestamp: string;
  uptime?: number;
  tasksProcessed?: number;
}
```

### BroadcastMessage
```typescript
interface BroadcastMessage {
  type: 'shutdown' | 'announcement' | 'config' | 'custom';
  message: string;
  timestamp: string;
  source?: string;
  priority?: 'low' | 'normal' | 'high';
}
```
