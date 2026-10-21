import { z } from "zod";

// ============================================================================
// 1. Zod Schemas for MCP Ingestion Tools
// ============================================================================

export const guidanceSchema = z.object({
  revenue_target: z.string().optional(),
  margin_target: z.string().optional(),
  timeframe: z.string().optional(),
  key_assumptions: z.string().optional(),
});

export const saveFundamentalBriefSchema = z.object({
  symbol: z
    .string()
    .min(1, "Symbol is required")
    .transform((s) => s.trim().toUpperCase()),
  business_model: z.string().optional(),
  moat: z.string().optional(),
  competitors: z.array(z.string()).optional(),
  guidance: guidanceSchema.optional(),
  key_risks: z.array(z.string()).optional(),
  thesis_kpis: z.array(z.string()).optional(),
  as_of_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "as_of_date must be in YYYY-MM-DD format"),
  notebook_id: z.string().optional(),
  source_count: z.number().int().min(0).optional().default(1),
});

export type SaveFundamentalBriefInput = z.infer<typeof saveFundamentalBriefSchema>;

export const saveThemeSectorContextSchema = z.object({
  notebook_id: z.string().min(1, "notebook_id is required"),
  theme_name: z.string().min(1, "theme_name is required"),
  industry_dynamics: z.string().optional(),
  supply_chain_bottlenecks: z.string().optional(),
  competitive_landscape: z.string().optional(),
  macro_trends: z.string().optional(),
  symbols: z
    .array(z.string())
    .optional()
    .transform((arr) =>
      arr ? Array.from(new Set(arr.map((s) => s.trim().toUpperCase()))) : []
    ),
});

export type SaveThemeSectorContextInput = z.infer<typeof saveThemeSectorContextSchema>;

export const getFundamentalBriefSchema = z.object({
  symbol: z
    .string()
    .min(1, "Symbol is required")
    .transform((s) => s.trim().toUpperCase()),
});

export type GetFundamentalBriefInput = z.infer<typeof getFundamentalBriefSchema>;

// ============================================================================
// 2. Data Models & Entities
// ============================================================================

export interface StockFundamentalRecord {
  symbol: string;
  business_model: string | null;
  moat: string | null;
  competitors: string | null; // JSON string
  guidance: string | null;    // JSON string
  key_risks: string | null;   // JSON string
  thesis_kpis: string | null; // JSON string
  as_of_date: string;
  notebook_id: string | null;
  source_count: number;
  updated_at: string;
}

export interface ThemeSectorContextRecord {
  notebook_id: string;
  theme_name: string;
  industry_dynamics: string | null;
  supply_chain_bottlenecks: string | null;
  competitive_landscape: string | null;
  macro_trends: string | null;
  updated_at: string;
}

export interface ThemeSymbolMappingRecord {
  notebook_id: string;
  symbol: string;
  created_at: string;
}

export interface QualitativeDebateData {
  fundamental: {
    symbol: string;
    business_model?: string | null;
    moat?: string | null;
    competitors?: string[];
    guidance?: {
      revenue_target?: string;
      margin_target?: string;
      timeframe?: string;
      key_assumptions?: string;
    };
    key_risks?: string[];
    thesis_kpis?: string[];
    as_of_date: string;
    notebook_id?: string | null;
    source_count?: number;
    updated_at?: string;
  } | null;
  themes: Array<{
    notebook_id: string;
    theme_name: string;
    industry_dynamics?: string | null;
    supply_chain_bottlenecks?: string | null;
    competitive_landscape?: string | null;
    macro_trends?: string | null;
    updated_at?: string;
  }>;
}

// ============================================================================
// 3. OKF Markdown Serialization & Parser
// ============================================================================

export function serializeToOkfMarkdown(data: {
  symbol: string;
  as_of_date: string;
  notebook_id?: string | null;
  source_count?: number;
  business_model?: string | null;
  moat?: string | null;
  guidance?: {
    revenue_target?: string;
    margin_target?: string;
    timeframe?: string;
    key_assumptions?: string;
  } | null;
  competitors?: string[] | null;
  key_risks?: string[] | null;
  thesis_kpis?: string[] | null;
  updated_at?: string;
}): string {
  const lines: string[] = [
    "---",
    `symbol: ${data.symbol}`,
    `title: Fundamental Brief - ${data.symbol}`,
    `as_of_date: ${data.as_of_date}`,
    `notebook_id: ${data.notebook_id || "none"}`,
    `source_count: ${data.source_count ?? 1}`,
    `type: fundamental_brief`,
    `updated_at: ${data.updated_at || new Date().toISOString()}`,
    "---",
    "",
    `# Fundamental Brief: ${data.symbol}`,
    "",
    "## Business Model",
    data.business_model || "Not specified.",
    "",
    "## Economic Moat",
    data.moat || "Not specified.",
    ""
  ];

  if (data.guidance) {
    lines.push("## Guidance Targets");
    if (data.guidance.revenue_target) lines.push(`- Revenue Target: ${data.guidance.revenue_target}`);
    if (data.guidance.margin_target) lines.push(`- Margin Target: ${data.guidance.margin_target}`);
    if (data.guidance.timeframe) lines.push(`- Timeframe: ${data.guidance.timeframe}`);
    if (data.guidance.key_assumptions) lines.push(`- Key Assumptions: ${data.guidance.key_assumptions}`);
    lines.push("");
  }

  if (data.competitors && data.competitors.length > 0) {
    lines.push("## Key Competitors");
    data.competitors.forEach((c) => lines.push(`- ${c}`));
    lines.push("");
  }

  if (data.key_risks && data.key_risks.length > 0) {
    lines.push("## Key Risks");
    data.key_risks.forEach((r) => lines.push(`- ${r}`));
    lines.push("");
  }

  if (data.thesis_kpis && data.thesis_kpis.length > 0) {
    lines.push("## Thesis KPIs");
    data.thesis_kpis.forEach((k) => lines.push(`- ${k}`));
    lines.push("");
  }

  return lines.join("\r\n");
}

