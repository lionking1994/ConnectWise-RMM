import axios, { AxiosInstance } from 'axios';
import { logger } from '../../utils/logger';
import retry from 'retry';
import * as querystring from 'querystring';

/**
 * N-able N-sight API Service
 * Based on: https://developer.n-able.com/n-sight/docs/getting-started-with-the-n-sight-api
 * API Documentation: https://developer.n-able.com/n-sight/docs/listing-failing-checks
 * 
 * IMPORTANT: API rate limit is 1 call every 90 seconds
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

export interface NsightFailedCheck {
  checkId: string;
  checkType: number; // Check type ID (e.g., 1012 for Windows Service Check)
  dsc247: boolean; // 24/7 check indicator
  description: string; // Check description
  date: string; // Failure date
  time: string; // Failure time
  startDate?: string; // When the failure started
  startTime?: string;
  formattedOutput: string; // Description of the problem
  checkStatus: 'testok' | 'testerror' | 'testalertdelayed' | 'testcleared' | 'test_inactive' | 'testok_inactive' | 'testerror_inactive';
}

export interface NsightFailingChecksResponse {
  clients: Array<{
    clientId: string;
    name: string;
    sites: Array<{
      siteId: string;
      name: string;
      workstations?: Array<{
        id: string;
        name: string;
        offline?: {
          description: string;
          startDate: string;
          startTime: string;
        };
        failedChecks?: NsightFailedCheck[];
      }>;
      servers?: Array<{
        id: string;
        name: string;
        offline?: {
          description: string;
          startDate: string;
          startTime: string;
        };
        overdue?: {
          description: string;
          startDate: string;
          startTime: string;
        };
        unreachable?: {
          description: string;
          startDate: string;
          startTime: string;
        };
        failedChecks?: NsightFailedCheck[];
      }>;
    }>;
  }>;
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

export interface NsightTaskRunResult {
  success: boolean;
  taskId?: string;
  message?: string;
  error?: string;
}

export class NableNsightService {
  private static instance: NableNsightService;
  private apiKey: string;
  private serverUrl: string;
  private client: AxiosInstance;
  private lastApiCall: number = 0;
  private readonly API_RATE_LIMIT = 90000; // 90 seconds in milliseconds

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
   * Enforce rate limiting - wait if necessary
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastApiCall;
    
    if (timeSinceLastCall < this.API_RATE_LIMIT) {
      const waitTime = this.API_RATE_LIMIT - timeSinceLastCall;
      logger.info(`Rate limiting: waiting ${waitTime}ms before next API call`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastApiCall = Date.now();
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
   * Execute API call with retry logic and rate limiting
   */
  private async executeWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    // Enforce rate limit before making the call
    await this.enforceRateLimit();

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
   * List all failing checks across all clients or specific client
   * Based on: https://developer.n-able.com/n-sight/docs/listing-failing-checks
   * 
   * @param clientId - Optional client ID to filter results
   * @param checkType - Optional: 'checks' (exclude automated tasks), 'tasks' (only automated tasks), 'random' (all)
   */
  public async listFailingChecks(
    clientId?: string, 
    checkType?: 'checks' | 'tasks' | 'random'
  ): Promise<NsightFailingChecksResponse> {
    try {
      logger.info('Fetching failing checks from N-sight API', { clientId, checkType });
      
      const url = this.buildApiUrl('list_failing_checks', {
        clientid: clientId,
        check_type: checkType
      });
      
      const response = await this.executeWithRetry(() => 
        this.client.get(url)
      );

      // Parse XML response to JSON (N-sight returns XML)
      const failingChecks = await this.parseFailingChecksResponse(response.data);
      
      logger.info(`Retrieved ${this.countFailingChecks(failingChecks)} failing checks from N-sight`);
      return failingChecks;
    } catch (error) {
      logger.error('Failed to list failing checks:', error);
      throw error;
    }
  }

  /**
   * Count total failing checks in response
   */
  private countFailingChecks(response: NsightFailingChecksResponse): number {
    let count = 0;
    response.clients?.forEach(client => {
      client.sites?.forEach(site => {
        site.workstations?.forEach(ws => {
          count += (ws.failedChecks?.length || 0);
        });
        site.servers?.forEach(server => {
          count += (server.failedChecks?.length || 0);
        });
      });
    });
    return count;
  }

  /**
   * Run a task/script on specific device
   * Based on: https://developer.n-able.com/n-sight/docs/run-task-now
   * 
   * @param deviceId - Device ID to run task on
   * @param taskId - Task ID to execute
   * @param parameters - Optional parameters to pass to the script
   */
  public async runTaskNow(
    deviceId: string, 
    taskId: string,
    parameters?: Record<string, any>
  ): Promise<NsightTaskRunResult> {
    try {
      logger.info('Triggering task execution', { deviceId, taskId });
      
      const url = this.buildApiUrl('run_task_now', {
        deviceid: deviceId,
        taskid: taskId,
        ...parameters
      });
      
      const response = await this.executeWithRetry(() => 
        this.client.post(url)
      );

      const result = this.parseTaskRunResponse(response.data);
      
      if (result.success) {
        logger.info(`Successfully triggered task ${taskId} on device ${deviceId}`);
      } else {
        logger.error(`Failed to trigger task ${taskId} on device ${deviceId}:`, result.error);
      }
      
      return result;
    } catch (error) {
      logger.error('Failed to run task:', error);
      throw error;
    }
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
   * List checks for a device
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
      logger.error('Failed to list N-sight checks:', error);
      throw error;
    }
  }

  /**
   * Get device monitoring details
   */
  public async getDeviceMonitoringDetails(deviceId: string): Promise<any> {
    try {
      const url = this.buildApiUrl('list_device_monitoring_details', {
        deviceid: deviceId
      });
      
      const response = await this.executeWithRetry(() => 
        this.client.get(url)
      );

      return this.parseNsightResponse(response.data, 'device');
    } catch (error) {
      logger.error('Failed to get device monitoring details:', error);
      throw error;
    }
  }

  /**
   * List all patches for a device
   */
  public async listPatches(deviceId: string): Promise<NsightPatch[]> {
    try {
      const url = this.buildApiUrl('list_patches24x7', {
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
   * List backup sessions for a device
   */
  public async listBackupSessions(deviceId: string, days?: number): Promise<NsightBackupSession[]> {
    try {
      const url = this.buildApiUrl('list_backup_sessions', {
        deviceid: deviceId,
        days: days || 30
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
   * Convert N-sight alert to internal format
   */
  public convertToInternalAlert(nsightAlert: NsightFailedCheck, device: any): NsightAlert {
    return {
      alertId: nsightAlert.checkId,
      deviceId: device.id,
      checkId: nsightAlert.checkId,
      severity: this.mapCheckStatusToSeverity(nsightAlert.checkStatus),
      alertType: nsightAlert.description,
      message: nsightAlert.formattedOutput,
      timestamp: new Date(`${nsightAlert.date} ${nsightAlert.time}`),
      status: 'Active',
      details: {
        checkType: nsightAlert.checkType,
        is247: nsightAlert.dsc247,
        startDate: nsightAlert.startDate,
        startTime: nsightAlert.startTime
      }
    };
  }

  /**
   * Map check status to severity
   */
  private mapCheckStatusToSeverity(status: string): 'Information' | 'Warning' | 'Error' | 'Critical' {
    switch(status) {
      case 'testerror':
      case 'testerror_inactive':
        return 'Critical';
      case 'testalertdelayed':
        return 'Warning';
      case 'testcleared':
        return 'Information';
      default:
        return 'Error';
    }
  }

  /**
   * Parse failing checks XML response
   * Note: In production, use a proper XML parser library like xml2js
   */
  private async parseFailingChecksResponse(xmlData: string): Promise<NsightFailingChecksResponse> {
    // This is a simplified parser - in production use xml2js or similar
    // For now, returning a structured response
    logger.debug('Parsing N-sight XML response');
    
    // TODO: Implement proper XML parsing
    // npm install xml2js
    // const parseString = promisify(xml2js.parseString);
    // const result = await parseString(xmlData);
    
    return {
      clients: []
    };
  }

  /**
   * Parse task run response
   */
  private parseTaskRunResponse(data: any): NsightTaskRunResult {
    // Parse the response to determine if task was triggered successfully
    if (data.status === 'OK' || data.success) {
      return {
        success: true,
        taskId: data.taskId || data.task_id,
        message: data.message || 'Task triggered successfully'
      };
    } else {
      return {
        success: false,
        error: data.error || data.message || 'Failed to trigger task'
      };
    }
  }

  /**
   * Generic response parser for N-sight API
   */
  private parseNsightResponse(data: any, responseType: string): any {
    // N-sight API returns XML by default
    // This should be parsed properly in production
    // For now, returning the data as-is
    logger.debug(`Parsing N-sight ${responseType} response`);
    
    // In production, implement proper XML parsing here
    return data;
  }

  /**
   * Test connection to N-sight API
   */
  public async testConnection(): Promise<boolean> {
    try {
      logger.info('Testing N-sight API connection...');
      
      // Try to list clients as a test
      const url = this.buildApiUrl('list_clients', {
        describe: true // Get service description
      });
      
      const response = await this.executeWithRetry(() => 
        this.client.get(url, { timeout: 10000 })
      );
      
      logger.info('N-sight API connection successful');
      return response.status === 200;
    } catch (error: any) {
      logger.error('N-sight API connection failed:', error.message);
      return false;
    }
  }
}