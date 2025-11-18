import { ConnectWiseService } from './connectwise/ConnectWiseService';
import { NableService } from './nable/NableService';
import { NableNsightService } from './nable/NableNsightService';
import { AppDataSource } from '../database/dataSource';
import { Ticket, TicketSource } from '../entities/Ticket';
import { ApiCredential } from '../entities/ApiCredential';
import { logger } from '../utils/logger';
import { CronJob } from 'cron';
import EventEmitter from 'events';

export class SyncService extends EventEmitter {
  private static instance: SyncService;
  private connectwiseService: ConnectWiseService | null = null;
  private nableService: NableService | null = null;
  private nsightService: NableNsightService | null = null;
  private syncJob: CronJob | null = null;
  private isSyncing: boolean = false;
  private ticketRepository = AppDataSource.getRepository(Ticket);
  private credentialRepository = AppDataSource.getRepository(ApiCredential);

  private constructor() {
    super();
  }

  public static getInstance(): SyncService {
    if (!SyncService.instance) {
      SyncService.instance = new SyncService();
    }
    return SyncService.instance;
  }

  async initialize(): Promise<void> {
    try {
      // Check if we have valid API credentials
      const cwCredentials = await this.credentialRepository.findOne({
        where: { provider: 'connectwise' as any, isActive: true }
      });

      const nableCredentials = await this.credentialRepository.findOne({
        where: { provider: 'nable' as any, isActive: true }
      });

      if (cwCredentials) {
        // Initialize ConnectWise with real credentials if available
        process.env.CONNECTWISE_API_URL = cwCredentials.credentials.apiUrl;
        process.env.CONNECTWISE_COMPANY_ID = cwCredentials.credentials.companyId;
        process.env.CONNECTWISE_PUBLIC_KEY = cwCredentials.credentials.publicKey;
        process.env.CONNECTWISE_PRIVATE_KEY = cwCredentials.credentials.privateKey;
        process.env.CONNECTWISE_CLIENT_ID = cwCredentials.credentials.clientId;
        this.connectwiseService = ConnectWiseService.getInstance();
        logger.info('ConnectWise service initialized with stored credentials');
      }

      if (nableCredentials) {
        // Check if this is N-sight API (has apiKey as single key) or N-able RMM (has apiKey and apiSecret)
        if (nableCredentials.credentials.apiKey && !nableCredentials.credentials.apiSecret) {
          // N-sight API format
          this.nsightService = NableNsightService.getInstance(
            nableCredentials.credentials.apiKey,
            nableCredentials.credentials.apiUrl
          );
          logger.info('N-sight service initialized with stored credentials');
        } else {
          // N-able RMM API format
          process.env.NABLE_API_URL = nableCredentials.credentials.apiUrl;
          process.env.NABLE_API_KEY = nableCredentials.credentials.apiKey;
          process.env.NABLE_API_SECRET = nableCredentials.credentials.apiSecret;
          this.nableService = NableService.getInstance();
          logger.info('N-able RMM service initialized with stored credentials');
        }
      }

      // Start periodic sync if services are available
      if (this.connectwiseService || this.nableService || this.nsightService) {
        this.startPeriodicSync();
      }
    } catch (error) {
      logger.error('Failed to initialize sync service:', error);
    }
  }

  private startPeriodicSync(): void {
    // Enable automatic sync every 5 minutes
    this.syncJob = new CronJob('*/5 * * * *', async () => {
      logger.info('Running scheduled sync with external systems');
      await this.syncAll();
    });
    this.syncJob.start();
    
    // Trigger initial sync on startup after a short delay
    setTimeout(async () => {
      logger.info('Running initial sync with external systems');
      try {
        await this.syncAll();
        logger.info('Initial sync completed successfully');
      } catch (error) {
        logger.error('Initial sync failed:', error);
      }
    }, 5000); // 5 second delay to ensure services are ready
    
    logger.info('Periodic sync enabled - will sync with ConnectWise every 5 minutes');
  }

