import { AppDataSource } from '../database/dataSource';
import { Asset, AssetType, AssetStatus, AssetHistory, AssetRelationship } from '../entities/Asset';
import { logger } from '../utils/logger';
import { ConnectWiseService } from './connectwise/ConnectWiseService';
import { NableService } from './nable/NableService';
import { NableNsightService } from './nable/NableNsightService';
import { ApiCredential, ApiProvider } from '../entities/ApiCredential';
import { LessThan, MoreThan, Between, In, Like } from 'typeorm';

export interface AssetImportResult {
  imported: number;
  updated: number;
  failed: number;
  errors: string[];
}

export interface AssetSearchCriteria {
  type?: AssetType;
  status?: AssetStatus;
  clientId?: string;
  assignedTo?: string;
  searchTerm?: string;
  tags?: string[];
  warrantyExpiring?: boolean;
  maintenanceExpiring?: boolean;
  complianceIssues?: boolean;
}

export interface AssetMetrics {
  totalAssets: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  byClient: Record<string, number>;
  totalValue: number;
  depreciatedValue: number;
  warrantyExpiringCount: number;
  maintenanceExpiringCount: number;
  complianceIssues: number;
  utilizationMetrics: {
    avgCpuUtilization: number;
    avgMemoryUtilization: number;
    avgDiskUtilization: number;
  };
}

export class AssetInventoryService {
  private static instance: AssetInventoryService;
  private assetRepository = AppDataSource.getRepository(Asset);
  private historyRepository = AppDataSource.getRepository(AssetHistory);
  private relationshipRepository = AppDataSource.getRepository(AssetRelationship);
  private credentialRepository = AppDataSource.getRepository(ApiCredential);

  private constructor() {
    this.initializeAutoDiscovery();
  }

  public static getInstance(): AssetInventoryService {
    if (!AssetInventoryService.instance) {
      AssetInventoryService.instance = new AssetInventoryService();
    }
    return AssetInventoryService.instance;
  }

  private async initializeAutoDiscovery() {
    // Schedule periodic asset discovery from external sources
    setInterval(() => {
      this.discoverAssets().catch(error => {
        logger.error('Asset discovery failed:', error);
      });
    }, 4 * 60 * 60 * 1000); // Every 4 hours
  }

  async discoverAssets(): Promise<AssetImportResult> {
    const result: AssetImportResult = {
      imported: 0,
      updated: 0,
      failed: 0,
      errors: []
    };

    try {
      // Import from ConnectWise
      const cwResult = await this.importFromConnectWise();
      result.imported += cwResult.imported;
      result.updated += cwResult.updated;
      result.failed += cwResult.failed;
      result.errors.push(...cwResult.errors);

      // Import from N-able
      const nableResult = await this.importFromNable();
      result.imported += nableResult.imported;
      result.updated += nableResult.updated;
      result.failed += nableResult.failed;
      result.errors.push(...nableResult.errors);

      logger.info(`Asset discovery completed: ${result.imported} imported, ${result.updated} updated, ${result.failed} failed`);
    } catch (error) {
      logger.error('Asset discovery error:', error);
      result.errors.push(error.message);
    }

    return result;
  }

