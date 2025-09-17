import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { connect, StringCodec, NatsConnection } from 'nats';
import { spawn } from 'child_process';
import { spawn as ptySpawn, type IPty } from 'node-pty';
import next from 'next';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

interface AgentMessage {
  from: string;
  to: string;
  message: string;
  type: 'text' | 'command' | 'query' | 'response';
  metadata?: Record<string, any>;
  timestamp: string;
}

interface ContainerStat {
  Name: string;
  CPUPerc: string;
  MemUsage: string;
  NetIO: string;
  BlockIO: string;
  PIDs: string;
}

interface LogData {
  container: string;
  data: string;
  timestamp: string;
  isError: boolean;
}

class MonitorServer {
  private natsConnection: NatsConnection | null = null;
  private stringCodec = StringCodec();
  private io: SocketIOServer | null = null;
  private ptys: Map<string, IPty> = new Map();

  async initialize() {
    try {
      // Connect to NATS
      const natsUrl = process.env.NATS_URL || 'nats://localhost:4222';
      console.log(`Connecting to NATS at ${natsUrl}...`);
      
      this.natsConnection = await connect({ 
        servers: natsUrl,
        reconnect: true,
        maxReconnectAttempts: -1,
        reconnectTimeWait: 1000
      });
      
      console.log('Connected to NATS successfully');
      
      // Setup NATS subscriptions
      await this.setupNatsSubscriptions();
      
    } catch (error) {
      console.error('Failed to connect to NATS:', error);
      // Continue without NATS - monitor can still show Docker stats
    }
  }

  private async setupNatsSubscriptions() {
    if (!this.natsConnection) return;

    try {
      // Subscribe to agent announcements
      const announceSub = this.natsConnection.subscribe('agent.announce');
      (async () => {
        for await (const msg of announceSub) {
          try {
            const announcement = JSON.parse(this.stringCodec.decode(msg.data));
            console.log('Agent announced:', announcement);
            this.io?.emit('agent-announce', announcement);
          } catch (error) {
            console.error('Error processing agent announcement:', error);
          }
        }
      })();

      // Subscribe to agent status updates
      const statusSub = this.natsConnection.subscribe('agent.*.status');
      (async () => {
        for await (const msg of statusSub) {
          try {
            const status = JSON.parse(this.stringCodec.decode(msg.data));
            console.log('Agent status update:', status);
            this.io?.emit('agent-status', status);
          } catch (error) {
            console.error('Error processing agent status:', error);
          }
        }
      })();

      // Subscribe to agent messages for monitoring
      const messageSub = this.natsConnection.subscribe('agent.*.message');
      (async () => {
        for await (const msg of messageSub) {
          try {
            const message: AgentMessage = JSON.parse(this.stringCodec.decode(msg.data));
            console.log('Agent message:', message);
            this.io?.emit('agent-message', message);
          } catch (error) {
            console.error('Error processing agent message:', error);
          }
        }
      })();

      // Subscribe to broadcast messages
      const broadcastSub = this.natsConnection.subscribe('agent.broadcast');
      (async () => {
        for await (const msg of broadcastSub) {
          try {
            const message: AgentMessage = JSON.parse(this.stringCodec.decode(msg.data));
            console.log('Broadcast message:', message);
            this.io?.emit('agent-broadcast', message);
          } catch (error) {
            console.error('Error processing broadcast message:', error);
          }
        }
      })();

      console.log('NATS subscriptions setup complete');
    } catch (error) {
      console.error('Error setting up NATS subscriptions:', error);
    }
  }

