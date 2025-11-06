# ✅ Updated Rule Editor UI for N-able Alert Automation

## Changes Made to Support Automation Rules

### 1. **Updated Trigger Types**
- Added `N-able Alert` as the primary trigger type
- This is now the default selection for new rules

### 2. **Alert-Specific Condition Fields**
Added fields specific to N-able alerts:
- `alertType` - Type of alert (dropdown with predefined values)
- `severity` - Alert severity level
- `deviceId` - Device identifier
- `deviceName` - Device name
- `serviceName` - For service-related alerts
- `cpuPercent` - For CPU monitoring
- `memoryPercent` - For memory monitoring
- `diskPercent` - For disk usage monitoring

### 3. **Predefined Alert Types**
Dropdown menu includes:
- `DISK_SPACE_LOW` - Disk Space Low
- `SERVICE_STOPPED` - Service Stopped
- `CPU_HIGH` - High CPU Usage
- `MEMORY_HIGH` - High Memory Usage
- `BACKUP_FAILED` - Backup Failed
- `SERVER_DOWN` - Server Down
- `NETWORK_ISSUE` - Network Issue
- And more...

### 4. **Enhanced Condition Operators**
- Added `in` operator for comma-separated values
- Added `greater_than` and `less_than` for numeric comparisons
- Perfect for CPU/Memory/Disk percentage thresholds

### 5. **Script Execution Action**
Primary action type is now `Execute N-able Script` with:
- **Script Selection**: Dropdown with available scripts
  - Clean-TempFiles
  - Restart-Service
  - Analyze-HighCPU
  - Clear-Memory
  - Retry-Backup
  - And more...
- **Parameters**: JSON input field for script parameters
- **Timeout**: Configurable timeout in seconds
- **Max Retries**: Number of retry attempts
- **On Success**: Action to take (Close Ticket, Update Ticket, Do Nothing)
- **On Failure**: Action to take (Escalate, Send Teams Alert, Retry)

### 6. **Other Action Types**
- `Update ConnectWise Ticket` - Update ticket fields
- `Close Ticket` - Auto-close with note
- `Add Ticket Note` - Add notes with variables
- `Escalate to Technician` - Escalate with priority
- `Send Teams Notification` - Teams alerts with mentions
- `Assign Ticket` - Assign to specific tech
- `Set Priority` - Change ticket priority

### 7. **Visual Helpers**
- Info alert when "N-able Alert" trigger is selected
- Quick start guide for new rules
- Example text showing common conditions
- Helper text for JSON parameters
- Variable placeholders ({{deviceName}}, {{alertType}}, etc.)

## How to Create a Rule in the Updated UI

### Step 1: Basic Information
1. **Name**: Enter a descriptive name (e.g., "Disk Space Auto-Cleanup")
2. **Priority**: Set to 1 for high priority
3. **Active**: Toggle ON to enable immediately
4. **Description**: Brief description of what the rule does

### Step 2: Trigger Configuration
1. **Trigger Type**: Select `N-able Alert`
2. You'll see an info box explaining how alert triggers work

### Step 3: Add Conditions
1. Click **"Add Condition"**
2. **Field**: Select `alertType`
3. **Operator**: Select `equals`
4. **Value**: Select from dropdown (e.g., `DISK_SPACE_LOW`)
5. Add more conditions as needed
6. Choose "Match ALL conditions" (AND) or "Match ANY condition" (OR)

### Step 4: Add Actions
1. Click **"Add Action"**
2. **Action Type**: Select `Execute N-able Script`
3. **Script Name**: Select from dropdown (e.g., `Clean-TempFiles`)
4. **Script Parameters**: Enter as JSON:
   ```json
   {"targetDrive": "C:", "threshold": "10"}
   ```
5. **Timeout**: 300 seconds
6. **Max Retries**: 2
7. **On Success**: Select `Close Ticket`
8. **On Failure**: Select `Escalate to Technician`

### Step 5: Save
Click **"Save"** button to create the rule

## Example Rule Creation

