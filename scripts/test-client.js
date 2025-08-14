#!/usr/bin/env node

const { connect, StringCodec } = require('nats');

const NATS_URL = process.env.NATS_URL || 'nats://localhost:4222';
const sc = StringCodec();

async function main() {
  console.log(`Connecting to NATS at ${NATS_URL}...`);
  
  let nc;
  try {
    nc = await connect({ servers: NATS_URL });
    console.log('Connected to NATS');
  } catch (err) {
    console.error('Failed to connect to NATS:', err.message);
    process.exit(1);
  }
  
  // Subscribe to task results
  const resultSub = nc.subscribe('task.result');
  console.log('Subscribed to task.result');
  
  // Subscribe to agent heartbeats
  const heartbeatSub = nc.subscribe('agent.*.heartbeat');
  console.log('Subscribed to agent heartbeats');
  
  // Process results
  (async () => {
    for await (const msg of resultSub) {
      const result = JSON.parse(sc.decode(msg.data));
      console.log('Task result received:', result);
    }
  })();
  
  // Process heartbeats
  (async () => {
    for await (const msg of heartbeatSub) {
      const heartbeat = JSON.parse(sc.decode(msg.data));
      console.log(`Heartbeat from ${heartbeat.agentId}: ${heartbeat.status}`);
    }
  })();
  
  // Publish test tasks
  console.log('\nPublishing test tasks...');
  
  for (let i = 1; i <= 5; i++) {
    const task = {
      id: `task-${Date.now()}-${i}`,
      type: 'test',
      data: `Test task ${i}`,
      timestamp: new Date().toISOString()
    };
    
    nc.publish('tasks.test', sc.encode(JSON.stringify(task)));
    console.log(`Published task ${task.id}`);
    
    // Small delay between tasks
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Send a broadcast message
  const broadcast = {
    type: 'announcement',
    message: 'All agents: system test in progress',
    timestamp: new Date().toISOString()
  };
  nc.publish('broadcast', sc.encode(JSON.stringify(broadcast)));
  console.log('Sent broadcast message');
  
  // Keep the client running to receive results
  console.log('\nListening for results and heartbeats (press Ctrl+C to exit)...\n');
  
  // Handle graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('\nShutting down...');
    await nc.drain();
    process.exit(0);
  });
  
  process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    await nc.drain();
    process.exit(0);
  });
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});