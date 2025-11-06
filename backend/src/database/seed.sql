-- Seed data for RMM Integration Platform
-- This file contains initial data for testing and development

-- Insert default users (passwords are hashed for 'password123')
INSERT INTO users (id, username, email, password, role, "firstName", "lastName", "isActive", "createdAt", "updatedAt")
VALUES 
  ('550e8400-e29b-41d4-a716-446655440001', 'admin', 'admin@rmm-platform.com', '$2b$10$YourHashedPasswordHere', 'admin', 'Admin', 'User', true, NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440002', 'tech1', 'tech1@rmm-platform.com', '$2b$10$YourHashedPasswordHere', 'technician', 'Tech', 'One', true, NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440003', 'viewer', 'viewer@rmm-platform.com', '$2b$10$YourHashedPasswordHere', 'viewer', 'View', 'Only', true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Insert default escalation chain
INSERT INTO escalation_chains (id, name, description, "isActive", levels, "createdAt", "updatedAt")
VALUES 
  (1, 'Default Escalation', 'Standard escalation chain for critical issues', true, 
   '[{"level": 1, "assignTo": "550e8400-e29b-41d4-a716-446655440002", "delayMinutes": 15, "type": "user"}, {"level": 2, "assignTo": "550e8400-e29b-41d4-a716-446655440001", "delayMinutes": 30, "type": "user"}]'::jsonb,
   NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Insert sample scripts
INSERT INTO scripts (id, name, description, type, category, content, parameters, "isActive", "isTemplate", version, tags, "timeoutSeconds", "maxRetries", "retryDelaySeconds", "createdAt", "updatedAt")
VALUES 
  (1, 'Disk Cleanup', 'Clean temporary files and free disk space', 'powershell', 'maintenance',
   '# Disk Cleanup Script
$ErrorActionPreference = "Stop"
Write-Host "Starting disk cleanup..."

# Clean Windows temp files
Remove-Item -Path "$env:TEMP\*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "C:\Windows\Temp\*" -Recurse -Force -ErrorAction SilentlyContinue

# Clean recycle bin
Clear-RecycleBin -Force -ErrorAction SilentlyContinue

# Get disk space after cleanup
$disk = Get-WmiObject Win32_LogicalDisk -Filter "DeviceID=''C:''"
$freeGB = [math]::Round($disk.FreeSpace / 1GB, 2)
$usedPercent = [math]::Round((($disk.Size - $disk.FreeSpace) / $disk.Size) * 100, 2)

Write-Host "Cleanup completed. Free space: $freeGB GB ($usedPercent% used)"
exit 0',
   '{}', true, true, '1.0.0', '{disk,cleanup,maintenance}', 300, 3, 60, NOW(), NOW()),

  (2, 'Restart Service', 'Restart a Windows service', 'powershell', 'services',
   '# Service Restart Script
param(
    [Parameter(Mandatory=$true)]
    [string]$ServiceName
)

$ErrorActionPreference = "Stop"
Write-Host "Restarting service: $ServiceName"

try {
    $service = Get-Service -Name $ServiceName -ErrorAction Stop
    
    if ($service.Status -eq "Running") {
        Stop-Service -Name $ServiceName -Force
        Start-Sleep -Seconds 5
    }
    
    Start-Service -Name $ServiceName
    Start-Sleep -Seconds 5
    
    $service = Get-Service -Name $ServiceName
    Write-Host "Service $ServiceName is now: $($service.Status)"
    
    if ($service.Status -eq "Running") {
        exit 0
    } else {
        exit 1
    }
} catch {
    Write-Error "Failed to restart service: $_"
    exit 1
}',
   '{"ServiceName": ""}', true, true, '1.0.0', '{service,restart}', 120, 3, 30, NOW(), NOW()),

  (3, 'System Health Check', 'Check system files and disk health', 'powershell', 'security',
   '# System Health Check Script
$ErrorActionPreference = "Stop"
Write-Host "Starting system health check..."

# Run SFC scan
Write-Host "Running System File Checker..."
$sfcResult = sfc /scannow 2>&1 | Out-String

if ($sfcResult -match "Windows Resource Protection found corrupt files") {
    Write-Host "Corrupt files found - attempting repair"
    DISM /Online /Cleanup-Image /RestoreHealth
    $exitCode = 1
} elseif ($sfcResult -match "Windows Resource Protection did not find any integrity violations") {
    Write-Host "No integrity violations found"
    $exitCode = 0
} else {
    Write-Host "Unable to determine SFC result"
    $exitCode = 2
}

# Check disk space
$disk = Get-WmiObject Win32_LogicalDisk -Filter "DeviceID=''C:''"
$usedPercent = [math]::Round((($disk.Size - $disk.FreeSpace) / $disk.Size) * 100, 2)

if ($usedPercent -gt 90) {
    Write-Host "WARNING: Disk usage critical: $usedPercent%"
    $exitCode = 1
} elseif ($usedPercent -gt 80) {
    Write-Host "WARNING: Disk usage high: $usedPercent%"
}

exit $exitCode',
   '{}', true, true, '1.0.0', '{system,health,sfc}', 600, 2, 60, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Insert sample alert mappings
INSERT INTO alert_script_mappings (
  id, name, description, "isActive", priority, conditions, actions, 
  "primaryScriptId", "maxRetries", "retryDelaySeconds", "executionTimeoutSeconds",
  "stopOnFirstSuccess", "escalateAfterFailures", "notificationSettings",
  "createdAt", "updatedAt"
)
VALUES 
  (1, 'Disk Space Alert', 'Auto-cleanup when disk space is low', true, 10,
   '{"all": [{"field": "type", "operator": "contains", "value": "disk"}, {"field": "severity", "operator": "in", "value": ["warning", "critical"]}]}',
   '[{"type": "run_script", "order": 0, "parameters": {"scriptId": 1}, "continueOnError": false}]',
   1, 3, 60, 300, true, 3,
   '{"onSuccess": false, "onFailure": true, "onEscalation": true}',
   NOW(), NOW()),

  (2, 'Service Down Alert', 'Auto-restart failed services', true, 5,
   '{"any": [{"field": "message", "operator": "contains", "value": "service"}, {"field": "type", "operator": "equals", "value": "service_failure"}]}',
   '[{"type": "run_script", "order": 0, "parameters": {"scriptId": 2}, "continueOnError": false}]',
   2, 3, 30, 120, true, 2,
   '{"onSuccess": false, "onFailure": true, "onEscalation": true}',
   NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Insert sample board configuration
INSERT INTO board_configurations (
  id, "boardId", "boardName", description, "isActive", "isPrimary",
  settings, filters, "lastSyncAt", "activeTicketsCount",
  "createdAt", "updatedAt"
)
VALUES 
  (1, 'noc-board-001', 'Network Operations Center', 'Primary NOC board for critical alerts', 
   true, true,
   '{"autoCreateTickets": true, "autoAssignEnabled": true, "defaultPriority": "high", "defaultStatus": "open", "syncInterval": 15, "notificationSettings": {"onNewTicket": true, "onStatusChange": false, "onPriorityChange": true, "channels": ["teams"]}}',
   '{"priorities": ["high", "critical"], "statuses": ["open", "in_progress"]}',
   NOW(), 0, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Reset sequences to avoid conflicts (only if tables have data)
SELECT setval('escalation_chains_id_seq', COALESCE((SELECT MAX(id) FROM escalation_chains), 1), false);
SELECT setval('scripts_id_seq', COALESCE((SELECT MAX(id) FROM scripts), 1), false);
SELECT setval('alert_script_mappings_id_seq', COALESCE((SELECT MAX(id) FROM alert_script_mappings), 1), false);
SELECT setval('board_configurations_id_seq', COALESCE((SELECT MAX(id) FROM board_configurations), 1), false);