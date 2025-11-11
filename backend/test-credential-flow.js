const axios = require('axios');

async function testCredentialFlow() {
  const apiUrl = 'http://localhost:3001';
  
  console.log('📝 Step 1: Saving test N-able credentials...');
  try {
    // Save N-able credentials
    const saveResponse = await axios.put(`${apiUrl}/api/settings`, {
      nable: {
        apiUrl: 'https://www.systemmonitor.us',
        apiKey: 'test-api-key-123',
        isActive: true
      },
      connectwise: {
        apiUrl: 'https://api-na.myconnectwise.net/v4_6_release/apis/3.0',
        companyId: 'test-company',
        publicKey: 'test-public',
        privateKey: 'test-private',
        clientId: 'test-client-id',
        isActive: true
      }
    });
    console.log('✅ Settings saved:', saveResponse.data.message);
    
    // Reload credentials
    console.log('\n🔄 Step 2: Reloading credentials in services...');
    const reloadResponse = await axios.post(`${apiUrl}/api/settings/reload-credentials`);
    console.log('✅ Reload response:', reloadResponse.data.message);
    
    // Send test webhook to trigger automation
    console.log('\n🚀 Step 3: Sending test alert webhook...');
    const webhookResponse = await axios.post(`${apiUrl}/api/webhooks/nable`, {
      id: 'TEST-' + Date.now(),
      eventType: 'alert.created',
      alertType: 'DISK_SPACE_LOW',
      severity: 'CRITICAL',
      message: 'Test: Disk space low',
      deviceId: 'TEST-DEVICE-01',
      deviceName: 'Test Server',
      clientName: 'Test Client',
      diskPercent: 92,
      driveLetter: 'C:',
      cwTicketNumber: 'CW-TEST-' + Date.now(),
      timestamp: new Date().toISOString()
    });
    console.log('✅ Webhook accepted:', webhookResponse.data);
    
    // Check latest ticket
    console.log('\n📋 Step 4: Checking automation execution...');
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
    
    const ticketsResponse = await axios.get(`${apiUrl}/api/tickets?limit=1`);
    const latestTicket = ticketsResponse.data[0];
    
    if (latestTicket) {
      console.log('\n📑 Latest ticket:', {
        number: latestTicket.ticketNumber,
        alertType: latestTicket.metadata?.nableData?.alertType,
        device: latestTicket.deviceName,
        notes: latestTicket.notes?.length || 0
      });
      
      if (latestTicket.notes && latestTicket.notes.length > 0) {
        console.log('\n📝 Automation notes:');
        latestTicket.notes.forEach(note => {
          console.log('  •', note.text.substring(0, 100));
        });
      }
    }
    
    console.log('\n✅ Test completed!');
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

testCredentialFlow();
