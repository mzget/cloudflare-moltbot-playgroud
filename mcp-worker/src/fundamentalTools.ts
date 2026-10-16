import { z } from "zod";

/**
 * Guidance sub-schema for management qualitative targets.
 */
export const guidanceSchema = z
  .object({
    revenue_target: z
      .string()
      .optional()
      .describe("Target revenue growth or range (e.g. '20-25% YoY', '$1.2B - $1.3B in FY27')"),
    margin_target: z
      .string()
      .optional()
      .describe("Gross or operating margin target (e.g. '75-80% gross margin', '40% operating margin')"),
    timeframe: z
      .string()
      .optional()
      .describe("Guidance horizon or fiscal period (e.g. 'FY27', 'Next 3-5 Years', 'Q2 FY27')"),
    key_assumptions: z
      .string()
      .optional()
      .describe("Strategic operational assumptions (e.g. 'ARMv9 royalty rate doubling, hyperscaler adoption')"),
    near_term: z
      .string()
      .optional()
      .describe("Near-term outlook summary (ADR 0010 compatibility)"),
    long_term: z
      .string()
      .optional()
      .describe("Long-term strategic targets (ADR 0010 compatibility)"),
  })
  .optional()
  .describe("Qualitative management guidance targets and operational assumptions");

export type GuidanceInfo = z.infer<typeof guidanceSchema>;

/**
 * Shape for save_fundamental_brief tool registration.
 */
export const saveFundamentalBriefShape = {
  symbol: z
    .string()
    .transform((val) => val.trim().toUpperCase())
    .refine((val) => val.length > 0, "symbol is required and cannot be empty")
    .describe("Stock ticker symbol in uppercase (e.g. 'ARM', 'NVDA')"),
  business_model: z
    .string()
    .optional()
    .describe("Comprehensive breakdown of business model, monetization engines, and unit economics"),
  moat: z
    .string()
    .optional()
    .describe("Structural economic moat mechanisms (e.g. high switching costs, IP architecture lock-in)"),
  competitors: z
    .array(z.string())
    .optional()
    .default([])
    .describe("Key direct and architecture competitors (e.g. ['RISC-V', 'x86', 'Qualcomm'])"),
  guidance: guidanceSchema,
  key_risks: z
    .array(z.string())
    .optional()
    .default([])
    .describe("Top structural, thesis, and operational risks"),
  thesis_kpis: z
    .array(z.string())
    .optional()
    .default([])
    .describe("3-5 quantifiable KPIs to track thesis progress"),
  as_of_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "as_of_date must be in YYYY-MM-DD format")
    .describe("Freshness date derived from newest filing/source timestamp (ISO YYYY-MM-DD)"),
  notebook_id: z
    .string()
    .optional()
    .describe("UUID of the source Google Gemini Notebook"),
  source_count: z
    .number()
    .int("source_count must be an integer")
    .min(1, "source_count must be at least 1")
    .default(1)
    .describe("Total number of primary documents ingested in the notebook (min 1, default 1)"),
};

export const SaveFundamentalBriefSchema = z.object(saveFundamentalBriefShape);
export type SaveFundamentalBriefInput = z.infer<typeof SaveFundamentalBriefSchema>;

/**
 * Shape for save_theme_sector_context tool registration.
 */
export const saveThemeSectorContextShape = {
  notebook_id: z
    .string()
    .transform((val) => val.trim())
    .refine((val) => val.length > 0, "notebook_id is required and cannot be empty")
    .describe("Google Gemini Notebook UUID (Primary Key)"),
  theme_name: z
    .string()
    .transform((val) => val.trim())
    .refine((val) => val.length > 0, "theme_name is required and cannot be empty")
    .describe("Human-readable theme title (e.g. 'SemiAnalysis & Advanced Packaging')"),
  industry_dynamics: z
    .string()
    .optional()
    .describe("Synthesis of industry structure, adoption lifecycles, and secular tailwinds"),
  supply_chain_bottlenecks: z
    .string()
    .optional()
    .describe("Supply chain constraints (e.g. CoWoS packaging, HBM allocation, power availability)"),
  competitive_landscape: z
    .string()
    .optional()
    .describe("Relative positioning and margin capture across the value chain"),
  macro_trends: z
    .string()
    .optional()
    .describe("Geopolitical, monetary, or macroeconomic tailwinds/headwinds"),
  symbols: z
    .array(z.string())
    .optional()
    .describe("Stock ticker symbols linked to this theme (e.g. ['ARM', 'NVDA', 'TSM'])"),
};

