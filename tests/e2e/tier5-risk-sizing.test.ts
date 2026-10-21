import { describe, it, expect, beforeEach } from "vitest";
import {
  InMemoryD1Database,
  InMemoryR2Bucket,
  createFundamentalTools,
  handleDeleteTheme,
  handleRenameTheme,
} from "./contracts/contracts";
import { loadPortfolioRiskData } from "../../backend/src/routes/portfolio/risk";
import {
  DEFAULT_RISK_CONFIG,
  computeConcentrationAudit,
  computeCorrelationAndBeta,
  calculateFixedBasePositionSize,
  simulatePreTradeImpact,
  computePortfolioHealthScore,
  type RiskHoldingInput,
  type ThemeMappingInput,
} from "../../backend/src/portfolioRisk";

describe("Tier 5: Risk Manager & Portfolio Sizing Agent (End-to-End Lifecycles)", () => {
  let db: InMemoryD1Database;
  let r2: InMemoryR2Bucket;
  let tools: ReturnType<typeof createFundamentalTools>;

  beforeEach(() => {
    db = new InMemoryD1Database();
    r2 = new InMemoryR2Bucket();
    tools = createFundamentalTools({ DB: db, KNOWLEDGE_BUCKET: r2 });
  });

  // ==========================================================================
  // Scenario 1: Portfolio Concentration Audit & Zero-Weight Unused Themes
  // ==========================================================================
  it("Scenario 1: Concentration Audit with Holdings, Multi-Stock Themes & Unused Theme Retention", async () => {
    // 1. Seed holdings into D1
    db.holdings.push(
      { symbol: "NVDA", shares: 100, avg_cost: 100, total_cost: 10000, status: "open" },
      { symbol: "MSFT", shares: 50, avg_cost: 400, total_cost: 20000, status: "open" },
      { symbol: "AAPL", shares: 50, avg_cost: 200, total_cost: 10000, status: "open" },
      { symbol: "BABA", shares: 100, avg_cost: 80, total_cost: 8000, status: "open" }
    );

    // 2. Seed market stats (current prices)
    // NVDA = 120 -> $12,000 (24%)
    // MSFT = 420 -> $21,000 (42%)
    // AAPL = 220 -> $11,000 (22%)
    // BABA = 60  -> $6,000  (12%)
    // Total = $50,000
    db.marketStats.push(
      { symbol: "NVDA", price: 120, previous_close: 118 },
      { symbol: "MSFT", price: 420, previous_close: 415 },
      { symbol: "AAPL", price: 220, previous_close: 218 },
      { symbol: "BABA", price: 60, previous_close: 62 }
    );

    // 3. Seed watchlist names and sectors
    db.watchlist.push(
      { symbol: "NVDA", name: "NVIDIA Corp", sector_label: "Semiconductors" },
      { symbol: "MSFT", name: "Microsoft Corp", sector_label: "Software" },
      { symbol: "AAPL", name: "Apple Inc", sector_label: "Consumer Electronics" },
      { symbol: "BABA", name: "Alibaba Group", sector_label: "E-Commerce" }
    );

    // 4. Ingest Themes via MCP tool
    // Theme A: AI Accelerators (NVDA)
    await tools.save_theme_sector_context.execute({
      notebook_id: "nb_ai_accelerators",
      theme_name: "AI Accelerators",
      symbols: ["NVDA"],
    });

    // Theme B: Cloud & Platform Infrastructure (MSFT, AAPL)
    await tools.save_theme_sector_context.execute({
      notebook_id: "nb_cloud_infra",
      theme_name: "Cloud & Platform Infrastructure",
      symbols: ["MSFT", "AAPL"],
    });

    // Theme C: Clean Energy & Grid (Unused - 0 holdings in portfolio)
    await tools.save_theme_sector_context.execute({
      notebook_id: "nb_clean_energy",
      theme_name: "Clean Energy & Grid",
      symbols: ["ENPH"], // ENPH is not held in portfolio
    });

    // 5. Load portfolio risk data using backend D1 loader
    const { riskHoldings, themeMappings } = await loadPortfolioRiskData(db as any);

    expect(riskHoldings).toHaveLength(4);
    const nvdaHolding = riskHoldings.find((h) => h.symbol === "NVDA");
    expect(nvdaHolding?.lastPrice).toBe(120);

    // 6. Compute concentration audit with standard policy:
    // Target = 8%, Max Stock = 15%, Max Theme = 30%, Warning Stock = 12%
    const audit = computeConcentrationAudit(riskHoldings, themeMappings, DEFAULT_RISK_CONFIG);

    expect(audit.totalStockPortfolioUsd).toBe(50000);

    // Stock concentration checks
    const nvdaStock = audit.stockConcentrations.find((s) => s.symbol === "NVDA");
    expect(nvdaStock).toBeDefined();
    expect(nvdaStock!.weightPct).toBeCloseTo(24.0, 1);
    expect(nvdaStock!.status).toBe("breach"); // 24% > 15% max
    expect(nvdaStock!.trimToCapUsd).toBeCloseTo(12000 - 7500, 1); // $4,500 to trim

    const babaStock = audit.stockConcentrations.find((s) => s.symbol === "BABA");
    expect(babaStock).toBeDefined();
    expect(babaStock!.weightPct).toBeCloseTo(12.0, 1);
    expect(babaStock!.status).toBe("warning"); // 12% is warning threshold

    // Theme concentration checks
    const aiTheme = audit.themeExposures.find((t) => t.themeName === "AI Accelerators");
    expect(aiTheme).toBeDefined();
    expect(aiTheme!.weightPct).toBeCloseTo(24.0, 1);
    expect(aiTheme!.status).toBe("ok"); // 24% <= 30% cap

    const cloudTheme = audit.themeExposures.find((t) => t.themeName === "Cloud & Platform Infrastructure");
    expect(cloudTheme).toBeDefined();
    // MSFT (42%) + AAPL (22%) = 64% -> breached!
    expect(cloudTheme!.weightPct).toBeCloseTo(64.0, 1);
    expect(cloudTheme!.status).toBe("breach"); // 64% > 30%

    // Unassigned Theme check: BABA is not mapped to any theme
    const unassignedTheme = audit.themeExposures.find((t) => t.themeName === "Unassigned");
    expect(unassignedTheme).toBeDefined();
    expect(unassignedTheme!.weightPct).toBeCloseTo(12.0, 1);
    expect(unassignedTheme!.symbols).toEqual(["BABA"]);

    // CRITICAL: Unused theme retention check
    const cleanEnergyTheme = audit.themeExposures.find((t) => t.themeName === "Clean Energy & Grid");
    expect(cleanEnergyTheme).toBeDefined();
    expect(cleanEnergyTheme!.marketValueUsd).toBe(0);
    expect(cleanEnergyTheme!.weightPct).toBe(0);
    expect(cleanEnergyTheme!.status).toBe("ok");
    expect(cleanEnergyTheme!.symbols).toEqual(["ENPH"]);
  });

  // ==========================================================================
  // Scenario 2: Theme Deletion & Cascade Remapping
  // ==========================================================================
  it("Scenario 2: Theme Deletion (Unused and Active) via Atomic Batch Cascade", async () => {
    // 1. Setup portfolio with active theme and unused theme
    db.holdings.push(
      { symbol: "NVDA", shares: 100, avg_cost: 100, total_cost: 10000, status: "open" }
    );
    db.marketStats.push({ symbol: "NVDA", price: 100, previous_close: 100 });

    await tools.save_theme_sector_context.execute({
      notebook_id: "nb_theme_active",
      theme_name: "Active AI Hardware",
      symbols: ["NVDA"],
    });

    await tools.save_theme_sector_context.execute({
      notebook_id: "nb_theme_deprecated",
      theme_name: "Deprecated Clean Tech",
      symbols: ["TSLA"],
    });

    // Verify initial database rows
    expect(db.themeSectorContexts.has("nb_theme_deprecated")).toBe(true);
    expect(db.themeSymbolMappings.some((m) => m.notebook_id === "nb_theme_deprecated")).toBe(true);

    // 2. Delete unused theme "Deprecated Clean Tech"
    const delRes1 = await handleDeleteTheme(db, "Deprecated Clean Tech");
    expect(delRes1.status).toBe(200);
    expect(delRes1.success).toBe(true);
    expect(delRes1.deletedTheme).toBe("Deprecated Clean Tech");

    // Verify database state: context and mappings removed
    expect(db.themeSectorContexts.has("nb_theme_deprecated")).toBe(false);
    expect(db.themeSymbolMappings.some((m) => m.notebook_id === "nb_theme_deprecated")).toBe(false);

    // 3. Delete active theme "Active AI Hardware"
    // First rename "Active AI Hardware" inline to "Next-Gen AI Compute" and verify concentration audit updates
    const renameRes = await handleRenameTheme(db, "Active AI Hardware", "Next-Gen AI Compute");
    expect(renameRes.status).toBe(200);
    expect(renameRes.success).toBe(true);
    expect(renameRes.oldThemeName).toBe("Active AI Hardware");
    expect(renameRes.newThemeName).toBe("Next-Gen AI Compute");

    const afterRenameData = await loadPortfolioRiskData(db as any);
    const afterRenameAudit = computeConcentrationAudit(afterRenameData.riskHoldings, afterRenameData.themeMappings, DEFAULT_RISK_CONFIG);
    expect(afterRenameAudit.themeExposures.some((t) => t.themeName === "Next-Gen AI Compute")).toBe(true);
    expect(afterRenameAudit.themeExposures.some((t) => t.themeName === "Active AI Hardware")).toBe(false);

    // Now delete the renamed theme "Next-Gen AI Compute"
    const delRes2 = await handleDeleteTheme(db, "Next-Gen AI Compute");
    expect(delRes2.status).toBe(200);
    expect(delRes2.success).toBe(true);

    expect(db.themeSectorContexts.has("nb_theme_active")).toBe(false);
    expect(db.themeSymbolMappings.some((m) => m.notebook_id === "nb_theme_active")).toBe(false);

    // 4. Re-run concentration audit: NVDA should now fall back to "Unassigned"
    const { riskHoldings, themeMappings } = await loadPortfolioRiskData(db as any);
    const audit = computeConcentrationAudit(riskHoldings, themeMappings, DEFAULT_RISK_CONFIG);

    expect(audit.themeExposures.some((t) => t.themeName === "Next-Gen AI Compute")).toBe(false);
    expect(audit.themeExposures.some((t) => t.themeName === "Deprecated Clean Tech")).toBe(false);

    const unassigned = audit.themeExposures.find((t) => t.themeName === "Unassigned");
    expect(unassigned).toBeDefined();
    expect(unassigned!.weightPct).toBeCloseTo(100.0, 1);
    expect(unassigned!.symbols).toContain("NVDA");
  });

  // ==========================================================================
  // Scenario 3: Fixed-Base Position Sizing with DCF Margin of Safety
  // ==========================================================================
  it("Scenario 3: Fixed-Base Position Sizing with MoS and Max Cap Constraints", () => {
    const holdings: RiskHoldingInput[] = [
      { symbol: "NVDA", shares: 40, lastPrice: 100, status: "open" }, // $4,000 (4%)
      { symbol: "MSFT", shares: 100, lastPrice: 200, status: "open" }, // $20,000 (20%)
      { symbol: "AAPL", shares: 380, lastPrice: 200, status: "open" }, // $76,000 (76%)
    ]; // Total = $100,000
    const themeMappings: ThemeMappingInput[] = [
      { symbol: "NVDA", themeName: "Semiconductors", notebookId: "nb1" },
      { symbol: "MSFT", themeName: "Cloud", notebookId: "nb2" },
      { symbol: "AAPL", themeName: "Hardware", notebookId: "nb3" },
    ];
    const audit = computeConcentrationAudit(holdings, themeMappings, DEFAULT_RISK_CONFIG);

    // Case A: High Margin of Safety (Base MoS 30%, Bear MoS 10%)
    // NVDA currently at $4,000 (4%). Target 8% = $8,000. Room to target = $4,000 -> 40 shares at $100.
    // Stock cap is 15% = $15,000. Room to stock cap = $11,000 -> 110 shares.
    const sizingA = calculateFixedBasePositionSize({
      symbol: "NVDA",
      currentPrice: 100,
      audit,
      themeMappings,
      config: DEFAULT_RISK_CONFIG,
      baseMarginOfSafetyPct: 30,
      bearMarginOfSafetyPct: 10,
    });

    expect(sizingA.roomToTargetUsd).toBe(4000);
    expect(sizingA.roomToTargetShares).toBe(40);
    expect(sizingA.roomToStockCapUsd).toBe(11000);
    expect(sizingA.roomToStockCapShares).toBe(110);
    expect(sizingA.maxAllowedBuyShares).toBe(110);

    // Case B: Existing position exceeding target (MSFT currently at 20%)
    // Target 8% is already exceeded, so roomToTargetUsd is 0 and roomToTargetShares is 0.
    const sizingB = calculateFixedBasePositionSize({
      symbol: "MSFT",
      currentPrice: 200,
      audit,
      themeMappings,
      config: DEFAULT_RISK_CONFIG,
      baseMarginOfSafetyPct: 25,
      bearMarginOfSafetyPct: 5,
    });

    expect(sizingB.currentWeightPct).toBe(20);
    expect(sizingB.roomToTargetUsd).toBe(0);
    expect(sizingB.roomToTargetShares).toBe(0);
    expect(sizingB.bindingCapReason).toContain("Single-Stock Cap");
  });

  // ==========================================================================
  // Scenario 4: Pre-Trade Simulation Order Impact & Concentration Breaches
  // ==========================================================================
  it("Scenario 4: Pre-Trade Simulation Order Evaluation (Safe vs Breaching Orders)", () => {
    const existingHoldings: RiskHoldingInput[] = [
      { symbol: "NVDA", shares: 100, lastPrice: 100, status: "open" }, // $10,000 (10%)
      { symbol: "AAPL", shares: 400, lastPrice: 100, status: "open" }, // $40,000 (40%)
      { symbol: "CASH", shares: 500, lastPrice: 100, status: "open" }, // $50,000 (50%)
    ];
    const themeMappings: ThemeMappingInput[] = [
      { symbol: "NVDA", themeName: "Semiconductors", notebookId: "nb_semi" },
      { symbol: "AAPL", themeName: "Tech Hardware", notebookId: "nb_hw" },
    ];
    const audit = computeConcentrationAudit(existingHoldings, themeMappings, DEFAULT_RISK_CONFIG);

    // Simulation A: Safe BUY order (+20 NVDA shares = +$2,000)
    // NVDA goes from $10,000 (10%) to $12,000 (12%) -> Under 15% stock cap & 30% theme cap
    const simSafe = simulatePreTradeImpact({
      audit,
      order: {
        symbol: "NVDA",
        type: "Buy",
        shares: 20,
        price: 100,
      },
      themeMappings,
      config: DEFAULT_RISK_CONFIG,
    });

    expect(simSafe.causesStockCapBreach).toBe(false);
    expect(simSafe.causesThemeCapBreach).toBe(false);
    expect(simSafe.projectedStockWeightPct).toBeCloseTo(12.0, 1);

    // Simulation B: Breaching BUY order (+80 NVDA shares = +$8,000)
    // NVDA becomes $18,000 (18%) -> Exceeds 15% single stock cap
    const simBreachStock = simulatePreTradeImpact({
      audit,
      order: {
        symbol: "NVDA",
        type: "Buy",
        shares: 80,
        price: 100,
      },
      themeMappings,
      config: DEFAULT_RISK_CONFIG,
    });

    expect(simBreachStock.causesStockCapBreach).toBe(true);
    expect(simBreachStock.projectedStockWeightPct).toBeGreaterThan(15);

    // Simulation C: Breaching Theme BUY order (+250 NVDA shares = +$25,000)
    // Semiconductors theme becomes $35,000 (35%) -> Exceeds 30% theme cap
    const simBreachTheme = simulatePreTradeImpact({
      audit,
      order: {
        symbol: "NVDA",
        type: "Buy",
        shares: 250,
        price: 100,
      },
      themeMappings,
      config: DEFAULT_RISK_CONFIG,
    });

    expect(simBreachTheme.causesThemeCapBreach).toBe(true);
  });

  // ==========================================================================
  // Scenario 5: Multi-Stock Correlation Matrix & Portfolio Health Scoring
  // ==========================================================================
  it("Scenario 5: Correlation Matrix Computation & Portfolio Health Score Penalty", () => {
    // 1. Synthetic 30-day price series
    const dates = Array.from({ length: 30 }, (_, i) => {
      const day = String(i + 1).padStart(2, "0");
      return `2026-06-${day}`;
    });

    // SymA and SymB move in lockstep
    // Benchmark (^GSPC) moves steadily
    const priceSeries = {
      SYMA: dates.map((date, i) => ({ date, close: 100 + i * 2 })),
      SYMB: dates.map((date, i) => ({ date, close: 200 + i * 4 })),
      SYMC: dates.map((date, i) => ({ date, close: 150 - i * 2 })),
      "^GSPC": dates.map((date, i) => ({ date, close: 5000 + i * 10 })),
    };

    const holdings: RiskHoldingInput[] = [
      { symbol: "SYMA", shares: 100, lastPrice: 158, status: "open" },
      { symbol: "SYMB", shares: 50, lastPrice: 316, status: "open" },
      { symbol: "SYMC", shares: 100, lastPrice: 92, status: "open" },
    ];

    const corrResult = computeCorrelationAndBeta(holdings, priceSeries, "^GSPC", 0.70);

    // SYMA vs SYMB correlation is high (>= 0.70)
    expect(corrResult.highCorrelationPairs.length).toBeGreaterThan(0);
    const abPair = corrResult.highCorrelationPairs.find(
      (p) => (p.symbolA === "SYMA" && p.symbolB === "SYMB") || (p.symbolA === "SYMB" && p.symbolB === "SYMA")
    );
    expect(abPair).toBeDefined();
    expect(abPair!.correlation).toBeGreaterThan(0.70);

    // 2. Health Score evaluation
    // A diversified portfolio with 15 positions (6.67% each, < 10% warning, < 25% theme warning, HHI < 0.25)
    const healthyHoldings: RiskHoldingInput[] = Array.from({ length: 15 }, (_, i) => ({
      symbol: `STOCK_${i + 1}`,
      shares: 50,
      lastPrice: 100, // $5,000 each = 6.67%
      status: "open",
    }));
    const healthyThemeMappings: ThemeMappingInput[] = Array.from({ length: 15 }, (_, i) => ({
      symbol: `STOCK_${i + 1}`,
      themeName: `Theme_${Math.floor(i / 3) + 1}`, // 5 themes, 3 stocks each = 20%
      notebookId: `nb_${Math.floor(i / 3) + 1}`,
    }));
    const healthyConcentration = computeConcentrationAudit(healthyHoldings, healthyThemeMappings, DEFAULT_RISK_CONFIG);

    const emptyCorrelation = {
      stockBetas: {},
      stockAnnualizedVolatilities: {},
      portfolioBeta: 1.05,
      highCorrelationPairs: [],
    };

    const healthyScore = computePortfolioHealthScore(healthyConcentration, emptyCorrelation);
    expect(healthyScore.healthScore).toBeGreaterThanOrEqual(80);
    expect(healthyScore.riskLevel).toBe("Low");

    // A concentrated portfolio with breaches drops the health score
    const breachedHoldings: RiskHoldingInput[] = [
      { symbol: "SYMA", shares: 500, lastPrice: 100, status: "open" }, // $50,000 (50%) -> breaches 15% stock cap & 30% theme cap
      { symbol: "SYMB", shares: 500, lastPrice: 100, status: "open" }, // $50,000 (50%)
    ];
    const breachedThemeMappings: ThemeMappingInput[] = [
      { symbol: "SYMA", themeName: "Theme A", notebookId: "nb_a" },
      { symbol: "SYMB", themeName: "Theme A", notebookId: "nb_a" },
    ];
    const breachedConcentration = computeConcentrationAudit(breachedHoldings, breachedThemeMappings, DEFAULT_RISK_CONFIG);

    const breachedScore = computePortfolioHealthScore(breachedConcentration, corrResult);
    expect(breachedScore.healthScore).toBeLessThan(75);
    expect(["Moderate", "Elevated", "High"]).toContain(breachedScore.riskLevel);

    // Deductions & warning reasons
    expect(breachedScore.deductions.length).toBeGreaterThan(0);
    expect(breachedScore.deductions.some((d) => d.reason.includes("SYMA"))).toBe(true);
  });
});