  private async importFromConnectWise(): Promise<AssetImportResult> {
    const result: AssetImportResult = {
      imported: 0,
      updated: 0,
      failed: 0,
      errors: []
    };

    try {
      const cwCredential = await this.credentialRepository.findOne({
        where: { provider: ApiProvider.CONNECTWISE, isActive: true }
      });

      if (!cwCredential) {
        result.errors.push('No active ConnectWise credentials found');
        return result;
      }

      // ConnectWise configuration import would go here
      // For now, creating sample assets for demo
      const sampleAssets = [
        {
          id: 'cw-001',
          name: 'Main Server',
          type: 'Server',
          status: 'Active',
          company: { id: '1', name: 'Acme Corp' },
          serialNumber: 'SRV-001-2023'
        },
        {
          id: 'cw-002',
          name: 'Backup Server',
          type: 'Server',
          status: 'Active',
          company: { id: '1', name: 'Acme Corp' },
          serialNumber: 'SRV-002-2023'
        }
      ];

      for (const config of sampleAssets) {
        try {
          let asset = await this.assetRepository.findOne({
            where: { externalId: `cw-${config.id}` }
          });

          const assetData = {
            name: config.name,
            description: `Imported from ConnectWise`,
            type: this.mapConfigurationType(config.type),
            status: config.status === 'Active' ? AssetStatus.ACTIVE : AssetStatus.INACTIVE,
            externalId: `cw-${config.id}`,
            clientId: config.company?.id?.toString(),
            clientName: config.company?.name,
            serialNumber: config.serialNumber,
            metadata: {
              connectwiseData: config,
              lastScanDate: new Date()
            }
          };

          if (asset) {
            // Update existing asset
            const oldData = { ...asset };
            Object.assign(asset, assetData);
            await this.assetRepository.save(asset);
            
            // Log history
            await this.logAssetHistory(asset.id, 'updated', this.getChanges(oldData, asset), 'system');
            result.updated++;
          } else {
            // Create new asset
            asset = this.assetRepository.create(assetData);
            await this.assetRepository.save(asset);
            
            // Log history
            await this.logAssetHistory(asset.id, 'created', {}, 'system');
            result.imported++;
          }
        } catch (error) {
          logger.error(`Failed to import asset ${config.id}:`, error);
          result.failed++;
          result.errors.push(`Asset ${config.id}: ${error.message}`);
        }
      }
    } catch (error) {
      logger.error('ConnectWise import error:', error);
      result.errors.push(`ConnectWise: ${error.message}`);
    }

    return result;
  }

  private async importFromNable(): Promise<AssetImportResult> {
    const result: AssetImportResult = {
      imported: 0,
      updated: 0,
      failed: 0,
      errors: []
    };

    try {
      const nableCredential = await this.credentialRepository.findOne({
        where: { provider: ApiProvider.NABLE, isActive: true }
      });

      if (!nableCredential) {
        result.errors.push('No active N-able credentials found');
        return result;
      }

      // Determine if using N-able RMM or N-sight
      const isNsight = !nableCredential.credentials.apiSecret;
      
      let devices: any[] = [];
      
      if (isNsight) {
        const nsightService = NableNsightService.getInstance(
          nableCredential.credentials.apiKey,
          nableCredential.credentials.apiUrl
        );
        devices = await nsightService.listAllDevices();
      } else {
        const nableService = NableService.getInstance();
        devices = await nableService.getDevices();
      }

      for (const device of devices) {
        try {
          let asset = await this.assetRepository.findOne({
            where: { externalId: `nable-${device.id || device.device_id}` }
          });

          const deviceType = this.mapDeviceType(device.device_type || device.type);
          
          const assetData = {
            name: device.name || device.device_name,
            description: device.description,
            type: deviceType,
            status: device.online || device.status === 'online' ? AssetStatus.ACTIVE : AssetStatus.INACTIVE,
            externalId: `nable-${device.id || device.device_id}`,
            clientId: device.client_id || device.customer?.id,
            clientName: device.client_name || device.customer?.name,
            specifications: {
              operatingSystem: device.os || device.operating_system,
              cpu: device.cpu_info,
              memory: device.memory_total ? `${device.memory_total} GB` : undefined,
              storage: device.disk_total ? `${device.disk_total} GB` : undefined,
              ipAddress: device.ip_address || device.ip,
              hostname: device.hostname,
              manufacturer: device.manufacturer,
              model: device.model
            },
            monitoring: {
              isMonitored: true,
              lastSeen: device.last_seen ? new Date(device.last_seen) : new Date(),
              uptime: device.uptime,
              utilizationCpu: device.cpu_usage,
              utilizationMemory: device.memory_usage,
              utilizationDisk: device.disk_usage
            },
            metadata: {
              nableData: device,
              lastScanDate: new Date(),
              riskLevel: this.calculateRiskLevel(device)
            }
          };

          if (asset) {
            // Update existing asset
            const oldData = { ...asset };
            Object.assign(asset, assetData);
            await this.assetRepository.save(asset);
            
            // Log history
            await this.logAssetHistory(asset.id, 'updated', this.getChanges(oldData, asset), 'system');
            result.updated++;
          } else {
            // Create new asset
            asset = this.assetRepository.create(assetData);
            await this.assetRepository.save(asset);
            
            // Log history
            await this.logAssetHistory(asset.id, 'created', {}, 'system');
            result.imported++;
          }

          // Update monitoring data
          await this.updateMonitoringData(asset, device);
        } catch (error) {
          logger.error(`Failed to import device ${device.id}:`, error);
          result.failed++;
          result.errors.push(`Device ${device.id}: ${error.message}`);
        }
      }
    } catch (error) {
      logger.error('N-able import error:', error);
      result.errors.push(`N-able: ${error.message}`);
    }

    return result;
  }

