# 🤖 Automation Rules Setup Guide

## Complete Workflow Testing Configuration

This guide provides all the information needed to create automation rules for testing the full N-able → ConnectWise → Automation workflow.

---

## 📋 Required Automation Rules for Testing

### Rule 1: Disk Space Cleanup
**Purpose**: Automatically clean disk space when N-able detects low disk space

#### Trigger Configuration:
- **Trigger Type**: `Alert`
- **Alert Type**: `DISK_SPACE_LOW`
- **Severity Filter**: `HIGH` or `CRITICAL`
- **Device Filter**: `*` (all devices) or specific device IDs for testing

#### Action Configuration:
- **Action Type**: `Execute Script`
- **Script Name**: `Clean-TempFiles` or `Disk-Cleanup`
- **Script Parameters**:
  ```json
  {
    "targetDrive": "C:",
    "cleanupType": "temp_files",
    "thresholdGB": "10",
    "deleteOlderThanDays": "30"
  }
  ```
- **Timeout**: `300` seconds (5 minutes)
- **Max Retries**: `2`

#### Response Actions:
- **On Success**: 
  - Update ConnectWise ticket with results
  - Add note: "Automated disk cleanup completed. Freed {freedSpace}GB"
  - Close ticket automatically
- **On Failure**:
  - Update ticket with error details
  - Escalate to technician
  - Send Teams notification

---

### Rule 2: Service Restart
**Purpose**: Automatically restart stopped services

#### Trigger Configuration:
- **Trigger Type**: `Alert`
- **Alert Type**: `SERVICE_STOPPED`
- **Severity Filter**: `CRITICAL`
- **Service Name Filter**: Can specify specific services like:
  - `wuauserv` (Windows Update)
  - `Spooler` (Print Spooler)
  - `W32Time` (Windows Time)

#### Action Configuration:
- **Action Type**: `Execute Script`
- **Script Name**: `Restart-Service`
- **Script Parameters**:
  ```json
  {
    "serviceName": "{alertServiceName}",
    "forcedRestart": "true",
    "waitTime": "30",
    "verifyRunning": "true"
  }
  ```
- **Timeout**: `120` seconds
- **Max Retries**: `3`

#### Response Actions:
- **On Success**:
  - Update ticket: "Service {serviceName} restarted successfully"
  - Close ticket
- **On Failure**:
  - Update ticket: "Failed to restart service after {attempts} attempts"
  - Escalate to Level 2 support
  - Send critical Teams alert

---

### Rule 3: High CPU Usage
**Purpose**: Analyze and remediate high CPU usage

#### Trigger Configuration:
- **Trigger Type**: `Alert`
- **Alert Type**: `CPU_HIGH`
- **Severity Filter**: `HIGH`
- **Threshold**: `> 90%` for more than 5 minutes

#### Action Configuration:
- **Action Type**: `Execute Script`
- **Script Name**: `Analyze-HighCPU`
- **Script Parameters**:
  ```json
  {
    "topProcesses": "10",
    "killIfOver": "95",
    "excludeProcesses": ["System", "svchost", "csrss"],
    "collectDiagnostics": "true"
  }
  ```
- **Timeout**: `180` seconds
- **Max Retries**: `1`

#### Response Actions:
- **On Success**:
  - Update ticket with process analysis
  - If process killed: Note which process and why
  - Mark as resolved
- **On Failure**:
  - Keep ticket open
  - Assign to technician
  - Priority: High

---

### Rule 4: Backup Failure
**Purpose**: Retry failed backups or escalate

#### Trigger Configuration:
- **Trigger Type**: `Alert`
- **Alert Type**: `BACKUP_FAILED`
- **Severity Filter**: `HIGH`
- **Source**: `Backup Software Alert`

#### Action Configuration:
- **Action Type**: `Execute Script`
- **Script Name**: `Retry-Backup`
- **Script Parameters**:
  ```json
  {
    "backupJob": "{jobName}",
    "retryType": "incremental",
    "verifySpace": "true",
    "notifyOnStart": "true"
  }
  ```
- **Timeout**: `600` seconds (10 minutes)
- **Max Retries**: `1`

#### Response Actions:
- **On Success**:
  - Update ticket: "Backup completed successfully on retry"
  - Close ticket
