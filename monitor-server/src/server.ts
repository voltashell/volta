import Docker from 'dockerode';
import { Server } from 'socket.io';
import { createServer } from 'http';
import { Readable } from 'stream';
import * as pty from 'node-pty';

const docker = new Docker();
const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:3000', 'http://monitor:3000', '*'],
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// Track active terminals per container
const terminals: Map<string, any> = new Map();

// Container names to monitor
const CONTAINER_NAMES = ['agent-1', 'agent-2', 'agent-3', 'nats'];

io.on('connection', (socket) => {
  console.log('Client connected');

  // Send initial connection status
  socket.emit('connected', { status: 'Connected to Docker terminal server' });

  // Handle terminal creation for container
  socket.on('create-terminal', async (containerName: string) => {
    try {
      if (!CONTAINER_NAMES.includes(containerName)) {
        socket.emit('error', { 
          container: containerName, 
          message: 'Invalid container name' 
        });
        return;
      }

      // Clean up existing terminal if present
      if (terminals.has(containerName)) {
        const oldTerm = terminals.get(containerName);
        if (oldTerm && oldTerm.kill) {
          oldTerm.kill();
        }
        terminals.delete(containerName);
      }

      const container = docker.getContainer(containerName);
      
      // Check if container is running
      const containerInfo = await container.inspect();
      if (!containerInfo.State.Running) {
        socket.emit('error', { 
          container: containerName, 
          message: 'Container is not running' 
        });
        return;
      }

      // Create a pseudo-terminal that runs docker exec
      const term = pty.spawn('docker', ['exec', '-it', containerName, '/bin/bash'], {
        name: 'xterm-256color',
        cols: 80,
        rows: 30,
        cwd: process.cwd(),
        env: {
          ...process.env,
          TERM: 'xterm-256color'
        }
      });

      terminals.set(containerName, term);

      // Handle data from terminal to client
      term.onData((data: string) => {
        socket.emit('terminal-output', {
          container: containerName,
          data: data
        });
      });

      // Handle terminal exit
      term.onExit(() => {
        console.log(`Terminal exited for ${containerName}`);
        socket.emit('terminal-closed', {
          container: containerName
        });
        terminals.delete(containerName);
      });

      socket.emit('terminal-created', {
        container: containerName,
        message: 'Terminal connected'
      });

      console.log(`Terminal created for ${containerName}`);

    } catch (error: any) {
      console.error(`Error creating terminal for ${containerName}:`, error);
      socket.emit('error', {
        container: containerName,
        message: error.message
      });
    }
  });

  // Handle input from client to container
  socket.on('terminal-input', (data: { container: string; input: string }) => {
    const term = terminals.get(data.container);
    if (term) {
      term.write(data.input);
    } else {
      socket.emit('error', {
        container: data.container,
        message: 'No active terminal for this container'
      });
    }
  });

  // Handle terminal resize
  socket.on('terminal-resize', (data: { container: string; cols: number; rows: number }) => {
    const term = terminals.get(data.container);
    if (term) {
      term.resize(data.cols, data.rows);
    }
  });

  // Handle command execution (non-interactive)
  socket.on('execute-command', async (data: { command: string; target: string; timestamp: string }) => {
    try {
      const container = docker.getContainer(data.target);
      
      const exec = await container.exec({
        Cmd: ['/bin/bash', '-c', data.command],
        AttachStdout: true,
        AttachStderr: true,
        Tty: false
      });

      const stream = await exec.start({ hijack: true, stdin: false });
      
      let output = '';
      stream.on('data', (chunk: Buffer) => {
        output += chunk.toString('utf8');
      });

      stream.on('end', () => {
        socket.emit('command-result', {
          target: data.target,
          command: data.command,
          output: output,
          timestamp: data.timestamp,
          success: true
        });
      });

      stream.on('error', (err: Error) => {
        socket.emit('command-result', {
          target: data.target,
          command: data.command,
          output: err.message,
          timestamp: data.timestamp,
          success: false
        });
      });

    } catch (error: any) {
      socket.emit('error', {
        container: data.target,
        message: error.message
      });
    }
  });

  // Handle container restart
  socket.on('restart-container', async (containerName: string) => {
    try {
      const container = docker.getContainer(containerName);
      await container.restart();
      
      socket.emit('container-restarted', {
        container: containerName,
        success: true,
        message: 'Container restarted successfully'
      });
    } catch (error: any) {
      socket.emit('container-restarted', {
        container: containerName,
        success: false,
        message: error.message
      });
    }
  });

  // Handle container stats
  socket.on('get-stats', async () => {
    try {
      const statsPromises = CONTAINER_NAMES.map(async (name) => {
        try {
          const container = docker.getContainer(name);
          const stats = await container.stats({ stream: false });
          
          // Calculate CPU percentage
          const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
          const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
          const cpuPercent = (cpuDelta / systemDelta) * stats.cpu_stats.online_cpus * 100;
          
          // Calculate memory usage
          const memUsage = stats.memory_stats.usage || 0;
          const memLimit = stats.memory_stats.limit || 0;
          const memPercent = (memUsage / memLimit) * 100;
          
          return {
            Name: name,
            CPUPerc: `${cpuPercent.toFixed(2)}%`,
            MemUsage: `${(memUsage / 1024 / 1024).toFixed(2)}MB / ${(memLimit / 1024 / 1024).toFixed(2)}MB`,
            MemPerc: `${memPercent.toFixed(2)}%`,
            Status: 'running'
          };
        } catch (err) {
          return {
            Name: name,
            CPUPerc: '0%',
            MemUsage: '0MB / 0MB',
            MemPerc: '0%',
            Status: 'stopped'
          };
        }
      });
      
      const stats = await Promise.all(statsPromises);
      socket.emit('stats', stats);
    } catch (error: any) {
      console.error('Error getting stats:', error);
    }
  });

  // Stream container logs
  socket.on('start-logs', async (containerName: string) => {
    try {
      const container = docker.getContainer(containerName);
      const logStream = await container.logs({
        stdout: true,
        stderr: true,
        follow: true,
        tail: 50,
        timestamps: true
      });

      // Docker logs come with 8-byte header that needs to be parsed
      const parseDockerLog = (buffer: Buffer) => {
        let messages = [];
        let offset = 0;
        
        while (offset < buffer.length) {
          // Skip the 8-byte header
          if (offset + 8 > buffer.length) break;
          
          const header = buffer.subarray(offset, offset + 8);
          const size = header.readUInt32BE(4);
          
          if (offset + 8 + size > buffer.length) break;
          
          const payload = buffer.subarray(offset + 8, offset + 8 + size);
          messages.push(payload.toString('utf8'));
          
          offset += 8 + size;
        }
        
        return messages.join('');
      };

      if (logStream instanceof Readable) {
        logStream.on('data', (chunk: Buffer) => {
          const message = parseDockerLog(chunk);
          if (message) {
            socket.emit('log', {
              container: containerName,
              data: message,
              timestamp: new Date().toISOString()
            });
          }
        });

        logStream.on('error', (err: Error) => {
          console.error(`Log stream error for ${containerName}:`, err);
        });

        logStream.on('end', () => {
          console.log(`Log stream ended for ${containerName}`);
        });
      }
    } catch (error: any) {
      console.error(`Error starting logs for ${containerName}:`, error);
      socket.emit('error', {
        container: containerName,
        message: error.message
      });
    }
  });

  // Clean up on disconnect
  socket.on('disconnect', () => {
    console.log('Client disconnected');
    
    // Clean up all terminals for this connection
    terminals.forEach((terminal) => {
      if (terminal && terminal.kill) {
        terminal.kill();
      }
    });
    terminals.clear();
  });

  // Start streaming logs for all containers on connection
  CONTAINER_NAMES.forEach(async containerName => {
    // Trigger log streaming
    try {
      const container = docker.getContainer(containerName);
      const logStream = await container.logs({
        stdout: true,
        stderr: true,
        follow: true,
        tail: 50,
        timestamps: true
      });

      // Docker logs come with 8-byte header that needs to be parsed
      const parseDockerLog = (buffer: Buffer) => {
        let messages = [];
        let offset = 0;
        
        while (offset < buffer.length) {
          // Skip the 8-byte header
          if (offset + 8 > buffer.length) break;
          
          const header = buffer.subarray(offset, offset + 8);
          const size = header.readUInt32BE(4);
          
          if (offset + 8 + size > buffer.length) break;
          
          const payload = buffer.subarray(offset + 8, offset + 8 + size);
          messages.push(payload.toString('utf8'));
          
          offset += 8 + size;
        }
        
        return messages.join('');
      };

      if (logStream instanceof Readable) {
        logStream.on('data', (chunk: Buffer) => {
          const message = parseDockerLog(chunk);
          if (message) {
            socket.emit('log', {
              container: containerName,
              data: message,
              timestamp: new Date().toISOString()
            });
          }
        });
      }
    } catch (error) {
      console.error(`Error starting logs for ${containerName}:`, error);
    }
  });

  // Function to send stats to this specific client
  const sendStats = async () => {
    try {
      const statsPromises = CONTAINER_NAMES.map(async (name) => {
        try {
          const container = docker.getContainer(name);
          const stats = await container.stats({ stream: false });
          
          // Calculate CPU percentage
          const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
          const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
          const cpuPercent = (cpuDelta / systemDelta) * stats.cpu_stats.online_cpus * 100;
          
          // Calculate memory usage
          const memUsage = stats.memory_stats.usage || 0;
          const memLimit = stats.memory_stats.limit || 0;
          const memPercent = (memUsage / memLimit) * 100;
          
          return {
            Name: name,
            CPUPerc: `${cpuPercent.toFixed(2)}%`,
            MemUsage: `${(memUsage / 1024 / 1024).toFixed(2)}MB / ${(memLimit / 1024 / 1024).toFixed(2)}MB`,
            MemPerc: `${memPercent.toFixed(2)}%`,
            Status: 'running'
          };
        } catch (err) {
          return {
            Name: name,
            CPUPerc: '0%',
            MemUsage: '0MB / 0MB',
            MemPerc: '0%',
            Status: 'stopped'
          };
        }
      });
      
      const stats = await Promise.all(statsPromises);
      socket.emit('stats', stats);
    } catch (error: any) {
      console.error('Error getting stats:', error);
    }
  };

  // Send initial stats
  sendStats();

  // Start periodic stats updates for this client
  const statsInterval = setInterval(sendStats, 5000);

  socket.on('disconnect', () => {
    clearInterval(statsInterval);
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Docker terminal server listening on port ${PORT}`);
});