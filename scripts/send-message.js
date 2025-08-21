#!/usr/bin/env node

const { connect, StringCodec } = require('nats');

const NATS_URL = process.env.NATS_URL || 'nats://localhost:4222';
const sc = StringCodec();

async function sendTaskToAgents(taskData) {
  const nc = await connect({ servers: NATS_URL });
  
  const task = {
    id: `task-${Date.now()}`,
    type: 'claude',
    data: taskData,
    timestamp: new Date().toISOString(),
    priority: 'normal'
  };
  
  nc.publish('tasks.work', sc.encode(JSON.stringify(task)));
  console.log(`✅ Sent task: ${task.id}`);
  
  await nc.drain();
}

async function sendAgentEvent(agentId, eventType, eventData = {}) {
  const nc = await connect({ servers: NATS_URL });
  
  const event = {
    type: eventType,
    data: eventData,
    timestamp: new Date().toISOString(),
    source: 'external-client'
  };
  
  nc.publish(`agent.${agentId}.events`, sc.encode(JSON.stringify(event)));
  console.log(`✅ Sent ${eventType} event to ${agentId}`);
  
  await nc.drain();
}

async function sendBroadcast(message, type = 'announcement') {
  const nc = await connect({ servers: NATS_URL });
  
  const broadcast = {
    type: type,
    message: message,
    timestamp: new Date().toISOString(),
    priority: 'normal'
  };
  
  nc.publish('broadcast', sc.encode(JSON.stringify(broadcast)));
  console.log(`✅ Sent broadcast: ${message}`);
  
  await nc.drain();
}

async function listenForResults() {
  const nc = await connect({ servers: NATS_URL });
  
  // Subscribe to task results
  const resultSub = nc.subscribe('task.result');
  console.log('🔍 Listening for task results...');
  
  // Subscribe to heartbeats
  const heartbeatSub = nc.subscribe('agent.*.heartbeat');
  console.log('💓 Listening for agent heartbeats...');
  
  // Process results
  (async () => {
    for await (const msg of resultSub) {
      const result = JSON.parse(sc.decode(msg.data));
      console.log(`📋 Task Result from ${result.agentId}:`, {
        taskId: result.taskId,
        status: result.status,
        result: result.result.substring(0, 100) + (result.result.length > 100 ? '...' : ''),
        processingTime: result.processingTime + 'ms'
      });
    }
  })();
  
  // Process heartbeats
  (async () => {
    for await (const msg of heartbeatSub) {
      const heartbeat = JSON.parse(sc.decode(msg.data));
      console.log(`💓 ${heartbeat.agentId}: ${heartbeat.status} (${heartbeat.tasksProcessed} tasks processed)`);
    }
  })();
  
  // Keep listening
  console.log('\nPress Ctrl+C to exit...\n');
  
  process.on('SIGINT', async () => {
    console.log('\n👋 Shutting down...');
    await nc.drain();
    process.exit(0);
  });
}

// Command line interface
async function main() {
  const command = process.argv[2];
  const arg1 = process.argv[3];
  const arg2 = process.argv[4];
  
  try {
    switch (command) {
      case 'task':
        if (!arg1) {
          console.log('Usage: node send-message.js task "Your task description"');
          process.exit(1);
        }
        await sendTaskToAgents(arg1);
        break;
        
      case 'event':
        if (!arg1 || !arg2) {
          console.log('Usage: node send-message.js event <agent-id> <event-type>');
          console.log('Event types: status_request, restart, config_update');
          process.exit(1);
        }
        await sendAgentEvent(arg1, arg2);
        break;
        
      case 'broadcast':
        if (!arg1) {
          console.log('Usage: node send-message.js broadcast "Your message"');
          process.exit(1);
        }
        await sendBroadcast(arg1);
        break;
        
      case 'listen':
        await listenForResults();
        break;
        
      default:
        console.log('AI Flock NATS Message Sender');
        console.log('');
        console.log('Commands:');
        console.log('  task "description"           - Send a task to any available agent');
        console.log('  event <agent-id> <type>      - Send event to specific agent');
        console.log('  broadcast "message"          - Send message to all agents');
        console.log('  listen                       - Listen for responses and heartbeats');
        console.log('');
        console.log('Examples:');
        console.log('  node send-message.js task "Analyze this code for bugs"');
        console.log('  node send-message.js event agent-1 status_request');
        console.log('  node send-message.js broadcast "System maintenance starting"');
        console.log('  node send-message.js listen');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
