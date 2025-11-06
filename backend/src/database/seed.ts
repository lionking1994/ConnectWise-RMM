import { AppDataSource } from './dataSource';
import { User } from '../entities/User';
import { Script } from '../entities/Script';
import { AlertScriptMapping } from '../entities/AlertScriptMapping';
import { BoardConfiguration } from '../entities/BoardConfiguration';
import { EscalationChain } from '../entities/EscalationChain';
import { logger } from '../utils/logger';
import bcrypt from 'bcrypt';

async function seed() {
  try {
    logger.info('Starting database seeding...');
    
    // Initialize the data source
    await AppDataSource.initialize();
    logger.info('Database connection established');
    
    // Get repositories
    const userRepository = AppDataSource.getRepository(User);
    const scriptRepository = AppDataSource.getRepository(Script);
    const mappingRepository = AppDataSource.getRepository(AlertScriptMapping);
    const boardRepository = AppDataSource.getRepository(BoardConfiguration);
    const escalationRepository = AppDataSource.getRepository(EscalationChain);
    
    // Seed Users
    logger.info('Seeding users...');
    const users = await seedUsers(userRepository);
    
    // Seed Scripts
    logger.info('Seeding scripts...');
    const scripts = await seedScripts(scriptRepository);
    
    // Seed Alert Mappings
    logger.info('Seeding alert mappings...');
    await seedAlertMappings(mappingRepository, scripts);
    
    // Seed Board Configuration
    logger.info('Seeding board configuration...');
    await seedBoardConfiguration(boardRepository);
    
    // Seed Escalation Chains
    logger.info('Seeding escalation chains...');
    await seedEscalationChains(escalationRepository, users);
    
    await AppDataSource.destroy();
    logger.info('Database seeding completed successfully');
    
    process.exit(0);
  } catch (error) {
    logger.error('Database seeding failed:', error);
    process.exit(1);
  }
}

async function seedUsers(repository: any): Promise<any[]> {
  const hashedPassword = await bcrypt.hash('password123', 10);
  
  const users = [
    {
      username: 'admin',
      email: 'admin@rmm-platform.com',
      password: await bcrypt.hash('ChangeMe123!', 10),
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin' as const,
      isActive: true
    },
    {
      username: 'tech1',
      email: 'tech1@rmm-platform.com',
      password: hashedPassword,
      firstName: 'Tech',
      lastName: 'One',
      role: 'technician' as const,
      isActive: true
    },
    {
      username: 'viewer',
      email: 'viewer@rmm-platform.com',
      password: hashedPassword,
      firstName: 'View',
      lastName: 'Only',
      role: 'viewer' as const,
      isActive: true
    }
  ];
  
  const savedUsers = [];
  for (const userData of users) {
    const existing = await repository.findOne({ where: { username: userData.username } });
    if (!existing) {
      const user = repository.create(userData);
      savedUsers.push(await repository.save(user));
      logger.info(`Created user: ${userData.username}`);
    } else {
      savedUsers.push(existing);
      logger.info(`User already exists: ${userData.username}`);
    }
  }
  
  return savedUsers;
}

