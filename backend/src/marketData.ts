import { Env } from './index';

interface FinnhubResponse {
	metric?: Record<string, any>;
	symbol?: string;
	metricType?: string;
	series?: Record<string, any>;
}

export async function fetchAndStoreMarketStats(env: Env): Promise<void> {
	const apiKey = env.FINNHUB_API_KEY;
	if (!apiKey) {
		console.warn('FINNHUB_API_KEY is not set. Skipping market stats update.');
		return;
	}

	let results: any[] = [];
	try {
		const dbResults = await env.DB.prepare(`
			SELECT w.symbol 
			FROM watchlist w
			LEFT JOIN market_stats m ON w.symbol = m.symbol
			WHERE w.is_active = 1
			ORDER BY (m.updated_at IS NULL) DESC, m.updated_at ASC
			LIMIT 6
		`).all();
		results = dbResults.results || [];
	} catch (e) {
		console.error("D1 Query failed. Is 'market_stats' table created in remote?", e);
		return;
	}
	if (results.length === 0) return;

	const fetchFinnhub = async (symbol: string) => {
		const url = `https://finnhub.io/api/v1/stock/metric?symbol=${symbol}&metric=all&token=${apiKey}`;
		try {
			const response = await fetch(url);
			if (response.ok) {
				return await response.json();
			}
		} catch (e) {
			console.error(`Finnhub fetch failed for ${symbol}:`, e);
		}
		return null;
	};

	console.log(`Fetching market stats from Finnhub for ${results.length} symbols...`);

	for (const row of results) {
		const symbol = row.symbol as string;

		// Database fields
		let market_cap = null, revenues = null, revenue_3y_cagr = null, revenue_1y_growth = null;
		let gross_profit_margin = null, operating_margin = null, ev_ebit = null, ev_sales = null;
		let p_ocf = null, p_fcf = null, capex_to_ocf = null, rd_to_revenue = null, debt_equity = null;
		let p_e = null, fcf_margin = null, total_cash = null, net_debt = null, dividend_yield = null;

		try {
			const data = await fetchFinnhub(symbol) as FinnhubResponse | null;
			if (data && data.metric) {
				const m = data.metric;

				// Basic Valuation & Stats
				market_cap = m.marketCapitalization ?? null;
				p_e = m.peBasicExclExtraTTM || m.peTTM || null;
				dividend_yield = m.dividendYieldIndicatedAnnual ? m.dividendYieldIndicatedAnnual / 100 : (m.dividendYieldTTM ? m.dividendYieldTTM / 100 : null);

				// Margins (Finnhub provides these as percentages, convert to decimals)
				gross_profit_margin = m.grossMarginTTM ? m.grossMarginTTM / 100 : null;
				operating_margin = m.operatingMarginTTM ? m.operatingMarginTTM / 100 : null;
				fcf_margin = m.freeCashFlowMarginTTM ? m.freeCashFlowMarginTTM / 100 : null;

				// Growth
				revenue_1y_growth = m.revenueGrowthTTM ? m.revenueGrowthTTM / 100 : null;
				revenue_3y_cagr = m.revenueGrowth3Y ? m.revenueGrowth3Y / 100 : (m.revenueGrowth5Y ? m.revenueGrowth5Y / 100 : null);

				// Ratios
				p_ocf = m.pcfRatioTTM || null;
				p_fcf = m.pfcfRatioTTM || null;
				debt_equity = m.totalDebtToEquityTTM ? m.totalDebtToEquityTTM / 100 : null;

				// Enterprise Value based ratios
				// Finnhub doesn't always provide EV/Sales directly in metrics, so we calculate if possible
				const ev = m.enterpriseValue;
				revenues = m.revenueTTM || null;
				if (ev && revenues && revenues > 0) {
					ev_sales = ev / revenues;
				} else {
					ev_sales = m.evToSales || null;
				}

				const ebitda = m.ebitdaTTM;
				if (ev && ebitda && ebitda > 0) {
					ev_ebit = ev / ebitda;
				} else {
					ev_ebit = m.evToEbitda || null;
				}

				// Financial Health
				total_cash = m.cashAndCashEquivalents || null;
				net_debt = m.netDebt || null;

				// Specific Metrics
				rd_to_revenue = m.researchAndDevelopmentToRevenueTTM ? m.researchAndDevelopmentToRevenueTTM / 100 : null;
				capex_to_ocf = m.capexToOperatingCashFlowTTM ? m.capexToOperatingCashFlowTTM / 100 : null;
			}

			// Log the data for debugging
			// console.log(`Final stats for ${symbol}:`, {
			// 	market_cap, revenues, revenue_3y_cagr, revenue_1y_growth,
			// 	gross_profit_margin, operating_margin, ev_ebit, ev_sales,
			// 	p_ocf, p_fcf, capex_to_ocf, rd_to_revenue, debt_equity,
			// 	p_e, fcf_margin, total_cash, net_debt, dividend_yield
			// });

			await env.DB.prepare(`
				INSERT INTO market_stats (
					symbol, market_cap, revenues, revenue_3y_cagr, revenue_1y_growth,
					gross_profit_margin, operating_margin, ev_ebit, ev_sales,
					p_ocf, p_fcf, capex_to_ocf, rd_to_revenue, debt_equity,
					p_e, fcf_margin, total_cash, net_debt, dividend_yield,
					updated_at
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
				ON CONFLICT(symbol) DO UPDATE SET
					market_cap=excluded.market_cap,
					revenues=excluded.revenues,
					revenue_3y_cagr=excluded.revenue_3y_cagr,
					revenue_1y_growth=excluded.revenue_1y_growth,
					gross_profit_margin=excluded.gross_profit_margin,
					operating_margin=excluded.operating_margin,
					ev_ebit=excluded.ev_ebit,
					ev_sales=excluded.ev_sales,
					p_ocf=excluded.p_ocf,
					p_fcf=excluded.p_fcf,
					capex_to_ocf=excluded.capex_to_ocf,
					rd_to_revenue=excluded.rd_to_revenue,
					debt_equity=excluded.debt_equity,
					p_e=excluded.p_e,
					fcf_margin=excluded.fcf_margin,
					total_cash=excluded.total_cash,
					net_debt=excluded.net_debt,
					dividend_yield=excluded.dividend_yield,
					updated_at=CURRENT_TIMESTAMP
			`).bind(
				symbol, market_cap, revenues, revenue_3y_cagr, revenue_1y_growth,
				gross_profit_margin, operating_margin, ev_ebit, ev_sales,
				p_ocf, p_fcf, capex_to_ocf, rd_to_revenue, debt_equity,
				p_e, fcf_margin, total_cash, net_debt, dividend_yield
			).run();

		} catch (error) {
			console.error(`Error processing stats for ${symbol}:`, error);
		}
	}
}
