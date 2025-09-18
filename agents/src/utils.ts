/**
 * Utility functions for the Volta Shell agent system
 */

import { promises as fs } from 'fs';
import path from 'path';
import { AgentDirs } from './types';

/**
 * Ensures agent directories exist with proper permissions
 */
export async function ensureAgentDirs(sharedDir: string, agentId: string): Promise<AgentDirs> {
  const agentDir = path.join(sharedDir, 'agents', agentId);
  const logsDir = path.join(sharedDir, 'logs');
  
  await fs.mkdir(agentDir, { recursive: true });
  await fs.mkdir(logsDir, { recursive: true });
  
  return { agentDir, logsDir };
}

/**
 * Centralized logging function with file and console output
 */
export async function log(message: string, agentId: string, sharedDir: string): Promise<void> {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${agentId}] ${message}\n`;
  
  console.log(logMessage.trim());
  
  const logsDir = path.join(sharedDir, 'logs');
  const logFile = path.join(logsDir, `${agentId}.log`);
  
  try {
    await fs.appendFile(logFile, logMessage);
  } catch (err: any) {
    console.error('Failed to write to log file:', err);
  }
}

/**
 * Calculate exponential backoff delay
 */
export function calculateBackoffDelay(retryCount: number, baseDelay = 1000, maxDelay = 30000): number {
  return Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);
}

/**
 * Generate a unique task ID
 */
export function generateTaskId(prefix = 'task'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Validate task object structure
 */
export function isValidTask(obj: any): boolean {
  return obj && 
         typeof obj === 'object' &&
         typeof obj.id === 'string' &&
         typeof obj.type === 'string' &&
         obj.data !== undefined;
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Format uptime in human readable format
 */
export function formatUptime(uptimeMs: number): string {
  const seconds = Math.floor(uptimeMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `${days}d ${hours % 24}h ${minutes % 60}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}