/**
 * Cloudflare Worker for handling subdomain routing
 * Handles *.datakit.page requests and routes them appropriately
 */

interface Env {
  BACKEND_URL: string;
  FRONTEND_URL: string;
  ALLOWED_ORIGINS: string;
}

// Reserved subdomains that should not be used for project sharing
const RESERVED_SUBDOMAINS = new Set([
  'www', 'api', 'app', 'admin', 'support', 'help', 'docs', 'blog',
  'mail', 'ftp', 'cdn', 'assets', 'static', 'share', 'preview',
  'dashboard', 'auth', 'login', 'signup', 'account', 'settings',
  'status', 'health', 'monitoring', 'analytics', 'reports',
]);

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const hostname = url.hostname;
    
    // Extract subdomain from hostname
    const subdomain = hostname.replace('.datakit.page', '');
    
    // Handle main domain (no subdomain or www)
    if (subdomain === 'datakit' || subdomain === '' || subdomain === 'www') {
      return proxyToFrontend(request, env.FRONTEND_URL);
    }
    
    // Handle API subdomain
    if (subdomain === 'api') {
      return proxyToBackend(request, env.BACKEND_URL);
    }
    
    // Handle share subdomain (fallback sharing)
    if (subdomain === 'share') {
      return handleShareSubdomain(request, env);
    }
    
    // Handle reserved subdomains
    if (RESERVED_SUBDOMAINS.has(subdomain)) {
      return new Response('This subdomain is reserved', { 
        status: 403,
        headers: { 'content-type': 'text/plain' }
      });
    }
    
    // Handle custom project subdomains
    return handleProjectSubdomain(subdomain, request, env);
  },
};

/**
 * Proxy request to frontend app
 */
async function proxyToFrontend(request: Request, frontendUrl: string): Promise<Response> {
  const url = new URL(request.url);
  const targetUrl = `${frontendUrl}${url.pathname}${url.search}`;
  
  const modifiedRequest = new Request(targetUrl, {
    method: request.method,
    headers: request.headers,
    body: request.body,
  });
  
  return fetch(modifiedRequest);
}

/**
 * Proxy request to backend API
 */
async function proxyToBackend(request: Request, backendUrl: string): Promise<Response> {
  const url = new URL(request.url);
  const targetUrl = `${backendUrl}${url.pathname}${url.search}`;
  
  const modifiedRequest = new Request(targetUrl, {
    method: request.method,
    headers: request.headers,
    body: request.body,
  });
  
  return fetch(modifiedRequest);
}

/**
 * Handle share.datakit.page requests
 */
async function handleShareSubdomain(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  
  // Route /p/{shareId} to project preview
  if (url.pathname.startsWith('/p/')) {
    const shareId = url.pathname.split('/')[2];
    if (shareId) {
      return handleProjectPreview(shareId, request, env, false);
    }
  }
  
  // For other paths, proxy to frontend
  return proxyToFrontend(request, env.FRONTEND_URL);
}

/**
 * Handle custom project subdomains
 */
async function handleProjectSubdomain(
  customSlug: string, 
  request: Request, 
  env: Env
): Promise<Response> {
  // Validate slug format
  if (!isValidSlug(customSlug)) {
    return new Response('Invalid subdomain format', { 
      status: 400,
      headers: { 'content-type': 'text/plain' }
    });
  }
  
  return handleProjectPreview(customSlug, request, env, true);
}

/**
 * Handle project preview for both custom slugs and share IDs
 */
