import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Request,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CloudStorageService } from './cloud-storage.service';
import { CreateCloudProjectDto } from './dto/create-cloud-project.dto';
import { SaveToCloudDto } from './dto/cloud-storage-response.dto';

@Controller('cloud-storage')
@UseGuards(JwtAuthGuard)
export class CloudStorageController {
  constructor(private readonly cloudStorageService: CloudStorageService) {}

  /**
   * Create a new cloud project in a workspace
   */
  @Post('workspace/:workspaceId/project')
  async createProject(
    @Request() req,
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateCloudProjectDto,
  ) {
    const userId = req.user.id;
    return this.cloudStorageService.createProject(userId, workspaceId, dto);
  }

  /**
   * Get workspace's cloud projects
   */
  @Get('workspace/:workspaceId/projects')
  async getWorkspaceProjects(
    @Request() req,
    @Param('workspaceId') workspaceId: string,
  ) {
    const userId = req.user.id;
    return this.cloudStorageService.getWorkspaceProjects(userId, workspaceId);
  }

  /**
   * Get all projects user has access to
   */
  @Get('projects')
  async getUserAccessibleProjects(@Request() req) {
    const userId = req.user.id;
    return this.cloudStorageService.getUserAccessibleProjects(userId);
  }

  /**
   * Upload file to cloud project
   */
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 500 * 1024 * 1024, // 500MB max
      },
    }),
  )
  async uploadToCloud(
    @Request() req,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
  ) {
    if (!file) {
      throw new Error('No file uploaded');
    }

    const userId = req.user.id;

    // Parse metadata from body
    const dto: SaveToCloudDto = {
      projectId: body.projectId, // Changed from workspaceId
      fileName: body.fileName,
      metadata: body.metadata ? JSON.parse(body.metadata) : undefined,
      replaceIfExists: body.replaceIfExists === 'true',
      keepVersionHistory: body.keepVersionHistory === 'true',
    };

    return this.cloudStorageService.saveToCloud(userId, file, dto);
  }

  /**
   * Get files in a project
   */
  @Get('project/:projectId/files')
  async getProjectFiles(@Request() req, @Param('projectId') projectId: string) {
    const userId = req.user.id;
    return this.cloudStorageService.getProjectFiles(userId, projectId);
  }

  /**
   * Get all user's cloud files across all projects
   */
  @Get('files')
  async getAllUserFiles(@Request() req) {
    const userId = req.user.id;
    const projects =
      await this.cloudStorageService.getUserAccessibleProjects(userId);

    const allFiles = [];
    for (const project of projects) {
      const files = await this.cloudStorageService.getProjectFiles(
        userId,
        project.id,
      );
      allFiles.push(
        ...files.map((file) => ({
          ...file,
          projectName: project.name,
          projectId: project.id,
        })),
      );
    }

    return allFiles;
  }

  /**
   * Get file access/download URL
   */
  @Post('file/:fileId/access')
  @HttpCode(HttpStatus.OK)
  async getFileAccess(@Request() req, @Param('fileId') fileId: string) {
    const userId = req.user.id;
    return this.cloudStorageService.getFileAccess(userId, fileId);
  }

  /**
   * Delete file from cloud
   */
  @Delete('file/:fileId')
  async deleteFile(@Request() req, @Param('fileId') fileId: string) {
    const userId = req.user.id;
    await this.cloudStorageService.deleteFile(userId, fileId);
    return { message: 'File deleted successfully' };
  }

  /**
   * Get user's aggregated storage statistics
   */
  @Get('stats')
  async getUserStorageStats(@Request() req) {
    const userId = req.user.id;
    return this.cloudStorageService.getUserStorageStats(userId);
  }

  /**
   * Get workspace's storage statistics
   */
  @Get('workspace/:workspaceId/stats')
  async getWorkspaceStorageStats(
    @Request() req,
    @Param('workspaceId') workspaceId: string,
  ) {
    const userId = req.user.id;

    // Check access - method is private, so we'll call getWorkspaceProjects first
    await this.cloudStorageService.getWorkspaceProjects(userId, workspaceId);

    return this.cloudStorageService.getWorkspaceStorageStats(workspaceId);
  }

  /**
   * Delete project (and all its files)
   */
  @Delete('project/:projectId')
  async deleteProject(@Request() req, @Param('projectId') projectId: string) {
    const userId = req.user.id;
    await this.cloudStorageService.deleteProject(userId, projectId);
    return { message: 'Project deleted successfully' };
  }
}
