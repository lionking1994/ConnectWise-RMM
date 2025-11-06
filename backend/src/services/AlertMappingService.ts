import { Repository, In } from 'typeorm';
import { AppDataSource } from '../database/dataSource';
import { 
  AlertScriptMapping, 
  AlertMappingExecution, 
  AlertConditionOperator, 
  AlertActionType,
  AlertCondition,
  AlertAction 
} from '../entities/AlertScriptMapping';
import { Script } from '../entities/Script';
import { User } from '../entities/User';
import { Ticket } from '../entities/Ticket';
import { ScriptService } from './ScriptService';
import { NotificationService } from './NotificationService';
import { ConnectWiseService } from './connectwise/ConnectWiseService';
import { logger } from '../utils/logger';

export interface AlertData {
  id: string;
  type: string;
  severity: string;
  deviceId: string;
  deviceName: string;
  message: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface MappingExecutionResult {
  mappingId: number;
  success: boolean;
  actions: Array<{
    type: string;
    success: boolean;
    output?: string;
    error?: string;
  }>;
  escalated?: boolean;
  ticketUpdated?: boolean;
}

export class AlertMappingService {
  private mappingRepository: Repository<AlertScriptMapping>;
  private executionRepository: Repository<AlertMappingExecution>;
  private scriptService: ScriptService;
  private notificationService: NotificationService;
  private connectWiseService: ConnectWiseService;

  constructor() {
    this.mappingRepository = AppDataSource.getRepository(AlertScriptMapping);
    this.executionRepository = AppDataSource.getRepository(AlertMappingExecution);
    this.scriptService = new ScriptService();
    this.notificationService = NotificationService.getInstance();
    this.connectWiseService = ConnectWiseService.getInstance();
  }

  // Create a new alert mapping
  async createMapping(data: Partial<AlertScriptMapping>, user: User): Promise<AlertScriptMapping> {
    try {
      const mapping = this.mappingRepository.create({
        ...data,
        createdBy: user,
        updatedBy: user,
        executionCount: 0,
        successCount: 0,
        failureCount: 0,
      });

      const saved = await this.mappingRepository.save(mapping);
      logger.info(`Alert mapping created: ${saved.name} by ${user.email}`);
      return saved;
    } catch (error) {
      logger.error('Error creating alert mapping:', error);
      throw error;
    }
  }

  // Update an alert mapping
  async updateMapping(id: number, data: Partial<AlertScriptMapping>, user: User): Promise<AlertScriptMapping> {
    try {
      const mapping = await this.mappingRepository.findOne({ where: { id } });
      if (!mapping) {
        throw new Error('Alert mapping not found');
      }

      Object.assign(mapping, {
        ...data,
        updatedBy: user,
      });

      const saved = await this.mappingRepository.save(mapping);
      logger.info(`Alert mapping updated: ${saved.name}`);
      return saved;
    } catch (error) {
      logger.error('Error updating alert mapping:', error);
      throw error;
    }
  }

  // Get all mappings
  async getAllMappings(filters?: {
    isActive?: boolean;
    alertType?: string;
    scriptId?: number;
  }): Promise<AlertScriptMapping[]> {
    try {
      const query = this.mappingRepository.createQueryBuilder('mapping')
        .leftJoinAndSelect('mapping.primaryScript', 'script')
        .leftJoinAndSelect('mapping.createdBy', 'createdBy')
        .leftJoinAndSelect('mapping.updatedBy', 'updatedBy');

      if (filters?.isActive !== undefined) {
        query.andWhere('mapping.isActive = :isActive', { isActive: filters.isActive });
      }
      if (filters?.alertType) {
        query.andWhere(':alertType = ANY(mapping.alertTypes)', { alertType: filters.alertType });
      }
      if (filters?.scriptId) {
        query.andWhere('mapping.primary_script_id = :scriptId', { scriptId: filters.scriptId });
      }

      query.orderBy('mapping.priority', 'DESC')
        .addOrderBy('mapping.name', 'ASC');

      return await query.getMany();
    } catch (error) {
      logger.error('Error fetching alert mappings:', error);
      throw error;
    }
  }

  // Get mapping by ID
  async getMappingById(id: number): Promise<AlertScriptMapping | null> {
    try {
      return await this.mappingRepository.findOne({
        where: { id },
        relations: ['primaryScript', 'createdBy', 'updatedBy'],
      });
    } catch (error) {
      logger.error('Error fetching alert mapping:', error);
      throw error;
    }
  }

