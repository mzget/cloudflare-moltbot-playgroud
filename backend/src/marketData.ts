import { Env } from './index';

interface FinnhubResponse {
	metric?: Record<string, any>;
	symbol?: string;
	metricType?: string;
	series?: Record<string, any>;
}

export async function fetchAndStoreMarketStats(env: Env): Promise<{ symbol: string, success: boolean, price?: number | null, error?: string }[]> {
	const apiKey = env.FINNHUB_API_KEY;
	const runResults: { symbol: string, success: boolean, price?: number | null, error?: string }[] = [];
	if (!apiKey) {
		console.warn('FINNHUB_API_KEY is not set. Skipping market stats update.');
		return runResults;
	}

	let results: any[] = [];
	try {
		const dbResults = await env.DB.prepare(`
			SELECT w.symbol, m.updated_at, m.market_cap
			FROM watchlist w
			LEFT JOIN market_stats m ON w.symbol = m.symbol
			WHERE w.is_active = 1
			LIMIT 30
		`).all();
		results = dbResults.results || [];
	} catch (e) {
		console.error("D1 Query failed. Is 'market_stats' table created in remote?", e);
		return runResults;
	}
	if (results.length === 0) return runResults;

	const MAX_METRIC_FETCHES_PER_RUN = 5;
	const metricsSymbolsToUpdate = new Set<string>();

	// Sort a copy of the results to prioritize which ones need metrics update (missing first, then oldest updated)
	const prioritizedForMetrics = [...results].sort((a, b) => {
		const aHasStats = a.updated_at !== null && a.market_cap !== null;
		const bHasStats = b.updated_at !== null && b.market_cap !== null;
		if (!aHasStats && bHasStats) return -1;
		if (aHasStats && !bHasStats) return 1;
		if (!aHasStats && !bHasStats) return 0;
		
		const parseTime = (val: any) => {
			if (!val) return 0;
			const num = Number(val);
			if (!isNaN(num)) {
				return num < 100000000000 ? num * 1000 : num;
			}
			const utcStr = String(val).replace(' ', 'T') + 'Z';
			return Date.parse(utcStr) || 0;
		};

		return parseTime(a.updated_at) - parseTime(b.updated_at);
	});

	let metricFetchCount = 0;
	const oneDayAgoMs = Date.now() - 24 * 60 * 60 * 1000;

	for (const row of prioritizedForMetrics) {
		if (metricFetchCount >= MAX_METRIC_FETCHES_PER_RUN) break;

		const lastUpdated = row.updated_at;
		let needsMetrics = false;
		if (!lastUpdated || !row.market_cap) {
			needsMetrics = true;
		} else {
			let lastUpdatedMs = 0;
			const num = Number(lastUpdated);
			if (!isNaN(num)) {
				lastUpdatedMs = num < 100000000000 ? num * 1000 : num;
			} else {
				const utcStr = String(lastUpdated).replace(' ', 'T') + 'Z';
				lastUpdatedMs = Date.parse(utcStr) || 0;
			}
			if (lastUpdatedMs < oneDayAgoMs) {
				needsMetrics = true;
			}
		}

		if (needsMetrics) {
			metricsSymbolsToUpdate.add(row.symbol as string);
			metricFetchCount++;
		}
	}


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

	const fetchQuote = async (symbol: string) => {
		const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`;
		try {
			const response = await fetch(url);
			if (response.ok) {
				return await response.json();
			}
			return { error: `HTTP ${response.status} ${response.statusText}` };
		} catch (e) {
			return { error: (e as any).message || String(e) };
		}
	};

	console.log(`Fetching market stats from Finnhub for ${results.length} symbols...`);

	for (const row of results) {
		const symbol = row.symbol as string;

		// Database fields
		let market_cap = null, revenues = null, revenue_3y_cagr = null, revenue_1y_growth = null, revenue_5y_cagr = null;
		let gross_profit_margin = null, operating_margin = null, ev_ebit = null, ev_sales = null;
		let p_ocf = null, p_fcf = null, capex_to_ocf = null, rd_to_revenue = null, debt_equity = null;
		let p_e = null, fcf_margin = null, total_cash = null, net_debt = null, total_debt = null, dividend_yield = null;
		let price = null;
		let previous_close = null, day_high = null, day_low = null, open_price = null;
		let quoteError = null;

		const shouldFetchMetrics = metricsSymbolsToUpdate.has(symbol);

		try {
			let data: FinnhubResponse | null = null;
			let quoteDataResult: any = null;

			if (shouldFetchMetrics) {
				const [metricRes, quoteRes] = await Promise.all([
					fetchFinnhub(symbol),
					fetchQuote(symbol)
				]) as [FinnhubResponse | null, any];
				data = metricRes;
				quoteDataResult = quoteRes;
			} else {
				quoteDataResult = await fetchQuote(symbol);
			}

			if (shouldFetchMetrics && (!data || !data.metric)) {
				throw new Error(`Failed to fetch stats from Finnhub: No data returned for ${symbol}`);
			}

			const m = data?.metric;
			const quoteData = quoteDataResult as any;
			if (quoteData && quoteData.error) {
				quoteError = quoteData.error;
				price = null;
			} else {
				price = quoteData?.c ?? null;
				previous_close = quoteData?.pc ?? null;
				day_high = quoteData?.h ?? null;
				day_low = quoteData?.l ?? null;
				open_price = quoteData?.o ?? null;
			}

			if (m) {
				// Basic Valuation & Stats
				market_cap = m.marketCapitalization ?? null;
				p_e = m.peBasicExclExtraTTM || m.peTTM || null;
				dividend_yield = typeof m.dividendYieldIndicatedAnnual === 'number'
					? m.dividendYieldIndicatedAnnual / 100
					: (typeof m.dividendYieldTTM === 'number' ? m.dividendYieldTTM / 100 : null);

				// Margins (Finnhub provides these as percentages, convert to decimals)
				gross_profit_margin = typeof m.grossMarginTTM === 'number' ? m.grossMarginTTM / 100 : null;
				operating_margin = typeof m.operatingMarginTTM === 'number' ? m.operatingMarginTTM / 100 : null;
				fcf_margin = typeof m.freeCashFlowMarginTTM === 'number' ? m.freeCashFlowMarginTTM / 100 : null;

				// Growth
				revenue_1y_growth = typeof m.revenueGrowthTTMYoy === 'number'
					? m.revenueGrowthTTMYoy / 100
					: (typeof m.revenueGrowthTTM === 'number' ? m.revenueGrowthTTM / 100 : null);
				revenue_3y_cagr = typeof m.revenueGrowth3Y === 'number' ? m.revenueGrowth3Y / 100 : null;
				revenue_5y_cagr = typeof m.revenueGrowth5Y === 'number' ? m.revenueGrowth5Y / 100 : null;

				// Ratios
				// Note: Finnhub's pcfShareTTM stands for 'Price to Cash Flow per share', where Cash Flow is Operating Cash Flow.
				p_ocf = typeof m.pcfShareTTM === 'number' ? m.pcfShareTTM : null;
				p_fcf = typeof m.pfcfShareTTM === 'number' ? m.pfcfShareTTM : null;

				// Debt / Equity: Provided directly as a ratio (e.g. 0.79 means 79%)
				debt_equity = typeof m.totalDebtToEquityTTM === 'number'
					? m.totalDebtToEquityTTM
					: (typeof m['totalDebt/totalEquityQuarterly'] === 'number' ? m['totalDebt/totalEquityQuarterly'] : null);
				
				// Calculate revenues if possible since Finnhub doesn't always provide absolute TTM revenue
				if (m.marketCapitalization && m.psTTM && m.psTTM > 0) {
					revenues = m.marketCapitalization / m.psTTM;
				}

				// Enterprise Value based ratios
				ev_sales = typeof m.evRevenueTTM === 'number' ? m.evRevenueTTM : null;
				
				// Calculate EV / Operating Income (EBIT) instead of EBITDA
				if (m.enterpriseValue && revenues && operating_margin && operating_margin !== 0) {
					ev_ebit = m.enterpriseValue / (revenues * operating_margin);
				} else {
					ev_ebit = null;
				}

				// Free Cash Flow Margin
				if (m.psTTM && m.pfcfShareTTM && m.pfcfShareTTM > 0) {
					fcf_margin = m.psTTM / m.pfcfShareTTM;
				}

				// Financial Health
				// Total Cash = Cash per share * Shares Outstanding
				// Shares Outstanding = revenues / revenuePerShareTTM
				if (m.cashPerSharePerShareQuarterly && revenues && m.revenuePerShareTTM && m.revenuePerShareTTM > 0) {
					const sharesOut = revenues / m.revenuePerShareTTM;
					total_cash = m.cashPerSharePerShareQuarterly * sharesOut;
				} else {
					total_cash = typeof m.cashAndCashEquivalents === 'number' ? m.cashAndCashEquivalents : null;
				}

				// Net Debt
				// Net Debt = Enterprise Value - Market Cap
				if (m.enterpriseValue && m.marketCapitalization) {
					net_debt = m.enterpriseValue - m.marketCapitalization;
				} else {
					net_debt = typeof m.netDebt === 'number' ? m.netDebt : null;
				}

				// Total Debt
				// Calculate from Long Term Debt and Short Term Debt if available
				if (typeof m.longTermDebt === 'number' && typeof m.shortTermDebt === 'number') {
					total_debt = m.longTermDebt + m.shortTermDebt;
				} else if (typeof m.totalDebt === 'number') {
					total_debt = m.totalDebt;
				} else if (net_debt !== null && total_cash !== null) {
					total_debt = net_debt + total_cash;
				} else {
					total_debt = null;
				}

				// Specific Metrics
				rd_to_revenue = typeof m.researchAndDevelopmentToRevenueTTM === 'number' ? m.researchAndDevelopmentToRevenueTTM / 100 : null;
				if (p_ocf !== null && p_fcf !== null && p_fcf !== 0) {
					capex_to_ocf = 1 - (p_ocf / p_fcf);
				} else {
					capex_to_ocf = typeof m.capexToOperatingCashFlowTTM === 'number' ? m.capexToOperatingCashFlowTTM / 100 : null;
				}
			}

			// Log the data for debugging
			console.log(`Final stats for ${symbol}: price=${price}, mc=${market_cap}, p_e=${p_e}`);

			const currentUtcString = new Date().toISOString().replace('T', ' ').slice(0, 19);
			const updatedAtVal = shouldFetchMetrics ? currentUtcString : null;

			await env.DB.prepare(`
				INSERT INTO market_stats (
					symbol, market_cap, revenues, revenue_3y_cagr, revenue_1y_growth, revenue_5y_cagr,
					gross_profit_margin, operating_margin, ev_ebit, ev_sales,
					p_ocf, p_fcf, capex_to_ocf, rd_to_revenue, debt_equity,
					p_e, fcf_margin, total_cash, net_debt, total_debt, dividend_yield,
					price, previous_close, day_high, day_low, open_price, updated_at
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
				ON CONFLICT(symbol) DO UPDATE SET
					market_cap=CASE WHEN excluded.updated_at IS NOT NULL THEN excluded.market_cap ELSE market_stats.market_cap END,
					revenues=CASE WHEN excluded.updated_at IS NOT NULL THEN excluded.revenues ELSE market_stats.revenues END,
					revenue_3y_cagr=CASE WHEN excluded.updated_at IS NOT NULL THEN excluded.revenue_3y_cagr ELSE market_stats.revenue_3y_cagr END,
					revenue_1y_growth=CASE WHEN excluded.updated_at IS NOT NULL THEN excluded.revenue_1y_growth ELSE market_stats.revenue_1y_growth END,
					revenue_5y_cagr=CASE WHEN excluded.updated_at IS NOT NULL THEN excluded.revenue_5y_cagr ELSE market_stats.revenue_5y_cagr END,
					gross_profit_margin=CASE WHEN excluded.updated_at IS NOT NULL THEN excluded.gross_profit_margin ELSE market_stats.gross_profit_margin END,
					operating_margin=CASE WHEN excluded.updated_at IS NOT NULL THEN excluded.operating_margin ELSE market_stats.operating_margin END,
					ev_ebit=CASE WHEN excluded.updated_at IS NOT NULL THEN excluded.ev_ebit ELSE market_stats.ev_ebit END,
					ev_sales=CASE WHEN excluded.updated_at IS NOT NULL THEN excluded.ev_sales ELSE market_stats.ev_sales END,
					p_ocf=CASE WHEN excluded.updated_at IS NOT NULL THEN excluded.p_ocf ELSE market_stats.p_ocf END,
					p_fcf=CASE WHEN excluded.updated_at IS NOT NULL THEN excluded.p_fcf ELSE market_stats.p_fcf END,
					capex_to_ocf=CASE WHEN excluded.updated_at IS NOT NULL THEN excluded.capex_to_ocf ELSE market_stats.capex_to_ocf END,
					rd_to_revenue=CASE WHEN excluded.updated_at IS NOT NULL THEN excluded.rd_to_revenue ELSE market_stats.rd_to_revenue END,
					debt_equity=CASE WHEN excluded.updated_at IS NOT NULL THEN excluded.debt_equity ELSE market_stats.debt_equity END,
					p_e=CASE WHEN excluded.updated_at IS NOT NULL THEN excluded.p_e ELSE market_stats.p_e END,
					fcf_margin=CASE WHEN excluded.updated_at IS NOT NULL THEN excluded.fcf_margin ELSE market_stats.fcf_margin END,
					total_cash=CASE WHEN excluded.updated_at IS NOT NULL THEN excluded.total_cash ELSE market_stats.total_cash END,
					net_debt=CASE WHEN excluded.updated_at IS NOT NULL THEN excluded.net_debt ELSE market_stats.net_debt END,
					total_debt=CASE WHEN excluded.updated_at IS NOT NULL THEN excluded.total_debt ELSE market_stats.total_debt END,
					dividend_yield=CASE WHEN excluded.updated_at IS NOT NULL THEN excluded.dividend_yield ELSE market_stats.dividend_yield END,
					price=COALESCE(excluded.price, market_stats.price),
					previous_close=COALESCE(excluded.previous_close, market_stats.previous_close),
					day_high=COALESCE(excluded.day_high, market_stats.day_high),
					day_low=COALESCE(excluded.day_low, market_stats.day_low),
					open_price=COALESCE(excluded.open_price, market_stats.open_price),
					updated_at=COALESCE(excluded.updated_at, market_stats.updated_at)
			`).bind(
				symbol, market_cap, revenues, revenue_3y_cagr, revenue_1y_growth, revenue_5y_cagr,
				gross_profit_margin, operating_margin, ev_ebit, ev_sales,
				p_ocf, p_fcf, capex_to_ocf, rd_to_revenue, debt_equity,
				p_e, fcf_margin, total_cash, net_debt, total_debt, dividend_yield,
				price, previous_close, day_high, day_low, open_price, updatedAtVal
			).run();

			runResults.push({ symbol, success: true, price, error: quoteError });
		} catch (error) {
			console.error(`Error processing stats for ${symbol}:`, error);
			runResults.push({ symbol, success: false, error: (error as any).message });
		}
	}
	return runResults;
}