export const SaveThemeSectorContextSchema = z.object(saveThemeSectorContextShape);
export type SaveThemeSectorContextInput = z.infer<typeof SaveThemeSectorContextSchema>;

/**
 * Shape for get_fundamental_brief tool registration.
 */
export const getFundamentalBriefShape = {
  symbol: z
    .string()
    .transform((val) => val.trim().toUpperCase())
    .refine((val) => val.length > 0, "symbol is required and cannot be empty")
    .describe("Stock ticker symbol in uppercase (e.g. 'ARM', 'NVDA')"),
};

export const GetFundamentalBriefSchema = z.object(getFundamentalBriefShape);
export type GetFundamentalBriefInput = z.infer<typeof GetFundamentalBriefSchema>;

/**
 * Exact canonical fallback placeholders from Milestone 1 (ADR 0010 § 49-62).
 */
export const OKF_FALLBACK_PLACEHOLDERS = {
  business_model: "_No business model summary provided._",
  moat: "_No competitive moat analysis provided._",
  guidance: "_No formal management guidance documented._",
  key_risks: "_No key risks specified._",
  thesis_kpis: "_No thesis KPIs specified._",
} as const;

/**
 * Sanitizes a scalar string for safe single-line YAML frontmatter insertion.
 */
export function sanitizeYamlScalar(val: unknown): string {
  if (typeof val !== "string") return "";
  return val
    .replace(/[\r\n]+/g, " ")
    .replace(/"/g, "'")
    .replace(/\\+$/, "")
    .trim();
}

/**
 * Normalizes array inputs from string[], JSON string, or multiline newline string.
 */
export function normalizeArrayField(field: unknown): string[] {
  if (!field) return [];
  if (Array.isArray(field)) {
    return field.map(String).map((s) => s.trim()).filter(Boolean);
  }
  if (typeof field === "string") {
    const trimmed = field.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map(String).map((s) => s.trim()).filter(Boolean);
        }
      } catch {
        // Fall through
      }
    }
    return trimmed
      .split("\n")
      .map((line) => line.replace(/^[-*•\d.]+\s*/, "").trim())
      .filter(Boolean);
  }
  return [];
}

/**
 * Normalizes guidance inputs from GuidanceInfo object, JSON string, or raw text.
 */
export function normalizeGuidanceField(field: unknown): Record<string, any> | string | null {
  if (!field) return null;
  if (typeof field === "object" && !Array.isArray(field)) {
    return field as Record<string, any>;
  }
  if (typeof field === "string") {
    const trimmed = field.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith("{")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
          return parsed as Record<string, any>;
        }
      } catch {
        // Fall through
      }
    }
    return trimmed;
  }
  return null;
}

/**
 * Serializes fundamental brief data into canonical OKF Markdown.
 */
