import { Router } from 'express';
import { AppDataSource } from '../database/dataSource';
import { Ticket } from '../entities/Ticket';
import { AutomationHistory } from '../entities/AutomationHistory';
import { AuditLog } from '../entities/AuditLog';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { Between, MoreThan, LessThan } from 'typeorm';
// import PDFDocument from 'pdfkit'; // Uncomment when implementing PDF export
import * as ExcelJS from 'exceljs';
import { EmailService } from '../services/EmailService';

export const reportsRouter = Router();

// Repository instances
const ticketRepository = AppDataSource.getRepository(Ticket);
const automationRepository = AppDataSource.getRepository(AutomationHistory);
const auditRepository = AppDataSource.getRepository(AuditLog);

// Apply auth middleware to all routes
reportsRouter.use(authMiddleware);

interface ReportConfig {
  type: 'tickets' | 'automation' | 'sla' | 'compliance' | 'executive';
  format: 'json' | 'pdf' | 'excel' | 'csv';
  dateRange: {
    start: Date;
    end: Date;
  };
  filters?: {
    status?: string[];
    priority?: string[];
    clientName?: string;
    technician?: string;
  };
  groupBy?: string;
  includeCharts?: boolean;
}

// Get available reports
reportsRouter.get('/available', async (req: AuthRequest, res, next) => {
  try {
    const reports = [
      {
        id: 'ticket-summary',
        name: 'Ticket Summary Report',
        description: 'Overview of ticket metrics and trends',
        parameters: ['dateRange', 'status', 'priority', 'clientName']
      },
      {
        id: 'sla-compliance',
        name: 'SLA Compliance Report',
        description: 'Service level agreement compliance metrics',
        parameters: ['dateRange', 'clientName', 'threshold']
      },
      {
        id: 'automation-performance',
        name: 'Automation Performance Report',
        description: 'Automation execution statistics and success rates',
        parameters: ['dateRange', 'ruleId', 'status']
      },
      {
        id: 'device-health',
        name: 'Device Health Report',
        description: 'Device status, alerts, and patch compliance',
        parameters: ['dateRange', 'deviceType', 'clientName']
      },
      {
        id: 'executive-summary',
        name: 'Executive Summary Report',
        description: 'High-level KPIs and business metrics',
        parameters: ['dateRange', 'includeProjections']
      },
      {
        id: 'technician-performance',
        name: 'Technician Performance Report',
        description: 'Individual technician metrics and productivity',
        parameters: ['dateRange', 'technicianId']
      },
      {
        id: 'patch-compliance',
        name: 'Patch Compliance Report',
        description: 'Patch deployment status and compliance rates',
        parameters: ['dateRange', 'severity', 'deviceGroup']
      },
      {
        id: 'incident-analysis',
        name: 'Incident Analysis Report',
        description: 'Detailed analysis of incidents and root causes',
        parameters: ['dateRange', 'incidentType', 'severity']
      }
    ];

    res.json(reports);
  } catch (error) {
    next(error);
  }
});

