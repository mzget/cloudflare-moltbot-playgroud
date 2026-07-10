import { fetchExchangeQuotes } from './fmpClient';

export interface BreakoutResult {
	symbol: string;
	name: string;
	price: number;
	percentChange: number;
	yearHigh: number;
	yearLow: number;
	breakoutType: '52w_high' | '52w_low';
}

export async function scanMarketBreakouts(db: any, fmpApiKey: string): Promise<BreakoutResult[]> {
	console.log('[MarketScanner] Starting daily market breakout scan...');
	const exchanges = ['nasdaq', 'nyse', 'amex'];
	const allBreakouts: BreakoutResult[] = [];
	const todayDate = new Date().toISOString().split('T')[0];

	// 1. Fetch quotes from FMP for NASDAQ, NYSE, AMEX
	for (const exchange of exchanges) {
		try {
			console.log(`[MarketScanner] Fetching quotes for ${exchange}...`);
			const quotes = await fetchExchangeQuotes(fmpApiKey, exchange);
			console.log(`[MarketScanner] Received ${quotes.length} quotes for ${exchange}`);

			for (const quote of quotes) {
				const { symbol, name, price, changesPercentage, yearHigh, yearLow } = quote;

				if (!symbol || !price || price <= 0) continue;

				// Skip symbols that look like options or warrants (typically have '.' or '-' or length > 5)
				if (symbol.includes('.') || symbol.includes('-') || symbol.length > 5) continue;

				// Check 52-Week High Breakout
				if (yearHigh && yearHigh > 0 && price >= yearHigh) {
					allBreakouts.push({
						symbol: symbol.toUpperCase(),
						name: name || '',
						price,
						percentChange: changesPercentage || 0,
						yearHigh,
						yearLow: yearLow || 0,
						breakoutType: '52w_high'
					});
				}

				// Check 52-Week Low Breakdown
				if (yearLow && yearLow > 0 && price <= yearLow) {
					allBreakouts.push({
						symbol: symbol.toUpperCase(),
						name: name || '',
						price,
						percentChange: changesPercentage || 0,
						yearHigh: yearHigh || 0,
						yearLow,
						breakoutType: '52w_low'
					});
				}
			}
		} catch (error) {
			console.error(`[MarketScanner] Error scanning exchange ${exchange}:`, error);
		}
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

	// 4. Cross-reference with watchlist
	try {
		const watchlistRes = await db.prepare(`
			SELECT symbol FROM watchlist WHERE is_active = 1
		`).all();
		const watchlist = new Set((watchlistRes.results || []).map((r: any) => r.symbol.toUpperCase()));

		if (watchlist.size > 0) {
			for (const breakout of allBreakouts) {
				if (watchlist.has(breakout.symbol)) {
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
			}
		}
	} catch (err) {
		console.error('[MarketScanner] Watchlist cross-reference error:', err);
	}

	return allBreakouts;
}
