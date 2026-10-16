import { Hono } from 'hono';
import type { AppEnv } from '../env';
import {
  computeFreshnessStatus,
  deserializeStockFundamental,
  type StockFundamentalDbRow,
  type ThemeSectorContext,
  type FundamentalStatusItem,
  type FundamentalStatusResponse
} from '../fundamentals';

const fundamentals = new Hono<AppEnv>();

// GET /api/fundamentals/status
fundamentals.get('/api/fundamentals/status', async (c) => {
  try {
    const asOfQuery = c.req.query('as_of');
    const refDate = asOfQuery && !isNaN(Date.parse(asOfQuery)) ? new Date(asOfQuery) : new Date();

    const [watchlistRes, themesRes] = await Promise.all([
      c.env.DB.prepare(`
        SELECT 
          w.symbol, 
          w.name as company_name, 
          sf.as_of_date, 
          sf.source_count, 
          sf.updated_at
        FROM watchlist w
        LEFT JOIN stock_fundamentals sf ON UPPER(w.symbol) = UPPER(sf.symbol)
        ORDER BY w.symbol ASC
      `).all(),

      c.env.DB.prepare(`
        SELECT DISTINCT
          tsm.symbol, 
          tsc.theme_name
        FROM theme_symbol_mappings tsm
        JOIN theme_sector_contexts tsc ON tsm.notebook_id = tsc.notebook_id
      `).all()
    ]);

    const themeMap = new Map<string, Set<string>>();
    for (const row of ((themesRes?.results || []) as any[])) {
      const sym = (row.symbol || '').trim().toUpperCase();
      const themeName = typeof row.theme_name === 'string' ? row.theme_name.trim() : '';
      if (!sym || !themeName) continue;
      if (!themeMap.has(sym)) {
        themeMap.set(sym, new Set());
      }
      themeMap.get(sym)!.add(themeName);
    }

    let activeCount = 0;
    let staleCount = 0;
    let missingCount = 0;

    const items: FundamentalStatusItem[] = (((watchlistRes?.results || []) as any[])).map((row) => {
      const symUpper = (row.symbol || '').toUpperCase();
      const status = computeFreshnessStatus(row.as_of_date, refDate);
      if (status === 'active') activeCount++;
      else if (status === 'stale') staleCount++;
      else missingCount++;

      return {
        symbol: symUpper,
        company_name: row.company_name || symUpper,
        as_of_date: row.as_of_date || null,
        status,
        source_count: row.source_count !== null && row.source_count !== undefined ? Number(row.source_count) : 0,
        theme_tags: Array.from(themeMap.get(symUpper) || []),
        updated_at: row.updated_at || null
      };
    });

    return c.json<FundamentalStatusResponse>({
      items,
      summary: {
        total: items.length,
        active: activeCount,
        stale: staleCount,
        missing: missingCount
      }
    });
  } catch (err: any) {
    console.error('[FundamentalsRoute] Failed to fetch fundamentals status:', err);
    return c.json({ error: err?.message || 'Failed to fetch fundamentals status' }, 500);
  }
});

// GET /api/fundamentals?symbol=XYZ
fundamentals.get('/api/fundamentals', async (c) => {
  const symbol = c.req.query('symbol');
  if (!symbol || !symbol.trim()) {
    return c.json({ error: 'symbol query parameter is required' }, 400);
  }

  const symbolUpper = symbol.trim().toUpperCase();

  try {
    const fundamentalStmt = c.env.DB.prepare(
      'SELECT * FROM stock_fundamentals WHERE symbol = ?'
    ).bind(symbolUpper);

    const fundamentalPromise = typeof fundamentalStmt.first === 'function'
      ? fundamentalStmt.first<StockFundamentalDbRow>()
      : (typeof (fundamentalStmt as any).all === 'function'
          ? (fundamentalStmt as any).all().then((r: any) => r?.results?.[0] ?? null)
          : Promise.resolve(null));

    const [fundamentalRow, themeRows] = await Promise.all([
      fundamentalPromise,
      c.env.DB.prepare(`
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
      `).bind(symbolUpper).all<any>()
    ]);

    if (!fundamentalRow) {
      return c.json({
        error: `Fundamental brief not found for ${symbolUpper}`,
        symbol: symbolUpper,
        fundamental: null,
        themes: []
      }, 404);
    }

    const fundamental = deserializeStockFundamental(fundamentalRow);
    const seenThemeNames = new Set<string>();
    const themes: ThemeSectorContext[] = [];
    for (const t of ((themeRows?.results || []) as any[])) {
      const themeKey = (t.theme_name || '').trim().toLowerCase();
      if (!themeKey || seenThemeNames.has(themeKey)) {
        continue;
      }
      seenThemeNames.add(themeKey);
      themes.push({
        notebook_id: t.notebook_id,
        theme_name: typeof t.theme_name === 'string' ? t.theme_name.trim() : t.theme_name,
        industry_dynamics: t.industry_dynamics || '',
        supply_chain_bottlenecks: t.supply_chain_bottlenecks || null,
        competitive_landscape: t.competitive_landscape || null,
        macro_trends: t.macro_trends || null,
        updated_at: t.updated_at || null,
        symbols: [symbolUpper]
      });
    }

    return c.json({
      symbol: symbolUpper,
      fundamental,
      themes
    });
  } catch (err: any) {
    console.error(`[FundamentalsRoute] Failed to fetch fundamental brief for ${symbolUpper}:`, err);
    return c.json({ error: err?.message || 'Failed to fetch fundamental brief' }, 500);
  }
});

export default fundamentals;
