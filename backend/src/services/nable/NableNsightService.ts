import axios, { AxiosInstance } from 'axios';
import { logger } from '../../utils/logger';
import retry from 'retry';
import * as querystring from 'querystring';

/**
 * N-able N-sight API Service
 * Based on: https://developer.n-able.com/n-sight/docs/getting-started-with-the-n-sight-api
 */

export interface NsightClient {
  clientId: string;
  clientName: string;
  creationDate: Date;
  licenseCount?: number;
}

export interface NsightSite {
  siteId: string;
  siteName: string;
  clientId: string;
  clientName: string;
  creationDate: Date;
}

export interface NsightDevice {
  deviceId: string;
  deviceName: string;
  clientId: string;
  clientName: string;
  siteId: string;
  siteName: string;
  deviceType: 'Server' | 'Workstation' | 'Network Device' | 'Other';
  osVersion: string;
  ipAddress: string;
  macAddress?: string;
  lastSeen: Date;
  status: 'Online' | 'Offline' | 'Stale';
  installDate: Date;
}

export interface NsightCheck {
  checkId: string;
  deviceId: string;
  checkName: string;
  checkType: string;
  status: 'OK' | 'Warning' | 'Failed' | 'Disabled';
  lastRunTime: Date;
  message?: string;
  output?: string;
}

export interface NsightAlert {
  alertId: string;
  deviceId: string;
  checkId: string;
  severity: 'Information' | 'Warning' | 'Error' | 'Critical';
  alertType: string;
  message: string;
  timestamp: Date;
  status: 'Active' | 'Acknowledged' | 'Resolved';
  details?: Record<string, any>;
}

export interface NsightPatch {
  patchId: string;
  deviceId: string;
  patchName: string;
  category: string;
  severity: string;
  status: 'Missing' | 'Approved' | 'Ignored' | 'Failed' | 'Installed';
  releaseDate: Date;
  size?: number;
  vendor?: string;
}

export interface NsightBackupSession {
  sessionId: string;
  deviceId: string;
  backupName: string;
  status: 'Success' | 'Failed' | 'Warning' | 'Running';
  startTime: Date;
  endTime?: Date;
  dataTransferred?: number;
  errors?: number;
  warnings?: number;
}

export class NableNsightService {
  private static instance: NableNsightService;
  private apiKey: string;
  private serverUrl: string;
  private client: AxiosInstance;

  private constructor(apiKey: string, serverUrl: string) {
    this.apiKey = apiKey;
    this.serverUrl = serverUrl.replace(/\/$/, ''); // Remove trailing slash
    
    // Create axios instance for N-sight API
    this.client = axios.create({
      baseURL: `${this.serverUrl}/api/`,
      timeout: 30000,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'ConnectWise-NRMM-Integration/1.0'
      }
    });

