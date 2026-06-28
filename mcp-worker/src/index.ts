import { McpAgent } from "agents/mcp";
// @ts-ignore
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getPortfolio, getPortfolioHistory, getKnowledgeByCategory, searchKnowledge, getLatestAnalysisReport } from "./knowledge";
import { createWorkersAI } from "workers-ai-provider";
import { streamText, tool, convertToModelMessages, UIMessage } from "ai";
import { AIChatAgent } from "@cloudflare/ai-chat";
import { getAgentByName, routeAgentRequest } from "agents";

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

  // Override fetch to add Bearer token security
  async fetch(request: Request) {
    const env = this.env as any;
    if (env.MCP_SECRET) {
      const authHeader = request.headers.get("Authorization");
      if (!authHeader || authHeader !== `Bearer ${env.MCP_SECRET}`) {
        return new Response("Unauthorized", { status: 401 });
      }
    }
    return super.fetch(request);
  }
}

export class OaktreeChat extends AIChatAgent<any> {
  override async onRequest(request: Request): Promise<Response> {
    if (request.method === "POST") {
      try {
        const { messages } = await request.json() as any;

        // Persist new messages
        if (messages && Array.isArray(messages)) {
          const newMessages = messages.filter(
            (msg: any) => !this.messages.some((m) => m.id === msg.id)
          );
          if (newMessages.length > 0) {
            for (const msg of newMessages) {
              this.messages.push(msg);
            }
            await this.persistMessages(newMessages);
          }
        }

        // Trigger chat generation
        const response = await this.onChatMessage(
          async (event: any) => {
            const assistantMsg = event.responseMessages[0];
            if (assistantMsg) {
              const uiMsg = {
                id: assistantMsg.id || crypto.randomUUID(),
                role: 'assistant',
                content: typeof assistantMsg.content === 'string' ? assistantMsg.content : '',
                parts: Array.isArray(assistantMsg.content)
                  ? assistantMsg.content
                  : (typeof assistantMsg.content === 'string'
                      ? [{ type: 'text', text: assistantMsg.content }]
                      : []),
                createdAt: new Date()
              };
              this.messages.push(uiMsg as any);
              await this.persistMessages([uiMsg as any]);
            }
          },
          {
            requestId: crypto.randomUUID(),
            abortSignal: request.signal,
          }
        );

        const allowedOrigin = request.headers.get("Origin") || "*";
        const headers = new Headers(response.headers);
        headers.set("Access-Control-Allow-Origin", allowedOrigin);
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers
        });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    return super.onRequest(request);
  }

