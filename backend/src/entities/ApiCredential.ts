import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum ApiProvider {
  CONNECTWISE = 'connectwise',
  NABLE = 'nable',
  SLACK = 'slack',
  TEAMS = 'teams',
  SMTP = 'smtp'
}

@Entity('api_credentials')
export class ApiCredential {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: ApiProvider,
    unique: true
  })
  provider: ApiProvider;

  @Column()
  name: string;

  @Column('jsonb')
  credentials: {
    apiUrl?: string;
    apiKey?: string;
    apiSecret?: string;
    publicKey?: string;
    privateKey?: string;
    companyId?: string;
    clientId?: string;
    webhookUrl?: string;
    host?: string;
    port?: number;
    username?: string;
    password?: string;
    [key: string]: any;
  };

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  lastTestAt: Date;

  @Column({ nullable: true })
  lastTestStatus: 'success' | 'failed';

  @Column('text', { nullable: true })
  lastTestMessage: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}


