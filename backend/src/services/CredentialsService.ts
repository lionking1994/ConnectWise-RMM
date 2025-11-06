import { AppDataSource } from '../database/dataSource';
import { ApiCredential, ApiProvider } from '../entities/ApiCredential';
import { logger } from '../utils/logger';

export interface ConnectWiseCredentials {
  apiUrl: string;
  companyId: string;
  publicKey: string;
  privateKey: string;
  clientId?: string;
}

export interface NableCredentials {
  apiUrl: string;
  apiKey: string;
  partnerName?: string;
}

export class CredentialsService {
  private static instance: CredentialsService;
  private credentialRepository = AppDataSource.getRepository(ApiCredential);
  private cachedCWCredentials: ConnectWiseCredentials | null = null;
  private cachedNableCredentials: NableCredentials | null = null;
  private cacheTime: number = 0;
  private CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  static getInstance(): CredentialsService {
    if (!CredentialsService.instance) {
      CredentialsService.instance = new CredentialsService();
    }
    return CredentialsService.instance;
  }

  async getConnectWiseCredentials(): Promise<ConnectWiseCredentials | null> {
    // Check cache
    if (this.cachedCWCredentials && Date.now() - this.cacheTime < this.CACHE_TTL) {
      return this.cachedCWCredentials;
    }

    try {
      // Load from database
      const credential = await this.credentialRepository.findOne({
        where: { provider: ApiProvider.CONNECTWISE as any, isActive: true },
        order: { updatedAt: 'DESC' }
      });

      if (!credential || !credential.credentials) {
        // Fall back to environment variables
        if (process.env.CONNECTWISE_API_URL && process.env.CONNECTWISE_COMPANY_ID) {
          this.cachedCWCredentials = {
            apiUrl: process.env.CONNECTWISE_API_URL,
            companyId: process.env.CONNECTWISE_COMPANY_ID,
            publicKey: process.env.CONNECTWISE_PUBLIC_KEY || '',
            privateKey: process.env.CONNECTWISE_PRIVATE_KEY || '',
            clientId: process.env.CONNECTWISE_CLIENT_ID
          };
          this.cacheTime = Date.now();
          return this.cachedCWCredentials;
        }
        return null;
      }

      // Decrypt and parse credentials
      const decrypted = credential.credentials as any;
      this.cachedCWCredentials = {
        apiUrl: decrypted.apiUrl || decrypted.url,
        companyId: decrypted.companyId,
        publicKey: decrypted.publicKey,
        privateKey: decrypted.privateKey,
        clientId: decrypted.clientId
      };
      this.cacheTime = Date.now();

      logger.info('Loaded ConnectWise credentials from database');
      return this.cachedCWCredentials;
    } catch (error) {
      logger.error('Error loading ConnectWise credentials:', error);
      return null;
    }
  }

  async getNableCredentials(): Promise<NableCredentials | null> {
    // Check cache
    if (this.cachedNableCredentials && Date.now() - this.cacheTime < this.CACHE_TTL) {
      return this.cachedNableCredentials;
    }

    try {
      // Load from database
      const credential = await this.credentialRepository.findOne({
        where: { provider: ApiProvider.NABLE as any, isActive: true },
        order: { updatedAt: 'DESC' }
      });

      if (!credential || !credential.credentials) {
        // Fall back to environment variables
        if (process.env.NABLE_API_URL && process.env.NABLE_API_KEY) {
          this.cachedNableCredentials = {
            apiUrl: process.env.NABLE_API_URL || process.env.NSIGHT_API_URL || 'https://www.systemmonitor.us',
            apiKey: process.env.NABLE_API_KEY,
            partnerName: process.env.NSIGHT_PARTNER_NAME
          };
          this.cacheTime = Date.now();
          return this.cachedNableCredentials;
        }
        return null;
      }

      // Decrypt and parse credentials
      const decrypted = credential.credentials as any;
      this.cachedNableCredentials = {
        apiUrl: decrypted.url || decrypted.apiUrl,
        apiKey: decrypted.accessKey || decrypted.apiKey,
        partnerName: decrypted.partnerName
      };
      this.cacheTime = Date.now();

      logger.info('Loaded N-able credentials from database');
      return this.cachedNableCredentials;
    } catch (error) {
      logger.error('Error loading N-able credentials:', error);
      return null;
    }
  }

  async saveConnectWiseCredentials(creds: ConnectWiseCredentials): Promise<void> {
    try {
      // Find existing or create new
      let credential = await this.credentialRepository.findOne({
        where: { provider: ApiProvider.CONNECTWISE as any }
      });

      if (!credential) {
        credential = this.credentialRepository.create({
          provider: ApiProvider.CONNECTWISE as any,
          name: 'ConnectWise PSA'
        });
      }

      credential.credentials = {
        apiUrl: creds.apiUrl,
        companyId: creds.companyId,
        publicKey: creds.publicKey,
        privateKey: creds.privateKey,
        clientId: creds.clientId
      };
      credential.isActive = true;
      credential.updatedAt = new Date();

      await this.credentialRepository.save(credential);
      
      // Clear cache
      this.cachedCWCredentials = null;
      logger.info('Saved ConnectWise credentials to database');
    } catch (error) {
      logger.error('Error saving ConnectWise credentials:', error);
      throw error;
    }
  }

  async saveNableCredentials(creds: NableCredentials): Promise<void> {
    try {
      // Find existing or create new
      let credential = await this.credentialRepository.findOne({
        where: { provider: ApiProvider.NABLE as any }
      });

      if (!credential) {
        credential = this.credentialRepository.create({
          provider: ApiProvider.NABLE as any,
          name: 'N-able N-sight RMM'
        });
      }

      credential.credentials = {
        url: creds.apiUrl,
        apiUrl: creds.apiUrl,
        accessKey: creds.apiKey,
        apiKey: creds.apiKey,
        partnerName: creds.partnerName
      };
      credential.isActive = true;
      credential.updatedAt = new Date();

      await this.credentialRepository.save(credential);
      
      // Clear cache
      this.cachedNableCredentials = null;
      logger.info('Saved N-able credentials to database');
    } catch (error) {
      logger.error('Error saving N-able credentials:', error);
      throw error;
    }
  }

  clearCache(): void {
    this.cachedCWCredentials = null;
    this.cachedNableCredentials = null;
    this.cacheTime = 0;
  }
}
