# NATS and MCP Communication Guide for AI Flock

## Overview

This guide explains how to effectively use NATS and MCP (Model Context Protocol) for agent communication in the AI Flock distributed agent system. The architecture uses a hybrid approach combining both protocols for optimal performance and functionality.

## Architecture Components

### NATS Message Bus
- **Purpose**: High-performance, low-latency messaging
- **Use Cases**: Task distribution, heartbeats, system events, broadcasts
- **Connection**: `nats://nats:4222`

### MCP Server
- **Purpose**: Structured agent-to-agent communication
- **Use Cases**: Service discovery, capability requests, direct messaging
- **Port**: WebSocket on port 4002

## Communication Patterns

### NATS Patterns

#### 1. Task Distribution
```typescript
// Agents subscribe to task queues
const taskSub = nc.subscribe('tasks.*');

// Publish tasks to be processed
nc.publish('tasks.general', sc.encode(JSON.stringify({
  id: 'task-123',
  type: 'claude',
  data: 'Process this text',
  priority: 'high'
})));
```

#### 2. Agent Discovery & Heartbeats
```typescript
// Agent announces itself on startup
nc.publish('agent.announce', sc.encode(JSON.stringify({
  id: 'agent-1',
  name: 'agent-1',
  capabilities: ['claude-ai', 'text-processing'],
  timestamp: new Date().toISOString()
})));

// Regular heartbeats (every 30 seconds)
const heartbeat = {
  agentId: 'agent-1',
  status: 'alive',
  timestamp: new Date().toISOString(),
  uptime: Date.now() - startTime,
  tasksProcessed: stats.tasksProcessed
};
nc.publish(`agent.${agentId}.heartbeat`, sc.encode(JSON.stringify(heartbeat)));
```

#### 3. System Events & Broadcasts
```typescript
// Agent-specific events
nc.publish(`agent.${agentId}.events`, sc.encode(JSON.stringify({
  type: 'config_update',
  data: newConfig
})));

// System-wide broadcasts
nc.publish('broadcast', sc.encode(JSON.stringify({
  type: 'announcement',
  message: 'System maintenance in 5 minutes'
})));
```

### MCP Patterns

#### 1. Direct Agent Messaging
```typescript
// Send targeted messages between agents
await mcpClient.sendMessage('agent-2', 'Process this data', 'command', {
  priority: 'high',
  data: processData,
  timeout: 30000
});

// Send queries expecting responses
await mcpClient.sendMessage('agent-3', 'What is your current status?', 'query');
```

#### 2. Capability-Based Requests
```typescript
// Request specific capabilities from available agents
const result = await mcpClient.requestCapability('text-analysis', {
  text: 'Analyze sentiment of this text',
  useClaude: true,
  model: 'claude-3-5-sonnet-20241022'
}, 30000);

// Request Claude AI processing
const aiResult = await mcpClient.requestCapability('claude-ai', {
  prompt: 'Generate a summary of this document',
  maxTokens: 1000
});
```

#### 3. Service Discovery
```typescript
// List all available agents
const agents = await mcpClient.listAgents('online');

// Get detailed agent information
const agentInfo = await mcpClient.getAgentInfo('agent-2');

// Filter agents by capability
const claudeAgents = agents.filter(agent => 
  agent.capabilities?.includes('claude-ai')
);
```

#### 4. Message Handlers
```typescript
// Register handlers for different message types
mcpClient.registerMessageHandler('command', async (message) => {
  await log(`Received command from ${message.from}: ${message.message}`);
  // Process command and optionally send response
});

mcpClient.registerMessageHandler('query', async (message) => {
  const response = await processQuery(message.message);
  await mcpClient.sendResponse(message.from, response, message.metadata);
});
```

## Best Practices

### 1. Protocol Selection Strategy

**Use NATS for:**
- Task distribution (`tasks.*`)
- System events (`agent.*.heartbeat`, `agent.announce`)
- Broadcast notifications (`broadcast`)
- High-volume, low-latency messaging
- Fire-and-forget communications

