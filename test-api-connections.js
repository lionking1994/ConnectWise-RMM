/**
 * API Connection Test Script
 * Tests both ConnectWise and N-able API connections
 */

const axios = require('axios');
require('dotenv').config();

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  magenta: '\x1b[35m'
};

console.log(`${colors.magenta}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
console.log(`${colors.blue}                    API CONNECTION TEST SUITE                                  ${colors.reset}`);
console.log(`${colors.magenta}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

// Configuration from environment
const config = {
  backend: {
    url: process.env.API_URL || 'http://localhost:3001'
  },
  connectwise: {
    url: process.env.CONNECTWISE_API_URL || 'https://api-na.myconnectwise.net/v4_6_release/apis/3.0',
    companyId: process.env.CONNECTWISE_COMPANY_ID || 'somos',
    publicKey: process.env.CONNECTWISE_PUBLIC_KEY || '',
    privateKey: process.env.CONNECTWISE_PRIVATE_KEY || '',
    clientId: process.env.CONNECTWISE_CLIENT_ID || '0ea93dc0-6921-4d58-919a-4433616ef054'
  },
  nable: {
    url: process.env.NABLE_API_URL || 'https://www.systemmonitor.us',
    apiKey: process.env.NABLE_API_KEY || ''
  }
};

// Test results storage
const results = {
  backend: { status: 'pending', message: '' },
  connectwise: { status: 'pending', message: '' },
  nable: { status: 'pending', message: '' }
};

// Test Backend Health
async function testBackendHealth() {
  console.log(`${colors.blue}Testing Backend API...${colors.reset}`);
  
  try {
    const response = await axios.get(`${config.backend.url}/health`, {
      timeout: 5000
    });
    
    if (response.status === 200) {
      results.backend.status = 'success';
      results.backend.message = 'Backend is running';
      console.log(`  ${colors.green}✅ Backend API is healthy${colors.reset}`);
      return true;
    }
  } catch (error) {
    results.backend.status = 'error';
    results.backend.message = error.message;
    console.log(`  ${colors.red}❌ Backend is not accessible${colors.reset}`);
    console.log(`     Please start it with: cd backend && npm run dev`);
    return false;
  }
}

// Test ConnectWise Connection via Backend
async function testConnectWise() {
  console.log(`\n${colors.blue}Testing ConnectWise Connection...${colors.reset}`);
  
  if (!config.connectwise.publicKey || !config.connectwise.privateKey) {
    console.log(`  ${colors.yellow}⚠️  ConnectWise credentials not configured${colors.reset}`);
    console.log(`     Add to .env: CONNECTWISE_PUBLIC_KEY and CONNECTWISE_PRIVATE_KEY`);
    results.connectwise.status = 'skipped';
    results.connectwise.message = 'Missing credentials';
    return;
  }
  
  try {
    const response = await axios.post(
      `${config.backend.url}/api/settings/test-connection/connectwise`,
      {
        url: config.connectwise.url,
        companyId: config.connectwise.companyId,
        publicKey: config.connectwise.publicKey,
        privateKey: config.connectwise.privateKey,
        clientId: config.connectwise.clientId
      },
      { timeout: 10000 }
    );
    
    if (response.data.success) {
      results.connectwise.status = 'success';
      results.connectwise.message = response.data.message;
      console.log(`  ${colors.green}✅ ConnectWise API connected successfully${colors.reset}`);
      console.log(`     Company: ${colors.yellow}${config.connectwise.companyId}${colors.reset}`);
      if (response.data.details?.version) {
        console.log(`     Version: ${colors.yellow}${response.data.details.version}${colors.reset}`);
      }
    } else {
      results.connectwise.status = 'error';
      results.connectwise.message = response.data.message;
      console.log(`  ${colors.red}❌ ConnectWise connection failed${colors.reset}`);
      console.log(`     Error: ${response.data.message}`);
    }
  } catch (error) {
    results.connectwise.status = 'error';
    results.connectwise.message = error.response?.data?.message || error.message;
    console.log(`  ${colors.red}❌ ConnectWise test failed${colors.reset}`);
    console.log(`     Error: ${results.connectwise.message}`);
    
    if (error.response?.data?.hint) {
      console.log(`     ${colors.yellow}Hint: ${error.response.data.hint}${colors.reset}`);
    }
  }
}

// Test N-able Connection via Backend
async function testNable() {
  console.log(`\n${colors.blue}Testing N-able Connection...${colors.reset}`);
  
  if (!config.nable.apiKey || config.nable.apiKey === 'YOUR_NSIGHT_API_KEY') {
    console.log(`  ${colors.yellow}⚠️  N-able API key not configured${colors.reset}`);
    console.log(`     Add to .env: NABLE_API_KEY=your_actual_key`);
    results.nable.status = 'skipped';
    results.nable.message = 'Missing API key';
    return;
  }
  
  try {
    const response = await axios.post(
      `${config.backend.url}/api/settings/test-connection/nable`,
      {
        url: config.nable.url,
        accessKey: config.nable.apiKey
      },
      { timeout: 10000 }
    );
    
    if (response.data.success) {
      results.nable.status = 'success';
      results.nable.message = response.data.message;
      console.log(`  ${colors.green}✅ N-able API connected successfully${colors.reset}`);
      console.log(`     Server: ${colors.yellow}${config.nable.url}${colors.reset}`);
    } else {
      results.nable.status = 'error';
      results.nable.message = response.data.message;
      console.log(`  ${colors.red}❌ N-able connection failed${colors.reset}`);
      console.log(`     Error: ${response.data.message}`);
    }
  } catch (error) {
    results.nable.status = 'error';
    results.nable.message = error.response?.data?.message || error.message;
    console.log(`  ${colors.red}❌ N-able test failed${colors.reset}`);
    console.log(`     Error: ${results.nable.message}`);
  }
}

// Test Webhook Endpoint
async function testWebhook() {
  console.log(`\n${colors.blue}Testing Webhook Endpoint...${colors.reset}`);
  
  try {
    const testAlert = {
      alertType: 'CONNECTION_TEST',
      deviceId: 'TEST-001',
      deviceName: 'Test Device',
      severity: 'INFO',
      message: 'Testing webhook endpoint',
      timestamp: new Date().toISOString()
    };
    
    const response = await axios.post(
      `${config.backend.url}/api/webhooks/nable`,
      testAlert,
      { timeout: 5000 }
    );
    
    if (response.status === 200 || response.status === 201) {
      console.log(`  ${colors.green}✅ Webhook endpoint is working${colors.reset}`);
      return true;
    }
  } catch (error) {
    if (error.response?.status === 404) {
      console.log(`  ${colors.yellow}⚠️  Webhook endpoint not found${colors.reset}`);
    } else {
      console.log(`  ${colors.red}❌ Webhook endpoint error${colors.reset}`);
    }
    return false;
  }
}

// Test Database Connection
async function testDatabase() {
  console.log(`\n${colors.blue}Testing Database Connection...${colors.reset}`);
  
  try {
    const response = await axios.get(`${config.backend.url}/api/health/db`, {
      timeout: 5000
    });
    
    if (response.data.connected) {
      console.log(`  ${colors.green}✅ Database is connected${colors.reset}`);
      return true;
    }
  } catch (error) {
    if (error.response?.status === 404) {
      console.log(`  ${colors.yellow}⚠️  Database health endpoint not available${colors.reset}`);
    } else {
      console.log(`  ${colors.yellow}⚠️  Could not verify database connection${colors.reset}`);
    }
    return false;
  }
}

// Run all tests
async function runTests() {
  console.log(`${colors.yellow}Configuration:${colors.reset}`);
  console.log(`  Backend URL: ${colors.yellow}${config.backend.url}${colors.reset}`);
  console.log(`  ConnectWise Company: ${colors.yellow}${config.connectwise.companyId}${colors.reset}`);
  console.log(`  N-able Server: ${colors.yellow}${config.nable.url}${colors.reset}`);
  console.log();
  
  // Test backend first
  const backendOk = await testBackendHealth();
  
  if (!backendOk) {
    console.log(`\n${colors.red}Cannot proceed without backend. Please start it first.${colors.reset}`);
    process.exit(1);
  }
  
  // Test other services
  await testConnectWise();
  await testNable();
  await testWebhook();
  await testDatabase();
  
  // Summary
  console.log(`\n${colors.magenta}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.blue}                            TEST SUMMARY                                        ${colors.reset}`);
  console.log(`${colors.magenta}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);
  
  let allSuccess = true;
  
  Object.entries(results).forEach(([service, result]) => {
    const statusIcon = result.status === 'success' ? '✅' : 
                       result.status === 'error' ? '❌' : '⚠️ ';
    const statusColor = result.status === 'success' ? colors.green : 
                        result.status === 'error' ? colors.red : colors.yellow;
    
    console.log(`  ${statusIcon} ${service.toUpperCase()}: ${statusColor}${result.message || result.status}${colors.reset}`);
    
    if (result.status !== 'success' && result.status !== 'skipped') {
      allSuccess = false;
    }
  });
  
  console.log();
  
  if (allSuccess) {
    console.log(`${colors.green}🎉 All configured services are working!${colors.reset}`);
    console.log(`\nYou can now:`);
    console.log(`  1. Open the UI at http://localhost:3000`);
    console.log(`  2. Configure automation rules`);
    console.log(`  3. Test the full workflow with: ./test-full-workflow.sh`);
  } else {
    console.log(`${colors.yellow}⚠️  Some services need configuration${colors.reset}`);
    console.log(`\nNext steps:`);
    
    if (results.connectwise.status === 'error') {
      console.log(`  1. Check ConnectWise credentials in .env file`);
      console.log(`     - Verify CONNECTWISE_PUBLIC_KEY and CONNECTWISE_PRIVATE_KEY`);
      console.log(`     - Ensure CONNECTWISE_CLIENT_ID is set if required`);
    }
    
    if (results.nable.status === 'error') {
      console.log(`  2. Check N-able API key in .env file`);
      console.log(`     - Set NABLE_API_KEY with your N-sight API key`);
      console.log(`     - Verify NABLE_API_URL is correct for your region`);
    }
    
    if (results.connectwise.status === 'skipped' || results.nable.status === 'skipped') {
      console.log(`  3. Add missing API credentials to .env file`);
    }
  }
  
  console.log(`\n${colors.magenta}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);
}

// Run the tests
runTests().catch(error => {
  console.error(`${colors.red}Test suite error: ${error.message}${colors.reset}`);
  process.exit(1);
});
 * API Connection Test Script
 * Tests both ConnectWise and N-able API connections
 */

const axios = require('axios');
require('dotenv').config();

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  magenta: '\x1b[35m'
};

console.log(`${colors.magenta}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
console.log(`${colors.blue}                    API CONNECTION TEST SUITE                                  ${colors.reset}`);
console.log(`${colors.magenta}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

// Configuration from environment
const config = {
  backend: {
    url: process.env.API_URL || 'http://localhost:3001'
  },
  connectwise: {
    url: process.env.CONNECTWISE_API_URL || 'https://api-na.myconnectwise.net/v4_6_release/apis/3.0',
    companyId: process.env.CONNECTWISE_COMPANY_ID || 'somos',
    publicKey: process.env.CONNECTWISE_PUBLIC_KEY || '',
    privateKey: process.env.CONNECTWISE_PRIVATE_KEY || '',
    clientId: process.env.CONNECTWISE_CLIENT_ID || '0ea93dc0-6921-4d58-919a-4433616ef054'
  },
  nable: {
    url: process.env.NABLE_API_URL || 'https://www.systemmonitor.us',
    apiKey: process.env.NABLE_API_KEY || ''
  }
};

// Test results storage
const results = {
  backend: { status: 'pending', message: '' },
  connectwise: { status: 'pending', message: '' },
  nable: { status: 'pending', message: '' }
};

// Test Backend Health
async function testBackendHealth() {
  console.log(`${colors.blue}Testing Backend API...${colors.reset}`);
  
  try {
    const response = await axios.get(`${config.backend.url}/health`, {
      timeout: 5000
    });
    
    if (response.status === 200) {
      results.backend.status = 'success';
      results.backend.message = 'Backend is running';
      console.log(`  ${colors.green}✅ Backend API is healthy${colors.reset}`);
      return true;
    }
  } catch (error) {
    results.backend.status = 'error';
    results.backend.message = error.message;
    console.log(`  ${colors.red}❌ Backend is not accessible${colors.reset}`);
    console.log(`     Please start it with: cd backend && npm run dev`);
    return false;
  }
}

// Test ConnectWise Connection via Backend
async function testConnectWise() {
  console.log(`\n${colors.blue}Testing ConnectWise Connection...${colors.reset}`);
  
  if (!config.connectwise.publicKey || !config.connectwise.privateKey) {
    console.log(`  ${colors.yellow}⚠️  ConnectWise credentials not configured${colors.reset}`);
    console.log(`     Add to .env: CONNECTWISE_PUBLIC_KEY and CONNECTWISE_PRIVATE_KEY`);
    results.connectwise.status = 'skipped';
    results.connectwise.message = 'Missing credentials';
    return;
  }
  
  try {
    const response = await axios.post(
      `${config.backend.url}/api/settings/test-connection/connectwise`,
      {
        url: config.connectwise.url,
        companyId: config.connectwise.companyId,
        publicKey: config.connectwise.publicKey,
        privateKey: config.connectwise.privateKey,
        clientId: config.connectwise.clientId
      },
      { timeout: 10000 }
    );
    
    if (response.data.success) {
      results.connectwise.status = 'success';
      results.connectwise.message = response.data.message;
      console.log(`  ${colors.green}✅ ConnectWise API connected successfully${colors.reset}`);
      console.log(`     Company: ${colors.yellow}${config.connectwise.companyId}${colors.reset}`);
      if (response.data.details?.version) {
        console.log(`     Version: ${colors.yellow}${response.data.details.version}${colors.reset}`);
      }
    } else {
      results.connectwise.status = 'error';
      results.connectwise.message = response.data.message;
      console.log(`  ${colors.red}❌ ConnectWise connection failed${colors.reset}`);
      console.log(`     Error: ${response.data.message}`);
    }
  } catch (error) {
    results.connectwise.status = 'error';
    results.connectwise.message = error.response?.data?.message || error.message;
    console.log(`  ${colors.red}❌ ConnectWise test failed${colors.reset}`);
    console.log(`     Error: ${results.connectwise.message}`);
    
    if (error.response?.data?.hint) {
      console.log(`     ${colors.yellow}Hint: ${error.response.data.hint}${colors.reset}`);
    }
  }
}

// Test N-able Connection via Backend
async function testNable() {
  console.log(`\n${colors.blue}Testing N-able Connection...${colors.reset}`);
  
  if (!config.nable.apiKey || config.nable.apiKey === 'YOUR_NSIGHT_API_KEY') {
    console.log(`  ${colors.yellow}⚠️  N-able API key not configured${colors.reset}`);
    console.log(`     Add to .env: NABLE_API_KEY=your_actual_key`);
    results.nable.status = 'skipped';
    results.nable.message = 'Missing API key';
    return;
  }
  
  try {
    const response = await axios.post(
      `${config.backend.url}/api/settings/test-connection/nable`,
      {
        url: config.nable.url,
        accessKey: config.nable.apiKey
      },
      { timeout: 10000 }
    );
    
    if (response.data.success) {
      results.nable.status = 'success';
      results.nable.message = response.data.message;
      console.log(`  ${colors.green}✅ N-able API connected successfully${colors.reset}`);
      console.log(`     Server: ${colors.yellow}${config.nable.url}${colors.reset}`);
    } else {
      results.nable.status = 'error';
      results.nable.message = response.data.message;
      console.log(`  ${colors.red}❌ N-able connection failed${colors.reset}`);
      console.log(`     Error: ${response.data.message}`);
    }
  } catch (error) {
    results.nable.status = 'error';
    results.nable.message = error.response?.data?.message || error.message;
    console.log(`  ${colors.red}❌ N-able test failed${colors.reset}`);
    console.log(`     Error: ${results.nable.message}`);
  }
}

// Test Webhook Endpoint
async function testWebhook() {
  console.log(`\n${colors.blue}Testing Webhook Endpoint...${colors.reset}`);
  
  try {
    const testAlert = {
      alertType: 'CONNECTION_TEST',
      deviceId: 'TEST-001',
      deviceName: 'Test Device',
      severity: 'INFO',
      message: 'Testing webhook endpoint',
      timestamp: new Date().toISOString()
    };
    
    const response = await axios.post(
      `${config.backend.url}/api/webhooks/nable`,
      testAlert,
      { timeout: 5000 }
    );
    
    if (response.status === 200 || response.status === 201) {
      console.log(`  ${colors.green}✅ Webhook endpoint is working${colors.reset}`);
      return true;
    }
  } catch (error) {
    if (error.response?.status === 404) {
      console.log(`  ${colors.yellow}⚠️  Webhook endpoint not found${colors.reset}`);
    } else {
      console.log(`  ${colors.red}❌ Webhook endpoint error${colors.reset}`);
    }
    return false;
  }
}

// Test Database Connection
async function testDatabase() {
  console.log(`\n${colors.blue}Testing Database Connection...${colors.reset}`);
  
  try {
    const response = await axios.get(`${config.backend.url}/api/health/db`, {
      timeout: 5000
    });
    
    if (response.data.connected) {
      console.log(`  ${colors.green}✅ Database is connected${colors.reset}`);
      return true;
    }
  } catch (error) {
    if (error.response?.status === 404) {
      console.log(`  ${colors.yellow}⚠️  Database health endpoint not available${colors.reset}`);
    } else {
      console.log(`  ${colors.yellow}⚠️  Could not verify database connection${colors.reset}`);
    }
    return false;
  }
}

// Run all tests
async function runTests() {
  console.log(`${colors.yellow}Configuration:${colors.reset}`);
  console.log(`  Backend URL: ${colors.yellow}${config.backend.url}${colors.reset}`);
  console.log(`  ConnectWise Company: ${colors.yellow}${config.connectwise.companyId}${colors.reset}`);
  console.log(`  N-able Server: ${colors.yellow}${config.nable.url}${colors.reset}`);
  console.log();
  
  // Test backend first
  const backendOk = await testBackendHealth();
  
  if (!backendOk) {
    console.log(`\n${colors.red}Cannot proceed without backend. Please start it first.${colors.reset}`);
    process.exit(1);
  }
  
  // Test other services
  await testConnectWise();
  await testNable();
  await testWebhook();
  await testDatabase();
  
  // Summary
  console.log(`\n${colors.magenta}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.blue}                            TEST SUMMARY                                        ${colors.reset}`);
  console.log(`${colors.magenta}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);
  
  let allSuccess = true;
  
  Object.entries(results).forEach(([service, result]) => {
    const statusIcon = result.status === 'success' ? '✅' : 
                       result.status === 'error' ? '❌' : '⚠️ ';
    const statusColor = result.status === 'success' ? colors.green : 
                        result.status === 'error' ? colors.red : colors.yellow;
    
    console.log(`  ${statusIcon} ${service.toUpperCase()}: ${statusColor}${result.message || result.status}${colors.reset}`);
    
    if (result.status !== 'success' && result.status !== 'skipped') {
      allSuccess = false;
    }
  });
  
  console.log();
  
  if (allSuccess) {
    console.log(`${colors.green}🎉 All configured services are working!${colors.reset}`);
    console.log(`\nYou can now:`);
    console.log(`  1. Open the UI at http://localhost:3000`);
    console.log(`  2. Configure automation rules`);
    console.log(`  3. Test the full workflow with: ./test-full-workflow.sh`);
  } else {
    console.log(`${colors.yellow}⚠️  Some services need configuration${colors.reset}`);
    console.log(`\nNext steps:`);
    
    if (results.connectwise.status === 'error') {
      console.log(`  1. Check ConnectWise credentials in .env file`);
      console.log(`     - Verify CONNECTWISE_PUBLIC_KEY and CONNECTWISE_PRIVATE_KEY`);
      console.log(`     - Ensure CONNECTWISE_CLIENT_ID is set if required`);
    }
    
    if (results.nable.status === 'error') {
      console.log(`  2. Check N-able API key in .env file`);
      console.log(`     - Set NABLE_API_KEY with your N-sight API key`);
      console.log(`     - Verify NABLE_API_URL is correct for your region`);
    }
    
    if (results.connectwise.status === 'skipped' || results.nable.status === 'skipped') {
      console.log(`  3. Add missing API credentials to .env file`);
    }
  }
  
  console.log(`\n${colors.magenta}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);
}

// Run the tests
runTests().catch(error => {
  console.error(`${colors.red}Test suite error: ${error.message}${colors.reset}`);
  process.exit(1);
});
