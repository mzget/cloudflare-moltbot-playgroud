import { Hono } from 'hono';
import type { AppEnv } from '../../env';

const brokers = new Hono<AppEnv>();

// GET /api/portfolio/brokers
brokers.get('/api/portfolio/brokers', async (c) => {
  const rate = parseFloat(c.req.query('rate') || '36.5');

  // 1. Fetch auto-calculated stock balances per broker from holdings table
  const { results: stockResults } = await c.env.DB.prepare(`
    SELECT 
      h.broker_name,
      SUM(h.total_cost) as cost_usd,
      SUM(h.shares * COALESCE(m.price, 0)) as balance_usd
    FROM holdings h
    LEFT JOIN market_stats m ON h.symbol = m.symbol
    WHERE h.status != 'Closed'
    GROUP BY h.broker_name
  `).all();

  // 2. Fetch fund balances per broker
  const { results: fundResults } = await c.env.DB.prepare(`
    SELECT 
      f.broker_name,
      SUM(a.amount) as balance_thb
    FROM fund_allocations a
    JOIN portfolio_funds f ON a.fund_id = f.id
    GROUP BY f.broker_name
  `).all();

  // 3. Fetch manual overrides
  const { results: overrideResults } = await c.env.DB.prepare(`
    SELECT * FROM manual_broker_balances
  `).all();

  const overrides = new Map((overrideResults || []).map((row: any) => [row.broker_name, row]));

  // 4. Combine all brokers
  const brokersMap = new Map<string, { broker_name: string; cost: number; balance: number }>();

  // Process stocks (convert USD to THB)
  for (const row of (stockResults || []) as any[]) {
    const broker = row.broker_name || 'Common Stock';
    const cost = (row.cost_usd || 0) * rate;
    const balance = (row.balance_usd || 0) * rate;
    brokersMap.set(broker, { broker_name: broker, cost, balance });
  }

  // Process funds (balances are in THB; cost defaults to balance unless overridden)
  for (const row of (fundResults || []) as any[]) {
    const broker = row.broker_name;
    const balance = row.balance_thb || 0;
    const existing = brokersMap.get(broker);
    if (existing) {
      existing.balance += balance;
      existing.cost += balance;
    } else {
      brokersMap.set(broker, { broker_name: broker, cost: balance, balance });
    }
  }

  // Apply overrides and ensure manual-only brokers are included
  const allBrokerNames = new Set([
    ...brokersMap.keys(),
    ...overrides.keys()
  ]);

  const output = Array.from(allBrokerNames).map(name => {
    const calculated = brokersMap.get(name) || { broker_name: name, cost: 0, balance: 0 };
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

    const gain_amt = finalBalance - finalCost;
    const gain_pct = finalCost > 0 ? (gain_amt / finalCost) * 100 : 0;

    return {
      broker_name: name,
      cost: finalCost,
      balance: finalBalance,
      gain_amt,
      gain_pct,
      cost_override: override?.cost_override ?? null,
      balance_override: override?.balance_override ?? null
    };
  });

  return c.json(output);
});

// POST /api/portfolio/brokers/override
brokers.post('/api/portfolio/brokers/override', async (c) => {
  const body = await c.req.json();
  const { broker_name, cost_override, balance_override } = body;
  if (!broker_name) return c.json({ error: 'broker_name is required' }, 400);

  await c.env.DB.prepare(`
    INSERT INTO manual_broker_balances (broker_name, cost_override, balance_override)
    VALUES (?, ?, ?)
    ON CONFLICT(broker_name) DO UPDATE SET
      cost_override = excluded.cost_override,
      balance_override = excluded.balance_override
  `).bind(
    broker_name,
    (cost_override === undefined || cost_override === null || cost_override === '') ? null : parseFloat(cost_override),
    (balance_override === undefined || balance_override === null || balance_override === '') ? null : parseFloat(balance_override)
  ).run();

  return c.json({ success: true });
});

export default brokers;
