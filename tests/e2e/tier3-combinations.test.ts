import { describe, it, expect, beforeEach } from "vitest";
import {
  InMemoryD1Database,
  InMemoryR2Bucket,
  createFundamentalTools,
  fetchQualitativeData,
  formatDebateContext,
  getBullOpeningPrompt,
  getBearOpeningPrompt,
  calculateFreshnessStatus,
  generateGeminiExtractionPrompt,
  handleGetFundamentalsStatus,
  handleGetFundamentalBySymbol
} from "./contracts/contracts";
import { armFundamentalSeed, semiAnalysisThemeSeed } from "./fixtures/armSeed";
import { nvdaFundamentalMock } from "./fixtures/mockData";

describe("Tier 3: Pairwise & Cross-Feature Combinations", () => {
  let db: InMemoryD1Database;
  let r2: InMemoryR2Bucket;
  let tools: ReturnType<typeof createFundamentalTools>;

  beforeEach(() => {
    db = new InMemoryD1Database();
    r2 = new InMemoryR2Bucket();
    tools = createFundamentalTools({ DB: db, KNOWLEDGE_BUCKET: r2 });
  });

  // Combination 1: F1 (D1 Schema) × F3 (save_fundamental_brief) × F5 (get_fundamental_brief)
  it("Combo 1: Ingests brief via MCP tool into D1 schema, then retrieves via MCP get tool with full fidelity", async () => {
    await tools.save_fundamental_brief.execute(armFundamentalSeed);
    const getRes = await tools.get_fundamental_brief.execute({ symbol: "ARM" });
    const parsed = JSON.parse(getRes.content[0].text);

    expect(parsed.fundamental).not.toBeNull();
    expect(parsed.fundamental.symbol).toBe("ARM");
    expect(parsed.fundamental.as_of_date).toBe("2026-07-29");
    expect(parsed.fundamental.guidance.revenue_target).toBe("Mid-20s % revenue CAGR through FY27");
  });

  // Combination 2: F1 (D1 Schema) × F4 (save_theme_sector_context) × F5 (get_fundamental_brief)
  it("Combo 2: Ingests theme via MCP tool, maps symbols, then retrieves joined themes via MCP get tool", async () => {
    await tools.save_theme_sector_context.execute(semiAnalysisThemeSeed);
    const getRes = await tools.get_fundamental_brief.execute({ symbol: "NVDA" });
    const parsed = JSON.parse(getRes.content[0].text);

    expect(parsed.fundamental).toBeNull(); // No fundamental brief yet
    expect(parsed.themes).toHaveLength(1);
    expect(parsed.themes[0].theme_name).toBe("SemiAnalysis AI & Compute Dynamics");
    expect(parsed.themes[0].supply_chain_bottlenecks).toContain("Advanced packaging (CoWoS)");
  });

  // Combination 3: F3 (save_fundamental_brief) × F2 (OKF Markdown) × R2 Bucket
  it("Combo 3: Ingesting single-stock brief automatically generates OKF markdown and writes to R2 bucket", async () => {
    await tools.save_fundamental_brief.execute(armFundamentalSeed);
    const r2Key = `fundamentals/${armFundamentalSeed.symbol}.md`;
    const r2Object = await r2.get(r2Key);
    expect(r2Object).not.toBeNull();

    const okfText = await r2Object?.text();
    expect(okfText).toContain("symbol: ARM");
    expect(okfText).toContain("# Fundamental Brief: ARM");
    expect(okfText).toContain("## Guidance Targets");
  });

  // Combination 4: F3 (save_fundamental_brief) × F7 (Qualitative Fetch) × F8 (5-Section Context)
  it("Combo 4: Ingested single-stock brief is retrieved by fetchQualitativeData and formatted into Section 2 of debate prompt", async () => {
    await tools.save_fundamental_brief.execute(armFundamentalSeed);
    const qual = await fetchQualitativeData(db, "ARM");
    const debatePrompt = formatDebateContext("Price: 142.50 USD", [], [], qual);

    expect(debatePrompt).toContain("### 2. ข้อมูลเชิงคุณภาพและบทวิเคราะห์พื้นฐาน (Company Fundamental Brief)");
    expect(debatePrompt).toContain("เป้ารายได้: Mid-20s % revenue CAGR through FY27");
    expect(debatePrompt).toContain("v9 architecture adoption rate (2x royalty rate vs v8)");
  });

  // Combination 5: F4 (save_theme_sector_context) × F7 (Qualitative Fetch) × F8 (5-Section Context)
  it("Combo 5: Ingested theme context is retrieved by fetchQualitativeData and formatted into Section 3 of debate prompt", async () => {
    await tools.save_theme_sector_context.execute(semiAnalysisThemeSeed);
    const qual = await fetchQualitativeData(db, "ARM");
    const debatePrompt = formatDebateContext("Price: 142.50 USD", [], [], qual);

    expect(debatePrompt).toContain("### 3. บริบทอุตสาหกรรมและภาพรวมการแข่งขัน (Sector & Competitive Dynamics):");
    expect(debatePrompt).toContain("SemiAnalysis AI & Compute Dynamics");
    expect(debatePrompt).toContain("คอขวดห่วงโซ่อุปทาน: Advanced packaging (CoWoS)");
  });

  // Combination 6: F7 (Qualitative Fetch) × F10 (Graceful Fallback)
  it("Combo 6: Querying qualitative data for unseeded stock returns safe empty structure without crashing debate context", async () => {
    const qual = await fetchQualitativeData(db, "UNKNOWN_TICKER");
    expect(qual.fundamental).toBeNull();
    expect(qual.themes).toEqual([]);

    const debatePrompt = formatDebateContext("Price: 50 USD\nP/E: 15", [], [], qual);
    expect(debatePrompt).toContain("### 1. ข้อมูลทางการเงินและตัวชี้วัด (Financial Metrics):");
    expect(debatePrompt).not.toContain("### 2.");
    expect(debatePrompt).not.toContain("### 3.");
  });

  // Combination 7: F8 (5-Section Formatter) × F9 (Prompt Grounding Rules)
  it("Combo 7: 5-section formatted context is injected into Bull and Bear prompts mandating guidance and risks citations", async () => {
    await tools.save_fundamental_brief.execute(armFundamentalSeed);
    const qual = await fetchQualitativeData(db, "ARM");
    const contextStr = formatDebateContext("Price: 142.50 USD", [], [], qual);

    const bull = getBullOpeningPrompt("ARM", contextStr);
    const bear = getBearOpeningPrompt("ARM", contextStr);

    expect(bull.prompt).toContain("Mid-20s % revenue CAGR through FY27");
    expect(bull.system).toContain("Management Guidance");
    expect(bear.prompt).toContain("SoftBank ownership concentration overhang");
    expect(bear.system).toContain("Key Risks");
  });

  // Combination 8: F1 (D1 Schema) × F11 (API Status Route) × Freshness Classification
  it("Combo 8: Database with active, stale, and unseeded stocks queried via status route, returning accurate categorization", async () => {
    const refDate = new Date("2026-08-15T00:00:00Z");

    // 1. Active (<90d)
    await tools.save_fundamental_brief.execute({ symbol: "ARM", as_of_date: "2026-07-29" });
    // 2. Stale (>=90d)
    await tools.save_fundamental_brief.execute({ symbol: "INTC", as_of_date: "2026-04-01" });

    const watchlist = [
      { symbol: "ARM", company_name: "Arm Holdings plc" },
      { symbol: "INTC", company_name: "Intel Corp" },
      { symbol: "PLTR", company_name: "Palantir Technologies" } // Missing
    ];

    const statusRes = await handleGetFundamentalsStatus(db, watchlist, refDate);
    expect(statusRes.items).toHaveLength(3);

    const armItem = statusRes.items.find((i) => i.symbol === "ARM");
    const intcItem = statusRes.items.find((i) => i.symbol === "INTC");
    const pltrItem = statusRes.items.find((i) => i.symbol === "PLTR");

    expect(armItem?.status).toBe("active");
    expect(intcItem?.status).toBe("stale");
    expect(pltrItem?.status).toBe("missing");
  });

  // Combination 9: F3 (save_fundamental_brief) × F11 (API Status Refresh Lifecycle)
  it("Combo 9: Watchlist item starts as missing, brief ingested with recent date, status flips to active", async () => {
    const refDate = new Date("2026-08-15");
    const watchlist = [{ symbol: "NVDA", company_name: "NVIDIA Corp" }];

    // Step 1: Initial check
    const initialStatus = await handleGetFundamentalsStatus(db, watchlist, refDate);
    expect(initialStatus.items[0].status).toBe("missing");

    // Step 2: Ingest brief
    await tools.save_fundamental_brief.execute(nvdaFundamentalMock);

    // Step 3: Check status again
    const updatedStatus = await handleGetFundamentalsStatus(db, watchlist, refDate);
    expect(updatedStatus.items[0].status).toBe("active");
    expect(updatedStatus.items[0].as_of_date).toBe("2026-08-28");
  });

  // Combination 10: F12 (Observability UI) × F13 (Copy Prompt Modal Integration)
  it("Combo 10: Selecting an unseeded stock triggers generation of Gemini prompt for that ticker with exact extraction schema", () => {
    const symbol = "AVGO";
    const status = calculateFreshnessStatus(null);
    expect(status).toBe("missing");

    const prompt = generateGeminiExtractionPrompt(symbol);
    expect(prompt).toContain("# Fundamental Research Extraction Prompt: AVGO");
    expect(prompt).toContain('"symbol": "AVGO"');
    expect(prompt).toContain("save_fundamental_brief");
  });

  // Combination 11: F3 (save_fundamental_brief) × F4 (save_theme_sector_context) × F14 (ARM Golden Seed Dual Ingestion)
  it("Combo 11: Ingests ARM seed and SemiAnalysis theme context, verified via unified query returning both", async () => {
    await tools.save_fundamental_brief.execute(armFundamentalSeed);
    await tools.save_theme_sector_context.execute(semiAnalysisThemeSeed);

    const briefRes = await handleGetFundamentalBySymbol(db, "ARM");
    expect(briefRes.status).toBe(200);
    expect(briefRes.data?.fundamental?.symbol).toBe("ARM");
    expect(briefRes.data?.themes).toHaveLength(1);
    expect(briefRes.data?.themes[0].theme_name).toBe("SemiAnalysis AI & Compute Dynamics");
  });

  // Combination 12: F3 (save_fundamental_brief) Upsert Idempotency & R2 Synchronization
  it("Combo 12: Updating a brief with new filing date and updated metrics updates both D1 and R2 simultaneously", async () => {
    await tools.save_fundamental_brief.execute(armFundamentalSeed);

    const updatedSeed = {
      ...armFundamentalSeed,
      as_of_date: "2026-10-30",
      source_count: 4,
      guidance: {
        ...armFundamentalSeed.guidance,
        revenue_target: "30% revenue CAGR through FY28"
      }
    };
    await tools.save_fundamental_brief.execute(updatedSeed);

    // Verify D1
    const inDb = db.stockFundamentals.get("ARM");
    expect(inDb?.as_of_date).toBe("2026-10-30");
    expect(inDb?.source_count).toBe(4);
    expect(db.stockFundamentals.size).toBe(1);

    // Verify R2
    const r2Obj = await r2.get("fundamentals/ARM.md");
    const r2Content = await r2Obj?.text();
    expect(r2Content).toContain("as_of_date: 2026-10-30");
    expect(r2Content).toContain("30% revenue CAGR through FY28");
  });

  // Combination 13: F4 (save_theme_sector_context) Symbol Mapping Refresh & Foreign Key Cascade
  it("Combo 13: Updating a theme's symbol list cleans up orphaned mappings, and deleting theme cascades to all mappings", async () => {
    await tools.save_theme_sector_context.execute({
      notebook_id: "t_cascade",
      theme_name: "Cascade Test",
      symbols: ["ARM", "NVDA", "INTC"]
    });
    expect(db.themeSymbolMappings.filter((m) => m.notebook_id === "t_cascade")).toHaveLength(3);

    // Re-map with fewer symbols
    await tools.save_theme_sector_context.execute({
      notebook_id: "t_cascade",
      theme_name: "Cascade Test",
      symbols: ["ARM"]
    });
    expect(db.themeSymbolMappings.filter((m) => m.notebook_id === "t_cascade")).toHaveLength(1);

    // Delete theme and verify cascade
    await db.prepare("DELETE FROM theme_sector_contexts WHERE notebook_id = ?").bind("t_cascade").run();
    expect(db.themeSymbolMappings.filter((m) => m.notebook_id === "t_cascade")).toHaveLength(0);
  });

  // Combination 14: F10 (Graceful Fallbacks) × F11 (API Route Lookup)
  it("Combo 14: Querying /api/fundamentals for non-existent symbol returns 200 with fundamental: null without crashing", async () => {
    const res = await handleGetFundamentalBySymbol(db, "NONEXISTENT_TICKER");
    expect(res.status).toBe(200);
    expect(res.data?.fundamental).toBeNull();
    expect(res.data?.themes).toEqual([]);
  });

  // Combination 15: F6 (MCP Tool Registry) × F3/F4/F5 Dispatch Execution
  it("Combo 15: Calling tools through the unified tool suite executes the respective operations and produces valid MCP text outputs", async () => {
    // 1. Tool 1: save_fundamental_brief
    const saveFundRes = await tools.save_fundamental_brief.execute({ symbol: "TSM", as_of_date: "2026-07-15" });
    expect(saveFundRes.content[0].text).toContain("TSM");

    // 2. Tool 2: save_theme_sector_context
    const saveThemeRes = await tools.save_theme_sector_context.execute({
      notebook_id: "t_tsm",
      theme_name: "Foundry Leadership",
      symbols: ["TSM"]
    });
    expect(saveThemeRes.content[0].text).toContain("Foundry Leadership");

    // 3. Tool 3: get_fundamental_brief
    const getRes = await tools.get_fundamental_brief.execute({ symbol: "TSM" });
    const parsed = JSON.parse(getRes.content[0].text);
    expect(parsed.fundamental.symbol).toBe("TSM");
    expect(parsed.themes[0].theme_name).toBe("Foundry Leadership");
  });
});
