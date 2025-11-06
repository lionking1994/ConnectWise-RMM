import axios, { AxiosInstance } from 'axios';
import { logger } from '../../utils/logger';
import { Ticket, TicketStatus, TicketPriority } from '../../entities/Ticket';
import { Notification } from '../../entities/Notification';
import { AppDataSource } from '../../database/dataSource';
import { AutomationRule } from '../../entities/AutomationRule';
import { User } from '../../entities/User';
import retry from 'retry';
import { v4 as uuidv4 } from 'uuid';

export interface TeamsMessage {
  type: 'message';
  attachments: TeamsAttachment[];
}

export interface TeamsAttachment {
  contentType: 'application/vnd.microsoft.card.adaptive';
  contentUrl?: null;
  content: TeamsAdaptiveCard;
}

export interface TeamsAdaptiveCard {
  $schema: string;
  type: 'AdaptiveCard';
  version: string;
  body: any[];
  actions?: any[];
}

export interface TeamsCommand {
  action: string;
  entityType: 'ticket' | 'automation' | 'alert';
  entityId: string;
  userId?: string;
  additionalData?: any;
}

export interface TeamsActionResponse {
  success: boolean;
  message: string;
  card?: TeamsAdaptiveCard;
}

export class TeamsService {
  private static instance: TeamsService;
  private webhookUrl: string;
  private client: AxiosInstance;
  private commandHandlers: Map<string, (command: TeamsCommand) => Promise<TeamsActionResponse>>;

  private constructor() {
    this.webhookUrl = process.env.MS_TEAMS_WEBHOOK_URL || '';
    this.client = axios.create({
      timeout: 10000
    });
    this.commandHandlers = new Map();
    this.registerCommandHandlers();
  }

  public static getInstance(): TeamsService {
    if (!TeamsService.instance) {
      TeamsService.instance = new TeamsService();
    }
    return TeamsService.instance;
  }

