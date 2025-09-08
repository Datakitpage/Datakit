import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectSharingController } from './project-sharing.controller';
import { ProjectSharingService } from './project-sharing.service';
import { SharedProject } from './entities/shared-project.entity';
import { CloudProject } from '../cloud-storage/entities/cloud-project.entity';
import { CloudFile } from '../cloud-storage/entities/cloud-file.entity';
import { Workspace } from '../workspaces/entities/workspace.entity';
import { WorkspaceMember } from '../workspaces/entities/workspace-member.entity';
import { R2CloudStorageService } from '../cloud-storage/r2-cloud-storage.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SharedProject,
      CloudProject,
      CloudFile,
      Workspace,
      WorkspaceMember,
    ]),
  ],
  controllers: [ProjectSharingController],
  providers: [ProjectSharingService, R2CloudStorageService],
  exports: [ProjectSharingService],
})
export class ProjectSharingModule {}