  async syncAll(): Promise<void> {
    if (this.isSyncing) {
      logger.info('Sync already in progress, skipping...');
      return;
    }

    this.isSyncing = true;
    this.emit('sync:started');

    try {
      const results = {
        connectwise: { success: false, count: 0, error: null as any },
        nable: { success: false, count: 0, error: null as any }
      };

      // Sync ConnectWise tickets
      if (this.connectwiseService) {
        try {
          const count = await this.syncConnectWiseTickets();
          results.connectwise.success = true;
          results.connectwise.count = count;
        } catch (error) {
          logger.error('ConnectWise sync failed:', error);
          results.connectwise.error = error;
        }
      }

      // Sync N-able alerts
      if (this.nableService) {
        try {
          const count = await this.syncNableAlerts();
          results.nable.success = true;
          results.nable.count = count;
        } catch (error) {
          logger.error('N-able sync failed:', error);
          results.nable.error = error;
        }
      }

      this.emit('sync:completed', results);
      logger.info('Sync completed:', results);
    } finally {
      this.isSyncing = false;
    }
  }

  async syncConnectWiseTickets(): Promise<number> {
    if (!this.connectwiseService) {
      throw new Error('ConnectWise service not initialized');
    }

    try {
      // Fetch tickets from ConnectWise
      logger.info('Fetching open tickets from ConnectWise...');
      const cwTickets = await this.connectwiseService.getTickets({
        conditions: 'closedFlag=false',
        orderBy: 'lastUpdated desc',
        pageSize: 100
      });
      logger.info(`ConnectWise API returned ${cwTickets.length} open tickets`);

      let syncedCount = 0;

      for (const cwTicket of cwTickets) {
        try {
          // Check if ticket already exists
          let ticket = await this.ticketRepository.findOne({
            where: { externalId: cwTicket.id.toString() }
          });

          const ticketData = this.connectwiseService.convertToInternalTicket(cwTicket);

          if (ticket) {
            // Update existing ticket
            Object.assign(ticket, ticketData);
            ticket.updatedAt = new Date();
          } else {
            // Create new ticket
            ticket = this.ticketRepository.create({
              ...ticketData,
              source: TicketSource.CONNECTWISE
            });
          }

          await this.ticketRepository.save(ticket);
          syncedCount++;
        } catch (error) {
          logger.error(`Failed to sync ticket ${cwTicket.id}:`, error);
        }
      }

      logger.info(`Synced ${syncedCount} tickets from ConnectWise`);
      return syncedCount;
    } catch (error) {
      logger.error('Error fetching ConnectWise tickets:', error);
      throw error;
    }
  }