**Use MCP for:**
- Agent-to-agent collaboration
- Service discovery and capability requests
- Structured data exchange
- Request-response patterns with timeouts
- Complex inter-agent workflows

### 2. Error Handling & Resilience

```typescript
// Implement circuit breaker pattern
async function requestWithFallback(capability: string, params: any) {
  try {
    return await mcpClient.requestCapability(capability, params, 10000);
  } catch (error) {
    // Fallback to NATS direct messaging
    return await fallbackToNATS(capability, params);
  }
}

// Graceful degradation when MCP is unavailable
if (!mcpClient) {
  await log('MCP unavailable, using NATS-only mode', agentId, sharedDir);
  // Continue with basic NATS functionality
}
```

### 3. Message Schemas

```typescript
// Define clear message schemas
interface TaskMessage {
  id: string;
  type: 'claude' | 'processing' | 'analysis';
  priority: 'low' | 'medium' | 'high';
  data: any;
  requester?: string;
  timeout?: number;
  metadata?: Record<string, any>;
}

interface CapabilityRequest {
  capability: string;
  parameters: Record<string, any>;
  requester: string;
  timeout: number;
  correlationId?: string;
}

interface AgentAnnouncement {
  id: string;
  name: string;
  capabilities: string[];
  maxConcurrentTasks?: number;
  timestamp: string;
}
```

### 4. Capability Management

```typescript
// Agents should advertise their capabilities clearly
const capabilities = [];
if (claudeService) {
  capabilities.push('claude-ai', 'text-analysis', 'code-generation');
}
if (hasFileAccess) {
  capabilities.push('file-processing');
}

await mcpClient.announceAgent({
  id: agentId,
  name: agentId,
  capabilities,
  maxConcurrentTasks: 5,
  timestamp: new Date().toISOString()
});
```

### 5. Load Balancing & Distribution

```typescript
// Implement capability-based routing
async function routeCapabilityRequest(capability: string, params: any) {
  const availableAgents = await mcpClient.listAgents('online');
  const capableAgents = availableAgents.filter(agent => 
    agent.capabilities?.includes(capability)
  );
  
  if (capableAgents.length === 0) {
    throw new Error(`No agents available with capability: ${capability}`);
  }
  
  // Select agent based on load or round-robin
  const selectedAgent = selectOptimalAgent(capableAgents);
  return await mcpClient.sendMessage(selectedAgent.id, params, 'command');
}

function selectOptimalAgent(agents: AgentInfo[]): AgentInfo {
  // Simple round-robin or implement load-based selection
  return agents[Math.floor(Math.random() * agents.length)];
}
```

### 6. Monitoring & Observability

```typescript
// Enhanced logging with correlation IDs
const correlationId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

await log(`[${correlationId}] Requesting capability: ${capability}`, agentId, sharedDir);

// Track message metrics
const messageMetrics = {
  sent: 0,
  received: 0,
  errors: 0,
  avgResponseTime: 0,
  capabilityRequests: new Map<string, number>()
};

// Update metrics on message send/receive
function updateMetrics(type: 'sent' | 'received' | 'error', responseTime?: number) {
  messageMetrics[type]++;
  if (responseTime) {
    messageMetrics.avgResponseTime = 
      (messageMetrics.avgResponseTime + responseTime) / 2;
  }
}
```

## Communication Flow Examples

### Scenario 1: AI Task Processing
```typescript
// 1. Receive task via NATS
const taskSub = nc.subscribe('tasks.ai');
for await (const msg of taskSub) {
  const task = JSON.parse(sc.decode(msg.data));
  
  // 2. Check if local Claude service is available
  if (task.requiresAI && !claudeService) {
    // 3. Use MCP to find Claude-capable agent
    const result = await mcpClient.requestCapability('claude-ai', {
      prompt: task.data,
      model: 'claude-3-5-sonnet-20241022',
      maxTokens: 2048
    });
    
    // 4. Publish result back via NATS
    nc.publish('task.result', sc.encode(JSON.stringify({
      taskId: task.id,
      result: result,
      processedBy: agentId
    })));
  }
}
```

