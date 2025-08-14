import { connect, NatsConnection, StringCodec, Subscription, Msg } from 'nats';
import { promises as fs } from 'fs';
import path from 'path';
import { Task, TaskResult, AgentEvent, Heartbeat, BroadcastMessage, AgentConfig, ProcessingStats } from './types';
import { ensureAgentDirs, log, calculateBackoffDelay, isValidTask, sleep, formatUptime } from './utils';

// Environment configuration
const config: AgentConfig = {
  id: process.env.AGENT_ID || 'agent-unknown',
  natsUrl: process.env.NATS_URL || 'nats://nats:4222',
  sharedDir: process.env.SHARED_DIR || '/shared',
  heartbeatInterval: parseInt(process.env.HEARTBEAT_INTERVAL || '30000'),
  maxRetries: parseInt(process.env.MAX_RETRIES || '10'),
  logLevel: (process.env.LOG_LEVEL as any) || 'info'
};

// String codec for NATS messages
const sc = StringCodec();

// Agent statistics
const stats: ProcessingStats = {
  tasksProcessed: 0,
  tasksSucceeded: 0,
  tasksFailed: 0,
  averageProcessingTime: 0,
  uptime: 0
};

const startTime = Date.now();

/**
 * Process an incoming task and return the result
 */
async function processTask(data: Uint8Array, agentDir: string): Promise<TaskResult> {
  const taskStartTime = Date.now();
  
  try {
    const taskData = JSON.parse(sc.decode(data));
    
    if (!isValidTask(taskData)) {
      throw new Error('Invalid task structure');
    }
    
    const task: Task = taskData;
    await log(`Processing task: ${JSON.stringify(task)}`, config.id, config.sharedDir);
    
    // Simulate task processing with some async work
    const processingTime = Math.random() * 100;
    await sleep(processingTime);
    
    const result: TaskResult = {
      agentId: config.id,
      taskId: task.id,
      status: 'completed',
      timestamp: new Date().toISOString(),
      result: `Task ${task.id} processed by ${config.id}`,
      processingTime: Date.now() - taskStartTime
    };
    
    // Write result to agent's directory
    const resultFile = path.join(agentDir, `task-${task.id}-result.json`);
    await fs.writeFile(resultFile, JSON.stringify(result, null, 2));
    
    // Update statistics
    stats.tasksProcessed++;
    stats.tasksSucceeded++;
    stats.averageProcessingTime = ((stats.averageProcessingTime * (stats.tasksProcessed - 1)) + result.processingTime!) / stats.tasksProcessed;
    
    await log(`Task ${task.id} completed in ${result.processingTime}ms, result saved to ${resultFile}`, config.id, config.sharedDir);
    
    return result;
  } catch (error: any) {
    const result: TaskResult = {
      agentId: config.id,
      taskId: 'unknown',
      status: 'failed',
      timestamp: new Date().toISOString(),
      result: 'Task processing failed',
      error: error.message,
      processingTime: Date.now() - taskStartTime
    };
    
    // Update statistics
    stats.tasksProcessed++;
    stats.tasksFailed++;
    
    await log(`Task processing failed: ${error.message}`, config.id, config.sharedDir);
    return result;
  }
}

/**
 * Handle agent-specific events
 */
async function handleAgentEvent(data: Uint8Array): Promise<void> {
  try {
    const event: AgentEvent = JSON.parse(sc.decode(data));
    await log(`Received agent event: ${JSON.stringify(event)}`, config.id, config.sharedDir);
    
    // Handle specific event types
    switch (event.type) {
      case 'config_update':
        await log('Received configuration update', config.id, config.sharedDir);
        break;
      case 'status_request':
        await log(`Agent status: ${JSON.stringify(getAgentStatus())}`, config.id, config.sharedDir);
        break;
      case 'restart':
        await log('Received restart command', config.id, config.sharedDir);
        process.exit(0);
      default:
        await log(`Unknown event type: ${event.type}`, config.id, config.sharedDir);
    }
  } catch (error: any) {
    await log(`Error processing agent event: ${error.message}`, config.id, config.sharedDir);
  }
}

/**
 * Handle broadcast messages
 */
async function handleBroadcast(data: Uint8Array): Promise<void> {
  try {
    const broadcast: BroadcastMessage = JSON.parse(sc.decode(data));
    await log(`Received broadcast: ${JSON.stringify(broadcast)}`, config.id, config.sharedDir);
    
    // Handle specific broadcast types
    switch (broadcast.type) {
      case 'shutdown':
        await log('Received shutdown broadcast', config.id, config.sharedDir);
        process.exit(0);
      case 'announcement':
        await log(`System announcement: ${broadcast.message}`, config.id, config.sharedDir);
        break;
      default:
        await log(`Broadcast: ${broadcast.message}`, config.id, config.sharedDir);
    }
  } catch (error: any) {
    await log(`Error processing broadcast: ${error.message}`, config.id, config.sharedDir);
  }
}

/**
 * Get current agent status
 */
function getAgentStatus() {
  stats.uptime = Date.now() - startTime;
  return {
    agentId: config.id,
    uptime: formatUptime(stats.uptime),
    stats: { ...stats },
    config: { ...config },
    timestamp: new Date().toISOString()
  };
}