export function parseOkfMarkdown(content: string) {
  const frontmatterMatch = content.match(/^---\r?\r\n([\s\S]*?)\r?\r\n---\r?\r\n([\s\S]*)$/);
  if (!frontmatterMatch) {
    return { frontmatter: {}, body: content };
  }
  const fmLines = frontmatterMatch[1].split("\r\n");
  const frontmatter: Record<string, string> = {};
  for (const line of fmLines) {
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      const val = line.slice(colonIdx + 1).trim();
      frontmatter[key] = val;
    }
  }
  return { frontmatter, body: frontmatterMatch[2] };
}

// ============================================================================
// 4. In-Memory D1 Mock Database Harness with Constraints & Cascade Deletes
// ============================================================================

export class InMemoryD1Database {
  stockFundamentals = new Map<string, StockFundamentalRecord>();
  themeSectorContexts = new Map<string, ThemeSectorContextRecord>();
  themeSymbolMappings: ThemeSymbolMappingRecord[] = [];
  holdings: Array<{
    symbol: string;
    shares: number;
    avg_cost?: number;
    total_cost?: number;
    status: string;
  }> = [];
  watchlist: Array<{
    symbol: string;
    name?: string;
    sector_label?: string;
  }> = [];
  marketStats: Array<{
    symbol: string;
    price?: number;
    previous_close?: number;
  }> = [];
  dcfCalculations: Array<{
    symbol: string;
    scenario_name?: string;
    implied_share_price?: number;
  }> = [];

  indices = {
    idx_stock_fundamentals_as_of_date: true,
    idx_theme_symbol_mappings_symbol: true,
  };

  prepare(sql: string) {
    return new PreparedStatement(this, sql);
  }

  async batch(statements: PreparedStatement[]) {
    const results = [];
    for (const stmt of statements) {
      results.push(await stmt.run());
    }
    return results;
  }
}

class PreparedStatement {
  private boundArgs: unknown[] = [];

  constructor(
    private db: InMemoryD1Database,
    public readonly sql: string
  ) {}

  bind(...args: unknown[]) {
    this.boundArgs = args;
    return this;
  }

  async run() {
    const trimmed = this.sql.trim();

    // 1. Insert or Replace into stock_fundamentals
    if (/INSERT\s+OR\s+REPLACE\s+INTO\s+stock_fundamentals/is.test(trimmed) || /UPSERT/is.test(trimmed)) {
      const colMatch = trimmed.match(/stock_fundamentals\s*\(([^)]+)\)/i);
      const record: StockFundamentalRecord = {
        symbol: "",
        business_model: null,
        moat: null,
        competitors: null,
        guidance: null,
        key_risks: null,
        thesis_kpis: null,
        as_of_date: "",
        notebook_id: null,
        source_count: 1,
        updated_at: new Date().toISOString(),
      };

      if (colMatch) {
        const cols = colMatch[1].split(",").map((c) => c.trim().toLowerCase());
        cols.forEach((col, idx) => {
          (record as any)[col] = this.boundArgs[idx] ?? null;
        });
      } else {
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
          source_count
        ] = this.boundArgs as any[];

        record.symbol = symbol;
        record.business_model = business_model ?? null;
        record.moat = moat ?? null;
        record.competitors = competitors ?? null;
        record.guidance = guidance ?? null;
        record.key_risks = key_risks ?? null;
        record.thesis_kpis = thesis_kpis ?? null;
        record.as_of_date = as_of_date;
        record.notebook_id = notebook_id ?? null;
        record.source_count = source_count ?? 1;
      }

      if (record.source_count === null || record.source_count === undefined) {
        record.source_count = 1;
      }

