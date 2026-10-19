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

const dcfMock = vi.hoisted(() => ({
  saveDcfScenarios: vi.fn(),
  getDcfModel: vi.fn(),
  listDcfSymbols: vi.fn(),
}));

const fundamentalMock = vi.hoisted(() => ({
  saveFundamentalBrief: vi.fn(),
  saveThemeSectorContext: vi.fn(),
  getFundamentalBrief: vi.fn(),
  saveBullBearDebate: vi.fn(),
  getBullBearDebate: vi.fn(),
  saveFundamentalBriefShape: {},
  saveThemeSectorContextShape: {},
  getFundamentalBriefShape: {},
  saveBullBearDebateShape: {},
  getBullBearDebateShape: {},
}));

vi.mock("agents/mcp", () => ({ McpAgent: class { env: any = { id: "env" }; } }));
vi.mock("@modelcontextprotocol/sdk/server/mcp.js", () => ({
  McpServer: class { tool = vi.fn(); },
}));
vi.mock("./knowledge", () => m);
vi.mock("./dcfTools", () => dcfMock);
vi.mock("./fundamentalTools", () => fundamentalMock);

import { OaktreeMCP } from "./mcpAgent";

async function setup() {
  const agent: any = new (OaktreeMCP as any)({}, {});
  await agent.init();
  const tools = new Map<string, any[]>(agent.server.tool.mock.calls.map((c: any[]) => [c[0], c]));
  return { agent, tools };
}
const textOf = (res: any) => JSON.parse(res.content[0].text);

describe("OaktreeMCP", () => {
  it("registers all twenty tools with descriptions", async () => {
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
      "save_dcf_scenarios",
      "get_dcf_model",
      "list_dcf_symbols",
      "save_fundamental_brief",
      "save_bull_bear_debate",
      "get_bull_bear_debate",
      "save_theme_sector_context",
      "get_fundamental_brief",
      "get_portfolio_risk_audit",
      "calculate_position_size",
      "save_risk_advisory",
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

    dcfMock.saveDcfScenarios.mockResolvedValue({ success: true, symbol: "NVDA" });
    dcfMock.getDcfModel.mockResolvedValue({ symbol: "NVDA", scenarios: [] });
    dcfMock.listDcfSymbols.mockResolvedValue({ total_symbols: 1, symbols: [] });

    expect(textOf(await tools.get("save_dcf_scenarios")![3]({ symbol: "NVDA", scenarios: [] }))).toEqual({ success: true, symbol: "NVDA" });
    expect(dcfMock.saveDcfScenarios).toHaveBeenCalledWith(agent.env, { symbol: "NVDA", scenarios: [] });

    expect(textOf(await tools.get("get_dcf_model")![3]({ symbol: "NVDA" }))).toEqual({ symbol: "NVDA", scenarios: [] });
    expect(dcfMock.getDcfModel).toHaveBeenCalledWith(agent.env, "NVDA");

    expect(textOf(await tools.get("list_dcf_symbols")![3]())).toEqual({ total_symbols: 1, symbols: [] });
    expect(dcfMock.listDcfSymbols).toHaveBeenCalledWith(agent.env);

    fundamentalMock.saveFundamentalBrief.mockResolvedValue({ success: true, symbol: "ARM" });
    fundamentalMock.saveBullBearDebate.mockResolvedValue({ success: true, symbol: "ARM" });
    fundamentalMock.getBullBearDebate.mockResolvedValue({ symbol: "ARM", debate: null });
    fundamentalMock.saveThemeSectorContext.mockResolvedValue({ success: true, notebook_id: "nb-1" });
    fundamentalMock.getFundamentalBrief.mockResolvedValue({ fundamental: { symbol: "ARM" }, themes: [] });

    expect(textOf(await tools.get("save_fundamental_brief")![3]({ symbol: "ARM", as_of_date: "2026-10-01" }))).toEqual({ success: true, symbol: "ARM" });
    expect(fundamentalMock.saveFundamentalBrief).toHaveBeenCalledWith(agent.env, { symbol: "ARM", as_of_date: "2026-10-01" });

    expect(textOf(await tools.get("save_bull_bear_debate")![3]({ symbol: "ARM", debate: {} }))).toEqual({ success: true, symbol: "ARM" });
    expect(fundamentalMock.saveBullBearDebate).toHaveBeenCalledWith(agent.env, { symbol: "ARM", debate: {} });

    expect(textOf(await tools.get("get_bull_bear_debate")![3]({ symbol: "ARM" }))).toEqual({ symbol: "ARM", debate: null });
    expect(fundamentalMock.getBullBearDebate).toHaveBeenCalledWith(agent.env, { symbol: "ARM" });

    expect(textOf(await tools.get("save_theme_sector_context")![3]({ notebook_id: "nb-1", theme_name: "AI" }))).toEqual({ success: true, notebook_id: "nb-1" });
    expect(fundamentalMock.saveThemeSectorContext).toHaveBeenCalledWith(agent.env, { notebook_id: "nb-1", theme_name: "AI" });

    expect(textOf(await tools.get("get_fundamental_brief")![3]({ symbol: "ARM" }))).toEqual({ fundamental: { symbol: "ARM" }, themes: [] });
    expect(fundamentalMock.getFundamentalBrief).toHaveBeenCalledWith(agent.env, { symbol: "ARM" });
  });

  it("propagates knowledge errors to the MCP layer", async () => {
    const { tools } = await setup();
    m.getPortfolio.mockRejectedValue(new Error("d1 down"));
    await expect(tools.get("get_portfolio")![3]()).rejects.toThrow("d1 down");
  });
});
