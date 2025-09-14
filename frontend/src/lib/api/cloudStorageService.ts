import { apiClient } from './apiClient';
import { 
  CloudProject, 
  CloudFile, 
  CloudStorageStats,
  WorkspaceType,
} from '@/store/cloudStore';

export interface CreateCloudProjectDto {
  name: string;
  description?: string;
  type?: WorkspaceType;
  settings?: {
    autoSync?: boolean;
    versioningEnabled?: boolean;
    defaultFileFormat?: string;
  };
  isDefault?: boolean;
}

export interface SaveToCloudDto {
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

export interface CloudUploadResponse {
  file: CloudFile;
  project: any;
  storageStats: CloudStorageStats;
}

export interface CloudAccessData {
  fileId: string;
  downloadUrl: string;
  fileName: string;
  mimeType: string;
  compressed: boolean;
  expiresIn: number;
}

class CloudStorageService {
  /**
   * Create a new cloud project in current workspace
   */
  async createCloudProject(workspaceId: string, dto: CreateCloudProjectDto): Promise<CloudProject> {
    const response = await apiClient.post(`/cloud-storage/workspace/${workspaceId}/project`, dto);
    return response;
  }

  /**
   * Get user's accessible cloud projects
   */
  async getUserProjects(): Promise<CloudProject[]> {
    const response = await apiClient.get('/cloud-storage/projects');
    return response;
  }

  /**
   * Get projects in a specific workspace
   */
  async getWorkspaceProjects(workspaceId: string): Promise<CloudProject[]> {
    const response = await apiClient.get(`/cloud-storage/workspace/${workspaceId}/projects`);
    return response;
  }

  /**
   * Upload file to cloud
   */
  async uploadToCloud(
    file: File,
    dto: SaveToCloudDto,
    onProgress?: (progress: number) => void,
  ): Promise<CloudUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('projectId', dto.projectId);
    
    if (dto.fileName) {
      formData.append('fileName', dto.fileName);
    }
    if (dto.metadata) {
      formData.append('metadata', JSON.stringify(dto.metadata));
    }
    if (dto.replaceIfExists !== undefined) {
      formData.append('replaceIfExists', dto.replaceIfExists.toString());
    }
    if (dto.keepVersionHistory !== undefined) {
      formData.append('keepVersionHistory', dto.keepVersionHistory.toString());
    }

    // Debug logging
    console.log('CloudStorage upload:', {
      file: file.name,
      size: file.size,
      projectId: dto.projectId,
      metadata: dto.metadata,
    });

    console.log('FormData contents:');
    for (const [key, value] of formData.entries()) {
      console.log(`${key}:`, value);
    }

    try {
      const response = await apiClient.uploadFormData('/cloud-storage/upload', formData, {
        onUploadProgress: onProgress,
      });
      console.log('Upload response:', response);
      return response;
    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    }
  }

  /**
   * Get files in a specific project
   */
  async getProjectFiles(projectId: string): Promise<CloudFile[]> {
    const response = await apiClient.get(`/cloud-storage/project/${projectId}/files`);
    return response;
  }

  /**
   * Get all user's cloud files
   */
  async getAllUserFiles(): Promise<CloudFile[]> {
    const response = await apiClient.get('/cloud-storage/files');
    return response;
  }

  /**
   * Get file access/download URL
   */
  async getFileAccess(fileId: string): Promise<CloudAccessData> {
    const response = await apiClient.post(`/cloud-storage/file/${fileId}/access`);
    return response;
  }

  /**
   * Delete file from cloud
   */
  async deleteFile(fileId: string): Promise<void> {
    await apiClient.delete(`/cloud-storage/file/${fileId}`);
  }

  /**
   * Get user's storage statistics across all workspaces
   */
  async getStorageStats(): Promise<CloudStorageStats> {
    const response = await apiClient.get('/cloud-storage/stats');
    return response;
  }

  /**
   * Get workspace-specific storage statistics
   */
  async getWorkspaceStorageStats(workspaceId: string): Promise<CloudStorageStats> {
    const response = await apiClient.get(`/cloud-storage/workspace/${workspaceId}/stats`);
    return response;
  }

  /**
   * Rename/update project
   */
  async renameCloudProject(projectId: string, name: string): Promise<CloudProject> {
    const response = await apiClient.patch(`/cloud-storage/project/${projectId}`, { name });
    return response;
  }

  /**
   * Delete cloud project (and all its files)
   */
  async deleteCloudProject(projectId: string): Promise<void> {
    await apiClient.delete(`/cloud-storage/project/${projectId}`);
  }

  /**
   * Delete project (and all its files)
   * @deprecated Use deleteCloudProject instead
   */
  async deleteProject(projectId: string): Promise<void> {
    await apiClient.delete(`/cloud-storage/project/${projectId}`);
  }
}

export const cloudStorageService = new CloudStorageService();