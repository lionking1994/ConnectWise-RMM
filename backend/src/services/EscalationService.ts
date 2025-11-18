import { Repository, In, LessThan, MoreThan } from 'typeorm';
import { AppDataSource } from '../database/dataSource';
import {
  EscalationChain,
  EscalationExecution,
  TechnicianProfile,
  EscalationAssignmentType,
  EscalationTrigger,
  EscalationLevel,
} from '../entities/EscalationChain';
import { User } from '../entities/User';
import { Ticket } from '../entities/Ticket';
import { NotificationService } from './NotificationService';
import { TeamsService } from './teams/TeamsService';
import { ConnectWiseService } from './connectwise/ConnectWiseService';
import { logger } from '../utils/logger';

export interface EscalationContext {
  ticketId: number;
  alertId?: string;
  currentAssigneeId?: number;
  failureCount?: number;
  elapsedMinutes?: number;
  severity?: string;
  priority?: string;
  alertType?: string;
  clientName?: string;
  deviceInfo?: any;
  triggerReason: string;
}

export interface EscalationResult {
  success: boolean;
  newAssigneeId?: number;
  newAssigneeName?: string;
  level: number;
  reason: string;
  notifications?: string[];
}

export class EscalationService {
  private chainRepository: Repository<EscalationChain>;
  private executionRepository: Repository<EscalationExecution>;
  private profileRepository: Repository<TechnicianProfile>;
  private userRepository: Repository<User>;
  private notificationService: NotificationService;
  private teamsService: TeamsService;
  private connectWiseService: ConnectWiseService;

  constructor() {
    this.chainRepository = AppDataSource.getRepository(EscalationChain);
    this.executionRepository = AppDataSource.getRepository(EscalationExecution);
    this.profileRepository = AppDataSource.getRepository(TechnicianProfile);
    this.userRepository = AppDataSource.getRepository(User);
    this.notificationService = NotificationService.getInstance();
    this.teamsService = TeamsService.getInstance();
    this.connectWiseService = ConnectWiseService.getInstance();
  }

  // Process escalation for a ticket
  async escalateTicket(context: EscalationContext): Promise<EscalationResult> {
    try {
      logger.info(`Processing escalation for ticket ${context.ticketId}`);

      // Find applicable escalation chain
      const chain = await this.findApplicableChain(context);
      if (!chain) {
        logger.warn(`No applicable escalation chain found for ticket ${context.ticketId}`);
        return {
          success: false,
          level: 0,
          reason: 'No applicable escalation chain found',
        };
      }

      // Check if there's an existing execution
      let execution = await this.executionRepository.findOne({
        where: {
          ticketId: context.ticketId,
          status: 'active',
        },
        relations: ['chain'],
      });

      if (!execution) {
        // Create new execution
        execution = this.executionRepository.create({
          chain,
          ticketId: context.ticketId,
          alertId: context.alertId,
          currentLevel: 0,
          levelHistory: [],
          status: 'active',
          metadata: {
            triggerReason: context.triggerReason,
            originalAssignee: context.currentAssigneeId,
            priority: context.priority,
            severity: context.severity,
            clientName: context.clientName,
            deviceInfo: context.deviceInfo,
          },
          startedAt: new Date(),
        });
        await this.executionRepository.save(execution);
      }

      // Determine next level
      const nextLevelIndex = execution.currentLevel;
      if (nextLevelIndex >= chain.levels.length) {
        logger.warn(`Escalation chain exhausted for ticket ${context.ticketId}`);
        execution.status = 'failed';
        execution.completedAt = new Date();
        await this.executionRepository.save(execution);

        return {
          success: false,
          level: nextLevelIndex,
          reason: 'Escalation chain exhausted',
        };
      }

      const level = chain.levels[nextLevelIndex];

      // Check if escalation trigger is met
      if (!this.isEscalationTriggered(level, context)) {
        return {
          success: false,
          level: nextLevelIndex,
          reason: 'Escalation trigger not met',
        };
      }

      // Find next assignee based on assignment type
      const assignee = await this.findNextAssignee(level, chain, context);
      if (!assignee) {
        logger.warn(`No available assignee found for level ${nextLevelIndex}`);
        
        if (level.skipIfUnavailable && nextLevelIndex < chain.levels.length - 1) {
          // Skip to next level
          execution.currentLevel = nextLevelIndex + 1;
          await this.executionRepository.save(execution);
          return this.escalateTicket(context);
        }

        return {
          success: false,
          level: nextLevelIndex,
          reason: 'No available assignee',
        };
      }

      // Update ticket assignment
      await this.assignTicket(context.ticketId, assignee.id);

      // Record in execution history
      execution.levelHistory.push({
        level: nextLevelIndex,
        assignedTo: assignee.id,
        assignedAt: new Date(),
        outcome: 'escalated',
      });
      execution.currentLevel = nextLevelIndex + 1;
      await this.executionRepository.save(execution);

      // Update chain statistics
      chain.totalEscalations++;
      chain.lastEscalatedAt = new Date();
      if (!chain.escalationHistory) {
        chain.escalationHistory = [];
      }
      chain.escalationHistory.push({
        ticketId: context.ticketId,
        alertId: context.alertId,
        fromUser: context.currentAssigneeId,
        toUser: assignee.id,
        level: nextLevelIndex,
        reason: context.triggerReason,
        timestamp: new Date(),
        success: true,
      });
      await this.chainRepository.save(chain);

      // Send notifications
      const notifications = await this.sendEscalationNotifications(
        chain,
        level,
        context,
        assignee
      );

      // Update technician workload
      await this.updateTechnicianWorkload(assignee.id, 1);

      logger.info(`Successfully escalated ticket ${context.ticketId} to ${assignee.email}`);

      return {
        success: true,
        newAssigneeId: assignee.id,
        newAssigneeName: assignee.email,
        level: nextLevelIndex,
        reason: context.triggerReason,
        notifications,
      };
    } catch (error) {
      logger.error('Error during escalation:', error);
      throw error;
    }
  }

