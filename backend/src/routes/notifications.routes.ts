import { Router } from 'express';
import { AppDataSource } from '../database/dataSource';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { EmailService } from '../services/EmailService';
import { TeamsService } from '../services/teams/TeamsService';
import nodemailer from 'nodemailer';

export const notificationsRouter = Router();

// Apply auth middleware to all routes
notificationsRouter.use(authMiddleware);

interface NotificationConfig {
  email: {
    enabled: boolean;
    smtp: {
      host: string;
      port: number;
      secure: boolean;
      auth: {
        user: string;
        pass: string;
      };
    };
    defaultFrom: string;
    defaultTo: string[];
  };
  teams: {
    enabled: boolean;
    webhookUrl: string;
    channels: {
      alerts: string;
      tickets: string;
      reports: string;
    };
  };
  templates: {
    [key: string]: {
      subject: string;
      body: string;
      type: 'html' | 'text';
    };
  };
}

// Store in database or environment
let notificationConfig: NotificationConfig = {
  email: {
    enabled: false,
    smtp: {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || ''
      }
    },
    defaultFrom: process.env.SMTP_FROM || 'noreply@connectwise-nrmm.com',
    defaultTo: process.env.SMTP_DEFAULT_TO?.split(',') || []
  },
  teams: {
    enabled: false,
    webhookUrl: process.env.TEAMS_WEBHOOK_URL || '',
    channels: {
      alerts: process.env.TEAMS_ALERT_CHANNEL || '',
      tickets: process.env.TEAMS_TICKET_CHANNEL || '',
      reports: process.env.TEAMS_REPORT_CHANNEL || ''
    }
  },
  templates: {}
};

// Get notification configuration
notificationsRouter.get('/config', async (req: AuthRequest, res, next) => {
  try {
    // Mask sensitive data for non-admin users
    const config = { ...notificationConfig };
    if (req.user?.role !== 'admin') {
      if (config.email.smtp.auth) {
        config.email.smtp.auth.pass = '********';
      }
      if (config.teams.webhookUrl) {
        config.teams.webhookUrl = config.teams.webhookUrl.substring(0, 30) + '...';
      }
    }
    res.json(config);
  } catch (error) {
    next(error);
  }
});

// Update notification configuration
notificationsRouter.put('/config', async (req: AuthRequest, res, next) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const newConfig = req.body as NotificationConfig;
    
    // Validate and merge configuration
    if (newConfig.email) {
      notificationConfig.email = { ...notificationConfig.email, ...newConfig.email };
    }
    if (newConfig.teams) {
      notificationConfig.teams = { ...notificationConfig.teams, ...newConfig.teams };
    }
    if (newConfig.templates) {
      notificationConfig.templates = { ...notificationConfig.templates, ...newConfig.templates };
    }

    // Reinitialize services with new config
    if (notificationConfig.email.enabled) {
      // EmailService configuration is updated via environment variables
      process.env.SMTP_HOST = notificationConfig.email.smtp.host;
      process.env.SMTP_PORT = notificationConfig.email.smtp.port.toString();
      process.env.SMTP_USER = notificationConfig.email.smtp.auth.user;
      process.env.SMTP_PASS = notificationConfig.email.smtp.auth.pass;
      process.env.SMTP_FROM = notificationConfig.email.defaultFrom;
    }
    if (notificationConfig.teams.enabled && notificationConfig.teams.webhookUrl) {
      process.env.TEAMS_WEBHOOK_URL = notificationConfig.teams.webhookUrl;
    }

    logger.info('Notification configuration updated');
    res.json({ success: true, config: notificationConfig });
  } catch (error) {
    next(error);
  }
});

// Test email configuration
notificationsRouter.post('/test/email', async (req: AuthRequest, res, next) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { to, subject, body } = req.body;
    
    if (!notificationConfig.email.enabled) {
      return res.status(400).json({ message: 'Email notifications are disabled' });
    }

    // Create test transporter
    const transporter = nodemailer.createTransport(notificationConfig.email.smtp);
    
    // Test connection
    await transporter.verify();
    
    // Send test email
    const result = await transporter.sendMail({
      from: notificationConfig.email.defaultFrom,
      to: to || notificationConfig.email.defaultTo[0] || req.user.email,
      subject: subject || 'Test Email from ConnectWise-NRMM',
      html: body || '<h1>Test Email</h1><p>This is a test email from your ConnectWise-NRMM system.</p>'
    });

    logger.info('Test email sent successfully', { messageId: result.messageId });
    res.json({ 
      success: true, 
      message: 'Test email sent successfully',
      messageId: result.messageId 
    });
  } catch (error: any) {
    logger.error('Failed to send test email:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to send test email' 
    });
  }
});

// Test Teams configuration
notificationsRouter.post('/test/teams', async (req: AuthRequest, res, next) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { message, channel } = req.body;
    
    if (!notificationConfig.teams.enabled || !notificationConfig.teams.webhookUrl) {
      return res.status(400).json({ message: 'Teams notifications are disabled or not configured' });
    }

    const teamsService = TeamsService.getInstance();
    
    const result = await teamsService.sendAlertNotification(
      'Test Notification', 
      message || 'This is a test notification from ConnectWise-NRMM',
      'info'
    );

    logger.info('Test Teams notification sent successfully');
    res.json({ 
      success: true, 
      message: 'Test notification sent to Teams'
    });
  } catch (error: any) {
    logger.error('Failed to send Teams notification:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to send Teams notification' 
    });
  }
});

