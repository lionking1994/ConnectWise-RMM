import { Router } from 'express';
import { AppDataSource } from '../database/dataSource';
import { AutomationRule } from '../entities/AutomationRule';
import { AutomationHistory, ExecutionStatus } from '../entities/AutomationHistory';
import { logger } from '../utils/logger';
import { authMiddleware } from '../middleware/auth';

export const automationRouter = Router();

// Get all automation rules
automationRouter.get('/rules', async (req, res, next) => {
  try {
    const ruleRepository = AppDataSource.getRepository(AutomationRule);
    const rules = await ruleRepository.find({
      order: { priority: 'ASC', createdAt: 'DESC' }
    });
    
    // Format response for UI compatibility
    const formattedRules = rules.map(rule => ({
      id: rule.id,
      name: rule.name,
      description: rule.description,
      enabled: rule.isActive,
      trigger: rule.metadata?.triggerType || rule.triggerEvents?.[0] || 'alert',
      actions: rule.actions?.map(a => a.type || 'execute_script') || [],
      lastTriggered: rule.updatedAt,
      executionCount: rule.executionCount || 0,
      successRate: rule.successCount > 0 ? (rule.successCount / (rule.successCount + rule.failureCount)) * 100 : 0
    }));
    
    res.json({
      data: formattedRules,
      total: formattedRules.length
    });
  } catch (error) {
    logger.error('Error fetching automation rules:', error);
    next(error);
  }
});

// Get single automation rule by ID
automationRouter.get('/rules/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const ruleRepository = AppDataSource.getRepository(AutomationRule);
    
    const rule = await ruleRepository.findOne({
      where: { id }
    });
    
    if (!rule) {
      return res.status(404).json({ 
        error: 'Rule not found',
        message: `No rule found with ID: ${id}`
      });
    }
    
    // Transform back to frontend format
    const transformedRule = {
      ...rule,
      trigger: {
        type: rule.metadata?.triggerType || rule.triggerEvents?.[0] || 'alert',
        conditions: rule.conditions?.all || rule.conditions?.any || [],
        logicalOperator: rule.conditions?.any ? 'OR' : 'AND'
      }
    };
    
    res.json(transformedRule);
  } catch (error) {
    logger.error('Error fetching automation rule:', error);
    next(error);
  }
});