### For Disk Space Cleanup:
- **Name**: "Disk Space Auto-Cleanup"
- **Trigger**: N-able Alert
- **Conditions**: 
  - alertType = DISK_SPACE_LOW
  - severity in (HIGH, CRITICAL)
- **Action**: Execute Script
  - Script: Clean-TempFiles
  - Parameters: `{"targetDrive": "C:", "threshold": "10"}`
  - On Success: Close Ticket
  - On Failure: Escalate

### For Service Restart:
- **Name**: "Service Auto-Restart"
- **Trigger**: N-able Alert
- **Conditions**:
  - alertType = SERVICE_STOPPED
  - severity = CRITICAL
- **Action**: Execute Script
  - Script: Restart-Service
  - Parameters: `{"serviceName": "{{alertServiceName}}", "forcedRestart": "true"}`
  - On Success: Close Ticket
  - On Failure: Send Teams Alert

## Navigation

1. Go to http://localhost:3000
2. Login with admin credentials
3. Navigate to **Automation** section
4. Click **"+ Add Rule"** button
5. You'll be redirected to `/automation/rules/new`
6. The updated Rule Editor will load with all the new features

## Testing Your Rule

After creating a rule:
1. It will appear in the Automation rules list
2. Make sure it shows as "Enabled"
3. Send a test webhook to trigger it:

```bash
curl -X POST http://localhost:3001/api/webhooks/nable \
  -H "Content-Type: application/json" \
  -d '{"alertType":"DISK_SPACE_LOW","severity":"HIGH","deviceId":"TEST-001"}'
```

4. Check Automation History to see if the rule triggered

## Benefits of the Update

✅ **Alert-Focused**: Designed specifically for N-able alert automation
✅ **User-Friendly**: Dropdowns for common values instead of free text
✅ **Script Integration**: Direct script execution with parameter configuration
✅ **Success/Failure Handling**: Built-in actions for different outcomes
✅ **Visual Guidance**: Helper text and info boxes guide users
✅ **Variable Support**: Use {{variables}} for dynamic content
✅ **Pre-configured Options**: All common scripts and alert types included

The UI is now perfectly aligned with your N-able → ConnectWise automation workflow!

## Changes Made to Support Automation Rules

### 1. **Updated Trigger Types**
- Added `N-able Alert` as the primary trigger type
- This is now the default selection for new rules

### 2. **Alert-Specific Condition Fields**
Added fields specific to N-able alerts:
- `alertType` - Type of alert (dropdown with predefined values)
- `severity` - Alert severity level
- `deviceId` - Device identifier
- `deviceName` - Device name
- `serviceName` - For service-related alerts
- `cpuPercent` - For CPU monitoring
- `memoryPercent` - For memory monitoring
- `diskPercent` - For disk usage monitoring

### 3. **Predefined Alert Types**
Dropdown menu includes:
- `DISK_SPACE_LOW` - Disk Space Low
- `SERVICE_STOPPED` - Service Stopped
- `CPU_HIGH` - High CPU Usage
- `MEMORY_HIGH` - High Memory Usage
- `BACKUP_FAILED` - Backup Failed
- `SERVER_DOWN` - Server Down
- `NETWORK_ISSUE` - Network Issue
- And more...

### 4. **Enhanced Condition Operators**
- Added `in` operator for comma-separated values
- Added `greater_than` and `less_than` for numeric comparisons
- Perfect for CPU/Memory/Disk percentage thresholds

### 5. **Script Execution Action**
Primary action type is now `Execute N-able Script` with:
- **Script Selection**: Dropdown with available scripts
  - Clean-TempFiles
  - Restart-Service
  - Analyze-HighCPU
  - Clear-Memory
  - Retry-Backup
  - And more...
- **Parameters**: JSON input field for script parameters
- **Timeout**: Configurable timeout in seconds
- **Max Retries**: Number of retry attempts
- **On Success**: Action to take (Close Ticket, Update Ticket, Do Nothing)
- **On Failure**: Action to take (Escalate, Send Teams Alert, Retry)

