import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
  Headers,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { ProjectSharingService } from './project-sharing.service';
import { CreateProjectShareDto, UpdateProjectShareDto } from './dto/create-project-share.dto';

@Controller('project-sharing')
export class ProjectSharingController {
  constructor(private readonly projectSharingService: ProjectSharingService) {}

  /**
   * Create a new project share (requires authentication)
   */
  @Post('share')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createProjectShare(
    @Request() req,
    @Body() dto: CreateProjectShareDto,
  ) {
    const userId = req.user.id;
    return this.projectSharingService.createProjectShare(userId, dto);
  }

  /**
   * Get project share preview (public endpoint)
   */
  @Get('preview/:identifier')
  async getProjectSharePreview(@Param('identifier') identifier: string) {
    return this.projectSharingService.getProjectSharePreview(identifier);
  }

  /**
   * Access a shared project (optionally authenticated)
   */
  @Post('access/:identifier')
  @UseGuards(OptionalJwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async accessSharedProject(
    @Param('identifier') identifier: string,
    @Request() req,
    @Headers('x-forwarded-for') ipAddress?: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    const userId = req.user?.id;
    const userEmail = req.user?.email;

    return this.projectSharingService.accessSharedProject(
      identifier,
      userId,
      userEmail,
      ipAddress,
      userAgent,
    );
  }

  /**
   * Update project share (requires authentication)
   */
  @Put('share/:shareId')
  @UseGuards(JwtAuthGuard)
  async updateProjectShare(
    @Request() req,
    @Param('shareId') shareId: string,
    @Body() dto: UpdateProjectShareDto,
  ) {
    const userId = req.user.id;
    return this.projectSharingService.updateProjectShare(userId, shareId, dto);
  }

  /**
   * Delete project share (requires authentication)
   */
  @Delete('share/:shareId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteProjectShare(
    @Request() req,
    @Param('shareId') shareId: string,
  ) {
    const userId = req.user.id;
    await this.projectSharingService.deleteProjectShare(userId, shareId);
  }

  /**
   * Get user's project shares (requires authentication)
   */
  @Get('my-shares')
  @UseGuards(JwtAuthGuard)
  async getUserProjectShares(@Request() req) {
    const userId = req.user.id;
    return this.projectSharingService.getUserProjectShares(userId);
  }

  /**
   * Get project share analytics (requires authentication)
   */
  @Get('share/:shareId/analytics')
  @UseGuards(JwtAuthGuard)
  async getProjectShareAnalytics(
    @Request() req,
    @Param('shareId') shareId: string,
  ) {
    const userId = req.user.id;
    return this.projectSharingService.getProjectShareAnalytics(userId, shareId);
  }

  /**
   * Check custom slug availability (requires authentication)
   */
  @Get('check-slug/:slug')
  @UseGuards(JwtAuthGuard)
  async checkSlugAvailability(@Param('slug') slug: string) {
    try {
      // Try to create a temporary share to validate slug
      // This will throw if slug is invalid or taken
      await this.projectSharingService['validateCustomSlug'](slug);
      return { available: true };
    } catch (error) {
      return { 
        available: false, 
        message: error instanceof Error ? error.message : 'Slug not available' 
      };
    }
  }
}