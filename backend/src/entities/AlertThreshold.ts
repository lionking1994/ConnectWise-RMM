export enum EscalationLevel {
  L1 = 'L1',
  L2 = 'L2',
  L3 = 'L3',
  MANAGER = 'MANAGER'
}

import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { EscalationChain } from './EscalationChain';

export enum ThresholdType {
  COUNT_BASED = 'count_based',
  TIME_BASED = 'time_based',
  RATE_BASED = 'rate_based',
  COMPOSITE = 'composite',
  CPU_USAGE = 'cpu_usage',
  MEMORY_USAGE = 'memory_usage',
  DISK_USAGE = 'disk_usage',
  TICKET_COUNT = 'ticket_count',
  RESPONSE_TIME = 'response_time'
}

export enum AlertSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum ComparisonOperator {
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals',
  GREATER_THAN = 'greater_than',
  LESS_THAN = 'less_than',
  GREATER_THAN_OR_EQUALS = 'greater_than_or_equals',
  LESS_THAN_OR_EQUALS = 'less_than_or_equals',
  CONTAINS = 'contains',
  NOT_CONTAINS = 'not_contains'
}

export type ThresholdSeverity = AlertSeverity;

export enum EscalationType {
  IMMEDIATE = 'immediate',
  DELAYED = 'delayed',
  PROGRESSIVE = 'progressive',
  SCHEDULED = 'scheduled'
}

export interface ThresholdCondition {
  field: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'in' | 'not_in' | 'regex';
  value: any;
  caseSensitive?: boolean;
}

export interface ThresholdAction {
  type: 'escalate' | 'notify' | 'run_script' | 'update_ticket' | 'create_ticket';
  config: {
    escalationChainId?: number;
    notificationChannels?: string[];
    scriptId?: number;
    ticketUpdates?: any;
    newTicketData?: any;
  };
}

@Entity('alert_thresholds')
export class AlertThreshold {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: string;

  @Column('text', { nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: ThresholdType,
    default: ThresholdType.COUNT_BASED
  })
  type: ThresholdType;

  @Column({
    type: 'enum',
    enum: AlertSeverity,
    default: AlertSeverity.MEDIUM
  })
  severity: AlertSeverity;

  @Column({ default: true })
  isActive: boolean;

  // Threshold configuration
  @Column('jsonb', { default: {} })
  conditions: {
    all?: ThresholdCondition[];
    any?: ThresholdCondition[];
  };

  @Column({ default: 1 })
  triggerCount: number;

  @Column({ default: 3600 }) // 1 hour in seconds
  timeWindowSeconds: number;

  @Column({ type: 'float', default: 0.8 }) // 80%
  triggerRate: number;

  @Column({ default: 300 }) // 5 minutes
  cooldownSeconds: number;

  // Additional threshold fields
  @Column({ type: 'enum', enum: ComparisonOperator, default: ComparisonOperator.GREATER_THAN })
  operator: ComparisonOperator;

  @Column({ type: 'float', nullable: true })
  value: number;

  @Column({ default: 0 })
  breachCount: number;

  @Column({ nullable: true })
  lastBreachAt: Date;

  @Column({ nullable: true })
  lastCheckedAt: Date;

  @Column({ default: 60 }) // Check every minute
  checkInterval: number;

  @Column({ nullable: true })
  clientId: string;

  // Actions when threshold is breached
  @Column('jsonb', { default: [] })
  actions: ThresholdAction[];

  // Escalation settings
  @ManyToOne(() => EscalationChain, { nullable: true })
  @JoinColumn({ name: 'escalation_chain_id' })
  escalationChain: EscalationChain;

  @Column({
    type: 'enum',
    enum: EscalationType,
    default: EscalationType.IMMEDIATE
  })
  escalationType: EscalationType;

  @Column({ default: 0 })
  escalationDelayMinutes: number;

  // Notification settings
  @Column('simple-array', { default: [] })
  notificationChannels: string[];

  @Column('text', { nullable: true })
  notificationTemplate: string;

  // Statistics
  @Column('jsonb', { default: {} })
  statistics: {
    totalTriggers: number;
    lastTriggered?: Date;
    lastBreachedValue?: any;
    avgResponseTime?: number;
    successRate?: number;
  };

  // Metadata
  @Column('jsonb', { default: {} })
  metadata: {
    tags?: string[];
    priority?: number;
    category?: string;
    affectedServices?: string[];
    customFields?: Record<string, any>;
    escalationChainId?: number;
    consecutiveBreaches?: number;
    unit?: string;
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  createdBy: string;

  @Column({ nullable: true })
  updatedBy: string;

  @Column('simple-array', { nullable: true })
  notificationRecipients: string[];

  @Column({ default: false })
  autoEscalate: boolean;

  @Column({ default: 5 })
  escalationDelay: number;

  @Column({ default: 3 })
  escalationThreshold: number;

  @Column({ default: false })
  createTicket: boolean;
}