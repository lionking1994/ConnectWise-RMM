import { Router } from 'express';
import axios from 'axios';
import { AppDataSource } from '../database/dataSource';
import { ApiCredential, ApiProvider } from '../entities/ApiCredential';
import { logger } from '../utils/logger';
import { CredentialsService } from '../services/CredentialsService';

export const settingsRouter = Router();

// Get all settings
settingsRouter.get('/', async (req, res, next) => {
  try {
    const credentialsRepository = AppDataSource.getRepository(ApiCredential);
    
    // Get all API credentials
    const credentials = await credentialsRepository.find();
    
    // Build settings response
    const settings = {
      connectwise: credentials.find(c => c.provider === ApiProvider.CONNECTWISE) || {
        provider: ApiProvider.CONNECTWISE,
        isActive: false,
        lastSync: null,
        credentials: {}
      },
      nable: credentials.find(c => c.provider === ApiProvider.NABLE) || {
        provider: ApiProvider.NABLE,
        isActive: false,
        lastSync: null,
        credentials: {}
      },
      general: {
        syncInterval: process.env.SYNC_INTERVAL || '300000',
        maxRetries: process.env.MAX_RETRIES || '3',
        retryDelay: process.env.RETRY_DELAY || '5000'
      },
      notifications: {
        emailEnabled: process.env.EMAIL_ENABLED === 'true',
        slackEnabled: process.env.SLACK_ENABLED === 'true',
        teamsEnabled: process.env.TEAMS_ENABLED === 'true'
      }
    };
    
    res.json(settings);
  } catch (error) {
    logger.error('Error fetching settings:', error);
    next(error);
  }
});

// Update settings
settingsRouter.put('/', async (req, res, next) => {
  try {
    const credentialsRepository = AppDataSource.getRepository(ApiCredential);
    const { connectwise, nable, general, notifications } = req.body;
    
    const updatedSettings: any = { 
      general: general || {},
      notifications: notifications || {}
    };
    
    // Update ConnectWise credentials if provided
    if (connectwise) {
      let cwCredentials = await credentialsRepository.findOne({ 
        where: { provider: ApiProvider.CONNECTWISE } 
      });
      
      if (!cwCredentials) {
        cwCredentials = credentialsRepository.create({
          provider: ApiProvider.CONNECTWISE,
          name: 'ConnectWise Integration',
          credentials: {
            apiUrl: connectwise.apiUrl || 'https://api-na.myconnectwise.net/v2025_1/apis/3.0',
            apiKey: connectwise.apiKey,
            companyId: connectwise.companyId,
            publicKey: connectwise.publicKey,
            privateKey: connectwise.privateKey,
            clientId: connectwise.clientId,
            ...(connectwise.config || {})
          },
          isActive: connectwise.isActive || false
        });
      } else {
        // Update existing credentials
        cwCredentials.credentials = {
          ...cwCredentials.credentials,
          ...(connectwise.apiUrl && { apiUrl: connectwise.apiUrl }),
          ...(connectwise.apiKey && { apiKey: connectwise.apiKey }),
          ...(connectwise.companyId && { companyId: connectwise.companyId }),
          ...(connectwise.publicKey && { publicKey: connectwise.publicKey }),
          ...(connectwise.privateKey && { privateKey: connectwise.privateKey }),
          ...(connectwise.clientId && { clientId: connectwise.clientId }),
          ...(connectwise.config || {})
        };
        if (typeof connectwise.isActive === 'boolean') {
          cwCredentials.isActive = connectwise.isActive;
        }
      }
      
      updatedSettings.connectwise = await credentialsRepository.save(cwCredentials);
    }
    
    // Update N-able credentials if provided
    if (nable) {
      let nableCredentials = await credentialsRepository.findOne({ 
        where: { provider: ApiProvider.NABLE } 
      });
      
      if (!nableCredentials) {
        nableCredentials = credentialsRepository.create({
          provider: ApiProvider.NABLE,
          name: 'N-able Integration',
          credentials: {
            apiUrl: nable.apiUrl,
            apiKey: nable.apiKey,
            username: nable.username,
            password: nable.password,
            ...(nable.config || {})
          },
          isActive: nable.isActive || false
        });
      } else {
        // Update existing credentials
        nableCredentials.credentials = {
          ...nableCredentials.credentials,
          ...(nable.apiUrl && { apiUrl: nable.apiUrl }),
          ...(nable.apiKey && { apiKey: nable.apiKey }),
          ...(nable.username && { username: nable.username }),
          ...(nable.password && { password: nable.password }),
          ...(nable.config || {})
        };
        if (typeof nable.isActive === 'boolean') {
          nableCredentials.isActive = nable.isActive;
        }
      }
      
      updatedSettings.nable = await credentialsRepository.save(nableCredentials);
    }
    
    res.json({ 
      success: true, 
      message: 'Settings updated successfully',
      settings: updatedSettings 
    });
  } catch (error) {
    logger.error('Error updating settings:', error);
    next(error);
  }
});

