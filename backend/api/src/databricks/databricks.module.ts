import { Module } from '@nestjs/common';
import { DatabricksService } from './databricks.service';
import { DatabricksController } from './databricks.controller';

@Module({
  controllers: [DatabricksController],
  providers: [DatabricksService],
  exports: [DatabricksService],
})
export class DatabricksModule {}

