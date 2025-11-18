import { AlertThreshold, ThresholdType, ThresholdSeverity as AlertThresholdSeverity, ComparisonOperator, EscalationLevel as EscalationLevelEnum } from '../entities/AlertThreshold';
import { AppDataSource } from '../database/dataSource';
import { EscalationChain, EscalationLevel } from '../entities/EscalationChain';
import { Ticket, TicketStatus, TicketPriority, TicketSource } from '../entities/Ticket';
import { logger } from '../utils/logger';
import { TeamsService } from './teams/TeamsService';
import { EmailService } from './EmailService';
import axios from 'axios';
import { CronJob } from 'cron';

// Re-export types from entity for consistency
export { ThresholdType } from '../entities/AlertThreshold';
export type ThresholdSeverity = AlertThresholdSeverity;

export interface AlertMetric {
  deviceId: string;
  deviceName: string;
  metricType: ThresholdType;
  value: number;
  timestamp: Date;
  metadata?: any;
}

export class AlertThresholdService {
  private static instance: AlertThresholdService | null = null;
  private thresholdRepository = AppDataSource.getRepository(AlertThreshold);
  private escalationRepository = AppDataSource.getRepository(EscalationChain);
  private ticketRepository = AppDataSource.getRepository(Ticket);
  private cronJobs: Map<string, CronJob> = new Map();
  private alertHistory: Map<string, AlertHistoryEntry[]> = new Map();

  // Prevent direct instantiation
  private constructor() {}

  // Singleton pattern with async initialization
  static async getInstance(): Promise<AlertThresholdService> {
    if (!AlertThresholdService.instance) {
      AlertThresholdService.instance = new AlertThresholdService();
      await AlertThresholdService.instance.initialize();
    }
    return AlertThresholdService.instance;
  }

  private async initialize(): Promise<void> {
    try {
      // Load active thresholds and start monitoring
      const activeThresholds = await this.thresholdRepository.find({
        where: { isActive: true }
      });

      for (const threshold of activeThresholds) {
        this.startMonitoring(threshold);
      }

      logger.info(`AlertThresholdService initialized with ${activeThresholds.length} active thresholds`);
    } catch (error) {
      logger.error('Failed to initialize AlertThresholdService:', error);
      throw error;
    }
  }

  async createThreshold(data: Partial<AlertThreshold>): Promise<AlertThreshold> {
    const threshold = this.thresholdRepository.create({
      ...data,
      isActive: data.isActive !== false
    });

    const saved = await this.thresholdRepository.save(threshold);

    if (saved.isActive) {
      this.startMonitoring(saved);
    }

    logger.info(`Created alert threshold: ${saved.name}`);
    return saved;
  }

  async updateThreshold(id: string, data: Partial<AlertThreshold>): Promise<AlertThreshold> {
    const threshold = await this.thresholdRepository.findOne({ where: { id: parseInt(id) } });
    
    if (!threshold) {
      throw new Error(`Threshold ${id} not found`);
    }

    // Stop monitoring if being disabled
    if (data.isActive === false && threshold.isActive) {
      this.stopMonitoring(id);
    }

    Object.assign(threshold, data);
    const updated = await this.thresholdRepository.save(threshold);

    // Start monitoring if being enabled
    if (data.isActive === true && !threshold.isActive) {
      this.startMonitoring(updated);
    }

    logger.info(`Updated alert threshold: ${updated.name}`);
    return updated;
  }

  async deleteThreshold(id: string): Promise<void> {
    const threshold = await this.thresholdRepository.findOne({ where: { id: parseInt(id) } });
    
    if (!threshold) {
      throw new Error(`Threshold ${id} not found`);
    }

    this.stopMonitoring(id);
    await this.thresholdRepository.remove(threshold);
    
    logger.info(`Deleted alert threshold: ${threshold.name}`);
  }

  async getThreshold(id: string): Promise<AlertThreshold> {
    const threshold = await this.thresholdRepository.findOne({
      where: { id: parseInt(id) },
      relations: ['escalationChain']
    });

    if (!threshold) {
      throw new Error(`Threshold ${id} not found`);
    }

    return threshold;
  }

  async listThresholds(filters?: {
    metricType?: ThresholdType;
    severity?: ThresholdSeverity;
    isActive?: boolean;
  }): Promise<AlertThreshold[]> {
    const queryBuilder = this.thresholdRepository.createQueryBuilder('threshold');

    if (filters?.metricType) {
      queryBuilder.andWhere('threshold.metricType = :metricType', { metricType: filters.metricType });
    }

    if (filters?.severity) {
      queryBuilder.andWhere('threshold.severity = :severity', { severity: filters.severity });
    }

    if (filters?.isActive !== undefined) {
      queryBuilder.andWhere('threshold.isActive = :isActive', { isActive: filters.isActive });
    }

    return queryBuilder.getMany();
  }

