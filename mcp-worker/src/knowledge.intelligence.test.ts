import { describe, it, expect, vi, beforeEach } from "vitest";
import { saveMarketArticle, createFacebookDraft, getRecentArticles, getWatchlist, searchKnowledge } from "./knowledge";

describe("Market Intelligence Knowledge Helpers", () => {
  let mockDb: any;
  let mockKnowledgeBucket: any;
  let mockEnv: any;
  let executedSql: { sql: string; binds: any[] }[];

  beforeEach(() => {
    vi.resetAllMocks();
    executedSql = [];

    mockDb = {
      prepare: vi.fn().mockImplementation((sql: string) => {
        let currentBinds: any[] = [];
        const entry = { sql, binds: [] as any[] };
        executedSql.push(entry);
        const stmt = {
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
});