- **On Failure**:
  - Escalate immediately
  - Send Teams alert with @mention
  - Priority: Critical

---

## 🔧 How to Create Rules in the UI

### Step 1: Access Automation Section
1. Navigate to http://localhost:3000
2. Login with admin credentials
3. Click on **Automation** in the sidebar

### Step 2: Create New Rule
1. Click **"+ Add Rule"** or **"Create Automation Rule"**
2. Fill in the following fields:

#### Basic Information:
- **Rule Name**: Descriptive name (e.g., "Disk Cleanup for Low Space")
- **Description**: What this rule does
- **Enabled**: Toggle ON for testing
- **Priority**: 1-10 (1 = highest priority)

#### Trigger Section:
- **Trigger Type**: Select "Alert"
- **Alert Matching**:
  - Alert Type equals `DISK_SPACE_LOW`
  - Severity in [`HIGH`, `CRITICAL`]
  - Device contains `*` or specific pattern

#### Action Section:
- **Primary Action**: "Execute Script"
- **Script Selection**: Choose from dropdown or enter script ID
- **Parameters**: JSON format as shown above
- **Execution Settings**:
  - Timeout: 300 seconds
  - Retry on failure: Yes
  - Max retries: 2

#### Post-Execution:
- **Update Ticket**: Always
- **Close on Success**: Yes/No
- **Escalate on Failure**: Yes/No
- **Notification Settings**:
  - Teams: Enabled
  - Email: Optional
  - Include script output: Yes

### Step 3: Test the Rule
1. Save the rule
2. Send a test webhook to trigger it
3. Monitor the execution in the UI

---

## 🧪 Test Webhooks for Each Rule

### Test Disk Space Alert:
```bash
curl -X POST http://localhost:3001/api/webhooks/nable \
  -H "Content-Type: application/json" \
  -d '{
    "alertType": "DISK_SPACE_LOW",
    "deviceId": "SERVER-001",
    "deviceName": "ProductionServer01",
    "severity": "HIGH",
    "message": "C: drive is 95% full (4.5GB free of 100GB)",
    "cwTicketNumber": "T20240101-001",
    "cwTicketId": "12345",
    "driveInfo": {
      "drive": "C:",
      "percentUsed": 95,
      "freeSpaceGB": 4.5,
      "totalSpaceGB": 100
    }
  }'
```

### Test Service Stopped:
```bash
curl -X POST http://localhost:3001/api/webhooks/nable \
  -H "Content-Type: application/json" \
  -d '{
    "alertType": "SERVICE_STOPPED",
    "deviceId": "SERVER-002",
    "deviceName": "ApplicationServer",
    "severity": "CRITICAL",
    "message": "Windows Update service has stopped",
    "serviceName": "wuauserv",
    "serviceDisplayName": "Windows Update",
    "cwTicketNumber": "T20240101-002",
    "cwTicketId": "12346"
  }'
```

### Test High CPU:
```bash
curl -X POST http://localhost:3001/api/webhooks/nable \
  -H "Content-Type: application/json" \
  -d '{
    "alertType": "CPU_HIGH",
    "deviceId": "WS-003",
    "deviceName": "Workstation03",
    "severity": "HIGH",
    "message": "CPU usage at 95% for 10 minutes",
    "cpuPercent": 95,
    "duration": "10 minutes",
    "topProcess": "chrome.exe",
    "cwTicketNumber": "T20240101-003",
    "cwTicketId": "12347"
  }'
```

### Test Backup Failure:
```bash
curl -X POST http://localhost:3001/api/webhooks/nable \
  -H "Content-Type: application/json" \
  -d '{
    "alertType": "BACKUP_FAILED",
    "deviceId": "SERVER-004",
    "deviceName": "DatabaseServer",
    "severity": "HIGH",
    "message": "Nightly backup job failed",
    "jobName": "SQL_Daily_Backup",
    "errorCode": "INSUFFICIENT_SPACE",
    "cwTicketNumber": "T20240101-004",
    "cwTicketId": "12348"
  }'
```

---

## 📊 Expected Workflow Results

