import { Router } from 'express';
import { AppDataSource } from '../database/dataSource';
import { AlertThreshold } from '../entities/AlertThreshold';
import { EscalationChain } from '../entities/EscalationChain';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { AlertThresholdService } from '../services/AlertThresholdService';

export const alertsRouter = Router();
alertsRouter.use(authMiddleware);

let alertService: AlertThresholdService | null = null;
let thresholdRepository: any;
let escalationRepository: any;

// Initialize repositories and service
const initializeService = async () => {
  if (!alertService) {
    alertService = await AlertThresholdService.getInstance();
    if (AppDataSource.isInitialized) {
      thresholdRepository = AppDataSource.getRepository(AlertThreshold);
      escalationRepository = AppDataSource.getRepository(EscalationChain);
    }
  }
  return alertService;
};

// GET all thresholds
alertsRouter.get('/thresholds', async (req: AuthRequest, res, next) => {
  try {
    const service = await initializeService();
    const thresholds = await service.listThresholds();
    res.json(thresholds);
  } catch (error) {
    next(error);
  }
});

// GET threshold by id
alertsRouter.get('/thresholds/:id', async (req: AuthRequest, res, next) => {
  try {
    const threshold = await thresholdRepository.findOne({
      where: { id: req.params.id }
    });
    
    if (!threshold) {
      return res.status(404).json({ message: 'Threshold not found' });
    }
    
    res.json(threshold);
  } catch (error) {
    next(error);
  }
});

// CREATE new threshold
alertsRouter.post('/thresholds', async (req: AuthRequest, res, next) => {
  try {
    const service = await initializeService();
    const threshold = await service.createThreshold(req.body);
    logger.info(`Alert threshold created: ${threshold.name} by ${req.user?.email}`);
    res.status(201).json(threshold);
  } catch (error) {
    next(error);
  }
});

// UPDATE threshold
alertsRouter.put('/thresholds/:id', async (req: AuthRequest, res, next) => {
  try {
    const service = await initializeService();
    const threshold = await service.updateThreshold(req.params.id, req.body);
    logger.info(`Alert threshold updated: ${threshold.name} by ${req.user?.email}`);
    res.json(threshold);
  } catch (error) {
    next(error);
  }
});

// DELETE threshold
alertsRouter.delete('/thresholds/:id', async (req: AuthRequest, res, next) => {
  try {
    const service = await initializeService();
    await service.deleteThreshold(req.params.id);
    logger.info(`Alert threshold deleted: ${req.params.id} by ${req.user?.email}`);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// TEST threshold
alertsRouter.post('/thresholds/:id/test', async (req: AuthRequest, res, next) => {
  try {
    const service = await initializeService();
    const threshold = await service.getThreshold(req.params.id);
    
    // Create a test metric
    const testMetric = {
      deviceId: 'test-device',
      deviceName: 'Test Device',
      metricType: threshold.type,
      value: req.body.value || threshold.value,
      timestamp: new Date(),
      metadata: req.body.metadata || {}
    };
    
    const result = await service.checkMetric(testMetric);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// TRIGGER manual check
alertsRouter.post('/thresholds/:id/check', async (req: AuthRequest, res, next) => {
  try {
    const threshold = await thresholdRepository.findOne({
      where: { id: req.params.id }
    });
    
    if (!threshold) {
      return res.status(404).json({ message: 'Threshold not found' });
    }
    
    const service = await initializeService();
    // Create a metric from the request
    const metric = {
      deviceId: req.body.deviceId || 'manual-check',
      deviceName: req.body.deviceName || 'Manual Check',
      metricType: threshold.type,
      value: req.body.value || 0,
      timestamp: new Date(),
      metadata: req.body.metadata || {}
    };
    const result = await service.checkMetric(metric);
    res.json({ success: result, message: result ? 'Check completed' : 'Check failed' });
  } catch (error) {
    next(error);
  }
});

// GET all escalation chains
alertsRouter.get('/escalations', async (req: AuthRequest, res, next) => {
  try {
    await initializeService();
    if (!escalationRepository) {
      escalationRepository = AppDataSource.getRepository(EscalationChain);
    }
    const chains = await escalationRepository.find();
    res.json(chains);
  } catch (error) {
    next(error);
  }
});

// GET escalation chain by id
alertsRouter.get('/escalations/:id', async (req: AuthRequest, res, next) => {
  try {
    const chain = await escalationRepository.findOne({
      where: { id: req.params.id }
    });
    
    if (!chain) {
      return res.status(404).json({ message: 'Escalation chain not found' });
    }
    
    res.json(chain);
  } catch (error) {
    next(error);
  }
});

// CREATE new escalation chain
alertsRouter.post('/escalations', async (req: AuthRequest, res, next) => {
  try {
    await initializeService();
    if (!escalationRepository) {
      escalationRepository = AppDataSource.getRepository(EscalationChain);
    }
    const chain = escalationRepository.create(req.body);
    const saved = await escalationRepository.save(chain);
    logger.info(`Escalation chain created: ${saved.name} by ${req.user?.email}`);
    res.status(201).json(saved);
  } catch (error) {
    next(error);
  }
});

// UPDATE escalation chain
alertsRouter.put('/escalations/:id', async (req: AuthRequest, res, next) => {
  try {
    await initializeService();
    if (!escalationRepository) {
      escalationRepository = AppDataSource.getRepository(EscalationChain);
    }
    const chain = await escalationRepository.findOne({ where: { id: req.params.id } });
    if (!chain) {
      return res.status(404).json({ message: 'Escalation chain not found' });
    }
    Object.assign(chain, req.body);
    const updated = await escalationRepository.save(chain);
    logger.info(`Escalation chain updated: ${updated.name} by ${req.user?.email}`);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// DELETE escalation chain
alertsRouter.delete('/escalations/:id', async (req: AuthRequest, res, next) => {
  try {
    await initializeService();
    if (!escalationRepository) {
      escalationRepository = AppDataSource.getRepository(EscalationChain);
    }
    const chain = await escalationRepository.findOne({ where: { id: req.params.id } });
    if (!chain) {
      return res.status(404).json({ message: 'Escalation chain not found' });
    }
    await escalationRepository.remove(chain);
    logger.info(`Escalation chain deleted: ${req.params.id} by ${req.user?.email}`);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// GET alert statistics
alertsRouter.get('/stats', async (req: AuthRequest, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    
    let query: any = {};
    if (startDate) {
      query.lastBreachAt = { 
        $gte: new Date(startDate as string) 
      };
    }
    if (endDate) {
      query.lastBreachAt = {
        ...query.lastBreachAt,
        $lte: new Date(endDate as string)
      };
    }

    const thresholds = await thresholdRepository.find({ where: query });
    
    const stats = {
      totalThresholds: thresholds.length,
      activeThresholds: thresholds.filter(t => t.enabled).length,
      recentBreaches: thresholds.filter(t => t.lastBreachAt && 
        t.lastBreachAt > new Date(Date.now() - 24 * 60 * 60 * 1000)
      ).length,
      totalBreaches: thresholds.reduce((sum, t) => sum + t.breachCount, 0),
      byType: {} as Record<string, number>,
      bySeverity: {} as Record<string, number>
    };

    // Group by type and severity
    for (const threshold of thresholds) {
      stats.byType[threshold.type] = (stats.byType[threshold.type] || 0) + 1;
      stats.bySeverity[threshold.severity] = (stats.bySeverity[threshold.severity] || 0) + 1;
    }

    res.json(stats);
  } catch (error) {
    next(error);
  }
});




