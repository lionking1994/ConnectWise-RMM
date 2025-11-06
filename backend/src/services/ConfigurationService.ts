import { AppDataSource } from '../database/dataSource';
import { logger } from '../utils/logger';

export interface SystemConfiguration {
  // ConnectWise Settings
  connectwise: {
    defaultBoardId: number;
    defaultBoardName: string;
    monitoredBoards: number[];
    // defaultCompanyId removed - N-able creates tickets with company assigned
    preventDuplicates: boolean;
    updateOnlyMode: boolean;
    createNewTickets: boolean;
  };
  
  // N-able Settings
  nable: {
    scriptTimeout: number;
    maxRetries: number;
    includeTicketNumber: boolean;
  };
  
  // Automation Settings
  automation: {
    enabled: boolean;
    concurrency: number;
    autoCloseOnSuccess: boolean;
    autoEscalateOnFailure: boolean;
    escalationThreshold: number;
  };
  
  // Notification Settings
  notifications: {
    teams: {
      enabled: boolean;
      webhookUrl: string;
      alertChannel: string;
      escalationMentions: string[];
    };
    email: {
      enabled: boolean;
      escalationEmails: string[];
    };
    slack: {
      enabled: boolean;
      channel: string;
    };
  };
  
  // Feature Flags
  features: {
    ticketSync: boolean;
    autoRemediation: boolean;
    teamsCommands: boolean;
    emailNotifications: boolean;
    dashboardAnalytics: boolean;
    auditLogging: boolean;
    scriptTemplates: boolean;
    boardManagement: boolean;
  };
}

export class ConfigurationService {
  private static instance: ConfigurationService;
  private config: SystemConfiguration;
  
  private constructor() {
    this.loadConfiguration();
  }
  
  public static getInstance(): ConfigurationService {
    if (!ConfigurationService.instance) {
      ConfigurationService.instance = new ConfigurationService();
    }
    return ConfigurationService.instance;
  }
  
  private loadConfiguration(): void {
    this.config = {
      connectwise: {
        defaultBoardId: parseInt(process.env.CW_DEFAULT_BOARD_ID || '10'),
        defaultBoardName: process.env.CW_DEFAULT_BOARD_NAME || 'Network Operations Center',
        monitoredBoards: this.parseNumberArray(process.env.CW_BOARD_IDS || '10'),
        // defaultCompanyId not needed - N-able assigns company when creating tickets
        preventDuplicates: process.env.PREVENT_DUPLICATE_TICKETS === 'true',
        updateOnlyMode: process.env.UPDATE_ONLY_MODE === 'true',
        createNewTickets: process.env.CREATE_NEW_CW_TICKETS !== 'false'
      },
      nable: {
        scriptTimeout: parseInt(process.env.NABLE_SCRIPT_TIMEOUT || '300000'),
        maxRetries: parseInt(process.env.NABLE_MAX_RETRIES || '3'),
        includeTicketNumber: process.env.NABLE_INCLUDE_TICKET_NUMBER === 'true'
      },
      automation: {
        enabled: process.env.AUTOMATION_ENABLED !== 'false',
        concurrency: parseInt(process.env.AUTOMATION_CONCURRENCY || '5'),
        autoCloseOnSuccess: process.env.AUTO_CLOSE_ON_SUCCESS !== 'false',
        autoEscalateOnFailure: process.env.AUTO_ESCALATE_ON_FAILURE !== 'false',
        escalationThreshold: parseInt(process.env.ESCALATION_FAILURE_THRESHOLD || '2')
      },
      notifications: {
        teams: {
          enabled: process.env.MS_TEAMS_ENABLED !== 'false',
          webhookUrl: process.env.MS_TEAMS_WEBHOOK_URL || '',
          alertChannel: process.env.TEAMS_ALERT_CHANNEL || 'general',
          escalationMentions: this.parseStringArray(process.env.TEAMS_ESCALATION_MENTIONS || '@on-call-team')
        },
        email: {
          enabled: process.env.EMAIL_ENABLED === 'true',
          escalationEmails: this.parseStringArray(process.env.ESCALATION_EMAILS || '')
        },
        slack: {
          enabled: process.env.SLACK_ENABLED === 'true',
          channel: process.env.SLACK_CHANNEL || '#alerts'
        }
      },
      features: {
        ticketSync: process.env.FEATURE_TICKET_SYNC !== 'false',
        autoRemediation: process.env.FEATURE_AUTO_REMEDIATION !== 'false',
        teamsCommands: process.env.FEATURE_TEAMS_COMMANDS !== 'false',
        emailNotifications: process.env.FEATURE_EMAIL_NOTIFICATIONS !== 'false',
        dashboardAnalytics: process.env.FEATURE_DASHBOARD_ANALYTICS !== 'false',
        auditLogging: process.env.FEATURE_AUDIT_LOGGING !== 'false',
        scriptTemplates: process.env.FEATURE_SCRIPT_TEMPLATES !== 'false',
        boardManagement: process.env.FEATURE_BOARD_MANAGEMENT !== 'false'
      }
    };
    
    logger.info('Configuration loaded:', {
      defaultBoard: this.config.connectwise.defaultBoardName,
      preventDuplicates: this.config.connectwise.preventDuplicates,
      automationEnabled: this.config.automation.enabled
    });
  }
  
