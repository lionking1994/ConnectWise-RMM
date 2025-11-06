import { NableService, ScriptExecutionResult } from '../nable/NableService';
import { ConnectWiseService } from '../connectwise/ConnectWiseService';
import { TeamsService } from '../teams/TeamsService';
import { AppDataSource } from '../../database/dataSource';
import { Ticket } from '../../entities/Ticket';
import { AutomationHistory } from '../../entities/AutomationHistory';
import { logger } from '../../utils/logger';
import { EventEmitter } from 'events';

export interface ScriptOutput {
  executionId: string;
  ticketId?: string;
  deviceId: string;
  deviceName: string;
  scriptName: string;
  output: string;
  exitCode: number;
  success: boolean;
  timestamp: Date;
  parsedResults?: ParsedScriptResults;
}

export interface ParsedScriptResults {
  type: string;
  findings: any[];
  recommendations: string[];
  requiredActions: string[];
  metrics?: Record<string, any>;
}

export class ScriptOutputBridge extends EventEmitter {
  private static instance: ScriptOutputBridge;
  private nableService: NableService;
  private connectwiseService: ConnectWiseService;
  private teamsService: TeamsService;
  private ticketRepository = AppDataSource.getRepository(Ticket);
  private historyRepository = AppDataSource.getRepository(AutomationHistory);

  private constructor() {
    super();
    this.nableService = NableService.getInstance();
    this.connectwiseService = ConnectWiseService.getInstance();
    this.teamsService = TeamsService.getInstance();
  }

  public static getInstance(): ScriptOutputBridge {
    if (!ScriptOutputBridge.instance) {
      ScriptOutputBridge.instance = new ScriptOutputBridge();
    }
    return ScriptOutputBridge.instance;
  }

  async captureScriptOutput(
    executionResult: ScriptExecutionResult,
    ticketId?: string,
    deviceName?: string
  ): Promise<ScriptOutput> {
    const scriptOutput: ScriptOutput = {
      executionId: executionResult.executionId,
      ticketId,
      deviceId: executionResult.deviceId,
      deviceName: deviceName || executionResult.deviceId,
      scriptName: executionResult.scriptId,
      output: executionResult.output,
      exitCode: executionResult.exitCode || -1,
      success: executionResult.status === 'Completed' && (executionResult.exitCode === 0),
      timestamp: new Date()
    };

    // Parse the output based on script type
    scriptOutput.parsedResults = this.parseScriptOutput(
      executionResult.scriptId,
      executionResult.output
    );

    // Update ticket if associated
    if (ticketId) {
      await this.updateTicketWithResults(ticketId, scriptOutput);
    }

    // Send notifications
    await this.sendNotifications(scriptOutput);

    // Store in automation history
    await this.storeHistory(scriptOutput);

    // Emit event for real-time updates
    this.emit('scriptComplete', scriptOutput);

    return scriptOutput;
  }

  private parseScriptOutput(scriptId: string, output: string): ParsedScriptResults {
    // Parse different types of script outputs
    if (scriptId.includes('SCAN') || output.includes('sfc /scannow')) {
      return this.parseSystemScanOutput(output);
    } else if (scriptId.includes('DISK') || output.includes('disk')) {
      return this.parseDiskCleanupOutput(output);
    } else if (scriptId.includes('UPDATE') || output.includes('Windows Update')) {
      return this.parsePatchOutput(output);
    } else if (scriptId.includes('SERVICE')) {
      return this.parseServiceOutput(output);
    } else {
      return this.parseGenericOutput(output);
    }
  }