  async syncNableAlerts(): Promise<number> {
    // Check which N-able service is initialized
    const isNsight = !!this.nsightService;
    const isNableRmm = !!this.nableService;
    
    if (!isNsight && !isNableRmm) {
      throw new Error('No N-able service initialized');
    }

    try {
      let alerts: any[] = [];
      let syncedCount = 0;

      // Fetch alerts based on which service is available
      if (isNsight) {
        // Use N-sight API to pull failing checks (alerts)
        logger.info('Fetching failing checks from N-sight API...');
        const failingChecks = await this.nsightService!.listFailingChecks();
        
        // Process each failing check as an alert
        for (const client of failingChecks.clients || []) {
          for (const site of client.sites || []) {
            // Process workstation failures
            for (const workstation of site.workstations || []) {
              for (const check of workstation.failedChecks || []) {
                try {
                  const alertId = `${workstation.id}-${check.checkId}`;
                  
            // Check if ticket already exists for this alert
            let ticket = await this.ticketRepository.findOne({
                    where: { externalId: `nsight-${alertId}` }
            });

                      if (!ticket) {
                        ticket = this.ticketRepository.create({
                          externalId: `nsight-${alertId}`,
                          title: `[${this.getCheckSeverity(check.checkStatus)}] ${workstation.name}: ${check.description}`,
                          description: `Device: ${workstation.name}\nClient: ${client.name}\nSite: ${site.name}\nCheck: ${check.description}\nStatus: ${check.checkStatus}\nOutput: ${check.formattedOutput}\nFailed at: ${check.date} ${check.time}`,
                          status: 'open' as any,
                          priority: this.mapCheckStatusToPriority(check.checkStatus),
                          source: TicketSource.NABLE,
                          clientName: client.name,
                          clientId: client.clientId,
                          deviceId: workstation.id,
                          metadata: {
                            nableData: {
                              checkData: {
                                ...check,
                                checkType: check.checkId // Add numeric check type ID
                              },
                              device: workstation,
                              site: site,
                              client: client,
                              source: 'nsight',
                              deviceType: 'workstation'
                            }
                          }
                        });

              await this.ticketRepository.save(ticket);
              syncedCount++;
            }
          } catch (error) {
                  logger.error(`Failed to sync N-sight workstation check ${check.checkId}:`, error);
                }
              }
            }
            
            // Process server failures
            for (const server of site.servers || []) {
              for (const check of server.failedChecks || []) {
                try {
                  const alertId = `${server.id}-${check.checkId}`;
                  
                  // Check if ticket already exists for this alert
                  let ticket = await this.ticketRepository.findOne({
                    where: { externalId: `nsight-${alertId}` }
                  });

                      if (!ticket) {
                        ticket = this.ticketRepository.create({
                          externalId: `nsight-${alertId}`,
                          title: `[${this.getCheckSeverity(check.checkStatus)}] ${server.name}: ${check.description}`,
                          description: `Device: ${server.name}\nClient: ${client.name}\nSite: ${site.name}\nCheck: ${check.description}\nStatus: ${check.checkStatus}\nOutput: ${check.formattedOutput}\nFailed at: ${check.date} ${check.time}`,
                          status: 'open' as any,
                          priority: this.mapCheckStatusToPriority(check.checkStatus),
                          source: TicketSource.NABLE,
                          clientName: client.name,
                          clientId: client.clientId,
                          deviceId: server.id,
                          metadata: {
                            nableData: {
                              checkData: {
                                ...check,
                                checkType: check.checkId // Add numeric check type ID
                              },
                              device: server,
                              site: site,
                              client: client,
                              source: 'nsight',
                              deviceType: 'server'
                            }
                          }
                        });

                    await this.ticketRepository.save(ticket);
                    syncedCount++;
                  }
                } catch (error) {
                  logger.error(`Failed to sync N-sight server check ${check.checkId}:`, error);
                }
              }
            }
          }
        }
        
        logger.info(`Synced ${syncedCount} alerts from N-sight API`);
      } else if (isNableRmm) {
        // Use N-able RMM API
        alerts = await this.nableService!.getAlerts({
          status: 'Active',
          startDate: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        });
        
        for (const alert of alerts) {
          try {
            // Check if ticket already exists for this alert
            let ticket = await this.ticketRepository.findOne({
              where: { externalId: `nable-${alert.alertId}` }
            });

            if (!ticket) {
              // Get device details
              const device = await this.nableService!.getDevice(alert.deviceId);

              // Create ticket from alert
              ticket = this.ticketRepository.create({
                externalId: `nable-${alert.alertId}`,
                title: alert.message,
                description: `Alert Type: ${alert.alertType}\nDevice: ${device.deviceName}\nDetails: ${JSON.stringify(alert.details, null, 2)}`,
                status: 'open' as any,
                priority: this.mapAlertSeverityToPriority(alert.severity),
                source: TicketSource.NABLE,
                clientName: device.customerName,
                clientId: device.customerId,
                deviceId: device.deviceId,
                metadata: {
                  nableData: {
                    alertData: alert,
                    deviceData: device,
                    source: 'rmm'
                  }
                }
              });

              await this.ticketRepository.save(ticket);

              // If ConnectWise is configured, create ticket there too
              if (this.connectwiseService) {
                try {
                  const cwTicket = await this.connectwiseService.createTicket({
                    summary: alert.message,
                    board: { id: 1 }, // Default board - should be configurable
                    company: { id: 1 }, // Default company - should map from customer
                    priority: { id: this.getPriorityId(alert.severity) },
                    initialDescription: ticket.description
                  });

                  // Update our ticket with ConnectWise ID
                  ticket.externalId = cwTicket.id.toString();
                  ticket.metadata.connectwiseData = cwTicket;
                  await this.ticketRepository.save(ticket);
                } catch (error) {
                  logger.error('Failed to create ConnectWise ticket for alert:', error);
                }
              }

              syncedCount++;
            }
          } catch (error) {
            logger.error(`Failed to sync alert ${alert.alertId}:`, error);
          }
        }
      }

      logger.info(`Synced ${syncedCount} alerts from N-able`);
      return syncedCount;
    } catch (error) {
      logger.error('Error fetching N-able alerts:', error);
      throw error;
    }
  }

  private mapAlertSeverityToPriority(severity: string): any {
    const map: Record<string, string> = {
      'Critical': 'critical',
      'Error': 'high',
      'Warning': 'medium',
      'Information': 'low'
    };
    return map[severity] || 'medium';
  }

