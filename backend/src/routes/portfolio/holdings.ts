import { Hono } from 'hono';
import { cache } from 'hono/cache';
import type { AppEnv } from '../../env';
import { recordDailyPortfolioHistory, getPortfolioHistory } from '../../portfolioHistory';
import { sortTransactions } from '../../portfolioUtils';
import { calculatePerformanceComparison } from '../../historicalPrices';
import { recalcHoldings } from '../../portfolioRecalc';

const holdings = new Hono<AppEnv>();

// ===== PORTFOLIO API =====

// GET /api/portfolio/holdings - All holdings with computed gains
holdings.get('/api/portfolio/holdings', async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT 
      h.symbol, h.shares, h.avg_cost, h.total_cost, h.status,
      w.name, w.sector_label, w.sector_label_color,
      m.price as last_price, m.previous_close, m.market_cap, m.p_e, m.price_updated_at, m.updated_at as stats_updated_at,
      COALESCE(d.total_dividends, 0) as tot_div_income,
      COALESCE(t.realized_gain_sum, 0) as realized_gain_amt,
      COALESCE(t.realized_cost_basis, 0) as realized_cost_basis
    FROM holdings h
    LEFT JOIN watchlist w ON h.symbol = w.symbol
    LEFT JOIN market_stats m ON h.symbol = m.symbol
    LEFT JOIN (
      SELECT symbol, SUM(amount) as total_dividends FROM dividends GROUP BY symbol
    ) d ON h.symbol = d.symbol
    LEFT JOIN (
      SELECT symbol, 
        SUM(CASE WHEN type = 'Sell' THEN realized_gain_amt ELSE 0 END) as realized_gain_sum,
        SUM(CASE WHEN type = 'Sell' THEN total_cost ELSE 0 END) as realized_cost_basis
      FROM transactions GROUP BY symbol
    ) t ON h.symbol = t.symbol
    ORDER BY h.symbol ASC
  `).all();

  // Compute derived fields
  const holdings = (results || []).map((row: any) => {
    const shares = row.shares || 0;
    const lastPrice = row.last_price;
    const avgCost = row.avg_cost;
    const totalCost = row.total_cost || (shares * (avgCost || 0));
    const marketValue = lastPrice ? shares * lastPrice : null;
    const prevClose = row.previous_close;

    // Day gain
    const dayGainPct = (lastPrice && prevClose && prevClose > 0)
      ? ((lastPrice - prevClose) / prevClose) * 100 : null;
    const dayGainAmt = (lastPrice && prevClose)
      ? shares * (lastPrice - prevClose) : null;

    // Total unrealized gain
    const totGainAmt = (marketValue !== null && totalCost)
      ? marketValue - totalCost : null;
    const totGainPct = (totGainAmt !== null && totalCost && totalCost > 0)
      ? (totGainAmt / totalCost) * 100 : null;

    // Realized gain percentage
    const realizedGainAmt = row.realized_gain_amt || 0;
    const realizedCostBasis = row.realized_cost_basis || 0;
    const realizedGainPct = realizedCostBasis > 0
      ? (realizedGainAmt / realizedCostBasis) * 100 : null;

    return {
      symbol: row.symbol,
      name: row.name || row.symbol,
      status: row.status || 'Open',
      shares,
      last_price: lastPrice,
      avg_cost: avgCost,
      total_cost: totalCost,
      market_value: marketValue,
      tot_div_income: row.tot_div_income,
      day_gain_pct: dayGainPct,
      day_gain_amt: dayGainAmt,
      tot_gain_pct: totGainPct,
      tot_gain_amt: totGainAmt,
      realized_gain_pct: realizedGainPct,
      realized_gain_amt: realizedGainAmt,
      price_updated_at: row.price_updated_at || null,
      stats_updated_at: row.stats_updated_at || null,
      sector_label: row.sector_label || null,
      sector_label_color: row.sector_label_color || null,
    };
  });

  return c.json(holdings);
});

// GET /api/portfolio/summary - Portfolio totals
holdings.get('/api/portfolio/summary', async (c) => {
  const rate = parseFloat(c.req.query('rate') || '36.5');

  // 1. Fetch stocks
  const { results: stockResults } = await c.env.DB.prepare(`
    SELECT 
      h.symbol, h.shares, h.avg_cost, h.total_cost, h.broker_name,
      m.price as last_price, m.previous_close,
      COALESCE(d.total_dividends, 0) as tot_div_income
    FROM holdings h
    LEFT JOIN market_stats m ON h.symbol = m.symbol
    LEFT JOIN (
      SELECT symbol, SUM(amount) as total_dividends FROM dividends GROUP BY symbol
    ) d ON h.symbol = d.symbol
    WHERE h.status != 'Closed'
  `).all();

  let stockMarketValueUsd = 0;
  let stockCostUsd = 0;
  let stockDayChangeUsd = 0;
  let stockDividendsUsd = 0;

  const brokerStocks = new Map<string, { costUsd: number; balanceUsd: number }>();

  for (const row of (stockResults || []) as any[]) {
    const shares = row.shares || 0;
    const price = row.last_price || 0;
    const prevClose = row.previous_close || price;
    const cost = row.total_cost || 0;
    const broker = row.broker_name || 'Common Stock';

    stockMarketValueUsd += shares * price;
    stockCostUsd += cost;
    stockDayChangeUsd += shares * (price - prevClose);
    stockDividendsUsd += row.tot_div_income || 0;

    const prev = brokerStocks.get(broker) || { costUsd: 0, balanceUsd: 0 };
    prev.costUsd += cost;
    prev.balanceUsd += shares * price;
    brokerStocks.set(broker, prev);
  }

  // 2. Fetch fund allocations grouped by broker
  const { results: fundResults } = await c.env.DB.prepare(`
    SELECT 
      f.broker_name,
      SUM(a.amount) as balance_thb
    FROM fund_allocations a
    JOIN portfolio_funds f ON a.fund_id = f.id
    GROUP BY f.broker_name
  `).all();

  // 3. Fetch manual broker overrides
  const { results: overrideResults } = await c.env.DB.prepare(`
    SELECT * FROM manual_broker_balances
  `).all();
  const overrides = new Map((overrideResults || []).map((row: any) => [row.broker_name, row]));

  // 4. Combine brokers and apply overrides
  const brokersMap = new Map<string, { cost: number; balance: number }>();

  // Process stocks (convert to THB)
  for (const [broker, val] of brokerStocks.entries()) {
    brokersMap.set(broker, {
      cost: val.costUsd * rate,
      balance: val.balanceUsd * rate
    });
  }

  // Process funds
  for (const row of (fundResults || []) as any[]) {
    const broker = row.broker_name;
    const balance = row.balance_thb || 0;
    const existing = brokersMap.get(broker);
    if (existing) {
      existing.balance += balance;
      existing.cost += balance;
    } else {
      brokersMap.set(broker, { cost: balance, balance });
    }
  }

  // Calculate total cost and market value by summing final broker values (with overrides applied)
  const allBrokerNames = new Set([
    ...brokersMap.keys(),
    ...overrides.keys()
  ]);

  let totalCostThb = 0;
  let totalMarketValueThb = 0;

  for (const name of allBrokerNames) {
    if (name === 'Cash') continue; // Skip Cash since it is already included in other brokers
    const calculated = brokersMap.get(name) || { cost: 0, balance: 0 };
    const override = overrides.get(name) as any;

    let finalCost = calculated.cost;
    let finalBalance = calculated.balance;

    if (override) {
      if (override.cost_override !== null && override.cost_override !== undefined) {
        finalCost = override.cost_override;
      }
      if (override.balance_override !== null && override.balance_override !== undefined) {
        finalBalance = override.balance_override;
      }
    }

    totalCostThb += finalCost;
    totalMarketValueThb += finalBalance;
  }

  // 5. Fetch realized gains
  const { results: txResults } = await c.env.DB.prepare(`
    SELECT COALESCE(SUM(realized_gain_amt), 0) as total_realized
    FROM transactions WHERE type = 'Sell'
  `).all();
  const totalRealizedUsd = (txResults?.[0] as any)?.total_realized || 0;
  const totalRealizedThb = totalRealizedUsd * rate;
  const totalDayChangeThb = stockDayChangeUsd * rate;
  const totalDividendsThb = stockDividendsUsd * rate;

  const unrealizedGainThb = totalMarketValueThb - totalCostThb;
  const unrealizedGainPct = totalCostThb > 0 ? (unrealizedGainThb / totalCostThb) * 100 : 0;
  const dayChangePct = (totalMarketValueThb - totalDayChangeThb) > 0
    ? (totalDayChangeThb / (totalMarketValueThb - totalDayChangeThb)) * 100 : 0;

  // Calculate stock-only values (in USD)
  let stockMarketValueUsdFinal = stockMarketValueUsd;
  let stockCostUsdFinal = stockCostUsd;
  const stockDayChangeUsdFinal = stockDayChangeUsd;
  const stockDividendsUsdFinal = stockDividendsUsd;

  // Stocks Only (USD) summary card should skip broker overrides and reflect raw holdings

  const stockUnrealizedGainUsd = stockMarketValueUsdFinal - stockCostUsdFinal;
  const stockUnrealizedGainPct = stockCostUsdFinal > 0 ? (stockUnrealizedGainUsd / stockCostUsdFinal) * 100 : 0;
  const stockDayChangePct = (stockMarketValueUsdFinal - stockDayChangeUsdFinal) > 0
    ? (stockDayChangeUsdFinal / (stockMarketValueUsdFinal - stockDayChangeUsdFinal)) * 100 : 0;

  // Record history snapshot in background
  c.executionCtx.waitUntil(recordDailyPortfolioHistory(c.env.DB));

  return c.json({
    total_market_value: totalMarketValueThb,
    total_cost: totalCostThb,
    cash: 0,
    day_change_amt: totalDayChangeThb,
    day_change_pct: dayChangePct,
    unrealized_gain_amt: unrealizedGainThb,
    unrealized_gain_pct: unrealizedGainPct,
    realized_gain_amt: totalRealizedThb,
    total_dividends: totalDividendsThb,
    is_thb: true,
    stocks: {
      total_market_value: stockMarketValueUsdFinal,
      total_cost: stockCostUsdFinal,
      day_change_amt: stockDayChangeUsdFinal,
      day_change_pct: stockDayChangePct,
      unrealized_gain_amt: stockUnrealizedGainUsd,
      unrealized_gain_pct: stockUnrealizedGainPct,
      realized_gain_amt: totalRealizedUsd,
      total_dividends: stockDividendsUsdFinal
    }
  });
});

// GET /api/portfolio/history - Historical portfolio values
holdings.get('/api/portfolio/history', async (c) => {
  try {
    const history = await getPortfolioHistory(c.env.DB);
    return c.json(history);
  } catch (e) {
    return c.json({ error: (e as any).message }, 500);
  }
});

// GET /api/portfolio/performance-comparison - Compare portfolio performance with S&P 500
holdings.get('/api/portfolio/performance-comparison', cache({ cacheName: 'oaktree-performance-comp', cacheControl: 'max-age=900' }), async (c) => {
  try {
    const timeframe = c.req.query('timeframe') || '1y';
    const result = await calculatePerformanceComparison(c.env.DB, timeframe);
    return c.json(result);
  } catch (e) {
    return c.json({ error: (e as any).message }, 500);
  }
});

// POST /api/portfolio/import - Bulk import transactions from CSV (parsed frontend JSON)
holdings.post('/api/portfolio/import', async (c) => {
  try {
    const transactions = await c.req.json() as any[];
    if (!Array.isArray(transactions)) {
      return c.json({ error: 'Invalid payload, expected array of transactions' }, 400);
    }
    if (transactions.length > 1000) {
      return c.json({ error: 'Payload too large, maximum 1000 transactions allowed' }, 400);
    }

    // Sort transactions chronologically to ensure FIFO lot matching behaves correctly
    const sortedTransactions = sortTransactions(transactions);

    const affectedSymbols = new Set<string>();

    for (const tx of sortedTransactions) {
      if (!tx.symbol || !tx.date || isNaN(parseFloat(tx.shares)) || isNaN(parseFloat(tx.price))) {
        continue;
      }

      const symbol = tx.symbol.trim().toUpperCase();
      const date = tx.date;
      const type = tx.type || 'Buy';
      const shares = parseFloat(tx.shares);
      const price = parseFloat(tx.price);
      const commission = parseFloat(tx.commission) || 0;
      const note = tx.note || null;

      affectedSymbols.add(symbol);

      const totalCost = type === 'Sell'
        ? (shares * price) - commission
        : (shares * price) + commission;

      // 1. Record the transaction
      await c.env.DB.prepare(`
        INSERT INTO transactions (symbol, date, type, shares, cost_per_share, commission, total_cost, note)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(symbol, date, type, shares, price, commission, totalCost, note).run();

      if (type === 'Buy') {
        // 2. Add buy lot
        await c.env.DB.prepare(`
          INSERT INTO share_lots (symbol, date, shares, cost_per_share, total_cost, note)
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(symbol, date, shares, price, totalCost, note).run();
      } else if (type === 'Sell') {
        // 3. FIFO deduct lots
        const { results: lots } = await c.env.DB.prepare(`
          SELECT * FROM share_lots WHERE symbol = ? AND shares > 0 ORDER BY date ASC
        `).bind(symbol).all();

        let remainingToSell = shares;
        for (const lot of (lots || []) as any[]) {
          if (remainingToSell <= 0) break;

          const lotShares = lot.shares;
          const lotCostBasisPerShare = lot.total_cost && lot.shares > 0
            ? lot.total_cost / lot.shares
            : lot.cost_per_share;

          if (lotShares <= remainingToSell) {
            const proportionalSellComm = (lotShares / shares) * commission;
            const realizedAmt = (lotShares * price - proportionalSellComm) - (lotShares * lotCostBasisPerShare);
            const realizedPct = lotCostBasisPerShare > 0 ? (realizedAmt / (lotShares * lotCostBasisPerShare)) * 100 : 0;

            await c.env.DB.prepare(`
              UPDATE transactions 
              SET realized_gain_amt = COALESCE(realized_gain_amt, 0) + ?,
                  realized_gain_pct = ?
              WHERE symbol = ? AND date = ? AND type = 'Sell' AND shares = ?
            `).bind(realizedAmt, realizedPct, symbol, date, shares).run();

            await c.env.DB.prepare('DELETE FROM share_lots WHERE id = ?').bind(lot.id).run();
            remainingToSell -= lotShares;
          } else {
            const proportionalSellComm = (remainingToSell / shares) * commission;
            const realizedAmt = (remainingToSell * price - proportionalSellComm) - (remainingToSell * lotCostBasisPerShare);
            const realizedPct = lotCostBasisPerShare > 0 ? (realizedAmt / (remainingToSell * lotCostBasisPerShare)) * 100 : 0;

            await c.env.DB.prepare(`
              UPDATE transactions 
              SET realized_gain_amt = COALESCE(realized_gain_amt, 0) + ?,
                  realized_gain_pct = ?
              WHERE symbol = ? AND date = ? AND type = 'Sell' AND shares = ?
            `).bind(realizedAmt, realizedPct, symbol, date, shares).run();

            const newShares = lotShares - remainingToSell;
            const newCost = newShares * lotCostBasisPerShare;
            await c.env.DB.prepare(`
              UPDATE share_lots 
              SET shares = ?, total_cost = ? 
              WHERE id = ?
            `).bind(newShares, newCost, lot.id).run();
            remainingToSell = 0;
          }
        }
      }
    }

    // Recalculate positions
    for (const symbol of affectedSymbols) {
      await recalcHoldings(c.env.DB, symbol);
    }

    return c.json({ success: true, count: transactions.length });
  } catch (e) {
    return c.json({ error: (e as any).message }, 500);
  }
});



// POST /api/portfolio/holdings - Add new holding
holdings.post('/api/portfolio/holdings', async (c) => {
  const body = await c.req.json();
  const { symbol, shares, avg_cost, commission, status } = body;
  if (!symbol) return c.json({ error: 'Symbol is required' }, 400);

  const sym = symbol.toUpperCase();
  const numShares = parseFloat(shares) || 0;
  const avgCost = avg_cost !== undefined && avg_cost !== null ? parseFloat(avg_cost) : null;
  const comm = parseFloat(commission) || 0;

  // Check if symbol is in holdings already
  const existingHolding = await c.env.DB.prepare('SELECT 1 FROM holdings WHERE symbol = ?').bind(sym).first();
  const isAlreadyInHoldings = !!existingHolding;

  if (isAlreadyInHoldings) {
    // === Add Transaction Logic ===
    if (numShares > 0 && avgCost !== null) {
      const dateStr = new Date().toISOString().split('T')[0];
      const lotTotalCost = (numShares * avgCost) + comm;

      // Add buy lot
      await c.env.DB.prepare(`
        INSERT INTO share_lots (symbol, date, shares, cost_per_share, total_cost, note)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(sym, dateStr, numShares, avgCost, lotTotalCost, 'Additional Position').run();

      // Add buy transaction
      await c.env.DB.prepare(`
        INSERT INTO transactions (symbol, date, type, shares, cost_per_share, commission, total_cost, note)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(sym, dateStr, 'Buy', numShares, avgCost, comm, lotTotalCost, 'Additional Position').run();

      // Recalculate holdings
      await recalcHoldings(c.env.DB, sym);
    }
  } else {
    // === Add New Holding Logic ===
    // Check if symbol exists in watchlist
    const watchlistEntry = await c.env.DB.prepare('SELECT * FROM watchlist WHERE symbol = ?').bind(sym).first();
    if (watchlistEntry) {
      // If in watchlist, ensure is_active is 1
      await c.env.DB.prepare('UPDATE watchlist SET is_active = 1 WHERE symbol = ?').bind(sym).run();
    } else {
      // If not in watchlist, insert it
      await c.env.DB.prepare(`
        INSERT INTO watchlist (symbol, name, is_active)
        VALUES (?, ?, 1)
      `).bind(sym, sym).run();
    }

    if (numShares > 0 && avgCost !== null) {
      const dateStr = new Date().toISOString().split('T')[0];
      const lotTotalCost = (numShares * avgCost) + comm;

      // Add buy lot
      await c.env.DB.prepare(`
        INSERT INTO share_lots (symbol, date, shares, cost_per_share, total_cost, note)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(sym, dateStr, numShares, avgCost, lotTotalCost, 'Initial Position').run();

      // Add buy transaction
      await c.env.DB.prepare(`
        INSERT INTO transactions (symbol, date, type, shares, cost_per_share, commission, total_cost, note)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(sym, dateStr, 'Buy', numShares, avgCost, comm, lotTotalCost, 'Initial Position').run();

      // Recalculate holdings
      await recalcHoldings(c.env.DB, sym);
    } else {
      // Just insert empty holding if shares is 0
      await c.env.DB.prepare(`
        INSERT INTO holdings (symbol, shares, avg_cost, total_cost, status)
        VALUES (?, 0, NULL, 0, ?)
        ON CONFLICT(symbol) DO UPDATE SET
          shares = excluded.shares,
          avg_cost = excluded.avg_cost,
          total_cost = excluded.total_cost,
          status = excluded.status,
          updated_at = strftime('%s', 'now')
      `).bind(sym, status || 'Open').run();
    }
  }

  return c.json({ success: true });
});

// PUT /api/portfolio/holdings/:symbol - Update holding
holdings.put('/api/portfolio/holdings/:symbol', async (c) => {
  const symbol = c.req.param('symbol').toUpperCase();
  const body = await c.req.json();
  const { shares, avg_cost, status } = body;
  const totalCost = (shares || 0) * (avg_cost || 0);

  await c.env.DB.prepare(`
    UPDATE holdings SET shares = ?, avg_cost = ?, total_cost = ?, status = ?, updated_at = strftime('%s', 'now')
    WHERE symbol = ?
  `).bind(shares || 0, avg_cost || null, totalCost, status || 'Open', symbol).run();

  return c.json({ success: true });
});

// DELETE /api/portfolio/holdings/:symbol
holdings.delete('/api/portfolio/holdings/:symbol', async (c) => {
  const symbol = c.req.param('symbol').toUpperCase();
  await c.env.DB.prepare('DELETE FROM holdings WHERE symbol = ?').bind(symbol).run();
  await c.env.DB.prepare('DELETE FROM share_lots WHERE symbol = ?').bind(symbol).run();
  await c.env.DB.prepare('DELETE FROM transactions WHERE symbol = ?').bind(symbol).run();
  await c.env.DB.prepare('DELETE FROM dividends WHERE symbol = ?').bind(symbol).run();
  return c.json({ success: true });
});

export default holdings;