async function seedScripts(repository: any): Promise<any[]> {
  const scripts = [
    {
      name: 'Disk Cleanup',
      description: 'Clean temporary files and free disk space',
      type: 'powershell',
      category: 'maintenance',
      content: `# Disk Cleanup Script
$ErrorActionPreference = "Stop"
Write-Host "Starting disk cleanup..."

# Clean Windows temp files
Remove-Item -Path "$env:TEMP\\*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "C:\\Windows\\Temp\\*" -Recurse -Force -ErrorAction SilentlyContinue

# Clean recycle bin
Clear-RecycleBin -Force -ErrorAction SilentlyContinue

# Get disk space after cleanup
$disk = Get-WmiObject Win32_LogicalDisk -Filter "DeviceID='C:'"
$freeGB = [math]::Round($disk.FreeSpace / 1GB, 2)
$usedPercent = [math]::Round((($disk.Size - $disk.FreeSpace) / $disk.Size) * 100, 2)

Write-Host "Cleanup completed. Free space: $freeGB GB ($usedPercent% used)"
exit 0`,
      parameters: {},
      isActive: true,
      isTemplate: true,
      version: '1.0.0',
      tags: ['disk', 'cleanup', 'maintenance'],
      timeoutSeconds: 300,
      maxRetries: 3,
      retryDelaySeconds: 60
    },
    {
      name: 'Restart Service',
      description: 'Restart a Windows service',
      type: 'powershell',
      category: 'services',
      content: `# Service Restart Script
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
}`,
      parameters: { ServiceName: '' },
      isActive: true,
      isTemplate: true,
      version: '1.0.0',
      tags: ['service', 'restart'],
      timeoutSeconds: 120,
      maxRetries: 3,
      retryDelaySeconds: 30
    },
    {
      name: 'System Health Check',
      description: 'Check system files and disk health',
      type: 'powershell',
      category: 'security',
      content: `# System Health Check Script
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
$disk = Get-WmiObject Win32_LogicalDisk -Filter "DeviceID='C:'"
$usedPercent = [math]::Round((($disk.Size - $disk.FreeSpace) / $disk.Size) * 100, 2)

if ($usedPercent -gt 90) {
    Write-Host "WARNING: Disk usage critical: $usedPercent%"
    $exitCode = 1
} elseif ($usedPercent -gt 80) {
    Write-Host "WARNING: Disk usage high: $usedPercent%"
}

exit $exitCode`,
      parameters: {},
      isActive: true,
      isTemplate: true,
      version: '1.0.0',
      tags: ['system', 'health', 'sfc'],
      timeoutSeconds: 600,
      maxRetries: 2,
      retryDelaySeconds: 60
    },
    {
      name: 'Network Reset',
      description: 'Reset network configuration',
      type: 'powershell',
      category: 'network',
      content: `# Network Reset Script
$ErrorActionPreference = "Stop"
Write-Host "Starting network reset..."

# Release and renew IP
ipconfig /release
ipconfig /renew

# Flush DNS
ipconfig /flushdns

# Reset Winsock
netsh winsock reset

# Reset TCP/IP
netsh int ip reset

Write-Host "Network reset completed. A restart may be required."
exit 0`,
      parameters: {},
      isActive: true,
      isTemplate: true,
      version: '1.0.0',
      tags: ['network', 'reset', 'dns'],
      timeoutSeconds: 120,
      maxRetries: 2,
      retryDelaySeconds: 30
    },
    {
      name: 'Windows Update Check',
      description: 'Check and install Windows updates',
      type: 'powershell',
      category: 'maintenance',
      content: `# Windows Update Script
$ErrorActionPreference = "Stop"
Write-Host "Checking for Windows updates..."

# Create update session
$UpdateSession = New-Object -ComObject Microsoft.Update.Session
$UpdateSearcher = $UpdateSession.CreateUpdateSearcher()

# Search for updates
$SearchResult = $UpdateSearcher.Search("IsInstalled=0 and Type='Software'")

if ($SearchResult.Updates.Count -eq 0) {
    Write-Host "No updates available"
    exit 0
}

Write-Host "Found $($SearchResult.Updates.Count) updates"

# Download updates
$UpdatesToDownload = New-Object -ComObject Microsoft.Update.UpdateColl
foreach ($Update in $SearchResult.Updates) {
    $UpdatesToDownload.Add($Update) | Out-Null
}

$Downloader = $UpdateSession.CreateUpdateDownloader()
$Downloader.Updates = $UpdatesToDownload
$DownloadResult = $Downloader.Download()

# Install updates
$UpdatesToInstall = New-Object -ComObject Microsoft.Update.UpdateColl
foreach ($Update in $SearchResult.Updates) {
    if ($Update.IsDownloaded) {
        $UpdatesToInstall.Add($Update) | Out-Null
    }
}

$Installer = $UpdateSession.CreateUpdateInstaller()
$Installer.Updates = $UpdatesToInstall
$InstallResult = $Installer.Install()

if ($InstallResult.RebootRequired) {
    Write-Host "Reboot required to complete updates"
    exit 3010
}

Write-Host "Updates installed successfully"
exit 0`,
      parameters: {},
      isActive: true,
      isTemplate: true,
      version: '1.0.0',
      tags: ['windows', 'update', 'patch'],
      timeoutSeconds: 1800,
      maxRetries: 2,
      retryDelaySeconds: 300
    }
  ];
  
  const savedScripts = [];
  for (const scriptData of scripts) {
    const existing = await repository.findOne({ where: { name: scriptData.name } });
    if (!existing) {
      const script = repository.create(scriptData);
      savedScripts.push(await repository.save(script));
      logger.info(`Created script: ${scriptData.name}`);
    } else {
      savedScripts.push(existing);
      logger.info(`Script already exists: ${scriptData.name}`);
    }
  }
  
  return savedScripts;
}

