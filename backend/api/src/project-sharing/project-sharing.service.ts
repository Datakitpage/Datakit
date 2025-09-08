import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { 
  SharedProject, 
  ShareAccessType, 
  SharePermission,
  AccessLog,
} from './entities/shared-project.entity';
import { CloudProject } from '../cloud-storage/entities/cloud-project.entity';
import { CloudFile } from '../cloud-storage/entities/cloud-file.entity';
import { Workspace } from '../workspaces/entities/workspace.entity';
import { WorkspaceMember, WorkspaceMemberRole } from '../workspaces/entities/workspace-member.entity';
import { R2CloudStorageService } from '../cloud-storage/r2-cloud-storage.service';
import { CreateProjectShareDto, UpdateProjectShareDto } from './dto/create-project-share.dto';
import { 
  ProjectShareResponseDto,
  ProjectSharePreviewDto,
  ProjectFilePreviewDto,
  ProjectShareAccessDto,
  ProjectShareAnalyticsDto,
} from './dto/project-share-response.dto';

@Injectable()
export class ProjectSharingService {
  private readonly logger = new Logger(ProjectSharingService.name);
  private readonly reservedSlugs = [
    'www', 'api', 'app', 'admin', 'support', 'help', 'docs', 'blog',
    'mail', 'ftp', 'cdn', 'assets', 'static', 'share', 'preview',
  ];

  constructor(
    @InjectRepository(SharedProject)
    private sharedProjectRepository: Repository<SharedProject>,
    @InjectRepository(CloudProject)
    private cloudProjectRepository: Repository<CloudProject>,
    @InjectRepository(CloudFile)
    private cloudFileRepository: Repository<CloudFile>,
    @InjectRepository(Workspace)
    private workspaceRepository: Repository<Workspace>,
    @InjectRepository(WorkspaceMember)
    private workspaceMemberRepository: Repository<WorkspaceMember>,
    private r2CloudStorageService: R2CloudStorageService,
    private configService: ConfigService,
  ) {}

