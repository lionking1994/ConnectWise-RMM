import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum WebhookSource {
  CONNECTWISE = 'connectwise',
  NABLE = 'nable'
}

export enum WebhookStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  PROCESSED = 'processed',
  FAILED = 'failed',
  IGNORED = 'ignored'
}

@Entity('webhook_events')
export class WebhookEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: WebhookSource
  })
  source: WebhookSource;

  @Column()
  eventType: string;

  @Column('jsonb')
  payload: Record<string, any>;

  @Column('jsonb', { nullable: true })
  headers: Record<string, any>;

  @Column({
    type: 'enum',
    enum: WebhookStatus,
    default: WebhookStatus.PENDING
  })
  status: WebhookStatus;

  @Column({ default: 0 })
  retryCount: number;

  @Column({ nullable: true })
  processedAt: Date;

  @Column('text', { nullable: true })
  error: string;

  @Column('jsonb', { nullable: true })
  result: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;
}


