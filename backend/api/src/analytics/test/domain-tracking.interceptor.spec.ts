import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { DomainTrackingInterceptor } from '../interceptors/domain-tracking.interceptor';
import { AnalyticsService } from '../analytics.service';

describe('DomainTrackingInterceptor', () => {
  let interceptor: DomainTrackingInterceptor;
  let analyticsService: AnalyticsService;

  const mockAnalyticsService = {
    trackDomainUsage: jest.fn().mockResolvedValue(undefined),
  };

  const mockCallHandler: CallHandler = {
    handle: jest.fn().mockReturnValue(of('test-response')),
  };

  const createMockExecutionContext = (request: any): ExecutionContext => ({
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({}) as any,
      getNext: () => ({}) as any,
    }),
    getClass: () => ({}) as any,
    getHandler: () => ({}) as any,
    getArgs: () => [] as any,
    getArgByIndex: () => ({}) as any,
    switchToRpc: () => ({}) as any,
    switchToWs: () => ({}) as any,
    getType: () => 'http' as any,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DomainTrackingInterceptor,
        {
          provide: AnalyticsService,
          useValue: mockAnalyticsService,
        },
      ],
    }).compile();

    interceptor = module.get<DomainTrackingInterceptor>(
      DomainTrackingInterceptor,
    );
    analyticsService = module.get<AnalyticsService>(AnalyticsService);

    jest.clearAllMocks();
  });

  describe('intercept', () => {
    it('should track domain usage for regular requests', (done) => {
      const mockRequest = {
        url: '/api/ai/chat',
        method: 'POST',
        headers: {
          host: 'app.datakit.page',
          origin: 'https://app.datakit.page',
          referer: 'https://app.datakit.page/dashboard',
          'user-agent': 'Mozilla/5.0',
          'content-type': 'application/json',
          'accept-language': 'en-US',
        },
        user: { id: 'user-123' },
        connection: { remoteAddress: '192.168.1.1' },
      };

      const context = createMockExecutionContext(mockRequest);

      interceptor.intercept(context, mockCallHandler).subscribe({
        next: (value) => {
          expect(value).toBe('test-response');
          expect(mockAnalyticsService.trackDomainUsage).toHaveBeenCalledWith({
            domain: 'app.datakit.page',
            origin: 'https://app.datakit.page',
            referer: 'https://app.datakit.page/dashboard',
            endpoint: '/api/ai/chat',
            method: 'POST',
            userAgent: 'Mozilla/5.0',
            ip: '192.168.1.1',
            userId: 'user-123',
            metadata: {
              contentType: 'application/json',
              acceptLanguage: 'en-US',
            },
          });
          done();
        },
      });
    });

    it('should handle requests without user (anonymous)', (done) => {
      const mockRequest = {
        url: '/api/public/data',
        method: 'GET',
        headers: {
          host: 'public.datakit.page',
          'user-agent': 'curl/7.64.1',
        },
        connection: { remoteAddress: '10.0.0.1' },
      };

      const context = createMockExecutionContext(mockRequest);

      interceptor.intercept(context, mockCallHandler).subscribe({
        next: () => {
          expect(mockAnalyticsService.trackDomainUsage).toHaveBeenCalledWith(
            expect.objectContaining({
              userId: undefined,
              domain: 'public.datakit.page',
            }),
          );
          done();
        },
      });
    });

    it('should skip tracking for health check endpoints', (done) => {
      const mockRequest = {
        url: '/api/health',
        method: 'GET',
        headers: {
          host: 'app.datakit.page',
        },
      };

      const context = createMockExecutionContext(mockRequest);

      interceptor.intercept(context, mockCallHandler).subscribe({
        next: () => {
          expect(mockAnalyticsService.trackDomainUsage).not.toHaveBeenCalled();
          done();
        },
      });
    });

    it('should extract IP from x-forwarded-for header', (done) => {
      const mockRequest = {
        url: '/api/test',
        method: 'GET',
        headers: {
          host: 'app.datakit.page',
          'x-forwarded-for': '203.0.113.0, 198.51.100.0',
        },
      };

      const context = createMockExecutionContext(mockRequest);

      interceptor.intercept(context, mockCallHandler).subscribe({
        next: () => {
          expect(mockAnalyticsService.trackDomainUsage).toHaveBeenCalledWith(
            expect.objectContaining({
              ip: '203.0.113.0',
            }),
          );
          done();
        },
      });
    });

    it('should extract IP from x-real-ip header', (done) => {
      const mockRequest = {
        url: '/api/test',
        method: 'GET',
        headers: {
          host: 'app.datakit.page',
          'x-real-ip': '203.0.113.0',
        },
      };

      const context = createMockExecutionContext(mockRequest);

      interceptor.intercept(context, mockCallHandler).subscribe({
        next: () => {
          expect(mockAnalyticsService.trackDomainUsage).toHaveBeenCalledWith(
            expect.objectContaining({
              ip: '203.0.113.0',
            }),
          );
          done();
        },
      });
    });

    it('should handle tracking errors gracefully', (done) => {
      mockAnalyticsService.trackDomainUsage.mockRejectedValueOnce(
        new Error('Tracking failed'),
      );

      const mockRequest = {
        url: '/api/test',
        method: 'GET',
        headers: {
          host: 'app.datakit.page',
        },
      };

      const context = createMockExecutionContext(mockRequest);
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      interceptor.intercept(context, mockCallHandler).subscribe({
        next: (value) => {
          // Should still return the response even if tracking fails
          expect(value).toBe('test-response');
          setTimeout(() => {
            expect(consoleSpy).toHaveBeenCalledWith(
              'Failed to track domain usage:',
              expect.any(Error),
            );
            consoleSpy.mockRestore();
            done();
          }, 100);
        },
      });
    });

    it('should skip tracking for static assets', (done) => {
      const mockRequest = {
        url: '/static/css/main.css',
        method: 'GET',
        headers: {
          host: 'app.datakit.page',
        },
      };

      const context = createMockExecutionContext(mockRequest);

      interceptor.intercept(context, mockCallHandler).subscribe({
        next: () => {
          expect(mockAnalyticsService.trackDomainUsage).not.toHaveBeenCalled();
          done();
        },
      });
    });
  });
});
