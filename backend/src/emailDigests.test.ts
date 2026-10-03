import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('cloudflare:workers', () => ({
  WorkflowEntrypoint: class {},
  WorkflowStep: class {},
}));

import worker from './index';

describe('Email Digests API', () => {
  let mockDb: any;
  let mockEnv: any;

  beforeEach(() => {
    vi.resetAllMocks();

    mockDb = {
      prepare: vi.fn().mockImplementation((sql: string) => {
        const stmt = {
          bind: vi.fn().mockImplementation((...args: any[]) => stmt),
          all: vi.fn().mockImplementation(async () => {
            if (sql.includes('FROM email_digests e')) {
              return {
                results: [
                  {
                    id: 1,
                    category: 'Technology & AI',
                    summary: 'AI developments summary',
                    key_takeaways: '["takeaway 1"]',
                    source_emails: '[{"id":"msg1"}]',
                    digest_date: '2026-09-03',
                    is_readed: 0,
                    created_at: 1780000000,
                    facebook_status: null,
                    facebook_post_id: null,
                    facebook_error: null,
                  },
                ],
              };
            }
            return { results: [] };
          }),
          run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 1 } }),
        };
        return stmt;
      }),
    };

    mockEnv = {
      DB: mockDb,
      IS_LOCAL: 'true',
      JWT_SECRET: 'test-secret',
    };
  });

  describe('POST /api/email-digests/mark-read', () => {
    it('should mark a digest as read successfully when valid numeric ID is provided', async () => {
      const req = new Request('http://localhost/api/email-digests/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 1 }),
      });

      const res = await worker.fetch(req, mockEnv, {} as any);
      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data.success).toBe(true);
      expect(data.message).toBe('Digest marked as read');
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE email_digests SET is_readed = 1 WHERE id = ?')
      );
    });

    it('should accept and cast string numeric IDs correctly', async () => {
      const req = new Request('http://localhost/api/email-digests/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: '42' }),
      });

      const res = await worker.fetch(req, mockEnv, {} as any);
      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data.success).toBe(true);
    });

    it('should return 400 when ID is missing or null', async () => {
      const req = new Request('http://localhost/api/email-digests/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: null }),
      });

      const res = await worker.fetch(req, mockEnv, {} as any);
      expect(res.status).toBe(400);
      const data = (await res.json()) as any;
      expect(data.error).toBe('Missing or invalid digest ID');
    });

    it('should return 400 when ID is non-numeric string', async () => {
      const req = new Request('http://localhost/api/email-digests/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'invalid-id' }),
      });

      const res = await worker.fetch(req, mockEnv, {} as any);
      expect(res.status).toBe(400);
      const data = (await res.json()) as any;
      expect(data.error).toBe('Missing or invalid digest ID');
    });

    it('should return 500 when database run throws an error', async () => {
      mockDb.prepare.mockImplementationOnce(() => ({
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockRejectedValue(new Error('D1 write error')),
      }));

      const req = new Request('http://localhost/api/email-digests/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 1 }),
      });

      const res = await worker.fetch(req, mockEnv, {} as any);
      expect(res.status).toBe(500);
      const data = (await res.json()) as any;
      expect(data.error).toBe('D1 write error');
    });
  });

  describe('GET /api/email-digests', () => {
    it('should query unread digests using COALESCE(e.is_readed, 0) = 0', async () => {
      const req = new Request('http://localhost/api/email-digests', {
        method: 'GET',
      });

      const res = await worker.fetch(req, mockEnv, {} as any);
      expect(res.status).toBe(200);
      const data = (await res.json()) as any[];
      expect(data).toHaveLength(1);
      expect(data[0].id).toBe(1);
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('WHERE COALESCE(e.is_readed, 0) = 0')
      );
    });

    it('should return 500 when database query fails', async () => {
      mockDb.prepare.mockImplementationOnce(() => ({
        all: vi.fn().mockRejectedValue(new Error('D1 query failure')),
      }));

      const req = new Request('http://localhost/api/email-digests', {
        method: 'GET',
      });

      const res = await worker.fetch(req, mockEnv, {} as any);
      expect(res.status).toBe(500);
      const data = (await res.json()) as any;
      expect(data.error).toBe('D1 query failure');
    });
  });

  describe('POST /api/email-digests/reprocess', () => {
    it('should delete digest and reset ingested email when reprocess is called', async () => {
      const deleteDigestStmt = {
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }),
      };
      const deleteFbPostStmt = {
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }),
      };
      const updateIngestedStmt = {
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }),
      };
      const subsStmt = {
        all: vi.fn().mockResolvedValue({ results: [] }),
      };

      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('DELETE FROM email_digests WHERE id')) return deleteDigestStmt;
        if (sql.includes('DELETE FROM facebook_posts WHERE source_type')) return deleteFbPostStmt;
        if (sql.includes('UPDATE ingested_emails SET processed = 0 WHERE id')) return updateIngestedStmt;
        if (sql.includes('FROM email_subscriptions')) return subsStmt;
        return { bind: vi.fn().mockReturnThis(), all: vi.fn().mockResolvedValue({ results: [] }), run: vi.fn().mockResolvedValue({ success: true }) };
      });

      const req = new Request('http://localhost/api/email-digests/reprocess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email_id: 'email-123', digest_id: 355 }),
      });

      const res = await worker.fetch(req, mockEnv, {} as any);
      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data.success).toBe(true);

      expect(deleteDigestStmt.bind).toHaveBeenCalledWith(355);
      expect(deleteDigestStmt.run).toHaveBeenCalledTimes(1);
      expect(updateIngestedStmt.bind).toHaveBeenCalledWith('email-123');
      expect(updateIngestedStmt.run).toHaveBeenCalledTimes(1);
    });

    it('should return 500 when database error occurs during reprocess', async () => {
      mockDb.prepare.mockImplementationOnce(() => ({
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockRejectedValue(new Error('D1 write failure')),
      }));

      const req = new Request('http://localhost/api/email-digests/reprocess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email_id: 'email-123', digest_id: 355 }),
      });

      const res = await worker.fetch(req, mockEnv, {} as any);
      expect(res.status).toBe(500);
      const data = (await res.json()) as any;
      expect(data.error).toBe('D1 write failure');
    });
  });
});
