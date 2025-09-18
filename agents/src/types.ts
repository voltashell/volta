/**
 * Type definitions for the Volta Shell agent system
 */

export interface Task {
  id: string;
  type: string;
  data: any;
  timestamp?: string;
  priority?: 'low' | 'normal' | 'high';
  timeout?: number;
}

export interface TaskResult {
  agentId: string;
  taskId: string;
  status: 'completed' | 'failed' | 'processing';
  timestamp: string;
  result: string;
  error?: string;
  processingTime?: number;
}

export interface AgentEvent {
  type: 'config_update' | 'status_request' | 'restart' | 'custom';
  data: any;
  timestamp: string;
  source?: string;
}

export interface Heartbeat {
  agentId: string;
  status: 'alive' | 'stopping' | 'restarting';
  timestamp: string;
  uptime?: number;
  tasksProcessed?: number;
}

export interface BroadcastMessage {
  type: 'shutdown' | 'announcement' | 'config' | 'custom';
  message: string;
  timestamp: string;
  source?: string;
  priority?: 'low' | 'normal' | 'high';
}

export interface AgentConfig {
  id: string;
  natsUrl: string;
  sharedDir: string;
  heartbeatInterval?: number;
  maxRetries?: number;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  claudeApiKey?: string;
  claudeModel?: string;
}

export interface AgentDirs {
  agentDir: string;
  logsDir: string;
}

export interface ProcessingStats {
  tasksProcessed: number;
  tasksSucceeded: number;
  tasksFailed: number;
  averageProcessingTime: number;
  uptime: number;
}

export interface ClaudeConfig {
  apiKey: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
}

export interface ClaudeTask {
  prompt: string;
  systemInstruction?: string;
  context?: any;
}

export interface ClaudeResponse {
  text: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}