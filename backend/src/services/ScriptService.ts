import { Repository } from 'typeorm';
import { AppDataSource } from '../database/dataSource';
import { Script, ScriptType, ScriptCategory, ScriptExecution } from '../entities/Script';
import { User } from '../entities/User';
import { logger } from '../utils/logger';
import { NableService } from './nable/NableService';
import { NotificationService } from './NotificationService';

export interface ScriptTemplate {
  name: string;
  description: string;
  type: ScriptType;
  category: ScriptCategory;
  content: string;
  parameters: Record<string, any>;
  outputParser?: any;
  tags?: string[];
}

export class ScriptService {
  private scriptRepository: Repository<Script>;
  private executionRepository: Repository<ScriptExecution>;
  private nableService: NableService;
  private notificationService: NotificationService;

  constructor() {
    this.scriptRepository = AppDataSource.getRepository(Script);
    this.executionRepository = AppDataSource.getRepository(ScriptExecution);
    this.nableService = NableService.getInstance();
    this.notificationService = NotificationService.getInstance();
  }

  // Get common MSP remediation script templates
  public getScriptTemplates(): ScriptTemplate[] {
    return [
      {
        name: 'Restart Windows Service',
        description: 'Restarts a specified Windows service',
        type: ScriptType.POWERSHELL,
        category: ScriptCategory.SERVICES,
        content: `param(
  [Parameter(Mandatory=$true)]
  [string]$ServiceName,
  [int]$WaitSeconds = 30
)

try {
  $service = Get-Service -Name $ServiceName -ErrorAction Stop
  Write-Host "Current status of $ServiceName: $($service.Status)"
  
  if ($service.Status -eq 'Running') {
    Write-Host "Stopping $ServiceName..."
    Stop-Service -Name $ServiceName -Force -ErrorAction Stop
    Start-Sleep -Seconds 5
  }
  
  Write-Host "Starting $ServiceName..."
  Start-Service -Name $ServiceName -ErrorAction Stop
  Start-Sleep -Seconds $WaitSeconds
  
  $service = Get-Service -Name $ServiceName
  if ($service.Status -eq 'Running') {
    Write-Host "SUCCESS: $ServiceName is now running"
    exit 0
  } else {
    Write-Host "ERROR: $ServiceName failed to start. Status: $($service.Status)"
    exit 1
  }
} catch {
  Write-Host "ERROR: $_"
  exit 1
}`,
        parameters: { ServiceName: 'string', WaitSeconds: 30 },
        outputParser: {
          type: 'regex',
          successCondition: 'SUCCESS:',
          errorPattern: 'ERROR:'
        },
        tags: ['windows', 'service', 'restart']
      },
      {
        name: 'Disk Cleanup',
        description: 'Performs disk cleanup on Windows systems',
        type: ScriptType.POWERSHELL,
        category: ScriptCategory.DISK,
        content: `param(
  [int]$ThresholdGB = 10
)

function Clear-TempFiles {
  $paths = @(
    "$env:TEMP\\*",
    "$env:WINDIR\\Temp\\*",
    "$env:WINDIR\\Prefetch\\*",
    "$env:LOCALAPPDATA\\Temp\\*"
  )
  
  $totalCleaned = 0
  foreach ($path in $paths) {
    try {
      $items = Get-ChildItem -Path $path -Recurse -Force -ErrorAction SilentlyContinue
      $size = ($items | Measure-Object -Property Length -Sum).Sum / 1GB
      Remove-Item -Path $path -Recurse -Force -ErrorAction SilentlyContinue
      $totalCleaned += $size
      Write-Host "Cleaned: $path ($([math]::Round($size, 2)) GB)"
    } catch {
      Write-Host "Warning: Could not clean $path"
    }
  }
  return $totalCleaned
}

try {
  $drive = Get-PSDrive C
  $freeSpaceBefore = $drive.Free / 1GB
  Write-Host "Free space before cleanup: $([math]::Round($freeSpaceBefore, 2)) GB"
  
  # Clear Windows Update cache
  Stop-Service -Name wuauserv -Force -ErrorAction SilentlyContinue
  Remove-Item -Path "$env:WINDIR\\SoftwareDistribution\\Download\\*" -Recurse -Force -ErrorAction SilentlyContinue
  Start-Service -Name wuauserv -ErrorAction SilentlyContinue
  
  # Clear temp files
  $cleaned = Clear-TempFiles
  
  # Run Disk Cleanup utility
  Start-Process -FilePath "cleanmgr.exe" -ArgumentList "/sagerun:1" -Wait -NoNewWindow
  
  $drive = Get-PSDrive C
  $freeSpaceAfter = $drive.Free / 1GB
  $spaceRecovered = $freeSpaceAfter - $freeSpaceBefore
  
  Write-Host "Free space after cleanup: $([math]::Round($freeSpaceAfter, 2)) GB"
  Write-Host "Space recovered: $([math]::Round($spaceRecovered, 2)) GB"
  
  if ($freeSpaceAfter -gt $ThresholdGB) {
    Write-Host "SUCCESS: Disk cleanup completed. Free space is above threshold."
    exit 0
  } else {
    Write-Host "WARNING: Disk cleanup completed but free space is still below threshold."
    exit 1
  }
} catch {
  Write-Host "ERROR: $_"
  exit 1
}`,
        parameters: { ThresholdGB: 10 },
        outputParser: {
          type: 'regex',
          successCondition: 'SUCCESS:',
          errorPattern: 'ERROR:'
        },
        tags: ['windows', 'disk', 'cleanup', 'maintenance']
      },
      {
        name: 'Memory Optimization',
        description: 'Optimizes memory usage on Windows systems',
        type: ScriptType.POWERSHELL,
        category: ScriptCategory.PERFORMANCE,
        content: `param(
  [int]$MemoryThresholdPercent = 80
)

function Clear-WorkingSets {
  $processes = Get-Process | Where-Object { $_.WorkingSet64 -gt 100MB }
  foreach ($process in $processes) {
    try {
      [System.GC]::Collect()
      [System.GC]::WaitForPendingFinalizers()
      Write-Host "Optimized process: $($process.Name)"
    } catch {
      Write-Host "Could not optimize: $($process.Name)"
    }
  }
}

try {
  $totalMemory = (Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB
  $freeMemory = (Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory / 1MB
  $usedPercent = ((($totalMemory * 1024) - $freeMemory) / ($totalMemory * 1024)) * 100
  
  Write-Host "Memory usage before optimization: $([math]::Round($usedPercent, 2))%"
  
  # Clear working sets
  Clear-WorkingSets
  
  # Clear standby memory
  $memoryPurgeStandbyList = [System.Runtime.InteropServices.Marshal]::AllocHGlobal(4)
  [System.Runtime.InteropServices.Marshal]::WriteInt32($memoryPurgeStandbyList, 4)
  
  # Restart memory-intensive services if needed
  $heavyServices = @('WSearch', 'superfetch')
  foreach ($service in $heavyServices) {
    try {
      Restart-Service -Name $service -Force -ErrorAction SilentlyContinue
      Write-Host "Restarted service: $service"
    } catch {}
  }
  
  Start-Sleep -Seconds 10
  
  $freeMemoryAfter = (Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory / 1MB
  $usedPercentAfter = ((($totalMemory * 1024) - $freeMemoryAfter) / ($totalMemory * 1024)) * 100
  
  Write-Host "Memory usage after optimization: $([math]::Round($usedPercentAfter, 2))%"
  $memoryFreed = $usedPercent - $usedPercentAfter
  Write-Host "Memory freed: $([math]::Round($memoryFreed, 2))%"
  
  if ($usedPercentAfter -lt $MemoryThresholdPercent) {
    Write-Host "SUCCESS: Memory optimization completed successfully"
    exit 0
  } else {
    Write-Host "WARNING: Memory optimization completed but usage still above threshold"
    exit 1
  }
} catch {
  Write-Host "ERROR: $_"
  exit 1
}`,
        parameters: { MemoryThresholdPercent: 80 },
        outputParser: {
          type: 'regex',
          successCondition: 'SUCCESS:',
          errorPattern: 'ERROR:'
        },
        tags: ['windows', 'memory', 'performance', 'optimization']
      },
      {
        name: 'Restart Sophos Anti-Virus',
        description: 'Restarts Sophos Anti-Virus services',
        type: ScriptType.POWERSHELL,
        category: ScriptCategory.SECURITY,
        content: `try {
  $sophosServices = @(
    'Sophos Agent',
    'Sophos AutoUpdate Service',
    'Sophos Health Service',
    'Sophos MCS Agent',
    'Sophos MCS Client',
    'Sophos Message Router',
    'Sophos System Protection Service',
    'Sophos Web Control Service'
  )
  
  $failedServices = @()
  
  foreach ($serviceName in $sophosServices) {
    try {
      $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
      if ($service) {
        Write-Host "Restarting $serviceName..."
        Restart-Service -Name $serviceName -Force -ErrorAction Stop
        Start-Sleep -Seconds 3
        
        $service = Get-Service -Name $serviceName
        if ($service.Status -eq 'Running') {
          Write-Host "$serviceName is running"
        } else {
          $failedServices += $serviceName
          Write-Host "WARNING: $serviceName failed to start"
        }
      }
    } catch {
      Write-Host "Error with $serviceName: $_"
    }
  }
  
  if ($failedServices.Count -eq 0) {
    Write-Host "SUCCESS: All Sophos services restarted successfully"
    exit 0
  } else {
    Write-Host "ERROR: Failed to restart services: $($failedServices -join ', ')"
    exit 1
  }
} catch {
  Write-Host "ERROR: $_"
  exit 1
}`,
        parameters: {},
        outputParser: {
          type: 'regex',
          successCondition: 'SUCCESS:',
          errorPattern: 'ERROR:'
        },
        tags: ['sophos', 'antivirus', 'security', 'service']
      },
      {
        name: 'Windows Update Check',
        description: 'Checks and installs pending Windows updates',
        type: ScriptType.POWERSHELL,
        category: ScriptCategory.MAINTENANCE,
        content: `try {
  Write-Host "Checking for Windows Updates..."
  
  # Create update session
  $updateSession = New-Object -ComObject Microsoft.Update.Session
  $updateSearcher = $updateSession.CreateUpdateSearcher()
  
  # Search for updates
  $searchResult = $updateSearcher.Search("IsInstalled=0 and Type='Software'")
  
  if ($searchResult.Updates.Count -eq 0) {
    Write-Host "SUCCESS: No pending updates found"
    exit 0
  }
  
  Write-Host "Found $($searchResult.Updates.Count) updates"
  
  # Download updates
  $updatesToDownload = New-Object -ComObject Microsoft.Update.UpdateColl
  foreach ($update in $searchResult.Updates) {
    if (-not $update.IsDownloaded) {
      $updatesToDownload.Add($update) | Out-Null
    }
  }
  
  if ($updatesToDownload.Count -gt 0) {
    Write-Host "Downloading $($updatesToDownload.Count) updates..."
    $downloader = $updateSession.CreateUpdateDownloader()
    $downloader.Updates = $updatesToDownload
    $downloadResult = $downloader.Download()
    Write-Host "Download completed"
  }
  
  # Install updates
  $updatesToInstall = New-Object -ComObject Microsoft.Update.UpdateColl
  foreach ($update in $searchResult.Updates) {
    if ($update.IsDownloaded) {
      $updatesToInstall.Add($update) | Out-Null
    }
  }
  
  if ($updatesToInstall.Count -gt 0) {
    Write-Host "Installing $($updatesToInstall.Count) updates..."
    $installer = $updateSession.CreateUpdateInstaller()
    $installer.Updates = $updatesToInstall
    $installResult = $installer.Install()
    
    if ($installResult.RebootRequired) {
      Write-Host "WARNING: Reboot required to complete updates"
      exit 2
    } else {
      Write-Host "SUCCESS: Updates installed successfully"
      exit 0
    }
  }
} catch {
  Write-Host "ERROR: $_"
  exit 1
}`,
        parameters: {},
        outputParser: {
          type: 'regex',
          successCondition: 'SUCCESS:',
          errorPattern: 'ERROR:',
          warningPattern: 'WARNING:'
        },
        tags: ['windows', 'updates', 'patches', 'maintenance']
      },
      {
        name: 'Network Connectivity Test',
        description: 'Tests network connectivity and DNS resolution',
        type: ScriptType.POWERSHELL,
        category: ScriptCategory.NETWORK,
        content: `param(
  [string[]]$TestHosts = @('8.8.8.8', 'google.com', 'cloudflare.com')
)

$results = @()
$failures = 0

foreach ($host in $TestHosts) {
  try {
    $result = Test-NetConnection -ComputerName $host -InformationLevel Quiet
    if ($result) {
      Write-Host "SUCCESS: Connected to $host"
      $results += @{Host=$host; Status='Success'}
    } else {
      Write-Host "FAILED: Cannot connect to $host"
      $results += @{Host=$host; Status='Failed'}
      $failures++
    }
  } catch {
    Write-Host "ERROR testing $host: $_"
    $failures++
  }
}

# Test DNS resolution
try {
  $dns = Resolve-DnsName -Name 'google.com' -ErrorAction Stop
  Write-Host "DNS Resolution: Working"
} catch {
  Write-Host "DNS Resolution: Failed"
  $failures++
}

# Test default gateway
try {
  $gateway = (Get-NetRoute -DestinationPrefix '0.0.0.0/0').NextHop
  $gatewayTest = Test-NetConnection -ComputerName $gateway -InformationLevel Quiet
  if ($gatewayTest) {
    Write-Host "Default Gateway: Reachable"
  } else {
    Write-Host "Default Gateway: Unreachable"
    $failures++
  }
} catch {}

if ($failures -eq 0) {
  Write-Host "SUCCESS: All network connectivity tests passed"
  exit 0
} else {
  Write-Host "ERROR: $failures network tests failed"
  exit 1
}`,
        parameters: { TestHosts: ['8.8.8.8', 'google.com', 'cloudflare.com'] },
        outputParser: {
          type: 'regex',
          successCondition: 'SUCCESS:',
          errorPattern: 'ERROR:'
        },
        tags: ['network', 'connectivity', 'dns', 'diagnostic']
      }
    ];
  }

