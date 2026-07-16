export interface BreakoutResult {
	symbol: string;
	name: string;
	price: number;
	percentChange: number;
	yearHigh: number;
	yearLow: number;
	breakoutType: '52w_high' | '52w_low';
}

export async function scanMarketBreakouts(db: any, fmpApiKey: string, scope: 'watchlist' | 'market' = 'watchlist'): Promise<BreakoutResult[]> {
	console.log(`[MarketScanner] Starting ${scope} breakout scan using TradingView API...`);
	const allBreakouts: BreakoutResult[] = [];
	const todayDate = new Date().toISOString().split('T')[0];

	// For watchlist scope, fetch watchlist symbols first
	let watchlistSymbols: Set<string> | null = null;
	if (scope === 'watchlist') {
		try {
			const watchlistRes = await db.prepare('SELECT symbol FROM watchlist WHERE is_active = 1').all();
			const symbols = (watchlistRes.results || []).map((r: any) => r.symbol.toUpperCase());
			if (symbols.length === 0) {
				console.log('[MarketScanner] No active watchlist symbols. Skipping scan.');
				return [];
			}
			watchlistSymbols = new Set(symbols);
			console.log(`[MarketScanner] Scanning ${symbols.length} watchlist symbols: ${symbols.join(', ')}`);
		} catch (error) {
			console.error('[MarketScanner] Failed to fetch watchlist:', error);
			return [];
		}
	}

	try {
		const tvUrl = 'https://scanner.tradingview.com/america/scan';
		const body: any = {
			columns: ['name', 'description', 'close', 'change', 'price_52_week_high', 'price_52_week_low'],
			filter: [] as any[],
		};

		if (scope === 'watchlist') {
			// Query only watchlist symbols via name filter
			body.filter.push({
				left: 'name',
				operation: 'in_range',
				right: Array.from(watchlistSymbols!)
			});
		} else {
			// Full market scan
			body.filter.push({
				left: 'type',
				operation: 'in_range',
				right: ['stock', 'dr']
			});
			body.range = [0, 25000];
		}

		const res = await fetch(tvUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
			},
			body: JSON.stringify(body)
		});

		if (!res.ok) {
			throw new Error(`Failed to fetch TradingView quotes: ${res.statusText}`);
		}

		const json = (await res.json()) as { data: { s: string; d: any[] }[] };
		console.log(`[MarketScanner] Received ${json.data.length} quotes from TradingView`);

		for (const item of json.data) {
			const symbolWithExchange = item.s; // e.g. "NASDAQ:AAPL"
			const parts = symbolWithExchange.split(':');
			if (parts.length < 2) continue;
			const exchange = parts[0];
			const symbol = parts[1];

			// Filter exchanges
			if (exchange !== 'NASDAQ' && exchange !== 'NYSE' && exchange !== 'AMEX') continue;
			// Skip options, warrants, preferreds, etc. (only for market scope)
			if (scope === 'market' && (symbol.includes('.') || symbol.includes('-') || symbol.length > 5)) continue;

			const [name, description, price, percentChange, yearHigh, yearLow] = item.d;

			if (!symbol || !price || price <= 0) continue;

			// Check 52-Week High Breakout
			if (yearHigh && yearHigh > 0 && price >= yearHigh) {
				allBreakouts.push({
					symbol: symbol.toUpperCase(),
					name: description || name || '',
					price,
					percentChange: percentChange || 0,
					yearHigh,
					yearLow: yearLow || 0,
					breakoutType: '52w_high'
				});
			}

			// Check 52-Week Low Breakdown
			if (yearLow && yearLow > 0 && price <= yearLow) {
				allBreakouts.push({
					symbol: symbol.toUpperCase(),
					name: description || name || '',
					price,
					percentChange: percentChange || 0,
					yearHigh: yearHigh || 0,
					yearLow,
					breakoutType: '52w_low'
				});
			}
		}
	} catch (error) {
		console.error('[MarketScanner] Error during TradingView scan:', error);
	}

	console.log(`[MarketScanner] Scan completed. Found ${allBreakouts.length} total breakouts/breakdowns.`);

	if (allBreakouts.length === 0) {
		return [];
	}

	// 2. Clear today's previous scans if any (to avoid duplicates on rerun)
	try {
		await db.prepare('DELETE FROM market_breakouts WHERE scan_date = ?1').bind(todayDate).run();
	} catch (e) {
		console.error('[MarketScanner] Error cleaning old breakouts:', e);
	}

	// 3. Batch insert breakouts into D1
	// We divide insertions into chunks of 100 to avoid D1 statement limits
	const chunkSize = 100;
	for (let i = 0; i < allBreakouts.length; i += chunkSize) {
		const chunk = allBreakouts.slice(i, i + chunkSize);
		const statements = chunk.map(b => {
			return db.prepare(`
				INSERT INTO market_breakouts (
					symbol, name, price, percent_change, year_high, year_low, breakout_type, scan_date
				) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
			`).bind(b.symbol, b.name, b.price, b.percentChange, b.yearHigh, b.yearLow, b.breakoutType, todayDate);
		});

		try {
			await db.batch(statements);
		} catch (error) {
			console.error('[MarketScanner] Batch insert failed:', error);
		}
	}

	// 4. Create notifications for watchlisted breakouts
	// In watchlist mode: every breakout is a watchlisted stock, create notifications directly
	// In market mode: cross-reference breakouts against watchlist
	try {
		const breakoutsToNotify: BreakoutResult[] = [];

		if (scope === 'watchlist') {
			// All breakouts are from watchlist — notify all
			breakoutsToNotify.push(...allBreakouts);
		} else {
			// Market mode: cross-reference with watchlist
			const watchlistRes = await db.prepare(`
				SELECT symbol FROM watchlist WHERE is_active = 1
			`).all();
			const watchlist = new Set((watchlistRes.results || []).map((r: any) => r.symbol.toUpperCase()));

			if (watchlist.size > 0) {
				for (const breakout of allBreakouts) {
					if (watchlist.has(breakout.symbol)) {
						breakoutsToNotify.push(breakout);
					}
				}
			}
		}

		for (const breakout of breakoutsToNotify) {
			// Check if already notified today
			const alreadyNotified = await db.prepare(`
				SELECT id FROM record_breaker_events 
				WHERE symbol = ?1 AND event_type = ?2 AND event_date = ?3
			`).bind(breakout.symbol, breakout.breakoutType, todayDate).first();

			if (!alreadyNotified) {
				console.log(`[MarketScanner] ALERT: Watchlisted stock ${breakout.symbol} triggered ${breakout.breakoutType}`);
				
				const isHigh = breakout.breakoutType === '52w_high';
				const message = isHigh
					? `${breakout.symbol} broke out to a new 52-week high of $${breakout.price} (${breakout.percentChange >= 0 ? '+' : ''}${breakout.percentChange.toFixed(2)}%)!`
					: `${breakout.symbol} broke down to a new 52-week low of $${breakout.price} (${breakout.percentChange >= 0 ? '+' : ''}${breakout.percentChange.toFixed(2)}%)!`;

				const previousRecord = isHigh ? breakout.yearHigh : breakout.yearLow;

				// Create transaction/batch for notification and event
				await db.batch([
					db.prepare(`
						INSERT INTO in_app_notifications (
							symbol, metric, condition_type, target_value, trigger_value, message, is_read, created_at
						) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, strftime('%s', 'now'))
					`).bind(
						breakout.symbol,
						breakout.breakoutType,
						isHigh ? 'breakout' : 'breakdown',
						previousRecord,
						breakout.price,
						message
					),
					db.prepare(`
						INSERT INTO record_breaker_events (
							symbol, event_type, price, previous_record, event_date, is_notified, created_at
						) VALUES (?1, ?2, ?3, ?4, ?5, 1, strftime('%s', 'now'))
					`).bind(
						breakout.symbol,
						breakout.breakoutType,
						breakout.price,
						previousRecord,
						todayDate
					)
				]);
			}
		}
	} catch (err) {
		console.error('[MarketScanner] Watchlist notification error:', err);
	}

	return allBreakouts;
}
