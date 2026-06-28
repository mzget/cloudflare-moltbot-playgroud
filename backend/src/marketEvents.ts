import { Env } from './index';

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

	const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
	const fromDateStrGeneral = thirtyDaysAgo.toISOString().split('T')[0];

	const thirtyDaysInFuture = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
	const toDateStrGeneral = thirtyDaysInFuture.toISOString().split('T')[0];

	for (const symbol of symbols) {
		try {
			// B. Dividends from Nasdaq (with fallback to Yahoo Finance if Nasdaq fails)
			let dividendsFetched = false;
			try {
				const nasdaqUrl = `https://api.nasdaq.com/api/quote/${encodeURIComponent(symbol)}/dividends?assetclass=stocks`;
				const nasdaqRes = await fetch(nasdaqUrl, {
					headers: {
						'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
						'Accept': 'application/json, text/plain, */*'
					}
				});
				if (nasdaqRes.ok) {
					const nasdaqData = await nasdaqRes.json() as any;
					const dividendRows = nasdaqData?.data?.dividends?.rows || [];
					if (dividendRows.length > 0) {
						const parseDate = (dStr: string) => {
							if (!dStr || dStr === 'N/A') return null;
							const parts = dStr.split('/');
							if (parts.length === 3) {
								return `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
							}
							return null;
						};

						for (const row of dividendRows) {
							const eventDate = parseDate(row.exOrEffDate);
							if (eventDate && eventDate >= fromDateStrGeneral && eventDate <= toDateStrGeneral) {
								const eventId = `div-${symbol}-${eventDate}`;
								const cleanAmount = row.amount ? row.amount.replace('$', '') : '';
								const title = `Dividend Declared: $${cleanAmount}`;
								
								const payDate = parseDate(row.paymentDate);
								const recordDate = parseDate(row.recordDate);
								const declarationDate = parseDate(row.declarationDate);
								
								let description = `Ex-Dividend Date: ${eventDate}`;
								if (payDate) description += `, Pay Date: ${payDate}`;

								const metadata = JSON.stringify({
									amount: parseFloat(cleanAmount) || cleanAmount,
									exDate: eventDate,
									payDate: payDate,
									recordDate: recordDate,
									declarationDate: declarationDate
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
						dividendsFetched = true;
					}
				}
			} catch (nasdaqError) {
				console.error(`Error fetching dividends from Nasdaq for ${symbol}:`, nasdaqError);
			}

			// C. Yahoo Finance: Splits (and Dividends if Nasdaq fallback needed)
			const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=3mo&events=div,split`;
			try {
				const yahooRes = await fetch(yahooUrl, {
					headers: {
						'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
					}
				});
				if (yahooRes.ok) {
					const data = await yahooRes.json() as any;
					const events = data?.chart?.result?.[0]?.events;
					if (events) {
						// Process dividends ONLY if not fetched from Nasdaq
						if (events.dividends && !dividendsFetched) {
							for (const key of Object.keys(events.dividends)) {
								const item = events.dividends[key];
								const eventDate = new Date(item.date * 1000).toISOString().split('T')[0];
								if (eventDate >= fromDateStrGeneral && eventDate <= toDateStrGeneral) {
									const eventId = `div-${symbol}-${eventDate}`;
									const title = `Dividend Declared: $${item.amount}`;
									const description = `Ex-Dividend Date: ${eventDate}`;
									const metadata = JSON.stringify({
										amount: item.amount,
										exDate: eventDate
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
						}

						// Process splits
						if (events.splits) {
							for (const key of Object.keys(events.splits)) {
								const item = events.splits[key];
								const eventDate = new Date(item.date * 1000).toISOString().split('T')[0];
								if (eventDate >= fromDateStrGeneral && eventDate <= toDateStrGeneral) {
									const eventId = `split-${symbol}-${eventDate}`;
									const title = `Stock Split: ${item.numerator} for ${item.denominator}`;
									const description = `Execution date: ${eventDate}`;
									const metadata = JSON.stringify({
										fromFactor: item.numerator,
										toFactor: item.denominator
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
						}
					}
				}
			} catch (yahooError) {
				console.error(`Error fetching/storing splits (or dividends fallback) from Yahoo for ${symbol}:`, yahooError);
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
