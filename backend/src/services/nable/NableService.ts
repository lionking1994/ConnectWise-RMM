import axios, { AxiosInstance } from 'axios';
import { logger } from '../../utils/logger';
import { CredentialsService } from '../CredentialsService';

export interface ScriptExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
  exitCode?: number;
  executionId?: string;
  deviceId?: string;
}

export interface NableDevice {
  id: string;
  name: string;
  type: string;
  status: string;
  clientName?: string;
  lastSeen?: Date;
  deviceId?: string;
  deviceName?: string;
  customerName?: string;
  customerId?: string;
}

export interface NableAlert {
  alertId: string;
  alertType: string;
  severity: string;
  message: string;
  deviceId: string;
  details?: Record<string, any>;
  timestamp?: Date;
}

export class NableService {
  private static instance: NableService;
  private credentialsService: CredentialsService;
  private apiUrl: string = '';
  private apiKey: string = '';
  private initialized: boolean = false;

  private constructor() {
    this.credentialsService = CredentialsService.getInstance();
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      const credentials = await this.credentialsService.getNableCredentials();
      if (credentials) {
        this.apiUrl = credentials.apiUrl.replace(/\/$/, ''); // Remove trailing slash
        this.apiKey = credentials.apiKey;
        this.initialized = true;
        logger.info('N-able service initialized with credentials');
      } else {
        logger.warn('No N-able credentials found');
      }
    } catch (error) {
      logger.error('Failed to initialize N-able service:', error);
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
      if (!this.initialized) {
        throw new Error('N-able service not configured. Please check credentials.');
      }
    }
  }

  public static getInstance(): NableService {
    if (!NableService.instance) {
      NableService.instance = new NableService();
    }
    return NableService.instance;
  }

  /**
   * Execute a script on a device through N-sight RMM
   */
  async executeScript(
    deviceId: string,
    scriptName: string,
    parameters?: Record<string, any>
  ): Promise<ScriptExecutionResult> {
    await this.ensureInitialized();

    try {
      logger.info(`Executing script ${scriptName} on device ${deviceId}`);
      
      // Map common script names to N-sight RMM script IDs or services
      const scriptMapping: Record<string, string> = {
        'disk_cleanup': 'cleanup_disk',
        'service_restart': 'restart_service',
        'clear_temp': 'clear_temp_files',
        'check_disk': 'disk_check',
        'restart_spooler': 'restart_print_spooler',
        'windows_update': 'install_updates',
        'Clean-TempFiles': 'cleanup_disk',
        'Restart-Service': 'restart_service',
        'Clear-DiskSpace': 'cleanup_disk',
        'Check-Services': 'check_services'
      };

      const nsightScript = scriptMapping[scriptName] || scriptName;

      // For N-sight RMM, we need to use the appropriate API endpoint
      // This is a simplified example - actual implementation depends on N-sight API
      const response = await axios.get(`${this.apiUrl}/api/`, {
        params: {
          apikey: this.apiKey,
          service: 'run_script',
          deviceid: deviceId,
          script: nsightScript,
          ...parameters
        },
        timeout: 60000 // 60 second timeout for script execution
      });

      // Parse N-sight response
      if (response.data && typeof response.data === 'string') {
        // N-sight may return HTML or text responses
        const success = !response.data.includes('error') && 
                       !response.data.includes('failed') &&
                       response.status === 200;
        
        return {
          success,
          output: response.data.substring(0, 1000), // Limit output length
          exitCode: success ? 0 : 1,
          executionId: `NSIGHT-${Date.now()}`,
          deviceId
        };
      }

      // Handle JSON response
      const result = response.data;
      return {
        success: result.status === 'success' || result.exitCode === 0,
        output: result.output || result.message || 'Script executed',
        error: result.error,
        exitCode: result.exitCode || 0,
        executionId: result.id || `NSIGHT-${Date.now()}`,
        deviceId
      };

    } catch (error: any) {
      logger.error(`Failed to execute script ${scriptName} on device ${deviceId}:`, error);
      
      // Return a structured error response
      return {
        success: false,
        error: error.message || 'Script execution failed',
        exitCode: error.response?.status || -1,
        deviceId
      };
    }
  }
  
  /**
   * Get device information
   */
  async getDevice(deviceId: string): Promise<NableDevice | null> {
    await this.ensureInitialized();

    try {
      const response = await axios.get(`${this.apiUrl}/api/`, {
        params: {
          apikey: this.apiKey,
          service: 'get_device',
          deviceid: deviceId
        },
        timeout: 10000
      });

      if (response.data) {
      return {
          id: deviceId,
          name: response.data.name || 'Unknown',
          type: response.data.type || 'Unknown',
          status: response.data.status || 'Unknown',
          clientName: response.data.client,
          lastSeen: response.data.lastseen ? new Date(response.data.lastseen) : undefined,
          deviceId: deviceId,
          deviceName: response.data.name || 'Unknown',
          customerName: response.data.client || response.data.customerName,
          customerId: response.data.clientId || response.data.customerId
        };
      }

      return null;
    } catch (error) {
      logger.error(`Failed to get device ${deviceId}:`, error);
      return null;
    }
  }

  /**
   * Get all devices
   */
  async getDevices(): Promise<NableDevice[]> {
    await this.ensureInitialized();

    try {
      const response = await axios.get(`${this.apiUrl}/api/`, {
        params: {
          apikey: this.apiKey,
          service: 'list_devices'
        },
        timeout: 30000
      });

      if (Array.isArray(response.data)) {
        return response.data.map((device: any) => ({
          id: device.id || device.deviceId,
          name: device.name || device.deviceName || 'Unknown',
          type: device.type || 'Unknown',
          status: device.status || 'Unknown',
          clientName: device.client || device.customerName,
          lastSeen: device.lastseen ? new Date(device.lastseen) : undefined,
          deviceId: device.id || device.deviceId,
          deviceName: device.name || device.deviceName || 'Unknown',
          customerName: device.client || device.customerName,
          customerId: device.clientId || device.customerId
        }));
      }

      return [];
    } catch (error) {
      logger.error('Failed to get devices:', error);
      return [];
    }
  }
  
  /**
   * Get alerts
   */
  async getAlerts(options?: { status?: string; startDate?: Date }): Promise<NableAlert[]> {
    await this.ensureInitialized();

    try {
      const params: any = {
        apikey: this.apiKey,
        service: 'list_alerts'
      };

      if (options?.status) {
        params.status = options.status;
      }

      if (options?.startDate) {
        params.since = options.startDate.toISOString();
      }

      const response = await axios.get(`${this.apiUrl}/api/`, {
        params,
        timeout: 30000
      });

      if (Array.isArray(response.data)) {
        return response.data.map((alert: any) => ({
          alertId: alert.id || alert.alertId || `ALERT-${Date.now()}`,
          alertType: alert.type || alert.alertType || 'Unknown',
          severity: alert.severity || 'Medium',
          message: alert.message || alert.description || 'Alert triggered',
          deviceId: alert.deviceId || alert.device || '',
          details: alert.details || {},
          timestamp: alert.timestamp ? new Date(alert.timestamp) : new Date()
        }));
      }

      return [];
    } catch (error) {
      logger.error('Failed to get alerts:', error);
      return [];
    }
  }

  /**
   * Run a command on a device
   */
  async runCommand(deviceId: string, command: string): Promise<ScriptExecutionResult> {
    await this.ensureInitialized();

    try {
      logger.info(`Running command on device ${deviceId}: ${command}`);
      
      const response = await axios.get(`${this.apiUrl}/api/`, {
        params: {
          apikey: this.apiKey,
          service: 'run_command',
          deviceid: deviceId,
          command: command
        },
        timeout: 60000
      });

      return {
        success: response.status === 200,
        output: response.data?.output || response.data || 'Command executed',
        exitCode: response.data?.exitCode || 0,
        executionId: `CMD-${Date.now()}`,
        deviceId
      };
    } catch (error: any) {
      logger.error(`Failed to run command on device ${deviceId}:`, error);
      return {
        success: false,
        error: error.message || 'Command execution failed',
        exitCode: -1,
        deviceId
      };
    }
  }

  /**
   * Run remediation script (alias for executeScript with specific naming)
   */
  async runRemediationScript(
    deviceId: string,
    scriptName: string,
    parameters?: Record<string, any>
  ): Promise<ScriptExecutionResult> {
    return this.executeScript(deviceId, scriptName, parameters);
  }

  /**
   * Install a patch on a device
   */
  async installPatch(deviceId: string, patchId: string): Promise<ScriptExecutionResult> {
    await this.ensureInitialized();

    try {
      logger.info(`Installing patch ${patchId} on device ${deviceId}`);
      
      const response = await axios.get(`${this.apiUrl}/api/`, {
        params: {
          apikey: this.apiKey,
          service: 'install_patch',
          deviceid: deviceId,
          patchid: patchId
        },
        timeout: 300000 // 5 minute timeout for patch installation
      });

      return {
        success: response.status === 200,
        output: response.data?.output || `Patch ${patchId} installed`,
        exitCode: response.data?.exitCode || 0,
        executionId: `PATCH-${Date.now()}`,
        deviceId
      };
    } catch (error: any) {
      logger.error(`Failed to install patch ${patchId} on device ${deviceId}:`, error);
      return {
        success: false,
        error: error.message || 'Patch installation failed',
        exitCode: -1,
        deviceId
      };
    }
  }

  /**
   * Get the status of a script execution
   */
  async getScriptExecutionStatus(executionId?: string): Promise<ScriptExecutionResult> {
    await this.ensureInitialized();

    if (!executionId) {
      return {
        success: false,
        error: 'Execution ID is required',
        exitCode: -1
      };
    }

    try {
      const response = await axios.get(`${this.apiUrl}/api/`, {
        params: {
          apikey: this.apiKey,
          service: 'get_script_status',
          executionid: executionId
        },
        timeout: 10000
      });

      return {
        success: response.data?.status === 'completed' || response.data?.status === 'success',
        output: response.data?.output || response.data?.message || '',
        error: response.data?.error,
        exitCode: response.data?.exitCode || (response.data?.status === 'completed' ? 0 : 1),
        executionId: executionId
      };
    } catch (error: any) {
      logger.error(`Failed to get script execution status for ${executionId}:`, error);
      return {
        success: false,
        error: error.message || 'Failed to get execution status',
        exitCode: -1,
        executionId: executionId
      };
    }
  }

  /**
   * Execute predefined remediation scripts
   */
  async executeRemediation(
    deviceId: string,
    alertType: string,
    parameters?: Record<string, any>
  ): Promise<ScriptExecutionResult> {
    logger.info(`Executing remediation for ${alertType} on device ${deviceId}`);

    // Map alert types to remediation scripts
    const remediationMap: Record<string, { script: string; params: any }> = {
      'DISK_SPACE_LOW': {
        script: 'disk_cleanup',
        params: {
          target: parameters?.driveLetter || 'C:',
          cleanTemp: true,
          cleanLogs: true,
          cleanRecycle: true
        }
      },
      'SERVICE_STOPPED': {
        script: 'service_restart',
        params: {
          serviceName: parameters?.serviceName || 'Spooler',
          waitTime: 5
        }
      },
      'HIGH_CPU': {
        script: 'check_services',
        params: {
          killHighUsage: true,
          threshold: 90
        }
      },
      'HIGH_MEMORY': {
        script: 'clear_temp_files',
        params: {
          clearCache: true,
          restartExplorer: false
        }
      },
      'WINDOWS_UPDATE_REQUIRED': {
        script: 'windows_update',
        params: {
          installCritical: true,
          rebootIfNeeded: false
        }
      }
    };

    const remediation = remediationMap[alertType];
    if (!remediation) {
      logger.warn(`No remediation script defined for alert type: ${alertType}`);
    return {
        success: false,
        error: `No remediation available for ${alertType}`,
        deviceId
      };
    }

    // Merge provided parameters with defaults
    const finalParams = { ...remediation.params, ...parameters };
    
    return this.executeScript(deviceId, remediation.script, finalParams);
  }

  /**
   * Check script execution status (if async execution is supported)
   */
  async getScriptStatus(executionId: string): Promise<ScriptExecutionResult> {
    await this.ensureInitialized();

    try {
      const response = await axios.get(`${this.apiUrl}/api/`, {
        params: {
          apikey: this.apiKey,
          service: 'get_script_status',
          executionid: executionId
        },
        timeout: 10000
      });

      const result = response.data;
      return {
        success: result.status === 'completed' && result.exitCode === 0,
        output: result.output,
        error: result.error,
        exitCode: result.exitCode || 0,
        executionId
      };
    } catch (error) {
      logger.error(`Failed to get script status for ${executionId}:`, error);
      return {
        success: false,
        error: 'Failed to get script status',
        executionId
      };
    }
  }
}