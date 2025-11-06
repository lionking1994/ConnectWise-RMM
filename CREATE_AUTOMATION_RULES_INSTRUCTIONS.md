# 📋 Step-by-Step Instructions: Creating Automation Rules

## ✅ The UI Has Been Updated!

The Rule Editor now supports N-able alert automation with all the fields and options you need.

---

## 🚀 How to Create Your First Automation Rule

### Step 1: Access the Rule Editor
1. Open your browser: http://localhost:3000
2. Login: `admin@rmm-platform.com` / `Admin123!`
3. Click **"Automation"** in the sidebar
4. Click **"+ Add Rule"** button

### Step 2: Fill in the Form

#### **Section 1: Basic Information**
- **Rule Name**: `Disk Space Auto-Cleanup`
- **Priority**: `1` (higher priority = runs first)
- **Active**: Toggle ON ✅
- **Description**: `Automatically clean temporary files when disk space is low`

#### **Section 2: Trigger Configuration**
- **Trigger Type**: Select `N-able Alert` from dropdown

#### **Section 3: Conditions**
1. Click **"Add Condition"**
2. Fill in:
   - **Field**: `alertType`
   - **Operator**: `equals`
   - **Value**: `DISK_SPACE_LOW` (select from dropdown)
3. Click **"Add Condition"** again
4. Fill in:
   - **Field**: `severity`
   - **Operator**: `in`
   - **Value**: Type: `HIGH,CRITICAL`
5. Keep **"Match ALL conditions"** selected

#### **Section 4: Actions**
1. Click **"Add Action"**
2. **Action Type**: Select `Execute N-able Script`
3. Fill in the script details:
   - **Script Name**: `Clean-TempFiles` (select from dropdown)
   - **Script Parameters (JSON)**:
     ```json
     {"targetDrive": "C:", "threshold": "10"}
     ```
   - **Timeout**: `300`
   - **Max Retries**: `2`
   - **On Success**: `Close Ticket`
   - **On Failure**: `Escalate to Technician`

### Step 3: Save the Rule
Click the **"Save"** button at the top right

---

## 📝 Create These 4 Essential Rules

### **Rule 1: Disk Space Cleanup** ✅
**Already covered above!**

### **Rule 2: Service Restart** 🔄
- **Name**: `Critical Service Auto-Restart`
- **Priority**: `1`
- **Trigger**: `N-able Alert`
- **Conditions**:
  - alertType = `SERVICE_STOPPED`
  - severity = `CRITICAL`
- **Action**: Execute N-able Script
  - Script: `Restart-Service`
  - Parameters: `{"serviceName": "{{alertServiceName}}", "forcedRestart": "true"}`
  - Timeout: `120`
  - On Success: `Close Ticket`
  - On Failure: `Send Teams Alert`

### **Rule 3: High CPU Analysis** 📊
- **Name**: `High CPU Auto-Analysis`
- **Priority**: `2`
- **Trigger**: `N-able Alert`
- **Conditions**:
  - alertType = `CPU_HIGH`
  - cpuPercent > `90`
- **Action**: Execute N-able Script
  - Script: `Analyze-HighCPU`
  - Parameters: `{"topProcesses": "10", "killIfOver": "95"}`
  - Timeout: `180`
  - On Success: `Update Ticket`
  - On Failure: `Escalate to Technician`

### **Rule 4: Backup Recovery** 💾
- **Name**: `Backup Failure Auto-Retry`
- **Priority**: `1`
- **Trigger**: `N-able Alert`
- **Conditions**:
  - alertType = `BACKUP_FAILED`
  - severity = `HIGH` (use "in" operator with value: `HIGH,CRITICAL`)
- **Action**: Execute N-able Script
  - Script: `Retry-Backup`
  - Parameters: `{"backupJob": "{{jobName}}", "retryType": "incremental"}`
  - Timeout: `600`
  - On Success: `Close Ticket`
  - On Failure: `Escalate to Technician`

---

## 🧪 Test Your Rules

After creating each rule, test it:

```bash
# Test Disk Space Rule
curl -X POST http://localhost:3001/api/webhooks/nable \
  -H "Content-Type: application/json" \
  -d '{"alertType":"DISK_SPACE_LOW","severity":"HIGH","deviceId":"TEST-001","cwTicketNumber":"T001"}'

# Test Service Restart Rule
curl -X POST http://localhost:3001/api/webhooks/nable \
  -H "Content-Type: application/json" \
  -d '{"alertType":"SERVICE_STOPPED","severity":"CRITICAL","serviceName":"wuauserv","cwTicketNumber":"T002"}'

# Test High CPU Rule
curl -X POST http://localhost:3001/api/webhooks/nable \
  -H "Content-Type: application/json" \
  -d '{"alertType":"CPU_HIGH","severity":"HIGH","cpuPercent":95,"cwTicketNumber":"T003"}'

# Test Backup Rule
curl -X POST http://localhost:3001/api/webhooks/nable \
  -H "Content-Type: application/json" \
  -d '{"alertType":"BACKUP_FAILED","severity":"HIGH","jobName":"SQL_Daily","cwTicketNumber":"T004"}'
```

