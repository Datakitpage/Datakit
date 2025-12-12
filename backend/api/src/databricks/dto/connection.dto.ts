import { IsString, IsNotEmpty, IsOptional, IsNumber, Min, Max } from 'class-validator';

export class DatabricksConnectionDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @IsNotEmpty()
  host: string; // server_hostname, e.g. dbc-xxxx.cloud.databricks.com

  @IsString()
  @IsNotEmpty()
  httpPath: string; // warehouse http path

  @IsOptional()
  @IsNumber()
  @Min(1000)
  @Max(300000)
  timeout?: number = 30000;
}

