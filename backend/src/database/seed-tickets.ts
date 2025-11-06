import { AppDataSource } from './dataSource';
import { Ticket, TicketStatus, TicketPriority, TicketSource } from '../entities/Ticket';
import { User } from '../entities/User';
import { logger } from '../utils/logger';

async function seedTickets() {
  try {
    logger.info('Starting ticket seeding...');
    
    // Initialize the data source
    await AppDataSource.initialize();
    logger.info('Database connection established');
    
    const ticketRepository = AppDataSource.getRepository(Ticket);
    const userRepository = AppDataSource.getRepository(User);
    
    // Get the first user to assign tickets
    const user = await userRepository.findOne({ where: {} });
    
    // Sample tickets data
    const ticketsData = [
      {
        title: 'Server Maintenance Required',
        description: 'Production server needs scheduled maintenance for security updates',
        clientName: 'Acme Corp',
        status: TicketStatus.OPEN,
        priority: TicketPriority.HIGH,
        source: TicketSource.CONNECTWISE,
        tags: ['server', 'maintenance', 'production'],
        ticketNumber: 'TKT-001',
        externalId: 'CW-10001'
      },
      {
        title: 'Email Service Down',
        description: 'Multiple users reporting email service is not working',
        clientName: 'TechStart Inc',
        status: TicketStatus.IN_PROGRESS,
        priority: TicketPriority.CRITICAL,
        source: TicketSource.MANUAL,
        tags: ['email', 'outage', 'urgent'],
        ticketNumber: 'TKT-002',
        externalId: 'CW-10002'
      },
      {
        title: 'New Workstation Setup',
        description: 'New employee needs workstation setup with standard software',
        clientName: 'Global Solutions',
        status: TicketStatus.OPEN,
        priority: TicketPriority.MEDIUM,
        source: TicketSource.CONNECTWISE,
        tags: ['setup', 'new-employee', 'workstation'],
        ticketNumber: 'TKT-003',
        externalId: 'CW-10003'
      },
      {
        title: 'VPN Connection Issues',
        description: 'Remote employees unable to connect to VPN',
        clientName: 'Remote Works LLC',
        status: TicketStatus.OPEN,
        priority: TicketPriority.HIGH,
        source: TicketSource.NABLE,
        tags: ['vpn', 'remote', 'connectivity'],
        ticketNumber: 'TKT-004',
        externalId: 'CW-10004'
      },
      {
        title: 'Database Backup Failure',
        description: 'Automated database backup failed last night',
        clientName: 'DataCorp',
        status: TicketStatus.RESOLVED,
        priority: TicketPriority.HIGH,
        source: TicketSource.AUTOMATION,
        tags: ['database', 'backup', 'automation'],
        ticketNumber: 'TKT-005',
        externalId: 'CW-10005'
      },
      {
        title: 'Printer Not Working',
        description: 'Office printer showing error code and not printing',
        clientName: 'PrintCo',
        status: TicketStatus.OPEN,
        priority: TicketPriority.LOW,
        source: TicketSource.CONNECTWISE,
        tags: ['printer', 'hardware', 'office'],
        ticketNumber: 'TKT-006',
        externalId: 'CW-10006'
      },
      {
        title: 'Software License Renewal',
        description: 'Microsoft Office licenses expiring next week',
        clientName: 'Office Solutions',
        status: TicketStatus.PENDING,
        priority: TicketPriority.MEDIUM,
        source: TicketSource.MANUAL,
        tags: ['license', 'software', 'renewal'],
        ticketNumber: 'TKT-007',
        externalId: 'CW-10007'
      },
      {
        title: 'Network Speed Issues',
        description: 'Users reporting slow network speeds in Building B',
        clientName: 'NetSpeed Inc',
        status: TicketStatus.IN_PROGRESS,
        priority: TicketPriority.MEDIUM,
        source: TicketSource.NABLE,
        tags: ['network', 'performance', 'building-b'],
        ticketNumber: 'TKT-008',
        externalId: 'CW-10008'
      },
      {
        title: 'Security Patch Deployment',
        description: 'Critical security patches need to be deployed to all servers',
        clientName: 'SecureNet',
        status: TicketStatus.PENDING,
        priority: TicketPriority.HIGH,
        source: TicketSource.AUTOMATION,
        tags: ['security', 'patch', 'servers'],
        ticketNumber: 'TKT-009',
        externalId: 'CW-10009'
      },
      {
        title: 'Password Reset Request',
        description: 'User locked out and needs password reset',
        clientName: 'UserCorp',
        status: TicketStatus.CLOSED,
        priority: TicketPriority.LOW,
        source: TicketSource.CONNECTWISE,
        tags: ['password', 'account', 'access'],
        ticketNumber: 'TKT-010',
        externalId: 'CW-10010'
      }
    ];
    
    // Check if tickets already exist
    const existingTickets = await ticketRepository.count();
    
    if (existingTickets === 0) {
      // Create tickets
      for (const ticketData of ticketsData) {
        const ticket = ticketRepository.create({
          ...ticketData,
          assignedTo: user || undefined,
          createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000), // Random date within last week
          updatedAt: new Date()
        });
        
        await ticketRepository.save(ticket);
        logger.info(`Created ticket: ${ticket.title}`);
      }
      
      logger.info(`Successfully seeded ${ticketsData.length} demo tickets`);
    } else {
      logger.info(`Tickets already exist (${existingTickets} found), skipping seeding`);
    }
    
    await AppDataSource.destroy();
    logger.info('Ticket seeding completed successfully');
    
    process.exit(0);
  } catch (error) {
    logger.error('Ticket seeding failed:', error);
    process.exit(1);
  }
}

// Run seeding if this file is executed directly
if (require.main === module) {
  seedTickets();
}

export default seedTickets;
