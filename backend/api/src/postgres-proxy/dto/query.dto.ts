import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  Min,
  Max,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ExecuteQueryDto {
  @IsString()
  @IsNotEmpty()
  sql: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(1000000)
  limit?: number = 1000; // Default limit for result sets

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  offset?: number = 0;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1000)
  @Max(300000)
  timeout?: number = 30000; // Query timeout in milliseconds

  @IsOptional()
  @IsBoolean()
  includeMetadata?: boolean = true; // Include execution metadata in response

  @IsOptional()
  @IsString()
  format?: 'json' | 'csv' | 'parquet' = 'json'; // Response format
}

export class QueryResultDto {
  success: boolean;
  data: any[];
  columns: {
    name: string;
    type: string;
    nullable?: boolean;
  }[];
  metadata: {
    executionTime: number; // in milliseconds
    rowCount: number;
    totalRows?: number; // if count query was executed
    queryId?: string;
    warnings?: string[];
  };
  pagination?: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export class QueryErrorDto {
  success: false;
  error: {
    code: string;
    message: string;
    detail?: string;
    hint?: string;
    position?: number;
    sqlState?: string;
  };
  metadata: {
    executionTime: number;
    queryId?: string;
  };
}