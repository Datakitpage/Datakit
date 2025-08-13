import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { DomainUsage } from './entities/domain-usage.entity';
import { DomainTrackingInterceptor } from './interceptors/domain-tracking.interceptor';
import { SlackModule } from '../slack/slack.module';

@Module({
  imports: [TypeOrmModule.forFeature([DomainUsage]), SlackModule],
  controllers: [AnalyticsController],
  providers: [
    AnalyticsService,
    {
      provide: APP_INTERCEPTOR,
      useClass: DomainTrackingInterceptor,
    },
  ],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
