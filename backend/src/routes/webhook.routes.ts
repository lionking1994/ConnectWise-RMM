import { Router } from 'express';
import { WebhookService } from '../services/WebhookService';
import { TeamsService } from '../services/teams/TeamsService';
import { logger } from '../utils/logger';
import { AppDataSource } from '../database/dataSource';
import { AuditLog, AuditAction } from '../entities/AuditLog';

export const webhookRouter = Router();

// ConnectWise webhook
webhookRouter.post('/connectwise', async (req, res, next) => {
  try {
    const webhookService = WebhookService.getInstance();
    await webhookService.handleConnectWiseWebhook(req.body, req.headers);
    res.status(200).json({ received: true });
  } catch (error) {
    next(error);
  }
});

// N-able webhook
webhookRouter.post('/nable', async (req, res, next) => {
  try {
    const webhookService = WebhookService.getInstance();
    await webhookService.handleNableWebhook(req.body, req.headers);
    res.status(200).json({ received: true });
  } catch (error) {
    next(error);
  }
});

// Teams interactive webhook endpoint
webhookRouter.post('/teams/action', async (req, res) => {
  try {
    logger.info('Received Teams action webhook:', req.body);
    
    const teamsService = TeamsService.getInstance();
    const command = req.body;
    
    // Extract note text if it's an add_note action
    if (command.action === 'add_note' && req.body.noteText) {
      command.additionalData = { note: req.body.noteText };
    }
    
    // Execute the command
    const result = await teamsService.handleCommand(command);
    
    // Log the action
    const auditRepo = AppDataSource.getRepository(AuditLog);
    await auditRepo.save({
      userId: command.userId || 'teams-bot',
      action: AuditAction.UPDATE,
      entity: command.entityType,
      entityId: command.entityId,
      details: {
        action: command.action,
        result: result.success ? 'success' : 'failed',
        message: result.message
      },
      ipAddress: req.ip || 'teams-webhook'
    });
    
    // Send response card back to Teams if provided
    if (result.card) {
      res.json({
        type: 'message',
        text: result.message,
        attachments: [{
          contentType: 'application/vnd.microsoft.card.adaptive',
          content: result.card
        }]
      });
    } else {
      res.json({ type: 'message', text: result.message });
    }
  } catch (error) {
    logger.error('Error processing Teams action:', error);
    res.status(500).json({ 
      type: 'message', 
      text: 'Error processing action. Please try again.' 
    });
  }
});

// Teams command webhook endpoint (for slash commands)
webhookRouter.post('/teams/command', async (req, res) => {
  try {
    logger.info('Received Teams command webhook:', req.body);
    
    const { text, from } = req.body;
    const teamsService = TeamsService.getInstance();
    
    // Parse command and parameters
    const [command, ...params] = text.split(' ');
    const parameters = params.join(' ');
    
    // Handle the command
    const response = await teamsService.handleTeamsCommand(command, { 
      parameters, 
      userId: from?.id 
    });
    
    res.json({ type: 'message', text: response });
  } catch (error) {
    logger.error('Error processing Teams command:', error);
    res.status(500).json({ 
      type: 'message', 
      text: 'Error processing command. Please try again.' 
    });
  }
});

