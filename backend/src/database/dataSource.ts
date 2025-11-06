import { DataSource } from 'typeorm';
import dotenv from 'dotenv';
import path from 'path';
import { User } from '../entities/User';
import { Ticket } from '../entities/Ticket';
import { AutomationRule } from '../entities/AutomationRule';
import { AutomationHistory } from '../entities/AutomationHistory';
import { WebhookEvent } from '../entities/WebhookEvent';
import { Notification } from '../entities/Notification';
import { ApiCredential } from '../entities/ApiCredential';
import { AuditLog } from '../entities/AuditLog';
import { AlertThreshold } from '../entities/AlertThreshold';
import { EscalationChain, TechnicianProfile, EscalationExecution } from '../entities/EscalationChain';
import { Script, ScriptExecution } from '../entities/Script';
import { AlertScriptMapping, AlertMappingExecution } from '../entities/AlertScriptMapping';
import { BoardConfiguration, BoardSyncHistory, BoardFieldMapping } from '../entities/BoardConfiguration';
import { Asset, AssetHistory, AssetRelationship } from '../entities/Asset';

// Load .env from backend directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Check environment
const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;

console.log('Environment:', process.env.NODE_ENV || 'development (default)');
console.log('Database sync enabled:', isDevelopment);

// Parse DATABASE_URL if provided, otherwise use individual env vars
const databaseUrl = process.env.DATABASE_URL;
let dbConfig: any = {};

if (databaseUrl) {
  // Parse DATABASE_URL
  const url = new URL(databaseUrl);
  dbConfig = {
    host: url.hostname,
    port: parseInt(url.port || '5432'),
    username: url.username,
    password: url.password,
    database: url.pathname.substring(1), // Remove leading slash
  };
} else {
  dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USER || 'rmm_user',
    password: process.env.DB_PASSWORD || 'rmm_secure_pass_2024',
    database: process.env.DB_NAME || 'rmm_integration',
  };
}

export const AppDataSource = new DataSource({
  type: 'postgres',
  ...dbConfig,
  synchronize: isDevelopment,  // Auto-create tables in development
  logging: isDevelopment,
  entities: [
    User,
    Ticket,
    AutomationRule,
    AutomationHistory,
    WebhookEvent,
    Notification,
    ApiCredential,
    AuditLog,
    AlertThreshold,
    EscalationChain,
    TechnicianProfile,
    EscalationExecution,
    Script,
    ScriptExecution,
    AlertScriptMapping,
    AlertMappingExecution,
    BoardConfiguration,
    BoardSyncHistory,
    BoardFieldMapping,
    Asset,
    AssetHistory,
    AssetRelationship
  ],
  migrations: ['src/database/migrations/*.ts'],
  subscribers: ['src/database/subscribers/*.ts'],
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false
});


