#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { connect, StringCodec, NatsConnection, Subscription } from 'nats';
import winston from 'winston';
import * as dotenv from 'dotenv';
import WebSocket from 'ws';
import { WebSocketServerTransport } from './websocket-transport.js';
import http from 'http';

dotenv.config();

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'mcp-server.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Agent registry to track active agents
interface Agent {
  id: string;
  name: string;
  lastSeen: Date;
  status: 'online' | 'offline';
  capabilities?: string[];
}

class AgentCommunicationServer {
  private servers: Map<string, Server> = new Map();
  private natsConnection: NatsConnection | null = null;
  private stringCodec = StringCodec();
  private agents: Map<string, Agent> = new Map();
  private messageSubscriptions: Map<string, Subscription> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private wsServer: WebSocket.Server | null = null;
  private httpServer: http.Server | null = null;

  constructor() {
    // MCP server will be created for each connection
  }

  private createMCPServer(clientId: string): Server {
    const server = new Server(
      {
        name: 'ai-flock-communication',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers(server, clientId);
    return server;
  }

  private async connectToNats(): Promise<void> {
    const natsUrl = process.env.NATS_URL || 'nats://localhost:4222';
    
    try {
      this.natsConnection = await connect({
        servers: natsUrl,
        name: 'mcp-server',
        reconnect: true,
        maxReconnectAttempts: -1,
        reconnectTimeWait: 1000,
      });

      logger.info('Connected to NATS server');

      // Subscribe to agent discovery
      await this.subscribeToAgentDiscovery();
      
      // Start heartbeat monitoring
      this.startHeartbeatMonitoring();

    } catch (error) {
      logger.error('Failed to connect to NATS:', error);
      throw error;
    }
  }

  private async subscribeToAgentDiscovery(): Promise<void> {
    if (!this.natsConnection) return;

    // Subscribe to agent announcements
    const sub = this.natsConnection.subscribe('agent.announce');
    (async () => {
      for await (const msg of sub) {
        const data = JSON.parse(this.stringCodec.decode(msg.data));
        this.registerAgent(data);
      }
    })();

    // Subscribe to agent status updates
    const statusSub = this.natsConnection.subscribe('agent.*.status');
    (async () => {
      for await (const msg of statusSub) {
        const data = JSON.parse(this.stringCodec.decode(msg.data));
        this.updateAgentStatus(data.agentId, data.status);
      }
    })();

    // Handle MCP requests via NATS for backward compatibility
    await this.setupNATSRequestHandlers();
  }

  private async setupNATSRequestHandlers(): Promise<void> {
    if (!this.natsConnection) return;

    // Handle list agents requests via NATS
    const listAgentsSub = this.natsConnection.subscribe('mcp.list_agents');
    (async () => {
      for await (const msg of listAgentsSub) {
        try {
          const request = JSON.parse(this.stringCodec.decode(msg.data));
          const { status = 'all' } = request;
          
          let agentList = Array.from(this.agents.values());
          
          if (status !== 'all') {
            agentList = agentList.filter(agent => agent.status === status);
          }

          const agentInfo = agentList.map(agent => ({
            id: agent.id,
            name: agent.name,
            status: agent.status,
            lastSeen: agent.lastSeen.toISOString(),
            capabilities: agent.capabilities,
          }));

          msg.respond(this.stringCodec.encode(JSON.stringify(agentInfo)));
        } catch (error: any) {
          logger.error('Error handling list_agents request:', error);
          msg.respond(this.stringCodec.encode(JSON.stringify({ error: error.message })));
        }
      }
    })();

    // Handle get agent info requests via NATS
    const getAgentInfoSub = this.natsConnection.subscribe('mcp.get_agent_info');
    (async () => {
      for await (const msg of getAgentInfoSub) {
        try {
          const request = JSON.parse(this.stringCodec.decode(msg.data));
          const { agentId } = request;
          
          const agent = this.agents.get(agentId);
          if (!agent) {
            msg.respond(this.stringCodec.encode(JSON.stringify(null)));
            return;
          }

          const info = {
            id: agent.id,
            name: agent.name,
            status: agent.status,
            lastSeen: agent.lastSeen.toISOString(),
            capabilities: agent.capabilities,
            uptime: Date.now() - agent.lastSeen.getTime(),
          };

          msg.respond(this.stringCodec.encode(JSON.stringify(info)));
        } catch (error: any) {
          logger.error('Error handling get_agent_info request:', error);
          msg.respond(this.stringCodec.encode(JSON.stringify(null)));
        }
      }
    })();
  }

  private registerAgent(agentData: any): void {
    const agent: Agent = {
      id: agentData.id,
      name: agentData.name || `agent-${agentData.id}`,
      lastSeen: new Date(),
      status: 'online',
      capabilities: agentData.capabilities || [],
    };

    this.agents.set(agent.id, agent);
    logger.info(`Agent registered: ${agent.id}`);
  }

  private updateAgentStatus(agentId: string, status: 'online' | 'offline'): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.status = status;
      agent.lastSeen = new Date();
      logger.info(`Agent ${agentId} status updated to ${status}`);
    }
  }

