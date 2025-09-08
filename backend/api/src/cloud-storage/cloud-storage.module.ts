import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { CloudStorageController } from './cloud-storage.controller';
import { CloudStorageService } from './cloud-storage.service';
import { R2CloudStorageService } from './r2-cloud-storage.service';
import { CloudProject } from './entities/cloud-project.entity';
import { CloudFile } from './entities/cloud-file.entity';
import { User } from '../users/entities/user.entity';
import { Workspace } from '../workspaces/entities/workspace.entity';
import { WorkspaceMember } from '../workspaces/entities/workspace-member.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      CloudProject,
      CloudFile,
      User,
      Workspace,
      WorkspaceMember,
      Subscription,
    ]),
  ],
  controllers: [CloudStorageController],
  providers: [CloudStorageService, R2CloudStorageService],
  exports: [CloudStorageService],
})
export class CloudStorageModule {}