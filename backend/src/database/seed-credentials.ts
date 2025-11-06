import { AppDataSource } from './dataSource';
import { ApiCredential } from '../entities/ApiCredential';
import { logger } from '../utils/logger';
import crypto from 'crypto';

// Simple encryption for demo purposes - use proper encryption in production
function encrypt(text: string): string {
  const algorithm = 'aes-256-cbc';
  const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'default-key-change-in-production', 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

async function seedCredentials() {
  try {
    logger.info('Seeding API credentials...');
    
    await AppDataSource.initialize();
    
    const credentialRepository = AppDataSource.getRepository(ApiCredential);
    
    // Check if credentials already exist
    const existingCreds = await credentialRepository.find();
    
    if (existingCreds.length === 0) {
      // ConnectWise credentials
      const cwCreds = credentialRepository.create({
        service: 'connectwise',
        name: 'ConnectWise Production',
        apiUrl: process.env.CONNECTWISE_API_URL || 'https://api-na.myconnectwise.net',
        credentials: {
          companyId: process.env.CONNECTWISE_COMPANY_ID || 'YOUR_COMPANY',
          publicKey: encrypt(process.env.CONNECTWISE_PUBLIC_KEY || 'YOUR_PUBLIC_KEY'),
          privateKey: encrypt(process.env.CONNECTWISE_PRIVATE_KEY || 'YOUR_PRIVATE_KEY'),
          clientId: process.env.CONNECTWISE_CLIENT_ID || 'YOUR_CLIENT_ID'
        },
        isActive: true,
        lastValidated: new Date()
      });
      
      // N-able credentials
      const nableCreds = credentialRepository.create({
        service: 'nable',
        name: 'N-able RMM Production',
        apiUrl: process.env.NABLE_API_URL || 'https://api.narmm.com',
        credentials: {
          apiKey: encrypt(process.env.NABLE_API_KEY || 'YOUR_API_KEY'),
          apiSecret: encrypt(process.env.NABLE_API_SECRET || 'YOUR_API_SECRET')
        },
        isActive: true,
        lastValidated: new Date()
      });
      
      // Teams webhook
      const teamsCreds = credentialRepository.create({
        service: 'teams',
        name: 'Microsoft Teams Webhook',
        apiUrl: process.env.MS_TEAMS_WEBHOOK_URL || 'https://outlook.office.com/webhook/YOUR_WEBHOOK',
        credentials: {
          webhookUrl: process.env.MS_TEAMS_WEBHOOK_URL || 'YOUR_WEBHOOK_URL'
        },
        isActive: true,
        lastValidated: new Date()
      });
      
      await credentialRepository.save([cwCreds, nableCreds, teamsCreds]);
      logger.info('API credentials seeded successfully');
      logger.warn('⚠️  Remember to update with real credentials before production use!');
    } else {
      logger.info('API credentials already exist, skipping');
    }
    
    await AppDataSource.destroy();
    process.exit(0);
  } catch (error) {
    logger.error('Failed to seed credentials:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  seedCredentials();
}
