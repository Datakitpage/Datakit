import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull } from 'typeorm';
import { CloudProject, ProjectType } from './entities/cloud-project.entity';
import { CloudFile, CloudFileStatus } from './entities/cloud-file.entity';
import { User } from '../users/entities/user.entity';
import { Workspace } from '../workspaces/entities/workspace.entity';
import {
  WorkspaceMember,
  WorkspaceMemberRole,
} from '../workspaces/entities/workspace-member.entity';
import {
  Subscription,
  SubscriptionPlan,
} from '../subscriptions/entities/subscription.entity';
import { R2CloudStorageService } from './r2-cloud-storage.service';
import { CreateCloudProjectDto } from './dto/create-cloud-project.dto';
import {
  CloudProjectDto,
  CloudFileDto,
  CloudStorageStatsDto,
  SaveToCloudDto,
  CloudUploadResponseDto,
  CloudAccessDto,
} from './dto/cloud-storage-response.dto';

// Storage limits in bytes
const STORAGE_LIMITS = {
  [SubscriptionPlan.FREE]: 500 * 1024 * 1024, // 500 MB
  [SubscriptionPlan.PRO]: 10 * 1024 * 1024 * 1024, // 10 GB
  [SubscriptionPlan.TEAM]: 50 * 1024 * 1024 * 1024, // 50 GB
};

@Injectable()
export class CloudStorageService {
  private readonly logger = new Logger(CloudStorageService.name);