  private parseNumberArray(value: string): number[] {
    return value.split(',')
      .map(v => parseInt(v.trim()))
      .filter(v => !isNaN(v));
  }
  
  private parseStringArray(value: string): string[] {
    return value.split(',')
      .map(v => v.trim())
      .filter(v => v.length > 0);
  }
  
  public getConfig(): SystemConfiguration {
    return this.config;
  }
  
  public getConnectWiseConfig() {
    return this.config.connectwise;
  }
  
  public getNableConfig() {
    return this.config.nable;
  }
  
  public getAutomationConfig() {
    return this.config.automation;
  }
  
  public getNotificationConfig() {
    return this.config.notifications;
  }
  
  public isFeatureEnabled(feature: keyof SystemConfiguration['features']): boolean {
    return this.config.features[feature];
  }
  
  public async updateConfiguration(updates: Partial<SystemConfiguration>): Promise<void> {
    // Deep merge updates with existing config
    this.config = this.deepMerge(this.config, updates) as SystemConfiguration;
    
    // Optionally persist to database
    // await this.persistConfiguration();
    
    logger.info('Configuration updated:', updates);
  }
  
  private deepMerge(target: any, source: any): any {
    const output = Object.assign({}, target);
    if (this.isObject(target) && this.isObject(source)) {
      Object.keys(source).forEach(key => {
        if (this.isObject(source[key])) {
          if (!(key in target)) {
            Object.assign(output, { [key]: source[key] });
          } else {
            output[key] = this.deepMerge(target[key], source[key]);
          }
        } else {
          Object.assign(output, { [key]: source[key] });
        }
      });
    }
    return output;
  }
  
  private isObject(item: any): boolean {
    return item && typeof item === 'object' && !Array.isArray(item);
  }
  
  /**
   * Get the default board configuration for Network Operations Center
   */
  public getNOCBoardConfig() {
    return {
      id: this.config.connectwise.defaultBoardId,
      name: this.config.connectwise.defaultBoardName,
      isDefault: true
    };
  }
  
  /**
   * Check if we should prevent duplicate ticket creation
   */
  public shouldPreventDuplicates(): boolean {
    return this.config.connectwise.preventDuplicates;
  }
  
  /**
   * Check if we're in update-only mode (no new ticket creation)
   */
  public isUpdateOnlyMode(): boolean {
    return this.config.connectwise.updateOnlyMode;
  }
  
  /**
   * Get script template configurations
   */
  public getScriptTemplates() {
    return {
      'cleanup-disk': {
        name: 'Disk Cleanup Advanced',
        timeout: 300,
        autoClose: true,
        escalateOnFail: 2
      },
      'restart-service': {
        name: 'Smart Service Restart',
        timeout: 180,
        autoClose: true,
        escalateOnFail: 1
      },
      'restart-iis': {
        name: 'IIS Application Pool Recycle',
        timeout: 120,
        autoClose: true,
        escalateOnFail: 1
      },
      'clear-cache': {
        name: 'Memory & Cache Optimization',
        timeout: 240,
        autoClose: true,
        escalateOnFail: 0
      },
      'install-updates': {
        name: 'Windows Update Installation',
        timeout: 600,
        autoClose: false,
        escalateOnFail: 0
      },
      'reset-network': {
        name: 'Network Stack Reset',
        timeout: 180,
        autoClose: true,
        escalateOnFail: 1
      }
    };
  }
}