  private getPriorityId(severity: string): number {
    const map: Record<string, number> = {
      'Critical': 1,
      'Error': 2,
      'Warning': 3,
      'Information': 4
    };
    return map[severity] || 3;
  }

  async syncTicketToConnectWise(ticketId: string): Promise<void> {
    if (!this.connectwiseService) {
      throw new Error('ConnectWise service not initialized');
    }

    const ticket = await this.ticketRepository.findOne({ where: { id: ticketId } });
    if (!ticket) {
      throw new Error('Ticket not found');
    }

    if (ticket.externalId) {
      // Update existing ConnectWise ticket
      await this.connectwiseService.updateTicket(ticket.externalId, [
        {
          op: 'replace',
          path: '/summary',
          value: ticket.title
        },
        {
          op: 'replace',
          path: '/initialDescription',
          value: ticket.description
        }
      ]);
    } else {
      // Create new ConnectWise ticket
      const cwTicket = await this.connectwiseService.createTicket({
        summary: ticket.title,
        board: { id: 1 }, // Should be configurable
        company: { id: 1 }, // Should map from client
        initialDescription: ticket.description
      });

      ticket.externalId = cwTicket.id.toString();
      await this.ticketRepository.save(ticket);
    }
  }

  async fetchRealTimeData(): Promise<{
    tickets: Ticket[];
    devices: any[];
    alerts: any[];
  }> {
    const result = {
      tickets: [] as Ticket[],
      devices: [] as any[],
      alerts: [] as any[]
    };

    // Fetch tickets from database (synced from external sources)
    result.tickets = await this.ticketRepository.find({
      order: { createdAt: 'DESC' },
      take: 100
    });

    // Fetch devices from N-able/N-sight if available
    if (this.nsightService) {
      try {
        // Combine servers and workstations
        const servers = await this.nsightService.listServers();
        const workstations = await this.nsightService.listWorkstations();
        result.devices = [...servers, ...workstations];
      } catch (error) {
        logger.error('Failed to fetch N-sight devices:', error);
      }
    } else if (this.nableService) {
      try {
        result.devices = await this.nableService.getDevices();
      } catch (error) {
        logger.error('Failed to fetch N-able devices:', error);
      }
    }

    // Fetch recent alerts from N-able/N-sight if available
    if (this.nsightService) {
      try {
        // Fetch failing checks as alerts
        const failingChecks = await this.nsightService.listFailingChecks();
        result.alerts = []; // Convert failing checks to alert format if needed
      } catch (error) {
        logger.error('Failed to fetch N-sight alerts:', error);
      }
    } else if (this.nableService) {
      try {
        result.alerts = await this.nableService.getAlerts({
          startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
        });
      } catch (error) {
        logger.error('Failed to fetch N-able alerts:', error);
      }
    }

    return result;
  }

  async testConnectWiseConnection(): Promise<boolean> {
    try {
      if (!this.connectwiseService) {
        return false;
      }
      await this.connectwiseService.getTickets({ pageSize: 1 });
      return true;
    } catch (error) {
      logger.error('ConnectWise connection test failed:', error);
      return false;
    }
  }

  async testNableConnection(): Promise<boolean> {
    try {
      if (this.nsightService) {
        // Test N-sight API
        const testResult = await this.nsightService.testConnection();
        return testResult; // testConnection returns boolean
      } else if (this.nableService) {
        // Test N-able RMM API
        await this.nableService.getDevices();
        return true;
      }
      return false;
    } catch (error) {
      logger.error('N-able/N-sight connection test failed:', error);
      return false;
    }
  }

  stop(): void {
    if (this.syncJob) {
      this.syncJob.stop();
      this.syncJob = null;
    }
  }

  /**
   * Get check severity from status
   */
  private getCheckSeverity(checkStatus: string): string {
    switch(checkStatus) {
      case 'testerror':
      case 'testerror_inactive':
        return 'CRITICAL';
      case 'testalertdelayed':
        return 'WARNING';
      case 'testcleared':
        return 'INFO';
      default:
        return 'ERROR';
    }
  }

  /**
   * Map check status to priority
   */
  private mapCheckStatusToPriority(checkStatus: string): any {
    switch(checkStatus) {
      case 'testerror':
      case 'testerror_inactive':
        return 'critical';
      case 'testalertdelayed':
        return 'high';
      case 'testcleared':
      case 'test_inactive':
      case 'testok_inactive':
        return 'low';
      default:
        return 'medium';
    }
  }
}

