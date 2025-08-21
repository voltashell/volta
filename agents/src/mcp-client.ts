import { NatsConnection, StringCodec } from 'nats';
import { log } from './utils';

interface MCPMessage {
  from: string;
  to: string;
  message: string;
  type: 'text' | 'command' | 'query' | 'response';
  metadata?: Record<string, any>;
  timestamp: string;
}

interface AgentInfo {
  id: string;
  name: string;
  status: 'online' | 'offline';
  lastSeen: string;
  capabilities?: string[];
}

/**
 * MCP Communication Client for agents
 * Communicates with MCP server through NATS messaging
 */
export class MCPCommunicationClient {
  private agentId: string;
  private sharedDir: string;
  private natsConnection: NatsConnection;
  private stringCodec = StringCodec();
  private messageHandlers: Map<string, (message: MCPMessage) => void> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(agentId: string, sharedDir: string, natsConnection: NatsConnection) {
    this.agentId = agentId;
    this.sharedDir = sharedDir;
    this.natsConnection = natsConnection;
  }

  async initialize(): Promise<void> {
    try {
      // Announce agent to MCP server via NATS
      await this.announceAgent();
      
      // Setup message listener
      await this.setupMessageListener();
      
      // Start sending heartbeats
      this.startHeartbeat();

      await log(`MCP client initialized for ${this.agentId}`, this.agentId, this.sharedDir);
    } catch (error: any) {
      await log(`Failed to initialize MCP client: ${error.message}`, this.agentId, this.sharedDir);
      throw error;
    }
  }

  private async announceAgent(): Promise<void> {
    const announcement = {
      id: this.agentId,
      name: this.agentId,
      capabilities: ['text-processing', 'task-execution', 'claude-ai'],
      timestamp: new Date().toISOString()
    };

    this.natsConnection.publish(
      'agent.announce',
      this.stringCodec.encode(JSON.stringify(announcement))
    );
  }

  private async setupMessageListener(): Promise<void> {
    // Subscribe to direct messages
    const messageSub = this.natsConnection.subscribe(`agent.${this.agentId}.message`);
    
    (async () => {
      for await (const msg of messageSub) {
        try {
          const message: MCPMessage = JSON.parse(this.stringCodec.decode(msg.data));
          await this.handleIncomingMessage(message);
        } catch (error: any) {
          await log(`Error processing message: ${error.message}`, this.agentId, this.sharedDir);
        }
      }
    })().catch(async (err) => {
      await log(`Message subscription error: ${err.message}`, this.agentId, this.sharedDir);
    });

    // Subscribe to broadcast messages
    const broadcastSub = this.natsConnection.subscribe('agent.broadcast');
    
    (async () => {
      for await (const msg of broadcastSub) {
        try {
          const message: MCPMessage = JSON.parse(this.stringCodec.decode(msg.data));
          await this.handleIncomingMessage(message);
        } catch (error: any) {
          await log(`Error processing broadcast: ${error.message}`, this.agentId, this.sharedDir);
        }
      }
    })().catch(async (err) => {
      await log(`Broadcast subscription error: ${err.message}`, this.agentId, this.sharedDir);
    });
  }