async function seedAlertMappings(repository: any, scripts: any[]): Promise<void> {
  const diskScript = scripts.find(s => s.name === 'Disk Cleanup');
  const serviceScript = scripts.find(s => s.name === 'Restart Service');
  
  const mappings = [
    {
      name: 'Disk Space Alert',
      description: 'Auto-cleanup when disk space is low',
      isActive: true,
      priority: 10,
      conditions: {
        all: [
          { field: 'type', operator: 'contains', value: 'disk' },
          { field: 'severity', operator: 'in', value: ['warning', 'critical'] }
        ]
      },
      actions: [
        {
          type: 'run_script',
          order: 0,
          parameters: { scriptId: diskScript?.id },
          continueOnError: false
        }
      ],
      primaryScript: diskScript,
      maxRetries: 3,
      retryDelaySeconds: 60,
      executionTimeoutSeconds: 300,
      stopOnFirstSuccess: true,
      escalateAfterFailures: 3,
      notificationSettings: {
        onSuccess: false,
        onFailure: true,
        onEscalation: true
      }
    },
    {
      name: 'Service Down Alert',
      description: 'Auto-restart failed services',
      isActive: true,
      priority: 5,
      conditions: {
        any: [
          { field: 'message', operator: 'contains', value: 'service' },
          { field: 'type', operator: 'equals', value: 'service_failure' }
        ]
      },
      actions: [
        {
          type: 'run_script',
          order: 0,
          parameters: { scriptId: serviceScript?.id },
          continueOnError: false
        }
      ],
      primaryScript: serviceScript,
      maxRetries: 3,
      retryDelaySeconds: 30,
      executionTimeoutSeconds: 120,
      stopOnFirstSuccess: true,
      escalateAfterFailures: 2,
      notificationSettings: {
        onSuccess: false,
        onFailure: true,
        onEscalation: true
      }
    }
  ];
  
  for (const mappingData of mappings) {
    const existing = await repository.findOne({ where: { name: mappingData.name } });
    if (!existing) {
      const mapping = repository.create(mappingData);
      await repository.save(mapping);
      logger.info(`Created alert mapping: ${mappingData.name}`);
    } else {
      logger.info(`Alert mapping already exists: ${mappingData.name}`);
    }
  }
}

async function seedBoardConfiguration(repository: any): Promise<void> {
  const boardData = {
    boardId: 'noc-board-001',
    boardName: 'Network Operations Center',
    description: 'Primary NOC board for critical alerts',
    isActive: true,
    isPrimary: true,
    settings: {
      autoCreateTickets: true,
      autoAssignEnabled: true,
      defaultPriority: 'high',
      defaultStatus: 'open',
      syncInterval: 15,
      notificationSettings: {
        onNewTicket: true,
        onStatusChange: false,
        onPriorityChange: true,
        channels: ['teams']
      }
    },
    filters: {
      priorities: ['high', 'critical'],
      statuses: ['open', 'in_progress']
    },
    lastSyncAt: new Date(),
    activeTicketsCount: 0
  };
  
  const existing = await repository.findOne({ where: { boardId: boardData.boardId } });
  if (!existing) {
    const board = repository.create(boardData);
    await repository.save(board);
    logger.info(`Created board configuration: ${boardData.boardName}`);
  } else {
    logger.info(`Board configuration already exists: ${boardData.boardName}`);
  }
}

async function seedEscalationChains(repository: any, users: any[]): Promise<void> {
  const tech = users.find(u => u.username === 'tech1');
  const admin = users.find(u => u.username === 'admin');
  
  const chainData = {
    name: 'Default Escalation',
    description: 'Standard escalation chain for critical issues',
    isActive: true,
    levels: [
      {
        level: 1,
        assignTo: tech?.id,
        delayMinutes: 15,
        type: 'user'
      },
      {
        level: 2,
        assignTo: admin?.id,
        delayMinutes: 30,
        type: 'user'
      }
    ]
  };
  
  const existing = await repository.findOne({ where: { name: chainData.name } });
  if (!existing) {
    const chain = repository.create(chainData);
    await repository.save(chain);
    logger.info(`Created escalation chain: ${chainData.name}`);
  } else {
    logger.info(`Escalation chain already exists: ${chainData.name}`);
  }
}

// Run seeding if this file is executed directly
if (require.main === module) {
  seed();
}
