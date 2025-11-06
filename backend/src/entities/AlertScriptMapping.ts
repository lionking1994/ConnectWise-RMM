import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Script } from './Script';
import { User } from './User';

export enum AlertConditionOperator {
  EQUALS = 'equals',
  CONTAINS = 'contains',
  STARTS_WITH = 'starts_with',
  ENDS_WITH = 'ends_with',
  REGEX = 'regex',
  IN = 'in',
  NOT_IN = 'not_in',
  GREATER_THAN = 'greater_than',
  LESS_THAN = 'less_than',
}

export enum AlertActionType {
  RUN_SCRIPT = 'run_script',
  UPDATE_TICKET = 'update_ticket',
  SEND_NOTIFICATION = 'send_notification',
  ESCALATE = 'escalate',
  CLOSE_TICKET = 'close_ticket',
}

export interface AlertCondition {
  field: string; // e.g., 'alertType', 'severity', 'deviceName'
  operator: AlertConditionOperator;
  value: any;
}

export interface AlertAction {
  type: AlertActionType;
  order: number;
  parameters: Record<string, any>;
  continueOnError?: boolean;
}

@Entity('alert_script_mappings')
export class AlertScriptMapping {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: 0 })
  priority: number; // Higher priority rules execute first

  // Alert matching conditions
  @Column('jsonb')
  conditions: {
    all?: AlertCondition[]; // AND conditions
    any?: AlertCondition[]; // OR conditions
  };

  // Actions to perform when conditions match
  @Column('jsonb')
  actions: AlertAction[];

  // Primary script to execute
  @ManyToOne(() => Script, { nullable: true })
  @JoinColumn({ name: 'primary_script_id' })
  primaryScript: Script;

  // Execution settings
  @Column({ default: 3 })
  maxRetries: number;

  @Column({ default: 60 })
  retryDelaySeconds: number;

  @Column({ default: 300 })
  executionTimeoutSeconds: number;

  @Column({ default: false })
  stopOnFirstSuccess: boolean; // Stop processing other rules if this one succeeds

  // Escalation settings
  @Column({ nullable: true })
  escalateAfterFailures: number; // Escalate after N consecutive failures

  @Column({ nullable: true })
  escalateToUserId: number;

  @Column({ nullable: true })
  escalateToGroupName: string;

  // Notification settings
  @Column('jsonb', { nullable: true })
  notificationSettings: {
    onSuccess?: boolean;
    onFailure?: boolean;
    onEscalation?: boolean;
    channels?: string[]; // ['teams', 'email']
    recipients?: string[];
  };

  // Ticket update settings
  @Column('jsonb', { nullable: true })
  ticketUpdateTemplate: {
    status?: string;
    priority?: string;
    noteTemplate?: string; // Template with variables like {{scriptName}}, {{result}}
    customFields?: Record<string, any>;
  };

  // Schedule restrictions
  @Column('jsonb', { nullable: true })
  schedule: {
    enabled?: boolean;
    timezone?: string;
    allowedDays?: number[]; // 0-6 (Sunday-Saturday)
    allowedHours?: { start: number; end: number }; // 24-hour format
    blackoutPeriods?: Array<{ start: Date; end: Date }>;
  };

  // Statistics
  @Column({ default: 0 })
  executionCount: number;

  @Column({ default: 0 })
  successCount: number;

  @Column({ default: 0 })
  failureCount: number;

  @Column({ nullable: true })
  lastExecutedAt: Date;

  @Column({ nullable: true })
  lastExecutionStatus: 'success' | 'failure' | 'partial';

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'updated_by_id' })
  updatedBy: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Alert type filters (for quick filtering)
  @Column('simple-array', { nullable: true })
  alertTypes: string[]; // Quick reference for UI filtering

  @Column('simple-array', { nullable: true })
  deviceGroups: string[]; // Apply only to specific device groups
}

// Execution log for alert mappings
@Entity('alert_mapping_executions')
export class AlertMappingExecution {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => AlertScriptMapping)
  @JoinColumn({ name: 'mapping_id' })
  mapping: AlertScriptMapping;

  @Column()
  alertId: string;

  @Column('jsonb')
  alertData: Record<string, any>;

  @Column()
  ticketId: number;

  @Column({ nullable: true })
  deviceId: string;

  @Column('jsonb')
  executedActions: Array<{
    action: AlertAction;
    startTime: Date;
    endTime?: Date;
    success: boolean;
    output?: string;
    error?: string;
  }>;

  @Column()
  overallStatus: 'pending' | 'running' | 'success' | 'failure' | 'partial';

  @Column({ nullable: true })
  escalated: boolean;

  @Column({ nullable: true })
  escalatedTo: string;

  @CreateDateColumn()
  startTime: Date;

  @Column({ nullable: true })
  endTime: Date;

  @Column({ nullable: true })
  duration: number; // milliseconds

  @Column('text', { nullable: true })
  notes: string;
}

