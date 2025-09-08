import { IsString, IsOptional, IsBoolean, IsObject } from 'class-validator';
import { ProjectType } from '../entities/cloud-project.entity';

export class CreateCloudProjectDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  type?: ProjectType;

  @IsObject()
  @IsOptional()
  settings?: {
    autoSync?: boolean;
    versioningEnabled?: boolean;
    defaultFileFormat?: string;
  };

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}