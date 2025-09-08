import { create } from 'zustand';
import { 
  projectSharingService,
  ProjectShare,
  ProjectSharePreview,
  ProjectShareAccess,
  CreateProjectShareDto,
  UpdateProjectShareDto,
  ShareAccessType,
  SharePermission,
} from '@/lib/api/projectSharingService';

interface ProjectSharingState {
  // State
  userShares: ProjectShare[];
  currentSharePreview: ProjectSharePreview | null;
  currentShareAccess: ProjectShareAccess | null;
  
  // UI State
  isLoading: boolean;
  isSharing: boolean;
  shareError: string | null;
  
  // Modal State
  isShareModalOpen: boolean;
  shareModalProjectId: string | null;
  
  // Actions
  createProjectShare: (dto: CreateProjectShareDto) => Promise<ProjectShare>;
  updateProjectShare: (shareId: string, dto: UpdateProjectShareDto) => Promise<ProjectShare>;
  deleteProjectShare: (shareId: string) => Promise<void>;
  loadUserShares: () => Promise<void>;
  
  // Public access (no auth required)
  getSharePreview: (identifier: string) => Promise<ProjectSharePreview>;
  accessSharedProject: (identifier: string) => Promise<ProjectShareAccess>;
  
  // Analytics
  getShareAnalytics: (shareId: string) => Promise<any>;
  
  // Modal actions
  openShareModal: (projectId: string) => void;
  closeShareModal: () => void;
  
  // Helpers
  setShareError: (error: string | null) => void;
  clearShareError: () => void;
  getShareById: (shareId: string) => ProjectShare | undefined;
}

export const useProjectSharingStore = create<ProjectSharingState>((set, get) => ({
  // Initial state
  userShares: [],
  currentSharePreview: null,
  currentShareAccess: null,
  
  // UI State
  isLoading: false,
  isSharing: false,
  shareError: null,
  
  // Modal State
  isShareModalOpen: false,
  shareModalProjectId: null,
  
  // Create project share
  createProjectShare: async (dto: CreateProjectShareDto) => {
    set({ isSharing: true, shareError: null });
    
    try {
      const share = await projectSharingService.createProjectShare(dto);
      
      set(state => ({
        userShares: [share, ...state.userShares],
        isSharing: false,
      }));
      
      return share;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create share';
      set({ 
        shareError: message,
        isSharing: false,
      });
      throw error;
    }
  },
  
  // Update project share
  updateProjectShare: async (shareId: string, dto: UpdateProjectShareDto) => {
    set({ isLoading: true, shareError: null });
    
    try {
      const updatedShare = await projectSharingService.updateProjectShare(shareId, dto);
      
      set(state => ({
        userShares: state.userShares.map(share => 
          share.shareId === shareId ? updatedShare : share
        ),
        isLoading: false,
      }));
      
      return updatedShare;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update share';
      set({ 
        shareError: message,
        isLoading: false,
      });
      throw error;
    }
  },
  
  // Delete project share
  deleteProjectShare: async (shareId: string) => {
    set({ isLoading: true, shareError: null });
    
    try {
      await projectSharingService.deleteProjectShare(shareId);
      
      set(state => ({
        userShares: state.userShares.filter(share => share.shareId !== shareId),
        isLoading: false,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete share';
      set({ 
        shareError: message,
        isLoading: false,
      });
      throw error;
    }
  },
  
  // Load user's shares
  loadUserShares: async () => {
    set({ isLoading: true, shareError: null });
    
    try {
      const shares = await projectSharingService.getUserProjectShares();
      set({ 
        userShares: shares,
        isLoading: false,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load shares';
      set({ 
        shareError: message,
        isLoading: false,
      });
    }
  },
  
  // Get share preview (public)
  getSharePreview: async (identifier: string) => {
    set({ isLoading: true, shareError: null });
    
    try {
      const preview = await projectSharingService.getProjectSharePreview(identifier);
      set({ 
        currentSharePreview: preview,
        isLoading: false,
      });
      return preview;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load share preview';
      set({ 
        shareError: message,
        isLoading: false,
        currentSharePreview: null,
      });
      throw error;
    }
  },
  
  // Access shared project
  accessSharedProject: async (identifier: string) => {
    set({ isLoading: true, shareError: null });
    
    try {
      const access = await projectSharingService.accessSharedProject(identifier);
      set({ 
        currentShareAccess: access,
        isLoading: false,
      });
      return access;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to access shared project';
      set({ 
        shareError: message,
        isLoading: false,
        currentShareAccess: null,
      });
      throw error;
    }
  },
  
  // Get share analytics
  getShareAnalytics: async (shareId: string) => {
    try {
      return await projectSharingService.getProjectShareAnalytics(shareId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load analytics';
      set({ shareError: message });
      throw error;
    }
  },
  
  // Modal actions
  openShareModal: (projectId: string) => {
    set({ 
      isShareModalOpen: true,
      shareModalProjectId: projectId,
      shareError: null,
    });
  },
  
  closeShareModal: () => {
    set({ 
      isShareModalOpen: false,
      shareModalProjectId: null,
      shareError: null,
    });
  },
  
  // Helpers
  setShareError: (error: string | null) => {
    set({ shareError: error });
  },
  
  clearShareError: () => {
    set({ shareError: null });
  },
  
  getShareById: (shareId: string) => {
    return get().userShares.find(share => share.shareId === shareId);
  },
}));