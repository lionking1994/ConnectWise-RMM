import { Router } from 'express';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { EscalationService } from '../services/EscalationService';
import { logger } from '../utils/logger';

const router = Router();

// Get all escalation chains
router.get('/chains', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const escalationService = new EscalationService();
    const { isActive, category } = req.query;
    const filters = {
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      category: category as string,
    };
    const chains = await escalationService.getEscalationChains(filters);
    res.json(chains);
  } catch (error) {
    next(error);
  }
});

// Create escalation chain
router.post('/chains', authenticate, authorize(['admin']), async (req: AuthRequest, res, next) => {
  try {
    const escalationService = new EscalationService();
    const chain = await escalationService.createEscalationChain(req.body, req.user);
    res.status(201).json(chain);
  } catch (error) {
    next(error);
  }
});

// Update escalation chain
router.put('/chains/:id', authenticate, authorize(['admin']), async (req: AuthRequest, res, next) => {
  try {
    const escalationService = new EscalationService();
    const chain = await escalationService.updateEscalationChain(
      Number(req.params.id),
      req.body,
      req.user
    );
    res.json(chain);
  } catch (error) {
    next(error);
  }
});

// Trigger escalation manually
router.post('/escalate', authenticate, authorize(['admin', 'technician']), async (req: AuthRequest, res, next) => {
  try {
    const escalationService = new EscalationService();
    const result = await escalationService.escalateTicket(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Complete escalation
router.post('/complete', authenticate, authorize(['admin', 'technician']), async (req: AuthRequest, res, next) => {
  try {
    const escalationService = new EscalationService();
    const { ticketId, resolution, notes, resolvedByUserId } = req.body;
    await escalationService.completeEscalation(
      ticketId,
      resolution,
      notes,
      resolvedByUserId || req.user.id
    );
    res.json({ message: 'Escalation completed successfully' });
  } catch (error) {
    next(error);
  }
});

// Get escalation history
router.get('/history', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { ticketId, chainId, status, limit } = req.query;
    const filters = {
      ticketId: ticketId ? Number(ticketId) : undefined,
      chainId: chainId ? Number(chainId) : undefined,
      status: status as string,
      limit: limit ? Number(limit) : 100,
    };
    const escalationService = new EscalationService();
    const history = await escalationService.getEscalationHistory(filters);
    res.json(history);
  } catch (error) {
    next(error);
  }
});

// Get technician profiles
router.get('/technicians', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const escalationService = new EscalationService();
    const profiles = await escalationService.getTechnicianProfiles();
    res.json(profiles);
  } catch (error) {
    next(error);
  }
});

// Update technician profile
router.put('/technicians/:userId', authenticate, authorize(['admin', 'technician']), async (req: AuthRequest, res, next) => {
  try {
    const escalationService = new EscalationService();
    const profile = await escalationService.updateTechnicianProfile(
      Number(req.params.userId),
      req.body
    );
    res.json(profile);
  } catch (error) {
    next(error);
  }
});

export default router;

