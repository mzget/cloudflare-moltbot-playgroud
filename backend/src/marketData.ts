import { Env } from './index';

export async function fetchAndStoreMarketStats(env: Env): Promise<void> {
	if (!env.FMP_API_KEY) {
		console.warn('FMP_API_KEY is not set. Skipping market stats update.');
		return;
	}

	const { results } = await env.DB.prepare(`
		SELECT w.symbol 
		FROM watchlist w
		LEFT JOIN market_stats m ON w.symbol = m.symbol
		WHERE w.is_active = 1
		ORDER BY m.updated_at ASC NULLS FIRST
		LIMIT 6
	`).all();
	if (!results || results.length === 0) return;

	const fetchFMP = async (endpoint: string) => {
		const fmpUrl = `https://financialmodelingprep.com${endpoint}${endpoint.includes('?') ? '&' : '?'}apikey=${env.FMP_API_KEY}`;
		try {
			const response = await fetch(fmpUrl);
			if (response.ok) {
				return await response.json();
			}
		} catch (e) {
			console.error(`FMP fetch failed for ${endpoint}:`, e);
		}
		return null;
	};

	console.log(`Fetching market stats for ${results.length} symbols...`);

	for (const row of results) {
		const symbol = row.symbol as string;
		let market_cap = null, revenues = null, revenue_3y_cagr = null, revenue_1y_growth = null;
		let gross_profit_margin = null, operating_margin = null, ev_ebit = null, ev_sales = null;
		let p_ocf = null, p_fcf = null, capex_to_ocf = null, rd_to_revenue = null, debt_equity = null;
		let p_e = null, fcf_margin = null, total_cash = null, net_debt = null, dividend_yield = null;

		try {
			// 1. Key Metrics (Stable uses ?symbol=)
			const km = await fetchFMP(`/stable/key-metrics?symbol=${symbol}`);
			if (Array.isArray(km) && km.length > 0) {
				const d = km[0];
				market_cap = d.marketCap ?? null;
				ev_sales = (d.evToSales || d.enterpriseValueOverRevenue) ?? null;
				ev_ebit = (d.evToEBIT || d.enterpriseValueOverEBIT) ?? null;
				p_ocf = (d.pocfratio || d.priceToOperatingCashFlowsRatio) ?? null;
				p_fcf = (d.pfcfRatio || d.priceToFreeCashFlowsRatio) ?? null;
				debt_equity = d.debtToEquity ?? null;
				p_e = (d.peRatio || d.priceEarningsRatio) ?? null;
				dividend_yield = d.dividendYieldPercentage ? d.dividendYieldPercentage / 100 : (d.dividendYield ?? null);
			}

			// 2. Ratios
			const ratios = await fetchFMP(`/stable/ratios?symbol=${symbol}`);
			if (Array.isArray(ratios) && ratios.length > 0) {
				const d = ratios[0];
				gross_profit_margin = d.grossProfitMargin ?? null;
				operating_margin = d.operatingProfitMargin ?? null;
			}

			// 3. Financial Growth
			const growth = await fetchFMP(`/stable/financial-growth?symbol=${symbol}&limit=1`);
			if (Array.isArray(growth) && growth.length > 0) {
				const d = growth[0];
				revenue_1y_growth = d.revenueGrowth ?? null;
				revenue_3y_cagr = (d.threeYRevenueGrowthPerShare || d.revenueGrowth3Y) ?? null;
			}

			// 4. Income Statement
			const income = await fetchFMP(`/stable/income-statement?symbol=${symbol}&limit=1`);
			if (Array.isArray(income) && income.length > 0) {
				const d = income[0];
				revenues = d.revenue ?? null;
				if (d.revenue && d.revenue > 0) {
					rd_to_revenue = d.researchAndDevelopmentExpenses / d.revenue;
				}
			}

			// 5. Cash Flow
			const cf = await fetchFMP(`/stable/cash-flow-statement?symbol=${symbol}&limit=1`);
			if (Array.isArray(cf) && cf.length > 0) {
				const d = cf[0];
				if (d.operatingCashFlow && d.operatingCashFlow > 0) {
					capex_to_ocf = Math.abs(d.capitalExpenditure) / d.operatingCashFlow;
				}
				if (revenues && revenues > 0) {
					fcf_margin = d.freeCashFlow / revenues;
				}
			}

			// 6. Balance Sheet for cash and debt
			const bs = await fetchFMP(`/stable/balance-sheet-statement?symbol=${symbol}&limit=1`);
			if (Array.isArray(bs) && bs.length > 0) {
				const d = bs[0];
				total_cash = d.cashAndCashEquivalents ?? null;
				net_debt = d.netDebt ?? null;
			}

			// Log the data for debugging
			console.log(`Final stats for ${symbol}:`, {
				market_cap, revenues, revenue_3y_cagr, revenue_1y_growth,
				gross_profit_margin, operating_margin, ev_ebit, ev_sales,
				p_ocf, p_fcf, capex_to_ocf, rd_to_revenue, debt_equity,
				p_e, fcf_margin, total_cash, net_debt, dividend_yield
			});

			// Upsert to database
			await env.DB.prepare(`
				INSERT INTO market_stats (
					symbol, market_cap, revenues, revenue_3y_cagr, revenue_1y_growth, 
					gross_profit_margin, operating_margin, ev_ebit, ev_sales, 
					p_ocf, p_fcf, capex_to_ocf, rd_to_revenue, debt_equity,
					p_e, fcf_margin, total_cash, net_debt, dividend_yield, updated_at
				) VALUES (
					?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%s', 'now')
				)
				ON CONFLICT(symbol) DO UPDATE SET 
					market_cap=excluded.market_cap, revenues=excluded.revenues, 
					revenue_3y_cagr=excluded.revenue_3y_cagr, revenue_1y_growth=excluded.revenue_1y_growth,
					gross_profit_margin=excluded.gross_profit_margin, operating_margin=excluded.operating_margin,
					ev_ebit=excluded.ev_ebit, ev_sales=excluded.ev_sales,
					p_ocf=excluded.p_ocf, p_fcf=excluded.p_fcf,
					capex_to_ocf=excluded.capex_to_ocf, rd_to_revenue=excluded.rd_to_revenue,
					debt_equity=excluded.debt_equity, p_e=excluded.p_e, fcf_margin=excluded.fcf_margin,
					total_cash=excluded.total_cash, net_debt=excluded.net_debt, dividend_yield=excluded.dividend_yield,
					updated_at=excluded.updated_at
			`).bind(
				symbol, market_cap, revenues, revenue_3y_cagr, revenue_1y_growth,
				gross_profit_margin, operating_margin, ev_ebit, ev_sales,
				p_ocf, p_fcf, capex_to_ocf, rd_to_revenue, debt_equity,
				p_e, fcf_margin, total_cash, net_debt, dividend_yield
			).run();

			console.log(`Updated market stats for ${symbol}`);

		} catch (e) {
			console.error(`Error processing FMP data for ${symbol}:`, e);
		}
	}
	console.log('Finished updating market stats.');
}