// Create new automation rule
automationRouter.post('/rules', async (req, res, next) => {
  try {
    const ruleRepository = AppDataSource.getRepository(AutomationRule);
    
    logger.info('Creating new automation rule:', {
      name: req.body.name,
      trigger: req.body.trigger?.type
    });
    
    // Transform trigger format to conditions format
    const conditions: any = {};
    if (req.body.trigger?.conditions && req.body.trigger?.conditions.length > 0) {
      if (req.body.trigger.logicalOperator === 'OR') {
        conditions.any = req.body.trigger.conditions.map((c: any) => ({
          ...c,
          dataSource: 'alert'
        }));
      } else {
        conditions.all = req.body.trigger.conditions.map((c: any) => ({
          ...c,
          dataSource: 'alert'
        }));
      }
    } else {
      conditions.all = [];
    }
    
    // Transform actions to include order and continueOnError
    const actions = (req.body.actions || []).map((action: any, index: number) => ({
      type: action.type || 'run_script',
      parameters: action.parameters || {},
      order: index,
      continueOnError: action.continueOnError !== false
    }));
    
    // Store trigger info in metadata
    const metadata = {
      triggerType: req.body.trigger?.type || 'alert',
      ...(req.body.metadata || {})
    };
    
    // Create the rule entity
    const newRule = ruleRepository.create({
      name: req.body.name,
      description: req.body.description,
      isActive: req.body.isActive || false,
      priority: req.body.priority || 0,
      conditions,
      actions,
      triggerEvents: [req.body.trigger?.type || 'alert'],
      schedule: req.body.schedule || { enabled: false },
      metadata,
      maxRetries: 3,
      retryDelayMs: 5000,
      timeoutMs: 300000,
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    // Save to database
    const savedRule = await ruleRepository.save(newRule);
    
    logger.info(`Automation rule created successfully: ${savedRule.id}`);
    
    res.status(201).json({
      id: savedRule.id,
      ...savedRule,
      message: 'Rule created successfully'
    });
  } catch (error: any) {
    logger.error('Error creating automation rule:', error);
    res.status(500).json({ 
      error: 'Failed to create rule',
      message: error.message 
    });
  }
});

// Update existing automation rule
automationRouter.put('/rules/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const ruleRepository = AppDataSource.getRepository(AutomationRule);
    
    logger.info(`Updating automation rule: ${id}`);
    
    // Find existing rule
    const existingRule = await ruleRepository.findOne({
      where: { id }
    });
    
    if (!existingRule) {
      return res.status(404).json({ 
        error: 'Rule not found',
        message: `No rule found with ID: ${id}`
      });
    }
    
    // Transform trigger format to conditions format if provided
    if (req.body.trigger) {
      const conditions: any = {};
      if (req.body.trigger.conditions && req.body.trigger.conditions.length > 0) {
        if (req.body.trigger.logicalOperator === 'OR') {
          conditions.any = req.body.trigger.conditions.map((c: any) => ({
            ...c,
            dataSource: 'alert'
          }));
        } else {
          conditions.all = req.body.trigger.conditions.map((c: any) => ({
            ...c,
            dataSource: 'alert'
          }));
        }
      } else {
        conditions.all = [];
      }
      existingRule.conditions = conditions;
      existingRule.triggerEvents = [req.body.trigger.type || 'alert'];
      existingRule.metadata = {
        ...existingRule.metadata,
        triggerType: req.body.trigger.type
      };
    }
    
    // Transform and update actions if provided
    if (req.body.actions) {
      existingRule.actions = req.body.actions.map((action: any, index: number) => ({
        type: action.type || 'run_script',
        parameters: action.parameters || {},
        order: index,
        continueOnError: action.continueOnError !== false
      }));
    }
    
    // Update other fields
    existingRule.name = req.body.name || existingRule.name;
    existingRule.description = req.body.description || existingRule.description;
    existingRule.isActive = req.body.isActive !== undefined ? req.body.isActive : existingRule.isActive;
    existingRule.priority = req.body.priority !== undefined ? req.body.priority : existingRule.priority;
    existingRule.schedule = req.body.schedule || existingRule.schedule;
    existingRule.updatedAt = new Date();
    
    // Save updated rule
    const updatedRule = await ruleRepository.save(existingRule);
    
    logger.info(`Automation rule updated successfully: ${id}`);
    
    res.json({
      id: updatedRule.id,
      ...updatedRule,
      message: 'Rule updated successfully'
    });
  } catch (error: any) {
    logger.error('Error updating automation rule:', error);
    res.status(500).json({ 
      error: 'Failed to update rule',
      message: error.message 
    });
  }
});

// Delete automation rule
automationRouter.delete('/rules/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const ruleRepository = AppDataSource.getRepository(AutomationRule);
    
    logger.info(`Deleting automation rule: ${id}`);
    
    const result = await ruleRepository.delete(id);
    
    if (result.affected === 0) {
      return res.status(404).json({ 
        error: 'Rule not found',
        message: `No rule found with ID: ${id}`
      });
    }
    
    logger.info(`Automation rule deleted successfully: ${id}`);
    
    res.json({ 
      message: 'Rule deleted successfully',
      id 
    });
  } catch (error: any) {
    logger.error('Error deleting automation rule:', error);
    res.status(500).json({ 
      error: 'Failed to delete rule',
      message: error.message 
    });
  }
});

