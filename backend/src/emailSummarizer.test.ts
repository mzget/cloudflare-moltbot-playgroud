import { vi, describe, it, expect, beforeEach } from 'vitest';
import { syncAndIngestEmails, generateEmailDigests } from './emailSummarizer';
import * as gmailModule from './gmail';

vi.mock('./gmail', () => ({
  getOrRefreshAccessToken: vi.fn(),
  fetchGmailMessages: vi.fn(),
  fetchGmailMessageDetail: vi.fn(),
  parseEmailBody: vi.fn(),
  getHeader: vi.fn(),
}));

describe('emailSummarizer', () => {
  let mockDb: any;
  let mockAi: any;
  let mockEnv: any;

  beforeEach(() => {
    vi.resetAllMocks();

    mockDb = {
      prepare: vi.fn().mockImplementation((sql: string) => {
        const stmt = {
          bind: vi.fn().mockImplementation((...args: any[]) => {
            stmt._boundArgs = args;
            return stmt;
          }),
          all: vi.fn().mockResolvedValue({ results: [] }),
          first: vi.fn().mockResolvedValue(null),
          run: vi.fn().mockResolvedValue({ success: true }),
          _boundArgs: [] as any[],
        };
        return stmt;
      }),
    };

    mockAi = {
      run: vi.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                digests: [
                  {
                    category: 'Macroeconomy',
                    summary: 'สรุปภาวะเศรษฐกิจและการลงทุน...',
                    key_takeaways: ['ประเด็นสำคัญที่ 1', 'ประเด็นสำคัญที่ 2'],
                  },
                ],
              }),
            },
          },
        ],
      }),
    };

    mockEnv = {
      DB: mockDb,
      AI: mockAi,
      GOOGLE_CLIENT_ID: 'test-client-id',
      GOOGLE_CLIENT_SECRET: 'test-client-secret',
      JWT_SECRET: 'test-jwt-secret',
      default_ai_model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    };
  });

  describe('syncAndIngestEmails', () => {
    it('returns 0 if Google client credentials are not configured', async () => {
      const envWithoutCreds = { ...mockEnv, GOOGLE_CLIENT_ID: undefined };
      const count = await syncAndIngestEmails(envWithoutCreds);
      expect(count).toBe(0);
    });

    it('returns 0 if Gmail access token cannot be obtained', async () => {
      vi.mocked(gmailModule.getOrRefreshAccessToken).mockResolvedValue(null);
      const count = await syncAndIngestEmails(mockEnv);
      expect(count).toBe(0);
    });

    it('builds query with newer_than:2d and without is:unread for standard subscriptions', async () => {
      vi.mocked(gmailModule.getOrRefreshAccessToken).mockResolvedValue('valid-token');

      // Mock subscriptions query
      const subStmt = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({
          results: [
            {
              id: 1,
              name: 'Sub 1',
              sender: 'newsletter@example.com',
              subject_filter: 'Daily Update',
              label_filter: null,
              raw_query: null,
            },
          ],
        }),
        first: vi.fn(),
        run: vi.fn(),
      };

      // Mock exists query
      const existsStmt = {
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null),
        all: vi.fn(),
        run: vi.fn(),
      };

      // Mock insert query
      const insertStmt = {
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }),
        all: vi.fn(),
        first: vi.fn(),
      };

      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('FROM email_subscriptions')) return subStmt;
        if (sql.includes('FROM ingested_emails WHERE id')) return existsStmt;
        if (sql.includes('INSERT INTO ingested_emails')) return insertStmt;
        return { bind: vi.fn().mockReturnThis(), all: vi.fn(), first: vi.fn(), run: vi.fn() };
      });

      vi.mocked(gmailModule.fetchGmailMessages).mockResolvedValue([{ id: 'msg-1', threadId: 'thread-1' }]);
      vi.mocked(gmailModule.fetchGmailMessageDetail).mockResolvedValue({
        id: 'msg-1',
        internalDate: '1700000000000',
        payload: { headers: [] },
      } as any);
      vi.mocked(gmailModule.getHeader).mockImplementation((headers, name) => {
        if (name === 'subject') return 'Daily Update';
        if (name === 'from') return 'newsletter@example.com';
        return '';
      });
      vi.mocked(gmailModule.parseEmailBody).mockReturnValue('<p>Hello World</p>');

      const count = await syncAndIngestEmails(mockEnv);

      expect(gmailModule.fetchGmailMessages).toHaveBeenCalledWith(
        'valid-token',
        'from:newsletter@example.com subject:(Daily Update) newer_than:2d'
      );
      expect(count).toBe(1);
      expect(insertStmt.run).toHaveBeenCalled();
    });

    it('uses raw_query directly when provided in subscription', async () => {
      vi.mocked(gmailModule.getOrRefreshAccessToken).mockResolvedValue('valid-token');

      const subStmt = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({
          results: [
            {
              id: 2,
              name: 'Sub Custom',
              sender: null,
              subject_filter: null,
              label_filter: null,
              raw_query: 'from:special@news.com has:attachment',
            },
          ],
        }),
      };

      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('FROM email_subscriptions')) return subStmt;
        return { bind: vi.fn().mockReturnThis(), all: vi.fn().mockResolvedValue({ results: [] }), first: vi.fn().mockResolvedValue(null), run: vi.fn() };
      });

      vi.mocked(gmailModule.fetchGmailMessages).mockResolvedValue([]);

      await syncAndIngestEmails(mockEnv);

      expect(gmailModule.fetchGmailMessages).toHaveBeenCalledWith(
        'valid-token',
        'from:special@news.com has:attachment'
      );
    });

    it('skips already ingested emails by message id deduplication', async () => {
      vi.mocked(gmailModule.getOrRefreshAccessToken).mockResolvedValue('valid-token');

      const subStmt = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({
          results: [{ id: 1, name: 'Sub 1', sender: 'test@example.com', raw_query: null }],
        }),
      };

      const existsStmt = {
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({ 1: 1 }), // Exists
      };

      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('FROM email_subscriptions')) return subStmt;
        if (sql.includes('FROM ingested_emails WHERE id')) return existsStmt;
        return { bind: vi.fn().mockReturnThis(), all: vi.fn(), first: vi.fn(), run: vi.fn() };
      });

      vi.mocked(gmailModule.fetchGmailMessages).mockResolvedValue([{ id: 'msg-already-exists', threadId: 'thread-already' }]);

      const count = await syncAndIngestEmails(mockEnv);

      expect(count).toBe(0);
      expect(gmailModule.fetchGmailMessageDetail).not.toHaveBeenCalled();
    });
  });

  describe('generateEmailDigests', () => {
    it('returns early when there are no active email subscriptions', async () => {
      const emptySubsStmt = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [] }),
      };

      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('FROM email_subscriptions')) return emptySubsStmt;
        return { bind: vi.fn().mockReturnThis(), all: vi.fn() };
      });

      await generateEmailDigests(mockEnv);

      expect(mockAi.run).not.toHaveBeenCalled();
    });

    it('enforces FIFO queue and throttles to LIMIT 1 email per cycle', async () => {
      let querySql = '';
      const subsStmt = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [{ id: 1 }, { id: 2 }] }),
      };

      const emailsStmt = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({
          results: [
            {
              id: 'email-oldest',
              subscription_id: 1,
              sender: 'analyst@bloomberg.com',
              subject: 'Market Close',
              body_text: 'Summary of the day...',
              received_at: '2026-10-01T01:00:00Z',
              processed: 0,
            },
          ],
        }),
      };

      const insertDigestStmt = {
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }),
      };

      const markProcessedStmt = {
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }),
      };

      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('FROM email_subscriptions')) return subsStmt;
        if (sql.includes('FROM ingested_emails WHERE processed = 0')) {
          querySql = sql;
          return emailsStmt;
        }
        if (sql.includes('INSERT INTO email_digests')) return insertDigestStmt;
        if (sql.includes('UPDATE ingested_emails SET processed = 1')) return markProcessedStmt;
        return { bind: vi.fn().mockReturnThis(), all: vi.fn(), run: vi.fn() };
      });

      await generateEmailDigests(mockEnv);

      // Verify FIFO ordering and LIMIT 1 in the executed SQL
      expect(querySql).toContain('ORDER BY received_at ASC LIMIT 1');
      expect(mockAi.run).toHaveBeenCalledTimes(1);
      expect(insertDigestStmt.run).toHaveBeenCalledTimes(1);
      expect(markProcessedStmt.run).toHaveBeenCalledTimes(1);
    });

    it('does nothing when no unprocessed emails are in queue', async () => {
      const subsStmt = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [{ id: 1 }] }),
      };

      const emailsStmt = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [] }),
      };

      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('FROM email_subscriptions')) return subsStmt;
        if (sql.includes('FROM ingested_emails WHERE processed = 0')) return emailsStmt;
        return { bind: vi.fn().mockReturnThis(), all: vi.fn() };
      });

      await generateEmailDigests(mockEnv);

      expect(mockAi.run).not.toHaveBeenCalled();
    });
  });
});
