import { McpAgent } from "agents/mcp";
// @ts-ignore
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getPortfolio, getPortfolioHistory, getKnowledgeByCategory, searchKnowledge, getLatestAnalysisReport } from "./knowledge";

const asText = (data: unknown) => ({
  content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
});

export class OaktreeMCP extends McpAgent {
  server = new McpServer({ name: "oaktree-mcp", version: "1.0.0" });

  async init() {
    // Register MCP Tools
    this.server.tool(
      "get_portfolio",
      "Get all portfolio holdings, their weights, and investment thesis.",
      {},
      async () => asText(await getPortfolio(this.env as any))
    );

    this.server.tool(
      "get_portfolio_history",
      "Get the yearly performance history of the portfolio.",
      {},
      async () => asText(await getPortfolioHistory(this.env as any))
    );

    this.server.tool(
      "get_knowledge",
      "Get investment philosophy and frameworks by category (e.g., 'intelligent_investor', 'buffett_principles', 'five_forces').",
      { category: z.string() },
      async ({ category }: any) => asText(await getKnowledgeByCategory(this.env as any, category))
    );

    this.server.tool(
      "search_knowledge",
      "Search the knowledge base for a specific term.",
      { query: z.string() },
      async ({ query }: any) => asText(await searchKnowledge(this.env as any, query))
    );

    this.server.tool(
      "get_analysis_report",
      "Get the latest value investor deep analysis report for a stock symbol.",
      { symbol: z.string().describe("The stock symbol to fetch the analysis report for (e.g. AAPL)") },
      async ({ symbol }: any) => asText(await getLatestAnalysisReport(this.env as any, symbol))
    );
  }
}

