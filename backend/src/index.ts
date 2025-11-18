// Simple backend startup without problematic imports
import * as dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';

// Load environment
dotenv.config();
console.log('✓ Environment loaded');

const app = express();
const httpServer = createServer(app);

// Configure CORS to allow multiple origins
const allowedOrigins = [
  'http://localhost:3000',
  'http://213.199.59.71:3000',
  process.env.FRONTEND_URL
].filter(Boolean);

// Initialize Socket.IO with CORS configuration
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    credentials: true
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('✓ Client connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('✗ Client disconnected:', socket.id);
  });
  
  // Handle ticket events
  socket.on('ticket:update', (data) => {
    io.emit('ticket:updated', data);
  });
});

// Middleware
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all origins for now
    }
  },
  credentials: true
}));
app.use(express.json());

// Health endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK',
    timestamp: new Date(),
    environment: process.env.NODE_ENV
  });
});

const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';

async function start() {
  try {
    // Initialize database
    console.log('Initializing database...');
    const { AppDataSource } = await import('./database/dataSource');
    
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
    console.log('✓ Database initialized');

    // Load routes with proper error handling
    console.log('Loading routes...');
    try {
      const { authRouter } = await import('./routes/auth.routes');
      app.use('/api/auth', authRouter);
      console.log('  ✓ Auth routes loaded');
    } catch (e) {
      console.log('  ⚠ Auth routes failed:', e.message);
    }

    try {
      const { ticketRouter } = await import('./routes/ticket.routes');
      app.use('/api/tickets', ticketRouter);
      console.log('  ✓ Ticket routes loaded');
    } catch (e) {
      console.log('  ⚠ Ticket routes failed:', e.message);
    }

    try {
      const { automationRouter } = await import('./routes/automation.routes');
      app.use('/api/automation', automationRouter);
      console.log('  ✓ Automation routes loaded');
    } catch (e) {
      console.log('  ⚠ Automation routes failed:', e.message);
    }

    try {
      const { webhookRouter } = await import('./routes/webhook.routes');
      app.use('/api/webhooks', webhookRouter);
      console.log('  ✓ Webhook routes loaded');
    } catch (e) {
      console.log('  ⚠ Webhook routes failed:', e.message);
    }

    try {
      const { analyticsRouter } = await import('./routes/analytics.routes');
      app.use('/api/analytics', analyticsRouter);
      console.log('  ✓ Analytics routes loaded');
    } catch (e) {
      console.log('  ⚠ Analytics routes failed:', e.message);
    }

    try {
      const { notificationRouter } = await import('./routes/notification.routes');
      app.use('/api/notification', notificationRouter);
      console.log('  ✓ Notification routes loaded');
    } catch (e) {
      console.log('  ⚠ Notification routes failed:', e.message);
    }

    try {
      const { credentialsRouter } = await import('./routes/credentials.routes');
      app.use('/api/credentials', credentialsRouter);
      console.log('  ✓ Credentials routes loaded');
    } catch (e) {
      console.log('  ⚠ Credentials routes failed:', e.message);
    }

    try {
      const { notificationsRouter } = await import('./routes/notifications.routes');
      app.use('/api/notifications', notificationsRouter);
      console.log('  ✓ Notifications routes loaded');
    } catch (e) {
      console.log('  ⚠ Notifications routes failed:', e.message);
    }

    try {
      const { reportsRouter } = await import('./routes/reports.routes');
      app.use('/api/reports', reportsRouter);
      console.log('  ✓ Reports routes loaded');
    } catch (e) {
      console.log('  ⚠ Reports routes failed:', e.message);
    }

    try {
      const scriptsRouter = (await import('./routes/scripts.routes')).default;
      app.use('/api/scripts', scriptsRouter);
      console.log('  ✓ Scripts routes loaded');
    } catch (e) {
      console.log('  ⚠ Scripts routes failed:', e.message);
    }

    try {
      const alertMappingsRouter = (await import('./routes/alert-mappings.routes')).default;
      app.use('/api/alert-mappings', alertMappingsRouter);
      console.log('  ✓ Alert mappings routes loaded');
    } catch (e) {
      console.log('  ⚠ Alert mappings routes failed:', e.message);
    }
    
    try {
      const { settingsRouter } = await import('./routes/settings.routes');
      app.use('/api/settings', settingsRouter);
      console.log('  ✓ Settings routes loaded');
    } catch (e) {
      console.log('  ⚠ Settings routes failed:', e.message);
    }

    try {
      const { nableRouter } = await import('./routes/nable.routes');
      app.use('/api/nable', nableRouter);
      console.log('  ✓ N-able routes loaded');
    } catch (e) {
      console.log('  ⚠ N-able routes failed:', e.message);
    }

    // Initialize sync service for ConnectWise/N-able integration
    console.log('Initializing sync service...');
    setTimeout(async () => {
      try {
        const { SyncService } = await import('./services/SyncService');
        const syncService = SyncService.getInstance();
        await syncService.initialize();
        console.log('✓ Sync service initialized - will sync with external APIs if credentials are configured');
        
        // Optional: Trigger initial sync (uncomment if needed)
        // await syncService.syncAll();
        // console.log('✓ Initial sync completed');
      } catch (error: any) {
        console.log('⚠ Sync service initialization failed - will work with local data:', error.message);
      }
    }, 3000); // Delay to ensure database and services are ready

    // Simple error handler
    app.use((err: any, req: any, res: any, next: any) => {
      console.error('Error:', err.message);
      res.status(err.statusCode || 500).json({
        error: err.message || 'Internal Server Error'
      });
    });

    // Start server
    httpServer.listen(PORT, HOST, () => {
      console.log(`
╔════════════════════════════════════════════════╗
║   🚀 Backend Server Running                   ║
║   Port: ${PORT}                                  ║
║   Host: ${HOST}                               ║
║   Health: http://localhost:${PORT}/health        ║
╚════════════════════════════════════════════════╝
      `);
    });

  } catch (error) {
    console.error('❌ Startup failed:', error);
    process.exit(1);
  }
}

// Handle errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  httpServer.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('\nSIGINT received, shutting down...');
  httpServer.close(() => process.exit(0));
});

// Start the server
start();
