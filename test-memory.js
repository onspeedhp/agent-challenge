// Test script to demonstrate memory functionality
const testMemory = async () => {
  const baseUrl = 'http://localhost:8080';
  const agentEndpoint = `${baseUrl}/api/agents/solanaExpertAgent/generate`;
  
  // Test conversation with memory
  const resourceId = 'test-user-123';
  const threadId = 'conversation-456';
  
  try {
    console.log('🧪 Testing Memory Functionality...\n');
    
    // First message - analyze a program
    console.log('📤 First message: Analyzing a program...');
    const firstResponse = await fetch(agentEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          { 
            role: 'user', 
            content: 'Analyze this program: 9gJ7jZaAvUafgTFPoqkCwbuvC9kpZCPtHfHjMkQ66wu9' 
          }
        ],
        resourceId,
        threadId,
      }),
    });
    
    const firstResult = await firstResponse.json();
    console.log('✅ First response received\n');
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Second message - reference the previous analysis
    console.log('📤 Second message: Referencing previous analysis...');
    const secondResponse = await fetch(agentEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          { 
            role: 'user', 
            content: 'What was the name of the program I just analyzed? How many instructions did it have?' 
          }
        ],
        resourceId,
        threadId,
      }),
    });
    
    const secondResult = await secondResponse.json();
    console.log('✅ Second response received');
    console.log('📋 Agent response:', secondResult.text?.substring(0, 200) + '...');
    
    console.log('\n🎉 Memory test completed! The agent should remember the previous program analysis.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('💡 Make sure the server is running with: mastra dev --dir src/mastra');
  }
};

// Run the test if this file is executed directly
if (typeof window === 'undefined') {
  testMemory();
}

module.exports = { testMemory }; 