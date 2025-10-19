import nodemailer from 'nodemailer';
import { IncomingWebhook } from '@slack/webhook';
import axios from 'axios';
import { logger } from '../utils/logger';
import { AppDataSource } from '../database/dataSource';
import { Notification } from '../entities/Notification';
import { User } from '../entities/User';

export interface NotificationPayload {
  channels: Array<'email' | 'slack' | 'teams'>;
  subject: string;
  message: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  recipients?: string[];
  metadata?: Record<string, any>;
}

export class NotificationService {
  private static instance: NotificationService;
  private emailTransporter: nodemailer.Transporter;
  private slackWebhook?: IncomingWebhook;
  private teamsWebhookUrl?: string;
  private notificationRepository = AppDataSource.getRepository(Notification);
  private userRepository = AppDataSource.getRepository(User);

  private constructor() {
    // Initialize email transporter
    this.emailTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // Initialize Slack webhook
    if (process.env.SLACK_WEBHOOK_URL) {
      this.slackWebhook = new IncomingWebhook(process.env.SLACK_WEBHOOK_URL);
    }

    // Initialize Teams webhook
    if (process.env.TEAMS_WEBHOOK_URL) {
      this.teamsWebhookUrl = process.env.TEAMS_WEBHOOK_URL;
    }
  }

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  async send(payload: NotificationPayload): Promise<void> {
    const promises: Promise<any>[] = [];

    if (payload.channels.includes('email')) {
      promises.push(this.sendEmail(payload));
    }

    if (payload.channels.includes('slack') && this.slackWebhook) {
      promises.push(this.sendSlack(payload));
    }

    if (payload.channels.includes('teams') && this.teamsWebhookUrl) {
      promises.push(this.sendTeams(payload));
    }

    const results = await Promise.allSettled(promises);
    
    // Log results
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        logger.error(`Notification failed for channel ${payload.channels[index]}:`, result.reason);
      }
    });

    // Save notification record
    await this.saveNotification(payload, results);
  }

  private async sendEmail(payload: NotificationPayload): Promise<void> {
    try {
      const recipients = payload.recipients || await this.getEmailRecipients(payload.priority);
      
      if (recipients.length === 0) {
        logger.warn('No email recipients configured');
        return;
      }

      const mailOptions = {
        from: process.env.EMAIL_FROM || 'RMM Integration <noreply@rmm.local>',
        to: recipients.join(', '),
        subject: this.formatSubject(payload),
        html: this.formatEmailBody(payload),
        priority: this.mapPriority(payload.priority) as any,
      };

      await this.emailTransporter.sendMail(mailOptions);
      logger.info(`Email sent successfully to ${recipients.length} recipients`);
    } catch (error) {
      logger.error('Failed to send email:', error);
      throw error;
    }
  }

  private async sendSlack(payload: NotificationPayload): Promise<void> {
    if (!this.slackWebhook) {
      throw new Error('Slack webhook not configured');
    }

    try {
      const color = this.getSlackColor(payload.priority);
      
      await this.slackWebhook.send({
        text: payload.subject,
        attachments: [
          {
            color,
            text: payload.message,
            fields: payload.metadata ? Object.entries(payload.metadata).map(([key, value]) => ({
              title: this.formatFieldName(key),
              value: String(value),
              short: true,
            })) : undefined,
            footer: 'RMM Integration Platform',
            ts: String(Date.now() / 1000),
          },
        ],
      });
      
      logger.info('Slack notification sent successfully');
    } catch (error) {
      logger.error('Failed to send Slack notification:', error);
      throw error;
    }
  }

  private async sendTeams(payload: NotificationPayload): Promise<void> {
    if (!this.teamsWebhookUrl) {
      throw new Error('Teams webhook not configured');
    }

    try {
      const card = {
        '@type': 'MessageCard',
        '@context': 'http://schema.org/extensions',
        themeColor: this.getTeamsColor(payload.priority),
        summary: payload.subject,
        sections: [
          {
            activityTitle: payload.subject,
            text: payload.message,
            facts: payload.metadata ? Object.entries(payload.metadata).map(([key, value]) => ({
              name: this.formatFieldName(key),
              value: String(value),
            })) : undefined,
          },
        ],
      };

      await axios.post(this.teamsWebhookUrl, card);
      logger.info('Teams notification sent successfully');
    } catch (error) {
      logger.error('Failed to send Teams notification:', error);
      throw error;
    }
  }

  private async getEmailRecipients(priority?: string): Promise<string[]> {
    // Get users who have email notifications enabled
    const users = await this.userRepository.find({
      where: { isActive: true },
    });

    return users
      .filter(user => {
        // Check if user has email notifications enabled
        if (!user.preferences?.notifications?.email) return false;
        
        // For high/critical priority, notify all users
        if (priority === 'high' || priority === 'critical') return true;
        
        // For other priorities, only notify admins and assigned technicians
        return user.role === 'admin' || user.role === 'technician';
      })
      .map(user => user.email);
  }

  private formatSubject(payload: NotificationPayload): string {
    const prefix = payload.priority === 'critical' ? '🚨 CRITICAL: ' :
                   payload.priority === 'high' ? '⚠️ HIGH: ' :
                   payload.priority === 'medium' ? 'ℹ️ ' : '';
    return `${prefix}${payload.subject}`;
  }

  private formatEmailBody(payload: NotificationPayload): string {
    let html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #2196f3; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">RMM Integration Platform</h1>
        </div>
        <div style="padding: 20px; background-color: #f5f5f5;">
          <h2>${payload.subject}</h2>
          <p style="font-size: 16px; line-height: 1.5;">${payload.message}</p>
    `;

    if (payload.metadata) {
      html += '<hr style="border: 1px solid #ddd;"><h3>Details:</h3><ul>';
      for (const [key, value] of Object.entries(payload.metadata)) {
        html += `<li><strong>${this.formatFieldName(key)}:</strong> ${value}</li>`;
      }
      html += '</ul>';
    }

    html += `
          <hr style="border: 1px solid #ddd;">
          <p style="font-size: 12px; color: #666; text-align: center;">
            This is an automated message from RMM Integration Platform.
            <br>Please do not reply to this email.
          </p>
        </div>
      </div>
    `;

    return html;
  }

  private formatFieldName(key: string): string {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .replace(/_/g, ' ');
  }

  private mapPriority(priority?: string): string {
    switch (priority) {
      case 'critical':
      case 'high':
        return 'high';
      case 'low':
        return 'low';
      default:
        return 'normal';
    }
  }

  private getSlackColor(priority?: string): string {
    switch (priority) {
      case 'critical':
        return '#ff0000';
      case 'high':
        return '#ff9800';
      case 'medium':
        return '#2196f3';
      case 'low':
        return '#4caf50';
      default:
        return '#808080';
    }
  }

  private getTeamsColor(priority?: string): string {
    switch (priority) {
      case 'critical':
        return 'ff0000';
      case 'high':
        return 'ff9800';
      case 'medium':
        return '2196f3';
      case 'low':
        return '4caf50';
      default:
        return '808080';
    }
  }

  private async saveNotification(payload: NotificationPayload, results: PromiseSettledResult<any>[]): Promise<void> {
    const notification = this.notificationRepository.create({
      channels: payload.channels,
      subject: payload.subject,
      message: payload.message,
      priority: payload.priority,
      recipients: payload.recipients,
      metadata: payload.metadata,
      status: results.every(r => r.status === 'fulfilled') ? 'sent' : 
              results.every(r => r.status === 'rejected') ? 'failed' : 'partial',
      sentAt: new Date(),
    });

    await this.notificationRepository.save(notification);
  }

  async sendTestNotification(channel: 'email' | 'slack' | 'teams', recipient?: string): Promise<void> {
    const payload: NotificationPayload = {
      channels: [channel],
      subject: 'Test Notification',
      message: `This is a test notification from RMM Integration Platform sent at ${new Date().toISOString()}`,
      priority: 'low',
      recipients: recipient ? [recipient] : undefined,
      metadata: {
        type: 'test',
        timestamp: new Date().toISOString(),
      },
    };

    await this.send(payload);
  }
}
