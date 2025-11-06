import { logger } from '../utils/logger';
import { NableService } from './nable/NableService';

export interface ScriptExecutionOptions {
  scriptId: string;
  scriptName: string;
  scriptType: 'powershell' | 'batch' | 'bash' | 'python';
  deviceId: string;
  parameters?: Record<string, any>;
  timeoutSeconds?: number;
  priority?: 'low' | 'normal' | 'high';
}

export interface ScriptExecutionResult {
  executionId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'timeout';
  output?: string;
  error?: string;
  exitCode?: number;
  startTime: Date;
  endTime?: Date;
  duration?: number;
}

export class ScriptExecutionService {
  private static instance: ScriptExecutionService;
  private nableService: NableService;
  private executionQueue: Map<string, ScriptExecutionResult> = new Map();

  private constructor() {
    this.nableService = NableService.getInstance();
  }

  public static getInstance(): ScriptExecutionService {
    if (!ScriptExecutionService.instance) {
      ScriptExecutionService.instance = new ScriptExecutionService();
    }
    return ScriptExecutionService.instance;
  }

  /**
   * Execute a script on a device
   */
  async executeScript(options: ScriptExecutionOptions): Promise<ScriptExecutionResult> {
    const executionId = this.generateExecutionId();
    const startTime = new Date();

    const execution: ScriptExecutionResult = {
      executionId,
      status: 'pending',
      startTime
    };

    this.executionQueue.set(executionId, execution);

    try {
      // Mark as running
      execution.status = 'running';
      logger.info(`Executing script ${options.scriptName} on device ${options.deviceId}`);

      // Execute via N-able
      const result = await this.nableService.executeScript(
        options.deviceId,
        options.scriptName,
        options.parameters || {}
      );

      // Update execution result
      execution.status = 'completed';
      execution.output = result.output;
      execution.exitCode = result.exitCode;
      execution.endTime = new Date();
      execution.duration = execution.endTime.getTime() - startTime.getTime();

      logger.info(`Script execution completed: ${executionId}`);
      return execution;

    } catch (error: any) {
      // Update execution with error
      execution.status = 'failed';
      execution.error = error.message;
      execution.endTime = new Date();
      execution.duration = execution.endTime.getTime() - startTime.getTime();

      logger.error(`Script execution failed: ${executionId}`, error);
      throw error;
    }
  }

  /**
   * Execute script with retry logic
   */
  async executeScriptWithRetry(
    options: ScriptExecutionOptions, 
    maxRetries: number = 3,
    retryDelay: number = 5000
  ): Promise<ScriptExecutionResult> {
    let lastError: Error | undefined;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info(`Script execution attempt ${attempt} of ${maxRetries}`);
        return await this.executeScript(options);
      } catch (error: any) {
        lastError = error;
        logger.warn(`Script execution attempt ${attempt} failed: ${error.message}`);
        
        if (attempt < maxRetries) {
          await this.delay(retryDelay);
        }
      }
    }

    throw lastError || new Error('Script execution failed after max retries');
  }

  /**
   * Execute multiple scripts in parallel
   */
  async executeBatch(
    scripts: ScriptExecutionOptions[]
  ): Promise<ScriptExecutionResult[]> {
    logger.info(`Executing batch of ${scripts.length} scripts`);
    
    const promises = scripts.map(script => 
      this.executeScript(script).catch(error => ({
        executionId: this.generateExecutionId(),
        status: 'failed' as const,
        error: error.message,
        startTime: new Date()
      }))
    );

    return Promise.all(promises);
  }

  /**
   * Get execution status by ID
   */
  getExecutionStatus(executionId: string): ScriptExecutionResult | undefined {
    return this.executionQueue.get(executionId);
  }

  /**
   * Cancel a running execution
   */
  async cancelExecution(executionId: string): Promise<boolean> {
    const execution = this.executionQueue.get(executionId);
    
    if (!execution || execution.status !== 'running') {
      return false;
    }

    try {
      // Attempt to cancel via N-able
      // This would need proper implementation based on N-able API
      logger.info(`Cancelling script execution: ${executionId}`);
      
      execution.status = 'failed';
      execution.error = 'Execution cancelled by user';
      execution.endTime = new Date();
      
      return true;
    } catch (error) {
      logger.error(`Failed to cancel execution: ${executionId}`, error);
      return false;
    }
  }

  /**
   * Clean up old executions from queue
   */
  cleanupOldExecutions(olderThanHours: number = 24): number {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - olderThanHours);
    
    let cleaned = 0;
    
    for (const [id, execution] of this.executionQueue.entries()) {
      if (execution.startTime < cutoffTime) {
        this.executionQueue.delete(id);
        cleaned++;
      }
    }
    
    logger.info(`Cleaned up ${cleaned} old script executions`);
    return cleaned;
  }

  /**
   * Generate unique execution ID
   */
  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Helper method for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get execution statistics
   */
  getExecutionStats(): {
    total: number;
    pending: number;
    running: number;
    completed: number;
    failed: number;
  } {
    const stats = {
      total: this.executionQueue.size,
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0
    };

    for (const execution of this.executionQueue.values()) {
      switch (execution.status) {
        case 'pending':
          stats.pending++;
          break;
        case 'running':
          stats.running++;
          break;
        case 'completed':
          stats.completed++;
          break;
        case 'failed':
        case 'timeout':
          stats.failed++;
          break;
      }
    }

    return stats;
  }
}

export default ScriptExecutionService;