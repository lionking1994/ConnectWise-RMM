import { AutomationRule, ActionType } from '../../entities/AutomationRule';
import { Ticket } from '../../entities/Ticket';
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
    const applicableRules = await this.findApplicableRules(ticket);
    
    for (const rule of applicableRules) {
      await this.queue.add(async () => {
        await this.executeRule(rule, ticket);
      });
    }
  }

  async processAlert(alert: any, source: 'connectwise' | 'nable'): Promise<void> {
    logger.info(`Processing alert from ${source}:`, alert);
    
    // Create or update ticket based on alert
    let ticket = await this.findOrCreateTicket(alert, source);
    
    // Process with automation rules
    await this.processTicket(ticket);
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
      const allMatch = conditions.all.every(condition => 
        this.evaluateCondition(condition, ticket)
      );
      if (!allMatch) return false;
    }
    
    if (conditions.any) {
      const anyMatch = conditions.any.some(condition => 
        this.evaluateCondition(condition, ticket)
      );
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
        return String(value).includes(condition.value);
      case 'not_contains':
        return !String(value).includes(condition.value);
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
      
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  private async executeScript(params: any, ticket: Ticket): Promise<any> {
    if (!ticket.deviceId) {
      throw new Error('No device associated with ticket');
    }
    
    const result = await this.nable.executeScript(
      ticket.deviceId,
      params.scriptId,
      params.parameters
    );
    
    // Add script output to ticket notes
    await this.addNote(ticket, {
      text: `Automation: Executed script ${params.scriptId}\nOutput: ${result.output}`,
      type: 'automation'
    });
    
    return result;
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
      undefined,
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
        undefined,
        params
      );
    }
  }

  private async findOrCreateTicket(alert: any, source: string): Promise<Ticket> {
    // Implementation would check if ticket exists for this alert
    // and create one if not
    const existingTicket = await this.ticketRepository.findOne({
      where: { externalId: alert.id }
    });
    
    if (existingTicket) {
      return existingTicket;
    }
    
    const newTicket = this.ticketRepository.create({
      ticketNumber: `AUTO-${Date.now()}`,
      title: alert.summary || alert.message,
      description: alert.description || alert.details,
      source: source as any,
      externalId: alert.id,
      clientName: alert.customerName || alert.company?.name,
      deviceId: alert.deviceId,
      deviceName: alert.deviceName,
      priority: this.mapAlertPriority(alert.severity || alert.priority),
      metadata: {
        [`${source}Data`]: alert
      }
    });
    
    return await this.ticketRepository.save(newTicket);
  }

  private mapAlertPriority(severity: string): any {
    const map: Record<string, string> = {
      'Critical': 'critical',
      'High': 'high',
      'Warning': 'medium',
      'Information': 'low'
    };
    return map[severity] || 'medium';
  }
}
