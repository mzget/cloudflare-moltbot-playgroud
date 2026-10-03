import { vi, describe, it, expect } from 'vitest';

vi.mock('cloudflare:workers', () => ({
  WorkflowEntrypoint: class {},
  WorkflowStep: class {},
}));

import worker from './index';
import { signJwt } from './auth';

const NOT_FOUND_TEXT = 'Oaktree Agent Backend Running';

// One representative, DB-only route from every mounted sub-app.
const SAMPLE_ROUTES: Array<[string, string, string]> = [
  ['userAuth', 'GET', '/api/user/preferences'],
  ['system', 'GET', '/api/settings'],
  ['content', 'GET', '/api/reports'],
  ['watchlist', 'GET', '/api/watchlist'],
  ['market', 'GET', '/api/market-breakouts'],
  ['alerts', 'GET', '/api/alerts'],
  ['gmail', 'GET', '/api/subscriptions'],
  ['facebook', 'POST', '/api/facebook/posts/style'],
  ['portfolio/holdings', 'GET', '/api/portfolio/holdings'],
  ['portfolio/transactions', 'GET', '/api/portfolio/lots/AAPL'],
  ['portfolio/reference', 'GET', '/api/portfolio/funds'],
  ['portfolio/brokers', 'POST', '/api/portfolio/brokers/override'],
  ['analysis', 'GET', '/api/analysis/results'],
  ['theses', 'GET', '/api/analysis/theses'],
];

const makeDb = () => {
  const stmt: any = {
    bind: () => stmt,
    all: async () => ({ results: [] }),
    first: async () => null,
    run: async () => ({ success: true, meta: { changes: 0 } }),
  };
  return { prepare: () => stmt, batch: async () => [] };
};

const send = (method: string, path: string, env: any, headers: Record<string, string> = {}) =>
  worker.fetch(
    new Request(`http://localhost${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: method === 'GET' ? undefined : JSON.stringify({}),
    }),
    env,
    { waitUntil: () => {} } as any,
  );

describe('app composition (index.ts)', () => {
  it('falls through to notFound for unknown API paths (positive control)', async () => {
    const res = await send('GET', '/api/does-not-exist', { DB: makeDb(), IS_LOCAL: 'true' });
    expect(await res.text()).toBe(NOT_FOUND_TEXT);
  });

  it.each(SAMPLE_ROUTES)('routes %s: %s %s is mounted (not served by notFound)', async (_name, method, path) => {
    const res = await send(method, path, { DB: makeDb(), IS_LOCAL: 'true', JWT_SECRET: 's' });
    const body = await res.text();
    expect(body).not.toBe(NOT_FOUND_TEXT);
  });

  it.each(SAMPLE_ROUTES)('routes %s: %s %s is protected by auth middleware', async (_name, method, path) => {
    const res = await send(method, path, { DB: makeDb(), JWT_SECRET: 's' });
    expect(res.status).toBe(401);
  });

  it('keeps login-url route public', async () => {
    const res = await send('GET', '/api/auth/user/login-url', { DB: makeDb(), JWT_SECRET: 's', GOOGLE_CLIENT_ID: 'id' });
    expect(res.status).not.toBe(401);
  });

  it('lets a valid JWT through to a handler', async () => {
    const token = await signJwt({ email: 'a@b.c', exp: Math.floor(Date.now() / 1000) + 3600 }, 's');
    const res = await send('GET', '/api/watchlist', { DB: makeDb(), JWT_SECRET: 's' }, { Authorization: `Bearer ${token}` });
    expect(res.status).toBe(200);
  });

  it('rejects an expired JWT', async () => {
    const token = await signJwt({ email: 'a@b.c', exp: Math.floor(Date.now() / 1000) - 10 }, 's');
    const res = await send('GET', '/api/watchlist', { DB: makeDb(), JWT_SECRET: 's' }, { Authorization: `Bearer ${token}` });
    expect(res.status).toBe(401);
  });

  it('rate-limits a trigger route on the second call within a minute when not local', async () => {
    const token = await signJwt({ email: 'rl@b.c', exp: Math.floor(Date.now() / 1000) + 3600 }, 's');
    const env = { DB: makeDb(), JWT_SECRET: 's' };
    const headers = { Authorization: `Bearer ${token}` };
    await send('GET', '/api/test-market-stats', env, headers);
    const second = await send('GET', '/api/test-market-stats', env, headers);
    expect(second.status).toBe(429);
    expect(await second.text()).toContain('Rate limit exceeded');
  });

  it('sends CORS headers: wildcard locally, pinned origin in production', async () => {
    const local = await send('GET', '/api/does-not-exist', { DB: makeDb(), IS_LOCAL: 'true' }, { Origin: 'http://x.test' });
    expect(local.headers.get('access-control-allow-origin')).toBe('*');
    const prod = await send('GET', '/api/does-not-exist', { DB: makeDb(), JWT_SECRET: 's' }, { Origin: 'https://oaktree-agent-frontend.pages.dev' });
    expect(prod.headers.get('access-control-allow-origin')).toBe('https://oaktree-agent-frontend.pages.dev');
  });
});
