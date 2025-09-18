export interface ContainerStat {
  Name: string;
  CPUPerc: string;
  MemUsage: string;
  NetIO: string;
  BlockIO: string;
  PIDs: string;
  State?: string;
  StatusText?: string;
}

export interface LogData {
  container: string;
  data: string;
  timestamp: string;
  isError: boolean;
}

export interface CommandResult {
  command: string;
  target: string;
  output: string;
  timestamp: string;
  exitCode: number;
  error?: string;
}

export interface ExecuteCommand {
  command: string;
  target: string;
  timestamp: string;
}

export interface RestartResponse {
  container: string;
  success: boolean;
}

export interface ErrorData {
  container: string;
  message: string;
}

export type ContainerName = 'agent-1' | 'agent-2' | 'agent-3' | 'nats';
export type TargetType = 'host' | 'all' | ContainerName;

export interface ConnectionStatus {
  connected: boolean;
  lastSeen?: Date;
}