  private mapConfigurationType(typeName?: string): AssetType {
    if (!typeName) return AssetType.OTHER;
    
    const typeMap: Record<string, AssetType> = {
      'server': AssetType.SERVER,
      'workstation': AssetType.WORKSTATION,
      'laptop': AssetType.LAPTOP,
      'network': AssetType.NETWORK_DEVICE,
      'printer': AssetType.PRINTER,
      'mobile': AssetType.MOBILE_DEVICE,
      'software': AssetType.SOFTWARE,
      'vm': AssetType.VIRTUAL_MACHINE,
      'virtual': AssetType.VIRTUAL_MACHINE,
      'cloud': AssetType.CLOUD_RESOURCE
    };

    const lowerType = typeName.toLowerCase();
    for (const [key, value] of Object.entries(typeMap)) {
      if (lowerType.includes(key)) {
        return value;
      }
    }

    return AssetType.OTHER;
  }

  private mapDeviceType(deviceType?: string): AssetType {
    if (!deviceType) return AssetType.OTHER;

    const typeMap: Record<string, AssetType> = {
      'windows_server': AssetType.SERVER,
      'windows_workstation': AssetType.WORKSTATION,
      'mac': AssetType.WORKSTATION,
      'linux': AssetType.SERVER,
      'network_device': AssetType.NETWORK_DEVICE,
      'printer': AssetType.PRINTER,
      'mobile': AssetType.MOBILE_DEVICE
    };

    return typeMap[deviceType.toLowerCase()] || AssetType.OTHER;
  }

  private calculateRiskLevel(device: any): 'low' | 'medium' | 'high' | 'critical' {
    let riskScore = 0;

    // Check patch status
    if (device.patches_missing > 10) riskScore += 3;
    else if (device.patches_missing > 5) riskScore += 2;
    else if (device.patches_missing > 0) riskScore += 1;

    // Check antivirus status
    if (!device.antivirus_installed) riskScore += 2;
    if (device.antivirus_out_of_date) riskScore += 1;

    // Check backup status
    const lastBackup = device.last_backup ? new Date(device.last_backup) : null;
    if (!lastBackup || (Date.now() - lastBackup.getTime()) > 7 * 24 * 60 * 60 * 1000) {
      riskScore += 2;
    }

    // Check uptime (potential for missed updates)
    if (device.uptime > 30 * 24 * 60 * 60) riskScore += 1; // > 30 days

    // Determine risk level
    if (riskScore >= 7) return 'critical';
    if (riskScore >= 5) return 'high';
    if (riskScore >= 3) return 'medium';
    return 'low';
  }