  // Create a new script
  async createScript(data: Partial<Script>, user: User): Promise<Script> {
    try {
      const script = this.scriptRepository.create({
        ...data,
        createdBy: user.email,
        updatedBy: user.email,
        version: '1.0.0',
      });

      const saved = await this.scriptRepository.save(script);
      logger.info(`Script created: ${saved.name} by ${user.email}`);
      return saved;
    } catch (error) {
      logger.error('Error creating script:', error);
      throw error;
    }
  }

  // Update a script
  async updateScript(id: number, data: Partial<Script>, user: User): Promise<Script> {
    try {
      const script = await this.scriptRepository.findOne({ where: { id } });
      if (!script) {
        throw new Error('Script not found');
      }

      // Increment version
      const currentVersion = script.version || '1.0.0';
      const versionParts = currentVersion.split('.').map(Number);
      versionParts[2]++; // Increment patch version
      const newVersion = versionParts.join('.');

      Object.assign(script, {
        ...data,
        updatedBy: user,
        version: newVersion,
      });

      const saved = await this.scriptRepository.save(script);
      logger.info(`Script updated: ${saved.name} to version ${newVersion}`);
      return saved;
    } catch (error) {
      logger.error('Error updating script:', error);
      throw error;
    }
  }

  // Get all scripts
  async getAllScripts(filters?: {
    category?: ScriptCategory;
    type?: ScriptType;
    isActive?: boolean;
    isTemplate?: boolean;
  }): Promise<Script[]> {
    try {
      const query = this.scriptRepository.createQueryBuilder('script');

      if (filters?.category) {
        query.andWhere('script.category = :category', { category: filters.category });
      }
      if (filters?.type) {
        query.andWhere('script.type = :type', { type: filters.type });
      }
      if (filters?.isActive !== undefined) {
        query.andWhere('script.isActive = :isActive', { isActive: filters.isActive });
      }
      if (filters?.isTemplate !== undefined) {
        query.andWhere('script.isTemplate = :isTemplate', { isTemplate: filters.isTemplate });
      }

      query.orderBy('script.category', 'ASC').addOrderBy('script.name', 'ASC');

      return await query.getMany();
    } catch (error) {
      logger.error('Error fetching scripts:', error);
      throw error;
    }
  }

