import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, IsNull, Not } from 'typeorm';
import { DomainUsage } from './entities/domain-usage.entity';
import { SlackService } from '../slack/slack.service';
import { Cron, CronExpression } from '@nestjs/schedule';

interface DomainTrackingData {
  domain: string;
  origin?: string;
  referer?: string;
  endpoint: string;
  method: string;
  userAgent?: string;
  ip?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface DomainStats {
  domain: string;
  totalRequests: number;
  uniqueUsers: number;
  endpoints: { endpoint: string; count: number }[];
  firstSeen: Date;
  lastSeen: Date;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);
  private readonly requestBuffer: Map<string, DomainTrackingData[]> = new Map();
  private readonly bufferFlushInterval = 5000; // 5 seconds
  private bufferTimer: NodeJS.Timeout;

  constructor(
    @InjectRepository(DomainUsage)
    private domainUsageRepository: Repository<DomainUsage>,
    private slackService: SlackService,
  ) {
    this.startBufferFlush();
  }

  private startBufferFlush() {
    this.bufferTimer = setInterval(() => {
      this.flushBuffer();
    }, this.bufferFlushInterval);
  }

  async trackDomainUsage(data: DomainTrackingData): Promise<void> {
    try {
      // Extract domain from origin or use a default
      const domain = this.extractDomain(data.origin || data.domain);

      // Add to buffer for batch processing
      const key = `${domain}-${data.userId || 'anonymous'}-${data.endpoint}`;
      if (!this.requestBuffer.has(key)) {
        this.requestBuffer.set(key, []);
      }
      this.requestBuffer.get(key)?.push(data);

      // Check if this is a new domain
      await this.checkNewDomain(domain);
    } catch (error) {
      this.logger.error('Error tracking domain usage:', error);
    }
  }

  private async flushBuffer(): Promise<void> {
    if (this.requestBuffer.size === 0) return;

    const bufferCopy = new Map(this.requestBuffer);
    this.requestBuffer.clear();

    for (const [key, requests] of bufferCopy) {
      if (requests.length === 0) continue;

      const firstRequest = requests[0];
      const domain = this.extractDomain(
        firstRequest.origin || firstRequest.domain,
      );

      try {
        // Check if we have an existing record for this domain/user/endpoint combination
        const existingUsage = await this.domainUsageRepository.findOne({
          where: {
            domain,
            userId: firstRequest.userId || IsNull(),
            endpoint: firstRequest.endpoint,
            method: firstRequest.method,
          },
        });

        if (existingUsage) {
          // Update existing record
          existingUsage.requestCount += requests.length;
          existingUsage.lastAccessAt = new Date();
          existingUsage.userAgent =
            firstRequest.userAgent || existingUsage.userAgent;
          existingUsage.ip = firstRequest.ip || existingUsage.ip;
          await this.domainUsageRepository.save(existingUsage);
        } else {
          // Create new record
          await this.domainUsageRepository.save({
            domain,
            origin: firstRequest.origin,
            referer: firstRequest.referer,
            endpoint: firstRequest.endpoint,
            method: firstRequest.method,
            userAgent: firstRequest.userAgent,
            ip: firstRequest.ip,
            userId: firstRequest.userId,
            requestCount: requests.length,
            metadata: firstRequest.metadata,
          });
        }
      } catch (error) {
        this.logger.error(`Error flushing buffer for key ${key}:`, error);
      }
    }
  }

  private extractDomain(url: string): string {
    if (!url) return 'unknown';

    try {
      if (url.includes('://')) {
        const urlObj = new URL(url);
        return urlObj.hostname;
      }
      return url;
    } catch {
      return url;
    }
  }

  private async checkNewDomain(domain: string): Promise<void> {
    // Skip localhost and common development domains
    if (this.isDevelopmentDomain(domain)) return;

    const existingDomain = await this.domainUsageRepository.findOne({
      where: { domain },
    });

    if (!existingDomain) {
      // This is a new domain, notify via Slack
      await this.notifyNewDomain(domain);
    }
  }

