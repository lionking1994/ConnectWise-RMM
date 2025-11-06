import { AppDataSource } from './dataSource';
import { User, UserRole } from '../entities/User';
import { logger } from '../utils/logger';
import bcrypt from 'bcrypt';

async function seedMinimal() {
  try {
    logger.info('Starting minimal database seeding...');
    
    // Initialize the data source
    await AppDataSource.initialize();
    logger.info('Database connection established');
    
    const userRepository = AppDataSource.getRepository(User);
    
    // Check if admin user exists
    const existingAdmin = await userRepository.findOne({ where: { email: 'admin@rmm-platform.com' } });
    
    if (!existingAdmin) {
      // Create default admin user
      const hashedPassword = await bcrypt.hash('ChangeMe123!', 10);
      
      const adminUser = userRepository.create({
        username: 'admin',
        email: 'admin@rmm-platform.com',
        password: hashedPassword,
        firstName: 'Admin',
        lastName: 'User',
        role: UserRole.ADMIN,
        isActive: true
      });
      
      await userRepository.save(adminUser);
      logger.info('Default admin user created (username: admin, password: ChangeMe123!)');
      logger.warn('⚠️  IMPORTANT: Change the admin password immediately after first login!');
    } else {
      logger.info('Admin user already exists, skipping creation');
    }
    
    await AppDataSource.destroy();
    logger.info('Minimal seeding completed successfully');
    
    process.exit(0);
  } catch (error) {
    logger.error('Database seeding failed:', error);
    process.exit(1);
  }
}

// Run seeding if this file is executed directly
if (require.main === module) {
  seedMinimal();
}
