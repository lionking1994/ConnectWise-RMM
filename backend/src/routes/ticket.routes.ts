import { Router } from 'express';
import { AppDataSource } from '../database/dataSource';
import { Ticket } from '../entities/Ticket';
import { SyncService } from '../services/SyncService';
import { authMiddleware } from '../middleware/auth';
import { logger } from '../utils/logger';

export const ticketRouter = Router();

// Apply auth middleware to all routes
// TEMPORARILY DISABLED FOR DEMO
// ticketRouter.use(authMiddleware);

// Get all tickets - with option to sync from external sources
ticketRouter.get('/', async (req, res, next) => {
  try {
    const ticketRepository = AppDataSource.getRepository(Ticket);
    const syncService = SyncService.getInstance();
    const { sync } = req.query;
    
    // If sync=true, trigger a sync before returning tickets
    if (sync === 'true') {
      try {
        await syncService.syncAll();
        logger.info('Tickets synced from external sources');
      } catch (error) {
        logger.error('Sync failed but returning existing tickets:', error);
      }
    }
    
    const tickets = await ticketRepository.find({
      relations: ['assignedTo'],
      order: { createdAt: 'DESC' }
    });
    res.json(tickets);
  } catch (error) {
    next(error);
  }
});

// Force sync with external systems
ticketRouter.post('/sync', async (req, res, next) => {
  try {
    const ticketRepository = AppDataSource.getRepository(Ticket);
    const syncService = SyncService.getInstance();
    logger.info('Manual sync triggered');
    await syncService.syncAll();
    
    // Get updated ticket count
    const ticketCount = await ticketRepository.count();
    
    res.json({ 
      success: true, 
      message: 'Sync completed',
      ticketCount
    });
  } catch (error) {
    logger.error('Manual sync failed:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Sync failed', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Get real-time data from external sources
ticketRouter.get('/realtime', async (req, res, next) => {
  try {
    const syncService = SyncService.getInstance();
    const data = await syncService.fetchRealTimeData();
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// Get ticket by ID
ticketRouter.get('/:id', async (req, res, next) => {
  try {
    const ticketRepository = AppDataSource.getRepository(Ticket);
    const ticket = await ticketRepository.findOne({
      where: { id: req.params.id },
      relations: ['assignedTo', 'automationHistory']
    });
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }
    res.json(ticket);
  } catch (error) {
    next(error);
  }
});


