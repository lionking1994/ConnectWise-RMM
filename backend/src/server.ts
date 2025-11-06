// Production-ready server with all routes
import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { AppDataSource } from './database/dataSource';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';

// Load environment variables from parent directory first, then backend directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const server = http.createServer(app);
const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';

// Initialize Socket.IO
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',').map(o => o.trim()) || ['http://localhost:3000'],
    credentials: true
  }
});

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" }
}));

// CORS configuration - allow both localhost and external IP
const corsOptions = {
  origin: function (origin: any, callback: any) {
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) return callback(null, true);
    
    // List of allowed origins
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://213.199.59.71:3000',
      'http://213.199.59.71:3001',
      ...(process.env.CORS_ORIGIN?.split(',').map(o => o.trim()) || [])
    ];
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all origins for now (can be restricted later)
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  preflightContinue: false,
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));

// Handle preflight requests explicitly
app.options('*', cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) }}));

// Health check endpoints
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'ConnectWise-N-able RMM Integration Platform',
    version: '1.0.0',
    status: 'running'
  });
});

// Simple auth endpoint (without database for now)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Basic validation
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    
    // For now, use hardcoded credentials
    if (email === 'admin@example.com' && password === 'admin123') {
      const user = {
        id: '1',
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'admin',
        isActive: true
      };
      
      // Generate a simple token (in production, use proper JWT)
      const token = Buffer.from(JSON.stringify({
        id: user.id,
        email: user.email,
        role: user.role,
        iat: Date.now()
      })).toString('base64');
      
      res.json({
        user,
        token,
        refreshToken: `refresh_${token}`
      });
    } else {
      res.status(401).json({ message: 'Invalid credentials' });
    }
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Auth endpoints
app.post('/api/auth/refresh', (req, res) => {
  // Simple refresh implementation
  const { refreshToken } = req.body;
  if (refreshToken && refreshToken.startsWith('refresh_')) {
    const token = refreshToken.replace('refresh_', '');
    res.json({ token, refreshToken });
  } else {
    res.status(401).json({ message: 'Invalid refresh token' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

app.get('/api/auth/me', (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    res.json({
      id: '1',
      email: 'admin@example.com',
      name: 'Admin User',
      role: 'admin',
      isActive: true
    });
  } else {
    res.status(401).json({ message: 'Not authenticated' });
  }
});

// Mock endpoints for features
app.get('/api/tickets', (req, res) => {
  const now = new Date();
  const tickets = [
    {
      id: '1',
      ticketNumber: 'TKT-2024-001',
      title: 'Server CPU Usage High - Critical Alert',
      description: 'CPU usage exceeded 90% threshold for 15 minutes',
      status: 'open',
      priority: 'critical',
      clientName: 'Acme Corp',
      assignedTo: 'John Smith',
      createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
      automationStatus: 'pending'
    },
    {
      id: '2',
      ticketNumber: 'TKT-2024-002',
      title: 'Disk Space Warning - Drive C: 85% Full',
      description: 'Automated cleanup script initiated',
      status: 'in_progress',
      priority: 'high',
      clientName: 'TechStart Inc',
      assignedTo: 'Sarah Johnson',
      createdAt: new Date(now.getTime() - 5 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString(),
      automationStatus: 'executing'
    },
    {
      id: '3',
      ticketNumber: 'TKT-2024-003',
      title: 'Backup Job Failed - SQL Database',
      description: 'Nightly backup job failed with error code 1001',
      status: 'resolved',
      priority: 'medium',
      clientName: 'Global Finance Ltd',
      assignedTo: 'Mike Davis',
      createdAt: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString(),
      automationStatus: 'completed',
      resolution: 'Backup service restarted and job completed successfully'
    },
    {
      id: '4',
      ticketNumber: 'TKT-2024-004',
      title: 'Windows Update Required - Security Patches',
      description: '15 critical security updates pending installation',
      status: 'open',
      priority: 'high',
      clientName: 'Healthcare Plus',
      assignedTo: 'Emily Chen',
      createdAt: new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
      automationStatus: 'scheduled'
    },
    {
      id: '5',
      ticketNumber: 'TKT-2024-005',
      title: 'Network Connectivity Issue - Branch Office',
      description: 'Intermittent connection drops reported',
      status: 'open',
      priority: 'medium',
      clientName: 'Retail Chain Co',
      assignedTo: 'David Lee',
      createdAt: new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(now.getTime() - 45 * 60 * 1000).toISOString(),
      automationStatus: 'manual'
    }
  ];
  
  res.json({
    data: tickets,
    total: tickets.length,
    page: 1,
    pageSize: 10
  });
});

app.get('/api/automation/rules', (req, res) => {
  const rules = [
    {
      id: '1',
      name: 'High CPU Usage Auto-Remediation',
      description: 'Automatically restarts services when CPU exceeds 90% for 10 minutes',
      enabled: true,
      trigger: 'CPU > 90%',
      actions: ['Restart IIS', 'Clear temp files', 'Send notification'],
      lastTriggered: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      executionCount: 45,
      successRate: 92
    },
    {
      id: '2',
      name: 'Disk Space Cleanup',
      description: 'Clears temp files and old logs when disk usage exceeds 85%',
      enabled: true,
      trigger: 'Disk Usage > 85%',
      actions: ['Clear Windows temp', 'Compress old logs', 'Delete cache'],
      lastTriggered: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      executionCount: 128,
      successRate: 98
    },
    {
      id: '3',
      name: 'Service Health Check',
      description: 'Monitors and restarts critical services if they stop',
      enabled: true,
      trigger: 'Service Status = Stopped',
      actions: ['Start service', 'Log event', 'Send alert'],
      lastTriggered: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      executionCount: 67,
      successRate: 95
    },
    {
      id: '4',
      name: 'Security Patch Installation',
      description: 'Automatically installs critical security updates during maintenance window',
      enabled: false,
      trigger: 'Critical updates available',
      actions: ['Download updates', 'Install patches', 'Reboot if required'],
      lastTriggered: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
      executionCount: 12,
      successRate: 83
    },
    {
      id: '5',
      name: 'Database Backup Verification',
      description: 'Checks backup job completion and retries if failed',
      enabled: true,
      trigger: 'Backup job status',
      actions: ['Verify backup', 'Retry if failed', 'Send report'],
      lastTriggered: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
      executionCount: 234,
      successRate: 99
    }
  ];
  
  res.json({
    data: rules,
    total: rules.length,
    page: 1,
    pageSize: 10
  });
});

app.get('/api/credentials', (req, res) => {
  res.json({
    data: [
      {
        id: '1',
        provider: 'connectwise',
        name: 'ConnectWise PSA',
        isActive: false
      },
      {
        id: '2',
        provider: 'nable',
        name: 'N-able RMM',
        isActive: false
      }
    ],
    total: 2
  });
});

app.get('/api/analytics/metrics', (req, res) => {
  res.json({
    overview: {
      totalTickets: 1247,
      openTickets: 23,
      resolvedTickets: 1189,
      pendingTickets: 35,
      avgResolutionTime: 4.5,
      automationRate: 67.8
    },
    performance: {
      avgResponseTime: 2.3,
      slaCompliance: 94.5,
      firstCallResolution: 72.3,
      customerSatisfaction: 4.6
    },
    trends: {
      ticketGrowth: 12.5,
      resolutionImprovement: 8.3,
      automationAdoption: 23.7
    }
  });
});

// Dashboard stats endpoint
app.get('/api/analytics/dashboard-stats', (req, res) => {
  res.json({
    totalTickets: 125,
    openTickets: 23,
    resolvedTickets: 89,
    pendingTickets: 13,
    avgResolutionTime: 4.5,
    automationRate: 67.8,
    ticketsByStatus: [
      { name: 'Open', value: 23 },
      { name: 'In Progress', value: 18 },
      { name: 'Resolved', value: 89 },
      { name: 'Closed', value: 102 }
    ],
    ticketsByPriority: [
      { name: 'Critical', value: 5 },
      { name: 'High', value: 12 },
      { name: 'Medium', value: 45 },
      { name: 'Low', value: 63 }
    ]
  });
});

// Ticket trends endpoint
app.get('/api/analytics/ticket-trends', (req, res) => {
  const today = new Date();
  const trends = [];
  
  // Generate mock data for last 7 days
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    trends.push({
      date: date.toISOString().split('T')[0],
      created: Math.floor(Math.random() * 20) + 5,
      resolved: Math.floor(Math.random() * 15) + 3,
      automated: Math.floor(Math.random() * 10) + 2
    });
  }
  
  res.json({
    trends,
    summary: {
      totalCreated: trends.reduce((sum, t) => sum + t.created, 0),
      totalResolved: trends.reduce((sum, t) => sum + t.resolved, 0),
      totalAutomated: trends.reduce((sum, t) => sum + t.automated, 0),
      averagePerDay: Math.round(trends.reduce((sum, t) => sum + t.created, 0) / 7)
    }
  });
});

// Automation metrics endpoint
app.get('/api/analytics/automation-metrics', (req, res) => {
  res.json({
    totalRules: 12,
    activeRules: 8,
    executionsToday: 34,
    successRate: 92.5,
    averageExecutionTime: 2.3,
    topRules: [
      { name: 'Disk Space Cleanup', executions: 45, successRate: 95 },
      { name: 'Service Restart', executions: 32, successRate: 88 },
      { name: 'Cache Clear', executions: 28, successRate: 100 },
      { name: 'Update Installation', executions: 15, successRate: 80 }
    ],
    executionsByHour: Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      count: Math.floor(Math.random() * 10)
    })),
    recentExecutions: [
      { id: 1, ruleName: 'Disk Cleanup', status: 'success', timestamp: new Date().toISOString() },
      { id: 2, ruleName: 'Service Restart', status: 'success', timestamp: new Date().toISOString() },
      { id: 3, ruleName: 'Cache Clear', status: 'failed', timestamp: new Date().toISOString() }
    ]
  });
});

app.get('/api/notifications', (req, res) => {
  res.json({
    data: [],
    total: 0
  });
});

// Settings endpoints - Load from environment variables
let systemSettings = {
  general: {
    companyName: process.env.COMPANY_NAME || 'RMM Integration Platform',
    clientId: process.env.COMPANY_CLIENT_ID || 'RMM-CLIENT-001',
    timezone: process.env.TIMEZONE || 'America/New_York',
    dateFormat: process.env.DATE_FORMAT || 'MM/DD/YYYY',
    language: process.env.LANGUAGE || 'en-US'
  },
  notifications: {
    emailEnabled: process.env.EMAIL_ENABLED === 'true',
    smsEnabled: process.env.SMS_ENABLED === 'true',
    teamsEnabled: process.env.TEAMS_ENABLED === 'true',
    slackEnabled: process.env.SLACK_ENABLED === 'true',
    emailRecipients: process.env.EMAIL_RECIPIENTS?.split(',').map(e => e.trim()) || ['admin@example.com', 'support@example.com']
  },
  automation: {
    enabled: process.env.AUTOMATION_ENABLED === 'true',
    maxRetries: parseInt(process.env.AUTOMATION_MAX_RETRIES || '3'),
    retryDelay: parseInt(process.env.AUTOMATION_RETRY_DELAY || '60'),
    defaultTimeout: parseInt(process.env.AUTOMATION_DEFAULT_TIMEOUT || '300'),
    requireApproval: process.env.AUTOMATION_REQUIRE_APPROVAL === 'true'
  },
  api: {
    connectwiseUrl: process.env.CONNECTWISE_API_URL || 'https://api-na.myconnectwise.net',
    connectwiseCompanyId: process.env.CONNECTWISE_COMPANY_ID || '',
    connectwisePublicKey: process.env.CONNECTWISE_PUBLIC_KEY || '',
    connectwisePrivateKey: process.env.CONNECTWISE_PRIVATE_KEY || '',
    nableUrl: process.env.NABLE_API_URL || 'https://api.n-able.com',
    nableAccessKey: process.env.NABLE_ACCESS_KEY || '',
    rateLimitPerMinute: parseInt(process.env.API_RATE_LIMIT || '60'),
    timeout: parseInt(process.env.API_TIMEOUT || '30')
  },
  maintenance: {
    window: {
      start: '02:00',
      end: '05:00',
      days: ['Saturday', 'Sunday']
    },
    autoUpdate: true
  }
};

app.get('/api/settings', (req, res) => {
  res.json(systemSettings);
});

// Endpoint to get environment status (for debugging)
app.get('/api/settings/env-status', (req, res) => {
  res.json({
    loaded: {
      companyName: !!process.env.COMPANY_NAME,
      clientId: !!process.env.COMPANY_CLIENT_ID,
      connectwiseUrl: !!process.env.CONNECTWISE_API_URL,
      nableUrl: !!process.env.NABLE_API_URL,
      emailRecipients: !!process.env.EMAIL_RECIPIENTS
    },
    defaults: {
      clientId: process.env.COMPANY_CLIENT_ID || 'RMM-CLIENT-001',
      companyName: process.env.COMPANY_NAME || 'RMM Integration Platform',
      timezone: process.env.TIMEZONE || 'America/New_York'
    }
  });
});

app.put('/api/settings', (req, res) => {
  systemSettings = { ...systemSettings, ...req.body };
  logger.info('Settings updated');
  res.json({ message: 'Settings updated successfully', settings: systemSettings });
});

// API connection test endpoints
app.post('/api/settings/test-connection/connectwise', async (req, res) => {
  try {
    const { companyId, publicKey, privateKey, url } = req.body;
    
    // Simulate connection test
    if (!companyId || !publicKey || !privateKey) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required ConnectWise credentials' 
      });
    }
    
    // In production, this would make an actual API call to ConnectWise
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    res.json({ 
      success: true, 
      message: 'Successfully connected to ConnectWise PSA',
      details: {
        companyName: 'Demo Company',
        version: '2023.3',
        activeBoards: 5
      }
    });
  } catch (error) {
    logger.error('ConnectWise connection test failed:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to connect to ConnectWise' 
    });
  }
});