  // Find applicable escalation chain
  private async findApplicableChain(context: EscalationContext): Promise<EscalationChain | null> {
    const chains = await this.chainRepository.find({
      where: { isActive: true },
      order: { priority: 'DESC' },
    });

    for (const chain of chains) {
      // Check alert type filter
      if (chain.alertTypes && chain.alertTypes.length > 0) {
        if (!context.alertType || !chain.alertTypes.includes(context.alertType)) {
          continue;
        }
      }

      // Check severity filter
      if (chain.severityLevels && chain.severityLevels.length > 0) {
        if (!context.severity || !chain.severityLevels.includes(context.severity)) {
          continue;
        }
      }

      // Check priority rules
      if (chain.priorityRules?.enabled && context.priority) {
        const rule = chain.priorityRules.thresholds.find(t => t.priority === context.priority);
        if (rule && context.elapsedMinutes && context.elapsedMinutes < rule.escalateAfterMinutes) {
          continue;
        }
      }

      return chain;
    }

    return null;
  }

  // Check if escalation trigger is met
  private isEscalationTriggered(level: EscalationLevel, context: EscalationContext): boolean {
    const trigger = level.trigger;

    switch (trigger.type) {
      case EscalationTrigger.FAILURE_COUNT:
        return (context.failureCount || 0) >= trigger.value;

      case EscalationTrigger.TIME_ELAPSED:
        return (context.elapsedMinutes || 0) >= trigger.value;

      case EscalationTrigger.NO_RESPONSE:
        // Check if current assignee has not responded within threshold
        return (context.elapsedMinutes || 0) >= trigger.value;

      case EscalationTrigger.SEVERITY_LEVEL:
        return context.severity === trigger.value || 
               this.getSeverityLevel(context.severity || '') >= this.getSeverityLevel(trigger.value);

      case EscalationTrigger.CUSTOM_CONDITION:
        // Evaluate custom condition (simplified)
        return this.evaluateCustomCondition(trigger.condition || '', context);

      default:
        return true;
    }
  }

