const { connect, StringCodec } = require('nats');

async function testParallelProcessing() {
  const nc = await connect({ servers: 'nats://localhost:4222' });
  const sc = StringCodec();
  
  console.log('🚀 Testing parallel agent processing...\n');
  
  // Subscribe to results
  const resultSub = nc.subscribe('task.result');
  let resultCount = 0;
  const startTime = Date.now();
  
  (async () => {
    for await (const msg of resultSub) {
      const result = JSON.parse(sc.decode(msg.data));
      resultCount++;
      console.log(`✅ Result ${resultCount} from ${result.agentId}: ${result.result} (${result.processingTime}ms)`);
      
      if (resultCount >= 9) { // 3 agents × 3 tasks = 9 results
        const totalTime = Date.now() - startTime;
        console.log(`\n📊 All ${resultCount} results received in ${totalTime}ms`);
        console.log(`💡 Parallel processing: ~${(totalTime/3).toFixed(0)}ms per task across 3 agents`);
        nc.close();
      }
    }
  })();
  
  // Send 3 tasks simultaneously
  console.log('📤 Sending 3 tasks to all agents simultaneously...\n');
  
  for (let i = 1; i <= 3; i++) {
    const task = {
      id: `parallel-test-${i}`,
      type: 'parallel-processing',
      data: {
        message: `Task ${i} - testing parallel execution`,
        delay: Math.random() * 50 + 25 // Random delay 25-75ms
      }
    };
    
    nc.publish('tasks.parallel', sc.encode(JSON.stringify(task)));
    console.log(`📨 Task ${i} sent to all agents`);
  }
  
  setTimeout(() => {
    console.log('\n⏰ Test timeout - closing connection');
    nc.close();
  }, 10000);
}

testParallelProcessing().catch(console.error);