  // Process an alert and execute matching mappings
  async processAlert(alertData: AlertData, ticketId?: number): Promise<MappingExecutionResult[]> {
    try {
      logger.info(`Processing alert: ${alertData.type} for device ${alertData.deviceId}`);

      // Find matching mappings
      const matchingMappings = await this.findMatchingMappings(alertData);
      
      if (matchingMappings.length === 0) {
        logger.info('No matching alert mappings found');
        return [];
      }

      logger.info(`Found ${matchingMappings.length} matching mappings`);

      const results: MappingExecutionResult[] = [];

      // Process mappings by priority
      for (const mapping of matchingMappings) {
        // Check schedule restrictions
        if (!this.isWithinSchedule(mapping)) {
          logger.info(`Mapping ${mapping.name} skipped due to schedule restrictions`);
          continue;
        }

        const result = await this.executeMappingActions(mapping, alertData, ticketId);
        results.push(result);

        // Stop processing if configured and successful
        if (mapping.stopOnFirstSuccess && result.success) {
          logger.info(`Stopping further processing as mapping ${mapping.name} succeeded`);
          break;
        }
      }

      return results;
    } catch (error) {
      logger.error('Error processing alert:', error);
      throw error;
    }
  }

  // Find mappings that match the alert
  private async findMatchingMappings(alertData: AlertData): Promise<AlertScriptMapping[]> {
    try {
      // Get all active mappings
      const mappings = await this.getAllMappings({ isActive: true });

      // Filter mappings that match the alert
      const matchingMappings = mappings.filter(mapping => {
        return this.evaluateConditions(mapping.conditions, alertData);
      });

      // Sort by priority (highest first)
      return matchingMappings.sort((a, b) => b.priority - a.priority);
    } catch (error) {
      logger.error('Error finding matching mappings:', error);
      throw error;
    }
  }

  // Evaluate conditions against alert data
  private evaluateConditions(
    conditions: { all?: AlertCondition[]; any?: AlertCondition[] },
    alertData: AlertData
  ): boolean {
    // Evaluate ALL conditions (AND)
    if (conditions.all && conditions.all.length > 0) {
      const allMatch = conditions.all.every(condition => 
        this.evaluateCondition(condition, alertData)
      );
      if (!allMatch) return false;
    }

    // Evaluate ANY conditions (OR)
    if (conditions.any && conditions.any.length > 0) {
      const anyMatch = conditions.any.some(condition => 
        this.evaluateCondition(condition, alertData)
      );
      if (!anyMatch) return false;
    }

    // If no conditions specified, it matches everything
    if ((!conditions.all || conditions.all.length === 0) && 
        (!conditions.any || conditions.any.length === 0)) {
      return false; // Require at least one condition
    }

    return true;
  }

  // Evaluate a single condition
  private evaluateCondition(condition: AlertCondition, alertData: AlertData): boolean {
    const fieldValue = this.getFieldValue(condition.field, alertData);
    const conditionValue = condition.value;

    switch (condition.operator) {
      case AlertConditionOperator.EQUALS:
        return fieldValue === conditionValue;
      
      case AlertConditionOperator.CONTAINS:
        return String(fieldValue).toLowerCase().includes(String(conditionValue).toLowerCase());
      
      case AlertConditionOperator.STARTS_WITH:
        return String(fieldValue).toLowerCase().startsWith(String(conditionValue).toLowerCase());
      
      case AlertConditionOperator.ENDS_WITH:
        return String(fieldValue).toLowerCase().endsWith(String(conditionValue).toLowerCase());
      
      case AlertConditionOperator.REGEX:
        try {
          return new RegExp(conditionValue).test(String(fieldValue));
        } catch {
          return false;
        }
      
      case AlertConditionOperator.IN:
        return Array.isArray(conditionValue) && conditionValue.includes(fieldValue);
      
      case AlertConditionOperator.NOT_IN:
        return Array.isArray(conditionValue) && !conditionValue.includes(fieldValue);
      
      case AlertConditionOperator.GREATER_THAN:
        return Number(fieldValue) > Number(conditionValue);
      
      case AlertConditionOperator.LESS_THAN:
        return Number(fieldValue) < Number(conditionValue);
      
      default:
        return false;
    }
  }

  // Get field value from alert data
  private getFieldValue(field: string, alertData: AlertData): any {
    // Support nested fields with dot notation
    const parts = field.split('.');
    let value: any = alertData;

    for (const part of parts) {
      value = value?.[part];
      if (value === undefined) break;
    }

    return value;
  }

