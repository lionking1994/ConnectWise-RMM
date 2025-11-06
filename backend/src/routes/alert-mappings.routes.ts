import { Router } from 'express';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { AlertMappingService } from '../services/AlertMappingService';
import { logger } from '../utils/logger';

const router = Router();

// Get all alert mappings
router.get('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const mappingService = new AlertMappingService();
    const { isActive, alertType, scriptId } = req.query;
    const filters = {
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      alertType: alertType as string,
      scriptId: scriptId ? Number(scriptId) : undefined,
    };
    const mappings = await mappingService.getAllMappings(filters);
    res.json(mappings);
  } catch (error) {
    next(error);
  }
});

// Get mapping by ID
router.get('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const mappingService = new AlertMappingService();
    const mapping = await mappingService.getMappingById(Number(req.params.id));
    if (!mapping) {
      return res.status(404).json({ error: 'Alert mapping not found' });
    }
    res.json(mapping);
  } catch (error) {
    next(error);
  }
});

// Create alert mapping
router.post('/', authenticate, authorize(['admin', 'technician']), async (req: AuthRequest, res, next) => {
  try {
    const mappingService = new AlertMappingService();
    const mapping = await mappingService.createMapping(req.body, req.user);
    res.status(201).json(mapping);
  } catch (error) {
    next(error);
  }
});

// Update alert mapping
router.put('/:id', authenticate, authorize(['admin', 'technician']), async (req: AuthRequest, res, next) => {
  try {
    const mappingService = new AlertMappingService();
    const mapping = await mappingService.updateMapping(
      Number(req.params.id),
      req.body,
      req.user
    );
    res.json(mapping);
  } catch (error) {
    next(error);
  }
});

// Test mapping with sample data
router.post('/:id/test', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const mappingService = new AlertMappingService();
    const result = await mappingService.testMapping(
      Number(req.params.id),
      req.body
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Process alert (manual trigger)
router.post('/process', authenticate, authorize(['admin', 'technician']), async (req: AuthRequest, res, next) => {
  try {
    const mappingService = new AlertMappingService();
    const { alertData, ticketId } = req.body;
    const results = await mappingService.processAlert(alertData, ticketId);
    res.json(results);
  } catch (error) {
    next(error);
  }
});

// Get execution history
router.get('/executions/history', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { mappingId, alertType, deviceId, status, limit } = req.query;
    const filters = {
      mappingId: mappingId ? Number(mappingId) : undefined,
      alertType: alertType as string,
      deviceId: deviceId as string,
      status: status as string,
      limit: limit ? Number(limit) : 100,
    };
    const mappingService = new AlertMappingService();
    const history = await mappingService.getExecutionHistory(filters);
    res.json(history);
  } catch (error) {
    next(error);
  }
});

// Clone mapping
router.post('/:id/clone', authenticate, authorize(['admin', 'technician']), async (req: AuthRequest, res, next) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'New name is required' });
    }
    const mappingService = new AlertMappingService();
    const mapping = await mappingService.cloneMapping(
      Number(req.params.id),
      name,
      req.user
    );
    res.status(201).json(mapping);
  } catch (error) {
    next(error);
  }
});

// Delete alert mapping
router.delete('/:id', authenticate, authorize(['admin']), async (req: AuthRequest, res, next) => {
  try {
    const mappingService = new AlertMappingService();
    await mappingService.deleteMapping(Number(req.params.id));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;