  private isDevelopmentDomain(domain: string): boolean {
    const devDomains = [
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      'host.docker.internal',
    ];
    return devDomains.some((dev) => domain.includes(dev));
  }

  private async notifyNewDomain(domain: string): Promise<void> {
    await this.slackService.sendNotification({
      text: `🌐 New Domain Detected!`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🌐 New Domain Using DataKit',
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Domain:*\n${domain}`,
            },
            {
              type: 'mrkdwn',
              text: `*First Seen:*\n${new Date().toLocaleString()}`,
            },
          ],
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: 'A new domain has started using DataKit API',
            },
          ],
        },
      ],
      username: 'DataKit Analytics',
      icon_emoji: ':globe_with_meridians:',
    });
  }

  async getDomainStats(
    startDate?: Date,
    endDate?: Date,
  ): Promise<DomainStats[]> {
    const whereClause: any = {};
    if (startDate && endDate) {
      whereClause.createdAt = Between(startDate, endDate);
    }

    const usages = await this.domainUsageRepository.find({
      where: whereClause,
      relations: ['user'],
    });

    const domainMap = new Map<string, DomainStats>();

    for (const usage of usages) {
      if (!domainMap.has(usage.domain)) {
        domainMap.set(usage.domain, {
          domain: usage.domain,
          totalRequests: 0,
          uniqueUsers: 0,
          endpoints: [],
          firstSeen: usage.createdAt,
          lastSeen: usage.lastAccessAt,
        });
      }

      const stats = domainMap.get(usage.domain)!;
      stats.totalRequests += usage.requestCount;

      if (usage.createdAt < stats.firstSeen) {
        stats.firstSeen = usage.createdAt;
      }
      if (usage.lastAccessAt > stats.lastSeen) {
        stats.lastSeen = usage.lastAccessAt;
      }

      const endpointIndex = stats.endpoints.findIndex(
        (e) => e.endpoint === usage.endpoint,
      );
      if (endpointIndex >= 0) {
        stats.endpoints[endpointIndex].count += usage.requestCount;
      } else {
        stats.endpoints.push({
          endpoint: usage.endpoint,
          count: usage.requestCount,
        });
      }
    }

    // Calculate unique users per domain
    for (const [domain, stats] of domainMap) {
      const uniqueUserIds = new Set(
        usages
          .filter((u) => u.domain === domain && u.userId)
          .map((u) => u.userId),
      );
      stats.uniqueUsers = uniqueUserIds.size;
    }

    return Array.from(domainMap.values()).sort(
      (a, b) => b.totalRequests - a.totalRequests,
    );
  }

  async getUserDomains(userId: string): Promise<string[]> {
    const usages = await this.domainUsageRepository.find({
      where: { userId },
      select: ['domain'],
    });

    return [...new Set(usages.map((u) => u.domain))];
  }

  // Daily report of domain usage
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async sendDailyDomainReport(): Promise<void> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const stats = await this.getDomainStats(yesterday, today);

    if (stats.length === 0) return;

    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '📊 Daily Domain Usage Report',
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Date:* ${yesterday.toLocaleDateString()}`,
        },
      },
    ];

    const topDomains = stats.slice(0, 5);
    for (const stat of topDomains) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${stat.domain}*\nRequests: ${stat.totalRequests} | Users: ${stat.uniqueUsers}`,
        },
      });
    }

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `Total domains: ${stats.length} | Total requests: ${stats.reduce(
          (sum, s) => sum + s.totalRequests,
          0,
        )}`,
      },
    });

    await this.slackService.sendNotification({
      blocks,
      username: 'DataKit Analytics',
      icon_emoji: ':chart_with_upwards_trend:',
    });
  }

  onModuleDestroy() {
    if (this.bufferTimer) {
      clearInterval(this.bufferTimer);
      this.flushBuffer(); // Flush any remaining data
    }
  }
}