export function stockFundamentalToOkf(data: {
  symbol: string;
  as_of_date: string;
  source_count?: number | null;
  notebook_id?: string | null;
  business_model?: string | null;
  moat?: string | null;
  competitors?: string[] | string | null;
  guidance?: any;
  key_risks?: string[] | string | null;
  thesis_kpis?: string[] | string | null;
}): string {
  const symbol = sanitizeYamlScalar(data.symbol).toUpperCase();
  const rawAsOf = sanitizeYamlScalar(data.as_of_date);
  const asOfDate = rawAsOf || new Date().toISOString().split("T")[0];
  const sourceCount =
    typeof data.source_count === "number"
      ? data.source_count
      : parseInt(String(data.source_count || "0"), 10) || 1;
  const rawNotebookId = sanitizeYamlScalar(data.notebook_id);
  const notebookId = rawNotebookId.length > 0 ? rawNotebookId : null;

  // 1. Tags & Description
  const tags = ["fundamental-brief", "single-stock"];
  if (symbol) {
    const cleanTag = symbol.toLowerCase().replace(/[[\]'",]/g, "").trim();
    if (cleanTag) tags.push(cleanTag);
  }

  const rawDesc = (data.business_model || "").trim().slice(0, 120);
  const description =
    sanitizeYamlScalar(rawDesc) || `Fundamental brief and qualitative profile for ${symbol}`;

  // 2. YAML Frontmatter
  const frontmatterLines = [
    "---",
    "type: fundamental_brief",
    `symbol: "${symbol}"`,
    `title: "Fundamental Brief: ${symbol}"`,
    `as_of_date: "${asOfDate}"`,
    `source_count: ${sourceCount}`,
    notebookId ? `notebook_id: "${notebookId}"` : null,
    `tags: [${tags.join(", ")}]`,
    `timestamp: "${asOfDate}"`,
    `description: "${description}"`,
    "---",
  ].filter(Boolean);

  // 3. Subtitle / Metadata Badge
  const metaBadgeParts = [
    `**As of**: ${asOfDate}`,
    `**Sources Analyzed**: ${sourceCount}`,
  ];
  if (notebookId) {
    metaBadgeParts.push(`**Notebook ID**: \`${notebookId}\``);
  }
  const subtitleBadge = `> ${metaBadgeParts.join(" | ")}`;

  // 4. Section: Business Model
  const businessModel = (data.business_model || "").trim();
  const businessModelSec = `## Business Model\n\n${businessModel || OKF_FALLBACK_PLACEHOLDERS.business_model}`;

  // 5. Section: Competitive Moat & Competitors
  const moat = (data.moat || "").trim();
  const competitorsList = normalizeArrayField(data.competitors);
  let moatBody = moat || OKF_FALLBACK_PLACEHOLDERS.moat;
  if (competitorsList.length > 0) {
    moatBody += `\n\n### Key Competitors\n${competitorsList.map((c) => `- ${c}`).join("\n")}`;
  }
  const moatSec = `## Competitive Moat\n\n${moatBody}`;

  // 6. Section: Management Guidance
  const guidance = normalizeGuidanceField(data.guidance);
  let guidanceContent: string = OKF_FALLBACK_PLACEHOLDERS.guidance;
  if (typeof guidance === "string") {
    guidanceContent = guidance;
  } else if (guidance && typeof guidance === "object") {
    const lines: string[] = [];
    if (guidance.revenue_target) lines.push(`- **Revenue Target**: ${guidance.revenue_target}`);
    if (guidance.margin_target) lines.push(`- **Margin Target**: ${guidance.margin_target}`);
    if (guidance.timeframe) lines.push(`- **Timeframe**: ${guidance.timeframe}`);
    if (guidance.key_assumptions) lines.push(`- **Key Assumptions**: ${guidance.key_assumptions}`);
    if (guidance.near_term) lines.push(`- **Near-Term Guidance**: ${guidance.near_term}`);
    if (guidance.long_term) lines.push(`- **Long-Term Guidance**: ${guidance.long_term}`);
    if (lines.length > 0) {
      guidanceContent = lines.join("\n");
    }
  }
  const guidanceSec = `## Management Guidance\n\n${guidanceContent}`;

  // 7. Section: Key Risks
  const risksList = normalizeArrayField(data.key_risks);
  const risksContent =
    risksList.length > 0
      ? risksList.map((r) => `- ${r}`).join("\n")
      : OKF_FALLBACK_PLACEHOLDERS.key_risks;
  const risksSec = `## Key Risks\n\n${risksContent}`;

  // 8. Section: Thesis KPIs
  const kpisList = normalizeArrayField(data.thesis_kpis);
  const kpisContent =
    kpisList.length > 0
      ? kpisList.map((k) => `- ${k}`).join("\n")
      : OKF_FALLBACK_PLACEHOLDERS.thesis_kpis;
  const kpisSec = `## Thesis KPIs\n\n${kpisContent}`;

  // 9. Assemble Document
  const bodySections = [
    `# Fundamental Brief: ${symbol}`,
    subtitleBadge,
    businessModelSec,
    moatSec,
    guidanceSec,
    risksSec,
    kpisSec,
  ];

  return `${frontmatterLines.join("\n")}\n\n${bodySections.join("\n\n")}\n`;
}

/** Alias for compatibility */
export const serializeFundamentalBriefToOkf = stockFundamentalToOkf;

/**
 * Safe JSON parse helper that never throws.
 */
export function safeJsonParse<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== "string") return fallback;
  const trimmed = raw.trim();
  if (!trimmed) return fallback;
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    return fallback;
  }
}

export interface SaveFundamentalBriefResult {
  success?: boolean;
  error?: string;
  symbol?: string;
  as_of_date?: string;
  d1_saved?: boolean;
  r2_key?: string | null;
  r2_written?: boolean;
  r2_error?: string;
}

