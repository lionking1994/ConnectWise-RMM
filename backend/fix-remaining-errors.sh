#!/bin/bash
# Script to fix remaining TypeScript build errors

echo "Fixing remaining backend build errors..."

# Add missing properties to AlertThreshold entity
cat << 'EOF' >> src/entities/AlertThreshold.ts

  @Column('simple-array', { nullable: true })
  notificationRecipients: string[];

  @Column({ default: false })
  autoEscalate: boolean;

  @Column({ default: 5 })
  escalationDelay: number;

  @Column({ default: 3 })
  escalationThreshold: number;

  @Column({ default: false })
  createTicket: boolean;
EOF

# Add EscalationLevel enum to AlertThreshold if not exists
if ! grep -q "export enum EscalationLevel" src/entities/AlertThreshold.ts; then
  sed -i '1i\
export enum EscalationLevel {\
  L1 = "L1",\
  L2 = "L2",\
  L3 = "L3",\
  MANAGER = "MANAGER"\
}\
' src/entities/AlertThreshold.ts
fi

# Add missing properties to Asset entity
if ! grep -q "monitoring" src/entities/Asset.ts; then
  cat << 'EOF' >> src/entities/Asset.ts

  @Column('jsonb', { nullable: true })
  monitoring: any;

  @Column('jsonb', { nullable: true })
  compliance: any;

  @Column('jsonb', { nullable: true })
  financial: any;

  @Column({ nullable: true })
  clientName: string;

  @Column({ nullable: true })
  assetTag: string;

  @Column({ type: 'decimal', nullable: true })
  purchasePrice: number;

  @Column({ nullable: true })
  maintenanceExpiration: Date;
EOF
fi

# Add externalId to Ticket entity if not exists
if ! grep -q "externalId" src/entities/Ticket.ts; then
  sed -i '/ticketNumber.*{/a\
  @Column({ nullable: true })\
  externalId: string;\
' src/entities/Ticket.ts
fi

# Add boardId to Ticket entity if not exists
if ! grep -q "boardId" src/entities/Ticket.ts; then
  sed -i '/source.*TicketSource/a\
  @Column({ nullable: true })\
  boardId: string;\
' src/entities/Ticket.ts
fi

echo "Entity updates complete!"