---

## 📌 UI Features Available

### Trigger Type Options:
- ✅ **N-able Alert** (use this for webhook automation)
- Ticket Created
- Ticket Updated
- Scheduled
- Manual Trigger

### Alert Types Available in Dropdown:
- DISK_SPACE_LOW
- SERVICE_STOPPED
- CPU_HIGH
- MEMORY_HIGH
- BACKUP_FAILED
- SERVER_DOWN
- NETWORK_ISSUE
- And more...

### Scripts Available in Dropdown:
- Clean-TempFiles
- Restart-Service
- Analyze-HighCPU
- Clear-Memory
- Retry-Backup
- Check-DiskSpace
- Update-Windows
- Reset-NetworkAdapter
- And more...

### Operators for Conditions:
- equals
- not_equals
- contains
- in (for multiple values)
- greater_than (for numbers)
- less_than (for numbers)

### Success/Failure Actions:
- Close Ticket
- Update Ticket
- Escalate to Technician
- Send Teams Alert
- Do Nothing

---

## ✨ Tips

1. **Use Variables**: In parameters, use `{{alertServiceName}}`, `{{deviceName}}`, etc.
2. **Test One at a Time**: Create and test each rule individually
3. **Check History**: Go to Automation section to see execution history
4. **Monitor Logs**: `tail -f backend/logs/combined.log`
5. **Start Simple**: Begin with Rule 1 (Disk Space) - it's the easiest

## 🎯 Success Indicators

After creating rules and sending test webhooks, you should see:
- ✅ Rule appears in Automation list as "Enabled"
- ✅ Webhook response: `{"received": true}`
- ✅ Log shows: "Matched rule: [Your Rule Name]"
- ✅ Automation History shows execution

---

## Need Help?

- **Rules Not Triggering?** Check if rule is enabled and conditions match
- **Script Not Found?** Verify script name matches exactly
- **Parameters Error?** Ensure JSON is valid (use double quotes)
- **Check Logs:** `tail -f backend/logs/combined.log | grep automation`

The UI is ready! Start creating your automation rules now! 🚀

## ✅ The UI Has Been Updated!

The Rule Editor now supports N-able alert automation with all the fields and options you need.

---

## 🚀 How to Create Your First Automation Rule

### Step 1: Access the Rule Editor
1. Open your browser: http://localhost:3000
2. Login: `admin@rmm-platform.com` / `Admin123!`
3. Click **"Automation"** in the sidebar
4. Click **"+ Add Rule"** button

### Step 2: Fill in the Form

#### **Section 1: Basic Information**
- **Rule Name**: `Disk Space Auto-Cleanup`
- **Priority**: `1` (higher priority = runs first)
- **Active**: Toggle ON ✅
- **Description**: `Automatically clean temporary files when disk space is low`

#### **Section 2: Trigger Configuration**
- **Trigger Type**: Select `N-able Alert` from dropdown

#### **Section 3: Conditions**
1. Click **"Add Condition"**
2. Fill in:
   - **Field**: `alertType`
   - **Operator**: `equals`
   - **Value**: `DISK_SPACE_LOW` (select from dropdown)
3. Click **"Add Condition"** again
4. Fill in:
   - **Field**: `severity`
   - **Operator**: `in`
   - **Value**: Type: `HIGH,CRITICAL`
5. Keep **"Match ALL conditions"** selected

#### **Section 4: Actions**
1. Click **"Add Action"**
2. **Action Type**: Select `Execute N-able Script`
3. Fill in the script details:
   - **Script Name**: `Clean-TempFiles` (select from dropdown)
   - **Script Parameters (JSON)**:
     ```json
     {"targetDrive": "C:", "threshold": "10"}
     ```
   - **Timeout**: `300`
   - **Max Retries**: `2`
   - **On Success**: `Close Ticket`
   - **On Failure**: `Escalate to Technician`

### Step 3: Save the Rule
Click the **"Save"** button at the top right

---

## 📝 Create These 4 Essential Rules

### **Rule 1: Disk Space Cleanup** ✅
**Already covered above!**

### **Rule 2: Service Restart** 🔄
- **Name**: `Critical Service Auto-Restart`
- **Priority**: `1`
- **Trigger**: `N-able Alert`
- **Conditions**:
  - alertType = `SERVICE_STOPPED`
  - severity = `CRITICAL`
