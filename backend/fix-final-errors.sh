#!/bin/bash
# Script to fix final TypeScript build errors

echo "Fixing final backend build errors..."

# Fix NotificationPayload type issues - remove 'type' properties
sed -i "s/type: 'escalation',//g" src/services/BoardManagementService.ts
sed -i "s/type: 'assignment',//g" src/services/BoardManagementService.ts
sed -i "s/type: 'escalation',//g" src/services/EscalationService.ts
sed -i "s/type: 'assignment',//g" src/services/EscalationService.ts

# Fix ScriptOutputBridge issues
sed -i "s/executionResult\.success ? 'Completed' : 'Failed' === 'Completed'/executionResult.success === true/g" src/services/automation/ScriptOutputBridge.ts
sed -i "s/executionResult\.success ? 'Completed' : 'Failed' === 'Running'/false/g" src/services/automation/ScriptOutputBridge.ts

# Fix boolean assignment
sed -i "s/success: executionResult\.success ? 'Completed' : 'Failed' === 'Completed' && (executionResult\.exitCode === 0)/success: executionResult.success === true/g" src/services/automation/ScriptOutputBridge.ts

# Fix EscalationService teams call
sed -i "s/await this\.teamsService\.sendMessage/await this.teamsService.sendEscalationNotification/g" src/services/EscalationService.ts

# Fix ConnectWise update call
sed -i "s/assignedToId/op: 'replace', path: '\/board\/id', value/g" src/services/EscalationService.ts

echo "Final error fixes applied!"
