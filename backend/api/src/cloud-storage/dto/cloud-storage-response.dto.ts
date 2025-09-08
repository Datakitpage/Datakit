import { CloudFileStatus } from '../entities/cloud-file.entity';
import { ProjectType } from '../entities/cloud-project.entity';

export class CloudProjectDto {
  id: string;
  name: string;
  description?: string;
  type: ProjectType;
  storageUsed: string;
  fileCount: number;
  settings?: {
    autoSync?: boolean;
    versioningEnabled?: boolean;
    defaultFileFormat?: string;
  };
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class CloudFileDto {
  id: string;
  projectId: string;
  fileName: string;
  originalName: string;
  fileSize: string;
  compressedSize?: string;
  mimeType: string;
  status: CloudFileStatus;
  metadata?: {
    rowCount?: number;
    columnCount?: number;
    fileType?: string;
    compressed?: boolean;
  };
  isShared: boolean;
  sharedFileId?: string;
  lastAccessedAt?: Date;
  lastSyncedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class CloudStorageStatsDto {
  totalStorageUsed: string;
  storageLimit: string;
  storagePercentage: number;
  totalFiles: number;
  totalProjects: number;
  plan: string;
}

export class SaveToCloudDto {
  projectId: string;
  fileName?: string;
  metadata?: {
    rowCount?: number;
    columnCount?: number;
    fileType?: string;
    tableName?: string;
  };
  replaceIfExists?: boolean;
  keepVersionHistory?: boolean;
}

export class CloudUploadResponseDto {
  file: CloudFileDto;
  project: CloudProjectDto;
  storageStats: CloudStorageStatsDto;
}

export class CloudAccessDto {
  fileId: string;
  downloadUrl: string;
  fileName: string;
  mimeType: string;
  compressed: boolean;
  expiresIn: number;
}