  // Get script by ID
  async getScriptById(id: number): Promise<Script | null> {
    try {
      return await this.scriptRepository.findOne({
        where: { id },
        relations: ['createdBy', 'updatedBy'],
      });
    } catch (error) {
      logger.error('Error fetching script:', error);
      throw error;
    }
  }

  // Execute a script
  async executeScript(
    scriptId: number,
    deviceId: string,
    parameters: Record<string, any>,
    ticketId?: number,
    executedBy?: string
  ): Promise<ScriptExecution> {
    try {
      const script = await this.getScriptById(scriptId);
      if (!script) {
        throw new Error('Script not found');
      }

      if (!script.isActive) {
        throw new Error('Script is not active');
      }

      // Create execution record
      const execution = this.executionRepository.create({
        scriptId: script.id,
        deviceId,
        ticketId: ticketId ? ticketId.toString() : undefined,
        executedById: executedBy || 'system',
        parameters,
        status: 'pending',
        startTime: new Date(),
      });
      
      // Set the script relationship
      execution.script = script;

      await this.executionRepository.save(execution);

      // Execute script through N-able
      try {
        execution.status = 'running';
        await this.executionRepository.save(execution);

        const result = await this.nableService.executeScript(
          deviceId,
          script.id.toString(),
          parameters
        );

        // Parse output based on script configuration
        const { success, output } = this.parseScriptOutput(result.output, undefined);

        execution.status = success ? 'success' : 'failure';
        execution.output = output;
        execution.exitCode = result.exitCode;
        execution.endTime = new Date();
        execution.duration = execution.endTime.getTime() - execution.startTime.getTime();

        await this.executionRepository.save(execution);

        // Update script execution history
        if (!script.executionHistory) {
          script.executionHistory = [];
        }
        script.executionHistory.push({
          executedAt: execution.startTime,
          deviceId,
          ticketId: ticketId || 0,
          success,
          output: output.substring(0, 500), // Store first 500 chars
          duration: execution.duration,
        });

        // Keep only last 100 executions in history
        if (script.executionHistory.length > 100) {
          script.executionHistory = script.executionHistory.slice(-100);
        }

        await this.scriptRepository.save(script);

        // Send notification if failed
        if (!success && ticketId) {
          // TODO: Implement proper notification method
          logger.error(`Script execution failed: ${script.name} on device ${deviceId}`);
          // await this.notificationService.sendNotification({
          //   type: 'script_failure',
          //   priority: 'high',
          //   title: `Script Execution Failed: ${script.name}`,
          //   message: `Script ${script.name} failed on device ${deviceId}`,
          //   data: {
          //     scriptId,
          //     deviceId,
          //     ticketId,
          //     error: output,
          //   },
          // });
        }

        return execution;
      } catch (error) {
        execution.status = 'failure';
        execution.errorMessage = error.message;
        execution.endTime = new Date();
        execution.duration = execution.endTime.getTime() - execution.startTime.getTime();
        await this.executionRepository.save(execution);
        throw error;
      }
    } catch (error) {
      logger.error('Error executing script:', error);
      throw error;
    }
  }

