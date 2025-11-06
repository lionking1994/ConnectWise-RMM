import axios, { AxiosInstance } from 'axios';
import { logger } from '../../utils/logger';
import { Ticket, TicketPriority, TicketStatus } from '../../entities/Ticket';
import retry from 'retry';
import { CredentialsService } from '../CredentialsService';

export interface ConnectWiseTicket {
  id: number;
  summary: string;
  company: {
    id: number;
    name: string;
  };
  status: {
    id: number;
    name: string;
  };
  priority: {
    id: number;
    name: string;
  };
  board: {
    id: number;
    name: string;
  };
  owner?: {
    id: number;
    name: string;
  };
  notes?: string;
  customFields?: Array<{
    id: number;
    caption: string;
    value: any;
  }>;
}

export class ConnectWiseService {
  private static instance: ConnectWiseService;
  private client: AxiosInstance | null = null;
  private companyId: string = '';
  private credentialsService: CredentialsService;
  private initialized: boolean = false;

  private constructor() {
    this.credentialsService = CredentialsService.getInstance();
    // Initial setup with env vars if available
    this.setupClient();
  }

  private async setupClient(): Promise<void> {
    try {
      // Try to get credentials from database first
      const credentials = await this.credentialsService.getConnectWiseCredentials();
      
      if (credentials) {
        this.companyId = credentials.companyId;
        const authString = `${credentials.companyId}+${credentials.publicKey}:${credentials.privateKey}`;
        const encodedAuth = Buffer.from(authString).toString('base64');

        this.client = axios.create({
          baseURL: credentials.apiUrl,
          headers: {
            'Authorization': `Basic ${encodedAuth}`,
            'Content-Type': 'application/json',
            'clientId': credentials.clientId || ''
          },
          timeout: 30000
        });

        // Add response interceptor for logging
        this.client.interceptors.response.use(
          response => {
            logger.debug(`ConnectWise API Response: ${response.status} ${response.config.url}`);
            return response;
          },
          error => {
            logger.error(`ConnectWise API Error: ${error.message}`, {
              url: error.config?.url,
              status: error.response?.status,
              data: error.response?.data
            });
            return Promise.reject(error);
          }
        );
        
        this.initialized = true;
        logger.info('ConnectWise client initialized with credentials from database');
      } else {
        logger.warn('No ConnectWise credentials found in database or environment');
      }
    } catch (error) {
      logger.error('Error setting up ConnectWise client:', error);
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized || !this.client) {
      await this.setupClient();
      if (!this.client) {
        throw new Error('ConnectWise client not configured. Please check credentials.');
      }
    }
  }

  public static getInstance(): ConnectWiseService {
    if (!ConnectWiseService.instance) {
      ConnectWiseService.instance = new ConnectWiseService();
    }
    return ConnectWiseService.instance;
  }

  private async executeWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    const operation = retry.operation({
      retries: 3,
      factor: 2,
      minTimeout: 1000,
      maxTimeout: 5000
    });