// Get notification templates
notificationsRouter.get('/templates', async (req: AuthRequest, res, next) => {
  try {
    const defaultTemplates = {
      ticketCreated: {
        subject: 'New Ticket Created: {{ticketId}}',
        body: `
          <h2>New Ticket Created</h2>
          <p><strong>Ticket ID:</strong> {{ticketId}}</p>
          <p><strong>Title:</strong> {{title}}</p>
          <p><strong>Priority:</strong> {{priority}}</p>
          <p><strong>Client:</strong> {{clientName}}</p>
          <p><strong>Description:</strong> {{description}}</p>
        `,
        type: 'html' as const
      },
      alertTriggered: {
        subject: 'Alert: {{alertType}} on {{deviceName}}',
        body: `
          <h2>Alert Triggered</h2>
          <p><strong>Alert Type:</strong> {{alertType}}</p>
          <p><strong>Device:</strong> {{deviceName}}</p>
          <p><strong>Severity:</strong> {{severity}}</p>
          <p><strong>Message:</strong> {{message}}</p>
          <p><strong>Time:</strong> {{timestamp}}</p>
        `,
        type: 'html' as const
      },
      automationCompleted: {
        subject: 'Automation Completed: {{ruleName}}',
        body: `
          <h2>Automation Execution Complete</h2>
          <p><strong>Rule:</strong> {{ruleName}}</p>
          <p><strong>Status:</strong> {{status}}</p>
          <p><strong>Duration:</strong> {{duration}}ms</p>
          <p><strong>Result:</strong> {{result}}</p>
        `,
        type: 'html' as const
      },
      dailyReport: {
        subject: 'Daily Report - {{date}}',
        body: `
          <h2>Daily Operations Report</h2>
          <p><strong>Date:</strong> {{date}}</p>
          <hr>
          <h3>Tickets</h3>
          <ul>
            <li>Created: {{ticketsCreated}}</li>
            <li>Resolved: {{ticketsResolved}}</li>
            <li>Pending: {{ticketsPending}}</li>
          </ul>
          <h3>Alerts</h3>
          <ul>
            <li>Critical: {{alertsCritical}}</li>
            <li>Warning: {{alertsWarning}}</li>
            <li>Info: {{alertsInfo}}</li>
          </ul>
          <h3>Automation</h3>
          <ul>
            <li>Rules Executed: {{automationExecuted}}</li>
            <li>Success Rate: {{automationSuccessRate}}%</li>
          </ul>
        `,
        type: 'html' as const
      }
    };

    const templates = { ...defaultTemplates, ...notificationConfig.templates };
    res.json(templates);
  } catch (error) {
    next(error);
  }
});

// Save/Update notification template
notificationsRouter.put('/templates/:name', async (req: AuthRequest, res, next) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { name } = req.params;
    const { subject, body, type } = req.body;

    if (!name || !subject || !body) {
      return res.status(400).json({ message: 'Name, subject, and body are required' });
    }

    notificationConfig.templates[name] = {
      subject,
      body,
      type: type || 'html'
    };

    logger.info(`Notification template saved: ${name}`);
    res.json({ 
      success: true, 
      template: notificationConfig.templates[name] 
    });
  } catch (error) {
    next(error);
  }
});

// Delete notification template
notificationsRouter.delete('/templates/:name', async (req: AuthRequest, res, next) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { name } = req.params;
    
    if (notificationConfig.templates[name]) {
      delete notificationConfig.templates[name];
      logger.info(`Notification template deleted: ${name}`);
      res.json({ success: true, message: 'Template deleted' });
    } else {
      res.status(404).json({ message: 'Template not found' });
    }
  } catch (error) {
    next(error);
  }
});

// Send notification
notificationsRouter.post('/send', async (req: AuthRequest, res, next) => {
  try {
    const { type, channel, template, data, recipients } = req.body;

    let result: any = {};

    if (type === 'email' && notificationConfig.email.enabled) {
      const emailService = EmailService.getInstance();
      
      // Get template if specified
      let subject = data.subject;
      let body = data.body;
      
      if (template && notificationConfig.templates[template]) {
        const tpl = notificationConfig.templates[template];
        subject = tpl.subject;
        body = tpl.body;
        
        // Replace template variables
        Object.keys(data).forEach(key => {
          const regex = new RegExp(`{{${key}}}`, 'g');
          subject = subject.replace(regex, data[key]);
          body = body.replace(regex, data[key]);
        });
      }

      // For now, use a simple email send (since EmailService doesn't have sendEmail)
      result.email = await emailService.sendTicketNotification(
        {
          id: data.ticketId || 'NEW',
          title: subject,
          description: body,
          status: 'open',
          priority: 'medium',
          clientName: data.clientName || 'Unknown'
        } as any,
        recipients || notificationConfig.email.defaultTo,
        'created'
      );
    }

    if (type === 'teams' && notificationConfig.teams.enabled) {
      const teamsService = TeamsService.getInstance();
      
      result.teams = await teamsService.sendAlertNotification(
        data.title || 'Notification',
        data.message || data.body,
        data.severity || 'info'
      );
    }

    logger.info('Notification sent', { type, channel, template });
    res.json({ success: true, result });
  } catch (error: any) {
    logger.error('Failed to send notification:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to send notification' 
    });
  }
});

