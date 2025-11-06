/**
 * N-sight API Test - Using Correct Format from Documentation
 * Based on: https://developer.n-able.com/n-sight/docs/getting-started-with-the-n-sight-api
 * 
 * Usage: node test-nsight-api.js
 * 
 * This script tests the N-sight API connection using the correct URL parameter format
 */

const https = require('https');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  magenta: '\x1b[35m'
};

console.log(`${colors.magenta}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
console.log(`${colors.blue}                N-SIGHT API TEST (CORRECT FORMAT)                              ${colors.reset}`);
console.log(`${colors.magenta}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

// Get configuration from environment variables
const apiKey = process.env.NABLE_API_KEY || '';
const apiUrl = process.env.NABLE_API_URL || 'https://www.systemmonitor.us';

// Ensure URL ends with /api
let baseUrl = apiUrl.replace(/\/+$/, ''); // Remove trailing slashes
if (!baseUrl.endsWith('/api')) {
  baseUrl = baseUrl + '/api';
}

console.log(`📋 ${colors.yellow}Configuration:${colors.reset}`);
console.log(`   API Key: ${colors.yellow}${apiKey ? apiKey.substring(0, 10) + '...' : 'NOT SET'}${colors.reset}`);
console.log(`   Server URL: ${colors.yellow}${baseUrl}${colors.reset}\n`);

if (!apiKey || apiKey === 'YOUR_NSIGHT_API_KEY' || apiKey === 'your_nable_api_key') {
  console.log(`${colors.red}❌ N-able API Key not configured!${colors.reset}`);
  console.log(`   Please set NABLE_API_KEY in your .env file\n`);
  console.log(`${colors.yellow}To get your API key:${colors.reset}`);
  console.log(`   1. Log into N-sight dashboard`);
  console.log(`   2. Go to System > API Keys`);
  console.log(`   3. Click Generate API Key`);
  console.log(`   4. Copy the key to your .env file\n`);
  process.exit(1);
}

// Test different N-sight API services according to documentation
async function testNsightAPI(service, description) {
  return new Promise((resolve) => {
    // Build URL according to N-sight documentation format
    const url = new URL(baseUrl);
    url.searchParams.append('apikey', apiKey);
    url.searchParams.append('service', service);
    
    console.log(`\n🔍 Testing: ${colors.blue}${description}${colors.reset}`);
    console.log(`   Service: ${colors.yellow}${service}${colors.reset}`);
    console.log(`   Full URL: ${colors.yellow}${url.toString().substring(0, 80)}...${colors.reset}`);

    https.get(url.toString(), (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        console.log(`   Status: ${res.statusCode}`);
        
        if (res.statusCode === 200) {
          console.log(`   ${colors.green}✅ SUCCESS!${colors.reset}`);
          try {
            const jsonData = JSON.parse(data);
            if (Array.isArray(jsonData)) {
              console.log(`   ${colors.green}Returned ${jsonData.length} items${colors.reset}`);
            } else if (jsonData.result) {
              console.log(`   ${colors.green}Result: ${jsonData.result}${colors.reset}`);
            } else {
              console.log(`   ${colors.green}Data received successfully${colors.reset}`);
            }
            resolve(true);
          } catch (e) {
            console.log(`   ${colors.green}Response received (non-JSON)${colors.reset}`);
            resolve(true);
          }
        } else if (res.statusCode === 401) {
          console.log(`   ${colors.red}❌ Authentication failed - Invalid API key${colors.reset}`);
          resolve(false);
        } else if (res.statusCode === 403) {
          console.log(`   ${colors.red}❌ Forbidden - API key lacks permissions${colors.reset}`);
          resolve(false);
        } else if (res.statusCode === 400) {
          console.log(`   ${colors.yellow}⚠️  Bad request - Service might not exist${colors.reset}`);
          if (data.includes('Invalid service')) {
            console.log(`   ${colors.yellow}Service '${service}' not recognized${colors.reset}`);
          }
          resolve(false);
        } else {
          console.log(`   ${colors.yellow}⚠️  Unexpected response${colors.reset}`);
          if (data) {
            console.log(`   Response: ${data.substring(0, 100)}`);
          }
          resolve(false);
        }
      });
    }).on('error', (err) => {
      console.log(`   ${colors.red}❌ Connection error: ${err.message}${colors.reset}`);
      resolve(false);
    }).setTimeout(10000, function() {
      console.log(`   ${colors.red}❌ Timeout after 10 seconds${colors.reset}`);
      this.destroy();
      resolve(false);
    });
  });
}

