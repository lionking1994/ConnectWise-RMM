import { Router } from 'express';
import { AppDataSource } from '../database/dataSource';
import { ApiCredential } from '../entities/ApiCredential';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { SyncService } from '../services/SyncService';
import axios from 'axios';

export const credentialsRouter = Router();

// Repository instance
const credentialRepository = AppDataSource.getRepository(ApiCredential);
const syncService = SyncService.getInstance();

// Apply auth middleware to all routes
credentialsRouter.use(authMiddleware);

// Get all API credentials
credentialsRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const credentials = await credentialRepository.find({
      order: { createdAt: 'DESC' }
    });
    
    // Hide sensitive data
    const sanitizedCredentials = credentials.map(cred => ({
      id: cred.id,
      name: cred.name,
      provider: cred.provider,
      credentials: {
        apiUrl: cred.credentials.apiUrl,
        companyId: cred.credentials.companyId,
        clientId: cred.credentials.clientId,
        // Hide sensitive fields
      },
      isActive: cred.isActive,
      lastTestAt: cred.lastTestAt,
      lastTestStatus: cred.lastTestStatus,
      lastTestMessage: cred.lastTestMessage,
      createdAt: cred.createdAt,
      updatedAt: cred.updatedAt
    }));
    
    res.json(sanitizedCredentials);
  } catch (error) {
    next(error);
  }
});

// Get single API credential
credentialsRouter.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const credential = await credentialRepository.findOne({
      where: { id: req.params.id }
    });
    
    if (!credential) {
      return res.status(404).json({ message: 'Credential not found' });
    }
    
    // Hide sensitive data
    const sanitizedCredential = {
      id: credential.id,
      name: credential.name,
      provider: credential.provider,
      credentials: {
        apiUrl: credential.credentials.apiUrl,
        companyId: credential.credentials.companyId,
        clientId: credential.credentials.clientId,
        // Hide sensitive fields
      },
      isActive: credential.isActive,
      lastTestAt: credential.lastTestAt,
      lastTestStatus: credential.lastTestStatus,
      lastTestMessage: credential.lastTestMessage,
      createdAt: credential.createdAt,
      updatedAt: credential.updatedAt
    };
    
    res.json(sanitizedCredential);
  } catch (error) {
    next(error);
  }
});

// Create new API credential
credentialsRouter.post('/', async (req: AuthRequest, res, next) => {
  try {
    const newCredential = credentialRepository.create(req.body);
    const savedCredential = await credentialRepository.save(newCredential);
    
    logger.info('API credential created');
    
    res.status(201).json(savedCredential);
  } catch (error) {
    next(error);
  }
});

// Update API credential
credentialsRouter.put('/:id', async (req: AuthRequest, res, next) => {
  try {
    const credential = await credentialRepository.findOne({
      where: { id: req.params.id }
    });
    
    if (!credential) {
      return res.status(404).json({ message: 'Credential not found' });
    }
    
    Object.assign(credential, req.body);
    await credentialRepository.save(credential);
    
    logger.info('API credential updated');
    
    res.json(credential);
  } catch (error) {
    next(error);
  }
});

// Delete API credential
credentialsRouter.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const credential = await credentialRepository.findOne({
      where: { id: req.params.id }
    });
    
    if (!credential) {
      return res.status(404).json({ message: 'Credential not found' });
    }
    
    await credentialRepository.remove(credential);
    
    logger.info('API credential deleted');
    
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// Test API connection
credentialsRouter.post('/:id/test', async (req: AuthRequest, res, next) => {
  try {
    const credential = await credentialRepository.findOne({
      where: { id: req.params.id }
    });
    
    if (!credential) {
      return res.status(404).json({ message: 'Credential not found' });
    }
    
    let testResult = { 
      success: false, 
      message: '', 
      data: null as any,
      timestamp: new Date()
    };

    try {
      if (credential.provider === 'connectwise') {
        // Test ConnectWise connection
        const authString = `${credential.credentials.companyId}+${credential.credentials.publicKey}:${credential.credentials.privateKey}`;
        const encodedAuth = Buffer.from(authString).toString('base64');
        
        const response = await axios.get(`${credential.credentials.apiUrl}/system/info`, {
          headers: {
            'Authorization': `Basic ${encodedAuth}`,
            'clientId': credential.credentials.clientId || ''
          },
          timeout: 10000
        });

        testResult.success = true;
        testResult.message = 'ConnectWise connection successful';
        testResult.data = { 
          version: response.data.version,
          isCloud: response.data.isCloud 
        };

      } else if (credential.provider === 'nable') {
        // Check if this is N-sight API or N-able RMM
        if (credential.credentials.apiKey && !credential.credentials.apiSecret) {
          // N-sight API format (API key only, no secret)
          const { NableNsightService } = await import('../services/nable/NableNsightService');
          const nsightService = NableNsightService.getInstance(
            credential.credentials.apiKey,
            credential.credentials.apiUrl
          );
          
          const isConnected = await nsightService.testConnection();
          testResult.success = isConnected;
          testResult.message = isConnected ? 'N-sight API connection successful' : 'N-sight API connection failed';
          testResult.data = { connected: isConnected };
        } else {
          // N-able RMM API format (API key and secret)
          const response = await axios.get(`${credential.credentials.apiUrl}/devices`, {
            headers: {
              'Authorization': `Bearer ${credential.credentials.apiKey}`,
              'X-API-Secret': credential.credentials.apiSecret || ''
            },
            params: { pageSize: 1 },
            timeout: 10000
          });

          testResult.success = true;
          testResult.message = 'N-able RMM connection successful';
          testResult.data = { 
            deviceCount: response.data.totalItems || 0
          };
        }

      } else {
        testResult.message = 'Unknown provider';
      }
    } catch (error: any) {
      testResult.success = false;
      testResult.message = error.response?.data?.message || error.message || 'Connection failed';
      logger.error(`Credential test failed for ${credential.name}:`, error.response?.data || error.message);
    }

    // Update credential test status
    credential.lastTestAt = new Date();
    credential.lastTestStatus = testResult.success ? 'success' : 'failed';
    credential.lastTestMessage = testResult.message;
    await credentialRepository.save(credential);

    // If test successful and credential is active, reinitialize the sync service
    if (testResult.success && credential.isActive) {
      await syncService.initialize();
      logger.info('Sync service reinitialized with new credentials');
    }
    
    res.json(testResult);
  } catch (error) {
    next(error);
  }
});

// Activate/Deactivate credential
credentialsRouter.post('/:id/toggle', async (req: AuthRequest, res, next) => {
  try {
    const credential = await credentialRepository.findOne({
      where: { id: req.params.id }
    });
    
    if (!credential) {
      return res.status(404).json({ message: 'Credential not found' });
    }
    
    credential.isActive = !credential.isActive;
    await credentialRepository.save(credential);

    // Reinitialize sync service to use new credentials
    await syncService.initialize();

    logger.info(`API credential ${credential.isActive ? 'activated' : 'deactivated'}: ${credential.name}`);

    res.json({ 
      success: true, 
      isActive: credential.isActive,
      message: `Credential ${credential.isActive ? 'activated' : 'deactivated'}` 
    });
  } catch (error) {
    next(error);
  }
});