### 6. **Other Action Types**
- `Update ConnectWise Ticket` - Update ticket fields
- `Close Ticket` - Auto-close with note
- `Add Ticket Note` - Add notes with variables
- `Escalate to Technician` - Escalate with priority
- `Send Teams Notification` - Teams alerts with mentions
- `Assign Ticket` - Assign to specific tech
- `Set Priority` - Change ticket priority

### 7. **Visual Helpers**
- Info alert when "N-able Alert" trigger is selected
- Quick start guide for new rules
- Example text showing common conditions
- Helper text for JSON parameters
- Variable placeholders ({{deviceName}}, {{alertType}}, etc.)

## How to Create a Rule in the Updated UI

### Step 1: Basic Information
1. **Name**: Enter a descriptive name (e.g., "Disk Space Auto-Cleanup")
2. **Priority**: Set to 1 for high priority
3. **Active**: Toggle ON to enable immediately
4. **Description**: Brief description of what the rule does

### Step 2: Trigger Configuration
1. **Trigger Type**: Select `N-able Alert`
2. You'll see an info box explaining how alert triggers work

### Step 3: Add Conditions
1. Click **"Add Condition"**
2. **Field**: Select `alertType`
3. **Operator**: Select `equals`
4. **Value**: Select from dropdown (e.g., `DISK_SPACE_LOW`)
5. Add more conditions as needed
6. Choose "Match ALL conditions" (AND) or "Match ANY condition" (OR)

### Step 4: Add Actions
1. Click **"Add Action"**
2. **Action Type**: Select `Execute N-able Script`
3. **Script Name**: Select from dropdown (e.g., `Clean-TempFiles`)
4. **Script Parameters**: Enter as JSON:
   ```json
   {"targetDrive": "C:", "threshold": "10"}
   ```
5. **Timeout**: 300 seconds
6. **Max Retries**: 2
7. **On Success**: Select `Close Ticket`
8. **On Failure**: Select `Escalate to Technician`

### Step 5: Save
Click **"Save"** button to create the rule

## Example Rule Creation

### For Disk Space Cleanup:
- **Name**: "Disk Space Auto-Cleanup"
- **Trigger**: N-able Alert
- **Conditions**: 
  - alertType = DISK_SPACE_LOW
  - severity in (HIGH, CRITICAL)
- **Action**: Execute Script
  - Script: Clean-TempFiles
  - Parameters: `{"targetDrive": "C:", "threshold": "10"}`
  - On Success: Close Ticket
  - On Failure: Escalate

### For Service Restart:
- **Name**: "Service Auto-Restart"
- **Trigger**: N-able Alert
- **Conditions**:
  - alertType = SERVICE_STOPPED
  - severity = CRITICAL
- **Action**: Execute Script
  - Script: Restart-Service
  - Parameters: `{"serviceName": "{{alertServiceName}}", "forcedRestart": "true"}`
  - On Success: Close Ticket
  - On Failure: Send Teams Alert

## Navigation

1. Go to http://localhost:3000
2. Login with admin credentials
3. Navigate to **Automation** section
4. Click **"+ Add Rule"** button
5. You'll be redirected to `/automation/rules/new`
6. The updated Rule Editor will load with all the new features

## Testing Your Rule

After creating a rule:
1. It will appear in the Automation rules list
2. Make sure it shows as "Enabled"
3. Send a test webhook to trigger it:

```bash
curl -X POST http://localhost:3001/api/webhooks/nable \
  -H "Content-Type: application/json" \
  -d '{"alertType":"DISK_SPACE_LOW","severity":"HIGH","deviceId":"TEST-001"}'
```

4. Check Automation History to see if the rule triggered

## Benefits of the Update

✅ **Alert-Focused**: Designed specifically for N-able alert automation
✅ **User-Friendly**: Dropdowns for common values instead of free text
✅ **Script Integration**: Direct script execution with parameter configuration
✅ **Success/Failure Handling**: Built-in actions for different outcomes
✅ **Visual Guidance**: Helper text and info boxes guide users
✅ **Variable Support**: Use {{variables}} for dynamic content
✅ **Pre-configured Options**: All common scripts and alert types included

The UI is now perfectly aligned with your N-able → ConnectWise automation workflow!
