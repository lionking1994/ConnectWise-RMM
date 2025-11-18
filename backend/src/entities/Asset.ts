import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany } from 'typeorm';

export enum AssetType {
  WORKSTATION = 'workstation',
  SERVER = 'server',
  NETWORK_DEVICE = 'network_device',
  VIRTUAL_MACHINE = 'virtual_machine',
  MOBILE_DEVICE = 'mobile_device',
  PRINTER = 'printer',
  OTHER = 'other'
}

export enum AssetStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  MAINTENANCE = 'maintenance',
  RETIRED = 'retired',
  DISPOSED = 'disposed'
}

@Entity('assets')
export class Asset {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'enum', enum: AssetType })
  type: AssetType;

  @Column({ type: 'enum', enum: AssetStatus, default: AssetStatus.ACTIVE })
  status: AssetStatus;

  @Column({ nullable: true })
  serialNumber?: string;

  @Column({ nullable: true })
  manufacturer?: string;

  @Column({ nullable: true })
  model?: string;

  @Column({ nullable: true })
  location?: string;

  @Column({ nullable: true })
  department?: string;

  @Column({ nullable: true })
  assignedTo?: string;

  @Column({ nullable: true })
  purchaseDate?: Date;

  @Column({ nullable: true })
  warrantyExpiration?: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  cost?: number;

  @Column({ type: 'jsonb', nullable: true })
  specifications?: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  networkInfo?: {
    ipAddress?: string;
    macAddress?: string;
    hostname?: string;
    domain?: string;
  };

  @Column({ type: 'jsonb', nullable: true })
  softwareInventory?: Array<{
    name: string;
    version: string;
    vendor: string;
    installDate?: Date;
  }>;

  @Column({ type: 'jsonb', nullable: true })
  metrics?: {
    cpuUtilization?: number;
    memoryUtilization?: number;
    diskUtilization?: number;
    lastSeen?: Date;
    uptime?: number;
  };

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @Column({ nullable: true })
  externalId?: string;

  @Column({ nullable: true })
  connectwiseId?: string;

  @Column({ nullable: true })
  nableDeviceId?: string;

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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  lastSyncedAt?: Date;

  @OneToMany(() => AssetHistory, history => history.asset)
  history: AssetHistory[];

  @OneToMany(() => AssetRelationship, relationship => relationship.parentAsset)
  childRelationships: AssetRelationship[];

  @OneToMany(() => AssetRelationship, relationship => relationship.childAsset)
  parentRelationships: AssetRelationship[];
}

@Entity('asset_history')
export class AssetHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Asset, asset => asset.history)
  asset: Asset;

  @Column()
  action: string;

  @Column({ type: 'jsonb', nullable: true })
  changes?: Record<string, any>;

  @Column({ nullable: true })
  performedBy?: string;

  @Column({ nullable: true })
  notes?: string;

  @CreateDateColumn()
  timestamp: Date;
}

@Entity('asset_relationships')
export class AssetRelationship {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Asset, asset => asset.childRelationships)
  parentAsset: Asset;

  @ManyToOne(() => Asset, asset => asset.parentRelationships)
  childAsset: Asset;

  @Column()
  relationshipType: string; // e.g., 'contains', 'depends_on', 'connected_to'

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

export default Asset;