  // Check if current time is within mapping's schedule
  private isWithinSchedule(mapping: AlertScriptMapping): boolean {
    if (!mapping.schedule?.enabled) {
      return true; // No schedule restrictions
    }

    const now = new Date();
    const schedule = mapping.schedule;

    // Check blackout periods
    if (schedule.blackoutPeriods) {
      for (const period of schedule.blackoutPeriods) {
        if (now >= new Date(period.start) && now <= new Date(period.end)) {
          return false;
        }
      }
    }

    // Check allowed days
    if (schedule.allowedDays && !schedule.allowedDays.includes(now.getDay())) {
      return false;
    }

    // Check allowed hours
    if (schedule.allowedHours) {
      const currentHour = now.getHours();
      if (currentHour < schedule.allowedHours.start || currentHour >= schedule.allowedHours.end) {
        return false;
      }
    }

    return true;
  }

  // Execute mapping actions
  private async executeMappingActions(
    mapping: AlertScriptMapping,
    alertData: AlertData,
    ticketId?: number
  ): Promise<MappingExecutionResult> {
    const execution = this.executionRepository.create({
      mapping,
      alertId: alertData.id,
      alertData: alertData as any,
      ticketId: ticketId || 0,
      deviceId: alertData.deviceId,
      executedActions: [],
      overallStatus: 'running',
      startTime: new Date(),
    });

    await this.executionRepository.save(execution);

    const result: MappingExecutionResult = {
      mappingId: mapping.id,
      success: true,
      actions: [],
    };

    let retryCount = 0;
    let shouldRetry = true;

    while (shouldRetry && retryCount <= mapping.maxRetries) {
      try {
        // Sort actions by order
        const sortedActions = [...mapping.actions].sort((a, b) => a.order - b.order);

        for (const action of sortedActions) {
          const actionResult = await this.executeAction(action, mapping, alertData, ticketId);
          
          execution.executedActions.push({
            action,
            startTime: new Date(),
            endTime: new Date(),
            success: actionResult.success,
            output: actionResult.output,
            error: actionResult.error,
          });

          result.actions.push(actionResult);

          if (!actionResult.success && !action.continueOnError) {
            result.success = false;
            throw new Error(`Action failed: ${actionResult.error}`);
          }
        }

        shouldRetry = false;
        result.success = true;

      } catch (error) {
        logger.error(`Attempt ${retryCount + 1} failed:`, error);
        retryCount++;

        if (retryCount <= mapping.maxRetries) {
          logger.info(`Retrying in ${mapping.retryDelaySeconds} seconds...`);
          await new Promise(resolve => setTimeout(resolve, mapping.retryDelaySeconds * 1000));
        } else {
          result.success = false;
          
          // Handle escalation if configured
          if (mapping.escalateAfterFailures && retryCount >= mapping.escalateAfterFailures) {
            await this.handleEscalation(mapping, alertData, ticketId, error.message);
            result.escalated = true;
            execution.escalated = true;
            execution.escalatedTo = mapping.escalateToGroupName || String(mapping.escalateToUserId);
          }
        }
      }
    }

    // Update execution record
    execution.overallStatus = result.success ? 'success' : 'failure';
    execution.endTime = new Date();
    execution.duration = execution.endTime.getTime() - execution.startTime.getTime();
    await this.executionRepository.save(execution);

    // Update mapping statistics
    mapping.executionCount++;
    if (result.success) {
      mapping.successCount++;
    } else {
      mapping.failureCount++;
    }
    mapping.lastExecutedAt = new Date();
    mapping.lastExecutionStatus = result.success ? 'success' : 'failure';
    await this.mappingRepository.save(mapping);

    // Send notifications based on result
    await this.sendMappingNotifications(mapping, result, alertData);

    return result;
  }

  // Execute a single action
  private async executeAction(
    action: AlertAction,
    mapping: AlertScriptMapping,
    alertData: AlertData,
    ticketId?: number
  ): Promise<{ type: string; success: boolean; output?: string; error?: string }> {
    try {
      switch (action.type) {
        case AlertActionType.RUN_SCRIPT:
          return await this.executeScriptAction(action, mapping, alertData, ticketId);
        
        case AlertActionType.UPDATE_TICKET:
          return await this.executeTicketUpdateAction(action, mapping, alertData, ticketId);
        
        case AlertActionType.SEND_NOTIFICATION:
          return await this.executeNotificationAction(action, alertData);
        
        case AlertActionType.ESCALATE:
          return await this.executeEscalationAction(action, alertData, ticketId);
        
        case AlertActionType.CLOSE_TICKET:
          return await this.executeCloseTicketAction(action, ticketId);
        
        default:
          throw new Error(`Unknown action type: ${action.type}`);
      }
    } catch (error) {
      logger.error(`Error executing action ${action.type}:`, error);
      return {
        type: action.type,
        success: false,
        error: error.message,
      };
    }
  }

