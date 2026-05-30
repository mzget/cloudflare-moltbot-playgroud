// backend/src/gmail.ts
import { D1Database } from '@cloudflare/workers-types';

export function getAuthUrl(clientId: string, redirectUri: string): string {
  const scopes = ['https://www.googleapis.com/auth/gmail.readonly'];
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes.join(' '),
    access_type: 'offline',
    prompt: 'consent',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export interface OAuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export async function exchangeCodeForTokens(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<OAuthTokens> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google token exchange failed: ${response.statusText} - ${errorText}`);
  }

  return await response.json() as OAuthTokens;
}

export async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<{ access_token: string; expires_in: number; refresh_token?: string }> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google token refresh failed: ${response.statusText} - ${errorText}`);
  }

  return await response.json() as any;
}

export async function getOrRefreshAccessToken(
  db: D1Database,
  clientId: string,
  clientSecret: string
): Promise<string | null> {
  const oauthRow = await db.prepare(
    'SELECT access_token, refresh_token, expiry_date FROM gmail_oauth WHERE id = ?'
  ).bind('default').first() as { access_token: string; refresh_token: string; expiry_date: number } | null;

  if (!oauthRow) {
    return null;
  }

  const { access_token, refresh_token, expiry_date } = oauthRow;
  const now = Date.now();

  // If token is still valid (with a 5-minute buffer)
  if (now < expiry_date - 5 * 60 * 1000) {
    return access_token;
  }

  // Token is expired or expiring soon, refresh it
  try {
    const refreshed = await refreshAccessToken(refresh_token, clientId, clientSecret);
    const newExpiry = Date.now() + refreshed.expires_in * 1000;
    
    // Sometimes Google doesn't return a new refresh token if it's still valid
    const finalRefreshToken = refreshed.refresh_token || refresh_token;

    await db.prepare(
      'UPDATE gmail_oauth SET access_token = ?, refresh_token = ?, expiry_date = ?, updated_at = (strftime(\'%s\', \'now\')) WHERE id = ?'
    ).bind(refreshed.access_token, finalRefreshToken, newExpiry, 'default').run();

    return refreshed.access_token;
  } catch (error) {
    console.error('Failed to auto-refresh access token:', error);
    return null;
  }
}

export async function fetchGmailMessages(
  accessToken: string,
  query: string
): Promise<Array<{ id: string; threadId: string }>> {
  const params = new URLSearchParams({
    q: query,
    maxResults: '20', // Limit to 20 per sync
  });

  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gmail fetch messages failed: ${response.statusText} - ${errorText}`);
  }

  const data = await response.json() as { messages?: Array<{ id: string; threadId: string }> };
  return data.messages || [];
}

export async function fetchGmailMessageDetail(
  accessToken: string,
  messageId: string
): Promise<any> {
  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gmail fetch message detail failed: ${response.statusText} - ${errorText}`);
  }

  return await response.json();
}

function decodeBase64Url(base64Url: string): string {
  let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  try {
    return Buffer.from(base64, 'base64').toString('utf-8');
  } catch (e) {
    // fallback if Buffer fails in some environments
    return decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
  }
}

export function parseEmailBody(payload: any): string {
  if (!payload) return '';
  if (payload.body && payload.body.data) {
    return decodeBase64Url(payload.body.data);
  }
  if (payload.parts) {
    let htmlBody = '';
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body && part.body.data) {
        return decodeBase64Url(part.body.data);
      }
      if (part.mimeType === 'text/html' && part.body && part.body.data) {
        htmlBody = decodeBase64Url(part.body.data);
      }
      if (part.parts) {
        const body = parseEmailBody(part);
        if (body) return body;
      }
    }
    if (htmlBody) return htmlBody;
  }
  return '';
}

export function getHeader(headers: Array<{ name: string; value: string }>, name: string): string {
  const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
  return header ? header.value : '';
}