  // Parse script output based on configured parser
  private parseScriptOutput(
    output: string,
    parser?: any
  ): { success: boolean; output: string } {
    if (!parser) {
      // Default: check for common success/error patterns
      const success = !output.toLowerCase().includes('error') &&
                     !output.toLowerCase().includes('failed');
      return { success, output };
    }

    switch (parser.type) {
      case 'regex':
        const successMatch = parser.successCondition ?
          new RegExp(parser.successCondition).test(output) : true;
        const errorMatch = parser.errorPattern ?
          new RegExp(parser.errorPattern).test(output) : false;
        return {
          success: successMatch && !errorMatch,
          output,
        };

      case 'json':
        try {
          const parsed = JSON.parse(output);
          const success = parser.successCondition ?
            eval(parser.successCondition.replace(/\$/g, 'parsed')) : true;
          return { success, output };
        } catch {
          return { success: false, output };
        }

      case 'text':
      default:
        return {
          success: output.includes(parser.successCondition || 'SUCCESS'),
          output,
        };
    }
  }

  // Get execution history
  async getExecutionHistory(filters?: {
    scriptId?: number;
    deviceId?: string;
    ticketId?: number;
    status?: string;
    limit?: number;
  }): Promise<ScriptExecution[]> {
    try {
      const query = this.executionRepository.createQueryBuilder('execution')
        .leftJoinAndSelect('execution.script', 'script');

      if (filters?.scriptId) {
        query.andWhere('execution.script_id = :scriptId', { scriptId: filters.scriptId });
      }
      if (filters?.deviceId) {
        query.andWhere('execution.deviceId = :deviceId', { deviceId: filters.deviceId });
      }
      if (filters?.ticketId) {
        query.andWhere('execution.ticketId = :ticketId', { ticketId: filters.ticketId });
      }
      if (filters?.status) {
        query.andWhere('execution.status = :status', { status: filters.status });
      }

      query.orderBy('execution.createdAt', 'DESC');

      if (filters?.limit) {
        query.limit(filters.limit);
      }

      return await query.getMany();
    } catch (error) {
      logger.error('Error fetching execution history:', error);
      throw error;
    }
  }

