# 🧪 Complete Workflow Testing Guide

## Overview
This guide walks through testing the complete automation flow from N-able alert to ConnectWise ticket resolution.

## Prerequisites Checklist

### 1. Environment Variables (.env file)
```bash
# ConnectWise Settings
CONNECTWISE_API_URL=https://api-na.myconnectwise.net/v4_6_release/apis/3.0
CONNECTWISE_COMPANY_ID=somos
CONNECTWISE_PUBLIC_KEY=jSPLwWW1zDjO7i08
CONNECTWISE_PRIVATE_KEY=KH1S5voDwhKDGHb7
CONNECTWISE_CLIENT_ID=0ea93dc0-6921-4d58-919a-4433616ef054

# N-able Settings
NABLE_API_URL=https://www.systemmonitor.us
NABLE_API_KEY=5232f3bf28...  # Your actual API key

# Duplicate Prevention (CRITICAL)
PREVENT_DUPLICATE_TICKETS=true
UPDATE_ONLY_MODE=true
CREATE_NEW_CW_TICKETS=false

# Teams Notifications
MS_TEAMS_WEBHOOK_URL=https://outlook.office.com/webhook/...
MS_TEAMS_ENABLED=true

# Automation
AUTO_REMEDIATION_ENABLED=true
AUTO_CLOSE_ON_SUCCESS=true
AUTO_ESCALATE_ON_FAILURE=true
```

### 2. Start All Services
```bash
# Terminal 1: Start backend
cd backend
npm run dev

# Terminal 2: Start frontend
cd frontend
npm start

# Terminal 3: Check database
docker-compose up -d postgres
```

## Test Flow 1: Basic Connection Tests

### Step 1.1: Test API Connections
1. Navigate to http://localhost:3000/settings
2. Go to "API Credentials" section
3. Enter your ConnectWise credentials and click "Test Connection"
   - ✅ Should show "ConnectWise connection successful"
4. Enter your N-able credentials and click "Test Connection"
   - ✅ Should show "N-sight API connection successful"

### Step 1.2: Verify Backend API
```bash
# Test backend health
curl http://localhost:3001/health

# Test ConnectWise connection
curl -X POST http://localhost:3001/api/settings/test-connection/connectwise \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://api-na.myconnectwise.net/v4_6_release/apis/3.0",
    "companyId": "somos",
    "publicKey": "jSPLwWW1zDjO7i08",
    "privateKey": "KH1S5voDwhKDGHb7",
    "clientId": "0ea93dc0-6921-4d58-919a-4433616ef054"
  }'

# Test N-able connection
curl -X POST http://localhost:3001/api/settings/test-connection/nable \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.systemmonitor.us",
    "accessKey": "YOUR_NABLE_API_KEY"
  }'
```

## Test Flow 2: Webhook Reception

### Step 2.1: Simulate N-able Alert Webhook
```bash
# Simulate a disk space alert from N-able
curl -X POST http://localhost:3001/api/webhooks/nable \
  -H "Content-Type: application/json" \
  -d '{
    "alertType": "DISK_SPACE_LOW",
    "deviceId": "TEST-DEVICE-001",
    "deviceName": "TestServer01",
    "customerId": "12345",
    "severity": "HIGH",
    "message": "Disk C: is 95% full",
    "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",
    "cwTicketId": "12345",
    "cwTicketNumber": "T20240101-0001"
  }'
```

Expected Response:
```json
{
  "success": true,
  "message": "Alert processed",
  "ticketId": "12345"
}
```

### Step 2.2: Check Logs
```bash
# Backend logs should show:
tail -f backend/logs/combined.log | grep -E "webhook|ticket|automation"
```

Look for:
- "Webhook received from N-able"
- "Found existing ConnectWise ticket: T20240101-0001"
- "Preventing duplicate ticket creation"
- "Executing automation rule for DISK_SPACE_LOW"

## Test Flow 3: Automation Execution

### Step 3.1: Create Automation Rules
1. Navigate to http://localhost:3000/automation
2. Click "Add Rule"
3. Create a rule:
   - Name: "Disk Cleanup Rule"
   - Trigger: Alert Type = "DISK_SPACE_LOW"
   - Action: Execute Script = "Clean-TempFiles"
   - Auto-close on success: Yes

### Step 3.2: Monitor Automation
```bash
# Watch automation queue
curl http://localhost:3001/api/automation/queue

# Check automation history
curl http://localhost:3001/api/automation/history
```

## Test Flow 4: Full End-to-End Test