  // Execute script action
  private async executeScriptAction(
    action: AlertAction,
    mapping: AlertScriptMapping,
    alertData: AlertData,
    ticketId?: number
  ): Promise<{ type: string; success: boolean; output?: string; error?: string }> {
    const scriptId = action.parameters.scriptId || mapping.primaryScript?.id;
    if (!scriptId) {
      throw new Error('No script specified for execution');
    }

    const execution = await this.scriptService.executeScript(
      scriptId,
      alertData.deviceId,
      action.parameters.scriptParameters || {},
      ticketId,
      'alert-mapping'
    );

    return {
      type: action.type,
      success: execution.status === 'success',
      output: execution.output || undefined,
      error: execution.errorMessage || undefined,
    };
  }

  // Execute ticket update action
  private async executeTicketUpdateAction(
    action: AlertAction,
    mapping: AlertScriptMapping,
    alertData: AlertData,
    ticketId?: number
  ): Promise<{ type: string; success: boolean; output?: string; error?: string }> {
    if (!ticketId) {
      throw new Error('No ticket ID provided for update');
    }

    const updates = action.parameters.updates || mapping.ticketUpdateTemplate || {};
    
    // Replace variables in note template
    if (updates.noteTemplate) {
      updates.note = this.replaceVariables(updates.noteTemplate, {
        alertType: alertData.type,
        deviceName: alertData.deviceName,
        severity: alertData.severity,
        timestamp: alertData.timestamp.toISOString(),
        mappingName: mapping.name,
      });
    }

    await this.connectWiseService.updateTicket(ticketId.toString(), updates);

    return {
      type: action.type,
      success: true,
      output: 'Ticket updated successfully',
    };
  }

  // Execute notification action
  private async executeNotificationAction(
    action: AlertAction,
    alertData: AlertData
  ): Promise<{ type: string; success: boolean; output?: string; error?: string }> {
    await this.notificationService.send({
      channels: action.parameters.channels || ['email'],
      subject: action.parameters.title || `Alert: ${alertData.type}`,
      message: action.parameters.message || alertData.message,
      priority: action.parameters.priority || 'medium',
      metadata: {
        type: action.parameters.notificationType || 'alert',
        alertData
      }
    });

    return {
      type: action.type,
      success: true,
      output: 'Notification sent',
    };
  }

  // Execute escalation action
  private async executeEscalationAction(
    action: AlertAction,
    alertData: AlertData,
    ticketId?: number
  ): Promise<{ type: string; success: boolean; output?: string; error?: string }> {
    await this.handleEscalation(
      { escalateToUserId: action.parameters.userId, escalateToGroupName: action.parameters.groupName } as any,
      alertData,
      ticketId,
      action.parameters.reason || 'Manual escalation'
    );

    return {
      type: action.type,
      success: true,
      output: 'Escalated successfully',
    };
  }

  // Execute close ticket action
  private async executeCloseTicketAction(
    action: AlertAction,
    ticketId?: number
  ): Promise<{ type: string; success: boolean; output?: string; error?: string }> {
    if (!ticketId) {
      throw new Error('No ticket ID provided for closure');
    }

    await this.connectWiseService.updateTicket(ticketId.toString(), [
      { op: 'replace', path: '/status/id', value: 5 }, // Closed status ID
      { op: 'add', path: '/resolution', value: action.parameters.resolution || 'Resolved by automation' }
    ]);

    return {
      type: action.type,
      success: true,
      output: 'Ticket closed',
    };
  }

  // Handle escalation
  private async handleEscalation(
    mapping: { escalateToUserId?: number; escalateToGroupName?: string },
    alertData: AlertData,
    ticketId?: number,
    reason: string = 'Alert triggered escalation'
  ): Promise<void> {
    try {
      logger.info(`Escalating alert ${alertData.id} - Reason: ${reason}`);

      // Send escalation notification
      await this.notificationService.send({
        channels: ['email', 'teams'],
        subject: `Alert Escalation: ${alertData.type}`,
        message: `Alert for device ${alertData.deviceName} has been escalated. Reason: ${reason}`,
        priority: 'high',
        metadata: {
          type: 'escalation',
          alertData,
          ticketId,
          escalatedTo: mapping.escalateToGroupName || mapping.escalateToUserId,
        },
      });

      // Update ticket if available
      if (ticketId) {
        await this.connectWiseService.updateTicket(ticketId.toString(), [
          { op: 'replace', path: '/priority/id', value: 3 }, // High priority ID
          { op: 'add', path: '/note', value: `Alert escalated: ${reason}` }
        ]);
      }
    } catch (error) {
      logger.error('Error handling escalation:', error);
      throw error;
    }
  }

