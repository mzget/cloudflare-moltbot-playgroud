
// Helper: Recalculate holdings aggregate from share_lots
export async function recalcHoldings(db: any, symbol: string) {
  const txCountResult = await db.prepare(
    'SELECT COUNT(*) as count FROM transactions WHERE symbol = ?'
  ).bind(symbol).first();
  const txCount = (txCountResult as any)?.count || 0;

  if (txCount === 0) {
    await db.prepare('DELETE FROM holdings WHERE symbol = ?').bind(symbol).run();
    return;
  }

  const { results } = await db.prepare(
    'SELECT SUM(shares) as total_shares, SUM(total_cost) as total_cost FROM share_lots WHERE symbol = ?'
  ).bind(symbol).all();
  const row = results?.[0] as any;
  const totalShares = row?.total_shares || 0;
  const totalCost = row?.total_cost || 0;
  const avgCost = totalShares > 0 ? totalCost / totalShares : 0;
  const status = totalShares > 0 ? 'Open' : 'Closed';

  await db.prepare(`
    INSERT INTO holdings (symbol, shares, avg_cost, total_cost, status)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(symbol) DO UPDATE SET
      shares = excluded.shares,
      avg_cost = excluded.avg_cost,
      total_cost = excluded.total_cost,
      status = excluded.status,
      updated_at = strftime('%s', 'now')
  `).bind(symbol, totalShares, avgCost, totalCost, status).run();

  // Also ensure symbol is in watchlist
  await db.prepare(`
    INSERT OR IGNORE INTO watchlist (symbol, name, is_active)
    VALUES (?, ?, 1)
  `).bind(symbol, symbol).run();
}



// Helper: Rebuild all share lots and recalculate realized gains for a symbol
export async function rebuildLotsAndRealizedGains(db: any, symbol: string) {
  const sym = symbol.toUpperCase();

  // 1. Delete all existing share lots for this symbol
  await db.prepare('DELETE FROM share_lots WHERE symbol = ?').bind(sym).run();

  // 2. Clear realized gains on Sell transactions for this symbol (we will recalculate them)
  await db.prepare('UPDATE transactions SET realized_gain_amt = NULL, realized_gain_pct = NULL WHERE symbol = ? AND type = "Sell"').bind(sym).run();

  // 3. Fetch all transactions for this symbol sorted chronologically (using date ASC, id ASC)
  const { results: txs } = await db.prepare('SELECT * FROM transactions WHERE symbol = ? ORDER BY date ASC, id ASC').bind(sym).all();

  for (const tx of (txs || []) as any[]) {
    const type = tx.type || 'Buy';
    const shares = parseFloat(tx.shares);
    const price = parseFloat(tx.cost_per_share);
    const commission = parseFloat(tx.commission) || 0;
    const totalCost = tx.total_cost;
    const date = tx.date;
    const note = tx.note || null;

    if (type === 'Buy') {
      await db.prepare(`
        INSERT INTO share_lots (symbol, date, shares, cost_per_share, total_cost, note)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(sym, date, shares, price, totalCost, note).run();
    } else if (type === 'Sell') {
      // FIFO deduct lots
      const { results: lots } = await db.prepare(`
        SELECT * FROM share_lots WHERE symbol = ? AND shares > 0 ORDER BY date ASC, id ASC
      `).bind(sym).all();

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

          await db.prepare(`
            UPDATE transactions 
            SET realized_gain_amt = COALESCE(realized_gain_amt, 0) + ?,
                realized_gain_pct = ?
            WHERE id = ?
          `).bind(realizedAmt, realizedPct, tx.id).run();

          await db.prepare('DELETE FROM share_lots WHERE id = ?').bind(lot.id).run();
          remainingToSell -= lotShares;
        } else {
          const proportionalSellComm = (remainingToSell / shares) * commission;
          const realizedAmt = (remainingToSell * price - proportionalSellComm) - (remainingToSell * lotCostBasisPerShare);
          const realizedPct = lotCostBasisPerShare > 0 ? (realizedAmt / (remainingToSell * lotCostBasisPerShare)) * 100 : 0;

          await db.prepare(`
            UPDATE transactions 
            SET realized_gain_amt = COALESCE(realized_gain_amt, 0) + ?,
                realized_gain_pct = ?
            WHERE id = ?
          `).bind(realizedAmt, realizedPct, tx.id).run();

          const newShares = lotShares - remainingToSell;
          const newCost = newShares * lotCostBasisPerShare;
          await db.prepare(`
            UPDATE share_lots 
            SET shares = ?, total_cost = ? 
            WHERE id = ?
          `).bind(newShares, newCost, lot.id).run();
          remainingToSell = 0;
        }
      }
    }
  }

  // 4. Finally recalculate holdings
  await recalcHoldings(db, sym);
}