### Successful Automation Flow:
1. **Webhook Received** → "Alert received from N-able"
2. **Ticket Found** → "Found existing ConnectWise ticket T20240101-001"
3. **Rule Matched** → "Matched rule: Disk Cleanup for Low Space"
4. **Script Executed** → "Executing script: Clean-TempFiles on SERVER-001"
5. **Results Captured** → "Script completed: Freed 15.3GB of disk space"
6. **Ticket Updated** → "Added automation results to ticket notes"
7. **Ticket Closed** → "Ticket auto-closed due to successful remediation"
8. **Teams Notified** → "Sent success notification to Teams channel"

### Failed Automation Flow:
1. **Webhook Received** → Alert received
2. **Ticket Found** → Existing ticket located
3. **Rule Matched** → Rule triggered
4. **Script Executed** → Script attempted
5. **Script Failed** → "Script failed: Access denied"
6. **Retry Attempted** → "Retrying script execution (attempt 2/3)"
7. **Final Failure** → "Script failed after 3 attempts"
8. **Ticket Updated** → "Added failure details to ticket"
9. **Escalation** → "Escalated to Level 2 support"
10. **Teams Alert** → "Critical alert sent with @mentions"

---

## 🔍 Monitoring Automation Execution

### Check Automation History:
```bash
# View recent automation executions
curl http://localhost:3001/api/automation/history

# Check specific device automations
curl http://localhost:3001/api/automation/history?deviceId=SERVER-001

# Check rule execution stats
curl http://localhost:3001/api/automation/rules/{ruleId}/stats
```

### UI Monitoring:
1. Go to **Automation** → **History** tab
2. Filter by:
   - Date range
   - Status (Success/Failed/In Progress)
   - Rule name
   - Device
3. Click on any execution to see:
   - Full script output
   - Execution timeline
   - Error details (if failed)
   - Ticket updates made

---

## ⚙️ Advanced Configuration

### Conditional Rules:
```json
{
  "conditions": {
    "AND": [
      { "field": "alertType", "operator": "equals", "value": "DISK_SPACE_LOW" },
      { "field": "severity", "operator": "in", "value": ["HIGH", "CRITICAL"] },
      { "field": "deviceName", "operator": "contains", "value": "PROD" }
    ]
  }
}
```

### Multi-Action Rules:
```json
{
  "actions": [
    {
      "type": "script",
      "scriptId": "cleanup-disk",
      "order": 1
    },
    {
      "type": "ticket-update",
      "note": "Automation initiated",
      "order": 2
    },
    {
      "type": "notification",
      "channel": "teams",
      "order": 3
    }
  ]
}
```

### Schedule-Based Rules:
```json
{
  "schedule": {
    "enabled": true,
    "activeHours": {
      "start": "08:00",
      "end": "18:00",
      "timezone": "America/New_York",
      "daysOfWeek": ["Mon", "Tue", "Wed", "Thu", "Fri"]
    },
    "afterHoursAction": "escalate"
  }
}
```

---

## 📝 Validation Checklist

Before testing, ensure:
- [ ] Automation rules are created and enabled
- [ ] Script names match available N-able scripts
- [ ] ConnectWise ticket numbers in webhooks are valid
- [ ] Teams webhook URL is configured (if using notifications)
- [ ] Escalation contacts are defined
- [ ] Test in this order: Disk → Service → CPU → Backup
- [ ] Monitor logs: `tail -f backend/logs/combined.log`
- [ ] Check UI for execution history
- [ ] Verify ticket updates in ConnectWise

---

## 🚀 Quick Start Test Sequence

```bash
# 1. Create all four rules in the UI first

# 2. Run this test sequence:
./test-full-workflow.sh

# Or manually:
# Test 1: Disk cleanup
curl -X POST http://localhost:3001/api/webhooks/nable \
  -H "Content-Type: application/json" \
  -d '{"alertType":"DISK_SPACE_LOW","deviceId":"TEST-001","severity":"HIGH","cwTicketNumber":"T-TEST-001"}'

sleep 5

# Test 2: Service restart
curl -X POST http://localhost:3001/api/webhooks/nable \
  -H "Content-Type: application/json" \
  -d '{"alertType":"SERVICE_STOPPED","deviceId":"TEST-002","severity":"CRITICAL","serviceName":"wuauserv","cwTicketNumber":"T-TEST-002"}'

sleep 5

# Check results
curl http://localhost:3001/api/automation/history
```

This should demonstrate the complete workflow from alert to resolution!

