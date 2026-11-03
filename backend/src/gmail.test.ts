import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getOrRefreshAccessToken, refreshAccessToken } from './gmail';
import { encryptToken } from './auth';

describe('gmail OAuth token management', () => {
  const jwtSecret = 'test-jwt-secret-key-123456';
  const clientId = 'test-client-id';
  const clientSecret = 'test-client-secret';
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('returns null when no row exists in gmail_oauth', async () => {
    const mockDb: any = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null),
        }),
      }),
    };

    const token = await getOrRefreshAccessToken(mockDb, clientId, clientSecret, jwtSecret);
    expect(token).toBeNull();
  });

  it('returns decrypted access_token directly when not expired', async () => {
    const encAccess = await encryptToken('valid-access-token', jwtSecret);
    const encRefresh = await encryptToken('valid-refresh-token', jwtSecret);
    const futureExpiry = Date.now() + 3600 * 1000;

    const mockDb: any = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({
            access_token: encAccess,
            refresh_token: encRefresh,
            expiry_date: futureExpiry,
          }),
        }),
      }),
    };

    const token = await getOrRefreshAccessToken(mockDb, clientId, clientSecret, jwtSecret);
    expect(token).toBe('valid-access-token');
  });

  it('refreshes token and updates gmail_oauth when expired', async () => {
    const encAccess = await encryptToken('expired-access-token', jwtSecret);
    const encRefresh = await encryptToken('valid-refresh-token', jwtSecret);
    const pastExpiry = Date.now() - 1000;

    const updateRun = vi.fn().mockResolvedValue({ success: true });
    const mockDb: any = {
      prepare: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('SELECT access_token')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue({
                access_token: encAccess,
                refresh_token: encRefresh,
                expiry_date: pastExpiry,
              }),
            }),
          };
        }
        if (sql.includes('UPDATE gmail_oauth')) {
          return {
            bind: vi.fn().mockReturnValue({
              run: updateRun,
            }),
          };
        }
        return { bind: vi.fn().mockReturnThis(), run: vi.fn() };
      }),
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        access_token: 'new-refreshed-access-token',
        expires_in: 3599,
      }),
    } as any);

    const token = await getOrRefreshAccessToken(mockDb, clientId, clientSecret, jwtSecret);
    expect(token).toBe('new-refreshed-access-token');
    expect(updateRun).toHaveBeenCalledTimes(1);
  });

  it('deletes stale gmail_oauth row and invokes onAuthInvalidated when refresh fails with invalid_grant', async () => {
    const encAccess = await encryptToken('expired-access-token', jwtSecret);
    const encRefresh = await encryptToken('revoked-refresh-token', jwtSecret);
    const pastExpiry = Date.now() - 1000;

    const deleteRun = vi.fn().mockResolvedValue({ success: true });
    const deleteBind = vi.fn().mockReturnValue({ run: deleteRun });

    const mockDb: any = {
      prepare: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('SELECT access_token')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue({
                access_token: encAccess,
                refresh_token: encRefresh,
                expiry_date: pastExpiry,
              }),
            }),
          };
        }
        if (sql.includes('DELETE FROM gmail_oauth')) {
          return {
            bind: deleteBind,
          };
        }
        return { bind: vi.fn().mockReturnThis(), run: vi.fn() };
      }),
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      text: vi.fn().mockResolvedValue('{"error":"invalid_grant","error_description":"Token has been expired or revoked."}'),
    } as any);

    const onAuthInvalidated = vi.fn().mockResolvedValue(undefined);
    const token = await getOrRefreshAccessToken(
      mockDb,
      clientId,
      clientSecret,
      jwtSecret,
      onAuthInvalidated
    );

    expect(token).toBeNull();
    expect(deleteBind).toHaveBeenCalledWith('default');
    expect(deleteRun).toHaveBeenCalledTimes(1);
    expect(onAuthInvalidated).toHaveBeenCalledTimes(1);
    expect(onAuthInvalidated).toHaveBeenCalledWith(expect.stringContaining('invalid_grant'));
  });

  it('does not delete gmail_oauth row on transient 500 server error during refresh', async () => {
    const encAccess = await encryptToken('expired-access-token', jwtSecret);
    const encRefresh = await encryptToken('valid-refresh-token', jwtSecret);
    const pastExpiry = Date.now() - 1000;

    const deleteRun = vi.fn();
    const mockDb: any = {
      prepare: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('SELECT access_token')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue({
                access_token: encAccess,
                refresh_token: encRefresh,
                expiry_date: pastExpiry,
              }),
            }),
          };
        }
        if (sql.includes('DELETE FROM gmail_oauth')) {
          return {
            bind: vi.fn().mockReturnValue({ run: deleteRun }),
          };
        }
        return { bind: vi.fn().mockReturnThis(), run: vi.fn() };
      }),
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      text: vi.fn().mockResolvedValue('Temporary backend error'),
    } as any);

    const onAuthInvalidated = vi.fn();
    const token = await getOrRefreshAccessToken(
      mockDb,
      clientId,
      clientSecret,
      jwtSecret,
      onAuthInvalidated
    );

    expect(token).toBeNull();
    expect(deleteRun).not.toHaveBeenCalled();
    expect(onAuthInvalidated).not.toHaveBeenCalled();
  });
});