### Step 4.1: Create Test Scenario Script
Create `test-full-flow.sh`:
```bash
#!/bin/bash

echo "🚀 Starting Full Workflow Test"
echo "================================"

# 1. Simulate N-able creating ticket in ConnectWise
echo "📝 Step 1: N-able creates ConnectWise ticket..."
TICKET_ID="TEST-$(date +%s)"
echo "   Ticket ID: $TICKET_ID"

# 2. Send webhook to platform
echo "📡 Step 2: Sending webhook to platform..."
curl -X POST http://localhost:3001/api/webhooks/nable \
  -H "Content-Type: application/json" \
  -d '{
    "alertType": "SERVICE_STOPPED",
    "deviceId": "SERVER-001",
    "deviceName": "ProductionServer",
    "severity": "CRITICAL",
    "message": "Windows Update service stopped",
    "serviceName": "wuauserv",
    "cwTicketId": "'$TICKET_ID'",
    "cwTicketNumber": "T'$TICKET_ID'"
  }'

echo ""
echo "⏳ Waiting for automation to execute..."
sleep 5

# 3. Check ticket status
echo "🔍 Step 3: Checking ticket status..."
curl http://localhost:3001/api/tickets/$TICKET_ID

echo ""
echo "✅ Test Complete!"
```

### Step 4.2: Run and Verify
```bash
chmod +x test-full-flow.sh
./test-full-flow.sh
```

## Test Flow 5: Duplicate Prevention Test

### Step 5.1: Test Duplicate Handling
```bash
# Send same alert twice
for i in 1 2; do
  echo "Sending alert attempt $i..."
  curl -X POST http://localhost:3001/api/webhooks/nable \
    -H "Content-Type: application/json" \
    -d '{
      "alertType": "CPU_HIGH",
      "deviceId": "DEVICE-DUP-TEST",
      "cwTicketNumber": "T20240101-DUPLICATE"
    }'
  sleep 2
done
```

Check logs for:
- "Ticket T20240101-DUPLICATE already exists, updating instead of creating"
- Only ONE ticket should exist in ConnectWise

## Test Flow 6: Teams Notifications

### Step 6.1: Test Teams Alert
```bash
# Trigger critical alert
curl -X POST http://localhost:3001/api/webhooks/nable \
  -H "Content-Type: application/json" \
  -d '{
    "alertType": "SERVER_DOWN",
    "severity": "CRITICAL",
    "deviceName": "CriticalServer01",
    "shouldEscalate": true
  }'
```

Check Teams channel for:
- Alert notification card
- Escalation mentions
- Action buttons

## Test Flow 7: Script Execution Verification

### Step 7.1: Monitor Script Execution
```bash
# Check N-able script execution status
curl http://localhost:3001/api/nable/scripts/status

# View script results
curl http://localhost:3001/api/automation/scripts/history
```

### Step 7.2: Verify Script Results in ConnectWise
1. Log into ConnectWise
2. Find the test ticket
3. Check ticket notes for:
   - "Automation started: [Script Name]"
   - "Script output: [Results]"
   - "Ticket auto-closed: Remediation successful"

## Monitoring Dashboard

### Access Real-time Monitoring
1. Open http://localhost:3000/dashboard
2. Monitor:
   - Active alerts count
   - Automation success rate
   - Recent ticket activity
   - Failed automations

### Check Analytics
1. Navigate to http://localhost:3000/analytics
2. Review:
   - Automation performance metrics
   - Common alert types
   - Resolution times

## Troubleshooting Common Issues

### Issue 1: Webhook Not Received
```bash
# Check if backend is listening
netstat -an | grep 3001

# Check webhook endpoint
curl -X POST http://localhost:3001/api/webhooks/nable -d '{}'
```

### Issue 2: Ticket Not Found
```bash
# Enable debug logging
export LOG_LEVEL=debug
npm run dev

# Check ConnectWise connection
curl http://localhost:3001/api/connectwise/tickets?number=T20240101-0001
```

### Issue 3: Script Not Executing
```bash
# Check N-able API
curl http://localhost:3001/api/nable/devices

# Verify script exists
curl http://localhost:3001/api/scripts
```

### Issue 4: Duplicate Tickets Created
Check `.env`:
```bash
PREVENT_DUPLICATE_TICKETS=true  # Must be true
UPDATE_ONLY_MODE=true           # Must be true
CREATE_NEW_CW_TICKETS=false     # Must be false
```

## Success Criteria Checklist