      this.db.stockFundamentals.set(record.symbol.toUpperCase(), record);
      return { success: true, meta: { changes: 1 } };
    }

    // Strict INSERT into stock_fundamentals (tests PK uniqueness)
    if (/^INSERT\s+INTO\s+stock_fundamentals/i.test(trimmed)) {
      const [symbol] = this.boundArgs as any[];
      if (this.db.stockFundamentals.has(symbol)) {
        throw new Error(`UNIQUE constraint failed: stock_fundamentals.symbol`);
      }
      return this.runUpsertStockFundamentals();
    }

    // 2. Insert or Replace into theme_sector_contexts
    if (/INSERT\s+OR\s+REPLACE\s+INTO\s+theme_sector_contexts/i.test(trimmed)) {
      const [
        notebook_id,
        theme_name,
        industry_dynamics,
        supply_chain_bottlenecks,
        competitive_landscape,
        macro_trends
      ] = this.boundArgs as any[];

      const record: ThemeSectorContextRecord = {
        notebook_id,
        theme_name,
        industry_dynamics: industry_dynamics ?? null,
        supply_chain_bottlenecks: supply_chain_bottlenecks ?? null,
        competitive_landscape: competitive_landscape ?? null,
        macro_trends: macro_trends ?? null,
        updated_at: new Date().toISOString(),
      };
      this.db.themeSectorContexts.set(notebook_id, record);
      return { success: true, meta: { changes: 1 } };
    }

    // 3. Delete from theme_symbol_mappings where notebook_id = ?
    if (/DELETE\s+FROM\s+theme_symbol_mappings\s+WHERE\s+notebook_id\s*=\s*\?/i.test(trimmed)) {
      const [notebook_id] = this.boundArgs as [string];
      const initial = this.db.themeSymbolMappings.length;
      this.db.themeSymbolMappings = this.db.themeSymbolMappings.filter(
        (m) => m.notebook_id !== notebook_id
      );
      return { success: true, meta: { changes: initial - this.db.themeSymbolMappings.length } };
    }

    // 4. Delete from theme_sector_contexts where notebook_id = ? (with CASCADE)
    if (/DELETE\s+FROM\s+theme_sector_contexts\s+WHERE\s+notebook_id\s*=\s*\?/i.test(trimmed)) {
      const [notebook_id] = this.boundArgs as [string];
      const deleted = this.db.themeSectorContexts.delete(notebook_id);
      // CASCADE delete
      this.db.themeSymbolMappings = this.db.themeSymbolMappings.filter(
        (m) => m.notebook_id !== notebook_id
      );
      return { success: true, meta: { changes: deleted ? 1 : 0 } };
    }

    // 4b. Delete from theme_symbol_mappings where notebook_id IN (SELECT notebook_id FROM theme_sector_contexts...)
    if (/DELETE\s+FROM\s+theme_symbol_mappings[\s\S]*WHERE\s+notebook_id\s+IN/i.test(trimmed)) {
      const [themeName] = this.boundArgs as [string];
      const targetName = (themeName || '').trim().toLowerCase();
      const targetNbIds = new Set<string>();
      for (const [nbId, rec] of this.db.themeSectorContexts.entries()) {
        if ((rec.theme_name || '').trim().toLowerCase() === targetName) {
          targetNbIds.add(nbId);
        }
      }
      const initial = this.db.themeSymbolMappings.length;
      this.db.themeSymbolMappings = this.db.themeSymbolMappings.filter(m => !targetNbIds.has(m.notebook_id));
      return { success: true, meta: { changes: initial - this.db.themeSymbolMappings.length } };
    }

    // 4c. Delete from theme_sector_contexts where LOWER(TRIM(theme_name)) = LOWER(TRIM(?))
    if (/DELETE\s+FROM\s+theme_sector_contexts[\s\S]*WHERE[\s\S]*theme_name/i.test(trimmed)) {
      const [themeName] = this.boundArgs as [string];
      const targetName = (themeName || '').trim().toLowerCase();
      let deletedCount = 0;
      for (const [nbId, rec] of Array.from(this.db.themeSectorContexts.entries())) {
        if ((rec.theme_name || '').trim().toLowerCase() === targetName) {
          this.db.themeSectorContexts.delete(nbId);
          this.db.themeSymbolMappings = this.db.themeSymbolMappings.filter(m => m.notebook_id !== nbId);
          deletedCount++;
        }
      }
      return { success: true, meta: { changes: deletedCount } };
    }

    // 4d. Update theme_sector_contexts SET theme_name = ? WHERE LOWER(TRIM(theme_name)) = LOWER(TRIM(?))
    if (/UPDATE\s+theme_sector_contexts[\s\S]*SET\s+theme_name\s*=\s*\?/i.test(trimmed)) {
      const [newThemeName, oldThemeName] = this.boundArgs as [string, string];
      const targetName = (oldThemeName || '').trim().toLowerCase();
      let updatedCount = 0;
      for (const [nbId, rec] of Array.from(this.db.themeSectorContexts.entries())) {
        if ((rec.theme_name || '').trim().toLowerCase() === targetName) {
          this.db.themeSectorContexts.set(nbId, {
            ...rec,
            theme_name: (newThemeName || '').trim(),
            updated_at: new Date().toISOString(),
          });
          updatedCount++;
        }
      }
      return { success: true, meta: { changes: updatedCount } };
    }

    // 5. Insert into theme_symbol_mappings
    if (/INSERT\s+INTO\s+theme_symbol_mappings/i.test(trimmed)) {
      const [notebook_id, symbol] = this.boundArgs as [string, string];
      // Enforce foreign key
      if (!this.db.themeSectorContexts.has(notebook_id)) {
        throw new Error(`FOREIGN KEY constraint failed: theme_symbol_mappings.notebook_id`);
      }
      // Enforce composite PK uniqueness
      const exists = this.db.themeSymbolMappings.some(
        (m) => m.notebook_id === notebook_id && m.symbol === symbol
      );
      if (exists) {
        throw new Error(`UNIQUE constraint failed: theme_symbol_mappings.notebook_id, theme_symbol_mappings.symbol`);
      }
      this.db.themeSymbolMappings.push({
        notebook_id,
        symbol,
        created_at: new Date().toISOString(),
      });
      return { success: true, meta: { changes: 1 } };
    }

    // 6. Insert into holdings
    if (/INSERT[\s\S]*INTO\s+holdings/is.test(trimmed)) {
      const [symbol, shares, avg_cost, total_cost, status] = this.boundArgs as any[];
      this.db.holdings.push({
        symbol: (symbol || '').toUpperCase(),
        shares: Number(shares) || 0,
        avg_cost: avg_cost !== undefined ? Number(avg_cost) : undefined,
        total_cost: total_cost !== undefined ? Number(total_cost) : undefined,
        status: status || 'open',
      });
      return { success: true, meta: { changes: 1 } };
    }

    return { success: true, meta: { changes: 0 } };
  }

  private runUpsertStockFundamentals() {
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
      source_count
    ] = this.boundArgs as any[];

    const record: StockFundamentalRecord = {
      symbol,
      business_model: business_model ?? null,
      moat: moat ?? null,
      competitors: competitors ?? null,
      guidance: guidance ?? null,
      key_risks: key_risks ?? null,
      thesis_kpis: thesis_kpis ?? null,
      as_of_date,
      notebook_id: notebook_id ?? null,
      source_count: source_count ?? 1,
      updated_at: new Date().toISOString(),
    };
    this.db.stockFundamentals.set(symbol, record);
    return { success: true, meta: { changes: 1 } };
  }

  async first<T = unknown>(): Promise<T | null> {
    const rows = await this.all<T>();
    return rows.results[0] || null;
  }

  async all<T = unknown>(): Promise<{ results: T[] }> {
    const trimmed = this.sql.trim();

    // Query single stock fundamental
    if (/SELECT[\s\S]*FROM\s+stock_fundamentals[\s\S]*WHERE\s+symbol\s*=\s*\?/is.test(trimmed)) {
      const [symbol] = this.boundArgs as [string];
      const match = this.db.stockFundamentals.get(symbol.toUpperCase());
      return { results: match ? ([match] as unknown as T[]) : [] };
    }

    // Query all theme sector contexts with LEFT JOIN theme_symbol_mappings (for Risk Concentration Audit)
    if (/FROM\s+theme_sector_contexts[\s\S]*LEFT\s+JOIN\s+theme_symbol_mappings/is.test(trimmed)) {
      const results: any[] = [];
      for (const [nbId, context] of this.db.themeSectorContexts.entries()) {
        const mappings = this.db.themeSymbolMappings.filter(m => m.notebook_id === nbId);
        if (mappings.length > 0) {
          for (const m of mappings) {
            results.push({ symbol: m.symbol, notebook_id: nbId, theme_name: context.theme_name });
          }
        } else {
          results.push({ symbol: null, notebook_id: nbId, theme_name: context.theme_name });
        }
      }
      return { results: results as unknown as T[] };
    }

    // Query theme sector contexts joined for symbol
    if (/FROM\s+theme_sector_contexts[\s\S]*JOIN\s+theme_symbol_mappings/is.test(trimmed)) {
      const [symbol] = this.boundArgs as [string];
      const matchingNotebookIds = this.db.themeSymbolMappings
        .filter((m) => m.symbol.toUpperCase() === symbol.toUpperCase())
        .map((m) => m.notebook_id);

      const results = matchingNotebookIds
        .map((id) => this.db.themeSectorContexts.get(id))
        .filter((c): c is ThemeSectorContextRecord => Boolean(c));

      return { results: results as unknown as T[] };
    }

    // Query all stock fundamentals for dashboard status
    if (/SELECT[\s\S]*FROM\s+stock_fundamentals/is.test(trimmed)) {
      const all = Array.from(this.db.stockFundamentals.values());
      return { results: all as unknown as T[] };
    }

    // Query holdings with joins for loadPortfolioRiskData
    if (/FROM\s+holdings[\s\S]*WHERE/is.test(trimmed)) {
      const results = this.db.holdings
        .filter((h) => (h.status || '').toLowerCase() === 'open')
        .map((h) => {
          const w = this.db.watchlist.find((w) => w.symbol.toUpperCase() === h.symbol.toUpperCase());
          const m = this.db.marketStats.find((m) => m.symbol.toUpperCase() === h.symbol.toUpperCase());
          return {
            symbol: h.symbol,
            shares: h.shares,
            avg_cost: h.avg_cost ?? 0,
            total_cost: h.total_cost ?? (h.shares * (h.avg_cost ?? 0)),
            status: h.status,
            name: w?.name ?? h.symbol,
            sector_label: w?.sector_label ?? null,
            last_price: m?.price ?? null,
            previous_close: m?.previous_close ?? null,
          };
        });
      return { results: results as unknown as T[] };
    }

    // Query dcf_calculations
    if (/FROM\s+dcf_calculations/is.test(trimmed)) {
      return { results: this.db.dcfCalculations as unknown as T[] };
    }

    return { results: [] };
  }
}

