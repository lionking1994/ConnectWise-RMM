import { Router } from 'express';
import { AppDataSource } from '../database/dataSource';
import { ApiCredential } from '../entities/ApiCredential';
import { Ticket } from '../entities/Ticket';
import { SyncService } from '../services/SyncService';
import { NableNsightService } from '../services/nable/NableNsightService';
import { logger } from '../utils/logger';

export const nableRouter = Router();

/**
 * N-able/N-sight API Routes
 * Based on: https://developer.n-able.com/n-sight/docs/
 */

// Get N-able service status
nableRouter.get('/status', async (req, res, next) => {
  try {
    const credentialRepository = AppDataSource.getRepository(ApiCredential);
    
    // Check for N-able/N-sight credentials
    const nableCredential = await credentialRepository.findOne({
      where: { provider: 'nable' as any, isActive: true }
    });
    
    if (!nableCredential) {
      return res.json({
        connected: false,
        service: null,
        message: 'No active N-able credentials found'
      });
    }
    
    // Check which type of N-able service
    const isNsight = !nableCredential.credentials.apiSecret; // N-sight only has API key
    
    res.json({
      connected: true,
      service: isNsight ? 'n-sight' : 'nable-rmm',
      apiUrl: nableCredential.credentials.apiUrl,
      lastSync: nableCredential.updatedAt
    });
  } catch (error) {
    next(error);
  }
});

// List failing checks/alerts from N-sight API
nableRouter.get('/alerts', async (req, res, next) => {
  try {
    const { clientId, checkType } = req.query;
    const syncService = SyncService.getInstance();
    
    // Get N-sight service instance
    const nsightService = (syncService as any).nsightService;
    
    if (!nsightService) {
      return res.status(400).json({
        error: 'N-sight service not initialized'
      });
    }
    
    logger.info('Fetching failing checks from N-sight API', { clientId, checkType });
    
    // Fetch failing checks (alerts)
    const failingChecks = await nsightService.listFailingChecks(
      clientId as string,
      checkType as 'checks' | 'tasks' | 'random'
    );
    
    // Transform to a simpler format for frontend
    const alerts = [];
    for (const client of failingChecks.clients || []) {
      for (const site of client.sites || []) {
        for (const workstation of site.workstations || []) {
          for (const check of workstation.failedChecks || []) {
            alerts.push({
              deviceId: workstation.id,
              deviceName: workstation.name,
              deviceType: 'workstation',
              clientName: client.name,
              siteName: site.name,
              checkId: check.checkId,
              checkType: check.checkType,
              description: check.description,
              status: check.checkStatus,
              output: check.formattedOutput,
              failedAt: `${check.date} ${check.time}`,
              is247: check.dsc247
            });
          }
        }
        
        for (const server of site.servers || []) {
          for (const check of server.failedChecks || []) {
            alerts.push({
              deviceId: server.id,
              deviceName: server.name,
              deviceType: 'server',
              clientName: client.name,
              siteName: site.name,
              checkId: check.checkId,
              checkType: check.checkType,
              description: check.description,
              status: check.checkStatus,
              output: check.formattedOutput,
              failedAt: `${check.date} ${check.time}`,
              is247: check.dsc247,
              offline: server.offline,
              overdue: server.overdue,
              unreachable: server.unreachable
            });
          }
        }
      }
    }
    
    res.json({
      total: alerts.length,
      alerts: alerts
    });
  } catch (error: any) {
    logger.error('Failed to fetch N-sight alerts:', error);
    res.status(500).json({
      error: 'Failed to fetch alerts',
      message: error.message
    });
  }
});

// Sync alerts from N-able/N-sight
nableRouter.post('/sync', async (req, res, next) => {
  try {
    const syncService = SyncService.getInstance();
    
    logger.info('Manual N-able sync triggered');
    const count = await syncService.syncNableAlerts();
    
    res.json({
      success: true,
      message: `Synced ${count} alerts from N-able`,
      count: count
    });
  } catch (error: any) {
    logger.error('N-able sync failed:', error);
    res.status(500).json({
      success: false,
      error: 'Sync failed',
      message: error.message
    });
  }
});