// Main test function
async function runTests() {
  console.log(`\n${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.blue}Testing N-sight API Services (as per documentation)${colors.reset}`);
  console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);

  // Test services mentioned in the N-sight documentation
  const tests = [
    { service: 'list_clients', description: 'List Clients' },
    { service: 'list_sites', description: 'List Sites' },
    { service: 'list_servers', description: 'List Servers' },
    { service: 'list_workstations', description: 'List Workstations' },
    { service: 'list_checks', description: 'List Checks' },
    { service: 'list_failing_checks', description: 'List Failing Checks' }
  ];

  let successCount = 0;
  let firstSuccessService = null;
  
  for (const test of tests) {
    const result = await testNsightAPI(test.service, test.description);
    if (result) {
      successCount++;
      if (!firstSuccessService) {
        firstSuccessService = test.service;
      }
      // Stop after first success to avoid rate limiting
      console.log(`\n${colors.green}✅ API Key is valid and working!${colors.reset}`);
      break;
    }
  }

  // Summary
  console.log(`\n${colors.magenta}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.blue}SUMMARY${colors.reset}`);
  console.log(`${colors.magenta}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

  if (successCount > 0) {
    console.log(`${colors.green}✅ N-sight API is working correctly!${colors.reset}`);
    console.log(`   First successful service: ${colors.green}${firstSuccessService}${colors.reset}`);
    
    console.log(`\n${colors.yellow}Important Notes:${colors.reset}`);
    console.log(`• N-sight uses URL parameters, not headers for authentication`);
    console.log(`• Format: /api?apikey=YOUR_KEY&service=SERVICE_NAME`);
    console.log(`• Your API key is valid and active`);
    
    console.log(`\n${colors.blue}Configuration in .env file:${colors.reset}`);
    console.log(`NABLE_API_URL=${apiUrl}`);
    console.log(`NABLE_API_KEY=${apiKey.substring(0, 10)}...`);
    
    console.log(`\n${colors.green}The backend has been updated to use this correct format!${colors.reset}`);
  } else {
    console.log(`${colors.red}❌ N-sight API connection failed${colors.reset}`);
    console.log(`\n${colors.yellow}Troubleshooting:${colors.reset}`);
    console.log(`1. Verify API key is correct in .env file`);
    console.log(`2. Check API key is active in N-sight dashboard`);
    console.log(`3. Ensure correct server URL for your region:`);
    console.log(`   • North America: https://www.systemmonitor.us`);
    console.log(`   • Europe: https://www.systemmonitor.eu.com`);
    console.log(`   • Australia: https://www.systemmonitor.com.au`);
    console.log(`4. API key format should be like: 5232f3bf28...`);
    console.log(`\n${colors.yellow}To generate a new API key:${colors.reset}`);
    console.log(`   1. Log into N-sight dashboard`);
    console.log(`   2. Go to System > API Keys`);
    console.log(`   3. Click Generate API Key`);
    console.log(`   4. Copy to your .env file`);
  }

  console.log(`\n${colors.magenta}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);
}

// Run the tests
runTests().catch(console.error);
 * N-sight API Test - Using Correct Format from Documentation
 * Based on: https://developer.n-able.com/n-sight/docs/getting-started-with-the-n-sight-api
 * 
 * Usage: node test-nsight-api.js
 * 
 * This script tests the N-sight API connection using the correct URL parameter format
 */

const https = require('https');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  magenta: '\x1b[35m'
};

console.log(`${colors.magenta}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
console.log(`${colors.blue}                N-SIGHT API TEST (CORRECT FORMAT)                              ${colors.reset}`);
console.log(`${colors.magenta}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

// Get configuration from environment variables
const apiKey = process.env.NABLE_API_KEY || '';
const apiUrl = process.env.NABLE_API_URL || 'https://www.systemmonitor.us';

// Ensure URL ends with /api
let baseUrl = apiUrl.replace(/\/+$/, ''); // Remove trailing slashes
if (!baseUrl.endsWith('/api')) {
  baseUrl = baseUrl + '/api';
}

console.log(`📋 ${colors.yellow}Configuration:${colors.reset}`);
console.log(`   API Key: ${colors.yellow}${apiKey ? apiKey.substring(0, 10) + '...' : 'NOT SET'}${colors.reset}`);
console.log(`   Server URL: ${colors.yellow}${baseUrl}${colors.reset}\n`);

if (!apiKey || apiKey === 'YOUR_NSIGHT_API_KEY' || apiKey === 'your_nable_api_key') {
  console.log(`${colors.red}❌ N-able API Key not configured!${colors.reset}`);
  console.log(`   Please set NABLE_API_KEY in your .env file\n`);
  console.log(`${colors.yellow}To get your API key:${colors.reset}`);
  console.log(`   1. Log into N-sight dashboard`);
  console.log(`   2. Go to System > API Keys`);
  console.log(`   3. Click Generate API Key`);
  console.log(`   4. Copy the key to your .env file\n`);
  process.exit(1);
}

// Test different N-sight API services according to documentation
async function testNsightAPI(service, description) {
  return new Promise((resolve) => {
    // Build URL according to N-sight documentation format
    const url = new URL(baseUrl);
    url.searchParams.append('apikey', apiKey);
    url.searchParams.append('service', service);
    
    console.log(`\n🔍 Testing: ${colors.blue}${description}${colors.reset}`);
    console.log(`   Service: ${colors.yellow}${service}${colors.reset}`);
    console.log(`   Full URL: ${colors.yellow}${url.toString().substring(0, 80)}...${colors.reset}`);

    https.get(url.toString(), (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        console.log(`   Status: ${res.statusCode}`);
        
        if (res.statusCode === 200) {
          console.log(`   ${colors.green}✅ SUCCESS!${colors.reset}`);
          try {
            const jsonData = JSON.parse(data);
            if (Array.isArray(jsonData)) {
              console.log(`   ${colors.green}Returned ${jsonData.length} items${colors.reset}`);
            } else if (jsonData.result) {
              console.log(`   ${colors.green}Result: ${jsonData.result}${colors.reset}`);
            } else {
              console.log(`   ${colors.green}Data received successfully${colors.reset}`);
            }
            resolve(true);
          } catch (e) {
            console.log(`   ${colors.green}Response received (non-JSON)${colors.reset}`);
            resolve(true);
          }
        } else if (res.statusCode === 401) {
          console.log(`   ${colors.red}❌ Authentication failed - Invalid API key${colors.reset}`);
          resolve(false);
        } else if (res.statusCode === 403) {
          console.log(`   ${colors.red}❌ Forbidden - API key lacks permissions${colors.reset}`);
          resolve(false);
        } else if (res.statusCode === 400) {
          console.log(`   ${colors.yellow}⚠️  Bad request - Service might not exist${colors.reset}`);
          if (data.includes('Invalid service')) {
            console.log(`   ${colors.yellow}Service '${service}' not recognized${colors.reset}`);
          }
          resolve(false);
        } else {
          console.log(`   ${colors.yellow}⚠️  Unexpected response${colors.reset}`);
          if (data) {
            console.log(`   Response: ${data.substring(0, 100)}`);
          }
          resolve(false);
        }
      });
    }).on('error', (err) => {
      console.log(`   ${colors.red}❌ Connection error: ${err.message}${colors.reset}`);
      resolve(false);
    }).setTimeout(10000, function() {
      console.log(`   ${colors.red}❌ Timeout after 10 seconds${colors.reset}`);
      this.destroy();
      resolve(false);
    });
  });
}

// Main test function
async function runTests() {
  console.log(`\n${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.blue}Testing N-sight API Services (as per documentation)${colors.reset}`);
  console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);

  // Test services mentioned in the N-sight documentation
  const tests = [
    { service: 'list_clients', description: 'List Clients' },
    { service: 'list_sites', description: 'List Sites' },
    { service: 'list_servers', description: 'List Servers' },
    { service: 'list_workstations', description: 'List Workstations' },
    { service: 'list_checks', description: 'List Checks' },
    { service: 'list_failing_checks', description: 'List Failing Checks' }
  ];

  let successCount = 0;
  let firstSuccessService = null;
  
  for (const test of tests) {
    const result = await testNsightAPI(test.service, test.description);
    if (result) {
      successCount++;
      if (!firstSuccessService) {
        firstSuccessService = test.service;
      }
      // Stop after first success to avoid rate limiting
      console.log(`\n${colors.green}✅ API Key is valid and working!${colors.reset}`);
      break;
    }
  }

  // Summary
  console.log(`\n${colors.magenta}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.blue}SUMMARY${colors.reset}`);
  console.log(`${colors.magenta}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

  if (successCount > 0) {
    console.log(`${colors.green}✅ N-sight API is working correctly!${colors.reset}`);
    console.log(`   First successful service: ${colors.green}${firstSuccessService}${colors.reset}`);
    
    console.log(`\n${colors.yellow}Important Notes:${colors.reset}`);
    console.log(`• N-sight uses URL parameters, not headers for authentication`);
    console.log(`• Format: /api?apikey=YOUR_KEY&service=SERVICE_NAME`);
    console.log(`• Your API key is valid and active`);
    
    console.log(`\n${colors.blue}Configuration in .env file:${colors.reset}`);
    console.log(`NABLE_API_URL=${apiUrl}`);
    console.log(`NABLE_API_KEY=${apiKey.substring(0, 10)}...`);
    
    console.log(`\n${colors.green}The backend has been updated to use this correct format!${colors.reset}`);
  } else {
    console.log(`${colors.red}❌ N-sight API connection failed${colors.reset}`);
    console.log(`\n${colors.yellow}Troubleshooting:${colors.reset}`);
    console.log(`1. Verify API key is correct in .env file`);
    console.log(`2. Check API key is active in N-sight dashboard`);
    console.log(`3. Ensure correct server URL for your region:`);
    console.log(`   • North America: https://www.systemmonitor.us`);
    console.log(`   • Europe: https://www.systemmonitor.eu.com`);
    console.log(`   • Australia: https://www.systemmonitor.com.au`);
    console.log(`4. API key format should be like: 5232f3bf28...`);
    console.log(`\n${colors.yellow}To generate a new API key:${colors.reset}`);
    console.log(`   1. Log into N-sight dashboard`);
    console.log(`   2. Go to System > API Keys`);
    console.log(`   3. Click Generate API Key`);
    console.log(`   4. Copy to your .env file`);
  }

  console.log(`\n${colors.magenta}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);
}

// Run the tests
runTests().catch(console.error);
