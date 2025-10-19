import { Router } from 'express';
import { AppDataSource } from '../database/dataSource';
import { Ticket } from '../entities/Ticket';

export const ticketRouter = Router();
const ticketRepository = AppDataSource.getRepository(Ticket);

// Get all tickets
ticketRouter.get('/', async (req, res, next) => {
  try {
    const tickets = await ticketRepository.find({
      relations: ['assignedTo'],
      order: { createdAt: 'DESC' }
    });
    res.json(tickets);
  } catch (error) {
    next(error);
  }
});

// Get ticket by ID
ticketRouter.get('/:id', async (req, res, next) => {
  try {
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


