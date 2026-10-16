import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  saveFundamentalBrief,
  getFundamentalBrief,
  stockFundamentalToOkf as mcpStockFundamentalToOkf,
  sanitizeYamlScalar,
  normalizeArrayField,
  normalizeGuidanceField,
  OKF_FALLBACK_PLACEHOLDERS,
} from "./fundamentalTools";
import {
  parseOkfFundamentalBrief,
  parseOkfFrontmatter,
  stockFundamentalToOkf as backendStockFundamentalToOkf,
} from "../../backend/src/okf";

describe("Empirical Challenger M2: R2 Error Isolation & OKF Markdown Fidelity", () => {
  let mockDb: any;
  let mockKnowledgeBucket: any;
  let mockEnv: any;
  let d1Store: Map<string, any>;

  beforeEach(() => {
    vi.resetAllMocks();
    d1Store = new Map();

    mockDb = {
      prepare: vi.fn().mockImplementation((sql: string) => {
        const stmt = {
          sql,
          params: [] as any[],
          bind: vi.fn().mockImplementation((...args: any[]) => {
            stmt.params = args;
            return stmt;
          }),
          run: vi.fn().mockImplementation(async () => {
            if (sql.includes("INSERT INTO stock_fundamentals")) {
              const [
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
              ] = stmt.params;
              d1Store.set(symbol, {
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
                updated_at: new Date().toISOString(),
              });
            }
            return { success: true, meta: { changes: 1 } };
          }),
          first: vi.fn().mockImplementation(async () => {
            if (sql.includes("FROM stock_fundamentals")) {
              const symbol = stmt.params[0];
              return d1Store.get(symbol) || null;
            }
            return null;
          }),
          all: vi.fn().mockImplementation(async () => {
            return { results: [] };
          }),
        };
        return stmt;
      }),
      batch: vi.fn().mockImplementation(async (statements: any[]) => {
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
  // Dimension 1: Cloudflare R2 Error Isolation & Fault Tolerance
  // =========================================================================
  describe("R2 Error Isolation & Resilience", () => {
    it("safely persists D1 record and returns structured failure when R2 rejects with network timeout", async () => {
      mockKnowledgeBucket.put.mockRejectedValue(new Error("Connection reset by peer (R2 timeout)"));

      const input = {
        symbol: "ARM",
        as_of_date: "2026-10-15",
        business_model: "Semiconductor architecture IP licensing",
        source_count: 4,
      };

      const result = await saveFundamentalBrief(mockEnv, input);

      // Verify return object structure matches specification
      expect(result).toEqual({
        success: true,
        symbol: "ARM",
        as_of_date: "2026-10-15",
        d1_saved: true,
        r2_key: "fundamentals/ARM.md",
        r2_written: false,
        r2_error: "Connection reset by peer (R2 timeout)",
      });

      // Verify D1 was actually written and persisted despite R2 failure
      expect(d1Store.has("ARM")).toBe(true);
      const row = d1Store.get("ARM");
      expect(row.business_model).toBe("Semiconductor architecture IP licensing");
      expect(row.source_count).toBe(4);

      // Verify getFundamentalBrief can retrieve the persisted D1 data
      const lookup = await getFundamentalBrief(mockEnv, "ARM");
      expect(lookup.fundamental).not.toBeNull();
      expect(lookup.fundamental?.symbol).toBe("ARM");
      expect(lookup.fundamental?.business_model).toBe("Semiconductor architecture IP licensing");
    });

    it("safely persists D1 when R2 throws synchronous exception", async () => {
      mockKnowledgeBucket.put.mockImplementation(() => {
        throw new TypeError("Simulated synchronous crash in R2 client binding");
      });

      const input = {
        symbol: "NVDA",
        as_of_date: "2026-10-15",
        moat: "CUDA software ecosystem and NVLink interconnect",
      };

      const result = await saveFundamentalBrief(mockEnv, input);

      expect(result.success).toBe(true);
      expect(result.d1_saved).toBe(true);
      expect(result.r2_written).toBe(false);
      expect(result.r2_error).toContain("Simulated synchronous crash in R2 client binding");
      expect(d1Store.has("NVDA")).toBe(true);
    });

    it("handles missing R2 bucket bindings gracefully without throwing", async () => {
      const bareEnv = { DB: mockDb }; // No KNOWLEDGE_BUCKET, no BUCKET

      const input = {
        symbol: "TSM",
        as_of_date: "2026-10-15",
        business_model: "Pure-play semiconductor foundry",
      };

      const result = await saveFundamentalBrief(bareEnv, input);

      expect(result.success).toBe(true);
      expect(result.d1_saved).toBe(true);
      expect(result.r2_written).toBe(false);
      expect(result.r2_key).toBeNull();
      expect(d1Store.has("TSM")).toBe(true);
    });

    it("handles corrupted bucket binding where .put is not a function", async () => {
      const corruptedEnv = {
        DB: mockDb,
        KNOWLEDGE_BUCKET: { notPut: true }, // Invalid object
      };

      const input = {
        symbol: "INTC",
        as_of_date: "2026-10-15",
      };

      const result = await saveFundamentalBrief(corruptedEnv, input);

      expect(result.success).toBe(true);
      expect(result.d1_saved).toBe(true);
      expect(result.r2_written).toBe(false);
      expect(result.r2_error).toBeDefined();
      expect(d1Store.has("INTC")).toBe(true);
    });

    it("ensures MCP JSON-RPC serialization works seamlessly when R2 fails", async () => {
      mockKnowledgeBucket.put.mockRejectedValue(new Error("503 Service Unavailable"));

      const result = await saveFundamentalBrief(mockEnv, {
        symbol: "MSFT",
        as_of_date: "2026-10-15",
      });

      // Emulate mcpAgent.ts asText wrapper
      const asText = (data: unknown) => ({
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      });

      const mcpResponse = asText(result);
      expect(mcpResponse.content).toHaveLength(1);
      expect(mcpResponse.content[0].type).toBe("text");

      const parsedJson = JSON.parse(mcpResponse.content[0].text);
      expect(parsedJson.success).toBe(true);
      expect(parsedJson.d1_saved).toBe(true);
      expect(parsedJson.r2_written).toBe(false);
      expect(parsedJson.r2_error).toBe("503 Service Unavailable");
    });
  });

  // =========================================================================
  // Dimension 2: OKF Markdown Serialization Fidelity & Escaping
  // =========================================================================
  describe("OKF Markdown Serialization Fidelity", () => {
    it("escapes YAML scalars properly to prevent YAML syntax corruption", () => {
      // Test malicious/complex scalar inputs
      expect(sanitizeYamlScalar('ARM "Holdings" plc')).toBe("ARM 'Holdings' plc");
      expect(sanitizeYamlScalar("Line 1\r\nLine 2\nLine 3")).toBe("Line 1 Line 2 Line 3");
      expect(sanitizeYamlScalar("Trailing backslash \\")).toBe("Trailing backslash");
      expect(sanitizeYamlScalar("Multiple trailing \\\\\\")).toBe("Multiple trailing");
      expect(sanitizeYamlScalar('  "Surrounded by quotes"  ')).toBe("'Surrounded by quotes'");
      expect(sanitizeYamlScalar(null)).toBe("");
      expect(sanitizeYamlScalar(undefined)).toBe("");
      expect(sanitizeYamlScalar(12345)).toBe("");
    });

    it("generates valid inline tags in [tag1, tag2, ...] format", () => {
      const markdown = mcpStockFundamentalToOkf({
        symbol: "ARM",
        as_of_date: "2026-10-15",
      });

      expect(markdown).toContain("tags: [fundamental-brief, single-stock, arm]");

      const { frontmatter } = parseOkfFrontmatter(markdown);
      expect(frontmatter.tags).toEqual(["fundamental-brief", "single-stock", "arm"]);
    });

    it("generates all 5 standard canonical markdown sections", () => {
      const markdown = mcpStockFundamentalToOkf({
        symbol: "ARM",
        as_of_date: "2026-10-15",
        business_model: "Licensing architecture and royalties",
        moat: "Architecture lock-in",
        competitors: ["x86", "RISC-V"],
        guidance: { revenue_target: "$4B" },
        key_risks: ["China JV"],
        thesis_kpis: ["v9 penetration"],
      });

      expect(markdown).toContain("# Fundamental Brief: ARM");
      expect(markdown).toContain("## Business Model");
      expect(markdown).toContain("## Competitive Moat");
      expect(markdown).toContain("### Key Competitors");
      expect(markdown).toContain("## Management Guidance");
      expect(markdown).toContain("## Key Risks");
      expect(markdown).toContain("## Thesis KPIs");
    });

    it("falls back to canonical placeholder strings for missing fields", () => {
      const markdown = mcpStockFundamentalToOkf({
        symbol: "EMPTY",
        as_of_date: "2026-10-15",
      });

      expect(markdown).toContain(OKF_FALLBACK_PLACEHOLDERS.business_model);
      expect(markdown).toContain(OKF_FALLBACK_PLACEHOLDERS.moat);
      expect(markdown).toContain(OKF_FALLBACK_PLACEHOLDERS.guidance);
      expect(markdown).toContain(OKF_FALLBACK_PLACEHOLDERS.key_risks);
      expect(markdown).toContain(OKF_FALLBACK_PLACEHOLDERS.thesis_kpis);
    });

    it("normalizes array inputs from string[], JSON string, or multiline strings", () => {
      expect(normalizeArrayField(["A", "B", "C"])).toEqual(["A", "B", "C"]);
      expect(normalizeArrayField('["JSON_A", "JSON_B"]')).toEqual(["JSON_A", "JSON_B"]);
      expect(normalizeArrayField("- Item 1\n* Item 2\n3. Item 3")).toEqual(["Item 1", "Item 2", "Item 3"]);
      expect(normalizeArrayField("   ")).toEqual([]);
      expect(normalizeArrayField(null)).toEqual([]);
    });

    it("normalizes guidance from object, JSON string, or raw text", () => {
      const objGuidance = { revenue_target: "20% YoY" };
      expect(normalizeGuidanceField(objGuidance)).toEqual(objGuidance);

      const jsonGuidance = '{"margin_target": "50%"}';
      expect(normalizeGuidanceField(jsonGuidance)).toEqual({ margin_target: "50%" });

      const rawGuidance = "Targeting 15% revenue growth by 2028";
      expect(normalizeGuidanceField(rawGuidance)).toBe(rawGuidance);

      expect(normalizeGuidanceField("")).toBeNull();
      expect(normalizeGuidanceField(null)).toBeNull();
    });
  });

  // =========================================================================
  // Dimension 3: Full Cross-Package Compatibility with backend/src/okf.ts
  // =========================================================================
  describe("Cross-Package Compatibility with backend/src/okf.ts", () => {
    it("produces OKF Markdown that backend parseOkfFundamentalBrief parses with 100% fidelity", () => {
      const originalInput = {
        symbol: "ARM",
        as_of_date: "2026-07-29",
        source_count: 5,
        notebook_id: "nb-arm-gemini-789",
        business_model: "High margin IP licensing upfront + compounding per-chip royalties across 30B+ chips annually.",
        moat: "Instruction set architecture (ISA) software ecosystem lock-in with 20M+ developers.",
        competitors: ["x86 (Intel / AMD)", "RISC-V (Open Standard)", "Qualcomm Oryon / Nuvia"],
        guidance: {
          revenue_target: "20-25% CAGR through FY27 ($4.0B+)",
          margin_target: "45-50% Non-GAAP operating margin",
          timeframe: "FY25 - FY27",
          key_assumptions: "ARMv9 royalty rate doubling from 1.5% to 3.0%+ and Compute Subsystem (CSS) adoption",
          near_term: "Q2 FY25 revenue of $820M-$870M",
          long_term: "Dominance in datacenter and edge AI compute",
        },
        key_risks: [
          "China JV (Arm Technology China) governance and cash repatriation friction",
          "SoftBank controlling ownership (approx 90%) and potential block sale overhang",
          "Hyperscaler migration to custom RISC-V accelerators",
        ],
        thesis_kpis: [
          "ARMv9 royalty penetration as % of total royalty revenue (> 25%)",
          "CSS royalty attach rate across cloud customers",
          "Datacenter server socket share expansion beyond 15%",
        ],
      };

      // Serialize using mcp-worker
      const mcpMarkdown = mcpStockFundamentalToOkf(originalInput);

      // Parse using backend parser
      const parsedBrief = parseOkfFundamentalBrief(mcpMarkdown);

      expect(parsedBrief).not.toBeNull();
      expect(parsedBrief?.symbol).toBe("ARM");
      expect(parsedBrief?.as_of_date).toBe("2026-07-29");
      expect(parsedBrief?.source_count).toBe(5);
      expect(parsedBrief?.notebook_id).toBe("nb-arm-gemini-789");
      expect(parsedBrief?.business_model).toBe(originalInput.business_model);
      expect(parsedBrief?.moat).toBe(originalInput.moat);
      expect(parsedBrief?.competitors).toEqual(originalInput.competitors);
      expect(parsedBrief?.guidance).toEqual(originalInput.guidance);
      expect(parsedBrief?.key_risks).toEqual(originalInput.key_risks);
      expect(parsedBrief?.thesis_kpis).toEqual(originalInput.thesis_kpis);
    });

    it("mcp-worker and backend serializers produce identical markdown output for identical inputs", () => {
      const testCases = [
        {
          symbol: "NVDA",
          as_of_date: "2026-09-10",
          source_count: 3,
          notebook_id: "nb-nvda-1",
          business_model: "Accelerated computing systems",
          moat: "CUDA ecosystem",
          competitors: ["AMD", "Intel"],
          guidance: {
            revenue_target: "$30B+",
            margin_target: "75%",
            timeframe: "Q3 FY25",
            key_assumptions: "Blackwell ramp",
            near_term: "Strong demand",
            long_term: "AI factory standard",
          },
          key_risks: ["Supply chain bottlenecks", "Export restrictions"],
          thesis_kpis: ["Data center revenue", "Gross margin"],
        },
        {
          symbol: "MINIMAL",
          as_of_date: "2026-01-01",
          source_count: 1,
          notebook_id: null,
          business_model: null,
          moat: null,
          competitors: [],
          guidance: null,
          key_risks: [],
          thesis_kpis: [],
        },
      ];

      for (const tc of testCases) {
        const mcpOutput = mcpStockFundamentalToOkf(tc);
        const backendOutput = backendStockFundamentalToOkf(tc as any);

        expect(mcpOutput).toBe(backendOutput);
      }
    });

    it("survives adversarial characters: Thai script, Chinese, emojis, quotes, and math symbols", () => {
      const adversarialInput = {
        symbol: "THAI-AI",
        as_of_date: "2026-10-15",
        source_count: 2,
        notebook_id: "สมุดโน้ต-123-🚀",
        business_model: 'ผู้นำด้านระบบ "AI Cloud" & ชิปประมวลผล 100% 💰 with math: 10 > 5 && 3 < 7',
        moat: 'เทคโนโลยีขั้นสูงพร้อมสิทธิบัตร "Key Patent #12345" และ `runtime` พิเศษ',
        competitors: ['บริษัท ก "x86"', 'บริษัท ข (RISC-V)', '华为主板', 'Global "Mega" Corp'],
        guidance: {
          revenue_target: 'เติบโต 35% YoY หรือ $1.5B',
          margin_target: 'กำไรสุทธิ 45% (Net Margin)',
          timeframe: 'ปี 2026-2027',
          key_assumptions: 'ขยายตลาดสู่ ASEAN & Middle East',
          near_term: 'ไตรมาสถัดไปมั่นคง',
          long_term: 'ครองตลาดเอเชีย',
        },
        key_risks: [
          'ความเสี่ยงจากนโยบายกีดกันทางการค้า "Trade War"',
          'ปัญหาการขาดแคลนกำลังการผลิต Foundry 3nm',
          'อัตราดอกเบี้ยผันผวน & FX USD/THB',
        ],
        thesis_kpis: [
          'จำนวนลูกค้าองค์กร > 500 ราย',
          'อัตราการต่อสัญญา (Retention Rate) 98%',
        ],
      };

      const markdown = mcpStockFundamentalToOkf(adversarialInput);
      const parsed = parseOkfFundamentalBrief(markdown);

      expect(parsed).not.toBeNull();
      expect(parsed?.symbol).toBe("THAI-AI");
      expect(parsed?.notebook_id).toBe("สมุดโน้ต-123-🚀");
      expect(parsed?.business_model).toBe(adversarialInput.business_model);
      expect(parsed?.moat).toBe(adversarialInput.moat);
      expect(parsed?.competitors).toEqual(adversarialInput.competitors);
      expect(parsed?.guidance).toEqual(adversarialInput.guidance);
      expect(parsed?.key_risks).toEqual(adversarialInput.key_risks);
      expect(parsed?.thesis_kpis).toEqual(adversarialInput.thesis_kpis);
    });

    it("preserves empty fields as null in parsed output when placeholders are serialized", () => {
      const minimalInput = {
        symbol: "EMPTY",
        as_of_date: "2026-10-15",
        source_count: 1,
      };

      const markdown = mcpStockFundamentalToOkf(minimalInput);
      const parsed = parseOkfFundamentalBrief(markdown);

      expect(parsed).not.toBeNull();
      expect(parsed?.symbol).toBe("EMPTY");
      // Fallback placeholders must be converted back to null / empty arrays by backend parser
      expect(parsed?.business_model).toBeNull();
      expect(parsed?.moat).toBeNull();
      expect(parsed?.competitors).toEqual([]);
      expect(parsed?.guidance).toBeNull();
      expect(parsed?.key_risks).toEqual([]);
      expect(parsed?.thesis_kpis).toEqual([]);
    });
  });
});