// Test ConnectWise connection
settingsRouter.post('/test-connection/connectwise', async (req, res, next) => {
  try {
    const { url, companyId, publicKey, privateKey, clientId } = req.body;
    
    if (!url || !companyId || !publicKey || !privateKey) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters: url, companyId, publicKey, and privateKey',
        error: 'Invalid request'
      });
    }
    
    // Test ConnectWise API connection
    try {
      // ConnectWise uses Basic auth with format: companyId+publicKey:privateKey
      const authString = `${companyId}+${publicKey}:${privateKey}`;
      const encodedAuth = Buffer.from(authString).toString('base64');
      
      logger.info(`Testing ConnectWise with Company ID: ${companyId}, Client ID: ${clientId || 'not provided'}`);
      
      const testUrl = url.replace(/\/$/, ''); // Remove trailing slash
      
      // Build headers with optional Client ID
      const headers: any = {
        'Authorization': `Basic ${encodedAuth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };
      
      // Add Client ID if provided (required for some ConnectWise integrations)
      if (clientId) {
        headers['clientId'] = clientId;  // Note: lowercase 'clientId' as per ConnectWise docs
        logger.info('Including clientId header in request');
      }
      
      // Test with ConnectWise System Info endpoint (lightweight and reliable)
      const testResponse = await axios.get(`${testUrl}/system/info`, {
        headers,
        timeout: 10000 // 10 second timeout
      }).catch(async (error) => {
        // If system/info fails, try company/companies endpoint with limit
        if (error.response?.status === 404) {
          logger.info('System/info endpoint not found, trying company/companies');
          return await axios.get(`${testUrl}/company/companies`, {
            headers,
            params: { pageSize: 1 }, // Just get 1 company to test
            timeout: 10000
          });
        }
        throw error;
      });
      
      // If we got here, connection is successful
      logger.info('ConnectWise API connection successful');
      logger.info(`Response status: ${testResponse.status}`);
      
      // Extract version info if available
      const version = testResponse.data?.version || 'Unknown';
      const isCloud = testResponse.data?.isCloud || false;
      
      res.json({
      success: true,
      message: 'ConnectWise connection successful',
      details: {
          apiUrl: url,
        companyId,
          clientId: clientId || null,
        authenticated: true,
          version,
          isCloud,
        timestamp: new Date().toISOString()
        }
      });
      
    } catch (apiError: any) {
      logger.error('ConnectWise API test failed:', {
        message: apiError.message,
        code: apiError.code,
        status: apiError.response?.status,
        url: apiError.config?.url
      });
      
      // Check for specific error types
      if (apiError.code === 'ECONNREFUSED' || apiError.code === 'ENOTFOUND') {
        return res.status(400).json({
          success: false,
          message: 'Cannot reach ConnectWise API URL. Please check the URL is correct.',
          error: 'Connection refused'
        });
      } else if (apiError.response?.status === 401) {
        return res.status(400).json({
          success: false,
          message: 'Authentication failed. Please check your Company ID, Public Key, Private Key, and Client ID (if required).',
          error: 'Unauthorized',
          hint: 'Some ConnectWise integrations require a Client ID. Try with: 0ea93dc0-6921-4d58-919a-4433616ef054'
        });
      } else if (apiError.response?.status === 403) {
        return res.status(400).json({
          success: false,
          message: 'Access denied. Your API member may not have sufficient permissions.',
          error: 'Forbidden'
        });
      } else if (apiError.code === 'ETIMEDOUT') {
        return res.status(400).json({
          success: false,
          message: 'Connection timeout. Please check the URL and network connectivity.',
          error: 'Timeout'
        });
      } else if (apiError.response?.status === 404) {
        return res.status(400).json({
          success: false,
          message: 'API endpoint not found. Please check the API URL format.',
          error: 'Not Found',
          expectedFormat: 'https://api-na.myconnectwise.net/v4_6_release/apis/3.0'
        });
      }
      
      // Generic error
      return res.status(400).json({
        success: false,
        message: `Failed to connect to ConnectWise: ${apiError.message}`,
        error: apiError.message
      });
    }
    
  } catch (error: any) {
    logger.error('Error testing ConnectWise connection:', {
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Test N-able connection
// Reload credentials in services
settingsRouter.post('/reload-credentials', async (req, res, next) => {
  try {
    const { ConnectWiseService } = await import('../services/connectwise/ConnectWiseService');
    const { NableService } = await import('../services/nable/NableService');
    
    const cwService = ConnectWiseService.getInstance();
    const nableService = NableService.getInstance();
    
    await cwService.reloadCredentials();
    await nableService.reloadCredentials();
    
    logger.info('Reloaded credentials in all services');
    
    res.json({
      success: true,
      message: 'Credentials reloaded successfully'
    });
  } catch (error: any) {
    logger.error('Error reloading credentials:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reload credentials',
      error: error.message
    });
  }
});

settingsRouter.post('/test-connection/nable', async (req, res, next) => {
  try {
    const { accessKey, url } = req.body;
    
    if (!accessKey || !url) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters: accessKey and url',
        error: 'Invalid request'
      });
    }
    
    // Test N-sight RMM API connection
    // Based on official documentation: https://developer.n-able.com/n-sight/docs/getting-started-with-the-n-sight-api
    // Format: https://{server}/api/?apikey={yourAPIkey}&service={service_name}
    try {
      // Clean the URL - ensure it ends with /api (not /api/)
      let baseUrl = url.replace(/\/+$/, ''); // Remove trailing slashes
      if (!baseUrl.endsWith('/api')) {
        baseUrl = baseUrl + '/api';
      }
      
      // Build URL with query parameters as per N-sight documentation
      const testUrl = new URL(baseUrl);
      testUrl.searchParams.append('apikey', accessKey);
      testUrl.searchParams.append('service', 'list_clients'); // Simple service to test
      
      logger.info(`Testing N-sight API with URL: ${testUrl.toString().substring(0, 80)}...`);
      
      const testResponse = await axios.get(testUrl.toString(), {
        timeout: 10000, // 10 second timeout
        headers: {
          'Accept': 'application/json, text/plain, */*'
        },
        validateStatus: function (status) {
          // Accept any status code to handle properly
          return true;
        }
      });
      
      const responseData = testResponse.data;
      const status = testResponse.status;
      
      logger.info(`N-sight API response status: ${status}`);
      
      // Handle different status codes as per working test script
      if (status === 200) {
        // Success - check response type
        let responseInfo = '';
        
        try {
          if (Array.isArray(responseData)) {
            responseInfo = `Returned ${responseData.length} items`;
            logger.info(`N-sight API success: ${responseInfo}`);
          } else if (responseData && typeof responseData === 'object' && responseData.result) {
            responseInfo = `Result: ${responseData.result}`;
            logger.info(`N-sight API success: ${responseInfo}`);
          } else if (responseData) {
            responseInfo = 'Data received successfully';
            logger.info('N-sight API success: Data received');
          }
        } catch (e) {
          responseInfo = 'Response received (non-JSON)';
          logger.info('N-sight API success: Non-JSON response');
        }
        
        return res.json({
          success: true,
          message: 'N-sight API connection successful',
          details: {
            apiUrl: url,
            authenticated: true,
            service: 'N-sight RMM', 
            response: responseInfo,
            timestamp: new Date().toISOString()
          }
        });
        
      } else if (status === 401) {
        logger.error('N-sight API: Authentication failed - Invalid API key');
        return res.status(401).json({
          success: false,
          message: 'Authentication failed - Invalid API key',
          error: 'INVALID_API_KEY',
          details: {
            help: 'Please check your N-sight API key in System > API Keys'
          }
        });
        
      } else if (status === 403) {
        logger.error('N-sight API: Forbidden - API key lacks permissions');
        return res.status(403).json({
          success: false,
          message: 'Forbidden - API key lacks permissions',
          error: 'FORBIDDEN',
          details: {
            help: 'Please check API key permissions in N-sight dashboard'
          }
        });
        
      } else if (status === 400) {
        // Bad request - check if it's about invalid service
        const responseStr = typeof responseData === 'string' ? responseData : JSON.stringify(responseData);
        
        if (responseStr.includes('Invalid service') || responseStr.includes('Service not found')) {
          logger.warn('N-sight API: Service not recognized, but connection works');
          // Service doesn't exist but API is reachable - still a success
          return res.json({
            success: true,
            message: 'N-sight API connected (service not available)',
            warning: 'The test service is not available, but API is reachable',
            details: {
              apiUrl: url,
              authenticated: true,
              service: 'N-sight RMM',
              timestamp: new Date().toISOString()
            }
          });
        }
        
        logger.error('N-sight API: Bad request');
        return res.status(400).json({
          success: false,
          message: 'Bad request - Please check API configuration',
          error: 'BAD_REQUEST'
        });
        
      } else if (status === 404) {
        logger.error('N-sight API: Endpoint not found');
        return res.status(404).json({
          success: false,
          message: 'API endpoint not found - Please check the server URL',
          error: 'NOT_FOUND',
          details: {
            help: 'Ensure URL ends with /api (e.g., https://www.systemmonitor.us/api)'
          }
        });
        
      } else if (status >= 500) {
        logger.error(`N-sight API: Server error ${status}`);
        return res.status(500).json({
          success: false,
          message: `N-sight server error (${status})`,
          error: 'SERVER_ERROR'
        });
        
      } else {
        // Unexpected status but not an error
        logger.warn(`N-sight API: Unexpected status ${status}`);
        return res.json({
      success: true,
          message: 'N-sight API reachable',
          warning: `Unexpected response status: ${status}`,
      details: {
            apiUrl: url,
        authenticated: true,
            status: status,
        timestamp: new Date().toISOString()
          }
        });
      }
      
    } catch (apiError: any) {
      logger.error('N-sight API connection error:', {
        message: apiError.message,
        code: apiError.code,
        status: apiError.response?.status
      });
      
      // Connection errors
      if (apiError.code === 'ECONNREFUSED' || apiError.code === 'ENOTFOUND') {
        return res.status(400).json({
          success: false,
          message: 'Cannot connect to N-sight server. Please check the URL.',
          error: 'CONNECTION_FAILED',
          details: {
            help: 'Verify the server URL is correct for your region',
            urls: {
              'North America': 'https://www.systemmonitor.us/api',
              'Europe': 'https://www.systemmonitor.eu.com/api',
              'Australia': 'https://www.systemmonitor.com.au/api'
            }
          }
        });
      } 
      
      // Timeout
      else if (apiError.code === 'ETIMEDOUT' || apiError.code === 'ECONNABORTED') {
        return res.status(408).json({
          success: false,
          message: 'Connection timeout after 10 seconds',
          error: 'TIMEOUT',
          details: {
            help: 'Check network connectivity and firewall settings'
          }
        });
      }
      
      // SSL/TLS errors
      else if (apiError.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' || 
               apiError.code === 'CERT_HAS_EXPIRED') {
        return res.status(400).json({
          success: false,
          message: 'SSL certificate error',
          error: 'SSL_ERROR',
          details: {
            help: 'There may be an issue with the SSL certificate'
          }
        });
      }
      
      // Generic network error
      else {
        return res.status(500).json({
          success: false,
          message: `Connection error: ${apiError.message}`,
          error: 'CONNECTION_ERROR',
          details: {
            code: apiError.code,
            help: 'Please verify your N-sight API configuration'
          }
        });
      }
    }
    
  } catch (error: any) {
    logger.error('Error testing N-able connection:', {
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});