  async checkMetric(metric: AlertMetric): Promise<{
    breached: boolean;
    thresholds: AlertThreshold[];
    actions: string[];
  }> {
    // Find applicable thresholds
    const thresholds = await this.thresholdRepository.find({
      where: {
        isActive: true
      },
      relations: ['escalationChain']
    });

    const breachedThresholds: AlertThreshold[] = [];
    const actions: string[] = [];

    for (const threshold of thresholds) {
      const result = await this.evaluateThresholdWithMetric(threshold, metric);
      
      if (result.breached) {
        breachedThresholds.push(threshold);
        
        // Track breach in history
        this.recordBreach(threshold, metric);
        
        // Check if we need to escalate
        if (this.shouldEscalate(threshold)) {
          const escalationActions = await this.escalate(threshold, metric);
          actions.push(...escalationActions);
        }
      }
    }

    return {
      breached: breachedThresholds.length > 0,
      thresholds: breachedThresholds,
      actions
    };
  }

  private startMonitoring(threshold: AlertThreshold): void {
    // For now, we'll rely on external systems pushing metrics
    // In a production system, this could poll metrics endpoints
    logger.info(`Started monitoring for threshold: ${threshold.name}`);
  }

  private stopMonitoring(thresholdId: string): void {
    const job = this.cronJobs.get(thresholdId);
      if (job) {
        job.stop();
      this.cronJobs.delete(thresholdId);
    }
    logger.info(`Stopped monitoring for threshold: ${thresholdId}`);
  }

  private recordBreach(threshold: AlertThreshold, metric: AlertMetric): void {
    const key = `${threshold.id}:${metric.deviceId}`;
    
    if (!this.alertHistory.has(key)) {
      this.alertHistory.set(key, []);
    }

    const history = this.alertHistory.get(key)!;
    history.push({
      timestamp: new Date(),
      value: metric.value,
      thresholdId: String(threshold.id)
    });

    // Keep only last 100 entries
    if (history.length > 100) {
      history.shift();
    }
  }

  private shouldEscalate(threshold: AlertThreshold): boolean {
    if (!threshold.autoEscalate) {
      return false;
    }

    const key = `${threshold.id}:*`;
    const recentBreaches = this.getRecentBreaches(key, threshold.escalationDelay || 5);
    
    // Escalate if we have multiple breaches within the time window
    return recentBreaches.length >= (threshold.escalationThreshold || 3);
  }

  private getRecentBreaches(pattern: string, windowMinutes: number): AlertHistoryEntry[] {
    const cutoff = new Date(Date.now() - windowMinutes * 60 * 1000);
    const breaches: AlertHistoryEntry[] = [];

    for (const [key, history] of this.alertHistory.entries()) {
      if (key.includes(pattern.replace('*', ''))) {
        const recent = history.filter(h => h.timestamp > cutoff);
        breaches.push(...recent);
      }
    }

    return breaches;
  }

  private async escalate(threshold: AlertThreshold, metric: AlertMetric): Promise<string[]> {
    const actions: string[] = [];

    try {
      // Create a ticket if configured
      if (threshold.createTicket) {
        const ticket = await this.createTicketFromAlert(threshold, metric);
        actions.push(`Created ticket: ${ticket.ticketNumber}`);
      }

      // Send notifications based on severity
      const notificationActions = await this.sendAlertNotifications(threshold, metric);
      actions.push(...notificationActions);

      // Execute escalation chain if configured
      if (threshold.escalationChain) {
        const escalationActions = await this.executeEscalationChain(
          threshold.escalationChain,
          threshold,
          metric
        );
        actions.push(...escalationActions);
      }

      logger.info(`Escalated alert for threshold ${threshold.name}: ${actions.join(', ')}`);
    } catch (error) {
      logger.error('Failed to escalate alert:', error);
      actions.push('Escalation failed - manual intervention required');
    }

    return actions;
  }

  private async createTicketFromAlert(threshold: AlertThreshold, metric: AlertMetric): Promise<Ticket> {
    const ticket = this.ticketRepository.create({
      ticketNumber: `ALERT-${Date.now()}`,
      title: `Alert: ${threshold.name} - ${metric.deviceName}`,
      description: `Automated alert triggered:\n\nThreshold: ${threshold.name}\nDevice: ${metric.deviceName}\nMetric: ${metric.metricType}\nValue: ${metric.value}\nThreshold: ${threshold.value}\nOperator: ${threshold.operator}\nSeverity: ${threshold.severity}\n\nThis ticket was automatically created by the alert threshold system.`,
      source: TicketSource.AUTOMATION,
      clientName: metric.metadata?.clientName || 'System',
      deviceName: metric.deviceName,
      deviceId: metric.deviceId,
      priority: this.mapSeverityToPriority(threshold.severity),
      status: TicketStatus.OPEN,
      metadata: {
        customFields: {
          alertThresholdId: threshold.id,
          metricValue: metric.value,
          timestamp: metric.timestamp
        }
      }
    });

    return await this.ticketRepository.save(ticket);
  }

