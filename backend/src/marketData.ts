import { Env } from './index';

// Returns true if the US stock market is currently open or in post-market close window (Mon-Fri, 9:30-16:30 ET).
// Uses America/New_York timezone to handle EDT/EST daylight saving transitions automatically.
export function isUSMarketOpen(targetDate: Date = new Date()): boolean {
	const formatter = new Intl.DateTimeFormat('en-US', {
		timeZone: 'America/New_York',
		hour12: false,
		weekday: 'short',
		hour: 'numeric',
		minute: 'numeric'
	});
	const parts = formatter.formatToParts(targetDate);
	let weekdayStr = '', hour = 0, minute = 0;
	for (const p of parts) {
		if (p.type === 'weekday') weekdayStr = p.value;
		if (p.type === 'hour') hour = parseInt(p.value, 10) % 24;
		if (p.type === 'minute') minute = parseInt(p.value, 10);
	}
	const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
	const day = dayMap[weekdayStr] ?? 0;
	if (day === 0 || day === 6) return false;

	const etMinutes = hour * 60 + minute;
	// 9:30 AM ET (570 mins) to 4:30 PM ET (990 mins - includes 30-min post-market grace period)
	return etMinutes >= (9 * 60 + 30) && etMinutes <= (16 * 60 + 30);
}

interface FinnhubResponse {
	metric?: Record<string, any>;
	symbol?: string;
	metricType?: string;
	series?: Record<string, any>;
}

export interface MarketStatsOptions {
	priceOnly?: boolean;
	metricsOnly?: boolean;
}

