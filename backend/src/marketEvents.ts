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
