import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany } from 'typeorm';
import { User } from './User';
import { AutomationHistory } from './AutomationHistory';

export enum TicketStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  PENDING = 'pending',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
  CANCELLED = 'cancelled'
}

export enum TicketPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum TicketSource {
  CONNECTWISE = 'connectwise',
  NABLE = 'nable',
  MANUAL = 'manual',
  AUTOMATION = 'automation'
}

@Entity('tickets')
export class Ticket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  ticketNumber: string;

  @Column({ nullable: true })
  externalId: string;

  @Column()
  title: string;

  @Column('text')
  description: string;

  @Column({
    type: 'enum',
    enum: TicketStatus,
    default: TicketStatus.OPEN
  })
  status: TicketStatus;

  @Column({
    type: 'enum',
    enum: TicketPriority,
    default: TicketPriority.MEDIUM
  })
  priority: TicketPriority;

  @Column({
    type: 'enum',
    enum: TicketSource
  })
  source: TicketSource;

  @Column()
  clientName: string;

  @Column({ nullable: true })
  clientId: string;

  @Column({ nullable: true })
  deviceName: string;

  @Column({ nullable: true })
  deviceId: string;

  @Column('jsonb', { nullable: true })
  metadata: {
    connectwiseData?: any;
    nableData?: any;
    customFields?: Record<string, any>;
  };

  @Column('text', { array: true, default: [] })
  tags: string[];

  @Column('jsonb', { default: [] })
  notes: Array<{
    id: string;
    text: string;
    author: string;
    timestamp: Date;
    type: 'manual' | 'automation' | 'system';
  }>;

  @Column('jsonb', { nullable: true })
  automationAttempts: Array<{
    ruleId: string;
    timestamp: Date;
    success: boolean;
    output?: string;
    error?: string;
  }>;

  @ManyToOne(() => User, user => user.assignedTickets, { nullable: true })
  assignedTo: User;

  @Column({ nullable: true })
  assignedToId: string;

  @OneToMany(() => AutomationHistory, history => history.ticket)
  automationHistory: AutomationHistory[];

  @Column({ nullable: true })
  resolvedAt: Date;

  @Column({ nullable: true })
  closedAt: Date;

  @Column({ nullable: true })
  slaDeadline: Date;

  @Column({ default: 0 })
  timeSpentMinutes: number;

  @Column({ default: false })
  isEscalated: boolean;

  @Column({ nullable: true })
  escalatedTo: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}


