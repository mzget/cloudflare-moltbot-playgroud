import { cors } from 'hono/cors';
import { createMiddleware } from 'hono/factory';
import { checkAuth } from './auth';
import type { AppEnv } from './env';

// Enable CORS
export const corsMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const origin = c.env.IS_LOCAL === 'true' ? '*' : 'https://oaktree-agent-frontend.pages.dev'; // Replace with your production domain as appropriate
  const corsHandler = cors({
    origin: origin,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  });
  return corsHandler(c, next);
});

// Authentication Middleware
export const authMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const path = c.req.path;
  const isUnprotectedRoute = path === '/' ||
    path === '/api/auth/user/login-url' ||
    path === '/api/auth/user/callback';

  if (!isUnprotectedRoute) {
    const jwtSecret = c.env.JWT_SECRET;
    if (!jwtSecret && c.env.IS_LOCAL !== 'true') {
      return c.text('JWT Secret is not configured', 500);
    }

    let user = await checkAuth(c.req.raw, jwtSecret || '');

    // Bypass authentication in local development mode
    if (!user && c.env.IS_LOCAL === 'true') {
      user = {
        email: 'local@example.com',
        name: 'Local User',
        picture: ''
      };
    }

    if (!user) {
      return c.text('Unauthorized', 401);
    }
    c.set('user', user);
  }
  await next();
});

// Admin & Test Trigger Rate Limiting Middleware
const rateLimitCache = new Map<string, number>();
export const rateLimitMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const path = c.req.path;
  const isTriggerRoute = path === '/api/email-test' ||
    path === '/api/crawl' ||
    path === '/api/summarize-all' ||
    path === '/api/test-market-stats' ||
    path === '/api/crawl-events' ||
    path === '/api/alerts/check-test' ||
    path === '/api/email-sync' ||
    path === '/api/test-email-digest' ||
    path === '/api/test-facebook-post';

  if (isTriggerRoute && c.env.IS_LOCAL !== 'true') {
    const user = c.get('user');
    const key = `${user?.email || 'anonymous'}:${path}`;
    const lastRequestTime = rateLimitCache.get(key) || 0;
    const now = Date.now();
    const limitMs = 60 * 1000; // 1 minute limit per trigger endpoint

    if (now - lastRequestTime < limitMs) {
      const waitSec = Math.ceil((limitMs - (now - lastRequestTime)) / 1000);
      return c.text(`Rate limit exceeded. Please wait ${waitSec} seconds.`, 429);
    }
    rateLimitCache.set(key, now);
  }
  await next();
});
