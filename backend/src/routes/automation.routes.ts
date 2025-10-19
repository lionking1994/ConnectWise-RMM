import { Router } from 'express';
import { AppDataSource } from '../database/dataSource';
import { AutomationRule } from '../entities/AutomationRule';

export const automationRouter = Router();
const ruleRepository = AppDataSource.getRepository(AutomationRule);

// Get all automation rules
automationRouter.get('/rules', async (req, res, next) => {
  try {
    const rules = await ruleRepository.find({
      order: { priority: 'ASC' }
    });
    res.json(rules);
  } catch (error) {
    next(error);
  }
});


