import { McpAgent } from "agents/mcp";
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
      async ({ category }) => {
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
      async ({ query }) => {
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

      const result = streamText({
        model,
        messages: await convertToModelMessages(messages),
        system: "You are Oaktree AI, an investment portfolio manager. You have tools to read the user's portfolio and knowledge base. Answer briefly and directly using the tools available.",
        tools: {
          getPortfolio: tool({
            description: "Get all portfolio holdings",
            parameters: z.object({}),
            execute: async () => getPortfolio(env),
          }),
          getPortfolioHistory: tool({
            description: "Get portfolio history",
            parameters: z.object({}),
            execute: async () => getPortfolioHistory(env),
          }),
          getKnowledge: tool({
            description: "Get investment knowledge by category",
            parameters: z.object({ category: z.string() }),
            execute: async ({ category }) => getKnowledgeByCategory(env, category),
          }),
          searchKnowledge: tool({
            description: "Search knowledge base stored in D1",
            parameters: z.object({ query: z.string() }),
            execute: async ({ query }) => searchKnowledge(env, query),
          }),
          queryNotebookLM: tool({
            description: "Query the user's NotebookLM notebooks for deep research context — use this for earnings calls, 10-K/10-Q filings, company analysis, and detailed investment research that goes beyond the local knowledge base.",
            parameters: z.object({
              question: z.string().describe("The research question to ask NotebookLM"),
              notebookId: z.string().optional().describe("Optional specific notebook ID to query"),
            }),
            execute: async ({ question, notebookId }) => {
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
          }),
        },
        maxSteps: 5,
      });

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