// ============================================================================
// 5. In-Memory R2 Storage Mock Harness
// ============================================================================

export class InMemoryR2Bucket {
  private store = new Map<string, string>();

  async put(key: string, value: string | ArrayBuffer) {
    const text = typeof value === "string" ? value : new TextDecoder().decode(value);
    this.store.set(key, text);
    return { key, size: text.length };
  }

  async get(key: string) {
    const val = this.store.get(key);
    if (!val) return null;
    return {
      text: async () => val,
      json: async () => JSON.parse(val),
    };
  }

  async list(options: { prefix?: string } = {}) {
    const prefix = options.prefix || "";
    const objects = Array.from(this.store.entries())
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, val]) => ({ key, size: val.length, uploaded: new Date().toISOString() }));
    return { objects };
  }

  async delete(key: string) {
    this.store.delete(key);
  }
}

// ============================================================================
// 6. MCP Fundamental Tools Implementation & Runner
// ============================================================================

export function createFundamentalTools(env: {
  DB: InMemoryD1Database;
  KNOWLEDGE_BUCKET: InMemoryR2Bucket;
}) {
  return {
    save_fundamental_brief: {
      name: "save_fundamental_brief",
      description: "Ingests structured single-stock qualitative research into D1 and persists OKF to R2",
      execute: async (args: unknown) => {
        const parsed = saveFundamentalBriefSchema.parse(args);

        // 1. D1 Upsert
        await env.DB.prepare(
          `INSERT OR REPLACE INTO stock_fundamentals 
           (symbol, business_model, moat, competitors, guidance, key_risks, thesis_kpis, as_of_date, notebook_id, source_count)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
          .bind(
            parsed.symbol,
            parsed.business_model || null,
            parsed.moat || null,
            parsed.competitors ? JSON.stringify(parsed.competitors) : null,
            parsed.guidance ? JSON.stringify(parsed.guidance) : null,
            parsed.key_risks ? JSON.stringify(parsed.key_risks) : null,
            parsed.thesis_kpis ? JSON.stringify(parsed.thesis_kpis) : null,
            parsed.as_of_date,
            parsed.notebook_id || null,
            parsed.source_count ?? 1
          )
          .run();

        // 2. R2 OKF Persistence
        const okf = serializeToOkfMarkdown(parsed);
        const r2Key = `fundamentals/${parsed.symbol}.md`;
        await env.KNOWLEDGE_BUCKET.put(r2Key, okf);

        return {
          content: [
            {
              type: "text",
              text: `Successfully saved fundamental brief for ${parsed.symbol} (as_of_date: ${parsed.as_of_date}) and persisted OKF to ${r2Key}.`
            }
          ]
        };
      }
    },

    save_theme_sector_context: {
      name: "save_theme_sector_context",
      description: "Ingests theme-level macro & sector dynamics and links stock symbols",
      execute: async (args: unknown) => {
        const parsed = saveThemeSectorContextSchema.parse(args);

        // 1. Upsert theme_sector_contexts
        await env.DB.prepare(
          `INSERT OR REPLACE INTO theme_sector_contexts
           (notebook_id, theme_name, industry_dynamics, supply_chain_bottlenecks, competitive_landscape, macro_trends)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
          .bind(
            parsed.notebook_id,
            parsed.theme_name,
            parsed.industry_dynamics || null,
            parsed.supply_chain_bottlenecks || null,
            parsed.competitive_landscape || null,
            parsed.macro_trends || null
          )
          .run();

        // 2. Refresh symbol mappings
        await env.DB.prepare(
          `DELETE FROM theme_symbol_mappings WHERE notebook_id = ?`
        )
          .bind(parsed.notebook_id)
          .run();

        if (parsed.symbols && parsed.symbols.length > 0) {
          for (const sym of parsed.symbols) {
            await env.DB.prepare(
              `INSERT INTO theme_symbol_mappings (notebook_id, symbol) VALUES (?, ?)`
            )
              .bind(parsed.notebook_id, sym)
              .run();
          }
        }

        return {
          content: [
            {
              type: "text",
              text: `Successfully saved theme context '${parsed.theme_name}' (${parsed.notebook_id}) and linked ${parsed.symbols?.length || 0} symbols.`
            }
          ]
        };
      }
    },

    get_fundamental_brief: {
      name: "get_fundamental_brief",
      description: "Retrieves single-stock fundamental profile and joined sector contexts",
      execute: async (args: unknown) => {
        const parsed = getFundamentalBriefSchema.parse(args);

        // 1. Fetch fundamental profile
        const fundRow = await env.DB.prepare(
          `SELECT * FROM stock_fundamentals WHERE symbol = ?`
        )
          .bind(parsed.symbol)
          .first<StockFundamentalRecord>();

        let fundamental = null;
        if (fundRow) {
          fundamental = {
            symbol: fundRow.symbol,
            business_model: fundRow.business_model,
            moat: fundRow.moat,
            competitors: fundRow.competitors ? JSON.parse(fundRow.competitors) : [],
            guidance: fundRow.guidance ? JSON.parse(fundRow.guidance) : null,
            key_risks: fundRow.key_risks ? JSON.parse(fundRow.key_risks) : [],
            thesis_kpis: fundRow.thesis_kpis ? JSON.parse(fundRow.thesis_kpis) : [],
            as_of_date: fundRow.as_of_date,
            notebook_id: fundRow.notebook_id,
            source_count: fundRow.source_count,
            updated_at: fundRow.updated_at
          };
        }

        // 2. Fetch joined themes
        const themeRows = await env.DB.prepare(
          `SELECT c.* FROM theme_sector_contexts c
           JOIN theme_symbol_mappings m ON c.notebook_id = m.notebook_id
           WHERE m.symbol = ?`
        )
          .bind(parsed.symbol)
          .all<ThemeSectorContextRecord>();

        const themes = themeRows.results.map((r) => ({
          notebook_id: r.notebook_id,
          theme_name: r.theme_name,
          industry_dynamics: r.industry_dynamics,
          supply_chain_bottlenecks: r.supply_chain_bottlenecks,
          competitive_landscape: r.competitive_landscape,
          macro_trends: r.macro_trends,
          updated_at: r.updated_at
        }));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ fundamental, themes }, null, 2)
            }
          ]
        };
      }
    }
  };
}

