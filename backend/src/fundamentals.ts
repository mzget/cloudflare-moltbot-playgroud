/**
 * fundamentals.ts — TypeScript Interfaces and Serialization Helpers
 * for Fundamental Intelligence Subsystem (ADR 0010)
 */

/**
 * Qualitative management guidance targets and operational assumptions.
 * Stored as a JSON object in stock_fundamentals.guidance.
 */
export interface GuidanceInfo {
  /** Target revenue growth or range (e.g. "20-25% YoY", "$1.2B - $1.3B in FY27") */
  revenue_target?: string;
  /** Gross or operating margin target (e.g. "75-80% gross margin", "40% operating margin") */
  margin_target?: string;
  /** Guidance horizon or fiscal period (e.g. "FY27", "Next 3-5 Years", "Q2 FY27") */
  timeframe?: string;
  /** Strategic operational assumptions (e.g. "ARMv9 royalty rate doubling, hyperscaler adoption") */
  key_assumptions?: string;
  /** Near-term outlook summary (ADR 0010 compatibility) */
  near_term?: string;
  /** Long-term strategic targets (ADR 0010 compatibility) */
  long_term?: string;
  /** Forward compatibility for additional notebook-extracted fields */
  [key: string]: unknown;
}

/**
 * Raw SQLite row representation in Cloudflare D1 table `stock_fundamentals`.
 * Complex fields are stored as JSON TEXT strings.
 */
export interface StockFundamentalDbRow {
  symbol: string;
  business_model: string | null;
  moat: string | null;
  competitors: string | null; // JSON string: string[]
  guidance: string | null;    // JSON string: GuidanceInfo
  key_risks: string | null;   // JSON string: string[]
  thesis_kpis: string | null; // JSON string: string[]
  debate_json?: string | null; // JSON string: DialecticalDebateResult
  as_of_date: string;
  notebook_id: string | null;
  source_count: number | null;
  updated_at?: string;
}

/**
 * Domain model for a single-stock qualitative fundamental profile.
 */
export interface StockFundamental {
  /** Stock ticker symbol in uppercase (e.g. "ARM", "NVDA") */
  symbol: string;
  /** Comprehensive breakdown of business model, monetization engines, and unit economics */
  business_model?: string | null;
  /** Structural economic moat mechanisms (e.g. high switching costs, IP architecture lock-in) */
  moat?: string | null;
  /** Key direct and architecture competitors (e.g. ["x86", "RISC-V", "Qualcomm"]) */
  competitors?: string[] | string | null;
  /** Parsed forward management guidance targets and assumptions */
  guidance?: GuidanceInfo | string | null;
  /** Top structural, thesis, and operational risks */
  key_risks?: string[] | string | null;
  /** 3-5 quantifiable KPIs to track thesis progress */
  thesis_kpis?: string[] | string | null;
  /** Stored Bull vs. Bear Dialectical Debate from Gemini Notebook */
  debate?: any | null;
  /** Freshness date derived from newest filing/source timestamp (ISO YYYY-MM-DD) */
  as_of_date: string;
  /** UUID of the source Google Gemini Notebook */
  notebook_id?: string | null;
  /** Total number of primary documents ingested in the notebook */
  source_count?: number | null;
  /** Last update timestamp in SQLite format or ISO string */
  updated_at?: string | null;
}

/**
 * Arguments accepted by MCP tool `save_fundamental_brief`.
 */
export interface SaveFundamentalBriefInput {
  symbol: string;
  business_model?: string;
  moat?: string;
  competitors?: string[];
  guidance?: GuidanceInfo;
  key_risks?: string[];
  thesis_kpis?: string[];
  as_of_date: string;
  notebook_id?: string;
  source_count?: number;
}

/**
 * Industry-level qualitative context extracted from Theme Notebooks.
 * Stored in D1 table `theme_sector_contexts`.
 */
export interface ThemeSectorContext {
  /** Google Gemini Notebook UUID (Primary Key) */
  notebook_id: string;
  /** Human-readable theme title (e.g. "SemiAnalysis & Advanced Packaging") */
  theme_name: string;
  /** Synthesis of industry structure, adoption lifecycles, and secular tailwinds */
  industry_dynamics: string;
  /** Supply chain constraints (e.g. CoWoS packaging, HBM allocation, power availability) */
  supply_chain_bottlenecks?: string | null;
  /** Relative positioning and margin capture across the value chain */
  competitive_landscape?: string | null;
  /** Geopolitical, monetary, or macroeconomic tailwinds/headwinds */
  macro_trends?: string | null;
  /** Record update timestamp */
  updated_at?: string;
  /** Ticker symbols linked to this theme (populated on joins or ingestion) */
  symbols?: string[];
}

/**
 * Arguments accepted by MCP tool `save_theme_sector_context`.
 */
export interface SaveThemeSectorContextInput {
  notebook_id: string;
  theme_name: string;
  industry_dynamics?: string;
  supply_chain_bottlenecks?: string;
  competitive_landscape?: string;
  macro_trends?: string;
  symbols?: string[];
}

/**
 * Relational join record linking a stock symbol to a theme notebook.
 * Stored in D1 table `theme_symbol_mappings`.
 */
