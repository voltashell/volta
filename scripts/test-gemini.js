const { connect, StringCodec } = require('nats');

async function testGeminiIntegration() {
  const nc = await connect({ servers: 'nats://localhost:4222' });
  const sc = StringCodec();
  
  console.log('🤖 Testing Gemini integration with AI Flock agents...\n');
  
  // Subscribe to results
  const resultSub = nc.subscribe('task.result');
  let resultCount = 0;
  
  (async () => {
    for await (const msg of resultSub) {
      const result = JSON.parse(sc.decode(msg.data));
      resultCount++;
      console.log(`✅ Result ${resultCount} from ${result.agentId}:`);
      console.log(`   Task: ${result.taskId}`);
      console.log(`   Status: ${result.status}`);
      console.log(`   Result: ${result.result.substring(0, 200)}${result.result.length > 200 ? '...' : ''}`);
      console.log(`   Time: ${result.processingTime}ms\n`);
      
      if (resultCount >= 3) { // Expecting 3 results from 3 agents
        console.log('📊 All Gemini test results received!');
        nc.close();
      }
    }
  })();
  
  // Send a Gemini AI task
  console.log('📤 Sending Gemini AI task to all agents...\n');
  
  const geminiTask = {
    id: `gemini-test-${Date.now()}`,
    type: 'gemini',
    data: {
      useGemini: true,
      prompt: 'You are an AI agent in a distributed system. Explain in 1-2 sentences what you can do to help process tasks efficiently.',
      task: 'introduction'
    }
  };
  
  nc.publish('tasks.gemini', sc.encode(JSON.stringify(geminiTask)));
  console.log('📨 Gemini task sent to all agents');
  console.log('🔍 Waiting for responses...\n');
  
  setTimeout(() => {
    console.log('\n⏰ Test timeout - closing connection');
    nc.close();
  }, 30000); // 30 second timeout for Gemini responses
}

testGeminiIntegration().catch(console.error);