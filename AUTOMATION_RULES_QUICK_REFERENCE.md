# 🚀 Automation Rules Quick Reference

## Essential Rules for Full Workflow Testing

### 🔴 Rule 1: Disk Space Cleanup
```yaml
Name: "Auto Clean Disk Space"
Trigger:
  Alert Type: DISK_SPACE_LOW
  Severity: HIGH or CRITICAL
Action:
  Script: Clean-TempFiles
  Parameters:
    - targetDrive: "C:"
    - thresholdGB: "10"
  Timeout: 300 seconds
On Success: Close ticket
On Failure: Escalate to technician
```

**Test Command:**
```bash
curl -X POST http://localhost:3001/api/webhooks/nable -H "Content-Type: application/json" \
-d '{"alertType":"DISK_SPACE_LOW","severity":"HIGH","deviceId":"SRV-001","cwTicketNumber":"T001"}'
```

---

### 🟠 Rule 2: Service Restart
```yaml
Name: "Auto Restart Service"
Trigger:
  Alert Type: SERVICE_STOPPED
  Severity: CRITICAL
Action:
  Script: Restart-Service
  Parameters:
    - serviceName: "{alertServiceName}"
    - forcedRestart: "true"
  Timeout: 120 seconds
On Success: Close ticket
On Failure: Escalate + Teams alert
```

**Test Command:**
```bash
curl -X POST http://localhost:3001/api/webhooks/nable -H "Content-Type: application/json" \
-d '{"alertType":"SERVICE_STOPPED","severity":"CRITICAL","serviceName":"wuauserv","cwTicketNumber":"T002"}'
```

---

### 🟡 Rule 3: High CPU Fix
```yaml
Name: "Handle High CPU"
Trigger:
  Alert Type: CPU_HIGH
  Severity: HIGH
  Threshold: >90%
Action:
  Script: Analyze-HighCPU
  Parameters:
    - topProcesses: "10"
    - killIfOver: "95"
  Timeout: 180 seconds
On Success: Update ticket with analysis
On Failure: Assign to technician
```

**Test Command:**
```bash
curl -X POST http://localhost:3001/api/webhooks/nable -H "Content-Type: application/json" \
-d '{"alertType":"CPU_HIGH","severity":"HIGH","cpuPercent":95,"cwTicketNumber":"T003"}'
```

---

### 🟢 Rule 4: Backup Retry
```yaml
Name: "Retry Failed Backup"
Trigger:
  Alert Type: BACKUP_FAILED
  Severity: HIGH
Action:
  Script: Retry-Backup
  Parameters:
    - backupJob: "{jobName}"
    - retryType: "incremental"
  Timeout: 600 seconds
On Success: Close ticket
On Failure: Critical escalation
```

**Test Command:**
```bash
curl -X POST http://localhost:3001/api/webhooks/nable -H "Content-Type: application/json" \
-d '{"alertType":"BACKUP_FAILED","severity":"HIGH","jobName":"SQL_Daily","cwTicketNumber":"T004"}'
```

---

## 📝 UI Configuration Steps

1. **Login**: http://localhost:3000 (admin@rmm-platform.com / Admin123!)
2. **Navigate**: Automation → Add Rule
3. **For Each Rule Above, Enter**:
   - Name & Description
   - Trigger conditions
   - Script & parameters
   - Success/failure actions

## ✅ Test Sequence (After Creating Rules)

```bash
# Run all tests in sequence
for type in "DISK_SPACE_LOW" "SERVICE_STOPPED" "CPU_HIGH" "BACKUP_FAILED"; do
  echo "Testing $type..."
  curl -X POST http://localhost:3001/api/webhooks/nable \
    -H "Content-Type: application/json" \
    -d "{\"alertType\":\"$type\",\"severity\":\"HIGH\",\"cwTicketNumber\":\"TEST-$(date +%s)\"}"
  sleep 3
done

# Check results
curl http://localhost:3001/api/automation/history | python3 -m json.tool
```

## 🔍 Verify Success

Look for these in logs/UI:
- ✅ "Matched rule: [Rule Name]"
- ✅ "Executing script: [Script Name]"
- ✅ "Ticket updated with automation results"
- ✅ "Ticket closed automatically" (on success)
- ⚠️ "Escalated to technician" (on failure)

## 💡 Tips

- Start with Rule 1 (Disk Space) - it's the simplest
- Use mock ticket numbers (T001, T002, etc.) for testing
- Watch logs: `tail -f backend/logs/combined.log`
- Check UI: Automation → History tab for execution details