  private async updateMonitoringData(asset: Asset, deviceData: any) {
    // Update real-time monitoring data
    asset.monitoring = {
      isMonitored: true,
      lastSeen: new Date(),
      uptime: deviceData.uptime,
      utilizationCpu: deviceData.cpu_usage,
      utilizationMemory: deviceData.memory_usage,
      utilizationDisk: deviceData.disk_usage,
      alerts: []
    };

    // Add any active alerts
    if (deviceData.alerts && Array.isArray(deviceData.alerts)) {
      asset.monitoring.alerts = deviceData.alerts.map((alert: any) => ({
        id: alert.id,
        type: alert.type,
        severity: alert.severity,
        message: alert.message,
        timestamp: new Date(alert.timestamp)
      }));
    }

    await this.assetRepository.save(asset);
  }

  private getChanges(oldData: any, newData: any): Record<string, any> {
    const changes: Record<string, any> = {};
    
    for (const key in newData) {
      if (oldData[key] !== newData[key]) {
        changes[key] = {
          old: oldData[key],
          new: newData[key]
        };
      }
    }
    
    return changes;
  }

  private async logAssetHistory(
    assetId: string,
    action: string,
    changes: Record<string, any>,
    userId: string,
    notes?: string
  ) {
    const history = this.historyRepository.create({
      assetId,
      action,
      changes,
      userId,
      notes
    });

    await this.historyRepository.save(history);
  }

  // Public methods for asset management

  async createAsset(data: Partial<Asset>, userId: string): Promise<Asset> {
    const asset = this.assetRepository.create(data);
    await this.assetRepository.save(asset);
    
    await this.logAssetHistory(asset.id, 'created', {}, userId);
    
    return asset;
  }

  async updateAsset(id: string, data: Partial<Asset>, userId: string): Promise<Asset> {
    const asset = await this.assetRepository.findOne({ where: { id } });
    if (!asset) {
      throw new Error('Asset not found');
    }

    const oldData = { ...asset };
    Object.assign(asset, data);
    await this.assetRepository.save(asset);
    
    await this.logAssetHistory(asset.id, 'updated', this.getChanges(oldData, asset), userId);
    
    return asset;
  }

  async deleteAsset(id: string, userId: string): Promise<void> {
    const asset = await this.assetRepository.findOne({ where: { id } });
    if (!asset) {
      throw new Error('Asset not found');
    }

    await this.logAssetHistory(asset.id, 'deleted', {}, userId);
    await this.assetRepository.delete(id);
  }

  async getAsset(id: string): Promise<Asset | null> {
    return await this.assetRepository.findOne({ where: { id } });
  }

  async searchAssets(criteria: AssetSearchCriteria): Promise<Asset[]> {
    const query = this.assetRepository.createQueryBuilder('asset');

    if (criteria.type) {
      query.andWhere('asset.type = :type', { type: criteria.type });
    }

    if (criteria.status) {
      query.andWhere('asset.status = :status', { status: criteria.status });
    }

    if (criteria.clientId) {
      query.andWhere('asset.clientId = :clientId', { clientId: criteria.clientId });
    }

    if (criteria.assignedTo) {
      query.andWhere('asset.assignedTo = :assignedTo', { assignedTo: criteria.assignedTo });
    }

    if (criteria.searchTerm) {
      query.andWhere(
        '(asset.name ILIKE :term OR asset.description ILIKE :term OR asset.assetTag ILIKE :term)',
        { term: `%${criteria.searchTerm}%` }
      );
    }

    if (criteria.warrantyExpiring) {
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      query.andWhere('asset.warrantyExpiration <= :date', { date: thirtyDaysFromNow });
    }

    if (criteria.maintenanceExpiring) {
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      query.andWhere('asset.maintenanceExpiration <= :date', { date: thirtyDaysFromNow });
    }

    if (criteria.tags && criteria.tags.length > 0) {
      query.andWhere(`asset.metadata->>'tags' ?| array[:...tags]`, { tags: criteria.tags });
    }

    return await query.getMany();
  }