    return new Promise((resolve, reject) => {
      operation.attempt(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          if (!operation.retry(error as Error)) {
            reject(operation.mainError());
          }
        }
      });
    });
  }

  async getTicket(ticketId: string): Promise<ConnectWiseTicket> {
    await this.ensureInitialized();
    return this.executeWithRetry(async () => {
      const response = await this.client.get(`/service/tickets/${ticketId}`);
      return response.data;
    });
  }

  async getTickets(params?: {
    conditions?: string;
    orderBy?: string;
    pageSize?: number;
    page?: number;
  }): Promise<ConnectWiseTicket[]> {
    return this.executeWithRetry(async () => {
      const response = await this.client.get('/service/tickets', { params });
      return response.data;
    });
  }

  async createTicket(data: {
    summary: string;
    board: { id: number };
    company: { id: number };
    status?: { id: number };
    priority?: { id: number };
    initialDescription?: string;
    contactName?: string;
    contactEmailAddress?: string;
  }): Promise<ConnectWiseTicket> {
    return this.executeWithRetry(async () => {
      const response = await this.client.post('/service/tickets', data);
      logger.info(`Created ConnectWise ticket: ${response.data.id}`);
      return response.data;
    });
  }

  async updateTicket(ticketId: string, updates: Array<{
    op: 'add' | 'replace' | 'remove';
    path: string;
    value?: any;
  }>): Promise<ConnectWiseTicket> {
    return this.executeWithRetry(async () => {
      const response = await this.client.patch(
        `/service/tickets/${ticketId}`,
        updates,
        {
          headers: {
            'Content-Type': 'application/json-patch+json'
          }
        }
      );
      logger.info(`Updated ConnectWise ticket: ${ticketId}`);
      return response.data;
    });
  }

  async addTicketNote(ticketId: string, note: {
    text: string;
    detailDescriptionFlag?: boolean;
    internalAnalysisFlag?: boolean;
    resolutionFlag?: boolean;
  }): Promise<any> {
    return this.executeWithRetry(async () => {
      const response = await this.client.post(
        `/service/tickets/${ticketId}/notes`,
        note
      );
      logger.info(`Added note to ConnectWise ticket: ${ticketId}`);
      return response.data;
    });
  }

  async closeTicket(ticketId: string, resolution: string): Promise<ConnectWiseTicket> {
    const updates = [
      {
        op: 'replace' as const,
        path: '/status/id',
        value: await this.getClosedStatusId()
      },
      {
        op: 'add' as const,
        path: '/resolution',
        value: resolution
      }
    ];
    return this.updateTicket(ticketId, updates);
  }

  async getCompanies(): Promise<any[]> {
    return this.executeWithRetry(async () => {
      const response = await this.client.get('/company/companies');
      return response.data;
    });
  }

  async getBoards(): Promise<any[]> {
    return this.executeWithRetry(async () => {
      const response = await this.client.get('/service/boards');
      return response.data;
    });
  }

  async getStatuses(boardId: number): Promise<any[]> {
    return this.executeWithRetry(async () => {
      const response = await this.client.get(`/service/boards/${boardId}/statuses`);
      return response.data;
    });
  }

  async getPriorities(): Promise<any[]> {
    return this.executeWithRetry(async () => {
      const response = await this.client.get('/service/priorities');
      return response.data;
    });
  }

  private async getClosedStatusId(): Promise<number> {
    // This would typically be configured or cached
    // For now, returning a common closed status ID
    return 5; // Usually "Closed" in ConnectWise
  }

  convertToInternalTicket(cwTicket: ConnectWiseTicket): Partial<Ticket> {
    return {
      externalId: cwTicket.id.toString(),
      title: cwTicket.summary,
      description: cwTicket.notes || '',
      status: this.mapStatus(cwTicket.status.name),
      priority: this.mapPriority(cwTicket.priority.name),
      clientName: cwTicket.company.name,
      clientId: cwTicket.company.id.toString(),
      metadata: {
        connectwiseData: cwTicket
      }
    };
  }

  private mapStatus(cwStatus: string): TicketStatus {
    const statusMap: Record<string, TicketStatus> = {
      'New': TicketStatus.OPEN,
      'Open': TicketStatus.OPEN,
      'In Progress': TicketStatus.IN_PROGRESS,
      'Pending': TicketStatus.PENDING,
      'Resolved': TicketStatus.RESOLVED,
      'Closed': TicketStatus.CLOSED
    };
    return statusMap[cwStatus] || TicketStatus.OPEN;
  }

  private mapPriority(cwPriority: string): TicketPriority {
    const priorityMap: Record<string, TicketPriority> = {
      'Low': TicketPriority.LOW,
      'Medium': TicketPriority.MEDIUM,
      'High': TicketPriority.HIGH,
      'Critical': TicketPriority.CRITICAL,
      'Emergency': TicketPriority.CRITICAL
    };
    return priorityMap[cwPriority] || TicketPriority.MEDIUM;
  }
}
