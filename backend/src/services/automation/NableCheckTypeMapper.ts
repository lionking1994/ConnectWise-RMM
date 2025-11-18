/**
 * N-able Check Type Mapper
 * Maps N-able check type IDs to automation actions
 * Based on: https://developer.n-able.com/n-sight/docs/listing-failing-checks
 */

export interface CheckTypeMapping {
  checkType: number;
  name: string;
  category: string;
  remediationScript?: string;
  autoRemediate: boolean;
  parameters?: Record<string, any>;
  escalationRequired?: boolean;
}

/**
 * N-able Check Type IDs from documentation
 */
export enum NableCheckType {
  // Windows Check Types
  ANTIVIRUS_UPDATE = 1001,
  BACKUP_CHECK = 1002,
  DRIVE_SPACE_CHANGE = 1003,
  DISK_SPACE = 1004,
  EXCHANGE_STORE_SIZE = 1005,
  FAILED_LOGIN = 1006,
  PERFORMANCE_MONITORING = 1007,
  PHYSICAL_DISK_HEALTH = 1008,
  PHYSICAL_MEMORY_HEALTH = 1009,
  PING_CHECK = 1010,
  TCP_SERVICE = 1011,
  WEB_PAGE = 1012,
  WINDOWS_SERVICE = 1013,
  CRITICAL_EVENTS = 1014,
  SNMP_CHECK = 1015,
  BANDWIDTH_MONITORING = 1018,
  FILE_SIZE = 1019,
  EVENT_LOG = 1020,
  WSUS_CHECK = 1021,
  AUTO_START_SERVICE = 1022,
  AUTOMATED_TASK = 1023,
  SCRIPT_CHECK = 1024,
  VULNERABILITY = 1025,
  MANAGED_ANTIVIRUS_VIPRE = 1026,
  BACKUP_RECOVERY_SIZE = 1030,
  WEB_PROTECTION_BANDWIDTH = 1033,
  MANAGED_ANTIVIRUS_BITDEFENDER = 1034,

  // Linux Check Types
  LINUX_ANTIVIRUS = 2001,
  LINUX_BACKUP = 2002,
  LINUX_FILE_SYSTEM_CHANGE = 2003,
  LINUX_FILE_SYSTEM_SPACE = 2004,
  LINUX_MTA_QUEUE = 2005,
  LINUX_FAILED_LOGIN = 2006,
  LINUX_PERFORMANCE = 2007,
  LINUX_PHYSICAL_DISK = 2008,
  LINUX_PHYSICAL_MEMORY = 2009,
  LINUX_PING = 2010,
  LINUX_TCP_SERVICE = 2011,
  LINUX_WEB_PAGE = 2012,
  LINUX_DAEMON = 2013,
  LINUX_SNMP = 2015,
  LINUX_BANDWIDTH = 2018,
  LINUX_SCRIPT = 2024,
  LINUX_PROCESS = 2027,
  LINUX_LOG_FILE = 2028,
  LINUX_MYSQL = 2029,
  LINUX_PACKAGE_MANAGER = 2031,

  // macOS Check Types
  OSX_FILE_SYSTEM_CHANGE = 3003,
  OSX_FILE_SYSTEM_SPACE = 3004,
  OSX_FAILED_LOGIN = 3006,
  OSX_PHYSICAL_DISK = 3008,
  OSX_DAEMON = 3013,
  OSX_SYSTEM_LOG = 3014,
  OSX_UPDATE = 3021,
  OSX_SCRIPT = 3024,
  OSX_PROCESS = 3027,
  OSX_LOG_FILE = 3028
}