## Complete Workflow Testing Configuration

This guide provides all the information needed to create automation rules for testing the full N-able → ConnectWise → Automation workflow.

---

## 📋 Required Automation Rules for Testing

### Rule 1: Disk Space Cleanup
**Purpose**: Automatically clean disk space when N-able detects low disk space

#### Trigger Configuration:
- **Trigger Type**: `Alert`
- **Alert Type**: `DISK_SPACE_LOW`
- **Severity Filter**: `HIGH` or `CRITICAL`
- **Device Filter**: `*` (all devices) or specific device IDs for testing

#### Action Configuration:
- **Action Type**: `Execute Script`
- **Script Name**: `Clean-TempFiles` or `Disk-Cleanup`
- **Script Parameters**:
  ```json
  {
    "targetDrive": "C:",
    "cleanupType": "temp_files",
    "thresholdGB": "10",
    "deleteOlderThanDays": "30"
  }
  ```
- **Timeout**: `300` seconds (5 minutes)
- **Max Retries**: `2`

#### Response Actions:
- **On Success**: 
  - Update ConnectWise ticket with results
  - Add note: "Automated disk cleanup completed. Freed {freedSpace}GB"
  - Close ticket automatically
- **On Failure**:
  - Update ticket with error details
  - Escalate to technician
  - Send Teams notification

---

### Rule 2: Service Restart
**Purpose**: Automatically restart stopped services

#### Trigger Configuration:
- **Trigger Type**: `Alert`
- **Alert Type**: `SERVICE_STOPPED`
- **Severity Filter**: `CRITICAL`
- **Service Name Filter**: Can specify specific services like:
  - `wuauserv` (Windows Update)
  - `Spooler` (Print Spooler)
  - `W32Time` (Windows Time)

#### Action Configuration:
- **Action Type**: `Execute Script`
- **Script Name**: `Restart-Service`
- **Script Parameters**:
  ```json
  {
    "serviceName": "{alertServiceName}",
    "forcedRestart": "true",
    "waitTime": "30",
    "verifyRunning": "true"
  }
  ```
- **Timeout**: `120` seconds
- **Max Retries**: `3`

#### Response Actions:
- **On Success**:
  - Update ticket: "Service {serviceName} restarted successfully"
  - Close ticket
- **On Failure**:
  - Update ticket: "Failed to restart service after {attempts} attempts"
  - Escalate to Level 2 support
  - Send critical Teams alert

---

### Rule 3: High CPU Usage
**Purpose**: Analyze and remediate high CPU usage

#### Trigger Configuration:
- **Trigger Type**: `Alert`
- **Alert Type**: `CPU_HIGH`
- **Severity Filter**: `HIGH`
- **Threshold**: `> 90%` for more than 5 minutes

#### Action Configuration:
- **Action Type**: `Execute Script`
- **Script Name**: `Analyze-HighCPU`
- **Script Parameters**:
  ```json
  {
    "topProcesses": "10",
    "killIfOver": "95",
    "excludeProcesses": ["System", "svchost", "csrss"],
    "collectDiagnostics": "true"
  }
  ```
- **Timeout**: `180` seconds
- **Max Retries**: `1`

#### Response Actions:
- **On Success**:
  - Update ticket with process analysis
  - If process killed: Note which process and why
  - Mark as resolved
- **On Failure**:
  - Keep ticket open
  - Assign to technician
  - Priority: High

---

### Rule 4: Backup Failure
**Purpose**: Retry failed backups or escalate

#### Trigger Configuration:
- **Trigger Type**: `Alert`
- **Alert Type**: `BACKUP_FAILED`
- **Severity Filter**: `HIGH`
- **Source**: `Backup Software Alert`

#### Action Configuration:
- **Action Type**: `Execute Script`
- **Script Name**: `Retry-Backup`
- **Script Parameters**:
  ```json
  {
    "backupJob": "{jobName}",
    "retryType": "incremental",
    "verifySpace": "true",
    "notifyOnStart": "true"
  }
  ```
- **Timeout**: `600` seconds (10 minutes)
- **Max Retries**: `1`

#### Response Actions:
- **On Success**:
  - Update ticket: "Backup completed successfully on retry"
  - Close ticket
