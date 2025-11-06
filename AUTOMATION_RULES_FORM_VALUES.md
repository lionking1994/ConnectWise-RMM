# 📝 Automation Rules - Form Input Values

Copy and paste these values directly into the UI when creating automation rules.

---

## 🔴 **RULE 1: DISK SPACE CLEANUP**

### Basic Information
- **Name**: `Disk Space Auto-Cleanup`
- **Priority**: `1`
- **Description**: `Automatically clean temporary files when disk space is critically low`
- **Enabled**: ✅ Yes

### Trigger Configuration
- **Trigger Type**: `Alert`

### Conditions
- **Field**: `alertType`
- **Operator**: `equals`
- **Value**: `DISK_SPACE_LOW`

**AND**

- **Field**: `severity`
- **Operator**: `in`
- **Value**: `HIGH,CRITICAL`

### Actions

#### Action 1: Execute Script
- **Action Type**: `Execute Script`
- **Script ID/Name**: `Clean-TempFiles`
- **Parameters** (JSON):
```json
{
  "targetDrive": "C:",
  "cleanupType": "temp_files",
  "thresholdGB": "10",
  "deleteOlderThanDays": "30"
}
```
- **Timeout**: `300`
- **Max Retries**: `2`

#### Action 2: Update Ticket
- **Action Type**: `Update Ticket`
- **On Success**:
  - **Add Note**: `Automated disk cleanup completed successfully. Freed disk space on drive.`
  - **Close Ticket**: ✅ Yes
  - **Set Status**: `Resolved`
- **On Failure**:
  - **Add Note**: `Disk cleanup automation failed. Manual intervention required.`
  - **Escalate**: ✅ Yes
  - **Assign To**: `Level 2 Support`

---

## 🟠 **RULE 2: SERVICE RESTART**

### Basic Information
- **Name**: `Critical Service Auto-Restart`
- **Priority**: `1`
- **Description**: `Automatically restart stopped critical Windows services`
- **Enabled**: ✅ Yes

### Trigger Configuration
- **Trigger Type**: `Alert`

### Conditions
- **Field**: `alertType`
- **Operator**: `equals`
- **Value**: `SERVICE_STOPPED`

**AND**

- **Field**: `severity`
- **Operator**: `equals`
- **Value**: `CRITICAL`

### Actions

#### Action 1: Execute Script
- **Action Type**: `Execute Script`
- **Script ID/Name**: `Restart-Service`
- **Parameters** (JSON):
```json
{
  "serviceName": "{{alertServiceName}}",
  "forcedRestart": "true",
  "waitTime": "30",
  "verifyRunning": "true"
}
```
- **Timeout**: `120`
- **Max Retries**: `3`

#### Action 2: Update Ticket
- **Action Type**: `Update Ticket`
- **On Success**:
  - **Add Note**: `Service restarted successfully via automation.`
  - **Close Ticket**: ✅ Yes
  - **Set Status**: `Resolved`
- **On Failure**:
  - **Add Note**: `Failed to restart service after multiple attempts. Escalating to technician.`
  - **Escalate**: ✅ Yes
  - **Set Priority**: `Critical`

#### Action 3: Send Notification (On Failure)
- **Action Type**: `Send Notification`
- **Channel**: `Teams`
- **Message**: `CRITICAL: Service restart failed on {{deviceName}}`
- **Mentions**: `@oncall-tech`

---

## 🟡 **RULE 3: HIGH CPU RESOLUTION**

### Basic Information
- **Name**: `High CPU Auto-Analysis`
- **Priority**: `2`
- **Description**: `Analyze and resolve high CPU usage issues`
- **Enabled**: ✅ Yes

### Trigger Configuration
- **Trigger Type**: `Alert`

### Conditions
- **Field**: `alertType`
- **Operator**: `equals`
- **Value**: `CPU_HIGH`

**AND**

