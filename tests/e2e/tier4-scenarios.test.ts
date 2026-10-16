import { describe, it, expect, beforeEach } from "vitest";
import {
  InMemoryD1Database,
  InMemoryR2Bucket,
  createFundamentalTools,
  fetchQualitativeData,
  formatDebateContext,
  getBullOpeningPrompt,
  getBearOpeningPrompt,
  calculateConvictionLabel,
  calculateFreshnessStatus,
  generateGeminiExtractionPrompt,
  handleGetFundamentalsStatus,
  handleGetFundamentalBySymbol
} from "./contracts/contracts";
import { armFundamentalSeed, semiAnalysisThemeSeed } from "./fixtures/armSeed";

describe("Tier 4: Real-World Scenarios (End-to-End Lifecycles)", () => {
  let db: InMemoryD1Database;
  let r2: InMemoryR2Bucket;
  let tools: ReturnType<typeof createFundamentalTools>;

  beforeEach(() => {
    db = new InMemoryD1Database();
    r2 = new InMemoryR2Bucket();
    tools = createFundamentalTools({ DB: db, KNOWLEDGE_BUCKET: r2 });
  });

  // ==========================================================================
  // Scenario 1: Quarterly Earnings Refresh Lifecycle
  // ==========================================================================
  it("Scenario 1: Quarterly Earnings Refresh Lifecycle (Prompt -> Extract -> MCP Push -> R2 OKF -> Status Flip)", async () => {
    const symbol = "ARM";
    const refDate = new Date("2026-08-15T00:00:00Z");

    // 1. Initial State: Watchlist status shows ARM is stale (>100 days old)
    await tools.save_fundamental_brief.execute({
      symbol: "ARM",
      as_of_date: "2026-04-01", // 136 days before refDate
      source_count: 1
    });

    const preStatus = await handleGetFundamentalsStatus(db, [{ symbol: "ARM", company_name: "Arm Holdings plc" }], refDate);
    expect(preStatus.items[0].status).toBe("stale");

    // 2. User copies extraction prompt from UI modal
    const extractionPrompt = generateGeminiExtractionPrompt(symbol);
    expect(extractionPrompt).toContain("# Fundamental Research Extraction Prompt: ARM");
    expect(extractionPrompt).toContain("save_fundamental_brief");

    // 3. User prompts Gemini Notebook with newly uploaded Q1 FY27 report
    // Gemini extracts structured JSON and invokes MCP tool save_fundamental_brief
    const mcpResponse = await tools.save_fundamental_brief.execute({
      ...armFundamentalSeed,
      as_of_date: "2026-07-29" // 17 days before refDate
    });
    expect(mcpResponse.content[0].text).toContain("Successfully saved fundamental brief for ARM");

    // 4. Verify R2 OKF markdown persisted with new filing date
    const r2Key = `fundamentals/${symbol}.md`;
    const r2Obj = await r2.get(r2Key);
    expect(r2Obj).not.toBeNull();
    const okfContent = await r2Obj?.text();
    expect(okfContent).toContain("as_of_date: 2026-07-29");
    expect(okfContent).toContain("Mid-20s % revenue CAGR through FY27");

    // 5. Verify Observability Dashboard status flips from stale to active
    const postStatus = await handleGetFundamentalsStatus(db, [{ symbol: "ARM", company_name: "Arm Holdings plc" }], refDate);
    expect(postStatus.items[0].status).toBe("active");
    expect(postStatus.items[0].as_of_date).toBe("2026-07-29");
  });

  // ==========================================================================
  // Scenario 2: Thematic Sector Dynamics Multi-Stock Linkage
  // ==========================================================================
  it("Scenario 2: Thematic Sector Dynamics Multi-Stock Linkage (Theme Ingestion -> Multi-Symbol Link -> Independent Retrieval)", async () => {
    // 1. Push theme dynamics covering AI data center silicon
    const themeRes = await tools.save_theme_sector_context.execute({
      notebook_id: "theme_ai_silicon",
      theme_name: "AI Accelerators & Custom Silicon",
      industry_dynamics: "Transition toward bespoke ASICs and high-bandwidth interconnects.",
      supply_chain_bottlenecks: "CoWoS advanced packaging allocations at TSMC.",
      competitive_landscape: "NVIDIA dominant in training; CSP ASICs gaining inference share.",
      macro_trends: "Power density constraints limiting mega-datacenter builds.",
      symbols: ["ARM", "NVDA", "AVGO", "TSM"]
    });
    expect(themeRes.content[0].text).toContain("linked 4 symbols");

    // 2. Verify all 4 mapped tickers retrieve the sector dynamics
    for (const sym of ["ARM", "NVDA", "AVGO", "TSM"]) {
      const qual = await fetchQualitativeData(db, sym);
      expect(qual.themes).toHaveLength(1);
      expect(qual.themes[0].theme_name).toBe("AI Accelerators & Custom Silicon");
      expect(qual.themes[0].supply_chain_bottlenecks).toContain("CoWoS");
    }

    // 3. Verify an unmapped ticker does NOT receive the theme
    const unmappedQual = await fetchQualitativeData(db, "INTC");
    expect(unmappedQual.themes).toHaveLength(0);
  });

  // ==========================================================================
  // Scenario 3: Zero-Data Cold-Start Dialectical Debate
  // ==========================================================================
  it("Scenario 3: Zero-Data Cold-Start Dialectical Debate (Graceful Degradation to Quantitative Metrics Only)", async () => {
    const symbol = "PLTR";
    const metricsStr = "Price: 32.50 USD\nP/E: 85.2\nRevenue Growth: 24%";

    // 1. Database has zero records for PLTR
    const qual = await fetchQualitativeData(db, symbol);
    expect(qual.fundamental).toBeNull();
    expect(qual.themes).toEqual([]);

    // 2. Format debate context with only quantitative numbers and an event
    const events = [{ title: "AIP Enterprise Customer Expansion", event_date: "2026-08-10", event_type: "product" }];
    const debateContext = formatDebateContext(metricsStr, events, [], qual);

    // 3. Verify clean 5-section context without undefined sections
    expect(debateContext).toContain("### 1. ข้อมูลทางการเงินและตัวชี้วัด (Financial Metrics):");
    expect(debateContext).toContain("Price: 32.50 USD");
    expect(debateContext).not.toContain("### 2. ข้อมูลเชิงคุณภาพและบทวิเคราะห์พื้นฐาน");
    expect(debateContext).not.toContain("### 3. บริบทอุตสาหกรรมและภาพรวมการแข่งขัน");
    expect(debateContext).toContain("### 4. ข่าวและเหตุการณ์สำคัญล่าสุด (Recent Market Events):");
    expect(debateContext).toContain("[PRODUCT] AIP Enterprise Customer Expansion");

    // 4. Verify Bull and Bear prompts generate cleanly from cold-start context
    const bullPrompt = getBullOpeningPrompt(symbol, debateContext);
    const bearPrompt = getBearOpeningPrompt(symbol, debateContext);

    expect(bullPrompt.prompt).toContain("PLTR");
    expect(bearPrompt.prompt).toContain("Price: 32.50 USD");
  });

  // ==========================================================================
  // Scenario 4: High-Conviction Adversarial Dialectical Debate
  // ==========================================================================
  it("Scenario 4: High-Conviction Adversarial Dialectical Debate (Rich Grounding Fusion -> Bull Guidance -> Bear Overhang -> Balanced Verdict)", async () => {
    // 1. Ingest ARM fundamental brief and SemiAnalysis theme
    await tools.save_fundamental_brief.execute(armFundamentalSeed);
    await tools.save_theme_sector_context.execute(semiAnalysisThemeSeed);

    // 2. Prepare 5-section debate context
    const qual = await fetchQualitativeData(db, "ARM");
    const debateContext = formatDebateContext(
      "Price: 142.50 USD\nMarket Cap: 148 Billion USD\nP/E: 78.5",
      [{ title: "v9 Adoption Surge", event_date: "2026-08-01", event_type: "earnings" }],
      [{ title: "SemiAnalysis ARM Teardown", summary: "CSS licensing model margin lift analysis" }],
      qual
    );

    // 3. Generate prompts
    const bullPrompt = getBullOpeningPrompt("ARM", debateContext);
    const bearPrompt = getBearOpeningPrompt("ARM", debateContext);

    // Verify Bull prompt is supplied with guidance targets and moat
    expect(bullPrompt.prompt).toContain("Mid-20s % revenue CAGR through FY27");
    expect(bullPrompt.prompt).toContain("v9 architecture adoption rate (2x royalty rate vs v8)");

    // Verify Bear prompt is supplied with risks and structural headwinds
    expect(bearPrompt.prompt).toContain("SoftBank ownership concentration overhang");
    expect(bearPrompt.prompt).toContain("RISC-V open architecture gaining traction");

    // 4. Simulated Arbiter evaluation
    const convictionScore = 4; // Moderate Bull (+4)
    const label = calculateConvictionLabel(convictionScore);
    expect(label).toBe("Moderate Bull");
  });

  // ==========================================================================
  // Scenario 5: Multi-Quarter Stale Flagging & Aging Lifecycle
  // ==========================================================================
  it("Scenario 5: Multi-Quarter Stale Flagging & Aging Lifecycle (Aging -> Warning Badge -> Refresh)", async () => {
    const symbol = "TSM";
    const baseDate = new Date("2026-01-01T00:00:00Z");

    // Quarter 1: Ingested fresh
    await tools.save_fundamental_brief.execute({
      symbol: "TSM",
      as_of_date: "2026-01-01",
      business_model: "Pure-play semiconductor foundry"
    });

    // Check status at Day 30: Active (🟢)
    const day30 = new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    const statusDay30 = await handleGetFundamentalsStatus(db, [{ symbol: "TSM", company_name: "TSMC" }], day30);
    expect(statusDay30.items[0].status).toBe("active");

    // Check status at Day 95: Stale (🟡)
    const day95 = new Date(baseDate.getTime() + 95 * 24 * 60 * 60 * 1000);
    const statusDay95 = await handleGetFundamentalsStatus(db, [{ symbol: "TSM", company_name: "TSMC" }], day95);
    expect(statusDay95.items[0].status).toBe("stale");

    // Quarter 2: Refresh brief with new Q2 filing date
    await tools.save_fundamental_brief.execute({
      symbol: "TSM",
      as_of_date: "2026-04-10",
      business_model: "Pure-play semiconductor foundry with 2nm N2 ramp"
    });

    // Check status at Day 105: Flips back to Active (🟢)
    const day105 = new Date(baseDate.getTime() + 105 * 24 * 60 * 60 * 1000); // 2026-04-16
    const statusDay105 = await handleGetFundamentalsStatus(db, [{ symbol: "TSM", company_name: "TSMC" }], day105);
    expect(statusDay105.items[0].status).toBe("active");
    expect(statusDay105.items[0].as_of_date).toBe("2026-04-10");
  });

  // ==========================================================================
  // Scenario 6: Malformed / Adversarial External Agent Injection & Resilience
  // ==========================================================================
  it("Scenario 6: Malformed / Adversarial External Agent Injection & Resilience (Validation Rejection Without State Corruption)", async () => {
    // 1. Attempt 1: SQL injection in guidance and invalid date
    const maliciousPayload = {
      symbol: "HACK",
      as_of_date: "2026/07/29; DROP TABLE stock_fundamentals;--",
      guidance: {
        revenue_target: "'; DROP TABLE stock_fundamentals;--"
      }
    };

    await expect(tools.save_fundamental_brief.execute(maliciousPayload)).rejects.toThrow();

    // Verify D1 table remains untouched
    expect(db.stockFundamentals.has("HACK")).toBe(false);

    // 2. Attempt 2: Negative source count and empty symbol
    const invalidPayload = {
      symbol: "",
      as_of_date: "2026-08-01",
      source_count: -5
    };

    await expect(tools.save_fundamental_brief.execute(invalidPayload)).rejects.toThrow();
    expect(db.stockFundamentals.size).toBe(0);

    // 3. Attempt 3: Valid brief still works normally afterward
    const validRes = await tools.save_fundamental_brief.execute({
      symbol: "CLEAN",
      as_of_date: "2026-08-01"
    });
    expect(validRes.content[0].text).toContain("CLEAN");
    expect(db.stockFundamentals.has("CLEAN")).toBe(true);
  });

  // ==========================================================================
  // Scenario 7: Full Golden Flow for ARM (ADR 0010 Reference Implementation)
  // ==========================================================================
  it("Scenario 7: Full Golden Flow for ARM (ADR 0010 Reference Flow)", async () => {
    // 1. Ingest ARM seed brief
    const armRes = await tools.save_fundamental_brief.execute(armFundamentalSeed);
    expect(armRes.content[0].text).toContain("Successfully saved fundamental brief for ARM");

    // 2. Ingest SemiAnalysis theme
    const themeRes = await tools.save_theme_sector_context.execute(semiAnalysisThemeSeed);
    expect(themeRes.content[0].text).toContain("SemiAnalysis AI & Compute Dynamics");

    // 3. Verify R2 OKF file exists and contains valid frontmatter
    const r2Key = "fundamentals/ARM.md";
    const r2Obj = await r2.get(r2Key);
    expect(r2Obj).not.toBeNull();
    const okf = await r2Obj?.text();
    expect(okf).toContain("symbol: ARM");
    expect(okf).toContain("as_of_date: 2026-07-29");

    // 4. Verify REST API status returns Active and SemiAnalysis tag
    const statusRes = await handleGetFundamentalsStatus(
      db,
      [{ symbol: "ARM", company_name: "Arm Holdings plc" }],
      new Date("2026-08-15T00:00:00Z")
    );
    expect(statusRes.items[0].status).toBe("active");
    expect(statusRes.items[0].theme_tags).toContain("SemiAnalysis AI & Compute Dynamics");

    // 5. Verify REST API single lookup returns both brief and theme
    const lookupRes = await handleGetFundamentalBySymbol(db, "ARM");
    expect(lookupRes.status).toBe(200);
    expect(lookupRes.data?.fundamental?.symbol).toBe("ARM");
    expect(lookupRes.data?.themes[0].theme_name).toBe("SemiAnalysis AI & Compute Dynamics");

    // 6. Verify 5-section debate context contains all qualitative citations
    const qual = await fetchQualitativeData(db, "ARM");
    const debateContext = formatDebateContext(
      "Price: 142.50 USD\nP/E: 78.5\nGross Margin: 96%",
      [{ title: "Q1 FY27 Earnings", event_date: "2026-07-29", event_type: "earnings" }],
      [{ title: "SemiAnalysis Deep Dive", summary: "Compute Subsystem Licensing" }],
      qual
    );

    expect(debateContext).toContain("### 1. ข้อมูลทางการเงินและตัวชี้วัด (Financial Metrics):");
    expect(debateContext).toContain("### 2. ข้อมูลเชิงคุณภาพและบทวิเคราะห์พื้นฐาน (Company Fundamental Brief)");
    expect(debateContext).toContain("### 3. บริบทอุตสาหกรรมและภาพรวมการแข่งขัน (Sector & Competitive Dynamics):");
    expect(debateContext).toContain("### 4. ข่าวและเหตุการณ์สำคัญล่าสุด (Recent Market Events):");
    expect(debateContext).toContain("### 5. บทวิเคราะห์และมุมมองสังเคราะห์ (Research & Notes):");
  });

  // ==========================================================================
  // Scenario 8: Orphan Theme Cleanup & Symbol Re-mapping
  // ==========================================================================
  it("Scenario 8: Orphan Theme Cleanup & Symbol Re-mapping (Dynamic Symbol Re-binding)", async () => {
    // 1. Initial mapping: SemiAnalysis linked to ARM and INTC
    await tools.save_theme_sector_context.execute({
      notebook_id: "t_semi",
      theme_name: "Semiconductors",
      symbols: ["ARM", "INTC"]
    });

    const armQual1 = await fetchQualitativeData(db, "ARM");
    const intcQual1 = await fetchQualitativeData(db, "INTC");
    expect(armQual1.themes).toHaveLength(1);
    expect(intcQual1.themes).toHaveLength(1);

    // 2. Re-mapping: INTC removed, QCOM added
    await tools.save_theme_sector_context.execute({
      notebook_id: "t_semi",
      theme_name: "Semiconductors",
      symbols: ["ARM", "QCOM"]
    });

    const armQual2 = await fetchQualitativeData(db, "ARM");
    const intcQual2 = await fetchQualitativeData(db, "INTC");
    const qcomQual2 = await fetchQualitativeData(db, "QCOM");

    expect(armQual2.themes).toHaveLength(1);
    expect(intcQual2.themes).toHaveLength(0); // Successfully unlinked
    expect(qcomQual2.themes).toHaveLength(1); // Successfully linked
  });
});