  private startHeartbeatMonitoring(): void {
    // Check for offline agents every 60 seconds
    this.heartbeatInterval = setInterval(() => {
      const now = new Date();
      const timeout = 90000; // 90 seconds

      for (const [id, agent] of this.agents) {
        if (now.getTime() - agent.lastSeen.getTime() > timeout) {
          if (agent.status === 'online') {
            this.updateAgentStatus(id, 'offline');
          }
        }
      }
    }, 60000);
  }

  private setupHandlers(server: Server, clientId: string): void {
    // Handle tool listing
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools: Tool[] = [
        {
          name: 'send_message',
          description: 'Send a message to a specific agent or broadcast to all agents',
          inputSchema: {
            type: 'object',
            properties: {
              to: {
                type: 'string',
                description: 'Target agent ID (use "all" for broadcast)',
              },
              message: {
                type: 'string',
                description: 'Message content to send',
              },
              type: {
                type: 'string',
                enum: ['text', 'command', 'query', 'response'],
                description: 'Type of message',
                default: 'text',
              },
              metadata: {
                type: 'object',
                description: 'Optional metadata to include with the message',
                additionalProperties: true,
              },
            },
            required: ['to', 'message'],
          },
        },
        {
          name: 'list_agents',
          description: 'List all registered agents and their status',
          inputSchema: {
            type: 'object',
            properties: {
              status: {
                type: 'string',
                enum: ['all', 'online', 'offline'],
                description: 'Filter agents by status',
                default: 'all',
              },
            },
          },
        },
        {
          name: 'subscribe_to_agent',
          description: 'Subscribe to messages from a specific agent',
          inputSchema: {
            type: 'object',
            properties: {
              agentId: {
                type: 'string',
                description: 'ID of the agent to subscribe to',
              },
            },
            required: ['agentId'],
          },
        },
        {
          name: 'unsubscribe_from_agent',
          description: 'Unsubscribe from messages from a specific agent',
          inputSchema: {
            type: 'object',
            properties: {
              agentId: {
                type: 'string',
                description: 'ID of the agent to unsubscribe from',
              },
            },
            required: ['agentId'],
          },
        },
        {
          name: 'request_capability',
          description: 'Request a specific capability from available agents',
          inputSchema: {
            type: 'object',
            properties: {
              capability: {
                type: 'string',
                description: 'The capability being requested',
              },
              parameters: {
                type: 'object',
                description: 'Parameters for the capability request',
                additionalProperties: true,
              },
              timeout: {
                type: 'number',
                description: 'Timeout in milliseconds for the request',
                default: 30000,
              },
            },
            required: ['capability'],
          },
        },
        {
          name: 'get_agent_info',
          description: 'Get detailed information about a specific agent',
          inputSchema: {
            type: 'object',
            properties: {
              agentId: {
                type: 'string',
                description: 'ID of the agent',
              },
            },
            required: ['agentId'],
          },
        },
      ];

      return { tools };
    });

    // Handle tool execution
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (!this.natsConnection) {
        await this.connectToNats();
      }

      const { name, arguments: args } = request.params;

      switch (name) {
        case 'send_message':
          return await this.handleSendMessage(args, clientId);
        
        case 'list_agents':
          return await this.handleListAgents(args);
        
        case 'subscribe_to_agent':
          return await this.handleSubscribeToAgent(args, clientId);
        
        case 'unsubscribe_from_agent':
          return await this.handleUnsubscribeFromAgent(args, clientId);
        
        case 'request_capability':
          return await this.handleRequestCapability(args);
        
        case 'get_agent_info':
          return await this.handleGetAgentInfo(args);
        
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }

  private async handleSendMessage(args: any, clientId: string): Promise<any> {
    if (!this.natsConnection) {
      throw new Error('NATS connection not established');
    }

    const { to, message, type = 'text', metadata = {} } = args;
    
    const payload = {
      from: clientId,
      to,
      message,
      type,
      metadata,
      timestamp: new Date().toISOString(),
    };

    const subject = to === 'all' ? 'agent.broadcast' : `agent.${to}.message`;
    
    try {
      this.natsConnection.publish(
        subject,
        this.stringCodec.encode(JSON.stringify(payload))
      );

      logger.info(`Message from ${clientId} sent to ${to}: ${message}`);

      return {
        content: [
          {
            type: 'text',
            text: `Message sent successfully to ${to}`,
          },
        ],
      };
    } catch (error) {
      logger.error('Failed to send message:', error);
      throw error;
    }
  }

  private async handleListAgents(args: any): Promise<any> {
    const { status = 'all' } = args;
    
    let agentList = Array.from(this.agents.values());
    
    if (status !== 'all') {
      agentList = agentList.filter(agent => agent.status === status);
    }

    const agentInfo = agentList.map(agent => ({
      id: agent.id,
      name: agent.name,
      status: agent.status,
      lastSeen: agent.lastSeen.toISOString(),
      capabilities: agent.capabilities,
    }));

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(agentInfo, null, 2),
        },
      ],
    };
  }

  private async handleSubscribeToAgent(args: any, clientId: string): Promise<any> {
    if (!this.natsConnection) {
      throw new Error('NATS connection not established');
    }

    const { agentId } = args;
    const subKey = `${clientId}-${agentId}`;
    
    // Check if already subscribed
    if (this.messageSubscriptions.has(subKey)) {
      return {
        content: [
          {
            type: 'text',
            text: `Already subscribed to agent ${agentId}`,
          },
        ],
      };
    }

    // Create subscription
    const subject = `agent.${agentId}.message`;
    const sub = this.natsConnection.subscribe(subject);
    
    this.messageSubscriptions.set(subKey, sub);

    // Handle incoming messages
    (async () => {
      for await (const msg of sub) {
        const data = JSON.parse(this.stringCodec.decode(msg.data));
        logger.info(`Message from ${agentId} to ${clientId}: ${JSON.stringify(data)}`);
        // Messages will be logged and can be retrieved through a separate mechanism
      }
    })();

    logger.info(`Client ${clientId} subscribed to agent ${agentId}`);

    return {
      content: [
        {
          type: 'text',
          text: `Successfully subscribed to messages from agent ${agentId}`,
        },
      ],
    };
  }

  private async handleUnsubscribeFromAgent(args: any, clientId: string): Promise<any> {
    const { agentId } = args;
    const subKey = `${clientId}-${agentId}`;
    
    const sub = this.messageSubscriptions.get(subKey);
    if (!sub) {
      return {
        content: [
          {
            type: 'text',
            text: `Not subscribed to agent ${agentId}`,
          },
        ],
      };
    }

    sub.unsubscribe();
    this.messageSubscriptions.delete(subKey);

    logger.info(`Client ${clientId} unsubscribed from agent ${agentId}`);

    return {
      content: [
        {
          type: 'text',
          text: `Successfully unsubscribed from agent ${agentId}`,
        },
      ],
    };
  }

  private async handleRequestCapability(args: any): Promise<any> {
    if (!this.natsConnection) {
      throw new Error('NATS connection not established');
    }

    const { capability, parameters = {}, timeout = 30000 } = args;
    
    const request = {
      capability,
      parameters,
      requestId: `req-${Date.now()}`,
      from: 'mcp-server',
      timestamp: new Date().toISOString(),
    };

    try {
      // Send capability request and wait for response
      const response = await this.natsConnection.request(
        'capability.request',
        this.stringCodec.encode(JSON.stringify(request)),
        { timeout }
      );

      const responseData = JSON.parse(this.stringCodec.decode(response.data));

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(responseData, null, 2),
          },
        ],
      };
    } catch (error: any) {
      if (error.code === '503') {
        return {
          content: [
            {
              type: 'text',
              text: `No agent available with capability: ${capability}`,
            },
          ],
        };
      }
      throw error;
    }
  }

  private async handleGetAgentInfo(args: any): Promise<any> {
    const { agentId } = args;
    
    const agent = this.agents.get(agentId);
    if (!agent) {
      return {
        content: [
          {
            type: 'text',
            text: `Agent ${agentId} not found`,
          },
        ],
      };
    }

    const info = {
      id: agent.id,
      name: agent.name,
      status: agent.status,
      lastSeen: agent.lastSeen.toISOString(),
      capabilities: agent.capabilities,
      uptime: Date.now() - agent.lastSeen.getTime(),
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(info, null, 2),
        },
      ],
    };
  }

  async startWebSocketServer(port: number = 3002): Promise<void> {
    // Create HTTP server
    this.httpServer = http.createServer();
    
    // Create WebSocket server
    this.wsServer = new WebSocket.Server({ server: this.httpServer });

    this.wsServer.on('connection', (ws: WebSocket, request) => {
      const clientId = `ws-client-${Date.now()}`;
      logger.info(`New WebSocket connection from ${clientId}`);

      // Create MCP server for this connection
      const mcpServer = this.createMCPServer(clientId);
      this.servers.set(clientId, mcpServer);

      // Create transport and connect
      const transport = new WebSocketServerTransport(ws);
      mcpServer.connect(transport).then(() => {
        logger.info(`MCP server connected for ${clientId}`);
      }).catch((error) => {
        logger.error(`Failed to connect MCP server for ${clientId}:`, error);
      });

      ws.on('close', () => {
        logger.info(`WebSocket connection closed for ${clientId}`);
        this.servers.delete(clientId);
      });
    });

    this.httpServer.listen(port, () => {
      logger.info(`WebSocket server listening on port ${port}`);
    });
  }

  async startStdioServer(): Promise<void> {
    const clientId = 'stdio-client';
    const mcpServer = this.createMCPServer(clientId);
    this.servers.set(clientId, mcpServer);

    const transport = new StdioServerTransport();
    await mcpServer.connect(transport);
    logger.info(`MCP Server started with stdio transport for ${clientId}`);
  }

  async start(): Promise<void> {
    // Connect to NATS first
    await this.connectToNats();

    // Start based on mode
    const mode = process.env.MCP_MODE || 'websocket';
    
    if (mode === 'stdio') {
      await this.startStdioServer();
    } else if (mode === 'websocket') {
      const port = parseInt(process.env.MCP_PORT || '3002');
      await this.startWebSocketServer(port);
    } else {
      // Start both
      await this.startWebSocketServer();
      // Don't start stdio in container mode as it would block
      logger.info('MCP Server started in WebSocket mode');
    }
  }

  async stop(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Unsubscribe from all agent messages
    for (const sub of this.messageSubscriptions.values()) {
      sub.unsubscribe();
    }

    if (this.natsConnection) {
      await this.natsConnection.close();
    }

    if (this.wsServer) {
      this.wsServer.close();
    }

    if (this.httpServer) {
      this.httpServer.close();
    }

    logger.info('MCP Server stopped');
  }
}

// Start the server
const server = new AgentCommunicationServer();

server.start().catch((error) => {
  logger.error('Failed to start MCP server:', error);
  process.exit(1);
});

// Handle shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down MCP server...');
  await server.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Shutting down MCP server...');
  await server.stop();
  process.exit(0);
});