  private async handleIncomingMessage(message: MCPMessage): Promise<void> {
    // Don't process our own messages
    if (message.from === this.agentId || message.from === `mcp-server-${this.agentId}`) {
      return;
    }

    await log(`Received message from ${message.from}: ${message.message}`, this.agentId, this.sharedDir);
    
    // Execute registered handlers
    const handler = this.messageHandlers.get(message.type);
    if (handler) {
      try {
        handler(message);
      } catch (error: any) {
        await log(`Error in message handler: ${error.message}`, this.agentId, this.sharedDir);
      }
    }

    // Send acknowledgment for direct query messages
    if (message.to === this.agentId && message.type === 'query') {
      await this.sendResponse(message.from, `Received your message: ${message.message}`, message.metadata);
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      try {
        const status = {
          agentId: this.agentId,
          status: 'online' as const,
          timestamp: new Date().toISOString()
        };

        this.natsConnection.publish(
          `agent.${this.agentId}.status`,
          this.stringCodec.encode(JSON.stringify(status))
        );
      } catch (error: any) {
        console.error(`Error sending heartbeat: ${error.message}`);
      }
    }, 30000); // Every 30 seconds
  }

  // Public methods for agent communication

  async sendMessage(to: string, message: string, type: 'text' | 'command' | 'query' | 'response' = 'text', metadata?: Record<string, any>): Promise<void> {
    try {
      const payload: MCPMessage = {
        from: this.agentId,
        to,
        message,
        type,
        metadata: {
          ...metadata,
          fromAgent: this.agentId
        },
        timestamp: new Date().toISOString()
      };

      const subject = to === 'all' ? 'agent.broadcast' : `agent.${to}.message`;
      
      this.natsConnection.publish(
        subject,
        this.stringCodec.encode(JSON.stringify(payload))
      );

      await log(`Message sent to ${to}: ${message}`, this.agentId, this.sharedDir);
    } catch (error: any) {
      await log(`Failed to send message: ${error.message}`, this.agentId, this.sharedDir);
      throw error;
    }
  }

  async sendResponse(to: string, message: string, originalMetadata?: Record<string, any>): Promise<void> {
    await this.sendMessage(to, message, 'response', {
      ...originalMetadata,
      responseFrom: this.agentId,
      responseTime: new Date().toISOString()
    });
  }

  async broadcastMessage(message: string, metadata?: Record<string, any>): Promise<void> {
    await this.sendMessage('all', message, 'text', metadata);
  }

  async listAgents(status: 'all' | 'online' | 'offline' = 'all'): Promise<AgentInfo[]> {
    try {
      // Request agent list via NATS request-reply pattern
      const request = {
        action: 'list_agents',
        status,
        requestFrom: this.agentId,
        timestamp: new Date().toISOString()
      };

      const response = await this.natsConnection.request(
        'mcp.list_agents',
        this.stringCodec.encode(JSON.stringify(request)),
        { timeout: 5000 }
      );

      const agents: AgentInfo[] = JSON.parse(this.stringCodec.decode(response.data));
      return agents.filter(agent => agent.id !== this.agentId); // Exclude self
    } catch (error: any) {
      await log(`Failed to list agents: ${error.message}`, this.agentId, this.sharedDir);
      return [];
    }
  }

  async requestCapability(capability: string, parameters?: Record<string, any>, timeout: number = 30000): Promise<any> {
    try {
      const request = {
        capability,
        parameters,
        requestId: `req-${Date.now()}`,
        from: this.agentId,
        timestamp: new Date().toISOString()
      };

      const response = await this.natsConnection.request(
        'capability.request',
        this.stringCodec.encode(JSON.stringify(request)),
        { timeout }
      );

      return JSON.parse(this.stringCodec.decode(response.data));
    } catch (error: any) {
      await log(`Failed to request capability: ${error.message}`, this.agentId, this.sharedDir);
      
      // Check if timeout
      if (error.code === '503' || error.message.includes('timeout')) {
        return { error: `No agent available with capability: ${capability}` };
      }
      throw error;
    }
  }

  async getAgentInfo(agentId: string): Promise<AgentInfo | null> {
    try {
      const request = {
        action: 'get_agent_info',
        agentId,
        requestFrom: this.agentId,
        timestamp: new Date().toISOString()
      };

      const response = await this.natsConnection.request(
        'mcp.get_agent_info',
        this.stringCodec.encode(JSON.stringify(request)),
        { timeout: 5000 }
      );

      return JSON.parse(this.stringCodec.decode(response.data));
    } catch (error: any) {
      await log(`Failed to get agent info: ${error.message}`, this.agentId, this.sharedDir);
      return null;
    }
  }

  // Register message handlers
  registerMessageHandler(type: string, handler: (message: MCPMessage) => void): void {
    this.messageHandlers.set(type, handler);
  }

  // Cleanup
  async close(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Send offline status
    try {
      const status = {
        agentId: this.agentId,
        status: 'offline' as const,
        timestamp: new Date().toISOString()
      };

      this.natsConnection.publish(
        `agent.${this.agentId}.status`,
        this.stringCodec.encode(JSON.stringify(status))
      );
    } catch (error: any) {
      console.error(`Error sending offline status: ${error.message}`);
    }
  }
}