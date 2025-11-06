import nodemailer, { Transporter } from 'nodemailer';
import { logger } from '../utils/logger';
import { Ticket } from '../entities/Ticket';
import { User } from '../entities/User';
import { ScriptOutput } from './automation/ScriptOutputBridge';

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
}

export class EmailService {
  private static instance: EmailService;
  private transporter: Transporter | null = null;
  private config: EmailConfig;
  private isConfigured: boolean = false;

  private constructor() {
    this.config = {
      host: process.env.SMTP_HOST || '',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || ''
      },
      from: process.env.SMTP_FROM || 'noreply@rmm-integration.com'
    };

    if (this.config.host && this.config.auth.user) {
      this.initializeTransporter();
    }
  }

  public static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  private initializeTransporter(): void {
    try {
      this.transporter = nodemailer.createTransport(this.config);
      this.isConfigured = true;
      logger.info('Email service initialized');
    } catch (error) {
      logger.error('Failed to initialize email service:', error);
      this.isConfigured = false;
    }
  }

  async sendTicketNotification(
    ticket: Ticket,
    recipients: string[],
    action: 'created' | 'updated' | 'resolved' | 'closed' | 'escalated'
  ): Promise<void> {
    if (!this.isConfigured || !this.transporter) {
      logger.warn('Email service not configured');
      return;
    }

    const subject = `[Ticket ${ticket.ticketNumber}] ${action.charAt(0).toUpperCase() + action.slice(1)} - ${ticket.title}`;
    const html = this.generateTicketEmailHtml(ticket, action);

    try {
      await this.transporter.sendMail({
        from: this.config.from,
        to: recipients.join(','),
        subject,
        html
      });
      logger.info(`Ticket notification email sent for ${ticket.ticketNumber}`);
    } catch (error) {
      logger.error('Failed to send ticket notification email:', error);
      throw error;
    }
  }

  async sendAutomationAlert(
    ruleName: string,
    ticketNumber: string,
    success: boolean,
    details: string,
    recipients: string[]
  ): Promise<void> {
    if (!this.isConfigured || !this.transporter) {
      logger.warn('Email service not configured');
      return;
    }

    const subject = `[Automation] ${success ? 'Success' : 'Failed'} - ${ruleName}`;
    const html = this.generateAutomationEmailHtml(ruleName, ticketNumber, success, details);

    try {
      await this.transporter.sendMail({
        from: this.config.from,
        to: recipients.join(','),
        subject,
        html
      });
      logger.info('Automation alert email sent');
    } catch (error) {
      logger.error('Failed to send automation alert email:', error);
      throw error;
    }
  }

  async sendScriptResultEmail(
    scriptOutput: ScriptOutput,
    recipients: string[]
  ): Promise<void> {
    if (!this.isConfigured || !this.transporter) {
      logger.warn('Email service not configured');
      return;
    }

    const subject = `[Script Execution] ${scriptOutput.success ? 'Completed' : 'Failed'} - ${scriptOutput.scriptName}`;
    const html = this.generateScriptResultEmailHtml(scriptOutput);

    try {
      await this.transporter.sendMail({
        from: this.config.from,
        to: recipients.join(','),
        subject,
        html
      });
      logger.info('Script result email sent');
    } catch (error) {
      logger.error('Failed to send script result email:', error);
      throw error;
    }
  }

  async sendSystemAlert(
    title: string,
    message: string,
    severity: 'info' | 'warning' | 'error' | 'critical',
    recipients: string[]
  ): Promise<void> {
    if (!this.isConfigured || !this.transporter) {
      logger.warn('Email service not configured');
      return;
    }

    const subject = `[System Alert - ${severity.toUpperCase()}] ${title}`;
    const html = this.generateSystemAlertEmailHtml(title, message, severity);

    try {
      await this.transporter.sendMail({
        from: this.config.from,
        to: recipients.join(','),
        subject,
        html
      });
      logger.info('System alert email sent');
    } catch (error) {
      logger.error('Failed to send system alert email:', error);
      throw error;
    }
  }

  async sendAlertNotification(
    recipient: string,
    subject: string,
    message: string,
    severity: string
  ): Promise<void> {
    if (!this.isConfigured || !this.transporter) {
      logger.warn('Email service not configured, skipping alert notification');
      return;
    }

    const severityColors = {
      info: '#0078D4',
      warning: '#FFA500',
      error: '#FF6B6B',
      critical: '#FF0000'
    };

    const color = severityColors[severity.toLowerCase()] || '#0078D4';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: ${color}; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">🚨 Alert Notification</h1>
        </div>
        <div style="padding: 20px; background: #f5f5f5;">
          <h2 style="color: ${color};">${subject}</h2>
          <div style="background: white; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <pre style="white-space: pre-wrap; word-wrap: break-word;">${message}</pre>
          </div>
          <div style="margin-top: 20px; padding: 15px; background: white; border-radius: 5px;">
            <p style="margin: 0;"><strong>Severity:</strong> ${severity.toUpperCase()}</p>
            <p style="margin: 5px 0;"><strong>Time:</strong> ${new Date().toLocaleString()}</p>
          </div>
          <div style="text-align: center; margin-top: 20px;">
            <a href="${process.env.FRONTEND_URL}/alerts" style="display: inline-block; padding: 10px 20px; background: ${color}; color: white; text-decoration: none; border-radius: 5px;">View in Dashboard</a>
          </div>
        </div>
        <div style="padding: 10px; text-align: center; color: #666; font-size: 12px;">
          <p>This is an automated alert from ConnectWise-NRMM Integration Platform</p>
        </div>
      </div>
    `;

    const mailOptions = {
      from: this.config.from,
      to: recipient,
      subject: `[${severity.toUpperCase()}] ${subject}`,
      html
    };

    try {
      await this.transporter.sendMail(mailOptions);
      logger.info(`Alert notification sent to ${recipient}`);
    } catch (error) {
      logger.error('Failed to send alert notification:', error);
      throw error;
    }
  }

  async sendPasswordResetEmail(user: User, resetToken: string): Promise<void> {
    if (!this.isConfigured || !this.transporter) {
      logger.warn('Email service not configured');
      return;
    }

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    const subject = 'Password Reset Request - RMM Integration Platform';
    const html = this.generatePasswordResetEmailHtml(user, resetUrl);

    try {
      await this.transporter.sendMail({
        from: this.config.from,
        to: user.email,
        subject,
        html
      });
      logger.info(`Password reset email sent to ${user.email}`);
    } catch (error) {
      logger.error('Failed to send password reset email:', error);
      throw error;
    }
  }

  async sendWeeklySummary(
    recipients: string[],
    stats: {
      totalTickets: number;
      resolvedTickets: number;
      automationRuns: number;
      successRate: number;
      topIssues: Array<{ issue: string; count: number }>;
    }
  ): Promise<void> {
    if (!this.isConfigured || !this.transporter) {
      logger.warn('Email service not configured');
      return;
    }

    const subject = 'Weekly RMM Integration Summary';
    const html = this.generateWeeklySummaryEmailHtml(stats);

    try {
      await this.transporter.sendMail({
        from: this.config.from,
        to: recipients.join(','),
        subject,
        html
      });
      logger.info('Weekly summary email sent');
    } catch (error) {
      logger.error('Failed to send weekly summary email:', error);
      throw error;
    }
  }

  private generateTicketEmailHtml(ticket: Ticket, action: string): string {
    const priorityColors: Record<string, string> = {
      low: '#4CAF50',
      medium: '#FF9800',
      high: '#FF5722',
      critical: '#F44336'
    };

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #1976D2; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
            .content { background: #f5f5f5; padding: 20px; border: 1px solid #ddd; }
            .priority { display: inline-block; padding: 5px 10px; border-radius: 3px; color: white; font-weight: bold; }
            .field { margin: 10px 0; }
            .label { font-weight: bold; color: #333; }
            .button { display: inline-block; padding: 10px 20px; background: #1976D2; color: white; text-decoration: none; border-radius: 5px; margin-top: 15px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>Ticket ${action.charAt(0).toUpperCase() + action.slice(1)}</h2>
            </div>
            <div class="content">
              <div class="field">
                <span class="label">Ticket Number:</span> ${ticket.ticketNumber}
              </div>
              <div class="field">
                <span class="label">Title:</span> ${ticket.title}
              </div>
              <div class="field">
                <span class="label">Client:</span> ${ticket.clientName}
              </div>
              <div class="field">
                <span class="label">Status:</span> ${ticket.status}
              </div>
              <div class="field">
                <span class="label">Priority:</span>
                <span class="priority" style="background: ${priorityColors[ticket.priority] || '#999'};">
                  ${ticket.priority.toUpperCase()}
                </span>
              </div>
              <div class="field">
                <span class="label">Description:</span>
                <p>${ticket.description}</p>
              </div>
              <a href="${process.env.FRONTEND_URL}/tickets/${ticket.id}" class="button">
                View Ticket
              </a>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private generateAutomationEmailHtml(
    ruleName: string,
    ticketNumber: string,
    success: boolean,
    details: string
  ): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: ${success ? '#4CAF50' : '#F44336'}; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
            .content { background: #f5f5f5; padding: 20px; border: 1px solid #ddd; }
            .field { margin: 10px 0; }
            .label { font-weight: bold; color: #333; }
            .details { background: white; padding: 15px; border-radius: 5px; margin-top: 15px; }
            .button { display: inline-block; padding: 10px 20px; background: #1976D2; color: white; text-decoration: none; border-radius: 5px; margin-top: 15px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>Automation ${success ? 'Succeeded' : 'Failed'}</h2>
            </div>
            <div class="content">
              <div class="field">
                <span class="label">Rule:</span> ${ruleName}
              </div>
              <div class="field">
                <span class="label">Ticket:</span> ${ticketNumber}
              </div>
              <div class="field">
                <span class="label">Status:</span> ${success ? 'Success' : 'Failed'}
              </div>
              <div class="field">
                <span class="label">Time:</span> ${new Date().toLocaleString()}
              </div>
              <div class="details">
                <strong>Details:</strong>
                <pre>${details}</pre>
              </div>
              <a href="${process.env.FRONTEND_URL}/tickets?search=${ticketNumber}" class="button">
                View Ticket
              </a>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private generateScriptResultEmailHtml(scriptOutput: ScriptOutput): string {
    const outputPreview = scriptOutput.output.length > 1000
      ? scriptOutput.output.substring(0, 1000) + '...'
      : scriptOutput.output;

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: ${scriptOutput.success ? '#4CAF50' : '#F44336'}; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
            .content { background: #f5f5f5; padding: 20px; border: 1px solid #ddd; }
            .field { margin: 10px 0; }
            .label { font-weight: bold; color: #333; }
            .output { background: #263238; color: #aed581; padding: 15px; border-radius: 5px; margin-top: 15px; font-family: monospace; overflow-x: auto; }
            .findings { background: white; padding: 15px; border-radius: 5px; margin-top: 15px; }
            .finding { margin: 5px 0; padding: 5px; }
            .finding.error { border-left: 3px solid #F44336; }
            .finding.warning { border-left: 3px solid #FF9800; }
            .finding.info { border-left: 3px solid #2196F3; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>Script Execution ${scriptOutput.success ? 'Completed' : 'Failed'}</h2>
            </div>
            <div class="content">
              <div class="field">
                <span class="label">Device:</span> ${scriptOutput.deviceName}
              </div>
              <div class="field">
                <span class="label">Script:</span> ${scriptOutput.scriptName}
              </div>
              <div class="field">
                <span class="label">Exit Code:</span> ${scriptOutput.exitCode}
              </div>
              <div class="field">
                <span class="label">Execution Time:</span> ${scriptOutput.timestamp.toLocaleString()}
              </div>
              ${
                scriptOutput.parsedResults && scriptOutput.parsedResults.findings.length > 0
                  ? `
                    <div class="findings">
                      <strong>Findings:</strong>
                      ${scriptOutput.parsedResults.findings
                        .map(
                          f => `<div class="finding ${f.severity}">[${f.severity.toUpperCase()}] ${f.issue}: ${f.details}</div>`
                        )
                        .join('')}
                    </div>
                  `
                  : ''
              }
              <div class="output">
                <strong>Output:</strong>
                <pre>${outputPreview}</pre>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private generateSystemAlertEmailHtml(
    title: string,
    message: string,
    severity: string
  ): string {
    const severityColors: Record<string, string> = {
      info: '#2196F3',
      warning: '#FF9800',
      error: '#F44336',
      critical: '#B71C1C'
    };

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: ${severityColors[severity] || '#333'}; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
            .content { background: #f5f5f5; padding: 20px; border: 1px solid #ddd; }
            .message { background: white; padding: 15px; border-radius: 5px; margin-top: 15px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>System Alert - ${severity.toUpperCase()}</h2>
            </div>
            <div class="content">
              <h3>${title}</h3>
              <div class="message">
                ${message}
              </div>
              <p><small>Time: ${new Date().toLocaleString()}</small></p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private generatePasswordResetEmailHtml(user: User, resetUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #1976D2; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
            .content { background: #f5f5f5; padding: 20px; border: 1px solid #ddd; }
            .button { display: inline-block; padding: 12px 30px; background: #1976D2; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>Password Reset Request</h2>
            </div>
            <div class="content">
              <p>Hello ${user.firstName || 'User'},</p>
              <p>We received a request to reset your password for the RMM Integration Platform.</p>
              <p>Click the button below to reset your password:</p>
              <a href="${resetUrl}" class="button">Reset Password</a>
              <p>This link will expire in 1 hour.</p>
              <p>If you didn't request this, please ignore this email.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private generateWeeklySummaryEmailHtml(stats: any): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #1976D2; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
            .content { background: #f5f5f5; padding: 20px; border: 1px solid #ddd; }
            .stat-box { background: white; padding: 15px; border-radius: 5px; margin: 10px 0; }
            .stat-value { font-size: 24px; font-weight: bold; color: #1976D2; }
            .stat-label { color: #666; }
            .issue-list { background: white; padding: 15px; border-radius: 5px; margin-top: 15px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>Weekly Summary - RMM Integration Platform</h2>
            </div>
            <div class="content">
              <div class="stat-box">
                <div class="stat-value">${stats.totalTickets}</div>
                <div class="stat-label">Total Tickets</div>
              </div>
              <div class="stat-box">
                <div class="stat-value">${stats.resolvedTickets}</div>
                <div class="stat-label">Resolved Tickets</div>
              </div>
              <div class="stat-box">
                <div class="stat-value">${stats.automationRuns}</div>
                <div class="stat-label">Automation Runs</div>
              </div>
              <div class="stat-box">
                <div class="stat-value">${stats.successRate.toFixed(1)}%</div>
                <div class="stat-label">Success Rate</div>
              </div>
              ${
                stats.topIssues && stats.topIssues.length > 0
                  ? `
                    <div class="issue-list">
                      <h3>Top Issues This Week</h3>
                      <ul>
                        ${stats.topIssues.map(issue => `<li>${issue.issue} (${issue.count} occurrences)</li>`).join('')}
                      </ul>
                    </div>
                  `
                  : ''
              }
            </div>
          </div>
        </body>
      </html>
    `;
  }

  async testConnection(): Promise<boolean> {
    if (!this.isConfigured || !this.transporter) {
      return false;
    }

    try {
      await this.transporter.verify();
      logger.info('Email service connection verified');
      return true;
    } catch (error) {
      logger.error('Email service connection test failed:', error);
      return false;
    }
  }
}


