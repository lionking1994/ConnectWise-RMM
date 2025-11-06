import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './User';

export enum EscalationAssignmentType {
  SPECIFIC_USER = 'specific_user',
  USER_GROUP = 'user_group',
  ROUND_ROBIN = 'round_robin',
  LEAST_LOADED = 'least_loaded',
  SKILL_BASED = 'skill_based',
  TIME_BASED = 'time_based',
  PRIORITY_BASED = 'priority_based',
}

export enum EscalationTrigger {
  FAILURE_COUNT = 'failure_count',
  TIME_ELAPSED = 'time_elapsed',
  NO_RESPONSE = 'no_response',
  SEVERITY_LEVEL = 'severity_level',
  CUSTOM_CONDITION = 'custom_condition',
}

export interface EscalationLevel {
  order: number;
  name: string;
  assignmentType: EscalationAssignmentType;
  assignTo?: {
    userId?: number;
    groupId?: number;
    groupName?: string;
    skills?: string[];
    schedule?: {
      timezone: string;
      businessHours: { start: string; end: string };
      weekends: boolean;
    };
  };
  trigger: {
    type: EscalationTrigger;
    value: any;
    condition?: string;
  };
  waitMinutes: number;
  notificationChannels: string[]; // ['teams', 'email', 'sms']
  autoReassign: boolean;
  skipIfUnavailable: boolean;
}

@Entity('escalation_chains')
export class EscalationChain {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: 0 })
  priority: number; // Higher priority chains are evaluated first

  @Column('jsonb')
  levels: EscalationLevel[];

  @Column({ nullable: true })
  category: string;

  @Column('simple-array', { nullable: true })
  alertTypes: string[]; // Apply to specific alert types

  @Column('simple-array', { nullable: true })
  severityLevels: string[]; // Apply to specific severity levels

  // Assignment rules configuration
  @Column('jsonb', { nullable: true })
  assignmentRules: {
    roundRobin?: {
      userPool: number[]; // User IDs in the pool
      lastAssignedIndex?: number;
      skipOfflineUsers?: boolean;
    };
    leastLoaded?: {
      userPool: number[];
      maxTicketsPerUser?: number;
      balancingPeriodHours?: number;
    };
    skillBased?: {
      requiredSkills: string[];
      preferredSkills?: string[];
      minimumSkillMatch?: number; // Percentage
    };
    timeBased?: {
      schedules: Array<{
        userId: number;
        schedule: {
          timezone: string;
          shifts: Array<{
            dayOfWeek: number; // 0-6
            startTime: string; // HH:mm
            endTime: string; // HH:mm
          }>;
        };
      }>;
    };
  };

  // Priority-based escalation
  @Column('jsonb', { nullable: true })
  priorityRules: {
    enabled: boolean;
    thresholds: Array<{
      priority: string; // 'low', 'medium', 'high', 'critical'
      escalateAfterMinutes: number;
      skipLevels?: number; // Skip N levels for high priority
    }>;
  };

  // Failure threshold configuration
  @Column({ default: 3 })
  defaultFailureThreshold: number;

  @Column('jsonb', { nullable: true })
  failureThresholds: {
    scriptExecution?: number;
    automationRule?: number;
    responseTime?: number; // minutes
    customMetrics?: Record<string, number>;
  };

  // Statistics
  @Column({ default: 0 })
  totalEscalations: number;

  @Column({ default: 0 })
  successfulEscalations: number;

  @Column({ nullable: true })
  lastEscalatedAt: Date;

  @Column('jsonb', { nullable: true })
  escalationHistory: Array<{
    ticketId: number;
    alertId?: string;
    fromUser?: number;
    toUser?: number;
    level: number;
    reason: string;
    timestamp: Date;
    success: boolean;
  }>;

  // Notification templates
  @Column('jsonb', { nullable: true })
  notificationTemplates: {
    escalation?: {
      subject: string;
      body: string;
      teamsCard?: any;
    };
    assignment?: {
      subject: string;
      body: string;
    };
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

// Technician skills and availability
@Entity('technician_profiles')
export class TechnicianProfile {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column('simple-array', { default: [] })
  skills: string[]; // ['networking', 'windows', 'security', 'hardware']

  @Column('jsonb', { nullable: true })
  certifications: Array<{
    name: string;
    issuer: string;
    expiryDate?: Date;
  }>;

  @Column({ default: 0 })
  experienceLevel: number; // 0-10

  @Column('simple-array', { default: [] })
  specializations: string[]; // ['sophos', 'disk_management', 'performance']

  @Column('jsonb', { nullable: true })
  availability: {
    status: 'available' | 'busy' | 'offline' | 'on_break';
    schedule: {
      timezone: string;
      workHours: Array<{
        dayOfWeek: number;
        startTime: string;
        endTime: string;
      }>;
    };
    nextAvailable?: Date;
  };

  @Column({ default: 0 })
  currentTicketCount: number;

  @Column({ default: 10 })
  maxConcurrentTickets: number;

  @Column('jsonb', { nullable: true })
  performance: {
    averageResolutionTime: number; // minutes
    successRate: number; // percentage
    customerSatisfaction: number; // 1-5
    ticketsResolved: number;
    escalationsReceived: number;
  };

  @Column('simple-array', { nullable: true })
  preferredAlertTypes: string[];

  @Column('simple-array', { nullable: true })
  preferredClients: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

// Escalation execution tracking
@Entity('escalation_executions')
export class EscalationExecution {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => EscalationChain)
  @JoinColumn({ name: 'chain_id' })
  chain: EscalationChain;

  @Column()
  ticketId: number;

  @Column({ nullable: true })
  alertId: string;

  @Column()
  currentLevel: number;

  @Column('jsonb')
  levelHistory: Array<{
    level: number;
    assignedTo: number;
    assignedAt: Date;
    completedAt?: Date;
    outcome: 'resolved' | 'escalated' | 'timeout' | 'failed';
    notes?: string;
  }>;

  @Column()
  status: 'active' | 'completed' | 'failed' | 'cancelled';

  @Column('jsonb')
  metadata: {
    triggerReason: string;
    originalAssignee?: number;
    priority?: string;
    severity?: string;
    clientName?: string;
    deviceInfo?: any;
  };

  @CreateDateColumn()
  startedAt: Date;

  @Column({ nullable: true })
  completedAt: Date;

  @Column({ nullable: true })
  resolutionNotes: string;

  @Column({ nullable: true })
  resolvedByUserId: number;
}