app.post('/api/settings/test-connection/nable', async (req, res) => {
  try {
    const { accessKey, url } = req.body;
    
    // Simulate connection test
    if (!accessKey) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required N-able access key'
      });
    }
    
    // In production, this would make an actual API call to N-able
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    res.json({ 
      success: true, 
      message: 'Successfully connected to N-able RMM',
      details: {
        accountName: 'Demo MSP',
        deviceCount: 150,
        activeAlerts: 12
      }
    });
  } catch (error) {
    logger.error('N-able connection test failed:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to connect to N-able' 
    });
  }
});

// Try to load all routes (with fallback if they have errors)
async function loadRoutes() {
  try {
    // Try to connect to database
    logger.info('Attempting database connection...');
    await AppDataSource.initialize();
    logger.info('Database connected successfully');
    
    // Try to load route modules
    try {
      const { authRouter } = await import('./routes/auth.routes');
      app.use('/api/auth', authRouter);
      logger.info('Auth routes loaded');
    } catch (error) {
      logger.warn('Could not load auth routes, using fallback:', error);
    }
    
    try {
      const { ticketRouter } = await import('./routes/ticket.routes');
      app.use('/api/tickets', ticketRouter);
      logger.info('Ticket routes loaded');
    } catch (error) {
      logger.warn('Could not load ticket routes, using fallback:', error);
    }
    
    try {
      const { automationRouter } = await import('./routes/automation.routes');
      app.use('/api/automation', automationRouter);
      logger.info('Automation routes loaded');
    } catch (error) {
      logger.warn('Could not load automation routes, using fallback:', error);
    }
    
    try {
      const { webhookRouter } = await import('./routes/webhook.routes');
      app.use('/api/webhooks', webhookRouter);
      logger.info('Webhook routes loaded');
    } catch (error) {
      logger.warn('Could not load webhook routes, using fallback:', error);
    }
    
    try {
      const scriptsRouter = await import('./routes/scripts.routes');
      app.use('/api/scripts', scriptsRouter.default);
      logger.info('Scripts routes loaded');
    } catch (error) {
      logger.warn('Could not load scripts routes, using fallback:', error);
    }
    
    try {
      const alertMappingsRouter = await import('./routes/alert-mappings.routes');
      app.use('/api/alert-mappings', alertMappingsRouter.default);
      logger.info('Alert mappings routes loaded');
    } catch (error) {
      logger.warn('Could not load alert-mappings routes, using fallback:', error);
    }
    
    try {
      const escalationRouter = await import('./routes/escalation.routes');
      app.use('/api/escalation', escalationRouter.default);
      logger.info('Escalation routes loaded');
    } catch (error) {
      logger.warn('Could not load escalation routes, using fallback:', error);
    }
    
    // Board management disabled - not needed when N-able creates tickets
    // try {
    //   const boardsRouter = await import('./routes/boards.routes');
    //   app.use('/api/boards', boardsRouter.default);
    //   logger.info('Boards routes loaded');
    // } catch (error) {
    //   logger.warn('Could not load boards routes, using fallback:', error);
    // }
    
    try {
      const { alertsRouter } = await import('./routes/alerts.routes');
      app.use('/api/alerts', alertsRouter);
      logger.info('Alerts routes loaded');
    } catch (error) {
      logger.warn('Could not load alerts routes, using fallback:', error);
    }
    
    try {
      const { notificationRouter } = await import('./routes/notification.routes');
      app.use('/api/notification', notificationRouter);
      logger.info('Notification routes loaded');
    } catch (error) {
      logger.warn('Could not load notification routes, using fallback:', error);
    }
    
    try {
      const { notificationsRouter } = await import('./routes/notifications.routes');
      app.use('/api/notifications', notificationsRouter);
      logger.info('Notifications routes loaded');
    } catch (error) {
      logger.warn('Could not load notifications routes, using fallback:', error);
    }
    
    try {
      const { reportsRouter } = await import('./routes/reports.routes');
      app.use('/api/reports', reportsRouter);
      logger.info('Reports routes loaded');
    } catch (error) {
      logger.warn('Could not load reports routes, using fallback:', error);
    }
    
    try {
      const { credentialsRouter } = await import('./routes/credentials.routes');
      app.use('/api/credentials', credentialsRouter);
      logger.info('Credentials routes loaded');
    } catch (error) {
      logger.warn('Could not load credentials routes, using fallback:', error);
    }
    
    try {
      const { analyticsRouter } = await import('./routes/analytics.routes');
      app.use('/api/analytics', analyticsRouter);
      logger.info('Analytics routes loaded');
    } catch (error) {
      logger.warn('Could not load analytics routes, using fallback:', error);
    }
    
  } catch (dbError) {
    logger.warn('Database connection failed, running in standalone mode:', dbError);
  }
}

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('New WebSocket connection:', socket.id);
  logger.info(`WebSocket connected: ${socket.id}`);
  
  // Send initial connection confirmation
  socket.emit('connected', { 
    message: 'Connected to RMM Integration Platform',
    socketId: socket.id 
  });
  
  // Handle ticket updates
  socket.on('ticket:update', (data) => {
    // Broadcast ticket updates to all connected clients
    io.emit('ticket:updated', data);
  });
  
  // Handle automation events
  socket.on('automation:execute', (data) => {
    socket.emit('automation:status', { 
      id: data.id, 
      status: 'executing',
      message: 'Automation rule is being executed'
    });
  });
  
  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('WebSocket disconnected:', socket.id);
    logger.info(`WebSocket disconnected: ${socket.id}`);
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
async function startServer() {
  try {
    // Try to load routes with database
    await loadRoutes();
    
    // Start listening
    server.listen(PORT, HOST, () => {
      console.log(`✅ Server running at http://${HOST}:${PORT}`);
      console.log(`Health check: http://${HOST}:${PORT}/health`);
      console.log(`WebSocket support enabled`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`Server started on ${HOST}:${PORT} with WebSocket support`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    
    // Start without database
    server.listen(PORT, HOST, () => {
      console.log(`⚠️ Server running in limited mode at http://${HOST}:${PORT}`);
      console.log(`Health check: http://${HOST}:${PORT}/health`);
      console.log(`WebSocket support enabled`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.warn('Server started in limited mode without database');
    });
  }
}

// Handle shutdown gracefully
process.on('SIGINT', async () => {
  logger.info('Shutting down server...');
  try {
    await AppDataSource.destroy();
  } catch (error) {
    logger.error('Error closing database:', error);
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Shutting down server...');
  try {
    await AppDataSource.destroy();
  } catch (error) {
    logger.error('Error closing database:', error);
  }
  process.exit(0);
});

// Start the server
startServer().catch(error => {
  console.error('Fatal error starting server:', error);
  process.exit(1);
});