  async onChatMessage(onFinish: any, options?: any) {
    const workersai = createWorkersAI({ binding: this.env.AI });
    const model = workersai('@cf/google/gemma-4-26b-a4b-it');

    const systemPrompt = "คุณคือ Oaktree AI ผู้ช่วยวิเคราะห์ข้อมูลการลงทุนแบบเน้นคุณค่า (Value Investing) ตามหลักการลงทุนของ Warren Buffett, Charlie Munger, Howard Marks, และอื่น ๆ กรุณาตอบข้อมูลต่าง ๆ โดยอ้างอิงจากข้อมูลที่มีอยู่ในฐานข้อมูล หรือใช้เครื่องมือเสริมการค้นหาที่มีให้ (เช่น getAnalysisReport, getPortfolio, getKnowledge) ตอบคำถามให้ตรงประเด็นและกระชับที่สุด\n" +
      "You also have read-only access to the full database via queryDatabase and listTables tools.\n" +
      "If the fixed tools do not contain the necessary information to answer a question (e.g., about specific broker balances, new tables, or complex queries), use listTables to understand the available tables and columns, then write and run SELECT queries using queryDatabase. Only SELECT queries are permitted.";

    const result = (streamText as any)({
      model,
      messages: await convertToModelMessages(this.messages),
      system: systemPrompt,
      tools: {
        getPortfolio: tool({
          description: "Get all portfolio holdings",
          parameters: z.object({}),
          execute: async () => getPortfolio(this.env as any),
        } as any) as any,
        getPortfolioHistory: tool({
          description: "Get portfolio history",
          parameters: z.object({}),
          execute: async () => getPortfolioHistory(this.env as any),
        } as any) as any,
        getKnowledge: tool({
          description: "Get investment knowledge by category",
          parameters: z.object({ category: z.string() }),
          execute: async ({ category }: any) => getKnowledgeByCategory(this.env as any, category),
        } as any) as any,
        searchKnowledge: tool({
          description: "Search knowledge base stored in D1",
          parameters: z.object({ query: z.string() }),
          execute: async ({ query }: any) => searchKnowledge(this.env as any, query),
        } as any) as any,
        getAnalysisReport: tool({
          description: "Get the latest value investor deep analysis report for a stock symbol",
          parameters: z.object({ symbol: z.string() }),
          execute: async ({ symbol }: any) => getLatestAnalysisReport(this.env as any, symbol),
        } as any) as any,
        queryNotebookLM: tool({
          description: "Query the user's NotebookLM notebooks for deep research context. Use this for earnings calls, 10-K/10-Q filings, company analysis, and detailed investment research that goes beyond the local knowledge base.",
          parameters: z.object({
            question: z.string().describe("The research question to ask NotebookLM"),
            notebookId: z.string().optional().describe("Optional specific notebook ID to query"),
          }),
          execute: async ({ question, notebookId }: any) => {
            const env = this.env as any;
            const bridgeUrl = env.NOTEBOOKLM_BRIDGE_URL;
            if (!bridgeUrl) {
              return { error: "NotebookLM bridge not configured. NOTEBOOKLM_BRIDGE_URL is not set." };
            }
            try {
              const body: Record<string, string> = { question };
              if (notebookId) body.notebookId = notebookId;

              const response = await fetch(`${bridgeUrl}/ask`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  ...(env.BRIDGE_SECRET ? { Authorization: `Bearer ${env.BRIDGE_SECRET}` } : {}),
                },
                body: JSON.stringify(body),
                signal: AbortSignal.timeout(30000), // 30s timeout
              });

              if (!response.ok) {
                const err = await response.text();
                return { error: `Bridge error ${response.status}: ${err}` };
              }

              const data = await response.json() as { answer?: string; error?: string };
              return data.answer ? { answer: data.answer } : { error: data.error || "No answer returned" };
            } catch (err: any) {
              return { error: `Failed to reach NotebookLM bridge: ${err.message}` };
            }
          },
        } as any) as any,
        queryDatabase: tool({
          description: "Execute a read-only SQL query against the D1 database. Use this to answer questions about portfolio, holdings, market data, knowledge, news, or any other data. Only SELECT queries are allowed.",
          parameters: z.object({
            sql: z.string().describe("A SELECT SQL query to execute"),
          }),
          execute: async ({ sql }: any) => {
            if (!sql.trim().toLowerCase().startsWith("select")) {
              return { error: "Only SELECT queries are allowed. This tool is read-only." };
            }
            try {
              const { results } = await (this.env as any).DB.prepare(sql).all();
              return { results: results.slice(0, 50) };
            } catch (e: any) {
              return { error: e.message };
            }
          },
        } as any) as any,
        listTables: tool({
          description: "List all database tables and their schemas. Use this to understand what data is available before writing SQL queries.",
          parameters: z.object({}),
          execute: async () => {
            try {
              const { results: tables } = await (this.env as any).DB.prepare(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'"
              ).all();
              const schemas: Record<string, any[]> = {};
              for (const t of tables as any[]) {
                const { results: cols } = await (this.env as any).DB.prepare(`PRAGMA table_info(${t.name})`).all();
                schemas[t.name] = cols;
              }
              return { tables: schemas };
            } catch (e: any) {
              return { error: e.message };
            }
          },
        } as any) as any,
      },
      maxSteps: 10,
      abortSignal: options?.abortSignal,
      onFinish,
    } as any);

    return result.toUIMessageStreamResponse({
      headers: {
        "Access-Control-Allow-Origin": "*",
      }
    });
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

const mcpFetch = OaktreeMCP.serve("/mcp", { binding: "OAKTREE_MCP" }).fetch;

export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext) {
    const url = new URL(request.url);

    // Resolve the allowed origin dynamically
    const origin = request.headers.get("Origin");
    const allowedOrigin = (origin === "https://oaktree-agent-frontend.pages.dev" || (origin && origin.startsWith("http://localhost:")))
      ? origin
      : "https://oaktree-agent-frontend.pages.dev";

    // Handle CORS for all requests
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
      if (env.IS_LOCAL !== 'true' && sessionName !== normalizedEmailSession) {
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
      const model = workersai('@cf/meta/llama-3-8b-instruct');

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

