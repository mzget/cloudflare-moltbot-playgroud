import { D1Database } from '@cloudflare/workers-types';

interface PricePoint {
  date: string;
  close: number;
}

// Fetch historical prices from Yahoo Finance and cache them in D1
export async function syncHistoricalPrices(db: D1Database, symbol: string): Promise<void> {
  const encodedSymbol = encodeURIComponent(symbol);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodedSymbol}?interval=1d&range=5y`;

  console.log(`[HistoricalPrices] Syncing ${symbol} from Yahoo Finance...`);

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!res.ok) {
      throw new Error(`Yahoo Finance API returned ${res.status} ${res.statusText}`);
    }

    const data = await res.json() as any;
    const result = data?.chart?.result?.[0];
    if (!result) {
      throw new Error(`Invalid response structure for ${symbol}`);
    }

    const timestamps = result.timestamp || [];
    const closes = result.indicators?.quote?.[0]?.close || [];

    if (timestamps.length === 0) {
      console.log(`[HistoricalPrices] No historical data returned for ${symbol}`);
      return;
    }

    const points: PricePoint[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const timestamp = timestamps[i];
      const close = closes[i];
      if (typeof close === 'number' && !isNaN(close)) {
        // Convert timestamp to YYYY-MM-DD in UTC
        const date = new Date(timestamp * 1000);
        const dateStr = date.toISOString().split('T')[0];
        points.push({ date: dateStr, close });
      }
    }

    if (points.length === 0) {
      console.log(`[HistoricalPrices] No valid closing prices found for ${symbol}`);
      return;
    }

    // Batch insert into D1
    console.log(`[HistoricalPrices] Storing ${points.length} prices for ${symbol}...`);
    
    // We split into chunks of 100 to avoid D1 limits
    const chunkSize = 100;
    for (let i = 0; i < points.length; i += chunkSize) {
      const chunk = points.slice(i, i + chunkSize);
      const statements = chunk.map(p => 
        db.prepare('INSERT OR REPLACE INTO historical_prices (symbol, date, close) VALUES (?, ?, ?)')
          .bind(symbol, p.date, p.close)
      );
      await db.batch(statements);
    }

    console.log(`[HistoricalPrices] Successfully synced ${symbol}`);
  } catch (e) {
    console.error(`[HistoricalPrices] Failed to sync ${symbol}:`, e);
    throw e;
  }
}

// Ensure prices are up to date in the cache
export async function ensureSymbolPrices(db: D1Database, symbol: string): Promise<void> {
  try {
    const res = await db.prepare(
      'SELECT MAX(date) as maxDate FROM historical_prices WHERE symbol = ?'
    ).first<{ maxDate: string | null }>();

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // If no prices, or last price is older than 24 hours
    const shouldSync = !res || !res.maxDate || 
      (new Date(todayStr).getTime() - new Date(res.maxDate).getTime() > 24 * 60 * 60 * 1000);

    if (shouldSync) {
      await syncHistoricalPrices(db, symbol);
    }
  } catch (e) {
    console.warn(`[HistoricalPrices] Error checking cache for ${symbol}, forcing sync:`, e);
    await syncHistoricalPrices(db, symbol);
  }
}

// Get the date range starting point based on timeframe
export function getStartDate(timeframe: string): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  if (timeframe === 'ytd') {
    return `${year}-01-01`;
  }

  const yearsMap: Record<string, number> = {
    '1y': 1,
    '3y': 3,
    '5y': 5
  };
  const years = yearsMap[timeframe] || 1;
  const d = new Date();
  d.setFullYear(now.getFullYear() - years);
  return d.toISOString().split('T')[0];
}

// Get the closing price on or before a target date
function getPriceOnOrBefore(
  priceMap: Record<string, Record<string, number>>,
  symbol: string,
  targetDate: string,
  allDates: string[] // sorted ASC
): number {
  const symbolPrices = priceMap[symbol];
  if (!symbolPrices) return 0;

  // Direct match
  if (symbolPrices[targetDate] !== undefined) {
    return symbolPrices[targetDate];
  }

  // Scan backward to find the nearest price
  const targetTime = new Date(targetDate).getTime();
  for (let i = allDates.length - 1; i >= 0; i--) {
    const dateStr = allDates[i];
    if (new Date(dateStr).getTime() <= targetTime && symbolPrices[dateStr] !== undefined) {
      return symbolPrices[dateStr];
    }
  }

  // If no date before, return first available price
  for (const dateStr of allDates) {
    if (symbolPrices[dateStr] !== undefined) {
      return symbolPrices[dateStr];
    }
  }

  return 0;
}

export interface PerformanceComparisonResult {
  dates: string[];
  portfolioReturns: number[];
  sp500Returns: number[];
}

export async function calculatePerformanceComparison(
  db: D1Database,
  timeframe: string
): Promise<PerformanceComparisonResult> {
  const startDate = getStartDate(timeframe);

  // 1. Get all unique symbols in transactions + '^GSPC' (S&P 500)
  const { results: symbolsResult } = await db.prepare(
    'SELECT DISTINCT symbol FROM transactions'
  ).all<{ symbol: string }>();

  const symbols = (symbolsResult || []).map(r => r.symbol);
  if (!symbols.includes('^GSPC')) {
    symbols.push('^GSPC');
  }

  // 2. Ensure historical prices are synced for all symbols
  console.log(`[HistoricalPrices] Ensuring price cache for ${symbols.length} symbols...`);
  await Promise.all(symbols.map(s => ensureSymbolPrices(db, s)));

  // 3. Fetch S&P 500 historical prices for master trading dates
  const sp500Prices = await db.prepare(
    'SELECT date, close FROM historical_prices WHERE symbol = ? AND date >= ? ORDER BY date ASC'
  ).bind('^GSPC', startDate).all<{ date: string; close: number }>();

  const tradingDays = (sp500Prices.results || []).map(p => p.date);
  if (tradingDays.length === 0) {
    return { dates: [], portfolioReturns: [], sp500Returns: [] };
  }

  // 4. Fetch all transactions and dividends
  const transactions = await db.prepare(
    'SELECT symbol, date, type, shares, cost_per_share, total_cost FROM transactions ORDER BY date ASC'
  ).all<{ symbol: string; date: string; type: string; shares: number; cost_per_share: number; total_cost: number }>();

  const dividends = await db.prepare(
    'SELECT symbol, date, amount FROM dividends ORDER BY date ASC'
  ).all<{ symbol: string; date: string; amount: number }>();

  // 5. Fetch all historical prices for the symbols from start date to today
  // To avoid individual queries, we fetch them in batch
  const placeHolders = symbols.map(() => '?').join(',');
  const allPrices = await db.prepare(
    `SELECT symbol, date, close FROM historical_prices WHERE symbol IN (${placeHolders}) AND date >= ?`
  ).bind(...symbols, startDate).all<{ symbol: string; date: string; close: number }>();

  // Build a price lookup map: symbol -> date -> close
  const priceMap: Record<string, Record<string, number>> = {};
  for (const p of allPrices.results || []) {
    if (!priceMap[p.symbol]) {
      priceMap[p.symbol] = {};
    }
    priceMap[p.symbol][p.date] = p.close;
  }

  // Build a transaction group map: date -> transactions
  const txByDate = new Map<string, typeof transactions.results>();
  for (const tx of transactions.results || []) {
    const list = txByDate.get(tx.date) || [];
    list.push(tx);
    txByDate.set(tx.date, list);
  }

  // Build a dividend group map: date -> dividends
  const divByDate = new Map<string, number>();
  for (const div of dividends.results || []) {
    const current = divByDate.get(div.date) || 0;
    divByDate.set(div.date, current + div.amount);
  }

  // 6. Partition transactions to establish initial holdings prior to startDate
  const prevTransactions = (transactions.results || []).filter(tx => tx.date < startDate);
  const holdings = new Map<string, number>(); // symbol -> shares

  for (const tx of prevTransactions) {
    const symbol = tx.symbol;
    const currentShares = holdings.get(symbol) || 0;
    if (tx.type === 'Buy') {
      holdings.set(symbol, currentShares + tx.shares);
    } else if (tx.type === 'Sell') {
      holdings.set(symbol, Math.max(0, currentShares - tx.shares));
    }
  }

  // 7. Calculate Time-Weighted Returns (TWR) daily
  const sp500Returns: number[] = [];
  const portfolioReturns: number[] = [];
  const dates: string[] = [];

  const baseSp500Price = sp500Prices.results?.[0]?.close || 1;
  let prevValueAfter = 0;

  // Initialize prevValueAfter for the start date
  for (const [symbol, shares] of holdings.entries()) {
    if (shares > 0) {
      const price = getPriceOnOrBefore(priceMap, symbol, startDate, tradingDays);
      prevValueAfter += shares * price;
    }
  }

  let cumulativePortfolioReturn = 0; // Starts at 0%

  for (let i = 0; i < tradingDays.length; i++) {
    const date = tradingDays[i];
    dates.push(date);

    // Calculate S&P 500 return relative to start date
    const sp500Price = sp500Prices.results![i].close;
    const sp500Return = ((sp500Price - baseSp500Price) / baseSp500Price) * 100;
    sp500Returns.push(Number(sp500Return.toFixed(2)));

    // Calculate today's dividends
    const todayDividends = divByDate.get(date) || 0;

    // Calculate today's portfolio value before today's transactions
    let todayValueBefore = 0;
    for (const [symbol, shares] of holdings.entries()) {
      if (shares > 0) {
        const price = getPriceOnOrBefore(priceMap, symbol, date, tradingDays);
        todayValueBefore += shares * price;
      }
    }

    // Calculate daily return
    let dailyReturn = 0;
    if (prevValueAfter > 0) {
      dailyReturn = (todayValueBefore + todayDividends) / prevValueAfter - 1;
    }
    
    // Update cumulative return
    cumulativePortfolioReturn = (1 + cumulativePortfolioReturn) * (1 + dailyReturn) - 1;
    portfolioReturns.push(Number((cumulativePortfolioReturn * 100).toFixed(2)));

    // Apply today's transactions to update holdings for the end of the day
    const todayTxs = txByDate.get(date) || [];
    for (const tx of todayTxs) {
      const symbol = tx.symbol;
      const currentShares = holdings.get(symbol) || 0;
      if (tx.type === 'Buy') {
        holdings.set(symbol, currentShares + tx.shares);
      } else if (tx.type === 'Sell') {
        holdings.set(symbol, Math.max(0, currentShares - tx.shares));
      }
    }

    // Calculate ending portfolio value using today's ending holdings
    let todayValueAfter = 0;
    for (const [symbol, shares] of holdings.entries()) {
      if (shares > 0) {
        const price = getPriceOnOrBefore(priceMap, symbol, date, tradingDays);
        todayValueAfter += shares * price;
      }
    }

    prevValueAfter = todayValueAfter;
  }

  return {
    dates,
    portfolioReturns,
    sp500Returns
  };
}