- **Field**: `cpuPercent`
- **Operator**: `greater_than`
- **Value**: `90`

### Actions

#### Action 1: Execute Script
- **Action Type**: `Execute Script`
- **Script ID/Name**: `Analyze-HighCPU`
- **Parameters** (JSON):
```json
{
  "topProcesses": "10",
  "killIfOver": "95",
  "excludeProcesses": ["System", "svchost", "csrss"],
  "collectDiagnostics": "true"
}
```
- **Timeout**: `180`
- **Max Retries**: `1`

#### Action 2: Update Ticket
- **Action Type**: `Update Ticket`
- **Always**:
  - **Add Note**: `CPU analysis completed. Process report attached to ticket.`
- **On Success**:
  - **Set Status**: `Resolved`
- **On Failure**:
  - **Add Note**: `Unable to automatically resolve high CPU. Manual review required.`
  - **Assign To**: `Primary Technician`
  - **Set Priority**: `High`

---

## 🟢 **RULE 4: BACKUP RECOVERY**

### Basic Information
- **Name**: `Backup Failure Auto-Retry`
- **Priority**: `1`
- **Description**: `Automatically retry failed backup jobs`
- **Enabled**: ✅ Yes

### Trigger Configuration
- **Trigger Type**: `Alert`

### Conditions
- **Field**: `alertType`
- **Operator**: `equals`
- **Value**: `BACKUP_FAILED`

**AND**

- **Field**: `severity`
- **Operator**: `in`
- **Value**: `HIGH,CRITICAL`

### Actions

#### Action 1: Execute Script
- **Action Type**: `Execute Script`
- **Script ID/Name**: `Retry-Backup`
- **Parameters** (JSON):
```json
{
  "backupJob": "{{jobName}}",
  "retryType": "incremental",
  "verifySpace": "true",
  "notifyOnStart": "true"
}
```
- **Timeout**: `600`
- **Max Retries**: `1`

#### Action 2: Update Ticket
- **Action Type**: `Update Ticket`
- **On Success**:
  - **Add Note**: `Backup completed successfully on retry.`
  - **Close Ticket**: ✅ Yes
  - **Set Status**: `Resolved`
- **On Failure**:
  - **Add Note**: `CRITICAL: Backup retry failed. Immediate attention required!`
  - **Escalate**: ✅ Yes
  - **Set Priority**: `Critical`
  - **Assign To**: `Backup Team`

#### Action 3: Send Notification
- **Action Type**: `Send Notification`
- **Channel**: `Teams`
- **On Failure**:
  - **Message**: `CRITICAL BACKUP FAILURE: {{jobName}} on {{deviceName}}`
  - **Mentions**: `@backup-team,@manager`
  - **Urgency**: `High`

---

## 🔧 **RULE 5: MEMORY LEAK DETECTION** (Bonus)

### Basic Information
- **Name**: `Memory Leak Auto-Fix`
- **Priority**: `2`
- **Description**: `Detect and resolve memory leaks`
- **Enabled**: ✅ Yes

### Trigger Configuration
- **Trigger Type**: `Alert`

### Conditions
- **Field**: `alertType`
- **Operator**: `equals`
- **Value**: `MEMORY_HIGH`

**AND**

- **Field**: `memoryPercent`
- **Operator**: `greater_than`
- **Value**: `85`

### Actions

#### Action 1: Execute Script
- **Action Type**: `Execute Script`
- **Script ID/Name**: `Clear-Memory`
- **Parameters** (JSON):
```json
{
  "clearPageFile": "true",
  "restartIIS": "false",
  "clearDNSCache": "true",
  "threshold": "85"
}
```
- **Timeout**: `240`
- **Max Retries**: `2`

---

## 📋 **Common Field Values Reference**

### Trigger Types
- `Alert`
- `Schedule`
- `Manual`
- `Webhook`