- [ ] ConnectWise API connection successful
- [ ] N-able API connection successful  
- [ ] Webhook received and processed
- [ ] Existing ticket found (no duplicate)
- [ ] Automation rule matched and triggered
- [ ] Script executed via N-able API
- [ ] ConnectWise ticket updated with results
- [ ] Teams notification sent
- [ ] Ticket closed on success OR escalated on failure
- [ ] All actions logged properly

## Logging Locations

```bash
# Backend logs
tail -f backend/logs/combined.log

# Frontend console
# Open browser DevTools (F12) > Console

# Database queries
docker logs connectwise-nrmm-postgres

# N-able API calls
grep "N-able" backend/logs/combined.log

# ConnectWise API calls
grep "ConnectWise" backend/logs/combined.log
```

## Performance Testing

### Load Test
```bash
# Install artillery
npm install -g artillery

# Create load test
echo 'config:
  target: "http://localhost:3001"
  phases:
    - duration: 60
      arrivalRate: 5
scenarios:
  - name: "Alert Webhook"
    flow:
      - post:
          url: "/api/webhooks/nable"
          json:
            alertType: "DISK_SPACE_LOW"
            deviceId: "LOAD-TEST-{{ $randomNumber() }}"' > loadtest.yml

# Run load test
artillery run loadtest.yml
```

## Reset Test Environment

```bash
# Clear test data
docker exec -it connectwise-nrmm-postgres psql -U postgres -d connectwise_nrmm -c "
  DELETE FROM automation_history WHERE device_id LIKE 'TEST-%';
  DELETE FROM tickets WHERE ticket_number LIKE 'T%TEST%';
"

# Restart services
docker-compose restart
```

## Next Steps After Testing

1. **Document Issues**: Record any failures or unexpected behaviors
2. **Review Logs**: Check for errors or warnings in all log files
3. **Performance Metrics**: Note response times and resource usage
4. **Security Check**: Ensure no sensitive data in logs
5. **User Acceptance**: Have end users validate the workflow

---

## Quick Test Commands Reference

```bash
# Test everything quickly
npm run test:integration

# Test ConnectWise only
npm run test:connectwise

# Test N-able only  
npm run test:nable

# Test automation engine
npm run test:automation

# Test webhooks
npm run test:webhooks
```

## Overview
This guide walks through testing the complete automation flow from N-able alert to ConnectWise ticket resolution.

## Prerequisites Checklist

### 1. Environment Variables (.env file)
```bash
# ConnectWise Settings
CONNECTWISE_API_URL=https://api-na.myconnectwise.net/v4_6_release/apis/3.0
CONNECTWISE_COMPANY_ID=somos
CONNECTWISE_PUBLIC_KEY=jSPLwWW1zDjO7i08
CONNECTWISE_PRIVATE_KEY=KH1S5voDwhKDGHb7
CONNECTWISE_CLIENT_ID=0ea93dc0-6921-4d58-919a-4433616ef054

# N-able Settings
NABLE_API_URL=https://www.systemmonitor.us
NABLE_API_KEY=5232f3bf28...  # Your actual API key

# Duplicate Prevention (CRITICAL)
PREVENT_DUPLICATE_TICKETS=true
UPDATE_ONLY_MODE=true
CREATE_NEW_CW_TICKETS=false

# Teams Notifications
MS_TEAMS_WEBHOOK_URL=https://outlook.office.com/webhook/...
MS_TEAMS_ENABLED=true

# Automation
AUTO_REMEDIATION_ENABLED=true
AUTO_CLOSE_ON_SUCCESS=true
AUTO_ESCALATE_ON_FAILURE=true
```

### 2. Start All Services
```bash
# Terminal 1: Start backend
cd backend
npm run dev

# Terminal 2: Start frontend
cd frontend
npm start

# Terminal 3: Check database
docker-compose up -d postgres
```

## Test Flow 1: Basic Connection Tests

### Step 1.1: Test API Connections
1. Navigate to http://localhost:3000/settings
2. Go to "API Credentials" section
3. Enter your ConnectWise credentials and click "Test Connection"
   - ✅ Should show "ConnectWise connection successful"
4. Enter your N-able credentials and click "Test Connection"
   - ✅ Should show "N-sight API connection successful"

