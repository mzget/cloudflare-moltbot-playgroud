import { McpAgent } from "agents/mcp";
// @ts-ignore
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getPortfolio, getPortfolioHistory, getKnowledgeByCategory, searchKnowledge, getLatestAnalysisReport, getWatchlist } from "./knowledge";
import { createWorkersAI } from "workers-ai-provider";
import { streamText, tool, convertToModelMessages, UIMessage } from "ai";
import { AIChatAgent } from "@cloudflare/ai-chat";
import { getAgentByName, routeAgentRequest, callable } from "agents";
import { validateMcpToken } from "./auth";
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
} from "./oauth";


export class OaktreeMCP extends McpAgent {
  server = new McpServer({ name: "oaktree-mcp", version: "1.0.0" });

  async init() {
    // Register MCP Tools
    this.server.tool(
      "get_portfolio",
      "Get all portfolio holdings, their weights, and investment thesis.",
      {},
      async () => {
        const data = await getPortfolio(this.env as any);
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
        };
      }
    );

    this.server.tool(
      "get_portfolio_history",
      "Get the yearly performance history of the portfolio.",
      {},
      async () => {
        const data = await getPortfolioHistory(this.env as any);
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
        };
      }
    );

    this.server.tool(
      "get_knowledge",
      "Get investment philosophy and frameworks by category (e.g., 'intelligent_investor', 'buffett_principles', 'five_forces').",
      { category: z.string() },
      async ({ category }: any) => {
        const data = await getKnowledgeByCategory(this.env as any, category);
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
        };
      }
    );

    this.server.tool(
      "search_knowledge",
      "Search the knowledge base for a specific term.",
      { query: z.string() },
      async ({ query }: any) => {
        const data = await searchKnowledge(this.env as any, query);
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
        };
      }
    );

    this.server.tool(
      "get_analysis_report",
      "Get the latest value investor deep analysis report for a stock symbol.",
      { symbol: z.string().describe("The stock symbol to fetch the analysis report for (e.g. AAPL)") },
      async ({ symbol }: any) => {
        const data = await getLatestAnalysisReport(this.env as any, symbol);
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
        };
      }
    );
  }
}

export class OaktreeChat extends AIChatAgent<any> {
  @callable()
  async deleteSession() {
    await this.destroy();
    return { success: true };
  }

  async onChatMessage(onFinish: any, options?: any) {
    const workersai = createWorkersAI({ binding: this.env.AI });
    const model = workersai(this.env.chat_ai_model);

    // Fetch portfolio and watchlist context dynamically so the model has real-time data
    let dataContext = "";
    try {
      const [holdings, watchlist] = await Promise.all([
        getPortfolio(this.env as any).catch(() => []),
        getWatchlist(this.env as any).catch(() => [])
      ]);

      if (holdings && Array.isArray(holdings) && holdings.length > 0) {
        dataContext += "\n\n[ข้อมูลพอร์ตการลงทุนปัจจุบันของผู้ใช้ (User's Current Portfolio)]:\n" +
          JSON.stringify(holdings.map((h: any) => ({
            symbol: h.symbol,
            shares: h.shares,
            avg_cost: h.avg_cost,
            current_price: h.current_price,
            current_value: h.current_value,
            unrealized_gain_loss_pct: h.unrealized_gain_loss_pct,
            target_weight: h.target_weight,
            thesis: h.thesis,
            category: h.category
          })), null, 2);
      }

      if (watchlist && Array.isArray(watchlist) && watchlist.length > 0) {
        dataContext += "\n\n[ข้อมูลหุ้นใน Watchlist ของผู้ใช้ (User's Watchlist)]:\n" +
          JSON.stringify(watchlist.map((w: any) => ({
            symbol: w.symbol,
            name: w.name,
            sector: w.sector,
            current_price: w.current_price,
            target_price: w.target_price,
            thesis: w.thesis
          })), null, 2);
      }
    } catch (err) {
      console.warn("Failed to fetch context for prompt:", err);
    }

    const systemPrompt = "คุณคือ Oaktree AI ผู้ช่วยวิเคราะห์ข้อมูลการลงทุนแบบเน้นคุณค่า (Value Investing) ตามหลักการลงทุนของ Warren Buffett, Charlie Munger, Howard Marks, Benjamin Graham, Peter Lynch และ Seth Klarman\n" +
      "หน้าที่ของคุณคือให้คำแนะนำ วิเคราะห์หุ้น พอร์ตการลงทุน และตอบคำถามด้านการลงทุนอย่างกระชับ ชัดเจน มีเหตุผลทางธุรกิจและหลักการลงทุนรองรับ\n" +
      "กฎข้อสำคัญอย่างยิ่ง:\n" +
      "1. ตอบคำถามเป็นภาษาไทยให้จบครบถ้วนในข้อความเดียวอย่างเป็นธรรมชาติ\n" +
      "2. ห้ามสร้างแท็กคำสั่งฟังก์ชัน เช่น <|tool_call|> หรือ SQL โค้ดหลอก ให้ตอบข้อมูลจากบริบทที่มีให้หรือความรู้ที่มีทันที\n" +
      "3. ใช้ markdown จัดหัวข้อ ตาราง หรือ bullet points ให้อ่านง่าย สวยงาม และน่าติดตาม\n" +
      dataContext;

    const result = streamText({
      model,
      messages: await convertToModelMessages(this.messages),
      system: systemPrompt,
      abortSignal: options?.abortSignal,
      onFinish,
    });

    return result.toUIMessageStreamResponse();
  }
}
// Helper functions for JWT verification inside the worker
function base64urlDecode(str: string): string {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const binString = atob(base64);
  const bytes = Uint8Array.from(binString, (m) => m.codePointAt(0)!);
  return new TextDecoder().decode(bytes);
}

