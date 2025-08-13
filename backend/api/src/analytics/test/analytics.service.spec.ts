import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnalyticsService } from '../analytics.service';
import { DomainUsage } from '../entities/domain-usage.entity';
import { SlackService } from '../../slack/slack.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let domainUsageRepository: Repository<DomainUsage>;
  let slackService: SlackService;

  const mockDomainUsageRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
  };

  const mockSlackService = {
    sendNotification: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        {
          provide: getRepositoryToken(DomainUsage),
          useValue: mockDomainUsageRepository,
        },
        {
          provide: SlackService,
          useValue: mockSlackService,
        },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
    domainUsageRepository = module.get<Repository<DomainUsage>>(
      getRepositoryToken(DomainUsage),
    );
    slackService = module.get<SlackService>(SlackService);

    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clean up the buffer flush timer
    service.onModuleDestroy();
  });

  describe('trackDomainUsage', () => {
    it('should track domain usage for authenticated user', async () => {
      const trackingData = {
        domain: 'app.datakit.page',
        origin: 'https://app.datakit.page',
        endpoint: '/api/ai/chat',
        method: 'POST',
        userId: 'user-123',
        userAgent: 'Mozilla/5.0',
        ip: '192.168.1.1',
      };

      mockDomainUsageRepository.findOne.mockResolvedValue(null);

      await service.trackDomainUsage(trackingData);

      // Wait for buffer to be processed
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockDomainUsageRepository.findOne).toHaveBeenCalled();
    });

    it('should track domain usage for anonymous user', async () => {
      const trackingData = {
        domain: 'public.datakit.page',
        origin: 'https://public.datakit.page',
        endpoint: '/api/public/data',
        method: 'GET',
        userAgent: 'Mozilla/5.0',
        ip: '192.168.1.2',
      };

      mockDomainUsageRepository.findOne.mockResolvedValue(null);

      await service.trackDomainUsage(trackingData);

      // Wait for buffer to be processed
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockDomainUsageRepository.findOne).toHaveBeenCalled();
    });

    it('should notify Slack for new production domain', async () => {
      const trackingData = {
        domain: 'newcustomer.com',
        origin: 'https://newcustomer.com',
        endpoint: '/api/ai/chat',
        method: 'POST',
        userId: 'user-456',
      };

      mockDomainUsageRepository.findOne.mockResolvedValue(null);

      await service.trackDomainUsage(trackingData);

      // The notification happens asynchronously
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockSlackService.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('New Domain Detected'),
        }),
      );
    });

    it('should not notify Slack for localhost domains', async () => {
      const trackingData = {
        domain: 'localhost:3000',
        origin: 'http://localhost:3000',
        endpoint: '/api/test',
        method: 'GET',
      };

      await service.trackDomainUsage(trackingData);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockSlackService.sendNotification).not.toHaveBeenCalled();
    });
  });

  describe('getDomainStats', () => {
    it('should return aggregated domain statistics', async () => {
      const mockUsages = [
        {
          id: '1',
          domain: 'app.datakit.page',
          endpoint: '/api/ai/chat',
          requestCount: 10,
          userId: 'user-1',
          createdAt: new Date('2024-01-01'),
          lastAccessAt: new Date('2024-01-02'),
        },
        {
          id: '2',
          domain: 'app.datakit.page',
          endpoint: '/api/credits',
          requestCount: 5,
          userId: 'user-2',
          createdAt: new Date('2024-01-01'),
          lastAccessAt: new Date('2024-01-02'),
        },
        {
          id: '3',
          domain: 'customer.com',
          endpoint: '/api/ai/chat',
          requestCount: 20,
          userId: 'user-3',
          createdAt: new Date('2024-01-01'),
          lastAccessAt: new Date('2024-01-03'),
        },
      ];

      mockDomainUsageRepository.find.mockResolvedValue(mockUsages);

      const stats = await service.getDomainStats();

      expect(stats).toHaveLength(2);
      expect(stats[0].domain).toBe('customer.com');
      expect(stats[0].totalRequests).toBe(20);
      expect(stats[1].domain).toBe('app.datakit.page');
      expect(stats[1].totalRequests).toBe(15);
    });

    it('should filter stats by date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      mockDomainUsageRepository.find.mockResolvedValue([]);

      await service.getDomainStats(startDate, endDate);

      expect(mockDomainUsageRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: expect.anything(),
          }),
        }),
      );
    });
  });

  describe('getUserDomains', () => {
    it('should return unique domains for a user', async () => {
      const userId = 'user-123';
      const mockUsages = [
        { domain: 'app.datakit.page' },
        { domain: 'app.datakit.page' },
        { domain: 'staging.datakit.page' },
        { domain: 'localhost:3000' },
      ];

      mockDomainUsageRepository.find.mockResolvedValue(mockUsages);

      const domains = await service.getUserDomains(userId);

      expect(domains).toEqual([
        'app.datakit.page',
        'staging.datakit.page',
        'localhost:3000',
      ]);
      expect(mockDomainUsageRepository.find).toHaveBeenCalledWith({
        where: { userId },
        select: ['domain'],
      });
    });

    it('should return empty array for user with no domains', async () => {
      mockDomainUsageRepository.find.mockResolvedValue([]);

      const domains = await service.getUserDomains('user-999');

      expect(domains).toEqual([]);
    });
  });

  describe('buffer management', () => {
    it('should batch requests in buffer before saving', async () => {
      const trackingData1 = {
        domain: 'app.datakit.page',
        origin: 'https://app.datakit.page',
        endpoint: '/api/test',
        method: 'GET',
        userId: 'user-1',
      };

      const trackingData2 = {
        domain: 'app.datakit.page',
        origin: 'https://app.datakit.page',
        endpoint: '/api/test',
        method: 'GET',
        userId: 'user-1',
      };

      mockDomainUsageRepository.findOne.mockResolvedValue({
        id: '1',
        domain: 'app.datakit.page',
        endpoint: '/api/test',
        method: 'GET',
        userId: 'user-1',
        requestCount: 5,
        lastAccessAt: new Date(),
      });

      await service.trackDomainUsage(trackingData1);
      await service.trackDomainUsage(trackingData2);

      // Force buffer flush
      await service['flushBuffer']();

      expect(mockDomainUsageRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          requestCount: expect.any(Number),
        }),
      );
    });
  });
});
