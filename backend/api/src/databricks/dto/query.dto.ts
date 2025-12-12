import { IsString, IsNotEmpty, IsOptional, IsNumber, Min, Max } from 'class-validator';

export class DatabricksQueryDto {
  @IsString()
  @IsNotEmpty()
  sql: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10000)
  limit?: number = 1000;

  @IsOptional()
  @IsNumber()
  @Min(0)
  offset?: number = 0;

  @IsOptional()
  @IsNumber()
  @Min(1000)
  @Max(300000)
  timeout?: number = 30000;
}

