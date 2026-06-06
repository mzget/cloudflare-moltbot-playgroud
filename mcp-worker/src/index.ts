import { McpAgent } from "agents/mcp";
// @ts-ignore
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getPortfolio, getPortfolioHistory, getKnowledgeByCategory, searchKnowledge } from "./knowledge";
import { createWorkersAI } from "workers-ai-provider";
import { streamText, tool, convertToModelMessages, UIMessage } from "ai";

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

const mcpFetch = OaktreeMCP.serve("/mcp", { binding: "OAKTREE_MCP" }).fetch;

export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext) {
    const url = new URL(request.url);

    // Handle CORS for all requests
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    if (url.pathname === "/chat" && request.method === "POST") {
      const { messages }: { messages: UIMessage[] } = await request.json() as any;
      const workersai = createWorkersAI({ binding: env.AI });
      const model = workersai('@cf/meta/llama-3-8b-instruct');

      const result = (streamText as any)({
        model,
        messages: await convertToModelMessages(messages),
        system: "You are Oaktree AI, an investment portfolio manager. You have tools to read the user's portfolio and knowledge base. Answer briefly and directly using the tools available.",
        tools: {
          getPortfolio: tool({
            description: "Get all portfolio holdings",
            parameters: z.object({}),
            execute: async () => getPortfolio(env),
          } as any) as any,
          getPortfolioHistory: tool({
            description: "Get portfolio history",
            parameters: z.object({}),
            execute: async () => getPortfolioHistory(env),
          } as any) as any,
          getKnowledge: tool({
            description: "Get investment knowledge by category",
            parameters: z.object({ category: z.string() }),
            execute: async ({ category }: any) => getKnowledgeByCategory(env, category),
          } as any) as any,
          searchKnowledge: tool({
            description: "Search knowledge base stored in D1",
            parameters: z.object({ query: z.string() }),
            execute: async ({ query }: any) => searchKnowledge(env, query),
          } as any) as any,
          queryNotebookLM: tool({
            description: "Query the user's NotebookLM notebooks for deep research context — use this for earnings calls, 10-K/10-Q filings, company analysis, and detailed investment research that goes beyond the local knowledge base.",
            parameters: z.object({
              question: z.string().describe("The research question to ask NotebookLM"),
              notebookId: z.string().optional().describe("Optional specific notebook ID to query"),
            }),
            execute: async ({ question, notebookId }: any) => {
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
        },
        maxSteps: 5,
      } as any);

      return result.toUIMessageStreamResponse({
        headers: {
          "Access-Control-Allow-Origin": "*",
        }
      });
    }

    if (url.pathname === "/database-chat/status" && request.method === "GET") {
      return new Response(JSON.stringify({ enabled: env.ENABLE_DATABASE_AGENT === "true" }), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        }
      });
    }

    if (url.pathname === "/database-chat" && request.method === "POST") {
      if (env.ENABLE_DATABASE_AGENT !== "true") {
        return new Response("The Database Agent is temporarily disabled.", {
          status: 403,
          headers: {
            "Access-Control-Allow-Origin": "*",
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
          "Access-Control-Allow-Origin": "*",
        }
      });
    }

    const response = await mcpFetch(request, env, ctx);
    const newResponse = new Response(response.body, response);
    newResponse.headers.set("Access-Control-Allow-Origin", "*");
    return newResponse;
  }
}
