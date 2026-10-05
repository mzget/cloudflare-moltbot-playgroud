import { createWorkersAI } from "workers-ai-provider";
import { streamText, convertToModelMessages, UIMessage } from "ai";
import { requireAuth } from "../jwtAuth";
import { jsonResponse } from "../http";
import { createDbTools } from "../dbTools";

const DB_AGENT_SYSTEM_PROMPT =
  "You are Cloudflare DB Agent, a state-of-the-art AI assistant specializing in the Cloudflare developer platform (Workers, D1, R2, KV, Durable Objects). You are an expert database administrator. You have direct access to tools for inspecting and querying the D1 database (SQLite-based) and R2 storage bucket.\nUse the database tools (list_d1_tables, get_d1_table_schema, execute_d1_sql) to inspect tables, construct accurate SQL queries, run queries to analyze data, or perform schema migrations.\nUse the R2 tools (list_r2_objects, get_r2_object, put_r2_object, delete_r2_object) to list, read, write, or delete files in R2 storage.\nAlways explain the SQL query or R2 action you are about to perform. When displaying SQL results, respond normally and let the user interface render it. If a query returns an error, explain the error and suggest a fix. Be concise, precise, and secure in all operations.";

async function getStatus(request: Request, env: any, allowedOrigin: string): Promise<Response> {
  const auth = await requireAuth(request, env, allowedOrigin);
  if (auth instanceof Response) return auth;

  return jsonResponse({ enabled: env.ENABLE_DATABASE_AGENT === "true" }, 200, {
    "Access-Control-Allow-Origin": allowedOrigin,
  });
}

async function postChat(request: Request, env: any, allowedOrigin: string): Promise<Response> {
  const auth = await requireAuth(request, env, allowedOrigin);
  if (auth instanceof Response) return auth;

  if (env.ENABLE_DATABASE_AGENT !== "true") {
    return new Response("The Database Agent is temporarily disabled.", {
      status: 403,
      headers: { "Access-Control-Allow-Origin": allowedOrigin },
    });
  }

  const { messages }: { messages: UIMessage[] } = await request.json() as any;
  const workersai = createWorkersAI({ binding: env.AI });
  const model = workersai(env.db_ai_model);

  const result = (streamText as any)({
    model,
    messages: await convertToModelMessages(messages),
    system: DB_AGENT_SYSTEM_PROMPT,
    tools: createDbTools(env),
    maxSteps: 5,
  } as any);

  return result.toUIMessageStreamResponse({
    headers: { "Access-Control-Allow-Origin": allowedOrigin },
  });
}

/** Database agent routes. Returns null when no route matched. */
export async function handleDatabaseChatRoute(
  request: Request,
  env: any,
  url: URL,
  allowedOrigin: string
): Promise<Response | null> {
  if (url.pathname === "/database-chat/status" && request.method === "GET") {
    return getStatus(request, env, allowedOrigin);
  }
  if (url.pathname === "/database-chat" && request.method === "POST") {
    return postChat(request, env, allowedOrigin);
  }
  return null;
}