  async getAssetMetrics(): Promise<AssetMetrics> {
    const assets = await this.assetRepository.find();
    
    const metrics: AssetMetrics = {
      totalAssets: assets.length,
      byType: {},
      byStatus: {},
      byClient: {},
      totalValue: 0,
      depreciatedValue: 0,
      warrantyExpiringCount: 0,
      maintenanceExpiringCount: 0,
      complianceIssues: 0,
      utilizationMetrics: {
        avgCpuUtilization: 0,
        avgMemoryUtilization: 0,
        avgDiskUtilization: 0
      }
    };

    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    let cpuTotal = 0, memoryTotal = 0, diskTotal = 0;
    let monitoredCount = 0;

    for (const asset of assets) {
      // Count by type
      metrics.byType[asset.type] = (metrics.byType[asset.type] || 0) + 1;
      
      // Count by status
      metrics.byStatus[asset.status] = (metrics.byStatus[asset.status] || 0) + 1;
      
      // Count by client
      if (asset.clientName) {
        metrics.byClient[asset.clientName] = (metrics.byClient[asset.clientName] || 0) + 1;
      }
      
      // Financial metrics
      if (asset.purchasePrice) {
        metrics.totalValue += Number(asset.purchasePrice);
      }
      
      if (asset.financial?.currentValue) {
        metrics.depreciatedValue += Number(asset.financial.currentValue);
      }
      
      // Expiring warranties/maintenance
      if (asset.warrantyExpiration && asset.warrantyExpiration <= thirtyDaysFromNow) {
        metrics.warrantyExpiringCount++;
      }
      
      if (asset.maintenanceExpiration && asset.maintenanceExpiration <= thirtyDaysFromNow) {
        metrics.maintenanceExpiringCount++;
      }
      
      // Compliance issues
      if (asset.compliance?.violations && asset.compliance.violations.length > 0) {
        metrics.complianceIssues++;
      }
      
      // Utilization metrics
      if (asset.monitoring?.isMonitored) {
        if (asset.monitoring.utilizationCpu) {
          cpuTotal += asset.monitoring.utilizationCpu;
        }
        if (asset.monitoring.utilizationMemory) {
          memoryTotal += asset.monitoring.utilizationMemory;
        }
        if (asset.monitoring.utilizationDisk) {
          diskTotal += asset.monitoring.utilizationDisk;
        }
        monitoredCount++;
      }
    }

    // Calculate averages
    if (monitoredCount > 0) {
      metrics.utilizationMetrics.avgCpuUtilization = cpuTotal / monitoredCount;
      metrics.utilizationMetrics.avgMemoryUtilization = memoryTotal / monitoredCount;
      metrics.utilizationMetrics.avgDiskUtilization = diskTotal / monitoredCount;
    }

    return metrics;
  }

  async getAssetHistory(assetId: string): Promise<AssetHistory[]> {
    return await this.historyRepository.find({
      where: { assetId },
      order: { timestamp: 'DESC' }
    });
  }

  async createAssetRelationship(
    parentAssetId: string,
    childAssetId: string,
    relationshipType: string,
    description?: string
  ): Promise<AssetRelationship> {
    const relationship = this.relationshipRepository.create({
      parentAssetId,
      childAssetId,
      relationshipType,
      description
    });

    return await this.relationshipRepository.save(relationship);
  }

  async getAssetRelationships(assetId: string): Promise<AssetRelationship[]> {
    return await this.relationshipRepository.find({
      where: [
        { parentAssetId: assetId },
        { childAssetId: assetId }
      ]
    });
  }

  async generateAssetReport(format: 'csv' | 'json' | 'pdf'): Promise<Buffer> {
    const assets = await this.assetRepository.find();
    
    // Implement report generation based on format
    // This would create CSV, JSON, or PDF reports
    // For now, returning JSON
    
    const report = {
      generatedAt: new Date(),
      totalAssets: assets.length,
      assets: assets.map(asset => ({
        id: asset.id,
        name: asset.name,
        type: asset.type,
        status: asset.status,
        clientName: asset.clientName,
        assetTag: asset.assetTag,
        purchasePrice: asset.purchasePrice,
        warrantyExpiration: asset.warrantyExpiration
      }))
    };

    return Buffer.from(JSON.stringify(report, null, 2));
  }
}
