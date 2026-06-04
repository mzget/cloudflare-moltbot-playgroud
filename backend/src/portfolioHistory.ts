import { D1Database } from '@cloudflare/workers-types';

export async function recordDailyPortfolioHistory(db: D1Database) {
  try {
    // 1. Fetch current portfolio holdings and stats
    const { results } = await db.prepare(`
      SELECT 
        h.shares, h.total_cost,
        m.price as last_price,
        COALESCE(d.total_dividends, 0) as tot_div_income
      FROM holdings h
      LEFT JOIN market_stats m ON h.symbol = m.symbol
      LEFT JOIN (
        SELECT symbol, SUM(amount) as total_dividends FROM dividends GROUP BY symbol
      ) d ON h.symbol = d.symbol
      WHERE h.status != 'Closed'
    `).all();

    let totalMarketValue = 0;
    let totalCost = 0;
    let totalDividends = 0;

    for (const row of (results || []) as any[]) {
      const shares = row.shares || 0;
      const price = row.last_price || 0;
      const cost = row.total_cost || 0;
      
      totalMarketValue += shares * price;
      totalCost += cost;
      totalDividends += row.tot_div_income || 0;
    }

    // 2. Fetch realized gains
    const { results: txResults } = await db.prepare(`
      SELECT COALESCE(SUM(realized_gain_amt), 0) as total_realized
      FROM transactions WHERE type = 'Sell'
    `).all();
    const totalRealized = (txResults?.[0] as any)?.total_realized || 0;

    const unrealizedGain = totalMarketValue - totalCost;
    const todayStr = new Date().toISOString().split('T')[0]; // 'YYYY-MM-DD'

    // 3. Insert or update the history for today
    await db.prepare(`
      INSERT INTO portfolio_daily_history (date, total_market_value, total_cost, unrealized_gain, realized_gain, total_dividends)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(date) DO UPDATE SET
        total_market_value = excluded.total_market_value,
        total_cost = excluded.total_cost,
        unrealized_gain = excluded.unrealized_gain,
        realized_gain = excluded.realized_gain,
        total_dividends = excluded.total_dividends
    `).bind(todayStr, totalMarketValue, totalCost, unrealizedGain, totalRealized, totalDividends).run();

    console.log(`[History] Recorded snapshot for ${todayStr}: MarketValue=${totalMarketValue}, Cost=${totalCost}`);
  } catch (e) {
    console.error('[History] Failed to record daily portfolio history:', e);
  }
}

export async function getPortfolioHistory(db: D1Database) {
  // Record today's value first to ensure current data is present
  await recordDailyPortfolioHistory(db);

  const { results } = await db.prepare(`
    SELECT date, total_market_value, total_cost, unrealized_gain, realized_gain, total_dividends
    FROM portfolio_daily_history
    ORDER BY date ASC
    LIMIT 90
  `).all();

  let history = results || [];

  // If we have fewer than 30 points, simulate historical data going backwards to fill up to 30 days
  if (history.length < 30) {
    const today = new Date();
    const historyMap = new Map(history.map((row: any) => [row.date, row]));
    const simulatedHistory: any[] = [];

    // Let's retrieve base values from the first real entry or today's values
    let baseMarketValue = 0;
    let baseCost = 0;
    let baseRealized = 0;
    let baseDividends = 0;

    if (history.length > 0) {
      baseMarketValue = (history[0] as any).total_market_value;
      baseCost = (history[0] as any).total_cost;
      baseRealized = (history[0] as any).realized_gain;
      baseDividends = (history[0] as any).total_dividends;
    } else {
      // If absolutely no history, use the current summary values
      const { results: summaryResults } = await db.prepare(`
        SELECT h.shares, h.total_cost, m.price as last_price
        FROM holdings h
        LEFT JOIN market_stats m ON h.symbol = m.symbol
        WHERE h.status != 'Closed'
      `).all();
      for (const row of (summaryResults || []) as any[]) {
        baseMarketValue += (row.shares || 0) * (row.last_price || 0);
        baseCost += row.total_cost || 0;
      }
    }

    // Now, let's walk back 30 days
    let curMarketValue = baseMarketValue;
    let curCost = baseCost;
    
    // We simulate slightly realistic day-by-day movements going back
    for (let i = 0; i < 30; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];

      if (historyMap.has(dateStr)) {
        // If we have a real entry, update our current values to match it
        const realEntry = historyMap.get(dateStr) as any;
        curMarketValue = realEntry.total_market_value;
        curCost = realEntry.total_cost;
        simulatedHistory.unshift(realEntry);
      } else {
        // Otherwise, simulate values going backward
        // Add random fluctuation of ±1.2% with a small upward drift (meaning going backward, we drift down slightly)
        // Going backward: curMarketValue = curMarketValue * (1 - (drift + random_fluctuation))
        const drift = 0.0003; // 0.03% daily drift
        const fluctuation = (Math.random() - 0.5) * 0.015; // ±0.75%
        curMarketValue = Math.max(0, curMarketValue * (1 - (drift + fluctuation)));

        const unrealized = curMarketValue - curCost;
        simulatedHistory.unshift({
          date: dateStr,
          total_market_value: Number(curMarketValue.toFixed(2)),
          total_cost: Number(curCost.toFixed(2)),
          unrealized_gain: Number(unrealized.toFixed(2)),
          realized_gain: baseRealized,
          total_dividends: baseDividends,
          is_simulated: true
        });
      }
    }
    history = simulatedHistory;
  }

  return history;
}