export interface SystemConfiguration {
  // ConnectWise Settings
  connectwise: {
    defaultBoardId: number;
    defaultBoardName: string;
    monitoredBoards: number[];
    // defaultCompanyId removed - N-able creates tickets with company assigned
    preventDuplicates: boolean;
    updateOnlyMode: boolean;
    createNewTickets: boolean;
  };
  
  // N-able Settings
  nable: {
    scriptTimeout: number;
    maxRetries: number;
    includeTicketNumber: boolean;
  };
  
  // Automation Settings
  automation: {
    enabled: boolean;
    concurrency: number;
    autoCloseOnSuccess: boolean;
    autoEscalateOnFailure: boolean;
    escalationThreshold: number;
  };
  
  // Notification Settings
  notifications: {
    teams: {
      enabled: boolean;
      webhookUrl: string;
      alertChannel: string;
      escalationMentions: string[];
    };
    email: {
      enabled: boolean;
      escalationEmails: string[];
    };
    slack: {
      enabled: boolean;
      channel: string;
    };
  };
  
  // Feature Flags
  features: {
    ticketSync: boolean;
    autoRemediation: boolean;
    teamsCommands: boolean;
    emailNotifications: boolean;
    dashboardAnalytics: boolean;
    auditLogging: boolean;
    scriptTemplates: boolean;
    boardManagement: boolean;
  };
}

export class ConfigurationService {
  private static instance: ConfigurationService;
  private config: SystemConfiguration;
  
  private constructor() {
    this.loadConfiguration();
  }
  
  public static getInstance(): ConfigurationService {
    if (!ConfigurationService.instance) {
      ConfigurationService.instance = new ConfigurationService();
    }
    return ConfigurationService.instance;
  }
  
  private loadConfiguration(): void {
    this.config = {
      connectwise: {
        defaultBoardId: parseInt(process.env.CW_DEFAULT_BOARD_ID || '10'),
        defaultBoardName: process.env.CW_DEFAULT_BOARD_NAME || 'Network Operations Center',
        monitoredBoards: this.parseNumberArray(process.env.CW_BOARD_IDS || '10'),
        // defaultCompanyId not needed - N-able assigns company when creating tickets
        preventDuplicates: process.env.PREVENT_DUPLICATE_TICKETS === 'true',
        updateOnlyMode: process.env.UPDATE_ONLY_MODE === 'true',
        createNewTickets: process.env.CREATE_NEW_CW_TICKETS !== 'false'
      },
      nable: {
        scriptTimeout: parseInt(process.env.NABLE_SCRIPT_TIMEOUT || '300000'),
        maxRetries: parseInt(process.env.NABLE_MAX_RETRIES || '3'),
        includeTicketNumber: process.env.NABLE_INCLUDE_TICKET_NUMBER === 'true'
      },
      automation: {
        enabled: process.env.AUTOMATION_ENABLED !== 'false',
        concurrency: parseInt(process.env.AUTOMATION_CONCURRENCY || '5'),
        autoCloseOnSuccess: process.env.AUTO_CLOSE_ON_SUCCESS !== 'false',
        autoEscalateOnFailure: process.env.AUTO_ESCALATE_ON_FAILURE !== 'false',
        escalationThreshold: parseInt(process.env.ESCALATION_FAILURE_THRESHOLD || '2')
      },
      notifications: {
        teams: {
          enabled: process.env.MS_TEAMS_ENABLED !== 'false',
          webhookUrl: process.env.MS_TEAMS_WEBHOOK_URL || '',
          alertChannel: process.env.TEAMS_ALERT_CHANNEL || 'general',
          escalationMentions: this.parseStringArray(process.env.TEAMS_ESCALATION_MENTIONS || '@on-call-team')
        },
        email: {
          enabled: process.env.EMAIL_ENABLED === 'true',
          escalationEmails: this.parseStringArray(process.env.ESCALATION_EMAILS || '')
        },
        slack: {
          enabled: process.env.SLACK_ENABLED === 'true',
          channel: process.env.SLACK_CHANNEL || '#alerts'
        }
      },
      features: {
        ticketSync: process.env.FEATURE_TICKET_SYNC !== 'false',
        autoRemediation: process.env.FEATURE_AUTO_REMEDIATION !== 'false',
        teamsCommands: process.env.FEATURE_TEAMS_COMMANDS !== 'false',
        emailNotifications: process.env.FEATURE_EMAIL_NOTIFICATIONS !== 'false',
        dashboardAnalytics: process.env.FEATURE_DASHBOARD_ANALYTICS !== 'false',
        auditLogging: process.env.FEATURE_AUDIT_LOGGING !== 'false',
        scriptTemplates: process.env.FEATURE_SCRIPT_TEMPLATES !== 'false',
        boardManagement: process.env.FEATURE_BOARD_MANAGEMENT !== 'false'
      }
    };
    
    logger.info('Configuration loaded:', {
      defaultBoard: this.config.connectwise.defaultBoardName,
      preventDuplicates: this.config.connectwise.preventDuplicates,
      automationEnabled: this.config.automation.enabled
    });
  }
  