  /**
   * Check if user has permission to share project
   */
  private async checkProjectSharePermission(
    userId: string,
    projectId: string,
  ): Promise<{ project: CloudProject; workspace: Workspace }> {
    const project = await this.cloudProjectRepository.findOne({
      where: { id: projectId },
      relations: ['workspace'],
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Check workspace membership
    const member = await this.workspaceMemberRepository.findOne({
      where: {
        userId,
        workspaceId: project.workspaceId,
      },
    });

    if (!member) {
      throw new ForbiddenException('You do not have access to this project');
    }

    // Only admins and owners can share projects
    if (![WorkspaceMemberRole.OWNER, WorkspaceMemberRole.ADMIN].includes(member.role)) {
      throw new ForbiddenException('You do not have permission to share this project');
    }

    return { project, workspace: project.workspace };
  }

  /**
   * Generate unique share ID
   */
  private generateShareId(): string {
    return randomBytes(9).toString('base64url');
  }

  /**
   * Validate custom slug
   */
  private async validateCustomSlug(slug: string, excludeId?: string): Promise<void> {
    if (this.reservedSlugs.includes(slug.toLowerCase())) {
      throw new BadRequestException('This slug is reserved');
    }

    const existing = await this.sharedProjectRepository.findOne({
      where: { customSlug: slug },
    });

    if (existing && existing.id !== excludeId) {
      throw new ConflictException('This custom URL is already taken');
    }
  }

  /**
   * Create a new project share
   */
  async createProjectShare(
    userId: string,
    dto: CreateProjectShareDto,
  ): Promise<ProjectShareResponseDto> {
    // Validate project access
    const { project, workspace } = await this.checkProjectSharePermission(
      userId,
      dto.projectId,
    );

    // Check if project is already shared
    const existingShare = await this.sharedProjectRepository.findOne({
      where: { projectId: dto.projectId, isActive: true },
    });

    if (existingShare) {
      throw new ConflictException('This project is already shared');
    }

    // Validate custom slug if provided
    if (dto.customSlug) {
      await this.validateCustomSlug(dto.customSlug);
    }

    // Generate unique share ID
    const shareId = this.generateShareId();

    // Set default permissions based on access type
    let permissions = dto.permissions || [SharePermission.VIEW];
    if (dto.accessType === ShareAccessType.PUBLIC && dto.requireAuth !== false) {
      // For public shares, limit permissions unless explicitly overridden
      permissions = permissions.filter(p => 
        [SharePermission.VIEW, SharePermission.EXPORT].includes(p)
      );
    }

    // Create shared project
    const sharedProject = this.sharedProjectRepository.create({
      shareId,
      projectId: dto.projectId,
      workspaceId: project.workspaceId,
      createdByUserId: userId,
      customSlug: dto.customSlug,
      accessType: dto.accessType || ShareAccessType.AUTHENTICATED,
      allowedEmails: dto.allowedEmails,
      requireAuth: dto.requireAuth !== false,
      permissions,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      settings: {
        showOwnerInfo: dto.settings?.showOwnerInfo !== false,
        allowDownload: dto.settings?.allowDownload !== false,
        allowQueryExecution: dto.settings?.allowQueryExecution || false,
        allowAIUsage: dto.settings?.allowAIUsage || false,
        showWatermark: dto.settings?.showWatermark !== false,
        customBranding: dto.settings?.customBranding,
      },
      isPublic: dto.accessType === ShareAccessType.PUBLIC,
      accessLogs: [],
    });

    const savedShare = await this.sharedProjectRepository.save(sharedProject);

    this.logger.log(`Created project share ${shareId} for project ${dto.projectId} by user ${userId}`);

    return this.mapToResponseDto(savedShare, project, workspace);
  }

  /**
   * Get project share preview (public endpoint)
   */
  async getProjectSharePreview(
    identifier: string, // shareId or customSlug
  ): Promise<ProjectSharePreviewDto> {
    let sharedProject: SharedProject | null;

    // Try to find by custom slug first, then by shareId
    if (identifier.length > 12) {
      sharedProject = await this.sharedProjectRepository.findOne({
        where: { customSlug: identifier },
        relations: ['project', 'workspace'],
      });
    } else {
      sharedProject = await this.sharedProjectRepository.findOne({
        where: { shareId: identifier },
        relations: ['project', 'workspace'],
      });
    }

    if (!sharedProject || !sharedProject.isActive) {
      throw new NotFoundException('Shared project not found');
    }

    // Check if expired
    if (sharedProject.isExpired) {
      throw new BadRequestException('This share has expired');
    }

    // Get project files
    const files = await this.cloudFileRepository.find({
      where: { projectId: sharedProject.projectId },
      order: { createdAt: 'DESC' },
    });

    // Calculate total size
    const totalSize = files.reduce((sum, file) => sum + Number(file.fileSize || 0), 0);

    // Map files to preview format
    const filesPreviews: ProjectFilePreviewDto[] = files.map(file => ({
      id: file.id,
      fileName: file.fileName,
      fileSize: file.fileSize?.toString() || '0',
      mimeType: file.mimeType,
      metadata: {
        rowCount: file.metadata?.rowCount,
        columnCount: file.metadata?.columnCount,
        fileType: file.metadata?.fileType,
      },
      lastModified: file.updatedAt,
    }));

    return {
      shareId: sharedProject.shareId,
      customSlug: sharedProject.customSlug,
      projectName: sharedProject.project.name,
      projectDescription: sharedProject.project.description,
      workspaceName: sharedProject.workspace.name,
      ownerName: sharedProject.settings?.showOwnerInfo ? 
        sharedProject.workspace.name : undefined,
      fileCount: files.length,
      totalSize: this.formatFileSize(totalSize),
      lastUpdated: sharedProject.project.updatedAt,
      accessType: sharedProject.accessType,
      requireAuth: sharedProject.requireAuth,
      permissions: sharedProject.permissions,
      settings: {
        showOwnerInfo: sharedProject.settings?.showOwnerInfo,
        customBranding: sharedProject.settings?.customBranding,
      },
      files: filesPreviews,
      isExpired: sharedProject.isExpired,
      createdAt: sharedProject.createdAt,
    };
  }

  /**
   * Access a shared project (requires authentication/permission)
   */
  async accessSharedProject(
    identifier: string,
    userId?: string,
    userEmail?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<ProjectShareAccessDto> {
    // Get shared project
    let sharedProject: SharedProject | null;

    if (identifier.length > 12) {
      sharedProject = await this.sharedProjectRepository.findOne({
        where: { customSlug: identifier },
        relations: ['project', 'workspace'],
      });
    } else {
      sharedProject = await this.sharedProjectRepository.findOne({
        where: { shareId: identifier },
        relations: ['project', 'workspace'],
      });
    }

    if (!sharedProject || !sharedProject.isActive) {
      throw new NotFoundException('Shared project not found');
    }

    // Check if expired
    if (sharedProject.isExpired) {
      throw new BadRequestException('This share has expired');
    }

    // Check access permissions
    if (sharedProject.requireAuth && !userId) {
      return {
        shareId: sharedProject.shareId,
        accessGranted: false,
        message: 'Authentication required to access this project',
      };
    }

    // Check email restrictions
    if (sharedProject.accessType === ShareAccessType.EMAIL_LIST) {
      if (!userEmail || !sharedProject.allowedEmails?.includes(userEmail)) {
        return {
          shareId: sharedProject.shareId,
          accessGranted: false,
          message: 'Your email is not authorized to access this project',
        };
      }
    }

    // Get project files with download URLs
    const files = await this.cloudFileRepository.find({
      where: { projectId: sharedProject.projectId },
    });

    const projectFiles = await Promise.all(
      files.map(async (file) => {
        let downloadUrl: string | undefined;
        
        // Only generate download URL if user has export permission
        if (sharedProject.permissions.includes(SharePermission.EXPORT)) {
          try {
            downloadUrl = await this.r2CloudStorageService.getPresignedUrl(
              file.r2Key,
              3600, // 1 hour
            );
          } catch (error) {
            this.logger.warn(`Failed to generate download URL for file ${file.id}:`, error);
          }
        }

        return {
          id: file.id,
          name: file.fileName,
          downloadUrl: downloadUrl || '',
          metadata: file.metadata,
        };
      })
    );

    // Log access
    const accessLog: AccessLog = {
      timestamp: new Date(),
      userId,
      userEmail,
      ipAddress,
      userAgent,
      action: 'access',
    };

    // Update analytics
    await this.updateAnalytics(sharedProject, accessLog);

    return {
      shareId: sharedProject.shareId,
      accessGranted: true,
      projectData: {
        name: sharedProject.project.name,
        description: sharedProject.project.description,
        files: projectFiles,
        permissions: sharedProject.permissions,
      },
      expiresIn: sharedProject.expiresAt ? 
        Math.floor((sharedProject.expiresAt.getTime() - Date.now()) / 1000) : 
        undefined,
    };
  }

  /**
   * Update analytics for a shared project
   */
  private async updateAnalytics(
    sharedProject: SharedProject,
    accessLog: AccessLog,
  ): Promise<void> {
    // Add to access logs (keep only last 100 entries)
    const logs = [...(sharedProject.accessLogs || []), accessLog].slice(-100);

    // Update view counts
    const viewCount = sharedProject.viewCount + 1;
    
    // Count unique viewers (rough estimate based on userId/email/IP)
    const uniqueIdentifiers = new Set();
    logs.forEach(log => {
      const identifier = log.userId || log.userEmail || log.ipAddress;
      if (identifier) uniqueIdentifiers.add(identifier);
    });

    await this.sharedProjectRepository.update(sharedProject.id, {
      viewCount,
      uniqueViewers: uniqueIdentifiers.size,
      lastAccessedAt: new Date(),
      accessLogs: logs,
    });
  }

  /**
   * Update project share
   */
  async updateProjectShare(
    userId: string,
    shareId: string,
    dto: UpdateProjectShareDto,
  ): Promise<ProjectShareResponseDto> {
    const sharedProject = await this.sharedProjectRepository.findOne({
      where: { shareId },
      relations: ['project', 'workspace'],
    });

    if (!sharedProject) {
      throw new NotFoundException('Shared project not found');
    }

    // Check permission
    await this.checkProjectSharePermission(userId, sharedProject.projectId);

    // Validate custom slug if being updated
    if (dto.customSlug && dto.customSlug !== sharedProject.customSlug) {
      await this.validateCustomSlug(dto.customSlug, sharedProject.id);
    }

    // Update fields
    Object.assign(sharedProject, {
      ...dto,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      isPublic: dto.accessType === ShareAccessType.PUBLIC,
      settings: dto.settings ? { ...sharedProject.settings, ...dto.settings } : sharedProject.settings,
    });

    const updatedShare = await this.sharedProjectRepository.save(sharedProject);

    return this.mapToResponseDto(
      updatedShare,
      sharedProject.project,
      sharedProject.workspace,
    );
  }

  /**
   * Delete project share
   */
  async deleteProjectShare(userId: string, shareId: string): Promise<void> {
    const sharedProject = await this.sharedProjectRepository.findOne({
      where: { shareId },
    });

    if (!sharedProject) {
      throw new NotFoundException('Shared project not found');
    }

    // Check permission
    await this.checkProjectSharePermission(userId, sharedProject.projectId);

    await this.sharedProjectRepository.remove(sharedProject);

    this.logger.log(`Deleted project share ${shareId} by user ${userId}`);
  }

  /**
   * Get project shares for a user
   */
  async getUserProjectShares(userId: string): Promise<ProjectShareResponseDto[]> {
    // Get all workspaces user is member of
    const memberships = await this.workspaceMemberRepository.find({
      where: { userId },
    });

    const workspaceIds = memberships.map(m => m.workspaceId);

    const shares = await this.sharedProjectRepository.find({
      where: { workspaceId: In(workspaceIds) },
      relations: ['project', 'workspace'],
      order: { createdAt: 'DESC' },
    });

    return shares.map(share => this.mapToResponseDto(
      share,
      share.project,
      share.workspace,
    ));
  }

  /**
   * Get analytics for a shared project
   */
  async getProjectShareAnalytics(
    userId: string,
    shareId: string,
  ): Promise<ProjectShareAnalyticsDto> {
    const sharedProject = await this.sharedProjectRepository.findOne({
      where: { shareId },
    });

    if (!sharedProject) {
      throw new NotFoundException('Shared project not found');
    }

    // Check permission
    await this.checkProjectSharePermission(userId, sharedProject.projectId);

    const logs = sharedProject.accessLogs || [];
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thisMonth = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    return {
      shareId: sharedProject.shareId,
      totalViews: sharedProject.viewCount,
      uniqueViewers: sharedProject.uniqueViewers,
      viewsToday: logs.filter(log => new Date(log.timestamp) >= today).length,
      viewsThisWeek: logs.filter(log => new Date(log.timestamp) >= thisWeek).length,
      viewsThisMonth: logs.filter(log => new Date(log.timestamp) >= thisMonth).length,
      topCountries: [], // Would need IP geolocation service
      recentActivity: logs.slice(-10).map(log => ({
        timestamp: new Date(log.timestamp),
        action: log.action,
        userEmail: log.userEmail,
        ipAddress: log.ipAddress,
      })),
    };
  }

  // Helper methods
  private mapToResponseDto(
    share: SharedProject,
    project: CloudProject,
    workspace: Workspace,
  ): ProjectShareResponseDto {
    return {
      id: share.id,
      shareId: share.shareId,
      shareUrl: share.shareUrl,
      customSlug: share.customSlug,
      projectId: share.projectId,
      projectName: project.name,
      workspaceId: share.workspaceId,
      workspaceName: workspace.name,
      accessType: share.accessType,
      permissions: share.permissions,
      requireAuth: share.requireAuth,
      allowedEmails: share.allowedEmails,
      expiresAt: share.expiresAt,
      settings: share.settings,
      viewCount: share.viewCount,
      uniqueViewers: share.uniqueViewers,
      lastAccessedAt: share.lastAccessedAt,
      isActive: share.isActive,
      createdAt: share.createdAt,
      updatedAt: share.updatedAt,
    };
  }

  private formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
}