import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AnalyticsService } from '../analytics.service';

@Injectable()
export class DomainTrackingInterceptor implements NestInterceptor {
  constructor(private analyticsService: AnalyticsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();

    // Skip tracking for health checks and internal endpoints
    if (this.shouldSkipTracking(request.url)) {
      return next.handle();
    }

    // Extract tracking data from request
    const trackingData = {
      domain: request.headers.host || 'unknown',
      origin: request.headers.origin,
      referer: request.headers.referer,
      endpoint: request.url,
      method: request.method,
      userAgent: request.headers['user-agent'],
      ip: this.getClientIp(request),
      userId: request.user?.id,
      metadata: {
        contentType: request.headers['content-type'],
        acceptLanguage: request.headers['accept-language'],
      },
    };

    // Track asynchronously to not block the request
    this.analyticsService.trackDomainUsage(trackingData).catch((error) => {
      console.error('Failed to track domain usage:', error);
    });

    return next.handle().pipe(
      tap({
        next: () => {
          // Could track successful responses here if needed
        },
        error: (error) => {
          // Could track errors by domain if needed
          if (error.status >= 500) {
            // Track server errors separately if desired
          }
        },
      }),
    );
  }

  private shouldSkipTracking(url: string): boolean {
    const skipPatterns = [
      '/api/health',
      '/api/metrics',
      '/favicon.ico',
      '/_next',
      '/static',
    ];

    return skipPatterns.some((pattern) => url.startsWith(pattern));
  }

  private getClientIp(request: any): string {
    // Check for various headers that might contain the real IP
    const forwardedFor = request.headers['x-forwarded-for'];
    if (forwardedFor) {
      return forwardedFor.split(',')[0].trim();
    }

    const realIp = request.headers['x-real-ip'];
    if (realIp) {
      return realIp;
    }

    // Fallback to connection remote address
    return (
      request.connection?.remoteAddress ||
      request.socket?.remoteAddress ||
      'unknown'
    );
  }
}