  private parseNumberArray(value: string): number[] {
    return value.split(',')
      .map(v => parseInt(v.trim()))
      .filter(v => !isNaN(v));
  }
  
  private parseStringArray(value: string): string[] {
    return value.split(',')
      .map(v => v.trim())
      .filter(v => v.length > 0);
  }
  
  public getConfig(): SystemConfiguration {
    return this.config;
  }
  
  public getConnectWiseConfig() {
    return this.config.connectwise;
  }
  
  public getNableConfig() {
    return this.config.nable;
  }
  
  public getAutomationConfig() {
    return this.config.automation;
  }
  
  public getNotificationConfig() {
    return this.config.notifications;
  }
  
  public isFeatureEnabled(feature: keyof SystemConfiguration['features']): boolean {
    return this.config.features[feature];
  }
  
  public async updateConfiguration(updates: Partial<SystemConfiguration>): Promise<void> {
    // Deep merge updates with existing config
    this.config = this.deepMerge(this.config, updates) as SystemConfiguration;
    
    // Optionally persist to database
    // await this.persistConfiguration();
    
    logger.info('Configuration updated:', updates);
  }
  
  private deepMerge(target: any, source: any): any {
    const output = Object.assign({}, target);
    if (this.isObject(target) && this.isObject(source)) {
      Object.keys(source).forEach(key => {
        if (this.isObject(source[key])) {
          if (!(key in target)) {
            Object.assign(output, { [key]: source[key] });
          } else {
            output[key] = this.deepMerge(target[key], source[key]);
          }
        } else {
          Object.assign(output, { [key]: source[key] });
        }
      });
    }
    return output;
  }
  
  private isObject(item: any): boolean {
    return item && typeof item === 'object' && !Array.isArray(item);
  }
  
  /**
   * Get the default board configuration for Network Operations Center
   */
  public getNOCBoardConfig() {
    return {
      id: this.config.connectwise.defaultBoardId,
      name: this.config.connectwise.defaultBoardName,
      isDefault: true
    };
  }
  
  /**
   * Check if we should prevent duplicate ticket creation
   */
  public shouldPreventDuplicates(): boolean {
    return this.config.connectwise.preventDuplicates;
  }
  
  /**
   * Check if we're in update-only mode (no new ticket creation)
   */
  public isUpdateOnlyMode(): boolean {
    return this.config.connectwise.updateOnlyMode;
  }
  
  /**
   * Get script template configurations
   */
  public getScriptTemplates() {
    return {
      'cleanup-disk': {
        name: 'Disk Cleanup Advanced',
        timeout: 300,
        autoClose: true,
        escalateOnFail: 2
      },
      'restart-service': {
        name: 'Smart Service Restart',
        timeout: 180,
        autoClose: true,
        escalateOnFail: 1
      },
      'restart-iis': {
        name: 'IIS Application Pool Recycle',
        timeout: 120,
        autoClose: true,
        escalateOnFail: 1
      },
      'clear-cache': {
        name: 'Memory & Cache Optimization',
        timeout: 240,
        autoClose: true,
        escalateOnFail: 0
      },
      'install-updates': {
        name: 'Windows Update Installation',
        timeout: 600,
        autoClose: false,
        escalateOnFail: 0
      },
      'reset-network': {
        name: 'Network Stack Reset',
        timeout: 180,
        autoClose: true,
        escalateOnFail: 1
      }
    };
  }
}

