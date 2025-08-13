# Domain Usage Analytics

This module tracks which domains are accessing your DataKit API, providing valuable insights for:
- Understanding customer usage patterns
- Detecting new deployments (especially Docker self-hosted instances)
- Security monitoring
- Usage analytics

## Features

### Automatic Domain Tracking
- Intercepts all API requests automatically
- Extracts domain/origin information from request headers
- Tracks authenticated and anonymous usage separately
- Batches requests for efficient database writes

### Slack Notifications
- **New Domain Alert**: Notifies when a new production domain starts using the API
- **Daily Reports**: Sends daily usage summaries at 9 AM
- Filters out localhost/development domains from notifications

### Analytics Endpoints

```bash
# Get domain statistics (admin)
GET /api/analytics/domains?startDate=2024-01-01&endDate=2024-01-31

# Get user's domains
GET /api/analytics/my-domains

# Get domain summary for current user
GET /api/analytics/domain-summary
```

## Configuration

### Environment Variables
```bash
# Slack webhook for notifications (optional)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...

# Your existing ALLOWED_ORIGINS now supports patterns:
ALLOWED_ORIGINS=localhost:*,*.datakit.page,*.pages.dev,customer.com
```

### Pattern Support
- `localhost:*` - All localhost ports
- `*.datakit.page` - All subdomains
- `datakit.page` - Exact domain (any protocol)
- `https://specific.domain.com` - Exact match

## Database Migration

Run the migration to create the domain_usage table:
```bash
npm run migration:run
```

## Data Collected

For each unique domain/user/endpoint combination:
- Domain/origin
- Endpoint accessed
- HTTP method
- User ID (if authenticated)
- Request count
- User agent
- IP address (for security)
- First seen date
- Last access date

## Privacy & Security

- IP addresses are hashed/anonymized after 30 days
- No request body/response data is stored
- Only metadata is tracked
- Development domains (localhost) are filtered from reports

## Use Cases

1. **Docker Deployments**: Track which customers are self-hosting
2. **Multi-tenant SaaS**: Monitor domain usage per customer
3. **Security**: Detect unauthorized domain usage
4. **Analytics**: Understand API usage patterns
5. **Billing**: Track usage for domain-based pricing

## Testing

Run the analytics tests:
```bash
npm test -- src/analytics
```

## Performance

- Requests are buffered and batch-written every 5 seconds
- Indexes on (domain, userId) and (domain, createdAt) for fast queries
- Old data can be archived/aggregated monthly