export class NableCheckTypeMapper {
  private static mappings: Map<number, CheckTypeMapping> = new Map([
    // Disk Space Checks - High Priority Auto-remediation
    [NableCheckType.DISK_SPACE, {
      checkType: NableCheckType.DISK_SPACE,
      name: 'Disk Space Check',
      category: 'storage',
      remediationScript: 'cleanup_disk_space.ps1',
      autoRemediate: true,
      parameters: {
        thresholdPercent: 90,
        cleanTemp: true,
        cleanLogs: true,
        maxLogAge: 30
      }
    }],
    [NableCheckType.LINUX_FILE_SYSTEM_SPACE, {
      checkType: NableCheckType.LINUX_FILE_SYSTEM_SPACE,
      name: 'Linux File System Space',
      category: 'storage',
      remediationScript: 'cleanup_disk_space.sh',
      autoRemediate: true,
      parameters: {
        cleanPackageCache: true,
        cleanTemp: true
      }
    }],

    // Service Checks - Auto-restart services
    [NableCheckType.WINDOWS_SERVICE, {
      checkType: NableCheckType.WINDOWS_SERVICE,
      name: 'Windows Service Check',
      category: 'service',
      remediationScript: 'restart_windows_service.ps1',
      autoRemediate: true,
      parameters: {
        maxRestartAttempts: 3,
        waitBetweenAttempts: 60
      }
    }],
    [NableCheckType.AUTO_START_SERVICE, {
      checkType: NableCheckType.AUTO_START_SERVICE,
      name: 'Auto-Start Service Check',
      category: 'service',
      remediationScript: 'restart_windows_service.ps1',
      autoRemediate: true
    }],
    [NableCheckType.LINUX_DAEMON, {
      checkType: NableCheckType.LINUX_DAEMON,
      name: 'Linux Daemon Check',
      category: 'service',
      remediationScript: 'restart_linux_service.sh',
      autoRemediate: true
    }],

    // Backup Checks - Notification only, manual intervention needed
    [NableCheckType.BACKUP_CHECK, {
      checkType: NableCheckType.BACKUP_CHECK,
      name: 'Backup Check',
      category: 'backup',
      autoRemediate: false,
      escalationRequired: true,
      remediationScript: 'check_backup_status.ps1'
    }],
    [NableCheckType.LINUX_BACKUP, {
      checkType: NableCheckType.LINUX_BACKUP,
      name: 'Linux Backup Check',
      category: 'backup',
      autoRemediate: false,
      escalationRequired: true
    }],

    // Antivirus Checks - Update definitions
    [NableCheckType.ANTIVIRUS_UPDATE, {
      checkType: NableCheckType.ANTIVIRUS_UPDATE,
      name: 'Antivirus Update Check',
      category: 'security',
      remediationScript: 'update_antivirus.ps1',
      autoRemediate: true,
      parameters: {
        forceUpdate: true
      }
    }],
    [NableCheckType.MANAGED_ANTIVIRUS_BITDEFENDER, {
      checkType: NableCheckType.MANAGED_ANTIVIRUS_BITDEFENDER,
      name: 'Bitdefender Antivirus Check',
      category: 'security',
      remediationScript: 'fix_bitdefender.ps1',
      autoRemediate: true
    }],

    // Performance Checks - Analyze and report
    [NableCheckType.PERFORMANCE_MONITORING, {
      checkType: NableCheckType.PERFORMANCE_MONITORING,
      name: 'Performance Monitoring',
      category: 'performance',
      remediationScript: 'analyze_performance.ps1',
      autoRemediate: true,
      parameters: {
        killHighCpuProcesses: false,
        generateReport: true
      }
    }],
    [NableCheckType.BANDWIDTH_MONITORING, {
      checkType: NableCheckType.BANDWIDTH_MONITORING,
      name: 'Bandwidth Monitoring',
      category: 'network',
      autoRemediate: false,
      escalationRequired: true
    }],

    // Hardware Health - Escalate immediately
    [NableCheckType.PHYSICAL_DISK_HEALTH, {
      checkType: NableCheckType.PHYSICAL_DISK_HEALTH,
      name: 'Physical Disk Health',
      category: 'hardware',
      autoRemediate: false,
      escalationRequired: true,
      remediationScript: 'check_disk_smart.ps1'
    }],
    [NableCheckType.PHYSICAL_MEMORY_HEALTH, {
      checkType: NableCheckType.PHYSICAL_MEMORY_HEALTH,
      name: 'Physical Memory Health',
      category: 'hardware',
      autoRemediate: false,
      escalationRequired: true
    }],

    // Network Checks
    [NableCheckType.PING_CHECK, {
      checkType: NableCheckType.PING_CHECK,
      name: 'Ping Check',
      category: 'network',
      remediationScript: 'check_network_connectivity.ps1',
      autoRemediate: true,
      parameters: {
        restartNetworkAdapter: true
      }
    }],
    [NableCheckType.TCP_SERVICE, {
      checkType: NableCheckType.TCP_SERVICE,
      name: 'TCP Service Check',
      category: 'network',
      autoRemediate: false
    }],

    // Security Events - Escalate
    [NableCheckType.FAILED_LOGIN, {
      checkType: NableCheckType.FAILED_LOGIN,
      name: 'Failed Login Check',
      category: 'security',
      autoRemediate: false,
      escalationRequired: true,
      remediationScript: 'analyze_failed_logins.ps1'
    }],
    [NableCheckType.CRITICAL_EVENTS, {
      checkType: NableCheckType.CRITICAL_EVENTS,
      name: 'Critical Events Check',
      category: 'system',
      autoRemediate: false,
      escalationRequired: true
    }],

    // Script/Task Failures
    [NableCheckType.AUTOMATED_TASK, {
      checkType: NableCheckType.AUTOMATED_TASK,
      name: 'Automated Task',
      category: 'automation',
      autoRemediate: false,
      parameters: {
        notifyOnly: true
      }
    }],
    [NableCheckType.SCRIPT_CHECK, {
      checkType: NableCheckType.SCRIPT_CHECK,
      name: 'Script Check',
      category: 'automation',
      autoRemediate: false
    }],

    // WSUS/Updates
    [NableCheckType.WSUS_CHECK, {
      checkType: NableCheckType.WSUS_CHECK,
      name: 'WSUS Check',
      category: 'updates',
      remediationScript: 'force_wsus_update.ps1',
      autoRemediate: true,
      parameters: {
        installCritical: true,
        installImportant: true,
        rebootIfNeeded: false
      }
    }]
  ]);