async function verifyJwt(token: string, secret: string): Promise<any | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const encoder = new TextEncoder();
  const data = encoder.encode(`${encodedHeader}.${encodedPayload}`);
  
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    
    const signatureBytes = new Uint8Array(
      atob(encodedSignature.replace(/-/g, '+').replace(/_/g, '/'))
        .split('')
        .map(c => c.charCodeAt(0))
    );
    
    const isValid = await crypto.subtle.verify('HMAC', key, signatureBytes, data);
    if (!isValid) return null;
    
    const payload = JSON.parse(base64urlDecode(encodedPayload));
    if (payload.exp && Date.now() > payload.exp * 1000) {
      return null;
    }
    return payload;
  } catch (e) {
    return null;
  }
}

async function authenticateRequest(request: Request, env: any): Promise<{ email: string } | Response> {
  if (env.IS_LOCAL === 'true') {
    return { email: 'local@example.com' };
  }

  const url = new URL(request.url);
  let token = url.searchParams.get("token");

  if (!token) {
    const authHeader = request.headers.get("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7);
    }
  }

  if (!token) {
    return new Response("Unauthorized: Missing or invalid token format", { status: 401 });
  }

  const jwtSecret = env.JWT_SECRET || 'dev-secret-key-123456';
  
  const payload = await verifyJwt(token, jwtSecret);
  if (!payload || !payload.email) {
    return new Response("Unauthorized: Invalid or expired token", { status: 401 });
  }

  return { email: payload.email };
}

const mcpFetch = OaktreeMCP.serve("/mcp", { 
  binding: "OAKTREE_MCP",
  transport: "auto"
}).fetch;

