import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import rateLimit from 'express-rate-limit';

import { AppDataSource } from './database/dataSource';
import { errorHandler } from './middleware/errorHandler';
import { authRouter } from './routes/auth.routes';
import { ticketRouter } from './routes/ticket.routes';
import { automationRouter } from './routes/automation.routes';
import { webhookRouter } from './routes/webhook.routes';
import { analyticsRouter } from './routes/analytics.routes';
import { notificationRouter } from './routes/notification.routes';
import { logger } from './utils/logger';
import { AutomationEngine } from './services/automation/AutomationEngine';
import { WebhookService } from './services/WebhookService';
import { initializeQueues } from './queues';
import { initializeCronJobs } from './jobs/cronJobs';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
  }
});

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: 'Too many requests from this IP, please try again later.'
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));
app.use('/api', limiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/tickets', ticketRouter);
app.use('/api/automation', automationRouter);
app.use('/api/webhooks', webhookRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/notifications', notificationRouter);

// Socket.IO connection handling
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);

  socket.on('subscribe', (room: string) => {
    socket.join(room);
    logger.info(`Client ${socket.id} joined room: ${room}`);
  });

  socket.on('unsubscribe', (room: string) => {
    socket.leave(room);
    logger.info(`Client ${socket.id} left room: ${room}`);
  });

  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Make io accessible to routes
app.set('io', io);

const PORT = process.env.PORT || 3001;

async function startServer() {
  try {
    // Initialize database connection
    await AppDataSource.initialize();
    logger.info('Database connection established');

    // Run migrations
    await AppDataSource.runMigrations();
    logger.info('Database migrations completed');

    // Initialize queues
    await initializeQueues();
    logger.info('Message queues initialized');

    // Initialize automation engine
    const automationEngine = AutomationEngine.getInstance();
    await automationEngine.initialize();
    logger.info('Automation engine initialized');

    // Initialize webhook service
    const webhookService = WebhookService.getInstance();
    await webhookService.initialize();
    logger.info('Webhook service initialized');

    // Initialize cron jobs
    initializeCronJobs();
    logger.info('Cron jobs initialized');

    // Start server
    httpServer.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  httpServer.close(async () => {
    logger.info('HTTP server closed');
    await AppDataSource.destroy();
    logger.info('Database connection closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT signal received: closing HTTP server');
  httpServer.close(async () => {
    logger.info('HTTP server closed');
    await AppDataSource.destroy();
    logger.info('Database connection closed');
    process.exit(0);
  });
});

startServer();


