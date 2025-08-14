import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import {
  LogData,
  ContainerStats,
  ErrorData,
  ContainerRestartData,
  CommandData,
  CommandResult,
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
  MonitorSocket,
  LogStream
} from './types';

const app = express();
const server = createServer(app);
const io = new SocketIOServer<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>(server);

const PORT = process.env.PORT || 3001;

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// Store active log streams
const logStreams = new Map<string, ChildProcess>();

/**
 * Start a docker log stream for a specific container
 */
function startLogStream(containerName: string, socket: MonitorSocket): ChildProcess {
  // Clean up existing stream if it exists
  if (logStreams.has(containerName)) {
    const existingStream = logStreams.get(containerName);
    existingStream?.kill();
  }

  const dockerLogs = spawn('docker', ['logs', '-f', '--tail', '100', containerName]);
  logStreams.set(containerName, dockerLogs);

  dockerLogs.stdout?.on('data', (data: Buffer) => {
    const logData: LogData = {
      container: containerName,
      data: data.toString(),
      timestamp: new Date().toISOString()
    };
    socket.emit('log', logData);
  });

  dockerLogs.stderr?.on('data', (data: Buffer) => {
    const logData: LogData = {
      container: containerName,
      data: data.toString(),
      timestamp: new Date().toISOString(),
      isError: true
    };
    socket.emit('log', logData);
  });

  dockerLogs.on('close', (code: number | null) => {
    console.log(`Log stream for ${containerName} closed with code ${code}`);
    logStreams.delete(containerName);
  });

  dockerLogs.on('error', (err: Error) => {
    console.error(`Error streaming logs for ${containerName}:`, err);
    const errorData: ErrorData = {
      container: containerName,
      message: err.message
    };
    socket.emit('error', errorData);
  });

  return dockerLogs;
}

/**
 * Get container statistics from Docker
 */
async function getContainerStats(): Promise<ContainerStats[]> {
  return new Promise((resolve) => {
    const statsProcess = spawn('docker', [
      'stats',
      '--no-stream',
      '--format',
      'json',
      'agent-1',
      'agent-2',
      'agent-3',
      'nats'
    ]);
    
    let output = '';

    statsProcess.stdout?.on('data', (data: Buffer) => {
      output += data.toString();
    });

    statsProcess.on('close', () => {
      try {
        const lines = output.trim().split('\n').filter(line => line.trim());
        const stats: ContainerStats[] = lines.map(line => JSON.parse(line));
        resolve(stats);
      } catch (err) {
        console.error('Error parsing stats:', err);
        resolve([]);
      }
    });

    statsProcess.on('error', (err: Error) => {
      console.error('Error getting stats:', err);
      resolve([]);
    });
  });
}

/**
 * Restart a specific container
 */
function restartContainer(containerName: string, socket: MonitorSocket): void {
  console.log(`Restarting container: ${containerName}`);
  const restart = spawn('docker', ['restart', containerName]);
  
  restart.on('close', (code: number | null) => {
    const restartData: ContainerRestartData = {
      container: containerName,
      success: code === 0
    };
    socket.emit('container-restarted', restartData);
    
    // Restart log stream after container restart
    if (code === 0) {
      setTimeout(() => {
        startLogStream(containerName, socket);
      }, 2000);
    }
  });

  restart.on('error', (err: Error) => {
    console.error(`Error restarting container ${containerName}:`, err);
    const restartData: ContainerRestartData = {
      container: containerName,
      success: false
    };
    socket.emit('container-restarted', restartData);
  });
}

/**
 * Execute a command on the specified target
 */
function executeCommand(commandData: CommandData, socket: MonitorSocket): void {
  const { command, target, timestamp } = commandData;
  console.log(`Executing command "${command}" on target "${target}"`);

  let cmdProcess: ChildProcess;
  let cmdArgs: string[];

  if (target === 'host') {
    // Execute command directly on host
    cmdArgs = ['sh', '-c', command];
    cmdProcess = spawn(cmdArgs[0], cmdArgs.slice(1));
  } else if (target === 'all') {
    // Execute command on all agent containers
    const containers = ['agent-1', 'agent-2', 'agent-3'];
    containers.forEach(container => {
      const individualCommand: CommandData = {
        command,
        target: container as any,
        timestamp
      };
      executeCommand(individualCommand, socket);
    });
    return;
  } else {
    // Execute command in specific container
    cmdArgs = ['docker', 'exec', target, 'sh', '-c', command];
    cmdProcess = spawn(cmdArgs[0], cmdArgs.slice(1));
  }

  let output = '';
  let errorOutput = '';

  cmdProcess.stdout?.on('data', (data: Buffer) => {
    output += data.toString();
  });

  cmdProcess.stderr?.on('data', (data: Buffer) => {
    errorOutput += data.toString();
  });

  cmdProcess.on('close', (code: number | null) => {
    const result: CommandResult = {
      command,
      target,
      output: output || 'No output',
      error: errorOutput || undefined,
      timestamp: new Date().toISOString(),
      exitCode: code || 0
    };

    socket.emit('command-result', result);
  });

  cmdProcess.on('error', (err: Error) => {
    const result: CommandResult = {
      command,
      target,
      output: '',
      error: err.message,
      timestamp: new Date().toISOString(),
      exitCode: 1
    };

    socket.emit('command-result', result);
  });
}

// Socket connection handler
io.on('connection', (socket: MonitorSocket) => {
  console.log('Client connected:', socket.id);

  // Start log streams for all containers
  const containers = ['agent-1', 'agent-2', 'agent-3', 'nats'];
  containers.forEach(container => {
    startLogStream(container, socket);
  });

  // Send periodic stats updates
  const statsInterval = setInterval(async () => {
    const stats = await getContainerStats();
    socket.emit('stats', stats);
  }, 2000);

  // Handle client disconnect
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    clearInterval(statsInterval);
    
    // Clean up log streams for this client
    logStreams.forEach((stream, containerName) => {
      stream.kill();
      logStreams.delete(containerName);
    });
  });

  // Handle restart container requests
  socket.on('restart-container', (containerName: string) => {
    restartContainer(containerName, socket);
  });

  // Handle command execution requests
  socket.on('execute-command', (commandData: CommandData) => {
    executeCommand(commandData, socket);
  });
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down monitor server...');
  logStreams.forEach((stream) => {
    stream.kill();
  });
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('Shutting down monitor server...');
  logStreams.forEach((stream) => {
    stream.kill();
  });
  server.close(() => {
    process.exit(0);
  });
});

server.listen(PORT, () => {
  console.log(`Monitor server running on http://localhost:${PORT}`);
});