// Trigger remediation script on device
nableRouter.post('/remediate', async (req, res, next) => {
  try {
    const { deviceId, taskId, ticketId, parameters } = req.body;
    
    if (!deviceId || !taskId) {
      return res.status(400).json({
        error: 'deviceId and taskId are required'
      });
    }
    
    const syncService = SyncService.getInstance();
    
    // Get N-sight service instance
    const nsightService = (syncService as any).nsightService;
    
    if (!nsightService) {
      return res.status(400).json({
        error: 'N-sight service not initialized'
      });
    }
    
    logger.info('Triggering remediation task', { deviceId, taskId, ticketId });
    
    // Run the task on the device
    const result = await nsightService.runTaskNow(
      deviceId,
      taskId,
      parameters
    );
    
    // Update ticket if provided
    if (ticketId && result.success) {
      const ticketRepository = AppDataSource.getRepository(Ticket);
      const ticket = await ticketRepository.findOne({
        where: { id: ticketId }
      });
      
      if (ticket) {
        ticket.status = 'in_progress' as any;
        if (!ticket.notes) {
          ticket.notes = [];
        }
        ticket.notes.push({
          id: `remediation-${Date.now()}`,
          text: `Remediation script triggered: Task ${taskId}`,
          author: 'N-able Integration',
          timestamp: new Date(),
          type: 'automation' as const
        });
        ticket.metadata = {
          ...ticket.metadata,
          customFields: {
            ...ticket.metadata?.customFields,
            lastRemediation: {
              taskId: taskId,
              deviceId: deviceId,
              triggeredAt: new Date(),
              result: result
            }
          }
        };
        await ticketRepository.save(ticket);
      }
    }
    
    res.json({
      success: result.success,
      message: result.message || 'Remediation task triggered',
      taskId: result.taskId,
      error: result.error
    });
  } catch (error: any) {
    logger.error('Failed to trigger remediation:', error);
    res.status(500).json({
      error: 'Failed to trigger remediation',
      message: error.message
    });
  }
});

// List available tasks/scripts
nableRouter.get('/tasks', async (req, res, next) => {
  try {
    const { deviceId } = req.query;
    
    // This would be implemented based on N-sight API documentation
    // For now, return a sample list of common remediation tasks
    const tasks = [
      {
        id: 'restart-service',
        name: 'Restart Windows Service',
        description: 'Restarts a specified Windows service',
        parameters: ['serviceName']
      },
      {
        id: 'clear-disk-space',
        name: 'Clear Disk Space',
        description: 'Clears temporary files and old logs',
        parameters: []
      },
      {
        id: 'restart-device',
        name: 'Restart Device',
        description: 'Schedules a device restart',
        parameters: ['delayMinutes']
      },
      {
        id: 'update-antivirus',
        name: 'Update Antivirus Definitions',
        description: 'Forces an antivirus definition update',
        parameters: []
      },
      {
        id: 'run-custom-script',
        name: 'Run Custom PowerShell Script',
        description: 'Executes a custom PowerShell script',
        parameters: ['scriptContent']
      }
    ];
    
    res.json({
      tasks: tasks,
      deviceId: deviceId
    });
  } catch (error: any) {
    logger.error('Failed to list tasks:', error);
    res.status(500).json({
      error: 'Failed to list tasks',
      message: error.message
    });
  }
});

// Test N-able/N-sight connection
nableRouter.post('/test-connection', async (req, res, next) => {
  try {
    const syncService = SyncService.getInstance();
    
    const isConnected = await syncService.testNableConnection();
    
    res.json({
      success: isConnected,
      message: isConnected ? 'N-able connection successful' : 'N-able connection failed'
    });
  } catch (error: any) {
    logger.error('N-able connection test failed:', error);
    res.status(500).json({
      success: false,
      error: 'Connection test failed',
      message: error.message
    });
  }
});