export interface SaveThemeSectorContextResult {
  success?: boolean;
  error?: string;
  notebook_id?: string;
  theme_name?: string;
  linked_symbols?: string[];
}

/**
 * MCP Tool Handler: save_fundamental_brief
 * Ingests qualitative single-stock brief, upserts into D1 `stock_fundamentals`,
 * serializes to OKF Markdown and persists into R2 `fundamentals/{symbol}.md`.
 */
export async function saveFundamentalBrief(
  env: any,
  args: any
): Promise<SaveFundamentalBriefResult> {
  const parsed = SaveFundamentalBriefSchema.safeParse(args);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map((i) => `${i.path.join(".") || "field"}: ${i.message}`).join(", ");
    return { error: `Validation error: ${errorMsg}` };
  }

  const {
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
  } = parsed.data;

  // 1. D1 Upsert
  const upsertSql = `
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
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now')
    )
    ON CONFLICT(symbol) DO UPDATE SET
      business_model = excluded.business_model,
      moat = excluded.moat,
      competitors = excluded.competitors,
      guidance = excluded.guidance,
      key_risks = excluded.key_risks,
      thesis_kpis = excluded.thesis_kpis,
      as_of_date = excluded.as_of_date,
      notebook_id = excluded.notebook_id,
      source_count = excluded.source_count,
      updated_at = datetime('now');
  `;

  await env.DB.prepare(upsertSql).bind(
    symbol,
    business_model?.trim() || null,
    moat?.trim() || null,
    competitors && competitors.length > 0 ? JSON.stringify(competitors) : null,
    guidance ? JSON.stringify(guidance) : null,
    key_risks && key_risks.length > 0 ? JSON.stringify(key_risks) : null,
    thesis_kpis && thesis_kpis.length > 0 ? JSON.stringify(thesis_kpis) : null,
    as_of_date,
    notebook_id?.trim() || null,
    source_count ?? 1
  ).run();

  // 2. R2 Persistence in isolated try/catch
  const targetBucket = env.KNOWLEDGE_BUCKET || env.BUCKET;
  let r2Key: string | null = null;
  let r2Written = false;
  let r2Error: string | null = null;

  if (targetBucket) {
    try {
      r2Key = `fundamentals/${symbol}.md`;
      const markdown = stockFundamentalToOkf(parsed.data);
      await targetBucket.put(r2Key, markdown, {
        httpMetadata: { contentType: "text/markdown" },
      });
      r2Written = true;
    } catch (err: any) {
      console.warn(`[saveFundamentalBrief] Failed to write R2 OKF file for ${symbol}:`, err?.message);
      r2Written = false;
      r2Error = err?.message || "R2 write failure";
    }
  }

  return {
    success: true,
    symbol,
    as_of_date,
    d1_saved: true,
    r2_key: r2Key,
    r2_written: r2Written,
    ...(r2Error ? { r2_error: r2Error } : {}),
  };
}

/**
 * MCP Tool Handler: save_theme_sector_context
 * Ingests multi-stock theme or sector macro intelligence, upserts `theme_sector_contexts`,
 * and synchronizes `theme_symbol_mappings` via atomic D1 batch.
 */
