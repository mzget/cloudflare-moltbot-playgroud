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
  handleGetFundamentalBySymbol,
  serializeToOkfMarkdown,
  parseOkfMarkdown,
  saveFundamentalBriefSchema,
  saveThemeSectorContextSchema,
  getFundamentalBriefSchema
} from "./contracts/contracts";
import { armFundamentalSeed, semiAnalysisThemeSeed } from "./fixtures/armSeed";
import { nvdaFundamentalMock, sampleMarketStats } from "./fixtures/mockData";

describe("Tier 1: Feature Coverage (Category-Partition: F1-F14)", () => {
  let db: InMemoryD1Database;
  let r2: InMemoryR2Bucket;
  let tools: ReturnType<typeof createFundamentalTools>;

  beforeEach(() => {
    db = new InMemoryD1Database();
    r2 = new InMemoryR2Bucket();
    tools = createFundamentalTools({ DB: db, KNOWLEDGE_BUCKET: r2 });
  });

  // --------------------------------------------------------------------------
  // F1: D1 Migration 0041
  // --------------------------------------------------------------------------
  describe("F1: D1 Migration 0041 (Schema & Layout)", () => {
    it("F1.1: creates stock_fundamentals table with primary key and JSON text fields", async () => {
      await db.prepare(
        `INSERT OR REPLACE INTO stock_fundamentals (symbol, business_model, moat, competitors, guidance, key_risks, thesis_kpis, as_of_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind("ARM", "Licensing", "Architecture ISA", '["RISC-V"]', '{"revenue_target":"25%"}', '["Risks"]', '["KPIs"]', "2026-07-29").run();

      const row = await db.prepare("SELECT * FROM stock_fundamentals WHERE symbol = ?").bind("ARM").first<any>();
      expect(row).toBeDefined();
      expect(row.symbol).toBe("ARM");
      expect(JSON.parse(row.competitors)).toEqual(["RISC-V"]);
    });

    it("F1.2: creates theme_sector_contexts table with notebook_id as primary key", async () => {
      await db.prepare(
        `INSERT OR REPLACE INTO theme_sector_contexts (notebook_id, theme_name, industry_dynamics)
         VALUES (?, ?, ?)`
      ).bind("theme_semianalysis_01", "SemiAnalysis AI", "High Capex Transition").run();

      expect(db.themeSectorContexts.has("theme_semianalysis_01")).toBe(true);
      expect(db.themeSectorContexts.get("theme_semianalysis_01")?.theme_name).toBe("SemiAnalysis AI");
    });

    it("F1.3: enforces foreign key relation between theme_symbol_mappings and theme_sector_contexts", async () => {
      await expect(
        db.prepare("INSERT INTO theme_symbol_mappings (notebook_id, symbol) VALUES (?, ?)")
          .bind("non_existent_notebook", "ARM")
          .run()
      ).rejects.toThrow(/FOREIGN KEY/);
    });

    it("F1.4: supports cascade deletion of symbol mappings when theme context is deleted", async () => {
      await db.prepare(
        `INSERT OR REPLACE INTO theme_sector_contexts (notebook_id, theme_name) VALUES (?, ?)`
      ).bind("theme_01", "Theme One").run();

      await db.prepare("INSERT INTO theme_symbol_mappings (notebook_id, symbol) VALUES (?, ?)")
        .bind("theme_01", "ARM").run();
      await db.prepare("INSERT INTO theme_symbol_mappings (notebook_id, symbol) VALUES (?, ?)")
        .bind("theme_01", "NVDA").run();

      expect(db.themeSymbolMappings.filter((m) => m.notebook_id === "theme_01")).toHaveLength(2);

      await db.prepare("DELETE FROM theme_sector_contexts WHERE notebook_id = ?")
        .bind("theme_01").run();

      expect(db.themeSymbolMappings.filter((m) => m.notebook_id === "theme_01")).toHaveLength(0);
    });

    it("F1.5: verifies index configuration on as_of_date and theme_symbol_mappings(symbol)", () => {
      expect(db.indices.idx_stock_fundamentals_as_of_date).toBe(true);
      expect(db.indices.idx_theme_symbol_mappings_symbol).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // F2: OKF Markdown Persistence
  // --------------------------------------------------------------------------
  describe("F2: OKF Markdown Persistence (R2 Knowledge Bucket)", () => {
    it("F2.1: serializes fundamental profile with valid YAML frontmatter", () => {
      const okf = serializeToOkfMarkdown(armFundamentalSeed);
      expect(okf).toContain("---");
      expect(okf).toContain("symbol: ARM");
      expect(okf).toContain("as_of_date: 2026-07-29");
      expect(okf).toContain("type: fundamental_brief");
    });

    it("F2.2: formats section headers according to OKF spec", () => {
      const okf = serializeToOkfMarkdown(armFundamentalSeed);
      expect(okf).toContain("# Fundamental Brief: ARM");
      expect(okf).toContain("## Business Model");
      expect(okf).toContain("## Economic Moat");
      expect(okf).toContain("## Guidance Targets");
      expect(okf).toContain("## Key Competitors");
      expect(okf).toContain("## Key Risks");
      expect(okf).toContain("## Thesis KPIs");
    });

    it("F2.3: serializes guidance targets with revenue, margin, and timeframe", () => {
      const okf = serializeToOkfMarkdown(armFundamentalSeed);
      expect(okf).toContain("Revenue Target: Mid-20s % revenue CAGR through FY27");
      expect(okf).toContain("Margin Target: Operating margin expanding to >45%");
      expect(okf).toContain("Timeframe: FY25-FY27");
    });

    it("F2.4: saves OKF file under fundamentals/{symbol}.md in R2 bucket", async () => {
      const key = `fundamentals/${armFundamentalSeed.symbol}.md`;
      const okf = serializeToOkfMarkdown(armFundamentalSeed);
      await r2.put(key, okf);

      const saved = await r2.get(key);
      expect(saved).not.toBeNull();
      const text = await saved?.text();
      expect(text).toBe(okf);
    });

    it("F2.5: parses OKF markdown back into metadata frontmatter and body", () => {
      const okf = serializeToOkfMarkdown(armFundamentalSeed);
      const parsed = parseOkfMarkdown(okf);
      expect(parsed.frontmatter.symbol).toBe("ARM");
      expect(parsed.frontmatter.as_of_date).toBe("2026-07-29");
      expect(parsed.body).toContain("## Business Model");
    });
  });

  // --------------------------------------------------------------------------
  // F3: MCP save_fundamental_brief
  // --------------------------------------------------------------------------
  describe("F3: MCP save_fundamental_brief (Single-Stock Ingestion)", () => {
    it("F3.1: ingests full valid payload into D1 stock_fundamentals", async () => {
      const result = await tools.save_fundamental_brief.execute(armFundamentalSeed);
      expect(result.content[0].text).toContain("Successfully saved fundamental brief for ARM");

      const inDb = db.stockFundamentals.get("ARM");
      expect(inDb).toBeDefined();
      expect(inDb?.as_of_date).toBe("2026-07-29");
      expect(JSON.parse(inDb?.competitors || "[]")).toContain("RISC-V ecosystem");
    });

    it("F3.2: automatically persists OKF markdown to R2 bucket during ingestion", async () => {
      await tools.save_fundamental_brief.execute(armFundamentalSeed);
      const file = await r2.get("fundamentals/ARM.md");
      expect(file).not.toBeNull();
      const content = await file?.text();
      expect(content).toContain("symbol: ARM");
    });

    it("F3.3: ingests minimal valid payload with symbol and as_of_date", async () => {
      const minimal = { symbol: "AAPL", as_of_date: "2026-08-01" };
      const res = await tools.save_fundamental_brief.execute(minimal);
      expect(res.content[0].text).toContain("AAPL");
      expect(db.stockFundamentals.get("AAPL")?.as_of_date).toBe("2026-08-01");
    });

    it("F3.4: upserts existing record cleanly without creating duplicate rows", async () => {
      await tools.save_fundamental_brief.execute({ symbol: "TSM", as_of_date: "2026-01-01", business_model: "Old" });
      await tools.save_fundamental_brief.execute({ symbol: "TSM", as_of_date: "2026-04-01", business_model: "New" });

      expect(db.stockFundamentals.size).toBe(1);
      expect(db.stockFundamentals.get("TSM")?.business_model).toBe("New");
      expect(db.stockFundamentals.get("TSM")?.as_of_date).toBe("2026-04-01");
    });

    it("F3.5: validates input schema using Zod and normalizes symbol to uppercase", () => {
      const parsed = saveFundamentalBriefSchema.parse({ symbol: "  arm  ", as_of_date: "2026-07-29" });
      expect(parsed.symbol).toBe("ARM");
    });
  });

  // --------------------------------------------------------------------------
  // F4: MCP save_theme_sector_context
  // --------------------------------------------------------------------------
  describe("F4: MCP save_theme_sector_context (Theme & Symbol Mapping)", () => {
    it("F4.1: ingests theme sector context into D1 theme_sector_contexts", async () => {
      const res = await tools.save_theme_sector_context.execute(semiAnalysisThemeSeed);
      expect(res.content[0].text).toContain("SemiAnalysis AI & Compute Dynamics");
      expect(db.themeSectorContexts.has("theme_semianalysis_01")).toBe(true);
    });

    it("F4.2: batch links multiple stock symbols in theme_symbol_mappings", async () => {
      await tools.save_theme_sector_context.execute(semiAnalysisThemeSeed);
      const mappings = db.themeSymbolMappings.filter((m) => m.notebook_id === "theme_semianalysis_01");
      const mappedSymbols = mappings.map((m) => m.symbol);
      expect(mappedSymbols).toEqual(expect.arrayContaining(["ARM", "NVDA", "AVGO", "TSM"]));
    });

    it("F4.3: updates theme details when called with existing notebook_id", async () => {
      await tools.save_theme_sector_context.execute({
        notebook_id: "t1",
        theme_name: "Original Name",
        symbols: ["ARM"]
      });
      await tools.save_theme_sector_context.execute({
        notebook_id: "t1",
        theme_name: "Updated Name",
        symbols: ["ARM", "NVDA"]
      });

      expect(db.themeSectorContexts.get("t1")?.theme_name).toBe("Updated Name");
      expect(db.themeSymbolMappings.filter((m) => m.notebook_id === "t1")).toHaveLength(2);
    });

    it("F4.4: deduplicates input symbols and converts to uppercase", () => {
      const parsed = saveThemeSectorContextSchema.parse({
        notebook_id: "t_test",
        theme_name: "Test",
        symbols: ["arm", "ARM", "nvda", "  NVDA  "]
      });
      expect(parsed.symbols).toEqual(["ARM", "NVDA"]);
    });

    it("F4.5: supports saving theme context without linked symbols", async () => {
      const res = await tools.save_theme_sector_context.execute({
        notebook_id: "t_macro",
        theme_name: "Macro Headwinds 2026"
      });
      expect(res.content[0].text).toContain("linked 0 symbols");
      expect(db.themeSectorContexts.has("t_macro")).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // F5: MCP get_fundamental_brief
  // --------------------------------------------------------------------------
  describe("F5: MCP get_fundamental_brief (Brief & Joined Themes Retrieval)", () => {
    it("F5.1: retrieves fundamental brief and linked theme sector contexts", async () => {
      await tools.save_fundamental_brief.execute(armFundamentalSeed);
      await tools.save_theme_sector_context.execute(semiAnalysisThemeSeed);

      const res = await tools.get_fundamental_brief.execute({ symbol: "ARM" });
      const data = JSON.parse(res.content[0].text);
      expect(data.fundamental).toBeDefined();
      expect(data.fundamental.symbol).toBe("ARM");
      expect(data.themes).toHaveLength(1);
      expect(data.themes[0].theme_name).toBe("SemiAnalysis AI & Compute Dynamics");
    });

    it("F5.2: retrieves fundamental brief with empty themes when no themes mapped", async () => {
      await tools.save_fundamental_brief.execute(nvdaFundamentalMock);
      const res = await tools.get_fundamental_brief.execute({ symbol: "NVDA" });
      const data = JSON.parse(res.content[0].text);
      expect(data.fundamental.symbol).toBe("NVDA");
      expect(data.themes).toEqual([]);
    });

    it("F5.3: returns fundamental: null when symbol has no saved profile", async () => {
      const res = await tools.get_fundamental_brief.execute({ symbol: "UNKNOWN" });
      const data = JSON.parse(res.content[0].text);
      expect(data.fundamental).toBeNull();
      expect(data.themes).toEqual([]);
    });

    it("F5.4: returns multiple theme contexts when symbol is mapped to multiple themes", async () => {
      await tools.save_fundamental_brief.execute(armFundamentalSeed);
      await tools.save_theme_sector_context.execute(semiAnalysisThemeSeed);
      await tools.save_theme_sector_context.execute({
        notebook_id: "theme_edge_ai",
        theme_name: "Edge AI & IoT Devices",
        symbols: ["ARM", "QCOM"]
      });

      const res = await tools.get_fundamental_brief.execute({ symbol: "ARM" });
      const data = JSON.parse(res.content[0].text);
      expect(data.themes).toHaveLength(2);
      const themeNames = data.themes.map((t: any) => t.theme_name);
      expect(themeNames).toContain("SemiAnalysis AI & Compute Dynamics");
      expect(themeNames).toContain("Edge AI & IoT Devices");
    });

    it("F5.5: validates symbol parameter using Zod schema", () => {
      expect(() => getFundamentalBriefSchema.parse({ symbol: "" })).toThrow();
      const parsed = getFundamentalBriefSchema.parse({ symbol: " arm " });
      expect(parsed.symbol).toBe("ARM");
    });
  });

  // --------------------------------------------------------------------------
  // F6: MCP Agent Registration & Inventory Verification
  // --------------------------------------------------------------------------
  describe("F6: MCP Agent Registration & Inventory Verification", () => {
    it("F6.1: verifies save_fundamental_brief tool descriptor and metadata", () => {
      expect(tools.save_fundamental_brief.name).toBe("save_fundamental_brief");
      expect(tools.save_fundamental_brief.description).toBeTruthy();
    });

    it("F6.2: verifies save_theme_sector_context tool descriptor and metadata", () => {
      expect(tools.save_theme_sector_context.name).toBe("save_theme_sector_context");
      expect(tools.save_theme_sector_context.description).toBeTruthy();
    });

    it("F6.3: verifies get_fundamental_brief tool descriptor and metadata", () => {
      expect(tools.get_fundamental_brief.name).toBe("get_fundamental_brief");
      expect(tools.get_fundamental_brief.description).toBeTruthy();
    });

    it("F6.4: verifies exactly 3 fundamental tools in the suite", () => {
      const toolKeys = Object.keys(tools);
      expect(toolKeys).toHaveLength(3);
      expect(toolKeys).toContain("save_fundamental_brief");
      expect(toolKeys).toContain("save_theme_sector_context");
      expect(toolKeys).toContain("get_fundamental_brief");
    });

    it("F6.5: verifies tool execution dispatch returns valid MCP text content", async () => {
      const res = await tools.save_fundamental_brief.execute({ symbol: "INTC", as_of_date: "2026-06-01" });
      expect(res.content).toBeInstanceOf(Array);
      expect(res.content[0].type).toBe("text");
      expect(typeof res.content[0].text).toBe("string");
    });
  });

  // --------------------------------------------------------------------------
  // F7: Qualitative Fetching in Debate Engine
  // --------------------------------------------------------------------------
  describe("F7: Qualitative Fetching in Debate Engine", () => {
    it("F7.1: fetchQualitativeData fetches fundamental brief and joined themes", async () => {
      await tools.save_fundamental_brief.execute(armFundamentalSeed);
      await tools.save_theme_sector_context.execute(semiAnalysisThemeSeed);

      const qual = await fetchQualitativeData(db, "ARM");
      expect(qual.fundamental).not.toBeNull();
      expect(qual.fundamental?.symbol).toBe("ARM");
      expect(qual.themes).toHaveLength(1);
      expect(qual.themes[0].theme_name).toBe("SemiAnalysis AI & Compute Dynamics");
    });

    it("F7.2: fetchQualitativeData returns null fundamental for unseeded ticker", async () => {
      const qual = await fetchQualitativeData(db, "PLTR");
      expect(qual.fundamental).toBeNull();
      expect(qual.themes).toEqual([]);
    });

    it("F7.3: fetchQualitativeData normalizes ticker to uppercase", async () => {
      await tools.save_fundamental_brief.execute(armFundamentalSeed);
      const qual = await fetchQualitativeData(db, "arm");
      expect(qual.fundamental?.symbol).toBe("ARM");
    });

    it("F7.4: parses stringified guidance and KPIs into typed objects", async () => {
      await tools.save_fundamental_brief.execute(armFundamentalSeed);
      const qual = await fetchQualitativeData(db, "ARM");
      expect(qual.fundamental?.guidance?.revenue_target).toBe("Mid-20s % revenue CAGR through FY27");
      expect(qual.fundamental?.thesis_kpis).toHaveLength(3);
    });

    it("F7.5: handles multiple theme contexts attached to one symbol", async () => {
      await tools.save_theme_sector_context.execute({
        notebook_id: "t1",
        theme_name: "Theme 1",
        symbols: ["TSM"]
      });
      await tools.save_theme_sector_context.execute({
        notebook_id: "t2",
        theme_name: "Theme 2",
        symbols: ["TSM"]
      });

      const qual = await fetchQualitativeData(db, "TSM");
      expect(qual.themes).toHaveLength(2);
    });
  });

  // --------------------------------------------------------------------------
  // F8: 5-Section Debate Context Formatter
  // --------------------------------------------------------------------------
  describe("F8: 5-Section Debate Context Formatter", () => {
    it("F8.1: includes Section 1: Financial Metrics in formatted output", () => {
      const context = formatDebateContext("Price: 142.50 USD\nP/E: 78.5");
      expect(context).toContain("### 1. ข้อมูลทางการเงินและตัวชี้วัด (Financial Metrics):");
      expect(context).toContain("Price: 142.50 USD");
    });

    it("F8.2: includes Section 2: Company Fundamental Brief when provided", () => {
      const qual = {
        fundamental: armFundamentalSeed,
        themes: []
      };
      const context = formatDebateContext("Price: 142.50 USD", [], [], qual);
      expect(context).toContain("### 2. ข้อมูลเชิงคุณภาพและบทวิเคราะห์พื้นฐาน (Company Fundamental Brief)");
      expect(context).toContain("โมเดลธุรกิจ (Business Model):");
      expect(context).toContain("ปราการทางธุรกิจ (Economic Moat):");
      expect(context).toContain("เป้าหมายและการชี้นำของผู้บริหาร (Management Guidance):");
    });

    it("F8.3: includes Section 3: Sector & Competitive Dynamics when themes present", () => {
      const qual = {
        fundamental: null,
        themes: [semiAnalysisThemeSeed]
      };
      const context = formatDebateContext("Price: 142.50 USD", [], [], qual);
      expect(context).toContain("### 3. บริบทอุตสาหกรรมและภาพรวมการแข่งขัน (Sector & Competitive Dynamics):");
      expect(context).toContain("SemiAnalysis AI & Compute Dynamics");
      expect(context).toContain("พลวัตอุตสาหกรรม:");
    });

    it("F8.4: includes Section 4: Recent Market Events when events provided", () => {
      const events = [
        { title: "Q1 Earnings Beat", event_date: "2026-08-01", event_type: "earnings", description: "Revenue grew 39%" }
      ];
      const context = formatDebateContext("Price: 142.50 USD", events, []);
      expect(context).toContain("### 4. ข่าวและเหตุการณ์สำคัญล่าสุด (Recent Market Events):");
      expect(context).toContain("[EARNINGS] Q1 Earnings Beat (2026-08-01): Revenue grew 39%");
    });

    it("F8.5: includes Section 5: Research & Notes when notebook articles provided", () => {
      const articles = [
        { title: "SemiAnalysis ARM Teardown", summary: "Deep analysis of CSS architectural licensing margin lift" }
      ];
      const context = formatDebateContext("Price: 142.50 USD", [], articles);
      expect(context).toContain("### 5. บทวิเคราะห์และมุมมองสังเคราะห์ (Research & Notes):");
      expect(context).toContain("หัวข้อ: SemiAnalysis ARM Teardown");
    });
  });

  // --------------------------------------------------------------------------
  // F9: Prompt Grounding Rules
  // --------------------------------------------------------------------------
  describe("F9: Prompt Grounding Rules (Bull/Bear/Arbiter)", () => {
    it("F9.1: getBullOpeningPrompt mandates grounding in guidance, moat, and KPIs", () => {
      const promptObj = getBullOpeningPrompt("ARM", "Sample Context");
      expect(promptObj.system).toContain("Management Guidance");
      expect(promptObj.system).toContain("Moat");
      expect(promptObj.system).toContain("Thesis KPIs");
      expect(promptObj.prompt).toContain("ARM");
    });

    it("F9.2: getBearOpeningPrompt mandates grounding in key risks and structural headwinds", () => {
      const promptObj = getBearOpeningPrompt("ARM", "Sample Context");
      expect(promptObj.system).toContain("Key Risks");
      expect(promptObj.system).toContain("Structural Headwinds");
      expect(promptObj.system).toContain("Inversion Thinking");
    });

    it("F9.3: calculateConvictionLabel evaluates Strong Bull (+7 to +10)", () => {
      expect(calculateConvictionLabel(7)).toBe("Strong Bull");
      expect(calculateConvictionLabel(10)).toBe("Strong Bull");
    });

    it("F9.4: calculateConvictionLabel evaluates Neutral and Bear labels", () => {
      expect(calculateConvictionLabel(0)).toBe("Neutral");
      expect(calculateConvictionLabel(-4)).toBe("Moderate Bear");
      expect(calculateConvictionLabel(-8)).toBe("Strong Bear");
    });

    it("F9.5: requires JSON responses without unescaped double quotes", () => {
      const bull = getBullOpeningPrompt("ARM", "");
      const bear = getBearOpeningPrompt("ARM", "");
      expect(bull.system).toContain("ห้ามใช้เครื่องหมาย double quote ซ้อนภายในข้อความ");
      expect(bear.system).toContain("ห้ามใช้เครื่องหมาย double quote ซ้อนภายในข้อความ");
    });
  });

  // --------------------------------------------------------------------------
  // F10: Graceful Grounding Fallbacks
  // --------------------------------------------------------------------------
  describe("F10: Graceful Grounding Fallbacks", () => {
    it("F10.1: formats debate context without throwing when qualitative data is null", () => {
      expect(() => formatDebateContext("Price: 100", [], [], null)).not.toThrow();
      const res = formatDebateContext("Price: 100", [], [], null);
      expect(res).toContain("### 1. ข้อมูลทางการเงินและตัวชี้วัด (Financial Metrics):");
      expect(res).not.toContain("### 2. ข้อมูลเชิงคุณภาพ");
    });

    it("F10.2: formats debate context without throwing when qualitative data is empty object", () => {
      const emptyQual = { fundamental: null, themes: [] };
      const res = formatDebateContext("Price: 100", [], [], emptyQual);
      expect(res).not.toContain("### 2. ข้อมูลเชิงคุณภาพ");
      expect(res).not.toContain("### 3. บริบทอุตสาหกรรม");
    });

    it("F10.3: formats debate context when guidance fields are missing or partial", () => {
      const partialQual = {
        fundamental: {
          symbol: "AAPL",
          as_of_date: "2026-06-30",
          guidance: { revenue_target: "Single digit growth" }
        },
        themes: []
      };
      const res = formatDebateContext("Price: 200", [], [], partialQual);
      expect(res).toContain("เป้ารายได้: Single digit growth");
      expect(res).not.toContain("เป้าอัตรากำไร:");
    });

    it("F10.4: gracefully skips empty market events array", () => {
      const res = formatDebateContext("Price: 100", []);
      expect(res).not.toContain("### 4. ข่าวและเหตุการณ์สำคัญล่าสุด");
    });

    it("F10.5: gracefully skips empty research articles array", () => {
      const res = formatDebateContext("Price: 100", [], []);
      expect(res).not.toContain("### 5. บทวิเคราะห์และมุมมองสังเคราะห์");
    });
  });

  // --------------------------------------------------------------------------
  // F11: Fundamentals API Routes
  // --------------------------------------------------------------------------
  describe("F11: Fundamentals API Routes", () => {
    it("F11.1: handleGetFundamentalsStatus returns watchlist with status and themes", async () => {
      await tools.save_fundamental_brief.execute(armFundamentalSeed);
      await tools.save_theme_sector_context.execute(semiAnalysisThemeSeed);

      const watchlist = [{ symbol: "ARM", company_name: "Arm Holdings plc" }];
      const res = await handleGetFundamentalsStatus(db, watchlist, new Date("2026-08-15"));
      expect(res.items).toHaveLength(1);
      expect(res.items[0].symbol).toBe("ARM");
      expect(res.items[0].status).toBe("active");
      expect(res.items[0].theme_tags).toContain("SemiAnalysis AI & Compute Dynamics");
    });

    it("F11.2: handleGetFundamentalsStatus assigns 'stale' status when >90 days elapsed", async () => {
      await tools.save_fundamental_brief.execute({
        symbol: "INTC",
        as_of_date: "2026-01-01"
      });
      const watchlist = [{ symbol: "INTC", company_name: "Intel Corp" }];
      const res = await handleGetFundamentalsStatus(db, watchlist, new Date("2026-08-15"));
      expect(res.items[0].status).toBe("stale");
    });

    it("F11.3: handleGetFundamentalsStatus assigns 'missing' status when no record exists", async () => {
      const watchlist = [{ symbol: "PLTR", company_name: "Palantir" }];
      const res = await handleGetFundamentalsStatus(db, watchlist);
      expect(res.items[0].status).toBe("missing");
      expect(res.items[0].as_of_date).toBeNull();
    });

    it("F11.4: handleGetFundamentalBySymbol returns 400 when symbol missing", async () => {
      const res = await handleGetFundamentalBySymbol(db, "");
      expect(res.status).toBe(400);
      expect(res.error).toBe("Symbol parameter is required");
    });

    it("F11.5: handleGetFundamentalBySymbol returns fundamental and joined themes", async () => {
      await tools.save_fundamental_brief.execute(armFundamentalSeed);
      await tools.save_theme_sector_context.execute(semiAnalysisThemeSeed);

      const res = await handleGetFundamentalBySymbol(db, "ARM");
      expect(res.status).toBe(200);
      expect(res.data?.fundamental?.symbol).toBe("ARM");
      expect(res.data?.themes[0].theme_name).toBe("SemiAnalysis AI & Compute Dynamics");
    });
  });

  // --------------------------------------------------------------------------
  // F12: Observability Tab & Freshness Badge Classification
  // --------------------------------------------------------------------------
  describe("F12: Observability Tab & Freshness Badge Classification", () => {
    it("F12.1: classifies as_of_date < 90 days as 'active'", () => {
      const ref = new Date("2026-08-15");
      const filing = "2026-07-29"; // 17 days ago
      expect(calculateFreshnessStatus(filing, ref)).toBe("active");
    });

    it("F12.2: classifies as_of_date >= 90 days as 'stale'", () => {
      const ref = new Date("2026-08-15");
      const filing = "2026-05-01"; // 106 days ago
      expect(calculateFreshnessStatus(filing, ref)).toBe("stale");
    });

    it("F12.3: classifies null or empty as_of_date as 'missing'", () => {
      expect(calculateFreshnessStatus(null)).toBe("missing");
      expect(calculateFreshnessStatus("")).toBe("missing");
      expect(calculateFreshnessStatus(undefined)).toBe("missing");
    });

    it("F12.4: classifies invalid date string as 'missing'", () => {
      expect(calculateFreshnessStatus("not-a-date")).toBe("missing");
    });

    it("F12.5: classifies future or same-day as_of_date as 'active'", () => {
      const now = new Date("2026-08-15");
      expect(calculateFreshnessStatus("2026-08-15", now)).toBe("active");
      expect(calculateFreshnessStatus("2026-08-20", now)).toBe("active");
    });
  });

  // --------------------------------------------------------------------------
  // F13: Copy Prompt for Gemini Modal Generation
  // --------------------------------------------------------------------------
  describe("F13: Copy Prompt for Gemini Modal Generation", () => {
    it("F13.1: generates markdown prompt targeting the given ticker symbol", () => {
      const prompt = generateGeminiExtractionPrompt("ARM");
      expect(prompt).toContain("# Fundamental Research Extraction Prompt: ARM");
      expect(prompt).toContain('"symbol": "ARM"');
    });

    it("F13.2: includes save_fundamental_brief JSON schema structure in prompt", () => {
      const prompt = generateGeminiExtractionPrompt("NVDA");
      expect(prompt).toContain("save_fundamental_brief");
      expect(prompt).toContain('"business_model":');
      expect(prompt).toContain('"moat":');
      expect(prompt).toContain('"guidance":');
      expect(prompt).toContain('"key_risks":');
      expect(prompt).toContain('"thesis_kpis":');
      expect(prompt).toContain('"as_of_date":');
    });

    it("F13.3: instructs Gemini to derive as_of_date strictly from source filing", () => {
      const prompt = generateGeminiExtractionPrompt("ARM");
      expect(prompt).toContain("MUST be derived from the filing or earnings release date");
      expect(prompt).toContain("Do NOT invent dates");
    });

    it("F13.4: normalizes input symbol in prompt generation", () => {
      const prompt = generateGeminiExtractionPrompt("  tsm  ");
      expect(prompt).toContain("# Fundamental Research Extraction Prompt: TSM");
      expect(prompt).toContain('"symbol": "TSM"');
    });

    it("F13.5: formats markdown prompt with valid code blocks for easy copying", () => {
      const prompt = generateGeminiExtractionPrompt("AVGO");
      expect(prompt).toContain("```json");
      expect(prompt).toContain("```");
    });
  });

  // --------------------------------------------------------------------------
  // F14: ARM Seed Ingestion & E2E Grounding Validation
  // --------------------------------------------------------------------------
  describe("F14: ARM Seed Ingestion & E2E Grounding Validation", () => {
    it("F14.1: validates and ingests official ARM fundamental brief into D1", async () => {
      const res = await tools.save_fundamental_brief.execute(armFundamentalSeed);
      expect(res.content[0].text).toContain("ARM");
      const record = db.stockFundamentals.get("ARM");
      expect(record?.moat).toContain("instruction set architecture (ISA)");
    });

    it("F14.2: verifies ARM OKF markdown is saved to R2 fundamentals/ARM.md", async () => {
      await tools.save_fundamental_brief.execute(armFundamentalSeed);
      const r2Obj = await r2.get("fundamentals/ARM.md");
      const okf = await r2Obj?.text();
      expect(okf).toContain("symbol: ARM");
      expect(okf).toContain("as_of_date: 2026-07-29");
    });

    it("F14.3: ingests SemiAnalysis theme and joins ARM in theme_symbol_mappings", async () => {
      await tools.save_theme_sector_context.execute(semiAnalysisThemeSeed);
      const mappings = db.themeSymbolMappings.filter((m) => m.symbol === "ARM");
      expect(mappings).toHaveLength(1);
      expect(mappings[0].notebook_id).toBe("theme_semianalysis_01");
    });

    it("F14.4: retrieves ARM brief with SemiAnalysis theme attached", async () => {
      await tools.save_fundamental_brief.execute(armFundamentalSeed);
      await tools.save_theme_sector_context.execute(semiAnalysisThemeSeed);

      const qual = await fetchQualitativeData(db, "ARM");
      expect(qual.fundamental?.symbol).toBe("ARM");
      expect(qual.themes[0].theme_name).toBe("SemiAnalysis AI & Compute Dynamics");
    });

    it("F14.5: formats complete 5-section debate context with ARM guidance and theme dynamics", async () => {
      await tools.save_fundamental_brief.execute(armFundamentalSeed);
      await tools.save_theme_sector_context.execute(semiAnalysisThemeSeed);

      const qual = await fetchQualitativeData(db, "ARM");
      const context = formatDebateContext(
        "Price: 142.50 USD\nMarket Cap: 148 Billion USD",
        [{ title: "v9 Adoption Acceleration", event_date: "2026-08-01", event_type: "product" }],
        [{ title: "SemiAnalysis ARM Review", summary: "CSS compute licensing model analysis" }],
        qual
      );

      expect(context).toContain("### 1. ข้อมูลทางการเงินและตัวชี้วัด");
      expect(context).toContain("### 2. ข้อมูลเชิงคุณภาพและบทวิเคราะห์พื้นฐาน");
      expect(context).toContain("v9 architecture adoption rate (2x royalty rate vs v8)");
      expect(context).toContain("### 3. บริบทอุตสาหกรรมและภาพรวมการแข่งขัน");
      expect(context).toContain("SemiAnalysis AI & Compute Dynamics");
      expect(context).toContain("### 4. ข่าวและเหตุการณ์สำคัญล่าสุด");
      expect(context).toContain("### 5. บทวิเคราะห์และมุมมองสังเคราะห์");
    });
  });
});
