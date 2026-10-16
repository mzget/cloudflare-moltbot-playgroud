import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  saveFundamentalBrief,
  saveThemeSectorContext,
  getFundamentalBrief,
  SaveFundamentalBriefSchema,
  SaveThemeSectorContextSchema,
  GetFundamentalBriefSchema,
} from "./fundamentalTools";

describe("fundamentalTools", () => {
  let mockDb: any;
  let mockKnowledgeBucket: any;
  let mockEnv: any;
  let executedSql: { sql: string; binds: any[] }[];
  let executedBatches: any[][];
  let preparedStatements: { sql: string; params: any[] }[];

  beforeEach(() => {
    vi.resetAllMocks();
    executedSql = [];
    executedBatches = [];
    preparedStatements = [];

    mockDb = {
      prepare: vi.fn().mockImplementation((sql: string) => {
        const stmt = {
          sql,
          params: [] as any[],
          bind: vi.fn().mockImplementation((...args: any[]) => {
            stmt.params = args;
            executedSql.push({ sql, binds: args });
            preparedStatements.push({ sql, params: args });
            return stmt;
          }),
          run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 1 } }),
          first: vi.fn().mockImplementation(async () => {
            if (sql.includes("FROM stock_fundamentals")) {
              const sym = stmt.params[0] || stmt.params[1];
              if (sym === "ARM") {
                return {
                  symbol: "ARM",
                  business_model: "Licensing IP and royalty fee models",
                  moat: "High switching costs and architecture ecosystem lock-in",
                  competitors: JSON.stringify(["x86", "RISC-V"]),
                  guidance: JSON.stringify({ revenue_target: "$4.0B", margin_target: "45%" }),
                  key_risks: JSON.stringify(["China JV volatility", "Export licensing controls"]),
                  thesis_kpis: JSON.stringify(["ARMv9 royalty penetration", "CSS licensing"]),
                  as_of_date: "2026-07-29",
                  notebook_id: "nb-arm-123",
                  source_count: 5,
                  updated_at: "2026-07-30 12:00:00",
                };
              }
              if (sym === "CORRUPT") {
                return {
                  symbol: "CORRUPT",
                  business_model: "Test",
                  moat: "Test",
                  competitors: "{corrupt json",
                  guidance: "[not-an-object",
                  key_risks: null,
                  thesis_kpis: null,
                  as_of_date: "2026-07-29",
                  notebook_id: null,
                  source_count: 1,
                  updated_at: null,
                };
              }
              return null;
            }
            return null;
          }),
          all: vi.fn().mockImplementation(async () => {
            if (sql.includes("FROM theme_sector_contexts")) {
              const sym = stmt.params[0] || stmt.params[1];
              if (sym === "ARM") {
                return {
                  results: [
                    {
                      notebook_id: "nb-semi-456",
                      theme_name: "SemiAnalysis & Advanced Packaging",
                      industry_dynamics: "CoWoS capacity tight; ASIC design expanding.",
                      supply_chain_bottlenecks: "Substrate packaging constraints",
                      competitive_landscape: "TSMC leads advanced nodes",
                      macro_trends: "Hyperscaler capex ramp",
                      updated_at: "2026-07-30 10:00:00",
                    },
                  ],
                };
              }
              return { results: [] };
            }
            return { results: [] };
          }),
        };
        return stmt;
      }),
      batch: vi.fn().mockImplementation(async (statements: any[]) => {
        executedBatches.push(statements);
        return statements.map(() => ({ success: true }));
      }),
    };

    mockKnowledgeBucket = {
      put: vi.fn().mockResolvedValue({}),
      get: vi.fn().mockResolvedValue(null),
    };

    mockEnv = {
      DB: mockDb,
      KNOWLEDGE_BUCKET: mockKnowledgeBucket,
    };
  });

  // =========================================================================
  // 1. saveFundamentalBrief
  // =========================================================================
  describe("saveFundamentalBrief", () => {
    it("saves fundamental brief successfully with D1 upsert and R2 put (happy path)", async () => {
      const payload = {
        symbol: "arm",
        business_model: "Licensing IP and royalties",
        moat: "Ecosystem lock-in",
        competitors: ["x86", "RISC-V"],
        guidance: {
          revenue_target: "20-25% YoY",
          margin_target: "45% operating margin",
          timeframe: "FY27",
          key_assumptions: "ARMv9 royalty rate doubling",
        },
        key_risks: ["China JV risk", "Hyperscaler internal silicon"],
        thesis_kpis: ["v9 adoption rate", "CSS unit volume"],
        as_of_date: "2026-10-01",
        notebook_id: "nb-1234",
        source_count: 5,
      };

      const result = await saveFundamentalBrief(mockEnv, payload);

      expect(result.success).toBe(true);
      expect(result.symbol).toBe("ARM");
      expect(result.r2_key).toBe("fundamentals/ARM.md");

      // Verify D1 Upsert
      const upsert = executedSql.find((e) => e.sql.includes("INSERT INTO stock_fundamentals"));
      expect(upsert).toBeDefined();
      expect(upsert?.sql).toContain("ON CONFLICT(symbol) DO UPDATE SET");
      expect(upsert?.binds[0]).toBe("ARM"); // normalized uppercase
      expect(upsert?.binds[1]).toBe("Licensing IP and royalties");
      expect(upsert?.binds[2]).toBe("Ecosystem lock-in");
      expect(upsert?.binds[3]).toBe(JSON.stringify(["x86", "RISC-V"]));
      expect(upsert?.binds[4]).toBe(JSON.stringify(payload.guidance));
      expect(upsert?.binds[5]).toBe(JSON.stringify(["China JV risk", "Hyperscaler internal silicon"]));
      expect(upsert?.binds[6]).toBe(JSON.stringify(["v9 adoption rate", "CSS unit volume"]));
      expect(upsert?.binds[7]).toBe("2026-10-01");
      expect(upsert?.binds[8]).toBe("nb-1234");
      expect(upsert?.binds[9]).toBe(5);

      // Verify R2 Put
      expect(mockKnowledgeBucket.put).toHaveBeenCalledTimes(1);
      const [r2Key, r2Body, r2Opts] = mockKnowledgeBucket.put.mock.calls[0];
      expect(r2Key).toBe("fundamentals/ARM.md");
      expect(r2Body).toContain("type: fundamental_brief");
      expect(r2Body).toContain('symbol: "ARM"');
      expect(r2Body).toContain("## Business Model");
      expect(r2Body).toContain("## Competitive Moat");
      expect(r2Body).toContain("### Key Competitors");
      expect(r2Body).toContain("- x86");
      expect(r2Body).toContain("## Management Guidance");
      expect(r2Body).toContain("**Revenue Target**: 20-25% YoY");
      expect(r2Body).toContain("## Key Risks");
      expect(r2Body).toContain("## Thesis KPIs");
      expect(r2Opts?.httpMetadata?.contentType).toContain("text/markdown");
    });

    it("defaults source_count to 1 when omitted", async () => {
      const payload = {
        symbol: "NVDA",
        as_of_date: "2026-09-15",
        business_model: "GPU compute hardware and CUDA stack",
      };

      const result = await saveFundamentalBrief(mockEnv, payload);

      expect(result.success).toBe(true);
      const upsert = executedSql.find((e) => e.sql.includes("INSERT INTO stock_fundamentals"));
      expect(upsert?.binds[9]).toBe(1); // default source_count
    });

    it("handles optional and empty fields gracefully with nulls and placeholders", async () => {
      const payload = {
        symbol: "AAPL",
        as_of_date: "2026-08-01",
      };

      const result = await saveFundamentalBrief(mockEnv, payload);

      expect(result.success).toBe(true);
      const upsert = executedSql.find((e) => e.sql.includes("INSERT INTO stock_fundamentals"));
      expect(upsert?.binds[1]).toBeNull(); // business_model
      expect(upsert?.binds[2]).toBeNull(); // moat
      expect(upsert?.binds[3]).toBeNull(); // competitors
      expect(upsert?.binds[4]).toBeNull(); // guidance
      expect(upsert?.binds[5]).toBeNull(); // key_risks
      expect(upsert?.binds[6]).toBeNull(); // thesis_kpis
      expect(upsert?.binds[8]).toBeNull(); // notebook_id

      // Verify R2 put uses standard placeholders
      const [, r2Body] = mockKnowledgeBucket.put.mock.calls[0];
      expect(r2Body).toContain("_No business model summary provided._");
      expect(r2Body).toContain("_No competitive moat analysis provided._");
      expect(r2Body).toContain("_No formal management guidance documented._");
    });

    it("rejects missing or empty symbol with validation error", async () => {
      const payload: any = {
        symbol: "   ",
        as_of_date: "2026-10-01",
      };

      const result = await saveFundamentalBrief(mockEnv, payload);
      expect(result.error).toBeDefined();
      expect(mockDb.prepare).not.toHaveBeenCalled();
      expect(mockKnowledgeBucket.put).not.toHaveBeenCalled();
    });

    it("rejects invalid as_of_date format with validation error", async () => {
      const invalidDates = ["2026/10/01", "not-a-date", "10-01-2026", "2026-1-1"];

      for (const badDate of invalidDates) {
        const result = await saveFundamentalBrief(mockEnv, {
          symbol: "ARM",
          as_of_date: badDate,
        });
        expect(result.error).toBeDefined();
        expect(result.error).toContain("as_of_date");
      }
      expect(mockDb.prepare).not.toHaveBeenCalled();
    });

    it("survives R2 failure gracefully without failing the D1 upsert", async () => {
      mockKnowledgeBucket.put.mockRejectedValue(new Error("R2 write timeout"));

      const result = await saveFundamentalBrief(mockEnv, {
        symbol: "ARM",
        as_of_date: "2026-10-01",
        business_model: "Resilient IP",
      });

      expect(result.success).toBe(true);
      expect(result.symbol).toBe("ARM");
      expect(result.r2_written).toBe(false);
      expect(result.r2_error).toBe("R2 write timeout");
      const upsert = executedSql.find((e) => e.sql.includes("INSERT INTO stock_fundamentals"));
      expect(upsert).toBeDefined();
    });

    it("falls back to env.BUCKET if env.KNOWLEDGE_BUCKET is absent", async () => {
      const fallbackBucket = { put: vi.fn().mockResolvedValue({}) };
      const fallbackEnv = { DB: mockDb, BUCKET: fallbackBucket };

      const result = await saveFundamentalBrief(fallbackEnv, {
        symbol: "TSM",
        as_of_date: "2026-10-01",
      });

      expect(result.success).toBe(true);
      expect(fallbackBucket.put).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // 2. saveThemeSectorContext
  // =========================================================================
  describe("saveThemeSectorContext", () => {
    it("saves theme sector context and updates symbol mappings via D1 batch (happy path)", async () => {
      const payload = {
        notebook_id: "nb-semi-101",
        theme_name: "SemiAnalysis & Advanced Packaging",
        industry_dynamics: "CoWoS demand outstrips supply.",
        supply_chain_bottlenecks: "High Bandwidth Memory (HBM3e) yields",
        competitive_landscape: "TSMC N3/N2 foundry dominance",
        macro_trends: "Hyperscaler Custom Silicon vs Merchant GPU",
        symbols: ["ARM", "NVDA", "TSM"],
      };

      const result = await saveThemeSectorContext(mockEnv, payload);

      expect(result.success).toBe(true);
      expect(result.notebook_id).toBe("nb-semi-101");
      expect(result.theme_name).toBe("SemiAnalysis & Advanced Packaging");
      expect(result.linked_symbols).toEqual(["ARM", "NVDA", "TSM"]);

      // 1. Verify D1 Upsert into theme_sector_contexts
      const upsert = executedSql.find((e) => e.sql.includes("INSERT INTO theme_sector_contexts"));
      expect(upsert).toBeDefined();
      expect(upsert?.sql).toContain("ON CONFLICT(notebook_id) DO UPDATE SET");
      expect(upsert?.binds[0]).toBe("nb-semi-101");
      expect(upsert?.binds[1]).toBe("SemiAnalysis & Advanced Packaging");
      expect(upsert?.binds[2]).toBe("CoWoS demand outstrips supply.");
      expect(upsert?.binds[3]).toBe("High Bandwidth Memory (HBM3e) yields");
      expect(upsert?.binds[4]).toBe("TSMC N3/N2 foundry dominance");
      expect(upsert?.binds[5]).toBe("Hyperscaler Custom Silicon vs Merchant GPU");

      // 2. Verify D1 Batch execution for theme_symbol_mappings
      expect(mockDb.batch).toHaveBeenCalledTimes(1);
      const batchStatements = executedBatches[0];
      // 1 DELETE + 3 INSERT statements = 4 statements
      expect(batchStatements.length).toBe(4);

      // Verify DELETE statement
      expect(batchStatements[0].sql).toContain("DELETE FROM theme_symbol_mappings WHERE notebook_id = ?");
      expect(batchStatements[0].params).toEqual(["nb-semi-101"]);

      // Verify INSERT statements
      expect(batchStatements[1].sql).toContain("INSERT OR REPLACE INTO theme_symbol_mappings");
      expect(batchStatements[1].params).toEqual(["nb-semi-101", "ARM"]);
      expect(batchStatements[2].params).toEqual(["nb-semi-101", "NVDA"]);
      expect(batchStatements[3].params).toEqual(["nb-semi-101", "TSM"]);
    });

    it("deduplicates, trims, and normalizes symbols to uppercase", async () => {
      const payload = {
        notebook_id: "nb-theme-1",
        theme_name: "AI Datacenter Networking",
        symbols: ["arm", "ARM", "  nvda  ", "tsm", "arm", ""],
      };

      const result = await saveThemeSectorContext(mockEnv, payload);

      expect(result.success).toBe(true);
      expect(result.linked_symbols).toEqual(["ARM", "NVDA", "TSM"]);

      const batchStatements = executedBatches[0];
      // 1 DELETE + 3 unique normalized symbols = 4 statements
      expect(batchStatements.length).toBe(4);
      expect(batchStatements[1].params[1]).toBe("ARM");
      expect(batchStatements[2].params[1]).toBe("NVDA");
      expect(batchStatements[3].params[1]).toBe("TSM");
    });

    it("clears symbol mappings when symbols is an empty array", async () => {
      const payload = {
        notebook_id: "nb-empty-symbols",
        theme_name: "Obsolete Theme",
        symbols: [],
      };

      const result = await saveThemeSectorContext(mockEnv, payload);

      expect(result.success).toBe(true);
      expect(result.linked_symbols).toEqual([]);

      expect(mockDb.batch).toHaveBeenCalledTimes(1);
      const batchStatements = executedBatches[0];
      // Only 1 DELETE statement
      expect(batchStatements.length).toBe(1);
      expect(batchStatements[0].sql).toContain("DELETE FROM theme_symbol_mappings WHERE notebook_id = ?");
    });

    it("skips mapping update when symbols parameter is omitted", async () => {
      const payload = {
        notebook_id: "nb-no-symbols",
        theme_name: "Macro Theme",
        macro_trends: "Global interest rates",
      };

      const result = await saveThemeSectorContext(mockEnv, payload);

      expect(result.success).toBe(true);
      expect(mockDb.batch).not.toHaveBeenCalled();
    });

    it("rejects missing notebook_id or theme_name with validation error", async () => {
      const badPayloads = [
        { theme_name: "No notebook id" },
        { notebook_id: "   ", theme_name: "Whitespace id" },
        { notebook_id: "nb-1", theme_name: "   " },
        { notebook_id: "nb-1" },
      ];

      for (const bad of badPayloads) {
        const result = await saveThemeSectorContext(mockEnv, bad as any);
        expect(result.error).toBeDefined();
      }
      expect(mockDb.prepare).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 3. getFundamentalBrief
  // =========================================================================
  describe("getFundamentalBrief", () => {
    it("retrieves existing fundamental profile and linked themes (happy path)", async () => {
      const result = await getFundamentalBrief(mockEnv, "ARM");

      expect(result).toBeDefined();
      expect(result.fundamental).toBeDefined();
      expect(result.fundamental?.symbol).toBe("ARM");
      expect(result.fundamental?.business_model).toBe("Licensing IP and royalty fee models");
      expect(result.fundamental?.competitors).toEqual(["x86", "RISC-V"]);
      expect(result.fundamental?.guidance).toEqual({ revenue_target: "$4.0B", margin_target: "45%" });
      expect(result.fundamental?.key_risks).toEqual(["China JV volatility", "Export licensing controls"]);
      expect(result.fundamental?.thesis_kpis).toEqual(["ARMv9 royalty penetration", "CSS licensing"]);
      expect(result.fundamental?.source_count).toBe(5);

      // Verify linked themes
      expect(result.themes).toBeDefined();
      expect(result.themes.length).toBe(1);
      expect(result.themes[0].theme_name).toBe("SemiAnalysis & Advanced Packaging");
      expect(result.themes[0].industry_dynamics).toContain("CoWoS capacity tight");
    });

    it("performs case-insensitive symbol lookup", async () => {
      const resultLower = await getFundamentalBrief(mockEnv, "arm");
      expect(resultLower.fundamental?.symbol).toBe("ARM");

      const resultMixed = await getFundamentalBrief(mockEnv, "aRm");
      expect(resultMixed.fundamental?.symbol).toBe("ARM");
    });

    it("accepts object argument { symbol: string }", async () => {
      const result = await getFundamentalBrief(mockEnv, { symbol: "arm" });
      expect(result.fundamental?.symbol).toBe("ARM");
    });

    it("returns null fundamental and empty themes when ticker is not found", async () => {
      const result = await getFundamentalBrief(mockEnv, "UNKNOWN_TICKER");

      expect(result).toBeDefined();
      expect(result.fundamental).toBeNull();
      expect(result.themes).toEqual([]);
    });

    it("returns null fundamental and empty themes when symbol is empty", async () => {
      const result = await getFundamentalBrief(mockEnv, "   ");

      expect(result.fundamental).toBeNull();
      expect(result.themes).toEqual([]);
      expect(mockDb.prepare).not.toHaveBeenCalled();
    });

    it("handles corrupted JSON fields in D1 row without crashing", async () => {
      const result = await getFundamentalBrief(mockEnv, "CORRUPT");

      expect(result.fundamental).toBeDefined();
      expect(result.fundamental?.symbol).toBe("CORRUPT");
      expect(result.fundamental?.competitors).toEqual([]); // Fallback to empty array
      expect(result.fundamental?.guidance).toBeNull(); // Fallback to null
    });
  });

  // =========================================================================
  // 4. Zod Schemas Validation Units
  // =========================================================================
  describe("Zod Schemas", () => {
    it("SaveFundamentalBriefSchema validates valid input and transforms symbol", () => {
      const parsed = SaveFundamentalBriefSchema.parse({
        symbol: "arm",
        as_of_date: "2026-10-01",
        source_count: 3,
      });
      expect(parsed.symbol).toBe("ARM");
      expect(parsed.source_count).toBe(3);
    });

    it("SaveFundamentalBriefSchema enforces date format regex YYYY-MM-DD", () => {
      const bad = SaveFundamentalBriefSchema.safeParse({
        symbol: "ARM",
        as_of_date: "2026/10/01",
      });
      expect(bad.success).toBe(false);
    });

    it("SaveThemeSectorContextSchema requires notebook_id and theme_name", () => {
      const bad = SaveThemeSectorContextSchema.safeParse({
        theme_name: "Missing ID",
      });
      expect(bad.success).toBe(false);
    });

    it("GetFundamentalBriefSchema normalizes symbol to uppercase", () => {
      const parsed = GetFundamentalBriefSchema.parse({ symbol: "nvda" });
      expect(parsed.symbol).toBe("NVDA");
    });
  });
});
