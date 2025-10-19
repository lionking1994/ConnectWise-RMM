import { AppDataSource } from '../database/dataSource';
import { WebhookEvent, WebhookSource, WebhookStatus } from '../entities/WebhookEvent';
import { AutomationEngine } from './automation/AutomationEngine';
import { logger } from '../utils/logger';
import crypto from 'crypto';

export class WebhookService {
  private static instance: WebhookService;
  private webhookRepository = AppDataSource.getRepository(WebhookEvent);
  private automationEngine: AutomationEngine;

  private constructor() {
    this.automationEngine = AutomationEngine.getInstance();
  }

  public static getInstance(): WebhookService {
    if (!WebhookService.instance) {
      WebhookService.instance = new WebhookService();
    }
    return WebhookService.instance;
  }

  async initialize(): Promise<void> {
    logger.info('Webhook service initialized');
  }

  async handleConnectWiseWebhook(payload: any, headers: any): Promise<void> {
    const webhook = this.webhookRepository.create({
      source: WebhookSource.CONNECTWISE,
      eventType: payload.Type || 'unknown',
      payload,
      headers,
      status: WebhookStatus.PROCESSING
    });

    await this.webhookRepository.save(webhook);

    try {
      // Verify webhook signature if configured
      if (process.env.CONNECTWISE_WEBHOOK_SECRET) {
        const isValid = this.verifyConnectWiseSignature(payload, headers);
        if (!isValid) {
          throw new Error('Invalid webhook signature');
        }
      }

      // Process based on event type
      await this.processConnectWiseEvent(payload);

      webhook.status = WebhookStatus.PROCESSED;
      webhook.processedAt = new Date();
    } catch (error: any) {
      logger.error('Failed to process ConnectWise webhook:', error);
      webhook.status = WebhookStatus.FAILED;
      webhook.error = error.message;
    }

    await this.webhookRepository.save(webhook);
  }

  async handleNableWebhook(payload: any, headers: any): Promise<void> {
    const webhook = this.webhookRepository.create({
      source: WebhookSource.NABLE,
      eventType: payload.eventType || 'unknown',
      payload,
      headers,
      status: WebhookStatus.PROCESSING
    });

    await this.webhookRepository.save(webhook);

    try {
      // Process based on event type
      await this.processNableEvent(payload);

      webhook.status = WebhookStatus.PROCESSED;
      webhook.processedAt = new Date();
    } catch (error: any) {
      logger.error('Failed to process N-able webhook:', error);
      webhook.status = WebhookStatus.FAILED;
      webhook.error = error.message;
    }

    await this.webhookRepository.save(webhook);
  }

  private verifyConnectWiseSignature(payload: any, headers: any): boolean {
    // Implement signature verification logic
    return true;
  }

  private async processConnectWiseEvent(payload: any): Promise<void> {
    const eventType = payload.Type;

    switch (eventType) {
      case 'TicketCreated':
      case 'TicketUpdated':
        await this.automationEngine.processAlert(payload, 'connectwise');
        break;
      default:
        logger.info(`Unhandled ConnectWise event type: ${eventType}`);
    }
  }

  private async processNableEvent(payload: any): Promise<void> {
    const eventType = payload.eventType;

    switch (eventType) {
      case 'alert.created':
      case 'alert.updated':
        await this.automationEngine.processAlert(payload, 'nable');
        break;
      default:
        logger.info(`Unhandled N-able event type: ${eventType}`);
    }
  }
}