  private mapSeverityToPriority(severity: ThresholdSeverity): TicketPriority {
    const mapping: Record<string, TicketPriority> = {
      'critical': TicketPriority.CRITICAL,
      'warning': TicketPriority.HIGH,
      'info': TicketPriority.MEDIUM
    };
    return mapping[severity] || TicketPriority.MEDIUM;
  }

  private async sendAlertNotifications(threshold: AlertThreshold, metric: AlertMetric): Promise<string[]> {
    const actions: string[] = [];

    try {
      const teamsService = TeamsService.getInstance();
      const emailService = EmailService.getInstance();

      // Send Teams notification
      if (threshold.notificationChannels?.includes('teams')) {
        await teamsService.sendAlertNotification(
          `🚨 Alert: ${threshold.name}`,
          `Device: ${metric.deviceName}\nValue: ${metric.value} (Threshold: ${threshold.value})`,
          threshold.severity as 'info' | 'warning' | 'error' | 'critical',
          `${process.env.FRONTEND_URL}/alerts/${threshold.id}`
        );
        actions.push('Sent Teams notification');
      }

      // Send email notification
      if (threshold.notificationChannels?.includes('email') && threshold.notificationRecipients?.length) {
        await emailService.sendSystemAlert(
          `Alert: ${threshold.name}`,
          `Device: ${metric.deviceName}\nMetric: ${metric.metricType}\nValue: ${metric.value}\nThreshold: ${threshold.value}\nSeverity: ${threshold.severity}`,
          threshold.severity as 'info' | 'warning' | 'error' | 'critical',
          threshold.notificationRecipients
        );
        actions.push(`Sent email to ${threshold.notificationRecipients.length} recipients`);
      }
    } catch (error) {
      logger.error('Failed to send alert notifications:', error);
      actions.push('Failed to send some notifications');
    }

    return actions;
  }

  private async executeEscalationChain(
    chain: EscalationChain,
    threshold: AlertThreshold,
    metric: AlertMetric
  ): Promise<string[]> {
    const actions: string[] = [];

    for (const level of chain.levels || []) {
      if (await this.shouldTriggerLevel(level, threshold, metric)) {
        const levelActions = await this.executeLevelActions(level, threshold, metric);
        actions.push(...levelActions);
      }
    }

    return actions;
  }

  private async shouldTriggerLevel(
    level: EscalationLevel,
    threshold: AlertThreshold,
    metric: AlertMetric
  ): Promise<boolean> {
    // Check if conditions are met (simplified for now)
    return true;
  }

  private async executeLevelActions(
    level: EscalationLevel,
    threshold: AlertThreshold,
    metric: AlertMetric
  ): Promise<string[]> {
    const actions: string[] = [];

    try {
      // Execute notification action
      if (threshold.notificationChannels?.includes('email')) {
        const emailService = EmailService.getInstance();
        await emailService.sendSystemAlert(
          `[${level.name}] Alert: ${threshold.name}`,
          `Escalation Level: ${level.name}\n\nDevice: ${metric.deviceName}\nMetric: ${metric.metricType}\nValue: ${metric.value}`,
          'critical',
          threshold.notificationRecipients || []
        );
        actions.push(`Executed ${level.name}: email notification`);
      }

      // Execute webhook action (simplified)
      // Execute script action (simplified)

      actions.push(`Executed escalation level: ${level.name}`);
    } catch (error) {
      logger.error(`Failed to execute escalation level ${level.name}:`, error);
      actions.push(`Failed: ${level.name}`);
    }

    return actions;
  }

  private evaluateThreshold(threshold: AlertThreshold, value: number): boolean {
    switch (threshold.operator) {
      case ComparisonOperator.GREATER_THAN:
        return value > threshold.value;
      case ComparisonOperator.LESS_THAN:
        return value < threshold.value;
      case ComparisonOperator.EQUALS:
        return value === threshold.value;
      case ComparisonOperator.NOT_EQUALS:
        return value !== threshold.value;
      case ComparisonOperator.GREATER_THAN_OR_EQUALS:
        return value >= threshold.value;
      case ComparisonOperator.LESS_THAN_OR_EQUALS:
        return value <= threshold.value;
      default:
        return false;
    }
  }

  private async evaluateThresholdWithMetric(
    threshold: AlertThreshold,
    metric: AlertMetric
  ): Promise<{ breached: boolean; value: number; message: string }> {
    const breached = this.evaluateThreshold(threshold, metric.value);

    return {
      breached,
      value: metric.value,
      message: breached 
        ? `Threshold breached: ${metric.value} ${threshold.operator.replace('_', ' ')} ${threshold.value}`
        : `Threshold OK: ${metric.value} within limits`
    };
  }
}

// Internal types
interface AlertHistoryEntry {
  timestamp: Date;
  value: number;
  thresholdId: string;
}