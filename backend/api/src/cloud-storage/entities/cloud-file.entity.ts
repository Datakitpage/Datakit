import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { CloudProject } from './cloud-project.entity';
import { User } from '../../users/entities/user.entity';

export enum CloudFileStatus {
  SYNCED = 'synced',
  SYNCING = 'syncing',
  PENDING = 'pending',
  ERROR = 'error',
}

@Entity('cloud_files')
@Index(['projectId', 'uploadedByUserId'])
@Index(['fileName'])
export class CloudFile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  projectId: string;

  @ManyToOne(() => CloudProject, project => project.files, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project: CloudProject;

  @Column({ nullable: true })
  uploadedByUserId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'uploadedByUserId' })
  uploadedBy: User;

  @Column()
  fileName: string;

  @Column()
  originalName: string;

  @Column({ type: 'bigint' })
  fileSize: number;

  @Column({ type: 'bigint', nullable: true })
  compressedSize: number;

  @Column()
  mimeType: string;

  @Column()
  r2Key: string;

  @Column({
    type: 'enum',
    enum: CloudFileStatus,
    default: CloudFileStatus.SYNCED,
  })
  status: CloudFileStatus;

  @Column({ type: 'jsonb', nullable: true })
  metadata: {
    rowCount?: number;
    columnCount?: number;
    fileType?: string;
    schema?: any;
    tableName?: string;
    compressed?: boolean;
    lastModifiedLocally?: Date;
  };

  @Column({ type: 'jsonb', nullable: true })
  versions: Array<{
    versionId: string;
    r2Key: string;
    createdAt: Date;
    fileSize: number;
    createdBy: string;
    comment?: string;
  }>;

  @Column({ default: false })
  isShared: boolean;

  @Column({ nullable: true })
  sharedFileId: string;

  @Column({ type: 'timestamp', nullable: true })
  lastAccessedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastSyncedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}