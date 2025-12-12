export function createCorsOriginChecker(allowedOrigins: string[]) {
  return (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void,
  ) => {
    try {
      // Allow requests with no origin (like mobile apps or Postman)
      if (!origin) {
        return callback(null, true);
      }

      // Check if origin matches any allowed pattern
      if (isOriginAllowed(origin, allowedOrigins)) {
        return callback(null, true);
      }

      // Reject other origins
      callback(new Error('Not allowed by CORS'));
    } catch (error) {
      console.error('[CORS] Error checking origin:', error);
      callback(new Error('Not allowed by CORS'));
    }
  };
}

export function isOriginAllowed(
  origin: string,
  allowedOrigins: string[],
): boolean {
  for (const allowed of allowedOrigins) {
    // Handle localhost wildcard patterns
    if (
      allowed === 'localhost:*' ||
      allowed === 'http://localhost:*' ||
      allowed === 'https://localhost:*'
    ) {
      const protocol = allowed.startsWith('http://')
        ? 'http'
        : allowed.startsWith('https://')
          ? 'https'
          : 'https?';
      const regex = new RegExp(
        `^${protocol}://(localhost|127\\.0\\.0\\.1)(:\\d+)?$`,
      );
      if (regex.test(origin)) {
        return true;
      }
    }
    // Handle 127.0.0.1 wildcard patterns
    else if (
      allowed === '127.0.0.1:*' ||
      allowed === 'http://127.0.0.1:*' ||
      allowed === 'https://127.0.0.1:*' ||
      allowed === '*.pages.dev'
    ) {
      const protocol = allowed.startsWith('http://')
        ? 'http'
        : allowed.startsWith('https://')
          ? 'https'
          : 'https?';
      const regex = new RegExp(
        `^${protocol}://(localhost|127\\.0\\.0\\.1)(:\\d+)?$`,
      );
      if (regex.test(origin)) {
        return true;
      }
    }
    // Handle pages.dev wildcard
    else if (allowed === '*.pages.dev') {
      const regex = new RegExp(`^https://[a-zA-Z0-9.-]+\\.pages\\.dev$`);
      if (regex.test(origin)) {
        return true;
      }
    }
    // Handle domain wildcard patterns (e.g., *.datakit.page)
    else if (allowed.startsWith('*.')) {
      const domain = allowed.substring(2);
      const regex = new RegExp(
        `^https?://([a-zA-Z0-9-]+\\.)?${domain.replace(/\./g, '\\.')}$`,
      );
      if (regex.test(origin)) {
        return true;
      }
    }
    // Handle exact matches
    else if (allowed === origin) {
      return true;
    }
    // Handle partial domain matches (e.g., 'datakit.page' matches 'https://datakit.page')
    else if (!allowed.includes('://')) {
      const regex = new RegExp(`^https?://${allowed.replace(/\./g, '\\.')}$`);
      if (regex.test(origin)) {
        return true;
      }
    }
  }

  return false;
}

export function parseAllowedOrigins(
  originsString: string | undefined,
  defaultOrigins: string[] = [],
): string[] {
  if (!originsString) {
    return defaultOrigins;
  }

  const parsedOrigins = originsString
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  // Merge parsed origins with default origins (remove duplicates)
  return [...new Set([...defaultOrigins, ...parsedOrigins])];
}
