import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('cloudflare:workers', () => ({
  WorkflowEntrypoint: class {},
  WorkflowStep: class {},
}));

import worker from './index';
import { queueFacebookPost, publishArticleNow, syncAndProcessFacebookPosts } from './facebook';

describe('Facebook Notebook Article & Publishing Pipeline', () => {
  let mockDb: any;
  let mockAi: any;
  let mockEnv: any;
  let executedSql: { sql: string; binds: any[] }[];

  beforeEach(() => {
    vi.resetAllMocks();
    executedSql = [];

    mockDb = {
      prepare: vi.fn().mockImplementation((sql: string) => {
        let currentBinds: any[] = [];
        const queryEntry = { sql, binds: [] as any[] };
        executedSql.push(queryEntry);
        const stmt = {
          bind: vi.fn().mockImplementation((...args: any[]) => {
            currentBinds = args;
            queryEntry.binds = args;
            return stmt;
          }),
          first: vi.fn().mockImplementation(async () => {
            if (sql.includes('SELECT value FROM system_settings')) {
              return null; // not paused
            }
            if (sql.includes('FROM notebook_articles WHERE id = ?')) {
              const id = currentBinds[0];
              if (id === 999) return null; // not found
              return {
                id,
                title: 'NVIDIA AI Revenue Surge',
                symbol: 'NVDA',
                summary: 'Record datacenter demand driving GPU growth.',
                key_takeaways: JSON.stringify(['GPU datacenter revenue up 150%', 'Supply constraints easing']),
              };
            }
            if (sql.includes('FROM facebook_posts WHERE source_type =') && sql.includes('source_id = ?')) {
              const id = currentBinds[0];
              if (id === 101) {
                return { id: 50, status: 'posted', facebook_post_id: 'fb-already-posted-101' };
              }
              return null;
            }
            return null;
          }),
          all: vi.fn().mockImplementation(async () => {
            if (sql.includes('FROM notebook_articles n')) {
              return {
                results: [
                  {
                    id: 1,
                    source_type: 'notebook_article',
                    title: 'NVIDIA AI Revenue Surge',
                    symbol: 'NVDA',
                    summary: 'Summary text',
                    key_takeaways: '["takeaway 1"]',
                    source: 'gemini_spark',
                    category: 'Tech & Semiconductors',
                    url: 'https://example.com/nvda',
                    auto_publish: 0,
                    is_readed: 0,
                    created_at: 1780000000,
                    facebook_status: null,
                    facebook_post_id: null,
                    facebook_error: null,
                  },
                ],
              };
            }
            if (sql.includes("FROM facebook_posts WHERE status = 'pending'")) {
              return { results: [] };
            }
            return { results: [] };
          }),
          run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 1 } }),
        };
        return stmt;
      }),
    };

    mockAi = {
      run: vi.fn().mockResolvedValue({
        response: '"Howard Marks style memo: Risk awareness is key in hyper-growth cycles."',
      }),
    };

    mockEnv = {
      DB: mockDb,
      AI: mockAi,
      IS_LOCAL: 'true',
      JWT_SECRET: 'test-secret',
      facebook_summarize_model: '@cf/meta/llama-4-scout-17b-16e-instruct',
      FACEBOOK_PAGE_ID: 'page_123',
      FACEBOOK_PAGE_ACCESS_TOKEN: 'token_abc',
    };
  });

  describe('queueFacebookPost', () => {
    it('successfully queues a notebook_article', async () => {
      await queueFacebookPost(mockEnv, 'notebook_article', 42);
      expect(mockDb.prepare).toHaveBeenCalledWith(
        'INSERT OR IGNORE INTO facebook_posts (source_type, source_id, status) VALUES (?, ?, ?)'
      );
      const insertCall = executedSql.find(e => e.sql.includes('INSERT OR IGNORE INTO facebook_posts'));
      expect(insertCall?.binds).toEqual(['notebook_article', 42, 'pending']);
    });
  });

  describe('POST /api/facebook/queue', () => {
    it('accepts source_type = notebook_article and queues it', async () => {
      const req = new Request('http://localhost/api/facebook/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_type: 'notebook_article', source_id: 15 }),
      });
      const res = await worker.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data.success).toBe(true);
      expect(data.message).toContain('notebook_article queued');
    });

    it('rejects invalid source_type', async () => {
      const req = new Request('http://localhost/api/facebook/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_type: 'invalid_type', source_id: 15 }),
      });
      const res = await worker.fetch(req, mockEnv);
      expect(res.status).toBe(400);
    });
  });

  describe('publishArticleNow', () => {
    it('returns alreadyPosted if article was previously posted to Facebook', async () => {
      const res = await publishArticleNow(mockEnv, 101);
      expect(res.success).toBe(true);
      expect(res.alreadyPosted).toBe(true);
      expect(res.facebookPostId).toBe('fb-already-posted-101');
    });

    it('throws error when article is not found', async () => {
      await expect(publishArticleNow(mockEnv, 999)).rejects.toThrow('Notebook article ID 999 not found');
    });

    it('formats memo with Workers AI and posts to Facebook Graph API', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('graph.facebook.com')) {
          return new Response(JSON.stringify({ id: 'fb_post_created_888' }), { status: 200 });
        }
        return originalFetch(url);
      });

      try {
        const result = await publishArticleNow(mockEnv, 1);
        expect(result.success).toBe(true);
        expect(result.facebookPostId).toBe('fb_post_created_888');
        expect(result.url).toBe('https://facebook.com/fb_post_created_888');
        expect(mockAi.run).toHaveBeenCalled();
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe('POST /api/facebook/publish-article-now route', () => {
    it('validates article_id requirement', async () => {
      const req = new Request('http://localhost/api/facebook/publish-article-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const res = await worker.fetch(req, mockEnv);
      expect(res.status).toBe(400);
      const data = (await res.json()) as any;
      expect(data.error).toBe('article_id is required');
    });
  });

  describe('syncAndProcessFacebookPosts auto-discovery guard', () => {
    it('discovers notebook_articles ONLY with auto_publish = 1', async () => {
      await syncAndProcessFacebookPosts(mockEnv);
      const notebookDiscovery = executedSql.find(e =>
        e.sql.includes('FROM notebook_articles') && e.sql.includes('WHERE auto_publish = 1')
      );
      expect(notebookDiscovery).toBeDefined();
    });
  });

  describe('GET /api/notebook-articles', () => {
    it('returns source, category, url, auto_publish, and source_type fields', async () => {
      const req = new Request('http://localhost/api/notebook-articles');
      const res = await worker.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const items = (await res.json()) as any[];
      expect(items.length).toBe(1);
      expect(items[0].source_type).toBe('notebook_article');
      expect(items[0].source).toBe('gemini_spark');
      expect(items[0].category).toBe('Tech & Semiconductors');
      expect(items[0].auto_publish).toBe(0);
      expect(items[0].is_readed).toBe(0);
    });
  });

  describe('POST /api/notebook-articles/mark-read', () => {
    it('marks article as read successfully', async () => {
      const req = new Request('http://localhost/api/notebook-articles/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 1 }),
      });
      const res = await worker.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data.success).toBe(true);
      expect(data.message).toBe('Article marked as read');
      expect(mockDb.prepare).toHaveBeenCalledWith('UPDATE notebook_articles SET is_readed = 1 WHERE id = ?');
    });

    it('returns 400 when article id is missing or non-numeric', async () => {
      const req = new Request('http://localhost/api/notebook-articles/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'abc' }),
      });
      const res = await worker.fetch(req, mockEnv);
      expect(res.status).toBe(400);
      const data = (await res.json()) as any;
      expect(data.error).toBe('Missing or invalid article ID');
    });
  });

  describe('DELETE /api/notebook-articles/:id', () => {
    it('successfully deletes an article and its facebook post record', async () => {
      const req = new Request('http://localhost/api/notebook-articles/42', {
        method: 'DELETE',
      });
      const res = await worker.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data.success).toBe(true);
      expect(data.message).toBe('Article deleted successfully');
      expect(mockDb.prepare).toHaveBeenCalledWith('DELETE FROM notebook_articles WHERE id = ?');
      expect(mockDb.prepare).toHaveBeenCalledWith(
        "DELETE FROM facebook_posts WHERE source_type = 'notebook_article' AND source_id = ?"
      );
    });

    it('returns 400 when article id is invalid or not numeric', async () => {
      const req = new Request('http://localhost/api/notebook-articles/abc', {
        method: 'DELETE',
      });
      const res = await worker.fetch(req, mockEnv);
      expect(res.status).toBe(400);
      const data = (await res.json()) as any;
      expect(data.error).toBe('Missing or invalid article ID');
    });

    it('returns 500 when database fails', async () => {
      mockDb.prepare.mockImplementationOnce(() => ({
        bind: vi.fn().mockReturnValue({
          run: vi.fn().mockRejectedValue(new Error('D1 error')),
        }),
      }));
      const req = new Request('http://localhost/api/notebook-articles/42', {
        method: 'DELETE',
      });
      const res = await worker.fetch(req, mockEnv);
      expect(res.status).toBe(500);
      const data = (await res.json()) as any;
      expect(data.error).toBe('D1 error');
    });
  });
});