  // Get severity level for comparison
  private getSeverityLevel(severity: string): number {
    const levels: Record<string, number> = {
      'low': 1,
      'medium': 2,
      'warning': 3,
      'high': 4,
      'error': 4,
      'critical': 5,
    };
    return levels[severity.toLowerCase()] || 0;
  }

  // Evaluate custom condition
  private evaluateCustomCondition(condition: string, context: EscalationContext): boolean {
    // Simplified custom condition evaluation
    // In production, use a proper expression evaluator
    try {
      // Replace variables in condition with context values
      let evaluableCondition = condition;
      evaluableCondition = evaluableCondition.replace(/\{failureCount\}/g, String(context.failureCount || 0));
      evaluableCondition = evaluableCondition.replace(/\{elapsedMinutes\}/g, String(context.elapsedMinutes || 0));
      
      // For security, only allow simple comparisons
      if (/^[\d\s<>=!]+$/.test(evaluableCondition)) {
        return eval(evaluableCondition);
      }
      
      return false;
    } catch {
      return false;
    }
  }

  // Find next assignee based on assignment type
  private async findNextAssignee(
    level: EscalationLevel,
    chain: EscalationChain,
    context: EscalationContext
  ): Promise<User | null> {
    switch (level.assignmentType) {
      case EscalationAssignmentType.SPECIFIC_USER:
        return this.findSpecificUser(level.assignTo?.userId);

      case EscalationAssignmentType.USER_GROUP:
        return this.findUserFromGroup(level.assignTo?.groupId || level.assignTo?.groupName);

      case EscalationAssignmentType.ROUND_ROBIN:
        return this.findRoundRobinUser(chain);

      case EscalationAssignmentType.LEAST_LOADED:
        return this.findLeastLoadedUser(chain);

      case EscalationAssignmentType.SKILL_BASED:
        return this.findSkillBasedUser(level.assignTo?.skills || [], context);

      case EscalationAssignmentType.TIME_BASED:
        return this.findTimeBasedUser(chain);

      case EscalationAssignmentType.PRIORITY_BASED:
        return this.findPriorityBasedUser(context.priority || 'medium', chain);

      default:
        return null;
    }
  }

  // Find specific user
  private async findSpecificUser(userId?: number): Promise<User | null> {
    if (!userId) return null;
    
    const user = await this.userRepository.findOne({ where: { id: String(userId) } });
    if (!user || !user.isActive) return null;

    // Check if user is available
    const profile = await this.profileRepository.findOne({
      where: { user: { id: String(userId) } },
      relations: ['user'],
    });

    if (profile?.availability?.status === 'offline') {
      return null;
    }

    return user;
  }

  // Find user from group
  private async findUserFromGroup(groupIdOrName?: number | string): Promise<User | null> {
    if (!groupIdOrName) return null;

    // For simplicity, using role as group identifier
    const users = await this.userRepository.find({
      where: { 
        isActive: true,
        role: In(['admin', 'technician']),
      },
    });

    // Filter available users
    const availableUsers: User[] = [];
    for (const user of users) {
      const profile = await this.profileRepository.findOne({
        where: { user: { id: user.id } },
      });

      if (!profile || profile.availability?.status !== 'offline') {
        if (profile && profile.currentTicketCount < profile.maxConcurrentTickets) {
          availableUsers.push(user);
        }
      }
    }

    // Return random available user
    if (availableUsers.length > 0) {
      return availableUsers[Math.floor(Math.random() * availableUsers.length)];
    }

    return null;
  }

  // Round-robin assignment
  private async findRoundRobinUser(chain: EscalationChain): Promise<User | null> {
    const rules = chain.assignmentRules?.roundRobin;
    if (!rules || !rules.userPool || rules.userPool.length === 0) {
      return null;
    }

    let nextIndex = (rules.lastAssignedIndex || -1) + 1;
    if (nextIndex >= rules.userPool.length) {
      nextIndex = 0;
    }

    let attempts = 0;
    while (attempts < rules.userPool.length) {
      const userId = rules.userPool[nextIndex];
      const user = await this.findSpecificUser(userId);
      
      if (user) {
        // Update last assigned index
        if (!chain.assignmentRules) {
          chain.assignmentRules = {};
        }
        if (!chain.assignmentRules.roundRobin) {
          chain.assignmentRules.roundRobin = rules;
        }
        chain.assignmentRules.roundRobin.lastAssignedIndex = nextIndex;
        await this.chainRepository.save(chain);
        
        return user;
      }

      nextIndex = (nextIndex + 1) % rules.userPool.length;
      attempts++;
    }

    return null;
  }