  private parseSystemScanOutput(output: string): ParsedScriptResults {
    const results: ParsedScriptResults = {
      type: 'system_scan',
      findings: [],
      recommendations: [],
      requiredActions: []
    };

    // Parse SFC scan results
    if (output.includes('Windows Resource Protection found corrupt files')) {
      results.findings.push({
        severity: 'high',
        issue: 'Corrupt system files detected',
        details: 'Windows Resource Protection found corrupt files'
      });
      results.recommendations.push('Run DISM to repair system image');
      results.requiredActions.push('Schedule maintenance window for repairs');
    } else if (output.includes('Windows Resource Protection did not find any integrity violations')) {
      results.findings.push({
        severity: 'info',
        issue: 'No issues found',
        details: 'System file integrity check passed'
      });
    }

    // Parse DISM results if present
    if (output.includes('The restore operation completed successfully')) {
      results.findings.push({
        severity: 'info',
        issue: 'System repair successful',
        details: 'DISM restore operation completed'
      });
    }

    // Check for specific error patterns
    const errorPatterns = [
      { pattern: /Error:\s*(\d+)/g, type: 'error_code' },
      { pattern: /Failed to\s+(.+)/g, type: 'failure' },
      { pattern: /Access denied/g, type: 'permission' }
    ];

    errorPatterns.forEach(({ pattern, type }) => {
      const matches = output.match(pattern);
      if (matches) {
        matches.forEach(match => {
          results.findings.push({
            severity: 'error',
            issue: type,
            details: match
          });
        });
      }
    });

    return results;
  }

  private parseDiskCleanupOutput(output: string): ParsedScriptResults {
    const results: ParsedScriptResults = {
      type: 'disk_cleanup',
      findings: [],
      recommendations: [],
      requiredActions: [],
      metrics: {}
    };

    // Parse freed space
    const freedSpaceMatch = output.match(/(\d+(?:\.\d+)?)\s*(GB|MB|KB)\s*freed/i);
    if (freedSpaceMatch) {
      const amount = parseFloat(freedSpaceMatch[1]);
      const unit = freedSpaceMatch[2];
      results.metrics!.freedSpace = { amount, unit };
      results.findings.push({
        severity: 'info',
        issue: 'Disk cleanup successful',
        details: `Freed ${amount} ${unit} of disk space`
      });
    }

    // Check disk usage after cleanup
    const diskUsageMatch = output.match(/(\d+)%\s*(?:used|full)/i);
    if (diskUsageMatch) {
      const usage = parseInt(diskUsageMatch[1]);
      results.metrics!.diskUsage = usage;
      
      if (usage > 90) {
        results.findings.push({
          severity: 'critical',
          issue: 'Critical disk space',
          details: `Disk still ${usage}% full after cleanup`
        });
        results.requiredActions.push('Investigate large files or consider disk expansion');
      } else if (usage > 80) {
        results.findings.push({
          severity: 'warning',
          issue: 'Low disk space',
          details: `Disk ${usage}% full after cleanup`
        });
        results.recommendations.push('Monitor disk usage closely');
      }
    }

    return results;
  }

  private parsePatchOutput(output: string): ParsedScriptResults {
    const results: ParsedScriptResults = {
      type: 'patch_management',
      findings: [],
      recommendations: [],
      requiredActions: [],
      metrics: {
        installed: 0,
        failed: 0,
        pending: 0
      }
    };

    // Parse Windows Update results
    const installedMatch = output.match(/(\d+)\s*updates?\s*installed/i);
    if (installedMatch) {
      results.metrics!.installed = parseInt(installedMatch[1]);
      results.findings.push({
        severity: 'info',
        issue: 'Updates installed',
        details: `Successfully installed ${installedMatch[1]} updates`
      });
    }

    const failedMatch = output.match(/(\d+)\s*updates?\s*failed/i);
    if (failedMatch) {
      results.metrics!.failed = parseInt(failedMatch[1]);
      results.findings.push({
        severity: 'error',
        issue: 'Update failures',
        details: `${failedMatch[1]} updates failed to install`
      });
      results.requiredActions.push('Review failed updates and troubleshoot installation issues');
    }

    // Check if restart is required
    if (output.includes('restart required') || output.includes('reboot required')) {
      results.findings.push({
        severity: 'warning',
        issue: 'Restart required',
        details: 'System restart required to complete update installation'
      });
      results.requiredActions.push('Schedule system restart');
    }

    return results;
  }