## Essential Rules for Full Workflow Testing

### 🔴 Rule 1: Disk Space Cleanup
```yaml
Name: "Auto Clean Disk Space"
Trigger:
  Alert Type: DISK_SPACE_LOW
  Severity: HIGH or CRITICAL
Action:
  Script: Clean-TempFiles
  Parameters:
    - targetDrive: "C:"
    - thresholdGB: "10"
  Timeout: 300 seconds
On Success: Close ticket
On Failure: Escalate to technician
```

**Test Command:**
```bash
curl -X POST http://localhost:3001/api/webhooks/nable -H "Content-Type: application/json" \
-d '{"alertType":"DISK_SPACE_LOW","severity":"HIGH","deviceId":"SRV-001","cwTicketNumber":"T001"}'
```

---

### 🟠 Rule 2: Service Restart
```yaml
Name: "Auto Restart Service"
Trigger:
  Alert Type: SERVICE_STOPPED
  Severity: CRITICAL
Action:
  Script: Restart-Service
  Parameters:
    - serviceName: "{alertServiceName}"
    - forcedRestart: "true"
  Timeout: 120 seconds
On Success: Close ticket
On Failure: Escalate + Teams alert
```

**Test Command:**
```bash
curl -X POST http://localhost:3001/api/webhooks/nable -H "Content-Type: application/json" \
-d '{"alertType":"SERVICE_STOPPED","severity":"CRITICAL","serviceName":"wuauserv","cwTicketNumber":"T002"}'
```

---

### 🟡 Rule 3: High CPU Fix
```yaml
Name: "Handle High CPU"
Trigger:
  Alert Type: CPU_HIGH
  Severity: HIGH
  Threshold: >90%
Action:
  Script: Analyze-HighCPU
  Parameters:
    - topProcesses: "10"
    - killIfOver: "95"
  Timeout: 180 seconds
On Success: Update ticket with analysis
On Failure: Assign to technician
```

**Test Command:**
```bash
curl -X POST http://localhost:3001/api/webhooks/nable -H "Content-Type: application/json" \
-d '{"alertType":"CPU_HIGH","severity":"HIGH","cpuPercent":95,"cwTicketNumber":"T003"}'
```

---

### 🟢 Rule 4: Backup Retry
```yaml
Name: "Retry Failed Backup"
Trigger:
  Alert Type: BACKUP_FAILED
  Severity: HIGH
Action:
  Script: Retry-Backup
  Parameters:
    - backupJob: "{jobName}"
    - retryType: "incremental"
  Timeout: 600 seconds
On Success: Close ticket
On Failure: Critical escalation
```

**Test Command:**
```bash
curl -X POST http://localhost:3001/api/webhooks/nable -H "Content-Type: application/json" \
-d '{"alertType":"BACKUP_FAILED","severity":"HIGH","jobName":"SQL_Daily","cwTicketNumber":"T004"}'
```

---

## 📝 UI Configuration Steps

1. **Login**: http://localhost:3000 (admin@rmm-platform.com / Admin123!)
2. **Navigate**: Automation → Add Rule
3. **For Each Rule Above, Enter**:
   - Name & Description
   - Trigger conditions
   - Script & parameters
   - Success/failure actions

## ✅ Test Sequence (After Creating Rules)

```bash
# Run all tests in sequence
for type in "DISK_SPACE_LOW" "SERVICE_STOPPED" "CPU_HIGH" "BACKUP_FAILED"; do
  echo "Testing $type..."
  curl -X POST http://localhost:3001/api/webhooks/nable \
    -H "Content-Type: application/json" \
    -d "{\"alertType\":\"$type\",\"severity\":\"HIGH\",\"cwTicketNumber\":\"TEST-$(date +%s)\"}"
  sleep 3
done

# Check results
curl http://localhost:3001/api/automation/history | python3 -m json.tool
```

## 🔍 Verify Success

Look for these in logs/UI:
- ✅ "Matched rule: [Rule Name]"
- ✅ "Executing script: [Script Name]"
- ✅ "Ticket updated with automation results"
- ✅ "Ticket closed automatically" (on success)
- ⚠️ "Escalated to technician" (on failure)

## 💡 Tips

- Start with Rule 1 (Disk Space) - it's the simplest
- Use mock ticket numbers (T001, T002, etc.) for testing
- Watch logs: `tail -f backend/logs/combined.log`
- Check UI: Automation → History tab for execution details
