import { McpAgent } from "agents/mcp";
// @ts-ignore
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { 
  getPortfolio, 
  getPortfolioHistory, 
  getKnowledgeByCategory, 
  searchKnowledge, 
  getLatestAnalysisReport,
  saveMarketArticle,
  createFacebookDraft,
  getRecentArticles
} from "./knowledge";

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

    this.server.tool(
      "save_market_intelligence",
      "Save market news summary and investment analysis from Gemini Spark into Oaktree Intelligence store and R2 Knowledge Base.",
      {
        title: z.string().describe("The headline or title of the market news or analysis"),
        summary: z.string().describe("A concise 1-3 paragraph summary of the event or analysis"),
        key_takeaways: z.union([z.array(z.string()), z.string()]).optional().describe("Key bullet points or takeaways (array of strings or bullet-separated text)"),
        symbol: z.string().optional().describe("Associated stock ticker symbol (e.g. NVDA, AAPL), or null for macro/general market"),
        category: z.string().optional().describe("Category of analysis (e.g. 'Macro', 'Earnings', 'Semiconductors', 'Valuation')"),
        source: z.string().optional().describe("Source attribution name, defaults to 'gemini_spark'"),
        url: z.string().optional().describe("Original reference or news source URL"),
        auto_publish_facebook: z.boolean().optional().describe("If true, queues this post for publishing to Facebook Page with Howard Marks memo")
      },
      async (args: any) => asText(await saveMarketArticle(this.env as any, args))
    );

    this.server.tool(
      "create_facebook_post_draft",
      "Save a custom Facebook post draft in Oaktree App for user review and editing before publishing.",
      {
        title: z.string().describe("Working title or topic of the Facebook draft"),
        content: z.string().describe("Draft text or copy for the Facebook post")
      },
      async (args: any) => asText(await createFacebookDraft(this.env as any, args))
    );

    this.server.tool(
      "get_recent_intelligence",
      "Get recent ingested market news and analyses from the database.",
      {
        limit: z.number().optional().describe("Number of articles to fetch (default: 10, max: 50)"),
        source: z.string().optional().describe("Filter by source, e.g. 'gemini_spark' or 'notebooklm'")
      },
      async ({ limit, source }: any) => asText(await getRecentArticles(this.env as any, limit, source))
    );
  }
}

