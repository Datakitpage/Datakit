import { 
  IsString, 
  IsOptional, 
  IsBoolean, 
  IsArray, 
  IsEnum, 
  IsDateString,
  IsObject,
  Length,
  Matches,
  ArrayNotEmpty,
} from 'class-validator';
import { ShareAccessType, SharePermission } from '../entities/shared-project.entity';

export class CreateProjectShareDto {
  @IsString()
  projectId: string;

  @IsOptional()
  @IsString()
  @Length(3, 50)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Custom slug must contain only lowercase letters, numbers, and hyphens',
  })
  customSlug?: string;

  @IsOptional()
  @IsEnum(ShareAccessType)
  accessType?: ShareAccessType;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedEmails?: string[];

  @IsOptional()
  @IsBoolean()
  requireAuth?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(SharePermission, { each: true })
  permissions?: SharePermission[];

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsObject()
  settings?: {
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
}

export class UpdateProjectShareDto {
  @IsOptional()
  @IsString()
  @Length(3, 50)
  @Matches(/^[a-z0-9-]+$/)
  customSlug?: string;

  @IsOptional()
  @IsEnum(ShareAccessType)
  accessType?: ShareAccessType;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedEmails?: string[];

  @IsOptional()
  @IsBoolean()
  requireAuth?: boolean;

  @IsOptional()
  @IsArray()
  @IsEnum(SharePermission, { each: true })
  permissions?: SharePermission[];

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsObject()
  settings?: {
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

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}