### Alert Types
- `DISK_SPACE_LOW`
- `SERVICE_STOPPED`
- `CPU_HIGH`
- `BACKUP_FAILED`
- `MEMORY_HIGH`
- `SERVER_DOWN`
- `NETWORK_ISSUE`

### Severity Levels
- `LOW`
- `MEDIUM`
- `HIGH`
- `CRITICAL`

### Status Values
- `Open`
- `In Progress`
- `Pending`
- `Resolved`
- `Closed`

### Operators
- `equals`
- `not_equals`
- `contains`
- `not_contains`
- `greater_than`
- `less_than`
- `in`
- `not_in`

### Action Types
- `Execute Script`
- `Update Ticket`
- `Send Notification`
- `Create Ticket`
- `Escalate`
- `Wait`
- `Run Command`

---

## 💡 **Variable Placeholders**

These variables can be used in text fields:
- `{{alertType}}` - Type of alert
- `{{deviceName}}` - Name of affected device
- `{{deviceId}}` - Device identifier
- `{{severity}}` - Alert severity
- `{{ticketNumber}}` - ConnectWise ticket number
- `{{serviceName}}` - Name of service (for SERVICE_STOPPED)
- `{{jobName}}` - Backup job name (for BACKUP_FAILED)
- `{{cpuPercent}}` - CPU usage percentage
- `{{freedSpace}}` - Space freed (for disk cleanup)
- `{{timestamp}}` - Current timestamp
- `{{error}}` - Error message from failed script
- `{{attempts}}` - Number of retry attempts

---

## ✨ **Tips for Creating Rules**

1. **Start Simple**: Create Rule 1 first and test it
2. **Use Priority 1**: For critical automations (service restart, backup)
3. **Use Priority 2**: For analysis/monitoring (CPU, memory)
4. **Always Include**: Both success and failure actions
5. **Test Variables**: Use `{{variableName}}` in notes to capture dynamic data
6. **Set Timeouts**: Based on expected script duration + 20% buffer
7. **Enable Gradually**: Start with one rule enabled, add more as you verify

Copy these values directly into your automation rule forms!

Copy and paste these values directly into the UI when creating automation rules.

---

## 🔴 **RULE 1: DISK SPACE CLEANUP**

### Basic Information
- **Name**: `Disk Space Auto-Cleanup`
- **Priority**: `1`
- **Description**: `Automatically clean temporary files when disk space is critically low`
- **Enabled**: ✅ Yes

### Trigger Configuration
- **Trigger Type**: `Alert`

### Conditions
- **Field**: `alertType`
- **Operator**: `equals`
- **Value**: `DISK_SPACE_LOW`

**AND**

- **Field**: `severity`
- **Operator**: `in`
- **Value**: `HIGH,CRITICAL`

### Actions

#### Action 1: Execute Script
- **Action Type**: `Execute Script`
- **Script ID/Name**: `Clean-TempFiles`
- **Parameters** (JSON):
```json
{
  "targetDrive": "C:",
  "cleanupType": "temp_files",
  "thresholdGB": "10",
  "deleteOlderThanDays": "30"
}
```
- **Timeout**: `300`
- **Max Retries**: `2`

#### Action 2: Update Ticket
- **Action Type**: `Update Ticket`
- **On Success**:
  - **Add Note**: `Automated disk cleanup completed successfully. Freed disk space on drive.`
  - **Close Ticket**: ✅ Yes
  - **Set Status**: `Resolved`
- **On Failure**:
  - **Add Note**: `Disk cleanup automation failed. Manual intervention required.`
  - **Escalate**: ✅ Yes
  - **Assign To**: `Level 2 Support`

---

## 🟠 **RULE 2: SERVICE RESTART**

### Basic Information
- **Name**: `Critical Service Auto-Restart`
- **Priority**: `1`
- **Description**: `Automatically restart stopped critical Windows services`
- **Enabled**: ✅ Yes

### Trigger Configuration
- **Trigger Type**: `Alert`