  /**
   * Get remediation action for a check type
   */
  static getRemediation(checkType: number): CheckTypeMapping | undefined {
    return this.mappings.get(checkType);
  }

  /**
   * Parse check description to extract additional context
   */
  static parseCheckDescription(description: string): {
    checkName: string;
    targetService?: string;
    targetDisk?: string;
    targetProcess?: string;
  } {
    const result: any = { checkName: description };

    // Extract Windows Service name
    const serviceMatch = description.match(/Windows Service Check - (.+)/i);
    if (serviceMatch) {
      result.targetService = serviceMatch[1];
    }

    // Extract disk drive letter
    const diskMatch = description.match(/Drive ([A-Z]):/i);
    if (diskMatch) {
      result.targetDisk = diskMatch[1];
    }

    // Extract process name
    const processMatch = description.match(/Process Check - (.+)/i);
    if (processMatch) {
      result.targetProcess = processMatch[1];
    }

    return result;
  }

  /**
   * Determine if auto-remediation should run based on check output
   */
  static shouldAutoRemediate(
    checkType: number,
    checkStatus: string,
    formattedOutput: string
  ): boolean {
    const mapping = this.getRemediation(checkType);
    if (!mapping || !mapping.autoRemediate) {
      return false;
    }

    // Don't auto-remediate if it's just a warning
    if (checkStatus === 'testalertdelayed') {
      return false;
    }

    // Additional logic based on check type
    switch (checkType) {
      case NableCheckType.DISK_SPACE:
      case NableCheckType.LINUX_FILE_SYSTEM_SPACE:
        // Only remediate if disk is > 90% full
        const percentMatch = formattedOutput.match(/(\d+)%/);
        if (percentMatch) {
          const percent = parseInt(percentMatch[1]);
          return percent >= 90;
        }
        break;

      case NableCheckType.WINDOWS_SERVICE:
      case NableCheckType.AUTO_START_SERVICE:
        // Only remediate if service is stopped
        return formattedOutput.toLowerCase().includes('stopped');

      case NableCheckType.BACKUP_CHECK:
        // Never auto-remediate backup failures
        return false;
    }

    return mapping.autoRemediate;
  }

  /**
   * Get severity level based on check type and status
   */
  static getSeverity(checkType: number, checkStatus: string): 'critical' | 'high' | 'medium' | 'low' {
    // Hardware failures are always critical
    if ([NableCheckType.PHYSICAL_DISK_HEALTH, NableCheckType.PHYSICAL_MEMORY_HEALTH].includes(checkType)) {
      return 'critical';
    }

    // Security events are high priority
    if ([NableCheckType.FAILED_LOGIN, NableCheckType.CRITICAL_EVENTS, NableCheckType.VULNERABILITY].includes(checkType)) {
      return 'high';
    }

    // Backup failures are high priority
    if ([NableCheckType.BACKUP_CHECK, NableCheckType.LINUX_BACKUP].includes(checkType)) {
      return 'high';
    }

    // Map by check status
    switch (checkStatus) {
      case 'testerror':
      case 'testerror_inactive':
        return 'critical';
      case 'testalertdelayed':
        return 'medium';
      default:
        return 'low';
    }
  }
}
