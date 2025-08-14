/**
 * Type definitions for the AI Flock agent system
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
  geminiApiKey?: string;
  geminiModel?: string;
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

export interface GeminiConfig {
  apiKey: string;
  model: string;
  generationConfig?: {
    temperature?: number;
    topK?: number;
    topP?: number;
    maxOutputTokens?: number;
  };
}

export interface GeminiTask {
  prompt: string;
  systemInstruction?: string;
  context?: any;
}

export interface GeminiResponse {
  text: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}