// ============================================================================
// 7. Debate Grounding Context Fusion & Formatter Contract
// ============================================================================

export interface MarketEventItem {
  title: string;
  description?: string | null;
  event_date: string;
  event_type: string;
}

export interface NotebookArticleItem {
  title: string;
  summary?: string | null;
  key_takeaways?: string | null;
}

export async function fetchQualitativeData(
  db: InMemoryD1Database,
  symbol: string
): Promise<QualitativeDebateData> {
  const normSymbol = symbol.trim().toUpperCase();

  const fundRow = await db.prepare(
    `SELECT * FROM stock_fundamentals WHERE symbol = ?`
  )
    .bind(normSymbol)
    .first<StockFundamentalRecord>();

  let fundamental = null;
  if (fundRow) {
    let competitors: string[] = [];
    let guidance = null;
    let key_risks: string[] = [];
    let thesis_kpis: string[] = [];

    try { competitors = fundRow.competitors ? JSON.parse(fundRow.competitors) : []; } catch {}
    try { guidance = fundRow.guidance ? JSON.parse(fundRow.guidance) : null; } catch {}
    try { key_risks = fundRow.key_risks ? JSON.parse(fundRow.key_risks) : []; } catch {}
    try { thesis_kpis = fundRow.thesis_kpis ? JSON.parse(fundRow.thesis_kpis) : []; } catch {}

    fundamental = {
      symbol: fundRow.symbol,
      business_model: fundRow.business_model,
      moat: fundRow.moat,
      competitors,
      guidance,
      key_risks,
      thesis_kpis,
      as_of_date: fundRow.as_of_date,
      notebook_id: fundRow.notebook_id,
      source_count: fundRow.source_count,
      updated_at: fundRow.updated_at
    };
  }

  const themeRows = await db.prepare(
    `SELECT c.* FROM theme_sector_contexts c
     JOIN theme_symbol_mappings m ON c.notebook_id = m.notebook_id
     WHERE m.symbol = ?`
  )
    .bind(normSymbol)
    .all<ThemeSectorContextRecord>();

  const themes = themeRows.results.map((r) => ({
    notebook_id: r.notebook_id,
    theme_name: r.theme_name,
    industry_dynamics: r.industry_dynamics,
    supply_chain_bottlenecks: r.supply_chain_bottlenecks,
    competitive_landscape: r.competitive_landscape,
    macro_trends: r.macro_trends,
    updated_at: r.updated_at
  }));

  return { fundamental, themes };
}