  constructor(
    @InjectRepository(CloudProject)
    private cloudProjectRepository: Repository<CloudProject>,
    @InjectRepository(CloudFile)
    private cloudFileRepository: Repository<CloudFile>,
    @InjectRepository(Workspace)
    private workspaceRepository: Repository<Workspace>,
    @InjectRepository(WorkspaceMember)
    private workspaceMemberRepository: Repository<WorkspaceMember>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Subscription)
    private subscriptionRepository: Repository<Subscription>,
    private r2CloudStorageService: R2CloudStorageService,
  ) {}

  /**
   * Check if user has access to workspace
   */
  private async checkWorkspaceAccess(
    userId: string,
    workspaceId: string,
    requiredRole?: WorkspaceMemberRole,
  ): Promise<WorkspaceMember> {
    const member = await this.workspaceMemberRepository.findOne({
      where: {
        userId,
        workspaceId,
      },
      relations: ['workspace'],
    });

    if (!member) {
      throw new ForbiddenException('You do not have access to this workspace');
    }

    // Check role if specified
    if (requiredRole) {
      const roleHierarchy = {
        [WorkspaceMemberRole.OWNER]: 3,
        [WorkspaceMemberRole.ADMIN]: 2,
        [WorkspaceMemberRole.MEMBER]: 1,
      };

      if (roleHierarchy[member.role] < roleHierarchy[requiredRole]) {
        throw new ForbiddenException(
          `You need ${requiredRole} role to perform this action`,
        );
      }
    }

    return member;
  }

  /**
   * Get workspace's storage limit based on subscription
   */
  async getWorkspaceStorageLimit(workspaceId: string): Promise<number> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { workspaceId },
    });

    const plan = subscription?.planType || SubscriptionPlan.FREE;
    return STORAGE_LIMITS[plan];
  }

  /**
   * Get workspace's current storage usage
   */
  async getWorkspaceStorageUsage(workspaceId: string): Promise<number> {
    const result = await this.cloudProjectRepository
      .createQueryBuilder('project')
      .select('SUM(project.storageUsed)', 'total')
      .where('project.workspaceId = :workspaceId', { workspaceId })
      .getRawOne();

    return parseInt(result?.total || '0');
  }

  /**
   * Check if workspace can upload file
   */
  async checkStorageQuota(
    workspaceId: string,
    fileSize: number,
  ): Promise<void> {
    const limit = await this.getWorkspaceStorageLimit(workspaceId);
    const usage = await this.getWorkspaceStorageUsage(workspaceId);

    if (usage + fileSize > limit) {
      const limitMB = Math.round(limit / (1024 * 1024));
      const usageMB = Math.round(usage / (1024 * 1024));
      throw new ForbiddenException(
        `Storage limit exceeded. Workspace is using ${usageMB}MB of ${limitMB}MB available. You need more space? contact us at hello@datakit.page`,
      );
    }
  }

  /**
   * Create a new cloud project in workspace
   */
  async createProject(
    userId: string,
    workspaceId: string,
    dto: CreateCloudProjectDto,
  ): Promise<CloudProjectDto> {
    // Check workspace access
    await this.checkWorkspaceAccess(
      userId,
      workspaceId,
      WorkspaceMemberRole.MEMBER,
    );

    // Get workspace
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    // Create project
    const project = this.cloudProjectRepository.create({
      workspaceId,
      createdByUserId: userId,
      name: dto.name,
      description: dto.description,
      type: dto.type || ProjectType.CLOUD,
      settings: dto.settings || {},
      isDefault: dto.isDefault || false,
    });

    // If setting as default, unset other defaults in workspace
    if (project.isDefault) {
      await this.cloudProjectRepository.update(
        { workspaceId, isDefault: true },
        { isDefault: false },
      );
    }

    const savedProject = await this.cloudProjectRepository.save(project);
    return this.mapProjectToDto(savedProject);
  }

  /**
   * Get workspace's cloud projects
   */
  async getWorkspaceProjects(
    userId: string,
    workspaceId: string,
  ): Promise<CloudProjectDto[]> {
    // Check workspace access
    await this.checkWorkspaceAccess(userId, workspaceId);

    const projects = await this.cloudProjectRepository.find({
      where: { workspaceId, isActive: true },
      order: { isDefault: 'DESC', createdAt: 'DESC' },
    });

    return projects.map((proj) => this.mapProjectToDto(proj));
  }

  /**
   * Get all projects user has access to across all workspaces
   */
  async getUserAccessibleProjects(userId: string): Promise<CloudProjectDto[]> {
    // Get all workspaces user is member of
    const memberships = await this.workspaceMemberRepository.find({
      where: { userId },
      relations: ['workspace'],
    });

    const projects: CloudProject[] = [];

    for (const membership of memberships) {
      const workspaceProjects = await this.cloudProjectRepository.find({
        where: { workspaceId: membership.workspaceId, isActive: true },
        order: { isDefault: 'DESC', createdAt: 'DESC' },
      });
      projects.push(...workspaceProjects);
    }

    return projects.map((proj) => this.mapProjectToDto(proj));
  }

  /**
   * Save file to cloud project
   */
  async saveToCloud(
    userId: string,
    file: Express.Multer.File,
    dto: SaveToCloudDto,
  ): Promise<CloudUploadResponseDto> {
    // Validate project
    const project = await this.cloudProjectRepository.findOne({
      where: { id: dto.projectId },
      relations: ['workspace'],
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Check workspace access
    await this.checkWorkspaceAccess(userId, project.workspaceId);

    // Check storage quota
    await this.checkStorageQuota(project.workspaceId, file.size);

    // Check if file exists
    const existingFile = await this.cloudFileRepository.findOne({
      where: {
        projectId: dto.projectId,
        fileName: dto.fileName || file.originalname,
      },
    });

    if (existingFile && !dto.replaceIfExists) {
      throw new BadRequestException('File already exists in this project');
    }

    // Upload to R2
    const r2Key = `workspaces/${project.workspaceId}/projects/${dto.projectId}/files/${Date.now()}_${file.originalname}`;
    const uploadResult = await this.r2CloudStorageService.uploadFile(
      file.buffer,
      r2Key,
      file.mimetype,
    );

    // Use the actual key returned by R2 service (may include .gz suffix if compressed)
    const actualR2Key = uploadResult.key;

    // Create or update file record
    let cloudFile: CloudFile;

    if (existingFile && dto.replaceIfExists) {
      // Keep version history if requested
      if (dto.keepVersionHistory && existingFile.versions) {
        existingFile.versions.push({
          versionId: `v_${Date.now()}`,
          r2Key: existingFile.r2Key,
          createdAt: new Date(),
          fileSize: existingFile.fileSize,
          createdBy: userId,
        });
      }

      // Update existing file
      existingFile.r2Key = actualR2Key;
      existingFile.fileSize = file.size;
      existingFile.compressedSize = uploadResult.compressedSize || file.size;
      existingFile.mimeType = file.mimetype;
      existingFile.metadata = dto.metadata;
      existingFile.uploadedByUserId = userId;
      existingFile.lastSyncedAt = new Date();

      cloudFile = await this.cloudFileRepository.save(existingFile);
    } else {
      // Create new file
      cloudFile = this.cloudFileRepository.create({
        projectId: dto.projectId,
        uploadedByUserId: userId,
        fileName: dto.fileName || file.originalname,
        originalName: file.originalname,
        fileSize: file.size,
        compressedSize: uploadResult.compressedSize || file.size,
        mimeType: file.mimetype,
        r2Key: actualR2Key,
        status: CloudFileStatus.SYNCED,
        metadata: dto.metadata,
        versions: [],
        lastSyncedAt: new Date(),
      });

      cloudFile = await this.cloudFileRepository.save(cloudFile);
    }

    // Update project storage usage
    const projectFiles = await this.cloudFileRepository.find({
      where: { projectId: dto.projectId },
    });

    const totalStorage = projectFiles.reduce(
      (sum, f) => sum + Number(f.fileSize),
      0,
    );

    await this.cloudProjectRepository.update(
      { id: dto.projectId },
      {
        storageUsed: totalStorage,
        fileCount: projectFiles.length,
      },
    );

    // Get updated project
    const updatedProject = await this.cloudProjectRepository.findOne({
      where: { id: dto.projectId },
    });

    // Get storage stats
    const storageStats = await this.getWorkspaceStorageStats(
      project.workspaceId,
    );

    return {
      file: this.mapFileToDto(cloudFile),
      project: this.mapProjectToDto(updatedProject!),
      storageStats,
    };
  }

  /**
   * Get project files
   */
  async getProjectFiles(
    userId: string,
    projectId: string,
  ): Promise<CloudFileDto[]> {
    // Get project and check access
    const project = await this.cloudProjectRepository.findOne({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    await this.checkWorkspaceAccess(userId, project.workspaceId);

    const files = await this.cloudFileRepository.find({
      where: { projectId },
      order: { createdAt: 'DESC' },
    });

    return files.map((file) => this.mapFileToDto(file));
  }

  /**
   * Get file access/download URL
   */
  async getFileAccess(userId: string, fileId: string): Promise<CloudAccessDto> {
    const file = await this.cloudFileRepository.findOne({
      where: { id: fileId },
      relations: ['project'],
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    // Check workspace access through project
    const project = await this.cloudProjectRepository.findOne({
      where: { id: file.projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    await this.checkWorkspaceAccess(userId, project.workspaceId);

    // Generate presigned URL
    const downloadUrl = await this.r2CloudStorageService.getPresignedUrl(
      file.r2Key,
      3600, // 1 hour
    );

    // Update last accessed
    await this.cloudFileRepository.update(
      { id: fileId },
      { lastAccessedAt: new Date() },
    );

    return {
      fileId: file.id,
      downloadUrl,
      fileName: file.fileName,
      mimeType: file.mimeType,
      compressed: !!file.compressedSize && file.compressedSize < file.fileSize,
      expiresIn: 3600,
    };
  }

  /**
   * Delete file from cloud
   */
  async deleteFile(userId: string, fileId: string): Promise<void> {
    const file = await this.cloudFileRepository.findOne({
      where: { id: fileId },
      relations: ['project'],
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    // Check workspace access with admin role
    const project = await this.cloudProjectRepository.findOne({
      where: { id: file.projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    await this.checkWorkspaceAccess(
      userId,
      project.workspaceId,
      WorkspaceMemberRole.ADMIN,
    );

    // Delete from R2
    await this.r2CloudStorageService.deleteFile(file.r2Key);

    // Delete database record
    await this.cloudFileRepository.remove(file);

    // Update project storage
    const remainingFiles = await this.cloudFileRepository.find({
      where: { projectId: file.projectId },
    });

    const totalStorage = remainingFiles.reduce(
      (sum, f) => sum + Number(f.fileSize),
      0,
    );

    await this.cloudProjectRepository.update(
      { id: file.projectId },
      {
        storageUsed: totalStorage,
        fileCount: remainingFiles.length,
      },
    );
  }

  /**
   * Get workspace storage statistics
   */
  /**
   * Get user's aggregated storage statistics across all accessible workspaces
   */
  async getUserStorageStats(userId: string): Promise<CloudStorageStatsDto> {
    // Get all workspaces the user has access to
    const memberships = await this.workspaceMemberRepository.find({
      where: { userId, acceptedAt: Not(IsNull()) },
      relations: ['workspace'],
    });

    let totalUsage = 0;
    let totalLimit = 0;
    let totalFiles = 0;
    let totalProjects = 0;
    let primaryPlan = SubscriptionPlan.FREE;

    for (const membership of memberships) {
      const workspaceId = membership.workspaceId;

      // Get workspace storage usage and limits
      const usage = await this.getWorkspaceStorageUsage(workspaceId);
      const limit = await this.getWorkspaceStorageLimit(workspaceId);

      totalUsage += usage;
      totalLimit += limit;

      // Count projects and files in this workspace
      const projectCount = await this.cloudProjectRepository.count({
        where: { workspaceId },
      });

      const fileCount = await this.cloudFileRepository
        .createQueryBuilder('file')
        .innerJoin('file.project', 'project')
        .where('project.workspaceId = :workspaceId', { workspaceId })
        .getCount();

      totalProjects += projectCount;
      totalFiles += fileCount;

      // Get the highest tier plan across all workspaces
      const subscription = await this.subscriptionRepository.findOne({
        where: { workspaceId },
      });

      if (subscription) {
        if (subscription.planType === SubscriptionPlan.TEAM) {
          primaryPlan = SubscriptionPlan.TEAM;
        } else if (
          subscription.planType === SubscriptionPlan.PRO &&
          primaryPlan === SubscriptionPlan.FREE
        ) {
          primaryPlan = SubscriptionPlan.PRO;
        }
      }
    }

    return {
      totalStorageUsed: totalUsage.toString(),
      storageLimit: totalLimit.toString(),
      storagePercentage: totalLimit > 0 ? (totalUsage / totalLimit) * 100 : 0,
      totalFiles,
      totalProjects,
      plan: primaryPlan,
    };
  }

  async getWorkspaceStorageStats(
    workspaceId: string,
  ): Promise<CloudStorageStatsDto> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { workspaceId },
    });

    const limit = await this.getWorkspaceStorageLimit(workspaceId);
    const usage = await this.getWorkspaceStorageUsage(workspaceId);

    const projects = await this.cloudProjectRepository.count({
      where: { workspaceId },
    });

    const files = await this.cloudFileRepository
      .createQueryBuilder('file')
      .innerJoin('file.project', 'project')
      .where('project.workspaceId = :workspaceId', { workspaceId })
      .getCount();

    return {
      totalStorageUsed: usage.toString(),
      storageLimit: limit.toString(),
      storagePercentage: (usage / limit) * 100,
      totalFiles: files,
      totalProjects: projects,
      plan: subscription?.planType || SubscriptionPlan.FREE,
    };
  }

  /**
   * Delete project (and all its files)
   */
  async deleteProject(userId: string, projectId: string): Promise<void> {
    const project = await this.cloudProjectRepository.findOne({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Check workspace access with admin role
    await this.checkWorkspaceAccess(
      userId,
      project.workspaceId,
      WorkspaceMemberRole.ADMIN,
    );

    // Get all files in project
    const files = await this.cloudFileRepository.find({
      where: { projectId },
    });

    // Delete all files from R2
    for (const file of files) {
      await this.r2CloudStorageService.deleteFile(file.r2Key);
    }

    // Delete project (cascade will delete files)
    await this.cloudProjectRepository.remove(project);
  }

  // Helper methods
  private mapProjectToDto(project: CloudProject): CloudProjectDto {
    return {
      id: project.id,
      name: project.name,
      description: project.description,
      type: project.type,
      storageUsed: project.storageUsed?.toString() || '0',
      fileCount: project.fileCount,
      settings: project.settings,
      isDefault: project.isDefault,
      isActive: project.isActive,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };
  }

  private mapFileToDto(file: CloudFile): CloudFileDto {
    return {
      id: file.id,
      projectId: file.projectId,
      fileName: file.fileName,
      originalName: file.originalName,
      fileSize: file.fileSize?.toString() || '0',
      compressedSize: file.compressedSize?.toString(),
      mimeType: file.mimeType,
      status: file.status,
      metadata: file.metadata,
      isShared: file.isShared,
      sharedFileId: file.sharedFileId,
      lastAccessedAt: file.lastAccessedAt,
      lastSyncedAt: file.lastSyncedAt,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
    };
  }
}
