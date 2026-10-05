import { getAgentByName, routeAgentRequest } from "agents";
import { requireAuth } from "../jwtAuth";
import { jsonResponse, withCors } from "../http";
import { normalizeEmailSession, isOwnSession } from "../sessionId";

const forbiddenSession = (allowedOrigin: string) =>
  new Response("Forbidden: Session ID mismatch", {
    status: 403,
    headers: { "Access-Control-Allow-Origin": allowedOrigin },
  });

const jsonCors = (body: unknown, allowedOrigin: string, status = 200) =>
  jsonResponse(body, status, { "Access-Control-Allow-Origin": allowedOrigin });

const errorJson = (e: any, allowedOrigin: string) =>
  jsonCors({ error: e.message }, allowedOrigin, 500);

const ensureSessionsTable = (env: any) =>
  env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS agent_chat_sessions (
      id TEXT PRIMARY KEY,
      user_email TEXT NOT NULL,
      title TEXT NOT NULL,
      created_at INTEGER DEFAULT (unixepoch())
    )
  `).run();

async function handleAgents(request: Request, env: any, url: URL, allowedOrigin: string): Promise<Response | null> {
  const auth = await requireAuth(request, env, allowedOrigin);
  if (auth instanceof Response) return auth;

  const sessionName = url.pathname.split("/")[3];
  const normalizedEmail = normalizeEmailSession(auth.email);

  // Prevent horizontal privilege escalation: users can only connect to their own session (unless local dev)
  if (env.IS_LOCAL !== 'true' && !isOwnSession(sessionName, normalizedEmail)) {
    return forbiddenSession(allowedOrigin);
  }

  const response = await routeAgentRequest(request, env);
  return response ? withCors(response, allowedOrigin) : null;
}

async function listSessions(request: Request, env: any, allowedOrigin: string): Promise<Response> {
  const auth = await requireAuth(request, env, allowedOrigin);
  if (auth instanceof Response) return auth;

  try {
    await ensureSessionsTable(env);
    await env.DB.prepare(
      "CREATE INDEX IF NOT EXISTS idx_agent_chat_sessions_user_email ON agent_chat_sessions(user_email)"
    ).run();

    const { results } = await env.DB.prepare(
      "SELECT id, title, created_at FROM agent_chat_sessions WHERE user_email = ? ORDER BY created_at DESC"
    ).bind(auth.email).all();

    return jsonCors({ sessions: results }, allowedOrigin);
  } catch (e: any) {
    return errorJson(e, allowedOrigin);
  }
}

async function createSession(request: Request, env: any, allowedOrigin: string): Promise<Response> {
  const auth = await requireAuth(request, env, allowedOrigin);
  if (auth instanceof Response) return auth;

  try {
    const { title } = await request.json() as { title: string };
    const sessionId = `${normalizeEmailSession(auth.email)}--${crypto.randomUUID()}`;
    const finalTitle = title || "New Chat";

    await ensureSessionsTable(env);
    await env.DB.prepare(
      "INSERT INTO agent_chat_sessions (id, user_email, title) VALUES (?, ?, ?)"
    ).bind(sessionId, auth.email, finalTitle).run();

    return jsonCors({ id: sessionId, title: finalTitle }, allowedOrigin);
  } catch (e: any) {
    return errorJson(e, allowedOrigin);
  }
}

async function deleteSession(request: Request, env: any, allowedOrigin: string): Promise<Response> {
  const auth = await requireAuth(request, env, allowedOrigin);
  if (auth instanceof Response) return auth;

  try {
    const { id } = await request.json() as { id: string };

    // Prevent deletion of other users' sessions
    if (!isOwnSession(id, normalizeEmailSession(auth.email))) {
      return forbiddenSession(allowedOrigin);
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

    return jsonCors({ success: true }, allowedOrigin);
  } catch (e: any) {
    return errorJson(e, allowedOrigin);
  }
}

/** Chat agent routing and session CRUD. Returns null when no route matched. */
export async function handleChatRoute(
  request: Request,
  env: any,
  url: URL,
  allowedOrigin: string
): Promise<Response | null> {
  const { pathname } = url;
  const { method } = request;

  if (pathname.startsWith("/agents/")) {
    const response = await handleAgents(request, env, url, allowedOrigin);
    if (response) return response;
  }
  if (pathname === "/chat/sessions" && method === "GET") return listSessions(request, env, allowedOrigin);
  if (pathname === "/chat/sessions" && method === "POST") return createSession(request, env, allowedOrigin);
  if (pathname === "/chat/sessions/delete" && method === "POST") return deleteSession(request, env, allowedOrigin);
  return null;
}

