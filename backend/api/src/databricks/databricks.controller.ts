import { Body, Controller, HttpStatus, Post } from '@nestjs/common';
import { DatabricksService } from './databricks.service';
import { DatabricksConnectionDto } from './dto/connection.dto';
import { DatabricksExploreRequestDto } from './dto/explore.dto';
import { DatabricksExecuteQueryRequestDto } from './dto/execute-query.dto';

@Controller('databricks')
export class DatabricksController {
  constructor(private readonly databricksService: DatabricksService) { }

  @Post('explore')
  async explore(@Body() body: DatabricksExploreRequestDto) {
    console.log('[DatabricksController] Explore request received');
    const data = await this.databricksService.listCatalogsSchemasTables(
      body.connection as DatabricksConnectionDto,
      body.filters,
    );
    console.log('[DatabricksController] Explore request completed');

    return {
      statusCode: HttpStatus.OK,
      message: 'Databricks catalogs/schemas/tables retrieved successfully',
      data,
    };
  }

  @Post('query')
  async query(@Body() body: DatabricksExecuteQueryRequestDto) {
    const data = await this.databricksService.executeQuery(
      body.connection,
      body.query,
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'Databricks query executed successfully',
      data,
    };
  }
}
