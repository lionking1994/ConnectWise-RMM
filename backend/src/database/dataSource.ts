import { DataSource } from 'typeorm';
import dotenv from 'dotenv';
import { User } from '../entities/User';
import { Ticket } from '../entities/Ticket';
import { AutomationRule } from '../entities/AutomationRule';
import { AutomationHistory } from '../entities/AutomationHistory';
import { WebhookEvent } from '../entities/WebhookEvent';
import { Notification } from '../entities/Notification';
import { ApiCredential } from '../entities/ApiCredential';
import { AuditLog } from '../entities/AuditLog';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER || 'rmm_user',
  password: process.env.DB_PASSWORD || 'rmm_secure_pass_2024',
  database: process.env.DB_NAME || 'rmm_integration',
  synchronize: process.env.NODE_ENV === 'development',
  logging: process.env.NODE_ENV === 'development',
  entities: [
    User,
    Ticket,
    AutomationRule,
    AutomationHistory,
    WebhookEvent,
    Notification,
    ApiCredential,
    AuditLog
  ],
  migrations: ['src/database/migrations/*.ts'],
  subscribers: ['src/database/subscribers/*.ts'],
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false
});


