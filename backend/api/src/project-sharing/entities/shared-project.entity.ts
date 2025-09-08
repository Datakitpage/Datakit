import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { CloudProject } from '../../cloud-storage/entities/cloud-project.entity';
import { Workspace } from '../../workspaces/entities/workspace.entity';
import { User } from '../../users/entities/user.entity';

export enum ShareAccessType {
  PUBLIC = 'public',
  AUTHENTICATED = 'authenticated',
  EMAIL_LIST = 'email_list',
}

export enum SharePermission {
  VIEW = 'view',
  QUERY = 'query',
  AI = 'ai',
  EXPORT = 'export',
}

export interface AccessLog {
  timestamp: Date;
  userId?: string;
  userEmail?: string;
  ipAddress?: string;
  userAgent?: string;
  action: 'preview' | 'access' | 'query' | 'export';
}

@Entity('shared_projects')
@Index(['shareId'])
@Index(['customSlug'])
@Index(['workspaceId'])
@Unique(['customSlug']) // Ensure unique custom subdomains
export class SharedProject {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 12 })
  shareId: string; // Short unique ID for URLs

  @Column()
  projectId: string;

  @ManyToOne(() => CloudProject, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project: CloudProject;

  @Column()
  workspaceId: string;

  @ManyToOne(() => Workspace)
  @JoinColumn({ name: 'workspaceId' })
  workspace: Workspace;

  @Column()
  createdByUserId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'createdByUserId' })
  createdBy: User;

  // Custom subdomain/slug for branding
  @Column({ nullable: true, length: 50 })
  customSlug: string; // For {custom-slug}.datakit.page

  // Access control
  @Column({
    type: 'enum',
    enum: ShareAccessType,
    default: ShareAccessType.AUTHENTICATED,
  })
  accessType: ShareAccessType;

  @Column({ type: 'simple-array', nullable: true })
  allowedEmails: string[];

  @Column({ default: true })
  requireAuth: boolean;

  // Permissions
  @Column({
    type: 'simple-array',
    default: [SharePermission.VIEW],
  })
  permissions: SharePermission[];

  // Expiration
  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date;

  // Settings
  @Column({ type: 'jsonb', nullable: true })
  settings: {
    showOwnerInfo?: boolean;
    allowDownload?: boolean;
    allowQueryExecution?: boolean;
    allowAIUsage?: boolean;
    showWatermark?: boolean;
    customBranding?: {
      title?: string;
      description?: string;
      logoUrl?: string;
      primaryColor?: string;
    };
  };

  // Analytics
  @Column({ default: 0 })
  viewCount: number;

  @Column({ default: 0 })
  uniqueViewers: number;

  @Column({ type: 'timestamp', nullable: true })
  lastAccessedAt: Date;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  accessLogs: AccessLog[];

  // Status
  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isPublic: boolean; // Quick flag for public shares

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Computed properties
  get shareUrl(): string {
    if (this.customSlug) {
      return `https://${this.customSlug}.datakit.page`;
    }
    return `https://share.datakit.page/p/${this.shareId}`;
  }

  get isExpired(): boolean {
    return this.expiresAt ? this.expiresAt < new Date() : false;
  }

  get hasPermission(): (permission: SharePermission) => boolean {
    return (permission: SharePermission) => this.permissions.includes(permission);
  }
}