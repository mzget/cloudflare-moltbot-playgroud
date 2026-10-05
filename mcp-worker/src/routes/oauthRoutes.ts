import {
  getProtectedResourceMetadata,
  getAuthorizationServerMetadata,
  createAuthCode,
  verifyAuthCode,
  createAccessToken,
  extractClientCredentials,
  isAllowedRedirectUri,
  renderAuthorizeHtml,
  computeSha256Base64Url,
} from "../oauth";
import { OAUTH_CORS_HEADERS, jsonResponse, parseBodyParams } from "../http";

const optionsResponse = () => new Response(null, { headers: OAUTH_CORS_HEADERS });

const oauthError = (error: string, description: string, status: number) =>
  jsonResponse({ error, error_description: description }, status, OAUTH_CORS_HEADERS);

const textError = (message: string, status: number) =>
  new Response(message, { status, headers: OAUTH_CORS_HEADERS });

function handleMetadata(request: Request, body: unknown): Response {
  if (request.method === "OPTIONS") return optionsResponse();
  return jsonResponse(body, 200, OAUTH_CORS_HEADERS);
}

function handleAuthorizeGet(url: URL, expectedClientId: string): Response {
  const clientId = url.searchParams.get("client_id") || "";
  const redirectUri = url.searchParams.get("redirect_uri") || "";

  if (clientId !== expectedClientId) {
    return textError(`Invalid client_id: ${clientId}. Expected: ${expectedClientId}`, 400);
  }
  if (!isAllowedRedirectUri(redirectUri)) {
    return textError(`Invalid redirect_uri: ${redirectUri}`, 400);
  }

  const html = renderAuthorizeHtml({
    clientId,
    redirectUri,
    state: url.searchParams.get("state") || "",
    codeChallenge: url.searchParams.get("code_challenge") || "",
    codeChallengeMethod: url.searchParams.get("code_challenge_method") || "",
  });

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", ...OAUTH_CORS_HEADERS },
  });
}

async function handleAuthorizePost(
  request: Request,
  url: URL,
  expectedClientId: string,
  secret: string
): Promise<Response> {
  const params = await parseBodyParams(request);
  const pick = (key: string) => params[key] || url.searchParams.get(key);

  const clientId = pick("client_id") || "";
  const redirectUri = pick("redirect_uri") || "";
  const state = pick("state") || "";
  const codeChallenge = pick("code_challenge") || undefined;
  const codeChallengeMethod = pick("code_challenge_method") || undefined;

  if (clientId !== expectedClientId) {
    return textError(`Invalid client_id: ${clientId}`, 400);
  }
  if (!isAllowedRedirectUri(redirectUri)) {
    return textError(`Invalid redirect_uri: ${redirectUri}`, 400);
  }

  const code = await createAuthCode(
    { clientId, redirectUri, codeChallenge, codeChallengeMethod },
    secret
  );

  const targetUrl = new URL(redirectUri);
  targetUrl.searchParams.set("code", code);
  if (state) {
    targetUrl.searchParams.set("state", state);
  }

  return Response.redirect(targetUrl.toString(), 302);
}

async function handleAuthorize(request: Request, env: any, url: URL): Promise<Response | null> {
  if (request.method === "OPTIONS") return optionsResponse();

  const expectedClientId = env.OAUTH_CLIENT_ID || "oaktree-gemini";
  const secret = env.OAUTH_CLIENT_SECRET || env.MCP_SECRET;

  if (request.method === "GET") return handleAuthorizeGet(url, expectedClientId);
  if (request.method === "POST") return handleAuthorizePost(request, url, expectedClientId, secret);
  return null;
}

async function handleToken(request: Request, env: any): Promise<Response> {
  if (request.method === "OPTIONS") return optionsResponse();
  if (request.method !== "POST") return textError("Method Not Allowed", 405);

  const bodyParams = await parseBodyParams(request);

  const creds = extractClientCredentials(request, bodyParams);
  const expectedClientId = env.OAUTH_CLIENT_ID || "oaktree-gemini";
  const expectedSecret = env.OAUTH_CLIENT_SECRET || env.MCP_SECRET;

  if (!creds || creds.clientId !== expectedClientId || creds.clientSecret !== expectedSecret) {
    return oauthError("invalid_client", "Invalid client_id or client_secret", 401);
  }

  if (bodyParams.grant_type !== "authorization_code") {
    return oauthError("unsupported_grant_type", "Only authorization_code is supported", 400);
  }

  const { code, redirect_uri: redirectUri, code_verifier: codeVerifier } = bodyParams;

  if (!code) {
    return oauthError("invalid_request", "Missing authorization code", 400);
  }

  const authPayload = await verifyAuthCode(code, expectedSecret);
  if (!authPayload || authPayload.clientId !== creds.clientId) {
    return oauthError("invalid_grant", "Authorization code is invalid or expired", 400);
  }

  if (redirectUri && authPayload.redirectUri !== redirectUri) {
    return oauthError("invalid_grant", "redirect_uri mismatch", 400);
  }

  // PKCE verification
  if (authPayload.codeChallenge) {
    if (!codeVerifier) {
      return oauthError("invalid_request", "code_verifier required for PKCE", 400);
    }
    const computed = await computeSha256Base64Url(codeVerifier);
    if (computed !== authPayload.codeChallenge) {
      return oauthError("invalid_grant", "code_verifier mismatch", 400);
    }
  }

  const accessToken = await createAccessToken(creds.clientId, expectedSecret);

  return jsonResponse(
    {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: 2592000,
      scope: "mcp",
    },
    200,
    OAUTH_CORS_HEADERS
  );
}

/** Handles OAuth/RFC discovery routes. Returns null when the path is not an OAuth route. */
export async function handleOAuthRoute(request: Request, env: any, url: URL): Promise<Response | null> {
  const baseUrl = `${url.protocol}//${url.host}`;

  switch (url.pathname) {
    case "/.well-known/oauth-protected-resource":
      return handleMetadata(request, getProtectedResourceMetadata(baseUrl));
    case "/.well-known/oauth-authorization-server":
      return handleMetadata(request, getAuthorizationServerMetadata(baseUrl));
    case "/oauth/authorize":
      return handleAuthorize(request, env, url);
    case "/oauth/token":
      return handleToken(request, env);
    default:
      return null;
  }
}