  // Least loaded assignment
  private async findLeastLoadedUser(chain: EscalationChain): Promise<User | null> {
    const rules = chain.assignmentRules?.leastLoaded;
    if (!rules || !rules.userPool || rules.userPool.length === 0) {
      return null;
    }

    let leastLoadedUser: User | null = null;
    let minTickets = Infinity;

    for (const userId of rules.userPool) {
      const user = await this.userRepository.findOne({ where: { id: String(userId) } });
      if (!user || !user.isActive) continue;

      const profile = await this.profileRepository.findOne({
        where: { user: { id: String(userId) } },
      });

      if (profile && profile.availability?.status !== 'offline') {
        const ticketCount = profile.currentTicketCount || 0;
        
        if (ticketCount < minTickets && ticketCount < (rules.maxTicketsPerUser || 10)) {
          minTickets = ticketCount;
          leastLoadedUser = user;
        }
      }
    }

    return leastLoadedUser;
  }

  // Skill-based assignment
  private async findSkillBasedUser(
    requiredSkills: string[],
    context: EscalationContext
  ): Promise<User | null> {
    if (requiredSkills.length === 0) return null;

    const profiles = await this.profileRepository.find({
      relations: ['user'],
    });

    let bestMatch: { user: User; score: number } | null = null;

    for (const profile of profiles) {
      if (!profile.user.isActive || profile.availability?.status === 'offline') {
        continue;
      }

      if (profile.currentTicketCount >= profile.maxConcurrentTickets) {
        continue;
      }

      // Calculate skill match score
      let score = 0;
      for (const skill of requiredSkills) {
        if (profile.skills.includes(skill)) {
          score++;
        }
      }

      // Bonus for specializations
      if (context.alertType && profile.specializations.includes(context.alertType)) {
        score += 2;
      }

      // Bonus for experience
      score += profile.experienceLevel * 0.1;

      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { user: profile.user, score };
      }
    }

