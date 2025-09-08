import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Workspace } from '../../workspaces/entities/workspace.entity';
import { CloudFile } from './cloud-file.entity';

export enum ProjectType {
  LOCAL = 'local',
  CLOUD = 'cloud',
}

@Entity('cloud_projects')
@Index(['workspaceId'])
@Index(['createdByUserId'])
export class CloudProject {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  workspaceId: string;

  @ManyToOne(() => Workspace)
  @JoinColumn({ name: 'workspaceId' })
  workspace: Workspace;

  @Column({ nullable: true })
  createdByUserId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'createdByUserId' })
  createdBy: User;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: ProjectType,
    default: ProjectType.CLOUD,
  })
  type: ProjectType;

  @Column({ type: 'bigint', default: 0 })
  storageUsed: number;

  @Column({ default: 0 })
  fileCount: number;

  @Column({ type: 'jsonb', nullable: true })
  settings: {
    autoSync?: boolean;
    versioningEnabled?: boolean;
    defaultFileFormat?: string;
  };

  @Column({ default: false })
  isDefault: boolean;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => CloudFile, file => file.project)
  files: CloudFile[];
}