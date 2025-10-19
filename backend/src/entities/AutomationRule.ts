import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { AutomationHistory } from './AutomationHistory';

export enum RuleConditionOperator {
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals',
  CONTAINS = 'contains',
  NOT_CONTAINS = 'not_contains',
  GREATER_THAN = 'greater_than',
  LESS_THAN = 'less_than',
  IN = 'in',
  NOT_IN = 'not_in',
  REGEX = 'regex'
}

export enum ActionType {
  RUN_SCRIPT = 'run_script',
  UPDATE_TICKET = 'update_ticket',
  SEND_NOTIFICATION = 'send_notification',
  CREATE_TICKET = 'create_ticket',
  CLOSE_TICKET = 'close_ticket',
  ESCALATE = 'escalate',
  ASSIGN_TICKET = 'assign_ticket',
  ADD_NOTE = 'add_note',
  RESTART_SERVICE = 'restart_service',
  CLEAR_CACHE = 'clear_cache',
  INSTALL_UPDATE = 'install_update'
}

interface RuleCondition {
  field: string;
  operator: RuleConditionOperator;
  value: any;
  dataSource: 'ticket' | 'device' | 'alert';
}

interface RuleAction {
  type: ActionType;
  parameters: Record<string, any>;
  order: number;
  continueOnError: boolean;
}

@Entity('automation_rules')
export class AutomationRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column('text', { nullable: true })
  description: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: 0 })
  priority: number;

  @Column('jsonb')
  conditions: {
    all?: RuleCondition[];
    any?: RuleCondition[];
  };

  @Column('jsonb')
  actions: RuleAction[];

  @Column('simple-array', { nullable: true })
  triggerEvents: string[];

  @Column('jsonb', { nullable: true })
  schedule: {
    enabled: boolean;
    cron?: string;
    timezone?: string;
  };

  @Column({ default: 3 })
  maxRetries: number;

  @Column({ default: 5000 })
  retryDelayMs: number;

  @Column({ default: 300000 })
  timeoutMs: number;

  @Column('simple-array', { nullable: true })
  tags: string[];

  @Column('jsonb', { nullable: true })
  metadata: Record<string, any>;

  @Column({ default: 0 })
  executionCount: number;

  @Column({ default: 0 })
  successCount: number;

  @Column({ default: 0 })
  failureCount: number;

  @Column({ nullable: true })
  lastExecutedAt: Date;

  @Column({ nullable: true })
  lastSuccessAt: Date;

  @Column({ nullable: true })
  lastFailureAt: Date;

  @Column('text', { nullable: true })
  lastError: string;

  @OneToMany(() => AutomationHistory, history => history.rule)
  executionHistory: AutomationHistory[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}