### Scenario 2: Agent Coordination
```typescript
// Use MCP for coordination, NATS for execution
async function coordinateWorkload(workload: any[]) {
  // 1. Discover available agents
  const agents = await mcpClient.listAgents('online');
  
  // 2. Plan work distribution
  const plan = await planWorkDistribution(agents, workload);
  
  // 3. Coordinate via MCP
  for (const assignment of plan.assignments) {
    await mcpClient.sendMessage(assignment.agentId, 
      `Prepare for ${assignment.taskCount} tasks`, 'command');
  }
  
  // 4. Distribute actual work via NATS
  plan.tasks.forEach(task => {
    nc.publish(`tasks.${task.type}`, sc.encode(JSON.stringify(task)));
  });
}
```

### Scenario 3: Health Monitoring
```typescript
// Combine NATS heartbeats with MCP health checks
setInterval(async () => {
  // Send heartbeat via NATS (lightweight)
  nc.publish(`agent.${agentId}.heartbeat`, sc.encode(JSON.stringify({
    agentId,
    status: 'alive',
    timestamp: new Date().toISOString()
  })));
  
  // Periodic detailed health check via MCP
  if (Date.now() % 300000 === 0) { // Every 5 minutes
    const agents = await mcpClient.listAgents('online');
    for (const agent of agents) {
      try {
        await mcpClient.sendMessage(agent.id, 'health-check', 'query');
      } catch (error) {
        await log(`Agent ${agent.id} health check failed`, agentId, sharedDir);
      }
    }
  }
}, 30000);
```

## Configuration

### Environment Variables

```bash
# NATS Configuration
NATS_URL=nats://nats:4222

# MCP Configuration
MCP_ENABLED=true
MCP_PORT=4002
MCP_TIMEOUT=30000

# Agent Configuration
AGENT_ID=agent-1
HEARTBEAT_INTERVAL=30000
MAX_RETRIES=10
LOG_LEVEL=info

# Claude Configuration
ANTHROPIC_API_KEY=your-api-key
CLAUDE_MODEL=claude-3-5-sonnet-20241022
```

### Docker Compose Integration

```yaml
services:
  nats:
    image: nats:2.10-alpine
    ports:
      - "4222:4222"
      - "8222:8222"
    command: ["--http_port", "8222"]
    
  mcp-server:
    build: ./mcp-server
    depends_on:
      - nats
    environment:
      - NATS_URL=nats://nats:4222
      - LOG_LEVEL=info
    ports:
      - "4002:4002"
      
  agent-1:
    build: ./agents
    depends_on:
      - nats
      - mcp-server
    environment:
      - AGENT_ID=agent-1
      - NATS_URL=nats://nats:4222
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
```

## Performance Optimization

### 1. Connection Management
```typescript
// Reuse NATS connections
const natsConnection = await connect({ servers: natsUrl });

// Connection pooling for high-volume scenarios
class ConnectionPool {
  private connections: NatsConnection[] = [];
  
  async getConnection(): Promise<NatsConnection> {
    if (this.connections.length === 0) {
      return await connect({ servers: natsUrl });
    }
    return this.connections.pop()!;
  }
  
  releaseConnection(conn: NatsConnection) {
    this.connections.push(conn);
  }
}
```

### 2. Message Batching
```typescript
// Batch related messages when possible
class MessageBatcher {
  private batch: any[] = [];
  private batchTimeout: NodeJS.Timeout | null = null;
  
  addMessage(message: any) {
    this.batch.push(message);
    
    if (!this.batchTimeout) {
      this.batchTimeout = setTimeout(() => {
        this.flushBatch();
      }, 100); // 100ms batch window
    }
    
    if (this.batch.length >= 10) {
      this.flushBatch();
    }
  }
  
  private flushBatch() {
    if (this.batch.length > 0) {
      nc.publish('batch.messages', sc.encode(JSON.stringify(this.batch)));
      this.batch = [];
    }
    
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
  }
}
```

