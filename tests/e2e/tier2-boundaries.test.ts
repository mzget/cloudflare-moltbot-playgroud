import { describe, it, expect, beforeEach } from "vitest";
import {
  InMemoryD1Database,
  InMemoryR2Bucket,
  createFundamentalTools,
  fetchQualitativeData,
  formatDebateContext,
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

describe("Tier 2: Boundary Value Analysis & Corner Cases (F1-F14)", () => {
  let db: InMemoryD1Database;
  let r2: InMemoryR2Bucket;
  let tools: ReturnType<typeof createFundamentalTools>;

  beforeEach(() => {
    db = new InMemoryD1Database();
    r2 = new InMemoryR2Bucket();
    tools = createFundamentalTools({ DB: db, KNOWLEDGE_BUCKET: r2 });
  });

  // --------------------------------------------------------------------------
  // F1: D1 Migration Boundaries
  // --------------------------------------------------------------------------
  describe("F1: D1 Migration Boundaries", () => {
    it("F1-B1: rejects duplicate primary key on stock_fundamentals using strict INSERT", async () => {
      await db.prepare(
        "INSERT INTO stock_fundamentals (symbol, business_model, moat, competitors, guidance, key_risks, thesis_kpis, as_of_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      ).bind("ARM", "B1", "M1", "[]", "{}", "[]", "[]", "2026-07-29").run();

      await expect(
        db.prepare(
          "INSERT INTO stock_fundamentals (symbol, business_model, moat, competitors, guidance, key_risks, thesis_kpis, as_of_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        ).bind("ARM", "B2", "M2", "[]", "{}", "[]", "[]", "2026-08-01").run()
      ).rejects.toThrow(/UNIQUE constraint/);
    });

    it("F1-B2: rejects orphan theme_symbol_mapping when foreign key parent missing", async () => {
      await expect(
        db.prepare("INSERT INTO theme_symbol_mappings (notebook_id, symbol) VALUES (?, ?)")
          .bind("missing_notebook_999", "NVDA")
          .run()
      ).rejects.toThrow(/FOREIGN KEY/);
    });

    it("F1-B3: rejects duplicate composite key in theme_symbol_mappings (notebook_id, symbol)", async () => {
      await db.prepare("INSERT OR REPLACE INTO theme_sector_contexts (notebook_id, theme_name) VALUES (?, ?)")
        .bind("t_semi", "Semis").run();

      await db.prepare("INSERT INTO theme_symbol_mappings (notebook_id, symbol) VALUES (?, ?)")
        .bind("t_semi", "ARM").run();

      await expect(
        db.prepare("INSERT INTO theme_symbol_mappings (notebook_id, symbol) VALUES (?, ?)")
          .bind("t_semi", "ARM").run()
      ).rejects.toThrow(/UNIQUE constraint/);
    });

    it("F1-B4: supports symbols with special characters (e.g. BRK.B, BF-A)", async () => {
      await db.prepare(
        "INSERT OR REPLACE INTO stock_fundamentals (symbol, business_model, as_of_date) VALUES (?, ?, ?)"
      ).bind("BRK.B", "Conglomerate", "2026-07-01").run();

      const row = await db.prepare("SELECT * FROM stock_fundamentals WHERE symbol = ?").bind("BRK.B").first<any>();
      expect(row.symbol).toBe("BRK.B");
    });

    it("F1-B5: applies default source_count = 1 when omitted and allows null optional columns", async () => {
      await db.prepare(
        "INSERT OR REPLACE INTO stock_fundamentals (symbol, as_of_date) VALUES (?, ?)"
      ).bind("MOCK", "2026-06-01").run();

      const row = await db.prepare("SELECT * FROM stock_fundamentals WHERE symbol = ?").bind("MOCK").first<any>();
      expect(row.source_count).toBe(1);
      expect(row.business_model).toBeNull();
      expect(row.moat).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // F2: OKF Markdown Persistence Boundaries
  // --------------------------------------------------------------------------
  describe("F2: OKF Markdown Persistence Boundaries", () => {
    it("F2-B1: business model with markdown special chars (| * _ ` #) serializes intact", () => {
      const okf = serializeToOkfMarkdown({
        symbol: "TEST",
        as_of_date: "2026-01-01",
        business_model: "SaaS | Marketplace * 2x _growth_ `v9` #1 compute"
      });
      expect(okf).toContain("SaaS | Marketplace * 2x _growth_ `v9` #1 compute");
    });

    it("F2-B2: empty or null guidance fields do not output literal 'undefined' or 'null'", () => {
      const okf = serializeToOkfMarkdown({
        symbol: "TEST",
        as_of_date: "2026-01-01",
        guidance: { revenue_target: "10% YoY" } // other fields undefined
      });
      expect(okf).not.toContain("undefined");
      expect(okf).not.toContain("null");
      expect(okf).toContain("Revenue Target: 10% YoY");
    });

    it("F2-B3: empty arrays for competitors and risks omit section headers cleanly", () => {
      const okf = serializeToOkfMarkdown({
        symbol: "TEST",
        as_of_date: "2026-01-01",
        competitors: [],
        key_risks: [],
        thesis_kpis: []
      });
      expect(okf).not.toContain("## Key Competitors");
      expect(okf).not.toContain("## Key Risks");
      expect(okf).not.toContain("## Thesis KPIs");
    });

    it("F2-B4: serializes large arrays (20+ items) without truncation or corruption", () => {
      const risks = Array.from({ length: 25 }, (_, i) => `Risk item ${i + 1}`);
      const okf = serializeToOkfMarkdown({
        symbol: "TEST",
        as_of_date: "2026-01-01",
        key_risks: risks
      });
      expect(okf).toContain("Risk item 1");
      expect(okf).toContain("Risk item 25");
    });

    it("F2-B5: parseOkfMarkdown handles unformatted markdown body gracefully", () => {
      const raw = "# Simple Heading\nJust text without YAML frontmatter";
      const parsed = parseOkfMarkdown(raw);
      expect(parsed.frontmatter).toEqual({});
      expect(parsed.body).toBe(raw);
    });
  });

  // --------------------------------------------------------------------------
  // F3: MCP save_fundamental_brief Boundaries
  // --------------------------------------------------------------------------
  describe("F3: MCP save_fundamental_brief Boundaries", () => {
    it("F3-B1: Zod validation rejects empty symbol string", () => {
      expect(() => saveFundamentalBriefSchema.parse({ symbol: "", as_of_date: "2026-07-29" })).toThrow(/Symbol is required/);
    });

    it("F3-B2: Zod validation rejects malformed date format (e.g. DD-MM-YYYY)", () => {
      expect(() => saveFundamentalBriefSchema.parse({ symbol: "ARM", as_of_date: "29-07-2026" })).toThrow(/YYYY-MM-DD/);
      expect(() => saveFundamentalBriefSchema.parse({ symbol: "ARM", as_of_date: "invalid-date" })).toThrow(/YYYY-MM-DD/);
    });

    it("F3-B3: normalizes untrimmed lowercase symbol to uppercase", () => {
      const parsed = saveFundamentalBriefSchema.parse({ symbol: "  arm  ", as_of_date: "2026-07-29" });
      expect(parsed.symbol).toBe("ARM");
    });

    it("F3-B4: rejects negative source_count in schema", () => {
      expect(() => saveFundamentalBriefSchema.parse({ symbol: "ARM", as_of_date: "2026-07-29", source_count: -1 })).toThrow();
    });

    it("F3-B5: handles guidance target object with empty strings cleanly", () => {
      const parsed = saveFundamentalBriefSchema.parse({
        symbol: "ARM",
        as_of_date: "2026-07-29",
        guidance: { revenue_target: "", margin_target: "" }
      });
      expect(parsed.guidance?.revenue_target).toBe("");
    });
  });

  // --------------------------------------------------------------------------
  // F4: MCP save_theme_sector_context Boundaries
  // --------------------------------------------------------------------------
  describe("F4: MCP save_theme_sector_context Boundaries", () => {
    it("F4-B1: Zod validation rejects missing notebook_id or theme_name", () => {
      expect(() => saveThemeSectorContextSchema.parse({ notebook_id: "", theme_name: "Theme" })).toThrow();
      expect(() => saveThemeSectorContextSchema.parse({ notebook_id: "t1", theme_name: "" })).toThrow();
    });

    it("F4-B2: deduplicates symbols array and converts to uppercase", () => {
      const parsed = saveThemeSectorContextSchema.parse({
        notebook_id: "t1",
        theme_name: "Theme",
        symbols: ["arm", "ARM", "Arm", "nvda", "NVDA"]
      });
      expect(parsed.symbols).toEqual(["ARM", "NVDA"]);
    });

    it("F4-B3: replacing theme symbols removes unreferenced old symbols atomically", async () => {
      await tools.save_theme_sector_context.execute({
        notebook_id: "t_ai",
        theme_name: "AI Theme",
        symbols: ["ARM", "INTC"]
      });
      expect(db.themeSymbolMappings.filter((m) => m.notebook_id === "t_ai")).toHaveLength(2);

      await tools.save_theme_sector_context.execute({
        notebook_id: "t_ai",
        theme_name: "AI Theme",
        symbols: ["ARM", "NVDA"]
      });

      const updated = db.themeSymbolMappings.filter((m) => m.notebook_id === "t_ai");
      expect(updated).toHaveLength(2);
      const syms = updated.map((m) => m.symbol);
      expect(syms).toContain("ARM");
      expect(syms).toContain("NVDA");
      expect(syms).not.toContain("INTC");
    });

    it("F4-B4: passing empty symbols array clears all existing mappings for the theme", async () => {
      await tools.save_theme_sector_context.execute({
        notebook_id: "t_temp",
        theme_name: "Temporary",
        symbols: ["ARM"]
      });
      await tools.save_theme_sector_context.execute({
        notebook_id: "t_temp",
        theme_name: "Temporary",
        symbols: []
      });

      const mappings = db.themeSymbolMappings.filter((m) => m.notebook_id === "t_temp");
      expect(mappings).toHaveLength(0);
    });

    it("F4-B5: handles large batch symbol list (50 symbols) cleanly", async () => {
      const symbols = Array.from({ length: 50 }, (_, i) => `SYM${i}`);
      const res = await tools.save_theme_sector_context.execute({
        notebook_id: "t_broad",
        theme_name: "Broad Market",
        symbols
      });
      expect(res.content[0].text).toContain("linked 50 symbols");
      expect(db.themeSymbolMappings.filter((m) => m.notebook_id === "t_broad")).toHaveLength(50);
    });
  });

  // --------------------------------------------------------------------------
  // F5: MCP get_fundamental_brief Boundaries
  // --------------------------------------------------------------------------
  describe("F5: MCP get_fundamental_brief Boundaries", () => {
    it("F5-B1: case-insensitive symbol lookup resolves uppercase stored record", async () => {
      await tools.save_fundamental_brief.execute(armFundamentalSeed);
      const res = await tools.get_fundamental_brief.execute({ symbol: "arm" });
      const data = JSON.parse(res.content[0].text);
      expect(data.fundamental?.symbol).toBe("ARM");
    });

    it("F5-B2: querying non-existent ticker returns fundamental: null and empty themes without throwing", async () => {
      const res = await tools.get_fundamental_brief.execute({ symbol: "XYZ999" });
      const data = JSON.parse(res.content[0].text);
      expect(data.fundamental).toBeNull();
      expect(data.themes).toEqual([]);
    });

    it("F5-B3: symbol with whitespace padding is trimmed and resolved", async () => {
      await tools.save_fundamental_brief.execute(armFundamentalSeed);
      const res = await tools.get_fundamental_brief.execute({ symbol: "   ARM   " });
      const data = JSON.parse(res.content[0].text);
      expect(data.fundamental?.symbol).toBe("ARM");
    });

    it("F5-B4: parses empty JSON arrays stored as null cleanly", async () => {
      await db.prepare(
        "INSERT OR REPLACE INTO stock_fundamentals (symbol, as_of_date, competitors, key_risks) VALUES (?, ?, ?, ?)"
      ).bind("EMPTY_STOCK", "2026-01-01", null, null).run();

      const res = await tools.get_fundamental_brief.execute({ symbol: "EMPTY_STOCK" });
      const data = JSON.parse(res.content[0].text);
      expect(data.fundamental.competitors).toEqual([]);
      expect(data.fundamental.key_risks).toEqual([]);
    });

    it("F5-B5: handles theme context with null optional fields without error", async () => {
      await tools.save_theme_sector_context.execute({
        notebook_id: "t_bare",
        theme_name: "Bare Theme",
        symbols: ["BARE"]
      });

      const res = await tools.get_fundamental_brief.execute({ symbol: "BARE" });
      const data = JSON.parse(res.content[0].text);
      expect(data.themes[0].theme_name).toBe("Bare Theme");
      expect(data.themes[0].industry_dynamics).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // F6: MCP Agent Registration & Tool Boundaries
  // --------------------------------------------------------------------------
  describe("F6: MCP Agent Registration & Tool Boundaries", () => {
    it("F6-B1: calling tool with missing required arguments throws validation error", async () => {
      await expect(tools.save_fundamental_brief.execute({})).rejects.toThrow();
    });

    it("F6-B2: calling get_fundamental_brief with null args throws validation error", async () => {
      await expect(tools.get_fundamental_brief.execute(null)).rejects.toThrow();
    });

    it("F6-B3: verifies tool names are exact case and non-empty", () => {
      expect(tools.save_fundamental_brief.name).toBe("save_fundamental_brief");
      expect(tools.save_theme_sector_context.name).toBe("save_theme_sector_context");
      expect(tools.get_fundamental_brief.name).toBe("get_fundamental_brief");
    });

    it("F6-B4: verifies tool return structure contains type 'text'", async () => {
      const res = await tools.get_fundamental_brief.execute({ symbol: "ARM" });
      expect(res.content[0].type).toBe("text");
      expect(typeof res.content[0].text).toBe("string");
    });

    it("F6-B5: handles schema rejection gracefully without corrupting database", async () => {
      try {
        await tools.save_fundamental_brief.execute({ symbol: "", as_of_date: "invalid" });
      } catch (e) {
        expect(e).toBeDefined();
      }
      expect(db.stockFundamentals.size).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // F7: Qualitative Fetching Boundaries
  // --------------------------------------------------------------------------
  describe("F7: Qualitative Fetching Boundaries", () => {
    it("F7-B1: symbol with no theme mappings returns empty array for themes", async () => {
      await tools.save_fundamental_brief.execute({ symbol: "LONE", as_of_date: "2026-05-01" });
      const qual = await fetchQualitativeData(db, "LONE");
      expect(qual.themes).toEqual([]);
    });

    it("F7-B2: symbol with no fundamental record returns fundamental: null", async () => {
      const qual = await fetchQualitativeData(db, "NONEXISTENT");
      expect(qual.fundamental).toBeNull();
    });

    it("F7-B3: trims whitespace and matches case-insensitively in fetchQualitativeData", async () => {
      await tools.save_fundamental_brief.execute({ symbol: "TRIM", as_of_date: "2026-05-01" });
      const qual = await fetchQualitativeData(db, "  trim  ");
      expect(qual.fundamental?.symbol).toBe("TRIM");
    });

    it("F7-B4: corrupt JSON in competitors column does not crash fetchQualitativeData", async () => {
      await db.prepare(
        "INSERT OR REPLACE INTO stock_fundamentals (symbol, as_of_date, competitors) VALUES (?, ?, ?)"
      ).bind("CORRUPT", "2026-05-01", "{malformed_json:").run();

      const qual = await fetchQualitativeData(db, "CORRUPT");
      expect(qual.fundamental?.competitors).toEqual([]);
    });

    it("F7-B5: corrupt JSON in guidance column does not crash fetchQualitativeData", async () => {
      await db.prepare(
        "INSERT OR REPLACE INTO stock_fundamentals (symbol, as_of_date, guidance) VALUES (?, ?, ?)"
      ).bind("CORRUPT_G", "2026-05-01", "not-json").run();

      const qual = await fetchQualitativeData(db, "CORRUPT_G");
      expect(qual.fundamental?.guidance).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // F8: 5-Section Debate Context Formatter Boundaries
  // --------------------------------------------------------------------------
  describe("F8: 5-Section Debate Context Formatter Boundaries", () => {
    it("F8-B1: formats only Section 1 when qualitative data, events, and articles are omitted", () => {
      const context = formatDebateContext("Price: 100 USD");
      expect(context).toContain("### 1. ข้อมูลทางการเงินและตัวชี้วัด");
      expect(context).not.toContain("### 2.");
      expect(context).not.toContain("### 3.");
      expect(context).not.toContain("### 4.");
      expect(context).not.toContain("### 5.");
    });

    it("F8-B2: formats Section 1 and Section 2 only when themes, events, and articles omitted", () => {
      const qual = { fundamental: { symbol: "SOLO", as_of_date: "2026-01-01", business_model: "Solo Model" }, themes: [] };
      const context = formatDebateContext("Price: 100 USD", [], [], qual);
      expect(context).toContain("### 1.");
      expect(context).toContain("### 2.");
      expect(context).not.toContain("### 3.");
    });

    it("F8-B3: formats Section 1 and Section 3 only when fundamental brief is null", () => {
      const qual = { fundamental: null, themes: [{ notebook_id: "t", theme_name: "Macro", industry_dynamics: "Dynamics" }] };
      const context = formatDebateContext("Price: 100 USD", [], [], qual);
      expect(context).toContain("### 1.");
      expect(context).not.toContain("### 2.");
      expect(context).toContain("### 3.");
    });

    it("F8-B4: formats partial guidance without writing undefined for missing targets", () => {
      const qual = {
        fundamental: {
          symbol: "PART",
          as_of_date: "2026-01-01",
          guidance: { revenue_target: "30% CAGR" }
        },
        themes: []
      };
      const context = formatDebateContext("Price: 100 USD", [], [], qual);
      expect(context).toContain("เป้ารายได้: 30% CAGR");
      expect(context).not.toContain("undefined");
      expect(context).not.toContain("เป้าอัตรากำไร:");
    });

    it("F8-B5: handles large text fields (5000+ chars) in business model without breaking headers", () => {
      const longText = "Very long business model description. ".repeat(150);
      const qual = {
        fundamental: {
          symbol: "LONG",
          as_of_date: "2026-01-01",
          business_model: longText
        },
        themes: []
      };
      const context = formatDebateContext("Price: 100 USD", [], [], qual);
      expect(context).toContain("Very long business model description");
      expect(context).toContain("### 1. ข้อมูลทางการเงิน");
    });
  });

  // --------------------------------------------------------------------------
  // F9: Prompt Grounding Rules Boundaries
  // --------------------------------------------------------------------------
  describe("F9: Prompt Grounding Rules Boundaries", () => {
    it("F9-B1: conviction boundary: score = 7 is Strong Bull, score = 6 is Moderate Bull", () => {
      expect(calculateConvictionLabel(7)).toBe("Strong Bull");
      expect(calculateConvictionLabel(6)).toBe("Moderate Bull");
    });

    it("F9-B2: conviction boundary: score = 2 is Moderate Bull, score = 1 is Neutral", () => {
      expect(calculateConvictionLabel(2)).toBe("Moderate Bull");
      expect(calculateConvictionLabel(1)).toBe("Neutral");
    });

    it("F9-B3: conviction boundary: score = -1 is Neutral, score = -2 is Moderate Bear", () => {
      expect(calculateConvictionLabel(-1)).toBe("Neutral");
      expect(calculateConvictionLabel(-2)).toBe("Moderate Bear");
    });

    it("F9-B4: conviction boundary: score = -6 is Moderate Bear, score = -7 is Strong Bear", () => {
      expect(calculateConvictionLabel(-6)).toBe("Moderate Bear");
      expect(calculateConvictionLabel(-7)).toBe("Strong Bear");
    });

    it("F9-B5: conviction extreme boundary: +15 is Strong Bull, -15 is Strong Bear", () => {
      expect(calculateConvictionLabel(15)).toBe("Strong Bull");
      expect(calculateConvictionLabel(-15)).toBe("Strong Bear");
    });
  });

  // --------------------------------------------------------------------------
  // F10: Graceful Fallbacks Boundaries
  // --------------------------------------------------------------------------
  describe("F10: Graceful Fallbacks Boundaries", () => {
    it("F10-B1: handles empty string metricsStr without throwing", () => {
      expect(() => formatDebateContext("")).not.toThrow();
      const res = formatDebateContext("");
      expect(res).toContain("### 1. ข้อมูลทางการเงินและตัวชี้วัด (Financial Metrics):");
    });

    it("F10-B2: renders 'N/A' when business_model and moat are null", () => {
      const qual = {
        fundamental: { symbol: "NA_STOCK", as_of_date: "2026-01-01", business_model: null, moat: null },
        themes: []
      };
      const res = formatDebateContext("Price: 50", [], [], qual);
      expect(res).toContain("โมเดลธุรกิจ (Business Model): N/A");
      expect(res).toContain("ปราการทางธุรกิจ (Economic Moat): N/A");
    });

    it("F10-B3: omits thesis KPIs line when array is empty", () => {
      const qual = {
        fundamental: { symbol: "NO_KPI", as_of_date: "2026-01-01", thesis_kpis: [] },
        themes: []
      };
      const res = formatDebateContext("Price: 50", [], [], qual);
      expect(res).not.toContain("ตัวชี้วัดวิทยานิพนธ์การลงทุน (Thesis KPIs):");
    });

    it("F10-B4: handles null qualitative object identically to empty object", () => {
      const res1 = formatDebateContext("Price: 100", [], [], null);
      const res2 = formatDebateContext("Price: 100", [], [], { fundamental: null, themes: [] });
      expect(res1).toBe(res2);
    });

    it("F10-B5: handles events without description cleanly", () => {
      const events = [{ title: "Headline Only", event_date: "2026-09-01", event_type: "macro", description: null }];
      const res = formatDebateContext("Price: 100", events);
      expect(res).toContain("[MACRO] Headline Only (2026-09-01)");
      expect(res).not.toContain("undefined");
    });
  });

  // --------------------------------------------------------------------------
  // F11: Fundamentals API Routes Boundaries
  // --------------------------------------------------------------------------
  describe("F11: Fundamentals API Routes Boundaries", () => {
    it("F11-B1: freshness boundary: exactly 89 days ago evaluates to 'active'", () => {
      const ref = new Date("2026-07-29T00:00:00Z");
      const filing = new Date(ref.getTime() - 89 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      expect(calculateFreshnessStatus(filing, ref)).toBe("active");
    });

    it("F11-B2: freshness boundary: exactly 90 days ago evaluates to 'stale'", () => {
      const ref = new Date("2026-07-29T00:00:00Z");
      const filing = new Date(ref.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      expect(calculateFreshnessStatus(filing, ref)).toBe("stale");
    });

    it("F11-B3: freshness boundary: exactly 91 days ago evaluates to 'stale'", () => {
      const ref = new Date("2026-07-29T00:00:00Z");
      const filing = new Date(ref.getTime() - 91 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      expect(calculateFreshnessStatus(filing, ref)).toBe("stale");
    });

    it("F11-B4: handleGetFundamentalBySymbol rejects whitespace-only symbol with 400", async () => {
      const res = await handleGetFundamentalBySymbol(db, "   ");
      expect(res.status).toBe(400);
      expect(res.error).toBe("Symbol parameter is required");
    });

    it("F11-B5: handleGetFundamentalsStatus with empty watchlist returns empty items array", async () => {
      const res = await handleGetFundamentalsStatus(db, []);
      expect(res.items).toEqual([]);
    });
  });

  // --------------------------------------------------------------------------
  // F12: Observability Tab & Freshness Badge Boundaries
  // --------------------------------------------------------------------------
  describe("F12: Observability Tab & Freshness Badge Boundaries", () => {
    it("F12-B1: future filing date is classified as 'active'", () => {
      const ref = new Date("2026-01-01");
      expect(calculateFreshnessStatus("2026-02-01", ref)).toBe("active");
    });

    it("F12-B2: filing date exactly today (0 days diff) is classified as 'active'", () => {
      const now = new Date("2026-05-15T12:00:00Z");
      expect(calculateFreshnessStatus("2026-05-15", now)).toBe("active");
    });

    it("F12-B3: malformed date string 'invalid-date' returns 'missing'", () => {
      expect(calculateFreshnessStatus("invalid-date")).toBe("missing");
    });

    it("F12-B4: very old filing date (500+ days ago) returns 'stale'", () => {
      const ref = new Date("2026-07-29");
      expect(calculateFreshnessStatus("2024-01-01", ref)).toBe("stale");
    });

    it("F12-B5: empty or whitespace string returns 'missing'", () => {
      expect(calculateFreshnessStatus("   ")).toBe("missing");
    });
  });

  // --------------------------------------------------------------------------
  // F13: Copy Prompt for Gemini Modal Boundaries
  // --------------------------------------------------------------------------
  describe("F13: Copy Prompt for Gemini Modal Boundaries", () => {
    it("F13-B1: normalizes lowercase symbol to uppercase in extraction prompt", () => {
      const prompt = generateGeminiExtractionPrompt("aapl");
      expect(prompt).toContain("# Fundamental Research Extraction Prompt: AAPL");
      expect(prompt).toContain('"symbol": "AAPL"');
    });

    it("F13-B2: trims leading and trailing whitespace from input symbol", () => {
      const prompt = generateGeminiExtractionPrompt("   msft   ");
      expect(prompt).toContain("# Fundamental Research Extraction Prompt: MSFT");
      expect(prompt).toContain('"symbol": "MSFT"');
    });

    it("F13-B3: preserves special symbols (e.g. BRK.B) in prompt generation", () => {
      const prompt = generateGeminiExtractionPrompt("BRK.B");
      expect(prompt).toContain("# Fundamental Research Extraction Prompt: BRK.B");
      expect(prompt).toContain('"symbol": "BRK.B"');
    });

    it("F13-B4: verifies extraction prompt includes strict date anti-hallucination instruction", () => {
      const prompt = generateGeminiExtractionPrompt("ARM");
      expect(prompt).toContain("MUST be derived from the filing or earnings release date");
      expect(prompt).toContain("Do NOT invent dates");
    });

    it("F13-B5: verifies prompt includes guidance and KPI schema specifications", () => {
      const prompt = generateGeminiExtractionPrompt("NVDA");
      expect(prompt).toContain('"revenue_target":');
      expect(prompt).toContain('"margin_target":');
      expect(prompt).toContain('"thesis_kpis":');
    });
  });

  // --------------------------------------------------------------------------
  // F14: ARM Seed Ingestion Boundaries
  // --------------------------------------------------------------------------
  describe("F14: ARM Seed Ingestion Boundaries", () => {
    it("F14-B1: updating ARM brief with newer as_of_date overwrites previous record cleanly", async () => {
      await tools.save_fundamental_brief.execute(armFundamentalSeed);
      const updatedArm = { ...armFundamentalSeed, as_of_date: "2026-10-28", source_count: 4 };
      await tools.save_fundamental_brief.execute(updatedArm);

      const inDb = db.stockFundamentals.get("ARM");
      expect(inDb?.as_of_date).toBe("2026-10-28");
      expect(inDb?.source_count).toBe(4);
      expect(db.stockFundamentals.size).toBe(1);
    });

    it("F14-B2: retrieving ARM after SemiAnalysis theme update reflects updated theme content", async () => {
      await tools.save_fundamental_brief.execute(armFundamentalSeed);
      await tools.save_theme_sector_context.execute(semiAnalysisThemeSeed);

      const updatedTheme = { ...semiAnalysisThemeSeed, theme_name: "SemiAnalysis AI 2.0" };
      await tools.save_theme_sector_context.execute(updatedTheme);

      const qual = await fetchQualitativeData(db, "ARM");
      expect(qual.themes[0].theme_name).toBe("SemiAnalysis AI 2.0");
    });

    it("F14-B3: ARM debate context formatting preserves all 3 thesis KPIs", async () => {
      await tools.save_fundamental_brief.execute(armFundamentalSeed);
      const qual = await fetchQualitativeData(db, "ARM");
      const ctx = formatDebateContext("Price: 142.50", [], [], qual);
      expect(ctx).toContain("v9 architecture adoption rate");
      expect(ctx).toContain("CSS (Compute Subsystem) revenue contribution share");
      expect(ctx).toContain("Datacenter and cloud market share gains");
    });

    it("F14-B4: ARM debate context formatting preserves guidance revenue CAGR and margin targets", async () => {
      await tools.save_fundamental_brief.execute(armFundamentalSeed);
      const qual = await fetchQualitativeData(db, "ARM");
      const ctx = formatDebateContext("Price: 142.50", [], [], qual);
      expect(ctx).toContain("Mid-20s % revenue CAGR through FY27");
      expect(ctx).toContain("Operating margin expanding to >45%");
    });

    it("F14-B5: ARM freshness evaluation: active at day 1, stale at day 94", () => {
      const filing = armFundamentalSeed.as_of_date; // 2026-07-29
      const activeRef = new Date("2026-07-30T00:00:00Z"); // 1 day
      const staleRef = new Date("2026-10-31T00:00:00Z");  // 94 days

      expect(calculateFreshnessStatus(filing, activeRef)).toBe("active");
      expect(calculateFreshnessStatus(filing, staleRef)).toBe("stale");
    });
  });
});
