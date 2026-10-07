import { describe, it, expect, vi } from "vitest";

const m = vi.hoisted(() => ({
  getPortfolio: vi.fn(),
  getPortfolioHistory: vi.fn(),
  getKnowledgeByCategory: vi.fn(),
  searchKnowledge: vi.fn(),
  getLatestAnalysisReport: vi.fn(),
  getWatchlist: vi.fn(),
  saveMarketArticle: vi.fn(),
  createFacebookDraft: vi.fn(),
  getRecentArticles: vi.fn(),
}));

vi.mock("agents/mcp", () => ({ McpAgent: class { env: any = { id: "env" }; } }));
vi.mock("@modelcontextprotocol/sdk/server/mcp.js", () => ({
  McpServer: class { tool = vi.fn(); },
}));
vi.mock("./knowledge", () => m);

import { OaktreeMCP } from "./mcpAgent";

async function setup() {
  const agent: any = new (OaktreeMCP as any)({}, {});
  await agent.init();
  const tools = new Map<string, any[]>(agent.server.tool.mock.calls.map((c: any[]) => [c[0], c]));
  return { agent, tools };
}
const textOf = (res: any) => JSON.parse(res.content[0].text);

describe("OaktreeMCP", () => {
  it("registers all nine tools with descriptions", async () => {
    const { tools } = await setup();
    expect([...tools.keys()]).toEqual([
      "get_portfolio",
      "get_portfolio_history",
      "get_knowledge",
      "search_knowledge",
      "get_analysis_report",
      "get_watchlist",
      "save_market_intelligence",
      "create_facebook_post_draft",
      "get_recent_intelligence",
    ]);
    for (const call of tools.values()) expect(typeof call[1]).toBe("string");
  });

  it("get_portfolio and get_portfolio_history return pretty JSON text", async () => {
    const { tools, agent } = await setup();
    m.getPortfolio.mockResolvedValue([{ symbol: "AAPL" }]);
    m.getPortfolioHistory.mockResolvedValue([{ year: 2024 }]);
    const res = await tools.get("get_portfolio")![3]();
    expect(res.content[0].type).toBe("text");
    expect(res.content[0].text).toBe(JSON.stringify([{ symbol: "AAPL" }], null, 2));
    expect(textOf(await tools.get("get_portfolio_history")![3]())).toEqual([{ year: 2024 }]);
    expect(m.getPortfolio).toHaveBeenCalledWith(agent.env);
  });

  it("parameterised tools forward their arguments", async () => {
    const { tools, agent } = await setup();
    m.getKnowledgeByCategory.mockResolvedValue({ c: 1 });
    m.searchKnowledge.mockResolvedValue([]);
    m.getLatestAnalysisReport.mockResolvedValue(null);
    m.getWatchlist.mockResolvedValue([{ symbol: "AAPL" }, { symbol: "MSFT" }]);
    m.saveMarketArticle.mockResolvedValue({ success: true, id: 1 });
    m.createFacebookDraft.mockResolvedValue({ success: true });
    m.getRecentArticles.mockResolvedValue([{ id: 1 }]);

    expect(textOf(await tools.get("get_knowledge")![3]({ category: "five_forces" }))).toEqual({ c: 1 });
    expect(m.getKnowledgeByCategory).toHaveBeenCalledWith(agent.env, "five_forces");
    expect(textOf(await tools.get("search_knowledge")![3]({ query: "moat" }))).toEqual([]);
    expect(m.searchKnowledge).toHaveBeenCalledWith(agent.env, "moat");
    expect(textOf(await tools.get("get_analysis_report")![3]({ symbol: "AAPL" }))).toBeNull();
    expect(m.getLatestAnalysisReport).toHaveBeenCalledWith(agent.env, "AAPL");

    expect(textOf(await tools.get("get_watchlist")![3]({ active_only: true }))).toEqual([
      { symbol: "AAPL" },
      { symbol: "MSFT" },
    ]);
    expect(m.getWatchlist).toHaveBeenCalledWith(agent.env, { activeOnly: true });

    expect(textOf(await tools.get("save_market_intelligence")![3]({ title: "T", summary: "S" }))).toEqual({ success: true, id: 1 });
    expect(m.saveMarketArticle).toHaveBeenCalledWith(agent.env, { title: "T", summary: "S" });

    expect(textOf(await tools.get("create_facebook_post_draft")![3]({ title: "T", content: "C" }))).toEqual({ success: true });
    expect(m.createFacebookDraft).toHaveBeenCalledWith(agent.env, { title: "T", content: "C" });

    expect(textOf(await tools.get("get_recent_intelligence")![3]({ limit: 5, source: "gemini_spark" }))).toEqual([{ id: 1 }]);
    expect(m.getRecentArticles).toHaveBeenCalledWith(agent.env, 5, "gemini_spark");
  });

  it("propagates knowledge errors to the MCP layer", async () => {
    const { tools } = await setup();
    m.getPortfolio.mockRejectedValue(new Error("d1 down"));
    await expect(tools.get("get_portfolio")![3]()).rejects.toThrow("d1 down");
  });
});