### 3. Circuit Breaker Pattern
```typescript
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > 60000) { // 1 minute
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }
    
    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess() {
    this.failures = 0;
    this.state = 'closed';
  }
  
  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= 5) {
      this.state = 'open';
    }
  }
}
```

## Troubleshooting

### Common Issues

#### NATS Connection Problems
```bash
# Check NATS server status
docker exec nats nats-cli server check

# Monitor NATS connections
docker exec nats nats-cli server info

# View NATS logs
docker logs nats -f
```

#### MCP Communication Issues
```bash
# Check MCP server logs
docker logs mcp-server -f

# Test MCP WebSocket connection
curl -i -N -H "Connection: Upgrade" \
     -H "Upgrade: websocket" \
     -H "Sec-WebSocket-Version: 13" \
     -H "Sec-WebSocket-Key: test" \
     http://localhost:4002
```

#### Agent Discovery Problems
```typescript
// Debug agent registration
const agents = await mcpClient.listAgents('all');
console.log('Registered agents:', agents);

// Check agent capabilities
for (const agent of agents) {
  const info = await mcpClient.getAgentInfo(agent.id);
  console.log(`Agent ${agent.id}:`, info);
}
```

### Debugging Commands

```bash
# View all container logs
docker-compose logs -f

# Monitor NATS traffic
docker exec nats nats-cli sub ">"

# Check agent connectivity
docker exec agent-1 cat /shared/agents/agent-1/agent.log

# Test MCP tools
docker exec mcp-server node -e "
const { connect } = require('nats');
connect().then(nc => {
  nc.publish('test.message', 'Hello World');
  console.log('Message sent');
});
"
```

## Security Considerations

### Network Isolation
- All communication happens within Docker's isolated network
- No external network access for agents
- MCP server only accessible within the container network

### Message Validation
```typescript
// Validate message schemas
function validateTaskMessage(message: any): message is TaskMessage {
  return message &&
         typeof message.id === 'string' &&
         typeof message.type === 'string' &&
         message.data !== undefined;
}

// Sanitize inputs
function sanitizeMessage(message: string): string {
  return message.replace(/[<>]/g, '').substring(0, 1000);
}
```

### Authentication (Future Enhancement)
```typescript
// JWT-based agent authentication
interface AgentToken {
  agentId: string;
  capabilities: string[];
  expires: number;
}

function verifyAgentToken(token: string): AgentToken | null {
  try {
    return jwt.verify(token, process.env.JWT_SECRET) as AgentToken;
  } catch {
    return null;
  }
}
```

## Future Enhancements

### Planned Features
1. **Message Persistence**: Store message history for replay and debugging
2. **Advanced Routing**: Content-based message routing and filtering
3. **Load Balancing**: Intelligent distribution of capability requests
4. **Metrics Collection**: Prometheus/Grafana integration for monitoring
5. **WebSocket Gateway**: Direct browser-to-agent communication
6. **Rate Limiting**: Prevent message flooding and abuse
7. **Encryption**: End-to-end message encryption for sensitive data

### Scalability Improvements
- Horizontal scaling of MCP servers
- Message queue implementation for high-volume scenarios
- Caching layer for agent discovery
- Database backend for persistent agent registry
- Clustering support for NATS

## Conclusion

The AI Flock system's hybrid NATS/MCP architecture provides a robust foundation for distributed agent communication. By following these patterns and best practices, you can build scalable, reliable agent systems that effectively coordinate work and share capabilities.

The key is understanding when to use each protocol:
- **NATS** for high-performance, fire-and-forget messaging
- **MCP** for structured, reliable agent interactions

This combination provides both the speed needed for real-time systems and the reliability required for complex agent coordination.
