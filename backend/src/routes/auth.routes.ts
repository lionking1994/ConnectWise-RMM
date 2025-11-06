import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AppDataSource } from '../database/dataSource';
import { User } from '../entities/User';
import { logger } from '../utils/logger';
import { authMiddleware, AuthRequest } from '../middleware/auth';

export const authRouter = Router();

// Login
authRouter.post('/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty()
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;

      const userRepository = AppDataSource.getRepository(User);
      const user = await userRepository.findOne({ where: { email } });
      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      if (!user.isActive) {
        return res.status(403).json({ message: 'Account is disabled' });
      }

      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET || 'secret',
        { expiresIn: process.env.JWT_EXPIRY || '7d' } as any
      );

      const refreshToken = jwt.sign(
        { id: user.id },
        process.env.JWT_SECRET || 'secret',
        { expiresIn: '30d' }
      );

      user.lastLogin = new Date();
      user.refreshToken = refreshToken;
      await userRepository.save(user);

      logger.info(`User logged in: ${user.email}`);

      res.json({
        token,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          permissions: user.permissions
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// Refresh token
authRouter.post('/refresh',
  [body('refreshToken').notEmpty()],
  async (req, res, next) => {
    try {
      const { refreshToken } = req.body;

      const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET || 'secret') as any;
      
      const userRepository = AppDataSource.getRepository(User);
      const user = await userRepository.findOne({ 
        where: { id: decoded.id, refreshToken } 
      });

      if (!user || !user.isActive) {
        return res.status(401).json({ message: 'Invalid refresh token' });
      }

      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET || 'secret',
        { expiresIn: process.env.JWT_EXPIRY || '7d' } as any
      );

      res.json({ token });
    } catch (error) {
      next(error);
    }
  }
);

// Get current user
authRouter.get('/me', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    res.json({
      id: user.id,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      permissions: user.permissions,
      profilePicture: user.profilePicture,
      phoneNumber: user.phoneNumber,
      preferences: user.preferences
    });
  } catch (error) {
    next(error);
  }
});

// Logout
authRouter.post('/logout', async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any;
      
      const userRepository = AppDataSource.getRepository(User);
      await userRepository.update(decoded.id, { refreshToken: null });
      logger.info(`User logged out: ${decoded.email}`);
    }

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
});
