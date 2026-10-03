import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { exchangeCodeForTokens } from '../gmail';
import { fetchGoogleUserProfile, isEmailAuthorized, signJwt, getUserLoginAuthUrl } from '../auth';

const userAuth = new Hono<AppEnv>();


// API: Google OAuth for User Login URL
userAuth.get('/api/auth/user/login-url', async (c) => {
  const clientId = c.env.GOOGLE_CLIENT_ID;
  const redirectUri = c.req.query('redirect_uri');
  if (!clientId || !redirectUri) {
    return c.text('Missing client_id configuration or redirect_uri parameter', 400);
  }
  const authUrl = getUserLoginAuthUrl(clientId, redirectUri);
  return c.json({ url: authUrl });
});

// API: Google OAuth Callback for User Login
userAuth.post('/api/auth/user/callback', async (c) => {
  try {
    const { code, redirect_uri } = await c.req.json() as any;
    const clientId = c.env.GOOGLE_CLIENT_ID;
    const clientSecret = c.env.GOOGLE_CLIENT_SECRET;
    const jwtSecret = c.env.JWT_SECRET;
    if (!jwtSecret && c.env.IS_LOCAL !== 'true') {
      return c.text('JWT Secret is not configured', 500);
    }
    if (!clientId || !clientSecret || !code || !redirect_uri) {
      return c.text('Missing configuration, code, or redirect_uri', 400);
    }
    const tokens = await exchangeCodeForTokens(code, clientId, clientSecret, redirect_uri);
    const profile = await fetchGoogleUserProfile(tokens.access_token);

    if (!profile.email) {
      return c.text('Failed to retrieve email from Google profile', 400);
    }

    // Email check
    const allowedEmails = c.env.ALLOWED_EMAILS;
    if (!isEmailAuthorized(profile.email, allowedEmails)) {
      return c.text('Forbidden: Your email is not authorized to access this site', 403);
    }

    // Generate session JWT (valid for 7 days)
    const sessionPayload = {
      email: profile.email,
      name: profile.name,
      picture: profile.picture,
      exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)
    };

    const token = await signJwt(sessionPayload, jwtSecret || '');
    return c.json({
      success: true,
      token,
      user: {
        email: profile.email,
        name: profile.name,
        picture: profile.picture
      }
    });
  } catch (e) {
    return c.text(`User authentication failed: ${(e as any).message}`, 500);
  }
});

// API: Get Current Authenticated User Info
userAuth.get('/api/auth/user/me', async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.text('Unauthorized', 401);
  }
  return c.json({ user });
});

// API: Get User Preferences
userAuth.get('/api/user/preferences', async (c) => {
  const user = c.get('user');
  if (!user || !user.email) {
    return c.text('Unauthorized', 401);
  }

  try {
    const row = await c.env.DB.prepare(
      'SELECT theme, table_density, currency, exchange_rate, fundamental_columns FROM user_preferences WHERE email = ?'
    ).bind(user.email).first();

    if (row) {
      return c.json(row);
    } else {
      return c.json({
        theme: 'system',
        table_density: 'cozy',
        currency: 'USD',
        exchange_rate: 1.0,
        fundamental_columns: null
      });
    }
  } catch (e) {
    return c.json({ error: (e as any).message }, 500);
  }
});

// API: Update User Preferences
userAuth.put('/api/user/preferences', async (c) => {
  const user = c.get('user');
  if (!user || !user.email) {
    return c.text('Unauthorized', 401);
  }

  try {
    const body = await c.req.json() as any;
    const { theme, table_density, currency, exchange_rate, fundamental_columns } = body;

    // Validation
    if (theme && !['light', 'dark', 'system'].includes(theme)) {
      return c.text('Invalid theme setting', 400);
    }
    if (table_density && !['compact', 'cozy', 'comfort'].includes(table_density)) {
      return c.text('Invalid table density setting', 400);
    }
    if (exchange_rate !== undefined && (typeof exchange_rate !== 'number' || exchange_rate <= 0)) {
      return c.text('Invalid exchange rate', 400);
    }

    const current = await c.env.DB.prepare(
      'SELECT theme, table_density, currency, exchange_rate, fundamental_columns FROM user_preferences WHERE email = ?'
    ).bind(user.email).first() || {
      theme: 'system',
      table_density: 'cozy',
      currency: 'USD',
      exchange_rate: 1.0,
      fundamental_columns: null
    };

    const newTheme = theme !== undefined ? theme : current.theme;
    const newDensity = table_density !== undefined ? table_density : current.table_density;
    const newCurrency = currency !== undefined ? currency : current.currency;
    const newRate = exchange_rate !== undefined ? exchange_rate : current.exchange_rate;
    const newFundamentalColumns = fundamental_columns !== undefined
      ? (typeof fundamental_columns === 'string' ? fundamental_columns : JSON.stringify(fundamental_columns))
      : current.fundamental_columns;

    await c.env.DB.prepare(`
      INSERT INTO user_preferences (email, theme, table_density, currency, exchange_rate, fundamental_columns, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, strftime('%s', 'now'))
      ON CONFLICT(email) DO UPDATE SET
        theme = excluded.theme,
        table_density = excluded.table_density,
        currency = excluded.currency,
        exchange_rate = excluded.exchange_rate,
        fundamental_columns = excluded.fundamental_columns,
        updated_at = excluded.updated_at
    `).bind(user.email, newTheme, newDensity, newCurrency, newRate, newFundamentalColumns).run();

    return c.json({
      success: true,
      preferences: {
        theme: newTheme,
        table_density: newDensity,
        currency: newCurrency,
        exchange_rate: newRate,
        fundamental_columns: newFundamentalColumns
      }
    });
  } catch (e) {
    return c.json({ error: (e as any).message }, 500);
  }
});

export default userAuth;
