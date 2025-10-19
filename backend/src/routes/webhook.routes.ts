import { Router } from 'express';
import { WebhookService } from '../services/WebhookService';

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