    // Add response interceptor for logging
    this.client.interceptors.response.use(
      response => {
        logger.debug(`N-sight API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      error => {
        logger.error(`N-sight API Error: ${error.message}`, {
          url: error.config?.url,
          status: error.response?.status,
          data: error.response?.data
        });
        return Promise.reject(error);
      }
    );
  }

  public static getInstance(apiKey?: string, serverUrl?: string): NableNsightService {
    if (!NableNsightService.instance) {
      if (!apiKey || !serverUrl) {
        throw new Error('API key and server URL required for initial N-sight service creation');
      }
      NableNsightService.instance = new NableNsightService(apiKey, serverUrl);
    }
    return NableNsightService.instance;
  }

  /**
   * Build API URL with service and parameters
   */
  private buildApiUrl(service: string, params: Record<string, any> = {}): string {
    const queryParams = {
      apikey: this.apiKey,
      service,
      ...params
    };
    
    // Filter out undefined values
    Object.keys(queryParams).forEach(key => {
      if (queryParams[key] === undefined) {
        delete queryParams[key];
      }
    });

    return `?${querystring.stringify(queryParams)}`;
  }

  /**
   * Execute API call with retry logic
   */
  private async executeWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    const operation = retry.operation({
      retries: 3,
      factor: 2,
      minTimeout: 1000,
      maxTimeout: 5000
    });

    return new Promise((resolve, reject) => {
      operation.attempt(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error: any) {
          if (!operation.retry(error)) {
            reject(operation.mainError());
          }
        }
      });
    });
  }

  /**
   * List all clients
   */
  public async listClients(deviceType?: string): Promise<NsightClient[]> {
    try {
      const url = this.buildApiUrl('list_clients', {
        devicetype: deviceType // optional: 'server', 'workstation', etc.
      });
      
      const response = await this.executeWithRetry(() => 
        this.client.get(url)
      );

      return this.parseNsightResponse(response.data, 'clients');
    } catch (error) {
      logger.error('Failed to list N-sight clients:', error);
      throw error;
    }
  }

  /**
   * List all sites
   */
  public async listSites(clientId?: string): Promise<NsightSite[]> {
    try {
      const url = this.buildApiUrl('list_sites', {
        clientid: clientId
      });
      
      const response = await this.executeWithRetry(() => 
        this.client.get(url)
      );

      return this.parseNsightResponse(response.data, 'sites');
    } catch (error) {
      logger.error('Failed to list N-sight sites:', error);
      throw error;
    }
  }

  /**
   * List servers
   */
  public async listServers(clientId?: string, siteId?: string): Promise<NsightDevice[]> {
    try {
      const url = this.buildApiUrl('list_servers', {
        clientid: clientId,
        siteid: siteId
      });
      
      const response = await this.executeWithRetry(() => 
        this.client.get(url)
      );

      return this.parseNsightResponse(response.data, 'servers');
    } catch (error) {
      logger.error('Failed to list N-sight servers:', error);
      throw error;
    }
  }

  /**
   * List workstations
   */
  public async listWorkstations(clientId?: string, siteId?: string): Promise<NsightDevice[]> {
    try {
      const url = this.buildApiUrl('list_workstations', {
        clientid: clientId,
        siteid: siteId
      });
      
      const response = await this.executeWithRetry(() => 
        this.client.get(url)
      );

      return this.parseNsightResponse(response.data, 'workstations');
    } catch (error) {
      logger.error('Failed to list N-sight workstations:', error);
      throw error;
    }
  }

  /**
   * List all devices (servers + workstations)
   */
  public async listAllDevices(clientId?: string): Promise<NsightDevice[]> {
    try {
      const [servers, workstations] = await Promise.all([
        this.listServers(clientId),
        this.listWorkstations(clientId)
      ]);

      return [...servers, ...workstations];
    } catch (error) {
      logger.error('Failed to list all N-sight devices:', error);
      throw error;
    }
  }

  /**
   * List failing checks
   */
  public async listFailingChecks(deviceId?: string): Promise<NsightCheck[]> {
    try {
      const url = this.buildApiUrl('list_failing_checks', {
        deviceid: deviceId
      });
      
      const response = await this.executeWithRetry(() => 
        this.client.get(url)
      );

      return this.parseNsightResponse(response.data, 'checks');
    } catch (error) {
      logger.error('Failed to list failing checks:', error);
      throw error;
    }
  }

  /**
   * List all checks for a device
   */
  public async listChecks(deviceId: string): Promise<NsightCheck[]> {
    try {
      const url = this.buildApiUrl('list_checks', {
        deviceid: deviceId
      });
      
      const response = await this.executeWithRetry(() => 
        this.client.get(url)
      );

      return this.parseNsightResponse(response.data, 'checks');
    } catch (error) {
      logger.error('Failed to list checks:', error);
      throw error;
    }
  }

  /**
   * Get alerts (from failing checks)
   */
  public async getAlerts(deviceId?: string): Promise<NsightAlert[]> {
    try {
      // N-sight doesn't have a direct alerts endpoint, 
      // we get alerts from failing checks
      const failingChecks = await this.listFailingChecks(deviceId);
      
      return failingChecks.map(check => ({
        alertId: `alert-${check.checkId}`,
        deviceId: check.deviceId,
        checkId: check.checkId,
        severity: this.mapCheckStatusToSeverity(check.status),
        alertType: check.checkType,
        message: check.message || check.checkName,
        timestamp: check.lastRunTime,
        status: 'Active' as const,
        details: { output: check.output }
      }));
    } catch (error) {
      logger.error('Failed to get alerts:', error);
      throw error;
    }
  }

  /**
   * List patches for a device
   */
  public async listPatches(deviceId: string): Promise<NsightPatch[]> {
    try {
      const url = this.buildApiUrl('list_device_patch_status', {
        deviceid: deviceId
      });
      
      const response = await this.executeWithRetry(() => 
        this.client.get(url)
      );

      return this.parseNsightResponse(response.data, 'patches');
    } catch (error) {
      logger.error('Failed to list patches:', error);
      throw error;
    }
  }

  /**
   * Approve a patch
   */
  public async approvePatch(deviceId: string, patchId: string): Promise<boolean> {
    try {
      const url = this.buildApiUrl('approve_patch', {
        deviceid: deviceId,
        patchid: patchId
      });
      
      const response = await this.executeWithRetry(() => 
        this.client.get(url) // N-sight uses GET for actions
      );

      return response.data.success === true;
    } catch (error) {
      logger.error('Failed to approve patch:', error);
      throw error;
    }
  }

  /**
   * Run an automated task
   */
  public async runTaskNow(taskId: string, deviceId?: string): Promise<boolean> {
    try {
      const url = this.buildApiUrl('run_task_now', {
        taskid: taskId,
        deviceid: deviceId
      });
      
      const response = await this.executeWithRetry(() => 
        this.client.get(url)
      );

      return response.data.success === true;
    } catch (error) {
      logger.error('Failed to run task:', error);
      throw error;
    }
  }

  /**
   * List backup sessions
   */
  public async listBackupSessions(deviceId: string, days: number = 30): Promise<NsightBackupSession[]> {
    try {
      const url = this.buildApiUrl('list_backup_sessions', {
        deviceid: deviceId,
        days: days
      });
      
      const response = await this.executeWithRetry(() => 
        this.client.get(url)
      );

      return this.parseNsightResponse(response.data, 'sessions');
    } catch (error) {
      logger.error('Failed to list backup sessions:', error);
      throw error;
    }
  }

  /**
   * Clear a check (acknowledge alert)
   */
  public async clearCheck(checkId: string, note?: string): Promise<boolean> {
    try {
      const url = this.buildApiUrl('clear_check', {
        checkid: checkId,
        note: note
      });
      
      const response = await this.executeWithRetry(() => 
        this.client.get(url)
      );

      return response.data.success === true;
    } catch (error) {
      logger.error('Failed to clear check:', error);
      throw error;
    }
  }

  /**
   * Add a check note
   */
  public async addCheckNote(checkId: string, note: string): Promise<boolean> {
    try {
      const url = this.buildApiUrl('add_check_note', {
        checkid: checkId,
        note: note
      });
      
      const response = await this.executeWithRetry(() => 
        this.client.get(url)
      );

      return response.data.success === true;
    } catch (error) {
      logger.error('Failed to add check note:', error);
      throw error;
    }
  }

  /**
   * Parse N-sight API response
   */
  private parseNsightResponse(data: any, key: string): any[] {
    // N-sight API returns data in various formats
    if (Array.isArray(data)) {
      return data;
    }
    
    if (data && typeof data === 'object') {
      // Check for nested structure
      if (data[key] && Array.isArray(data[key])) {
        return data[key];
      }
      
      // Check for items/results structure
      if (data.items && Array.isArray(data.items)) {
        return data.items;
      }
      
      if (data.results && Array.isArray(data.results)) {
        return data.results;
      }
      
      // Single object response
      if (data.id || data.deviceid || data.clientid) {
        return [data];
      }
    }
    
    return [];
  }

  /**
   * Map check status to severity
   */
  private mapCheckStatusToSeverity(status: string): 'Information' | 'Warning' | 'Error' | 'Critical' {
    switch (status.toLowerCase()) {
      case 'failed':
      case 'error':
        return 'Error';
      case 'warning':
        return 'Warning';
      case 'critical':
        return 'Critical';
      default:
        return 'Information';
    }
  }

  /**
   * Test API connection
   */
  public async testConnection(): Promise<{
    success: boolean;
    message: string;
    data?: any;
  }> {
    try {
      // Try to list clients as a simple test
      const clients = await this.listClients();
      
      return {
        success: true,
        message: 'N-sight API connection successful',
        data: {
          clientCount: clients.length,
          apiServer: this.serverUrl
        }
      };
    } catch (error: any) {
      // Extract only serializable parts of the error
      const errorMessage = error.response?.data?.message || 
                          error.response?.statusText || 
                          error.message || 
                          'N-sight API connection failed';
      
      const errorData = error.response?.data ? {
        status: error.response.status,
        statusText: error.response.statusText,
        data: typeof error.response.data === 'string' 
          ? error.response.data 
          : error.response.data?.message || error.response.data?.error || null
      } : null;
      
      logger.error('N-sight API test failed:', {
        message: errorMessage,
        url: this.serverUrl,
        status: error.response?.status
      });
      
      return {
        success: false,
        message: errorMessage,
        data: errorData
      };
    }
  }
}