  private parseServiceOutput(output: string): ParsedScriptResults {
    const results: ParsedScriptResults = {
      type: 'service_management',
      findings: [],
      recommendations: [],
      requiredActions: []
    };

    // Parse service status
    const servicePatterns = [
      { pattern: /(.+)\s+service\s+(?:is\s+)?(running|stopped|started|failed)/gi, key: 'status' },
      { pattern: /Failed to (?:start|stop)\s+(.+)\s+service/gi, key: 'failure' }
    ];

    servicePatterns.forEach(({ pattern, key }) => {
      let match;
      while ((match = pattern.exec(output)) !== null) {
        if (key === 'failure') {
          results.findings.push({
            severity: 'error',
            issue: 'Service operation failed',
            details: match[0]
          });
          results.requiredActions.push(`Investigate ${match[1]} service issues`);
        } else {
          const serviceName = match[1];
          const status = match[2];
          results.findings.push({
            severity: status === 'failed' ? 'error' : 'info',
            issue: `Service ${status}`,
            details: `${serviceName} service is ${status}`
          });
        }
      }
    });

    return results;
  }

  private parseGenericOutput(output: string): ParsedScriptResults {
    const results: ParsedScriptResults = {
      type: 'generic',
      findings: [],
      recommendations: [],
      requiredActions: []
    };

    // Look for common patterns
    if (output.includes('ERROR') || output.includes('FAILED')) {
      results.findings.push({
        severity: 'error',
        issue: 'Script execution error',
        details: 'Script output contains error indicators'
      });
    }

    if (output.includes('WARNING')) {
      results.findings.push({
        severity: 'warning',
        issue: 'Script execution warning',
        details: 'Script output contains warnings'
      });
    }

    if (output.includes('SUCCESS') || output.includes('COMPLETED')) {
      results.findings.push({
        severity: 'info',
        issue: 'Script completed',
        details: 'Script execution completed successfully'
      });
    }

    return results;
  }

  private async updateTicketWithResults(ticketId: string, scriptOutput: ScriptOutput): Promise<void> {
    try {
      // Get the ticket
      const ticket = await this.ticketRepository.findOne({ where: { id: ticketId } });
      if (!ticket) {
        logger.error(`Ticket not found: ${ticketId}`);
        return;
      }

      // Build note content
      let noteContent = `**Automation Script Executed**\n\n`;
      noteContent += `Script: ${scriptOutput.scriptName}\n`;
      noteContent += `Device: ${scriptOutput.deviceName}\n`;
      noteContent += `Exit Code: ${scriptOutput.exitCode}\n`;
      noteContent += `Status: ${scriptOutput.success ? 'Success' : 'Failed'}\n\n`;

      if (scriptOutput.parsedResults) {
        noteContent += `**Findings:**\n`;
        scriptOutput.parsedResults.findings.forEach(finding => {
          noteContent += `- [${finding.severity.toUpperCase()}] ${finding.issue}: ${finding.details}\n`;
        });

        if (scriptOutput.parsedResults.recommendations.length > 0) {
          noteContent += `\n**Recommendations:**\n`;
          scriptOutput.parsedResults.recommendations.forEach(rec => {
            noteContent += `- ${rec}\n`;
          });
        }

        if (scriptOutput.parsedResults.requiredActions.length > 0) {
          noteContent += `\n**Required Actions:**\n`;
          scriptOutput.parsedResults.requiredActions.forEach(action => {
            noteContent += `- ${action}\n`;
          });
        }

        if (scriptOutput.parsedResults.metrics) {
          noteContent += `\n**Metrics:**\n`;
          Object.entries(scriptOutput.parsedResults.metrics).forEach(([key, value]) => {
            noteContent += `- ${key}: ${JSON.stringify(value)}\n`;
          });
        }
      }

      noteContent += `\n**Raw Output (truncated):**\n\`\`\`\n${scriptOutput.output.substring(0, 1000)}\n\`\`\`\n`;

      // Update ticket in ConnectWise if it has an external ID
      if (ticket.externalId) {
        await this.connectwiseService.addTicketNote(ticket.externalId, {
          text: noteContent,
          internalAnalysisFlag: true
        });
      }

      // Update ticket notes in our database
      const currentNotes = ticket.notes || [];
      currentNotes.push({
        id: `note-${Date.now()}`, // Generate unique ID
        timestamp: new Date(),
        author: 'Automation Engine',
        text: noteContent,
        type: 'automation'
      });
      ticket.notes = currentNotes;

      // Update ticket status based on results
      if (scriptOutput.success && scriptOutput.parsedResults) {
        const hasErrors = scriptOutput.parsedResults.findings.some(f => f.severity === 'error' || f.severity === 'critical');
        const hasRequiredActions = scriptOutput.parsedResults.requiredActions.length > 0;
        
        if (!hasErrors && !hasRequiredActions) {
          ticket.status = 'resolved' as any;
        } else if (hasRequiredActions) {
          ticket.status = 'pending' as any;
        }
      }

      await this.ticketRepository.save(ticket);
      logger.info(`Updated ticket ${ticketId} with script results`);
    } catch (error) {
      logger.error('Error updating ticket with script results:', error);
    }
  }

