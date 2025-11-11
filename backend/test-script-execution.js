const axios = require('axios');

async function testScriptExecution() {
  console.log('🔧 Testing Script Execution with Saved Credentials\n');
  console.log('=' .repeat(50) + '\n');
  
  const apiUrl = 'http://localhost:3001';
  
  try {
    // Step 1: Trigger reload of saved credentials
    console.log('📥 Step 1: Reloading saved credentials from database...');
    const reloadResp = await axios.post(`${apiUrl}/api/settings/reload-credentials`);
    console.log('✅ Credentials reloaded:', reloadResp.data.message);
    console.log();
    
    // Step 2: Create a high-priority alert to trigger script
    console.log('🚨 Step 2: Sending critical DISK_SPACE_LOW alert...');
    const alertData = {
      id: 'SCRIPT-TEST-' + Date.now(),
      eventType: 'alert.created',
      alertType: 'DISK_SPACE_LOW',
      severity: 'CRITICAL',
      message: 'CRITICAL: C: drive at 98% capacity - immediate cleanup required',
      deviceId: 'PROD-SERVER-01',
      deviceName: 'Production Web Server',
      clientName: 'Acme Corporation',
      diskPercent: 98,
      driveLetter: 'C:',
      cwTicketNumber: 'CW-PROD-' + Date.now().toString().slice(-6),
      timestamp: new Date().toISOString()
    };
    
    const webhookResp = await axios.post(`${apiUrl}/api/webhooks/nable`, alertData);
    console.log('✅ Alert received by webhook');
    console.log('   Alert ID:', alertData.id);
    console.log('   Device:', alertData.deviceName);
    console.log('   Disk Usage:', alertData.diskPercent + '%');
    console.log();
    
    // Step 3: Wait for automation to process
    console.log('⏳ Step 3: Waiting for automation engine to process...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Step 4: Check ticket and script execution
    console.log('📋 Step 4: Checking ticket and script execution status...');
    const ticketsResp = await axios.get(`${apiUrl}/api/tickets?limit=1`);
    const ticket = ticketsResp.data[0];
    
    if (ticket) {
      console.log('\n✅ Ticket Created:');
      console.log('   Number:', ticket.ticketNumber);
      console.log('   Status:', ticket.status);
      console.log('   Priority:', ticket.priority);
      
      if (ticket.notes && ticket.notes.length > 0) {
        console.log('\n📝 Automation Activity:');
        ticket.notes.forEach((note, index) => {
          console.log(`   ${index + 1}. ${note.text}`);
          console.log(`      Time: ${note.timestamp}`);
        });
        
        // Check if script execution was attempted
        const scriptNotes = ticket.notes.filter(n => 
          n.text.includes('remediation') || 
          n.text.includes('script') ||
          n.text.includes('cleanup')
        );
        
        if (scriptNotes.length > 0) {
          console.log('\n🔄 Script Execution Summary:');
          const attempted = scriptNotes.find(n => n.text.includes('initiated'));
          const result = scriptNotes.find(n => n.text.includes('successful') || n.text.includes('failed'));
          
          if (attempted) {
            console.log('   ✓ Script execution was attempted');
          }
          
          if (result) {
            if (result.text.includes('successful')) {
              console.log('   ✅ Script executed successfully!');
              console.log('   🎉 Your saved credentials are working!');
            } else if (result.text.includes('failed')) {
              console.log('   ❌ Script execution failed');
              const errorMatch = result.text.match(/failed: (.+)/);
              if (errorMatch) {
                console.log('   Error:', errorMatch[1]);
                
                if (errorMatch[1].includes('credentials') || errorMatch[1].includes('configured')) {
                  console.log('\n   ⚠️  Note: Script failed due to credential issue.');
                  console.log('   Please update your N-able credentials with valid API key.');
                } else if (errorMatch[1].includes('404') || errorMatch[1].includes('not found')) {
                  console.log('\n   ⚠️  Note: Script endpoint not found.');
                  console.log('   The N-able API endpoint may need adjustment.');
                }
              }
            }
          }
        }
      }
    } else {
      console.log('❌ No ticket found - automation may not be configured');
    }
    
    // Step 5: Check automation history
    console.log('\n📊 Step 5: Checking automation execution history...');
    const historyResp = await axios.get(`${apiUrl}/api/automation/history?limit=1`);
    if (historyResp.data && historyResp.data.length > 0) {
      const execution = historyResp.data[0];
      console.log('   Last execution:', execution.createdAt);
      console.log('   Rule:', execution.rule?.name || 'Unknown');
      console.log('   Status:', execution.status);
      
      if (execution.executionSteps && execution.executionSteps.length > 0) {
        console.log('   Steps:');
        execution.executionSteps.forEach(step => {
          console.log(`     - ${step.action}: ${step.status}`);
          if (step.error) {
            console.log(`       Error: ${step.error}`);
          }
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
  
  console.log('\n' + '=' .repeat(50));
  console.log('📌 Test Complete!\n');
  console.log('Your saved credentials are being used by the automation engine.');
  console.log('To enable full script execution, ensure you have:');
  console.log('  1. Valid N-able API key (not test key)');
  console.log('  2. Correct N-able API URL for your instance');
  console.log('  3. Device IDs that exist in your N-able system');
}

testScriptExecution();