export function formatDebateContext(
  metricsStr: string,
  events: MarketEventItem[] = [],
  articles: NotebookArticleItem[] = [],
  qualitative?: QualitativeDebateData | null
): string {
  const sections: string[] = [
    "### 1. ข้อมูลทางการเงินและตัวชี้วัด (Financial Metrics):",
    metricsStr
  ];

  // Section 2: Company Fundamental Brief
  if (qualitative?.fundamental) {
    const f = qualitative.fundamental;
    const briefLines: string[] = [
      `\r\n### 2. ข้อมูลเชิงคุณภาพและบทวิเคราะห์พื้นฐาน (Company Fundamental Brief) [As of: ${f.as_of_date}]:`,
      `- โมเดลธุรกิจ (Business Model): ${f.business_model || "N/A"}`,
      `- ปราการทางธุรกิจ (Economic Moat): ${f.moat || "N/A"}`
    ];

    if (f.guidance) {
      const g = f.guidance;
      const gParts: string[] = [];
      if (g.revenue_target) gParts.push(`เป้ารายได้: ${g.revenue_target}`);
      if (g.margin_target) gParts.push(`เป้าอัตรากำไร: ${g.margin_target}`);
      if (g.timeframe) gParts.push(`กรอบเวลา: ${g.timeframe}`);
      if (g.key_assumptions) gParts.push(`สมมติฐานหลัก: ${g.key_assumptions}`);
      if (gParts.length > 0) {
        briefLines.push(`- เป้าหมายและการชี้นำของผู้บริหาร (Management Guidance): ${gParts.join(" | ")}`);
      }
    }

    if (f.competitors && f.competitors.length > 0) {
      briefLines.push(`- คู่แข่งสำคัญ (Competitors): ${f.competitors.join(", ")}`);
    }

    if (f.key_risks && f.key_risks.length > 0) {
      briefLines.push(`- ปัจจัยความเสี่ยงสำคัญ (Key Risks): ${f.key_risks.join("; ")}`);
    }

    if (f.thesis_kpis && f.thesis_kpis.length > 0) {
      briefLines.push(`- ตัวชี้วัดวิทยานิพนธ์การลงทุน (Thesis KPIs): ${f.thesis_kpis.join("; ")}`);
    }

    sections.push(briefLines.join("\r\n"));
  }

  // Section 3: Sector & Competitive Dynamics
  if (qualitative?.themes && qualitative.themes.length > 0) {
    const themeLines: string[] = [
      `\r\n### 3. บริบทอุตสาหกรรมและภาพรวมการแข่งขัน (Sector & Competitive Dynamics):`
    ];

    qualitative.themes.forEach((t, idx) => {
      themeLines.push(`${idx + 1}. [ธีม: ${t.theme_name}]`);
      if (t.industry_dynamics) themeLines.push(`   - พลวัตอุตสาหกรรม: ${t.industry_dynamics}`);
      if (t.supply_chain_bottlenecks) themeLines.push(`   - คอขวดห่วงโซ่อุปทาน: ${t.supply_chain_bottlenecks}`);
      if (t.competitive_landscape) themeLines.push(`   - ภูมิทัศน์การแข่งขัน: ${t.competitive_landscape}`);
      if (t.macro_trends) themeLines.push(`   - แนวโน้มมหภาค: ${t.macro_trends}`);
    });

    sections.push(themeLines.join("\r\n"));
  }

  // Section 4: Recent Market Events
  if (events.length > 0) {
    sections.push("\r\n### 4. ข่าวและเหตุการณ์สำคัญล่าสุด (Recent Market Events):");
    events.forEach((ev, idx) => {
      sections.push(`${idx + 1}. [${ev.event_type.toUpperCase()}] ${ev.title} (${ev.event_date})${ev.description ? `: ${ev.description}` : ""}`);
    });
  }

  // Section 5: Research & Notes
  if (articles.length > 0) {
    sections.push("\r\n### 5. บทวิเคราะห์และมุมมองสังเคราะห์ (Research & Notes):");
    articles.forEach((art, idx) => {
      sections.push(`${idx + 1}. หัวข้อ: ${art.title}${art.summary ? `\r\nสรุป: ${art.summary}` : ""}`);
    });
  }

  return sections.join("\r\n");
}

// ============================================================================
// 8. Prompt Grounding Rules & Conviction Label Engine
// ============================================================================

