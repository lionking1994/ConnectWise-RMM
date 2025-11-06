import Bull from 'bull';
import { logger } from '../utils/logger';

let automationQueue: Bull.Queue;
let notificationQueue: Bull.Queue;
let webhookQueue: Bull.Queue;

export async function initializeQueues(): Promise<void> {
  const redisConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  };

  // Automation processing queue
  automationQueue = new Bull('automation', { redis: redisConfig });
  
  // Notification queue
  notificationQueue = new Bull('notifications', { redis: redisConfig });
  
  // Webhook processing queue
  webhookQueue = new Bull('webhooks', { redis: redisConfig });

  // Set up queue processors
  automationQueue.process(async (job) => {
    logger.info(`Processing automation job: ${job.id}`);
    // Process automation job
    return { success: true };
  });

  notificationQueue.process(async (job) => {
    logger.info(`Processing notification job: ${job.id}`);
    // Process notification job
    return { success: true };
  });

  webhookQueue.process(async (job) => {
    logger.info(`Processing webhook job: ${job.id}`);
    // Process webhook job
    return { success: true };
  });

}

export { automationQueue, notificationQueue, webhookQueue };