/**
 * Send periodic heartbeat to indicate agent health
 */
function startHeartbeat(nc: NatsConnection): NodeJS.Timeout {
  return setInterval(async () => {
    try {
      const heartbeat: Heartbeat = {
        agentId: config.id,
        status: 'alive',
        timestamp: new Date().toISOString(),
        uptime: Date.now() - startTime,
        tasksProcessed: stats.tasksProcessed
      };
      nc.publish(`agent.${config.id}.heartbeat`, sc.encode(JSON.stringify(heartbeat)));
    } catch (error: any) {
      await log(`Error sending heartbeat: ${error.message}`, config.id, config.sharedDir);
    }
  }, config.heartbeatInterval);
}

/**
 * Setup graceful shutdown handlers
 */
function setupShutdownHandlers(nc: NatsConnection, heartbeatInterval: NodeJS.Timeout): void {
  const shutdown = async (signal: string) => {
    await log(`Received ${signal}, shutting down gracefully...`, config.id, config.sharedDir);
    
    // Send final heartbeat
    try {
      const heartbeat: Heartbeat = {
        agentId: config.id,
        status: 'stopping',
        timestamp: new Date().toISOString(),
        uptime: Date.now() - startTime,
        tasksProcessed: stats.tasksProcessed
      };
      nc.publish(`agent.${config.id}.heartbeat`, sc.encode(JSON.stringify(heartbeat)));
    } catch (error: any) {
      await log(`Error sending shutdown heartbeat: ${error.message}`, config.id, config.sharedDir);
    }
    
    clearInterval(heartbeatInterval);
    await nc.drain();
    process.exit(0);
  };
  
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

/**
 * Connect to NATS with retry logic and exponential backoff
 */
async function connectToNATS(): Promise<NatsConnection> {
  let retries = 0;
  
  while (retries < config.maxRetries!) {
    try {
      const nc = await connect({ servers: config.natsUrl });
      await log(`Connected to NATS at ${config.natsUrl}`, config.id, config.sharedDir);
      return nc;
    } catch (err: any) {
      retries++;
      const delay = calculateBackoffDelay(retries);
      await log(`Failed to connect to NATS (attempt ${retries}/${config.maxRetries}): ${err.message}`, config.id, config.sharedDir);
      
      if (retries < config.maxRetries!) {
        await log(`Retrying in ${delay}ms...`, config.id, config.sharedDir);
        await sleep(delay);
      }
    }
  }
  
  throw new Error('Failed to connect to NATS after maximum retries');
}

/**
 * Setup NATS subscriptions and message handlers
 */
async function setupSubscriptions(nc: NatsConnection, agentDir: string): Promise<void> {
  // Subscribe to task queue
  const taskSub: Subscription = nc.subscribe('tasks.*');
  await log('Subscribed to tasks.*', config.id, config.sharedDir);
  
  // Subscribe to agent-specific events
  const agentSub: Subscription = nc.subscribe(`agent.${config.id}.events`);
  await log(`Subscribed to agent.${config.id}.events`, config.id, config.sharedDir);
  
  // Subscribe to broadcast messages
  const broadcastSub: Subscription = nc.subscribe('broadcast');
  await log('Subscribed to broadcast', config.id, config.sharedDir);
  
  // Process tasks
  (async () => {
    for await (const msg of taskSub) {
      try {
        const result = await processTask(msg.data, agentDir);
        // Publish result
        nc.publish('task.result', sc.encode(JSON.stringify(result)));
      } catch (err: any) {
        await log(`Error processing task: ${err.message}`, config.id, config.sharedDir);
      }
    }
  })().catch(async (err: any) => {
    await log(`Task subscription error: ${err.message}`, config.id, config.sharedDir);
  });
  
  // Process agent-specific events
  (async () => {
    for await (const msg of agentSub) {
      await handleAgentEvent(msg.data);
    }
  })().catch(async (err: any) => {
    await log(`Agent subscription error: ${err.message}`, config.id, config.sharedDir);
  });
  
  // Process broadcast messages
  (async () => {
    for await (const msg of broadcastSub) {
      await handleBroadcast(msg.data);
    }
  })().catch(async (err: any) => {
    await log(`Broadcast subscription error: ${err.message}`, config.id, config.sharedDir);
  });
}

/**
 * Main agent entry point
 */
async function main(): Promise<void> {
  await log(`Agent ${config.id} starting with config: ${JSON.stringify(config)}`, config.id, config.sharedDir);
  
  // Ensure directories exist
  const { agentDir } = await ensureAgentDirs(config.sharedDir, config.id);
  
  // Connect to NATS
  const nc = await connectToNATS();
  
  // Setup subscriptions and message handlers
  await setupSubscriptions(nc, agentDir);
  
  // Start heartbeat
  const heartbeatInterval = startHeartbeat(nc);
  
  // Setup graceful shutdown
  setupShutdownHandlers(nc, heartbeatInterval);
  
  await log(`Agent ${config.id} is running and ready to process tasks`, config.id, config.sharedDir);
}

// Start the agent
main().catch(async (err: any) => {
  await log(`Fatal error: ${err.message}`, config.id, config.sharedDir);
  console.error(err);
  process.exit(1);
});