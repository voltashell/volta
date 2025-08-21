# AI Flock MCP Server

## Overview

The MCP (Model Context Protocol) server provides a structured communication layer for AI agents in the flock system. It enables agents to discover each other, send targeted messages, and request capabilities from other agents.

## Features

### Core Communication Tools

1. **send_message** - Send messages to specific agents or broadcast to all
2. **list_agents** - Discover available agents and their status
3. **subscribe_to_agent** - Receive messages from specific agents
4. **unsubscribe_from_agent** - Stop receiving messages from specific agents
5. **request_capability** - Request specific capabilities from available agents
6. **get_agent_info** - Get detailed information about a specific agent

## Architecture

The MCP server acts as a bridge between the NATS messaging system and the MCP protocol, providing:

- **Agent Discovery**: Automatic detection of online agents
- **Message Routing**: Targeted and broadcast messaging capabilities
- **Capability Negotiation**: Request-response pattern for capability requests
- **Health Monitoring**: Heartbeat-based agent status tracking

## Message Types

### Text Messages
Basic communication between agents
```json
{
  "type": "text",
  "from": "agent-1",
  "to": "agent-2",
  "message": "Hello from agent 1"
}
```

### Command Messages
Execute commands on other agents
```json
{
  "type": "command",
  "from": "agent-1",
  "to": "agent-2",
  "message": "process_data",
  "metadata": { "data": "..." }
}
```

### Query Messages
Request information from other agents (expects response)
```json
{
  "type": "query",
  "from": "agent-1",
  "to": "agent-2",
  "message": "What is your current status?",
  "metadata": { "requestId": "req-123" }
}
```

### Response Messages
Responses to query messages
```json
{
  "type": "response",
  "from": "agent-2",
  "to": "agent-1",
  "message": "Status: Processing 5 tasks",
  "metadata": { "requestId": "req-123" }
}
```

## Integration with Agents

Agents can integrate with the MCP server through the MCPCommunicationClient class:

```typescript
import { MCPCommunicationClient } from './mcp-client';

// Initialize the client
const mcpClient = new MCPCommunicationClient(agentId, sharedDir, natsConnection);
await mcpClient.initialize();

// Send a message to another agent
await mcpClient.sendMessage('agent-2', 'Hello!', 'text');

// Broadcast to all agents
await mcpClient.broadcastMessage('System update completed');

// List available agents
const agents = await mcpClient.listAgents('online');

// Request a capability
const result = await mcpClient.requestCapability('text-processing', {
  text: 'Process this text'
});

// Register message handlers
mcpClient.registerMessageHandler('command', (message) => {
  console.log(`Received command: ${message.message}`);
});
```

## Environment Variables

- `NATS_URL`: NATS server URL (default: `nats://nats:4222`)
- `LOG_LEVEL`: Logging level (default: `info`)

## Docker Deployment

The MCP server is included in the docker-compose configuration:

```yaml
mcp-server:
  build:
    context: ./mcp-server
    dockerfile: Dockerfile
  environment:
    - NATS_URL=nats://nats:4222
    - LOG_LEVEL=info
  networks:
    - bus
```

## Usage Examples

### Agent-to-Agent Communication

```typescript
// Agent 1 sends a query to Agent 2
await mcpClient.sendMessage('agent-2', 'Can you process this task?', 'query');

// Agent 2 receives the query and responds
mcpClient.registerMessageHandler('query', async (message) => {
  const response = await processQuery(message.message);
  await mcpClient.sendResponse(message.from, response);
});
```

### Capability Request

```typescript
// Agent requests text processing capability
const result = await mcpClient.requestCapability('text-processing', {
  text: 'Analyze this text for sentiment',
  useClaude: true
});
```

### Agent Discovery

```typescript
// List all online agents
const onlineAgents = await mcpClient.listAgents('online');
console.log(`Found ${onlineAgents.length} online agents`);

// Get info about a specific agent
const agentInfo = await mcpClient.getAgentInfo('agent-2');
console.log(`Agent 2 capabilities: ${agentInfo.capabilities.join(', ')}`);
```

## Monitoring

The MCP server logs all communication activities to `mcp-server.log` and the console. Monitor logs to track:

- Agent registrations and disconnections
- Message routing
- Capability requests
- Error conditions

## Security Considerations

- All communication goes through the isolated NATS bus
- Agents can only communicate with other agents on the same network
- No external network access from the MCP server
- Message validation ensures proper format and structure

## Development

To run the MCP server locally:

```bash
cd mcp-server
npm install
npm run dev
```

To build for production:

```bash
npm run build
npm start
```