import { AutomationRule, ActionType } from '../../entities/AutomationRule';
import { Ticket, TicketStatus, TicketPriority, TicketSource } from '../../entities/Ticket';
import { AutomationHistory, ExecutionStatus } from '../../entities/AutomationHistory';
import { ConnectWiseService } from '../connectwise/ConnectWiseService';
import { NableService } from '../nable/NableService';
import { NotificationService } from '../NotificationService';
import { AppDataSource } from '../../database/dataSource';
import { logger } from '../../utils/logger';
import PQueue from 'p-queue';

export class AutomationEngine {
  private static instance: AutomationEngine;
  private connectWise: ConnectWiseService;
  private nable: NableService;
  private notification: NotificationService;
  private queue: PQueue;
  private ruleRepository = AppDataSource.getRepository(AutomationRule);
  private ticketRepository = AppDataSource.getRepository(Ticket);
  private historyRepository = AppDataSource.getRepository(AutomationHistory);

  private constructor() {
    this.connectWise = ConnectWiseService.getInstance();
    this.nable = NableService.getInstance();
    this.notification = NotificationService.getInstance();
    this.queue = new PQueue({ 
      concurrency: parseInt(process.env.AUTOMATION_CONCURRENCY || '5'),
      interval: 1000,
      intervalCap: 10
    });
  }

  public static getInstance(): AutomationEngine {
    if (!AutomationEngine.instance) {
      AutomationEngine.instance = new AutomationEngine();
    }
    return AutomationEngine.instance;
  }

  async initialize(): Promise<void> {
    logger.info('Initializing Automation Engine');
    await this.loadActiveRules();
  }

  private async loadActiveRules(): Promise<void> {
    const activeRules = await this.ruleRepository.find({
      where: { isActive: true },
      order: { priority: 'ASC' }
    });
    logger.info(`Loaded ${activeRules.length} active automation rules`);
  }

  async processTicket(ticket: Ticket): Promise<void> {
    logger.info(`Processing ticket ${ticket.ticketNumber} with automation rules`);
    const applicableRules = await this.findApplicableRules(ticket);
    
    if (applicableRules.length === 0) {
      logger.info(`No applicable automation rules found for ticket ${ticket.ticketNumber}`);
    } else {
      logger.info(`Found ${applicableRules.length} applicable rules for ticket ${ticket.ticketNumber}`);
    }
    
    for (const rule of applicableRules) {
      logger.info(`Queueing rule "${rule.name}" for ticket ${ticket.ticketNumber}`);
      await this.queue.add(async () => {
        await this.executeRule(rule, ticket);
      });
    }
  }

  async processAlert(alert: any, source: 'connectwise' | 'nable'): Promise<void> {
    logger.info(`Processing alert from ${source}:`, alert);
    
    // Create or update ticket based on alert
    let ticket = await this.findOrCreateTicket(alert, source);
    
    // Check for automatic remediation based on alert type
    await this.attemptAutoRemediation(ticket, alert);
    
    // Process with automation rules
    await this.processTicket(ticket);
  }
  
