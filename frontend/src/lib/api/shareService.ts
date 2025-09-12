import { apiClient } from './apiClient';
import { ShareAccessType } from '@/store/shareStore';

export interface ShareOptions {
  accessType?: ShareAccessType;
  allowedEmails?: string[];
  requireAuth?: boolean;
  expirationDays?: number;
}

export interface SharedFile {
  shareId: string;
  shareUrl: string;
  fileName: string;
  fileSize: number;
  accessType: ShareAccessType;
  requireAuth: boolean;
  expiresAt: Date;
  createdAt: Date;
  fileMetadata?: {
    rowCount?: number;
    columnCount?: number;
    fileType: string;
    compressed: boolean;
  };
  accessCount?: number;
}

export interface SharePreview {
  shareId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  rowCount?: number;
  columnCount?: number;
  compressed: boolean;
  createdAt: Date;
  expiresAt: Date;
  ownerName?: string;
  accessCount: number;
  requireAuth: boolean;
}

export interface ShareAccess {
  shareId: string;
  downloadUrl: string;
  fileName: string;
  mimeType: string;
  compressed: boolean;
  expiresIn: number;
}

class ShareService {
  /**
   * Create a new file share
   */
  async createShare(
    file: File,
    metadata: any,
    options: ShareOptions = {},
    onProgress?: (progress: number) => void,
  ): Promise<SharedFile> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('metadata', JSON.stringify(metadata));
    
    // Add options to form data
    if (options.accessType) {
      formData.append('accessType', options.accessType);
    }
    if (options.allowedEmails?.length) {
      formData.append('allowedEmails', options.allowedEmails.join(','));
    }
    if (options.requireAuth !== undefined) {
      formData.append('requireAuth', options.requireAuth.toString());
    }
    if (options.expirationDays) {
      formData.append('expirationDays', options.expirationDays.toString());
    }
    
    // Debug logging
    console.log('FormData debug:', {
      file: file,
      fileSize: file?.size,
      fileName: file?.name,
      formDataEntries: Array.from(formData.entries()),
    });
    
    const response = await apiClient.uploadFormData('/file-sharing/share', formData, {
      onUploadProgress: (progress) => {
        if (onProgress) {
          onProgress(progress);
        }
      },
    });
    
    return response;
  }
  
  /**
   * Get share preview (public endpoint)
   */
  async getSharePreview(shareId: string): Promise<SharePreview> {
    const response = await apiClient.get(`/file-sharing/share/${shareId}`);
    return response;
  }
  
  /**
   * Access/download a shared file
   */
  async accessShare(shareId: string): Promise<ShareAccess> {
    const response = await apiClient.post(`/file-sharing/access/${shareId}`);
    return response;
  }
  
  /**
   * Get user's shares
   */
  async getUserShares(): Promise<SharedFile[]> {
    const response = await apiClient.get('/file-sharing/my-shares');
    return response;
  }
  
  /**
   * Delete a share
   */
  async deleteShare(shareId: string): Promise<void> {
    await apiClient.delete(`/file-sharing/share/${shareId}`);
  }
  
  /**
   * Download file from share
   */
  async downloadSharedFile(downloadUrl: string): Promise<Blob> {
    const response = await fetch(downloadUrl);
    if (!response.ok) {
      throw new Error('Failed to download file');
    }
    return response.blob();
  }
}

export const shareService = new ShareService();