import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne } from 'typeorm';
import { AutomationRule } from './AutomationRule';
import { Ticket } from './Ticket';

export enum ExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  SUCCESS = 'success',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  TIMEOUT = 'timeout'
}

@Entity('automation_history')
export class AutomationHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => AutomationRule, rule => rule.executionHistory)
  rule: AutomationRule;

  @Column()
  ruleId: string;

  @ManyToOne(() => Ticket, ticket => ticket.automationHistory, { nullable: true })
  ticket: Ticket;

  @Column({ nullable: true })
  ticketId: string;

  @Column({
    type: 'enum',
    enum: ExecutionStatus,
    default: ExecutionStatus.PENDING
  })
  status: ExecutionStatus;

  @Column('jsonb')
  executionSteps: Array<{
    action: string;
    startTime: Date;
    endTime?: Date;
    status: ExecutionStatus;
    output?: any;
    error?: string;
  }>;

  @Column('jsonb', { nullable: true })
  input: Record<string, any>;

  @Column('jsonb', { nullable: true })
  output: Record<string, any>;

  @Column('text', { nullable: true })
  errorMessage: string;

  @Column('text', { nullable: true })
  errorStack: string;

  @Column({ default: 0 })
  retryCount: number;

  @Column({ nullable: true })
  startedAt: Date;

  @Column({ nullable: true })
  completedAt: Date;

  @Column({ default: 0 })
  durationMs: number;

  @CreateDateColumn()
  createdAt: Date;
}


