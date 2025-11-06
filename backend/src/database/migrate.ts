import { AppDataSource } from './dataSource';
import { logger } from '../utils/logger';

async function migrate() {
  try {
    logger.info('Starting database migration...');
    
    // Initialize the data source
    await AppDataSource.initialize();
    logger.info('Database connection established');
    
    // Run migrations
    await AppDataSource.runMigrations();
    logger.info('Migrations completed successfully');
    
    // Synchronize schema (creates tables if they don't exist)
    await AppDataSource.synchronize();
    logger.info('Database schema synchronized');
    
    await AppDataSource.destroy();
    logger.info('Database migration completed successfully');
    
    process.exit(0);
  } catch (error) {
    logger.error('Database migration failed:', error);
    process.exit(1);
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  migrate();
}
