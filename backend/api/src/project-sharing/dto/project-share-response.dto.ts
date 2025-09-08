import { ShareAccessType, SharePermission } from '../entities/shared-project.entity';

export class ProjectShareResponseDto {
  id: string;
  shareId: string;
  shareUrl: string;
  customSlug?: string;
  projectId: string;
  projectName: string;
  workspaceId: string;
  workspaceName: string;
  accessType: ShareAccessType;
  permissions: SharePermission[];
  requireAuth: boolean;
  allowedEmails?: string[];
  expiresAt?: Date;
  settings?: {
    showOwnerInfo?: boolean;
    allowDownload?: boolean;
    allowQueryExecution?: boolean;
    allowAIUsage?: boolean;
    showWatermark?: boolean;
    customBranding?: {
      title?: string;
      description?: string;
      logoUrl?: string;
      primaryColor?: string;
    };
  };
  viewCount: number;
  uniqueViewers: number;
  lastAccessedAt?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class ProjectSharePreviewDto {
  shareId: string;
  customSlug?: string;
  projectName: string;
  projectDescription?: string;
  workspaceName: string;
  ownerName?: string;
  fileCount: number;
  totalSize: string;
  lastUpdated: Date;
  accessType: ShareAccessType;
  requireAuth: boolean;
  permissions: SharePermission[];
  settings?: {
    showOwnerInfo?: boolean;
    customBranding?: {
      title?: string;
      description?: string;
      logoUrl?: string;
      primaryColor?: string;
    };
  };
  files: ProjectFilePreviewDto[];
  isExpired: boolean;
  createdAt: Date;
}

export class ProjectFilePreviewDto {
  id: string;
  fileName: string;
  fileSize: string;
  mimeType: string;
  metadata?: {
    rowCount?: number;
    columnCount?: number;
    fileType?: string;
  };
  lastModified: Date;
}

export class ProjectShareAccessDto {
  shareId: string;
  accessGranted: boolean;
  message?: string;
  projectData?: {
    name: string;
    description?: string;
    files: {
      id: string;
      name: string;
      downloadUrl: string;
      metadata?: any;
    }[];
    permissions: SharePermission[];
  };
  expiresIn?: number;
}

export class ProjectShareAnalyticsDto {
  shareId: string;
  totalViews: number;
  uniqueViewers: number;
  viewsToday: number;
  viewsThisWeek: number;
  viewsThisMonth: number;
  topCountries: { country: string; views: number }[];
  recentActivity: {
    timestamp: Date;
    action: string;
    userEmail?: string;
    ipAddress?: string;
  }[];
}