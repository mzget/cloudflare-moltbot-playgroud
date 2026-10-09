import { vi, describe, it, expect, beforeEach } from 'vitest';
import { syncAndIngestEmails, generateEmailDigests, isGibberishThai, sendDigestFailureAlert, parseAndValidateDigests } from './emailSummarizer';
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
      default_ai_model: '@cf/google/gemma-4-26b-a4b-it',
      facebook_summarize_model: '@cf/meta/llama-4-scout-17b-16e-instruct',
      ALERT_EMAIL: 'alert@example.com',
      EMAIL: {
        send: vi.fn().mockResolvedValue(undefined),
      },
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

    it('falls back to facebook_summarize_model immediately without retry when default_ai_model fails', async () => {
      const subsStmt = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [{ id: 1 }] }),
      };

      const emailsStmt = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({
          results: [
            {
              id: 'email-fallback-test',
              subscription_id: 1,
              sender: 'newsletter@invest.com',
              subject: 'Deep Dive',
              body_text: 'Content...',
              received_at: '2026-10-01T01:00:00Z',
              processed: 0,
            },
          ],
        }),
      };

      const markProcessedStmt = {
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }),
      };

      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('FROM email_subscriptions')) return subsStmt;
        if (sql.includes('FROM ingested_emails WHERE processed = 0')) return emailsStmt;
        if (sql.includes('INSERT INTO email_digests')) return { bind: vi.fn().mockReturnThis(), run: vi.fn().mockResolvedValue({ success: true }) };
        if (sql.includes('UPDATE ingested_emails SET processed = 1')) return markProcessedStmt;
        return { bind: vi.fn().mockReturnThis(), all: vi.fn(), run: vi.fn() };
      });

      // Fail default_ai_model once, then succeed on fallback model immediately
      mockAi.run
        .mockRejectedValueOnce(new Error('AiError: Service temporarily at capacity'))
        .mockResolvedValueOnce({
          response: JSON.stringify({
            digests: [
              {
                category: 'Technology & AI',
                summary: 'สรุปจากโมเดลสำรอง',
                key_takeaways: ['ข้อคิดที่ 1'],
                source_emails: ['email-fallback-test'],
              },
            ],
          }),
        });

      await generateEmailDigests(mockEnv);

      // Verify it called primary once, then fallback once (total 2 calls without retry)
      expect(mockAi.run).toHaveBeenCalledTimes(2);
      expect(mockAi.run).toHaveBeenNthCalledWith(
        1,
        '@cf/google/gemma-4-26b-a4b-it',
        expect.objectContaining({ max_tokens: 4096 })
      );
      expect(mockAi.run).toHaveBeenNthCalledWith(
        2,
        '@cf/meta/llama-4-scout-17b-16e-instruct',
        expect.objectContaining({ max_tokens: 4096 })
      );
      expect(markProcessedStmt.run).toHaveBeenCalledTimes(1);
      // No alert email should be sent when fallback succeeds
      expect(mockEnv.EMAIL.send).not.toHaveBeenCalled();
    });

    it('marks email as failed (processed = -1) and sends alert email to ALERT_EMAIL when both models fail', async () => {
      const subsStmt = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [{ id: 1 }] }),
      };

      const emailsStmt = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({
          results: [
            {
              id: '1a0ddeaacc54ff5e',
              subscription_id: 1,
              sender: 'bad@format.com',
              subject: 'Corrupted',
              body_text: 'Corrupted body...',
              received_at: '2026-10-01T01:00:00Z',
              processed: 0,
            },
          ],
        }),
      };

      const markFailedStmt = {
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }),
      };

      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('FROM email_subscriptions')) return subsStmt;
        if (sql.includes('FROM ingested_emails WHERE processed = 0')) return emailsStmt;
        if (sql.includes('UPDATE ingested_emails SET processed = -1')) return markFailedStmt;
        return { bind: vi.fn().mockReturnThis(), all: vi.fn(), run: vi.fn() };
      });

      mockAi.run.mockRejectedValue(new Error('Cloudflare internal error'));

      await generateEmailDigests(mockEnv);

      // Verify each model was called exactly once without retry
      expect(mockAi.run).toHaveBeenCalledTimes(2);
      expect(markFailedStmt.bind).toHaveBeenCalledWith('1a0ddeaacc54ff5e');
      expect(markFailedStmt.run).toHaveBeenCalledTimes(1);

      // Verify alert email was sent
      expect(mockEnv.EMAIL.send).toHaveBeenCalledTimes(1);
    });

    it('marks email as failed (processed = -1) and sends alert email when AI response contains no JSON structure across models', async () => {
      const subsStmt = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [{ id: 1 }] }),
      };

      const emailsStmt = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({
          results: [
            {
              id: 'email-no-json',
              subscription_id: 1,
              sender: 'test@example.com',
              subject: 'No JSON',
              body_text: 'Body...',
              received_at: '2026-10-01T01:00:00Z',
              processed: 0,
            },
          ],
        }),
      };

      const markFailedStmt = {
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }),
      };

      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('FROM email_subscriptions')) return subsStmt;
        if (sql.includes('FROM ingested_emails WHERE processed = 0')) return emailsStmt;
        if (sql.includes('UPDATE ingested_emails SET processed = -1')) return markFailedStmt;
        return { bind: vi.fn().mockReturnThis(), all: vi.fn(), run: vi.fn() };
      });

      mockAi.run.mockResolvedValue({ response: 'I am sorry, I cannot output JSON for this prompt.' });

      await generateEmailDigests(mockEnv);

      expect(mockAi.run).toHaveBeenCalledTimes(2);
      expect(markFailedStmt.bind).toHaveBeenCalledWith('email-no-json');
      expect(markFailedStmt.run).toHaveBeenCalledTimes(1);
      expect(mockEnv.EMAIL.send).toHaveBeenCalledTimes(1);
    });

    it('rejects AI response with gibberish/corrupted Thai text across models and sends alert email', async () => {
      const subsStmt = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [{ id: 1 }] }),
      };

      const emailsStmt = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({
          results: [
            {
              id: 'email-gibberish',
              subscription_id: 1,
              sender: 'test@example.com',
              subject: 'Agentic AI: Winners and Losers',
              body_text: 'Body...',
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

      const markFailedStmt = {
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }),
      };

      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('FROM email_subscriptions')) return subsStmt;
        if (sql.includes('FROM ingested_emails WHERE processed = 0')) return emailsStmt;
        if (sql.includes('INSERT INTO email_digests')) return insertDigestStmt;
        if (sql.includes('UPDATE ingested_emails SET processed = -1')) return markFailedStmt;
        return { bind: vi.fn().mockReturnThis(), all: vi.fn(), run: vi.fn() };
      });

      mockAi.run.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                digests: [
                  {
                    category: 'Technology & AI',
                    summary: 'ส็ายนราผ สหาปนาสรัาหปมา สอาบาสหฬามรัา บหาสาหฬาสาอาสารัา.',
                    key_takeaways: ['สาสหาสาสาฬารัา สอารัามา สาหาสาฬารัามา.'],
                    source_emails: ['email-gibberish'],
                  },
                ],
              }),
            },
          },
        ],
      });

      await generateEmailDigests(mockEnv);

      expect(mockAi.run).toHaveBeenCalledTimes(2);
      expect(insertDigestStmt.run).not.toHaveBeenCalled();
      expect(markFailedStmt.bind).toHaveBeenCalledWith('email-gibberish');
      expect(markFailedStmt.run).toHaveBeenCalledTimes(1);
      expect(mockEnv.EMAIL.send).toHaveBeenCalledTimes(1);
    });

    it('handles failure alert email gracefully when EMAIL binding is missing', async () => {
      const subsStmt = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [{ id: 1 }] }),
      };

      const emailsStmt = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({
          results: [
            {
              id: 'email-no-email-binding',
              subscription_id: 1,
              sender: 'test@example.com',
              subject: 'No Binding',
              body_text: 'Body...',
              received_at: '2026-10-01T01:00:00Z',
              processed: 0,
            },
          ],
        }),
      };

      const markFailedStmt = {
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }),
      };

      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('FROM email_subscriptions')) return subsStmt;
        if (sql.includes('FROM ingested_emails WHERE processed = 0')) return emailsStmt;
        if (sql.includes('UPDATE ingested_emails SET processed = -1')) return markFailedStmt;
        return { bind: vi.fn().mockReturnThis(), all: vi.fn(), run: vi.fn() };
      });

      mockAi.run.mockRejectedValue(new Error('AI failure'));

      const envWithoutEmail = { ...mockEnv, EMAIL: undefined };
      await generateEmailDigests(envWithoutEmail);

      expect(markFailedStmt.run).toHaveBeenCalledTimes(1);
    });

    it('handles failure alert email gracefully when EMAIL.send throws', async () => {
      const subsStmt = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [{ id: 1 }] }),
      };

      const emailsStmt = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({
          results: [
            {
              id: 'email-send-fail',
              subscription_id: 1,
              sender: 'test@example.com',
              subject: 'Send Fail',
              body_text: 'Body...',
              received_at: '2026-10-01T01:00:00Z',
              processed: 0,
            },
          ],
        }),
      };

      const markFailedStmt = {
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }),
      };

      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('FROM email_subscriptions')) return subsStmt;
        if (sql.includes('FROM ingested_emails WHERE processed = 0')) return emailsStmt;
        if (sql.includes('UPDATE ingested_emails SET processed = -1')) return markFailedStmt;
        return { bind: vi.fn().mockReturnThis(), all: vi.fn(), run: vi.fn() };
      });

      mockAi.run.mockRejectedValue(new Error('AI failure'));

      const envWithThrowingEmail = {
        ...mockEnv,
        EMAIL: {
          send: vi.fn().mockRejectedValue(new Error('SMTP connection failed')),
        },
      };

      await generateEmailDigests(envWithThrowingEmail);

      expect(markFailedStmt.run).toHaveBeenCalledTimes(1);
    });
  });

  describe('isGibberishThai', () => {
    it('returns false for null, undefined, empty, or non-string inputs', () => {
      expect(isGibberishThai('')).toBe(false);
      expect(isGibberishThai(null as any)).toBe(false);
      expect(isGibberishThai(undefined as any)).toBe(false);
      expect(isGibberishThai(123 as any)).toBe(false);
    });

    it('returns false for coherent, well-formed Thai sentences', () => {
      const normalThai1 = 'จดหมายข่าวฉบับนี้เน้นย้ำถึงเทรนด์ใหม่ในโลกของ AI ที่เรียกว่า Decision Models';
      const normalThai2 = 'การลงทุนในหุ้นกลุ่มเติบโตมีความเสี่ยงสูงต่อการถูกลดมูลค่าหากดอกเบี้ยเป็นขาขึ้น';
      expect(isGibberishThai(normalThai1)).toBe(false);
      expect(isGibberishThai(normalThai2)).toBe(false);
    });

    it('returns true when text contains invalid vowel combination Mai Han-Akat + Sara Aa (ัา)', () => {
      const invalidOrthography = 'สรัาหปมา สอาบาสหฬามรัา';
      expect(isGibberishThai(invalidOrthography)).toBe(true);
    });

    it('returns true when text contains looping token repetitions', () => {
      const loopingRepetition = 'สาหาสาฬารัามาสาหาอารัามาสาหาอารัามาสาหาอารัามา';
      expect(isGibberishThai(loopingRepetition)).toBe(true);
    });

    it('returns true for stacked impossible vowel marks', () => {
      const stackedVowels = 'คำที่มีสระซ้อนกันเกินไป \u0E31\u0E34\u0E35';
      expect(isGibberishThai(stackedVowels)).toBe(true);
    });
  });
});