export interface ThemeSymbolMapping {
  /** Google Gemini Notebook UUID */
  notebook_id: string;
  /** Stock ticker symbol in uppercase (e.g. "ARM") */
  symbol: string;
  /** Record creation timestamp */
  created_at?: string;
}

/**
 * 90-day aging status classification:
 * - 'active': as_of_date < 90 days old
 * - 'stale': as_of_date >= 90 days old
 * - 'missing': no fundamental brief exists or invalid date
 */
export type FundamentalFreshnessStatus = 'active' | 'stale' | 'missing';

/**
 * Observability item representing status of a ticker's fundamental research.
 */
export interface FundamentalStatusItem {
  /** Stock ticker symbol (e.g. "ARM") */
  symbol: string;
  /** Company name from watchlist table (e.g. "Arm Holdings plc") */
  company_name: string;
  /** Filing freshness date (YYYY-MM-DD) or null if missing */
  as_of_date: string | null;
  /** Freshness category badge */
  status: FundamentalFreshnessStatus;
  /** Ingested document count */
  source_count: number;
  /** List of linked theme names (e.g. ["SemiAnalysis", "AI Datacenter"]) */
  theme_tags: string[];
  /** When brief was last refreshed */
  updated_at: string | null;
}

/**
 * API response structure for GET /api/fundamentals/status
 */
export interface FundamentalStatusResponse {
  items: FundamentalStatusItem[];
  summary?: {
    total: number;
    active: number;
    stale: number;
    missing: number;
  };
}

/**
 * Safely parse a JSON string from D1, returning fallback on null/empty/invalid syntax.
 */
export function safeJsonParse<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }
  if (typeof value === 'object') {
    return value as T;
  }
  if (typeof value !== 'string') {
    return fallback;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

/**
 * Safely stringify a value for D1 TEXT storage.
 * Handles undefined/null, functions, symbols, and guards against double-stringification.
 * Always returns string | null (never returns undefined at runtime).
 */
export function safeJsonStringify(value: unknown): string | null {
  if (value === null || value === undefined || typeof value === 'function' || typeof value === 'symbol') {
    return null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    // Check if it's already a valid JSON stringified representation of an object or array
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        JSON.parse(trimmed);
        return trimmed;
      } catch {
        // Fall through if not valid JSON
      }
    }
    return JSON.stringify(trimmed);
  }
  try {
    return JSON.stringify(value) ?? null;
  } catch {
    return null;
  }
}

/**
 * Deserializes a D1 stock_fundamentals row into a typed StockFundamental domain model.
 */
export function deserializeStockFundamental(row: StockFundamentalDbRow): StockFundamental {
  return {
    symbol: row.symbol.toUpperCase(),
    business_model: row.business_model || '',
    moat: row.moat || '',
    competitors: safeJsonParse<string[]>(row.competitors, []),
    guidance: safeJsonParse<GuidanceInfo | null>(row.guidance, null),
    key_risks: safeJsonParse<string[]>(row.key_risks, []),
    thesis_kpis: safeJsonParse<string[]>(row.thesis_kpis, []),
    debate: safeJsonParse<any | null>(row.debate_json, null),
    as_of_date: row.as_of_date,
    notebook_id: row.notebook_id ?? null,
    source_count: Number(row.source_count ?? 1),
    updated_at: row.updated_at ?? null
  };
}

/**
 * Serializes a SaveFundamentalBriefInput object into parameter bindings for D1 INSERT/UPDATE.
 */
export function serializeStockFundamental(input: SaveFundamentalBriefInput): {
  symbol: string;
  business_model: string | null;
  moat: string | null;
  competitors: string | null;
  guidance: string | null;
  key_risks: string | null;
  thesis_kpis: string | null;
  as_of_date: string;
  notebook_id: string | null;
  source_count: number;
} {
  return {
    symbol: input.symbol.trim().toUpperCase(),
    business_model: input.business_model?.trim() || null,
    moat: input.moat?.trim() || null,
    competitors: input.competitors && input.competitors.length > 0 ? JSON.stringify(input.competitors) : null,
    guidance: input.guidance ? JSON.stringify(input.guidance) : null,
    key_risks: input.key_risks && input.key_risks.length > 0 ? JSON.stringify(input.key_risks) : null,
    thesis_kpis: input.thesis_kpis && input.thesis_kpis.length > 0 ? JSON.stringify(input.thesis_kpis) : null,
    as_of_date: input.as_of_date.trim(),
    notebook_id: input.notebook_id?.trim() || null,
    source_count: typeof input.source_count === 'number' && !isNaN(input.source_count) ? input.source_count : 1
  };
}

/**
 * Evaluates the 90-day aging rule for fundamental intelligence freshness.
 * - 'active' if now - as_of_date < 90 days
 * - 'stale' if now - as_of_date >= 90 days
 * - 'missing' if null, undefined, empty, or unparseable date
 */
export function computeFreshnessStatus(
  asOfDate: string | null | undefined,
  now: Date = new Date()
): FundamentalFreshnessStatus {
  if (!asOfDate || typeof asOfDate !== 'string' || !asOfDate.trim()) {
    return 'missing';
  }
  const parsedTime = Date.parse(asOfDate.trim());
  if (isNaN(parsedTime)) {
    return 'missing';
  }
  const diffDays = (now.getTime() - parsedTime) / (1000 * 60 * 60 * 24);
  return diffDays < 90 ? 'active' : 'stale';
}
