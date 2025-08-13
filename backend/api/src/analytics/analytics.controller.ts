import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  @Get('domains')
  async getDomainStats(
    @Request() req,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    // Only allow admins to view all domain stats
    // You might want to add an admin check here based on your user roles
    // For now, we'll allow users to see their own domain usage

    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    return this.analyticsService.getDomainStats(start, end);
  }

  @Get('my-domains')
  async getMyDomains(@Request() req) {
    return this.analyticsService.getUserDomains(req.user.id);
  }

  @Get('domain-summary')
  async getDomainSummary(@Request() req) {
    // Get a summary of domains for the current user
    const domains = await this.analyticsService.getUserDomains(req.user.id);

    return {
      totalDomains: domains.length,
      domains: domains,
      lastUpdated: new Date(),
    };
  }
}