  private async sendNotifications(scriptOutput: ScriptOutput): Promise<void> {
    try {
      // Send Teams notification
      await this.teamsService.sendScriptExecutionResult(
        scriptOutput.deviceName,
        scriptOutput.scriptName,
        scriptOutput.output,
        scriptOutput.exitCode,
        scriptOutput.ticketId
      );

      // Send email notification if configured
      // await this.emailService.sendScriptResultEmail(scriptOutput);
    } catch (error) {
      logger.error('Error sending script notifications:', error);
    }
  }

  private async storeHistory(scriptOutput: ScriptOutput): Promise<void> {
    try {
      const history = this.historyRepository.create({
        ruleId: 'script-execution', // Placeholder rule ID
        ticketId: scriptOutput.ticketId,
        status: scriptOutput.success ? 'success' as any : 'failed' as any,
        executionSteps: [{
          action: scriptOutput.scriptName,
          startTime: scriptOutput.timestamp,
          endTime: scriptOutput.timestamp,
          status: scriptOutput.success ? 'success' as any : 'failed' as any,
          output: {
            executionId: scriptOutput.executionId,
            exitCode: scriptOutput.exitCode,
            parsedResults: scriptOutput.parsedResults
          },
          error: scriptOutput.success ? undefined : scriptOutput.output
        }],
        input: {
          deviceId: scriptOutput.deviceId,
          deviceName: scriptOutput.deviceName,
          scriptName: scriptOutput.scriptName
        },
        output: scriptOutput.parsedResults || {},
        errorMessage: scriptOutput.success ? null : scriptOutput.output.substring(0, 500),
        startedAt: scriptOutput.timestamp,
        completedAt: scriptOutput.timestamp,
        durationMs: 0
      });

      await this.historyRepository.save(history);
    } catch (error) {
      logger.error('Error storing script execution history:', error);
    }
  }

  // Execute remediation based on ticket type
  async executeRemediation(
    ticket: Ticket,
    deviceId: string,
    scriptType: string,
    parameters?: Record<string, any>
  ): Promise<ScriptOutput> {
    try {
      logger.info(`Executing ${scriptType} remediation for ticket ${ticket.ticketNumber}`);
      
      // Get device info
      const device = await this.nableService.getDevice(deviceId);
      
      // Execute the script
      const result = await this.nableService.runRemediationScript(
        deviceId,
        scriptType as any,
        undefined,
        parameters
      );

      // Wait for completion (poll for status)
      let executionResult = result;
      let attempts = 0;
      const maxAttempts = 60; // 5 minutes with 5-second intervals

      while (executionResult.status === 'Running' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
        executionResult = await this.nableService.getScriptExecutionStatus(executionResult.executionId);
        attempts++;
      }

      // Capture and process the output
      return await this.captureScriptOutput(executionResult, ticket.id, device.deviceName);
    } catch (error) {
      logger.error('Error executing remediation:', error);
      throw error;
    }
  }
}

