/**
 * Default Automation Rules for N-able Alerts
 * Based on N-able check type IDs from API documentation
 */

import { AutomationRule, RuleConditionOperator, ActionType } from '../entities/AutomationRule';
import { NableCheckType } from '../services/automation/NableCheckTypeMapper';

export const defaultAutomationRules: Partial<AutomationRule>[] = [
  // ==== DISK SPACE RULES ====
  {
    name: 'Auto-Clean Disk Space (Windows)',
    description: 'Automatically clean disk space when Windows disk is over 90% full',
    isActive: true,
    priority: 100,
    conditions: {
      all: [
        {
          field: 'source',
          operator: RuleConditionOperator.EQUALS,
          value: 'nable',
          dataSource: 'ticket'
        },
        {
          field: 'metadata.nableData.checkData.checkType',
          operator: RuleConditionOperator.EQUALS,
          value: NableCheckType.DISK_SPACE,
          dataSource: 'ticket'
        },
        {
          field: 'metadata.nableData.checkData.formattedOutput',
          operator: RuleConditionOperator.REGEX,
          value: '(9[0-9]|100)%',
          dataSource: 'ticket'
        }
      ]
    },
    actions: [
      {
        type: ActionType.RUN_SCRIPT,
        parameters: {
          script: 'cleanup_disk_space.ps1',
          params: {
            cleanTemp: true,
            cleanLogs: true,
            cleanRecycleBin: true,
            maxLogAge: 30
          }
        },
        order: 1,
        continueOnError: true
      },
      {
        type: ActionType.ADD_NOTE,
        parameters: {
          note: 'Automated disk cleanup initiated due to disk space > 90%'
        },
        order: 2,
        continueOnError: true
      }
    ],
    triggerEvents: ['ticket_created', 'ticket_updated'],
    maxRetries: 2,
    retryDelayMs: 60000,
    timeoutMs: 600000,
    tags: ['disk', 'storage', 'auto-remediation']
  },

  // ==== SERVICE RESTART RULES ====
  {
    name: 'Auto-Restart Windows Services',
    description: 'Automatically restart stopped Windows services',
    isActive: true,
    priority: 95,
    conditions: {
      all: [
        {
          field: 'source',
          operator: RuleConditionOperator.EQUALS,
          value: 'nable',
          dataSource: 'ticket'
        },
        {
          field: 'metadata.nableData.checkData.checkType',
          operator: RuleConditionOperator.IN,
          value: [NableCheckType.WINDOWS_SERVICE, NableCheckType.AUTO_START_SERVICE],
          dataSource: 'ticket'
        },
        {
          field: 'metadata.nableData.checkData.formattedOutput',
          operator: RuleConditionOperator.CONTAINS,
          value: 'stopped',
          dataSource: 'ticket'
        }
      ]
    },
    actions: [
      {
        type: ActionType.RESTART_SERVICE,
        parameters: {
          maxAttempts: 3,
          waitBetweenAttempts: 30
        },
        order: 1,
        continueOnError: false
      },
      {
        type: ActionType.UPDATE_TICKET,
        parameters: {
          status: 'in_progress',
          notes_append: 'Service restart attempted'
        },
        order: 2,
        continueOnError: true
      }
    ],
    triggerEvents: ['ticket_created'],
    maxRetries: 3,
    retryDelayMs: 30000,
    timeoutMs: 180000,
    tags: ['service', 'windows', 'auto-remediation']
  },

  // ==== BACKUP FAILURE RULES ====
  {
    name: 'Escalate Backup Failures',
    description: 'Immediately escalate backup check failures to high priority',
    isActive: true,
    priority: 110,
    conditions: {
      all: [
        {
          field: 'source',
          operator: RuleConditionOperator.EQUALS,
          value: 'nable',
          dataSource: 'ticket'
        },
        {
          field: 'metadata.nableData.checkData.checkType',
          operator: RuleConditionOperator.IN,
          value: [NableCheckType.BACKUP_CHECK, NableCheckType.LINUX_BACKUP],
          dataSource: 'ticket'
        }
      ]
    },
    actions: [
      {
        type: ActionType.ESCALATE,
        parameters: {
          priority: 'high',
          assignToGroup: 'backup-team'
        },
        order: 1,
        continueOnError: false
      },
      {
        type: ActionType.SEND_NOTIFICATION,
        parameters: {
          recipients: ['backup-admin@company.com'],
          template: 'backup_failure',
          urgency: 'high'
        },
        order: 2,
        continueOnError: true
      },
      {
        type: ActionType.CREATE_TICKET,
        parameters: {
          system: 'connectwise',
          board: 'Critical Issues',
          priority: 'Critical'
        },
        order: 3,
        continueOnError: true
      }
    ],
    triggerEvents: ['ticket_created'],
    maxRetries: 1,
    retryDelayMs: 5000,
    timeoutMs: 60000,
    tags: ['backup', 'critical', 'escalation']
  },

  // ==== ANTIVIRUS UPDATE RULES ====
  {
    name: 'Update Antivirus Definitions',
    description: 'Force antivirus definition updates when out of date',
    isActive: true,
    priority: 90,
    conditions: {
      all: [
        {
          field: 'source',
          operator: RuleConditionOperator.EQUALS,
          value: 'nable',
          dataSource: 'ticket'
        },
        {
          field: 'metadata.nableData.checkData.checkType',
          operator: RuleConditionOperator.IN,
          value: [
            NableCheckType.ANTIVIRUS_UPDATE,
            NableCheckType.MANAGED_ANTIVIRUS_BITDEFENDER,
            NableCheckType.MANAGED_ANTIVIRUS_VIPRE
          ],
          dataSource: 'ticket'
        }
      ]
    },
    actions: [
      {
        type: ActionType.RUN_SCRIPT,
        parameters: {
          script: 'update_antivirus.ps1',
          params: {
            forceUpdate: true,
            restartService: true
          }
        },
        order: 1,
        continueOnError: false
      },
      {
        type: ActionType.ADD_NOTE,
        parameters: {
          note: 'Antivirus definition update triggered automatically'
        },
        order: 2,
        continueOnError: true
      }
    ],
    triggerEvents: ['ticket_created'],
    maxRetries: 2,
    retryDelayMs: 120000,
    timeoutMs: 300000,
    tags: ['security', 'antivirus', 'auto-remediation']
  },

  // ==== HARDWARE FAILURE RULES ====
  {
    name: 'Critical Hardware Alert',
    description: 'Immediately escalate hardware health issues',
    isActive: true,
    priority: 120,
    conditions: {
      all: [
        {
          field: 'source',
          operator: RuleConditionOperator.EQUALS,
          value: 'nable',
          dataSource: 'ticket'
        },
        {
          field: 'metadata.nableData.checkData.checkType',
          operator: RuleConditionOperator.IN,
          value: [
            NableCheckType.PHYSICAL_DISK_HEALTH,
            NableCheckType.PHYSICAL_MEMORY_HEALTH,
            NableCheckType.LINUX_PHYSICAL_DISK
          ],
          dataSource: 'ticket'
        }
      ]
    },
    actions: [
      {
        type: ActionType.ESCALATE,
        parameters: {
          priority: 'critical',
          assignToGroup: 'infrastructure-team'
        },
        order: 1,
        continueOnError: false
      },
      {
        type: ActionType.SEND_NOTIFICATION,
        parameters: {
          recipients: ['it-manager@company.com', 'oncall@company.com'],
          template: 'hardware_failure',
          urgency: 'critical',
          includeDeviceInfo: true
        },
        order: 2,
        continueOnError: true
      },
      {
        type: ActionType.RUN_SCRIPT,
        parameters: {
          script: 'collect_hardware_diagnostics.ps1',
          params: {
            includeSMART: true,
            includeEventLog: true
          }
        },
        order: 3,
        continueOnError: true
      }
    ],
    triggerEvents: ['ticket_created'],
    maxRetries: 1,
    retryDelayMs: 5000,
    timeoutMs: 120000,
    tags: ['hardware', 'critical', 'escalation']
  },

  // ==== SECURITY EVENTS RULES ====
  {
    name: 'Failed Login Detection',
    description: 'Alert on multiple failed login attempts',
    isActive: true,
    priority: 105,
    conditions: {
      all: [
        {
          field: 'source',
          operator: RuleConditionOperator.EQUALS,
          value: 'nable',
          dataSource: 'ticket'
        },
        {
          field: 'metadata.nableData.checkData.checkType',
          operator: RuleConditionOperator.IN,
          value: [
            NableCheckType.FAILED_LOGIN,
            NableCheckType.LINUX_FAILED_LOGIN,
            NableCheckType.OSX_FAILED_LOGIN
          ],
          dataSource: 'ticket'
        }
      ]
    },
    actions: [
      {
        type: ActionType.RUN_SCRIPT,
        parameters: {
          script: 'analyze_failed_logins.ps1',
          params: {
            lockoutThreshold: 5,
            checkTimeWindow: 3600
          }
        },
        order: 1,
        continueOnError: false
      },
      {
        type: ActionType.SEND_NOTIFICATION,
        parameters: {
          recipients: ['security@company.com'],
          template: 'security_alert',
          urgency: 'high'
        },
        order: 2,
        continueOnError: true
      },
      {
        type: ActionType.ESCALATE,
        parameters: {
          priority: 'high',
          assignToGroup: 'security-team'
        },
        order: 3,
        continueOnError: true
      }
    ],
    triggerEvents: ['ticket_created'],
    maxRetries: 1,
    retryDelayMs: 5000,
    timeoutMs: 60000,
    tags: ['security', 'authentication', 'escalation']
  },

  // ==== PERFORMANCE MONITORING RULES ====
  {
    name: 'High CPU/Memory Usage',
    description: 'Analyze and remediate performance issues',
    isActive: true,
    priority: 85,
    conditions: {
      all: [
        {
          field: 'source',
          operator: RuleConditionOperator.EQUALS,
          value: 'nable',
          dataSource: 'ticket'
        },
        {
          field: 'metadata.nableData.checkData.checkType',
          operator: RuleConditionOperator.IN,
          value: [
            NableCheckType.PERFORMANCE_MONITORING,
            NableCheckType.LINUX_PERFORMANCE
          ],
          dataSource: 'ticket'
        }
      ]
    },
    actions: [
      {
        type: ActionType.RUN_SCRIPT,
        parameters: {
          script: 'analyze_performance.ps1',
          params: {
            collectProcessList: true,
            killHighCpuProcesses: false,
            cpuThreshold: 90,
            memoryThreshold: 90
          }
        },
        order: 1,
        continueOnError: false
      },
      {
        type: ActionType.ADD_NOTE,
        parameters: {
          note: 'Performance analysis initiated'
        },
        order: 2,
        continueOnError: true
      }
    ],
    triggerEvents: ['ticket_created'],
    maxRetries: 2,
    retryDelayMs: 30000,
    timeoutMs: 300000,
    tags: ['performance', 'monitoring']
  },

  // ==== WSUS/UPDATE RULES ====
  {
    name: 'Windows Update Installation',
    description: 'Force install critical Windows updates',
    isActive: true,
    priority: 80,
    conditions: {
      all: [
        {
          field: 'source',
          operator: RuleConditionOperator.EQUALS,
          value: 'nable',
          dataSource: 'ticket'
        },
        {
          field: 'metadata.nableData.checkData.checkType',
          operator: RuleConditionOperator.EQUALS,
          value: NableCheckType.WSUS_CHECK,
          dataSource: 'ticket'
        }
      ]
    },
    actions: [
      {
        type: ActionType.INSTALL_UPDATE,
        parameters: {
          installCritical: true,
          installImportant: true,
          installOptional: false,
          scheduleReboot: false
        },
        order: 1,
        continueOnError: false
      },
      {
        type: ActionType.ADD_NOTE,
        parameters: {
          note: 'Windows updates installation initiated'
        },
        order: 2,
        continueOnError: true
      }
    ],
    triggerEvents: ['ticket_created'],
    schedule: {
      enabled: true,
      cron: '0 3 * * *', // Run at 3 AM daily
      timezone: 'America/New_York'
    },
    maxRetries: 2,
    retryDelayMs: 300000,
    timeoutMs: 3600000,
    tags: ['updates', 'wsus', 'maintenance']
  },

  // ==== LINUX DAEMON RULES ====
  {
    name: 'Linux Service Restart',
    description: 'Restart failed Linux daemons',
    isActive: true,
    priority: 95,
    conditions: {
      all: [
        {
          field: 'source',
          operator: RuleConditionOperator.EQUALS,
          value: 'nable',
          dataSource: 'ticket'
        },
        {
          field: 'metadata.nableData.checkData.checkType',
          operator: RuleConditionOperator.EQUALS,
          value: NableCheckType.LINUX_DAEMON,
          dataSource: 'ticket'
        }
      ]
    },
    actions: [
      {
        type: ActionType.RUN_SCRIPT,
        parameters: {
          script: 'restart_linux_service.sh',
          params: {
            useSystemctl: true,
            maxAttempts: 3
          }
        },
        order: 1,
        continueOnError: false
      },
      {
        type: ActionType.UPDATE_TICKET,
        parameters: {
          notes_append: 'Linux daemon restart attempted'
        },
        order: 2,
        continueOnError: true
      }
    ],
    triggerEvents: ['ticket_created'],
    maxRetries: 3,
    retryDelayMs: 30000,
    timeoutMs: 180000,
    tags: ['linux', 'service', 'auto-remediation']
  },

  // ==== NETWORK CONNECTIVITY RULES ====
  {
    name: 'Network Connectivity Restoration',
    description: 'Attempt to restore network connectivity',
    isActive: true,
    priority: 100,
    conditions: {
      all: [
        {
          field: 'source',
          operator: RuleConditionOperator.EQUALS,
          value: 'nable',
          dataSource: 'ticket'
        },
        {
          field: 'metadata.nableData.checkData.checkType',
          operator: RuleConditionOperator.IN,
          value: [NableCheckType.PING_CHECK, NableCheckType.LINUX_PING],
          dataSource: 'ticket'
        }
      ]
    },
    actions: [
      {
        type: ActionType.RUN_SCRIPT,
        parameters: {
          script: 'check_network_connectivity.ps1',
          params: {
            restartNetworkAdapter: true,
            flushDNS: true,
            resetTCPIP: false
          }
        },
        order: 1,
        continueOnError: false
      },
      {
        type: ActionType.ADD_NOTE,
        parameters: {
          note: 'Network connectivity check initiated'
        },
        order: 2,
        continueOnError: true
      }
    ],
    triggerEvents: ['ticket_created'],
    maxRetries: 2,
    retryDelayMs: 60000,
    timeoutMs: 300000,
    tags: ['network', 'connectivity', 'auto-remediation']
  }
];

/**
 * Initialize default automation rules in the database
 */
export async function initializeDefaultRules(ruleRepository: any): Promise<void> {
  for (const ruleData of defaultAutomationRules) {
    const existingRule = await ruleRepository.findOne({ 
      where: { name: ruleData.name } 
    });
    
    if (!existingRule) {
      const rule = ruleRepository.create(ruleData);
      await ruleRepository.save(rule);
      console.log(`Created default automation rule: ${ruleData.name}`);
    }
  }
}
