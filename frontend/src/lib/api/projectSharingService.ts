import { apiClient } from './apiClient';

export enum ShareAccessType {
  PUBLIC = 'public',
  AUTHENTICATED = 'authenticated',
  EMAIL_LIST = 'email_list',
}

export enum SharePermission {
  VIEW = 'view',
  QUERY = 'query',
  AI = 'ai',
  EXPORT = 'export',
}

export interface CreateProjectShareDto {
  projectId: string;
  customSlug?: string;
  accessType?: ShareAccessType;
  allowedEmails?: string[];
  requireAuth?: boolean;
  permissions?: SharePermission[];
  expiresAt?: string;
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
}

export interface UpdateProjectShareDto extends Partial<CreateProjectShareDto> {
  isActive?: boolean;
}

export interface ProjectShare {
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

export interface ProjectSharePreview {
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
  files: {
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
  }[];
  isExpired: boolean;
  createdAt: Date;
}

export interface ProjectShareAccess {
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

export interface ProjectShareAnalytics {
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

class ProjectSharingService {
  /**
   * Create a new project share
   */
  async createProjectShare(dto: CreateProjectShareDto): Promise<ProjectShare> {
    const response = await apiClient.post<ProjectShare>(
      '/project-sharing/share',
      dto
    );
    return response.data;
  }

  /**
   * Get project share preview (public)
   */
  async getProjectSharePreview(identifier: string): Promise<ProjectSharePreview> {
    const response = await apiClient.get<ProjectSharePreview>(
      `/project-sharing/preview/${identifier}`
    );
    return response.data;
  }

  /**
   * Access a shared project
   */
  async accessSharedProject(identifier: string): Promise<ProjectShareAccess> {
    const response = await apiClient.post<ProjectShareAccess>(
      `/project-sharing/access/${identifier}`
    );
    return response.data;
  }

  /**
   * Update project share
   */
  async updateProjectShare(
    shareId: string, 
    dto: UpdateProjectShareDto
  ): Promise<ProjectShare> {
    const response = await apiClient.put<ProjectShare>(
      `/project-sharing/share/${shareId}`,
      dto
    );
    return response.data;
  }

  /**
   * Delete project share
   */
  async deleteProjectShare(shareId: string): Promise<void> {
    await apiClient.delete(`/project-sharing/share/${shareId}`);
  }

  /**
   * Get user's project shares
   */
  async getUserProjectShares(): Promise<ProjectShare[]> {
    const response = await apiClient.get<ProjectShare[]>(
      '/project-sharing/my-shares'
    );
    return response.data;
  }

  /**
   * Get project share analytics
   */
  async getProjectShareAnalytics(shareId: string): Promise<ProjectShareAnalytics> {
    const response = await apiClient.get<ProjectShareAnalytics>(
      `/project-sharing/share/${shareId}/analytics`
    );
    return response.data;
  }

  /**
   * Check if custom slug is available
   */
  async checkSlugAvailability(slug: string): Promise<{ available: boolean; message?: string }> {
    const response = await apiClient.get<{ available: boolean; message?: string }>(
      `/project-sharing/check-slug/${slug}`
    );
    return response.data;
  }

  /**
   * Copy share link to clipboard
   */
  async copyShareLink(shareUrl: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = shareUrl;
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  }

  /**
   * Generate QR code for share URL
   */
  generateQRCodeUrl(shareUrl: string, size: number = 200): string {
    const encoded = encodeURIComponent(shareUrl);
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}`;
  }
}

export const projectSharingService = new ProjectSharingService();