import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import type { AppEnv } from './env';
import { authMiddleware, rateLimitMiddleware } from './middleware';

const buildApp = () => {
  const app = new Hono<AppEnv>();
  app.use('/api/*', authMiddleware);
  app.use('/api/*', rateLimitMiddleware);
  app.get('/api/watchlist', (c) => c.text('ok'));
  app.get('/api/auth/user/login-url', (c) => c.text('login'));
  app.get('/api/crawl', (c) => c.text('crawled'));
  return app;
};

describe('middleware', () => {
  it('returns 401 for protected route without a token', async () => {
    const res = await buildApp().request('/api/watchlist', {}, { JWT_SECRET: 'secret' } as any);
    expect(res.status).toBe(401);
  });

  it('does not block unprotected login-url route', async () => {
    const res = await buildApp().request('/api/auth/user/login-url', {}, { JWT_SECRET: 'secret' } as any);
    expect(res.status).toBe(200);
  });

  it('returns 500 when JWT secret is missing outside local mode', async () => {
    const res = await buildApp().request('/api/watchlist', {}, {} as any);
    expect(res.status).toBe(500);
  });

  it('bypasses auth in local mode', async () => {
    const res = await buildApp().request('/api/watchlist', {}, { IS_LOCAL: 'true' } as any);
    expect(res.status).toBe(200);
  });

  it('does not rate-limit trigger routes in local mode', async () => {
    const app = buildApp();
    const env = { IS_LOCAL: 'true' } as any;
    expect((await app.request('/api/crawl', {}, env)).status).toBe(200);
    expect((await app.request('/api/crawl', {}, env)).status).toBe(200);
  });
});