### Conditions
- **Field**: `alertType`
- **Operator**: `equals`
- **Value**: `SERVICE_STOPPED`

**AND**

- **Field**: `severity`
- **Operator**: `equals`
- **Value**: `CRITICAL`

### Actions

#### Action 1: Execute Script
- **Action Type**: `Execute Script`
- **Script ID/Name**: `Restart-Service`
- **Parameters** (JSON):
```json
{
  "serviceName": "{{alertServiceName}}",
  "forcedRestart": "true",
  "waitTime": "30",
  "verifyRunning": "true"
}
```
- **Timeout**: `120`
- **Max Retries**: `3`

#### Action 2: Update Ticket
- **Action Type**: `Update Ticket`
- **On Success**:
  - **Add Note**: `Service restarted successfully via automation.`
  - **Close Ticket**: ✅ Yes
  - **Set Status**: `Resolved`
- **On Failure**:
  - **Add Note**: `Failed to restart service after multiple attempts. Escalating to technician.`
  - **Escalate**: ✅ Yes
  - **Set Priority**: `Critical`

#### Action 3: Send Notification (On Failure)
- **Action Type**: `Send Notification`
- **Channel**: `Teams`
- **Message**: `CRITICAL: Service restart failed on {{deviceName}}`
- **Mentions**: `@oncall-tech`

---

## 🟡 **RULE 3: HIGH CPU RESOLUTION**

### Basic Information
- **Name**: `High CPU Auto-Analysis`
- **Priority**: `2`
- **Description**: `Analyze and resolve high CPU usage issues`
- **Enabled**: ✅ Yes

### Trigger Configuration
- **Trigger Type**: `Alert`

### Conditions
- **Field**: `alertType`
- **Operator**: `equals`
- **Value**: `CPU_HIGH`

**AND**

- **Field**: `cpuPercent`
- **Operator**: `greater_than`
- **Value**: `90`

### Actions

#### Action 1: Execute Script
- **Action Type**: `Execute Script`
- **Script ID/Name**: `Analyze-HighCPU`
- **Parameters** (JSON):
```json
{
  "topProcesses": "10",
  "killIfOver": "95",
  "excludeProcesses": ["System", "svchost", "csrss"],
  "collectDiagnostics": "true"
}
```
- **Timeout**: `180`
- **Max Retries**: `1`

#### Action 2: Update Ticket
- **Action Type**: `Update Ticket`
- **Always**:
  - **Add Note**: `CPU analysis completed. Process report attached to ticket.`
- **On Success**:
  - **Set Status**: `Resolved`
- **On Failure**:
  - **Add Note**: `Unable to automatically resolve high CPU. Manual review required.`
  - **Assign To**: `Primary Technician`
  - **Set Priority**: `High`

---

## 🟢 **RULE 4: BACKUP RECOVERY**

### Basic Information
- **Name**: `Backup Failure Auto-Retry`
- **Priority**: `1`
- **Description**: `Automatically retry failed backup jobs`
- **Enabled**: ✅ Yes

### Trigger Configuration
- **Trigger Type**: `Alert`

### Conditions
- **Field**: `alertType`
- **Operator**: `equals`
- **Value**: `BACKUP_FAILED`

**AND**

- **Field**: `severity`
- **Operator**: `in`
- **Value**: `HIGH,CRITICAL`

### Actions

#### Action 1: Execute Script
- **Action Type**: `Execute Script`
- **Script ID/Name**: `Retry-Backup`
- **Parameters** (JSON):
```json
{
  "backupJob": "{{jobName}}",
  "retryType": "incremental",
  "verifySpace": "true",
  "notifyOnStart": "true"
}
```
- **Timeout**: `600`
- **Max Retries**: `1`

#### Action 2: Update Ticket
- **Action Type**: `Update Ticket`
- **On Success**:
  - **Add Note**: `Backup completed successfully on retry.`
  - **Close Ticket**: ✅ Yes
  - **Set Status**: `Resolved`
