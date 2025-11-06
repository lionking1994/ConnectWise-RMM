import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './User';

export interface BoardSettings {
  autoCreateTickets: boolean;
  autoAssignEnabled: boolean;
  defaultPriority: string;
  defaultStatus: string;
  syncInterval: number; // minutes
  customFieldMappings?: Record<string, any>;
  notificationSettings?: {
    onNewTicket: boolean;
    onStatusChange: boolean;
    onPriorityChange: boolean;
    channels: string[]; // ['teams', 'email']
  };
  automationRules?: string[]; // IDs of automation rules to apply
  escalationChains?: string[]; // IDs of escalation chains
}

@Entity('board_configurations')
@Index(['boardId', 'isActive'])
export class BoardConfiguration {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  boardId: string; // ConnectWise board ID

  @Column()
  boardName: string; // e.g., "Network Operations Center"

  @Column({ nullable: true })
  description: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isPrimary: boolean; // Primary board (e.g., NOC)

  @Column('jsonb')
  settings: BoardSettings;

  // Board-specific filters
  @Column('jsonb', { nullable: true })
  filters: {
    statuses?: string[]; // Only sync tickets with these statuses
    priorities?: string[]; // Only sync tickets with these priorities
    types?: string[]; // Only sync tickets of these types
    companies?: string[]; // Only sync tickets from these companies
    teams?: string[]; // Only sync tickets assigned to these teams
    tags?: string[]; // Only sync tickets with these tags
    customFilters?: Array<{
      field: string;
      operator: string;
      value: any;
    }>;
  };

  // Board sync status
  @Column({ nullable: true })
  lastSyncAt: Date;

  @Column({ default: 0 })
  totalTicketsSynced: number;

  @Column({ default: 0 })
  activeTicketsCount: number;

  @Column('jsonb', { nullable: true })
  syncStatus: {
    isRunning: boolean;
    lastError?: string;
    lastErrorAt?: Date;
    consecutiveErrors?: number;
  };

  // Board-specific automation settings
  @Column('jsonb', { nullable: true })
  automationSettings: {
    enabled: boolean;
    rules: Array<{
      condition: string; // e.g., "priority === 'Critical'"
      action: string; // e.g., "escalate", "auto-assign", "run-script"
      parameters?: Record<string, any>;
    }>;
    scriptMappings?: Array<{
      alertType: string;
      scriptId: string;
      autoExecute: boolean;
    }>;
  };

  // Board-specific SLA settings
  @Column('jsonb', { nullable: true })
  slaSettings: {
    enabled: boolean;
    thresholds: Array<{
      priority: string;
      responseTimeMinutes: number;
      resolutionTimeMinutes: number;
      escalateOnBreach: boolean;
    }>;
  };

  // Board display preferences
  @Column('jsonb', { nullable: true })
  displaySettings: {
    color: string; // For UI differentiation
    icon?: string;
    dashboardPosition?: number;
    showInQuickAccess?: boolean;
    columnsToShow?: string[]; // Which ticket fields to display
  };

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
}

// Board sync history
@Entity('board_sync_history')
export class BoardSyncHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => BoardConfiguration)
  @JoinColumn({ name: 'board_config_id' })
  boardConfig: BoardConfiguration;

  @Column()
  syncType: 'manual' | 'scheduled' | 'webhook';

  @Column()
  startTime: Date;

  @Column({ nullable: true })
  endTime: Date;

  @Column({ default: 0 })
  ticketsCreated: number;

  @Column({ default: 0 })
  ticketsUpdated: number;

  @Column({ default: 0 })
  ticketsClosed: number;

  @Column({ default: 0 })
  errors: number;

  @Column('jsonb', { nullable: true })
  errorDetails: Array<{
    ticketId: string;
    error: string;
    timestamp: Date;
  }>;

  @Column()
  status: 'running' | 'completed' | 'failed' | 'partial';

  @Column('text', { nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;
}

// Board-specific custom field mappings
@Entity('board_field_mappings')
export class BoardFieldMapping {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => BoardConfiguration)
  @JoinColumn({ name: 'board_config_id' })
  boardConfig: BoardConfiguration;

  @Column()
  connectwiseFieldName: string;

  @Column()
  connectwiseFieldId: string;

  @Column()
  localFieldName: string; // Field name in our system

  @Column()
  dataType: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';

  @Column({ nullable: true })
  defaultValue: string;

  @Column({ default: true })
  syncEnabled: boolean;

  @Column()
  syncDirection: 'inbound' | 'outbound' | 'bidirectional';

  @Column('jsonb', { nullable: true })
  transformRules: {
    inbound?: {
      type: 'map' | 'regex' | 'function';
      rule: any;
    };
    outbound?: {
      type: 'map' | 'regex' | 'function';
      rule: any;
    };
  };

  @Column({ default: true })
  isRequired: boolean;

  @Column('jsonb', { nullable: true })
  validationRules: {
    pattern?: string;
    minLength?: number;
    maxLength?: number;
    minValue?: number;
    maxValue?: number;
    allowedValues?: any[];
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