  // Delete a script
  async deleteScript(id: number): Promise<void> {
    try {
      const script = await this.getScriptById(id);
      if (!script) {
        throw new Error('Script not found');
      }

      // Check if script is used in any active automation rules
      const hasActiveRules = false; // TODO: Check with AutomationRule entity

      if (hasActiveRules) {
        throw new Error('Cannot delete script that is used in active automation rules');
      }

      await this.scriptRepository.remove(script);
      logger.info(`Script deleted: ${script.name}`);
    } catch (error) {
      logger.error('Error deleting script:', error);
      throw error;
    }
  }

  // Test script syntax
  async testScript(
    type: ScriptType,
    content: string,
    parameters?: Record<string, any>
  ): Promise<{ valid: boolean; errors?: string[] }> {
    try {
      // Basic syntax validation based on script type
      switch (type) {
        case ScriptType.POWERSHELL:
          // Check for basic PowerShell syntax
          if (!content.includes('Write-Host') && !content.includes('Write-Output')) {
            return {
              valid: false,
              errors: ['PowerShell scripts should include output statements'],
            };
          }
          break;

        case ScriptType.BATCH:
          // Check for basic batch syntax
          if (!content.includes('echo') && !content.includes('ECHO')) {
            return {
              valid: false,
              errors: ['Batch scripts should include echo statements'],
            };
          }
          break;

        default:
          break;
      }

      return { valid: true };
    } catch (error) {
      logger.error('Error testing script:', error);
      return {
        valid: false,
        errors: [error.message],
      };
    }
  }

  // Clone a script
  async cloneScript(id: number, newName: string, user: User): Promise<Script> {
    try {
      const original = await this.getScriptById(id);
      if (!original) {
        throw new Error('Original script not found');
      }

      const cloned = this.scriptRepository.create({
        ...original,
        id: undefined,
        name: newName,
        version: '1.0.0',
        createdBy: user.email,
        updatedBy: user.email,
        createdAt: undefined,
        updatedAt: undefined,
        executionHistory: [],
      });

      const saved = await this.scriptRepository.save(cloned);
      logger.info(`Script cloned: ${original.name} -> ${newName}`);
      return saved;
    } catch (error) {
      logger.error('Error cloning script:', error);
      throw error;
    }
  }
}

