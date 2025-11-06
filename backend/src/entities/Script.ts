import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  CreateDateColumn, 
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn
} from 'typeorm';
import { User } from './User';
import { AlertScriptMapping } from './AlertScriptMapping';

export enum ScriptType {
  POWERSHELL = 'powershell',
  BATCH = 'batch',
  BASH = 'bash',
  PYTHON = 'python',
  CUSTOM = 'custom'
}

export enum ScriptCategory {
  SECURITY = 'security',
  PERFORMANCE = 'performance',
  MAINTENANCE = 'maintenance',
  DISK = 'disk',
  SERVICES = 'services',
  NETWORK = 'network',
  CUSTOM = 'custom'
}

@Entity('scripts')
export class Script {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: ScriptType,
    default: ScriptType.POWERSHELL
  })
  type: ScriptType;

  @Column({
    type: 'enum',
    enum: ScriptCategory,
    default: ScriptCategory.CUSTOM
  })
  category: ScriptCategory;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'jsonb', default: {} })
  parameters: Record<string, any>;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isTemplate: boolean;

  @Column({ default: '1.0.0' })
  version: string;

  @Column('simple-array', { nullable: true })
  tags: string[];

  @Column({ default: 300 })
  timeoutSeconds: number;

  @Column({ default: 3 })
  maxRetries: number;

  @Column({ default: 60 })
  retryDelaySeconds: number;

  @Column({ type: 'jsonb', nullable: true })
  executionHistory: Array<{
    executedAt: Date;
    deviceId: string;
    ticketId?: number;
    success: boolean;
    output?: string;
    duration?: number;
  }>;

  @Column({ nullable: true })
  createdBy: string;

  @Column({ nullable: true })
  updatedBy: string;

  @OneToMany(() => AlertScriptMapping, mapping => mapping.primaryScript)
  alertMappings: AlertScriptMapping[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('script_executions')
export class ScriptExecution {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Script)
  @JoinColumn()
  script: Script;

  @Column()
  scriptId: number;

  @Column()
  deviceId: string;

  @Column({ nullable: true })
  deviceName: string;

  @Column({ nullable: true })
  ticketId: string;

  @Column({ nullable: true })
  executionId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn()
  executedBy: User;

  @Column({ nullable: true })
  executedById: string;

  @Column({ default: 'pending' })
  status: string;

  @Column({ type: 'text', nullable: true })
  output: string;

  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  @Column({ type: 'jsonb', nullable: true })
  parameters: Record<string, any>;

  @Column()
  startTime: Date;

  @Column({ nullable: true })
  endTime: Date;

  @Column({ nullable: true })
  duration: number;

  @Column({ default: 0 })
  exitCode: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
