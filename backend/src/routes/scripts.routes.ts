import { Router } from 'express';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { ScriptService } from '../services/ScriptService';
import { Script, ScriptType, ScriptCategory } from '../entities/Script';
import { logger } from '../utils/logger';

const router = Router();

// Get all scripts
router.get('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const scriptService = new ScriptService();
    const { category, type, isActive, isTemplate } = req.query;
    
    const filters = {
      category: category as ScriptCategory,
      type: type as ScriptType,
      isActive: isActive === 'true',
      isTemplate: isTemplate === 'true',
    };

    const scripts = await scriptService.getAllScripts(filters);
    res.json(scripts);
  } catch (error) {
    next(error);
  }
});

// Get script templates
router.get('/templates', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const scriptService = new ScriptService();
    const templates = scriptService.getScriptTemplates();
    res.json(templates);
  } catch (error) {
    next(error);
  }
});

// Get script by ID
router.get('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const scriptService = new ScriptService();
    const script = await scriptService.getScriptById(Number(req.params.id));
    if (!script) {
      return res.status(404).json({ error: 'Script not found' });
    }
    res.json(script);
  } catch (error) {
    next(error);
  }
});

// Create script
router.post('/', authenticate, authorize(['admin', 'technician']), async (req: AuthRequest, res, next) => {
  try {
    const scriptService = new ScriptService();
    const script = await scriptService.createScript(req.body, req.user);
    res.status(201).json(script);
  } catch (error) {
    next(error);
  }
});

// Update script
router.put('/:id', authenticate, authorize(['admin', 'technician']), async (req: AuthRequest, res, next) => {
  try {
    const scriptService = new ScriptService();
    const script = await scriptService.updateScript(
      Number(req.params.id),
      req.body,
      req.user
    );
    res.json(script);
  } catch (error) {
    next(error);
  }
});

// Clone script
router.post('/:id/clone', authenticate, authorize(['admin', 'technician']), async (req: AuthRequest, res, next) => {
  try {
    const scriptService = new ScriptService();
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'New name is required' });
    }

    const script = await scriptService.cloneScript(
      Number(req.params.id),
      name,
      req.user
    );
    res.status(201).json(script);
  } catch (error) {
    next(error);
  }
});

// Test script
router.post('/test', authenticate, authorize(['admin', 'technician']), async (req: AuthRequest, res, next) => {
  try {
    const scriptService = new ScriptService();
    const { type, content, parameters } = req.body;
    
    if (!type || !content) {
      return res.status(400).json({ error: 'Type and content are required' });
    }

    const result = await scriptService.testScript(type, content, parameters);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Execute script
router.post('/:id/execute', authenticate, authorize(['admin', 'technician']), async (req: AuthRequest, res, next) => {
  try {
    const scriptService = new ScriptService();
    const { deviceId, parameters, ticketId } = req.body;
    
    if (!deviceId) {
      return res.status(400).json({ error: 'Device ID is required' });
    }

    const execution = await scriptService.executeScript(
      Number(req.params.id),
      deviceId,
      parameters || {},
      ticketId,
      req.user?.email || 'system'
    );

    res.json(execution);
  } catch (error) {
    next(error);
  }
});

// Get execution history
router.get('/executions/history', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const scriptService = new ScriptService();
    const { scriptId, deviceId, ticketId, status, limit } = req.query;
    
    const filters = {
      scriptId: scriptId ? Number(scriptId) : undefined,
      deviceId: deviceId as string,
      ticketId: ticketId ? Number(ticketId) : undefined,
      status: status as string,
      limit: limit ? Number(limit) : 100,
    };

    const history = await scriptService.getExecutionHistory(filters);
    res.json(history);
  } catch (error) {
    next(error);
  }
});

// Delete script
router.delete('/:id', authenticate, authorize(['admin']), async (req: AuthRequest, res, next) => {
  try {
    const scriptService = new ScriptService();
    await scriptService.deleteScript(Number(req.params.id));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;