  public updateConfig(webhookUrl: string): void {
    this.webhookUrl = webhookUrl;
    logger.info('TeamsService configuration updated.');
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

  async sendTicketNotification(ticket: Ticket, action: string): Promise<void> {
    if (!this.webhookUrl) {
      logger.warn('MS Teams webhook URL not configured');
      return;
    }

    const card = this.createTicketCard(ticket, action);
    return this.sendCard(card);
  }

  async sendAlertNotification(
    title: string,
    message: string,
    severity: 'info' | 'warning' | 'error' | 'critical',
    actionUrl?: string
  ): Promise<void> {
    if (!this.webhookUrl) {
      logger.warn('MS Teams webhook URL not configured');
      return;
    }

    const color = this.getSeverityColor(severity);
    const card = this.createAlertCard(title, message, color, actionUrl);
    return this.sendCard(card);
  }

  async sendAutomationResult(
    ruleName: string,
    ticketNumber: string,
    success: boolean,
    details: string
  ): Promise<void> {
    if (!this.webhookUrl) {
      logger.warn('MS Teams webhook URL not configured');
      return;
    }

    const card = this.createAutomationCard(ruleName, ticketNumber, success, details);
    return this.sendCard(card);
  }

  async sendScriptExecutionResult(
    deviceName: string,
    scriptName: string,
    output: string,
    exitCode: number,
    ticketNumber?: string
  ): Promise<void> {
    if (!this.webhookUrl) {
      logger.warn('MS Teams webhook URL not configured');
      return;
    }

    const card = this.createScriptCard(deviceName, scriptName, output, exitCode, ticketNumber);
    return this.sendCard(card);
  }

  private async sendCard(card: TeamsAdaptiveCard): Promise<void> {
    return this.executeWithRetry(async () => {
      await this.client.post(this.webhookUrl, {
        type: 'message',
        attachments: [{
          contentType: 'application/vnd.microsoft.card.adaptive',
          contentUrl: null,
          content: card
        }]
      });
      logger.info('Teams notification sent successfully');
    });
  }

  private registerCommandHandlers(): void {
    // Approve ticket action
    this.commandHandlers.set('approve_ticket', async (command) => {
      const ticketRepo = AppDataSource.getRepository(Ticket);
      const ticket = await ticketRepo.findOne({ where: { id: command.entityId } });
      
      if (!ticket) {
        return { success: false, message: 'Ticket not found' };
      }

      ticket.status = TicketStatus.IN_PROGRESS;
      ticket.metadata = {
        ...ticket.metadata,
        customFields: {
          ...ticket.metadata?.customFields,
          approvedBy: command.userId,
          approvedAt: new Date()
        }
      };
      await ticketRepo.save(ticket);

      return {
        success: true,
        message: `Ticket #${ticket.ticketNumber} approved`,
        card: this.createTicketCard(ticket, 'approved')
      };
    });

    // Reject ticket action
    this.commandHandlers.set('reject_ticket', async (command) => {
      const ticketRepo = AppDataSource.getRepository(Ticket);
      const ticket = await ticketRepo.findOne({ where: { id: command.entityId } });
      
      if (!ticket) {
        return { success: false, message: 'Ticket not found' };
      }

      ticket.status = TicketStatus.CLOSED;
      ticket.metadata = {
        ...ticket.metadata,
        customFields: {
          ...ticket.metadata?.customFields,
          rejectedBy: command.userId,
          rejectedAt: new Date(),
          rejectionReason: command.additionalData?.reason
        }
      };
      await ticketRepo.save(ticket);

      return {
        success: true,
        message: `Ticket #${ticket.ticketNumber} rejected`,
        card: this.createTicketCard(ticket, 'rejected')
      };
    });

    // Execute automation action
    this.commandHandlers.set('execute_automation', async (command) => {
      const { AutomationEngine } = await import('../automation/AutomationEngine');
      const engine = AutomationEngine.getInstance();
      
      try {
        // Find the automation rule first
        const { AutomationRule } = await import('../../entities/AutomationRule');
        const ruleRepo = AppDataSource.getRepository(AutomationRule);
        const rule = await ruleRepo.findOne({ where: { id: command.entityId } });
        
        if (!rule) {
          return {
            success: false,
            message: `Automation rule ${command.entityId} not found`
          };
        }
        
        // Create a temporary ticket for the automation execution
        const ticketRepo = AppDataSource.getRepository(Ticket);
        const tempTicket = ticketRepo.create({
          ticketNumber: `TEAMS-${Date.now()}`,
          title: `Teams Command Execution`,
          description: `Automation triggered via Teams command`,
          status: TicketStatus.OPEN,
          priority: 'medium' as any,
          source: 'manual' as any,
          clientName: 'System',
          metadata: {
            customFields: {
              triggeredBy: 'teams_command',
              userId: command.userId
            }
          }
        });
        await ticketRepo.save(tempTicket);
        
        await engine.executeRule(rule, tempTicket);
        return {
          success: true,
          message: `Automation rule ${command.entityId} executed successfully`
        };
      } catch (error: any) {
        return {
          success: false,
          message: `Failed to execute automation: ${error.message}`
        };
      }
    });

    // Query ticket status
    this.commandHandlers.set('query_status', async (command) => {
      const ticketRepo = AppDataSource.getRepository(Ticket);
      const ticket = await ticketRepo.findOne({ where: { id: command.entityId } });
      
      if (!ticket) {
        return { success: false, message: 'Ticket not found' };
      }

      return {
        success: true,
        message: `Current status: ${ticket.status}`,
        card: this.createTicketCard(ticket, 'status')
      };
    });

    // Assign ticket to technician
    this.commandHandlers.set('assign_ticket', async (command) => {
      const ticketRepo = AppDataSource.getRepository(Ticket);
      const ticket = await ticketRepo.findOne({ where: { id: command.entityId } });
      
      if (!ticket) {
        return { success: false, message: 'Ticket not found' };
      }

      ticket.assignedTo = command.additionalData?.assignTo;
      ticket.metadata = {
        ...ticket.metadata,
        customFields: {
          ...ticket.metadata?.customFields,
          assignedBy: command.userId,
          assignedAt: new Date()
        }
      };
      await ticketRepo.save(ticket);

      return {
        success: true,
        message: `Ticket #${ticket.ticketNumber} assigned to ${ticket.assignedTo}`,
        card: this.createTicketCard(ticket, 'assigned')
      };
    });

    // ADD NOTE TO TICKET - Enhanced for client requirements
    this.commandHandlers.set('add_note', async (command) => {
      const ticketRepo = AppDataSource.getRepository(Ticket);
      
      // Support both ticket ID and ticket number
      let ticket = await ticketRepo.findOne({ where: { id: command.entityId } });
      if (!ticket) {
        ticket = await ticketRepo.findOne({ where: { ticketNumber: command.entityId } });
      }
      
      if (!ticket) {
        return { success: false, message: `Ticket ${command.entityId} not found` };
      }

      const noteText = command.additionalData?.note || 'Note added via Teams';
      const note = {
        id: uuidv4(),
        text: noteText,
        author: command.userId || 'Teams User',
        timestamp: new Date(),
        type: 'manual' as const
      };

      ticket.notes = [...(ticket.notes || []), note];
      await ticketRepo.save(ticket);

      // SYNC TO CONNECTWISE - Client requirement
      if (ticket.externalId) {
        try {
          const { ConnectWiseService } = await import('../connectwise/ConnectWiseService');
          const cwService = ConnectWiseService.getInstance();
          await cwService.addTicketNote(ticket.externalId, {
            text: `[Teams] ${noteText}`,
            detailDescriptionFlag: false
          });
          logger.info(`Note synced to ConnectWise ticket ${ticket.externalId}`);
        } catch (error) {
          logger.error('Failed to sync note to ConnectWise:', error);
        }
      }

      return {
        success: true,
        message: `Note added to ticket #${ticket.ticketNumber}`,
        card: this.createTicketCard(ticket, 'note_added')
      };
    });

    // EXECUTE SCRIPT ON DEVICE - Enhanced for automatic remediation
    this.commandHandlers.set('run_script', async (command) => {
      const ticketRepo = AppDataSource.getRepository(Ticket);
      const { scriptName, scriptId, deviceId, ticketNumber } = command.additionalData || {};
      
      // If ticketNumber provided, get device from ticket
      let targetDeviceId = deviceId;
      let ticket = null;
      
      if (ticketNumber) {
        ticket = await ticketRepo.findOne({ where: { ticketNumber } });
        if (ticket && ticket.deviceId) {
          targetDeviceId = ticket.deviceId;
        }
      } else if (command.entityId) {
        ticket = await ticketRepo.findOne({ where: { ticketNumber: command.entityId } });
        if (ticket && ticket.deviceId) {
          targetDeviceId = ticket.deviceId;
        }
      }
      
      if (!targetDeviceId) {
        return { success: false, message: 'No device found for script execution' };
      }

      const scriptToRun = scriptName || scriptId;
      if (!scriptToRun) {
        return { success: false, message: 'Script name or ID required' };
      }

      // Trigger script execution via N-able
      try {
        const { NableService } = await import('../nable/NableService');
        const nableService = NableService.getInstance();
        
        // Execute remediation script
        const result = await nableService.runRemediationScript(
          targetDeviceId,
          scriptToRun,
          ticket?.ticketNumber
        );
        
        // Update ticket with script results
        if (ticket) {
          const note = {
            id: uuidv4(),
            text: `Script '${scriptToRun}' executed from Teams\nStatus: ${result.success ? 'Success' : 'Failed'}\nOutput: ${result.output || 'See script logs'}`,
            author: 'Automation',
            timestamp: new Date(),
            type: 'automation' as const
          };
          ticket.notes = [...(ticket.notes || []), note];
          
          // Auto-close ticket if script successful (client requirement)
          if (result.success && command.additionalData?.autoClose) {
            ticket.status = TicketStatus.CLOSED;
            ticket.resolution = `Resolved by script: ${scriptToRun}`;
            ticket.resolvedAt = new Date();
          }
          
          await ticketRepo.save(ticket);
          
          // Sync to ConnectWise
          if (ticket.externalId) {
            const { ConnectWiseService } = await import('../connectwise/ConnectWiseService');
            const cwService = ConnectWiseService.getInstance();
            await cwService.addTicketNote(ticket.externalId, {
              text: `[Teams Automation] Script '${scriptToRun}' executed\nResult: ${result.success ? 'SUCCESS' : 'FAILED'}\n${result.output || ''}`,
              detailDescriptionFlag: false
            });
            
            if (result.success && command.additionalData?.autoClose) {
              await cwService.updateTicket(ticket.externalId, [
                { op: 'replace', path: '/status/id', value: 5 } // Closed status ID
              ]);
            }
          }
        }
        
        return {
          success: true,
          message: `Script '${scriptToRun}' executed ${result.success ? 'successfully' : 'with errors'}`,
          card: this.createScriptCard(targetDeviceId, scriptToRun, result.output || 'Script completed', result.success ? 100 : 0)
        };
      } catch (error: any) {
        // If script fails, escalate ticket (client requirement)
        if (ticket && command.additionalData?.escalateOnFailure) {
          ticket.priority = TicketPriority.CRITICAL;
          ticket.status = TicketStatus.PENDING;
          await ticketRepo.save(ticket);
          
          await this.sendEscalationNotification(ticket, 'Script execution failed');
        }
        
        return {
          success: false,
          message: `Failed to execute script: ${error.message}`
        };
      }
    });

    // CLOSE TICKET FROM TEAMS - Client requested feature
    this.commandHandlers.set('close_ticket', async (command) => {
      const ticketRepo = AppDataSource.getRepository(Ticket);
      
      // Support both ticket ID and ticket number
      let ticket = await ticketRepo.findOne({ where: { id: command.entityId } });
      if (!ticket) {
        ticket = await ticketRepo.findOne({ where: { ticketNumber: command.entityId } });
      }
      
      if (!ticket) {
        return { success: false, message: `Ticket ${command.entityId} not found` };
      }

      const resolution = command.additionalData?.resolution || 'Resolved via Teams';
      
      // Update ticket status
      ticket.status = TicketStatus.CLOSED;
      ticket.resolvedAt = new Date();
      ticket.closedAt = new Date();
      ticket.metadata = {
        ...ticket.metadata,
        customFields: {
          ...ticket.metadata?.customFields,
          resolution: resolution,
          closedBy: command.userId,
          closedFrom: 'teams',
          closedAt: new Date()
        }
      };

      // Add closing note
      const note = {
        id: uuidv4(),
        text: `Ticket closed via Teams: ${resolution}`,
        author: command.userId || 'Teams User',
        timestamp: new Date(),
        type: 'system' as const
      };
      ticket.notes = [...(ticket.notes || []), note];
      await ticketRepo.save(ticket);

      // SYNC TO CONNECTWISE - Critical for client
      if (ticket.externalId) {
        try {
          const { ConnectWiseService } = await import('../connectwise/ConnectWiseService');
          const cwService = ConnectWiseService.getInstance();
          
          // Close ticket in ConnectWise
          await cwService.updateTicket(ticket.externalId, [
            { op: 'replace', path: '/status/id', value: 5 } // Closed status ID
          ]);
          
          // Add resolution note
          await cwService.addTicketNote(ticket.externalId, {
            text: `[Teams] Ticket closed: ${resolution}`,
            detailDescriptionFlag: false
          });
          
          logger.info(`Ticket ${ticket.externalId} closed in ConnectWise`);
        } catch (error) {
          logger.error('Failed to close ticket in ConnectWise:', error);
        }
      }

      return {
        success: true,
        message: `Ticket #${ticket.ticketNumber} closed successfully`,
        card: this.createTicketCard(ticket, 'closed')
      };
    });

    // ESCALATE TICKET - Client requested feature
    this.commandHandlers.set('escalate_ticket', async (command) => {
      const ticketRepo = AppDataSource.getRepository(Ticket);
      
      // Support both ticket ID and ticket number
      let ticket = await ticketRepo.findOne({ where: { id: command.entityId } });
      if (!ticket) {
        ticket = await ticketRepo.findOne({ where: { ticketNumber: command.entityId } });
      }
      
      if (!ticket) {
        return { success: false, message: `Ticket ${command.entityId} not found` };
      }

      const escalationReason = command.additionalData?.reason || 'Requires senior technician assistance';
      const escalateTo = command.additionalData?.assignTo || 'next-available';

      // Update ticket priority and status
      ticket.priority = TicketPriority.CRITICAL;
      ticket.status = TicketStatus.PENDING;
      ticket.assignedTo = escalateTo !== 'next-available' ? escalateTo : ticket.assignedTo;
      ticket.metadata = {
        ...ticket.metadata,
        customFields: {
          ...ticket.metadata?.customFields,
          escalatedBy: command.userId,
          escalatedAt: new Date(),
          escalationReason: escalationReason,
          escalationLevel: ((ticket.metadata?.customFields?.escalationLevel as number) || 0) + 1
        }
      };

      // Add escalation note
      const note = {
        id: uuidv4(),
        text: `Ticket escalated via Teams: ${escalationReason}\nEscalated to: ${escalateTo}`,
        author: command.userId || 'Teams User',
        timestamp: new Date(),
        type: 'system' as const
      };
      ticket.notes = [...(ticket.notes || []), note];
      await ticketRepo.save(ticket);

      // Send escalation notification
      await this.sendEscalationNotification(ticket, escalationReason);

      // SYNC TO CONNECTWISE
      if (ticket.externalId) {
        try {
          const { ConnectWiseService } = await import('../connectwise/ConnectWiseService');
          const cwService = ConnectWiseService.getInstance();
          
          // Update priority and status in ConnectWise
          await cwService.updateTicket(ticket.externalId, [
            { op: 'replace', path: '/priority/id', value: 1 }, // Critical priority ID
            { op: 'replace', path: '/status/id', value: 2 } // In Progress status ID (for escalated)
          ]);
          
          // Add escalation note
          await cwService.addTicketNote(ticket.externalId, {
            text: `[Teams] Ticket escalated: ${escalationReason}\nEscalated to: ${escalateTo}`,
            detailDescriptionFlag: false
          });
          
          logger.info(`Ticket ${ticket.externalId} escalated in ConnectWise`);
        } catch (error) {
          logger.error('Failed to escalate ticket in ConnectWise:', error);
        }
      }

      return {
        success: true,
        message: `Ticket #${ticket.ticketNumber} escalated to ${escalateTo}`,
        card: this.createTicketCard(ticket, 'escalated')
      };
    });
  }

  async handleCommand(command: TeamsCommand): Promise<TeamsActionResponse> {
    const handler = this.commandHandlers.get(command.action);
    
    if (!handler) {
      return {
        success: false,
        message: `Unknown command: ${command.action}`
      };
    }

    try {
      return await handler(command);
    } catch (error: any) {
      logger.error('Error handling Teams command:', error);
      return {
        success: false,
        message: `Error executing command: ${error.message}`
      };
    }
  }

  private createTicketCard(ticket: Ticket, action: string): TeamsAdaptiveCard {
    const actionEmoji = {
      created: '🆕',
      updated: '📝',
      resolved: '✅',
      closed: '🔒',
      escalated: '⚠️'
    }[action] || '📋';

    return {
      $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
      type: 'AdaptiveCard',
      version: '1.4',
      body: [
        {
          type: 'TextBlock',
          text: `${actionEmoji} Ticket ${action.toUpperCase()}: ${ticket.ticketNumber}`,
          weight: 'bolder',
          size: 'large',
          color: this.getPriorityColor(ticket.priority)
        },
        {
          type: 'FactSet',
          facts: [
            { title: 'Title', value: ticket.title },
            { title: 'Client', value: ticket.clientName },
            { title: 'Status', value: ticket.status },
            { title: 'Priority', value: ticket.priority },
            { title: 'Assigned To', value: ticket.assignedTo || 'Unassigned' }
          ]
        },
        {
          type: 'TextBlock',
          text: ticket.description,
          wrap: true,
          maxLines: 3
        }
      ],
      actions: [
        {
          type: 'Action.Submit',
          title: '✅ Approve',
          data: {
            action: 'approve_ticket',
            entityType: 'ticket',
            entityId: ticket.id,
            ticketNumber: ticket.ticketNumber
          }
        },
        {
          type: 'Action.Submit',
          title: '❌ Reject',
          data: {
            action: 'reject_ticket',
            entityType: 'ticket',
            entityId: ticket.id,
            ticketNumber: ticket.ticketNumber
          }
        },
        {
          type: 'Action.ShowCard',
          title: '📝 Add Note',
          card: {
            type: 'AdaptiveCard',
            body: [
              {
                type: 'Input.Text',
                id: 'noteText',
                placeholder: 'Enter your note...',
                isMultiline: true
              }
            ],
            actions: [
              {
                type: 'Action.Submit',
                title: 'Submit Note',
                data: {
                  action: 'add_note',
                  entityType: 'ticket',
                  entityId: ticket.id,
                  ticketNumber: ticket.ticketNumber
                }
              }
            ]
          }
        },
        {
          type: 'Action.OpenUrl',
          title: '🌐 View in Portal',
          url: `${process.env.FRONTEND_URL}/tickets/${ticket.id}`
        }
      ]
    };
  }

  private createAlertCard(
    title: string,
    message: string,
    color: string,
    actionUrl?: string
  ): TeamsAdaptiveCard {
    const card: TeamsAdaptiveCard = {
      $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
      type: 'AdaptiveCard',
      version: '1.4',
      body: [
        {
          type: 'TextBlock',
          text: title,
          weight: 'bolder',
          size: 'large',
          color: color
        },
        {
          type: 'TextBlock',
          text: message,
          wrap: true
        },
        {
          type: 'TextBlock',
          text: new Date().toLocaleString(),
          isSubtle: true,
          size: 'small'
        }
      ]
    };

    if (actionUrl) {
      card.actions = [
        {
          type: 'Action.OpenUrl',
          title: 'View Details',
          url: actionUrl
        }
      ];
    }

    return card;
  }

  private createAutomationCard(
    ruleName: string,
    ticketNumber: string,
    success: boolean,
    details: string
  ): TeamsAdaptiveCard {
    return {
      $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
      type: 'AdaptiveCard',
      version: '1.4',
      body: [
        {
          type: 'TextBlock',
          text: `🤖 Automation ${success ? 'Succeeded' : 'Failed'}`,
          weight: 'bolder',
          size: 'large',
          color: success ? 'good' : 'attention'
        },
        {
          type: 'FactSet',
          facts: [
            { title: 'Rule', value: ruleName },
            { title: 'Ticket', value: ticketNumber },
            { title: 'Status', value: success ? 'Success' : 'Failed' },
            { title: 'Time', value: new Date().toLocaleString() }
          ]
        },
        {
          type: 'TextBlock',
          text: details,
          wrap: true,
          spacing: 'medium'
        }
      ],
      actions: [
        {
          type: 'Action.OpenUrl',
          title: 'View Ticket',
          url: `${process.env.FRONTEND_URL}/tickets?search=${ticketNumber}`
        }
      ]
    };
  }

  private createScriptCard(
    deviceName: string,
    scriptName: string,
    output: string,
    exitCode: number,
    ticketNumber?: string
  ): TeamsAdaptiveCard {
    const success = exitCode === 0;
    const outputPreview = output.length > 500 ? output.substring(0, 500) + '...' : output;

    const card: TeamsAdaptiveCard = {
      $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
      type: 'AdaptiveCard',
      version: '1.4',
      body: [
        {
          type: 'TextBlock',
          text: `💻 Script Execution ${success ? 'Completed' : 'Failed'}`,
          weight: 'bolder',
          size: 'large',
          color: success ? 'good' : 'attention'
        },
        {
          type: 'FactSet',
          facts: [
            { title: 'Device', value: deviceName },
            { title: 'Script', value: scriptName },
            { title: 'Exit Code', value: exitCode.toString() },
            ...(ticketNumber ? [{ title: 'Ticket', value: ticketNumber }] : [])
          ]
        },
        {
          type: 'TextBlock',
          text: 'Output:',
          weight: 'bolder',
          spacing: 'medium'
        },
        {
          type: 'TextBlock',
          text: outputPreview,
          wrap: true,
          fontType: 'monospace',
          size: 'small'
        }
      ]
    };

    if (ticketNumber) {
      card.actions = [
        {
          type: 'Action.OpenUrl',
          title: 'View Ticket',
          url: `${process.env.FRONTEND_URL}/tickets?search=${ticketNumber}`
        }
      ];
    }

    return card;
  }

  private getPriorityColor(priority: string): string {
    const colors: Record<string, string> = {
      low: 'default',
      medium: 'warning',
      high: 'accent',
      critical: 'attention'
    };
    return colors[priority.toLowerCase()] || 'default';
  }

  private getSeverityColor(severity: string): string {
    const colors: Record<string, string> = {
      info: 'default',
      warning: 'warning',
      error: 'attention',
      critical: 'attention'
    };
    return colors[severity.toLowerCase()] || 'default';
  }

  // Bot Framework Integration for Interactive Cards
  async setupBotFramework(): Promise<void> {
    // This would integrate with Azure Bot Framework for interactive cards
    // Allowing users to respond directly from Teams
    logger.info('Bot Framework integration not yet implemented');
  }

  /**
   * Send escalation notification when automated scripts fail
   * CRITICAL: This ensures technicians are alerted immediately
   */
  async sendEscalationNotification(ticket: Ticket, reason: string): Promise<void> {
    logger.warn(`Sending escalation notification for ticket ${ticket.ticketNumber}: ${reason}`);
    
    try {
      // Create urgent escalation card
      const escalationCard = {
        type: 'AdaptiveCard',
        $schema: 'https://adaptivecards.io/schemas/adaptive-card.json',
        version: '1.3',
        body: [
          {
            type: 'TextBlock',
            text: '🚨 ESCALATION REQUIRED - AUTOMATION FAILED',
            weight: 'Bolder',
            size: 'Large',
            color: 'Attention',
            wrap: true
          },
          {
            type: 'FactSet',
            facts: [
              { title: '⚠️ Ticket', value: `#${ticket.ticketNumber}` },
              { title: '🔴 Priority', value: 'CRITICAL' },
              { title: '🖥️ Device', value: ticket.deviceName || 'Unknown' },
              { title: '🏢 Client', value: ticket.clientName },
              { title: '❌ Failure', value: reason },
              { title: '⏰ Time', value: new Date().toLocaleTimeString() }
            ]
          },
          {
            type: 'TextBlock',
            text: '**IMMEDIATE ACTION REQUIRED**',
            weight: 'Bolder',
            color: 'Warning',
            size: 'Medium',
            wrap: true
          },
          {
            type: 'TextBlock',
            text: `Automated remediation has failed. Manual intervention is required immediately.`,
            wrap: true,
            color: 'Attention'
          },
          {
            type: 'Container',
            style: 'attention',
            items: [
              {
                type: 'TextBlock',
                text: `**Issue:** ${ticket.title}`,
                wrap: true
              },
              {
                type: 'TextBlock',
                text: `**Failed Action:** ${reason}`,
                wrap: true,
                color: 'Warning'
              }
            ]
          }
        ],
        actions: [
          {
            type: 'Action.OpenUrl',
            title: '🔧 Take Ownership',
            url: `${process.env.CONNECTWISE_URL || 'http://localhost:3000'}/tickets/${ticket.id}`,
            style: 'positive'
          },
          {
            type: 'Action.Submit',
            title: '📝 Add Note',
            data: {
              action: 'add_note',
              ticketId: ticket.ticketNumber
            }
          },
          {
            type: 'Action.Submit',
            title: '🚀 Run Different Script',
            data: {
              action: 'run_script',
              ticketId: ticket.ticketNumber
            }
          },
          {
            type: 'Action.OpenUrl',
            title: '📞 Call On-Call',
            url: 'tel:+1-555-ON-CALL'
          }
        ],
        msteams: {
          width: 'Full',
          entities: [
            {
              type: 'mention',
              text: '<at>On-Call Team</at>',
              mentioned: {
                id: 'on-call',
                name: 'On-Call Team'
              }
            }
          ]
        }
      };

      // Send to Teams with high priority
      if (this.webhookUrl) {
        const message = {
          '@type': 'MessageCard',
          '@context': 'https://schema.org/extensions',
          themeColor: 'FF0000', // Red for urgent
          summary: `🚨 ESCALATION: Ticket ${ticket.ticketNumber} - Automation Failed`,
          sections: [{
            activityTitle: '**URGENT: Manual Intervention Required**',
            activitySubtitle: `Ticket #${ticket.ticketNumber}`,
            facts: [
              { name: 'Status:', value: '🔴 CRITICAL ESCALATION' },
              { name: 'Device:', value: ticket.deviceName || 'Unknown' },
              { name: 'Client:', value: ticket.clientName },
              { name: 'Failure:', value: reason }
            ],
            text: `**Automated remediation has failed and requires immediate manual intervention.**\n\n**Next Steps:**\n1. Click 'Take Action' below\n2. Review the failure reason\n3. Manually resolve the issue\n4. Update ticket with resolution`,
            potentialAction: [
              {
                '@type': 'HttpPOST',
                name: 'Take Action',
                target: `${process.env.API_URL || 'http://localhost:3001'}/api/webhooks/teams/action`,
                body: JSON.stringify({
                  action: 'take_ownership',
                  ticketId: ticket.ticketNumber
                }),
                bodyContentType: 'application/json'
              }
            ]
          }]
        };

        await this.client.post(this.webhookUrl, message);
        logger.info(`Escalation notification sent to Teams for ticket ${ticket.ticketNumber}`);
      }

      // Also send email alert if configured
      const { EmailService } = await import('../EmailService');
      const emailService = EmailService.getInstance();
      
      await emailService.sendSystemAlert(
        `🚨 CRITICAL: Automation Failed - Ticket ${ticket.ticketNumber}`,
        `URGENT: Manual Intervention Required\n\nTicket: #${ticket.ticketNumber}\nClient: ${ticket.clientName}\nDevice: ${ticket.deviceName || 'Unknown'}\nIssue: ${ticket.title}\nFailure Reason: ${reason}\n\nAutomated remediation has failed. Please respond immediately.\n\nView Ticket: ${process.env.CONNECTWISE_URL}/tickets/${ticket.externalId}`,
        'critical',
        [process.env.ESCALATION_EMAIL || 'it-oncall@company.com']
      );

      // Log escalation event
      const { AuditLog, AuditAction } = await import('../../entities/AuditLog');
      const auditLogRepo = AppDataSource.getRepository(AuditLog);
      await auditLogRepo.save({
        userId: 'system',
        action: AuditAction.UPDATE,
        entityType: 'ticket',
        entityId: ticket.id,
        description: `Ticket escalated: ${reason}`,
        metadata: {
          reason,
          priority: 'CRITICAL',
          notificationsSent: ['teams', 'email'],
        ipAddress: 'system'
        }
      });
      
    } catch (error) {
      logger.error('Failed to send escalation notification:', error);
      // Don't throw - we don't want to block the escalation process
    }
  }

  // Handle incoming commands from Teams
  async handleTeamsCommand(command: string, parameters: any): Promise<string> {
    try {
      // Parse command - support both slash and @ mentions
      const cmd = command.toLowerCase().replace('/', '').replace('@rmmbot', '').trim();
      
      switch (cmd) {
        case 'ticket':
        case 'status':
          return await this.handleTicketCommand(parameters);
        case 'close':
          return await this.handleCloseCommand(parameters);
        case 'note':
        case 'add-note':
          return await this.handleNoteCommand(parameters);
        case 'assign':
          return await this.handleAssignCommand(parameters);
        case 'escalate':
          return await this.handleEscalateCommand(parameters);
        case 'run':
        case 'script':
          return await this.handleScriptCommand(parameters);
        case 'help':
          return this.getHelpMessage();
        default:
          return `Unknown command: ${command}\n\n${this.getHelpMessage()}`;
      }
    } catch (error) {
      logger.error('Error handling Teams command:', error);
      return `❌ Error processing command: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  private async handleTicketCommand(params: any): Promise<string> {
    const ticketNumber = params.ticketNumber || params.parameters;
    if (!ticketNumber) {
      return '❌ Please provide a ticket number: /ticket 12345';
    }

    const ticketRepo = AppDataSource.getRepository(Ticket);
    const ticket = await ticketRepo.findOne({ where: { ticketNumber } });
    
    if (!ticket) {
      return `❌ Ticket ${ticketNumber} not found`;
    }

    return `📋 **Ticket #${ticket.ticketNumber}**
**Status:** ${ticket.status}
**Priority:** ${ticket.priority}
**Client:** ${ticket.clientName}
**Device:** ${ticket.deviceName || 'N/A'}
**Created:** ${ticket.createdAt.toLocaleString()}
**Title:** ${ticket.title}
**Assigned:** ${ticket.assignedTo || 'Unassigned'}`;
  }

  private async handleCloseCommand(params: any): Promise<string> {
    // Parse: /close 12345 "Fixed the issue"
    const parts = params.parameters?.split(' ') || [];
    const ticketNumber = parts[0];
    const resolution = parts.slice(1).join(' ').replace(/"/g, '') || 'Resolved via Teams';

    if (!ticketNumber) {
      return '❌ Usage: /close <ticket#> "<resolution>"\nExample: /close 12345 "Cleared disk space"';
    }

    const result = await this.handleCommand({
      action: 'close_ticket',
      entityId: ticketNumber,
      entityType: 'ticket',
      userId: params.userId || 'Teams User',
      additionalData: { resolution }
    });

    return result.success 
      ? `✅ Ticket #${ticketNumber} closed successfully\n📝 Resolution: ${resolution}`
      : `❌ ${result.message}`;
  }

  private async handleNoteCommand(params: any): Promise<string> {
    // Parse: /note 12345 "This is my note"
    const parts = params.parameters?.split(' ') || [];
    const ticketNumber = parts[0];
    const noteText = parts.slice(1).join(' ').replace(/"/g, '');

    if (!ticketNumber || !noteText) {
      return '❌ Usage: /note <ticket#> "<note text>"\nExample: /note 12345 "Checked server, disk at 70%"';
    }

    const result = await this.handleCommand({
      action: 'add_note',
      entityId: ticketNumber,
      entityType: 'ticket',
      userId: params.userId || 'Teams User',
      additionalData: { note: noteText }
    });

    return result.success 
      ? `✅ Note added to ticket #${ticketNumber}\n📝 "${noteText}"`
      : `❌ ${result.message}`;
  }

  private async handleAssignCommand(params: any): Promise<string> {
    // Parse: /assign 12345 john.smith
    const parts = params.parameters?.split(' ') || [];
    const ticketNumber = parts[0];
    const assignTo = parts[1];

    if (!ticketNumber || !assignTo) {
      return '❌ Usage: /assign <ticket#> <technician>\nExample: /assign 12345 john.smith';
    }

    const result = await this.handleCommand({
      action: 'assign_ticket',
      entityId: ticketNumber,
      entityType: 'ticket',
      userId: params.userId || 'Teams User',
      additionalData: { assignTo }
    });

    return result.success 
      ? `✅ Ticket #${ticketNumber} assigned to ${assignTo}`
      : `❌ ${result.message}`;
  }

  private async handleEscalateCommand(params: any): Promise<string> {
    // Parse: /escalate 12345 "Needs database expertise"
    const parts = params.parameters?.split(' ') || [];
    const ticketNumber = parts[0];
    const reason = parts.slice(1).join(' ').replace(/"/g, '') || 'Requires senior technician';

    if (!ticketNumber) {
      return '❌ Usage: /escalate <ticket#> "<reason>"\nExample: /escalate 12345 "Needs senior tech"';
    }

    const result = await this.handleCommand({
      action: 'escalate_ticket',
      entityId: ticketNumber,
      entityType: 'ticket',
      userId: params.userId || 'Teams User',
      additionalData: { reason }
    });

    return result.success 
      ? `⚠️ Ticket #${ticketNumber} escalated\n📝 Reason: ${reason}`
      : `❌ ${result.message}`;
  }

  private async handleScriptCommand(params: any): Promise<string> {
    // Parse: /run 12345 cleanup-disk
    const parts = params.parameters?.split(' ') || [];
    const ticketNumber = parts[0];
    const scriptName = parts[1];

    if (!ticketNumber || !scriptName) {
      return `❌ Usage: /run <ticket#> <script-name>
Example: /run 12345 cleanup-disk

Available scripts:
• cleanup-disk - Clear temp files and logs
• restart-iis - Restart IIS service
• restart-service - Restart any service
• clear-cache - Clear system caches
• install-updates - Install Windows updates`;
    }

    const result = await this.handleCommand({
      action: 'run_script',
      entityId: ticketNumber,
      entityType: 'ticket',
      userId: params.userId || 'Teams User',
      additionalData: { 
        scriptName,
        autoClose: true,
        escalateOnFailure: true
      }
    });

    return result.success 
      ? `🚀 Script '${scriptName}' executing on ticket #${ticketNumber}\n${result.message}`
      : `❌ ${result.message}`;
  }

  private getHelpMessage(): string {
    return `**🤖 RMM Bot Commands**

**Ticket Management:**
• /ticket <number> - View ticket status
• /close <number> "<resolution>" - Close a ticket
• /note <number> "<text>" - Add note to ticket
• /escalate <number> "<reason>" - Escalate ticket

**Automation:**
• /run <ticket> <script> - Execute remediation script
• /assign <ticket> <tech> - Assign to technician

**Examples:**
• /ticket 12345
• /close 12345 "Cleared disk space"
• /note 12345 "Waiting for reboot"
• /run 12345 cleanup-disk
• /escalate 12345 "Needs database expertise"

**Tips:**
• Use ticket numbers from ConnectWise
• All actions sync back to ConnectWise
• Scripts auto-close tickets if successful`;
  }
}

