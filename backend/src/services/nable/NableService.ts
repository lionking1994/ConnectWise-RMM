import axios, { AxiosInstance } from 'axios';
import { logger } from '../../utils/logger';
import retry from 'retry';

export interface NableDevice {
  deviceId: string;
  deviceName: string;
  customerName: string;
  customerId: string;
  status: string;
  lastSeen: Date;
  osVersion: string;
  ipAddress: string;
  alerts: NableAlert[];
}

export interface NableAlert {
  alertId: string;
  deviceId: string;
  severity: 'Information' | 'Warning' | 'Error' | 'Critical';
  alertType: string;
  message: string;
  timestamp: Date;
  status: 'Active' | 'Acknowledged' | 'Resolved';
  details: Record<string, any>;
}

export interface NableScript {
  scriptId: string;
  name: string;
  description: string;
  category: string;
  parameters: Array<{
    name: string;
    type: string;
    required: boolean;
    defaultValue?: any;
  }>;
}

export interface ScriptExecutionResult {
  executionId: string;
  scriptId: string;
  deviceId: string;
  status: 'Running' | 'Completed' | 'Failed' | 'Timeout';
  output: string;
  errorMessage?: string;
  startTime: Date;
  endTime?: Date;
  exitCode?: number;
}

export class NableService {
  private static instance: NableService;
  private client: AxiosInstance;

  private constructor() {
    this.client = axios.create({
      baseURL: process.env.NABLE_API_URL,
      headers: {
        'Authorization': `Bearer ${process.env.NABLE_API_KEY}`,
        'Content-Type': 'application/json',
        'X-API-Secret': process.env.NABLE_API_SECRET || ''
      },
      timeout: 30000
    });

    // Add response interceptor for logging
    this.client.interceptors.response.use(
      response => {
        logger.debug(`N-able API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      error => {
        logger.error(`N-able API Error: ${error.message}`, {
          url: error.config?.url,
          status: error.response?.status,
          data: error.response?.data
        });
        return Promise.reject(error);
      }
    );
  }

  public static getInstance(): NableService {
    if (!NableService.instance) {
      NableService.instance = new NableService();
    }
    return NableService.instance;
  }

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
        } catch (error) {
          if (!operation.retry(error as Error)) {
            reject(operation.mainError());
          }
        }
      });
    });
  }

  async getDevices(customerId?: string): Promise<NableDevice[]> {
    return this.executeWithRetry(async () => {
      const params = customerId ? { customerId } : {};
      const response = await this.client.get('/devices', { params });
      return response.data.devices;
    });
  }

  async getDevice(deviceId: string): Promise<NableDevice> {
    return this.executeWithRetry(async () => {
      const response = await this.client.get(`/devices/${deviceId}`);
      return response.data;
    });
  }

  async getAlerts(params?: {
    deviceId?: string;
    severity?: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<NableAlert[]> {
    return this.executeWithRetry(async () => {
      const response = await this.client.get('/alerts', { params });
      return response.data.alerts;
    });
  }

  async getAlert(alertId: string): Promise<NableAlert> {
    return this.executeWithRetry(async () => {
      const response = await this.client.get(`/alerts/${alertId}`);
      return response.data;
    });
  }

  async acknowledgeAlert(alertId: string, notes?: string): Promise<void> {
    return this.executeWithRetry(async () => {
      await this.client.post(`/alerts/${alertId}/acknowledge`, { notes });
      logger.info(`Acknowledged N-able alert: ${alertId}`);
    });
  }

  async resolveAlert(alertId: string, resolution: string): Promise<void> {
    return this.executeWithRetry(async () => {
      await this.client.post(`/alerts/${alertId}/resolve`, { resolution });
      logger.info(`Resolved N-able alert: ${alertId}`);
    });
  }

  async getScripts(category?: string): Promise<NableScript[]> {
    return this.executeWithRetry(async () => {
      const params = category ? { category } : {};
      const response = await this.client.get('/scripts', { params });
      return response.data.scripts;
    });
  }

  async executeScript(
    deviceId: string,
    scriptId: string,
    parameters?: Record<string, any>
  ): Promise<ScriptExecutionResult> {
    return this.executeWithRetry(async () => {
      const response = await this.client.post('/scripts/execute', {
        deviceId,
        scriptId,
        parameters: parameters || {}
      });
      logger.info(`Executed script ${scriptId} on device ${deviceId}`);
      return response.data;
    });
  }

  async getScriptExecutionStatus(executionId: string): Promise<ScriptExecutionResult> {
    return this.executeWithRetry(async () => {
      const response = await this.client.get(`/scripts/executions/${executionId}`);
      return response.data;
    });
  }

  async runRemediationScript(
    deviceId: string,
    scriptType: 'disk_cleanup' | 'service_restart' | 'update_install' | 'system_scan' | 'custom',
    customScriptId?: string,
    parameters?: Record<string, any>
  ): Promise<ScriptExecutionResult> {
    const scriptMap: Record<string, string> = {
      'disk_cleanup': 'SCRIPT_DISK_CLEANUP',
      'service_restart': 'SCRIPT_SERVICE_RESTART',
      'update_install': 'SCRIPT_WINDOWS_UPDATE',
      'system_scan': 'SCRIPT_SYSTEM_SCAN'
    };

    const scriptId = scriptType === 'custom' ? customScriptId! : scriptMap[scriptType];
    
    if (!scriptId) {
      throw new Error(`Invalid script type or missing custom script ID`);
    }

    return this.executeScript(deviceId, scriptId, parameters);
  }

  async installPatch(deviceId: string, patchId: string): Promise<void> {
    return this.executeWithRetry(async () => {
      await this.client.post(`/devices/${deviceId}/patches/${patchId}/install`);
      logger.info(`Initiated patch installation: ${patchId} on device ${deviceId}`);
    });
  }

  async restartDevice(deviceId: string, delay: number = 60): Promise<void> {
    return this.executeWithRetry(async () => {
      await this.client.post(`/devices/${deviceId}/restart`, { delay });
      logger.info(`Initiated device restart: ${deviceId} with delay ${delay}s`);
    });
  }

  async getDeviceHealth(deviceId: string): Promise<{
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    services: Array<{ name: string; status: string }>;
    lastBootTime: Date;
  }> {
    return this.executeWithRetry(async () => {
      const response = await this.client.get(`/devices/${deviceId}/health`);
      return response.data;
    });
  }

  async runCommand(deviceId: string, command: string): Promise<{
    output: string;
    exitCode: number;
    executionTime: number;
  }> {
    return this.executeWithRetry(async () => {
      const response = await this.client.post(`/devices/${deviceId}/command`, {
        command,
        timeout: 300000 // 5 minutes
      });
      return response.data;
    });
  }

  async getCustomers(): Promise<Array<{
    customerId: string;
    customerName: string;
    deviceCount: number;
  }>> {
    return this.executeWithRetry(async () => {
      const response = await this.client.get('/customers');
      return response.data.customers;
    });
  }

  async createMaintenanceWindow(
    deviceId: string,
    startTime: Date,
    endTime: Date,
    description: string
  ): Promise<void> {
    return this.executeWithRetry(async () => {
      await this.client.post('/maintenance-windows', {
        deviceId,
        startTime,
        endTime,
        description
      });
      logger.info(`Created maintenance window for device ${deviceId}`);
    });
  }
}