export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext) {
    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}`;
    const oauthCorsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization, X-Requested-With",
    };

    // 1. RFC 9728: Protected Resource Metadata
    if (url.pathname === "/.well-known/oauth-protected-resource") {
      if (request.method === "OPTIONS") {
        return new Response(null, { headers: oauthCorsHeaders });
      }
      return new Response(JSON.stringify(getProtectedResourceMetadata(baseUrl)), {
        headers: {
          "Content-Type": "application/json",
          ...oauthCorsHeaders,
        },
      });
    }

    // 2. RFC 8414: Authorization Server Metadata
    if (url.pathname === "/.well-known/oauth-authorization-server") {
      if (request.method === "OPTIONS") {
        return new Response(null, { headers: oauthCorsHeaders });
      }
      return new Response(JSON.stringify(getAuthorizationServerMetadata(baseUrl)), {
        headers: {
          "Content-Type": "application/json",
          ...oauthCorsHeaders,
        },
      });
    }

    // 3. OAuth 2.0 Authorize Endpoint
    if (url.pathname === "/oauth/authorize") {
      if (request.method === "OPTIONS") {
        return new Response(null, { headers: oauthCorsHeaders });
      }

      const expectedClientId = env.OAUTH_CLIENT_ID || "oaktree-gemini";
      const secret = env.OAUTH_CLIENT_SECRET || env.MCP_SECRET;

      if (request.method === "GET") {
        const clientId = url.searchParams.get("client_id") || "";
        const redirectUri = url.searchParams.get("redirect_uri") || "";
        const state = url.searchParams.get("state") || "";
        const codeChallenge = url.searchParams.get("code_challenge") || "";
        const codeChallengeMethod = url.searchParams.get("code_challenge_method") || "";

        if (clientId !== expectedClientId) {
          return new Response(`Invalid client_id: ${clientId}. Expected: ${expectedClientId}`, {
            status: 400,
            headers: oauthCorsHeaders,
          });
        }

        if (!isAllowedRedirectUri(redirectUri)) {
          return new Response(`Invalid redirect_uri: ${redirectUri}`, {
            status: 400,
            headers: oauthCorsHeaders,
          });
        }

        const html = renderAuthorizeHtml({
          clientId,
          redirectUri,
          state,
          codeChallenge,
          codeChallengeMethod,
        });

        return new Response(html, {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            ...oauthCorsHeaders,
          },
        });
      }

      if (request.method === "POST") {
        let params: Record<string, string> = {};
        const contentType = request.headers.get("Content-Type") || "";
        if (contentType.includes("application/x-www-form-urlencoded")) {
          const text = await request.text();
          const searchParams = new URLSearchParams(text);
          searchParams.forEach((v, k) => {
            params[k] = v;
          });
        } else if (contentType.includes("application/json")) {
          params = (await request.json()) as any;
        }

        const clientId = params.client_id || url.searchParams.get("client_id") || "";
        const redirectUri = params.redirect_uri || url.searchParams.get("redirect_uri") || "";
        const state = params.state || url.searchParams.get("state") || "";
        const codeChallenge = params.code_challenge || url.searchParams.get("code_challenge") || undefined;
        const codeChallengeMethod = params.code_challenge_method || url.searchParams.get("code_challenge_method") || undefined;

        if (clientId !== expectedClientId) {
          return new Response(`Invalid client_id: ${clientId}`, { status: 400, headers: oauthCorsHeaders });
        }
        if (!isAllowedRedirectUri(redirectUri)) {
          return new Response(`Invalid redirect_uri: ${redirectUri}`, { status: 400, headers: oauthCorsHeaders });
        }

        const code = await createAuthCode(
          {
            clientId,
            redirectUri,
            codeChallenge,
            codeChallengeMethod,
          },
          secret
        );

        const targetUrl = new URL(redirectUri);
        targetUrl.searchParams.set("code", code);
        if (state) {
          targetUrl.searchParams.set("state", state);
        }

        return Response.redirect(targetUrl.toString(), 302);
      }
    }

    // 4. OAuth 2.0 Token Endpoint
    if (url.pathname === "/oauth/token") {
      if (request.method === "OPTIONS") {
        return new Response(null, { headers: oauthCorsHeaders });
      }

      if (request.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405, headers: oauthCorsHeaders });
      }

      let bodyParams: Record<string, string> = {};
      const contentType = request.headers.get("Content-Type") || "";
      if (contentType.includes("application/x-www-form-urlencoded")) {
        const text = await request.text();
        const searchParams = new URLSearchParams(text);
        searchParams.forEach((v, k) => {
          bodyParams[k] = v;
        });
      } else if (contentType.includes("application/json")) {
        bodyParams = (await request.json()) as any;
      }

      const creds = extractClientCredentials(request, bodyParams);
      const expectedClientId = env.OAUTH_CLIENT_ID || "oaktree-gemini";
      const expectedSecret = env.OAUTH_CLIENT_SECRET || env.MCP_SECRET;

      if (!creds || creds.clientId !== expectedClientId || creds.clientSecret !== expectedSecret) {
        return new Response(
          JSON.stringify({
            error: "invalid_client",
            error_description: "Invalid client_id or client_secret",
          }),
          {
            status: 401,
            headers: {
              "Content-Type": "application/json",
              ...oauthCorsHeaders,
            },
          }
        );
      }

      const grantType = bodyParams.grant_type;
      if (grantType !== "authorization_code") {
        return new Response(
          JSON.stringify({
            error: "unsupported_grant_type",
            error_description: "Only authorization_code is supported",
          }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              ...oauthCorsHeaders,
            },
          }
        );
      }

      const code = bodyParams.code;
      const redirectUri = bodyParams.redirect_uri;
      const codeVerifier = bodyParams.code_verifier;

      if (!code) {
        return new Response(
          JSON.stringify({
            error: "invalid_request",
            error_description: "Missing authorization code",
          }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              ...oauthCorsHeaders,
            },
          }
        );
      }

      const authPayload = await verifyAuthCode(code, expectedSecret);
      if (!authPayload || authPayload.clientId !== creds.clientId) {
        return new Response(
          JSON.stringify({
            error: "invalid_grant",
            error_description: "Authorization code is invalid or expired",
          }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              ...oauthCorsHeaders,
            },
          }
        );
      }

      if (redirectUri && authPayload.redirectUri !== redirectUri) {
        return new Response(
          JSON.stringify({
            error: "invalid_grant",
            error_description: "redirect_uri mismatch",
          }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              ...oauthCorsHeaders,
            },
          }
        );
      }

      // PKCE verification
      if (authPayload.codeChallenge) {
        if (!codeVerifier) {
          return new Response(
            JSON.stringify({
              error: "invalid_request",
              error_description: "code_verifier required for PKCE",
            }),
            {
              status: 400,
              headers: {
                "Content-Type": "application/json",
                ...oauthCorsHeaders,
              },
            }
          );
        }

        const computed = await computeSha256Base64Url(codeVerifier);
        if (computed !== authPayload.codeChallenge) {
          return new Response(
            JSON.stringify({
              error: "invalid_grant",
              error_description: "code_verifier mismatch",
            }),
            {
              status: 400,
              headers: {
                "Content-Type": "application/json",
                ...oauthCorsHeaders,
              },
            }
          );
        }
      }

      // Generate Access Token
      const accessToken = await createAccessToken(creds.clientId, expectedSecret);

      return new Response(
        JSON.stringify({
          access_token: accessToken,
          token_type: "Bearer",
          expires_in: 2592000,
          scope: "mcp",
        }),
        {
          headers: {
            "Content-Type": "application/json",
            ...oauthCorsHeaders,
          },
        }
      );
    }

    // MCP Routes: Open CORS with MCP token protection
    if (url.pathname.startsWith("/mcp")) {
      const mcpOrigin = request.headers.get("Origin") || "*";
      if (request.method === "OPTIONS") {
        return new Response(null, {
          headers: {
            "Access-Control-Allow-Origin": mcpOrigin,
            "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization, mcp-session-id, mcp-protocol-version, X-Session-ID, x-session-id",
            "Access-Control-Expose-Headers": "mcp-session-id, WWW-Authenticate",
            "Access-Control-Max-Age": "86400",
          },
        });
      }

      // Validate MCP Access Token BEFORE calling mcpFetch to avoid WebSocket DO hang
      const secret = env.MCP_SECRET;
      if (secret) {
        const authResult = await validateMcpToken(request, secret);
        if (!authResult.isValid) {
          return new Response(
            JSON.stringify({
              jsonrpc: "2.0",
              error: {
                code: -32000,
                message: "Unauthorized: Invalid or missing MCP access token",
              },
              id: null,
            }),
            {
              status: 401,
              headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": mcpOrigin,
                "Access-Control-Expose-Headers": "mcp-session-id, WWW-Authenticate",
                "WWW-Authenticate": `Bearer resource_metadata="${baseUrl}/.well-known/oauth-protected-resource"`,
              },
            }
          );
        }
      }

      try {
        const response = await mcpFetch(request, env, ctx);
        const newResponse = new Response(response.body, response);
        newResponse.headers.set("Access-Control-Allow-Origin", mcpOrigin);
        newResponse.headers.set("Access-Control-Expose-Headers", "mcp-session-id, WWW-Authenticate");
        return newResponse;
      } catch (err: any) {
        console.error("mcpFetch error:", err);
        return new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            error: {
              code: -32603,
              message: "Internal error",
            },
            id: null,
          }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": mcpOrigin,
            },
          }
        );
      }
    }

    // Resolve the allowed origin dynamically for non-MCP routes
    const origin = request.headers.get("Origin");
    const allowedOrigin = (origin === "https://oaktree-agent-frontend.pages.dev" || (origin && origin.startsWith("http://localhost:")))
      ? origin
      : "https://oaktree-agent-frontend.pages.dev";

    // Handle CORS for non-MCP requests
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": allowedOrigin,
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Session-ID, x-session-id",
        },
      });
    }

    if (url.pathname.startsWith("/agents/")) {
      const auth = await authenticateRequest(request, env);
      if (auth instanceof Response) {
        const errorResponse = new Response(auth.body, auth);
        errorResponse.headers.set("Access-Control-Allow-Origin", allowedOrigin);
        return errorResponse;
      }

      const parts = url.pathname.split("/");
      const sessionName = parts[3];
      const normalizedEmailSession = auth.email.replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 64);
      
      // Prevent horizontal privilege escalation: users can only connect to their own session (unless local dev)
      if (env.IS_LOCAL !== 'true' && sessionName !== normalizedEmailSession && !sessionName.startsWith(normalizedEmailSession + "--")) {
        return new Response("Forbidden: Session ID mismatch", {
          status: 403,
          headers: {
            "Access-Control-Allow-Origin": allowedOrigin,
          }
        });
      }

      const response = await routeAgentRequest(request, env);
      if (response) {
        const newResponse = new Response(response.body, response);
        newResponse.headers.set("Access-Control-Allow-Origin", allowedOrigin);
        return newResponse;
      }
    }

    if (url.pathname === "/chat/sessions" && request.method === "GET") {
      const auth = await authenticateRequest(request, env);
      if (auth instanceof Response) {
        const errorResponse = new Response(auth.body, auth);
        errorResponse.headers.set("Access-Control-Allow-Origin", allowedOrigin);
        return errorResponse;
      }

      try {
        // Ensure table exists
        await env.DB.prepare(`
          CREATE TABLE IF NOT EXISTS agent_chat_sessions (
            id TEXT PRIMARY KEY,
            user_email TEXT NOT NULL,
            title TEXT NOT NULL,
            created_at INTEGER DEFAULT (unixepoch())
          )
        `).run();
        
        await env.DB.prepare(`
          CREATE INDEX IF NOT EXISTS idx_agent_chat_sessions_user_email ON agent_chat_sessions(user_email)
        `).run();

        const { results } = await env.DB.prepare(
          "SELECT id, title, created_at FROM agent_chat_sessions WHERE user_email = ? ORDER BY created_at DESC"
        ).bind(auth.email).all();

        return new Response(JSON.stringify({ sessions: results }), {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": allowedOrigin,
          }
        });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": allowedOrigin,
          }
        });
      }
    }

    if (url.pathname === "/chat/sessions" && request.method === "POST") {
      const auth = await authenticateRequest(request, env);
      if (auth instanceof Response) {
        const errorResponse = new Response(auth.body, auth);
        errorResponse.headers.set("Access-Control-Allow-Origin", allowedOrigin);
        return errorResponse;
      }

      try {
        const { title } = await request.json() as { title: string };
        const uuid = crypto.randomUUID();
        const normalizedEmail = auth.email.replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 64);
        const sessionId = `${normalizedEmail}--${uuid}`;

        // Ensure table exists
        await env.DB.prepare(`
          CREATE TABLE IF NOT EXISTS agent_chat_sessions (
            id TEXT PRIMARY KEY,
            user_email TEXT NOT NULL,
            title TEXT NOT NULL,
            created_at INTEGER DEFAULT (unixepoch())
          )
        `).run();

        await env.DB.prepare(
          "INSERT INTO agent_chat_sessions (id, user_email, title) VALUES (?, ?, ?)"
        ).bind(sessionId, auth.email, title || "New Chat").run();

        return new Response(JSON.stringify({ id: sessionId, title: title || "New Chat" }), {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": allowedOrigin,
          }
        });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": allowedOrigin,
          }
        });
      }
    }

    if (url.pathname === "/chat/sessions/delete" && request.method === "POST") {
      const auth = await authenticateRequest(request, env);
      if (auth instanceof Response) {
        const errorResponse = new Response(auth.body, auth);
        errorResponse.headers.set("Access-Control-Allow-Origin", allowedOrigin);
        return errorResponse;
      }

      try {
        const { id } = await request.json() as { id: string };
        const normalizedEmail = auth.email.replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 64);
        
        // Prevent deletion of other users' sessions
        if (!id.startsWith(normalizedEmail + "--") && id !== normalizedEmail) {
          return new Response("Forbidden: Session ID mismatch", {
            status: 403,
            headers: {
              "Access-Control-Allow-Origin": allowedOrigin,
            }
          });
        }

        // 1. Delete from D1 database
        await env.DB.prepare(
          "DELETE FROM agent_chat_sessions WHERE id = ? AND user_email = ?"
        ).bind(id, auth.email).run();

        // 2. Destroy the Durable Object state
        try {
          const agentInstance = await getAgentByName(env.OAKTREE_CHAT, id) as any;
          await agentInstance.deleteSession();
        } catch (err) {
          console.error("Failed to destroy Durable Object instance:", err);
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": allowedOrigin,
          }
        });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": allowedOrigin,
          }
        });
      }
    }


    if (url.pathname === "/database-chat/status" && request.method === "GET") {
      const auth = await authenticateRequest(request, env);
      if (auth instanceof Response) {
        const errorResponse = new Response(auth.body, auth);
        errorResponse.headers.set("Access-Control-Allow-Origin", allowedOrigin);
        return errorResponse;
      }

      return new Response(JSON.stringify({ enabled: env.ENABLE_DATABASE_AGENT === "true" }), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": allowedOrigin,
        }
      });
    }

    if (url.pathname === "/database-chat" && request.method === "POST") {
      const auth = await authenticateRequest(request, env);
      if (auth instanceof Response) {
        const errorResponse = new Response(auth.body, auth);
        errorResponse.headers.set("Access-Control-Allow-Origin", allowedOrigin);
        return errorResponse;
      }

      if (env.ENABLE_DATABASE_AGENT !== "true") {
        return new Response("The Database Agent is temporarily disabled.", {
          status: 403,
          headers: {
            "Access-Control-Allow-Origin": allowedOrigin,
          }
        });
      }
      const { messages }: { messages: UIMessage[] } = await request.json() as any;
      const workersai = createWorkersAI({ binding: env.AI });
      const model = workersai(env.db_ai_model);

      const result = (streamText as any)({
        model,
        messages: await convertToModelMessages(messages),
        system: "You are Cloudflare DB Agent, a state-of-the-art AI assistant specializing in the Cloudflare developer platform (Workers, D1, R2, KV, Durable Objects). You are an expert database administrator. You have direct access to tools for inspecting and querying the D1 database (SQLite-based) and R2 storage bucket.\nUse the database tools (list_d1_tables, get_d1_table_schema, execute_d1_sql) to inspect tables, construct accurate SQL queries, run queries to analyze data, or perform schema migrations.\nUse the R2 tools (list_r2_objects, get_r2_object, put_r2_object, delete_r2_object) to list, read, write, or delete files in R2 storage.\nAlways explain the SQL query or R2 action you are about to perform. When displaying SQL results, respond normally and let the user interface render it. If a query returns an error, explain the error and suggest a fix. Be concise, precise, and secure in all operations.",
        tools: {
          list_d1_tables: tool({
            description: "List all database tables in the D1 SQLite database.",
            parameters: z.object({}),
            execute: async () => {
              try {
                const { results } = await env.DB.prepare(
                  "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
                ).all();
                return { tables: results.map((r: any) => r.name) };
              } catch (e: any) {
                return { error: `Failed to list tables: ${e.message}` };
              }
            }
          } as any) as any,
          get_d1_table_schema: tool({
            description: "Get the column definitions and details (schema) of a D1 database table.",
            parameters: z.object({
              table: z.string().describe("The name of the table to inspect")
            }),
            execute: async ({ table }: any) => {
              if (!/^[a-zA-Z0-9_]+$/.test(table)) {
                return { error: `Invalid table name: ${table}` };
              }
              try {
                const { results } = await env.DB.prepare(`PRAGMA table_info(${table})`).all();
                return { table, schema: results };
              } catch (e: any) {
                return { error: `Failed to get schema for table ${table}: ${e.message}` };
              }
            }
          } as any) as any,
          execute_d1_sql: tool({
            description: "Execute a raw SQL query or command against the D1 database. Supports SELECT, INSERT, UPDATE, DELETE, and DDL commands. SELECT queries will be truncated to 100 rows maximum.",
            parameters: z.object({
              sql: z.string().describe("The exact SQL command or query to execute")
            }),
            execute: async ({ sql }: any) => {
              try {
                const isSelect = sql.trim().toLowerCase().startsWith("select");
                const statement = env.DB.prepare(sql);
                if (isSelect) {
                  const { results } = await statement.all();
                  const truncated = results.length > 100;
                  return {
                    success: true,
                    results: results.slice(0, 100),
                    truncated
                  };
                } else {
                  const info = await statement.run();
                  return {
                    success: true,
                    changes: info.meta.changes,
                    duration: info.meta.duration,
                    lastRowId: info.meta.last_row_id
                  };
                }
              } catch (e: any) {
                return { success: false, error: e.message };
              }
            }
          } as any) as any,
          list_r2_objects: tool({
            description: "List keys, sizes, and metadata of all objects stored in the Cloudflare R2 bucket.",
            parameters: z.object({
              prefix: z.string().optional().describe("Filter objects starting with this prefix"),
              limit: z.number().optional().describe("Maximum number of objects to list")
            }),
            execute: async ({ prefix, limit }: any) => {
              if (!env.BUCKET) {
                return { error: "R2 bucket is not configured or bound to the worker. Please configure R2 bucket binding BUCKET in wrangler.toml." };
              }
              try {
                const list = await env.BUCKET.list({ prefix, limit: limit || 100 });
                return {
                  success: true,
                  objects: list.objects.map((o: any) => ({
                    key: o.key,
                    size: o.size,
                    uploaded: o.uploaded
                  }))
                };
              } catch (e: any) {
                return { error: `Failed to list R2 objects: ${e.message}` };
              }
            }
          } as any) as any,
          get_r2_object: tool({
            description: "Get metadata and read text or JSON content from a specific object in the Cloudflare R2 bucket.",
            parameters: z.object({
              key: z.string().describe("The key of the object to retrieve")
            }),
            execute: async ({ key }: any) => {
              if (!env.BUCKET) {
                return { error: "R2 bucket is not configured or bound to the worker." };
              }
              try {
                const object = await env.BUCKET.get(key);
                if (!object) {
                  return { error: `Object with key '${key}' not found.` };
                }
                const text = await object.text();
                let body: any = text;
                try {
                  body = JSON.parse(text);
                } catch (_) {}
                return {
                  key: object.key,
                  size: object.size,
                  uploaded: object.uploaded,
                  httpMetadata: object.httpMetadata,
                  content: body
                };
              } catch (e: any) {
                return { error: `Failed to get R2 object: ${e.message}` };
              }
            }
          } as any) as any,
          put_r2_object: tool({
            description: "Upload or overwrite text or JSON content to a key in the Cloudflare R2 bucket.",
            parameters: z.object({
              key: z.string().describe("The key under which to save the object"),
              content: z.string().describe("The text or JSON string content to upload"),
              contentType: z.string().optional().describe("Optional HTTP Content-Type header (e.g. 'application/json', 'text/plain')")
            }),
            execute: async ({ key, content, contentType }: any) => {
              if (!env.BUCKET) {
                return { error: "R2 bucket is not configured or bound to the worker." };
              }
              try {
                const options: any = {};
                if (contentType) {
                  options.httpMetadata = { contentType };
                }
                const object = await env.BUCKET.put(key, content, options);
                return {
                  success: true,
                  key: object.key,
                  size: object.size,
                  uploaded: object.uploaded
                };
              } catch (e: any) {
                return { error: `Failed to upload R2 object: ${e.message}` };
              }
            }
          } as any) as any,
          delete_r2_object: tool({
            description: "Delete an object key from the Cloudflare R2 bucket.",
            parameters: z.object({
              key: z.string().describe("The key of the object to delete")
            }),
            execute: async ({ key }: any) => {
              if (!env.BUCKET) {
                return { error: "R2 bucket is not configured or bound to the worker." };
              }
              try {
                await env.BUCKET.delete(key);
                return { success: true, message: `Object '${key}' deleted successfully.` };
              } catch (e: any) {
                return { error: `Failed to delete R2 object: ${e.message}` };
              }
            }
          } as any) as any,
        },
        maxSteps: 5,
      } as any);

      return result.toUIMessageStreamResponse({
        headers: {
          "Access-Control-Allow-Origin": allowedOrigin,
        }
      });
    }

    const response = await mcpFetch(request, env, ctx);
    const newResponse = new Response(response.body, response);
    newResponse.headers.set("Access-Control-Allow-Origin", allowedOrigin);
    return newResponse;
  }
}