export function getBullOpeningPrompt(symbol: string, contextStr: string) {
  return {
    system: `คุณคือ Bullish Researcher Agent (นักวิเคราะห์ฝั่งกระทิง) ตามแนวทาง TradingAgents ทำหน้าที่สร้างข้อถกเถียงเชิงบวกและโอกาสเติบโต (Long Thesis) ที่แข็งแกร่งและสมเหตุสมผลที่สุดสำหรับหุ้น ${symbol} โดยต้องอ้างอิงและ Grounding ข้อมูลจากตัวเลขการเงิน เป้าหมายการชี้นำของผู้บริหาร (Management Guidance) ความได้เปรียบทางธุรกิจ (Moat) และตัวชี้วัด Thesis KPIs\r\n\r\nคำสั่ง: ห้ามใช้เครื่องหมาย double quote ซ้อนภายในข้อความ และตอบเป็นรูปแบบ JSON เท่านั้น โดยมีโครงสร้างดังนี้:\r\n{\r\n  "bull_thesis": "บทสรุปมุมมองกระทิงและวิทยานิพนธ์การลงทุนเชิงรุก 2-3 ประโยค",\r\n  "growth_catalysts": ["ปัจจัยเร่งการเติบโตข้อ 1 พร้อมตัวเลขสนับสนุน", "ปัจจัยเร่งข้อ 2"],\r\n  "competitive_advantages": ["ความได้เปรียบในการแข่งขันหรือการขยาย Moat ข้อ 1", "ข้อ 2"],\r\n  "valuation_upside": "การประเมินโอกาสที่ราคาจะปรับตัวขึ้นหรือข้อได้เปรียบเชิงมูลค่า"\r\n}`,
    prompt: `ข้อมูลหุ้น ${symbol}:\r\n${contextStr}`
  };
}

export function getBearOpeningPrompt(symbol: string, contextStr: string) {
  return {
    system: `คุณคือ Bearish Researcher Agent (นักวิเคราะห์ฝั่งหมี) ตามแนวทาง TradingAgents ทำหน้าที่ท้าทายและค้นหาจุดอ่อน ความเสี่ยง และ downside scenario (Short/Skeptical Thesis) ที่อันตรายที่สุดสำหรับหุ้น ${symbol} โดยใช้หลัก Inversion Thinking และอ้างอิงตัวเลขจริง ปัจจัยความเสี่ยงเชิงลึก (Key Risks) และอุปสรรคเชิงโครงสร้าง (Structural Headwinds)\r\n\r\nคำสั่ง: ห้ามใช้เครื่องหมาย double quote ซ้อนภายในข้อความ และตอบเป็นรูปแบบ JSON เท่านั้น โดยมีโครงสร้างดังนี้:\r\n{\r\n  "bear_thesis": "บทสรุปมุมมองหมีและวิทยานิพนธ์ความเสี่ยงเชิงลึก 2-3 ประโยค",\r\n  "downside_risks": ["ความเสี่ยงและจุดเปราะบางข้อ 1 พร้อมตัวเลขสนับสนุน", "ความเสี่ยงข้อ 2"],\r\n  "structural_headwinds": ["อุปสรรคเชิงโครงสร้างหรือการแข่งขันที่รุนแรงขึ้นข้อ 1", "ข้อ 2"],\r\n  "valuation_stretch": "การประเมินความตึงตัวของ Valuation หรือโอกาสเกิด Permanent Capital Loss"\r\n}`,
    prompt: `ข้อมูลหุ้น ${symbol}:\r\n${contextStr}`
  };
}

export function calculateConvictionLabel(score: number): string {
  if (score >= 7) return "Strong Bull";
  if (score >= 2) return "Moderate Bull";
  if (score >= -1) return "Neutral";
  if (score >= -6) return "Moderate Bear";
  return "Strong Bear";
}

// ============================================================================
// 9. Frontend Observability Logic & Gemini Extraction Copier Contract
// ============================================================================

export type FreshnessStatus = "active" | "stale" | "missing";

export function calculateFreshnessStatus(
  asOfDateStr: string | null | undefined,
  referenceDate: Date = new Date()
): FreshnessStatus {
  if (!asOfDateStr || !asOfDateStr.trim()) return "missing";
  const filingDate = new Date(asOfDateStr);
  if (isNaN(filingDate.getTime())) return "missing";

  const diffMs = referenceDate.getTime() - filingDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return "active"; // future date or same day
  return diffDays < 90 ? "active" : "stale";
}

export function generateGeminiExtractionPrompt(symbol: string): string {
  const normSymbol = symbol.trim().toUpperCase();
  return [
    `# Fundamental Research Extraction Prompt: ${normSymbol}`,
    "",
    "You are a Senior Equity Research Assistant analyzing the uploaded quarterly reports, earnings transcripts, and thesis slides for this company.",
    "",
    `Please extract the qualitative fundamental profile for **${normSymbol}** and invoke the MCP tool \`save_fundamental_brief\` with the following JSON schema:`,
    "",
    "```json",
    "{",
    `  "symbol": "${normSymbol}",`,
    '  "business_model": "Summarize revenue drivers, customer segment, and monetization mechanism in 2-3 clear sentences.",',
    '  "moat": "Analyze economic moat source (Network Effects, Switching Costs, Cost Advantages, Intangibles/Patents).",',
    '  "competitors": ["Competitor A", "Competitor B"],',
    '  "guidance": {',
    '    "revenue_target": "Stated forward revenue growth or target in $ or %",',
    '    "margin_target": "Stated gross margin or operating margin target",',
    '    "timeframe": "Filing target timeframe (e.g. FY27 or next quarter)",',
    '    "key_assumptions": "Underlying assumptions disclosed by management"',
    "  },",
    '  "key_risks": [',
    '    "Primary strategic or technological risk",',
    '    "Customer concentration, regulatory, or macroeconomic risk"',
    "  ],",
    '  "thesis_kpis": [',
    '    "Specific quantitative KPI tracking thesis success (e.g. ASP, unit adoption %, ARR)",',
    '    "Secondary metric (e.g. churn rate, gross retention %)"',
    "  ],",
    '  "as_of_date": "YYYY-MM-DD (MUST be derived from the filing or earnings release date, e.g. 2026-07-29)"',
    "}",
    "```",
    "",
    "**Strict Requirement**: Derive `as_of_date` strictly from the document publication date. Do NOT invent dates."
  ].join("\r\n");
}

// ============================================================================
// 10. Fundamentals REST API Handlers Contract
// ============================================================================

export interface WatchlistStockItem {
  symbol: string;
  company_name: string;
}

