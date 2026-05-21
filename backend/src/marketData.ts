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
		let market_cap = null, revenues = null, revenue_3y_cagr = null, revenue_1y_growth = null, revenue_5y_cagr = null;
		let gross_profit_margin = null, operating_margin = null, ev_ebit = null, ev_sales = null;
		let p_ocf = null, p_fcf = null, capex_to_ocf = null, rd_to_revenue = null, debt_equity = null;
		let p_e = null, fcf_margin = null, total_cash = null, net_debt = null, total_debt = null, dividend_yield = null;

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
				revenue_1y_growth = m.revenueGrowthTTMYoy ? m.revenueGrowthTTMYoy / 100 : (m.revenueGrowthTTM ? m.revenueGrowthTTM / 100 : null);
				revenue_3y_cagr = m.revenueGrowth3Y ? m.revenueGrowth3Y / 100 : null;
				revenue_5y_cagr = m.revenueGrowth5Y ? m.revenueGrowth5Y / 100 : null;

				// Ratios
				// Note: Finnhub's pcfShareTTM stands for 'Price to Cash Flow per share', where Cash Flow is Operating Cash Flow.
				p_ocf = m.pcfShareTTM || null;
				p_fcf = m.pfcfShareTTM || null;

				// Debt / Equity: Provided directly as a ratio (e.g. 0.79 means 79%)
				debt_equity = m.totalDebtToEquityTTM ? m.totalDebtToEquityTTM : (m['totalDebt/totalEquityQuarterly'] ? m['totalDebt/totalEquityQuarterly'] : null);
				
				// Calculate revenues if possible since Finnhub doesn't always provide absolute TTM revenue
				if (m.marketCapitalization && m.psTTM && m.psTTM > 0) {
					revenues = m.marketCapitalization / m.psTTM;
				}

				// Enterprise Value based ratios
				ev_sales = m.evRevenueTTM || null;
				
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
					total_cash = m.cashAndCashEquivalents || null;
				}

				// Net Debt
				// Net Debt = Enterprise Value - Market Cap
				if (m.enterpriseValue && m.marketCapitalization) {
					net_debt = m.enterpriseValue - m.marketCapitalization;
				} else {
					net_debt = m.netDebt || null;
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
					symbol, market_cap, revenues, revenue_3y_cagr, revenue_1y_growth, revenue_5y_cagr,
					gross_profit_margin, operating_margin, ev_ebit, ev_sales,
					p_ocf, p_fcf, capex_to_ocf, rd_to_revenue, debt_equity,
					p_e, fcf_margin, total_cash, net_debt, total_debt, dividend_yield,
					updated_at
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
				ON CONFLICT(symbol) DO UPDATE SET
					market_cap=excluded.market_cap,
					revenues=excluded.revenues,
					revenue_3y_cagr=excluded.revenue_3y_cagr,
					revenue_1y_growth=excluded.revenue_1y_growth,
					revenue_5y_cagr=excluded.revenue_5y_cagr,
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
					total_debt=excluded.total_debt,
					dividend_yield=excluded.dividend_yield,
					updated_at=CURRENT_TIMESTAMP
			`).bind(
				symbol, market_cap, revenues, revenue_3y_cagr, revenue_1y_growth, revenue_5y_cagr,
				gross_profit_margin, operating_margin, ev_ebit, ev_sales,
				p_ocf, p_fcf, capex_to_ocf, rd_to_revenue, debt_equity,
				p_e, fcf_margin, total_cash, net_debt, total_debt, dividend_yield
			).run();

		} catch (error) {
			console.error(`Error processing stats for ${symbol}:`, error);
		}
	}
}

export async function fetchAndStoreMarketEvents(env: Env): Promise<void> {
	const apiKey = env.FINNHUB_API_KEY;
	if (!apiKey) {
		console.warn('FINNHUB_API_KEY is not set. Skipping market events update.');
		return;
	}

	// 1. Ensure table exists
	try {
		await env.DB.prepare(`
			CREATE TABLE IF NOT EXISTS market_events (
				id TEXT PRIMARY KEY,
				symbol TEXT NOT NULL,
				event_type TEXT NOT NULL,
				event_date TEXT NOT NULL,
				title TEXT NOT NULL,
				description TEXT,
				url TEXT,
				metadata TEXT,
				created_at INTEGER DEFAULT (strftime('%s', 'now'))
			)
		`).run();
	} catch (e) {
		console.error("Failed to ensure market_events table exists", e);
		return;
	}

	// 2. Query active watchlist symbols
	let symbolsRes: any[] = [];
	try {
		const dbResults = await env.DB.prepare(`
			SELECT symbol FROM watchlist WHERE is_active = 1
		`).all();
		symbolsRes = dbResults.results || [];
	} catch (e) {
		console.error("Failed to fetch watchlist symbols", e);
		return;
	}
	if (symbolsRes.length === 0) return;

	const symbols = symbolsRes.map(row => row.symbol as string);
	console.log(`Fetching market events from Finnhub for symbols: ${symbols.join(', ')}`);

	// Date calculations
	const now = new Date();
	const toDateStr = now.toISOString().split('T')[0];
	
	const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
	const fromDateStrNews = sevenDaysAgo.toISOString().split('T')[0];

	const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
	const fromDateStrGeneral = thirtyDaysAgo.toISOString().split('T')[0];

	const thirtyDaysInFuture = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
	const toDateStrGeneral = thirtyDaysInFuture.toISOString().split('T')[0];

	for (const symbol of symbols) {
		try {
			// A. Company News (Press Releases)
			const newsUrl = `https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${fromDateStrNews}&to=${toDateStr}&token=${apiKey}`;
			const newsRes = await fetch(newsUrl);
			if (newsRes.ok) {
				const newsItems = await newsRes.json() as any[];
				for (const item of newsItems) {
					const eventId = `news-${item.id}`;
					const eventDate = new Date(item.datetime * 1000).toISOString();
					const metadata = JSON.stringify({ source: item.source });
					
					await env.DB.prepare(`
						INSERT INTO market_events (id, symbol, event_type, event_date, title, description, url, metadata)
						VALUES (?, ?, 'news', ?, ?, ?, ?, ?)
						ON CONFLICT(id) DO UPDATE SET
							title=excluded.title,
							description=excluded.description,
							url=excluded.url,
							metadata=excluded.metadata
					`).bind(eventId, symbol, eventDate, item.headline, item.summary || '', item.url || '', metadata).run();
				}
			}

			// B. Dividends
			const divUrl = `https://finnhub.io/api/v1/stock/dividend?symbol=${symbol}&from=${fromDateStrGeneral}&to=${toDateStrGeneral}&token=${apiKey}`;
			const divRes = await fetch(divUrl);
			if (divRes.ok) {
				const divItems = await divRes.json() as any[];
				for (const item of divItems) {
					const eventId = `div-${symbol}-${item.date}`;
					const eventDate = item.date;
					const title = `Dividend Declared: $${item.amount}`;
					const description = `Record date: ${item.recordDate || 'N/A'}, Pay date: ${item.payDate || 'N/A'}`;
					const metadata = JSON.stringify({
						amount: item.amount,
						recordDate: item.recordDate,
						payDate: item.payDate,
						declarationDate: item.declarationDate
					});

					await env.DB.prepare(`
						INSERT INTO market_events (id, symbol, event_type, event_date, title, description, url, metadata)
						VALUES (?, ?, 'dividend', ?, ?, ?, NULL, ?)
						ON CONFLICT(id) DO UPDATE SET
							title=excluded.title,
							description=excluded.description,
							metadata=excluded.metadata
					`).bind(eventId, symbol, eventDate, title, description, metadata).run();
				}
			}

			// C. Splits
			const splitUrl = `https://finnhub.io/api/v1/stock/split?symbol=${symbol}&from=${fromDateStrGeneral}&to=${toDateStrGeneral}&token=${apiKey}`;
			const splitRes = await fetch(splitUrl);
			if (splitRes.ok) {
				const splitItems = await splitRes.json() as any[];
				for (const item of splitItems) {
					const eventId = `split-${symbol}-${item.date}`;
					const eventDate = item.date;
					const title = `Stock Split: ${item.fromFactor} for ${item.toFactor}`;
					const description = `Execution date: ${item.date}`;
					const metadata = JSON.stringify({
						fromFactor: item.fromFactor,
						toFactor: item.toFactor
					});

					await env.DB.prepare(`
						INSERT INTO market_events (id, symbol, event_type, event_date, title, description, url, metadata)
						VALUES (?, ?, 'split', ?, ?, ?, NULL, ?)
						ON CONFLICT(id) DO UPDATE SET
							title=excluded.title,
							description=excluded.description,
							metadata=excluded.metadata
					`).bind(eventId, symbol, eventDate, title, description, metadata).run();
				}
			}

			// D. Earnings Calendar
			const earningsUrl = `https://finnhub.io/api/v1/calendar/earnings?symbol=${symbol}&from=${fromDateStrGeneral}&to=${toDateStrGeneral}&token=${apiKey}`;
			const earningsRes = await fetch(earningsUrl);
			if (earningsRes.ok) {
				const data = await earningsRes.json() as any;
				const earningsItems = data.earningsCalendar || [];
				for (const item of earningsItems) {
					const eventId = `earnings-${symbol}-${item.date}`;
					const eventDate = item.date;
					
					let title = `${symbol} Earnings Release`;
					if (item.quarter && item.year) {
						title = `${symbol} Q${item.quarter} ${item.year} Earnings Release`;
					}
					
					let description = '';
					if (item.epsEstimate !== null || item.epsActual !== null) {
						description += `EPS Est: ${item.epsEstimate ?? 'N/A'}, Act: ${item.epsActual ?? 'N/A'}. `;
					}
					if (item.revenueEstimate !== null || item.revenueActual !== null) {
						description += `Revenue Est: ${item.revenueEstimate ? '$' + (item.revenueEstimate / 1e9).toFixed(2) + 'B' : 'N/A'}, Act: ${item.revenueActual ? '$' + (item.revenueActual / 1e9).toFixed(2) + 'B' : 'N/A'}.`;
					}
					if (!description) {
						description = `Earnings date announcement. Hour: ${item.hour || 'N/A'}`;
					}

					const metadata = JSON.stringify({
						epsActual: item.epsActual,
						epsEstimate: item.epsEstimate,
						revenueActual: item.revenueActual,
						revenueEstimate: item.revenueEstimate,
						quarter: item.quarter,
						year: item.year,
						hour: item.hour
					});

					await env.DB.prepare(`
						INSERT INTO market_events (id, symbol, event_type, event_date, title, description, url, metadata)
						VALUES (?, ?, 'earnings', ?, ?, ?, NULL, ?)
						ON CONFLICT(id) DO UPDATE SET
							title=excluded.title,
							description=excluded.description,
							metadata=excluded.metadata
					`).bind(eventId, symbol, eventDate, title, description, metadata).run();
				}
			}

			// Small sleep to avoid rate limits
			await new Promise(resolve => setTimeout(resolve, 100));
		} catch (symbolError) {
			console.error(`Error fetching market events for ${symbol}:`, symbolError);
		}
	}
}