### Step 1.2: Verify Backend API
```bash
# Test backend health
curl http://localhost:3001/health

# Test ConnectWise connection
curl -X POST http://localhost:3001/api/settings/test-connection/connectwise \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://api-na.myconnectwise.net/v4_6_release/apis/3.0",
    "companyId": "somos",
    "publicKey": "jSPLwWW1zDjO7i08",
    "privateKey": "KH1S5voDwhKDGHb7",
    "clientId": "0ea93dc0-6921-4d58-919a-4433616ef054"
  }'

# Test N-able connection
curl -X POST http://localhost:3001/api/settings/test-connection/nable \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.systemmonitor.us",
    "accessKey": "YOUR_NABLE_API_KEY"
  }'
```

## Test Flow 2: Webhook Reception

### Step 2.1: Simulate N-able Alert Webhook
```bash
# Simulate a disk space alert from N-able
curl -X POST http://localhost:3001/api/webhooks/nable \
  -H "Content-Type: application/json" \
  -d '{
    "alertType": "DISK_SPACE_LOW",
    "deviceId": "TEST-DEVICE-001",
    "deviceName": "TestServer01",
    "customerId": "12345",
    "severity": "HIGH",
    "message": "Disk C: is 95% full",
    "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",
    "cwTicketId": "12345",
    "cwTicketNumber": "T20240101-0001"
  }'
```

Expected Response:
```json
{
  "success": true,
  "message": "Alert processed",
  "ticketId": "12345"
}
```

### Step 2.2: Check Logs
```bash
# Backend logs should show:
tail -f backend/logs/combined.log | grep -E "webhook|ticket|automation"
```

Look for:
- "Webhook received from N-able"
- "Found existing ConnectWise ticket: T20240101-0001"
- "Preventing duplicate ticket creation"
- "Executing automation rule for DISK_SPACE_LOW"

## Test Flow 3: Automation Execution

### Step 3.1: Create Automation Rules
1. Navigate to http://localhost:3000/automation
2. Click "Add Rule"
3. Create a rule:
   - Name: "Disk Cleanup Rule"
   - Trigger: Alert Type = "DISK_SPACE_LOW"
   - Action: Execute Script = "Clean-TempFiles"
   - Auto-close on success: Yes

### Step 3.2: Monitor Automation
```bash
# Watch automation queue
curl http://localhost:3001/api/automation/queue

# Check automation history
curl http://localhost:3001/api/automation/history
```

## Test Flow 4: Full End-to-End Test

### Step 4.1: Create Test Scenario Script
Create `test-full-flow.sh`:
```bash
#!/bin/bash

echo "🚀 Starting Full Workflow Test"
echo "================================"

# 1. Simulate N-able creating ticket in ConnectWise
echo "📝 Step 1: N-able creates ConnectWise ticket..."
TICKET_ID="TEST-$(date +%s)"
echo "   Ticket ID: $TICKET_ID"

# 2. Send webhook to platform
echo "📡 Step 2: Sending webhook to platform..."
curl -X POST http://localhost:3001/api/webhooks/nable \
  -H "Content-Type: application/json" \
  -d '{
    "alertType": "SERVICE_STOPPED",
    "deviceId": "SERVER-001",
    "deviceName": "ProductionServer",
    "severity": "CRITICAL",
    "message": "Windows Update service stopped",
    "serviceName": "wuauserv",
    "cwTicketId": "'$TICKET_ID'",
    "cwTicketNumber": "T'$TICKET_ID'"
  }'

echo ""
echo "⏳ Waiting for automation to execute..."
sleep 5

# 3. Check ticket status
echo "🔍 Step 3: Checking ticket status..."
curl http://localhost:3001/api/tickets/$TICKET_ID

echo ""
echo "✅ Test Complete!"
```

### Step 4.2: Run and Verify
```bash
chmod +x test-full-flow.sh
./test-full-flow.sh
```

## Test Flow 5: Duplicate Prevention Test

### Step 5.1: Test Duplicate Handling
```bash
# Send same alert twice
for i in 1 2; do
  echo "Sending alert attempt $i..."
  curl -X POST http://localhost:3001/api/webhooks/nable \
    -H "Content-Type: application/json" \
    -d '{
      "alertType": "CPU_HIGH",
      "deviceId": "DEVICE-DUP-TEST",
      "cwTicketNumber": "T20240101-DUPLICATE"
    }'
  sleep 2
done
```

Check logs for:
- "Ticket T20240101-DUPLICATE already exists, updating instead of creating"
- Only ONE ticket should exist in ConnectWise

## Test Flow 6: Teams Notifications

