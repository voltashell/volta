const { connect, StringCodec } = require('nats');
const fs = require('fs').promises;
const path = require('path');

const AGENT_ID = process.env.AGENT_ID || 'agent-unknown';
const NATS_URL = process.env.NATS_URL || 'nats://nats:4222';
const SHARED_DIR = process.env.SHARED_DIR || '/shared';

const sc = StringCodec();

async function ensureAgentDirs() {
  const agentDir = path.join(SHARED_DIR, 'agents', AGENT_ID);
  const logsDir = path.join(SHARED_DIR, 'logs');
  
  await fs.mkdir(agentDir, { recursive: true });
  await fs.mkdir(logsDir, { recursive: true });
  
  return { agentDir, logsDir };
}

async function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${AGENT_ID}] ${message}\n`;
  
  console.log(logMessage.trim());
  
  const logsDir = path.join(SHARED_DIR, 'logs');
  const logFile = path.join(logsDir, `${AGENT_ID}.log`);
  
  try {
    await fs.appendFile(logFile, logMessage);
  } catch (err) {
    console.error('Failed to write to log file:', err);
  }
}

async function processTask(data, agentDir) {
  const task = JSON.parse(sc.decode(data));
  await log(`Processing task: ${JSON.stringify(task)}`);
  
  // Simulate task processing
  const result = {
    agentId: AGENT_ID,
    taskId: task.id,
    status: 'completed',
    timestamp: new Date().toISOString(),
    result: `Task ${task.id} processed by ${AGENT_ID}`
  };
  
  // Write result to agent's directory
  const resultFile = path.join(agentDir, `task-${task.id}-result.json`);
  await fs.writeFile(resultFile, JSON.stringify(result, null, 2));
  
  await log(`Task ${task.id} completed, result saved to ${resultFile}`);
  
  return result;
}

async function main() {
  await log(`Agent ${AGENT_ID} starting...`);
  
  const { agentDir } = await ensureAgentDirs();
  
  let nc;
  let retries = 0;
  const maxRetries = 10;
  
  // Retry connection with exponential backoff
  while (retries < maxRetries) {
    try {
      nc = await connect({ servers: NATS_URL });
      await log(`Connected to NATS at ${NATS_URL}`);
      break;
    } catch (err) {
      retries++;
      const delay = Math.min(1000 * Math.pow(2, retries), 30000);
      await log(`Failed to connect to NATS (attempt ${retries}/${maxRetries}): ${err.message}`);
      if (retries < maxRetries) {
        await log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  if (!nc) {
    await log('Failed to connect to NATS after maximum retries');
    process.exit(1);
  }
  
  // Subscribe to task queue
  const taskSub = nc.subscribe('tasks.*');
  await log('Subscribed to tasks.*');
  
  // Subscribe to agent-specific events
  const agentSub = nc.subscribe(`agent.${AGENT_ID}.events`);
  await log(`Subscribed to agent.${AGENT_ID}.events`);
  
  // Subscribe to broadcast messages
  const broadcastSub = nc.subscribe('broadcast');
  await log('Subscribed to broadcast');
  
  // Send heartbeat every 30 seconds
  const heartbeatInterval = setInterval(async () => {
    const heartbeat = {
      agentId: AGENT_ID,
      status: 'alive',
      timestamp: new Date().toISOString()
    };
    nc.publish(`agent.${AGENT_ID}.heartbeat`, sc.encode(JSON.stringify(heartbeat)));
  }, 30000);
  
  // Process tasks
  (async () => {
    for await (const msg of taskSub) {
      try {
        const result = await processTask(msg.data, agentDir);
        // Publish result
        nc.publish(`task.result`, sc.encode(JSON.stringify(result)));
      } catch (err) {
        await log(`Error processing task: ${err.message}`);
      }
    }
  })();
  
  // Process agent-specific events
  (async () => {
    for await (const msg of agentSub) {
      const event = JSON.parse(sc.decode(msg.data));
      await log(`Received agent event: ${JSON.stringify(event)}`);
    }
  })();
  
  // Process broadcast messages
  (async () => {
    for await (const msg of broadcastSub) {
      const broadcast = JSON.parse(sc.decode(msg.data));
      await log(`Received broadcast: ${JSON.stringify(broadcast)}`);
    }
  })();
  
  // Handle graceful shutdown
  process.on('SIGTERM', async () => {
    await log('Received SIGTERM, shutting down gracefully...');
    clearInterval(heartbeatInterval);
    await nc.drain();
    process.exit(0);
  });
  
  process.on('SIGINT', async () => {
    await log('Received SIGINT, shutting down gracefully...');
    clearInterval(heartbeatInterval);
    await nc.drain();
    process.exit(0);
  });
  
  await log(`Agent ${AGENT_ID} is running and ready to process tasks`);
}

main().catch(async (err) => {
  await log(`Fatal error: ${err.message}`);
  console.error(err);
  process.exit(1);
});