async function handleProjectPreview(
  identifier: string,
  request: Request,
  env: Env,
  isCustomSlug: boolean
): Promise<Response> {
  const url = new URL(request.url);
  
  try {
    // Fetch project data from backend
    const apiUrl = `${env.BACKEND_URL}/project-sharing/preview/${identifier}`;
    const apiResponse = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'DataKit-Worker/1.0',
        'Accept': 'application/json',
      },
    });
    
    if (!apiResponse.ok) {
      if (apiResponse.status === 404) {
        return generateNotFoundPage(identifier, isCustomSlug);
      }
      throw new Error(`API returned ${apiResponse.status}`);
    }
    
    const projectData = await apiResponse.json();
    
    // For API requests, return JSON
    if (url.pathname.startsWith('/api/') || 
        request.headers.get('Accept')?.includes('application/json')) {
      return new Response(JSON.stringify(projectData), {
        headers: {
          'content-type': 'application/json',
          'cache-control': 'public, max-age=300',
          'access-control-allow-origin': env.ALLOWED_ORIGINS || '*',
        },
      });
    }
    
    // For browser requests, return HTML
    const html = generateProjectPreviewHTML(projectData, isCustomSlug);
    
    return new Response(html, {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=300', // 5 minutes
        'x-robots-tag': projectData.accessType === 'public' ? 'index, follow' : 'noindex, nofollow',
      },
    });
    
  } catch (error) {
    console.error('Error handling project preview:', error);
    return generateErrorPage(identifier, isCustomSlug);
  }
}

/**
 * Generate HTML for project preview
 */
function generateProjectPreviewHTML(projectData: any, isCustomSlug: boolean): string {
  const baseUrl = isCustomSlug ? 
    `https://${projectData.customSlug}.datakit.page` : 
    `https://share.datakit.page/p/${projectData.shareId}`;
    
  const title = projectData.settings?.customBranding?.title || 
                `${projectData.projectName} - DataKit`;
  const description = projectData.settings?.customBranding?.description || 
                     `Shared data project from ${projectData.workspaceName}`;
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}">
    
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website">
    <meta property="og:url" content="${baseUrl}">
    <meta property="og:title" content="${escapeHtml(title)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:image" content="https://datakit.page/og-image.png">
    
    <!-- Twitter -->
    <meta property="twitter:card" content="summary_large_image">
    <meta property="twitter:url" content="${baseUrl}">
    <meta property="twitter:title" content="${escapeHtml(title)}">
    <meta property="twitter:description" content="${escapeHtml(description)}">
    <meta property="twitter:image" content="https://datakit.page/og-image.png">
    
    <!-- Favicon -->
    <link rel="icon" type="image/x-icon" href="https://datakit.page/favicon.ico">
    
    <!-- Styles -->
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            color: white;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: rgba(0, 0, 0, 0.1);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            padding: 40px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        }
        .header {
            text-align: center;
            margin-bottom: 40px;
        }
        .title {
            font-size: 2.5rem;
            font-weight: bold;
            margin-bottom: 10px;
            background: linear-gradient(45deg, #fff, #f0f0f0);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        .subtitle {
            font-size: 1.2rem;
            opacity: 0.8;
            margin-bottom: 30px;
        }
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }
        .stat {
            text-align: center;
            background: rgba(255, 255, 255, 0.1);
            padding: 20px;
            border-radius: 15px;
            border: 1px solid rgba(255, 255, 255, 0.2);
        }
        .stat-value {
            font-size: 2rem;
            font-weight: bold;
            color: #4ade80;
        }
        .stat-label {
            font-size: 0.9rem;
            opacity: 0.8;
            margin-top: 5px;
        }
        .cta-button {
            display: inline-block;
            background: linear-gradient(45deg, #4ade80, #22c55e);
            color: white;
            padding: 15px 30px;
            border-radius: 30px;
            text-decoration: none;
            font-weight: bold;
            font-size: 1.1rem;
            transition: transform 0.2s, box-shadow 0.2s;
            box-shadow: 0 10px 25px rgba(34, 197, 94, 0.3);
        }
        .cta-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 15px 35px rgba(34, 197, 94, 0.4);
        }
        .auth-required {
            background: rgba(251, 191, 36, 0.1);
            border: 1px solid rgba(251, 191, 36, 0.3);
            padding: 20px;
            border-radius: 15px;
            margin: 20px 0;
            text-align: center;
        }
        .footer {
            text-align: center;
            margin-top: 40px;
            opacity: 0.6;
            font-size: 0.9rem;
        }
        .branding {
            color: #4ade80;
            text-decoration: none;
            font-weight: bold;
        }
    </style>
    
    <!-- Redirect script for client-side handling -->
    <script>
        window.projectData = ${JSON.stringify(projectData)};
        
        // Redirect to main app for authenticated access
        function accessProject() {
            const redirectUrl = 'https://datakit.page/share/${projectData.shareId}';
            window.location.href = redirectUrl;
        }
        
        // Track view
        if (navigator.sendBeacon) {
            navigator.sendBeacon('/api/track-view', JSON.stringify({
                shareId: '${projectData.shareId}',
                timestamp: new Date().toISOString()
            }));
        }
    </script>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 class="title">${escapeHtml(title)}</h1>
            <p class="subtitle">${escapeHtml(description)}</p>
            ${projectData.settings?.showOwnerInfo ? 
              `<p>Shared by <strong>${escapeHtml(projectData.workspaceName)}</strong></p>` : 
              ''}
        </div>
        
        <div class="stats">
            <div class="stat">
                <div class="stat-value">${projectData.fileCount}</div>
                <div class="stat-label">Files</div>
            </div>
            <div class="stat">
                <div class="stat-value">${projectData.totalSize}</div>
                <div class="stat-label">Total Size</div>
            </div>
            <div class="stat">
                <div class="stat-value">${formatDate(projectData.lastUpdated)}</div>
                <div class="stat-label">Last Updated</div>
            </div>
        </div>
        
        ${projectData.requireAuth ? `
        <div class="auth-required">
            <h3>🔒 Authentication Required</h3>
            <p>This project requires you to sign in to DataKit to access the data.</p>
        </div>
        ` : ''}
        
        <div style="text-align: center;">
            <a href="#" onclick="accessProject()" class="cta-button">
                ${projectData.requireAuth ? 'Sign In to Access Project' : 'View Project Data'}
            </a>
        </div>
        
        <div class="footer">
            <p>Powered by <a href="https://datakit.page" class="branding">DataKit</a></p>
        </div>
    </div>