// Test automation rule (dry run)
automationRouter.post('/rules/test', async (req, res, next) => {
  try {
    const rule = req.body;
    
    logger.info('Testing automation rule:', {
      name: rule.name,
      trigger: rule.trigger?.type,
      conditions: rule.trigger?.conditions?.length || 0,
      actions: rule.actions?.length || 0
    });
    
    // Simulate rule execution
    const testResults = {
      rule: rule.name,
      trigger: rule.trigger?.type,
      conditionsMatched: true,
      actions: rule.actions?.map((action: any) => ({
        type: action.type,
        status: 'simulated',
        message: `Would execute: ${action.type}`
      })) || [],
      timestamp: new Date(),
      success: true,
      message: 'Rule test completed successfully (dry run)'
    };
    
    res.json(testResults);
  } catch (error: any) {
    logger.error('Error testing automation rule:', error);
    res.status(500).json({ 
      error: 'Failed to test rule',
      message: error.message 
    });
  }
});

// Execute automation rule manually
automationRouter.post('/rules/:id/execute', async (req, res, next) => {
  try {
    const { id } = req.params;
    const ruleRepository = AppDataSource.getRepository(AutomationRule);
    const historyRepository = AppDataSource.getRepository(AutomationHistory);
    
    const rule = await ruleRepository.findOne({
      where: { id }
    });
    
    if (!rule) {
      return res.status(404).json({ 
        error: 'Rule not found',
        message: `No rule found with ID: ${id}`
      });
    }
    
    logger.info(`Manually executing automation rule: ${rule.name}`);
    
    // Create history entry
    const history = historyRepository.create({
      ruleId: rule.id,
      status: ExecutionStatus.RUNNING,
      startedAt: new Date(),
      input: { trigger: 'manual' },
      executionSteps: [],
      retryCount: 0
    });
    
    await historyRepository.save(history);
    
    // Simulate execution
    // In production, this would call the AutomationEngine
    setTimeout(async () => {
      history.status = ExecutionStatus.SUCCESS;
      history.completedAt = new Date();
      history.durationMs = Date.now() - history.startedAt.getTime();
      history.output = {
        success: true,
        message: 'Manual execution completed',
        actions: rule.actions?.map(a => ({
          type: a.type,
          status: 'completed'
        }))
      };
      history.executionSteps = rule.actions?.map((a, i) => ({
        action: a.type,
        startTime: new Date(),
        endTime: new Date(),
        status: ExecutionStatus.SUCCESS,
        output: { completed: true }
      })) || [];
      await historyRepository.save(history);
    }, 2000);
    
    res.json({ 
      message: 'Rule execution started',
      historyId: history.id,
      rule: rule.name
    });
  } catch (error: any) {
    logger.error('Error executing automation rule:', error);
    res.status(500).json({ 
      error: 'Failed to execute rule',
      message: error.message 
    });
  }
});

// Get automation history
automationRouter.get('/history', async (req, res, next) => {
  try {
    const { ticketId, ruleId, status } = req.query;
    const historyRepository = AppDataSource.getRepository(AutomationHistory);
    
    let query = historyRepository.createQueryBuilder('history')
      .leftJoinAndSelect('history.rule', 'rule')
      .orderBy('history.createdAt', 'DESC')
      .limit(100);
    
    if (ticketId) {
      query = query.andWhere('history.ticketId = :ticketId', { ticketId });
    }
    
    if (ruleId) {
      query = query.andWhere('history.ruleId = :ruleId', { ruleId });
    }
    
    if (status) {
      query = query.andWhere('history.status = :status', { status });
    }
    
    const history = await query.getMany();
    
    res.json(history);
  } catch (error) {
    logger.error('Error fetching automation history:', error);
    next(error);
  }
});

// Get automation queue status
automationRouter.get('/queue', async (req, res, next) => {
  try {
    // In production, this would check the actual queue
    const queueStatus = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      queueHealth: 'healthy'
    };
    
    res.json(queueStatus);
  } catch (error) {
    logger.error('Error fetching queue status:', error);
    next(error);
  }
});

export default automationRouter;