- **Action**: Execute N-able Script
  - Script: `Restart-Service`
  - Parameters: `{"serviceName": "{{alertServiceName}}", "forcedRestart": "true"}`
  - Timeout: `120`
  - On Success: `Close Ticket`
  - On Failure: `Send Teams Alert`

### **Rule 3: High CPU Analysis** 📊
- **Name**: `High CPU Auto-Analysis`
- **Priority**: `2`
- **Trigger**: `N-able Alert`
- **Conditions**:
  - alertType = `CPU_HIGH`
  - cpuPercent > `90`
- **Action**: Execute N-able Script
  - Script: `Analyze-HighCPU`
  - Parameters: `{"topProcesses": "10", "killIfOver": "95"}`
  - Timeout: `180`
  - On Success: `Update Ticket`
  - On Failure: `Escalate to Technician`

### **Rule 4: Backup Recovery** 💾
- **Name**: `Backup Failure Auto-Retry`
- **Priority**: `1`
- **Trigger**: `N-able Alert`
- **Conditions**:
  - alertType = `BACKUP_FAILED`
  - severity = `HIGH` (use "in" operator with value: `HIGH,CRITICAL`)
- **Action**: Execute N-able Script
  - Script: `Retry-Backup`
  - Parameters: `{"backupJob": "{{jobName}}", "retryType": "incremental"}`
  - Timeout: `600`
  - On Success: `Close Ticket`
  - On Failure: `Escalate to Technician`

---

## 🧪 Test Your Rules

After creating each rule, test it:

```bash
# Test Disk Space Rule
curl -X POST http://localhost:3001/api/webhooks/nable \
  -H "Content-Type: application/json" \
  -d '{"alertType":"DISK_SPACE_LOW","severity":"HIGH","deviceId":"TEST-001","cwTicketNumber":"T001"}'

# Test Service Restart Rule
curl -X POST http://localhost:3001/api/webhooks/nable \
  -H "Content-Type: application/json" \
  -d '{"alertType":"SERVICE_STOPPED","severity":"CRITICAL","serviceName":"wuauserv","cwTicketNumber":"T002"}'

# Test High CPU Rule
curl -X POST http://localhost:3001/api/webhooks/nable \
  -H "Content-Type: application/json" \
  -d '{"alertType":"CPU_HIGH","severity":"HIGH","cpuPercent":95,"cwTicketNumber":"T003"}'

# Test Backup Rule
curl -X POST http://localhost:3001/api/webhooks/nable \
  -H "Content-Type: application/json" \
  -d '{"alertType":"BACKUP_FAILED","severity":"HIGH","jobName":"SQL_Daily","cwTicketNumber":"T004"}'
```

---

## 📌 UI Features Available

### Trigger Type Options:
- ✅ **N-able Alert** (use this for webhook automation)
- Ticket Created
- Ticket Updated
- Scheduled
- Manual Trigger

### Alert Types Available in Dropdown:
- DISK_SPACE_LOW
- SERVICE_STOPPED
- CPU_HIGH
- MEMORY_HIGH
- BACKUP_FAILED
- SERVER_DOWN
- NETWORK_ISSUE
- And more...

### Scripts Available in Dropdown:
- Clean-TempFiles
- Restart-Service
- Analyze-HighCPU
- Clear-Memory
- Retry-Backup
- Check-DiskSpace
- Update-Windows
- Reset-NetworkAdapter
- And more...

### Operators for Conditions:
- equals
- not_equals
- contains
- in (for multiple values)
- greater_than (for numbers)
- less_than (for numbers)

### Success/Failure Actions:
- Close Ticket
- Update Ticket
- Escalate to Technician
- Send Teams Alert
- Do Nothing

---

## ✨ Tips

1. **Use Variables**: In parameters, use `{{alertServiceName}}`, `{{deviceName}}`, etc.
2. **Test One at a Time**: Create and test each rule individually
3. **Check History**: Go to Automation section to see execution history
4. **Monitor Logs**: `tail -f backend/logs/combined.log`
5. **Start Simple**: Begin with Rule 1 (Disk Space) - it's the easiest

## 🎯 Success Indicators

After creating rules and sending test webhooks, you should see:
- ✅ Rule appears in Automation list as "Enabled"
- ✅ Webhook response: `{"received": true}`
- ✅ Log shows: "Matched rule: [Your Rule Name]"
- ✅ Automation History shows execution

---

## Need Help?

- **Rules Not Triggering?** Check if rule is enabled and conditions match
- **Script Not Found?** Verify script name matches exactly
- **Parameters Error?** Ensure JSON is valid (use double quotes)
- **Check Logs:** `tail -f backend/logs/combined.log | grep automation`

The UI is ready! Start creating your automation rules now! 🚀