export async function handleGetFundamentalsStatus(
  db: InMemoryD1Database,
  watchlist: WatchlistStockItem[],
  referenceDate: Date = new Date()
) {
  const fundRows = await db.prepare(`SELECT * FROM stock_fundamentals`).all<StockFundamentalRecord>();
  const fundMap = new Map<string, StockFundamentalRecord>();
  for (const row of fundRows.results) {
    fundMap.set(row.symbol.toUpperCase(), row);
  }

  const items = [];
  for (const item of watchlist) {
    const symbol = item.symbol.toUpperCase();
    const fund = fundMap.get(symbol);

    const themeRows = await db.prepare(
      `SELECT c.theme_name FROM theme_sector_contexts c
       JOIN theme_symbol_mappings m ON c.notebook_id = m.notebook_id
       WHERE m.symbol = ?`
    )
      .bind(symbol)
      .all<{ theme_name: string }>();

    const theme_tags = themeRows.results.map((r) => r.theme_name);
    const as_of_date = fund?.as_of_date || null;
    const status = calculateFreshnessStatus(as_of_date, referenceDate);

    items.push({
      symbol,
      company_name: item.company_name,
      as_of_date,
      status,
      source_count: fund?.source_count ?? 0,
      theme_tags,
      updated_at: fund?.updated_at || null
    });
  }

  return { items };
}

export async function handleGetFundamentalBySymbol(
  db: InMemoryD1Database,
  symbol: string
) {
  if (!symbol || !symbol.trim()) {
    return { error: "Symbol parameter is required", status: 400 };
  }

  const normSymbol = symbol.trim().toUpperCase();
  const fundRow = await db.prepare(`SELECT * FROM stock_fundamentals WHERE symbol = ?`)
    .bind(normSymbol)
    .first<StockFundamentalRecord>();

  let fundamental = null;
  if (fundRow) {
    fundamental = {
      symbol: fundRow.symbol,
      business_model: fundRow.business_model,
      moat: fundRow.moat,
      competitors: fundRow.competitors ? JSON.parse(fundRow.competitors) : [],
      guidance: fundRow.guidance ? JSON.parse(fundRow.guidance) : null,
      key_risks: fundRow.key_risks ? JSON.parse(fundRow.key_risks) : [],
      thesis_kpis: fundRow.thesis_kpis ? JSON.parse(fundRow.thesis_kpis) : [],
      as_of_date: fundRow.as_of_date,
      notebook_id: fundRow.notebook_id,
      source_count: fundRow.source_count,
      updated_at: fundRow.updated_at
    };
  }

  const themeRows = await db.prepare(
    `SELECT c.* FROM theme_sector_contexts c
     JOIN theme_symbol_mappings m ON c.notebook_id = m.notebook_id
     WHERE m.symbol = ?`
  )
    .bind(normSymbol)
    .all<ThemeSectorContextRecord>();

  const themes = themeRows.results.map((r) => ({
    notebook_id: r.notebook_id,
    theme_name: r.theme_name,
    industry_dynamics: r.industry_dynamics,
    supply_chain_bottlenecks: r.supply_chain_bottlenecks,
    competitive_landscape: r.competitive_landscape,
    macro_trends: r.macro_trends,
    updated_at: r.updated_at
  }));

  return {
    status: 200,
    data: { fundamental, themes }
  };
}

// ============================================================================
// 11. Portfolio Risk Theme Deletion Contract
// ============================================================================

export async function handleDeleteTheme(
  db: InMemoryD1Database,
  rawThemeName: string
): Promise<{ status: number; error?: string; success?: boolean; deletedTheme?: string }> {
  if (!rawThemeName || !rawThemeName.trim()) {
    return { status: 400, error: 'Theme name is required' };
  }

  const themeName = decodeURIComponent(rawThemeName).trim();
  const deleteMappingsSql = `
    DELETE FROM theme_symbol_mappings
    WHERE notebook_id IN (
      SELECT notebook_id FROM theme_sector_contexts WHERE LOWER(TRIM(theme_name)) = LOWER(TRIM(?))
    )
  `;
  const deleteContextSql = `
    DELETE FROM theme_sector_contexts
    WHERE LOWER(TRIM(theme_name)) = LOWER(TRIM(?))
  `;

  await db.batch([
    db.prepare(deleteMappingsSql).bind(themeName),
    db.prepare(deleteContextSql).bind(themeName),
  ]);

  return { status: 200, success: true, deletedTheme: themeName };
}

export async function handleRenameTheme(
  db: InMemoryD1Database,
  rawOldThemeName: string,
  rawNewThemeName: string
): Promise<{ status: number; error?: string; success?: boolean; oldThemeName?: string; newThemeName?: string }> {
  if (!rawOldThemeName || !rawOldThemeName.trim()) {
    return { status: 400, error: 'Theme name is required' };
  }

  const oldThemeName = decodeURIComponent(rawOldThemeName).trim();
  if (!oldThemeName || oldThemeName.toLowerCase() === 'unassigned') {
    return { status: 400, error: 'Cannot rename Unassigned theme' };
  }

  const newThemeName = (rawNewThemeName || '').trim();
  if (!newThemeName) {
    return { status: 400, error: 'New theme name is required' };
  }

  if (newThemeName.toLowerCase() === 'unassigned') {
    return { status: 400, error: 'Cannot rename theme to reserved name "Unassigned"' };
  }

  const updateContextSql = `
    UPDATE theme_sector_contexts
    SET theme_name = ?, updated_at = datetime('now')
    WHERE LOWER(TRIM(theme_name)) = LOWER(TRIM(?))
  `;

  await db.prepare(updateContextSql).bind(newThemeName, oldThemeName).run();

  return { status: 200, success: true, oldThemeName, newThemeName };
}