    return bestMatch?.user || null;
  }

  // Time-based assignment
  private async findTimeBasedUser(chain: EscalationChain): Promise<User | null> {
    const schedules = chain.assignmentRules?.timeBased?.schedules;
    if (!schedules || schedules.length === 0) return null;

    const now = new Date();
    const currentDay = now.getDay();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    for (const schedule of schedules) {
      const userShifts = schedule.schedule.shifts.filter(shift => shift.dayOfWeek === currentDay);
      
      for (const shift of userShifts) {
        if (currentTime >= shift.startTime && currentTime <= shift.endTime) {
          const user = await this.findSpecificUser(schedule.userId);
          if (user) return user;
        }
      }
    }

    return null;
  }

  // Priority-based assignment
  private async findPriorityBasedUser(priority: string, chain: EscalationChain): Promise<User | null> {
    // For high priority tickets, find most experienced technician
    if (priority === 'critical' || priority === 'high') {
      const profiles = await this.profileRepository.find({
        where: { experienceLevel: MoreThan(7) },
        relations: ['user'],
        order: { experienceLevel: 'DESC' },
      });

      for (const profile of profiles) {
        if (profile.user.isActive && 
            profile.availability?.status !== 'offline' &&
            profile.currentTicketCount < profile.maxConcurrentTickets) {
          return profile.user;
        }
      }
    }

    // For lower priority, use round-robin
    return this.findRoundRobinUser(chain);
  }

  // Assign ticket to user
  private async assignTicket(ticketId: number, userId: number): Promise<void> {
    try {
      // Update ticket in ConnectWise
      await this.connectWiseService.updateTicket(String(ticketId), {
        assignedToId: userId,
        note: `Ticket escalated and reassigned via automation`,
      });

      // Update local ticket record if exists
      const ticketRepo = AppDataSource.getRepository(Ticket);
      const ticket = await ticketRepo.findOne({ where: { id: String(ticketId) } });
      if (ticket) {
        ticket.assignedToId = userId;
        await ticketRepo.save(ticket);
      }
    } catch (error) {
      logger.error(`Error assigning ticket ${ticketId} to user ${userId}:`, error);
      throw error;
    }
  }

  // Send escalation notifications
  private async sendEscalationNotifications(
    chain: EscalationChain,
    level: EscalationLevel,
    context: EscalationContext,
    assignee: User
  ): Promise<string[]> {
    const notifications: string[] = [];

    try {
      // Prepare notification data
      const notificationData = {
        ticketId: context.ticketId,
        alertId: context.alertId,
        escalationLevel: level.order,
        reason: context.triggerReason,
        newAssignee: assignee.email,
        priority: context.priority,
        severity: context.severity,
      };

      // Send to configured channels
      for (const channel of level.notificationChannels) {
        switch (channel) {
          case 'teams':
            await this.teamsService.sendMessage({
              title: `Ticket Escalation: #${context.ticketId}`,
              message: chain.notificationTemplates?.escalation?.body || 
                      `Ticket has been escalated to ${assignee.email}. Reason: ${context.triggerReason}`,
              data: notificationData,
              assigneeId: assignee.id,
            });
            notifications.push('teams');
            break;

          case 'email':
            await this.notificationService.send({
              type: 'escalation',
              priority: 'high',
              title: chain.notificationTemplates?.escalation?.subject || 
                     `Ticket #${context.ticketId} Escalated`,
              message: chain.notificationTemplates?.escalation?.body || 
                      `Ticket has been escalated. Please review immediately.`,
              data: notificationData,
            });
            notifications.push('email');
            break;

          case 'sms':
            // SMS implementation would go here
            logger.info('SMS notification not yet implemented');
            break;
        }
      }

      // Send assignment notification to new assignee
      if (chain.notificationTemplates?.assignment) {
        await this.notificationService.send({
          type: 'assignment',
          priority: 'high',
          title: chain.notificationTemplates.assignment.subject,
          message: chain.notificationTemplates.assignment.body,
          data: notificationData,
          recipientId: assignee.id,
        });
      }
    } catch (error) {
      logger.error('Error sending escalation notifications:', error);
    }

    return notifications;
  }

  // Update technician workload
  private async updateTechnicianWorkload(userId: number, change: number): Promise<void> {
    try {
      const profile = await this.profileRepository.findOne({
        where: { user: { id: String(userId) } },
      });

      if (profile) {
        profile.currentTicketCount = Math.max(0, profile.currentTicketCount + change);
        
        if (change > 0) {
          if (!profile.performance) {
            profile.performance = {
              averageResolutionTime: 0,
              successRate: 0,
              customerSatisfaction: 0,
              ticketsResolved: 0,
              escalationsReceived: 0,
            };
          }
          profile.performance.escalationsReceived++;
        }

        await this.profileRepository.save(profile);
      }
    } catch (error) {
      logger.error(`Error updating technician workload for user ${userId}:`, error);
    }
  }

  // Get escalation chains
  async getEscalationChains(filters?: {
    isActive?: boolean;
    category?: string;
  }): Promise<EscalationChain[]> {
    const query = this.chainRepository.createQueryBuilder('chain')
      .leftJoinAndSelect('chain.createdBy', 'createdBy')
      .leftJoinAndSelect('chain.updatedBy', 'updatedBy');

    if (filters?.isActive !== undefined) {
      query.andWhere('chain.isActive = :isActive', { isActive: filters.isActive });
    }
    if (filters?.category) {
      query.andWhere('chain.category = :category', { category: filters.category });
    }

    query.orderBy('chain.priority', 'DESC')
      .addOrderBy('chain.name', 'ASC');

    return await query.getMany();
  }

  // Create escalation chain
  async createEscalationChain(data: Partial<EscalationChain>, user: User): Promise<EscalationChain> {
    const chain = this.chainRepository.create({
      ...data,
      createdBy: user,
      updatedBy: user,
      totalEscalations: 0,
      successfulEscalations: 0,
    });

    return await this.chainRepository.save(chain);
  }

  // Update escalation chain
  async updateEscalationChain(
    id: number,
    data: Partial<EscalationChain>,
    user: User
  ): Promise<EscalationChain> {
    const chain = await this.chainRepository.findOne({ where: { id } });
    if (!chain) {
      throw new Error('Escalation chain not found');
    }

    Object.assign(chain, {
      ...data,
      updatedBy: user,
    });

    return await this.chainRepository.save(chain);
  }

  // Get technician profiles
  async getTechnicianProfiles(): Promise<TechnicianProfile[]> {
    return await this.profileRepository.find({
      relations: ['user'],
      order: { experienceLevel: 'DESC' },
    });
  }

  // Update technician profile
  async updateTechnicianProfile(
    userId: number,
    updates: Partial<TechnicianProfile>
  ): Promise<TechnicianProfile> {
    let profile = await this.profileRepository.findOne({
      where: { user: { id: String(userId) } },
      relations: ['user'],
    });

    if (!profile) {
      const user = await this.userRepository.findOne({ where: { id: String(userId) } });
      if (!user) {
        throw new Error('User not found');
      }

      profile = this.profileRepository.create({
        user,
        ...updates,
      });
    } else {
      Object.assign(profile, updates);
    }

    return await this.profileRepository.save(profile);
  }

  // Get escalation history
  async getEscalationHistory(filters?: {
    ticketId?: number;
    chainId?: number;
    status?: string;
    limit?: number;
  }): Promise<EscalationExecution[]> {
    const query = this.executionRepository.createQueryBuilder('execution')
      .leftJoinAndSelect('execution.chain', 'chain');

    if (filters?.ticketId) {
      query.andWhere('execution.ticketId = :ticketId', { ticketId: filters.ticketId });
    }
    if (filters?.chainId) {
      query.andWhere('execution.chain_id = :chainId', { chainId: filters.chainId });
    }
    if (filters?.status) {
      query.andWhere('execution.status = :status', { status: filters.status });
    }

    query.orderBy('execution.startedAt', 'DESC');

    if (filters?.limit) {
      query.limit(filters.limit);
    }

    return await query.getMany();
  }

  // Complete escalation execution
  async completeEscalation(
    ticketId: number,
    resolution: 'resolved' | 'failed',
    notes?: string,
    resolvedByUserId?: number
  ): Promise<void> {
    const execution = await this.executionRepository.findOne({
      where: {
        ticketId,
        status: 'active',
      },
      relations: ['chain'],
    });

    if (execution) {
      execution.status = resolution === 'resolved' ? 'completed' : 'failed';
      execution.completedAt = new Date();
      execution.resolutionNotes = notes || '';
      execution.resolvedByUserId = resolvedByUserId;

      // Update last level in history
      if (execution.levelHistory.length > 0) {
        const lastLevel = execution.levelHistory[execution.levelHistory.length - 1];
        lastLevel.completedAt = new Date();
        lastLevel.outcome = resolution === 'resolved' ? 'resolved' : 'failed';
        lastLevel.notes = notes;
      }

      await this.executionRepository.save(execution);

      // Update chain statistics
      if (execution.chain) {
        if (resolution === 'resolved') {
          execution.chain.successfulEscalations++;
        }
        await this.chainRepository.save(execution.chain);
      }

      // Update technician performance
      if (resolvedByUserId) {
        const profile = await this.profileRepository.findOne({
          where: { user: { id: resolvedByUserId } },
        });

        if (profile) {
          profile.currentTicketCount = Math.max(0, profile.currentTicketCount - 1);
          
          if (profile.performance) {
            profile.performance.ticketsResolved++;
            // Update other performance metrics as needed
          }

          await this.profileRepository.save(profile);
        }
      }
    }
  }
}