- **On Failure**:
  - Escalate immediately
  - Send Teams alert with @mention
  - Priority: Critical

---

## 🔧 How to Create Rules in the UI

### Step 1: Access Automation Section
1. Navigate to http://localhost:3000
2. Login with admin credentials
3. Click on **Automation** in the sidebar

### Step 2: Create New Rule
1. Click **"+ Add Rule"** or **"Create Automation Rule"**
2. Fill in the following fields:

#### Basic Information:
- **Rule Name**: Descriptive name (e.g., "Disk Cleanup for Low Space")
- **Description**: What this rule does
- **Enabled**: Toggle ON for testing
- **Priority**: 1-10 (1 = highest priority)

#### Trigger Section:
- **Trigger Type**: Select "Alert"
- **Alert Matching**:
  - Alert Type equals `DISK_SPACE_LOW`
  - Severity in [`HIGH`, `CRITICAL`]
  - Device contains `*` or specific pattern

#### Action Section:
- **Primary Action**: "Execute Script"
- **Script Selection**: Choose from dropdown or enter script ID
- **Parameters**: JSON format as shown above
- **Execution Settings**:
  - Timeout: 300 seconds
  - Retry on failure: Yes
  - Max retries: 2

#### Post-Execution:
- **Update Ticket**: Always
- **Close on Success**: Yes/No
- **Escalate on Failure**: Yes/No
- **Notification Settings**:
  - Teams: Enabled
  - Email: Optional
  - Include script output: Yes

### Step 3: Test the Rule
1. Save the rule
2. Send a test webhook to trigger it
3. Monitor the execution in the UI

---

## 🧪 Test Webhooks for Each Rule

### Test Disk Space Alert:
```bash
curl -X POST http://localhost:3001/api/webhooks/nable \
  -H "Content-Type: application/json" \
  -d '{
    "alertType": "DISK_SPACE_LOW",
    "deviceId": "SERVER-001",
    "deviceName": "ProductionServer01",
    "severity": "HIGH",
    "message": "C: drive is 95% full (4.5GB free of 100GB)",
    "cwTicketNumber": "T20240101-001",
    "cwTicketId": "12345",
    "driveInfo": {
      "drive": "C:",
      "percentUsed": 95,
      "freeSpaceGB": 4.5,
      "totalSpaceGB": 100
    }
  }'
```

### Test Service Stopped:
```bash
curl -X POST http://localhost:3001/api/webhooks/nable \
  -H "Content-Type: application/json" \
  -d '{
    "alertType": "SERVICE_STOPPED",
    "deviceId": "SERVER-002",
    "deviceName": "ApplicationServer",
    "severity": "CRITICAL",
    "message": "Windows Update service has stopped",
    "serviceName": "wuauserv",
    "serviceDisplayName": "Windows Update",
    "cwTicketNumber": "T20240101-002",
    "cwTicketId": "12346"
  }'
```

### Test High CPU:
```bash
curl -X POST http://localhost:3001/api/webhooks/nable \
  -H "Content-Type: application/json" \
  -d '{
    "alertType": "CPU_HIGH",
    "deviceId": "WS-003",
    "deviceName": "Workstation03",
    "severity": "HIGH",
    "message": "CPU usage at 95% for 10 minutes",
    "cpuPercent": 95,
    "duration": "10 minutes",
    "topProcess": "chrome.exe",
    "cwTicketNumber": "T20240101-003",
    "cwTicketId": "12347"
  }'
```

### Test Backup Failure:
```bash
curl -X POST http://localhost:3001/api/webhooks/nable \
  -H "Content-Type: application/json" \
  -d '{
    "alertType": "BACKUP_FAILED",
    "deviceId": "SERVER-004",
    "deviceName": "DatabaseServer",
    "severity": "HIGH",
    "message": "Nightly backup job failed",
    "jobName": "SQL_Daily_Backup",
    "errorCode": "INSUFFICIENT_SPACE",
    "cwTicketNumber": "T20240101-004",
    "cwTicketId": "12348"
  }'
```

---

## 📊 Expected Workflow Results

