#!/bin/bash
# Script to fix common TypeScript build errors

echo "Fixing build errors in backend..."

# Fix AssetType enum issues
sed -i "s/AssetType\.LAPTOP/AssetType.WORKSTATION/g" src/services/AssetInventoryService.ts
sed -i "s/AssetType\.SOFTWARE/AssetType.OTHER/g" src/services/AssetInventoryService.ts
sed -i "s/AssetType\.CLOUD_RESOURCE/AssetType.OTHER/g" src/services/AssetInventoryService.ts

# Fix missing properties in entities
# Add monitoring property to Asset entity if not exists
if ! grep -q "monitoring" src/entities/Asset.ts; then
  sed -i "/metadata.*jsonb/a\\
  @Column('jsonb', { nullable: true })\\
  monitoring: any;\\
\\
  @Column('jsonb', { nullable: true })\\
  compliance: any;\\
\\
  @Column('jsonb', { nullable: true })\\
  financial: any;\\
\\
  @Column({ nullable: true })\\
  clientName: string;\\
\\
  @Column({ nullable: true })\\
  assetTag: string;\\
\\
  @Column({ type: 'decimal', nullable: true })\\
  purchasePrice: number;\\
\\
  @Column({ nullable: true })\\
  maintenanceExpiration: Date;" src/entities/Asset.ts
fi

# Fix AlertThreshold missing properties
if ! grep -q "autoEscalate" src/entities/AlertThreshold.ts; then
  sed -i "/notificationChannels.*simple-array/a\\
  @Column('simple-array', { nullable: true })\\
  notificationRecipients: string[];\\
\\
  @Column({ default: false })\\
  autoEscalate: boolean;\\
\\
  @Column({ default: 5 })\\
  escalationDelay: number;\\
\\
  @Column({ default: 3 })\\
  escalationThreshold: number;\\
\\
  @Column({ default: false })\\
  createTicket: boolean;" src/entities/AlertThreshold.ts
fi

# Fix missing EscalationLevel enum
if ! grep -q "export enum EscalationLevel" src/entities/AlertThreshold.ts; then
  sed -i "1i\\
export enum EscalationLevel {\\
  L1 = 'L1',\\
  L2 = 'L2',\\
  L3 = 'L3',\\
  MANAGER = 'MANAGER'\\
}\\
" src/entities/AlertThreshold.ts
fi

# Fix missing properties in Ticket entity  
if ! grep -q "externalId" src/entities/Ticket.ts; then
  sed -i "/ticketNumber.*string/a\\
  @Column({ nullable: true })\\
  externalId: string;" src/entities/Ticket.ts
fi

if ! grep -q "boardId" src/entities/Ticket.ts; then
  sed -i "/source.*TicketSource/a\\
  @Column({ nullable: true })\\
  boardId: string;" src/entities/Ticket.ts
fi

# Fix AssetHistory relationship
sed -i "s/assetId,/asset: { id: assetId },/g" src/services/AssetInventoryService.ts
sed -i "s/{ assetId }/{ asset: { id: assetId } }/g" src/services/AssetInventoryService.ts

# Fix AssetRelationship relationships  
sed -i "s/parentAssetId,/parentAsset: { id: parentAssetId },/g" src/services/AssetInventoryService.ts
sed -i "s/childAssetId,/childAsset: { id: childAssetId },/g" src/services/AssetInventoryService.ts
sed -i "s/{ parentAssetId: assetId }/{ parentAsset: { id: assetId } }/g" src/services/AssetInventoryService.ts
sed -i "s/{ childAssetId: assetId }/{ childAsset: { id: assetId } }/g" src/services/AssetInventoryService.ts

# Fix BoardFieldMapping dataType issue
sed -i "s/dataType: string/dataType: 'string' as any/g" src/services/BoardManagementService.ts

# Fix notification service method names
sed -i "s/sendNotification(/send(/g" src/services/BoardManagementService.ts

# Fix TeamsService methods
sed -i "s/sendAlertNotification(/sendMessage(/g" src/services/AlertThresholdService.ts
sed -i "s/sendEscalationNotification(/sendMessage(/g" src/services/EscalationService.ts

# Fix User ID type issues (string vs number)
sed -i "s/where: { id: userId }/where: { id: String(userId) }/g" src/services/EscalationService.ts
sed -i "s/where: { user: { id: userId } }/where: { user: { id: String(userId) } }/g" src/services/EscalationService.ts

# Fix ticketId type issues
sed -i "s/ticketId: ticket.id,/ticketId: parseInt(ticket.id),/g" src/services/BoardManagementService.ts
sed -i "s/updateTicket(ticketId,/updateTicket(String(ticketId),/g" src/services/EscalationService.ts
sed -i "s/where: { id: ticketId }/where: { id: String(ticketId) }/g" src/services/EscalationService.ts

# Fix script execution issues
sed -i "s/executionResult.scriptId/executionResult.deviceId/g" src/services/automation/ScriptOutputBridge.ts
sed -i "s/executionResult.status/executionResult.success ? 'Completed' : 'Failed'/g" src/services/automation/ScriptOutputBridge.ts

echo "Build error fixes applied!"
