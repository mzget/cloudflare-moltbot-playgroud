import { describe, it, expect, vi } from "vitest";

const m = vi.hoisted(() => ({
  getPortfolio: vi.fn(),
  getPortfolioHistory: vi.fn(),
  getKnowledgeByCategory: vi.fn(),
  searchKnowledge: vi.fn(),
  getLatestAnalysisReport: vi.fn(),
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
  it("registers all five tools with descriptions", async () => {
    const { tools } = await setup();
    expect([...tools.keys()]).toEqual([
      "get_portfolio",
      "get_portfolio_history",
      "get_knowledge",
      "search_knowledge",
      "get_analysis_report",
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
    expect(textOf(await tools.get("get_knowledge")![3]({ category: "five_forces" }))).toEqual({ c: 1 });
    expect(m.getKnowledgeByCategory).toHaveBeenCalledWith(agent.env, "five_forces");
    expect(textOf(await tools.get("search_knowledge")![3]({ query: "moat" }))).toEqual([]);
    expect(m.searchKnowledge).toHaveBeenCalledWith(agent.env, "moat");
    expect(textOf(await tools.get("get_analysis_report")![3]({ symbol: "AAPL" }))).toBeNull();
    expect(m.getLatestAnalysisReport).toHaveBeenCalledWith(agent.env, "AAPL");
  });

  it("propagates knowledge errors to the MCP layer", async () => {
    const { tools } = await setup();
    m.getPortfolio.mockRejectedValue(new Error("d1 down"));
    await expect(tools.get("get_portfolio")![3]()).rejects.toThrow("d1 down");
  });
});