  // Send notifications based on mapping configuration
  private async sendMappingNotifications(
    mapping: AlertScriptMapping,
    result: MappingExecutionResult,
    alertData: AlertData
  ): Promise<void> {
    if (!mapping.notificationSettings) return;

    const settings = mapping.notificationSettings;
    
    if ((result.success && settings.onSuccess) || 
        (!result.success && settings.onFailure) ||
        (result.escalated && settings.onEscalation)) {
      
      const title = result.success 
        ? `Alert Remediation Success: ${alertData.type}`
        : `Alert Remediation Failed: ${alertData.type}`;
      
      const message = result.success
        ? `Successfully processed alert for device ${alertData.deviceName}`
        : `Failed to process alert for device ${alertData.deviceName}`;

      await this.notificationService.send({
        channels: ['email'],
        subject: title,
        message,
        priority: result.success ? 'low' : 'high',
        metadata: {
          type: 'automation',
          mappingId: mapping.id,
          mappingName: mapping.name,
          result,
          alertData,
        },
      });
    }
  }

  // Replace variables in template strings
  private replaceVariables(template: string, variables: Record<string, any>): string {
    let result = template;
    
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, String(value));
    }
    
    return result;
  }

  // Get execution history
  async getExecutionHistory(filters?: {
    mappingId?: number;
    alertType?: string;
    deviceId?: string;
    status?: string;
    limit?: number;
  }): Promise<AlertMappingExecution[]> {
    try {
      const query = this.executionRepository.createQueryBuilder('execution')
        .leftJoinAndSelect('execution.mapping', 'mapping');

      if (filters?.mappingId) {
        query.andWhere('execution.mapping_id = :mappingId', { mappingId: filters.mappingId });
      }
      if (filters?.deviceId) {
        query.andWhere('execution.deviceId = :deviceId', { deviceId: filters.deviceId });
      }
      if (filters?.status) {
        query.andWhere('execution.overallStatus = :status', { status: filters.status });
      }

      query.orderBy('execution.startTime', 'DESC');

      if (filters?.limit) {
        query.limit(filters.limit);
      }

      return await query.getMany();
    } catch (error) {
      logger.error('Error fetching execution history:', error);
      throw error;
    }
  }

  // Delete a mapping
  async deleteMapping(id: number): Promise<void> {
    try {
      const mapping = await this.getMappingById(id);
      if (!mapping) {
        throw new Error('Alert mapping not found');
      }

      await this.mappingRepository.remove(mapping);
      logger.info(`Alert mapping deleted: ${mapping.name}`);
    } catch (error) {
      logger.error('Error deleting alert mapping:', error);
      throw error;
    }
  }

  // Clone a mapping
  async cloneMapping(id: number, newName: string, user: User): Promise<AlertScriptMapping> {
    try {
      const original = await this.getMappingById(id);
      if (!original) {
        throw new Error('Original mapping not found');
      }

      const cloned = this.mappingRepository.create({
        ...original,
        id: undefined,
        name: newName,
        createdBy: user,
        updatedBy: user,
        createdAt: undefined,
        updatedAt: undefined,
        executionCount: 0,
        successCount: 0,
        failureCount: 0,
        lastExecutedAt: undefined,
        lastExecutionStatus: undefined,
      });

      const saved = await this.mappingRepository.save(cloned);
      logger.info(`Alert mapping cloned: ${original.name} -> ${newName}`);
      return saved;
    } catch (error) {
      logger.error('Error cloning alert mapping:', error);
      throw error;
    }
  }

  // Test a mapping with sample alert data
  async testMapping(
    mappingId: number,
    sampleAlertData: AlertData
  ): Promise<{ matches: boolean; actions?: AlertAction[]; error?: string }> {
    try {
      const mapping = await this.getMappingById(mappingId);
      if (!mapping) {
        throw new Error('Mapping not found');
      }

      const matches = this.evaluateConditions(mapping.conditions, sampleAlertData);
      
      return {
        matches,
        actions: matches ? mapping.actions : undefined,
      };
    } catch (error) {
      logger.error('Error testing mapping:', error);
      return {
        matches: false,
        error: error.message,
      };
    }
  }
}