### Step 6.1: Test Teams Alert
```bash
# Trigger critical alert
curl -X POST http://localhost:3001/api/webhooks/nable \
  -H "Content-Type: application/json" \
  -d '{
    "alertType": "SERVER_DOWN",
    "severity": "CRITICAL",
    "deviceName": "CriticalServer01",
    "shouldEscalate": true
  }'
```

Check Teams channel for:
- Alert notification card
- Escalation mentions
- Action buttons

## Test Flow 7: Script Execution Verification

### Step 7.1: Monitor Script Execution
```bash
# Check N-able script execution status
curl http://localhost:3001/api/nable/scripts/status

# View script results
curl http://localhost:3001/api/automation/scripts/history
```

### Step 7.2: Verify Script Results in ConnectWise
1. Log into ConnectWise
2. Find the test ticket
3. Check ticket notes for:
   - "Automation started: [Script Name]"
   - "Script output: [Results]"
   - "Ticket auto-closed: Remediation successful"

## Monitoring Dashboard

### Access Real-time Monitoring
1. Open http://localhost:3000/dashboard
2. Monitor:
   - Active alerts count
   - Automation success rate
   - Recent ticket activity
   - Failed automations

### Check Analytics
1. Navigate to http://localhost:3000/analytics
2. Review:
   - Automation performance metrics
   - Common alert types
   - Resolution times

## Troubleshooting Common Issues

### Issue 1: Webhook Not Received
```bash
# Check if backend is listening
netstat -an | grep 3001

# Check webhook endpoint
curl -X POST http://localhost:3001/api/webhooks/nable -d '{}'
```

### Issue 2: Ticket Not Found
```bash
# Enable debug logging
export LOG_LEVEL=debug
npm run dev

# Check ConnectWise connection
curl http://localhost:3001/api/connectwise/tickets?number=T20240101-0001
```

### Issue 3: Script Not Executing
```bash
# Check N-able API
curl http://localhost:3001/api/nable/devices

# Verify script exists
curl http://localhost:3001/api/scripts
```

### Issue 4: Duplicate Tickets Created
Check `.env`:
```bash
PREVENT_DUPLICATE_TICKETS=true  # Must be true
UPDATE_ONLY_MODE=true           # Must be true
CREATE_NEW_CW_TICKETS=false     # Must be false
```

## Success Criteria Checklist

- [ ] ConnectWise API connection successful
- [ ] N-able API connection successful  
- [ ] Webhook received and processed
- [ ] Existing ticket found (no duplicate)
- [ ] Automation rule matched and triggered
- [ ] Script executed via N-able API
- [ ] ConnectWise ticket updated with results
- [ ] Teams notification sent
- [ ] Ticket closed on success OR escalated on failure
- [ ] All actions logged properly

## Logging Locations

```bash
# Backend logs
tail -f backend/logs/combined.log

# Frontend console
# Open browser DevTools (F12) > Console

# Database queries
docker logs connectwise-nrmm-postgres

# N-able API calls
grep "N-able" backend/logs/combined.log

# ConnectWise API calls
grep "ConnectWise" backend/logs/combined.log
```

## Performance Testing

### Load Test
```bash
# Install artillery
npm install -g artillery

# Create load test
echo 'config:
  target: "http://localhost:3001"
  phases:
    - duration: 60
      arrivalRate: 5
scenarios:
  - name: "Alert Webhook"
    flow:
      - post:
          url: "/api/webhooks/nable"
          json:
            alertType: "DISK_SPACE_LOW"
            deviceId: "LOAD-TEST-{{ $randomNumber() }}"' > loadtest.yml

# Run load test
artillery run loadtest.yml
```

## Reset Test Environment

```bash
# Clear test data
docker exec -it connectwise-nrmm-postgres psql -U postgres -d connectwise_nrmm -c "
  DELETE FROM automation_history WHERE device_id LIKE 'TEST-%';
  DELETE FROM tickets WHERE ticket_number LIKE 'T%TEST%';
"

# Restart services
docker-compose restart
```

## Next Steps After Testing

1. **Document Issues**: Record any failures or unexpected behaviors
2. **Review Logs**: Check for errors or warnings in all log files
3. **Performance Metrics**: Note response times and resource usage
4. **Security Check**: Ensure no sensitive data in logs
5. **User Acceptance**: Have end users validate the workflow

---

## Quick Test Commands Reference

```bash
# Test everything quickly
npm run test:integration

# Test ConnectWise only
npm run test:connectwise

# Test N-able only  
npm run test:nable

# Test automation engine
npm run test:automation

# Test webhooks
npm run test:webhooks
```