- **On Failure**:
  - **Add Note**: `CRITICAL: Backup retry failed. Immediate attention required!`
  - **Escalate**: ✅ Yes
  - **Set Priority**: `Critical`
  - **Assign To**: `Backup Team`

#### Action 3: Send Notification
- **Action Type**: `Send Notification`
- **Channel**: `Teams`
- **On Failure**:
  - **Message**: `CRITICAL BACKUP FAILURE: {{jobName}} on {{deviceName}}`
  - **Mentions**: `@backup-team,@manager`
  - **Urgency**: `High`

---

## 🔧 **RULE 5: MEMORY LEAK DETECTION** (Bonus)

### Basic Information
- **Name**: `Memory Leak Auto-Fix`
- **Priority**: `2`
- **Description**: `Detect and resolve memory leaks`
- **Enabled**: ✅ Yes

### Trigger Configuration
- **Trigger Type**: `Alert`

### Conditions
- **Field**: `alertType`
- **Operator**: `equals`
- **Value**: `MEMORY_HIGH`

**AND**

- **Field**: `memoryPercent`
- **Operator**: `greater_than`
- **Value**: `85`

### Actions

#### Action 1: Execute Script
- **Action Type**: `Execute Script`
- **Script ID/Name**: `Clear-Memory`
- **Parameters** (JSON):
```json
{
  "clearPageFile": "true",
  "restartIIS": "false",
  "clearDNSCache": "true",
  "threshold": "85"
}
```
- **Timeout**: `240`
- **Max Retries**: `2`

---

## 📋 **Common Field Values Reference**

### Trigger Types
- `Alert`
- `Schedule`
- `Manual`
- `Webhook`

### Alert Types
- `DISK_SPACE_LOW`
- `SERVICE_STOPPED`
- `CPU_HIGH`
- `BACKUP_FAILED`
- `MEMORY_HIGH`
- `SERVER_DOWN`
- `NETWORK_ISSUE`

### Severity Levels
- `LOW`
- `MEDIUM`
- `HIGH`
- `CRITICAL`

### Status Values
- `Open`
- `In Progress`
- `Pending`
- `Resolved`
- `Closed`

### Operators
- `equals`
- `not_equals`
- `contains`
- `not_contains`
- `greater_than`
- `less_than`
- `in`
- `not_in`

### Action Types
- `Execute Script`
- `Update Ticket`
- `Send Notification`
- `Create Ticket`
- `Escalate`
- `Wait`
- `Run Command`

---

## 💡 **Variable Placeholders**

These variables can be used in text fields:
- `{{alertType}}` - Type of alert
- `{{deviceName}}` - Name of affected device
- `{{deviceId}}` - Device identifier
- `{{severity}}` - Alert severity
- `{{ticketNumber}}` - ConnectWise ticket number
- `{{serviceName}}` - Name of service (for SERVICE_STOPPED)
- `{{jobName}}` - Backup job name (for BACKUP_FAILED)
- `{{cpuPercent}}` - CPU usage percentage
- `{{freedSpace}}` - Space freed (for disk cleanup)
- `{{timestamp}}` - Current timestamp
- `{{error}}` - Error message from failed script
- `{{attempts}}` - Number of retry attempts

---

## ✨ **Tips for Creating Rules**

1. **Start Simple**: Create Rule 1 first and test it
2. **Use Priority 1**: For critical automations (service restart, backup)
3. **Use Priority 2**: For analysis/monitoring (CPU, memory)
4. **Always Include**: Both success and failure actions
5. **Test Variables**: Use `{{variableName}}` in notes to capture dynamic data
6. **Set Timeouts**: Based on expected script duration + 20% buffer
7. **Enable Gradually**: Start with one rule enabled, add more as you verify

Copy these values directly into your automation rule forms!
