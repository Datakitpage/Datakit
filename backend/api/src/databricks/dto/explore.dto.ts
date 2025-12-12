import { IsArray, IsBoolean, IsNumber, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { DatabricksConnectionDto } from './connection.dto';

export class DatabricksExploreFiltersDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  catalogs?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  schemas?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tables?: string[];

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsBoolean()
  includeViews?: boolean = true;

  @IsOptional()
  @IsBoolean()
  includeSystemSchemas?: boolean = false;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(1000)
  maxSchemasPerCatalog?: number = 100;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(5000)
  maxTablesPerSchema?: number = 500;
}

export class DatabricksExploreRequestDto {
  @ValidateNested()
  @Type(() => DatabricksConnectionDto)
  connection: DatabricksConnectionDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => DatabricksExploreFiltersDto)
  filters?: DatabricksExploreFiltersDto;
}
