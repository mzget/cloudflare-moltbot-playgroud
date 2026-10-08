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
  getWatchlist,
  saveMarketArticle,
  createFacebookDraft,
  getRecentArticles
} from "./knowledge";
import {
  saveDcfScenarios,
  getDcfModel,
  listDcfSymbols
} from "./dcfTools";

const asText = (data: unknown) => ({
  content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
});

export class OaktreeMCP extends McpAgent {
  server = new McpServer({ name: "oaktree-mcp", version: "1.0.0" });

  async init() {
    // Register MCP Tools
    this.server.tool(
      "get_portfolio",
      "Get all current portfolio holdings (19 symbols), their shares, weights, and investment thesis. NOTE: This is the user's actual portfolio holdings, NOT the watchlist. For watchlist stocks (24 symbols), call 'get_watchlist' instead.",
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
      "Search the knowledge base and watchlist for a specific term.",
      { query: z.string().describe("Search term, e.g. 'margin of safety', 'moat', 'watchlist', or a framework name") },
      async ({ query }: any) => asText(await searchKnowledge(this.env as any, query))
    );

    this.server.tool(
      "get_analysis_report",
      "Get the latest value investor deep analysis report for a stock symbol.",
      { symbol: z.string().describe("The stock symbol to fetch the analysis report for (e.g. AAPL)") },
      async ({ symbol }: any) => asText(await getLatestAnalysisReport(this.env as any, symbol))
    );

    this.server.tool(
      "get_watchlist",
      "Get all stock symbols in the user's watchlist (24 symbols total), with company names, sectors, target prices, current prices, PE ratios, and active status.",
      {
        active_only: z.boolean().optional().describe("If true, returns only active watchlist symbols (21 symbols). If false or omitted, returns all 24 symbols in the watchlist.")
      },
      async ({ active_only }: any) => asText(await getWatchlist(this.env as any, { activeOnly: active_only }))
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

    this.server.tool(
      "save_dcf_scenarios",
      "Save 1 to 3 DCF valuation scenarios (Base Case, Bull Case, Bear Case) calculated by Gemini Spark/App into Oaktree D1 database.",
      {
        symbol: z.string().describe("Stock ticker symbol (e.g. NVDA, AAPL)"),
        sync_target_price: z.boolean().optional().describe("If true, updates the target_price in watchlist with the Base Case implied share price"),
        scenarios: z.array(
          z.object({
            scenario_name: z.enum(["Base Case", "Bull Case", "Bear Case"]).describe("Scenario name"),
            mode: z.enum(["detailed", "uniform"]).optional().describe("Forecast mode: 'detailed' (5-year arrays) or 'uniform'"),
            base_revenue: z.number().describe("Starting base revenue in Billions USD ($B)"),
            shares_outstanding: z.number().describe("Shares outstanding in Millions ($M) - e.g. 15000 for 15 Billion shares"),
            net_cash: z.number().optional().describe("Net cash (Cash - Debt) in Billions USD ($B)"),
            wacc: z.number().describe("Discount rate / WACC in percent (%)"),
            terminal_growth: z.number().describe("Perpetual terminal growth rate in percent (%) - must be less than WACC"),
            tax_rate: z.number().optional().describe("Effective corporate tax rate in percent (%)"),
            exit_multiple: z.number().optional().describe("5-Year terminal exit multiple (e.g. 20.0)"),
            target_shares: z.number().optional().describe("Expected shares outstanding at Year 5 in Millions ($M)"),
            implied_share_price: z.number().describe("Calculated intrinsic share price ($)"),
            yearly_growth: z.array(z.number()).optional().describe("5-year YoY revenue growth rates in %: [yr1, yr2, yr3, yr4, yr5]"),
            yearly_op_margin: z.array(z.number()).optional().describe("5-year operating margins in %: [yr1, yr2, yr3, yr4, yr5]"),
            yearly_fcf_conv: z.array(z.number()).optional().describe("5-year FCF conversion of NOPAT in %: [yr1, yr2, yr3, yr4, yr5]"),
            revenue_growth: z.number().optional().describe("Single uniform revenue growth rate % (uniform mode)"),
            operating_margin: z.number().optional().describe("Single uniform operating margin % (uniform mode)"),
            fcf_conversion: z.number().optional().describe("Single uniform FCF conversion % (uniform mode)"),
            rationale: z.string().optional().describe("Thesis and assumptions explaining the growth and margin forecast"),
            source: z.string().optional().describe("Attribution source (defaults to 'gemini_spark')")
          })
        ).describe("Array of 1 to 3 DCF scenarios (Base Case, Bull Case, Bear Case)")
      },
      async (args: any) => asText(await saveDcfScenarios(this.env as any, args))
    );

    this.server.tool(
      "get_dcf_model",
      "Get saved DCF valuation scenarios and intrinsic prices for a stock symbol, along with current market price and upside/downside percentages.",
      {
        symbol: z.string().describe("Stock ticker symbol (e.g. NVDA, AAPL)")
      },
      async ({ symbol }: any) => asText(await getDcfModel(this.env as any, symbol))
    );

    this.server.tool(
      "list_dcf_symbols",
      "List all stock symbols that have saved DCF valuation models in Oaktree, with their latest Base Case intrinsic prices and update dates.",
      {},
      async () => asText(await listDcfSymbols(this.env as any))
    );
  }
}