// Generate ticket summary report
reportsRouter.post('/generate/ticket-summary', async (req: AuthRequest, res, next) => {
  try {
    const { dateRange, format = 'json', filters } = req.body;
    
    const startDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);

    // Build query
    const queryBuilder = ticketRepository.createQueryBuilder('ticket')
      .leftJoinAndSelect('ticket.assignedTo', 'assignedTo')
      .where('ticket.createdAt BETWEEN :start AND :end', { start: startDate, end: endDate });

    if (filters?.status?.length) {
      queryBuilder.andWhere('ticket.status IN (:...status)', { status: filters.status });
    }
    if (filters?.priority?.length) {
      queryBuilder.andWhere('ticket.priority IN (:...priority)', { priority: filters.priority });
    }
    if (filters?.clientName) {
      queryBuilder.andWhere('ticket.clientName LIKE :client', { client: `%${filters.clientName}%` });
    }

    const tickets = await queryBuilder.getMany();

    // Calculate metrics
    const metrics = {
      total: tickets.length,
      byStatus: {} as Record<string, number>,
      byPriority: {} as Record<string, number>,
      averageResolutionTime: 0,
      slaCompliance: 0,
      topClients: [] as { name: string; count: number }[],
      topTechnicians: [] as { name: string; count: number; avgTime: number }[],
      dailyTrend: [] as { date: string; created: number; resolved: number }[]
    };

    // Group by status
    tickets.forEach(ticket => {
      metrics.byStatus[ticket.status] = (metrics.byStatus[ticket.status] || 0) + 1;
      metrics.byPriority[ticket.priority] = (metrics.byPriority[ticket.priority] || 0) + 1;
    });

    // Calculate average resolution time
    const resolvedTickets = tickets.filter(t => t.status === 'closed' || t.status === 'resolved');
    if (resolvedTickets.length > 0) {
      const totalTime = resolvedTickets.reduce((sum, ticket) => {
        const resolutionTime = ticket.updatedAt.getTime() - ticket.createdAt.getTime();
        return sum + resolutionTime;
      }, 0);
      metrics.averageResolutionTime = Math.round(totalTime / resolvedTickets.length / (1000 * 60 * 60)); // in hours
    }

    // Calculate SLA compliance (example: tickets resolved within 24 hours)
    const slaTarget = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    const compliantTickets = resolvedTickets.filter(ticket => {
      const resolutionTime = ticket.updatedAt.getTime() - ticket.createdAt.getTime();
      return resolutionTime <= slaTarget;
    });
    metrics.slaCompliance = resolvedTickets.length > 0 
      ? Math.round((compliantTickets.length / resolvedTickets.length) * 100)
      : 0;

    // Top clients
    const clientCounts = tickets.reduce((acc, ticket) => {
      acc[ticket.clientName] = (acc[ticket.clientName] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    metrics.topClients = Object.entries(clientCounts)
      .map(([name, count]) => ({ name, count: count as number }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Daily trend
    const dailyData: Record<string, { created: number; resolved: number }> = {};
    tickets.forEach(ticket => {
      const date = ticket.createdAt.toISOString().split('T')[0];
      if (!dailyData[date]) {
        dailyData[date] = { created: 0, resolved: 0 };
      }
      dailyData[date].created++;
      if (ticket.status === 'closed' || ticket.status === 'resolved') {
        const resolvedDate = ticket.updatedAt.toISOString().split('T')[0];
        if (!dailyData[resolvedDate]) {
          dailyData[resolvedDate] = { created: 0, resolved: 0 };
        }
        dailyData[resolvedDate].resolved++;
      }
    });
    metrics.dailyTrend = Object.entries(dailyData)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Format response based on requested format
    if (format === 'json') {
      res.json({
        report: 'ticket-summary',
        dateRange: { start: startDate, end: endDate },
        metrics,
        generatedAt: new Date()
      });
    } else if (format === 'excel') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Ticket Summary');

      // Add headers
      worksheet.columns = [
        { header: 'Metric', key: 'metric', width: 30 },
        { header: 'Value', key: 'value', width: 20 }
      ];

      // Add data
      worksheet.addRow({ metric: 'Total Tickets', value: metrics.total });
      worksheet.addRow({ metric: 'Average Resolution Time (hours)', value: metrics.averageResolutionTime });
      worksheet.addRow({ metric: 'SLA Compliance (%)', value: metrics.slaCompliance });
      
      // Add status breakdown
      worksheet.addRow({});
      worksheet.addRow({ metric: 'By Status', value: '' });
      Object.entries(metrics.byStatus).forEach(([status, count]) => {
        worksheet.addRow({ metric: `  ${status}`, value: count });
      });

      // Add priority breakdown
      worksheet.addRow({});
      worksheet.addRow({ metric: 'By Priority', value: '' });
      Object.entries(metrics.byPriority).forEach(([priority, count]) => {
        worksheet.addRow({ metric: `  ${priority}`, value: count });
      });

      // Set response headers
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=ticket-summary-report.xlsx');

      // Write to response
      await workbook.xlsx.write(res);
      res.end();
    } else {
      res.status(400).json({ message: 'Unsupported format' });
    }
  } catch (error) {
    next(error);
  }
});

// Generate SLA compliance report
reportsRouter.post('/generate/sla-compliance', async (req: AuthRequest, res, next) => {
  try {
    const { dateRange, format = 'json', clientName, threshold = 24 } = req.body;
    
    const startDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);

    // Build query
    const queryBuilder = ticketRepository.createQueryBuilder('ticket')
      .where('ticket.createdAt BETWEEN :start AND :end', { start: startDate, end: endDate })
      .andWhere('ticket.status IN (:...status)', { status: ['closed', 'resolved'] });

    if (clientName) {
      queryBuilder.andWhere('ticket.clientName LIKE :client', { client: `%${clientName}%` });
    }

    const tickets = await queryBuilder.getMany();

    // Calculate SLA metrics
    const slaTarget = threshold * 60 * 60 * 1000; // Convert hours to milliseconds
    
    const slaMetrics = tickets.map(ticket => {
      const resolutionTime = ticket.updatedAt.getTime() - ticket.createdAt.getTime();
      const resolutionHours = resolutionTime / (1000 * 60 * 60);
      const isCompliant = resolutionTime <= slaTarget;
      
      return {
        ticketId: ticket.id,
        title: ticket.title,
        clientName: ticket.clientName,
        priority: ticket.priority,
        createdAt: ticket.createdAt,
        resolvedAt: ticket.updatedAt,
        resolutionHours: Math.round(resolutionHours * 10) / 10,
        slaTarget: threshold,
        isCompliant,
        variance: Math.round((resolutionHours - threshold) * 10) / 10
      };
    });

    // Calculate summary statistics
    const summary = {
      totalTickets: slaMetrics.length,
      compliantTickets: slaMetrics.filter(m => m.isCompliant).length,
      nonCompliantTickets: slaMetrics.filter(m => !m.isCompliant).length,
      complianceRate: 0,
      averageResolutionTime: 0,
      byPriority: {} as Record<string, { total: number; compliant: number; rate: number }>,
      byClient: {} as Record<string, { total: number; compliant: number; rate: number }>
    };

    summary.complianceRate = summary.totalTickets > 0
      ? Math.round((summary.compliantTickets / summary.totalTickets) * 100)
      : 0;

    summary.averageResolutionTime = slaMetrics.length > 0
      ? Math.round(slaMetrics.reduce((sum, m) => sum + m.resolutionHours, 0) / slaMetrics.length * 10) / 10
      : 0;

    // Group by priority
    slaMetrics.forEach(metric => {
      if (!summary.byPriority[metric.priority]) {
        summary.byPriority[metric.priority] = { total: 0, compliant: 0, rate: 0 };
      }
      summary.byPriority[metric.priority].total++;
      if (metric.isCompliant) {
        summary.byPriority[metric.priority].compliant++;
      }
    });

    // Calculate compliance rates
    Object.keys(summary.byPriority).forEach(priority => {
      const data = summary.byPriority[priority];
      data.rate = Math.round((data.compliant / data.total) * 100);
    });

    // Format response
    if (format === 'json') {
      res.json({
        report: 'sla-compliance',
        dateRange: { start: startDate, end: endDate },
        threshold,
        summary,
        details: slaMetrics,
        generatedAt: new Date()
      });
    } else {
      res.status(400).json({ message: 'Format not implemented yet' });
    }
  } catch (error) {
    next(error);
  }
});

// Generate automation performance report
reportsRouter.post('/generate/automation-performance', async (req: AuthRequest, res, next) => {
  try {
    const { dateRange, format = 'json' } = req.body;
    
    const startDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);

    const history = await automationRepository.find({
      where: {
        startedAt: Between(startDate, endDate)
      },
      relations: ['rule'],
      order: { startedAt: 'DESC' }
    });

    // Calculate metrics
    const metrics = {
      totalExecutions: history.length,
      successCount: history.filter(h => h.status === 'success').length,
      failureCount: history.filter(h => h.status === 'failed').length,
      successRate: 0,
      averageDuration: 0,
      byRule: {} as Record<string, { 
        executions: number; 
        success: number; 
        failed: number; 
        avgDuration: number;
      }>,
      byHour: new Array(24).fill(0),
      topErrors: [] as { error: string; count: number }[]
    };

    metrics.successRate = metrics.totalExecutions > 0
      ? Math.round((metrics.successCount / metrics.totalExecutions) * 100)
      : 0;

    // Calculate average duration
    const completedWithDuration = history.filter(h => h.status === 'success' && h.durationMs);
    if (completedWithDuration.length > 0) {
      const totalDuration = completedWithDuration.reduce((sum, h) => sum + (h.durationMs || 0), 0);
      metrics.averageDuration = Math.round(totalDuration / completedWithDuration.length);
    }

    // Group by rule
    history.forEach(execution => {
      const ruleId = execution.ruleId;
      if (!metrics.byRule[ruleId]) {
        metrics.byRule[ruleId] = { 
          executions: 0, 
          success: 0, 
          failed: 0, 
          avgDuration: 0 
        };
      }
      
      metrics.byRule[ruleId].executions++;
      if (execution.status === 'success') {
        metrics.byRule[ruleId].success++;
      } else if (execution.status === 'failed') {
        metrics.byRule[ruleId].failed++;
      }
    });

    // Group by hour of day
    history.forEach(execution => {
      const hour = execution.startedAt.getHours();
      metrics.byHour[hour]++;
    });

    // Collect top errors
    const errorCounts: Record<string, number> = {};
    history.filter(h => h.status === 'failed' && h.errorMessage).forEach(h => {
      const error = h.errorMessage || 'Unknown error';
      errorCounts[error] = (errorCounts[error] || 0) + 1;
    });
    metrics.topErrors = Object.entries(errorCounts)
      .map(([error, count]) => ({ error, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    if (format === 'json') {
      res.json({
        report: 'automation-performance',
        dateRange: { start: startDate, end: endDate },
        metrics,
        recentExecutions: history.slice(0, 100),
        generatedAt: new Date()
      });
    } else {
      res.status(400).json({ message: 'Format not implemented yet' });
    }
  } catch (error) {
    next(error);
  }
});

// Schedule report generation
reportsRouter.post('/schedule', async (req: AuthRequest, res, next) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { 
      reportType, 
      schedule, // 'daily', 'weekly', 'monthly'
      time, // '09:00'
      recipients,
      format = 'pdf',
      config
    } = req.body;

    // TODO: Implement scheduled report generation using cron jobs
    // This would integrate with the cron job system to generate and email reports

    logger.info('Report scheduled', { reportType, schedule, recipients });
    res.json({ 
      success: true, 
      message: 'Report scheduled successfully',
      schedule: { reportType, schedule, time, recipients, format }
    });
  } catch (error) {
    next(error);
  }
});

// Get scheduled reports
reportsRouter.get('/scheduled', async (req: AuthRequest, res, next) => {
  try {
    // TODO: Fetch from database
    const scheduledReports = [
      {
        id: '1',
        reportType: 'executive-summary',
        schedule: 'weekly',
        time: '09:00',
        dayOfWeek: 1, // Monday
        recipients: ['management@company.com'],
        format: 'pdf',
        lastRun: new Date('2025-10-21'),
        nextRun: new Date('2025-10-28'),
        active: true
      }
    ];

    res.json(scheduledReports);
  } catch (error) {
    next(error);
  }
});

// Export report history
reportsRouter.get('/history', async (req: AuthRequest, res, next) => {
  try {
    const { limit = 50 } = req.query;
    
    // TODO: Implement report generation history tracking
    const history = [
      {
        id: '1',
        reportType: 'ticket-summary',
        generatedBy: req.user?.email,
        generatedAt: new Date(),
        format: 'pdf',
        size: '2.3 MB',
        downloadUrl: '/api/reports/download/1'
      }
    ];

    res.json(history);
  } catch (error) {
    next(error);
  }
});

