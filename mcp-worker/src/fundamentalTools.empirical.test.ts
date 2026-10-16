import { describe, it, expect, beforeEach } from "vitest";

// Ambient declarations for Node.js built-ins in Cloudflare Worker TypeScript project
// @ts-ignore
declare const require: (mod: string) => any;
// @ts-ignore
declare const process: any;
// @ts-ignore
const { DatabaseSync } = require("node:sqlite") as { DatabaseSync: any };
// @ts-ignore
const fs = require("node:fs") as { readFileSync: (path: string, enc: string) => string };
// @ts-ignore
const path = require("node:path") as { resolve: (...paths: string[]) => string };

import {
  saveFundamentalBrief,
  saveThemeSectorContext,
  getFundamentalBrief,
  safeJsonParse,
} from "./fundamentalTools";

/**
 * Creates an in-memory SQLite database executing the real D1 migration schema
 * and wraps it in a Cloudflare D1-compatible interface.
 */
function createRealSqliteD1() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");

  // Load and execute migration 0041
  const migrationPath = path.resolve(
    process.cwd(),
    "../backend/migrations/0041_fundamental_intelligence.sql"
  );
  const migrationSql = fs.readFileSync(migrationPath, "utf-8");
  db.exec(migrationSql);


  const d1Shim = {
    _rawDb: db,
    prepare(sql: string) {
      let boundParams: any[] = [];
      const stmtObj = {
        sql,
        bind(...params: any[]) {
          boundParams = params.map((p) => (p === undefined ? null : p));
          return stmtObj;
        },
        async run() {
          const stmt = db.prepare(sql);
          const result = stmt.run(...boundParams);
          return {
            success: true,
            meta: {
              changes: Number(result.changes),
              last_row_id: Number(result.lastInsertRowid),
            },
          };
        },
        async first<T = any>() {
          const stmt = db.prepare(sql);
          const row = stmt.get(...boundParams);
          return (row as T) ?? null;
        },
        async all<T = any>() {
          const stmt = db.prepare(sql);
          const rows = stmt.all(...boundParams);
          return { results: rows as T[] };
        },
      };
      return stmtObj;
    },
    async batch(statements: any[]) {
      db.exec("BEGIN TRANSACTION;");
      try {
        const results = [];
        for (const s of statements) {
          const res = await s.run();
          results.push(res);
        }
        db.exec("COMMIT;");
        return results;
      } catch (err) {
        db.exec("ROLLBACK;");
        throw err;
      }
    },
  };

  const mockBucket = {
    put: async (_key: string, _value: string, _opts?: any) => ({}),
    get: async (_key: string) => null,
  };

  const env = {
    DB: d1Shim,
    KNOWLEDGE_BUCKET: mockBucket,
  };

  return { db, env, d1Shim };
}

