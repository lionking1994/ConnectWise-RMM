import { Router } from 'express';
import { AppDataSource } from '../database/dataSource';

export const analyticsRouter = Router();

// Dashboard stats
analyticsRouter.get('/dashboard-stats', async (req, res, next) => {
  try {
    // Mock data for now
    res.json({
      openTickets: 42,
      openTicketsChange: 5,
      automationSuccessRate: 87,
      automationSuccessChange: 3,
      avgResolutionTime: 2.5,
      resolutionTimeChange: -15,
      activeDevices: 156,
      devicesChange: 8,
      ticketsByPriority: [
        { name: 'Critical', value: 5 },
        { name: 'High', value: 15 },
        { name: 'Medium', value: 30 },
        { name: 'Low', value: 25 }
      ]
    });
  } catch (error) {
    next(error);
  }
});