export async function saveThemeSectorContext(
  env: any,
  args: any
): Promise<SaveThemeSectorContextResult> {
  const parsed = SaveThemeSectorContextSchema.safeParse(args);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map((i) => `${i.path.join(".") || "field"}: ${i.message}`).join(", ");
    return { error: `Validation error: ${errorMsg}` };
  }

  const {
    notebook_id,
    theme_name,
    industry_dynamics,
    supply_chain_bottlenecks,
    competitive_landscape,
    macro_trends,
    symbols,
  } = parsed.data;

  // 1. Upsert into theme_sector_contexts
  const upsertSql = `
    INSERT INTO theme_sector_contexts (
      notebook_id,
      theme_name,
      industry_dynamics,
      supply_chain_bottlenecks,
      competitive_landscape,
      macro_trends,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(notebook_id) DO UPDATE SET
      theme_name = excluded.theme_name,
      industry_dynamics = excluded.industry_dynamics,
      supply_chain_bottlenecks = excluded.supply_chain_bottlenecks,
      competitive_landscape = excluded.competitive_landscape,
      macro_trends = excluded.macro_trends,
      updated_at = datetime('now');
  `;

  await env.DB.prepare(upsertSql).bind(
    notebook_id,
    theme_name,
    industry_dynamics?.trim() || null,
    supply_chain_bottlenecks?.trim() || null,
    competitive_landscape?.trim() || null,
    macro_trends?.trim() || null
  ).run();

  // 2. Synchronize theme_symbol_mappings if symbols parameter was provided
  let linkedSymbols: string[] | undefined = undefined;
  if (symbols !== undefined) {
    const uniqueSymbols = Array.from(
      new Set(
        symbols
          .map((s) => (typeof s === "string" ? s.trim().toUpperCase() : ""))
          .filter(Boolean)
      )
    );
    linkedSymbols = uniqueSymbols;

    const batchStatements: any[] = [];
    batchStatements.push(
      env.DB.prepare("DELETE FROM theme_symbol_mappings WHERE notebook_id = ?").bind(notebook_id)
    );

    for (const sym of uniqueSymbols) {
      batchStatements.push(
        env.DB.prepare(
          "INSERT OR REPLACE INTO theme_symbol_mappings (notebook_id, symbol, created_at) VALUES (?, ?, datetime('now'))"
        ).bind(notebook_id, sym)
      );
    }

    await env.DB.batch(batchStatements);
  }

  return {
    success: true,
    notebook_id,
    theme_name,
    ...(linkedSymbols !== undefined ? { linked_symbols: linkedSymbols } : {}),
  };
}

/**
 * MCP Tool Handler: get_fundamental_brief
 * Case-insensitive retrieval of qualitative fundamental profile and joined theme sector contexts.
 */
export async function getFundamentalBrief(
  env: any,
  symbolOrArgs: string | { symbol?: string }
) {
  let rawSymbol: string | undefined;
  if (typeof symbolOrArgs === "string") {
    rawSymbol = symbolOrArgs;
  } else if (symbolOrArgs && typeof symbolOrArgs === "object") {
    rawSymbol = symbolOrArgs.symbol;
  }

  if (!rawSymbol || typeof rawSymbol !== "string" || !rawSymbol.trim()) {
    return { fundamental: null, themes: [] };
  }

  const symbolUpper = rawSymbol.trim().toUpperCase();

  const [fundamentalRow, themeRows] = await Promise.all([
    env.DB.prepare(`
      SELECT 
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
      FROM stock_fundamentals
      WHERE symbol = ?
    `).bind(symbolUpper).first(),

    env.DB.prepare(`
      SELECT 
        t.notebook_id,
        t.theme_name,
        t.industry_dynamics,
        t.supply_chain_bottlenecks,
        t.competitive_landscape,
        t.macro_trends,
        t.updated_at
      FROM theme_sector_contexts t
      INNER JOIN theme_symbol_mappings m ON t.notebook_id = m.notebook_id
      WHERE m.symbol = ?
      ORDER BY t.updated_at DESC
    `).bind(symbolUpper).all(),
  ]);

  const fundamental = fundamentalRow
    ? {
        symbol: fundamentalRow.symbol,
        business_model: fundamentalRow.business_model || "",
        moat: fundamentalRow.moat || "",
        competitors: safeJsonParse<string[]>(fundamentalRow.competitors, []),
        guidance: safeJsonParse<any>(fundamentalRow.guidance, null),
        key_risks: safeJsonParse<string[]>(fundamentalRow.key_risks, []),
        thesis_kpis: safeJsonParse<string[]>(fundamentalRow.thesis_kpis, []),
        as_of_date: fundamentalRow.as_of_date,
        notebook_id: fundamentalRow.notebook_id ?? null,
        source_count: Number(fundamentalRow.source_count ?? 1),
        updated_at: fundamentalRow.updated_at ?? null,
      }
    : null;

  const themes = (themeRows?.results || []).map((row: any) => ({
    notebook_id: row.notebook_id,
    theme_name: row.theme_name,
    industry_dynamics: row.industry_dynamics || "",
    supply_chain_bottlenecks: row.supply_chain_bottlenecks || null,
    competitive_landscape: row.competitive_landscape || null,
    macro_trends: row.macro_trends || null,
    updated_at: row.updated_at || null,
    symbols: [symbolUpper],
  }));

  return {
    symbol: symbolUpper,
    fundamental,
    themes,
  };
}