### Successful Automation Flow:
1. **Webhook Received** → "Alert received from N-able"
2. **Ticket Found** → "Found existing ConnectWise ticket T20240101-001"
3. **Rule Matched** → "Matched rule: Disk Cleanup for Low Space"
4. **Script Executed** → "Executing script: Clean-TempFiles on SERVER-001"
5. **Results Captured** → "Script completed: Freed 15.3GB of disk space"
6. **Ticket Updated** → "Added automation results to ticket notes"
7. **Ticket Closed** → "Ticket auto-closed due to successful remediation"
8. **Teams Notified** → "Sent success notification to Teams channel"

### Failed Automation Flow:
1. **Webhook Received** → Alert received
2. **Ticket Found** → Existing ticket located
3. **Rule Matched** → Rule triggered
4. **Script Executed** → Script attempted
5. **Script Failed** → "Script failed: Access denied"
6. **Retry Attempted** → "Retrying script execution (attempt 2/3)"
7. **Final Failure** → "Script failed after 3 attempts"
8. **Ticket Updated** → "Added failure details to ticket"
9. **Escalation** → "Escalated to Level 2 support"
10. **Teams Alert** → "Critical alert sent with @mentions"

---

## 🔍 Monitoring Automation Execution

### Check Automation History:
```bash
# View recent automation executions
curl http://localhost:3001/api/automation/history

# Check specific device automations
curl http://localhost:3001/api/automation/history?deviceId=SERVER-001

# Check rule execution stats
curl http://localhost:3001/api/automation/rules/{ruleId}/stats
```

### UI Monitoring:
1. Go to **Automation** → **History** tab
2. Filter by:
   - Date range
   - Status (Success/Failed/In Progress)
   - Rule name
   - Device
3. Click on any execution to see:
   - Full script output
   - Execution timeline
   - Error details (if failed)
   - Ticket updates made

---

## ⚙️ Advanced Configuration

### Conditional Rules:
```json
{
  "conditions": {
    "AND": [
      { "field": "alertType", "operator": "equals", "value": "DISK_SPACE_LOW" },
      { "field": "severity", "operator": "in", "value": ["HIGH", "CRITICAL"] },
      { "field": "deviceName", "operator": "contains", "value": "PROD" }
    ]
  }
}
```

### Multi-Action Rules:
```json
{
  "actions": [
    {
      "type": "script",
      "scriptId": "cleanup-disk",
      "order": 1
    },
    {
      "type": "ticket-update",
      "note": "Automation initiated",
      "order": 2
    },
    {
      "type": "notification",
      "channel": "teams",
      "order": 3
    }
  ]
}
```

### Schedule-Based Rules:
```json
{
  "schedule": {
    "enabled": true,
    "activeHours": {
      "start": "08:00",
      "end": "18:00",
      "timezone": "America/New_York",
      "daysOfWeek": ["Mon", "Tue", "Wed", "Thu", "Fri"]
    },
    "afterHoursAction": "escalate"
  }
}
```

---

## 📝 Validation Checklist

Before testing, ensure:
- [ ] Automation rules are created and enabled
- [ ] Script names match available N-able scripts
- [ ] ConnectWise ticket numbers in webhooks are valid
- [ ] Teams webhook URL is configured (if using notifications)
- [ ] Escalation contacts are defined
- [ ] Test in this order: Disk → Service → CPU → Backup
- [ ] Monitor logs: `tail -f backend/logs/combined.log`
- [ ] Check UI for execution history
- [ ] Verify ticket updates in ConnectWise

---

## 🚀 Quick Start Test Sequence

```bash
# 1. Create all four rules in the UI first

# 2. Run this test sequence:
./test-full-workflow.sh

# Or manually:
# Test 1: Disk cleanup
curl -X POST http://localhost:3001/api/webhooks/nable \
  -H "Content-Type: application/json" \
  -d '{"alertType":"DISK_SPACE_LOW","deviceId":"TEST-001","severity":"HIGH","cwTicketNumber":"T-TEST-001"}'

sleep 5

# Test 2: Service restart
curl -X POST http://localhost:3001/api/webhooks/nable \
  -H "Content-Type: application/json" \
  -d '{"alertType":"SERVICE_STOPPED","deviceId":"TEST-002","severity":"CRITICAL","serviceName":"wuauserv","cwTicketNumber":"T-TEST-002"}'

sleep 5

# Check results
curl http://localhost:3001/api/automation/history
```

This should demonstrate the complete workflow from alert to resolution!
