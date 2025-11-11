const axios = require('axios');

async function updateRealCredentials() {
  const apiUrl = 'http://localhost:3001';
  
  console.log('📝 Updating with REAL credentials...\n');
  
  try {
    // Update with real credentials
    const saveResponse = await axios.put(`${apiUrl}/api/settings`, {
      connectwise: {
        apiUrl: 'https://api-na.myconnectwise.net/v4_6_release/apis/3.0',
        companyId: 'Somos',
        publicKey: 'jSPLwWW1zDjO7i08',
        privateKey: 'KH1S5voDwhKDGHb7',
        clientId: '0ea93dc0-6921-4d58-919a-4433616ef054',
        isActive: true
      },
      nable: {
        apiUrl: 'https://www.systemmonitor.us',
        apiKey: '5232f3bf28767776bbf7346a42d69450',
        isActive: true
      }
    });
    
    console.log('✅ Credentials saved:', saveResponse.data.message);
    
    // Reload credentials in services
    console.log('\n🔄 Reloading credentials in services...');
    const reloadResponse = await axios.post(`${apiUrl}/api/settings/reload-credentials`);
    console.log('✅', reloadResponse.data.message);
    
    // Test ConnectWise connection
    console.log('\n🔌 Testing ConnectWise connection with real credentials...');
    const cwTest = await axios.post(`${apiUrl}/api/settings/test-connection/connectwise`, {
      url: 'https://api-na.myconnectwise.net/v4_6_release/apis/3.0',
      companyId: 'Somos',
      publicKey: 'jSPLwWW1zDjO7i08',
      privateKey: 'KH1S5voDwhKDGHb7',
      clientId: '0ea93dc0-6921-4d58-919a-4433616ef054'
    });
    console.log('ConnectWise:', cwTest.data.success ? '✅ Connected' : '❌ Failed', '-', cwTest.data.message);
    
    // Test N-able connection
    console.log('\n🔌 Testing N-able connection with real credentials...');
    const nableTest = await axios.post(`${apiUrl}/api/settings/test-connection/nable`, {
      url: 'https://www.systemmonitor.us',
      accessKey: '5232f3bf28767776bbf7346a42d69450'
    });
    console.log('N-able:', nableTest.data.success ? '✅ Connected' : '❌ Failed', '-', nableTest.data.message);
    if (nableTest.data.details) {
      console.log('  Details:', JSON.stringify(nableTest.data.details, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

updateRealCredentials();
