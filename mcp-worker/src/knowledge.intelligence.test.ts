import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  saveMarketArticle,
  createFacebookDraft,
  getRecentArticles,
  getWatchlist,
  searchKnowledge,
  saveValueInvestingReport,
  getLatestAnalysisReport,
} from "./knowledge";

describe("Market Intelligence Knowledge Helpers", () => {
  let mockDb: any;
  let mockKnowledgeBucket: any;
  let mockEnv: any;
  let executedSql: { sql: string; binds: any[] }[];
  let batchedStmts: any[];

  beforeEach(() => {
    vi.resetAllMocks();
    executedSql = [];
    batchedStmts = [];

    mockDb = {
      batch: vi.fn().mockImplementation(async (stmts: any[]) => {
        batchedStmts = stmts;
        for (const s of stmts) {
          if (typeof s.run === "function") {
            await s.run();
          }
        }
        return stmts.map(() => ({ success: true }));
      }),
      prepare: vi.fn().mockImplementation((sql: string) => {
        let currentBinds: any[] = [];
        const entry = { sql, binds: [] as any[] };
        executedSql.push(entry);
        const stmt = {
          sql,
          getBinds: () => currentBinds,
          bind: vi.fn().mockImplementation((...args: any[]) => {
            currentBinds = args;
            entry.binds = args;
            return stmt;
          }),
          run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 1 } }),
          first: vi.fn().mockImplementation(async () => {
            if (sql.includes("SELECT id FROM notebook_articles")) {
              return { id: 77 };
            }
            if (sql.includes("SELECT framework_results FROM analysis_results")) {
              return null;
            }
            if (sql.includes("SELECT debate_json FROM stock_fundamentals")) {
              return null;
            }
            return null;
          }),
          all: vi.fn().mockImplementation(async () => {
            if (sql.includes("SELECT * FROM notebook_articles")) {
              return {
                results: [
                  { id: 77, title: "NVIDIA Chip Surge", symbol: "NVDA", source: "gemini_spark" },
                ],
              };
            }
            if (sql.includes("FROM watchlist")) {
              if (sql.includes("WHERE (w.is_active = 1")) {
                return {
                  results: [
                    { symbol: "AAPL", name: "Apple", is_active: 1 },
                    { symbol: "MSFT", name: "Microsoft", is_active: 1 },
                  ],
                };
              }
              return {
                results: [
                  { symbol: "AAPL", name: "Apple", is_active: 1 },
                  { symbol: "MSFT", name: "Microsoft", is_active: 1 },
                  { symbol: "NFLX", name: "Netflix", is_active: 0 },
                ],
              };
            }
            if (sql.includes("FROM knowledge_base")) {
              return {
                results: [
                  { id: 1, title: "Warren Buffett Principles", category: "warren_buffett", content: "Margin of safety" }
                ],
              };
            }
            return { results: [] };
          }),
        };
        return stmt;
      }),
    };

    mockKnowledgeBucket = {
      put: vi.fn().mockResolvedValue({}),
    };

    mockEnv = {
      DB: mockDb,
      KNOWLEDGE_BUCKET: mockKnowledgeBucket,
    };
  });

  describe("saveMarketArticle", () => {
    it("upserts article into D1 notebook_articles and writes OKF to KNOWLEDGE_BUCKET", async () => {
      const result = await saveMarketArticle(mockEnv, {
        title: "NVIDIA Chip Surge",
        summary: "Massive demand for datacenter GPUs.",
        symbol: "nvda",
        key_takeaways: ["Takeaway 1", "Takeaway 2"],
        category: "Semiconductors",
        source: "gemini_spark",
        url: "https://bloomberg.com/nvda",
        auto_publish_facebook: false,
      });

      expect(result.success).toBe(true);
      expect(result.id).toBe(77);
      expect(result.symbol).toBe("NVDA");
      expect(result.auto_publish).toBe(false);
      expect(result.r2_key).toBe("articles/nvidia_chip_surge.md");

      // Verify D1 upsert SQL
      const upsert = executedSql.find((e) => e.sql.includes("INSERT INTO notebook_articles"));
      expect(upsert).toBeDefined();
      expect(upsert?.binds[0]).toBe("NVIDIA Chip Surge");
      expect(upsert?.binds[1]).toBe("NVDA"); // normalized to uppercase
      expect(upsert?.binds[7]).toBe(0); // auto_publish = 0

      // Verify R2 put
      expect(mockKnowledgeBucket.put).toHaveBeenCalledWith(
        "articles/nvidia_chip_surge.md",
        expect.stringContaining("title: \"NVIDIA Chip Surge\""),
        expect.objectContaining({ httpMetadata: { contentType: "text/markdown" } })
      );
    });

    it("parses multiline string key_takeaways cleanly and normalizes null symbol", async () => {
      const result = await saveMarketArticle(mockEnv, {
        title: "Fed Interest Rate Pause",
        summary: "The Fed holds rates steady.",
        key_takeaways: "- Inflation stabilizing\n• Job growth resilient\n3. Market expects cuts",
      });

      expect(result.success).toBe(true);
      expect(result.symbol).toBeNull();
      const upsert = executedSql.find((e) => e.sql.includes("INSERT INTO notebook_articles"));
      expect(upsert?.binds[3]).toBe(
        JSON.stringify(["Inflation stabilizing", "Job growth resilient", "Market expects cuts"])
      );
    });

    it("queues to facebook_posts when auto_publish_facebook is true", async () => {
      const result = await saveMarketArticle(mockEnv, {
        title: "Breaking AI News",
        summary: "Major breakthrough announced.",
        auto_publish_facebook: true,
      });

      expect(result.auto_publish).toBe(true);
      const fbQueue = executedSql.find((e) => e.sql.includes("INSERT OR IGNORE INTO facebook_posts"));
      expect(fbQueue).toBeDefined();
      expect(fbQueue?.binds).toEqual([77]);
    });
  });

  describe("createFacebookDraft", () => {
    it("creates custom draft in facebook_posts", async () => {
      const result = await createFacebookDraft(mockEnv, {
        title: "Market Commentary Draft",
        content: "Here is what we think about the recent dip...",
      });

      expect(result.success).toBe(true);
      const insert = executedSql.find((e) => e.sql.includes("INSERT INTO facebook_posts"));
      expect(insert?.binds).toEqual(["Market Commentary Draft", "Here is what we think about the recent dip..."]);
    });
  });

  describe("getRecentArticles", () => {
    it("queries articles with limit and source filter", async () => {
      const articles = await getRecentArticles(mockEnv, 5, "gemini_spark");
      expect(articles.length).toBe(1);
      const select = executedSql.find((e) => e.sql.includes("WHERE source = ?"));
      expect(select?.binds).toEqual(["gemini_spark", 5]);
    });
  });

  describe("getWatchlist", () => {
    it("returns all watchlist symbols by default (including inactive)", async () => {
      const items = await getWatchlist(mockEnv);
      expect(items.length).toBe(3);
      expect(items.map((i: any) => i.symbol)).toEqual(["AAPL", "MSFT", "NFLX"]);
      const query = executedSql.find((e) => e.sql.includes("FROM watchlist w"));
      expect(query?.sql).not.toContain("WHERE (w.is_active = 1");
    });

    it("filters only active watchlist symbols when activeOnly is true", async () => {
      const items = await getWatchlist(mockEnv, { activeOnly: true });
      expect(items.length).toBe(2);
      expect(items.map((i: any) => i.symbol)).toEqual(["AAPL", "MSFT"]);
      const query = executedSql.find((e) => e.sql.includes("WHERE (w.is_active = 1"));
      expect(query).toBeDefined();
    });

    it("falls back to SELECT * FROM watchlist when joined query errors", async () => {
      mockDb.prepare = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes("LEFT JOIN market_stats")) {
          throw new Error("column not found");
        }
        return {
          all: vi.fn().mockResolvedValue({
            results: [{ symbol: "AAPL" }, { symbol: "MSFT" }, { symbol: "NFLX" }],
          }),
        };
      });

      const items = await getWatchlist(mockEnv);
      expect(items.length).toBe(3);
      expect(mockDb.prepare).toHaveBeenCalledWith("SELECT * FROM watchlist ORDER BY symbol ASC");
    });
  });

  describe("searchKnowledge", () => {
    it("returns knowledge base items when query does not include watchlist", async () => {
      const results = await searchKnowledge(mockEnv, "margin");
      expect(results.length).toBe(1);
      expect(results[0].title).toBe("Warren Buffett Principles");
    });

    it("injects user watchlist when query includes watchlist", async () => {
      const results = await searchKnowledge(mockEnv, "watchlist");
      expect(results.length).toBe(2); // 1 from knowledge_base + 1 injected watchlist
      const watchlistResult = results.find((r: any) => r.category === "watchlist") as any;
      expect(watchlistResult).toBeDefined();
      expect(watchlistResult.title).toBe("User Watchlist");
      expect(watchlistResult.symbols).toEqual(["AAPL", "MSFT", "NFLX"]);
      expect(watchlistResult.content).toContain("Watchlist contains 3 symbols");
    });
  });

  describe("saveValueInvestingReport", () => {
    it("atomically overwrites analysis_results in D1 and writes OKF markdown to R2", async () => {
      const res = await saveValueInvestingReport(mockEnv, {
        symbol: " rmbs ",
        summary: "# รายงานการวิเคราะห์การลงทุนเชิงลึก: RMBS\n\n## 1. บทสรุป",
        conviction_level: "High",
        source: "gemini_app",
      });

      expect(res.success).toBe(true);
      expect(res.symbol).toBe("RMBS");
      expect(res.conviction_level).toBe("High");
      expect(res.source).toBe("gemini_app");
      expect(res.d1_saved).toBe(true);
      expect(res.r2_key).toBe("reports/RMBS.md");
      expect(res.r2_written).toBe(true);

      expect(mockDb.batch).toHaveBeenCalledTimes(1);
      expect(batchedStmts.length).toBe(2);

      const deleteEntry = executedSql.find((e) => e.sql.includes("DELETE FROM analysis_results WHERE symbol = ?"));
      expect(deleteEntry).toBeDefined();
      expect(deleteEntry?.binds).toEqual(["RMBS"]);

      const insertEntry = executedSql.find((e) => e.sql.includes("INSERT INTO analysis_results"));
      expect(insertEntry).toBeDefined();
      expect(insertEntry?.binds[0]).toBe("RMBS");
      expect(insertEntry?.binds[1]).toContain("# รายงานการวิเคราะห์การลงทุนเชิงลึก: RMBS");
      expect(insertEntry?.binds[2]).toBe("High");

      const fwJson = JSON.parse(insertEntry?.binds[3]);
      expect(fwJson.source).toBe("gemini_app");

      expect(mockKnowledgeBucket.put).toHaveBeenCalledWith(
        "reports/RMBS.md",
        expect.stringContaining("type: value_investing_report"),
        expect.objectContaining({ httpMetadata: { contentType: "text/markdown" } })
      );
    });

    it("preserves existing debate from analysis_results when overwriting report", async () => {
      const mockDebate = {
        symbol: "RMBS",
        synthesis: { conviction_score: 6, conviction_label: "Moderate Bull", verdict_summary: "Strong IP moat" },
      };

      const origPrepare = mockDb.prepare;
      mockDb.prepare = vi.fn().mockImplementation((sql: string) => {
        const stmt = origPrepare(sql);
        if (sql.includes("SELECT framework_results FROM analysis_results")) {
          stmt.first = vi.fn().mockResolvedValue({
            framework_results: JSON.stringify({ debate: mockDebate }),
          });
        }
        return stmt;
      });

      const res = await saveValueInvestingReport(mockEnv, {
        symbol: "RMBS",
        summary: "# RMBS Report",
        conviction_level: "Medium",
      });

      expect(res.success).toBe(true);
      const insertEntry = executedSql.find((e) => e.sql.includes("INSERT INTO analysis_results"));
      const fwJson = JSON.parse(insertEntry?.binds[3]);
      expect(fwJson.debate).toEqual(mockDebate);
      expect(fwJson.source).toBe("gemini_app");
    });

    it("returns validation error when symbol or summary is empty", async () => {
      const resEmptySymbol = await saveValueInvestingReport(mockEnv, {
        symbol: "   ",
        summary: "# Valid Summary",
        conviction_level: "High",
      });
      expect(resEmptySymbol.error).toContain("symbol");

      const resEmptySummary = await saveValueInvestingReport(mockEnv, {
        symbol: "RMBS",
        summary: "   ",
        conviction_level: "High",
      });
      expect(resEmptySummary.error).toContain("summary");
    });

    it("handles missing R2 bucket gracefully while still saving to D1", async () => {
      const envNoR2 = { DB: mockDb };
      const res = await saveValueInvestingReport(envNoR2, {
        symbol: "RMBS",
        summary: "# RMBS Report",
        conviction_level: "Low",
      });
      expect(res.success).toBe(true);
      expect(res.d1_saved).toBe(true);
      expect(res.r2_written).toBe(false);
      expect(res.r2_key).toBeNull();
    });
  });

  describe("getLatestAnalysisReport", () => {
    it("queries only non-empty summary reports for the given symbol", async () => {
      await getLatestAnalysisReport(mockEnv, "rmbs");
      const selectEntry = executedSql.find((e) => e.sql.includes("FROM analysis_results"));
      expect(selectEntry).toBeDefined();
      expect(selectEntry?.sql).toContain("summary IS NOT NULL AND summary != ''");
      expect(selectEntry?.binds).toEqual(["RMBS"]);
    });
  });
});
