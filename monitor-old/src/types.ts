/**
 * Type definitions for the AI Flock Monitor
 */

export interface LogData {
  container: string;
  data: string;
  timestamp: string;
  isError?: boolean;
}

export interface ContainerStats {
  BlockIO: string;
  CPUPerc: string;
  Container: string;
  ID: string;
  MemPerc: string;
  MemUsage: string;
  Name: string;
  NetIO: string;
  PIDs: string;
}

export interface ErrorData {
  container: string;
  message: string;
}

export interface ContainerRestartData {
  container: string;
  success: boolean;
}

export interface ClientSocket extends Socket {
  id: string;
}

export interface LogStream {
  container: string;
  process: ChildProcess;
}

// Socket.IO event types
export interface ServerToClientEvents {
  log: (data: LogData) => void;
  stats: (stats: ContainerStats[]) => void;
  error: (error: ErrorData) => void;
  'container-restarted': (data: ContainerRestartData) => void;
  'command-result': (result: CommandResult) => void;
}

export interface ClientToServerEvents {
  'restart-container': (containerName: string) => void;
  'execute-command': (data: CommandData) => void;
}

export interface CommandData {
  command: string;
  target: 'all' | 'agent-1' | 'agent-2' | 'agent-3' | 'nats' | 'host';
  timestamp: string;
}

export interface CommandResult {
  command: string;
  target: string;
  output: string;
  error?: string;
  timestamp: string;
  exitCode?: number;
}

export interface InterServerEvents {
  // No inter-server events for this application
}

export interface SocketData {
  // No additional socket data for this application
}

export type MonitorSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

import { Socket } from 'socket.io';
import { ChildProcess } from 'child_process';