  /**
   * Attempt automatic remediation for known alert types
   */
  private async attemptAutoRemediation(ticket: Ticket, alert: any): Promise<void> {
    // Check if auto-remediation is enabled
    const autoRemediationEnabled = process.env.AUTO_REMEDIATION_ENABLED !== 'false';
    if (!autoRemediationEnabled) {
      logger.info('Auto-remediation disabled by configuration');
      return;
    }

    // Map alert types to remediation scripts
    const remediationMap: Record<string, { script: string; params?: any }> = {
      'disk_space': { script: 'disk_cleanup' },
      'disk_full': { script: 'disk_cleanup' },
      'disk_space_low': { script: 'disk_cleanup' },
      'DISK_SPACE_LOW': { 
        script: 'disk_cleanup',
        params: { driveLetter: alert.driveLetter || 'C:' }
      },
      'service_stopped': { script: 'service_restart' },
      'SERVICE_STOPPED': { 
        script: 'service_restart',
        params: { serviceName: alert.serviceName }
      },
      'iis_stopped': { script: 'restart-iis' },
      'high_memory': { script: 'clear_temp_files' },
      'HIGH_MEMORY': { script: 'clear_temp_files' },
      'HIGH_CPU': { script: 'check_services' },
      'windows_updates': { script: 'windows_update' },
      'network_issue': { script: 'reset-network' }
    };
    
    const alertType = alert.alertType || alert.type;
    const remediation = remediationMap[alertType] || remediationMap[alertType?.toLowerCase()];
    
    if (remediation && ticket.deviceId) {
      logger.info(`Attempting auto-remediation for ${alertType} with script ${remediation.script}`);
      
      try {
        // Import NableService dynamically
        const { NableService } = await import('../nable/NableService');
        const nableService = NableService.getInstance();
        
        // Add note that remediation is starting
        const note = {
          id: `note-${Date.now()}`,
          text: `🚀 Automatic remediation initiated: ${remediation.script}`,
          author: 'Automation Engine',
          timestamp: new Date(),
          type: 'automation' as const
        };
        ticket.notes = [...(ticket.notes || []), note];
        await this.ticketRepository.save(ticket);
        
        // Execute remediation script through N-able
        const result = await nableService.executeRemediation(
          ticket.deviceId,
          alertType,
          remediation.params || {}
        );
        
        logger.info(`Auto-remediation ${result.success ? 'succeeded' : 'failed'} for ticket ${ticket.ticketNumber}`);
        
        // Add result note
        const resultNote = {
          id: `note-${Date.now()}`,
          text: result.success 
            ? `✅ Auto-remediation successful: ${result.output || 'Issue resolved'}`
            : `❌ Auto-remediation failed: ${result.error || 'Unknown error'}`,
          author: 'Automation Engine',
          timestamp: new Date(),
          type: 'automation' as const
        };
        ticket.notes = [...(ticket.notes || []), resultNote];
        await this.ticketRepository.save(ticket);
        
        // Update ConnectWise ticket if we have the ticket number
        const cwTicketNumber = alert.cwTicketNumber || alert.connectwiseTicketId || 
                              ticket.metadata?.customFields?.cwTicketNumber;
        
        if (cwTicketNumber && result.success) {
          await this.closeConnectWiseTicket(ticket, result);
        } else if (cwTicketNumber) {
          await this.updateConnectWiseTicket(ticket, false, result);
        }
        
      } catch (error) {
        logger.error(`Auto-remediation failed for ticket ${ticket.ticketNumber}:`, error);
        
        // Add failure note
        const note = {
          id: `note-${Date.now()}`,
          text: `❌ Auto-remediation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          author: 'Automation Engine',
          timestamp: new Date(),
          type: 'automation' as const
        };
        ticket.notes = [...(ticket.notes || []), note];
        await this.ticketRepository.save(ticket);
        
        // Update ConnectWise ticket with failure
        const cwTicketNumber = alert.cwTicketNumber || alert.connectwiseTicketId;
        if (cwTicketNumber) {
          await this.updateConnectWiseTicket(ticket, false, {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    }
  }

  private async findApplicableRules(ticket: Ticket): Promise<AutomationRule[]> {
    const allRules = await this.ruleRepository.find({
      where: { isActive: true },
      order: { priority: 'ASC' }
    });

    return allRules.filter(rule => this.evaluateConditions(rule, ticket));
  }

  private evaluateConditions(rule: AutomationRule, ticket: Ticket): boolean {
    const { conditions } = rule;
    
    if (conditions.all) {
      const allMatch = conditions.all.every(condition => {
        const result = this.evaluateCondition(condition, ticket);
        logger.debug(`Rule "${rule.name}": ALL condition ${JSON.stringify(condition)} = ${result}`);
        return result;
      });
      if (!allMatch) return false;
    }
    
    if (conditions.any) {
      const anyMatch = conditions.any.some(condition => {
        const result = this.evaluateCondition(condition, ticket);
        logger.debug(`Rule "${rule.name}": ANY condition ${JSON.stringify(condition)} = ${result}`);
        return result;
      });
      if (!anyMatch) return false;
    }
    
    return true;
  }

  private evaluateCondition(condition: any, ticket: Ticket): boolean {
    const value = this.getFieldValue(condition.field, ticket, condition.dataSource);
    
    switch (condition.operator) {
      case 'equals':
        return value === condition.value;
      case 'not_equals':
        return value !== condition.value;
      case 'contains':
        return String(value).toLowerCase().includes(String(condition.value).toLowerCase());
      case 'not_contains':
        return !String(value).toLowerCase().includes(String(condition.value).toLowerCase());
      case 'greater_than':
        return Number(value) > Number(condition.value);
      case 'less_than':
        return Number(value) < Number(condition.value);
      case 'in':
        return condition.value.includes(value);
      case 'not_in':
        return !condition.value.includes(value);
      case 'regex':
        return new RegExp(condition.value).test(String(value));
      default:
        return false;
    }
  }

  private getFieldValue(field: string, ticket: Ticket, dataSource: string): any {
    if (dataSource === 'ticket') {
      return (ticket as any)[field];
    } else if (dataSource === 'device' && ticket.metadata?.nableData) {
      return ticket.metadata.nableData[field];
    } else if (dataSource === 'alert' && ticket.metadata) {
      // Check in nableData first (for N-able alerts)
      if (ticket.metadata.nableData && ticket.metadata.nableData[field] !== undefined) {
        return ticket.metadata.nableData[field];
      }
      // Then check in customFields
      if (ticket.metadata.customFields && ticket.metadata.customFields[field] !== undefined) {
        return ticket.metadata.customFields[field];
      }
      // Finally check in metadata directly
      return ticket.metadata[field];
    }
    return null;
  }

  async executeRule(rule: AutomationRule, ticket: Ticket): Promise<void> {
    const history = this.historyRepository.create({
      rule,
      ruleId: rule.id,
      ticket,
      ticketId: ticket.id,
      status: ExecutionStatus.RUNNING,
      executionSteps: [],
      startedAt: new Date(),
      input: { ticketId: ticket.id, ticketData: ticket }
    });

    await this.historyRepository.save(history);

    try {
      logger.info(`Executing rule "${rule.name}" for ticket ${ticket.ticketNumber}`);
      
      for (const action of rule.actions.sort((a, b) => a.order - b.order)) {
        const stepStart = new Date();
        const step: any = {
          action: action.type,
          startTime: stepStart,
          status: ExecutionStatus.RUNNING as ExecutionStatus,
          output: null as any,
          error: null as any,
          endTime: undefined
        };
        
        try {
          const result = await this.executeAction(action, ticket);
          step.status = ExecutionStatus.SUCCESS;
          step.output = result;
          step.endTime = new Date();
        } catch (error: any) {
          step.status = ExecutionStatus.FAILED;
          step.error = error.message;
          step.endTime = new Date();
          
          if (!action.continueOnError) {
            throw error;
          }
        }
        
        history.executionSteps.push(step);
      }
      
      history.status = ExecutionStatus.SUCCESS;
      history.completedAt = new Date();
      history.durationMs = history.completedAt.getTime() - history.startedAt!.getTime();
      
      // Update rule statistics
      rule.executionCount++;
      rule.successCount++;
      rule.lastExecutedAt = new Date();
      rule.lastSuccessAt = new Date();
      await this.ruleRepository.save(rule);
      
    } catch (error: any) {
      logger.error(`Rule execution failed: ${error.message}`, error);
      history.status = ExecutionStatus.FAILED;
      history.errorMessage = error.message;
      history.errorStack = error.stack;
      history.completedAt = new Date();
      history.durationMs = history.completedAt.getTime() - history.startedAt!.getTime();
      
      // Update rule statistics
      rule.executionCount++;
      rule.failureCount++;
      rule.lastExecutedAt = new Date();
      rule.lastFailureAt = new Date();
      rule.lastError = error.message;
      await this.ruleRepository.save(rule);
    }
    
    await this.historyRepository.save(history);
  }

  private async executeAction(action: any, ticket: Ticket): Promise<any> {
    switch (action.type) {
      case ActionType.RUN_SCRIPT:
        return await this.executeScript(action.parameters, ticket);
      
      case ActionType.UPDATE_TICKET:
        return await this.updateTicket(ticket, action.parameters);
      
      case ActionType.SEND_NOTIFICATION:
        return await this.sendNotification(action.parameters, ticket);
      
      case ActionType.CLOSE_TICKET:
        return await this.closeTicket(ticket, action.parameters);
      
      case ActionType.ESCALATE:
        return await this.escalateTicket(ticket, action.parameters);
      
      case ActionType.ASSIGN_TICKET:
        return await this.assignTicket(ticket, action.parameters);
      
      case ActionType.ADD_NOTE:
        return await this.addNote(ticket, action.parameters);
      
      case ActionType.RESTART_SERVICE:
        return await this.restartService(action.parameters, ticket);
      
      case ActionType.CLEAR_CACHE:
        return await this.clearCache(action.parameters, ticket);
      
      case ActionType.INSTALL_UPDATE:
        return await this.installUpdate(action.parameters, ticket);
      
      case ActionType.CREATE_TICKET:
        return await this.createTicket(action.parameters, ticket);
      
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  private async executeScript(params: any, ticket: Ticket): Promise<any> {
    const { NableService } = await import('../nable/NableService');
    const nableService = NableService.getInstance();
    
    const scriptName = params.scriptName || params.scriptId || 'Unknown Script';
    const deviceId = params.deviceId || ticket.deviceId;
    
    if (!deviceId) {
      throw new Error('No device associated with ticket');
    }
    
    const scriptParams = params.scriptParams || params.parameters || {};
    
    logger.info(`Executing script: ${scriptName} on device: ${deviceId}`);
    
    try {
      // Execute the remediation script through N-able
      const result = await nableService.executeScript(
        deviceId,
        scriptName,
        scriptParams
      );
      
      // Add script output to ticket notes
      await this.addNote(ticket, {
        text: `Automation: Executed script ${scriptName}
Status: ${result.success ? '✅ Success' : '❌ Failed'}
Output: ${result.output || result.error || 'No output'}
Exit Code: ${result.exitCode || 0}`,
        type: 'automation'
      });
      
      // Handle success/failure actions
      if (result.success && params.onSuccess) {
        await this.handlePostScriptAction(ticket, params.onSuccess, true, result);
      } else if (!result.success && params.onFailure) {
        await this.handlePostScriptAction(ticket, params.onFailure, false, result);
      }
      
      // If script was successful and auto-close is enabled, close the ConnectWise ticket
      if (result.success && process.env.AUTO_CLOSE_ON_SUCCESS === 'true') {
        await this.closeConnectWiseTicket(ticket, result);
      }
      
      return result;
    } catch (error) {
      logger.error(`Script execution failed for ${scriptName}:`, error);
      
      // Add error note
      await this.addNote(ticket, {
        text: `Automation: Script execution failed - ${scriptName}
Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        type: 'automation'
      });
      
      // Handle failure action
      if (params.onFailure) {
        await this.handlePostScriptAction(ticket, params.onFailure, false, {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
      
      throw error;
    }
  }

  private async handlePostScriptAction(
    ticket: Ticket,
    action: string,
    success: boolean,
    result: any
  ): Promise<void> {
    logger.info(`Handling post-script action: ${action} (success: ${success})`);
    
    switch (action) {
      case 'close_ticket':
        if (success) {
          await this.closeConnectWiseTicket(ticket, result);
        }
        break;
        
      case 'escalate':
        if (!success) {
          await this.escalateTicket(ticket, {});
        }
        break;
        
      case 'update_ticket':
        await this.updateConnectWiseTicket(ticket, success, result);
        break;
        
      case 'add_note':
        await this.addNote(ticket, {
          text: success ?
            `✅ Automated remediation successful\n${result.output || 'Issue resolved'}` :
            `❌ Automated remediation failed\n${result.error || 'Unknown error'}`,
          type: 'automation'
        });
        break;
        
      case 'send_teams_message':
        await this.sendNotification({
          channel: 'teams',
          message: success ?
            `✅ Automation Success - Ticket ${ticket.ticketNumber}\n${result.output || 'Issue resolved'}` :
            `⚠️ Automation Failed - Ticket ${ticket.ticketNumber}\n${result.error || 'Unknown error'}`
        }, ticket);
        break;
    }
  }

  private async closeConnectWiseTicket(ticket: Ticket, result: any): Promise<void> {
    try {
      const { ConnectWiseService } = await import('../connectwise/ConnectWiseService');
      const cwService = ConnectWiseService.getInstance();
      
      // Get ConnectWise ticket ID from various possible locations
      const cwTicketId = ticket.metadata?.customFields?.cwTicketNumber || 
                        ticket.metadata?.connectwiseData?.id ||
                        ticket.externalId;
      
      if (cwTicketId) {
        // Update and close the ConnectWise ticket
        await cwService.updateTicket(cwTicketId, [
          {
            op: 'replace',
            path: '/status/id',
            value: 5 // Closed status ID (may vary per ConnectWise instance)
          },
          {
            op: 'add',
            path: '/resolution',
            value: `Automated remediation completed successfully.
Script Output: ${result.output || 'Issue resolved'}
Resolved by: RMM Automation Platform
Resolution Time: ${new Date().toISOString()}`
          }
        ]);
        
        // Add a final note to the ticket
        await cwService.addTicketNote(cwTicketId, {
          text: `✅ Ticket automatically closed by RMM automation.
Remediation successful.
Output: ${result.output || 'Issue resolved'}`,
          detailDescriptionFlag: false,
          internalAnalysisFlag: true
        });
        
        logger.info(`ConnectWise ticket ${cwTicketId} closed successfully`);
        
        // Update local ticket status
        ticket.status = TicketStatus.CLOSED;
        ticket.closedAt = new Date();
        await this.ticketRepository.save(ticket);
      }
    } catch (error) {
      logger.error('Failed to close ConnectWise ticket:', error);
    }
  }

  private async updateConnectWiseTicket(ticket: Ticket, success: boolean, result: any): Promise<void> {
    try {
      const { ConnectWiseService } = await import('../connectwise/ConnectWiseService');
      const cwService = ConnectWiseService.getInstance();
      
      const cwTicketId = ticket.metadata?.customFields?.cwTicketNumber || 
                        ticket.metadata?.connectwiseData?.id ||
                        ticket.externalId;
      
      if (cwTicketId) {
        // Update ticket status based on success
        const statusId = success ? 8 : 2; // 8 = Resolved, 2 = In Progress (adjust as needed)
        
        await cwService.updateTicket(cwTicketId, [
          {
            op: 'replace',
            path: '/status/id',
            value: statusId
          }
        ]);
        
        // Add note about the automation attempt
        await cwService.addTicketNote(cwTicketId, {
          text: success ?
            `✅ Automated remediation successful\n${result.output || 'Issue resolved'}` :
            `⚠️ Automated remediation attempt failed\n${result.error || 'Manual intervention required'}`,
          detailDescriptionFlag: false,
          internalAnalysisFlag: true
        });
        
        logger.info(`ConnectWise ticket ${cwTicketId} updated with automation results`);
        
        // Update local ticket
        ticket.status = success ? TicketStatus.RESOLVED : TicketStatus.IN_PROGRESS;
        await this.ticketRepository.save(ticket);
      }
    } catch (error) {
      logger.error('Failed to update ConnectWise ticket:', error);
    }
  }

  private async updateTicket(ticket: Ticket, params: any): Promise<void> {
    Object.assign(ticket, params.updates);
    await this.ticketRepository.save(ticket);
    
    if (ticket.externalId) {
      const updates = Object.entries(params.updates).map(([key, value]) => ({
        op: 'replace' as const,
        path: `/${key}`,
        value
      }));
      await this.connectWise.updateTicket(ticket.externalId, updates);
    }
  }

  private async sendNotification(params: any, ticket: Ticket): Promise<void> {
    await this.notification.send({
      channels: params.channels || ['email'],
      subject: params.subject || `Automation Alert: ${ticket.title}`,
      message: params.message || `Automation has processed ticket ${ticket.ticketNumber}`,
      metadata: {
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        ...params.metadata
      }
    });
  }

  private async closeTicket(ticket: Ticket, params: any): Promise<void> {
    ticket.status = 'closed' as any;
    ticket.closedAt = new Date();
    await this.ticketRepository.save(ticket);
    
    if (ticket.externalId) {
      await this.connectWise.closeTicket(
        ticket.externalId,
        params.resolution || 'Resolved by automation'
      );
    }
  }

  private async escalateTicket(ticket: Ticket, params: any): Promise<void> {
    ticket.isEscalated = true;
    ticket.escalatedTo = params.escalateTo;
    ticket.priority = 'high' as any;
    await this.ticketRepository.save(ticket);
    
    await this.sendNotification({
      channels: ['email', 'slack'],
      subject: `ESCALATION: ${ticket.title}`,
      message: `Ticket ${ticket.ticketNumber} has been escalated to ${params.escalateTo}`,
      priority: 'high'
    }, ticket);
  }

  private async assignTicket(ticket: Ticket, params: any): Promise<void> {
    ticket.assignedToId = params.userId;
    await this.ticketRepository.save(ticket);
  }

  private async addNote(ticket: Ticket, params: any): Promise<void> {
    const note = {
      id: `note_${Date.now()}`,
      text: params.text,
      author: params.author || 'Automation',
      timestamp: new Date(),
      type: params.type || 'automation' as any
    };
    
    ticket.notes = [...(ticket.notes || []), note];
    await this.ticketRepository.save(ticket);
    
    if (ticket.externalId) {
      await this.connectWise.addTicketNote(ticket.externalId, {
        text: params.text,
        internalAnalysisFlag: params.internal || false
      });
    }
  }

  private async restartService(params: any, ticket: Ticket): Promise<any> {
    if (!ticket.deviceId) {
      throw new Error('No device associated with ticket');
    }
    
    const command = `net stop "${params.serviceName}" && net start "${params.serviceName}"`;
    return await this.nable.runCommand(ticket.deviceId, command);
  }

  private async clearCache(params: any, ticket: Ticket): Promise<any> {
    if (!ticket.deviceId) {
      throw new Error('No device associated with ticket');
    }
    
    return await this.nable.runRemediationScript(
      ticket.deviceId,
      'disk_cleanup',
      params
    );
  }

  private async installUpdate(params: any, ticket: Ticket): Promise<any> {
    if (!ticket.deviceId) {
      throw new Error('No device associated with ticket');
    }
    
    if (params.patchId) {
      return await this.nable.installPatch(ticket.deviceId, params.patchId);
    } else {
      return await this.nable.runRemediationScript(
        ticket.deviceId,
        'update_install',
        params
      );
    }
  }

  private async createTicket(params: any, parentTicket: Ticket): Promise<any> {
    logger.info(`Creating new ticket from automation rule: ${JSON.stringify(params)}`);
    
    const newTicket = this.ticketRepository.create({
      ticketNumber: `AUTO-${Date.now()}`,
      title: params.title || 'Automated Ticket',
      description: params.description || `Created by automation rule from ticket ${parentTicket.ticketNumber}`,
      status: params.status || 'open' as any,
      priority: params.priority || 'medium' as any,
      source: 'manual' as any,
      clientName: parentTicket.clientName,
      clientId: parentTicket.clientId,
      deviceId: parentTicket.deviceId,
      deviceName: parentTicket.deviceName,
      metadata: {
        customFields: {
          parentTicket: parentTicket.id,
          parentTicketNumber: parentTicket.ticketNumber,
          createdBy: 'automation',
          ...params.customFields
        }
      }
    });
    
    const savedTicket = await this.ticketRepository.save(newTicket);
    logger.info(`Created ticket ${savedTicket.ticketNumber} from automation rule`);
    
    return { ticketId: savedTicket.id, ticketNumber: savedTicket.ticketNumber };
  }

  private async findOrCreateTicket(alert: any, source: string): Promise<Ticket> {
    // Configuration for duplicate prevention
    const preventDuplicates = process.env.PREVENT_DUPLICATE_TICKETS === 'true';
    const updateOnlyMode = process.env.UPDATE_ONLY_MODE === 'true';
    const createNewCWTickets = process.env.CREATE_NEW_CW_TICKETS !== 'false';
    
    // Check if ticket already exists for this alert
    const existingTicket = await this.ticketRepository.findOne({
      where: { externalId: alert.id }
    });
    
    if (existingTicket) {
      logger.info(`Ticket already exists for alert ${alert.id}: ${existingTicket.ticketNumber}`);
      return existingTicket;
    }
    
    // If alert includes ConnectWise ticket number (from N-able's built-in integration)
    if (preventDuplicates && (alert.ticketNumber || alert.cwTicketId || alert.connectwiseTicketId || alert.cwTicketNumber)) {
      const cwTicketId = alert.ticketNumber || alert.cwTicketId || alert.connectwiseTicketId || alert.cwTicketNumber;
      logger.info(`Alert already has ConnectWise ticket: ${cwTicketId}, syncing instead of creating`);
      
      try {
        // Get the existing CW ticket
        const cwService = ConnectWiseService.getInstance();
        const cwTicket = await cwService.getTicket(cwTicketId);
        
        // Find or create local tracking ticket
        let localTicket = await this.ticketRepository.findOne({
          where: { externalId: cwTicket.id.toString() }
        });
        
        if (!localTicket) {
          localTicket = this.ticketRepository.create({
            ticketNumber: `CW-${cwTicket.id}`,
            externalId: cwTicket.id.toString(),
            title: cwTicket.summary,
            description: cwTicket.notes || alert.description || '',
            source: source as TicketSource,
            clientName: cwTicket.company.name,
            clientId: cwTicket.company.id.toString(),
            deviceId: alert.deviceId,
            deviceName: alert.deviceName,
            priority: this.mapAlertPriority(alert.severity || alert.priority) as TicketPriority,
            status: this.mapConnectWiseStatus(cwTicket.status.name),
            metadata: {
              connectwiseData: cwTicket,
              nableData: alert,
              customFields: {
                syncedFromCW: true,
                originalCWTicket: cwTicket.id
              }
            }
          });
          
          await this.ticketRepository.save(localTicket);
          logger.info(`Created local tracking ticket for existing CW ticket ${cwTicket.id}`);
        }
        
        // Add note about automation starting
        await cwService.addTicketNote(cwTicket.id.toString(), {
          text: `[RMM Automation] Processing alert: ${alert.alertType || 'Unknown'}\nAutomated remediation initiated.`,
          detailDescriptionFlag: false
        });
        
        return localTicket;
      } catch (error) {
        logger.error(`Failed to sync with existing CW ticket: ${error}`);
        // Fall through to create new ticket if sync fails and not in update-only mode
        if (updateOnlyMode) {
          throw new Error(`Update-only mode: Cannot create new ticket for alert ${alert.id}`);
        }
      }
    }
    
    // If in update-only mode, don't create new tickets
    if (updateOnlyMode) {
      logger.warn(`Update-only mode enabled: Not creating ticket for alert ${alert.id}`);
      throw new Error(`Update-only mode: No existing ticket found for alert ${alert.id}`);
    }
    
    // STEP 1: Create ticket in LOCAL database
    const localTicket = this.ticketRepository.create({
      ticketNumber: `AUTO-${Date.now()}`,
      title: alert.summary || alert.message || `Alert: ${alert.alertType}`,
      description: alert.description || alert.details || JSON.stringify(alert, null, 2),
      source: source as TicketSource,
      externalId: alert.id, // N-able alert ID
      clientName: alert.customerName || alert.clientName || alert.company?.name || 'Unknown Client',
      deviceId: alert.deviceId,
      deviceName: alert.deviceName,
      priority: this.mapAlertPriority(alert.severity || alert.priority) as TicketPriority,
      status: TicketStatus.OPEN,
      metadata: {
        // Store full alert data
        nableData: {
          ...alert,
          // Ensure alert fields are accessible
          alertType: alert.alertType,
          severity: alert.severity,
          diskPercent: alert.diskPercent || alert.diskUsage,
          cpuPercent: alert.cpuPercent,
          memoryPercent: alert.memoryPercent,
          serviceName: alert.serviceName || alert.alertServiceName
        },
        customFields: {
          createdFrom: 'n-sight-alert',
          alertTimestamp: alert.timestamp || new Date(),
          cwTicketNumber: alert.cwTicketNumber || alert.ticketNumber,
          // Also store at custom fields level for rule matching
          alertType: alert.alertType,
          severity: alert.severity,
          diskPercent: alert.diskPercent || alert.diskUsage
        }
      }
    });
    
    // Save to local database
    const savedTicket = await this.ticketRepository.save(localTicket);
    logger.info(`Created local ticket ${savedTicket.ticketNumber} from ${source} alert`);
    
    // STEP 2: Create ticket in CONNECTWISE (if N-sight alert and enabled)
    if (source === 'nable' && createNewCWTickets && !updateOnlyMode) {
      try {
        const { ConnectWiseService } = await import('../connectwise/ConnectWiseService');
        const cwService = ConnectWiseService.getInstance();
        
        // Create ConnectWise ticket
        const cwTicket = await cwService.createTicket({
          summary: `[N-sight Alert] ${savedTicket.title}`,
          board: {
            id: parseInt(process.env.CW_BOARD_ID || '1')
          },
          company: {
            // Company ID should be provided by N-able alert or use a fallback
            // Since N-able creates tickets, this code path shouldn't be reached
            id: alert.companyId || alert.customerId || 1
          },
          initialDescription: `
Alert Source: N-able N-sight RMM
Alert ID: ${alert.id}
Device: ${alert.deviceName || 'Unknown'}
Client: ${alert.customerName || 'Unknown'}
Severity: ${alert.severity || 'Unknown'}
Time: ${new Date(alert.timestamp || Date.now()).toLocaleString()}

Details:
${savedTicket.description}

---
Local RMM Ticket: ${savedTicket.ticketNumber}
This ticket was automatically created from an N-sight alert.
          `
        });
        
        // Update local ticket with ConnectWise ID
        savedTicket.metadata = {
          ...savedTicket.metadata,
          connectwiseData: {
            id: cwTicket.id,
            number: cwTicket.id,
            createdAt: new Date()
          }
        };
        
        await this.ticketRepository.save(savedTicket);
        logger.info(`Created ConnectWise ticket ${cwTicket.id} linked to local ticket ${savedTicket.ticketNumber}`);
        
        // Add note to ConnectWise ticket
        await cwService.addTicketNote(cwTicket.id.toString(), {
          text: `Automated ticket created from N-sight alert. Local RMM system will handle initial remediation attempts.`,
          detailDescriptionFlag: false
        });
        
      } catch (error) {
        logger.error('Failed to create ConnectWise ticket:', error);
        // Don't fail the whole process - local ticket is still created
        savedTicket.metadata = {
          ...savedTicket.metadata,
          customFields: {
            ...savedTicket.metadata?.customFields,
          connectWiseError: error instanceof Error ? error.message : 'Failed to create CW ticket'
          }
        };
        await this.ticketRepository.save(savedTicket);
      }
    }
    
    // STEP 3: Send notification to Teams about dual ticket creation
    try {
      const { TeamsService } = await import('../teams/TeamsService');
      const teamsService = TeamsService.getInstance();
      
      await teamsService.sendTicketNotification(
        savedTicket,
        'created'
      );
    } catch (error) {
      logger.error('Failed to send Teams notification:', error);
    }
    
    return savedTicket;
  }

  private mapAlertPriority(severity: string): string {
    const map: Record<string, string> = {
      'Critical': 'critical',
      'High': 'high',
      'Warning': 'medium',
      'Information': 'low'
    };
    return map[severity] || 'medium';
  }
  
  private mapConnectWiseStatus(cwStatus: string): TicketStatus {
    const statusMap: Record<string, TicketStatus> = {
      'New': TicketStatus.OPEN,
      'Open': TicketStatus.OPEN,
      'In Progress': TicketStatus.IN_PROGRESS,
      'Pending': TicketStatus.PENDING,
      'Resolved': TicketStatus.RESOLVED,
      'Closed': TicketStatus.CLOSED,
      'Completed': TicketStatus.CLOSED
    };
    return statusMap[cwStatus] || TicketStatus.OPEN;
  }
  
  private mapPriorityToConnectWise(priority: string): string {
    const map: Record<string, string> = {
      'critical': 'Priority 1 - Critical',
      'high': 'Priority 2 - High', 
      'medium': 'Priority 3 - Medium',
      'low': 'Priority 4 - Low'
    };
    return map[priority.toLowerCase()] || 'Priority 3 - Medium';
  }
}
