import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('simple-array')
  channels: string[];

  @Column()
  subject: string;

  @Column('text')
  message: string;

  @Column({ nullable: true })
  priority: string;

  @Column('simple-array', { nullable: true })
  recipients: string[];

  @Column('jsonb', { nullable: true })
  metadata: Record<string, any>;

  @Column({ default: 'pending' })
  status: 'pending' | 'sent' | 'failed' | 'partial';

  @Column({ nullable: true })
  sentAt: Date;

  @Column('text', { nullable: true })
  error: string;

  @CreateDateColumn()
  createdAt: Date;
}