export async function fetchAndStoreMarketStats(env: Env, options: MarketStatsOptions = {}): Promise<{ symbol: string, success: boolean, price?: number | null, error?: string }[]> {
	const { priceOnly = false, metricsOnly = false } = options;
	const apiKey = env.FINNHUB_API_KEY;
	const runResults: { symbol: string, success: boolean, price?: number | null, error?: string }[] = [];
	
	const marketOpen = isUSMarketOpen();

	// Price-only mode: skip entirely when US market is closed
	if (priceOnly && !marketOpen) {
		console.log('Market is closed. Skipping price-only update.');
		return runResults;
	}

	let results: any[] = [];
	try {
		const dbResults = await env.DB.prepare(`
			SELECT w.symbol, m.updated_at, m.market_cap,
			       m.fifty_two_week_high, m.fifty_two_week_high_date,
			       m.fifty_two_week_low, m.fifty_two_week_low_date,
			       m.all_time_high, m.all_time_high_date,
			       m.all_time_low, m.all_time_low_date
			FROM watchlist w
			LEFT JOIN market_stats m ON w.symbol = m.symbol
			WHERE w.is_active = 1
			LIMIT 100
		`).all();
		results = dbResults.results || [];
	} catch (e) {
		console.error("D1 Query failed. Is 'market_stats' table created in remote?", e);
		return runResults;
	}
	if (results.length === 0) return runResults;

	const MAX_METRIC_FETCHES_PER_RUN = 15;
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


	const fetchFinnhub = async (symbol: string): Promise<FinnhubResponse | null> => {
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

	// Determine fetch directives based on US market open hours and options
	const shouldFetchQuote = marketOpen && !metricsOnly;
	const shouldFetchMetrics = (metricsOnly || (!priceOnly && !marketOpen)) && metricsSymbolsToUpdate.size > 0;

	// Filter active watchlist results based on options
	const resultsToProcess = shouldFetchQuote
		? results // Fetch quotes for all 100 symbols
		: (shouldFetchMetrics
			? results.filter(row => metricsSymbolsToUpdate.has(row.symbol as string)) // Fetch metrics for up to 15 symbols
			: [] // Do nothing if market is closed and no metrics need updating
		  );

	if (resultsToProcess.length === 0) {
		console.log('No price or metrics updates needed at this time.');
		return runResults;
	}

	const todayDate = new Date().toISOString().split('T')[0];
	const loggedEvents = new Set<string>();
	try {
		const dbEvents = await env.DB.prepare(`
			SELECT symbol, event_type FROM record_breaker_events WHERE event_date = ?1
		`).bind(todayDate).all();
		if (dbEvents.results) {
			for (const row of dbEvents.results) {
				const sym = String(row.symbol).toUpperCase();
				const evType = String(row.event_type);
				loggedEvents.add(`${sym}:${evType}`);
			}
		}
	} catch (e) {
		console.error("Failed to pre-fetch record_breaker_events:", e);
	}

	console.log(`Fetching market stats from Finnhub for ${resultsToProcess.length} symbols (FetchQuotes: ${shouldFetchQuote}, FetchMetrics: ${shouldFetchMetrics})...`);

	const chunkSize = 20; // Safe rate limit chunking (max 40 requests/minute)
	const resultChunks: any[][] = [];
	for (let i = 0; i < resultsToProcess.length; i += chunkSize) {
		resultChunks.push(resultsToProcess.slice(i, i + chunkSize));
	}

	const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

	for (let chunkIndex = 0; chunkIndex < resultChunks.length; chunkIndex++) {
		const chunk = resultChunks[chunkIndex];

		if (chunkIndex > 0) {
			console.log(`Rate limit guard: waiting 30 seconds before processing chunk ${chunkIndex + 1}...`);
			await delay(30000);
		}

		// 1. Fetch quote and metrics in parallel with a 50ms stagger to prevent API rate limit bursts
		const fetchPromises = chunk.map(async (row, idx) => {
			if (idx > 0) {
				await delay(idx * 50);
			}
			const symbol = row.symbol as string;
			const symbolFetchMetrics = shouldFetchMetrics && metricsSymbolsToUpdate.has(symbol);
			const symbolFetchQuote = shouldFetchQuote;

			let data: FinnhubResponse | null = null;
			let quoteDataResult: any = null;
			let quoteError: string | null = null;

			try {
				if (symbolFetchMetrics && symbolFetchQuote) {
					const [metricRes, quoteRes] = await Promise.all([
						fetchFinnhub(symbol),
						fetchQuote(symbol)
					]) as [FinnhubResponse | null, any];
					data = metricRes;
					quoteDataResult = quoteRes;
				} else if (symbolFetchMetrics) {
					data = await fetchFinnhub(symbol);
				} else if (symbolFetchQuote) {
					quoteDataResult = await fetchQuote(symbol);
				}

				if (symbolFetchMetrics && (!data || !data.metric)) {
					throw new Error(`Failed to fetch stats from Finnhub: No data returned for ${symbol}`);
				}
			} catch (e) {
				quoteError = (e as any).message || String(e);
			}

			return { row, data, quoteDataResult, quoteError, shouldFetchMetrics: symbolFetchMetrics, shouldFetchQuote: symbolFetchQuote };
		});

		const fetchedResults = await Promise.all(fetchPromises);

		// Array to collect DB batch write statements
		const batchStatements: any[] = [];

		// 2. Process results sequentially in memory
		for (const result of fetchedResults) {
			const { row, data, quoteDataResult, quoteError, shouldFetchMetrics, shouldFetchQuote } = result;
			const symbol = row.symbol as string;

			// Database fields
			let market_cap = null, revenues = null, revenue_3y_cagr = null, revenue_1y_growth = null, revenue_5y_cagr = null;
			let gross_profit_margin = null, operating_margin = null, ev_ebit = null, ev_sales = null;
			let p_ocf = null, p_fcf = null, capex_to_ocf = null, rd_to_revenue = null, debt_equity = null;
			let p_e = null, fcf_margin = null, total_cash = null, net_debt = null, total_debt = null, dividend_yield = null;
			let price = null;
			let previous_close = null, day_high = null, day_low = null, open_price = null;
			let finalQuoteError = quoteError;

			let fifty_two_week_high = row.fifty_two_week_high ?? null;
			let fifty_two_week_high_date = row.fifty_two_week_high_date ?? null;
			let fifty_two_week_low = row.fifty_two_week_low ?? null;
			let fifty_two_week_low_date = row.fifty_two_week_low_date ?? null;
			let all_time_high = row.all_time_high ?? null;
			let all_time_high_date = row.all_time_high_date ?? null;
			let all_time_low = row.all_time_low ?? null;
			let all_time_low_date = row.all_time_low_date ?? null;

			try {
				if (quoteError) {
					throw new Error(quoteError);
				}

				const m = data?.metric;
				const quoteData = quoteDataResult as any;
				if (quoteData && quoteData.error) {
					finalQuoteError = quoteData.error;
					price = null;
				} else if (quoteData) {
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
					if (m.cashPerSharePerShareQuarterly && revenues && m.revenuePerShareTTM && m.revenuePerShareTTM > 0) {
						const sharesOut = revenues / m.revenuePerShareTTM;
						total_cash = m.cashPerSharePerShareQuarterly * sharesOut;
					} else {
						total_cash = typeof m.cashAndCashEquivalents === 'number' ? m.cashAndCashEquivalents : null;
					}

					// Net Debt
					if (m.enterpriseValue && m.marketCapitalization) {
						net_debt = m.enterpriseValue - m.marketCapitalization;
					} else {
						net_debt = typeof m.netDebt === 'number' ? m.netDebt : null;
					}

					// Total Debt
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

					fifty_two_week_high = typeof m['52WeekHigh'] === 'number' ? m['52WeekHigh'] : fifty_two_week_high;
					fifty_two_week_high_date = typeof m['52WeekHighDate'] === 'string' ? m['52WeekHighDate'] : fifty_two_week_high_date;
					fifty_two_week_low = typeof m['52WeekLow'] === 'number' ? m['52WeekLow'] : fifty_two_week_low;
					fifty_two_week_low_date = typeof m['52WeekLowDate'] === 'string' ? m['52WeekLowDate'] : fifty_two_week_low_date;
				}

				// Breakout detection
				if (price && price > 0) {
					// 1. All-time High breakout
					if (all_time_high !== null && price >= all_time_high) {
						const key = `${symbol.toUpperCase()}:ath`;
						const logged = loggedEvents.has(key);

						if (!logged) {
							const msg = `${symbol} broke out to a new All-Time High of ${price}!`;
							await env.DB.batch([
								env.DB.prepare(`
									INSERT INTO in_app_notifications (symbol, metric, condition_type, target_value, trigger_value, message, is_read)
									VALUES (?1, 'ath', 'breakout', ?2, ?3, ?4, 0)
								`).bind(symbol, all_time_high, price, msg),
								env.DB.prepare(`
									INSERT INTO record_breaker_events (symbol, event_type, price, previous_record, event_date, is_notified)
									VALUES (?1, 'ath', ?2, ?3, ?4, 1)
								`).bind(symbol, price, all_time_high, todayDate)
							]);
							loggedEvents.add(key);
						}
						all_time_high = price;
						all_time_high_date = todayDate;
					} else if (all_time_high === null) {
						all_time_high = price;
						all_time_high_date = todayDate;
					}

					// 2. All-time Low breakdown
					if (all_time_low !== null && price <= all_time_low) {
						const key = `${symbol.toUpperCase()}:atl`;
						const logged = loggedEvents.has(key);

						if (!logged) {
							const msg = `${symbol} broke down to a new All-Time Low of ${price}!`;
							await env.DB.batch([
								env.DB.prepare(`
									INSERT INTO in_app_notifications (symbol, metric, condition_type, target_value, trigger_value, message, is_read)
									VALUES (?1, 'atl', 'breakdown', ?2, ?3, ?4, 0)
								`).bind(symbol, all_time_low, price, msg),
								env.DB.prepare(`
									INSERT INTO record_breaker_events (symbol, event_type, price, previous_record, event_date, is_notified)
									VALUES (?1, 'atl', ?2, ?3, ?4, 1)
								`).bind(symbol, price, all_time_low, todayDate)
							]);
							loggedEvents.add(key);
						}
						all_time_low = price;
						all_time_low_date = todayDate;
					} else if (all_time_low === null) {
						all_time_low = price;
						all_time_low_date = todayDate;
					}

					// 3. 52-week High breakout
					if (fifty_two_week_high !== null && price >= fifty_two_week_high) {
						const key = `${symbol.toUpperCase()}:52w_high`;
						const logged = loggedEvents.has(key);

						if (!logged) {
							const msg = `${symbol} broke out to a new 52-week high of ${price}!`;
							await env.DB.batch([
								env.DB.prepare(`
									INSERT INTO in_app_notifications (symbol, metric, condition_type, target_value, trigger_value, message, is_read)
									VALUES (?1, '52w_high', 'breakout', ?2, ?3, ?4, 0)
								`).bind(symbol, fifty_two_week_high, price, msg),
								env.DB.prepare(`
									INSERT INTO record_breaker_events (symbol, event_type, price, previous_record, event_date, is_notified)
									VALUES (?1, '52w_high', ?2, ?3, ?4, 1)
								`).bind(symbol, price, fifty_two_week_high, todayDate)
							]);
							loggedEvents.add(key);
						}
						fifty_two_week_high = price;
						fifty_two_week_high_date = todayDate;
					}

					// 4. 52-week Low breakdown
					if (fifty_two_week_low !== null && price <= fifty_two_week_low) {
						const key = `${symbol.toUpperCase()}:52w_low`;
						const logged = loggedEvents.has(key);

						if (!logged) {
							const msg = `${symbol} broke down to a new 52-week low of ${price}!`;
							await env.DB.batch([
								env.DB.prepare(`
									INSERT INTO in_app_notifications (symbol, metric, condition_type, target_value, trigger_value, message, is_read)
									VALUES (?1, '52w_low', 'breakdown', ?2, ?3, ?4, 0)
								`).bind(symbol, fifty_two_week_low, price, msg),
								env.DB.prepare(`
									INSERT INTO record_breaker_events (symbol, event_type, price, previous_record, event_date, is_notified)
									VALUES (?1, '52w_low', ?2, ?3, ?4, 1)
								`).bind(symbol, price, fifty_two_week_low, todayDate)
							]);
							loggedEvents.add(key);
						}
						fifty_two_week_low = price;
						fifty_two_week_low_date = todayDate;
					}
				}

				console.log(`Final stats for ${symbol}: price=${price}, mc=${market_cap}, p_e=${p_e}`);

				const currentUtcString = new Date().toISOString().replace('T', ' ').slice(0, 19);
				const updatedAtVal = shouldFetchMetrics ? currentUtcString : null;

				const stmt = env.DB.prepare(`
					INSERT INTO market_stats (
						symbol, market_cap, revenues, revenue_3y_cagr, revenue_1y_growth, revenue_5y_cagr,
						gross_profit_margin, operating_margin, ev_ebit, ev_sales,
						p_ocf, p_fcf, capex_to_ocf, rd_to_revenue, debt_equity,
						p_e, fcf_margin, total_cash, net_debt, total_debt, dividend_yield,
						price, previous_close, day_high, day_low, open_price, updated_at,
						fifty_two_week_high, fifty_two_week_high_date, fifty_two_week_low, fifty_two_week_low_date,
						all_time_high, all_time_high_date, all_time_low, all_time_low_date
					) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
						updated_at=COALESCE(excluded.updated_at, market_stats.updated_at),
						fifty_two_week_high=CASE WHEN excluded.updated_at IS NOT NULL THEN excluded.fifty_two_week_high ELSE market_stats.fifty_two_week_high END,
						fifty_two_week_high_date=CASE WHEN excluded.updated_at IS NOT NULL THEN excluded.fifty_two_week_high_date ELSE market_stats.fifty_two_week_high_date END,
						fifty_two_week_low=CASE WHEN excluded.updated_at IS NOT NULL THEN excluded.fifty_two_week_low ELSE market_stats.fifty_two_week_low END,
						fifty_two_week_low_date=CASE WHEN excluded.updated_at IS NOT NULL THEN excluded.fifty_two_week_low_date ELSE market_stats.fifty_two_week_low_date END,
						all_time_high=CASE WHEN excluded.updated_at IS NOT NULL THEN excluded.all_time_high ELSE market_stats.all_time_high END,
						all_time_high_date=CASE WHEN excluded.updated_at IS NOT NULL THEN excluded.all_time_high_date ELSE market_stats.all_time_high_date END,
						all_time_low=CASE WHEN excluded.updated_at IS NOT NULL THEN excluded.all_time_low ELSE market_stats.all_time_low END,
						all_time_low_date=CASE WHEN excluded.updated_at IS NOT NULL THEN excluded.all_time_low_date ELSE market_stats.all_time_low_date END
				`).bind(
					symbol, market_cap, revenues, revenue_3y_cagr, revenue_1y_growth, revenue_5y_cagr,
					gross_profit_margin, operating_margin, ev_ebit, ev_sales,
					p_ocf, p_fcf, capex_to_ocf, rd_to_revenue, debt_equity,
					p_e, fcf_margin, total_cash, net_debt, total_debt, dividend_yield,
					price, previous_close, day_high, day_low, open_price, updatedAtVal,
					fifty_two_week_high, fifty_two_week_high_date, fifty_two_week_low, fifty_two_week_low_date,
					all_time_high, all_time_high_date, all_time_low, all_time_low_date
				);

				batchStatements.push(stmt);
				runResults.push({ symbol, success: true, price, error: finalQuoteError || undefined });
			} catch (error) {
				console.error(`Error processing stats for ${symbol}:`, error);
				runResults.push({ symbol, success: false, error: (error as any).message });
			}
		}

		// 3. Execute database upserts in a single batch
		if (batchStatements.length > 0) {
			try {
				await env.DB.batch(batchStatements);
			} catch (dbError) {
				console.error(`Database batch update failed for chunk ${chunkIndex + 1}:`, dbError);
				// Mark symbols in this chunk as failed since DB update failed
				for (const row of chunk) {
					const symbol = row.symbol as string;
					const idx = runResults.findIndex(r => r.symbol === symbol);
					if (idx !== -1) {
						runResults[idx] = { symbol, success: false, error: `DB batch failed: ${(dbError as any).message}` };
					}
				}
			}
		}
	}
	return runResults;
}

