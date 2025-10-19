import { Router } from 'express';
import { NotificationService } from '../services/NotificationService';

export const notificationRouter = Router();

// Send test notification
notificationRouter.post('/test', async (req, res, next) => {
  try {
    const { channel, recipient } = req.body;
    const notificationService = NotificationService.getInstance();
    await notificationService.sendTestNotification(channel, recipient);
    res.json({ message: 'Test notification sent' });
  } catch (error) {
    next(error);
  }
});


