import { ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { DatabricksConnectionDto } from './connection.dto';
import { DatabricksQueryDto } from './query.dto';

export class DatabricksExecuteQueryRequestDto {
    @ValidateNested()
    @Type(() => DatabricksConnectionDto)
    connection: DatabricksConnectionDto;

    @ValidateNested()
    @Type(() => DatabricksQueryDto)
    query: DatabricksQueryDto;
}