  setupSocketIO(server: any) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });

    this.io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);

      // Send agent list via NATS
      socket.on('get-agents', async () => {
        if (this.natsConnection) {
          try {
            const request = {
              action: 'list_agents',
              status: 'all',
              requestFrom: 'monitor',
              timestamp: new Date().toISOString()
            };

            const response = await this.natsConnection.request(
              'mcp.list_agents',
              this.stringCodec.encode(JSON.stringify(request)),
              { timeout: 5000 }
            );

            const agents = JSON.parse(this.stringCodec.decode(response.data));
            socket.emit('agents-list', agents);
          } catch (error) {
            console.error('Failed to get agents list:', error);
            socket.emit('agents-list', []);
          }
        }
      });

      // Send message to agent via NATS
      socket.on('send-agent-message', async (data: { to: string, message: string, type?: string }) => {
        if (this.natsConnection) {
          try {
            const payload: AgentMessage = {
              from: 'monitor',
              to: data.to,
              message: data.message,
              type: (data.type as any) || 'text',
              metadata: { fromMonitor: true },
              timestamp: new Date().toISOString()
            };

            const subject = data.to === 'all' ? 'agent.broadcast' : `agent.${data.to}.message`;
            
            this.natsConnection.publish(
              subject,
              this.stringCodec.encode(JSON.stringify(payload))
            );

            console.log(`Message sent to ${data.to}: ${data.message}`);
          } catch (error) {
            console.error('Failed to send message to agent:', error);
          }
        }
      });

      // Handle container operations
      socket.on('execute-command', (data: { command: string, target: string }) => {
        this.executeDockerCommand(data.command, data.target, socket);
      });

      socket.on('restart-container', (containerName: string) => {
        this.restartContainer(containerName, socket);
      });

      // Terminal handling
      socket.on('create-terminal', (containerName: string) => {
        this.createTerminal(containerName, socket);
      });

      socket.on('terminal-input', (data: { container: string; input: string }) => {
        this.sendTerminalInput(socket, data.container, data.input);
      });

      socket.on('terminal-resize', (data: { container: string; cols: number; rows: number }) => {
        this.resizeTerminal(data.container, data.cols, data.rows);
      });

      socket.on('terminal-stop', (data: { container: string }) => {
        this.stopTerminal(socket.id, data.container);
      });

      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        // Clean up all terminals for this socket
        this.cleanupSocketTerminals(socket.id);
      });
    });

    // Start periodic Docker stats collection
    this.startStatsCollection();
    this.startLogCollection();
  }

  private executeDockerCommand(command: string, target: string, socket: any) {
    const dockerCommand = target === 'host' 
      ? command 
      : `docker exec ${target} ${command}`;

    const child = spawn('sh', ['-c', dockerCommand]);
    let output = '';
    let error = '';

    child.stdout.on('data', (data) => {
      output += data.toString();
    });

    child.stderr.on('data', (data) => {
      error += data.toString();
    });

    child.on('close', (code) => {
      socket.emit('command-result', {
        command,
        target,
        output,
        error,
        exitCode: code,
        timestamp: new Date().toISOString()
      });
    });
  }

  private restartContainer(containerName: string, socket: any) {
    const child = spawn('docker', ['restart', containerName]);

    child.on('close', (code) => {
      socket.emit('container-restarted', {
        container: containerName,
        success: code === 0
      });
    });
  }

  private createTerminal(containerName: string, socket: any) {
    const terminalKey = `${socket.id}-${containerName}`;

    // Clean up existing terminal if any
    const existing = this.ptys.get(terminalKey);
    if (existing) {
      try { existing.kill(); } catch {}
      this.ptys.delete(terminalKey);
    }

    // Choose shell per container (nats uses busybox sh)
    const shell = containerName === 'nats' ? '/bin/sh' : '/bin/bash';
    const shellArgs = containerName === 'nats' ? [] : ['-li'];

    // Spawn a PTY so docker sees a real TTY
    const p = ptySpawn('docker', ['exec', '-it', containerName, shell, ...shellArgs], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      env: { ...process.env, TERM: 'xterm-256color' }
    });

    this.ptys.set(terminalKey, p);

    p.onData((data: string) => {
      socket.emit('terminal-output', {
        container: containerName,
        data
      });
    });

    p.onExit(() => {
      this.ptys.delete(terminalKey);
      socket.emit('terminal-closed', { container: containerName });
    });

    socket.emit('terminal-created', { container: containerName, message: 'Terminal session started' });
  }

  private sendTerminalInput(socket: any, containerName: string, input: string) {
    const terminalKey = `${socket.id}-${containerName}`;
    const p = this.ptys.get(terminalKey);
    if (p) {
      p.write(input);
    }
  }

  private resizeTerminal(containerName: string, cols: number, rows: number) {
    // Resize PTY if present (affects programs like vim, less, etc.)
    for (const [key, p] of this.ptys.entries()) {
      if (key.endsWith(`-${containerName}`)) {
        try { p.resize(cols, rows); } catch {}
      }
    }
  }

  private stopTerminal(socketId: string, containerName: string) {
    const terminalKey = `${socketId}-${containerName}`;
    const p = this.ptys.get(terminalKey);
    if (p) {
      try { p.kill(); } catch {}
      this.ptys.delete(terminalKey);
    }
  }

  private cleanupSocketTerminals(socketId: string) {
    for (const [key, p] of this.ptys.entries()) {
      if (key.startsWith(`${socketId}-`)) {
        try { p.kill(); } catch {}
        this.ptys.delete(key);
      }
    }
  }

  private startStatsCollection() {
    const collectStats = () => {
      const child = spawn('docker', ['stats', '--no-stream', '--format', 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}\t{{.PIDs}}']);
      let output = '';

      child.stdout.on('data', (data) => {
        output += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          const lines = output.trim().split('\n').slice(1); // Skip header
          const stats: ContainerStat[] = lines.map(line => {
            const [Name, CPUPerc, MemUsage, NetIO, BlockIO, PIDs] = line.split('\t');
            return { Name, CPUPerc, MemUsage, NetIO, BlockIO, PIDs };
          }).filter(stat => ['agent-1', 'agent-2', 'agent-3', 'nats', 'monitor'].includes(stat.Name));

          this.io?.emit('stats', stats);
        }
      });
    };

    // Collect stats every 5 seconds
    setInterval(collectStats, 5000);
    collectStats(); // Initial collection
  }

  private startLogCollection() {
    const containers = ['agent-1', 'agent-2', 'agent-3', 'nats'];
    
    containers.forEach(container => {
      const child = spawn('docker', ['logs', '-f', '--tail', '100', container]);
      
      child.stdout.on('data', (data) => {
        const logData: LogData = {
          container,
          data: data.toString(),
          timestamp: new Date().toISOString(),
          isError: false
        };
        this.io?.emit('log', logData);
      });

      child.stderr.on('data', (data) => {
        const logData: LogData = {
          container,
          data: data.toString(),
          timestamp: new Date().toISOString(),
          isError: true
        };
        this.io?.emit('log', logData);
      });
    });
  }
}

async function startServer() {
  const monitor = new MonitorServer();
  await monitor.initialize();

  await app.prepare();
  
  const server = createServer((req, res) => {
    handle(req, res);
  });

  monitor.setupSocketIO(server);

  const port = process.env.PORT || 3000;
  server.listen(port, () => {
    console.log(`Monitor server running on port ${port}`);
  });
}

startServer().catch(console.error);