</body>
</html>`;
}

/**
 * Generate 404 page
 */
function generateNotFoundPage(identifier: string, isCustomSlug: boolean): Response {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Project Not Found - DataKit</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-align: center;
            padding: 20px;
        }
        .container {
            max-width: 500px;
            background: rgba(0, 0, 0, 0.1);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            padding: 40px;
        }
        h1 { font-size: 3rem; margin-bottom: 20px; }
        p { font-size: 1.2rem; opacity: 0.8; margin-bottom: 30px; }
        a { color: #4ade80; text-decoration: none; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <h1>404</h1>
        <p>The shared project "${escapeHtml(identifier)}" was not found.</p>
        <p>It may have been removed or the link is incorrect.</p>
        <p><a href="https://datakit.page">Return to DataKit</a></p>
    </div>
</body>
</html>`;
  
  return new Response(html, {
    status: 404,
    headers: { 'content-type': 'text/html; charset=utf-8' }
  });
}

/**
 * Generate error page
 */
function generateErrorPage(identifier: string, isCustomSlug: boolean): Response {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Error Loading Project - DataKit</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-align: center;
            padding: 20px;
        }
        .container {
            max-width: 500px;
            background: rgba(0, 0, 0, 0.1);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            padding: 40px;
        }
        h1 { font-size: 2.5rem; margin-bottom: 20px; }
        p { font-size: 1.1rem; opacity: 0.8; margin-bottom: 20px; }
        a { color: #4ade80; text-decoration: none; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <h1>⚠️ Error</h1>
        <p>We encountered an error while loading this project.</p>
        <p>Please try again later or <a href="https://datakit.page">return to DataKit</a>.</p>
    </div>
</body>
</html>`;
  
  return new Response(html, {
    status: 500,
    headers: { 'content-type': 'text/html; charset=utf-8' }
  });
}

// Utility functions
function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(slug) && slug.length >= 3 && slug.length <= 50;
}

function escapeHtml(text: string): string {
  const div = new Text(text);
  return div.data
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}