describe("Empirical D1 Stress Testing for Fundamental Intelligence", () => {
  let env: any;
  let db: any;

  beforeEach(() => {
    const context = createRealSqliteD1();
    env = context.env;
    db = context.db;
  });

  // =========================================================================
  // 1. Repeated & Concurrent Upserts on stock_fundamentals
  // =========================================================================
  describe("1. Repeated & Concurrent Upserts on stock_fundamentals", () => {
    it("empirically upserts and overwrites changing guidance and thesis KPIs", async () => {
      // Step 1: Initial Insert
      const res1 = await saveFundamentalBrief(env, {
        symbol: "ARM",
        as_of_date: "2026-06-01",
        business_model: "v1 business model",
        moat: "v1 moat",
        guidance: {
          revenue_target: "$3.8B",
          margin_target: "42%",
          timeframe: "FY26",
          key_assumptions: "Initial assumption",
        },
        thesis_kpis: ["KPI 1", "KPI 2"],
        competitors: ["x86"],
        key_risks: ["Risk 1"],
        source_count: 2,
        notebook_id: "nb-v1",
      });
      expect(res1.success).toBe(true);

      const brief1 = await getFundamentalBrief(env, "ARM");
      expect(brief1.fundamental?.guidance).toEqual({
        revenue_target: "$3.8B",
        margin_target: "42%",
        timeframe: "FY26",
        key_assumptions: "Initial assumption",
      });
      expect(brief1.fundamental?.thesis_kpis).toEqual(["KPI 1", "KPI 2"]);
      expect(brief1.fundamental?.business_model).toBe("v1 business model");
      expect(brief1.fundamental?.source_count).toBe(2);

      // Step 2: Overwrite with changing guidance and thesis KPIs
      const res2 = await saveFundamentalBrief(env, {
        symbol: "ARM",
        as_of_date: "2026-09-30",
        business_model: "v2 upgraded business model",
        moat: "v2 strengthened moat",
        guidance: {
          revenue_target: "$4.5B - $5.0B",
          margin_target: "48%",
          timeframe: "FY27",
          key_assumptions: "ARMv9 royalty acceleration and CSS packaging",
        },
        thesis_kpis: ["v9 penetration > 50%", "Hyperscaler CSS adoption", "Auto licensing ARR"],
        competitors: ["x86", "RISC-V", "Custom In-House Silicon"],
        key_risks: ["China licensing delays"],
        source_count: 7,
        notebook_id: "nb-v2",
      });
      expect(res2.success).toBe(true);

      // Verify D1 state directly
      const d1Row = db.prepare("SELECT * FROM stock_fundamentals WHERE symbol = 'ARM'").get() as any;
      expect(d1Row).toBeDefined();
      expect(d1Row.as_of_date).toBe("2026-09-30");
      expect(d1Row.business_model).toBe("v2 upgraded business model");
      expect(d1Row.source_count).toBe(7);
      expect(d1Row.notebook_id).toBe("nb-v2");

      const parsedGuidance = JSON.parse(d1Row.guidance);
      expect(parsedGuidance.revenue_target).toBe("$4.5B - $5.0B");
      expect(parsedGuidance.margin_target).toBe("48%");

      const parsedKpis = JSON.parse(d1Row.thesis_kpis);
      expect(parsedKpis).toHaveLength(3);
      expect(parsedKpis[0]).toBe("v9 penetration > 50%");

      // Verify retrieval tool
      const brief2 = await getFundamentalBrief(env, "ARM");
      expect(brief2.fundamental?.guidance).toEqual(parsedGuidance);
      expect(brief2.fundamental?.thesis_kpis).toEqual(parsedKpis);
      expect(brief2.fundamental?.competitors).toEqual(["x86", "RISC-V", "Custom In-House Silicon"]);
    });

    it("empirically survives rapid concurrent upserts without deadlock or schema violation", async () => {
      // Launch 15 concurrent upserts for the same ticker with varying guidance
      const promises = Array.from({ length: 15 }, (_, i) =>
        saveFundamentalBrief(env, {
          symbol: "ARM",
          as_of_date: `2026-10-${String(i + 1).padStart(2, "0")}`,
          business_model: `Model version ${i}`,
          guidance: {
            revenue_target: `$${4000 + i * 100}M`,
            margin_target: `${40 + i}%`,
          },
          thesis_kpis: [`KPI_${i}_A`, `KPI_${i}_B`],
          source_count: i + 1,
        })
      );

      const results = await Promise.all(promises);
      for (const res of results) {
        expect(res.success).toBe(true);
      }

      // Exactly 1 row must exist in D1
      const countRow = db
        .prepare("SELECT COUNT(*) as cnt FROM stock_fundamentals WHERE symbol = 'ARM'")
        .get() as any;
      expect(Number(countRow.cnt)).toBe(1);

      // Verify the final row is valid and clean
      const brief = await getFundamentalBrief(env, "ARM");
      expect(brief.fundamental).not.toBeNull();
      expect(brief.fundamental?.symbol).toBe("ARM");
      expect(typeof brief.fundamental?.guidance?.revenue_target).toBe("string");
      expect(Array.isArray(brief.fundamental?.thesis_kpis)).toBe(true);
    });

    it("empirically clears guidance and KPIs when updated with empty or omitted fields", async () => {
      // 1. Initial full record
      await saveFundamentalBrief(env, {
        symbol: "NVDA",
        as_of_date: "2026-08-01",
        business_model: "GPU leader",
        guidance: { revenue_target: "$100B" },
        thesis_kpis: ["Blackwell volume"],
        competitors: ["AMD"],
        key_risks: ["Capex digestion"],
      });

      // 2. Re-upsert with minimal payload (empty/omitted guidance, kpis, competitors, risks)
      const res = await saveFundamentalBrief(env, {
        symbol: "NVDA",
        as_of_date: "2026-10-01",
        business_model: "GPU leader updated",
      });
      expect(res.success).toBe(true);

      const brief = await getFundamentalBrief(env, "NVDA");
      expect(brief.fundamental?.business_model).toBe("GPU leader updated");
      expect(brief.fundamental?.guidance).toBeNull();
      expect(brief.fundamental?.thesis_kpis).toEqual([]);
      expect(brief.fundamental?.competitors).toEqual([]);
      expect(brief.fundamental?.key_risks).toEqual([]);
    });
  });

  // =========================================================================
  // 2. Batch Mapping Sync in saveThemeSectorContext
  // =========================================================================
  describe("2. Batch Mapping Sync in saveThemeSectorContext", () => {
    it("empirically handles duplicate, mixed-case, and whitespace symbols in batch mapping sync", async () => {
      const res = await saveThemeSectorContext(env, {
        notebook_id: "nb-semi-2026",
        theme_name: "Advanced Packaging & Foundry",
        industry_dynamics: "High demand for 2.5D packaging",
        symbols: ["arm", "ARM", "  Arm  ", "nvda", "NVDA", "tsm", "TSM", ""],
      });

      expect(res.success).toBe(true);
      expect(res.linked_symbols).toEqual(["ARM", "NVDA", "TSM"]);

      // Verify D1 table theme_symbol_mappings directly
      const rows = db
        .prepare(
          "SELECT symbol FROM theme_symbol_mappings WHERE notebook_id = 'nb-semi-2026' ORDER BY symbol ASC"
        )
        .all() as any[];

      expect(rows).toHaveLength(3);
      expect(rows.map((r) => r.symbol)).toEqual(["ARM", "NVDA", "TSM"]);

      // Verify getFundamentalBrief returns this theme for each symbol
      for (const sym of ["ARM", "arm", "NVDA", "tsm"]) {
        const brief = await getFundamentalBrief(env, sym);
        expect(brief.themes).toHaveLength(1);
        expect(brief.themes[0].notebook_id).toBe("nb-semi-2026");
        expect(brief.themes[0].theme_name).toBe("Advanced Packaging & Foundry");
      }
    });

    it("empirically clears all symbol mappings when symbols is an empty array", async () => {
      // Step 1: Seed theme with symbols
      await saveThemeSectorContext(env, {
        notebook_id: "nb-cloud-ai",
        theme_name: "Cloud AI Infrastructure",
        symbols: ["MSFT", "GOOGL", "AMZN"],
      });

      let count = db
        .prepare("SELECT COUNT(*) as cnt FROM theme_symbol_mappings WHERE notebook_id = 'nb-cloud-ai'")
        .get() as any;
      expect(Number(count.cnt)).toBe(3);

      // Step 2: Update theme with symbols: []
      const res = await saveThemeSectorContext(env, {
        notebook_id: "nb-cloud-ai",
        theme_name: "Cloud AI Infrastructure - Archived",
        symbols: [],
      });
      expect(res.success).toBe(true);
      expect(res.linked_symbols).toEqual([]);

      count = db
        .prepare("SELECT COUNT(*) as cnt FROM theme_symbol_mappings WHERE notebook_id = 'nb-cloud-ai'")
        .get() as any;
      expect(Number(count.cnt)).toBe(0);

      // Verify theme itself is NOT deleted
      const themeRow = db
        .prepare("SELECT theme_name FROM theme_sector_contexts WHERE notebook_id = 'nb-cloud-ai'")
        .get() as any;
      expect(themeRow.theme_name).toBe("Cloud AI Infrastructure - Archived");
    });

    it("empirically preserves existing mappings when symbols parameter is omitted", async () => {
      // Step 1: Seed theme with mappings
      await saveThemeSectorContext(env, {
        notebook_id: "nb-networking",
        theme_name: "Optics & Interconnect",
        symbols: ["AVGO", "MRVL"],
      });

      // Step 2: Update theme details WITHOUT passing symbols parameter
      const res = await saveThemeSectorContext(env, {
        notebook_id: "nb-networking",
        theme_name: "Optics & Interconnect (Updated Title)",
        macro_trends: "800G to 1.6T transceiver transition",
      });
      expect(res.success).toBe(true);
      expect(res.linked_symbols).toBeUndefined();

      // Mappings must STILL BE 2
      const rows = db
        .prepare(
          "SELECT symbol FROM theme_symbol_mappings WHERE notebook_id = 'nb-networking' ORDER BY symbol ASC"
        )
        .all() as any[];
      expect(rows.map((r) => r.symbol)).toEqual(["AVGO", "MRVL"]);
    });

    it("empirically synchronizes symbol mapping replacement without leaving orphaned mappings", async () => {
      // Initial: [ARM, NVDA]
      await saveThemeSectorContext(env, {
        notebook_id: "nb-custom-silicon",
        theme_name: "Custom Silicon",
        symbols: ["ARM", "NVDA"],
      });

      // Update to: [ARM, INTC, TSM] (NVDA removed, INTC and TSM added)
      await saveThemeSectorContext(env, {
        notebook_id: "nb-custom-silicon",
        theme_name: "Custom Silicon",
        symbols: ["ARM", "INTC", "TSM"],
      });

      const rows = db
        .prepare(
          "SELECT symbol FROM theme_symbol_mappings WHERE notebook_id = 'nb-custom-silicon' ORDER BY symbol ASC"
        )
        .all() as any[];
      expect(rows.map((r) => r.symbol)).toEqual(["ARM", "INTC", "TSM"]);

      // NVDA should no longer see this theme
      const nvdaBrief = await getFundamentalBrief(env, "NVDA");
      expect(nvdaBrief.themes).toHaveLength(0);

      // INTC should now see this theme
      const intcBrief = await getFundamentalBrief(env, "INTC");
      expect(intcBrief.themes).toHaveLength(1);
    });

    it("empirically respects foreign key CASCADE when theme is deleted", async () => {
      await saveThemeSectorContext(env, {
        notebook_id: "nb-temp",
        theme_name: "Temporary Theme",
        symbols: ["AAPL", "GOOG"],
      });

      // Delete the theme from theme_sector_contexts
      db.exec("DELETE FROM theme_sector_contexts WHERE notebook_id = 'nb-temp'");

      // Foreign key CASCADE should remove mappings
      const count = db
        .prepare("SELECT COUNT(*) as cnt FROM theme_symbol_mappings WHERE notebook_id = 'nb-temp'")
        .get() as any;
      expect(Number(count.cnt)).toBe(0);
    });
  });

  // =========================================================================
  // 3. getFundamentalBrief Resilience Testing
  // =========================================================================
  describe("3. getFundamentalBrief Resilience Testing", () => {
    it("empirically handles completely empty tables gracefully", async () => {
      const res = await getFundamentalBrief(env, "ARM");
      expect(res).toEqual({
        symbol: "ARM",
        fundamental: null,
        themes: [],
      });
    });

    it("empirically handles unseeded symbol when other symbols exist", async () => {
      await saveFundamentalBrief(env, {
        symbol: "ARM",
        as_of_date: "2026-10-01",
        business_model: "Licensing",
      });

      const res = await getFundamentalBrief(env, "NVDA");
      expect(res).toEqual({
        symbol: "NVDA",
        fundamental: null,
        themes: [],
      });
    });

    it("empirically handles mixed casing and whitespace in retrieval queries", async () => {
      await saveFundamentalBrief(env, {
        symbol: "arm",
        as_of_date: "2026-10-01",
        business_model: "Licensing",
      });
      await saveThemeSectorContext(env, {
        notebook_id: "nb-arm",
        theme_name: "ARM Ecosystem",
        symbols: ["arm"],
      });

      const queries = ["ARM", "arm", "Arm", "aRm", "  ARM  ", "  arm\t"];
      for (const q of queries) {
        const res = await getFundamentalBrief(env, q);
        expect(res.symbol).toBe("ARM");
        expect(res.fundamental?.symbol).toBe("ARM");
        expect(res.themes).toHaveLength(1);
        expect(res.themes[0].theme_name).toBe("ARM Ecosystem");
      }
    });

    it("empirically handles empty or non-string symbol arguments", async () => {
      expect(await getFundamentalBrief(env, "")).toEqual({ fundamental: null, themes: [] });
      expect(await getFundamentalBrief(env, "   ")).toEqual({ fundamental: null, themes: [] });
      expect(await getFundamentalBrief(env, null as any)).toEqual({ fundamental: null, themes: [] });
      expect(await getFundamentalBrief(env, undefined as any)).toEqual({ fundamental: null, themes: [] });
      expect(await getFundamentalBrief(env, {} as any)).toEqual({ fundamental: null, themes: [] });
      expect(await getFundamentalBrief(env, { symbol: "" })).toEqual({ fundamental: null, themes: [] });
      expect(await getFundamentalBrief(env, { symbol: "   " })).toEqual({ fundamental: null, themes: [] });
    });

    it("empirically recovers from malformed and corrupted JSON in D1 columns without crashing", async () => {
      // Directly inject corrupted JSON rows into D1 table
      db.prepare(`
        INSERT INTO stock_fundamentals (
          symbol,
          business_model,
          moat,
          competitors,
          guidance,
          key_risks,
          thesis_kpis,
          as_of_date,
          notebook_id,
          source_count,
          updated_at
        ) VALUES (
          'CORRUPT',
          'Business model test',
          'Moat test',
          '{{invalid_json_array',
          '{"revenue_target": unclosed_string',
          'not even json',
          '["unclosed array',
          '2026-10-01',
          'nb-corrupt',
          1,
          datetime('now')
        )
      `).run();

      const res = await getFundamentalBrief(env, "CORRUPT");
      expect(res.fundamental).not.toBeNull();
      expect(res.fundamental?.symbol).toBe("CORRUPT");
      // Fallback arrays and null guidance
      expect(res.fundamental?.competitors).toEqual([]);
      expect(res.fundamental?.guidance).toBeNull();
      expect(res.fundamental?.key_risks).toEqual([]);
      expect(res.fundamental?.thesis_kpis).toEqual([]);
    });

    it("empirically verifies multiple themes mapped to the same symbol ordered by updated_at DESC", async () => {
      // Insert 2 themes for ARM with staggered updated_at
      db.prepare(`
        INSERT INTO theme_sector_contexts (notebook_id, theme_name, updated_at)
        VALUES ('nb-older', 'Older Theme', '2026-01-01 00:00:00')
      `).run();
      db.prepare(`
        INSERT INTO theme_symbol_mappings (notebook_id, symbol)
        VALUES ('nb-older', 'ARM')
      `).run();

      db.prepare(`
        INSERT INTO theme_sector_contexts (notebook_id, theme_name, updated_at)
        VALUES ('nb-newer', 'Newer Theme', '2026-06-01 00:00:00')
      `).run();
      db.prepare(`
        INSERT INTO theme_symbol_mappings (notebook_id, symbol)
        VALUES ('nb-newer', 'ARM')
      `).run();

      const res = await getFundamentalBrief(env, "ARM");
      expect(res.themes).toHaveLength(2);
      expect(res.themes[0].notebook_id).toBe("nb-newer");
      expect(res.themes[0].theme_name).toBe("Newer Theme");
      expect(res.themes[1].notebook_id).toBe("nb-older");
      expect(res.themes[1].theme_name).toBe("Older Theme");
    });
  });

  // =========================================================================
  // 4. Adversarial Attack Surface & Extreme Edge Cases
  // =========================================================================
  describe("4. Adversarial Attack Surface & Extreme Edge Cases", () => {
    it("empirically resists SQL injection payloads across all text fields", async () => {
      const sqlInjectionPayload = "'; DROP TABLE stock_fundamentals; SELECT '1'='1";
      const res = await saveFundamentalBrief(env, {
        symbol: "INJ",
        as_of_date: "2026-10-01",
        business_model: sqlInjectionPayload,
        moat: "normal moat' OR '1'='1",
        guidance: {
          revenue_target: sqlInjectionPayload,
          key_assumptions: "'; DELETE FROM theme_sector_contexts; --",
        },
        competitors: [sqlInjectionPayload, "Safe competitor"],
        key_risks: ["Normal risk", "'); DROP TABLE theme_symbol_mappings; --"],
        thesis_kpis: ["KPI 1", sqlInjectionPayload],
      });
      expect(res.success).toBe(true);

      // Verify tables still exist
      const checkTable = db
        .prepare("SELECT COUNT(*) as cnt FROM stock_fundamentals WHERE symbol = 'INJ'")
        .get() as any;
      expect(Number(checkTable.cnt)).toBe(1);

      // Verify raw string stored verbatim without executing
      const brief = await getFundamentalBrief(env, "INJ");
      expect(brief.fundamental?.business_model).toBe(sqlInjectionPayload);
      expect(brief.fundamental?.guidance.revenue_target).toBe(sqlInjectionPayload);
      expect(brief.fundamental?.competitors).toContain(sqlInjectionPayload);
    });

    it("empirically handles large symbol batch (50 symbols) in theme sync", async () => {
      const symbols50 = Array.from({ length: 50 }, (_, i) => `SYM${i + 1}`);
      const res = await saveThemeSectorContext(env, {
        notebook_id: "nb-large-50",
        theme_name: "Large Sector Basket",
        symbols: symbols50,
      });

      expect(res.success).toBe(true);
      expect(res.linked_symbols).toHaveLength(50);

      const count = db
        .prepare("SELECT COUNT(*) as cnt FROM theme_symbol_mappings WHERE notebook_id = 'nb-large-50'")
        .get() as any;
      expect(Number(count.cnt)).toBe(50);
    });

    it("empirically handles concurrent read and write operations on the same symbol", async () => {
      // Seed initial record
      await saveFundamentalBrief(env, {
        symbol: "RACE",
        as_of_date: "2026-01-01",
        business_model: "Initial Model",
      });

      // Launch 10 simultaneous reads and 10 simultaneous writes
      const operations = [];
      for (let i = 0; i < 10; i++) {
        operations.push(getFundamentalBrief(env, "RACE"));
        operations.push(
          saveFundamentalBrief(env, {
            symbol: "RACE",
            as_of_date: `2026-02-${String(i + 1).padStart(2, "0")}`,
            business_model: `Model version ${i}`,
          })
        );
      }

      const results = await Promise.all(operations);
      expect(results).toHaveLength(20);

      // Every read returned a valid object with symbol RACE
      for (let i = 0; i < 20; i += 2) {
        const readRes: any = results[i];
        expect(readRes.symbol).toBe("RACE");
        expect(readRes.fundamental).not.toBeNull();
      }

      // Final state in D1 is healthy
      const finalBrief = await getFundamentalBrief(env, "RACE");
      expect(finalBrief.fundamental?.symbol).toBe("RACE");
      expect(finalBrief.fundamental?.business_model).toMatch(/^Model version \d$/);
    });
  });
});

