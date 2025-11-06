import { Router } from 'express';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { BoardManagementService } from '../services/BoardManagementService';
import { logger } from '../utils/logger';

const router = Router();

// Get all configured boards
router.get('/configured', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const boardService = new BoardManagementService();
    const activeOnly = req.query.activeOnly !== 'false';
    const boards = await boardService.getConfiguredBoards(activeOnly);
    res.json(boards);
  } catch (error) {
    next(error);
  }
});

// Get available boards from ConnectWise
router.get('/available', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const boardService = new BoardManagementService();
    const boards = await boardService.fetchAvailableBoards();
    res.json(boards);
  } catch (error) {
    next(error);
  }
});

// Get primary board
router.get('/primary', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const boardService = new BoardManagementService();
    const board = await boardService.getPrimaryBoard();
    res.json(board);
  } catch (error) {
    next(error);
  }
});

// Configure a new board
router.post('/configure', authenticate, authorize(['admin']), async (req: AuthRequest, res, next) => {
  try {
    const boardService = new BoardManagementService();
    const { boardId, boardName, settings, isPrimary } = req.body;
    const board = await boardService.configureBoard(
      boardId,
      boardName,
      settings,
      req.user,
      isPrimary
    );
    res.status(201).json(board);
  } catch (error) {
    next(error);
  }
});

// Update board configuration
router.put('/:boardId', authenticate, authorize(['admin']), async (req: AuthRequest, res, next) => {
  try {
    const boardService = new BoardManagementService();
    const board = await boardService.updateBoardConfig(
      req.params.boardId,
      req.body,
      req.user
    );
    res.json(board);
  } catch (error) {
    next(error);
  }
});

// Sync a specific board
router.post('/:boardId/sync', authenticate, authorize(['admin', 'technician']), async (req: AuthRequest, res, next) => {
  try {
    const boardService = new BoardManagementService();
    const result = await boardService.syncBoard(req.params.boardId, 'manual');
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Sync all boards
router.post('/sync-all', authenticate, authorize(['admin', 'technician']), async (req: AuthRequest, res, next) => {
  try {
    const boardService = new BoardManagementService();
    const results = await boardService.syncAllBoards();
    res.json(results);
  } catch (error) {
    next(error);
  }
});

// Get sync history for a board
router.get('/:boardId/sync-history', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const boardService = new BoardManagementService();
    const limit = Number(req.query.limit) || 50;
    const history = await boardService.getSyncHistory(req.params.boardId, limit);
    res.json(history);
  } catch (error) {
    next(error);
  }
});

// Toggle board active status
router.patch('/:boardId/toggle-active', authenticate, authorize(['admin']), async (req: AuthRequest, res, next) => {
  try {
    const boardService = new BoardManagementService();
    const board = await boardService.updateBoardConfig(
      req.params.boardId,
      { isActive: req.body.isActive },
      req.user
    );
    res.json(board);
  } catch (error) {
    next(error);
  }
});

// Set board as primary
router.patch('/:boardId/set-primary', authenticate, authorize(['admin']), async (req: AuthRequest, res, next) => {
  try {
    const boardService = new BoardManagementService();
    const board = await boardService.updateBoardConfig(
      req.params.boardId,
      { isPrimary: true },
      req.user
    );
    res.json(board);
  } catch (error) {
    next(error);
  }
});

// Configure field mappings for a board
router.post('/:boardId/field-mappings', authenticate, authorize(['admin']), async (req: AuthRequest, res, next) => {
  try {
    const boardService = new BoardManagementService();
    const mappings = await boardService.configureFieldMapping(
      req.params.boardId,
      req.body.mappings
    );
    res.json(mappings);
  } catch (error) {
    next(error);
  }
});

// Delete board configuration
router.delete('/:boardId', authenticate, authorize(['admin']), async (req: AuthRequest, res, next) => {
  try {
    const boardService = new BoardManagementService();
    await boardService.deleteBoard(req.params.boardId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;

