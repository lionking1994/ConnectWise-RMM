import { Repository, In, Not } from 'typeorm';
import { AppDataSource } from '../database/dataSource';
import { BoardConfiguration, BoardSyncHistory, BoardFieldMapping, BoardSettings } from '../entities/BoardConfiguration';
import { User } from '../entities/User';
import { Ticket } from '../entities/Ticket';
import { ConnectWiseService } from './connectwise/ConnectWiseService';
import { NotificationService } from './NotificationService';
import { logger } from '../utils/logger';

export interface ConnectWiseBoard {
  id: string;
  name: string;
  locationId?: number;
  businessUnitId?: number;
  projectFlag?: boolean;
  inactiveFlag?: boolean;
  signOffTemplateId?: number;
  sendToMemberFlag?: boolean;
  contactTemplateId?: number;
  autoCloseStatus?: string;
  autoAssignNewTicketsFlag?: boolean;
  autoAssignNewECTicketsFlag?: boolean;
  autoAssignNewPortalTicketsFlag?: boolean;
}

export interface BoardSyncResult {
  boardId: string;
  boardName: string;
  ticketsCreated: number;
  ticketsUpdated: number;
  ticketsClosed: number;
  errors: Array<{ ticketId: string; error: string }>;
  duration: number;
}

export class BoardManagementService {
  private boardConfigRepository: Repository<BoardConfiguration>;
  private syncHistoryRepository: Repository<BoardSyncHistory>;
  private fieldMappingRepository: Repository<BoardFieldMapping>;
  private ticketRepository: Repository<Ticket>;
  private connectWiseService: ConnectWiseService;
  private notificationService: NotificationService;
  private syncIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    this.boardConfigRepository = AppDataSource.getRepository(BoardConfiguration);
    this.syncHistoryRepository = AppDataSource.getRepository(BoardSyncHistory);
    this.fieldMappingRepository = AppDataSource.getRepository(BoardFieldMapping);
    this.ticketRepository = AppDataSource.getRepository(Ticket);
    this.connectWiseService = ConnectWiseService.getInstance();
    this.notificationService = NotificationService.getInstance();
  }

  // Fetch available boards from ConnectWise
  async fetchAvailableBoards(): Promise<ConnectWiseBoard[]> {
    try {
      const boards = await this.connectWiseService.getBoards();
      return boards.filter(board => !board.inactiveFlag);
    } catch (error) {
      logger.error('Error fetching ConnectWise boards:', error);
      throw error;
    }
  }

  // Configure a new board for monitoring
  async configureBoard(
    boardId: string,
    boardName: string,
    settings: BoardSettings,
    user: User,
    isPrimary: boolean = false
  ): Promise<BoardConfiguration> {
    try {
      // Check if board already exists
      const existing = await this.boardConfigRepository.findOne({ where: { boardId } });
      if (existing) {
        throw new Error(`Board ${boardName} is already configured`);
      }

      // If setting as primary, unset other primary boards
      if (isPrimary) {
        await this.boardConfigRepository.update(
          { isPrimary: true },
          { isPrimary: false }
        );
      }

      const boardConfig = this.boardConfigRepository.create({
        boardId,
        boardName,
        isPrimary,
        isActive: true,
        settings,
        filters: {},
        syncStatus: {
          isRunning: false,
        },
        automationSettings: {
          enabled: true,
          rules: [],
        },
        displaySettings: {
          color: isPrimary ? '#1976d2' : '#757575',
          showInQuickAccess: isPrimary,
          dashboardPosition: isPrimary ? 0 : 999,
        },
        createdBy: user,
        updatedBy: user,
      });

      const saved = await this.boardConfigRepository.save(boardConfig);
      
      // Start sync interval if configured
      if (settings.syncInterval > 0) {
        this.startSyncInterval(saved);
      }

      logger.info(`Board ${boardName} configured successfully`);
      
      // Send notification
      await this.notificationService.send({
        channels: ['email'],
        subject: 'New Board Configured',
        message: `Board "${boardName}" has been added to monitoring`,
        priority: 'low',
        metadata: { boardId, boardName, isPrimary },
      });

      return saved;
    } catch (error) {
      logger.error('Error configuring board:', error);
      throw error;
    }
  }

  // Update board configuration
  async updateBoardConfig(
    boardId: string,
    updates: Partial<BoardConfiguration>,
    user: User
  ): Promise<BoardConfiguration> {
    try {
      const boardConfig = await this.boardConfigRepository.findOne({ where: { boardId } });
      if (!boardConfig) {
        throw new Error('Board configuration not found');
      }

      // If changing primary status
      if (updates.isPrimary && !boardConfig.isPrimary) {
        await this.boardConfigRepository.update(
          { isPrimary: true },
          { isPrimary: false }
        );
      }

      Object.assign(boardConfig, {
        ...updates,
        updatedBy: user,
      });

      const saved = await this.boardConfigRepository.save(boardConfig);

      // Restart sync interval if interval changed
      if (updates.settings?.syncInterval !== undefined) {
        this.stopSyncInterval(boardId);
        if (updates.settings.syncInterval > 0) {
          this.startSyncInterval(saved);
        }
      }

      logger.info(`Board ${boardConfig.boardName} updated`);
      return saved;
    } catch (error) {
      logger.error('Error updating board config:', error);
      throw error;
    }
  }

  // Get all configured boards
  async getConfiguredBoards(activeOnly: boolean = true): Promise<BoardConfiguration[]> {
    const query = this.boardConfigRepository.createQueryBuilder('board')
      .leftJoinAndSelect('board.createdBy', 'createdBy')
      .leftJoinAndSelect('board.updatedBy', 'updatedBy');

    if (activeOnly) {
      query.andWhere('board.isActive = :isActive', { isActive: true });
    }

    query.orderBy('board.isPrimary', 'DESC')
      .addOrderBy('board.displaySettings->dashboardPosition', 'ASC')
      .addOrderBy('board.boardName', 'ASC');

    return await query.getMany();
  }

  // Get primary board (NOC)
  async getPrimaryBoard(): Promise<BoardConfiguration | null> {
    return await this.boardConfigRepository.findOne({
      where: { isPrimary: true, isActive: true },
    });
  }

  // Sync tickets from a specific board
  async syncBoard(boardId: string, syncType: 'manual' | 'scheduled' | 'webhook' = 'manual'): Promise<BoardSyncResult> {
    const startTime = new Date();
    const boardConfig = await this.boardConfigRepository.findOne({ where: { boardId } });
    
    if (!boardConfig) {
      throw new Error('Board configuration not found');
    }

    if (boardConfig.syncStatus?.isRunning) {
      throw new Error('Sync already in progress for this board');
    }

    // Create sync history entry
    const syncHistory = this.syncHistoryRepository.create({
      boardConfig,
      syncType,
      startTime,
      status: 'running',
      ticketsCreated: 0,
      ticketsUpdated: 0,
      ticketsClosed: 0,
      errors: 0,
      errorDetails: [],
    });

    await this.syncHistoryRepository.save(syncHistory);

    // Update sync status
    boardConfig.syncStatus = {
      isRunning: true,
      consecutiveErrors: 0,
    };
    await this.boardConfigRepository.save(boardConfig);

    const result: BoardSyncResult = {
      boardId,
      boardName: boardConfig.boardName,
      ticketsCreated: 0,
      ticketsUpdated: 0,
      ticketsClosed: 0,
      errors: [],
      duration: 0,
    };

    try {
      // Fetch tickets from ConnectWise
      const tickets = await this.connectWiseService.getTickets({ 
        conditions: `board/id=${boardId}`,
        ...boardConfig.filters 
      });
      
      for (const cwTicket of tickets) {
        try {
          // Check if ticket exists locally
          let localTicket = await this.ticketRepository.findOne({
            where: { externalId: String(cwTicket.id) },
          });

          if (!localTicket) {
            // Create new ticket
            localTicket = this.ticketRepository.create({
              id: undefined as any,
              externalId: String(cwTicket.id),
              ticketNumber: cwTicket.id.toString(),
              title: cwTicket.summary,
              description: (cwTicket as any).initialDescription || cwTicket.summary || '',
              status: this.mapConnectWiseStatus(cwTicket.status?.name) as any,
              priority: (cwTicket.priority?.name || 'Medium') as any,
              source: 'connectwise' as any,
              boardId,
              boardName: boardConfig.boardName,
              clientName: cwTicket.company?.name || 'Unknown',
              deviceId: (cwTicket as any).deviceId,
              deviceName: (cwTicket as any).deviceName,
              assignedTo: (cwTicket.owner as any)?.identifier || cwTicket.owner?.name,
              metadata: {
                connectwiseData: cwTicket,
                boardSettings: boardConfig.settings,
              },
            });

            await this.ticketRepository.save(localTicket);
            result.ticketsCreated++;

            // Send notification for new ticket if configured
            if (boardConfig.settings.notificationSettings?.onNewTicket) {
              await this.sendNewTicketNotification(localTicket, boardConfig);
            }

            // Apply automation rules if configured
            if (boardConfig.automationSettings?.enabled) {
              await this.applyBoardAutomationRules(localTicket, boardConfig);
            }
          } else {
            // Update existing ticket
            const statusChanged = localTicket.status !== this.mapConnectWiseStatus(cwTicket.status?.name);
            const priorityChanged = localTicket.priority !== cwTicket.priority?.name;

            localTicket.title = cwTicket.summary;
            localTicket.description = (cwTicket as any).initialDescription || localTicket.description;
            localTicket.status = this.mapConnectWiseStatus(cwTicket.status?.name) as any;
            localTicket.priority = (cwTicket.priority?.name || localTicket.priority) as any;
            localTicket.assignedTo = (cwTicket.owner as any)?.identifier || cwTicket.owner?.name;
            localTicket.metadata = {
              ...localTicket.metadata,
              connectwiseData: cwTicket,
              customFields: {
                ...localTicket.metadata?.customFields,
                lastSyncedAt: new Date(),
              }
            };

            await this.ticketRepository.save(localTicket);

            if (localTicket.status === 'closed') {
              result.ticketsClosed++;
            } else {
              result.ticketsUpdated++;
            }

            // Send notifications for changes if configured
            if (statusChanged && boardConfig.settings.notificationSettings?.onStatusChange) {
              await this.sendStatusChangeNotification(localTicket, boardConfig);
            }
            if (priorityChanged && boardConfig.settings.notificationSettings?.onPriorityChange) {
              await this.sendPriorityChangeNotification(localTicket, boardConfig);
            }
          }

          // Sync custom fields if configured
          if (boardConfig.settings.customFieldMappings) {
            await this.syncCustomFields(localTicket, cwTicket, boardConfig);
          }

        } catch (ticketError) {
          logger.error(`Error syncing ticket ${cwTicket.id}:`, ticketError);
          result.errors.push({
            ticketId: cwTicket.id.toString(),
            error: ticketError.message,
          });
          syncHistory.errors++;
          syncHistory.errorDetails?.push({
            ticketId: cwTicket.id.toString(),
            error: ticketError.message,
            timestamp: new Date(),
          });
        }
      }

      // Update board statistics
      boardConfig.lastSyncAt = new Date();
      boardConfig.totalTicketsSynced += result.ticketsCreated + result.ticketsUpdated;
      boardConfig.activeTicketsCount = await this.ticketRepository.count({
        where: {
          boardId,
          status: Not(In(['closed', 'resolved'])),
        },
      });
      boardConfig.syncStatus = {
        isRunning: false,
        consecutiveErrors: 0,
      };

      await this.boardConfigRepository.save(boardConfig);

      // Complete sync history
      syncHistory.endTime = new Date();
      syncHistory.ticketsCreated = result.ticketsCreated;
      syncHistory.ticketsUpdated = result.ticketsUpdated;
      syncHistory.ticketsClosed = result.ticketsClosed;
      syncHistory.status = result.errors.length > 0 ? 'partial' : 'completed';
      await this.syncHistoryRepository.save(syncHistory);

      result.duration = syncHistory.endTime.getTime() - startTime.getTime();

      logger.info(`Board sync completed for ${boardConfig.boardName}: ${result.ticketsCreated} created, ${result.ticketsUpdated} updated, ${result.errors.length} errors`);

      return result;

    } catch (error) {
      logger.error(`Board sync failed for ${boardConfig.boardName}:`, error);
      
      // Update sync status
      boardConfig.syncStatus = {
        isRunning: false,
        lastError: error.message,
        lastErrorAt: new Date(),
        consecutiveErrors: (boardConfig.syncStatus?.consecutiveErrors || 0) + 1,
      };
      await this.boardConfigRepository.save(boardConfig);

      // Update sync history
      syncHistory.endTime = new Date();
      syncHistory.status = 'failed';
      syncHistory.notes = error.message;
      await this.syncHistoryRepository.save(syncHistory);

      throw error;
    }
  }

  // Sync all active boards
  async syncAllBoards(): Promise<BoardSyncResult[]> {
    const boards = await this.getConfiguredBoards(true);
    const results: BoardSyncResult[] = [];

    for (const board of boards) {
      try {
        const result = await this.syncBoard(board.boardId, 'scheduled');
        results.push(result);
      } catch (error) {
        logger.error(`Failed to sync board ${board.boardName}:`, error);
        results.push({
          boardId: board.boardId,
          boardName: board.boardName,
          ticketsCreated: 0,
          ticketsUpdated: 0,
          ticketsClosed: 0,
          errors: [{ ticketId: 'N/A', error: error.message }],
          duration: 0,
        });
      }
    }

    return results;
  }

  // Configure custom field mapping
  async configureFieldMapping(
    boardId: string,
    mappings: Array<{
      connectwiseFieldName: string;
      connectwiseFieldId: string;
      localFieldName: string;
      dataType: string;
      syncDirection: 'inbound' | 'outbound' | 'bidirectional';
    }>
  ): Promise<BoardFieldMapping[]> {
    const boardConfig = await this.boardConfigRepository.findOne({ where: { boardId } });
    if (!boardConfig) {
      throw new Error('Board configuration not found');
    }

    const savedMappings: BoardFieldMapping[] = [];

    for (const mapping of mappings) {
      const fieldMapping = this.fieldMappingRepository.create({
        boardConfig,
        ...mapping,
        dataType: mapping.dataType as any,
        syncEnabled: true,
      } as any);

      const saved = await this.fieldMappingRepository.save(fieldMapping);
      savedMappings.push(saved as BoardFieldMapping);
    }

    logger.info(`Configured ${savedMappings.length} field mappings for board ${boardConfig.boardName}`);
    return savedMappings;
  }

  // Start automatic sync interval for a board
  private startSyncInterval(boardConfig: BoardConfiguration): void {
    if (boardConfig.settings.syncInterval <= 0) return;

    const intervalMs = boardConfig.settings.syncInterval * 60 * 1000;
    
    const interval = setInterval(async () => {
      try {
        await this.syncBoard(boardConfig.boardId, 'scheduled');
      } catch (error) {
        logger.error(`Scheduled sync failed for board ${boardConfig.boardName}:`, error);
      }
    }, intervalMs);

    this.syncIntervals.set(boardConfig.boardId, interval);
    logger.info(`Started sync interval for board ${boardConfig.boardName} (every ${boardConfig.settings.syncInterval} minutes)`);
  }

  // Stop automatic sync interval for a board
  private stopSyncInterval(boardId: string): void {
    const interval = this.syncIntervals.get(boardId);
    if (interval) {
      clearInterval(interval);
      this.syncIntervals.delete(boardId);
      logger.info(`Stopped sync interval for board ${boardId}`);
    }
  }

  // Map ConnectWise status to local status
  private mapConnectWiseStatus(cwStatus: string): string {
    const statusMap: Record<string, string> = {
      'New': 'open',
      'Open': 'open',
      'In Progress': 'in_progress',
      'On Hold': 'on_hold',
      'Waiting': 'waiting',
      'Closed': 'closed',
      'Resolved': 'resolved',
      'Cancelled': 'cancelled',
    };

    return statusMap[cwStatus] || cwStatus.toLowerCase().replace(/\s+/g, '_');
  }

  // Apply board-specific automation rules
  private async applyBoardAutomationRules(
    ticket: Ticket,
    boardConfig: BoardConfiguration
  ): Promise<void> {
    if (!boardConfig.automationSettings?.enabled) return;

    for (const rule of boardConfig.automationSettings.rules) {
      try {
        // Evaluate condition (simplified)
        if (this.evaluateRuleCondition(rule.condition, ticket)) {
          await this.executeRuleAction(rule.action, rule.parameters, ticket);
        }
      } catch (error) {
        logger.error(`Failed to apply automation rule for ticket ${ticket.ticketNumber}:`, error);
      }
    }
  }

  // Evaluate rule condition
  private evaluateRuleCondition(condition: string, ticket: Ticket): boolean {
    // Simplified condition evaluation
    // In production, use a proper expression evaluator
    try {
      const context = {
        priority: ticket.priority,
        status: ticket.status,
        clientName: ticket.clientName,
      };

      // Very basic evaluation - in production use a sandbox
      return eval(condition);
    } catch {
      return false;
    }
  }

  // Execute rule action
  private async executeRuleAction(
    action: string,
    parameters: Record<string, any>,
    ticket: Ticket
  ): Promise<void> {
    switch (action) {
      case 'escalate':
        // Trigger escalation
        const { EscalationService } = await import('./EscalationService');
        const escalationService = new EscalationService();
        await escalationService.escalateTicket({
          ticketId: parseInt(ticket.id),
          triggerReason: 'Board automation rule',
          severity: ticket.priority,
        });
        break;

      case 'auto-assign':
        // Auto-assign ticket
        ticket.assignedTo = parameters.assignTo || 'auto-assigned';
        await this.ticketRepository.save(ticket);
        break;

      case 'run-script':
        // Execute script
        const { ScriptService } = await import('./ScriptService');
        const scriptService = new ScriptService();
        await scriptService.executeScript(
          parameters.scriptId,
          ticket.deviceId || '',
          parameters.scriptParameters || {},
          parseInt(ticket.id)
        );
        break;

      default:
        logger.warn(`Unknown rule action: ${action}`);
    }
  }

  // Sync custom fields
  private async syncCustomFields(
    localTicket: Ticket,
    cwTicket: any,
    boardConfig: BoardConfiguration
  ): Promise<void> {
    const fieldMappings = await this.fieldMappingRepository.find({
      where: {
        boardConfig: { id: boardConfig.id },
        syncEnabled: true,
      },
    });

    for (const mapping of fieldMappings) {
      try {
        if (mapping.syncDirection === 'inbound' || mapping.syncDirection === 'bidirectional') {
          const cwValue = cwTicket.customFields?.[mapping.connectwiseFieldId];
          if (cwValue !== undefined) {
            // Apply transformation if configured
            const transformedValue = this.transformFieldValue(cwValue, mapping.transformRules?.inbound);
            
            // Store in ticket metadata
            if (!localTicket.metadata) {
              localTicket.metadata = {};
            }
            if (!localTicket.metadata.customFields) {
              localTicket.metadata.customFields = {};
            }
            localTicket.metadata.customFields[mapping.localFieldName] = transformedValue;
          }
        }
      } catch (error) {
        logger.error(`Failed to sync custom field ${mapping.connectwiseFieldName}:`, error);
      }
    }

    await this.ticketRepository.save(localTicket);
  }

  // Transform field value based on rules
  private transformFieldValue(value: any, transformRule?: any): any {
    if (!transformRule) return value;

    switch (transformRule.type) {
      case 'map':
        return transformRule.rule[value] || value;
      
      case 'regex':
        const regex = new RegExp(transformRule.rule.pattern);
        const match = String(value).match(regex);
        return match ? match[1] || match[0] : value;
      
      case 'function':
        // In production, use a sandboxed function evaluator
        try {
          return eval(transformRule.rule)(value);
        } catch {
          return value;
        }
      
      default:
        return value;
    }
  }

  // Send notifications
  private async sendNewTicketNotification(ticket: Ticket, boardConfig: BoardConfiguration): Promise<void> {
    await this.notificationService.send({
      channels: ['email'],
      subject: `New Ticket on ${boardConfig.boardName}`,
      message: `Ticket #${ticket.ticketNumber}: ${ticket.title}`,
      priority: ticket.priority === 'critical' ? 'high' : 'medium',
      metadata: {
        ticketId: parseInt(ticket.id),
        boardId: boardConfig.boardId,
        boardName: boardConfig.boardName,
        priority: ticket.priority,
      },
    });
  }

  private async sendStatusChangeNotification(ticket: Ticket, boardConfig: BoardConfiguration): Promise<void> {
    await this.notificationService.send({
      channels: ['email'],
      subject: `Ticket Status Changed`,
      message: `Ticket #${ticket.ticketNumber} status changed to ${ticket.status}`,
      priority: 'low',
      metadata: {
        ticketId: parseInt(ticket.id),
        boardName: boardConfig.boardName,
        newStatus: ticket.status,
      },
    });
  }

  private async sendPriorityChangeNotification(ticket: Ticket, boardConfig: BoardConfiguration): Promise<void> {
    await this.notificationService.send({
      channels: ['email'],
      subject: `Ticket Priority Changed`,
      message: `Ticket #${ticket.ticketNumber} priority changed to ${ticket.priority}`,
      priority: ticket.priority === 'critical' ? 'high' : 'medium',
      metadata: {
        ticketId: parseInt(ticket.id),
        boardName: boardConfig.boardName,
        newPriority: ticket.priority,
      },
    });
  }

  // Get sync history for a board
  async getSyncHistory(boardId: string, limit: number = 50): Promise<BoardSyncHistory[]> {
    return await this.syncHistoryRepository.find({
      where: { boardConfig: { boardId } },
      order: { createdAt: 'DESC' },
      take: limit,
      relations: ['boardConfig'],
    });
  }

  // Delete board configuration
  async deleteBoard(boardId: string): Promise<void> {
    const boardConfig = await this.boardConfigRepository.findOne({ where: { boardId } });
    if (!boardConfig) {
      throw new Error('Board configuration not found');
    }

    // Stop sync interval
    this.stopSyncInterval(boardId);

    // Delete field mappings
    await this.fieldMappingRepository.delete({ boardConfig: { id: boardConfig.id } });

    // Delete sync history
    await this.syncHistoryRepository.delete({ boardConfig: { id: boardConfig.id } });

    // Delete board config
    await this.boardConfigRepository.remove(boardConfig);

    logger.info(`Board ${boardConfig.boardName} deleted`);
  }

  // Initialize board sync intervals on service start
  async initializeSyncIntervals(): Promise<void> {
    const activeBoards = await this.getConfiguredBoards(true);
    
    for (const board of activeBoards) {
      if (board.settings.syncInterval > 0) {
        this.startSyncInterval(board);
      }
    }

    logger.info(`Initialized sync intervals for ${activeBoards.length} boards`);
  }
}

